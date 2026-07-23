const { EventEmitter } = require('events');
const { PHASE, ROLE, TIMERS, TEAM } = require('./constants');
const { getRolesForGame, getRoleName } = require('./RoleConfig');

class GameEngine extends EventEmitter {
  constructor(roomCode, players, emit, maxPlayers = 6) {
    super();
    this.roomCode = roomCode;
    this.emit = emit;                    // callback to emit socket events
    this.players = players;              // [{ id, username, socketId, isAlive, isReady }]
    this.maxPlayers = maxPlayers;        // 6, 8, or 12
    this.roles = {};                     // { socketId: role }
    this.phase = PHASE.WAITING;
    this.phaseTimer = null;
    this.startTime = null;

    // Night action state
    this.nightActions = {};              // { socketId: { action, targetId } }
    this.guardLastProtected = null;      // socketId of last protected player
    this.witchSaveUsed = false;
    this.witchSaveTarget = null;         // socketId of player saved by witch
    this.witchPoisonUsed = false;
    this.killedByWerewolves = null;      // socketId of werewolf kill target
    this.killedByWitch = null;           // socketId of witch poison target

    // Vote state
    this.votes = {};                     // { voterSocketId: targetSocketId }
    this.nightCount = 0;
    
    // Hunter state
    this.hunterDied = false;             // Whether hunter died this phase
    this.hunterKilledByPoison = false;   // Whether hunter was killed by poison
    
    // Speaking state (turn-based)
    this.speakingOrder = [];             // Array of socketIds in speaking order
    this.currentSpeakerIndex = -1;       // Index of current speaker in speakingOrder
    this.hasSpoken = new Set();          // Set of socketIds that have spoken this round
    
    // Game history for replay
    this.gameHistory = [];               // [{ night, action, actor, target, detail }]
  }

  // ==================== Helpers ====================

  get alivePlayers() {
    return this.players.filter(p => p.isAlive);
  }

  getPlayer(socketId) {
    return this.players.find(p => p.socketId === socketId);
  }

  getRole(socketId) {
    return this.roles[socketId];
  }

  // Get seat number display string like "3号"
  getSeatNum(socketId) {
    const player = this.getPlayer(socketId);
    if (!player) return '未知';
    const num = (player.seatIndex !== undefined ? player.seatIndex : 0) + 1;
    return `${num}号`;
  }

  // Get targets array with seat numbers for prompts
  getTargetsForPrompt(playerList) {
    return playerList.map(p => ({
      id: p.socketId,
      username: this.getSeatNum(p.socketId),
      seatNum: this.getSeatNum(p.socketId),
    }));
  }

  broadcast(event, data) {
    this.emit(this.roomCode, event, data);
  }

  sendTo(socketId, event, data) {
    this.emit(socketId, event, data);
  }

  // ==================== Witch Notification ====================

  notifyWitch() {
    const witches = this.alivePlayers.filter(p => this.roles[p.socketId] === ROLE.WITCH);
    for (const w of witches) {
      if (!this.witchSaveUsed || !this.witchPoisonUsed) {
        const killedPlayer = this.killedByWerewolves ? this.getPlayer(this.killedByWerewolves) : null;
        this.sendTo(w.socketId, 'night_action_prompt', {
          action: 'witch',
          message: '请使用你的药水',
          killed: killedPlayer ? { id: killedPlayer.socketId, username: this.getSeatNum(killedPlayer.socketId) } : null,
          canSave: !this.witchSaveUsed && this.killedByWerewolves !== null,
          canPoison: !this.witchPoisonUsed,
          targets: this.alivePlayers.filter(p => p.socketId !== w.socketId)
            .map(p => ({ id: p.socketId, username: this.getSeatNum(p.socketId) })),
        });
      }
    }
  }

  // ==================== Game Start ====================

  start() {
    if (this.phase !== PHASE.WAITING) return;
    const readyPlayers = this.players.filter(p => p.isReady);
    if (readyPlayers.length < this.maxPlayers) return;

    // Assign roles
    const roleList = getRolesForGame(readyPlayers.length);
    readyPlayers.forEach((p, i) => {
      this.roles[p.socketId] = roleList[i];
    });

    // Mark all ready players as alive
    this.players.forEach(p => {
      p.isAlive = p.isReady;
    });

    this.nightCount = 0;
    this.startTime = Date.now();

    // Tell each player their role and seat number
    this.players.forEach(p => {
      if (p.isAlive) {
        const mySeatNum = this.getSeatNum(p.socketId);
        this.sendTo(p.socketId, 'game_started', {
          role: this.roles[p.socketId],
          roleName: getRoleName(this.roles[p.socketId]),
          seatNum: mySeatNum,
          seatIndex: p.seatIndex,
          players: this.players.map(pl => ({
            id: pl.socketId,
            username: pl.username,
            seatNum: this.getSeatNum(pl.socketId),
            seatIndex: pl.seatIndex,
            isAlive: pl.isAlive,
          })),
        });
      }
    });

    // Announce game start
    const playerList = this.alivePlayers.map(p => this.getSeatNum(p.socketId)).join('、');
    this.broadcast('chat_message', {
      username: '系统',
      message: `🎮 游戏开始！玩家：${playerList}，共${this.alivePlayers.length}人`,
      timestamp: Date.now(),
      isSystem: true,
    });

    // Start first night after a short delay
    setTimeout(() => this.startNight(), 3000);
  }

  // ==================== Phase Transitions ====================

  startNight() {
    this.nightCount++;
    this.phase = PHASE.NIGHT;
    this.nightActions = {};
    this.killedByWerewolves = null;
    this.killedByWitch = null;
    this.witchSaveTarget = null;

    const nightDuration = 120;

    this.broadcast('phase_change', {
      phase: PHASE.NIGHT,
      nightCount: this.nightCount,
      timeout: nightDuration,
      message: `🌙 第 ${this.nightCount} 夜来临，请闭眼...`,
    });

    // Night sub-phases handled sequentially
    this.runNightSequence();
  }

  async runNightSequence() {
    const alive = this.alivePlayers;

    // Wait for AI players to submit their night actions first
    const aiPlayers = alive.filter(p => p.isAI);
    if (aiPlayers.length > 0) {
      await this._waitForAINightActions(aiPlayers);
    }

    // 1. Guard protects (30 seconds)
    const guards = alive.filter(p => this.roles[p.socketId] === ROLE.GUARD);
    if (guards.length > 0) {
      this.broadcast('night_role_turn', {
        role: 'guard',
        roleName: '守卫',
        timeout: 30,
        message: '🛡️ 守卫行动阶段',
      });

      for (const g of guards) {
        this.sendTo(g.socketId, 'night_action_prompt', {
          action: 'guard',
          message: '请选择要守护的玩家',
          targets: alive.filter(p => p.socketId !== g.socketId && p.socketId !== this.guardLastProtected)
            .map(p => ({ id: p.socketId, username: this.getSeatNum(p.socketId) })),
          timeout: 30,
        });
      }
      await this._waitForRoleActions(guards, 'guard');
      
      this.broadcast('night_role_done', {
        role: 'guard',
        roleName: '守卫',
        message: '🛡️ 守卫行动结束',
      });
    }

    // 2. Werewolves kill (30 seconds)
    const werewolves = alive.filter(p => this.roles[p.socketId] === ROLE.WEREWOLF);
    const targets = alive.filter(p => this.roles[p.socketId] !== ROLE.WEREWOLF)
      .map(p => ({ id: p.socketId, username: this.getSeatNum(p.socketId) }));

    this.broadcast('night_role_turn', {
      role: 'werewolf',
      roleName: '狼人',
      timeout: 30,
      message: '🐺 狼人行动阶段',
    });

    for (const w of werewolves) {
      const teammates = werewolves.filter(p => p.socketId !== w.socketId)
        .map(p => ({ id: p.socketId, username: this.getSeatNum(p.socketId) }));
      this.sendTo(w.socketId, 'night_action_prompt', {
        action: 'kill',
        message: '请选择要击杀的目标',
        targets,
        teammates,
        isWerewolfTeam: true,
        timeout: 30,
      });
    }
    await this._waitForRoleActions(werewolves, 'kill');
    
    this.broadcast('night_role_done', {
      role: 'werewolf',
      roleName: '狼人',
      message: '🐺 狼人行动结束',
    });

    // Resolve werewolf vote - all werewolves must agree on the same target
    const werewolfActions = werewolves.filter(w => this.nightActions[w.socketId]?.action === 'kill');
    if (werewolfActions.length > 0) {
      const firstAction = this.nightActions[werewolfActions[0].socketId];
      const chosenTarget = firstAction.targetId;
      
      for (const w of werewolfActions) {
        this.nightActions[w.socketId].targetId = chosenTarget;
      }
      
      this.killedByWerewolves = chosenTarget;
    }

    // 3. Seer checks (30 seconds)
    const seers = alive.filter(p => this.roles[p.socketId] === ROLE.SEER);
    if (seers.length > 0) {
      this.broadcast('night_role_turn', {
        role: 'seer',
        roleName: '预言家',
        timeout: 30,
        message: '🔮 预言家行动阶段',
      });

      for (const s of seers) {
        this.sendTo(s.socketId, 'night_action_prompt', {
          action: 'check',
          message: '请选择要查验的玩家',
          targets: alive.filter(p => p.socketId !== s.socketId)
            .map(p => ({ id: p.socketId, username: this.getSeatNum(p.socketId) })),
          timeout: 30,
        });
      }
      await this._waitForRoleActions(seers, 'check');
      
      this.broadcast('night_role_done', {
        role: 'seer',
        roleName: '预言家',
        message: '🔮 预言家行动结束',
      });
    }

    // 4. Witch action (30 seconds)
    const witches = alive.filter(p => this.roles[p.socketId] === ROLE.WITCH);
    if (witches.length > 0) {
      this.broadcast('night_role_turn', {
        role: 'witch',
        roleName: '女巫',
        timeout: 30,
        message: '🧪 女巫行动阶段',
      });

      for (const w of witches) {
        const options = {
          action: 'witch',
          message: '请使用你的药水',
          killed: this.killedByWerewolves
            ? { id: this.killedByWerewolves, username: this.getSeatNum(this.killedByWerewolves) }
            : null,
          canSave: !this.witchSaveUsed && this.killedByWerewolves !== null,
          canPoison: !this.witchPoisonUsed,
          targets: alive.filter(p => p.socketId !== w.socketId)
            .map(p => ({ id: p.socketId, username: this.getSeatNum(p.socketId) })),
          timeout: 30,
        };
        this.sendTo(w.socketId, 'night_action_prompt', options);
      }
      await this._waitForRoleActions(witches, 'witch');
      
      this.broadcast('night_role_done', {
        role: 'witch',
        roleName: '女巫',
        message: '🧪 女巫行动结束',
      });
    }

    // Resolve night
    this.resolveNight();
  }

  _waitForRoleActions(players, actionType) {
    return new Promise((resolve) => {
      const humanPlayers = players.filter(p => !p.isAI);
      
      if (humanPlayers.length === 0) {
        resolve();
        return;
      }

      let completedCount = 0;
      const totalCount = humanPlayers.length;

      const checkComplete = () => {
        completedCount++;
        if (completedCount >= totalCount) {
          this.clearTimer();
          this.off('night_action', actionListener);
          resolve();
        }
      };

      const actionListener = (socketId, action) => {
        if (action.action === actionType || action.action === 'skip') {
          checkComplete();
        }
      };

      this.on('night_action', actionListener);

      this.clearTimer();
      this.phaseTimer = setTimeout(() => {
        this.off('night_action', actionListener);
        resolve();
      }, 30000);
    });
  }

  async _waitForAINightActions(aiPlayers) {
    const aiGameHandler = require('./AIGameHandler');
    
    const timeoutPromise = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    
    for (const aiPlayer of aiPlayers) {
      const role = this.getRole(aiPlayer.socketId);
      if (!role) continue;

      try {
        const action = await Promise.race([
          aiGameHandler._decideNightAction(this, aiPlayer, role),
          timeoutPromise(3000)
        ]);
        
        if (action) {
          this.submitNightAction(aiPlayer.socketId, action.action, action.targetId);
        } else {
          console.warn(`[GameEngine] AI night action timeout for ${aiPlayer.username}, using fallback`);
          const fallbackAction = aiGameHandler._getFallbackNightAction(this, aiPlayer, role);
          if (fallbackAction) {
            this.submitNightAction(aiPlayer.socketId, fallbackAction.action, fallbackAction.targetId);
          }
        }
      } catch (error) {
        console.error(`[GameEngine] AI night action error for ${aiPlayer.username}:`, error);
        const fallbackAction = aiGameHandler._getFallbackNightAction(this, aiPlayer, role);
        if (fallbackAction) {
          this.submitNightAction(aiPlayer.socketId, fallbackAction.action, fallbackAction.targetId);
        }
      }
    }
  }

  // ==================== Night Actions ====================

  submitNightAction(socketId, action, targetId) {
    if (this.phase !== PHASE.NIGHT) return;
    const player = this.getPlayer(socketId);
    if (!player || !player.isAlive) return;

    const target = this.getPlayer(targetId);
    
    // Store action (preserve first action for witch who can do both save+poison)
    if (!this.nightActions[socketId] || (action !== 'save' && action !== 'poison')) {
      this.nightActions[socketId] = { action, targetId };
    }
    
    let detail;
    if (action === 'skip') {
      detail = `${this.getSeatNum(socketId)} (${getRoleName(this.roles[socketId])}) 选择跳过`;
    } else {
      detail = `${this.getSeatNum(socketId)} (${getRoleName(this.roles[socketId])}) 选择了${target ? this.getSeatNum(targetId) : '未知'}`;
    }
    
    this.gameHistory.push({
      night: this.nightCount,
      action,
      actor: { id: socketId, username: this.getSeatNum(socketId), role: this.roles[socketId] },
      target: target ? { id: targetId, username: this.getSeatNum(targetId) } : null,
      detail,
    });

    this.emit('night_action', socketId, { action, targetId });

    switch (action) {
      case 'guard':
        this.guardLastProtected = targetId;
        break;

      case 'kill': {
        // Store the kill action
        break;
      }

      case 'check': {
        const targetRole = this.roles[targetId];
        const isWerewolf = targetRole === ROLE.WEREWOLF;
        this.sendTo(socketId, 'seer_result', {
          targetId,
          isWerewolf,
          message: isWerewolf ? '查验结果：狼人' : '查验结果：好人',
        });
        break;
      }

      case 'save':
        this.witchSaveTarget = this.killedByWerewolves;
        this.witchSaveUsed = true;
        this.notifyWitch(); // re-notify to hide save button
        break;

      case 'poison':
        this.killedByWitch = targetId;
        this.witchPoisonUsed = true;
        this.notifyWitch(); // re-notify to hide poison option
        break;
    }
  }

  // ==================== Resolve Night ====================

  resolveNight() {
    this.clearTimer();
    if (this.phase !== PHASE.NIGHT) return;

    const deaths = new Set();

    // Finalize werewolf vote if not already done
    if (!this.killedByWerewolves) {
      const werewolves = this.alivePlayers.filter(p => this.roles[p.socketId] === ROLE.WEREWOLF);
      const werewolfActions = werewolves.filter(w => this.nightActions[w.socketId]?.action === 'kill');
      if (werewolfActions.length > 0) {
        const tally = {};
        werewolfActions.forEach(w => {
          const t = this.nightActions[w.socketId].targetId;
          tally[t] = (tally[t] || 0) + 1;
        });
        const maxVotes = Math.max(...Object.values(tally));
        const topTargets = Object.entries(tally).filter(([, v]) => v === maxVotes);
        this.killedByWerewolves = topTargets[0][0];
      }
    }

    // Apply guard protection
    let protectedPlayer = null;
    if (this.guardLastProtected) {
      protectedPlayer = this.guardLastProtected;
    }

    // Apply werewolf kill with guard protection and witch save
    if (this.killedByWerewolves) {
      const wasProtected = this.killedByWerewolves === protectedPlayer;
      const wasSaved = this.witchSaveTarget === this.killedByWerewolves;
      
      // 同守同救规则：守卫守护 + 女巫救 = 死亡
      if (!wasProtected && !wasSaved) {
        deaths.add(this.killedByWerewolves);
      } else if (wasProtected && wasSaved) {
        deaths.add(this.killedByWerewolves);
      }
      // 其他情况：只被守卫守护或只被女巫救，目标存活
    }

    // Apply witch poison
    if (this.killedByWitch) {
      deaths.add(this.killedByWitch);
    }

    // Kill players
    const deathList = [];
    for (const socketId of deaths) {
      const player = this.getPlayer(socketId);
      if (player) {
        player.isAlive = false;
        deathList.push({ id: socketId, username: this.getSeatNum(socketId), role: this.roles[socketId] });
      }
    }

    const nightMessage = deathList.length === 0 ? '🌅 天亮了，昨晚是平安夜' : `🌅 天亮了，昨晚 ${deathList.map(d => d.username).join('、')} 死亡`;
    
    this.broadcast('night_result', {
      deaths: deathList.map(d => ({ id: d.id, username: d.username })),
      saved: !!protectedPlayer && this.killedByWerewolves === protectedPlayer,
      message: nightMessage,
      guardProtected: protectedPlayer ? this.getSeatNum(protectedPlayer) : null,
    });

    this.broadcast('chat_message', {
      username: '系统',
      message: nightMessage,
      timestamp: Date.now(),
      isSystem: true,
    });

    const nightDetail = deathList.length > 0
      ? `夜晚结束，${deathList.map(d => d.username).join('、')}死亡`
      : '夜晚结束，平安夜';

    this.gameHistory.push({
      night: this.nightCount,
      action: 'night_end',
      deaths: deathList.map(d => ({ id: d.id, username: d.username, role: d.role })),
      saved: !!protectedPlayer && this.killedByWerewolves === protectedPlayer,
      guardProtected: protectedPlayer ? { id: protectedPlayer, username: this.getSeatNum(protectedPlayer) } : null,
      killedByWerewolves: this.killedByWerewolves ? { id: this.killedByWerewolves, username: this.getSeatNum(this.killedByWerewolves) } : null,
      killedByWitch: this.killedByWitch ? { id: this.killedByWitch, username: this.getSeatNum(this.killedByWitch) } : null,
      witchSaved: this.witchSaveTarget ? { id: this.witchSaveTarget, username: this.getSeatNum(this.witchSaveTarget) } : null,
      detail: nightDetail,
    });

    // Check for hunter death trigger
    let hunterDeath = null;
    let hunterKilledByPoison = false;
    
    for (const d of deathList) {
      if (d.role === ROLE.HUNTER) {
        hunterDeath = d;
        hunterKilledByPoison = this.killedByWitch === d.id;
        break;
      }
    }

    // Hunter shooting: can only shoot if not killed by poison
    if (hunterDeath && !hunterKilledByPoison) {
      const aliveAfterNight = this.alivePlayers;
      if (aliveAfterNight.length > 0) {
        // Send hunter trigger
        this.sendTo(hunterDeath.id, 'hunter_trigger', {
          message: '你已被杀，请选择带走一名玩家',
          targets: aliveAfterNight.map(p => ({ id: p.socketId, username: this.getSeatNum(p.socketId) })),
        });
        
        // Wait for hunter action or auto-shoot after timeout
        this.clearTimer();
        this.phaseTimer = setTimeout(() => {
          this._executeHunterShoot(hunterDeath.id);
        }, 10000);
        
        return; // Wait for hunter action
      }
    }

    // Check win condition
    if (this.checkWinCondition()) return;

    // Transition to day
    setTimeout(() => this.startDay(), 2000);
  }

  // ==================== Hunter Shooting ====================

  _executeHunterShoot(hunterId) {
    const hunter = this.getPlayer(hunterId);
    const aliveAfterNight = this.alivePlayers;
    
    if (!hunter || aliveAfterNight.length === 0) {
      this._continueAfterHunter();
      return;
    }
    
    // Auto-shoot a random player if hunter didn't choose
    const randomTarget = aliveAfterNight[Math.floor(Math.random() * aliveAfterNight.length)];
    
    // Kill the target
    randomTarget.isAlive = false;
    
    this.gameHistory.push({
      night: this.nightCount,
      action: 'hunter_shoot',
      actor: { id: hunterId, username: this.getSeatNum(hunterId), role: ROLE.HUNTER },
      target: { id: randomTarget.socketId, username: this.getSeatNum(randomTarget.socketId) },
      detail: `${this.getSeatNum(hunterId)}开枪带走了${this.getSeatNum(randomTarget.socketId)}`,
    });

    // Notify everyone
    this.broadcast('hunter_result', {
      shooter: { id: hunterId, username: this.getSeatNum(hunterId) },
      target: { id: randomTarget.socketId, username: this.getSeatNum(randomTarget.socketId) },
      message: `${this.getSeatNum(hunterId)}开枪带走了${this.getSeatNum(randomTarget.socketId)}`,
    });
    
    this._continueAfterHunter();
  }
  
  _continueAfterHunter() {
    // Check win condition after hunter shooting
    if (this.checkWinCondition()) return;
    
    // Transition to day
    setTimeout(() => this.startDay(), 2000);
  }

  // ==================== Day Phase ====================

  startDay() {
    this.phase = PHASE.DAY;

    const alive = this.alivePlayers;
    this.speakingOrder = alive.map(p => p.socketId);
    this.currentSpeakerIndex = 0;
    this.hasSpoken = new Set();

    this._skipDeadSpeakers();

    this.broadcast('phase_change', {
      phase: PHASE.DAY,
      timeout: TIMERS.DAY,
      message: '天亮了，按顺序发言',
      currentSpeaker: this.speakingOrder[this.currentSpeakerIndex],
      speakerName: this.getSeatNum(this.speakingOrder[this.currentSpeakerIndex]),
    });

    this.clearTimer();

    const currentSpeaker = this.speakingOrder[this.currentSpeakerIndex];
    if (currentSpeaker) {
      const speakerPlayer = this.getPlayer(currentSpeaker);
      if (speakerPlayer && speakerPlayer.isAI) {
        setTimeout(() => this._triggerAISpeaking(currentSpeaker), 1000);
      }
    }
  }

  _skipDeadSpeakers() {
    const aliveSpeakers = this.speakingOrder.filter(socketId => {
      const player = this.getPlayer(socketId);
      return player && player.isAlive !== false;
    });
    
    if (aliveSpeakers.length > 0) {
      this.speakingOrder = aliveSpeakers;
      
      if (this.currentSpeakerIndex >= this.speakingOrder.length) {
        this.currentSpeakerIndex = 0;
      }
    }
  }

  async _triggerAISpeaking(socketId) {
    const aiGameHandler = require('./AIGameHandler');
    const player = this.getPlayer(socketId);
    if (!player || !player.isAI) return;

    try {
      const timeoutPromise = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      
      let message = await Promise.race([
        aiGameHandler._generateChatMessage(this, player),
        timeoutPromise(5000)
      ]);

      if (!message || !message.trim()) {
        message = aiGameHandler._getFallbackChatMessage(this, player);
      }

      message = this._ensureMessageLength(message, player);

      this.broadcast('chat_message', {
        username: this.getSeatNum(socketId),
        message: message,
        timestamp: Date.now(),
      });

      setTimeout(() => this.nextSpeaker(), 5000);
    } catch (error) {
      console.error(`[GameEngine] AI speaking error for ${player.username}:`, error);
      const fallbackMessage = aiGameHandler._getFallbackChatMessage(this, player);
      const finalMessage = this._ensureMessageLength(fallbackMessage, player);
      
      this.broadcast('chat_message', {
        username: this.getSeatNum(socketId),
        message: finalMessage,
        timestamp: Date.now(),
      });

      setTimeout(() => this.nextSpeaker(), 5000);
    }
  }

  _ensureMessageLength(message, player) {
    if (!message) message = '';
    
    const trimmed = message.trim();
    
    if (trimmed.length >= 30 && trimmed.length <= 50) {
      return trimmed;
    }
    
    if (trimmed.length > 50) {
      return trimmed.substring(0, 50).replace(/，$/, '').replace(/。$/, '') + '。';
    }
    
    const role = this.getRole(player.socketId);
    const roleName = getRoleName(role);
    
    const extensions = {
      [ROLE.WEREWOLF]: [
        ' 大家仔细分析一下局势。',
        ' 我觉得我们需要谨慎投票。',
        ' 希望好人能做出正确的判断。',
        ' 狼人肯定会伪装成好人。',
        ' 大家不要被表面现象迷惑。',
      ],
      [ROLE.SEER]: [
        ' 请大家相信我的查验结果。',
        ' 今晚我会继续查验其他人。',
        ' 好人阵营需要我的信息。',
        ' 狼人一定会质疑我，大家别上当。',
        ' 希望大家能跟我一起投票。',
      ],
      [ROLE.WITCH]: [
        ' 我手里还有一瓶毒药。',
        ' 大家小心狼人乱跳身份。',
        ' 我会根据情况使用毒药。',
        ' 希望好人能保护好自己。',
        ' 今晚我会谨慎使用技能。',
      ],
      [ROLE.GUARD]: [
        ' 今晚我会守护关键人物。',
        ' 大家放心，我会保护好人。',
        ' 狼人别想轻易得手。',
        ' 我会根据局势决定守护谁。',
        ' 好人阵营需要我的守护。',
      ],
      [ROLE.HUNTER]: [
        ' 有枪在手，狼人小心点。',
        ' 谁敢出我，我就带走谁。',
        ' 我的身份很硬，大家别乱投。',
        ' 狼人别想轻易把我弄出去。',
        ' 我会根据情况开枪。',
      ],
      [ROLE.VILLAGER]: [
        ' 希望预言家能给点信息。',
        ' 我只能跟着大家的节奏走。',
        ' 请好人带领我们找出狼人。',
        ' 我完全相信好人阵营。',
        ' 大家一起加油找出狼人。',
      ],
    };
    
    const roleExtensions = extensions[role] || extensions[ROLE.VILLAGER];
    let result = trimmed;
    
    while (result.length < 30) {
      const extension = roleExtensions[Math.floor(Math.random() * roleExtensions.length)];
      if (!result.endsWith(extension.replace(/。$/, ''))) {
        if (!result.endsWith('。') && !result.endsWith('，')) {
          result += '，';
        }
        result += extension.replace(/^ /, '');
      }
    }
    
    if (result.length > 50) {
      result = result.substring(0, 50).replace(/，$/, '').replace(/。$/, '') + '。';
    }
    
    return result;
  }

  skipToVote() {
    if (this.phase !== PHASE.DAY) return;
    this.clearTimer();
    this.startVote();
  }

  nextSpeaker() {
    if (this.phase !== PHASE.DAY) return;

    this.hasSpoken.add(this.speakingOrder[this.currentSpeakerIndex]);

    if (this.hasSpoken.size >= this.speakingOrder.length) {
      this.clearTimer();
      this.startVote();
      return;
    }
    
    this.currentSpeakerIndex++;
    if (this.currentSpeakerIndex >= this.speakingOrder.length) {
      this.currentSpeakerIndex = 0;
    }

    this._skipDeadSpeakers();
    
    const currentSpeaker = this.speakingOrder[this.currentSpeakerIndex];
    
    this.broadcast('speaker_change', {
      currentSpeaker,
      speakerName: this.getSeatNum(currentSpeaker),
      hasSpoken: Array.from(this.hasSpoken),
    });

    if (currentSpeaker) {
      const speakerPlayer = this.getPlayer(currentSpeaker);
      if (speakerPlayer && speakerPlayer.isAI) {
        setTimeout(() => this._triggerAISpeaking(currentSpeaker), 1000);
      }
    }
  }

  skipSpeaking() {
    if (this.phase !== PHASE.DAY) return;
    
    const currentSpeaker = this.speakingOrder[this.currentSpeakerIndex];
    this.hasSpoken.add(currentSpeaker);

    if (this.hasSpoken.size >= this.speakingOrder.length) {
      this.clearTimer();
      this.startVote();
      return;
    }
    
    this.currentSpeakerIndex++;
    if (this.currentSpeakerIndex >= this.speakingOrder.length) {
      this.currentSpeakerIndex = 0;
    }

    this._skipDeadSpeakers();
    
    const nextSpeaker = this.speakingOrder[this.currentSpeakerIndex];
    
    this.broadcast('speaker_change', {
      currentSpeaker: nextSpeaker,
      speakerName: this.getSeatNum(nextSpeaker),
      hasSpoken: Array.from(this.hasSpoken),
    });

    if (nextSpeaker) {
      const speakerPlayer = this.getPlayer(nextSpeaker);
      if (speakerPlayer && speakerPlayer.isAI) {
        setTimeout(() => this._triggerAISpeaking(nextSpeaker), 1000);
      }
    }
  }

  // ==================== Vote Phase ====================

  async startVote() {
    this.phase = PHASE.VOTE;
    this.votes = {};

    const alive = this.alivePlayers;

    // Wait for AI players to submit their votes first
    const aiPlayers = alive.filter(p => p.isAI);
    if (aiPlayers.length > 0) {
      await this._waitForAIVotes(aiPlayers);
    }

    this.broadcast('phase_change', {
      phase: PHASE.VOTE,
      timeout: TIMERS.VOTE,
      message: '投票阶段，请选择要放逐的玩家',
      candidates: alive.map(p => ({ id: p.socketId, username: this.getSeatNum(p.socketId) })),
    });

    this.clearTimer();
    this.phaseTimer = setTimeout(() => this.resolveVote(), TIMERS.VOTE * 1000);
  }

  async _waitForAIVotes(aiPlayers) {
    const aiGameHandler = require('./AIGameHandler');
    
    const timeoutPromise = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    
    for (const aiPlayer of aiPlayers) {
      try {
        const voteTarget = await Promise.race([
          aiGameHandler._decideVote(this, aiPlayer),
          timeoutPromise(3000)
        ]);
        
        if (voteTarget) {
          this.submitVote(aiPlayer.socketId, voteTarget);
        } else {
          console.warn(`[GameEngine] AI vote timeout for ${aiPlayer.username}, using fallback`);
          const fallbackTarget = aiGameHandler._getFallbackVote(this, aiPlayer);
          if (fallbackTarget) {
            this.submitVote(aiPlayer.socketId, fallbackTarget);
          }
        }
      } catch (error) {
        console.error(`[GameEngine] AI vote error for ${aiPlayer.username}:`, error);
        const fallbackTarget = aiGameHandler._getFallbackVote(this, aiPlayer);
        if (fallbackTarget) {
          this.submitVote(aiPlayer.socketId, fallbackTarget);
        }
      }
    }
  }

  submitVote(socketId, targetId) {
    if (this.phase !== PHASE.VOTE) return;
    const voter = this.getPlayer(socketId);
    if (!voter || !voter.isAlive) return;
    
    const target = this.getPlayer(targetId);

    this.votes[socketId] = targetId;
    
    this.gameHistory.push({
      night: this.nightCount,
      action: 'vote',
      actor: { id: socketId, username: this.getSeatNum(socketId), role: this.roles[socketId] },
      target: target ? { id: targetId, username: this.getSeatNum(targetId) } : null,
      detail: `${this.getSeatNum(socketId)}投票给了${target ? this.getSeatNum(targetId) : '未知'}`,
    });

    // Notify all of vote progress (without revealing who voted for whom)
    this.broadcast('vote_update', {
      votedCount: Object.keys(this.votes).length,
      totalCount: this.alivePlayers.length,
    });
  }

  resolveVote() {
    this.clearTimer();
    if (this.phase !== PHASE.VOTE) return;

    const alive = this.alivePlayers;
    const tally = {};

    for (const [voterId, targetId] of Object.entries(this.votes)) {
      if (alive.find(p => p.socketId === voterId)) {
        tally[targetId] = (tally[targetId] || 0) + 1;
      }
    }

    // Find max votes
    let maxVotes = 0;
    let eliminated = null;
    const voteDetails = Object.entries(tally).map(([id, count]) => {
      return { id, username: this.getSeatNum(id), votes: count };
    });

    for (const [id, count] of Object.entries(tally)) {
      if (count > maxVotes) {
        maxVotes = count;
        eliminated = id;
      } else if (count === maxVotes) {
        eliminated = null; // tie
      }
    }

    let eliminatedPlayer = null;
    if (eliminated && maxVotes > 0) {
      eliminatedPlayer = this.getPlayer(eliminated);
      if (eliminatedPlayer) {
        eliminatedPlayer.isAlive = false;
      }
    }

    const result = {
      eliminated: eliminatedPlayer
        ? { id: eliminatedPlayer.socketId, username: this.getSeatNum(eliminatedPlayer.socketId), role: this.roles[eliminatedPlayer.socketId] }
        : null,
      votes: voteDetails,
      message: eliminatedPlayer
        ? `${this.getSeatNum(eliminatedPlayer.socketId)} 被放逐出局`
        : '平票，没有人被放逐',
    };

    this.broadcast('vote_result', result);

    this.broadcast('chat_message', {
      username: '系统',
      message: `🗳️ ${result.message}`,
      timestamp: Date.now(),
      isSystem: true,
    });

    // Check win condition
    if (this.checkWinCondition()) return;

    // Back to night
    setTimeout(() => this.startNight(), 3000);
  }

  // ==================== Win Condition ====================

  checkWinCondition() {
    const aliveWerewolves = this.alivePlayers.filter(
      p => this.roles[p.socketId] === ROLE.WEREWOLF
    ).length;

    const aliveVillagers = this.alivePlayers.filter(
      p => this.roles[p.socketId] !== ROLE.WEREWOLF
    ).length;

    if (aliveWerewolves === 0) {
      this.endGame('villager', '所有狼人已被消灭，村民阵营获胜！');
      return true;
    }

    if (aliveWerewolves >= aliveVillagers) {
      this.endGame('werewolf', '狼人数量不少于村民，狼人阵营获胜！');
      return true;
    }

    return false;
  }

  // ==================== Game End ====================

  endGame(winner, message) {
    this.clearTimer();
    this.phase = PHASE.END;

    const duration = this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0;

    const result = this.players.map(p => ({
      id: p.socketId,
      username: this.getSeatNum(p.socketId),
      role: this.roles[p.socketId],
      roleName: getRoleName(this.roles[p.socketId]),
      isAlive: p.isAlive,
      isWinner: TEAM[this.roles[p.socketId]] === winner,
      seatIndex: p.seatIndex,
    }));

    this.broadcast('game_over', {
      winner,
      message,
      duration,
      players: result,
    });

    // Return game result for persistence
    this.emit(this.roomCode, '__game_result', {
      roomCode: this.roomCode,
      winner,
      playerCount: this.players.filter(p => this.roles[p.socketId]).length,
      duration,
      players: result,
      history: this.gameHistory,
    });
    
    // Generate replay message
    const replayMsg = this.generateReplayMessage(result, winner, message);
    this.emit(this.roomCode, '__game_replay', {
      roomCode: this.roomCode,
      message: replayMsg,
    });
  }
  
  generateReplayMessage(players, winner, message) {
    let replay = `--- 🎮 上一轮复盘 ---
${message}

👥 身份揭晓：`;
    
    const werewolves = players.filter(p => p.role === ROLE.WEREWOLF);
    const villagers = players.filter(p => p.role !== ROLE.WEREWOLF);
    
    if (werewolves.length > 0) {
      replay += `
🐺 狼人：${werewolves.map(p => p.username).join('、')}`;
    }
    
    const seer = players.find(p => p.role === ROLE.SEER);
    if (seer) {
      replay += `
🔮 预言家：${seer.username}`;
    }
    
    const witch = players.find(p => p.role === ROLE.WITCH);
    if (witch) {
      replay += `
🧪 女巫：${witch.username}`;
    }
    
    const guard = players.find(p => p.role === ROLE.GUARD);
    if (guard) {
      replay += `
🛡️ 守卫：${guard.username}`;
    }
    
    const hunter = players.find(p => p.role === ROLE.HUNTER);
    if (hunter) {
      replay += `
🔫 猎人：${hunter.username}`;
    }
    
    const civilians = villagers.filter(p => p.role === ROLE.VILLAGER);
    if (civilians.length > 0) {
      replay += `
👤 平民：${civilians.map(p => p.username).join('、')}`;
    }
    
    replay += `

🏆 胜负结果：`;
    const winners = players.filter(p => p.isWinner);
    const losers = players.filter(p => !p.isWinner);
    
    replay += `
胜利方：${winners.map(p => p.username).join('、')}
失败方：${losers.map(p => p.username).join('、')}`;
    
    if (this.gameHistory.length > 0) {
      replay += `

📜 行动记录：`;
      let currentNight = -1;
      this.gameHistory.forEach(h => {
        if (h.night !== currentNight) {
          currentNight = h.night;
          replay += `\n🌙 第${currentNight}夜：`;
        }
        const detail = h.detail || `${h.action || '未知行动'}${h.actor?.username ? ' - ' + h.actor.username : ''}`;
        replay += `\n  - ${detail}`;
      });
    }
    
    replay += `

----------------------`;
    
    return replay;
  }

  // ==================== Cleanup ====================

  clearTimer() {
    if (this.phaseTimer) {
      clearTimeout(this.phaseTimer);
      this.phaseTimer = null;
    }
  }

  destroy() {
    this.clearTimer();
    this.players = [];
    this.roles = {};
    this.nightActions = {};
    this.votes = {};
  }
}

module.exports = GameEngine;

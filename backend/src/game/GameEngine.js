const { EventEmitter } = require('events');
const { PHASE, ROLE, TIMERS, TEAM } = require('./constants');
const { getRolesForGame, getRoleName } = require('./RoleConfig');

class GameEngine extends EventEmitter {
  constructor(roomCode, players, emit, maxPlayers = 6) {
    super();
    // W4: allow more listeners (AI + timers + night_action listeners)
    this.setMaxListeners(20);
    this.roomCode = roomCode;
    this.emit = emit;                    // callback to emit socket events
    this.players = players;              // [{ id, username, socketId, isAlive, isReady }]
    this.maxPlayers = maxPlayers;        // 6, 8, or 12
    this.roles = {};                     // { socketId: role }
    this.phase = PHASE.WAITING;
    this.phaseTimer = null;
    this.startTime = null;

    // 夜晚、投票、发言等状态都集中在这里，便于统一推进。
    this.nightActions = {};              // { socketId: { action, targetId } }
    this.guardLastProtected = null;      // socketId of last protected player
    this.witchSaveUsed = false;
    this.witchSaveTarget = null;         // socketId of player saved by witch
    this.witchPoisonUsed = false;
    this.killedByWerewolves = null;      // socketId of werewolf kill target
    this.killedByWitch = null;           // socketId of witch poison target

    // 投票阶段的 PK 变量，用来处理平票后的加赛。
    this.votes = {};                     // { voterSocketId: targetSocketId }
    this.nightCount = 0;
    this.pkRound = 0;                    // C3: PK (tie-break) vote round counter
    this.pkCandidates = [];              // C3: candidates restricted during PK
    
    // 猎人死亡后的开枪控制状态。
    this.hunterDied = false;             // Whether hunter died this phase
    this.hunterKilledByPoison = false;   // Whether hunter was killed by poison
    this.pendingHunterId = null;         // socketId of hunter currently pending shoot (C7 guard)
    
    // 白天轮流发言阶段使用的顺序和游标。
    this.speakingOrder = [];             // Array of socketIds in speaking order
    this.currentSpeakerIndex = -1;       // Index of current speaker in speakingOrder
    this.currentSpeaker = null;          // socketId of current speaker (for reconnection)
    this.hasSpoken = new Set();          // Set of socketIds that have spoken this round

    // 这些字段主要用于重连恢复，不驱动主流程。
    this.candidates = [];                // Candidates array for vote phase
    this.lastPhaseMessage = '';          // Last phase message (for reconnection)
    
    // 对局回放数据，记录每轮关键事件。
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

    // 开局前先确认房间人数和准备状态，再分配角色。
    const roleList = getRolesForGame(readyPlayers.length);
    readyPlayers.forEach((p, i) => {
      const role = roleList[i];
      this.roles[p.socketId] = role;
      p.role = role; // Persist role on player object for reliable reconnect recovery
    });

    // 把角色写到玩家对象上，便于重连恢复。
    this.players.forEach(p => {
      p.isAlive = p.isReady;
    });

    this.nightCount = 0;
    this.startTime = Date.now();

    // 所有已准备玩家统一标记为存活。
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

    // 单独通知每个玩家自己的身份和座位号。
    const playerList = this.alivePlayers.map(p => this.getSeatNum(p.socketId)).join('、');
    this.broadcast('chat_message', {
      username: '系统',
      message: `🎮 游戏开始！玩家：${playerList}，共${this.alivePlayers.length}人`,
      timestamp: Date.now(),
      isSystem: true,
    });

    // 广播开局公告，让全房间都知道游戏开始。
    setTimeout(() => this.startNight(), 3000);
  }

  // ==================== Phase Transitions ====================

  startNight() {
    // 稍作延迟后进入首夜，给客户端留出展示时间。
    this.nightCount++;
    this.phase = PHASE.NIGHT;
    this.nightActions = {};
    this.killedByWerewolves = null;
    this.killedByWitch = null;
    this.witchSaveTarget = null;

    const nightDuration = 120;

    this.lastPhaseMessage = `🌙 第 ${this.nightCount} 夜来临，请闭眼...`;
    this.currentSpeaker = null;
    this.candidates = [];

    this.broadcast('phase_change', {
      phase: PHASE.NIGHT,
      nightCount: this.nightCount,
      timeout: nightDuration,
      message: this.lastPhaseMessage,
    });

    // 夜晚阶段不是一个动作，而是按角色顺序串行推进。
    this.runNightSequence();
  }

  async runNightSequence() {
    // W3: total night budget of 150s; force-resolve if exceeded
    const nightBudgetMs = 150000;
    let timeoutHandle;
    const timeoutPromise = new Promise((resolve) => {
      timeoutHandle = setTimeout(() => {
        console.warn(`[GameEngine] Night sequence timed out after ${nightBudgetMs}ms, forcing resolveNight`);
        resolve('timeout');
      }, nightBudgetMs);
    });

    const result = await Promise.race([
      this._runNightSequenceInner(),
      timeoutPromise,
    ]);

    clearTimeout(timeoutHandle);

    if (result === 'timeout' && this.phase === PHASE.NIGHT) {
      this.resolveNight();
    }
  }

  async _runNightSequenceInner() {
    const alive = this.alivePlayers;

    // AI 先提交夜间动作，避免真人等待时 AI 仍未就绪。
    const aiPlayers = alive.filter(p => p.isAI);
    if (aiPlayers.length > 0) {
      await this._waitForAINightActions(aiPlayers);
    }

    // 1. 守卫先行动。
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

    // 2. 狼人按多数票刀人。
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

    // Resolve werewolf vote by majority (C2: no longer force-override each wolf's choice)
    // Individual werewolf votes are preserved; the kill target is the majority winner.
    // If tied, resolveNight will pick the first top target (and could randomize later).
    const werewolfActions = werewolves.filter(w => this.nightActions[w.socketId]?.action === 'kill');
    if (werewolfActions.length > 0) {
      const tally = {};
      werewolfActions.forEach(w => {
        const t = this.nightActions[w.socketId].targetId;
        if (t) tally[t] = (tally[t] || 0) + 1;
      });
      const maxVotes = Math.max(...Object.values(tally));
      const topTargets = Object.entries(tally).filter(([, v]) => v === maxVotes);
      if (topTargets.length > 0) {
        this.killedByWerewolves = topTargets[0][0];
      }
    }

    // 3. 预言家查验身份。
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

    // 4. 女巫决定救人或独人。
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

    // 夜晚的所有子阶段结束后，统一进入结算。
    this.resolveNight();
  }

  _waitForRoleActions(players, actionType) {
    // 等待这一类角色提交完动作，或者超时自动继续。
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
    // 夜间动作入口，所有动作都先在这里做合法性校验。
    if (this.phase !== PHASE.NIGHT) return;
    const player = this.getPlayer(socketId);
    if (!player || !player.isAlive) return;

    const role = this.roles[socketId];
    const target = this.getPlayer(targetId);

    // C1: role-based validation (defense-in-depth; AI calls this directly)
    if (action === 'save' && this.witchSaveUsed) return;            // witch save already used
    if (action === 'poison' && this.witchPoisonUsed) return;        // witch poison already used
    if (action === 'guard' && targetId && targetId === this.guardLastProtected) {
      // Guard cannot protect the same player on consecutive nights
      return;
    }
    if (action === 'kill' && target && this.roles[target.socketId] === ROLE.WEREWOLF) {
      // Werewolves cannot target a teammate
      return;
    }

    // 女巫可能同时救人和独人，所以 save / poison 要特殊处理。
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
        break;

      case 'poison':
        this.killedByWitch = targetId;
        this.witchPoisonUsed = true;
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
        deathList.push({ id: socketId, username: this.getSeatNum(socketId), role: this.roles[socketId], socketId: socketId });
      }
    }

    // Save dead players for last will phase
    this.lastWillDeadPlayers = deathList.map(d => {
      const player = this.getPlayer(d.socketId);
      return player;
    }).filter(p => p);

    console.log(`[GameEngine] Night deaths: ${deathList.map(d => d.username).join(', ')}. Last will players: ${this.lastWillDeadPlayers?.length || 0}`);

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

    // 猎人死亡后，进入开枪分支。
    let hunterDeath = null;
    let hunterKilledByPoison = false;
    
    for (const d of deathList) {
      if (d.role === ROLE.HUNTER) {
        hunterDeath = d;
        hunterKilledByPoison = this.killedByWitch === d.id;
        break;
      }
    }

    // 猎人被刀但没被毒时，可以开枪；被毒死则不能开枪。
    if (hunterDeath && !hunterKilledByPoison) {
      const aliveAfterNight = this.alivePlayers;
      if (aliveAfterNight.length > 0) {
        // Mark pending hunter so only this socket may shoot (C7)
        this.pendingHunterId = hunterDeath.id;
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
    } else if (hunterDeath && hunterKilledByPoison) {
      // C4: hunter was poisoned — cannot shoot, only broadcast a notice
      this.broadcast('chat_message', {
        username: '系统',
        message: `☠️ ${hunterDeath.username} 被毒杀，无法开枪`,
        timestamp: Date.now(),
        isSystem: true,
      });
    }

    // 夜晚结算完成后，先判胜负。
    if (this.checkWinCondition()) return;

    // 没有结束则进入白天。
    setTimeout(() => this.startDay(), 2000);
  }

  // ==================== Hunter Shooting ====================

  _executeHunterShoot(hunterId) {
    const hunter = this.getPlayer(hunterId);
    const aliveAfterNight = this.alivePlayers;

    // Clear pending state regardless of outcome (C7)
    this.pendingHunterId = null;

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
    // 猎人分支结束，清理 pending 状态，避免重复触发。
    // ????????? pending ??????????
    this.pendingHunterId = null;
    // 猎人开枪可能改变胜负关系，所以要再次检查。
    if (this.checkWinCondition()) return;

    // 猎人流程走完后再转白天。
    setTimeout(() => this.startDay(), 2000);
  }

  // ==================== Discussion Phase ====================

  startFreeDiscussion() {
    // 自由讨论阶段，所有存活玩家都可以发言。
    this.phase = PHASE.DISCUSSION;
    this.lastPhaseMessage = '自由讨论阶段，所有人可以发言';

    this.broadcast('phase_change', {
      phase: PHASE.DISCUSSION,
      timeout: TIMERS.DISCUSSION,
      message: this.lastPhaseMessage,
    });

    this.broadcast('chat_message', {
      username: '系统',
      message: `💬 自由讨论阶段开始，所有人可以发言（${TIMERS.DISCUSSION}秒）`,
      timestamp: Date.now(),
      isSystem: true,
    });

    // AI 会在自由讨论阶段自动插话，模拟真实聊天。
    const allAlive = this.alivePlayers;
    const aiPlayers = allAlive.filter(p => p.isAI);
    console.log(`[GameEngine] Free discussion: ${allAlive.length} alive players, ${aiPlayers.length} AI players`);
    console.log(`[GameEngine] AI players:`, aiPlayers.map(p => ({ username: p.username, isAI: p.isAI, alive: p.isAlive })));
    
    if (aiPlayers.length > 0) {
      this._triggerAIFreeDiscussion(aiPlayers);
    } else {
      console.warn('[GameEngine] No AI players found for free discussion');
    }

    this.clearTimer();
    this.phaseTimer = setTimeout(() => this.startOrderedSpeaking(), TIMERS.DISCUSSION * 1000);
  }

  _triggerAIFreeDiscussion(aiPlayers) {
    const aiGameHandler = require('./AIGameHandler');

    console.log(`[GameEngine] Starting AI free discussion for ${aiPlayers.length} AI players`);

    // Launch all AI players in parallel with independent random delays
    // Each AI speaks 1-2 times during the discussion period
    const aiPromises = aiPlayers.map((aiPlayer, index) => {
      return new Promise(async (resolve) => {
        try {
          // First message: delay 2-8 seconds
          const firstDelay = 2000 + Math.random() * 6000;
          console.log(`[GameEngine] AI ${aiPlayer.username} first speak after ${(firstDelay / 1000).toFixed(1)}s`);
          
          await new Promise(r => setTimeout(r, firstDelay));

          // Check if still in discussion phase
          if (this.phase !== PHASE.DISCUSSION) {
            console.log(`[GameEngine] Phase changed, AI ${aiPlayer.username} skipping`);
            resolve();
            return;
          }

          // Check if player is still alive
          if (!aiPlayer.isAlive) {
            console.log(`[GameEngine] AI ${aiPlayer.username} is dead, skipping`);
            resolve();
            return;
          }

          // Generate first message with fallback
          console.log(`[GameEngine] AI ${aiPlayer.username} generating first message...`);
          let message = await aiGameHandler._generateChatMessage(this, aiPlayer);
          
          // Fallback to template message if empty
          if (!message || !message.trim()) {
            console.warn(`[GameEngine] AI ${aiPlayer.username} generated empty message, using fallback`);
            message = aiGameHandler._getFallbackChatMessage(this, aiPlayer);
          }

          if (message && message.trim()) {
            const finalMessage = this._ensureMessageLength(message, aiPlayer);
            console.log(`[GameEngine] AI ${aiPlayer.username} broadcasting: "${finalMessage?.substring(0, 50)}..."`);
            this.broadcast('chat_message', {
              username: this.getSeatNum(aiPlayer.socketId),
              message: finalMessage,
              timestamp: Date.now(),
            });
          }

          // Second message: delay 15-30 seconds after first
          const secondDelay = 15000 + Math.random() * 15000;
          console.log(`[GameEngine] AI ${aiPlayer.username} second speak after ${(secondDelay / 1000).toFixed(1)}s`);
          
          await new Promise(r => setTimeout(r, secondDelay));

          // Check if still in discussion phase and alive
          if (this.phase !== PHASE.DISCUSSION || !aiPlayer.isAlive) {
            resolve();
            return;
          }

          // Generate second message with different context
          console.log(`[GameEngine] AI ${aiPlayer.username} generating second message...`);
          let message2 = await aiGameHandler._generateChatMessage(this, aiPlayer);
          
          // Fallback to template message if empty
          if (!message2 || !message2.trim()) {
            console.warn(`[GameEngine] AI ${aiPlayer.username} generated empty second message, using fallback`);
            message2 = aiGameHandler._getFallbackChatMessage(this, aiPlayer);
          }

          if (message2 && message2.trim()) {
            const finalMessage2 = this._ensureMessageLength(message2, aiPlayer);
            console.log(`[GameEngine] AI ${aiPlayer.username} broadcasting second: "${finalMessage2?.substring(0, 50)}..."`);
            this.broadcast('chat_message', {
              username: this.getSeatNum(aiPlayer.socketId),
              message: finalMessage2,
              timestamp: Date.now(),
            });
          }
        } catch (error) {
          console.error(`[GameEngine] AI discussion error for ${aiPlayer.username}:`, error);
          
          // Emergency fallback: send a basic message
          try {
            const fallbackMessage = aiGameHandler._getFallbackChatMessage(this, aiPlayer);
            if (fallbackMessage) {
              this.broadcast('chat_message', {
                username: this.getSeatNum(aiPlayer.socketId),
                message: fallbackMessage,
                timestamp: Date.now(),
              });
            }
          } catch (e) {
            console.error(`[GameEngine] Emergency fallback failed for ${aiPlayer.username}:`, e);
          }
        }
        resolve();
      });
    });

    // Run all AI players in parallel
    Promise.all(aiPromises).then(() => {
      console.log('[GameEngine] All AI free discussion promises resolved');
    });

    // 随机插话机制，让自由讨论更像真实房间。
    // This simulates real players interrupting each other with quick reactions
    aiPlayers.forEach((aiPlayer) => {
      if (Math.random() < 0.3) {
        const reactionDelay = 8000 + Math.random() * 20000;
        setTimeout(async () => {
          if (this.phase !== PHASE.DISCUSSION || !aiPlayer.isAlive) return;
          
          const seatNum = this.getSeatNum(aiPlayer.socketId);
          const reactions = [
            '对！',
            '胡说！',
            '我不同意',
            '等一下',
            '有道理',
            '不一定吧',
            '嗯嗯',
            '我觉得不是',
            '他说的不对',
            '哈哈',
            '这也行？',
            '我不信',
            '有可能',
            '别装了',
            '你确定？',
          ];
          const reaction = reactions[Math.floor(Math.random() * reactions.length)];
          
          this.broadcast('chat_message', {
            username: seatNum,
            message: reaction,
            timestamp: Date.now(),
          });
        }, reactionDelay);
      }
    });
  }

  startOrderedSpeaking() {
    // 按顺序发言阶段：把存活玩家排成固定顺序逐个发言。
    this.phase = PHASE.DAY;

    const alive = this.alivePlayers;
    this.speakingOrder = alive.map(p => p.socketId);
    this.currentSpeakerIndex = 0;
    this.hasSpoken = new Set();
    this.candidates = [];

    // 过滤掉中途死亡的玩家，避免轮到死人发言。
    this._skipDeadSpeakers();

    this.currentSpeaker = this.speakingOrder[this.currentSpeakerIndex];
    this.lastPhaseMessage = `按顺序发言阶段（每人${TIMERS.DAY}秒）`;

    this.broadcast('phase_change', {
      phase: PHASE.DAY,
      timeout: TIMERS.DAY,
      message: this.lastPhaseMessage,
      currentSpeaker: this.currentSpeaker,
      speakerName: this.getSeatNum(this.currentSpeaker),
    });

    this.broadcast('chat_message', {
      username: '系统',
      message: `🎤 按顺序发言开始，请 ${this.getSeatNum(this.currentSpeaker)} 发言（${TIMERS.DAY}秒）`,
      timestamp: Date.now(),
      isSystem: true,
    });

    this.clearTimer();

    const currentSpeaker = this.speakingOrder[this.currentSpeakerIndex];
    if (currentSpeaker) {
      const speakerPlayer = this.getPlayer(currentSpeaker);
      if (speakerPlayer && speakerPlayer.isAI) {
        setTimeout(() => this._triggerAISpeaking(currentSpeaker), 1000);
      }
    }

    // 当前发言人超时后自动进入下一位。
    this.phaseTimer = setTimeout(() => {
      this.nextSpeaker();
    }, TIMERS.DAY * 1000);
  }

  // ==================== Day Phase ====================

  startDay() {
    // 白天入口分两种：夜里有人死则先遗言，没人死则直接自由讨论。
    // 夜里有人死亡时，先进入死亡遗言。
    // 夜里无人死亡时，直接进入自由讨论。
    // 
    // 
    // 
    const lastWillPlayers = this.lastWillDeadPlayers || [];
    this.lastWillDeadPlayers = null;

    if (lastWillPlayers.length > 0) {
      // Start last will phase for dead players
      this.startLastWill(lastWillPlayers);
    } else {
      // No deaths, go straight to free discussion
      this.startFreeDiscussion();
    }
  }

  // ==================== Last Will Phase ====================

  startLastWill(deadPlayers) {
    // 遗言阶段按死亡顺序逐个发言。
    this.phase = PHASE.LAST_WILL;
    this.lastWillQueue = [...deadPlayers];
    this.lastWillIndex = 0;

    const deadNames = deadPlayers.map(p => this.getSeatNum(p.socketId)).join('、');
    this.lastPhaseMessage = `死亡遗言阶段：${deadNames}`;

    this.broadcast('phase_change', {
      phase: PHASE.LAST_WILL,
      timeout: TIMERS.LAST_WILL,
      message: this.lastPhaseMessage,
      lastWillPlayers: deadPlayers.map(p => ({ id: p.socketId, username: this.getSeatNum(p.socketId) })),
    });

    this.broadcast('chat_message', {
      username: '系统',
      message: `💀 ${deadNames} 请发表死亡遗言（每人${TIMERS.LAST_WILL}秒）`,
      timestamp: Date.now(),
      isSystem: true,
    });

    // 所有遗言说完后，进入自由讨论。
    this._startLastWillSpeaker();
  }

  _startLastWillSpeaker() {
    // AI 死者会自动生成遗言内容。
    if (!this.lastWillQueue || this.lastWillIndex >= this.lastWillQueue.length) {
    // 遗言有时间限制，超时后自动切到下一个。
      this.startFreeDiscussion();
      return;
    }

    const deadPlayer = this.lastWillQueue[this.lastWillIndex];
    this.lastPhaseMessage = `${this.getSeatNum(deadPlayer.socketId)} 的死亡遗言`;

    this.broadcast('phase_change', {
      phase: PHASE.LAST_WILL,
      timeout: TIMERS.LAST_WILL,
      message: this.lastPhaseMessage,
      currentSpeaker: deadPlayer.socketId,
      speakerName: this.getSeatNum(deadPlayer.socketId),
      lastWillPlayers: this.lastWillQueue.map(p => ({ id: p.socketId, username: this.getSeatNum(p.socketId) })),
    });

    const player = this.getPlayer(deadPlayer.socketId);
    
    // 白天发言顺序里可能混入死人，这里统一剔除。
    if (player && player.isAI) {
      setTimeout(() => this._generateAILastWill(deadPlayer.socketId), 1000);
    }

    // AI 在按顺序发言时会自动生成一段发言。
    this.clearTimer();
    this.phaseTimer = setTimeout(() => {
      this._nextLastWillSpeaker();
    }, TIMERS.LAST_WILL * 1000);
  }

  async _generateAILastWill(socketId) {
    const aiGameHandler = require('./AIGameHandler');
    const player = this.getPlayer(socketId);
    if (!player) return;

    try {
      const message = await aiGameHandler._generateLastWillMessage(this, player);
      if (message && message.trim()) {
        this.broadcast('chat_message', {
          username: this.getSeatNum(socketId),
          message: message,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      console.error(`[GameEngine] AI last will error for ${player.username}:`, error);
      const fallbackMessage = `我是${this.getSeatNum(socketId)}，希望好人阵营能赢。`;
      this.broadcast('chat_message', {
        username: this.getSeatNum(socketId),
        message: fallbackMessage,
        timestamp: Date.now(),
      });
    }
  }

  _nextLastWillSpeaker() {
    this.lastWillIndex++;
    this._startLastWillSpeaker();
  }

  // ==================== Discussion Phase ====================

  _skipDeadSpeakers() {
    // 白天讨论可以手动跳过，直接进入投票。
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
    // 切到下一位发言人。
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
    if (trimmed.length === 0) return '...';

    const agentConfig = player.agentConfig || null;
    const talkativeness = agentConfig?.personality?.talkativeness ?? 50;

    // Determine target length range based on talkativeness
    let minLen, maxLen;
    if (talkativeness > 70) {
      minLen = 40; maxLen = 70;
    } else if (talkativeness < 30) {
      minLen = 5; maxLen = 20;
    } else {
      minLen = 15; maxLen = 55;
    }

    // Add some randomness to the range
    minLen = Math.max(3, minLen + Math.floor(Math.random() * 10) - 5);
    maxLen = minLen + 15 + Math.floor(Math.random() * 15);

    if (trimmed.length >= minLen && trimmed.length <= maxLen) {
      return trimmed;
    }
    
    if (trimmed.length > maxLen) {
      let truncated = trimmed.substring(0, maxLen);
      truncated = truncated.replace(/[，,！!呀啊嘛呢呗啦咯哈。…]+$/g, '');
      if (trimmed.endsWith('...')) truncated += '...';
      else truncated += '。';
      return truncated;
    }
    
    const role = this.getRole(player.socketId);
    
    const extensions = {
      [ROLE.WEREWOLF]: [
        ' 大家仔细分析一下局势',
        ' 我觉着得谨慎点投票',
        ' 希望好人做出正确判断',
        ' 狼人肯定会伪装',
        ' 别被表面迷惑',
      ],
      [ROLE.SEER]: [
        ' 相信我的查验结果',
        ' 今晚继续验人',
        ' 好人需要我的信息',
        ' 狼人会质疑我，别上当',
        ' 大家跟我一起投票',
      ],
      [ROLE.WITCH]: [
        ' 我手里还有毒药',
        ' 小心狼人乱跳',
        ' 我会谨慎用药',
        ' 好人保护好自己',
        ' 今晚看情况',
      ],
      [ROLE.GUARD]: [
        ' 今晚守关键人物',
        ' 大家放心',
        ' 狼人别想得手',
        ' 看局势决定守护',
        ' 好人需要我',
      ],
      [ROLE.HUNTER]: [
        ' 有枪在手',
        ' 谁敢出我就带走谁',
        ' 身份硬得很',
        ' 狼人别想轻易投我',
        ' 看情况开枪',
      ],
      [ROLE.VILLAGER]: [
        ' 希望预言家给信息',
        ' 跟着大家走',
        ' 好人带领我们',
        ' 相信好人阵营',
        ' 一起加油',
      ],
    };
    
    const roleExtensions = extensions[role] || extensions[ROLE.VILLAGER];
    let result = trimmed;

    let iterations = 0;
    const maxIterations = 5;
    while (result.length < minLen && iterations < maxIterations) {
      iterations++;
      const extension = roleExtensions[Math.floor(Math.random() * roleExtensions.length)];
      if (!result.endsWith(extension)) {
        if (!result.endsWith('。') && !result.endsWith('，')) {
          result += '，';
        }
        result += extension;
      }
    }
    
    if (result.length > maxLen) {
      result = result.substring(0, maxLen).replace(/[，,！!呀啊嘛呢呗啦咯哈。]+$/g, '') + '。';
    }
    
    return result;
  }

  skipToVote() {
    // 当前发言人主动跳过，等价于把这一位标记为已发言。
    if (this.phase !== PHASE.DAY) return;
    this.clearTimer();
    this.startVote();
  }

  nextSpeaker() {
    // 当前发言人主动跳过，等价于把这一位标记为已发言。
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

    this.currentSpeaker = this.speakingOrder[this.currentSpeakerIndex];

    this.broadcast('speaker_change', {
      currentSpeaker: this.currentSpeaker,
      speakerName: this.getSeatNum(this.currentSpeaker),
      hasSpoken: Array.from(this.hasSpoken),
    });

    this.broadcast('chat_message', {
      username: '系统',
      message: `🎤 请 ${this.getSeatNum(this.currentSpeaker)} 发言（${TIMERS.DAY}秒）`,
      timestamp: Date.now(),
      isSystem: true,
    });

    if (this.currentSpeaker) {
      const speakerPlayer = this.getPlayer(this.currentSpeaker);
      if (speakerPlayer && speakerPlayer.isAI) {
        setTimeout(() => this._triggerAISpeaking(this.currentSpeaker), 1000);
      }
    }

    // 投票阶段开始时先清空上一轮状态。
    this.clearTimer();
    this.phaseTimer = setTimeout(() => {
      this.nextSpeaker();
    }, TIMERS.DAY * 1000);
  }

  skipSpeaking() {
    // AI 会先完成投票，前端看到的是实时进度。
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

    this.currentSpeaker = this.speakingOrder[this.currentSpeakerIndex];

    this.broadcast('speaker_change', {
      currentSpeaker: this.currentSpeaker,
      speakerName: this.getSeatNum(this.currentSpeaker),
      hasSpoken: Array.from(this.hasSpoken),
    });

    if (this.currentSpeaker) {
      const speakerPlayer = this.getPlayer(this.currentSpeaker);
      if (speakerPlayer && speakerPlayer.isAI) {
        setTimeout(() => this._triggerAISpeaking(this.currentSpeaker), 1000);
      }
    }
  }

  // ==================== Vote Phase ====================

  async startVote() {
    // 投票入口，只允许存活玩家在投票阶段使用。
    this.phase = PHASE.VOTE;
    this.votes = {};
    this.currentSpeaker = null;

    const alive = this.alivePlayers;
    this.candidates = alive.map(p => ({ id: p.socketId, username: this.getSeatNum(p.socketId) }));

    // 只广播已投票人数，不公开具体投票关系。
    const aiPlayers = alive.filter(p => p.isAI);
    if (aiPlayers.length > 0) {
      await this._waitForAIVotes(aiPlayers);
    }

    this.lastPhaseMessage = '投票阶段，请选择要放逐的玩家';

    this.broadcast('phase_change', {
      phase: PHASE.VOTE,
      timeout: TIMERS.VOTE,
      message: this.lastPhaseMessage,
      candidates: this.candidates,
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
    // 投票时间到后统一结算。
    if (this.phase !== PHASE.VOTE) return;
    const voter = this.getPlayer(socketId);
    if (!voter || !voter.isAlive) return;

    // C3: during PK, votes must target one of the PK candidates
    if (this.pkCandidates.length > 0 && !this.pkCandidates.includes(targetId)) return;

    const target = this.getPlayer(targetId);

    this.votes[socketId] = targetId;
    
    this.gameHistory.push({
      night: this.nightCount,
      action: 'vote',
      actor: { id: socketId, username: this.getSeatNum(socketId), role: this.roles[socketId] },
      target: target ? { id: targetId, username: this.getSeatNum(targetId) } : null,
      detail: `${this.getSeatNum(socketId)}投票给了${target ? this.getSeatNum(targetId) : '未知'}`,
    });

    // 找出最高票和并列最高票，为 PK 做准备。
    this.broadcast('vote_update', {
      votedCount: Object.keys(this.votes).length,
      totalCount: this.alivePlayers.length,
    });
  }

  resolveVote() {
    // 平票进入 PK 加赛；如果 PK 后还是平票，就直接回夜晚。
    this.clearTimer();
    if (this.phase !== PHASE.VOTE) return;

    const alive = this.alivePlayers;
    const tally = {};

    for (const [voterId, targetId] of Object.entries(this.votes)) {
      if (alive.find(p => p.socketId === voterId)) {
        tally[targetId] = (tally[targetId] || 0) + 1;
      }
    }

    // 本轮投票结算完毕后，清掉 PK 状态。
    let maxVotes = 0;
    for (const count of Object.values(tally)) {
      if (count > maxVotes) maxVotes = count;
    }
    const topTargets = Object.entries(tally)
      .filter(([, count]) => count === maxVotes)
      .map(([id]) => id);
    const voteDetails = Object.entries(tally).map(([id, count]) => {
      return { id, username: this.getSeatNum(id), votes: count };
    });

    // 平票时进入 PK 加赛，只允许候选人再次投票。
    if (topTargets.length > 1 && maxVotes > 0) {
      this._startPKVote(topTargets);
      return;
    }

    let eliminatedPlayer = null;
    if (topTargets.length === 1 && maxVotes > 0) {
      eliminatedPlayer = this.getPlayer(topTargets[0]);
      if (eliminatedPlayer) {
        eliminatedPlayer.isAlive = false;
      }
    }

    // 第二次 PK 还是平票，就认为本轮无人出局。
    this.pkRound = 0;
    this.pkCandidates = [];

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

    // 清空上一轮票数，并限制 PK 候选人。
    if (this.checkWinCondition()) return;

    // 前端只需要候选人的展示信息。
    setTimeout(() => this.startNight(), 3000);
  }

  /**
   * C3: Start a PK (tie-break) vote round between the given candidates.
   * Only one PK round is allowed; a second tie skips to night without elimination.
   */
  _startPKVote(pkCandidates) {
    // 胜负判断规则：狼人死光民众胜，狼人数量不少于其他阵营则狼人胜。
    this.pkRound = (this.pkRound || 0) + 1;

    // ???????????????????????????????
    if (this.pkRound > 1) {
      this.broadcast('vote_result', {
        eliminated: null,
        votes: [],
        message: 'PK 平票，没有人被放逐',
      });
      this.broadcast('chat_message', {
        username: '系统',
        message: '🗳️ PK 平票，没有人被放逐',
        timestamp: Date.now(),
        isSystem: true,
      });
      this.pkRound = 0;
      this.pkCandidates = [];
      if (this.checkWinCondition()) return;
      setTimeout(() => this.startNight(), 3000);
      return;
    }

    // ????? PK ??????????????
    this.votes = {};
    this.pkCandidates = pkCandidates;
    this.candidates = pkCandidates;
    this.lastPhaseMessage = `${pkCandidates.map(id => this.getSeatNum(id)).join('、')} 进入PK，请再次投票`;

    // 胜负条件未满足，继续下一夜。
    const candidatesForFrontend = pkCandidates.map(id => ({
      id,
      username: this.getSeatNum(id),
    }));

    this.broadcast('phase_change', {
      phase: PHASE.VOTE,
      isPK: true,
      candidates: candidatesForFrontend,
      timeout: 30,
      message: this.lastPhaseMessage,
    });
    this.broadcast('chat_message', {
      username: '系统',
      message: `🗳️ ${this.lastPhaseMessage}`,
      timestamp: Date.now(),
      isSystem: true,
    });

    this.clearTimer();
    this.phaseTimer = setTimeout(() => this.resolveVote(), 30000);
  }

  // ==================== Win Condition ====================

  checkWinCondition() {
    // 对局结束时统一收尾：清定时器、切 END、广播结果。
    // 1. ???? -> ???
    // ???????
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
    // 把结果交给外部持久化层，GameEngine 本身不直接写数据库。
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

    // 生成一份复盘消息，供前端和聊天区展示。
    this.emit(this.roomCode, '__game_result', {
      roomCode: this.roomCode,
      winner,
      playerCount: this.players.filter(p => this.roles[p.socketId]).length,
      duration,
      players: result,
      history: this.gameHistory,
    });
    
    // 清理所有阶段推进相关状态，防止下局串状态。
    const replayMsg = this.generateReplayMessage(result, winner, message);
    this.emit(this.roomCode, '__game_replay', {
      roomCode: this.roomCode,
      message: replayMsg,
    });
  }
  
  generateReplayMessage(players, winner, message) {
    const result = {
      type: 'replay',
      title: '🎮 上一轮复盘',
      summary: message,
      roles: {
        werewolves: [],
        seer: null,
        witch: null,
        guard: null,
        hunter: null,
        civilians: []
      },
      result: {
        winner: winner === 'werewolf' ? '狼人阵营' : '村民阵营',
        winners: [],
        losers: []
      },
      history: []
    };
    
    const werewolves = players.filter(p => p.role === ROLE.WEREWOLF);
    const villagers = players.filter(p => p.role !== ROLE.WEREWOLF);
    
    result.roles.werewolves = werewolves.map(p => p.username);
    
    const seer = players.find(p => p.role === ROLE.SEER);
    if (seer) result.roles.seer = seer.username;
    
    const witch = players.find(p => p.role === ROLE.WITCH);
    if (witch) result.roles.witch = witch.username;
    
    const guard = players.find(p => p.role === ROLE.GUARD);
    if (guard) result.roles.guard = guard.username;
    
    const hunter = players.find(p => p.role === ROLE.HUNTER);
    if (hunter) result.roles.hunter = hunter.username;
    
    const civilians = villagers.filter(p => p.role === ROLE.VILLAGER);
    result.roles.civilians = civilians.map(p => p.username);
    
    const winners = players.filter(p => p.isWinner);
    const losers = players.filter(p => !p.isWinner);
    result.result.winners = winners.map(p => p.username);
    result.result.losers = losers.map(p => p.username);
    
    // Group history by night
    if (this.gameHistory.length > 0) {
      const nightGroups = {};
      this.gameHistory.forEach(h => {
        const night = h.night || 0;
        if (!nightGroups[night]) {
          nightGroups[night] = [];
        }
        const detail = h.detail || `${h.action || '未知行动'}${h.actor?.username ? ' - ' + h.actor.username : ''}`;
        nightGroups[night].push({
          action: h.action,
          detail: detail
        });
      });
      
      result.history = Object.keys(nightGroups)
        .sort((a, b) => Number(a) - Number(b))
        .map(night => ({
          night: Number(night),
          events: nightGroups[night]
        }));
    }
    
    return result;
  }

  // ==================== Cleanup ====================

  clearTimer() {
    // 清理旧定时器是避免重复跳阶段的关键。
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

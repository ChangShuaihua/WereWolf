const { PHASE, ROLE } = require('./constants');
const { getRoleName } = require('./RoleConfig');

const NightPhaseMixin = {
  // ==================== Phase Transitions ====================
  // 开始夜
  startNight() {
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

    this.runNightSequence();
  },

  // 处理夜子阶段
  async runNightSequence() {
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
  },

  // 处理夜子阶段内部
  async _runNightSequenceInner() {
    const alive = this.alivePlayers;

    // 等待AI玩家提交夜行动
    const aiPlayers = alive.filter(p => p.isAI);
    if (aiPlayers.length > 0) {
      await this._waitForAINightActions(aiPlayers);
    }

    // 1. 守卫行动（30秒）
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

    // 2. 狼人行动（30秒）
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

    // 处理狼人击杀行动结果
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

    // 3. 预言家行动（30秒）
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

    // 4. 女巫行动（30秒）
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

    this.resolveNight();
  },

  // 等待玩家行动完成
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
  },

  async _waitForAINightActions(aiPlayers) {
    const aiGameHandler = require('./AIGameHandler');

    const timeoutPromise = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    for (const aiPlayer of aiPlayers) {
      const role = this.getRole(aiPlayer.socketId);
      if (!role) continue;

      try {
        const action = await Promise.race([
          aiGameHandler._decideNightAction(this, aiPlayer, role),
          timeoutPromise(15000)
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
  },

  // ==================== Night Actions ====================
  submitNightAction(socketId, action, targetId) {
    if (this.phase !== PHASE.NIGHT) return;
    const player = this.getPlayer(socketId);
    if (!player || !player.isAlive) return;

    const target = this.getPlayer(targetId);
    const role = this.roles[socketId];
    const allowedActions = {
      [ROLE.GUARD]: ['guard'],
      [ROLE.WEREWOLF]: ['kill'],
      [ROLE.SEER]: ['check'],
      [ROLE.WITCH]: ['save', 'poison', 'skip'],
    };

    if (!allowedActions[role]?.includes(action)) return;
    if (this.nightActions[socketId]) return;

    if (['kill', 'check', 'guard', 'poison'].includes(action)) {
      if (!target || !target.isAlive || target.socketId === socketId) return;
    }

    if (action === 'save' && (!this.killedByWerewolves || targetId !== this.killedByWerewolves)) return;

    // C1: role-based validation
    if (action === 'save' && this.witchSaveUsed) return;
    if (action === 'poison' && this.witchPoisonUsed) return;
    if (action === 'guard' && targetId && targetId === this.guardLastProtected) {
      return;
    }
    if (action === 'kill' && this.roles[target.socketId] === ROLE.WEREWOLF) {
      return;
    }

    // 每名玩家每夜只接受一次有效行动，避免重复用药或覆盖已确认选择。
    this.nightActions[socketId] = { action, targetId };

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
        // 广播狼人击杀投票状态给所有狼人队友
        this._broadcastWerewolfVoteState();
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
  },

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

      // 同守同救规则
      if (!wasProtected && !wasSaved) {
        deaths.add(this.killedByWerewolves);
      } else if (wasProtected && wasSaved) {
        deaths.add(this.killedByWerewolves);
      }
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

    // Hunter shooting
    if (hunterDeath && !hunterKilledByPoison) {
      const aliveAfterNight = this.alivePlayers;
      if (aliveAfterNight.length > 0) {
        this.pendingHunterId = hunterDeath.id;
        this.sendTo(hunterDeath.id, 'hunter_trigger', {
          message: '你已被杀，请选择带走一名玩家',
          targets: aliveAfterNight.map(p => ({ id: p.socketId, username: this.getSeatNum(p.socketId) })),
        });

        this.clearTimer();
        this.phaseTimer = setTimeout(() => {
          this._executeHunterShoot(hunterDeath.id);
        }, 10000);

        return;
      }
    } else if (hunterDeath && hunterKilledByPoison) {
      this.broadcast('chat_message', {
        username: '系统',
        message: `☠️ ${hunterDeath.username} 被毒杀，无法开枪`,
        timestamp: Date.now(),
        isSystem: true,
      });
    }

    // Check win condition
    if (this.checkWinCondition()) return;

    // Transition to day
    setTimeout(() => this.startDay(), 2000);
  },

  // ==================== Hunter Shooting ====================
  _executeHunterShoot(hunterId) {
    const hunter = this.getPlayer(hunterId);
    const aliveAfterNight = this.alivePlayers;

    this.pendingHunterId = null;

    if (!hunter || aliveAfterNight.length === 0) {
      this._continueAfterHunter();
      return;
    }

    // Auto-shoot a random player if hunter didn't choose
    const randomTarget = aliveAfterNight[Math.floor(Math.random() * aliveAfterNight.length)];

    randomTarget.isAlive = false;

    this.gameHistory.push({
      night: this.nightCount,
      action: 'hunter_shoot',
      actor: { id: hunterId, username: this.getSeatNum(hunterId), role: ROLE.HUNTER },
      target: { id: randomTarget.socketId, username: this.getSeatNum(randomTarget.socketId) },
      detail: `${this.getSeatNum(hunterId)}开枪带走了${this.getSeatNum(randomTarget.socketId)}`,
    });

    this.broadcast('hunter_result', {
      shooter: { id: hunterId, username: this.getSeatNum(hunterId) },
      target: { id: randomTarget.socketId, username: this.getSeatNum(randomTarget.socketId) },
      message: `${this.getSeatNum(hunterId)}开枪带走了${this.getSeatNum(randomTarget.socketId)}`,
    });

    this._continueAfterHunter();
  },

  _continueAfterHunter() {
    this.pendingHunterId = null;
    if (this.checkWinCondition()) return;

    setTimeout(() => this.startDay(), 2000);
  },

  // 广播狼人击杀投票状态给所有存活狼人
  _broadcastWerewolfVoteState() {
    const werewolves = this.alivePlayers.filter(p => this.roles[p.socketId] === ROLE.WEREWOLF);
    if (werewolves.length === 0) return;

    const choices = werewolves.map(w => {
      const action = this.nightActions[w.socketId];
      const targetId = action?.action === 'kill' ? action.targetId : null;
      return {
        playerId: w.socketId,
        playerName: this.getSeatNum(w.socketId),
        targetId,
        targetName: targetId ? this.getSeatNum(targetId) : null,
      };
    });

    const targetCounts = {};
    choices.forEach(c => {
      if (c.targetId) targetCounts[c.targetId] = (targetCounts[c.targetId] || 0) + 1;
    });
    const maxCount = Math.max(...Object.values(targetCounts), 0);
    const isUnanimous = maxCount === werewolves.length && werewolves.length > 1;

    const voteState = { choices, isUnanimous };

    for (const w of werewolves) {
      this.sendTo(w.socketId, 'werewolf_vote_update', voteState);
    }
  },
};

module.exports = NightPhaseMixin;

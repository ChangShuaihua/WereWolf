const { PHASE, ROLE, TIMERS, TEAM } = require('./constants');
const { getRolesForGame, getRoleName } = require('./RoleConfig');

class GameEngine {
  constructor(roomCode, players, emit) {
    this.roomCode = roomCode;
    this.emit = emit;                    // callback to emit socket events
    this.players = players;              // [{ id, username, socketId, isAlive, isReady }]
    this.roles = {};                     // { socketId: role }
    this.phase = PHASE.WAITING;
    this.phaseTimer = null;
    this.startTime = null;

    // Night action state
    this.nightActions = {};              // { socketId: { action, targetId } }
    this.guardLastProtected = null;      // socketId of last protected player
    this.witchSaveUsed = false;
    this.witchPoisonUsed = false;
    this.killedByWerewolves = null;      // socketId of werewolf kill target
    this.killedByWitch = null;           // socketId of witch poison target

    // Vote state
    this.votes = {};                     // { voterSocketId: targetSocketId }
    this.nightCount = 0;
    
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
          killed: killedPlayer ? { id: killedPlayer.socketId, username: killedPlayer.username } : null,
          canSave: !this.witchSaveUsed && this.killedByWerewolves !== null,
          canPoison: !this.witchPoisonUsed,
          targets: this.alivePlayers.filter(p => p.socketId !== w.socketId)
            .map(p => ({ id: p.socketId, username: p.username })),
        });
      }
    }
  }

  // ==================== Game Start ====================

  start() {
    if (this.phase !== PHASE.WAITING) return;
    const readyPlayers = this.players.filter(p => p.isReady);
    if (readyPlayers.length < 4) return;

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

    // Tell each player their role
    this.players.forEach(p => {
      if (p.isAlive) {
        this.sendTo(p.socketId, 'game_started', {
          role: this.roles[p.socketId],
          roleName: getRoleName(this.roles[p.socketId]),
          players: this.players.map(pl => ({
            id: pl.socketId,
            username: pl.username,
            isAlive: pl.isAlive,
          })),
        });
      }
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

    this.broadcast('phase_change', {
      phase: PHASE.NIGHT,
      nightCount: this.nightCount,
      timeout: TIMERS.NIGHT,
      message: `第 ${this.nightCount} 夜来临，请闭眼...`,
    });

    // Night sub-phases handled sequentially
    this.runNightSequence();
  }

  async runNightSequence() {
    const alive = this.alivePlayers;

    // 1. Guard protects
    const guards = alive.filter(p => this.roles[p.socketId] === ROLE.GUARD);
    for (const g of guards) {
      this.sendTo(g.socketId, 'night_action_prompt', {
        action: 'guard',
        message: '请选择要守护的玩家',
        targets: alive.filter(p => p.socketId !== g.socketId && p.socketId !== this.guardLastProtected)
          .map(p => ({ id: p.socketId, username: p.username })),
      });
    }

    // 2. Werewolves kill
    const werewolves = alive.filter(p => this.roles[p.socketId] === ROLE.WEREWOLF);
    const targets = alive.filter(p => this.roles[p.socketId] !== ROLE.WEREWOLF)
      .map(p => ({ id: p.socketId, username: p.username }));
    for (const w of werewolves) {
      this.sendTo(w.socketId, 'night_action_prompt', {
        action: 'kill',
        message: '请选择要击杀的目标',
        targets,
      });
    }

    // 3. Seer checks
    const seers = alive.filter(p => this.roles[p.socketId] === ROLE.SEER);
    for (const s of seers) {
      this.sendTo(s.socketId, 'night_action_prompt', {
        action: 'check',
        message: '请选择要查验的玩家',
        targets: alive.filter(p => p.socketId !== s.socketId)
          .map(p => ({ id: p.socketId, username: p.username })),
      });
    }

    // 4. Witch action - will be notified after werewolves decide or on timeout
    const witches = alive.filter(p => this.roles[p.socketId] === ROLE.WITCH);
    for (const w of witches) {
      const options = {
        action: 'witch',
        message: '请使用你的药水',
        killed: this.killedByWerewolves
          ? { id: this.killedByWerewolves, username: this.getPlayer(this.killedByWerewolves)?.username }
          : null,
        canSave: !this.witchSaveUsed && this.killedByWerewolves !== null,
        canPoison: !this.witchPoisonUsed,
        targets: alive.filter(p => p.socketId !== w.socketId)
          .map(p => ({ id: p.socketId, username: p.username })),
      };
      this.sendTo(w.socketId, 'night_action_prompt', options);
    }

    // Auto-advance after timer
    this.clearTimer();
    this.phaseTimer = setTimeout(() => this.resolveNight(), TIMERS.NIGHT * 1000);
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
    
    this.gameHistory.push({
      night: this.nightCount,
      action,
      actor: { id: socketId, username: player.username, role: this.roles[socketId] },
      target: target ? { id: targetId, username: target.username } : null,
      detail: `${getRoleName(this.roles[socketId])}选择了${target?.username || '未知'}`,
    });

    switch (action) {
      case 'guard':
        this.guardLastProtected = targetId;
        break;

      case 'kill': {
        // Werewolf vote: last kill action wins (simplified)
        const werewolves = this.alivePlayers.filter(p => this.roles[p.socketId] === ROLE.WEREWOLF);
        const werewolfActions = werewolves.filter(w => this.nightActions[w.socketId]?.action === 'kill');
        if (werewolfActions.length === werewolves.length) {
          // All werewolves have voted, count majority
          const tally = {};
          werewolfActions.forEach(w => {
            const t = this.nightActions[w.socketId].targetId;
            tally[t] = (tally[t] || 0) + 1;
          });
          const maxVotes = Math.max(...Object.values(tally));
          const topTargets = Object.entries(tally).filter(([, v]) => v === maxVotes);
          this.killedByWerewolves = topTargets[0][0]; // first target with most votes

          // Notify witch of the kill target
          this.notifyWitch();
        }
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
        this.killedByWerewolves = null;
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

    // Apply werewolf kill
    if (this.killedByWerewolves && this.killedByWerewolves !== protectedPlayer) {
      deaths.add(this.killedByWerewolves);
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
        deathList.push({ id: socketId, username: player.username, role: this.roles[socketId] });
      }
    }

    this.broadcast('night_result', {
      deaths: deathList.map(d => ({ id: d.id, username: d.username })),
      saved: !!protectedPlayer && this.killedByWerewolves === protectedPlayer,
      message: deathList.length === 0 ? '天亮了，昨晚是平安夜' : `天亮了，昨晚 ${deathList.map(d => d.username).join('、')} 死亡`,
    });

    // Check for hunter death trigger
    for (const d of deathList) {
      if (d.role === ROLE.HUNTER) {
        this.sendTo(d.id, 'hunter_trigger', {
          message: '你已被杀，请选择带走一名玩家',
          targets: this.alivePlayers.map(p => ({ id: p.socketId, username: p.username })),
        });
        // Hunter ability: can take someone with them (simplified: auto after short delay or manual)
        // For simplicity, we skip hunter active ability in night death, handle in day
      }
    }

    // Check win condition
    if (this.checkWinCondition()) return;

    // Transition to day
    setTimeout(() => this.startDay(), 2000);
  }

  // ==================== Day Phase ====================

  startDay() {
    this.phase = PHASE.DAY;

    this.broadcast('phase_change', {
      phase: PHASE.DAY,
      timeout: TIMERS.DAY,
      message: '天亮了，请自由讨论',
    });

    this.clearTimer();
    this.phaseTimer = setTimeout(() => this.startVote(), TIMERS.DAY * 1000);
  }

  skipToVote() {
    if (this.phase !== PHASE.DAY) return;
    this.clearTimer();
    this.startVote();
  }

  // ==================== Vote Phase ====================

  startVote() {
    this.phase = PHASE.VOTE;
    this.votes = {};

    const alive = this.alivePlayers;

    this.broadcast('phase_change', {
      phase: PHASE.VOTE,
      timeout: TIMERS.VOTE,
      message: '投票阶段，请选择要放逐的玩家',
      candidates: alive.map(p => ({ id: p.socketId, username: p.username })),
    });

    this.clearTimer();
    this.phaseTimer = setTimeout(() => this.resolveVote(), TIMERS.VOTE * 1000);
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
      actor: { id: socketId, username: voter.username, role: this.roles[socketId] },
      target: target ? { id: targetId, username: target.username } : null,
      detail: `${voter.username}投票给了${target?.username || '未知'}`,
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
      const p = this.getPlayer(id);
      return { id, username: p?.username || '未知', votes: count };
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
        ? { id: eliminatedPlayer.socketId, username: eliminatedPlayer.username, role: this.roles[eliminatedPlayer.socketId] }
        : null,
      votes: voteDetails,
      message: eliminatedPlayer
        ? `${eliminatedPlayer.username} 被放逐出局`
        : '平票，没有人被放逐',
    };

    this.broadcast('vote_result', result);

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
      username: p.username,
      role: this.roles[p.socketId],
      roleName: getRoleName(this.roles[p.socketId]),
      isAlive: p.isAlive,
      isWinner: TEAM[this.roles[p.socketId]] === winner,
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
    
    const civilians = villagers.filter(p => p.role === ROLE.CIVILIAN);
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
          replay += `\n🌙 第${currentNight + 1}夜：`;
        }
        replay += `\n  - ${h.detail}`;
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

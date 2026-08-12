const { PHASE, ROLE, TEAM } = require('./constants');
const { getRoleName } = require('./RoleConfig');

const GameEndMixin = {
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
  },

  // ==================== Game End ====================
  endGame(winner, message) {
    this.clearTimer();
    this.phase = PHASE.END;

    const duration = this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0;

    const result = this.players.map(p => ({
      id: p.socketId,
      userId: p.id,
      username: p.username || this.getSeatNum(p.socketId),
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
  },

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
  },

  // ==================== Cleanup ====================
  clearTimer() {
    if (this.phaseTimer) {
      clearTimeout(this.phaseTimer);
      this.phaseTimer = null;
    }
  },

  destroy() {
    this.clearTimer();
    this.players = [];
    this.roles = {};
    this.nightActions = {};
    this.votes = {};
  },
};

module.exports = GameEndMixin;

const { PHASE, ROLE } = require('./constants');
const { getRolesForGame, getRoleName } = require('./RoleConfig');

const CoreMixin = {
  // ==================== Helpers ====================
  // 获取所有存活玩家
  get alivePlayers() {
    return this.players.filter(p => p.isAlive);
  },

  // 获取玩家信息
  getPlayer(socketId) {
    return this.players.find(p => p.socketId === socketId);
  },

  // 获取玩家角色
  getRole(socketId) {
    return this.roles[socketId];
  },

  // 获取玩家座位号
  getSeatNum(socketId) {
    const player = this.getPlayer(socketId);
    if (!player) return '未知';
    const num = (player.seatIndex !== undefined ? player.seatIndex : 0) + 1;
    return `${num}号`;
  },

  // 获取玩家座位号数组，用于提示
  getTargetsForPrompt(playerList) {
    return playerList.map(p => ({
      id: p.socketId,
      username: this.getSeatNum(p.socketId),
      seatNum: this.getSeatNum(p.socketId),
    }));
  },

  // 广播事件到所有玩家
  broadcast(event, data) {
    this.emit(this.roomCode, event, data);
  },

  // 发送事件到指定玩家
  sendTo(socketId, event, data) {
    this.emit(socketId, event, data);
  },

  // 通知女巫使用药水
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
  },

  // ==================== Game Start ====================
  start() {
    if (this.phase !== PHASE.WAITING) return;
    const readyPlayers = this.players.filter(p => p.isReady);
    if (readyPlayers.length < this.maxPlayers) return;

    // 分配角色给玩家
    const roleList = getRolesForGame(readyPlayers.length);
    readyPlayers.forEach((p, i) => {
      const role = roleList[i];
      this.roles[p.socketId] = role;
      p.role = role;
    });

    // 标记所有准备好的玩家为存活
    this.players.forEach(p => {
      p.isAlive = p.isReady;
    });

    this.nightCount = 0;
    this.startTime = Date.now();

    // 通知每个玩家其角色和座位号
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

    // 广播游戏开始消息
    const playerList = this.alivePlayers.map(p => this.getSeatNum(p.socketId)).join('、');
    this.broadcast('chat_message', {
      username: '系统',
      message: `🎮 游戏开始！玩家：${playerList}，共${this.alivePlayers.length}人`,
      timestamp: Date.now(),
      isSystem: true,
    });

    this.notifySpectatorsOfStart();

    // 开始第一夜
    setTimeout(() => this.startNight(), 3000);
  },

  // 观众全知视角：身份、行动记录、当前投票
  buildSpectatorView() {
    const players = this.players.map(pl => ({
      id: pl.socketId,
      username: pl.username,
      seatNum: this.getSeatNum(pl.socketId),
      seatIndex: pl.seatIndex,
      isAlive: pl.isAlive,
      role: this.roles[pl.socketId] || '',
      roleName: getRoleName(this.roles[pl.socketId] || ''),
    }));

    const history = (this.gameHistory || []).map(entry => {
      if (!entry?.detail) return null;
      let detail = entry.detail;
      if (entry.action === 'check' && entry.result) {
        detail += entry.result === 'werewolf' ? '，查验结果是狼人' : '，查验结果是好人';
      }
      return { night: entry.night || 0, detail };
    }).filter(Boolean);

    const votes = Object.entries(this.votes || {}).map(([voterId, targetId]) => ({
      voterName: this.getSeatNum(voterId),
      targetName: this.getSeatNum(targetId),
    }));

    return {
      phase: this.phase,
      nightCount: this.nightCount,
      message: this.lastPhaseMessage || '',
      players,
      roles: Object.fromEntries(players.filter(p => p.id).map(p => [p.id, p.role])),
      history,
      votes,
    };
  },

  pushSpectatorView() {
    const { roomCache } = require('../utils/cache');
    const room = roomCache.get(this.roomCode);
    const spectators = (room?.spectators || []).filter(s => s.socketId);
    if (!spectators.length) return;
    const view = this.buildSpectatorView();
    for (const spectator of spectators) {
      this.emit(spectator.socketId, 'spectator_view', view);
    }
  },

  notifySpectatorsOfStart() {
    const { roomCache } = require('../utils/cache');
    const room = roomCache.get(this.roomCode);
    const spectators = (room?.spectators || []).filter(s => s.socketId);
    if (!spectators.length) return;
    const view = this.buildSpectatorView();
    for (const spectator of spectators) {
      this.emit(spectator.socketId, 'game_started', {
        spectator: true,
        role: '',
        roleName: '',
        players: view.players,
        phase: this.phase === 'WAITING' ? 'NIGHT' : this.phase,
      });
      this.emit(spectator.socketId, 'spectator_view', view);
    }
  },
};

module.exports = CoreMixin;

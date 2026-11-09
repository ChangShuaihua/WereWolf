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

  enterPhase(phase) {
    this.phase = phase;
    this.phaseVersion = (this.phaseVersion || 0) + 1;
    require('./AITaskCoordinator').expireRoom(this.roomCode);
  },

  // 断线重连会换 socketId。投票、夜间行动和角色都按这个 id 记账，必须整表迁过去，否则旧记录对不上活人，新连接可以再投一次、再刀一次。
  rebindSocket(oldSocketId, newSocketId) {
    if (!oldSocketId || !newSocketId || oldSocketId === newSocketId) return;

    const swap = (id) => (id === oldSocketId ? newSocketId : id);

    if (this.roles?.[oldSocketId]) {
      this.roles[newSocketId] = this.roles[oldSocketId];
      delete this.roles[oldSocketId];
    }

    if (this.votes) {
      const nextVotes = {};
      for (const [voterId, targetId] of Object.entries(this.votes)) {
        nextVotes[swap(voterId)] = swap(targetId);
      }
      this.votes = nextVotes;
    }

    if (this.nightActions) {
      const nextActions = {};
      for (const [actorId, action] of Object.entries(this.nightActions)) {
        if (action?.targetId) {
          nextActions[swap(actorId)] = { ...action, targetId: swap(action.targetId) };
        } else {
          nextActions[swap(actorId)] = action;
        }
      }
      this.nightActions = nextActions;
    }

    const remapList = (list) => {
      if (!Array.isArray(list)) return list;
      return list.map((item) => {
        if (item === oldSocketId) return newSocketId;
        if (item && item.id === oldSocketId) return { ...item, id: newSocketId };
        return item;
      });
    };
    this.pkCandidates = remapList(this.pkCandidates);
    this.candidates = remapList(this.candidates);
    this.speakingOrder = remapList(this.speakingOrder);

    if (this.currentSpeaker === oldSocketId) this.currentSpeaker = newSocketId;
    if (this.guardLastProtected === oldSocketId) this.guardLastProtected = newSocketId;
    if (this.witchSaveTarget === oldSocketId) this.witchSaveTarget = newSocketId;
    if (this.killedByWerewolves === oldSocketId) this.killedByWerewolves = newSocketId;
    if (this.killedByWitch === oldSocketId) this.killedByWitch = newSocketId;
    if (this.pendingHunterId === oldSocketId) this.pendingHunterId = newSocketId;

    if (this.hasSpoken instanceof Set && this.hasSpoken.has(oldSocketId)) {
      this.hasSpoken.delete(oldSocketId);
      this.hasSpoken.add(newSocketId);
    }

    const player = this.players.find(p => p.socketId === oldSocketId || p.boundSocketId === oldSocketId);
    if (player) {
      player.socketId = newSocketId;
      player.boundSocketId = newSocketId;
    }

    this.broadcast('socket_rebound', { from: oldSocketId, to: newSocketId });
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
      p.boundSocketId = p.socketId;
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
            avatarUrl: pl.avatarUrl || '',
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
      avatarUrl: pl.avatarUrl || '',
      seatNum: this.getSeatNum(pl.socketId),
      seatIndex: pl.seatIndex,
      isAlive: pl.isAlive,
      isAI: Boolean(pl.isAI),
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
      aiThoughts: this.aiThoughts || [],
    };
  },

  recordAiThought({ player, kind, summary, reasoning }) {
    if (!player?.isAI) return;
    const text = String(reasoning || '').trim();
    if (!text) return;
    if (!this.aiThoughts) this.aiThoughts = [];
    this.aiThoughts.push({
      id: `${player.socketId}-${this.aiThoughts.length}`,
      playerId: player.socketId,
      username: player.username,
      seat: this.getSeatNum(player.socketId),
      night: this.nightCount || 0,
      phase: this.phase,
      kind: kind || '决策',
      summary: String(summary || '').slice(0, 160),
      reasoning: text.slice(0, 800),
      at: Date.now(),
    });
    if (this.aiThoughts.length > 200) this.aiThoughts = this.aiThoughts.slice(-200);
    this.pushSpectatorView();
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

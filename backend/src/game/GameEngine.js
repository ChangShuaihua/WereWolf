// 引入 EventEmitter 模块，用于事件驱动编程
const { EventEmitter } = require('events');
// 定义游戏常量，阶段 PHASE、角色 ROLE、计时器 TIMERS、阵营 TEAM
const { PHASE } = require('./constants');

// 引入各功能模块 Mixin
const CoreMixin = require('./CoreMixin');
const NightPhaseMixin = require('./NightPhaseMixin');
const DayPhaseMixin = require('./DayPhaseMixin');
const VotePhaseMixin = require('./VotePhaseMixin');
const GameEndMixin = require('./GameEndMixin');

// 游戏引擎类，继承 EventEmitter，用于事件驱动编程
class GameEngine extends EventEmitter {
  // 构造函数，初始化游戏引擎
  constructor(roomCode, players, emit, maxPlayers = 6) {
    // 调用父类构造函数，初始化 EventEmitter
    super();
    // 设置最大监听器数量为20，避免内存泄漏
    this.setMaxListeners(20);
    this.roomCode = roomCode;
    this.emit = emit;                    // callback to emit socket events
    this.players = players;              // [{ id, username, socketId, isAlive, isReady }]
    this.maxPlayers = maxPlayers;        // 6, 8, or 12
    this.roles = {};
    this.phase = PHASE.WAITING;
    this.phaseTimer = null;              // 游戏阶段计时器
    this.startTime = null;               // 游戏开始时间

    // Night action state
    this.nightActions = {};              // 夜间操作状态
    this.guardLastProtected = null;      // 最后一个被守卫保护的玩家
    this.witchSaveUsed = false;          // 是否使用了巫保存能力
    this.witchSaveTarget = null;         // 女巫保存的目标玩家
    this.witchPoisonUsed = false;        // 是否使用了巫巫毒能力
    this.killedByWerewolves = null;      // 被狼人杀的玩家目标
    this.killedByWitch = null;           // 被巫巫毒的玩家目标

    // Vote state
    this.votes = {};                     // 投票状态
    this.nightCount = 0;
    this.pkRound = 0;                    // PK轮数计数器
    this.pkCandidates = [];              // PK候选玩家数组

    // Hunter state
    this.hunterDied = false;
    this.hunterKilledByPoison = false;
    this.pendingHunterId = null;

    // Speaking state (turn-based)
    this.speakingOrder = [];             // 轮流发言状态
    this.currentSpeakerIndex = -1;
    this.currentSpeaker = null;
    this.hasSpoken = new Set();

    // Vote state for reconnection
    this.candidates = [];
    this.lastPhaseMessage = '';

    // Game history for replay
    this.gameHistory = [];
  }
}

// 使用 Mixin 模式合并各功能模块（保留 getter/setter）
function mixin(target, source) {
  const descriptors = Object.getOwnPropertyDescriptors(source);
  Object.defineProperties(target, descriptors);
}

mixin(GameEngine.prototype, CoreMixin);
mixin(GameEngine.prototype, NightPhaseMixin);
mixin(GameEngine.prototype, DayPhaseMixin);
mixin(GameEngine.prototype, VotePhaseMixin);
mixin(GameEngine.prototype, GameEndMixin);

module.exports = GameEngine;

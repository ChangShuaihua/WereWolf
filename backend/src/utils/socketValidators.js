const { socketCache, gameCache, roomCache } = require('./cache');
const { PHASE } = require('../game/constants');

/**
 * Socket 事件统一校验工具：
 *   reduce 所有重复校验代码，保证 socket 事件的安全和一致性。
 *
 * 用法：
 *   const info = require('./utils/socketValidators').getRoomInfoOrReject(socket, roomCode);
 *   if (!info) return;
 *   const { room, code, game, player } = info;
 */

/**
 * 从 socket 上下文 + 传入参数解析 roomCode，并做基础校验。
 * 返回 null 时应直接 return（已经 emit 错误给客户端）。
 */
function getRoomInfoOrReject(socket, roomCodeFromEvent) {
  if (socket.kicked) return null;
  const info = socketCache.get(socket.id);
  const code = roomCodeFromEvent || info?.roomCode;

  if (!code) {
    socket.emit('error', { message: '请先加入房间' });
    return null;
  }
  const room = roomCache.get(code);
  if (!room) {
    socket.emit('error', { message: '房间不存在' });
    return null;
  }
  const player = room.players.find(p => p.socketId === socket.id);
  if (!player) {
    socket.emit('error', { message: '你不在该房间中' });
    return null;
  }
  const game = gameCache.get(code) || null;

  return { room, code, game, player, info };
}

/**
 * 校验当前游戏阶段，不匹配则 emit 错误并返回 false。
 *
 * @param {object} game  游戏实例
 * @param {string|string[]} expectedPhase 期望阶段（单个或阶段数组，任一命中即可）
 * @returns {boolean} 是否匹配
 */
function validatePhaseOrReject(socket, game, expectedPhase, actionName = '该操作') {
  if (!game) {
    socket.emit('error', { message: '游戏尚未开始' });
    return false;
  }
  const phases = Array.isArray(expectedPhase) ? expectedPhase : [expectedPhase];
  if (!phases.includes(game.phase)) {
    socket.emit('error', { message: `当前不是${actionName}的正确阶段` });
    return false;
  }
  return true;
}

/**
 * 校验玩家是否存活。
 */
function validateAliveOrReject(socket, player, actionName = '操作') {
  if (!player.isAlive) {
    socket.emit('error', { message: `你已经死亡，无法${actionName}` });
    return false;
  }
  return true;
}

/**
 * 校验玩家是否是房主。
 */
function validateHostOrReject(socket, room) {
  if (room.hostId !== socket.id) {
    socket.emit('error', { message: '只有房主可以进行该操作' });
    return false;
  }
  return true;
}

/**
 * 校验玩家不是 AI（某些操作真人才能做，AI 由服务端驱动）。
 */
function validateHumanOrReject(socket, player, actionName = '操作') {
  if (player.isAI) {
    socket.emit('error', { message: `AI 无法${actionName}` });
    return false;
  }
  return true;
}

module.exports = {
  getRoomInfoOrReject,
  validatePhaseOrReject,
  validateAliveOrReject,
  validateHostOrReject,
  validateHumanOrReject,
  PHASE,
};

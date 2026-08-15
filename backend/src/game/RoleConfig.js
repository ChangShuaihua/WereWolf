// 引入 constants 模块，用于获取游戏常量
const { ROLE_DISTRIBUTION, ROLE_NAMES } = require('./constants');

/**
 * Get role list for given player count.
 * Returns a shuffled copy.
 */
// 根据玩家数量获取角色配置
function getRolesForGame(playerCount) {
  const roles = ROLE_DISTRIBUTION[playerCount];
  if (!roles) {
    // 如果玩家数量不在支持范围内，使用默认配置
    const werewolves = Math.floor(playerCount / 3);
    const specials = Math.min(4, playerCount - werewolves - 1);
    const villagers = playerCount - werewolves - specials;
    // 随机打乱角色分布
    const allRoles = [
      ...Array(werewolves).fill('werewolf'),
      'seer', 'witch', 'guard', 'hunter',
      ...Array(Math.max(1, villagers)).fill('villager'),
    ].slice(0, playerCount);
    return shuffle(allRoles);
  }
  // 如果玩家数量在支持范围内，返回默认配置
  // 随机打乱角色分布
  return shuffle([...roles]);
}

/**
 * Fisher-Yates shuffle
 */
// 随机打乱数组元素顺序
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Get a human-readable role name
 */
// 获取角色的可读名称
function getRoleName(role) {
  return ROLE_NAMES[role] || role;
}

module.exports = { getRolesForGame, shuffle, getRoleName };

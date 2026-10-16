const { ROLE } = require('./constants');
const { roomCache } = require('../utils/cache');
const { extractAccusedSeats } = require('./FallbackStrategy');

/**
 * 按座位身份组装 AI 能看到的局面。隐藏身份只在规则允许时出现。
 */
function build(game, aiPlayer) {
  const role = game.getRole(aiPlayer.socketId);
  const isWerewolf = role === ROLE.WEREWOLF;

  const alivePlayers = game.alivePlayers.map((player) => {
    const playerRole = game.getRole(player.socketId);
    const isSelf = player.socketId === aiPlayer.socketId;
    const isTeammate = isWerewolf && !isSelf && playerRole === ROLE.WEREWOLF;
    return {
      socketId: player.socketId,
      seat: game.getSeatNum(player.socketId),
      role: isSelf ? role : (isTeammate ? playerRole : 'unknown'),
      isSelf,
      isTeammate,
    };
  });

  return {
    alivePlayers,
    teammates: alivePlayers.filter((player) => player.isTeammate),
  };
}

function ownNightHistory(game, aiPlayer, role) {
  const lines = [];
  for (const event of game.gameHistory || []) {
    const isSelf = event.actor?.id === aiPlayer.socketId;
    if (event.action === 'check' && isSelf && event.target) {
      const result = event.result === 'werewolf' || game.getRole(event.target.id) === ROLE.WEREWOLF ? '狼人' : '好人';
      lines.push(`第${event.night}夜你查验${event.target.username}，结果是${result}`);
    } else if (event.action === 'guard' && isSelf && event.target) {
      lines.push(`第${event.night}夜你守护了${event.target.username}`);
    } else if ((event.action === 'save' || event.action === 'poison') && isSelf) {
      const verb = event.action === 'save' ? '用解药救了' : '用毒药毒了';
      lines.push(`第${event.night}夜你${verb}${event.target?.username || '未知'}`);
    } else if (event.action === 'kill' && role === ROLE.WEREWOLF && event.target) {
      const actorIsWolf = isSelf || game.getRole(event.actor?.id) === ROLE.WEREWOLF;
      if (actorIsWolf) lines.push(`第${event.night}夜狼人刀了${event.target.username}`);
    }
  }
  return lines;
}

function canSeeHistoryEvent(game, aiPlayer, event) {
  if (!event) return false;
  const role = game.getRole(aiPlayer.socketId);
  const isSelf = event.actor?.id === aiPlayer.socketId;
  if (event.action === 'night_end' || event.action === 'vote' || event.action === 'hunter_shoot') return true;
  if (event.action === 'check' || event.action === 'guard' || event.action === 'save' || event.action === 'poison') {
    return isSelf;
  }
  if (event.action === 'kill') {
    if (role !== ROLE.WEREWOLF) return false;
    return isSelf || game.getRole(event.actor?.id) === ROLE.WEREWOLF;
  }
  return false;
}

function publicMemory(game, aiPlayer) {
  const chat = (roomCache.get(game.roomCode)?.chat || []).filter((msg) => !msg.isSystem);
  const mySeat = game.getSeatNum(aiPlayer.socketId);
  const accusations = {};
  const claims = {};
  const ownLines = [];

  for (const msg of chat) {
    const seat = String(msg.username || '');
    const text = String(msg.message || '');
    if (seat === mySeat) ownLines.push(text.slice(0, 40));
    for (const target of extractAccusedSeats(text)) {
      accusations[target] = (accusations[target] || 0) + 1;
    }
    const claim = text.match(/我是(?:真)?(预言家|女巫|守卫|猎人|狼人|平民|村民)/);
    if (claim && seat) {
      const roleName = claim[1] === '村民' ? '平民' : claim[1];
      if (!claims[seat]) claims[seat] = [];
      if (!claims[seat].includes(roleName)) claims[seat].push(roleName);
    }
  }

  const lines = [];
  const ranked = Object.entries(accusations).sort((a, b) => b[1] - a[1]).slice(0, 4);
  if (ranked.length) {
    lines.push(`公开怀疑：${ranked.map(([seat, count]) => `${seat}被点名${count}次`).join('，')}`);
  }
  for (const [seat, roles] of Object.entries(claims).slice(0, 4)) {
    lines.push(roles.length > 1
      ? `${seat}先后声称${roles.join('、')}（说法不一致）`
      : `${seat}声称自己是${roles[0]}`);
  }
  if (ownLines.length) lines.push(`你已经说过：${ownLines.slice(-2).join(' / ')}`);
  return lines;
}

function stanceLines(game, aiPlayer) {
  const counts = {};
  const own = [];
  for (const event of game.gameHistory || []) {
    if (event.action !== 'vote' || !event.target) continue;
    const seat = event.target.username || (event.target.id ? game.getSeatNum(event.target.id) : '');
    if (!seat) continue;
    counts[seat] = (counts[seat] || 0) + 1;
    if (event.actor?.id === aiPlayer.socketId) own.push(`你投过${seat}`);
  }
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const lines = [];
  if (ranked.length) lines.push(`公开投票累计：${ranked.map(([seat, count]) => `${seat}${count}票`).join('，')}`);
  if (own.length) lines.push(`你的投票记录：${own.slice(-4).join('；')}`);
  return lines;
}

function decisionBrief(game, aiPlayer) {
  const role = game.getRole(aiPlayer.socketId);
  const dead = game.players.filter((player) => !player.isAlive).map((player) => game.getSeatNum(player.socketId));
  const publicLines = [];
  for (const event of game.gameHistory || []) {
    if (!canSeeHistoryEvent(game, aiPlayer, event)) continue;
    if (event.action === 'night_end') {
      const deaths = (event.deaths || []).map((item) => item.username || (item.id ? game.getSeatNum(item.id) : '未知'));
      publicLines.push(deaths.length ? `第${event.night}夜死亡：${deaths.join('、')}` : `第${event.night}夜平安夜`);
    } else if (event.action === 'vote' && event.actor && event.target) {
      publicLines.push(`${event.actor.username}投票给了${event.target.username}`);
    } else if (event.action === 'hunter_shoot' && event.actor && event.target) {
      publicLines.push(`${event.actor.username}开枪带走了${event.target.username}`);
    }
  }
  const chat = (roomCache.get(game.roomCode)?.chat || []).slice(-8).map((msg) => {
    if (msg.isSystem) return `[系统] ${msg.message}`;
    return `${msg.username}: ${msg.message}`;
  });
  const privateLines = ownNightHistory(game, aiPlayer, role);
  const stance = [...stanceLines(game, aiPlayer), ...publicMemory(game, aiPlayer)];
  return [
    `已死亡：${dead.length ? dead.join('、') : '无'}`,
    `公开记录：\n${publicLines.slice(-12).join('\n') || '暂无'}`,
    `只有你知道的信息：\n${privateLines.join('\n') || '暂无'}`,
    stance.length ? `局内判断：\n${stance.join('\n')}` : '',
    `最近发言：\n${chat.join('\n') || '暂无'}`,
  ].filter(Boolean).join('\n');
}

module.exports = {
  build,
  ownNightHistory,
  canSeeHistoryEvent,
  stanceLines,
  publicMemory,
  decisionBrief,
};

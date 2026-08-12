const { ROLE } = require('./constants');

const ACTION_LABELS = {
  kill: '狼人袭击',
  check: '预言家查验',
  guard: '守卫守护',
  save: '女巫救人',
  poison: '女巫毒杀',
  vote: '放逐投票',
  night_end: '夜晚结算',
  hunter_shoot: '猎人开枪',
};

async function analyzeReplay(data, model = null) {
  const history = Array.isArray(data.history) ? data.history : [];
  const players = Array.isArray(data.players) ? data.players : [];
  const votes = history.filter(event => event.action === 'vote' && event.actor && event.target);
  const voteEdges = new Map();

  votes.forEach(event => {
    const key = `${event.actor.username}->${event.target.username}`;
    const current = voteEdges.get(key) || {
      source: event.actor.username,
      target: event.target.username,
      count: 0,
      nights: [],
    };
    current.count += 1;
    current.nights.push(event.night || 1);
    voteEdges.set(key, current);
  });

  const werewolves = new Set(players.filter(player => player.role === ROLE.WEREWOLF).map(player => player.username));
  const accurateVotes = votes.filter(event => werewolves.has(event.target.username) && !werewolves.has(event.actor.username));
  const topAccuser = countTop(accurateVotes.map(event => event.actor.username));
  const mostTargeted = countTop(votes.map(event => event.target.username));
  const turningPoint = findTurningPoint(history, players);

  const highlights = [];
  if (topAccuser) highlights.push(`${topAccuser.name} 对狼人的有效投票最多（${topAccuser.count} 次）`);
  if (mostTargeted) highlights.push(`${mostTargeted.name} 承受了全场最多投票（${mostTargeted.count} 票）`);
  if (turningPoint) highlights.push(turningPoint.text);
  if (highlights.length === 0) highlights.push('本局信息较少，胜负主要由存活人数变化决定');

  const analysis = {
    verdict: data.winner === 'werewolf'
      ? '狼人阵营成功隐藏身份，并将人数推进到控场线。'
      : '好人阵营完成了关键排狼，最终清除了全部狼人。',
    highlights,
    mvp: topAccuser?.name || players.find(player => player.isWinner)?.username || null,
    turningPoint,
    voteGraph: {
      nodes: players.map(player => ({
        id: player.username,
        role: player.role,
        roleName: player.roleName,
        team: player.role === ROLE.WEREWOLF ? 'werewolf' : 'villager',
        isWinner: player.isWinner,
      })),
      edges: Array.from(voteEdges.values()),
    },
    timeline: history.map((event, index) => ({
      id: index + 1,
      night: event.night || 0,
      action: event.action,
      label: ACTION_LABELS[event.action] || '关键事件',
      actor: event.actor?.username || null,
      target: event.target?.username || null,
      detail: event.detail || buildDetail(event),
    })),
  };

  if (!model || typeof model.invoke !== 'function') return analysis;

  try {
    const compactReplay = {
      winner: data.winner,
      players: players.map(player => ({
        name: player.username,
        role: player.roleName,
        winner: player.isWinner,
      })),
      events: analysis.timeline.map(event => ({
        day: event.night,
        action: event.label,
        actor: event.actor,
        target: event.target,
      })),
    };
    const response = await Promise.race([
      model.invoke([
        ['system', '你是狼人杀赛后分析师。只输出 JSON，不输出 Markdown。结论必须基于给定事件，不得虚构。'],
        ['human', `分析这局游戏：${JSON.stringify(compactReplay)}\n输出格式：{"verdict":"40字内总评","highlights":["亮点1","亮点2","亮点3"],"mvp":"玩家名或null"}`],
      ]),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Replay analysis timeout')), 8000)),
    ]);
    const parsed = parseModelJson(response?.content);
    if (parsed) {
      if (typeof parsed.verdict === 'string' && parsed.verdict.length <= 100) analysis.verdict = parsed.verdict;
      if (Array.isArray(parsed.highlights) && parsed.highlights.length) {
        analysis.highlights = parsed.highlights.filter(item => typeof item === 'string').slice(0, 4);
      }
      if (typeof parsed.mvp === 'string' && players.some(player => player.username === parsed.mvp)) {
        analysis.mvp = parsed.mvp;
      }
      analysis.source = 'llm';
    }
  } catch (err) {
    console.warn('[ReplayAnalyzer] Model analysis unavailable, using local analysis:', err.message);
  }

  return analysis;
}

function parseModelJson(content) {
  const text = Array.isArray(content)
    ? content.map(part => typeof part === 'string' ? part : part?.text || '').join('')
    : String(content || '');
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch (err) {
    return null;
  }
}

function countTop(values) {
  if (values.length === 0) return null;
  const counts = values.reduce((result, value) => {
    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
  const [name, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return { name, count };
}

function findTurningPoint(history, players) {
  const wolfNames = new Set(players.filter(player => player.role === ROLE.WEREWOLF).map(player => player.username));
  const vote = history.find(event => event.action === 'vote' && wolfNames.has(event.target?.username));
  if (vote) {
    return { night: vote.night || 1, text: `第 ${vote.night || 1} 天，${vote.actor.username} 首次把票投向狼人 ${vote.target.username}` };
  }
  const nightEnd = [...history].reverse().find(event => event.action === 'night_end' && event.deaths?.length);
  return nightEnd
    ? { night: nightEnd.night || 1, text: `第 ${nightEnd.night || 1} 夜的死亡结算改变了场上人数平衡` }
    : null;
}

function buildDetail(event) {
  if (event.actor && event.target) return `${event.actor.username} -> ${event.target.username}`;
  if (event.deaths?.length) return `死亡：${event.deaths.map(player => player.username).join('、')}`;
  return ACTION_LABELS[event.action] || '游戏事件';
}

module.exports = { analyzeReplay };

const { ROLE } = require('./constants');
const { roomCache } = require('../utils/cache');

function nightStrategy(aiPlayer) {
  return aiPlayer?.agentConfig?.strategy?.nightAction || 'random';
}

function extractAccusedSeats(text) {
  const seats = [];
  if (!text) return seats;
  const patterns = [
    /(\d+号).{0,12}(?:狼人|是狼|可疑|不对劲|漏洞|有问题|怀疑|出局)/g,
    /(?:投|怀疑|查杀)(\d+号)/g,
    /验了(\d+号).{0,8}(?:狼人|是狼)/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text))) {
      if (!seats.includes(match[1])) seats.push(match[1]);
    }
  }
  return seats;
}

function scorePublicTarget(game, player, strategy) {
  const seat = game.getSeatNum(player.socketId);
  const chat = roomCache.get(game.roomCode)?.chat || [];
  let speechLength = 0;
  let accusations = 0;
  for (const msg of chat) {
    if (msg.isSystem) continue;
    if (msg.username === seat) speechLength += (msg.message || '').length;
    if (extractAccusedSeats(msg.message || '').includes(seat)) accusations += 1;
  }
  if (strategy === 'target_weak') return -speechLength;
  return speechLength + accusations * 30;
}

function pickByNightStrategy(game, candidates, strategy) {
  if (!candidates.length) return null;
  if (!strategy || strategy === 'random' || strategy === 'follow_teammate') {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
  const ranked = [...candidates].sort(
    (a, b) => scorePublicTarget(game, b, strategy) - scorePublicTarget(game, a, strategy)
  );
  const topScore = scorePublicTarget(game, ranked[0], strategy);
  const tied = ranked.filter(player => scorePublicTarget(game, player, strategy) === topScore);
  return tied[Math.floor(Math.random() * tied.length)];
}

function werewolfConsensusTarget(game, aiPlayer) {
  const tally = {};
  for (const player of game.alivePlayers) {
    if (player.socketId === aiPlayer.socketId) continue;
    if (game.getRole(player.socketId) !== ROLE.WEREWOLF) continue;
    const action = game.nightActions?.[player.socketId];
    if (action?.action === 'kill' && action.targetId) {
      tally[action.targetId] = (tally[action.targetId] || 0) + 1;
    }
  }
  const best = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : null;
}

function legalNightTargets(game, aiPlayer, role) {
  const others = game.alivePlayers.filter(player => player.socketId !== aiPlayer.socketId);
  if (role === ROLE.WEREWOLF) {
    return others.filter(player => game.getRole(player.socketId) !== ROLE.WEREWOLF);
  }
  if (role === ROLE.GUARD) {
    return others.filter(player => player.socketId !== game.guardLastProtected);
  }
  return others;
}

function isLegalNightAction(game, aiPlayer, role, action, targetId) {
  if (role === ROLE.WITCH && action === 'skip') return true;
  if (!targetId) return false;
  const legalIds = new Set(legalNightTargets(game, aiPlayer, role).map(player => player.socketId));
  if (action === 'save') {
    return role === ROLE.WITCH && !game.witchSaveUsed && targetId === game.killedByWerewolves;
  }
  if (action === 'poison') {
    return role === ROLE.WITCH && !game.witchPoisonUsed && legalIds.has(targetId);
  }
  if (action === 'kill') return role === ROLE.WEREWOLF && legalIds.has(targetId);
  if (action === 'check') return role === ROLE.SEER && legalIds.has(targetId);
  if (action === 'guard') return role === ROLE.GUARD && legalIds.has(targetId);
  return false;
}

function accusationCounts(game, candidates) {
  const counts = {};
  const chat = roomCache.get(game.roomCode)?.chat || [];
  for (const msg of chat) {
    if (msg.isSystem) continue;
    for (const seat of extractAccusedSeats(msg.message || '')) {
      counts[seat] = (counts[seat] || 0) + 1;
    }
  }
  return candidates
    .map(player => ({ player, count: counts[game.getSeatNum(player.socketId)] || 0 }))
    .sort((a, b) => b.count - a.count);
}

function note(rememberThought, game, aiPlayer, thought) {
  if (typeof rememberThought === 'function') rememberThought(game, aiPlayer, thought);
}

function emergencyNightAction(game, aiPlayer, role, rememberThought) {
  const candidates = legalNightTargets(game, aiPlayer, role);
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  let action = null;
  if (role === ROLE.WEREWOLF && pick) action = { action: 'kill', targetId: pick.socketId };
  else if (role === ROLE.SEER && pick) action = { action: 'check', targetId: pick.socketId };
  else if (role === ROLE.GUARD && pick) action = { action: 'guard', targetId: pick.socketId };
  else if (role === ROLE.WITCH) action = { action: 'skip', targetId: null };

  if (action) {
    const summary = action.action === 'skip'
      ? '跳过'
      : `${action.action} → ${game.getSeatNum(action.targetId)}`;
    note(rememberThought, game, aiPlayer, {
      kind: '夜间行动',
      summary,
      reasoning: '模型两次都没有给出合法行动，随机选了一个合法目标。',
    });
  }
  return action;
}

function nightAction(game, aiPlayer, role, rememberThought) {
  const finish = (action) => {
    if (action) {
      const summary = action.action === 'skip'
        ? '跳过'
        : `${action.action} → ${action.targetId ? game.getSeatNum(action.targetId) : '无'}`;
      note(rememberThought, game, aiPlayer, {
        kind: '夜间行动',
        summary,
        reasoning: '按本地策略选择，没有大模型推理。',
      });
    }
    return action;
  };
  if (aiPlayer?.fallbackEnabled === false) return null;
  const strategy = nightStrategy(aiPlayer);
  const candidates = legalNightTargets(game, aiPlayer, role);
  if (role !== ROLE.WITCH && candidates.length === 0) return null;

  if (role === ROLE.WEREWOLF) {
    const consensus = werewolfConsensusTarget(game, aiPlayer);
    if (consensus && candidates.some(player => player.socketId === consensus)) {
      return finish({ action: 'kill', targetId: consensus });
    }
    const target = pickByNightStrategy(game, candidates, strategy);
    return finish(target ? { action: 'kill', targetId: target.socketId } : null);
  }

  if (role === ROLE.SEER) {
    const checked = new Set(
      (game.gameHistory || [])
        .filter(event => event.action === 'check' && event.actor?.id === aiPlayer.socketId && event.target?.id)
        .map(event => event.target.id)
    );
    const unseen = candidates.filter(player => !checked.has(player.socketId));
    const target = pickByNightStrategy(game, unseen.length ? unseen : candidates, strategy);
    return finish(target ? { action: 'check', targetId: target.socketId } : null);
  }

  if (role === ROLE.GUARD) {
    const target = pickByNightStrategy(game, candidates, strategy === 'follow_teammate' ? 'target_strong' : strategy);
    return finish(target ? { action: 'guard', targetId: target.socketId } : null);
  }

  if (role === ROLE.WITCH) {
    const accused = accusationCounts(game, candidates);
    const top = accused[0];
    if (!game.witchPoisonUsed && top && top.count >= 2) {
      return finish({ action: 'poison', targetId: top.player.socketId });
    }
    if (!game.witchSaveUsed && game.killedByWerewolves && game.killedByWerewolves !== aiPlayer.socketId) {
      return finish({ action: 'save', targetId: game.killedByWerewolves });
    }
    if (!game.witchPoisonUsed && top && top.count >= 1 && (game.nightCount || 1) >= 2) {
      return finish({ action: 'poison', targetId: top.player.socketId });
    }
    return finish({ action: 'skip', targetId: null });
  }

  return finish(null);
}

function voteCandidates(game, aiPlayer) {
  let candidates = game.alivePlayers.filter(player => player.socketId !== aiPlayer.socketId);
  if (Array.isArray(game.pkCandidates) && game.pkCandidates.length > 0) {
    candidates = candidates.filter(player => game.pkCandidates.includes(player.socketId));
  }
  if (game.getRole(aiPlayer.socketId) === ROLE.WEREWOLF) {
    const nonWolves = candidates.filter(player => game.getRole(player.socketId) !== ROLE.WEREWOLF);
    if (nonWolves.length > 0) candidates = nonWolves;
  }
  return candidates;
}

function vote(game, aiPlayer, rememberThought) {
  const finish = (targetId) => {
    if (targetId) {
      note(rememberThought, game, aiPlayer, {
        kind: '投票',
        summary: `投票给 ${game.getSeatNum(targetId)}`,
        reasoning: '按本地策略投票，没有大模型推理。',
      });
    }
    return targetId;
  };
  if (aiPlayer?.fallbackEnabled === false) return null;
  const candidates = voteCandidates(game, aiPlayer);
  if (candidates.length === 0) return null;

  const dayStrategy = aiPlayer.agentConfig?.strategy?.dayStrategy;
  if (dayStrategy === 'follower' && game.votes) {
    const tally = {};
    for (const targetId of Object.values(game.votes)) {
      if (candidates.some(player => player.socketId === targetId)) {
        tally[targetId] = (tally[targetId] || 0) + 1;
      }
    }
    const leading = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
    if (leading) return finish(leading[0]);
  }

  const accused = accusationCounts(game, candidates).filter(item => item.count > 0);
  if (accused.length > 0) return finish(accused[0].player.socketId);

  const strategy = dayStrategy === 'leader' || dayStrategy === 'active' ? 'target_strong' : 'random';
  const target = pickByNightStrategy(game, candidates, strategy);
  return finish(target ? target.socketId : null);
}

module.exports = {
  nightStrategy,
  extractAccusedSeats,
  scorePublicTarget,
  pickByNightStrategy,
  werewolfConsensusTarget,
  legalNightTargets,
  isLegalNightAction,
  accusationCounts,
  emergencyNightAction,
  nightAction,
  voteCandidates,
  vote,
};

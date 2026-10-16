function traitBand(value) {
  const n = Number(value);
  if (n > 70) return 'high';
  if (n < 30) return 'low';
  return 'mid';
}

const TRAIT_NOTES = {
  aggressiveness: {
    high: '激进度高：发言会主动点名质疑，随机程度也会略高。',
    low: '激进度低：少主动攻击别人。',
  },
  caution: {
    high: '谨慎度高：发言更收着，模型随机程度降低。',
    low: '谨慎度低：更敢把判断说出来，随机程度略高。',
  },
  cunning: {
    high: '狡猾度高：提示词会让它更会编理由。',
    low: '狡猾度低：更直，不绕。',
  },
  honesty: {
    high: '诚实度高：提示词要求少编造。狼人用这套性格时也会被要求别太会撒谎。',
    low: '诚实度低：狼人会被要求编夜间信息；好人则说话更直。',
  },
  talkativeness: {
    high: '话多：发言更长，随机程度略高。',
    low: '话少：只说短句，随机程度降低。',
  },
};

export function traitHint(key, value) {
  const band = traitBand(value);
  const notes = TRAIT_NOTES[key];
  if (!notes) return '';
  if (band === 'high') return notes.high;
  if (band === 'low') return notes.low;
  return '落在中间：这项不会单独把语气推往某一边。';
}

export function personalityNotes(personality = {}) {
  const notes = [];
  for (const key of Object.keys(TRAIT_NOTES)) {
    const band = traitBand(personality[key]);
    if (band === 'high' || band === 'low') notes.push(TRAIT_NOTES[key][band]);
  }
  if (notes.length === 0) notes.push('五项都在中间：发言长短和口气都比较平。');
  notes.push('性格主要写进发言提示。谨慎、话多和激进还会改模型的随机程度。');
  return notes;
}

const NIGHT_NOTES = {
  random: '随机攻击：没有模型时，在合法目标里随便挑。',
  target_weak: '攻击弱者：没有模型时，优先选发言更短的人。',
  target_strong: '攻击强者：没有模型时，优先选发言更长、被公开点名更多的人。',
  follow_teammate: '跟随队友：狼人会先跟已经下刀的队友；队友还没选时，在合法目标里随机挑。守卫会改成优先选发言多的人。',
};

const DAY_NOTES = {
  passive: '被动：没有模型时，先投被公开点名的人，没有点名就随机。提示词里少带节奏。',
  active: '主动：没有模型时，先投被点名的人，否则优先发言多的人。提示词里会积极分析。',
  leader: '领袖：投票目标和主动一样，提示词里会去带票。',
  follower: '跟随者：没有模型时，有人先投票就跟当前票数最高的。提示词里参考别人。',
};

const REVEAL_NOTES = {
  early: '尽早：只写进投票阶段的提示，告诉模型可以早点亮身份。本地投票不会按这项改目标。',
  mid: '中期：只写进投票阶段的提示。本地投票不会按这项改目标。',
  late: '晚期：只写进投票阶段的提示，让模型晚一点再亮。本地投票不会按这项改目标。',
  never: '从不：只写进投票阶段的提示，让模型别亮身份。本地投票不会按这项改目标。',
};

export function strategyNotes(strategy = {}) {
  return [
    NIGHT_NOTES[strategy.nightAction] || NIGHT_NOTES.random,
    DAY_NOTES[strategy.dayStrategy] || DAY_NOTES.passive,
    REVEAL_NOTES[strategy.revealIdentity] || REVEAL_NOTES.mid,
  ];
}

function firstPhrase(list, fallback) {
  return Array.isArray(list) && list[0] ? list[0] : fallback;
}

export function buildSampleLine(agent = {}) {
  const personality = agent.personality || {};
  const style = agent.speakingStyle || 'calm';
  const lang = agent.language || {};
  const prefix = firstPhrase(lang.prefixes, '我觉得');
  const suffix = firstPhrase(lang.suffixes, '');
  const word = firstPhrase(lang.favoriteWords, '');
  const seat = '3号';

  let core;
  if (traitBand(personality.talkativeness) === 'low') {
    core = `${seat}先放一放`;
  } else if (traitBand(personality.aggressiveness) === 'high') {
    core = `${seat}这轮必须出，别再绕`;
  } else if (traitBand(personality.caution) === 'high') {
    core = `${seat}我还要再听一轮`;
  } else if (traitBand(personality.cunning) === 'high') {
    core = `${seat}这票先挂着，别急着站死`;
  } else {
    core = `${seat}发言有点跳，我先看他`;
  }

  if (traitBand(personality.talkativeness) === 'high') {
    core += '，前后对不上的地方单独问';
  }
  if (style === 'humorous') core += '，别太严肃';
  if (style === 'mysterious') core += '，我先说到这';

  let line = `${prefix}，${core}`;
  if (word && !line.includes(word)) line += `，${word}`;
  line += suffix ? `。${suffix}` : '。';
  return line;
}

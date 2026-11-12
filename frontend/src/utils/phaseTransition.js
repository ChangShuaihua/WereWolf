const DAY_PHASES = new Set(['LAST_WILL', 'DISCUSSION', 'DAY', 'VOTE'])

export function atmosphereForPhase(phase) {
  if (phase === 'NIGHT') return 'night'
  if (DAY_PHASES.has(phase)) return 'day'
  return 'neutral'
}

export function phaseTransitionContent(kind) {
  if (kind === 'day') {
    return {
      kind: 'day',
      title: '天亮了',
      copy: '昨夜已经过去，请睁眼确认场上的变化。',
    }
  }

  if (kind === 'night') {
    return {
      kind: 'night',
      title: '天黑请闭眼',
      copy: '村庄归于寂静，夜间角色即将行动。',
    }
  }

  return null
}

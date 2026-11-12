import test from 'node:test'
import assert from 'node:assert/strict'
import { atmosphereForPhase, phaseTransitionContent } from './phaseTransition.js'

test('atmosphereForPhase maps every active game phase', () => {
  assert.equal(atmosphereForPhase('NIGHT'), 'night')
  for (const phase of ['LAST_WILL', 'DISCUSSION', 'DAY', 'VOTE']) {
    assert.equal(atmosphereForPhase(phase), 'day')
  }
})

test('atmosphereForPhase keeps waiting, end and unknown phases neutral', () => {
  for (const phase of ['WAITING', 'END', '', undefined, 'UNKNOWN']) {
    assert.equal(atmosphereForPhase(phase), 'neutral')
  }
})

test('phaseTransitionContent returns stable copy for supported transitions', () => {
  assert.deepEqual(phaseTransitionContent('day'), {
    kind: 'day',
    title: '天亮了',
    copy: '昨夜已经过去，请睁眼确认场上的变化。',
  })
  assert.equal(phaseTransitionContent('neutral'), null)
})

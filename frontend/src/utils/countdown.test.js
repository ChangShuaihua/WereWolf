import test from 'node:test'
import assert from 'node:assert/strict'
import { countdownPercent, countdownUrgency } from './countdown.js'

test('countdownPercent calculates and clamps progress', () => {
  assert.equal(countdownPercent(30, 60), 50)
  assert.equal(countdownPercent(90, 60), 100)
  assert.equal(countdownPercent(-1, 60), 0)
})

test('countdownPercent handles invalid or zero timeouts', () => {
  assert.equal(countdownPercent(10, 0), 0)
  assert.equal(countdownPercent(10, -5), 0)
  assert.equal(countdownPercent('invalid', 60), 0)
})

test('countdownUrgency uses the component thresholds', () => {
  assert.equal(countdownUrgency(24.99), 'danger')
  assert.equal(countdownUrgency(25), 'warning')
  assert.equal(countdownUrgency(49.99), 'warning')
  assert.equal(countdownUrgency(50), 'safe')
})

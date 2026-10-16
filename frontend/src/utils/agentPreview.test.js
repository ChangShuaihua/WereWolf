import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSampleLine, strategyNotes, traitHint } from './agentPreview.js';

test('loud personality produces a direct sample line', () => {
  const line = buildSampleLine({
    personality: { aggressiveness: 90, caution: 40, cunning: 40, honesty: 50, talkativeness: 80 },
    speakingStyle: 'aggressive',
    language: { prefixes: ['听清楚'], suffixes: ['别犹豫'], favoriteWords: ['拍板'] },
  });
  assert.match(line, /3号这轮必须出/);
  assert.match(line, /^听清楚，/);
  assert.match(line, /拍板/);
  assert.match(line, /别犹豫$/);
});

test('quiet personality stays short', () => {
  const line = buildSampleLine({
    personality: { aggressiveness: 90, caution: 20, cunning: 20, honesty: 80, talkativeness: 10 },
    speakingStyle: 'calm',
    language: { prefixes: ['嗯'], suffixes: [], favoriteWords: [] },
  });
  assert.equal(line, '嗯，3号先放一放。');
});

test('strategy notes describe fallback behavior', () => {
  const notes = strategyNotes({
    nightAction: 'follow_teammate',
    dayStrategy: 'follower',
    revealIdentity: 'never',
  });
  assert.match(notes[0], /队友/);
  assert.match(notes[1], /票数最高/);
  assert.match(notes[2], /本地投票不会按这项改目标/);
  assert.match(traitHint('talkativeness', 90), /发言更长/);
  assert.match(traitHint('caution', 50), /落在中间/);
});

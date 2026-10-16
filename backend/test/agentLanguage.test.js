const test = require('node:test');
const assert = require('node:assert/strict');
const { languageMatches } = require('../src/ai/AIAgentManager');

test('builtin language refresh only matches the old phrase lists exactly', () => {
  const legacy = {
    prefixes: ['我有药', '昨晚'],
    suffixes: ['你们懂的', '不多说了'],
    favoriteWords: ['救', '毒', '药'],
  };
  assert.equal(languageMatches(legacy, legacy), true);
  assert.equal(languageMatches({
    ...legacy,
    favoriteWords: ['藏着', '后手', '再看'],
  }, legacy), false);
  assert.equal(languageMatches({ prefixes: legacy.prefixes }, legacy), false);
});

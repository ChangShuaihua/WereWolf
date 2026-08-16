const test = require('node:test');
const assert = require('node:assert/strict');

process.env.LLM_CONFIG_ENCRYPTION_KEY = 'test-only-encryption-key-that-is-long-enough';

const { encryptSecret, decryptSecret } = require('../src/utils/secretCrypto');

test('encryptSecret round-trips without storing plaintext', () => {
  const plaintext = 'sk-example-secret';
  const encrypted = encryptSecret(plaintext);

  assert.match(encrypted, /^enc:v1:/);
  assert.equal(encrypted.includes(plaintext), false);
  assert.equal(decryptSecret(encrypted), plaintext);
});

test('decryptSecret keeps legacy plaintext readable', () => {
  assert.equal(decryptSecret('legacy-key'), 'legacy-key');
});

test('encryptSecret uses a unique nonce', () => {
  assert.notEqual(encryptSecret('same-key'), encryptSecret('same-key'));
});

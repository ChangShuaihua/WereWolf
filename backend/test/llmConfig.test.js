const test = require('node:test');
const assert = require('node:assert/strict');
const { validateApiUrl } = require('../src/config/llmConfig');

test('validateApiUrl rejects local and private destinations', () => {
  assert.ok(validateApiUrl('http://localhost:8080/v1'));
  assert.ok(validateApiUrl('http://127.0.0.1/v1'));
  assert.ok(validateApiUrl('http://192.168.1.20/v1'));
  assert.ok(validateApiUrl('http://[::1]/v1'));
  assert.ok(validateApiUrl('file:///etc/passwd'));
});

test('validateApiUrl accepts a public HTTPS endpoint', () => {
  assert.equal(validateApiUrl('https://api.openai.com/v1'), null);
});

test('validateApiUrl enforces configured production allowlist', () => {
  const previous = process.env.LLM_ALLOWED_HOSTS;
  process.env.LLM_ALLOWED_HOSTS = 'api.openai.com,api.deepseek.com';
  try {
    assert.equal(validateApiUrl('https://api.deepseek.com/v1'), null);
    assert.ok(validateApiUrl('https://example.com/v1'));
  } finally {
    if (previous === undefined) delete process.env.LLM_ALLOWED_HOSTS;
    else process.env.LLM_ALLOWED_HOSTS = previous;
  }
});

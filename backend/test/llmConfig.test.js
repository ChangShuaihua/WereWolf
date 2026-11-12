const test = require('node:test');
const assert = require('node:assert/strict');
const { validateApiUrl, resolveConfig } = require('../src/config/llmConfig');

test('resolveConfig uses server default when user has no API key', () => {
  const previous = {
    key: process.env.DEFAULT_LLM_API_KEY,
    url: process.env.DEFAULT_LLM_API_URL,
    model: process.env.DEFAULT_LLM_MODEL_NAME,
  };
  process.env.DEFAULT_LLM_API_KEY = 'default-key';
  process.env.DEFAULT_LLM_API_URL = 'https://api.example.com/v1';
  process.env.DEFAULT_LLM_MODEL_NAME = 'default-model';
  try {
    assert.deepEqual(resolveConfig({ apiKey: '', modelName: 'ignored' }), {
      apiKey: 'default-key',
      apiUrl: 'https://api.example.com/v1',
      modelName: 'default-model',
      source: 'default',
    });
  } finally {
    if (previous.key === undefined) delete process.env.DEFAULT_LLM_API_KEY;
    else process.env.DEFAULT_LLM_API_KEY = previous.key;
    if (previous.url === undefined) delete process.env.DEFAULT_LLM_API_URL;
    else process.env.DEFAULT_LLM_API_URL = previous.url;
    if (previous.model === undefined) delete process.env.DEFAULT_LLM_MODEL_NAME;
    else process.env.DEFAULT_LLM_MODEL_NAME = previous.model;
  }
});

test('resolveConfig prefers a complete user configuration', () => {
  assert.deepEqual(resolveConfig({
    apiKey: ' user-key ', apiUrl: ' https://user.example/v1 ', modelName: ' user-model ',
  }), {
    apiKey: 'user-key', apiUrl: 'https://user.example/v1', modelName: 'user-model', source: 'user',
  });
});

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

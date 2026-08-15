/**
 * llmConfig - 大模型 API 配置解析与模型实例构建
 *
 * 职责：
 * 1. 提供空的默认配置占位（系统不内置任何默认大模型 API）；
 * 2. 解析用户 DB 配置（trim 首尾空白）；
 * 3. 按配置签名缓存 ChatOpenAI 实例，避免每次调用重建。
 *
 * 每个用户的 API Key 存在 users 表（见 models/User.js），
 * 房间 AI 使用房主的 Key，规则问答使用提问者的 Key。
 */

const { ChatOpenAI } = require('@langchain/openai');

// 模型实例缓存，key 由 apiKey/apiUrl/modelName/temperature/maxTokens 决定
const modelCache = new Map();

/**
 * 空配置占位：系统不再内置任何默认大模型 API，
 * 唯一的 API 来源是用户在「设置」页配置并绑定到账号的 Key。
 */
function getEnvConfig() {
  return { apiKey: '', apiUrl: '', modelName: '' };
}

/**
 * 返回用户 DB 配置（去除首尾空白）。
 * @param {object} userDb - { apiKey?, apiUrl?, modelName? }
 */
function mergeConfig(userDb = {}) {
  return {
    apiKey: (userDb.apiKey || '').trim(),
    apiUrl: (userDb.apiUrl || '').trim(),
    modelName: (userDb.modelName || '').trim(),
  };
}

function modelKey(cfg, opts = {}) {
  const temperature = opts.temperature ?? 0.7;
  const maxTokens = opts.maxTokens ?? 1000;
  const timeout = opts.timeout ?? 0;
  return `${cfg.apiKey}|${cfg.apiUrl}|${cfg.modelName}|${temperature}|${maxTokens}|${timeout}`;
}

/**
 * 构建（或复用缓存的）ChatOpenAI 实例；无 apiKey 时返回 null。
 * @param {object} cfg - 合并后的配置
 * @param {object} opts - { temperature?, maxTokens?, timeout? }
 */
function buildModel(cfg, opts = {}) {
  if (!cfg || !cfg.apiKey) return null;
  const key = modelKey(cfg, opts);
  if (!modelCache.has(key)) {
    modelCache.set(key, new ChatOpenAI({
      apiKey: cfg.apiKey,
      modelName: cfg.modelName,
      configuration: cfg.apiUrl ? { baseURL: cfg.apiUrl } : {},
      temperature: opts.temperature ?? 0.7,
      maxTokens: opts.maxTokens ?? 1000,
      timeout: opts.timeout,
    }));
  }
  return modelCache.get(key);
}

/**
 * 对 API Key 打码，仅展示首尾片段。
 */
function maskKey(key) {
  if (!key) return '';
  if (key.length <= 8) return '••••';
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

module.exports = { getEnvConfig, mergeConfig, buildModel, maskKey, modelCache };

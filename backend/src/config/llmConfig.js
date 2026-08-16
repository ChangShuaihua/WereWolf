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
const crypto = require('crypto');
const net = require('net');

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
  const keyHash = crypto.createHash('sha256').update(cfg.apiKey).digest('hex');
  return `${keyHash}|${cfg.apiUrl}|${cfg.modelName}|${temperature}|${maxTokens}|${timeout}`;
}

function isPrivateIp(hostname) {
  if (net.isIPv4(hostname)) {
    const [a, b] = hostname.split('.').map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  if (net.isIPv6(hostname)) {
    const host = hostname.toLowerCase();
    return (
      host === '::1' ||
      host === '::' ||
      host.startsWith('fc') ||
      host.startsWith('fd') ||
      host.startsWith('fe8') ||
      host.startsWith('fe9') ||
      host.startsWith('fea') ||
      host.startsWith('feb')
    );
  }
  return false;
}

function validateApiUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch (_) {
    return 'API 地址格式无效';
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    return 'API 地址必须使用 http/https，且不能包含认证信息';
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || isPrivateIp(hostname)) {
    return 'API 地址不能指向本机、内网或链路本地地址';
  }

  const allowedHosts = (process.env.LLM_ALLOWED_HOSTS || '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  if (allowedHosts.length > 0 && !allowedHosts.includes(hostname)) {
    return '该 API 域名不在服务器允许列表中';
  }

  return null;
}

/**
 * 构建（或复用缓存的）ChatOpenAI 实例；无 apiKey 时返回 null。
 * @param {object} cfg - 合并后的配置
 * @param {object} opts - { temperature?, maxTokens?, timeout? }
 */
function buildModel(cfg, opts = {}) {
  if (!cfg || !cfg.apiKey) return null;
  if (cfg.apiUrl) {
    const urlError = validateApiUrl(cfg.apiUrl);
    if (urlError) throw new Error(urlError);
  }
  const key = modelKey(cfg, opts);
  if (!modelCache.has(key)) {
    modelCache.set(
      key,
      new ChatOpenAI({
        apiKey: cfg.apiKey,
        modelName: cfg.modelName,
        configuration: cfg.apiUrl ? { baseURL: cfg.apiUrl } : {},
        temperature: opts.temperature ?? 0.7,
        maxTokens: opts.maxTokens ?? 1000,
        timeout: opts.timeout,
      })
    );
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

module.exports = { getEnvConfig, mergeConfig, buildModel, maskKey, validateApiUrl, modelCache };

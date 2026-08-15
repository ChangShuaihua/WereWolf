/**
 * llmConfig - 大模型 API 运行时配置（仅内存，不落盘）
 *
 * 允许用户在设置页面动态传入 API Key / Base URL / 模型名，
 * 覆盖 .env 中的默认配置。该配置只保存在进程内存中，
 * 服务重启后即失效，不会写入数据库或本地文件。
 */

const runtimeConfig = {
  apiKey: null,
  apiUrl: null,
  modelName: null,
};

const DEFAULT_API_URL = 'https://api.xiaomimimo.com';
const DEFAULT_MODEL_NAME = 'mimo-v2-flash';

/**
 * 获取当前生效的 LLM 配置。
 * 优先级：运行时设置 > 环境变量 > 默认值。
 * @returns {{apiKey: string, apiUrl: string, modelName: string}}
 */
function getEffectiveConfig() {
  const apiKey =
    runtimeConfig.apiKey ||
    process.env.XIAOMI_API_KEY ||
    process.env.DEEPSEEK_API_KEY ||
    '';
  const apiUrl =
    runtimeConfig.apiUrl ||
    process.env.XIAOMI_API_URL ||
    process.env.DEEPSEEK_API_URL ||
    DEFAULT_API_URL;
  const modelName =
    runtimeConfig.modelName ||
    process.env.XIAOMI_MODEL_NAME ||
    process.env.MODEL_NAME ||
    DEFAULT_MODEL_NAME;

  return { apiKey, apiUrl, modelName };
}

/**
 * 设置运行时配置（仅内存）。
 * @param {object} opts - { apiKey?, apiUrl?, modelName? }
 *   apiKey 传空字符串表示清除运行时 key；undefined 表示保持不变。
 */
function setConfig({ apiKey, apiUrl, modelName } = {}) {
  if (typeof apiKey === 'string') {
    runtimeConfig.apiKey = apiKey.trim() || null;
  }
  if (typeof apiUrl === 'string' && apiUrl.trim()) {
    runtimeConfig.apiUrl = apiUrl.trim();
  }
  if (typeof modelName === 'string' && modelName.trim()) {
    runtimeConfig.modelName = modelName.trim();
  }
  return getStatus();
}

/**
 * 清除所有运行时配置，回退到 .env 默认值。
 */
function clearConfig() {
  runtimeConfig.apiKey = null;
  runtimeConfig.apiUrl = null;
  runtimeConfig.modelName = null;
  return getStatus();
}

/**
 * 返回给前端的配置状态（不包含完整 API Key）。
 */
function getStatus() {
  const { apiKey, apiUrl, modelName } = getEffectiveConfig();
  return {
    configured: Boolean(apiKey),
    apiKeySet: Boolean(apiKey),
    apiKeyPreview: maskKey(apiKey),
    apiUrl,
    modelName,
    runtimeOverride: Boolean(
      runtimeConfig.apiKey || runtimeConfig.apiUrl || runtimeConfig.modelName
    ),
  };
}

/**
 * 对 API Key 打码，仅展示首尾片段。
 */
function maskKey(key) {
  if (!key) return '';
  if (key.length <= 8) return '••••';
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

module.exports = { getEffectiveConfig, setConfig, clearConfig, getStatus };

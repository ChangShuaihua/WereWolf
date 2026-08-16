const express = require('express');
const authMiddleware = require('../middleware/auth');
const User = require('../models/User');
const llmConfig = require('../config/llmConfig');

const router = express.Router();

// 所有设置接口都需要登录，且仅操作当前登录用户自己的配置
router.use(authMiddleware);

// 组装当前用户的状态（不返回完整 API Key）
function buildStatus(dbCfg) {
  const cfg = llmConfig.mergeConfig(dbCfg);
  return {
    // ownKeySet：是否填了 Key；configured：是否已配置完整（有 Key + 模型名）
    ownKeySet: Boolean(cfg.apiKey),
    configured: Boolean(cfg.apiKey && cfg.modelName),
    apiKeyPreview: llmConfig.maskKey(cfg.apiKey),
    apiUrl: cfg.apiUrl,
    modelName: cfg.modelName,
    source: cfg.apiKey ? 'user' : 'none',
  };
}

// GET /api/settings/llm - 获取当前用户的 LLM 配置状态（不返回完整 API Key）
router.get('/llm', async (req, res) => {
  try {
    const dbCfg = await User.getLLMConfig(req.user.id);
    res.json(buildStatus(dbCfg));
  } catch (err) {
    console.error('[settings] get LLM config failed:', err.message);
    res.status(500).json({ message: '获取设置失败' });
  }
});

// PUT /api/settings/llm - 更新当前用户的 LLM 配置（存数据库）
router.put('/llm', async (req, res) => {
  const { apiKey, apiUrl, modelName } = req.body || {};

  const apiUrlError = apiUrl ? llmConfig.validateApiUrl(apiUrl) : null;
  if (apiUrlError) {
    return res.status(400).json({ message: apiUrlError });
  }
  if (typeof modelName === 'string' && modelName.length > 100) {
    return res.status(400).json({ message: '模型名过长' });
  }
  if (typeof apiKey === 'string' && apiKey.length > 500) {
    return res.status(400).json({ message: 'API Key 过长' });
  }

  try {
    const dbCfg = await User.updateLLMConfig(req.user.id, {
      apiKey: typeof apiKey === 'string' ? apiKey : undefined,
      apiUrl: typeof apiUrl === 'string' ? apiUrl : undefined,
      modelName: typeof modelName === 'string' ? modelName : undefined,
    });
    res.json({ ...buildStatus(dbCfg), message: 'LLM 配置已更新' });
  } catch (err) {
    console.error('[settings] update LLM config failed:', err.message);
    res.status(500).json({ message: '保存失败' });
  }
});

// DELETE /api/settings/llm - 清除当前用户的 API 配置
router.delete('/llm', async (req, res) => {
  try {
    const dbCfg = await User.clearLLMConfig(req.user.id);
    res.json({ ...buildStatus(dbCfg), message: '已清除你的 API 配置' });
  } catch (err) {
    console.error('[settings] clear LLM config failed:', err.message);
    res.status(500).json({ message: '清除失败' });
  }
});

// POST /api/settings/llm/test - 测试当前（或表单中的）LLM 是否可用
router.post('/llm/test', async (req, res) => {
  let dbCfg = { apiKey: '', apiUrl: '', modelName: '' };
  try {
    dbCfg = await User.getLLMConfig(req.user.id);
  } catch (err) {
    console.error('[settings] load user config for test failed:', err.message);
  }

  const saved = llmConfig.mergeConfig(dbCfg);
  const { apiKey, apiUrl, modelName } = req.body || {};

  // 表单传入的值优先，未传则用已保存/默认配置，方便「先测试再保存」
  const effective = {
    apiKey: typeof apiKey === 'string' && apiKey.trim() ? apiKey.trim() : saved.apiKey,
    apiUrl: typeof apiUrl === 'string' && apiUrl.trim() ? apiUrl.trim() : saved.apiUrl,
    modelName:
      typeof modelName === 'string' && modelName.trim() ? modelName.trim() : saved.modelName,
  };

  if (!effective.apiKey) {
    return res.json({ ok: false, message: '未配置 API Key，请先在下方填写' });
  }
  if (!effective.modelName) {
    return res.json({ ok: false, message: '缺少模型名称，请填写模型名称（如 deepseek-chat）' });
  }
  if (!effective.apiUrl) {
    return res.json({
      ok: false,
      message: '缺少 API 地址，请填写 Base URL（如 https://api.deepseek.com）',
    });
  }
  const apiUrlError = llmConfig.validateApiUrl(effective.apiUrl);
  if (apiUrlError) {
    return res.json({ ok: false, message: apiUrlError });
  }

  const start = Date.now();
  try {
    const testModel = llmConfig.buildModel(effective, {
      temperature: 0,
      maxTokens: 32,
      timeout: 15000,
    });
    const reply = await testModel.invoke('请只回复两个字：OK');
    res.json({
      ok: true,
      latency: Date.now() - start,
      modelName: effective.modelName,
      apiUrl: effective.apiUrl,
      reply: (reply?.content ?? '').trim(),
    });
  } catch (err) {
    res.json({
      ok: false,
      latency: Date.now() - start,
      modelName: effective.modelName,
      apiUrl: effective.apiUrl,
      message: err.message || '连接失败',
    });
  }
});

module.exports = router;

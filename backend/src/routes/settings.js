const express = require('express');
const { ChatOpenAI } = require('@langchain/openai');
const authMiddleware = require('../middleware/auth');
const llmConfig = require('../config/llmConfig');
const aiGameHandler = require('../game/AIGameHandler');
const ruleQAService = require('../services/RuleQAService');

const router = express.Router();

// 所有设置接口都需要登录
router.use(authMiddleware);

// 重新加载两个 LLM 服务实例，使配置即时生效
function reloadModels() {
  try {
    aiGameHandler.refreshModel();
    ruleQAService.refreshModel();
  } catch (err) {
    console.error('[settings] reload model failed:', err.message);
  }
}

// GET /api/settings/llm - 获取当前 LLM 配置状态（不返回完整 API Key）
router.get('/llm', (req, res) => {
  res.json(llmConfig.getStatus());
});

// PUT /api/settings/llm - 更新 LLM 配置（仅内存，不落盘）
router.put('/llm', (req, res) => {
  const { apiKey, apiUrl, modelName } = req.body || {};

  if (apiUrl && !/^https?:\/\//.test(apiUrl)) {
    return res.status(400).json({ message: 'API 地址需以 http:// 或 https:// 开头' });
  }
  if (typeof modelName === 'string' && modelName.length > 100) {
    return res.status(400).json({ message: '模型名过长' });
  }
  if (typeof apiKey === 'string' && apiKey.length > 500) {
    return res.status(400).json({ message: 'API Key 过长' });
  }

  llmConfig.setConfig({ apiKey, apiUrl, modelName });
  reloadModels();

  res.json({ ...llmConfig.getStatus(), message: 'LLM 配置已更新' });
});

// DELETE /api/settings/llm - 清除运行时配置，回退到 .env 默认值
router.delete('/llm', (req, res) => {
  llmConfig.clearConfig();
  reloadModels();

  res.json({ ...llmConfig.getStatus(), message: '已清除运行时配置，回退到 .env 默认值' });
});

// POST /api/settings/llm/test - 测试当前（或表单中的）LLM 是否可用
router.post('/llm/test', async (req, res) => {
  const current = llmConfig.getEffectiveConfig();
  const { apiKey, apiUrl, modelName } = req.body || {};

  // 表单传入的值优先，未传则用当前已生效配置，方便「先测试再保存」
  const effective = {
    apiKey: (typeof apiKey === 'string' && apiKey.trim()) ? apiKey.trim() : current.apiKey,
    apiUrl: (typeof apiUrl === 'string' && apiUrl.trim()) ? apiUrl.trim() : current.apiUrl,
    modelName: (typeof modelName === 'string' && modelName.trim()) ? modelName.trim() : current.modelName,
  };

  if (!effective.apiKey) {
    return res.json({ ok: false, message: '未配置 API Key，请先在下方填写' });
  }
  if (!/^https?:\/\//.test(effective.apiUrl)) {
    return res.json({ ok: false, message: 'API 地址需以 http:// 或 https:// 开头' });
  }

  const start = Date.now();
  try {
    const testModel = new ChatOpenAI({
      apiKey: effective.apiKey,
      modelName: effective.modelName,
      configuration: { baseURL: effective.apiUrl },
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

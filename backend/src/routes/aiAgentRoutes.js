const express = require('express');
const router = express.Router();
const aiAgentManager = require('../ai/AIAgentManager');
const authMiddleware = require('../middleware/auth');

// W14: validate agent payload shape
function validateAgent(body, partial = false) {
  const errors = [];
  const { name, avatar, personality, speakingStyle } = body;

  if (!partial || name !== undefined) {
    if (typeof name !== 'string' || name.trim().length < 1 || name.length > 20) {
      errors.push('名称长度应为1-20个字符');
    }
  }
  if (!partial || avatar !== undefined) {
    if (typeof avatar !== 'string' || avatar.trim().length === 0) {
      errors.push('头像不能为空');
    }
  }
  if (!partial || personality !== undefined) {
    if (typeof personality !== 'object' || personality === null) {
      errors.push('性格参数格式错误');
    } else {
      const personalityKeys = ['aggressiveness', 'caution', 'cunning', 'honesty', 'talkativeness'];
      for (const key of personalityKeys) {
        const value = personality[key];
        if (typeof value !== 'number' || value < 0 || value > 100) {
          errors.push(`性格参数 ${key} 应为0-100的数值`);
        }
      }
    }
  }
  if (!partial || speakingStyle !== undefined) {
    if (typeof speakingStyle !== 'string' || speakingStyle.trim().length === 0) {
      errors.push('发言风格不能为空');
    }
  }
  return errors;
}

router.get('/', authMiddleware, async (req, res, next) => {
  try {
    res.json(await aiAgentManager.getAllAgents());
  } catch (err) {
    next(err);
  }
});

router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    const agent = await aiAgentManager.getAgentById(req.params.id);
    if (!agent) {
      return res.status(404).json({ message: '智能体不存在' });
    }
    res.json(agent);
  } catch (err) {
    next(err);
  }
});

router.post('/', authMiddleware, async (req, res, next) => {
  try {
    console.log('Received agent creation request:', JSON.stringify(req.body, null, 2));
    const errors = validateAgent(req.body, false);
    if (errors.length > 0) {
      console.log('Validation errors:', errors);
      return res.status(400).json({ message: errors.join('；') });
    }
    const agent = await aiAgentManager.createAgent(req.body);
    res.status(201).json(agent);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authMiddleware, async (req, res, next) => {
  try {
    console.log('Received agent update request:', JSON.stringify(req.body, null, 2));
    const errors = validateAgent(req.body, true);
    if (errors.length > 0) {
      console.log('Validation errors:', errors);
      return res.status(400).json({ message: errors.join('；') });
    }
    const agent = await aiAgentManager.updateAgent(req.params.id, req.body);
    if (!agent) {
      return res.status(404).json({ message: '智能体不存在' });
    }
    res.json(agent);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const success = await aiAgentManager.deleteAgent(req.params.id);
    if (!success) {
      return res.status(404).json({ message: '智能体不存在' });
    }
    res.json({ message: '删除成功' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

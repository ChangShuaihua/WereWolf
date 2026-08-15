const express = require('express');
const router = express.Router();
const aiAgentManager = require('../ai/AIAgentManager');
const authMiddleware = require('../middleware/auth');

// 管理员ID白名单（与 stats 路由一致）
const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || '')
  .split(',')
  .map(s => s.trim())
  .filter(s => s)
  .map(s => Number(s))
  .filter(n => Number.isInteger(n));

function isAdmin(userId) {
  return ADMIN_USER_IDS.includes(Number(userId));
}

function canModify(req, agent) {
  // 管理员可改任何 AI；所有者只能改自己的；内置AI（ownerId===null）只能管理员改
  if (isAdmin(req.user.id)) return true;
  if (agent && agent.ownerId !== null && Number(agent.ownerId) === Number(req.user.id)) return true;
  return false;
}

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
    const errors = validateAgent(req.body, false);
    if (errors.length > 0) {
      return res.status(400).json({ message: errors.join('；') });
    }
    const agent = await aiAgentManager.createAgent(req.body, req.user.id);
    res.status(201).json(agent);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authMiddleware, async (req, res, next) => {
  try {
    const errors = validateAgent(req.body, true);
    if (errors.length > 0) {
      return res.status(400).json({ message: errors.join('；') });
    }
    const existing = await aiAgentManager.getAgentById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: '智能体不存在' });
    }
    if (!canModify(req, existing)) {
      return res.status(403).json({
        message: existing.ownerId === null
          ? '内置智能体不能修改，仅管理员可操作'
          : '仅智能体创建者或管理员可修改',
      });
    }
    const agent = await aiAgentManager.updateAgent(req.params.id, req.body);
    res.json(agent);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const existing = await aiAgentManager.getAgentById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: '智能体不存在' });
    }
    if (!canModify(req, existing)) {
      return res.status(403).json({
        message: existing.ownerId === null
          ? '内置智能体不能删除，仅管理员可操作'
          : '仅智能体创建者或管理员可删除',
      });
    }
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

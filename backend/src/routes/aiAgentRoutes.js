const express = require('express');
const router = express.Router();
const aiAgentManager = require('../ai/AIAgentManager');
const authMiddleware = require('../middleware/auth');

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
    const agent = await aiAgentManager.createAgent(req.body);
    res.status(201).json(agent);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authMiddleware, async (req, res, next) => {
  try {
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

const express = require('express');
const router = express.Router();
const aiAgentManager = require('../ai/AIAgentManager');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, (req, res) => {
  res.json(aiAgentManager.getAllAgents());
});

router.get('/:id', authMiddleware, (req, res) => {
  const agent = aiAgentManager.getAgentById(req.params.id);
  if (!agent) {
    return res.status(404).json({ message: '智能体不存在' });
  }
  res.json(agent);
});

router.post('/', authMiddleware, (req, res) => {
  const agent = aiAgentManager.createAgent(req.body);
  res.status(201).json(agent);
});

router.put('/:id', authMiddleware, (req, res) => {
  const agent = aiAgentManager.updateAgent(req.params.id, req.body);
  if (!agent) {
    return res.status(404).json({ message: '智能体不存在' });
  }
  res.json(agent);
});

router.delete('/:id', authMiddleware, (req, res) => {
  const success = aiAgentManager.deleteAgent(req.params.id);
  if (!success) {
    return res.status(404).json({ message: '智能体不存在' });
  }
  res.json({ message: '删除成功' });
});

module.exports = router;

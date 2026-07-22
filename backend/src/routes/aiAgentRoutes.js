const express = require('express');
const router = express.Router();
const aiAgentManager = require('../ai/AIAgentManager');

router.get('/', (req, res) => {
  res.json(aiAgentManager.getAllAgents());
});

router.get('/:id', (req, res) => {
  const agent = aiAgentManager.getAgentById(req.params.id);
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  res.json(agent);
});

router.post('/', (req, res) => {
  const agent = aiAgentManager.createAgent(req.body);
  res.status(201).json(agent);
});

router.put('/:id', (req, res) => {
  const agent = aiAgentManager.updateAgent(req.params.id, req.body);
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  res.json(agent);
});

router.delete('/:id', (req, res) => {
  const success = aiAgentManager.deleteAgent(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  res.json({ message: 'Agent deleted successfully' });
});

module.exports = router;
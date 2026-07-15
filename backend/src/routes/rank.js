const express = require('express');
const GameRecord = require('../models/GameRecord');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// GET /api/rank - Leaderboard
router.get('/', async (req, res) => {
  try {
    const leaderboard = await GameRecord.getLeaderboard(50);
    res.json({ leaderboard });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ message: '获取排行榜失败' });
  }
});

// GET /api/history - User game history
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const history = await GameRecord.getUserHistory(req.user.id, 20);
    res.json({ history });
  } catch (err) {
    console.error('History error:', err);
    res.status(500).json({ message: '获取游戏记录失败' });
  }
});

module.exports = router;

const express = require('express');
const authMiddleware = require('../middleware/auth');
const GameRecord = require('../models/GameRecord');

const router = express.Router();

router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    const gameId = Number(req.params.id);
    if (!Number.isInteger(gameId) || gameId <= 0) {
      return res.status(400).json({ message: '无效的复盘编号' });
    }
    const replay = await GameRecord.findForUser(gameId, req.user.id);
    if (!replay) {
      return res.status(404).json({ message: '复盘不存在，或你无权查看该对局' });
    }
    res.json(replay);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

const express = require('express');
const authMiddleware = require('../middleware/auth');
const GameRecord = require('../models/GameRecord');
const { ROLE_NAMES } = require('../game/constants');
const statsService = require('../services/statsService');

const router = express.Router();

// 禁止缓存所有 stats 路由
router.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// GET /api/stats/me - 获取当前用户积分和统计
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    // 优先从 Redis 读取（带降级到 MySQL）
    const stats = await statsService.getUserStats(req.user.id);
    // 获取排名（Redis ZREVRANK）
    let rank;
    try {
      rank = await statsService.getUserRank(req.user.id);
    } catch (rankErr) {
      console.warn('[stats/me] 排名获取失败:', rankErr.message);
      rank = null;
    }
    const result = { ...stats, rank };
    // 兜底：确保字段都存在
    result.score = typeof result.score === 'number' ? result.score : 0;
    result.totalGames = result.totalGames || 0;
    result.totalWins = result.totalWins || 0;
    result.totalLosses = result.totalLosses || 0;
    result.winRate = typeof result.winRate === 'number' ? result.winRate : 0;
    res.json(result);
  } catch (err) {
    console.error('[stats/me] 严重错误:', err);
    // 即使出错也返回默认数据，防止前端卡片不显示
    res.json({
      score: 0,
      totalGames: 0,
      totalWins: 0,
      totalLosses: 0,
      winRate: 0,
      rank: null,
      _error: err.message,
    });
  }
});

// GET /api/stats/history?page=1&limit=20 - 获取当前用户战绩列表
router.get('/history', authMiddleware, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const result = await GameRecord.getHistoryForUser(req.user.id, page, limit);
    // 翻译角色名
    result.records = result.records.map(r => ({
      ...r,
      roleName: ROLE_NAMES[r.role] || r.role,
    }));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/stats/leaderboard - 获取排行榜
router.get('/leaderboard', authMiddleware, async (req, res, next) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    // 优先从 Redis 读取排行榜（带降级到 MySQL）
    const leaderboard = await statsService.getLeaderboard(limit);
    res.json({ leaderboard });
  } catch (err) {
    next(err);
  }
});

// POST /api/stats/sync - 手动同步 MySQL 数据到 Redis（管理用）
router.post('/sync', authMiddleware, async (req, res, next) => {
  try {
    await statsService.syncAllUsersToRedis();
    res.json({ message: '同步完成' });
  } catch (err) {
    next(err);
  }
});

// POST /api/stats/clear - 清空 Redis 缓存（管理用）
router.post('/clear', authMiddleware, async (req, res, next) => {
  try {
    await statsService.clearAll();
    res.json({ message: '缓存已清空' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

const { getRedisClient } = require('../config/redis');
const User = require('../models/User');
const GameRecord = require('../models/GameRecord');

const KEY_PREFIX = process.env.REDIS_KEY_PREFIX || 'werewolf';
const LEADERBOARD_KEY = `${KEY_PREFIX}:leaderboard`;
const USER_SCORE_KEY = `${KEY_PREFIX}:user:score`;
const USER_NAME_KEY = `${KEY_PREFIX}:user:name`;
const RANK_CACHE_KEY = `${KEY_PREFIX}:user:rank`;
const RANK_CACHE_TTL = 60;

function isRedisAvailable() {
  return !!getRedisClient();
}

async function syncAllUsersToRedis() {
  if (!isRedisAvailable()) {
    console.log('[statsService] Redis unavailable, skip sync');
    return;
  }
  try {
    const users = await User.findAllWithScore();
    const redis = getRedisClient();

    // node-redis v4: 使用 multi() 替代 pipeline()
    const multi = redis.multi();
    for (const user of users) {
      multi.zAdd(LEADERBOARD_KEY, [{
        score: user.score || 0,
        value: String(user.id),
      }]);
      multi.hSet(`${USER_SCORE_KEY}:${user.id}`, {
        score: String(user.score || 0),
        totalGames: String(user.total_games || 0),
        totalWins: String(user.total_wins || 0),
        totalLosses: String(user.total_losses || 0),
      });
      multi.set(`${USER_NAME_KEY}:${user.id}`, user.username);
    }
    await multi.exec();
    console.log(`[statsService] Synced ${users.length} users to Redis`);
  } catch (err) {
    console.error('[statsService] Sync failed:', err.message);
  }
}

async function updateUserScore(userId, username, isWin) {
  // 1. 先更新 MySQL（主数据）
  await User.updateScore(userId, isWin);

  // 2. 更新 Redis（缓存，可降级）
  if (isRedisAvailable()) {
    try {
      const redis = getRedisClient();
      const scoreKey = `${USER_SCORE_KEY}:${userId}`;

      // 从 MySQL 获取最新数据并回填 Redis
      const user = await User.findById(userId);
      if (user) {
        const multi = redis.multi();
        multi.hSet(scoreKey, {
          score: String(user.score || 0),
          totalGames: String(user.total_games || 0),
          totalWins: String(user.total_wins || 0),
          totalLosses: String(user.total_losses || 0),
        });
        multi.zAdd(LEADERBOARD_KEY, [{ score: user.score || 0, value: String(userId) }]);
        multi.set(`${USER_NAME_KEY}:${userId}`, username);
        multi.del(`${RANK_CACHE_KEY}:${userId}`);
        await multi.exec();
      }
    } catch (err) {
      console.warn('[statsService] Redis update failed:', err.message);
    }
  }
}

async function getUserStats(userId) {
  // 先做一致性校验：把 users 表的值和真实 game_players 战绩对比，不一致就重算修复
  try {
    const [user, real] = await Promise.all([
      User.findById(userId),
      GameRecord.calcRealStatsForUser(userId),
    ]);

    if (user) {
      const stale =
        (user.total_games || 0) !== real.totalGames ||
        (user.total_wins || 0) !== real.totalWins ||
        (user.total_losses || 0) !== real.totalLosses ||
        (user.score || 0) !== real.score;

      if (stale) {
        console.log(
          `[statsService] 用户 ${userId} 数据不一致 ` +
            `(users: games=${user.total_games}, wins=${user.total_wins}, losses=${user.total_losses}, score=${user.score}` +
            ` vs real: games=${real.totalGames}, wins=${real.totalWins}, losses=${real.totalLosses}, score=${real.score}), 自动重算修复`
        );
        await User.recalcStatsFromGamePlayers(userId, real);
        // 同步清理 Redis 缓存中的旧值
        if (isRedisAvailable()) {
          try {
            const redis = getRedisClient();
            const multi = redis.multi();
            multi.del(`${USER_SCORE_KEY}:${userId}`);
            multi.del(`${RANK_CACHE_KEY}:${userId}`);
            multi.zAdd(LEADERBOARD_KEY, [{ score: real.score, value: String(userId) }]);
            await multi.exec();
          } catch (err) {
            console.warn('[statsService] Redis 旧缓存清理失败:', err.message);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[statsService] 一致性校验出错，仍按原逻辑返回:', err.message);
  }

  // 直接从 MySQL 读取（保证数据一致性，Redis 仅做排行榜加速）
  const user = await User.findById(userId);
  if (!user) return { score: 0, totalGames: 0, totalWins: 0, totalLosses: 0, winRate: 0 };

  const totalGames = user.total_games || 0;
  const totalWins = user.total_wins || 0;
  const result = {
    score: user.score || 0,
    totalGames,
    totalWins,
    totalLosses: user.total_losses || 0,
    winRate: totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0,
  };

  // 异步回填 Redis（不阻塞返回）
  if (isRedisAvailable()) {
    try {
      const redis = getRedisClient();
      const multi = redis.multi();
      multi.hSet(`${USER_SCORE_KEY}:${userId}`, {
        score: String(result.score),
        totalGames: String(result.totalGames),
        totalWins: String(result.totalWins),
        totalLosses: String(result.totalLosses),
      });
      multi.set(`${USER_NAME_KEY}:${userId}`, user.username);
      multi.zAdd(LEADERBOARD_KEY, [{ score: result.score, value: String(userId) }]);
      await multi.exec();
    } catch (err) {
      // Redis 写入失败不影响返回
    }
  }

  return result;
}

async function getUserRank(userId) {
  if (!isRedisAvailable()) return null;
  try {
    const redis = getRedisClient();
    // 检查排名缓存
    const cached = await redis.get(`${RANK_CACHE_KEY}:${userId}`);
    if (cached !== null) {
      return parseInt(cached, 10);
    }

    // ZREVRANK 获取排名（0-based，需要+1）
    const rank = await redis.zRevRank(LEADERBOARD_KEY, String(userId));
    const result = rank !== null ? rank + 1 : null;

    // 缓存排名 60 秒
    if (result !== null) {
      await redis.setEx(`${RANK_CACHE_KEY}:${userId}`, RANK_CACHE_TTL, String(result));
    }
    return result;
  } catch (err) {
    console.warn('[statsService] Rank query failed:', err.message);
    return null;
  }
}

async function getLeaderboard(limit = 50) {
  // 优先从 Redis 读取
  if (isRedisAvailable()) {
    try {
      const redis = getRedisClient();
      // node-redis v4: 用 zRangeWithScores 替代 zRevRange，然后 JS 反转
      const results = await redis.zRangeWithScores(LEADERBOARD_KEY, 0, limit - 1);

      if (results && results.length > 0) {
        // zRangeWithScores 返回升序，反转得到降序
        results.reverse();

        const leaderboard = [];
        for (const item of results) {
          const userId = item.value;
          const score = item.score;

          const username = await redis.get(`${USER_NAME_KEY}:${userId}`) || '未知玩家';
          const stats = await redis.hGetAll(`${USER_SCORE_KEY}:${userId}`);

          leaderboard.push({
            id: parseInt(userId, 10),
            username,
            score,
            total_games: parseInt(stats.totalGames || '0', 10),
            total_wins: parseInt(stats.totalWins || '0', 10),
            total_losses: parseInt(stats.totalLosses || '0', 10),
          });
        }
        return leaderboard;
      }
    } catch (err) {
      console.warn('[statsService] Leaderboard Redis read failed:', err.message);
    }
  }

  // 降级到 MySQL
  return await User.getLeaderboard(limit);
}

async function clearAll() {
  if (!isRedisAvailable()) return;
  try {
    const redis = getRedisClient();
    const keys = [];
    for await (const key of redis.scanIterator({ MATCH: `${KEY_PREFIX}:*`, COUNT: 100 })) {
      keys.push(key);
    }
    if (keys.length > 0) {
      await redis.del(keys);
      console.log(`[statsService] Cleared ${keys.length} Redis keys`);
    }
  } catch (err) {
    console.warn('[statsService] Clear failed:', err.message);
  }
}

module.exports = {
  isRedisAvailable,
  syncAllUsersToRedis,
  updateUserScore,
  getUserStats,
  getUserRank,
  getLeaderboard,
  clearAll,
};

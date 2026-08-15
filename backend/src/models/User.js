const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');

const User = {
  async create(username, password) {
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (username, password) VALUES (?, ?)',
      [username, hash]
    );
    return { id: result.insertId, username };
  },

  async findByUsername(username) {
    const [rows] = await pool.query(
      'SELECT id, username, password, ai_fallback_enabled, created_at FROM users WHERE username = ?',
      [username]
    );
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await pool.query(
      'SELECT id, username, score, total_games, total_wins, total_losses, ai_fallback_enabled, created_at FROM users WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  },

  async findAuthById(id) {
    const [rows] = await pool.query(
      'SELECT id, username, password, ai_fallback_enabled FROM users WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  },

  // 积分等于累计胜场：胜利 +1，失败不改变积分。
  async updateScore(userId, isWin) {
    const sql = isWin
      ? 'UPDATE users SET score = score + 1, total_games = total_games + 1, total_wins = total_wins + 1 WHERE id = ?'
      : 'UPDATE users SET total_games = total_games + 1, total_losses = total_losses + 1 WHERE id = ?';
    await pool.query(sql, [userId]);
  },

  // 用真实 game_players 记录覆盖重算用户 score/total_*，返回重算后的值
  async recalcStatsFromGamePlayers(userId, realStats) {
    const { totalGames, totalWins, totalLosses, score } = realStats;
    await pool.query(
      `UPDATE users
         SET score = ?, total_games = ?, total_wins = ?, total_losses = ?
       WHERE id = ?`,
      [score, totalGames, totalWins, totalLosses, userId]
    );
    return this.findById(userId);
  },

  // 获取所有有积分的用户（用于 Redis 同步）
  async findAllWithScore() {
    const [rows] = await pool.query(
      'SELECT id, username, score, total_games, total_wins, total_losses FROM users'
    );
    return rows;
  },

  // 获取排行榜
  async getLeaderboard(limit = 50) {
    const [rows] = await pool.query(
      'SELECT id, username, score, total_games, total_wins, total_losses FROM users WHERE total_games > 0 ORDER BY score DESC, total_wins DESC LIMIT ?',
      [limit]
    );
    return rows;
  },

  async verifyPassword(inputPassword, hashedPassword) {
    return bcrypt.compare(inputPassword, hashedPassword);
  },

  async updateProfile(userId, data) {
    const updates = [];
    const values = [];

    if (data.username) {
      updates.push('username = ?');
      values.push(data.username);
    }

    if (data.password) {
      const hash = await bcrypt.hash(data.password, 10);
      updates.push('password = ?');
      values.push(hash);
    }

    if (typeof data.aiFallbackEnabled === 'boolean') {
      updates.push('ai_fallback_enabled = ?');
      values.push(data.aiFallbackEnabled);
    }

    if (updates.length === 0) {
      return null;
    }

    values.push(userId);
    await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return this.findById(userId);
  },

  // 获取用户的大模型 API 配置（完整 Key，仅服务端内部使用）
  async getLLMConfig(userId) {
    const [rows] = await pool.query(
      'SELECT api_key, api_url, model_name FROM users WHERE id = ?',
      [userId]
    );
    const r = rows[0] || {};
    return {
      apiKey: r.api_key || '',
      apiUrl: r.api_url || '',
      modelName: r.model_name || '',
    };
  },

  // 更新用户的大模型 API 配置；传 undefined 表示不改动，传空字符串表示清空
  async updateLLMConfig(userId, { apiKey, apiUrl, modelName } = {}) {
    const sets = [];
    const values = [];

    if (typeof apiKey === 'string') {
      sets.push('api_key = ?');
      values.push(apiKey.trim() || null);
    }
    if (typeof apiUrl === 'string') {
      sets.push('api_url = ?');
      values.push(apiUrl.trim() || null);
    }
    if (typeof modelName === 'string') {
      sets.push('model_name = ?');
      values.push(modelName.trim() || null);
    }

    if (sets.length > 0) {
      values.push(userId);
      await pool.query(
        `UPDATE users SET ${sets.join(', ')} WHERE id = ?`,
        values
      );
    }

    return this.getLLMConfig(userId);
  },

  // 清除用户的大模型 API 配置
  async clearLLMConfig(userId) {
    await pool.query(
      'UPDATE users SET api_key = NULL, api_url = NULL, model_name = NULL WHERE id = ?',
      [userId]
    );
    return this.getLLMConfig(userId);
  },

};

module.exports = User;

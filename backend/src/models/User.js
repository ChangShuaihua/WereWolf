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
      'SELECT id, username, password, created_at FROM users WHERE username = ?',
      [username]
    );
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await pool.query(
      'SELECT id, username, score, total_games, total_wins, total_losses, created_at FROM users WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  },

  // 更新用户积分和战绩（相对增量方式，注意和重算并存时不要双重计数）
  async updateScore(userId, scoreChange, isWin) {
    const sql = isWin
      ? 'UPDATE users SET score = GREATEST(0, score + ?), total_games = total_games + 1, total_wins = total_wins + 1 WHERE id = ?'
      : 'UPDATE users SET score = GREATEST(0, score + ?), total_games = total_games + 1, total_losses = total_losses + 1 WHERE id = ?';
    await pool.query(sql, [scoreChange, userId]);
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

};

module.exports = User;

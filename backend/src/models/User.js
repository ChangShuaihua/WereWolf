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
      'SELECT id, username, password, wins, losses, score, created_at FROM users WHERE username = ?',
      [username]
    );
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await pool.query(
      'SELECT id, username, wins, losses, score, created_at FROM users WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  },

  async verifyPassword(inputPassword, hashedPassword) {
    return bcrypt.compare(inputPassword, hashedPassword);
  },

  async updateStats(userId, isWinner) {
    if (isWinner) {
      await pool.query(
        'UPDATE users SET wins = wins + 1, score = score + 10 WHERE id = ?',
        [userId]
      );
    } else {
      await pool.query(
        'UPDATE users SET losses = losses + 1, score = GREATEST(0, score - 5) WHERE id = ?',
        [userId]
      );
    }
  },
};

module.exports = User;

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
      'SELECT id, username, api_key, api_url, model_name, created_at FROM users WHERE id = ?',
      [id]
    );
    return rows[0] || null;
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

  async updateApiConfig(userId, config) {
    const updates = [];
    const values = [];

    if (config.api_key !== undefined) {
      updates.push('api_key = ?');
      values.push(config.api_key || null);
    }
    if (config.api_url !== undefined) {
      updates.push('api_url = ?');
      values.push(config.api_url || null);
    }
    if (config.model_name !== undefined) {
      updates.push('model_name = ?');
      values.push(config.model_name || null);
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

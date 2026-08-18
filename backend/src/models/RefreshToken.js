const crypto = require('crypto');
const { pool } = require('../config/db');

const RefreshToken = {
  // SHA-256 哈希（仅存哈希，不存明文）
  hashToken(token) {
    return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
  },

  async create(userId, tokenHash, expiresAt) {
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [userId, tokenHash, expiresAt]
    );
  },

  async findByHash(tokenHash) {
    const [rows] = await pool.query(
      'SELECT id, user_id, token_hash, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = ?',
      [tokenHash]
    );
    return rows[0] || null;
  },

  async revokeByHash(tokenHash) {
    const [result] = await pool.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL',
      [tokenHash]
    );
    return result.affectedRows > 0;
  },

  // 单设备登录：撤销该用户所有未失效的 refresh token
  async revokeAllForUser(userId) {
    await pool.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL',
      [userId]
    );
  },
};

module.exports = RefreshToken;

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const RefreshToken = require('../models/RefreshToken');
require('dotenv').config();

const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_DAYS = Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS || 7);

// Access token：短时 JWT，带 type: 'access' 标识
function issueAccessToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );
}

// Refresh token：不透明随机串，数据库只存 SHA-256 哈希
function generateRefreshToken() {
  return crypto.randomBytes(32).toString('hex');
}

// 签发 refresh token（落库哈希）并返回明文
async function issueRefreshToken(userId) {
  const token = generateRefreshToken();
  const tokenHash = RefreshToken.hashToken(token);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 86400 * 1000);
  await RefreshToken.create(userId, tokenHash, expiresAt);
  return token;
}

// 登录/注册统一签发双 token
async function issueTokens(user) {
  const [accessToken, refreshToken] = await Promise.all([
    issueAccessToken(user),
    issueRefreshToken(user.id),
  ]);
  return { accessToken, refreshToken };
}

module.exports = {
  issueAccessToken,
  generateRefreshToken,
  issueRefreshToken,
  issueTokens,
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_DAYS,
};

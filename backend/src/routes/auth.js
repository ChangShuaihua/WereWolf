const express = require('express');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const authMiddleware = require('../middleware/auth');
const { issueTokens } = require('../utils/token');
require('dotenv').config();

const router = express.Router();

// W15: username allows letters, digits, underscore, and CJK; 2-20 chars
const USERNAME_REGEX = /^[a-zA-Z0-9_\u4e00-\u9fa5]{2,20}$/;

function validateUsername(username) {
  if (!username || typeof username !== 'string') return '用户名不能为空';
  if (!USERNAME_REGEX.test(username)) {
    return '用户名只能包含字母、数字、下划线或中文，长度2-20个字符';
  }
  return null;
}

// W16: password must be at least 6 chars and contain both letters and numbers
function validatePassword(password) {
  if (!password || typeof password !== 'string') return '密码不能为空';
  if (password.length < 6) return '密码长度不能少于6位';
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return '密码必须包含字母和数字';
  }
  return null;
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const usernameErr = validateUsername(username);
    if (usernameErr) return res.status(400).json({ message: usernameErr });
    const passwordErr = validatePassword(password);
    if (passwordErr) return res.status(400).json({ message: passwordErr });

    const existing = await User.findByUsername(username);
    if (existing) {
      return res.status(400).json({ message: '用户名已存在' });
    }

    const user = await User.create(username, password);
    // 单设备登录：撤销该用户旧会话
    await RefreshToken.revokeAllForUser(user.id);
    const { accessToken, refreshToken } = await issueTokens(user);

    res.json({ accessToken, refreshToken, user: { id: user.id, username: user.username, aiFallbackEnabled: true } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: '注册失败，请稍后重试' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: '用户名和密码不能为空' });
    }

    const user = await User.findByUsername(username);
    if (!user) {
      return res.status(400).json({ message: '用户名或密码错误' });
    }

    const valid = await User.verifyPassword(password, user.password);
    if (!valid) {
      return res.status(400).json({ message: '用户名或密码错误' });
    }

    // 单设备登录：撤销该用户旧会话
    await RefreshToken.revokeAllForUser(user.id);
    const { accessToken, refreshToken } = await issueTokens(user);

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        aiFallbackEnabled: Boolean(user.ai_fallback_enabled),
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: '登录失败，请稍后重试' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    const { ai_fallback_enabled: aiFallbackEnabled, ...publicUser } = user;
    res.json({
      user: {
        ...publicUser,
        aiFallbackEnabled: Boolean(aiFallbackEnabled),
      },
    });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ message: '获取用户信息失败' });
  }
});

// PUT /api/auth/me
router.put('/me', authMiddleware, async (req, res) => {
  try {
    const { username, password, oldPassword, aiFallbackEnabled } = req.body;

    if (!username && !password && typeof aiFallbackEnabled !== 'boolean') {
      return res.status(400).json({ message: '请提供要修改的信息' });
    }

    if (password && !oldPassword) {
      return res.status(400).json({ message: '修改密码需要提供旧密码' });
    }

    if (username) {
      const usernameErr = validateUsername(username);
      if (usernameErr) return res.status(400).json({ message: usernameErr });
      const existing = await User.findByUsername(username);
      if (existing && existing.id !== req.user.id) {
        return res.status(400).json({ message: '用户名已存在' });
      }
    }

    if (password) {
      const passwordErr = validatePassword(password);
      if (passwordErr) return res.status(400).json({ message: passwordErr });
      const user = await User.findAuthById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: '用户不存在' });
      }
      const valid = await User.verifyPassword(oldPassword, user.password);
      if (!valid) {
        return res.status(400).json({ message: '旧密码不正确' });
      }
    }

    const updated = await User.updateProfile(req.user.id, { username, password, aiFallbackEnabled });
    if (!updated) {
      return res.status(400).json({ message: '更新失败' });
    }

    res.json({
      user: {
        id: updated.id,
        username: updated.username,
        aiFallbackEnabled: Boolean(updated.ai_fallback_enabled),
      },
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ message: '更新失败，请稍后重试' });
  }
});

// POST /api/auth/refresh - 用 refresh token 换新双 token（轮换 + 滑动续期）
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken || typeof refreshToken !== 'string') {
      return res.status(400).json({ message: '缺少 refresh token' });
    }

    const tokenHash = RefreshToken.hashToken(refreshToken);
    const record = await RefreshToken.findByHash(tokenHash);

    if (!record) {
      return res.status(401).json({ message: '登录已过期，请重新登录' });
    }

    if (record.revoked_at) {
      // 复用检测：已撤销的 token 被重放，视为泄露，撤销该用户全部会话
      await RefreshToken.revokeAllForUser(record.user_id);
      return res.status(401).json({ message: '登录已过期，请重新登录' });
    }

    if (new Date(record.expires_at).getTime() <= Date.now()) {
      return res.status(401).json({ message: '登录已过期，请重新登录' });
    }

    // 轮换：撤销旧 token，签发新双 token
    await RefreshToken.revokeByHash(tokenHash);
    const user = await User.findById(record.user_id);
    if (!user) {
      return res.status(401).json({ message: '用户不存在' });
    }

    const tokens = await issueTokens(user);
    res.json(tokens);
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ message: '刷新失败，请稍后重试' });
  }
});

// POST /api/auth/logout - 撤销当前 refresh token（凭 refresh token 即可撤销，无需 access token）
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (refreshToken && typeof refreshToken === 'string') {
      await RefreshToken.revokeByHash(RefreshToken.hashToken(refreshToken));
    }
    res.json({ message: '已退出登录' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ message: '退出失败，请稍后重试' });
  }
});

module.exports = router;

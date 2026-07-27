const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
require('dotenv').config();

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: '用户名和密码不能为空' });
    }
    if (username.length < 2 || username.length > 20) {
      return res.status(400).json({ message: '用户名长度应为2-20个字符' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: '密码长度不能少于6位' });
    }

    const existing = await User.findByUsername(username);
    if (existing) {
      return res.status(400).json({ message: '用户名已存在' });
    }

    const user = await User.create(username, password);
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({ token, user: { id: user.id, username: user.username } });
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

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username },
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
    res.json({ user });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ message: '获取用户信息失败' });
  }
});

// GET /api/auth/api-config
router.get('/api-config', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    res.json({
      api_key: user.api_key || '',
      api_url: user.api_url || '',
      model_name: user.model_name || '',
    });
  } catch (err) {
    console.error('Get API config error:', err);
    res.status(500).json({ message: '获取API配置失败' });
  }
});

// PUT /api/auth/api-config
router.put('/api-config', authMiddleware, async (req, res) => {
  try {
    const { api_key, api_url, model_name } = req.body;
    
    const updated = await User.updateApiConfig(req.user.id, {
      api_key,
      api_url,
      model_name,
    });

    if (!updated) {
      return res.status(400).json({ message: '更新失败' });
    }

    res.json({
      api_key: updated.api_key || '',
      api_url: updated.api_url || '',
      model_name: updated.model_name || '',
    });
  } catch (err) {
    console.error('Update API config error:', err);
    res.status(500).json({ message: '更新API配置失败，请稍后重试' });
  }
});

// PUT /api/auth/me
router.put('/me', authMiddleware, async (req, res) => {
  try {
    const { username, password, oldPassword } = req.body;

    if (!username && !password) {
      return res.status(400).json({ message: '请提供要修改的信息' });
    }

    if (password && !oldPassword) {
      return res.status(400).json({ message: '修改密码需要提供旧密码' });
    }

    if (username) {
      if (username.length < 2 || username.length > 20) {
        return res.status(400).json({ message: '用户名长度应为2-20个字符' });
      }
      const existing = await User.findByUsername(username);
      if (existing && existing.id !== req.user.id) {
        return res.status(400).json({ message: '用户名已存在' });
      }
    }

    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ message: '密码长度不能少于6位' });
      }
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: '用户不存在' });
      }
      const valid = await User.verifyPassword(oldPassword, user.password);
      if (!valid) {
        return res.status(400).json({ message: '旧密码不正确' });
      }
    }

    const updated = await User.updateProfile(req.user.id, { username, password });
    if (!updated) {
      return res.status(400).json({ message: '更新失败' });
    }

    res.json({ user: { id: updated.id, username: updated.username } });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ message: '更新失败，请稍后重试' });
  }
});

module.exports = router;

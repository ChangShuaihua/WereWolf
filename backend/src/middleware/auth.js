const jwt = require('jsonwebtoken');
require('dotenv').config();

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: '未登录，请先登录' });
  }

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // 拒绝用 refresh token 冒充 access token（旧 token 无 type，仍放行直到自然过期）
    if (decoded.type === 'refresh') {
      return res.status(401).json({ message: '登录已过期，请重新登录' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: '登录已过期，请重新登录' });
  }
}

module.exports = authMiddleware;

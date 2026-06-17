const jwt = require('jsonwebtoken');
const db = require('../database/db');

const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  jwt.verify(token, SECRET_KEY, async (err, user) => {
    if (err) {
      return res.status(403).json({ error: '认证令牌无效' });
    }

    const userRecord = await db.prepare('SELECT id, username, name, email, role FROM users WHERE id = ?').get(user.id);
    if (!userRecord) {
      return res.status(403).json({ error: '用户不存在' });
    }

    req.user = userRecord;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    SECRET_KEY,
    { expiresIn: '7d' }
  );
}

module.exports = {
  authenticateToken,
  requireAdmin,
  generateToken,
  SECRET_KEY
};

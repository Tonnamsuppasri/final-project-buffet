const db = require('../config/db');

// 1. ตรวจสอบว่า User Login หรือยัง (เช็ค x-user-id)
const requireAuth = async (req, res, next) => {
  const userIdFromHeader = req.headers['x-user-id'];
  if (!userIdFromHeader) {
    return res.status(401).json({ error: 'Authentication required (Missing User ID)' });
  }
  const userId = parseInt(userIdFromHeader, 10);
  if (isNaN(userId)) {
    return res.status(401).json({ error: 'Authentication required (Invalid User ID)' });
  }

  try {
    // ดึงข้อมูล User และ Permissions ล่าสุดจาก DB เสมอ
    const sqlGetUser = 'SELECT id, role, permissions FROM users WHERE id = ?';
    const [users] = await db.query(sqlGetUser, [userId]);

    if (users.length === 0) {
      return res.status(401).json({ error: 'User not found or invalid' });
    }
    const user = users[0];

    // แปลง permissions เป็น Array
    if (user.permissions) {
      user.permissions = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
    } else {
      user.permissions = [];
    }

    req.user = user; // ฝัง user object เข้าไปใน request เพื่อใช้ใน middleware ถัดไป
    next();
  } catch (dbError) {
    console.error('Authentication error:', dbError);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

// 2. ตรวจสอบสิทธิเฉพาะ (Permission Check)
const checkPermission = (requiredPermission) => {
  return (req, res, next) => {
    // Admin ผ่านตลอด
    if (req.user.role === 'Admin') return next();

    // เช็คว่ามี permission ที่ต้องการไหม
    if (req.user.permissions && req.user.permissions.includes(requiredPermission)) {
      return next();
    }

    // ถ้าไม่มีสิทธิ
    return res.status(403).json({ error: `Permission denied: Requires '${requiredPermission}'` });
  };
};

// 3. ตรวจสอบว่าเป็น Admin เท่านั้น
const requireAdmin = (req, res, next) => {
  if (req.user.role === 'Admin') {
    return next();
  }
  return res.status(403).json({ error: 'Admin permission required' });
};

module.exports = {
  requireAuth,
  checkPermission,
  requireAdmin
};

const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const { requireAuth, requireAdmin } = require('../middlewares/auth');
const { resolveImage, saveImage } = require('../utils/imageStorage');

const saltRounds = 10;

module.exports = (io) => {
  const router = express.Router();

  // ============================
  // Login API (Public)
  // ============================
  router.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
      const sqlUser = 'SELECT id, username, role, image, permissions, password, phone, email, first_name, last_name, nickname FROM users WHERE username = ?';
      const [users] = await db.query(sqlUser, [username]);

      if (users.length === 0) {
        return res.status(401).json({ success: false, message: 'Username not found' });
      }
      const user = users[0];
      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return res.status(401).json({ success: false, message: 'Incorrect password' });
      }

      let userPermissions = [];
      if (user.permissions) {
        userPermissions = typeof user.permissions === 'string'
          ? JSON.parse(user.permissions)
          : user.permissions;
      }

      res.json({
        success: true,
        message: 'Login successful',
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          phone: user.phone || null,
          email: user.email,
          first_name: user.first_name || null,
          last_name: user.last_name || null,
          nickname: user.nickname || null,
          permissions: userPermissions,
          image: resolveImage(user.image, 'users', `user_${user.id}`)
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // ============================
  // Staff & User API
  // ============================
  // Protected: ดูโปรไฟล์ตัวเอง (ใครก็ได้ที่ Login)
  router.get('/api/user/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
      const sql = 'SELECT id, username, role, phone, email, first_name, last_name, nickname, image, permissions FROM users WHERE id = ?';
      const [result] = await db.query(sql, [id]);
      if (result.length === 0) return res.status(404).json({ message: 'User not found' });

      const user = result[0];
      user.image = resolveImage(user.image, 'users', `user_${user.id}`);

      if (user.permissions) {
        user.permissions = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
      } else {
        user.permissions = [];
      }

      res.json(user);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Protected: Admin เท่านั้นที่ดูข้อมูล Staff ทั้งหมดได้
  router.get('/api/staff', requireAuth, requireAdmin, async (req, res) => {
    try {
      const sql = 'SELECT id, username, role, phone, email, first_name, last_name, nickname, image FROM users';
      const [result] = await db.query(sql);
      const staff = result.map((user) => ({
        ...user,
        image: resolveImage(user.image, 'users', `user_${user.id}`)
      }));
      res.json(staff);
    } catch (err) {
      res.status(500).json({ error: 'Error fetching staff data' });
    }
  });

  // Protected: Admin เท่านั้นที่ดึง permission ของคนอื่นได้
  router.get('/api/users-permissions', requireAuth, requireAdmin, async (req, res) => {
    try {
      const sql = "SELECT id, username, role, permissions FROM users WHERE role != 'Admin' ORDER BY username ASC";
      const [users] = await db.query(sql);

      const formattedUsers = users.map((u) => ({
        ...u,
        permissions: u.permissions ? (typeof u.permissions === 'string' ? JSON.parse(u.permissions) : u.permissions) : []
      }));

      res.json(formattedUsers);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error fetching users permissions' });
    }
  });

  // Protected: Admin เท่านั้นที่แก้ permission ได้
  router.put('/api/users/:id/permissions', requireAuth, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { permissions } = req.body;

    try {
      const sql = 'UPDATE users SET permissions = ? WHERE id = ?';
      await db.query(sql, [JSON.stringify(permissions), id]);

      console.log(`🚀 Emitting permissions_updated for User ID: ${id}`);
      io.emit('permissions_updated', {
        userId: Number(id),
        permissions
      });

      res.json({ message: 'Permissions updated successfully' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error updating permissions' });
    }
  });

  // Protected: Admin เท่านั้นที่เพิ่มพนักงาน
  router.post('/api/staff', requireAuth, requireAdmin, async (req, res) => {
    const { username, email, password, phone, role, first_name, last_name, nickname, image } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      const imagePathBuffer = saveImage(image, 'users', 'user');
      const sql = 'INSERT INTO users (username, email, password, phone, role, first_name, last_name, nickname, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
      const [result] = await db.query(sql, [username, email, hashedPassword, phone, role, first_name, last_name, nickname, imagePathBuffer]);
      console.log('🚀 Emitting staff_updated');
      io.emit('staff_updated');
      res.status(201).json({ id: result.insertId });
    } catch (error) {
      res.status(500).json({ error: 'Server error during password hashing or insertion.' });
    }
  });

  // Protected: Admin หรือเจ้าตัวสามารถแก้ไขข้อมูลโปรไฟล์ตัวเองได้
  router.put('/api/staff/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    if (req.user.role !== 'Admin' && String(req.user.id) !== String(id)) {
      return res.status(403).json({ error: 'Permission denied: Admin or account owner required' });
    }

    const { username, email, phone, role, first_name, last_name, nickname, image, newPassword } = req.body;
    try {
      const effectiveRole = req.user.role === 'Admin' ? role : req.user.role;
      const imagePathBuffer = saveImage(image, 'users', `user_${id}`);
      const params = [username, email, phone, effectiveRole, first_name, last_name, nickname, imagePathBuffer];
      let sql = 'UPDATE users SET username = ?, email = ?, phone = ?, role = ?, first_name = ?, last_name = ?, nickname = ?, image = ?';

      if (newPassword) {
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
        sql += ', password = ?';
        params.push(hashedPassword);
      }

      sql += ' WHERE id = ?';
      params.push(id);

      const [result] = await db.query(sql, params);

      if (result.affectedRows === 0) return res.status(404).json({ message: 'Staff member not found' });

      console.log('🚀 Emitting staff_updated');
      io.emit('staff_updated');
      res.json({ message: 'Staff member updated successfully', id });
    } catch (error) {
      res.status(500).json({ error: 'Could not update staff member' });
    }
  });

  // Protected: Admin เท่านั้นที่ลบพนักงาน
  router.delete('/api/staff/:id', requireAuth, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
      const sql = 'DELETE FROM users WHERE id = ?';
      const [result] = await db.query(sql, [id]);
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Staff member not found' });
      console.log('🚀 Emitting staff_updated');
      io.emit('staff_updated');
      res.json({ message: 'Staff member deleted successfully', id });
    } catch (err) {
      res.status(500).json({ error: 'Could not delete staff member' });
    }
  });

  return router;
};

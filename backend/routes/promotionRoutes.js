const express = require('express');
const db = require('../config/db');
const { requireAuth, checkPermission } = require('../middlewares/auth');

module.exports = () => {
  const router = express.Router();

  // Public/Protected: ดูโปรโมชั่น
  router.get('/api/promotions', requireAuth, async (req, res) => {
    let sql = 'SELECT * FROM promotions';
    const params = [];
    if (req.query.active === 'true') {
      sql += ' WHERE is_active = 1';
    } else if (req.query.active === 'false') {
      sql += ' WHERE is_active = 0';
    }
    sql += ' ORDER BY end_date DESC, start_date DESC';

    try {
      const [results] = await db.query(sql, params);
      res.json(results);
    } catch (err) {
      console.error('Error fetching promotions:', err);
      return res.status(500).json({ error: 'Error fetching promotions data', details: err.message });
    }
  });

  router.get('/api/promotions/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT * FROM promotions WHERE promotion_id = ?';
    try {
      const [results] = await db.query(sql, [id]);
      if (results.length === 0) {
        return res.status(404).json({ message: 'Promotion not found' });
      }
      res.json(results[0]);
    } catch (err) {
      console.error(`Error fetching promotion ${id}:`, err);
      return res.status(500).json({ error: 'Error fetching promotion data', details: err.message });
    }
  });

  // Protected: สร้างโปรโมชั่น
  router.post('/api/promotions', requireAuth, checkPermission('manage_settings'), async (req, res) => {
    const { name, description, type, value, code, start_date, end_date, conditions } = req.body;
    if (!name || !type || value === undefined || value === null || !start_date || !end_date) {
      return res.status(400).json({ error: 'Missing required promotion fields (name, type, value, start_date, end_date)' });
    }

    try {
      const sql = 'INSERT INTO promotions (name, description, type, value, code, start_date, end_date, conditions, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)';
      const params = [
        name, description || null, type, value, code || null,
        start_date, end_date, conditions || null
      ];
      const [result] = await db.query(sql, params);
      res.status(201).json({ message: 'Promotion created successfully', promotion_id: result.insertId });
    } catch (err) {
      console.error('Error creating promotion:', err);
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'Promotion code already exists' });
      }
      return res.status(500).json({ error: 'Could not create promotion', details: err.message });
    }
  });

  // Protected: แก้ไขโปรโมชั่น
  router.put('/api/promotions/:id', requireAuth, checkPermission('manage_settings'), async (req, res) => {
    const { id } = req.params;
    const { name, description, type, value, code, start_date, end_date, conditions } = req.body;
    if (!name || !type || value === undefined || value === null || !start_date || !end_date) {
      return res.status(400).json({ error: 'Missing required promotion fields (name, type, value, start_date, end_date)' });
    }

    try {
      const sql = 'UPDATE promotions SET name = ?, description = ?, type = ?, value = ?, code = ?, start_date = ?, end_date = ?, conditions = ? WHERE promotion_id = ?';
      const params = [
        name, description || null, type, value, code || null,
        start_date, end_date, conditions || null, id
      ];
      const [result] = await db.query(sql, params);
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Promotion not found' });
      }
      res.json({ message: 'Promotion updated successfully', promotion_id: id });
    } catch (err) {
      console.error(`Error updating promotion ${id}:`, err);
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'Promotion code already exists' });
      }
      return res.status(500).json({ error: 'Could not update promotion', details: err.message });
    }
  });

  // Protected: เปิด/ปิด โปรโมชั่น
  router.put('/api/promotions/:id/toggle', requireAuth, checkPermission('manage_settings'), async (req, res) => {
    const { id } = req.params;
    const sql = 'UPDATE promotions SET is_active = NOT is_active WHERE promotion_id = ?';
    try {
      const [result] = await db.query(sql, [id]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Promotion not found' });
      }
      res.json({ message: 'Promotion status toggled successfully', promotion_id: id });
    } catch (err) {
      console.error(`Error toggling promotion ${id}:`, err);
      return res.status(500).json({ error: 'Could not toggle promotion status', details: err.message });
    }
  });

  // Protected: ลบโปรโมชั่น
  router.delete('/api/promotions/:id', requireAuth, checkPermission('manage_settings'), async (req, res) => {
    const { id } = req.params;
    const sql = 'DELETE FROM promotions WHERE promotion_id = ?';
    try {
      const [result] = await db.query(sql, [id]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Promotion not found' });
      }
      res.json({ message: 'Promotion deleted successfully', promotion_id: id });
    } catch (err) {
      console.error(`Error deleting promotion ${id}:`, err);
      return res.status(500).json({ error: 'Could not delete promotion', details: err.message });
    }
  });

  return router;
};

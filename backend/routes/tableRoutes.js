const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { requireAuth, checkPermission } = require('../middlewares/auth');

module.exports = (io) => {
  const router = express.Router();

  // Public/Protected: ดูสถานะโต๊ะ (พนักงานทุกคนดูได้)
  router.get('/api/tables', requireAuth, async (req, res) => {
    try {
      const sql = 'SELECT * FROM tables ORDER BY table_number ASC';
      const [results] = await db.query(sql);
      res.json(results);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Public: ดูข้อมูลโต๊ะผ่าน UUID (ลูกค้าสแกน)
  router.get('/api/tables/uuid/:uuid', async (req, res) => {
    const { uuid } = req.params;
    try {
      const sql = 'SELECT table_id, table_number, seat_capacity, status, uuid FROM tables WHERE uuid = ?';
      const [results] = await db.query(sql, [uuid]);
      if (results.length === 0) {
        return res.status(404).json({ message: 'Table not found for this UUID' });
      }
      res.json(results[0]);
    } catch (err) {
      console.error('Error fetching table by UUID:', err);
      return res.status(500).json({ error: 'Database error' });
    }
  });

  // Protected: เพิ่มโต๊ะ (manage_settings)
  router.post('/api/tables', requireAuth, checkPermission('manage_settings'), async (req, res) => {
    const { table_number, seat_capacity } = req.body;
    if (!table_number || seat_capacity === undefined || seat_capacity === null) {
      return res.status(400).json({ error: 'Missing table_number or seat_capacity' });
    }
    try {
      const newUuid = uuidv4();
      const sql = "INSERT INTO tables (uuid, table_number, seat_capacity, status) VALUES (?, ?, ?, 'ว่าง')";
      const [result] = await db.query(sql, [newUuid, table_number, seat_capacity]);
      console.log('🚀 Emitting tables_updated (new table added)');
      io.emit('tables_updated');
      res.status(201).json({ message: 'Table added successfully', table_id: result.insertId, uuid: newUuid, table_number, seat_capacity, status: 'ว่าง' });
    } catch (err) {
      console.error('Error adding table:', err);
      return res.status(500).json({ error: 'Error adding table' });
    }
  });

  // Protected: แก้ไขโต๊ะ (manage_settings)
  router.put('/api/tables/:id', requireAuth, checkPermission('manage_settings'), async (req, res) => {
    const { id } = req.params;
    const { table_number, seat_capacity, status } = req.body;
    if (!table_number || seat_capacity === undefined || seat_capacity === null || !status) {
      return res.status(400).json({ error: 'Missing required table information' });
    }
    try {
      const sql = 'UPDATE tables SET table_number = ?, seat_capacity = ?, status = ? WHERE table_id = ?';
      const [result] = await db.query(sql, [table_number, seat_capacity, status, id]);
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Table not found' });
      console.log('🚀 Emitting tables_updated (table edited)');
      io.emit('tables_updated');
      res.json({ message: 'Table updated successfully' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Protected: ลบโต๊ะ (manage_settings)
  router.delete('/api/tables/:id', requireAuth, checkPermission('manage_settings'), async (req, res) => {
    const { id } = req.params;
    try {
      const checkOrdersSql = "SELECT COUNT(*) as orderCount FROM orders WHERE table_id = ? AND order_status = 'in-progress'";
      const [checkResult] = await db.query(checkOrdersSql, [id]);
      if (checkResult[0].orderCount > 0) {
        return res.status(400).json({ error: 'Cannot delete table with active orders' });
      }

      const sql = 'DELETE FROM tables WHERE table_id = ?';
      const [result] = await db.query(sql, [id]);
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Table not found' });

      console.log('🚀 Emitting tables_updated (table deleted)');
      io.emit('tables_updated');
      res.json({ message: 'Table deleted successfully' });
    } catch (err) {
      console.error('Error deleting table:', err);
      return res.status(500).json({ error: 'Could not delete table' });
    }
  });

  return router;
};

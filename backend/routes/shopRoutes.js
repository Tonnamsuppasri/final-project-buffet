const express = require('express');
const db = require('../config/db');
const { requireAuth, checkPermission } = require('../middlewares/auth');
const { resolveImage, saveImage } = require('../utils/imageStorage');

module.exports = (io) => {
  const router = express.Router();

  // ============================
  // SHOP API
  // ============================
  // Public: ดึงข้อมูลร้าน (สำหรับแสดงผลหน้า Login/Welcome)
  router.get('/api/shop', async (req, res) => {
    try {
      const sql = 'SELECT shop_name, shop_address, shop_phone, open_time, close_time, payment_qr_code, shop_logo, refill_water_price FROM shop WHERE id = 1';
      let [result] = await db.query(sql);

      if (result.length === 0) {
        await db.query(
          "INSERT IGNORE INTO shop (id, shop_name, shop_address, shop_phone, open_time, close_time, refill_water_price) VALUES (1, 'มากินปิ้งย่างยากินิกึ & ชาบู', '', '', '10:00:00', '22:00:00', 39.00)"
        );
        [result] = await db.query(sql);
      }

      if (result.length === 0) {
        return res.json({
          shop_name: 'มากินปิ้งย่างยากินิกึ & ชาบู',
          shop_address: '',
          shop_phone: '',
          open_time: '10:00:00',
          close_time: '22:00:00',
          payment_qr_code: null,
          shop_logo: null,
          refill_water_price: 39
        });
      }

      const shopData = result[0];
      shopData.payment_qr_code = resolveImage(shopData.payment_qr_code, 'shop', 'payment_qr');
      shopData.shop_logo = resolveImage(shopData.shop_logo, 'shop', 'shop_logo');
      res.json(shopData);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Protected: แก้ไขข้อมูลร้าน (ต้องมีสิทธิ manage_settings)
  router.put('/api/shop', requireAuth, checkPermission('manage_settings'), async (req, res) => {
    try {
      const { shop_name, shop_address, shop_phone, open_time, close_time, payment_qr_code, shop_logo, refill_water_price } = req.body;

      await db.query(
        'INSERT IGNORE INTO shop (id, shop_name, refill_water_price) VALUES (1, ?, ?)',
        [shop_name || 'Your Shop Name', refill_water_price || 0]
      );

      let sql = 'UPDATE shop SET shop_name = ?, shop_address = ?, shop_phone = ?, open_time = ?, close_time = ?, refill_water_price = ?';
      const params = [shop_name, shop_address, shop_phone, open_time, close_time, refill_water_price || 0];

      if (payment_qr_code) {
        const qrPathBuffer = saveImage(payment_qr_code, 'shop', 'payment_qr');
        sql += ', payment_qr_code = ?';
        params.push(qrPathBuffer);
      }
      if (shop_logo) {
        const logoPathBuffer = saveImage(shop_logo, 'shop', 'shop_logo');
        sql += ', shop_logo = ?';
        params.push(logoPathBuffer);
      }
      sql += ' WHERE id = 1';
      await db.query(sql, params);
      console.log('🚀 Emitting shop_updated');
      io.emit('shop_updated');
      res.json({ message: 'Shop info updated successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ============================
  // SERVICE TYPES API
  // ============================
  router.get('/api/service-types', async (req, res) => {
    try {
      const [results] = await db.query('SELECT * FROM service_types ORDER BY id');
      res.json(results);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // เพิ่ม service type ใหม่
  router.post('/api/service-types', requireAuth, async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'กรุณาระบุชื่อ' });
    try {
      const [result] = await db.query('INSERT INTO service_types (name) VALUES (?)', [name]);
      res.status(201).json({ id: result.insertId, name });
    } catch (err) {
      res.status(400).json({ error: 'ชื่อนี้มีอยู่แล้ว' });
    }
  });

  // ลบ service type
  router.delete('/api/service-types/:id', requireAuth, async (req, res) => {
    try {
      await db.query('DELETE FROM service_types WHERE id = ?', [req.params.id]);
      res.json({ message: 'ลบสำเร็จ' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};

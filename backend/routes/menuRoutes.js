const express = require('express');
const db = require('../config/db');
const { requireAuth, checkPermission } = require('../middlewares/auth');
const { resolveImage, saveImage } = require('../utils/imageStorage');

module.exports = (io) => {
  const router = express.Router();

  // Public: ดึงเมนู (ลูกค้าต้องเห็น)
  router.get('/api/menu', async (req, res) => {
    try {
      const sql = 'SELECT * FROM menu ORDER BY menu_category, menu_name';
      const [results] = await db.query(sql);
      const menuWithImages = results.map((item) => ({
        ...item,
        menu_image: resolveImage(item.menu_image, 'menus', `menu_${item.menu_id}`)
      }));
      res.json(menuWithImages);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Protected: เพิ่มเมนู (manage_settings)
  router.post('/api/menu', requireAuth, checkPermission('manage_settings'), async (req, res) => {
    try {
      const { menu_name, menu_description, menu_category, price, menu_quantity, menu_image } = req.body;
      const imagePathBuffer = saveImage(menu_image, 'menus', 'menu');
      const sql = 'INSERT INTO menu (menu_name, menu_description, menu_category, price, menu_quantity, menu_image) VALUES (?, ?, ?, ?, ?, ?)';
      const [result] = await db.query(sql, [menu_name, menu_description || null, menu_category || null, price, menu_quantity || 0, imagePathBuffer]);
      console.log('🚀 Emitting menu_updated');
      io.emit('menu_updated');
      res.status(201).json({ message: 'Menu item added successfully', menu_id: result.insertId });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Protected: แก้ไขเมนู (manage_settings)
  router.put('/api/menu/:id', requireAuth, checkPermission('manage_settings'), async (req, res) => {
    const { id } = req.params;
    const { menu_name, menu_description, menu_category, price, menu_quantity, menu_image } = req.body;

    try {
      const [menuResult] = await db.query('SELECT menu_quantity FROM menu WHERE menu_id = ?', [id]);
      if (menuResult.length === 0) return res.status(404).json({ message: 'Menu item not found' });
      const currentQuantity = menuResult[0].menu_quantity;

      let sqlUpdate;
      let paramsUpdate;
      if (menu_image) {
        // มีรูปใหม่หรือส่ง path เดิมมา → อัปเดตเป็น path ไฟล์
        const imagePathBuffer = saveImage(menu_image, 'menus', `menu_${id}`);
        sqlUpdate = 'UPDATE menu SET menu_name = ?, menu_description = ?, menu_category = ?, price = ?, menu_quantity = ?, menu_image = ? WHERE menu_id = ?';
        paramsUpdate = [menu_name, menu_description || null, menu_category || null, price, menu_quantity === null || menu_quantity === '' ? null : Number(menu_quantity), imagePathBuffer, id];
      } else {
        // ไม่มีรูปใหม่ → คงรูปเดิมไว้
        sqlUpdate = 'UPDATE menu SET menu_name = ?, menu_description = ?, menu_category = ?, price = ?, menu_quantity = ? WHERE menu_id = ?';
        paramsUpdate = [menu_name, menu_description || null, menu_category || null, price, menu_quantity === null || menu_quantity === '' ? null : Number(menu_quantity), id];
      }

      const [resultUpdate] = await db.query(sqlUpdate, paramsUpdate);
      if (resultUpdate.affectedRows === 0) return res.status(404).json({ message: 'Menu item not found for update' });

      const newQuantityDb = menu_quantity === null || menu_quantity === '' ? null : Number(menu_quantity);
      if (newQuantityDb !== null && currentQuantity !== newQuantityDb) {
        const changeQuantity = (currentQuantity === null ? 0 : currentQuantity) - newQuantityDb;
        const logSql = 'INSERT INTO stock_logs (menu_id, change_quantity, new_quantity, reason, user_id, timestamp) VALUES (?, ?, ?, ?, ?, NOW())';
        const adminUserId = req.user?.id || null;
        await db.query(logSql, [id, changeQuantity * -1, newQuantityDb, 'adjustment', adminUserId]);
        console.log(`Stock log created for menu ${id}. Change: ${changeQuantity * -1}, New Qty: ${newQuantityDb}`);
      }

      console.log('🚀 Emitting menu_updated');
      io.emit('menu_updated');
      res.json({ message: 'Menu item updated successfully' });
    } catch (err) {
      console.error('Error updating menu:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Protected: ลบเมนู (manage_settings)
  router.delete('/api/menu/:id', requireAuth, checkPermission('manage_settings'), async (req, res) => {
    const { id } = req.params;
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // ลบออกจาก plan_menu_access ก่อน
      await connection.query('DELETE FROM plan_menu_access WHERE menu_id = ?', [id]);

      // ลบออกจาก order_details ก่อน
      await connection.query('DELETE FROM order_details WHERE menu_id = ?', [id]);

      // แล้วค่อยลบเมนู
      const [result] = await connection.query('DELETE FROM menu WHERE menu_id = ?', [id]);
      if (result.affectedRows === 0) {
        await connection.rollback();
        return res.status(404).json({ error: 'ไม่พบเมนูนี้' });
      }

      await connection.commit();
      io.emit('menu_updated');
      res.json({ message: 'ลบเมนูเรียบร้อย' });
    } catch (err) {
      await connection.rollback();
      res.status(500).json({ error: err.message });
    } finally {
      connection.release();
    }
  });

  return router;
};

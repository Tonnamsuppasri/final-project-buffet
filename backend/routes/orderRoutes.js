const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { requireAuth } = require('../middlewares/auth');
const orderSessionCache = require('../utils/sessionCache');
const { resolveImage } = require('../utils/imageStorage');

module.exports = (io) => {
  const router = express.Router();

  // Public: สร้าง Order (สแกน QR Code)
  router.post('/api/orders', async (req, res) => {
    const { table_id, customer_quantity, plan_id, service_type, refill_water } = req.body;
    const order_uuid = uuidv4();

    try {
      const sql = "INSERT INTO orders (table_id, customer_quantity, plan_id, service_type, refill_water, start_time, order_status, order_uuid) VALUES (?, ?, ?, ?, ?, NOW(), 'in-progress', ?)";
      const [result] = await db.query(sql, [table_id, customer_quantity, plan_id, service_type, refill_water || 0, order_uuid]);

      const updateTableSql = "UPDATE tables SET status = 'ไม่ว่าง' WHERE table_id = ?";
      await db.query(updateTableSql, [table_id]);

      console.log('🚀 Emitting tables_updated (new order)');
      io.emit('tables_updated');

      const getTableSql = 'SELECT table_number FROM tables WHERE table_id = ?';
      const [tableResult] = await db.query(getTableSql, [table_id]);

      if (tableResult.length > 0) {
        const tableNumber = tableResult[0].table_number;
        io.emit('notification', {
          message: `โต๊ะ ${tableNumber} ได้เปิดใช้งานใหม่`,
          type: 'new_order',
          linkTo: '/table'
        });
      }

      res.status(201).json({ message: 'Order created successfully', order_id: result.insertId });
    } catch (err) {
      res.status(500).json({ error: 'Could not create order' });
    }
  });

  // Protected: ดูออเดอร์ที่ Active (สำหรับพนักงาน)
  router.get('/api/orders/active', requireAuth, async (req, res) => {
    try {
      const sql = `
        SELECT o.order_id, o.customer_quantity, o.service_type, o.start_time,
            o.order_status, o.order_uuid, o.refill_water,
            t.table_id, t.table_number, t.uuid,
            p.plan_name, p.price_per_person
        FROM orders o
        JOIN tables t ON o.table_id = t.table_id
        LEFT JOIN pricing_plans p ON o.plan_id = p.id 
        WHERE o.order_status = 'in-progress'
        ORDER BY o.start_time ASC
      `;
      const [results] = await db.query(sql);
      res.json(results);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Public: API สำหรับหน้าลูกค้า (ปลอดภัย)
  router.get('/api/order-session/:order_uuid', async (req, res) => {
    const { order_uuid } = req.params;
    try {
      const orderSql = `
        SELECT
          o.order_id, o.plan_id, o.customer_quantity, o.service_type, o.start_time,
          t.table_id, t.table_number, t.uuid AS table_uuid,
          p.plan_name, p.price_per_person
        FROM orders o
        JOIN tables t ON o.table_id = t.table_id
        LEFT JOIN pricing_plans p ON o.plan_id = p.id
        WHERE o.order_uuid = ? AND o.order_status = 'in-progress'
      `;
      const [orderResult] = await db.query(orderSql, [order_uuid]);

      if (orderResult.length === 0) {
        return res.status(404).json({ error: 'ไม่พบออเดอร์สำหรับโต๊ะนี้ หรือโต๊ะถูกปิดไปแล้ว' });
      }

      const planId = orderResult[0].plan_id;

      const menuSql = `
        SELECT m.*
        FROM menu m
        INNER JOIN plan_menu_access pma ON m.menu_id = pma.menu_id
        WHERE pma.plan_id = ?
        ORDER BY m.menu_category, m.menu_name
      `;
      const [menuResult] = await db.query(menuSql, [planId]);

      const menuWithImages = menuResult.map((item) => ({
        ...item,
        menu_image: resolveImage(item.menu_image, 'menus', `menu_${item.menu_id}`)
      }));

      const shopSql = 'SELECT shop_name, shop_logo FROM shop WHERE id = 1';
      const [shopResult] = await db.query(shopSql);
      const shopInfo = shopResult.length > 0 ? {
        ...shopResult[0],
        shop_logo: resolveImage(shopResult[0].shop_logo, 'shop', 'shop_logo')
      } : null;

      res.json({
        orderInfo: orderResult[0],
        menu: menuWithImages,
        shopInfo
      });
    } catch (err) {
      console.error('Error fetching order session:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Public: สั่งอาหารเพิ่ม (ลูกค้า)
  router.post('/api/orders/:orderId/details', async (req, res) => {
    const { orderId } = req.params;
    const orderDetails = req.body;
    if (!Array.isArray(orderDetails) || orderDetails.length === 0) return res.status(400).json({ error: 'Invalid data' });

    let connection;
    try {
      connection = await db.getConnection();
      await connection.beginTransaction();

      // 1. ตรวจสอบสต็อกสำหรับทุกเมนูที่สั่ง
      const menuIds = orderDetails.map((item) => item.menu_id);

      // ดึงสต็อกจริงจากตาราง menu (Lock แถวป้องกัน Race Condition)
      const [stockResults] = await connection.query(
        'SELECT menu_id, menu_name, menu_quantity FROM menu WHERE menu_id IN (?) FOR UPDATE',
        [menuIds]
      );

      // ดึงยอดที่สั่งไปแล้วแต่ยังไม่ตัดสต็อก (กำลังจัดทำ อยู่ทุกโต๊ะ)
      const [pendingResults] = await connection.query(
        `SELECT od.menu_id, SUM(od.quantity) AS pending_quantity
         FROM order_details od
         JOIN orders o ON od.order_id = o.order_id
         WHERE od.menu_id IN (?)
           AND od.item_status = 'กำลังจัดทำ'
           AND o.order_status = 'in-progress'
         GROUP BY od.menu_id`,
        [menuIds]
      );

      for (const item of orderDetails) {
        const menu = stockResults.find((m) => m.menu_id === item.menu_id);
        if (!menu) throw new Error(`ไม่พบเมนู ID: ${item.menu_id}`);

        if (menu.menu_quantity !== null) {
          const pending = pendingResults.find((p) => p.menu_id === item.menu_id);
          const pendingQty = pending ? Number(pending.pending_quantity) : 0;
          const availableQty = menu.menu_quantity - pendingQty;

          if (availableQty < item.quantity) {
            throw new Error(`วัตถุดิบหมด: ${menu.menu_name} (คงเหลือ ${availableQty} จาก ${menu.menu_quantity})`);
          }
        }
      }

      // 2. ถ้าผ่าน ให้บันทึกรายการ
      const values = orderDetails.map((item) => [
        orderId, item.menu_id, item.quantity, item.price_per_item, 'กำลังจัดทำ', item.customer_name || null
      ]);
      await connection.query('INSERT INTO order_details (order_id, menu_id, quantity, price_per_item, item_status, customer_name) VALUES ?', [values]);

      await connection.commit();

      io.emit('new_order_item', { orderId, items: orderDetails });

      const [orderInfo] = await db.query(
        `SELECT t.table_number 
         FROM orders o 
         JOIN tables t ON o.table_id = t.table_id 
         WHERE o.order_id = ?`,
        [orderId]
      );
      const tableNumber = orderInfo[0]?.table_number ?? '?';
      const totalItems = orderDetails.reduce((sum, item) => sum + item.quantity, 0);

      io.emit('notification', {
        message: `🍽️ โต๊ะ ${tableNumber} — สั่งอาหารใหม่ ${totalItems} รายการ`,
        type: 'new_order',
        linkTo: '/order'
      });

      res.status(201).json({ message: 'Order details added successfully' });
    } catch (err) {
      if (connection) await connection.rollback();
      console.error('Order Detail Error:', err.message);
      return res.status(400).json({ error: err.message });
    } finally {
      if (connection) connection.release();
    }
  });

  // Public/Protected: ดูรายการที่สั่ง (ลูกค้าดูได้ / พนักงานดูได้)
  router.get('/api/orders/:orderId/details', async (req, res) => {
    const { orderId } = req.params;
    try {
      const sql = `
        SELECT
            od.order_detail_id, od.quantity, od.item_status, od.created_at,
            od.price_per_item, od.customer_name, 
            m.menu_id, m.menu_name, m.menu_image
        FROM order_details od
        LEFT JOIN menu m ON od.menu_id = m.menu_id
        WHERE od.order_id = ?
        ORDER BY od.created_at DESC
      `;
      const [results] = await db.query(sql, [orderId]);
      const detailsWithImages = results.map((item) => ({
        ...item,
        menu_image: resolveImage(item.menu_image, 'menus', `menu_${item.menu_id || `detail_${item.order_detail_id}`}`)
      }));
      res.json(detailsWithImages);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Public: เข้าร่วมโต๊ะ (Join Table)
  router.post('/api/orders/:orderId/join', async (req, res) => {
    const { orderId } = req.params;
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const mapKey = `${orderId}-${sessionId}`;
    if (orderSessionCache.has(mapKey)) {
      return res.json({ customerName: orderSessionCache.get(mapKey) });
    }

    let connection;
    try {
      connection = await db.getConnection();
      await connection.beginTransaction();

      const [results] = await connection.query('SELECT customer_join_count FROM orders WHERE order_id = ? FOR UPDATE', [orderId]);

      if (results.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ message: 'Order not found' });
      }

      const currentCount = results[0].customer_join_count;
      const newCount = currentCount + 1;
      const customerLetter = String.fromCharCode(64 + newCount);
      const customerName = `ลูกค้า ${customerLetter}`;

      await connection.query('UPDATE orders SET customer_join_count = ? WHERE order_id = ?', [newCount, orderId]);

      await connection.commit();

      orderSessionCache.set(mapKey, customerName);
      io.emit('tables_updated');
      res.json({ customerName });
    } catch (err) {
      console.error(`Error joining order ${orderId}:`, err);
      if (connection) {
        await connection.rollback();
      }
      res.status(500).json({ error: 'Failed to process join request' });
    } finally {
      if (connection) {
        connection.release();
      }
    }
  });

  // Protected: อัปเดตสถานะอาหาร (พนักงาน)
  router.put('/api/order-details/:detailId/deliver', requireAuth, async (req, res) => {
    try {
      const { detailId } = req.params;
      const sql = "UPDATE order_details SET item_status = 'จัดส่งแล้ว' WHERE order_detail_id = ?";
      const [result] = await db.query(sql, [detailId]);
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Order detail item not found' });

      console.log(`🚀 Emitting item_status_updated for detail ${detailId}`);
      io.emit('item_status_updated', { detailId, newStatus: 'จัดส่งแล้ว' });
      res.json({ message: 'Item status updated successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Protected: ยกเลิกออเดอร์ (พนักงาน)
  router.delete('/api/orders/:orderId', requireAuth, async (req, res) => {
    const { orderId } = req.params;
    let connection;
    try {
      connection = await db.getConnection();
      await connection.beginTransaction();

      const [orders] = await connection.query("SELECT table_id FROM orders WHERE order_id = ? AND order_status = 'in-progress'", [orderId]);
      if (orders.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ message: 'Active order not found or already completed' });
      }

      const tableId = orders[0].table_id;

      const [maxIdResult] = await connection.query('SELECT MAX(order_id) as max_id FROM orders');
      const isMaxId = (maxIdResult[0].max_id == orderId);

      await connection.query('DELETE FROM order_details WHERE order_id = ?', [orderId]);
      const [deleteResult] = await connection.query('DELETE FROM orders WHERE order_id = ?', [orderId]);

      if (deleteResult.affectedRows === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ message: 'Order not found for deletion' });
      }

      let message = 'Order cancelled and table status updated successfully';
      if (isMaxId) {
        const [newMaxResult] = await connection.query('SELECT COALESCE(MAX(order_id), 0) + 1 as next_id FROM orders');
        const nextId = newMaxResult[0].next_id;
        const resetId = Math.max(1, nextId);
        await connection.query('ALTER TABLE orders AUTO_INCREMENT = ?', [resetId]);
        console.log(`🚀 AUTO_INCREMENT reset to ${resetId}`);
        message = 'Order cancelled, table status updated, and AUTO_INCREMENT reset.';
      }

      await connection.query("UPDATE tables SET status = 'ว่าง' WHERE table_id = ?", [tableId]);

      await connection.commit();
      connection.release();

      console.log('🚀 Emitting tables_updated (order cancelled)');
      io.emit('tables_updated');
      res.json({ message });
    } catch (err) {
      if (connection) {
        await connection.rollback();
        connection.release();
      }
      console.error('Error deleting order:', err);
      res.status(500).json({ error: 'Could not delete order' });
    }
  });

  return router;
};

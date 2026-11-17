const express = require('express');
const db = require('../config/db');
const { requireAuth } = require('../middlewares/auth');
const orderSessionCache = require('../utils/sessionCache');

module.exports = (io) => {
  const router = express.Router();

  // Protected: ชำระเงิน (พนักงานดำเนินการ)
  router.post('/api/payment', requireAuth, async (req, res) => {
    const { order_id, payment_method, discount, promotion_id } = req.body;
    if (!order_id) return res.status(400).json({ error: 'Missing order_id' });

    let connection;
    try {
      connection = await db.getConnection();
      await connection.beginTransaction();

      // 1. ดึงข้อมูลออเดอร์เพื่อคำนวณบุฟเฟต์
      const [orderRes] = await connection.query(
        `SELECT o.customer_quantity, o.refill_water, pp.price_per_person,
                s.refill_water_price
        FROM orders o 
        LEFT JOIN pricing_plans pp ON o.plan_id = pp.id
        LEFT JOIN shop s ON s.id = 1
        WHERE o.order_id = ?`,
        [order_id]
      );
      const { customer_quantity, price_per_person, refill_water, refill_water_price } = orderRes[0];
      const buffetTotal = customer_quantity * (price_per_person || 0);
      const waterTotal = refill_water ? customer_quantity * (refill_water_price || 0) : 0;

      // 2. ดึงข้อมูลรายการสั่งเพิ่ม (A La Carte) เพื่อคำนวณ
      const [alaCarteRes] = await connection.query(
        `SELECT SUM(quantity * price_per_item) AS total 
         FROM order_details WHERE order_id = ? AND price_per_item > 0`,
        [order_id]
      );
      const alaCarteTotal = Number(alaCarteRes[0].total || 0);

      // 3. รวมยอด
      const rawTotal = buffetTotal + waterTotal + alaCarteTotal;

      // 4. คำนวณส่วนลด
      const validDiscount = Math.min(Number(discount || 0), rawTotal);
      const finalPayAmount = rawTotal - validDiscount;

      // 5. บันทึกการชำระเงิน
      const [payRes] = await connection.query(
        `INSERT INTO payment (order_id, payment_time, total_price, payment_method, discount, promotion_id) 
         VALUES (?, NOW(), ?, ?, ?, ?)`,
        [order_id, finalPayAmount, payment_method, validDiscount, promotion_id || null]
      );
      const paymentId = payRes.insertId;

      // 6. ตัดสต็อก
      const [itemsToDeduct] = await connection.query(
        `SELECT od.menu_id, SUM(od.quantity) as total_qty 
         FROM order_details od JOIN menu m ON od.menu_id = m.menu_id 
         WHERE od.order_id = ? AND m.menu_quantity IS NOT NULL 
         GROUP BY od.menu_id`,
        [order_id]
      );

      if (itemsToDeduct.length > 0) {
        for (const item of itemsToDeduct) {
          await connection.query(
            'UPDATE menu SET menu_quantity = menu_quantity - ? WHERE menu_id = ?',
            [item.total_qty, item.menu_id]
          );

          const [updatedMenu] = await connection.query(
            'SELECT menu_quantity FROM menu WHERE menu_id = ?',
            [item.menu_id]
          );
          const currentQty = updatedMenu[0]?.menu_quantity || 0;

          await connection.query(
            'INSERT INTO stock_logs (menu_id, change_quantity, new_quantity, reason, user_id, timestamp) VALUES (?, ?, ?, ?, ?, NOW())',
            [
              item.menu_id,
              -item.total_qty,
              currentQty,
              'sale',
              req.user ? req.user.id : null
            ]
          );
        }
      }

      // 7. ปิดออเดอร์และโต๊ะ
      await connection.query("UPDATE orders SET order_status = 'completed' WHERE order_id = ?", [order_id]);
      await connection.query(
        "UPDATE tables t JOIN orders o ON t.table_id = o.table_id SET t.status = 'ว่าง' WHERE o.order_id = ?",
        [order_id]
      );

      // เคลียร์ Cache
      for (const key of orderSessionCache.keys()) {
        if (key.startsWith(`${order_id}-`)) orderSessionCache.delete(key);
      }

      await connection.commit();

      io.emit('tables_updated');
      io.emit('new_payment', { paymentId, orderId: order_id, totalPrice: finalPayAmount });

      res.status(201).json({ message: 'Payment success', payment_id: paymentId, total: finalPayAmount });
    } catch (err) {
      if (connection) await connection.rollback();
      console.error('Payment Error:', err);
      res.status(500).json({ error: err.message });
    } finally {
      if (connection) connection.release();
    }
  });

  // Protected: ดูรายละเอียดการชำระเงิน (พนักงาน)
  router.get('/api/payments/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
      const paymentDetailsSql = `
        SELECT
            p.payment_id, p.order_id, p.payment_time, p.total_price, p.payment_method,
            o.customer_quantity, o.service_type, o.start_time, o.refill_water,
            t.table_number, pp.plan_name, pp.price_per_person,
            s.refill_water_price
        FROM payment p
        JOIN orders o ON p.order_id = o.order_id
        JOIN tables t ON o.table_id = t.table_id
        LEFT JOIN pricing_plans pp ON o.plan_id = pp.id
        LEFT JOIN shop s ON s.id = 1
        WHERE p.payment_id = ?
      `;

      const [paymentResult] = await db.query(paymentDetailsSql, [id]);

      if (paymentResult.length === 0) {
        return res.status(404).json({ message: 'Payment record not found' });
      }
      const paymentDetails = paymentResult[0];
      const orderId = paymentDetails.order_id;

      const menuItemsSql = `
        SELECT od.quantity, od.price_per_item, m.menu_name
        FROM order_details od
        LEFT JOIN menu m ON od.menu_id = m.menu_id
        WHERE od.order_id = ?
      `;

      const [menuResult] = await db.query(menuItemsSql, [orderId]);
      res.json({ details: paymentDetails, menuItems: menuResult });
    } catch (err) {
      console.error('Error fetching payment details:', err);
      return res.status(500).json({ error: 'Error fetching payment details' });
    }
  });

  // Protected: ดูรายการชำระเงินทั้งหมด (พนักงาน)
  router.get('/api/payments', requireAuth, async (req, res) => {
    const { searchTerm, startDate, endDate } = req.query;
    try {
      let sql = `
        SELECT p.payment_id, p.order_id, p.payment_time, p.total_price, p.payment_method, 
               p.discount, p.promotion_id,
               t.table_number, o.customer_quantity, o.service_type, o.refill_water,
               pp.plan_name, pp.price_per_person,
               s.refill_water_price,
               promo.name AS promotion_name, promo.type AS promotion_type, promo.value AS promotion_value
        FROM payment p
        JOIN orders o ON p.order_id = o.order_id
        JOIN tables t ON o.table_id = t.table_id
        LEFT JOIN pricing_plans pp ON o.plan_id = pp.id
        LEFT JOIN shop s ON s.id = 1
        LEFT JOIN promotions promo ON p.promotion_id = promo.promotion_id
        WHERE 1=1
      `;
      const params = [];

      if (searchTerm) {
        sql += ' AND (p.payment_id = ? OR t.table_number LIKE ? OR p.payment_method LIKE ? OR p.total_price LIKE ?)';
        params.push(searchTerm, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
      }
      if (startDate) {
        sql += ' AND DATE(p.payment_time) >= ?';
        params.push(startDate);
      }
      if (endDate) {
        sql += ' AND DATE(p.payment_time) <= ?';
        params.push(endDate);
      }

      sql += ' ORDER BY p.payment_time DESC';

      const [results] = await db.query(sql, params);
      res.json(results);
    } catch (err) {
      console.error('Error fetching payments:', err);
      res.status(500).json({ error: 'Error fetching payment data' });
    }
  });

  return router;
};

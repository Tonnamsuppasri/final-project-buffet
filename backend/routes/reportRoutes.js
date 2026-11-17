const express = require('express');
const db = require('../config/db');
const { requireAuth, checkPermission } = require('../middlewares/auth');

const getDates = (req) => {
  let { startDate, endDate } = req.query;
  if (!startDate) {
    startDate = new Date().toISOString().split('T')[0];
  }
  if (!endDate) {
    endDate = new Date().toISOString().split('T')[0];
  }
  return [startDate, `${endDate} 23:59:59`];
};

module.exports = () => {
  const router = express.Router();

  router.get('/api/reports/overview/stats', requireAuth, checkPermission('view_reports'), async (req, res) => {
    const [startDate, endDate] = getDates(req);
    const sql = 'SELECT ' +
      'COALESCE(SUM(p.total_price), 0) AS totalSales, ' +
      'COALESCE(COUNT(p.payment_id), 0) AS totalOrders, ' +
      'COALESCE(SUM(o.customer_quantity), 0) AS totalCustomers, ' +
      'COALESCE(SUM(p.total_price) / NULLIF(SUM(o.customer_quantity), 0), 0) AS avgPerCustomer ' +
      'FROM payment p ' +
      'JOIN orders o ON p.order_id = o.order_id ' +
      'WHERE p.payment_time BETWEEN ? AND ?;';

    try {
      const [result] = await db.query(sql, [startDate, endDate]);
      const rawData = result[0] || { totalSales: 0, totalOrders: 0, totalCustomers: 0, avgPerCustomer: 0 };
      const formattedData = {
        totalSales: Number(rawData.totalSales),
        totalOrders: Number(rawData.totalOrders),
        totalCustomers: Number(rawData.totalCustomers),
        avgPerCustomer: Number(rawData.avgPerCustomer)
      };

      res.json(formattedData);
    } catch (err) {
      console.error('Error fetching overview stats:', err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  router.get('/api/reports/overview/service-types', requireAuth, checkPermission('view_reports'), async (req, res) => {
    const [startDate, endDate] = getDates(req);
    const sql = `
      SELECT 
          o.service_type AS type, 
          COUNT(o.order_id) AS count,
          SUM(p.total_price) AS revenue
      FROM orders o
      JOIN payment p ON o.order_id = p.order_id
      WHERE p.payment_time BETWEEN ? AND ?
      GROUP BY o.service_type;
    `;

    try {
      const [results] = await db.query(sql, [startDate, endDate]);
      res.json(results);
    } catch (err) {
      console.error('Error fetching service type summary:', err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  router.get('/api/reports/overview/payment-methods', requireAuth, checkPermission('view_reports'), async (req, res) => {
    const [startDate, endDate] = getDates(req);
    const sql = 'SELECT ' +
      'payment_method AS method, ' +
      'SUM(total_price) AS total ' +
      'FROM payment ' +
      'WHERE payment_time BETWEEN ? AND ? AND payment_method IS NOT NULL ' +
      'GROUP BY payment_method ' +
      'HAVING total > 0;';

    try {
      const [results] = await db.query(sql, [startDate, endDate]);
      res.json(results);
    } catch (err) {
      console.error('Error fetching payment methods:', err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  router.get('/api/reports/overview/plan-popularity', requireAuth, checkPermission('view_reports'), async (req, res) => {
    const [startDate, endDate] = getDates(req);
    const sql = 'SELECT ' +
      "COALESCE(pp.plan_name, 'A La Carte / อื่นๆ') AS plan_name, " +
      'SUM(o.customer_quantity) AS count ' +
      'FROM orders o ' +
      'JOIN payment p ON o.order_id = p.order_id ' +
      'LEFT JOIN pricing_plans pp ON o.plan_id = pp.id ' +
      'WHERE p.payment_time BETWEEN ? AND ? ' +
      'GROUP BY pp.id, pp.plan_name ' +
      'ORDER BY count DESC;';

    try {
      const [results] = await db.query(sql, [startDate, endDate]);
      res.json(results);
    } catch (err) {
      console.error('Error fetching plan popularity:', err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  router.get('/api/reports/sales', requireAuth, checkPermission('view_reports'), async (req, res) => {
    const [startDate, endDate] = getDates(req);
    try {
      const summarySql = 'SELECT ' +
        'COALESCE(SUM(total_price), 0) AS totalSales, ' +
        'COALESCE(COUNT(payment_id), 0) AS totalOrders, ' +
        'COALESCE(SUM(total_price) / NULLIF(COUNT(payment_id), 0), 0) AS avgOrderValue ' +
        'FROM payment ' +
        'WHERE payment_time BETWEEN ? AND ?;';

      const [summaryResult] = await db.query(summarySql, [startDate, endDate]);

      const dailySalesSql = 'SELECT ' +
        'DATE(payment_time) AS date, ' +
        'SUM(total_price) AS total ' +
        'FROM payment ' +
        'WHERE payment_time BETWEEN ? AND ? ' +
        'GROUP BY DATE(payment_time) ' +
        'ORDER BY date ASC;';

      const [dailySales] = await db.query(dailySalesSql, [startDate, endDate]);

      const paymentDetailsSql = 'SELECT ' +
        'p.payment_id, p.order_id, p.payment_time, p.total_price, p.payment_method, ' +
        't.table_number, o.customer_quantity ' +
        'FROM payment p ' +
        'JOIN orders o ON p.order_id = o.order_id ' +
        'JOIN tables t ON o.table_id = t.table_id ' +
        'WHERE p.payment_time BETWEEN ? AND ? ' +
        'ORDER BY p.payment_time DESC;';

      const [paymentDetails] = await db.query(paymentDetailsSql, [startDate, endDate]);

      res.json({
        summary: summaryResult[0] || { totalSales: 0, totalOrders: 0, avgOrderValue: 0 },
        dailySales,
        paymentDetails
      });
    } catch (err) {
      console.error('Error fetching sales report:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/api/reports/menu/plans', requireAuth, checkPermission('view_reports'), async (req, res) => {
    const [startDate, endDate] = getDates(req);
    const sql = 'SELECT ' +
      'pp.id AS plan_id, ' +
      "COALESCE(pp.plan_name, 'A La Carte / อื่นๆ') AS plan_name, " +
      'AVG(pp.price_per_person) AS price_per_person, ' +
      'COUNT(o.order_id) AS total_orders, ' +
      'SUM(o.customer_quantity) AS total_customers, ' +
      'SUM(o.customer_quantity * COALESCE(pp.price_per_person, 0)) AS total_revenue ' +
      'FROM orders o ' +
      'JOIN payment p ON o.order_id = p.order_id ' +
      'LEFT JOIN pricing_plans pp ON o.plan_id = pp.id ' +
      'WHERE p.payment_time BETWEEN ? AND ? ' +
      'GROUP BY pp.id, pp.plan_name ' +
      'ORDER BY total_revenue DESC;';

    try {
      const [results] = await db.query(sql, [startDate, endDate]);
      const processedResults = results.map((row) => ({
        ...row,
        price_per_person: row.price_per_person === null ? null : parseFloat(row.price_per_person),
        total_revenue: row.total_revenue === null ? null : parseFloat(row.total_revenue)
      }));
      res.json(processedResults);
    } catch (err) {
      console.error('[/api/reports/menu/plans] SQL Error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  router.get('/api/reports/menu/items', requireAuth, checkPermission('view_reports'), async (req, res) => {
    const [startDate, endDate] = getDates(req);
    const sql = 'SELECT ' +
      'm.menu_id, m.menu_name AS name, m.menu_category AS category, ' +
      'SUM(od.quantity) AS total_quantity, ' +
      'SUM(od.quantity * od.price_per_item) AS total_revenue ' +
      'FROM order_details od ' +
      'JOIN menu m ON od.menu_id = m.menu_id ' +
      'WHERE od.created_at BETWEEN ? AND ? ' +
      'GROUP BY m.menu_id, m.menu_name, m.menu_category ' +
      'ORDER BY total_quantity DESC;';

    try {
      const [results] = await db.query(sql, [startDate, endDate]);
      res.json(results);
    } catch (err) {
      console.error('[/api/reports/menu/items] SQL Error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
};

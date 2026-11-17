const express = require('express');
const { format } = require('date-fns');
const { th } = require('date-fns/locale');
const db = require('../config/db');
const { requireAuth, checkPermission } = require('../middlewares/auth');

module.exports = () => {
  const router = express.Router();

  // Protected: manage_stock
  router.get('/api/stock/summary', requireAuth, checkPermission('manage_stock'), async (req, res) => {
    const { menuId, startDate, endDate, groupBy = 'day' } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required.' });
    }

    if (!['hour', 'day', 'month', 'year'].includes(groupBy)) {
      return res.status(400).json({ error: 'Invalid groupBy value. Use "hour", "day", "month", or "year".' });
    }

    let dateColumn;
    let interval;
    let labelFormat;

    switch (groupBy) {
      case 'hour':
        dateColumn = 'DATE_FORMAT(timestamp, "%Y-%m-%d %H:00:00")';
        interval = 'INTERVAL 1 HOUR';
        labelFormat = 'dd MMM HH:mm';
        break;
      case 'month':
        dateColumn = 'DATE_FORMAT(timestamp, "%Y-%m-01")';
        interval = 'INTERVAL 1 MONTH';
        labelFormat = 'MMM yyyy';
        break;
      case 'year':
        dateColumn = 'DATE_FORMAT(timestamp, "%Y-01-01")';
        interval = 'INTERVAL 1 YEAR';
        labelFormat = 'yyyy';
        break;
      default: // 'day'
        dateColumn = 'DATE(timestamp)';
        interval = 'INTERVAL 1 DAY';
        labelFormat = 'dd MMM yyyy';
        break;
    }

    let sql = `
      SELECT
          ${dateColumn} AS period_start,
          m.menu_id, m.menu_name,
          COALESCE(SUM(CASE WHEN sl.change_quantity > 0 THEN sl.change_quantity ELSE 0 END), 0) AS total_in,
          COALESCE(SUM(CASE WHEN sl.change_quantity < 0 THEN ABS(sl.change_quantity) ELSE 0 END), 0) AS total_out,
          (
              SELECT sl_last.new_quantity
              FROM stock_logs sl_last
              WHERE sl_last.menu_id = sl.menu_id 
                AND sl_last.timestamp < DATE_ADD(${dateColumn}, ${interval})
              ORDER BY sl_last.timestamp DESC, sl_last.log_id DESC
              LIMIT 1
          ) AS ending_balance
      FROM stock_logs sl
      JOIN menu m ON sl.menu_id = m.menu_id
      WHERE sl.timestamp BETWEEN ? AND ?
    `;

    const params = [`${startDate} 00:00:00`, `${endDate} 23:59:59`];

    if (menuId && menuId !== '') {
      sql += ' AND sl.menu_id = ?';
      params.push(menuId);
    }

    sql += ' GROUP BY period_start, m.menu_id, m.menu_name ORDER BY period_start ASC, m.menu_name ASC;';

    try {
      const [results] = await db.query(sql, params);

      const formattedResults = results.map((row) => {
        const d = new Date(row.period_start);
        return {
          period_start: row.period_start,
          menu_id: row.menu_id,
          menu_name: row.menu_name,
          period_label: format(d, labelFormat, { locale: th }),
          total_in: parseInt(row.total_in, 10),
          total_out: parseInt(row.total_out, 10),
          ending_balance: row.ending_balance !== null ? parseInt(row.ending_balance, 10) : null
        };
      });

      res.json(formattedResults);
    } catch (err) {
      console.error('Error fetching stock summary:', err);
      res.status(500).json({ error: 'Could not fetch stock summary data' });
    }
  });

  router.get('/api/stock/history/:menuId', requireAuth, checkPermission('manage_stock'), async (req, res) => {
    const { menuId } = req.params;
    const { startDate, endDate } = req.query;
    let sql = 'SELECT sl.*, u.username as changed_by_user ' +
      'FROM stock_logs sl LEFT JOIN users u ON sl.user_id = u.id ' +
      'WHERE sl.menu_id = ?';
    const params = [menuId];
    if (startDate) { sql += ' AND sl.timestamp >= ?'; params.push(`${startDate} 00:00:00`); }
    if (endDate) { sql += ' AND sl.timestamp <= ?'; params.push(`${endDate} 23:59:59`); }
    sql += ' ORDER BY sl.timestamp DESC, sl.log_id DESC';
    try {
      const [logs] = await db.query(sql, params);
      res.json(logs);
    } catch (err) {
      console.error(`Error fetching stock history for menu ${menuId}:`, err);
      res.status(500).json({ error: 'Could not fetch stock history' });
    }
  });

  return router;
};

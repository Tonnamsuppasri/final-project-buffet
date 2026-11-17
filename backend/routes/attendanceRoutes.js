const express = require('express');
const { format } = require('date-fns');
const db = require('../config/db');
const { requireAuth, requireAdmin } = require('../middlewares/auth');

module.exports = (io) => {
  const router = express.Router();

  router.get('/api/attendance/status', requireAuth, async (req, res) => {
    const userId = req.user.id;
    const now = new Date();
    const todayDate = format(now, 'yyyy-MM-dd');

    try {
      const sql = 'SELECT attendance_id, clock_in_time, clock_out_time ' +
        'FROM attendance ' +
        'WHERE user_id = ? AND date = ? ' +
        'ORDER BY clock_in_time DESC LIMIT 1';

      const [records] = await db.query(sql, [userId, todayDate]);

      if (records.length === 0) {
        res.json({ status: 'not_clocked_in', lastClockIn: null });
      } else {
        const latestRecord = records[0];
        if (latestRecord.clock_out_time === null) {
          res.json({ status: 'clocked_in', lastClockIn: latestRecord.clock_in_time });
        } else {
          res.json({ status: 'clocked_out', lastClockIn: latestRecord.clock_in_time });
        }
      }
    } catch (err) {
      console.error(`Error getting attendance status for user ${userId}:`, err);
      res.status(500).json({ error: 'Could not get attendance status' });
    }
  });

  router.post('/api/attendance/clock-in', requireAuth, async (req, res) => {
    const userId = req.user.id;
    const { note } = req.body;

    try {
      const todayDate = format(new Date(), 'yyyy-MM-dd');
      const checkSql = 'SELECT * FROM attendance WHERE user_id = ? AND date = ? AND clock_out_time IS NULL';
      const [existing] = await db.query(checkSql, [userId, todayDate]);

      if (existing.length > 0) {
        return res.status(400).json({ message: 'คุณกำลังเข้างานอยู่ (กรุณากดออกงานก่อนเริ่มรอบใหม่)' });
      }

      const now = new Date();
      const noteText = note ? `In: ${note}` : null;
      const insertSql = 'INSERT INTO attendance (user_id, clock_in_time, date, notes) VALUES (?, ?, ?, ?)';
      await db.query(insertSql, [userId, now, todayDate, noteText]);

      res.status(201).json({ message: 'บันทึกเวลาเข้างานสำเร็จ', clockInTime: now });
      io.emit(`attendance_updated_${userId}`);
      io.emit('attendance_updated_admin');
    } catch (err) {
      console.error(`Clock-in error for user ${userId}:`, err);
      res.status(500).json({ error: 'ไม่สามารถบันทึกเวลาเข้างานได้' });
    }
  });

  router.post('/api/attendance/clock-out', requireAuth, async (req, res) => {
    const userId = req.user.id;
    const { note } = req.body;
    const now = new Date();
    const todayDate = format(now, 'yyyy-MM-dd');

    try {
      const findSql = 'SELECT attendance_id FROM attendance WHERE user_id = ? AND date = ? AND clock_out_time IS NULL ORDER BY clock_in_time DESC LIMIT 1';
      const [records] = await db.query(findSql, [userId, todayDate]);

      if (records.length === 0) {
        return res.status(400).json({ message: 'ไม่พบข้อมูลเข้างานล่าสุด หรือคุณได้ออกงานไปแล้ว' });
      }

      const attendanceId = records[0].attendance_id;
      let updateSql;
      let params;

      if (note) {
        updateSql = `
          UPDATE attendance 
          SET clock_out_time = ?, 
              notes = CONCAT(IFNULL(notes, ''), IF(notes IS NULL, '', ' | '), ?) 
          WHERE attendance_id = ?`;
        params = [now, `Out: ${note}`, attendanceId];
      } else {
        updateSql = 'UPDATE attendance SET clock_out_time = ? WHERE attendance_id = ?';
        params = [now, attendanceId];
      }

      await db.query(updateSql, params);

      res.json({ message: 'บันทึกเวลาออกงานสำเร็จ', clockOutTime: now });
      io.emit(`attendance_updated_${userId}`);
      io.emit('attendance_updated_admin');
    } catch (err) {
      console.error(`Clock-out error for user ${userId}:`, err);
      res.status(500).json({ error: 'ไม่สามารถบันทึกเวลาออกงานได้' });
    }
  });

  router.get('/api/attendance', requireAuth, requireAdmin, async (req, res) => {
    const { userId, startDate, endDate } = req.query;
    let sql = 'SELECT a.attendance_id, a.user_id, a.clock_in_time, a.clock_out_time, a.date, a.notes, ' +
      'u.username, u.first_name, u.last_name, u.nickname ' +
      'FROM attendance a ' +
      'JOIN users u ON a.user_id = u.id ' +
      'WHERE 1=1';
    const params = [];
    if (userId) {
      sql += ' AND a.user_id = ?';
      params.push(userId);
    }
    if (startDate) {
      sql += ' AND a.date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND a.date <= ?';
      params.push(endDate);
    }
    sql += ' ORDER BY a.date DESC, u.username ASC, a.clock_in_time DESC';
    try {
      const [results] = await db.query(sql, params);
      res.json(results);
    } catch (err) {
      console.error('Error fetching attendance report:', err);
      res.status(500).json({ error: 'Could not fetch attendance report' });
    }
  });

  router.get('/api/attendance/summary', requireAuth, requireAdmin, async (req, res) => {
    const { userId, startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required for summary report.' });
    }
    let whereClause = 'WHERE a.clock_out_time IS NOT NULL AND a.date BETWEEN ? AND ?';
    const params = [startDate, endDate];
    if (userId) {
      whereClause += ' AND a.user_id = ?';
      params.push(userId);
    }
    const sql = `
      SELECT
          u.id AS user_id, u.username, u.first_name, u.last_name, u.nickname,
          COUNT(DISTINCT a.date) AS days_worked,
          COALESCE(SUM(TIMESTAMPDIFF(MINUTE, a.clock_in_time, a.clock_out_time)), 0) AS total_minutes_worked
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      ${whereClause} 
      GROUP BY u.id, u.username, u.first_name, u.last_name, u.nickname
      ORDER BY u.username ASC;
    `;
    try {
      const [results] = await db.query(sql, params);
      const summaryResults = results.map((row) => {
        const totalMinutes = row.total_minutes_worked;
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return {
          ...row,
          total_time_worked_formatted: `${hours} ชม. ${minutes} นาที`,
          total_minutes_worked: totalMinutes
        };
      });
      res.json(summaryResults);
    } catch (err) {
      console.error('Error fetching attendance summary report:', err);
      res.status(500).json({ error: 'Could not fetch attendance summary report' });
    }
  });

  return router;
};

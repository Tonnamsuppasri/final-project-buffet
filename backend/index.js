// backend/index.js
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect((err) => {
  if (err) throw err;
  console.log('✅ MySQL connected!');
});

// --- Define all API routes here ---

// Login API
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'โปรดกรอกข้อมูลให้ครบ' });
  }

  const sqlUser = 'SELECT * FROM users WHERE username = ?';
  db.query(sqlUser, [username], (err, users) => {
    if (err) return res.status(500).json({ error: err });
    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'ไม่มีชื่อผู้ใช้นี้' });
    }

    const user = users[0];
    if (user.password !== password) {
      return res.status(401).json({ success: false, message: 'รหัสผ่านผิด' });
    }

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  });
});

app.get('/api/user/:id', (req, res) => {
  const { id } = req.params;
  db.query('SELECT id, username, role FROM users WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    if (result.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json(result[0]);
  });
});

// Staff API - Get all staff
app.get('/api/staff', (req, res) => {
  const sql = 'SELECT iduser, username, role, phone, email FROM users';
  db.query(sql, (err, result) => {
    if (err) {
      console.error('❌ Error fetching staff:', err);
      return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
    }
    res.json(result);
  });
});

// Staff API - Add new staff
app.post('/api/staff', (req, res) => {
  const { username, email, password, phone, role } = req.body;
  const sql = 'INSERT INTO users (username, email, password, phone, role) VALUES (?, ?, ?, ?, ?)';
  db.query(sql, [username, email, password, phone, role], (err, result) => {
    if (err) {
      console.error('❌ Error adding staff:', err);
      return res.status(500).json({ error: 'ไม่สามารถเพิ่มพนักงานได้' });
    }
    // Return the newly created staff member with their generated ID
    res.status(201).json({ iduser: result.insertId, username, email, phone, role });
  });
});

// Staff API - Update staff by ID (PUT request)
app.put('/api/staff/:id', (req, res) => {
  const { id } = req.params;
  const { username, email, phone, role, newPassword } = req.body;

  let sql = 'UPDATE users SET username = ?, email = ?, phone = ?, role = ?';
  const params = [username, email, phone, role];

  if (newPassword) { // Only update password if newPassword is provided
    sql += ', password = ?';
    params.push(newPassword);
  }
  sql += ' WHERE iduser = ?';
  params.push(id);

  db.query(sql, params, (err, result) => {
    if (err) {
      console.error('❌ Error updating staff:', err);
      return res.status(500).json({ error: 'ไม่สามารถอัปเดตข้อมูลพนักงานได้' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'ไม่พบพนักงานที่ต้องการอัปเดต' });
    }
    res.json({ message: 'อัปเดตข้อมูลพนักงานสำเร็จ', iduser: id });
  });
});

// Staff API - Delete staff by ID (DELETE request)
app.delete('/api/staff/:id', (req, res) => {
  const { id } = req.params;
  const sql = 'DELETE FROM users WHERE iduser = ?';
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error('❌ Error deleting staff:', err);
      return res.status(500).json({ error: 'ไม่สามารถลบพนักงานได้' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'ไม่พบพนักงานที่ต้องการลบ' });
    }
    res.json({ message: 'ลบพนักงานสำเร็จ', iduser: id });
  });
});


// --- Server listening starts here ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
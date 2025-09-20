const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // รองรับ JSON ขนาดใหญ่ (base64)

// ============================
// Database Connection
// ============================
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'your_database',
  port: process.env.DB_PORT || 3306
});

db.connect((err) => {
  if (err) {
    console.error('❌ Database connection failed:', err);
  } else {
    console.log('✅ Connected to MySQL database');
  }
});

// ============================
// Helper: Convert buffer -> base64 string
// ============================
const bufferToBase64 = (buffer) => {
  if (!buffer) return null;
  return buffer.toString('base64');
};

// ============================
// Login API
// ============================
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
        role: user.role,
        phone: user.phone || null,
        email: user.email,
        first_name: user.first_name || null,
        last_name: user.last_name || null,
        nickname: user.nickname || null,
        image: bufferToBase64(user.image) // ส่งออกเป็น base64
      }
    });
  });
});

// ============================
// Get User by ID
// ============================
app.get('/api/user/:id', (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT id, username, role, phone, email, first_name, last_name, nickname, image 
    FROM users 
    WHERE id = ?`;
  db.query(sql, [id], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    if (result.length === 0) return res.status(404).json({ message: 'User not found' });

    const user = result[0];
    user.image = bufferToBase64(user.image);

    res.json(user);
  });
});

// ============================
// Staff API - Get all staff
// ============================
app.get('/api/staff', (req, res) => {
  const sql = `
    SELECT iduser, username, role, phone, email, first_name, last_name, nickname, image 
    FROM users`;
  db.query(sql, (err, result) => {
    if (err) {
      console.error('❌ Error fetching staff:', err);
      return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
    }

    const staff = result.map(user => ({
      ...user,
      image: bufferToBase64(user.image)
    }));

    res.json(staff);
  });
});

// ============================
// Staff API - Add new staff
// ============================
app.post('/api/staff', (req, res) => {
  const { username, email, password, phone, role, first_name, last_name, nickname, image } = req.body;

  // ถ้ามีรูป ส่งมาเป็น base64 แล้วแปลงเป็น Buffer ก่อนเก็บ
  const imageBuffer = image ? Buffer.from(image, 'base64') : null;

  const sql = `
    INSERT INTO users (username, email, password, phone, role, first_name, last_name, nickname, image) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  db.query(sql, [username, email, password, phone, role, first_name || null, last_name || null, nickname || null, imageBuffer], (err, result) => {
    if (err) {
      console.error('❌ Error adding staff:', err);
      return res.status(500).json({ error: 'ไม่สามารถเพิ่มพนักงานได้' });
    }
    res.status(201).json({ 
      iduser: result.insertId, 
      username, 
      email, 
      phone, 
      role, 
      first_name, 
      last_name, 
      nickname,
      image: image || null
    });
  });
});

// ============================
// Staff API - Update staff by ID
// ============================
app.put('/api/staff/:id', (req, res) => {
  const { id } = req.params;
  const { username, email, phone, role, first_name, last_name, nickname, image, newPassword } = req.body;

  let sql = `
    UPDATE users 
    SET username = ?, email = ?, phone = ?, role = ?, first_name = ?, last_name = ?, nickname = ?, image = ?`;

  const params = [username, email, phone, role, first_name, last_name, nickname, image ? Buffer.from(image, 'base64') : null];

  if (newPassword) {
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

// ============================
// Start Server
// ============================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// ============================
// Staff API - Delete staff by ID
// ============================
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
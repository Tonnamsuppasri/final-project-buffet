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
        res.json({ success: true, message: 'Login successful' });
    });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
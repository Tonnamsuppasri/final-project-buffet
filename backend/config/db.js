const mysql = require('mysql2');
require('dotenv').config();

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'myappdb',
  port: process.env.DB_PORT || 3306
}).promise();

db.query('SELECT 1')
  .then(() => console.log('✅ Connected to MySQL database (using connection pool)'))
  .catch((err) => console.error('❌ Database connection failed:', err));

module.exports = db;

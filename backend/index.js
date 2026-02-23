const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const app = express();
const bcrypt = require('bcrypt');
const saltRounds = 10;
const { format } = require('date-fns');
const { th } = require('date-fns/locale');

const http = require('http');
const { Server } = require("socket.io");

const frontendUrl = process.env.FRONTEND_URL;
// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'http://192.168.0.101:5173',
  'http://10.226.247.45:5173',
  frontendUrl,
  // 'http://[YOUR_HOTSPOT_IP]:5173' 
];

const corsOptions = {
  origin: function (origin, callback) {
    // อนุญาต request ที่ไม่มี origin (เช่น mobile apps หรือ curl) หรืออยู่ใน allowedOrigins
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('http://192.168.')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-User-Id'],
};

const server = http.createServer(app);
const io = new Server(server, {
  cors: corsOptions
});

app.options(/.*/, cors(corsOptions));
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// ============================
// Database Connection
// ============================
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

// ============================
// SOCKET.IO CONNECTION HANDLER
// ============================
const orderSessionCache = new Map();
io.on('connection', (socket) => {
  console.log(`✅ User connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`❌ User disconnected: ${socket.id}`);
  });
  socket.on('call_for_bill', (data) => {
    console.log(`🚀 Table ${data.tableNumber} (ID: ${data.tableId}) is calling for the bill!`);
    io.emit('notification', {
      message: `โต๊ะ ${data.tableNumber} เรียกเก็บเงิน!`,
      type: 'call_bill',
      linkTo: '/PaymentPage'
    });
  });
});

// ============================
// Helper: Convert buffer -> base64 string
// ============================
const bufferToBase64 = (buffer) => {
  if (!buffer) return null;
  return buffer.toString('base64');
};

// ============================
// 🛡️ SECURITY MIDDLEWARES (NEW)
// ============================

// 1. ตรวจสอบว่า User Login หรือยัง (เช็ค x-user-id)
const requireAuth = async (req, res, next) => {
  const userIdFromHeader = req.headers['x-user-id'];
  if (!userIdFromHeader) {
    return res.status(401).json({ error: 'Authentication required (Missing User ID)' });
  }
  const userId = parseInt(userIdFromHeader, 10);
  if (isNaN(userId)) {
    return res.status(401).json({ error: 'Authentication required (Invalid User ID)' });
  }

  try {
    // ดึงข้อมูล User และ Permissions ล่าสุดจาก DB เสมอ
    const sqlGetUser = "SELECT id, role, permissions FROM users WHERE id = ?";
    const [users] = await db.query(sqlGetUser, [userId]);

    if (users.length === 0) {
      return res.status(401).json({ error: 'User not found or invalid' });
    }
    const user = users[0];

    // แปลง permissions เป็น Array
    if (user.permissions) {
      user.permissions = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
    } else {
      user.permissions = [];
    }

    req.user = user; // ฝัง user object เข้าไปใน request เพื่อใช้ใน middleware ถัดไป
    next();

  } catch (dbError) {
    console.error("Authentication error:", dbError);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

// 2. ตรวจสอบสิทธิเฉพาะ (Permission Check)
const checkPermission = (requiredPermission) => {
  return (req, res, next) => {
    // Admin ผ่านตลอด
    if (req.user.role === 'Admin') return next();

    // เช็คว่ามี permission ที่ต้องการไหม
    if (req.user.permissions && req.user.permissions.includes(requiredPermission)) {
      return next();
    }

    // ถ้าไม่มีสิทธิ
    return res.status(403).json({ error: `Permission denied: Requires '${requiredPermission}'` });
  };
};

// 3. ตรวจสอบว่าเป็น Admin เท่านั้น
const requireAdmin = (req, res, next) => {
  if (req.user.role === 'Admin') {
    return next();
  }
  return res.status(403).json({ error: 'Admin permission required' });
};

// ============================
// SHOP API
// ============================
// Public: ดึงข้อมูลร้าน (สำหรับแสดงผลหน้า Login/Welcome)
app.get('/api/shop', async (req, res) => {
  try {
    const sql = "SELECT shop_name, shop_address, shop_phone, open_time, close_time, payment_qr_code, shop_logo FROM shop WHERE id = 1";
    const [result] = await db.query(sql);
    if (result.length === 0) return res.status(404).json({ message: 'Shop info not found' });
    const shopData = result[0];
    shopData.payment_qr_code = bufferToBase64(shopData.payment_qr_code);
    shopData.shop_logo = bufferToBase64(shopData.shop_logo);
    res.json(shopData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Protected: แก้ไขข้อมูลร้าน (ต้องมีสิทธิ manage_settings)
app.put('/api/shop', requireAuth, checkPermission('manage_settings'), async (req, res) => {
  try {
    const { shop_name, shop_address, shop_phone, open_time, close_time, payment_qr_code, shop_logo } = req.body;
    let sql = `UPDATE shop SET shop_name = ?, shop_address = ?, shop_phone = ?, open_time = ?, close_time = ?`;
    let params = [shop_name, shop_address, shop_phone, open_time, close_time];
    if (payment_qr_code) {
      const qrCodeBuffer = Buffer.from(payment_qr_code, 'base64');
      sql += ', payment_qr_code = ?';
      params.push(qrCodeBuffer);
    }
    if (shop_logo) {
      const logoBuffer = Buffer.from(shop_logo, 'base64');
      sql += ', shop_logo = ?';
      params.push(logoBuffer);
    }
    sql += ' WHERE id = 1';
    await db.query(sql, params);
    console.log('🚀 Emitting shop_updated');
    io.emit('shop_updated');
    res.json({ message: 'Shop info updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================
// Login API (Public)
// ============================
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const sqlUser = 'SELECT id, username, role, image, permissions, password, phone, email, first_name, last_name, nickname FROM users WHERE username = ?';
    const [users] = await db.query(sqlUser, [username]); 
    
    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Username not found' });
    }
    const user = users[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Incorrect password' });
    }

    let userPermissions = [];
    if (user.permissions) {
        userPermissions = typeof user.permissions === 'string' 
            ? JSON.parse(user.permissions) 
            : user.permissions;
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
        permissions: userPermissions,
        image: bufferToBase64(user.image)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ============================
// Staff & User API
// ============================

// Protected: ดูโปรไฟล์ตัวเอง (ใครก็ได้ที่ Login)
app.get('/api/user/:id', requireAuth, async (req, res) => { 
  const { id } = req.params;
  try { 
    const sql = `SELECT id, username, role, phone, email, first_name, last_name, nickname, image, permissions FROM users WHERE id = ?`;
    const [result] = await db.query(sql, [id]); 
    if (result.length === 0) return res.status(404).json({ message: 'User not found' });
    
    const user = result[0];
    user.image = bufferToBase64(user.image);

    if (user.permissions) {
        user.permissions = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
    } else {
        user.permissions = [];
    }

    res.json(user);
  } catch (err) { 
    res.status(500).json({ error: err.message });
  }
});

// Protected: Admin เท่านั้นที่ดูข้อมูล Staff ทั้งหมดได้
app.get('/api/staff', requireAuth, requireAdmin, async (req, res) => {
  try {
    const sql = `SELECT id, username, role, phone, email, first_name, last_name, nickname, image FROM users`;
    const [result] = await db.query(sql);
    const staff = result.map(user => ({ ...user, image: bufferToBase64(user.image) }));
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching staff data' });
  }
});

// Protected: Admin เท่านั้นที่ดึง permission ของคนอื่นได้
app.get('/api/users-permissions', requireAuth, requireAdmin, async (req, res) => {
    try {
      const sql = "SELECT id, username, role, permissions FROM users WHERE role != 'Admin' ORDER BY username ASC";
      const [users] = await db.query(sql);
      
      const formattedUsers = users.map(u => ({
        ...u,
        permissions: u.permissions ? (typeof u.permissions === 'string' ? JSON.parse(u.permissions) : u.permissions) : []
      }));
  
      res.json(formattedUsers);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error fetching users permissions' });
    }
});

// Protected: Admin เท่านั้นที่แก้ permission ได้
app.put('/api/users/:id/permissions', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { permissions } = req.body; 

  try {
    const sql = "UPDATE users SET permissions = ? WHERE id = ?";
    await db.query(sql, [JSON.stringify(permissions), id]);

    console.log(`🚀 Emitting permissions_updated for User ID: ${id}`);
    io.emit('permissions_updated', { 
        userId: Number(id), 
        permissions: permissions 
    });

    res.json({ message: 'Permissions updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error updating permissions' });
  }
});

// Protected: Admin เท่านั้นที่เพิ่มพนักงาน
app.post('/api/staff', requireAuth, requireAdmin, async (req, res) => {
  const { username, email, password, phone, role, first_name, last_name, nickname, image } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const imageBuffer = image ? Buffer.from(image, 'base64') : null;
    const sql = `INSERT INTO users (username, email, password, phone, role, first_name, last_name, nickname, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const [result] = await db.query(sql, [username, email, hashedPassword, phone, role, first_name, last_name, nickname, imageBuffer]);
    console.log('🚀 Emitting staff_updated');
    io.emit('staff_updated');
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: "Server error during password hashing or insertion." });
  }
});

// Protected: Admin เท่านั้นที่แก้ไขพนักงาน
app.put('/api/staff/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { username, email, phone, role, first_name, last_name, nickname, image, newPassword } = req.body;
  try {
    let params = [username, email, phone, role, first_name, last_name, nickname, image ? Buffer.from(image, 'base64') : null];
    let sql = `UPDATE users SET username = ?, email = ?, phone = ?, role = ?, first_name = ?, last_name = ?, nickname = ?, image = ?`;

    if (newPassword) {
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
      sql += `, password = ?`;
      params.push(hashedPassword);
    }

    sql += ` WHERE id = ?`;
    params.push(id);

    const [result] = await db.query(sql, params);

    if (result.affectedRows === 0) return res.status(404).json({ message: 'Staff member not found' });

    console.log('🚀 Emitting staff_updated');
    io.emit('staff_updated');
    res.json({ message: 'Staff member updated successfully', id: id });
  } catch (error) {
    res.status(500).json({ error: 'Could not update staff member' });
  }
});

// Protected: Admin เท่านั้นที่ลบพนักงาน
app.delete('/api/staff/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const sql = 'DELETE FROM users WHERE id = ?';
    const [result] = await db.query(sql, [id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Staff member not found' });
    console.log('🚀 Emitting staff_updated');
    io.emit('staff_updated');
    res.json({ message: 'Staff member deleted successfully', id: id });
  } catch (err) {
    res.status(500).json({ error: 'Could not delete staff member' });
  }
});

// ============================
// MENU API
// ============================
// Public: ดึงเมนู (ลูกค้าต้องเห็น)
app.get('/api/menu', async (req, res) => {
  try {
    const sql = "SELECT * FROM menu ORDER BY menu_category, menu_name";
    const [results] = await db.query(sql);
    const menuWithImages = results.map(item => ({
      ...item,
      menu_image: bufferToBase64(item.menu_image)
    }));
    res.json(menuWithImages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Protected: เพิ่มเมนู (manage_settings)
app.post('/api/menu', requireAuth, checkPermission('manage_settings'), async (req, res) => {
  try {
    const { menu_name, menu_description, menu_category, price, menu_quantity, menu_image } = req.body;
    const imageBuffer = menu_image ? Buffer.from(menu_image, 'base64') : null;
    const sql = "INSERT INTO menu (menu_name, menu_description, menu_category, price, menu_quantity, menu_image) VALUES (?, ?, ?, ?, ?, ?)";
    const [result] = await db.query(sql, [menu_name, menu_description || null, menu_category || null, price, menu_quantity || 0, imageBuffer]);
    console.log('🚀 Emitting menu_updated');
    io.emit('menu_updated');
    res.status(201).json({ message: 'Menu item added successfully', menu_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Protected: แก้ไขเมนู (manage_settings)
app.put('/api/menu/:id', requireAuth, checkPermission('manage_settings'), async (req, res) => {
  const { id } = req.params;
  const { menu_name, menu_description, menu_category, price, menu_quantity, menu_image } = req.body;
  const imageBuffer = menu_image ? Buffer.from(menu_image, 'base64') : null;

  try {
    let currentQuantity = null;
    const [menuResult] = await db.query("SELECT menu_quantity FROM menu WHERE menu_id = ?", [id]);
    if (menuResult.length > 0) {
      currentQuantity = menuResult[0].menu_quantity;
    } else {
      return res.status(404).json({ message: 'Menu item not found' });
    }

    const sqlUpdate = "UPDATE menu SET menu_name = ?, menu_description = ?, menu_category = ?, price = ?, menu_quantity = ?, menu_image = ? WHERE menu_id = ?";
    const paramsUpdate = [
      menu_name,
      menu_description || null,
      menu_category || null,
      price,
      menu_quantity === null || menu_quantity === '' ? null : Number(menu_quantity),
      imageBuffer,
      id
    ];

    const [resultUpdate] = await db.query(sqlUpdate, paramsUpdate);
    if (resultUpdate.affectedRows === 0) return res.status(404).json({ message: 'Menu item not found for update' });

    const newQuantityDb = menu_quantity === null || menu_quantity === '' ? null : Number(menu_quantity);
    if (newQuantityDb !== null && currentQuantity !== newQuantityDb) {
      const changeQuantity = (currentQuantity === null ? 0 : currentQuantity) - newQuantityDb;
      const logSql = "INSERT INTO stock_logs (menu_id, change_quantity, new_quantity, reason, user_id, timestamp) VALUES (?, ?, ?, ?, ?, NOW())";
      const adminUserId = req.user?.id || null;
      await db.query(logSql, [id, changeQuantity * -1, newQuantityDb, 'adjustment', adminUserId]);
      console.log(`Stock log created for menu ${id}. Change: ${changeQuantity * -1}, New Qty: ${newQuantityDb}`);
    }

    console.log('🚀 Emitting menu_updated');
    io.emit('menu_updated');
    res.json({ message: 'Menu item updated successfully' });
  } catch (err) {
    console.error("Error updating menu:", err);
    res.status(500).json({ error: err.message });
  }
});

// Protected: ลบเมนู (manage_settings)
app.delete('/api/menu/:id', requireAuth, checkPermission('manage_settings'), async (req, res) => {
  try {
    const { id } = req.params;
    const sql = "DELETE FROM menu WHERE menu_id = ?";
    const [result] = await db.query(sql, [id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Menu item not found' });
    console.log('🚀 Emitting menu_updated');
    io.emit('menu_updated');
    res.json({ message: 'Menu item deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================
// ORDERS API (Dynamic QR Code)
// ============================

// Public: สร้าง Order (สแกน QR Code)
app.post('/api/orders', async (req, res) => {
  const { table_id, customer_quantity, plan_id, service_type } = req.body;
  const order_uuid = uuidv4();

  try {
    const sql = `INSERT INTO orders (table_id, customer_quantity, plan_id, service_type, start_time, order_status, order_uuid) VALUES (?, ?, ?, ?, NOW(), 'in-progress', ?)`;
    const [result] = await db.query(sql, [table_id, customer_quantity, plan_id, service_type, order_uuid]);

    const updateTableSql = "UPDATE tables SET status = 'ไม่ว่าง' WHERE table_id = ?";
    await db.query(updateTableSql, [table_id]);

    console.log('🚀 Emitting tables_updated (new order)');
    io.emit('tables_updated');

    const getTableSql = "SELECT table_number FROM tables WHERE table_id = ?";
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
app.get('/api/orders/active', requireAuth, async (req, res) => {
  try {
    const sql = `
            SELECT
                o.order_id, o.customer_quantity, o.service_type, o.start_time,
                o.order_status, o.order_uuid, 
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
app.get('/api/order-session/:order_uuid', async (req, res) => {
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
      return res.status(404).json({ error: "ไม่พบออเดอร์สำหรับโต๊ะนี้ หรือโต๊ะถูกปิดไปแล้ว" });
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

    const menuWithImages = menuResult.map(item => ({
      ...item,
      menu_image: bufferToBase64(item.menu_image)
    }));

    const shopSql = "SELECT shop_name, shop_logo FROM shop WHERE id = 1";
    const [shopResult] = await db.query(shopSql);
    const shopInfo = shopResult.length > 0 ? {
      ...shopResult[0],
      shop_logo: bufferToBase64(shopResult[0].shop_logo)
    } : null;

    res.json({
      orderInfo: orderResult[0],
      menu: menuWithImages,
      shopInfo: shopInfo
    });

  } catch (err) {
    console.error("Error fetching order session:", err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Public: สั่งอาหารเพิ่ม (ลูกค้า)
app.post('/api/orders/:orderId/details', async (req, res) => {
  const { orderId } = req.params;
  const orderDetails = req.body;
  if (!Array.isArray(orderDetails) || orderDetails.length === 0) return res.status(400).json({ error: 'Invalid data' });

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // 1. ตรวจสอบสต็อกสำหรับทุกเมนูที่สั่ง
    // 1. ตรวจสอบสต็อกสำหรับทุกเมนูที่สั่ง
    const menuIds = orderDetails.map(item => item.menu_id);

    // ดึงสต็อกจริงจากตาราง menu
    const [stockResults] = await connection.query(
      "SELECT menu_id, menu_name, menu_quantity FROM menu WHERE menu_id IN (?) FOR UPDATE", 
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
      const menu = stockResults.find(m => m.menu_id === item.menu_id);
      if (!menu) throw new Error(`ไม่พบเมนู ID: ${item.menu_id}`);

      if (menu.menu_quantity !== null) {
        // หายอดที่ถูกจองไว้แล้ว (pending) ของเมนูนี้
        const pending = pendingResults.find(p => p.menu_id === item.menu_id);
        const pendingQty = pending ? Number(pending.pending_quantity) : 0;

        // สต็อกที่เหลือจริงๆ = สต็อกในมือ - ที่จองไว้แล้ว
        const availableQty = menu.menu_quantity - pendingQty;

        if (availableQty < item.quantity) {
          throw new Error(`วัตถุดิบหมด: ${menu.menu_name} (คงเหลือ ${availableQty} จาก ${menu.menu_quantity})`);
        }
      }
    }

    // 2. ถ้าผ่าน ให้บันทึกรายการ
    const values = orderDetails.map(item => [
      orderId, item.menu_id, item.quantity, item.price_per_item, 'กำลังจัดทำ', item.customer_name || null
    ]);
    await connection.query("INSERT INTO order_details (order_id, menu_id, quantity, price_per_item, item_status, customer_name) VALUES ?", [values]);

    await connection.commit();
    
    // แจ้งเตือน Socket
    io.emit('new_order_item', { orderId: orderId, items: orderDetails });

    // ดึงเลขโต๊ะแล้วส่ง Toast แจ้งพนักงาน
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
    console.error("Order Detail Error:", err.message);
    return res.status(400).json({ error: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Public/Protected: ดูรายการที่สั่ง (ลูกค้าดูได้ / พนักงานดูได้)
app.get('/api/orders/:orderId/details', async (req, res) => {
  const { orderId } = req.params;
  try {
    const sql = `
            SELECT
                od.order_detail_id, od.quantity, od.item_status, od.created_at,
                od.price_per_item, od.customer_name, 
                m.menu_name, m.menu_image
            FROM order_details od
            LEFT JOIN menu m ON od.menu_id = m.menu_id
            WHERE od.order_id = ?
            ORDER BY od.created_at DESC
        `;
    const [results] = await db.query(sql, [orderId]);
    const detailsWithImages = results.map(item => ({
      ...item,
      menu_image: bufferToBase64(item.menu_image)
    }));
    res.json(detailsWithImages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public: เข้าร่วมโต๊ะ (Join Table)
app.post('/api/orders/:orderId/join', async (req, res) => {
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

    const [results] = await connection.query("SELECT customer_join_count FROM orders WHERE order_id = ? FOR UPDATE", [orderId]);

    if (results.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ message: 'Order not found' });
    }

    const currentCount = results[0].customer_join_count;
    const newCount = currentCount + 1;
    const customerLetter = String.fromCharCode(64 + newCount);
    const customerName = `ลูกค้า ${customerLetter}`;

    await connection.query("UPDATE orders SET customer_join_count = ? WHERE order_id = ?", [newCount, orderId]);

    await connection.commit();

    orderSessionCache.set(mapKey, customerName);
    io.emit('tables_updated');
    res.json({ customerName: customerName });

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
app.put('/api/order-details/:detailId/deliver', requireAuth, async (req, res) => {
  try {
    const { detailId } = req.params;
    const sql = "UPDATE order_details SET item_status = 'จัดส่งแล้ว' WHERE order_detail_id = ?";
    const [result] = await db.query(sql, [detailId]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Order detail item not found' });

    console.log(`🚀 Emitting item_status_updated for detail ${detailId}`);
    io.emit('item_status_updated', { detailId: detailId, newStatus: 'จัดส่งแล้ว' });
    res.json({ message: 'Item status updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Protected: ยกเลิกออเดอร์ (พนักงาน)
app.delete('/api/orders/:orderId', requireAuth, async (req, res) => {
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

    const [maxIdResult] = await connection.query("SELECT MAX(order_id) as max_id FROM orders");
    const isMaxId = (maxIdResult[0].max_id == orderId);

    await connection.query("DELETE FROM order_details WHERE order_id = ?", [orderId]);
    const [deleteResult] = await connection.query("DELETE FROM orders WHERE order_id = ?", [orderId]);

    if (deleteResult.affectedRows === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ message: 'Order not found for deletion' });
    }

    let message = 'Order cancelled and table status updated successfully';
    if (isMaxId) {
      const [newMaxResult] = await connection.query("SELECT COALESCE(MAX(order_id), 0) + 1 as next_id FROM orders");
      const nextId = newMaxResult[0].next_id;
      const resetId = Math.max(1, nextId);
      await connection.query(`ALTER TABLE orders AUTO_INCREMENT = ?`, [resetId]);
      console.log(`🚀 AUTO_INCREMENT reset to ${resetId}`);
      message = 'Order cancelled, table status updated, and AUTO_INCREMENT reset.';
    }

    await connection.query("UPDATE tables SET status = 'ว่าง' WHERE table_id = ?", [tableId]);

    await connection.commit();
    connection.release();

    console.log('🚀 Emitting tables_updated (order cancelled)');
    io.emit('tables_updated');
    res.json({ message: message });

  } catch (err) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error("Error deleting order:", err);
    res.status(500).json({ error: 'Could not delete order' });
  }
});

// ============================
// PAYMENT API
// ============================
// Protected: ชำระเงิน (พนักงานดำเนินการ)
app.post('/api/payment', requireAuth, async (req, res) => {
  const { order_id, payment_method, discount, promotion_id } = req.body; 
  // หมายเหตุ: เราจะไม่รับ final_price_client มาใช้คำนวณ แต่จะคิดเอง

  if (!order_id) return res.status(400).json({ error: 'Missing order_id' });

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // 1. ดึงข้อมูลออเดอร์เพื่อคำนวณบุฟเฟต์
    const [orderRes] = await connection.query(
      `SELECT o.customer_quantity, pp.price_per_person 
       FROM orders o LEFT JOIN pricing_plans pp ON o.plan_id = pp.id 
       WHERE o.order_id = ?`, 
      [order_id]
    );
    if (orderRes.length === 0) throw new Error('Order not found');
    
    const { customer_quantity, price_per_person } = orderRes[0];
    const buffetTotal = customer_quantity * (price_per_person || 0);

    // 2. ดึงข้อมูลรายการสั่งเพิ่ม (A La Carte) เพื่อคำนวณ
    const [alaCarteRes] = await connection.query(
      `SELECT SUM(quantity * price_per_item) AS total 
       FROM order_details WHERE order_id = ? AND price_per_item > 0`,
      [order_id]
    );
    const alaCarteTotal = Number(alaCarteRes[0].total || 0);

    // 3. รวมยอด
    const rawTotal = buffetTotal + alaCarteTotal;
    
    // 4. คำนวณส่วนลด (Server Side Logic) - เพื่อความปลอดภัยสูงสุดควรดึง promotion_id มาเช็คเงื่อนไขที่นี่
    // (ในตัวอย่างนี้เชื่อค่า discount ที่ส่งมา แต่ตรวจสอบไม่ให้เกินยอดรวม)
    const validDiscount = Math.min(Number(discount || 0), rawTotal); 
    const finalPayAmount = rawTotal - validDiscount;

    // 5. บันทึกการชำระเงิน
    const [payRes] = await connection.query(
      `INSERT INTO payment (order_id, payment_time, total_price, payment_method, discount, promotion_id) 
       VALUES (?, NOW(), ?, ?, ?, ?)`,
      [order_id, finalPayAmount, payment_method, validDiscount, promotion_id || null]
    );
    const paymentId = payRes.insertId;

    // 6. ตัดสต็อก (Optimized Loop)
    // ดึงรายการที่ต้องตัดสต็อก
    const [itemsToDeduct] = await connection.query(
      `SELECT od.menu_id, SUM(od.quantity) as total_qty 
       FROM order_details od JOIN menu m ON od.menu_id = m.menu_id 
       WHERE od.order_id = ? AND m.menu_quantity IS NOT NULL 
       GROUP BY od.menu_id`,
      [order_id]
    );

    if (itemsToDeduct.length > 0) {
        // ใช้ Loop ธรรมดา (for...of) แทน Promise.all เพื่อป้องกัน Database ล่ม
        for (const item of itemsToDeduct) {
            // 6.1 ตัดสต็อก
            await connection.query(
                "UPDATE menu SET menu_quantity = menu_quantity - ? WHERE menu_id = ?",
                [item.total_qty, item.menu_id]
            );

            // 6.2 (เพิ่ม) ดึงค่าจำนวนล่าสุดออกมา เพื่อเอาไปบันทึก Log (แก้ปัญหา 500 Error เรื่อง new_quantity)
            const [updatedMenu] = await connection.query(
                "SELECT menu_quantity FROM menu WHERE menu_id = ?", 
                [item.menu_id]
            );
            const currentQty = updatedMenu[0]?.menu_quantity || 0;

            // 6.3 บันทึก Log (เพิ่ม new_quantity เข้าไปให้เหมือนกับตอนแก้เมนู)
            await connection.query(
                "INSERT INTO stock_logs (menu_id, change_quantity, new_quantity, reason, user_id, timestamp) VALUES (?, ?, ?, ?, ?, NOW())",
                [
                    item.menu_id, 
                    -item.total_qty, 
                    currentQty, // ✅ ใส่ค่า new_quantity
                    'sale', 
                    req.user ? req.user.id : null // ✅ กัน Error กรณีไม่มี user id ให้ใส่ null แทน
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
    console.error("Payment Error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Protected: ดูรายละเอียดการชำระเงิน (พนักงาน)
app.get('/api/payments/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const paymentDetailsSql = `
            SELECT
                p.payment_id, p.order_id, p.payment_time, p.total_price, p.payment_method,
                o.customer_quantity, o.service_type, o.start_time,
                t.table_number, pp.plan_name
            FROM payment p
            JOIN orders o ON p.order_id = o.order_id
            JOIN tables t ON o.table_id = t.table_id
            LEFT JOIN pricing_plans pp ON o.plan_id = pp.id
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
    console.error("Error fetching payment details:", err);
    return res.status(500).json({ error: 'Error fetching payment details' });
  }
});

// Protected: ดูรายการชำระเงินทั้งหมด (พนักงาน)
app.get('/api/payments', requireAuth, async (req, res) => {
  const { searchTerm, startDate, endDate } = req.query;
  try {
    let sql = `
            SELECT p.payment_id, p.order_id, p.payment_time, p.total_price, p.payment_method, 
                   p.discount, p.promotion_id,
                   t.table_number, o.customer_quantity,
                   pp.plan_name, pp.price_per_person
            FROM payment p
            JOIN orders o ON p.order_id = o.order_id
            JOIN tables t ON o.table_id = t.table_id
            LEFT JOIN pricing_plans pp ON o.plan_id = pp.id
            WHERE 1=1
        `;
    const params = [];

    if (searchTerm) {
      sql += ` AND (p.payment_id = ? OR t.table_number LIKE ? OR p.payment_method LIKE ? OR p.total_price LIKE ?)`;
      params.push(searchTerm, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
    }
    if (startDate) {
      sql += ` AND DATE(p.payment_time) >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      sql += ` AND DATE(p.payment_time) <= ?`;
      params.push(endDate);
    }

    sql += ` ORDER BY p.payment_time DESC`;

    const [results] = await db.query(sql, params);
    res.json(results);

  } catch (err) {
    console.error("Error fetching payments:", err);
    res.status(500).json({ error: 'Error fetching payment data' });
  }
});

// ==========================================
// REPORTS API (Protected: view_reports)
// ==========================================
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

app.get('/api/reports/overview/stats', requireAuth, checkPermission('view_reports'), async (req, res) => {
  const [startDate, endDate] = getDates(req);
  const sql = "SELECT " +
    "COALESCE(SUM(p.total_price), 0) AS totalSales, " +
    "COALESCE(COUNT(p.payment_id), 0) AS totalOrders, " +
    "COALESCE(SUM(o.customer_quantity), 0) AS totalCustomers, " +
    "COALESCE(SUM(p.total_price) / NULLIF(SUM(o.customer_quantity), 0), 0) AS avgPerCustomer " +
    "FROM payment p " +
    "JOIN orders o ON p.order_id = o.order_id " +
    "WHERE p.payment_time BETWEEN ? AND ?;";

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
    console.error("Error fetching overview stats:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/overview/service-types', requireAuth, checkPermission('view_reports'), async (req, res) => {
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
    console.error("Error fetching service type summary:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/overview/payment-methods', requireAuth, checkPermission('view_reports'), async (req, res) => {
  const [startDate, endDate] = getDates(req);
  const sql = "SELECT " +
    "payment_method AS method, " +
    "SUM(total_price) AS total " +
    "FROM payment " +
    "WHERE payment_time BETWEEN ? AND ? AND payment_method IS NOT NULL " +
    "GROUP BY payment_method " +
    "HAVING total > 0;";

  try {
    const [results] = await db.query(sql, [startDate, endDate]);
    res.json(results);
  } catch (err) {
    console.error("Error fetching payment methods:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/overview/plan-popularity', requireAuth, checkPermission('view_reports'), async (req, res) => {
  const [startDate, endDate] = getDates(req);
  const sql = "SELECT " +
    "COALESCE(pp.plan_name, 'A La Carte / อื่นๆ') AS plan_name, " +
    "SUM(o.customer_quantity) AS count " +
    "FROM orders o " +
    "JOIN payment p ON o.order_id = p.order_id " +
    "LEFT JOIN pricing_plans pp ON o.plan_id = pp.id " +
    "WHERE p.payment_time BETWEEN ? AND ? " +
    "GROUP BY pp.id, pp.plan_name " +
    "ORDER BY count DESC;";

  try {
    const [results] = await db.query(sql, [startDate, endDate]);
    res.json(results);
  } catch (err) {
    console.error("Error fetching plan popularity:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/sales', requireAuth, checkPermission('view_reports'), async (req, res) => {
  const [startDate, endDate] = getDates(req);
  try {
    const summarySql = "SELECT " +
      "COALESCE(SUM(total_price), 0) AS totalSales, " +
      "COALESCE(COUNT(payment_id), 0) AS totalOrders, " +
      "COALESCE(SUM(total_price) / NULLIF(COUNT(payment_id), 0), 0) AS avgOrderValue " +
      "FROM payment " +
      "WHERE payment_time BETWEEN ? AND ?;";

    const [summaryResult] = await db.query(summarySql, [startDate, endDate]);

    const dailySalesSql = "SELECT " +
      "DATE(payment_time) AS date, " +
      "SUM(total_price) AS total " +
      "FROM payment " +
      "WHERE payment_time BETWEEN ? AND ? " +
      "GROUP BY DATE(payment_time) " +
      "ORDER BY date ASC;";

    const [dailySales] = await db.query(dailySalesSql, [startDate, endDate]);

    const paymentDetailsSql = "SELECT " +
      "p.payment_id, p.order_id, p.payment_time, p.total_price, p.payment_method, " +
      "t.table_number, o.customer_quantity " +
      "FROM payment p " +
      "JOIN orders o ON p.order_id = o.order_id " +
      "JOIN tables t ON o.table_id = t.table_id " +
      "WHERE p.payment_time BETWEEN ? AND ? " +
      "ORDER BY p.payment_time DESC;";

    const [paymentDetails] = await db.query(paymentDetailsSql, [startDate, endDate]);

    res.json({
      summary: summaryResult[0] || { totalSales: 0, totalOrders: 0, avgOrderValue: 0 },
      dailySales,
      paymentDetails
    });
  } catch (err) {
    console.error("Error fetching sales report:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/menu/plans', requireAuth, checkPermission('view_reports'), async (req, res) => {
  const [startDate, endDate] = getDates(req);
  const sql = "SELECT " +
    "pp.id AS plan_id, " +
    "COALESCE(pp.plan_name, 'A La Carte / อื่นๆ') AS plan_name, " +
    "AVG(pp.price_per_person) AS price_per_person, " +
    "COUNT(o.order_id) AS total_orders, " +
    "SUM(o.customer_quantity) AS total_customers, " +
    "SUM(o.customer_quantity * COALESCE(pp.price_per_person, 0)) AS total_revenue " +
    "FROM orders o " +
    "JOIN payment p ON o.order_id = p.order_id " +
    "LEFT JOIN pricing_plans pp ON o.plan_id = pp.id " +
    "WHERE p.payment_time BETWEEN ? AND ? " +
    "GROUP BY pp.id, pp.plan_name " +
    "ORDER BY total_revenue DESC;";

  try {
    const [results] = await db.query(sql, [startDate, endDate]);
    const processedResults = results.map(row => ({
      ...row,
      price_per_person: row.price_per_person === null ? null : parseFloat(row.price_per_person),
      total_revenue: row.total_revenue === null ? null : parseFloat(row.total_revenue)
    }));
    res.json(processedResults);
  } catch (err) {
    console.error("[/api/reports/menu/plans] SQL Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/menu/items', requireAuth, checkPermission('view_reports'), async (req, res) => {
  const [startDate, endDate] = getDates(req);
  const sql = "SELECT " +
    "m.menu_id, m.menu_name AS name, m.menu_category AS category, " +
    "SUM(od.quantity) AS total_quantity, " +
    "SUM(od.quantity * od.price_per_item) AS total_revenue " +
    "FROM order_details od " +
    "JOIN menu m ON od.menu_id = m.menu_id " +
    "WHERE od.created_at BETWEEN ? AND ? " +
    "GROUP BY m.menu_id, m.menu_name, m.menu_category " +
    "ORDER BY total_quantity DESC;";

  try {
    const [results] = await db.query(sql, [startDate, endDate]);
    res.json(results);
  } catch (err) {
    console.error("[/api/reports/menu/items] SQL Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ============================
// TABLES API (Protected: manage_settings)
// ============================
// Public/Protected: ดูสถานะโต๊ะ (พนักงานทุกคนดูได้)
app.get('/api/tables', requireAuth, async (req, res) => {
  try {
    const sql = "SELECT * FROM tables ORDER BY table_number ASC";
    const [results] = await db.query(sql);
    res.json(results);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Public: ดูข้อมูลโต๊ะผ่าน UUID (ลูกค้าสแกน)
app.get('/api/tables/uuid/:uuid', async (req, res) => {
  const { uuid } = req.params;
  try {
    const sql = "SELECT table_id, table_number, seat_capacity, status, uuid FROM tables WHERE uuid = ?";
    const [results] = await db.query(sql, [uuid]);
    if (results.length === 0) {
      return res.status(404).json({ message: 'Table not found for this UUID' });
    }
    res.json(results[0]);
  } catch (err) {
    console.error("Error fetching table by UUID:", err);
    return res.status(500).json({ error: 'Database error' });
  }
});

// Protected: เพิ่มโต๊ะ (manage_settings)
app.post('/api/tables', requireAuth, checkPermission('manage_settings'), async (req, res) => {
  const { table_number, seat_capacity } = req.body;
  if (!table_number || seat_capacity === undefined || seat_capacity === null) {
    return res.status(400).json({ error: 'Missing table_number or seat_capacity' });
  }
  try {
    const newUuid = uuidv4();
    const sql = "INSERT INTO tables (uuid, table_number, seat_capacity, status) VALUES (?, ?, ?, 'ว่าง')";
    const [result] = await db.query(sql, [newUuid, table_number, seat_capacity]);
    console.log('🚀 Emitting tables_updated (new table added)');
    io.emit('tables_updated');
    res.status(201).json({ message: 'Table added successfully', table_id: result.insertId, uuid: newUuid, table_number, seat_capacity, status: 'ว่าง' });
  } catch (err) {
    console.error("Error adding table:", err);
    return res.status(500).json({ error: 'Error adding table' });
  }
});

// Protected: แก้ไขโต๊ะ (manage_settings)
app.put('/api/tables/:id', requireAuth, checkPermission('manage_settings'), async (req, res) => {
  const { id } = req.params;
  const { table_number, seat_capacity, status } = req.body;
  if (!table_number || seat_capacity === undefined || seat_capacity === null || !status) {
    return res.status(400).json({ error: 'Missing required table information' });
  }
  try {
    const sql = "UPDATE tables SET table_number = ?, seat_capacity = ?, status = ? WHERE table_id = ?";
    const [result] = await db.query(sql, [table_number, seat_capacity, status, id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Table not found' });
    console.log('🚀 Emitting tables_updated (table edited)');
    io.emit('tables_updated');
    res.json({ message: 'Table updated successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Protected: ลบโต๊ะ (manage_settings)
app.delete('/api/tables/:id', requireAuth, checkPermission('manage_settings'), async (req, res) => {
  const { id } = req.params;
  try {
    const checkOrdersSql = "SELECT COUNT(*) as orderCount FROM orders WHERE table_id = ? AND order_status = 'in-progress'";
    const [checkResult] = await db.query(checkOrdersSql, [id]);
    if (checkResult[0].orderCount > 0) {
      return res.status(400).json({ error: 'Cannot delete table with active orders' });
    }

    const sql = "DELETE FROM tables WHERE table_id = ?";
    const [result] = await db.query(sql, [id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Table not found' });

    console.log('🚀 Emitting tables_updated (table deleted)');
    io.emit('tables_updated');
    res.json({ message: 'Table deleted successfully' });
  } catch (err) {
    console.error("Error deleting table:", err);
    return res.status(500).json({ error: 'Could not delete table' });
  }
});

// ============================
// PROMOTIONS API (Protected: manage_settings)
// ============================
// Public/Protected: ดูโปรโมชั่น (ลูกค้าดูได้ / พนักงานดูได้)
app.get('/api/promotions', requireAuth, async (req, res) => {
  let sql = "SELECT * FROM promotions";
  const params = [];
  if (req.query.active === 'true') {
    sql += " WHERE is_active = 1";
  } else if (req.query.active === 'false') {
    sql += " WHERE is_active = 0";
  }
  sql += " ORDER BY end_date DESC, start_date DESC";

  try {
    const [results] = await db.query(sql, params);
    res.json(results);
  } catch (err) {
    console.error("Error fetching promotions:", err);
    return res.status(500).json({ error: 'Error fetching promotions data', details: err.message });
  }
});

app.get('/api/promotions/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const sql = "SELECT * FROM promotions WHERE promotion_id = ?";
  try {
    const [results] = await db.query(sql, [id]);
    if (results.length === 0) {
      return res.status(404).json({ message: 'Promotion not found' });
    }
    res.json(results[0]);
  } catch (err) {
    console.error(`Error fetching promotion ${id}:`, err);
    return res.status(500).json({ error: 'Error fetching promotion data', details: err.message });
  }
});

// Protected: สร้างโปรโมชั่น
app.post('/api/promotions', requireAuth, checkPermission('manage_settings'), async (req, res) => {
  const { name, description, type, value, code, start_date, end_date, conditions } = req.body;
  if (!name || !type || value === undefined || value === null || !start_date || !end_date) {
    return res.status(400).json({ error: 'Missing required promotion fields (name, type, value, start_date, end_date)' });
  }

  try {
    const sql = "INSERT INTO promotions (name, description, type, value, code, start_date, end_date, conditions, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)";
    const params = [
      name, description || null, type, value, code || null,
      start_date, end_date, conditions || null
    ];
    const [result] = await db.query(sql, params);
    res.status(201).json({ message: 'Promotion created successfully', promotion_id: result.insertId });
  } catch (err) {
    console.error("Error creating promotion:", err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Promotion code already exists' });
    }
    return res.status(500).json({ error: 'Could not create promotion', details: err.message });
  }
});

//
app.put('/api/plans/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { plan_name, price_per_person, description, menu_ids } = req.body;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. แก้เป็น pricing_plans
    await connection.query(
      "UPDATE pricing_plans SET plan_name = ?, price_per_person = ?, description = ? WHERE id = ?",
      [plan_name, price_per_person, description, id]
    );

    // 2. ลบเมนูเดิม
    await connection.query("DELETE FROM plan_menu_access WHERE plan_id = ?", [id]);

    // 3. เพิ่มเมนูใหม่
    if (menu_ids && menu_ids.length > 0) {
      const values = menu_ids.map(menuId => [id, menuId]);
      await connection.query(
        "INSERT INTO plan_menu_access (plan_id, menu_id) VALUES ?", 
        [values]
      );
    }

    await connection.commit();
    res.json({ message: 'Plan updated successfully' });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to update plan' });
  } finally {
    connection.release();
  }
});

// Protected: แก้ไขโปรโมชั่น
app.put('/api/promotions/:id', requireAuth, checkPermission('manage_settings'), async (req, res) => {
  const { id } = req.params;
  const { name, description, type, value, code, start_date, end_date, conditions } = req.body;
  if (!name || !type || value === undefined || value === null || !start_date || !end_date) {
    return res.status(400).json({ error: 'Missing required promotion fields (name, type, value, start_date, end_date)' });
  }

  try {
    const sql = "UPDATE promotions SET name = ?, description = ?, type = ?, value = ?, code = ?, start_date = ?, end_date = ?, conditions = ? WHERE promotion_id = ?";
    const params = [
      name, description || null, type, value, code || null,
      start_date, end_date, conditions || null, id
    ];
    const [result] = await db.query(sql, params);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Promotion not found' });
    }
    res.json({ message: 'Promotion updated successfully', promotion_id: id });
  } catch (err) {
    console.error(`Error updating promotion ${id}:`, err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Promotion code already exists' });
    }
    return res.status(500).json({ error: 'Could not update promotion', details: err.message });
  }
});

// Protected: เปิด/ปิด โปรโมชั่น
app.put('/api/promotions/:id/toggle', requireAuth, checkPermission('manage_settings'), async (req, res) => {
  const { id } = req.params;
  const sql = "UPDATE promotions SET is_active = NOT is_active WHERE promotion_id = ?";
  try {
    const [result] = await db.query(sql, [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Promotion not found' });
    }
    res.json({ message: 'Promotion status toggled successfully', promotion_id: id });
  } catch (err) {
    console.error(`Error toggling promotion ${id}:`, err);
    return res.status(500).json({ error: 'Could not toggle promotion status', details: err.message });
  }
});

// Protected: ลบโปรโมชั่น
app.delete('/api/promotions/:id', requireAuth, checkPermission('manage_settings'), async (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM promotions WHERE promotion_id = ?";
  try {
    const [result] = await db.query(sql, [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Promotion not found' });
    }
    res.json({ message: 'Promotion deleted successfully', promotion_id: id });
  } catch (err) {
    console.error(`Error deleting promotion ${id}:`, err);
    return res.status(500).json({ error: 'Could not delete promotion', details: err.message });
  }
});

// ============================
// PRICING PLANS API
// ============================
app.get('/api/plans', async (req, res) => {
  try {
    const [plans] = await db.query("SELECT * FROM pricing_plans");
    const [accessData] = await db.query("SELECT * FROM plan_menu_access");

    const plansWithMenus = plans.map(plan => {
      // 1. หา ID ของ Plan (แปลงเป็น String เพื่อความชัวร์)
      // เช็คทุกชื่อที่เป็นไปได้: id, plan_id, หรือ pricing_plan_id
      const pId = String(plan.id || plan.plan_id || plan.pricing_plan_id);

      // 2. จับคู่กับตาราง plan_menu_access
      const selectedMenuIds = accessData
        .filter(item => {
            // ดึง plan_id จากตารางจับคู่ แล้วแปลงเป็น String เทียบกัน
            const accessPlanId = String(item.plan_id || item.pricing_plan_id); 
            return accessPlanId === pId; // เทียบแบบ String เจอแน่นอน
        })
        .map(item => Number(item.menu_id)); // ✅ สำคัญ: แปลง menu_id กลับเป็นตัวเลข (Int) ให้ Frontend
      
      return { 
        ...plan, 
        id: Number(pId), // ส่ง id เป็นตัวเลขกลับไป
        menu_ids: selectedMenuIds 
      }; 
    });

    res.json(plansWithMenus);
  } catch (err) {
    console.error("Error fetching plans:", err);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// Protected: เพิ่มแผนราคา

app.post('/api/plans', requireAuth, requireAdmin, async (req, res) => {
  // ** เช็คชื่อ column ใน database ให้ดีว่าตรงกับตัวแปรเหล่านี้ไหม **
  const { plan_name, price_per_person, description, menu_ids } = req.body; 
  
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. แก้เป็น pricing_plans
    const [result] = await connection.query(
      "INSERT INTO pricing_plans (plan_name, price_per_person, description) VALUES (?, ?, ?)",
      [plan_name, price_per_person, description]
    );
    const planId = result.insertId;

    // 2. บันทึกเมนู (ใช้ plan_menu_access เหมือนเดิม)
    if (menu_ids && menu_ids.length > 0) {
      const values = menu_ids.map(menuId => [planId, menuId]);
      await connection.query(
        "INSERT INTO plan_menu_access (plan_id, menu_id) VALUES ?", 
        [values]
      );
    }

    await connection.commit();
    res.json({ message: 'Plan created successfully', id: planId });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to create plan' });
  } finally {
    connection.release();
  }
});

// Protected: ลบแผนราคา
app.delete('/api/plans/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    // แก้เป็น pricing_plans
    await db.query("DELETE FROM pricing_plans WHERE id = ?", [id]);
    res.json({ message: 'Plan deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete plan' });
  }
});

// ============================
// ATTENDANCE API
// ============================
// (ใช้ global requireAuth แล้ว)

app.get('/api/attendance/status', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const now = new Date(); 
  const todayDate = format(now, 'yyyy-MM-dd');

  try {
    const sql = "SELECT attendance_id, clock_in_time, clock_out_time " +
      "FROM attendance " +
      "WHERE user_id = ? AND date = ? " +
      "ORDER BY clock_in_time DESC LIMIT 1";
      
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

app.post('/api/attendance/clock-in', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { note } = req.body;

  try {
    const todayDate = format(new Date(), 'yyyy-MM-dd');
    const checkSql = "SELECT * FROM attendance WHERE user_id = ? AND date = ? AND clock_out_time IS NULL";
    const [existing] = await db.query(checkSql, [userId, todayDate]);

    if (existing.length > 0) {
      return res.status(400).json({ message: 'คุณกำลังเข้างานอยู่ (กรุณากดออกงานก่อนเริ่มรอบใหม่)' });
    }

    const now = new Date();
    const noteText = note ? `In: ${note}` : null;
    const insertSql = "INSERT INTO attendance (user_id, clock_in_time, date, notes) VALUES (?, ?, ?, ?)";
    await db.query(insertSql, [userId, now, todayDate, noteText]);

    res.status(201).json({ message: 'บันทึกเวลาเข้างานสำเร็จ', clockInTime: now });
    io.emit(`attendance_updated_${userId}`);
    io.emit('attendance_updated_admin');

  } catch (err) {
    console.error(`Clock-in error for user ${userId}:`, err);
    res.status(500).json({ error: 'ไม่สามารถบันทึกเวลาเข้างานได้' });
  }
});

app.post('/api/attendance/clock-out', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { note } = req.body;
  const now = new Date();
  const todayDate = format(now, 'yyyy-MM-dd'); 

  try {
    const findSql = "SELECT attendance_id FROM attendance WHERE user_id = ? AND date = ? AND clock_out_time IS NULL ORDER BY clock_in_time DESC LIMIT 1";
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
        updateSql = "UPDATE attendance SET clock_out_time = ? WHERE attendance_id = ?";
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

app.get('/api/attendance', requireAuth, requireAdmin, async (req, res) => {
  const { userId, startDate, endDate } = req.query;
  let sql = "SELECT a.attendance_id, a.user_id, a.clock_in_time, a.clock_out_time, a.date, a.notes, " +
    "u.username, u.first_name, u.last_name, u.nickname " +
    "FROM attendance a " +
    "JOIN users u ON a.user_id = u.id " +
    "WHERE 1=1";
  const params = [];
  if (userId) {
    sql += " AND a.user_id = ?";
    params.push(userId);
  }
  if (startDate) {
    sql += " AND a.date >= ?";
    params.push(startDate);
  }
  if (endDate) {
    sql += " AND a.date <= ?";
    params.push(endDate);
  }
  sql += " ORDER BY a.date DESC, u.username ASC, a.clock_in_time DESC";
  try {
    const [results] = await db.query(sql, params);
    res.json(results);
  } catch (err) {
    console.error("Error fetching attendance report:", err);
    res.status(500).json({ error: 'Could not fetch attendance report' });
  }
});

app.get('/api/attendance/summary', requireAuth, requireAdmin, async (req, res) => {
  const { userId, startDate, endDate } = req.query;
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Start date and end date are required for summary report.' });
  }
  let whereClause = "WHERE a.clock_out_time IS NOT NULL AND a.date BETWEEN ? AND ?";
  const params = [startDate, endDate];
  if (userId) {
    whereClause += " AND a.user_id = ?";
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
    const summaryResults = results.map(row => {
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
    console.error("Error fetching attendance summary report:", err);
    res.status(500).json({ error: 'Could not fetch attendance summary report' });
  }
});

// ============================
// STOCK HISTORY/SUMMARY API
// ============================
// Protected: manage_stock
app.get('/api/stock/summary', requireAuth, checkPermission('manage_stock'), async (req, res) => {
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
        // ✅ แก้: ใส่ วัน/เดือน เข้าไปในรายชั่วโมงด้วย (ป้องกัน 10:00 ของเมื่อวาน ตีกับ 10:00 วันนี้)
        dateColumn = 'DATE_FORMAT(timestamp, "%Y-%m-%d %H:00:00")';
        interval = 'INTERVAL 1 HOUR';
        labelFormat = 'dd MMM HH:mm'; // เช่น 14 ก.พ. 13:00
        break;
    case 'month': 
        dateColumn = 'DATE_FORMAT(timestamp, "%Y-%m-01")';
        interval = 'INTERVAL 1 MONTH';
        labelFormat = 'MMM yyyy'; // เช่น ก.พ. 2024 (อันนี้มีปีอยู่แล้ว ไม่น่ามีปัญหาแต่เช็คให้ชัวร์)
        break;
    case 'year': 
        dateColumn = 'DATE_FORMAT(timestamp, "%Y-01-01")'; 
        interval = 'INTERVAL 1 YEAR';
        labelFormat = 'yyyy'; // เช่น 2024
        break;
    default: // 'day'
        dateColumn = 'DATE(timestamp)'; 
        interval = 'INTERVAL 1 DAY';
        // ✅ แก้: ใส่ ปี เข้าไปด้วย (ป้องกัน 1 ต.ค. ปีนี้ ตีกับปีที่แล้ว)
        labelFormat = 'dd MMM yyyy'; // เช่น 14 ก.พ. 2024
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
  
  // แปลงช่วงเวลาให้ครอบคลุมทั้งวัน (00:00:00 - 23:59:59)
  const params = [`${startDate} 00:00:00`, `${endDate} 23:59:59`];
  
  if (menuId && menuId !== '') {
    sql += " AND sl.menu_id = ?";
    params.push(menuId);
  }
  
  sql += ` GROUP BY period_start, m.menu_id, m.menu_name ORDER BY period_start ASC, m.menu_name ASC;`;

  try {
    const [results] = await db.query(sql, params);
    
    // Format ผลลัพธ์ก่อนส่งกลับ
    const formattedResults = results.map(row => {
        const d = new Date(row.period_start);
        return {
            period_start: row.period_start,
            menu_id: row.menu_id,
            menu_name: row.menu_name,
            // Format Label ตาม Group By ที่เลือก (ใช้ locale ภาษาไทย)
            period_label: format(d, labelFormat, { locale: th }), 
            total_in: parseInt(row.total_in, 10),
            total_out: parseInt(row.total_out, 10),
            ending_balance: row.ending_balance !== null ? parseInt(row.ending_balance, 10) : null
        };
    });
    
    res.json(formattedResults);
  } catch (err) {
    console.error("Error fetching stock summary:", err);
    res.status(500).json({ error: 'Could not fetch stock summary data' });
  }
});

app.get('/api/stock/history/:menuId', requireAuth, checkPermission('manage_stock'), async (req, res) => {
  const { menuId } = req.params;
  const { startDate, endDate } = req.query;
  let sql = "SELECT sl.*, u.username as changed_by_user " +
    "FROM stock_logs sl LEFT JOIN users u ON sl.user_id = u.id " +
    "WHERE sl.menu_id = ?";
  const params = [menuId];
  if (startDate) { sql += " AND sl.timestamp >= ?"; params.push(`${startDate} 00:00:00`); }
  if (endDate) { sql += " AND sl.timestamp <= ?"; params.push(`${endDate} 23:59:59`); }
  sql += " ORDER BY sl.timestamp DESC, sl.log_id DESC";
  try {
    const [logs] = await db.query(sql, params);
    res.json(logs);
  } catch (err) {
    console.error(`Error fetching stock history for menu ${menuId}:`, err);
    res.status(500).json({ error: 'Could not fetch stock history' });
  }
});

// ============================
// START SERVER
// ============================
const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});
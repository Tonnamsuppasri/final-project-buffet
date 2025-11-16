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

// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'http://192.168.0.101:5173', 
  // 'http://[YOUR_HOTSPOT_IP]:5173' 
];

const corsOptions = {
  origin: allowedOrigins, 
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
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'myappdb',
  port: process.env.DB_PORT || 3306
}).promise(); // ✅ ใช้ .promise() ที่นี่ที่เดียว

// (ใช้ .promise() แล้ว ไม่ต้องใช้ .getConnection แบบ callback)
// ตรวจสอบการเชื่อมต่อครั้งแรก (Optional)
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
// SHOP API
// ============================
app.get('/api/shop', async (req, res) => { // ✅ async
    try { // ✅ try
        const sql = "SELECT shop_name, shop_address, shop_phone, open_time, close_time, payment_qr_code, shop_logo FROM shop WHERE id = 1";
        const [result] = await db.query(sql); // ✅ await db.query()
        if (result.length === 0) return res.status(404).json({ message: 'Shop info not found' });
        const shopData = result[0];
        shopData.payment_qr_code = bufferToBase64(shopData.payment_qr_code);
        shopData.shop_logo = bufferToBase64(shopData.shop_logo);
        res.json(shopData);
    } catch (err) { // ✅ catch
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/shop', async (req, res) => { // ✅ async
    try { // ✅ try
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
        await db.query(sql, params); // ✅ await db.query()
        console.log('🚀 Emitting shop_updated');
        io.emit('shop_updated');
        res.json({ message: 'Shop info updated successfully' });
    } catch (err) { // ✅ catch
        res.status(500).json({ error: err.message });
    }
});

// ============================
// Login API
// ============================
app.post('/api/login', async (req, res) => { // ✅ async
  const { username, password } = req.body;
  try { // ✅ try
    const sqlUser = 'SELECT * FROM users WHERE username = ?';
    const [users] = await db.query(sqlUser, [username]); // ✅ await db.query()
    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Username not found' });
    }
    const user = users[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Incorrect password' });
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
        image: bufferToBase64(user.image)
      }
    });
  } catch (err) { // ✅ catch
      res.status(500).json({ error: err.message });
  }
});

// ============================
// Staff & User API
// ============================
app.get('/api/user/:id', async (req, res) => { // ✅ async
  const { id } = req.params;
  try { // ✅ try
    const sql = `SELECT id, username, role, phone, email, first_name, last_name, nickname, image FROM users WHERE id = ?`;
    const [result] = await db.query(sql, [id]); // ✅ await db.query()
    if (result.length === 0) return res.status(404).json({ message: 'User not found' });
    const user = result[0];
    user.image = bufferToBase64(user.image);
    res.json(user);
  } catch (err) { // ✅ catch
      res.status(500).json({ error: err.message });
  }
});

app.get('/api/staff', async (req, res) => { // ✅ async
  try { // ✅ try
    const sql = `SELECT id, username, role, phone, email, first_name, last_name, nickname, image FROM users`;
    const [result] = await db.query(sql); // ✅ await db.query()
    const staff = result.map(user => ({ ...user, image: bufferToBase64(user.image) }));
    res.json(staff);
  } catch (err) { // ✅ catch
      res.status(500).json({ error: 'Error fetching staff data' });
  }
});

app.post('/api/staff', async (req, res) => {
  const { username, email, password, phone, role, first_name, last_name, nickname, image } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const imageBuffer = image ? Buffer.from(image, 'base64') : null;
    const sql = `INSERT INTO users (username, email, password, phone, role, first_name, last_name, nickname, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const [result] = await db.query(sql, [username, email, hashedPassword, phone, role, first_name, last_name, nickname, imageBuffer]); // ✅ await db.query()
    console.log('🚀 Emitting staff_updated');
    io.emit('staff_updated');
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: "Server error during password hashing or insertion." });
  }
});

app.put('/api/staff/:id', async (req, res) => {
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
        
        const [result] = await db.query(sql, params); // ✅ await db.query()
        
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Staff member not found' });
        
        console.log('🚀 Emitting staff_updated');
        io.emit('staff_updated');
        res.json({ message: 'Staff member updated successfully', id: id });
    } catch (error) {
        res.status(500).json({ error: 'Could not update staff member' });
    }
});

app.delete('/api/staff/:id', async (req, res) => { // ✅ async
  const { id } = req.params;
  try { // ✅ try
    const sql = 'DELETE FROM users WHERE id = ?';
    const [result] = await db.query(sql, [id]); // ✅ await db.query()
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Staff member not found' });
    console.log('🚀 Emitting staff_updated');
    io.emit('staff_updated');
    res.json({ message: 'Staff member deleted successfully', id: id });
  } catch (err) { // ✅ catch
      res.status(500).json({ error: 'Could not delete staff member' });
  }
});

// ============================
// MENU API
// ============================
app.get('/api/menu', async (req, res) => { // ✅ async
    try { // ✅ try
        const sql = "SELECT * FROM menu ORDER BY menu_category, menu_name";
        const [results] = await db.query(sql); // ✅ await db.query()
        const menuWithImages = results.map(item => ({
            ...item,
            menu_image: bufferToBase64(item.menu_image)
        }));
        res.json(menuWithImages);
    } catch (err) { // ✅ catch
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/menu', async (req, res) => { // ✅ async
    try { // ✅ try
        const { menu_name, menu_description, menu_category, price, menu_quantity, menu_image } = req.body;
        const imageBuffer = menu_image ? Buffer.from(menu_image, 'base64') : null;
        const sql = "INSERT INTO menu (menu_name, menu_description, menu_category, price, menu_quantity, menu_image) VALUES (?, ?, ?, ?, ?, ?)";
        const [result] = await db.query(sql, [menu_name, menu_description || null, menu_category || null, price, menu_quantity || 0, imageBuffer]); // ✅ await db.query()
        console.log('🚀 Emitting menu_updated');
        io.emit('menu_updated');
        res.status(201).json({ message: 'Menu item added successfully', menu_id: result.insertId });
    } catch (err) { // ✅ catch
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/menu/:id', async (req, res) => { 
    const { id } = req.params;
    const { menu_name, menu_description, menu_category, price, menu_quantity, menu_image } = req.body; 
    const imageBuffer = menu_image ? Buffer.from(menu_image, 'base64') : null;

    try {
        let currentQuantity = null;
        const [menuResult] = await db.query("SELECT menu_quantity FROM menu WHERE menu_id = ?", [id]); // ✅ await db.query()
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

        const [resultUpdate] = await db.query(sqlUpdate, paramsUpdate); // ✅ await db.query()
        if (resultUpdate.affectedRows === 0) return res.status(404).json({ message: 'Menu item not found for update' });

        const newQuantityDb = menu_quantity === null || menu_quantity === '' ? null : Number(menu_quantity);
        if (newQuantityDb !== null && currentQuantity !== newQuantityDb) {
            const changeQuantity = (currentQuantity === null ? 0 : currentQuantity) - newQuantityDb; 
            const logSql = "INSERT INTO stock_logs (menu_id, change_quantity, new_quantity, reason, user_id, timestamp) VALUES (?, ?, ?, ?, ?, NOW())";
            const adminUserId = req.user?.id || null; 
            await db.query(logSql, [id, changeQuantity * -1, newQuantityDb, 'adjustment', adminUserId]); // ✅ await db.query()
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

app.delete('/api/menu/:id', async (req, res) => { // ✅ async
    try { // ✅ try
        const { id } = req.params;
        const sql = "DELETE FROM menu WHERE menu_id = ?";
        const [result] = await db.query(sql, [id]); // ✅ await db.query()
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Menu item not found' });
        console.log('🚀 Emitting menu_updated');
        io.emit('menu_updated');
        res.json({ message: 'Menu item deleted successfully' });
    } catch (err) { // ✅ catch
        res.status(500).json({ error: err.message });
    }
});

// ============================
// ORDERS API (Dynamic QR Code)
// ============================
app.post('/api/orders', async (req, res) => { // ✅ async
  const { table_id, customer_quantity, plan_id, service_type } = req.body;
  const order_uuid = uuidv4();

  try { // ✅ try
    const sql = `INSERT INTO orders (table_id, customer_quantity, plan_id, service_type, start_time, order_status, order_uuid) VALUES (?, ?, ?, ?, NOW(), 'in-progress', ?)`;
    const [result] = await db.query(sql, [table_id, customer_quantity, plan_id, service_type, order_uuid]); // ✅ await db.query()
    
    const updateTableSql = "UPDATE tables SET status = 'ไม่ว่าง' WHERE table_id = ?";
    await db.query(updateTableSql, [table_id]); // ✅ await db.query()
    
    console.log('🚀 Emitting tables_updated (new order)');
    io.emit('tables_updated');
    
    const getTableSql = "SELECT table_number FROM tables WHERE table_id = ?";
    const [tableResult] = await db.query(getTableSql, [table_id]); // ✅ await db.query()
    
    if (tableResult.length > 0) {
        const tableNumber = tableResult[0].table_number;
        io.emit('notification', {
            message: `โต๊ะ ${tableNumber} ได้เปิดใช้งานใหม่`,
            type: 'new_order',
            linkTo: '/table' 
        });
    }
    
    res.status(201).json({ message: 'Order created successfully', order_id: result.insertId });
  } catch (err) { // ✅ catch
      res.status(500).json({ error: 'Could not create order' });
  }
});

app.get('/api/orders/active', async (req, res) => { // ✅ async
    try { // ✅ try
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
        const [results] = await db.query(sql); // ✅ await db.query()
        res.json(results);
    } catch (err) { // ✅ catch
        res.status(500).json({ error: err.message });
    }
});

// API ใหม่: สำหรับหน้าลูกค้าโดยเฉพาะ (ปลอดภัย)
app.get('/api/order-session/:order_uuid', async (req, res) => {
    const { order_uuid } = req.params;
    try {
        const orderSql = `
            SELECT
                o.order_id, o.customer_quantity, o.service_type, o.start_time,
                t.table_id, t.table_number, t.uuid AS table_uuid,
                p.plan_name, p.price_per_person
            FROM orders o
            JOIN tables t ON o.table_id = t.table_id
            LEFT JOIN pricing_plans p ON o.plan_id = p.id 
            WHERE o.order_uuid = ? AND o.order_status = 'in-progress'
        `;
        const [orderResult] = await db.query(orderSql, [order_uuid]); // ✅ await db.query()

        if (orderResult.length === 0) {
            return res.status(404).json({ error: "ไม่พบออเดอร์สำหรับโต๊ะนี้ หรือโต๊ะถูกปิดไปแล้ว" });
        }

        const menuSql = "SELECT * FROM menu ORDER BY menu_category, menu_name";
        const [menuResult] = await db.query(menuSql); // ✅ await db.query()
        const menuWithImages = menuResult.map(item => ({
            ...item,
            menu_image: bufferToBase64(item.menu_image)
        }));

        const shopSql = "SELECT shop_name, shop_logo FROM shop WHERE id = 1";
        const [shopResult] = await db.query(shopSql); // ✅ await db.query()
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


app.post('/api/orders/:orderId/details', async (req, res) => { // ✅ async
    const { orderId } = req.params;
    const orderDetails = req.body; 
    if (!Array.isArray(orderDetails) || orderDetails.length === 0) {
        return res.status(400).json({ error: 'Invalid order details format. Expected an array.' });
    }
    
    try { // ✅ try
        const values = orderDetails.map(item => [
            orderId,
            item.menu_id,
            item.quantity,
            item.price_per_item,
            'กำลังจัดทำ', 
            item.customer_name || null 
        ]);
        const sql = "INSERT INTO order_details (order_id, menu_id, quantity, price_per_item, item_status, customer_name) VALUES ?";
        await db.query(sql, [values]); // ✅ await db.query()
        
        const findTableSql = `
          SELECT t.table_number 
          FROM orders o
          JOIN tables t ON o.table_id = t.table_id
          WHERE o.order_id = ?
        `;
        
        const [tableResult] = await db.query(findTableSql, [orderId]); // ✅ await db.query()
        let message = `มีออเดอร์ใหม่สำหรับ Order #${orderId}`; 
        
        if (tableResult.length > 0) {
            const tableNumber = tableResult[0].table_number;
            message = `โต๊ะ ${tableNumber} สั่งอาหารเพิ่ม (Order #${orderId})`;
        }
        
        io.emit('notification', {
            message: message,
            type: 'new_order',
            linkTo: '/order' 
        });

        console.log(`🚀 Emitting new_order_item for order ${orderId}`);
        io.emit('new_order_item', { orderId: orderId, items: orderDetails });
        res.status(201).json({ message: 'Order details added successfully' });
    } catch (err) { // ✅ catch
        console.error("Order Detail Insert Error:", err.message);
        return res.status(500).json({ error: err.message });
    }
});


app.get('/api/orders/:orderId/details', async (req, res) => { // ✅ async
    const { orderId } = req.params;
    try { // ✅ try
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
        const [results] = await db.query(sql, [orderId]); // ✅ await db.query()
        const detailsWithImages = results.map(item => ({
            ...item,
            menu_image: bufferToBase64(item.menu_image)
        }));
        res.json(detailsWithImages);
    } catch (err) { // ✅ catch
        res.status(500).json({ error: err.message });
    }
});

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

    // ✅ FIX: ใช้ connection.query (ไม่ใช่ db.promise().query)
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

    await connection.query("UPDATE orders SET customer_join_count = ? WHERE order_id = ?", [newCount, orderId]); // ✅ FIX

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


app.put('/api/order-details/:detailId/deliver', async (req, res) => { // ✅ async
    try { // ✅ try
        const { detailId } = req.params;
        const sql = "UPDATE order_details SET item_status = 'จัดส่งแล้ว' WHERE order_detail_id = ?";
        const [result] = await db.query(sql, [detailId]); // ✅ await db.query()
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Order detail item not found' });
        
        console.log(`🚀 Emitting item_status_updated for detail ${detailId}`);
        io.emit('item_status_updated', { detailId: detailId, newStatus: 'จัดส่งแล้ว' });
        res.json({ message: 'Item status updated successfully' });
    } catch (err) { // ✅ catch
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/orders/:orderId', async (req, res) => { // ✅ async
    const { orderId } = req.params;
    let connection;
    try {
        connection = await db.getConnection(); // ✅ ใช้ db.getConnection()
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
app.get('/api/payments', async (req, res) => { // ✅ async
    const { searchTerm, startDate, endDate } = req.query;
    try { // ✅ try
        let sql = `
            SELECT p.payment_id, p.order_id, p.payment_time, p.total_price, p.payment_method,
                   t.table_number, o.customer_quantity
            FROM payment p
            JOIN orders o ON p.order_id = o.order_id
            JOIN tables t ON o.table_id = t.table_id
            WHERE 1=1
        `;
        const params = [];

        if (searchTerm) {
            sql += ` AND (p.order_id = ? OR t.table_number LIKE ? OR p.payment_method LIKE ?)`;
            params.push(searchTerm, `%${searchTerm}%`, `%${searchTerm}%`);
        }
        if (startDate) {
            sql += ` AND p.payment_time >= ?`;
            params.push(`${startDate} 00:00:00`);
        }
        if (endDate) {
            sql += ` AND p.payment_time <= ?`;
            params.push(`${endDate} 23:59:59`);
        }
        sql += ` ORDER BY p.payment_time DESC`;

        const [results] = await db.query(sql, params); // ✅ await db.query()
        res.json(results);
    } catch (err) { // ✅ catch
        console.error("Error fetching payments:", err);
        return res.status(500).json({ error: 'Error fetching payment data' });
    }
});

app.get('/api/payments/:id', async (req, res) => { // ✅ async
    const { id } = req.params; 
    try { // ✅ try
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

        const [paymentResult] = await db.query(paymentDetailsSql, [id]); // ✅ await db.query()

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

        const [menuResult] = await db.query(menuItemsSql, [orderId]); // ✅ await db.query()
        res.json({ details: paymentDetails, menuItems: menuResult });
        
    } catch (err) { // ✅ catch
        console.error("Error fetching payment details:", err);
        return res.status(500).json({ error: 'Error fetching payment details' });
    }
});

app.post('/api/payment', async (req, res) => { 
  const { order_id, payment_method } = req.body;

  if (!order_id) {
    return res.status(400).json({ error: 'Missing required payment information (order_id)' });
  }

  let connection;
  try {
    connection = await db.getConnection(); // ✅ ใช้ db.getConnection()
    await connection.beginTransaction();

    const getOrderSql = "SELECT o.customer_quantity, o.plan_id, pp.price_per_person " +
                        "FROM orders o " +
                        "LEFT JOIN pricing_plans pp ON o.plan_id = pp.id " +
                        "WHERE o.order_id = ?";
    const [orderResult] = await connection.query(getOrderSql, [order_id]); // ✅ connection.query()

    if (orderResult.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderData = orderResult[0];
    const customerQuantity = parseInt(orderData.customer_quantity || '0', 10);
    const pricePerPerson = parseFloat(orderData.price_per_person || '0');
    const buffetTotal = customerQuantity * pricePerPerson;

    const getAlaCarteSql = "SELECT COALESCE(SUM(quantity * price_per_item), 0) AS aLaCarteTotal " +
                           "FROM order_details " +
                           "WHERE order_id = ? AND price_per_item > 0";
    const [alaCarteResult] = await connection.query(getAlaCarteSql, [order_id]); // ✅ connection.query()
    const aLaCarteTotal = parseFloat(alaCarteResult[0].aLaCarteTotal || '0');
    const finalTotalPrice = buffetTotal + aLaCarteTotal;

    const insertPaymentSql = "INSERT INTO payment (order_id, payment_time, total_price, payment_method) VALUES (?, NOW(), ?, ?)";
    const [insertResult] = await connection.query(insertPaymentSql, [order_id, finalTotalPrice, payment_method || null]); // ✅ connection.query()
    const paymentId = insertResult.insertId;

    // --- Stock Deduction ---
    const getOrderDetailsSql = "SELECT od.order_detail_id, od.menu_id, od.quantity, m.menu_quantity AS current_stock " +
                               "FROM order_details od " +
                               "JOIN menu m ON od.menu_id = m.menu_id " +
                               "WHERE od.order_id = ? AND m.menu_quantity IS NOT NULL"; 
    const [detailsToDeduct] = await connection.query(getOrderDetailsSql, [order_id]); // ✅ connection.query()

    for (const detail of detailsToDeduct) {
        if (detail.current_stock !== null) { 
            const soldQuantity = detail.quantity;
            const newQuantity = detail.current_stock - soldQuantity;
            const updateStockSql = "UPDATE menu SET menu_quantity = ? WHERE menu_id = ?";
            await connection.query(updateStockSql, [newQuantity, detail.menu_id]); // ✅ connection.query()
            const logSql = "INSERT INTO stock_logs (menu_id, change_quantity, new_quantity, reason, order_detail_id, timestamp) VALUES (?, ?, ?, ?, ?, NOW())";
            await connection.query(logSql, [detail.menu_id, -soldQuantity, newQuantity, 'sale', detail.order_detail_id]); // ✅ connection.query()
            console.log(`Stock updated & logged for menu ${detail.menu_id} (Sale). Change: ${-soldQuantity}, New Qty: ${newQuantity}`);
        }
    }
    // --- End Stock Deduction ---
    
    for (const key of orderSessionCache.keys()) {
      if (key.startsWith(`${order_id}-`)) {
        orderSessionCache.delete(key);
      }
    }

    const updateOrderStatusSql = "UPDATE orders SET order_status = 'completed' WHERE order_id = ?";
    await connection.query(updateOrderStatusSql, [order_id]); // ✅ connection.query()

    const updateTableSql = `UPDATE tables t JOIN orders o ON t.table_id = o.table_id SET t.status = 'ว่าง' WHERE o.order_id = ?`;
    const [updateTableResult] = await connection.query(updateTableSql, [order_id]); // ✅ connection.query()

    await connection.commit();
    connection.release();

    // --- Emit Sockets ---
    if (updateTableResult.affectedRows > 0) {
      console.log('🚀 Emitting tables_updated (payment complete)');
      io.emit('tables_updated');
      console.log('🚀 Emitting new_payment');
      io.emit('new_payment', { paymentId: paymentId, orderId: order_id, totalPrice: finalTotalPrice });

      const getTableSql = `SELECT t.table_number FROM orders o JOIN tables t ON o.table_id = t.table_id WHERE o.order_id = ?`;
      const [tableResult] = await db.query(getTableSql, [order_id]); // ✅ db.query() (นอก Transaction)
      if (tableResult.length > 0) {
        const tableNumber = tableResult[0].table_number;
        io.emit('notification', {
          message: `โต๊ะ ${tableNumber} ได้ชำระเงินและปิดโต๊ะแล้ว ยอดรวม ${finalTotalPrice.toFixed(2)} บาท`,
          type: 'close_table',
          linkTo: '/PaymentPage'
        });
      }
    }

    res.status(201).json({
      message: 'Payment recorded and status updated successfully',
      payment_id: paymentId,
      calculated_total_price: finalTotalPrice
    });

  } catch (err) {
    if (connection) {
        await connection.rollback();
        connection.release();
    }
    console.error(`Error processing payment for order ${order_id}:`, err); 
    res.status(500).json({ error: 'Error processing payment', details: err.message }); 
  }
});

// ==========================================
// REPORTS API (✅ FIX: เปลี่ยนเป็น async/await)
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

// API: /api/reports/overview/stats
app.get('/api/reports/overview/stats', async (req, res) => { // ✅ async
  const [startDate, endDate] = getDates(req);
  const sql = "SELECT " +
    "COALESCE(SUM(p.total_price), 0) AS totalSales, " +
    "COALESCE(COUNT(p.payment_id), 0) AS totalOrders, " +
    "COALESCE(SUM(o.customer_quantity), 0) AS totalCustomers, " +
    "COALESCE(SUM(p.total_price) / NULLIF(SUM(o.customer_quantity), 0), 0) AS avgPerCustomer " +
    "FROM payment p " +
    "JOIN orders o ON p.order_id = o.order_id " +
    "WHERE p.payment_time BETWEEN ? AND ?;";
  
  try { // ✅ try
    const [result] = await db.query(sql, [startDate, endDate]); // ✅ await db.query()
    res.json(result[0] || { totalSales: 0, totalOrders: 0, totalCustomers: 0, avgPerCustomer: 0 });
  } catch (err) { // ✅ catch
      console.error("Error fetching overview stats:", err.message);
      return res.status(500).json({ error: err.message });
  }
});

// API: /api/reports/overview/payment-methods
app.get('/api/reports/overview/payment-methods', async (req, res) => { // ✅ async
  const [startDate, endDate] = getDates(req);
  const sql = "SELECT " +
    "payment_method AS method, " +
    "SUM(total_price) AS total " +
    "FROM payment " +
    "WHERE payment_time BETWEEN ? AND ? AND payment_method IS NOT NULL " +
    "GROUP BY payment_method " +
    "HAVING total > 0;";
  
  try { // ✅ try
    const [results] = await db.query(sql, [startDate, endDate]); // ✅ await db.query()
    res.json(results);
  } catch (err) { // ✅ catch
      console.error("Error fetching payment methods:", err.message);
      return res.status(500).json({ error: err.message });
  }
});

// API: /api/reports/overview/plan-popularity
app.get('/api/reports/overview/plan-popularity', async (req, res) => { // ✅ async
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
  
  try { // ✅ try
    const [results] = await db.query(sql, [startDate, endDate]); // ✅ await db.query()
    res.json(results);
  } catch (err) { // ✅ catch
      console.error("Error fetching plan popularity:", err.message);
      return res.status(500).json({ error: err.message });
  }
});

// API: /api/reports/sales
app.get('/api/reports/sales', async (req, res) => {
  const [startDate, endDate] = getDates(req);
  try {
    const summarySql = "SELECT " +
      "COALESCE(SUM(total_price), 0) AS totalSales, " +
      "COALESCE(COUNT(payment_id), 0) AS totalOrders, " +
      "COALESCE(SUM(total_price) / NULLIF(COUNT(payment_id), 0), 0) AS avgOrderValue " +
      "FROM payment " +
      "WHERE payment_time BETWEEN ? AND ?;";
    
    const [summaryResult] = await db.query(summarySql, [startDate, endDate]); // ✅ FIX: db.query()
    
    const dailySalesSql = "SELECT " +
      "DATE(payment_time) AS date, " +
      "SUM(total_price) AS total " +
      "FROM payment " +
      "WHERE payment_time BETWEEN ? AND ? " +
      "GROUP BY DATE(payment_time) " +
      "ORDER BY date ASC;";
    
    const [dailySales] = await db.query(dailySalesSql, [startDate, endDate]); // ✅ FIX: db.query()
    
    const paymentDetailsSql = "SELECT " +
      "p.payment_id, p.order_id, p.payment_time, p.total_price, p.payment_method, " +
      "t.table_number, o.customer_quantity " +
      "FROM payment p " +
      "JOIN orders o ON p.order_id = o.order_id " +
      "JOIN tables t ON o.table_id = t.table_id " +
      "WHERE p.payment_time BETWEEN ? AND ? " +
      "ORDER BY p.payment_time DESC;";
    
    const [paymentDetails] = await db.query(paymentDetailsSql, [startDate, endDate]); // ✅ FIX: db.query()
    
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

// API: /api/reports/menu/plans
app.get('/api/reports/menu/plans', async (req, res) => { // ✅ async
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

  try { // ✅ try
    const [results] = await db.query(sql, [startDate, endDate]); // ✅ await db.query()
    const processedResults = results.map(row => ({
      ...row,
      price_per_person: row.price_per_person === null ? null : parseFloat(row.price_per_person),
      total_revenue: row.total_revenue === null ? null : parseFloat(row.total_revenue)
    }));
    res.json(processedResults);
  } catch (err) { // ✅ catch
    console.error("[/api/reports/menu/plans] SQL Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// API: /api/reports/menu/items
app.get('/api/reports/menu/items', async (req, res) => { // ✅ async
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

  try { // ✅ try
    const [results] = await db.query(sql, [startDate, endDate]); // ✅ await db.query()
    res.json(results);
  } catch (err) { // ✅ catch
    console.error("[/api/reports/menu/items] SQL Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ============================
// TABLES API (✅ FIX: เปลี่ยนเป็น async/await)
// ============================
app.get('/api/tables', async (req, res) => { // ✅ async
    try { // ✅ try
        const sql = "SELECT * FROM tables ORDER BY table_number ASC";
        const [results] = await db.query(sql); // ✅ await db.query()
        res.json(results);
    } catch (err) { // ✅ catch
        return res.status(500).json({ error: err.message });
    }
});

app.get('/api/tables/uuid/:uuid', async (req, res) => { // ✅ async
  const { uuid } = req.params;
  try { // ✅ try
    const sql = "SELECT table_id, table_number, seat_capacity, status, uuid FROM tables WHERE uuid = ?";
    const [results] = await db.query(sql, [uuid]); // ✅ await db.query()
    if (results.length === 0) {
      return res.status(404).json({ message: 'Table not found for this UUID' });
    }
    res.json(results[0]); 
  } catch (err) { // ✅ catch
    console.error("Error fetching table by UUID:", err);
    return res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/tables', async (req, res) => { // ✅ async
    const { table_number, seat_capacity } = req.body;
    if (!table_number || seat_capacity === undefined || seat_capacity === null) {
         return res.status(400).json({ error: 'Missing table_number or seat_capacity' });
    }
    try { // ✅ try
        const newUuid = uuidv4();
        const sql = "INSERT INTO tables (uuid, table_number, seat_capacity, status) VALUES (?, ?, ?, 'ว่าง')";
        const [result] = await db.query(sql, [newUuid, table_number, seat_capacity]); // ✅ await db.query()
        console.log('🚀 Emitting tables_updated (new table added)');
        io.emit('tables_updated');
        res.status(201).json({ message: 'Table added successfully', table_id: result.insertId, uuid: newUuid, table_number, seat_capacity, status: 'ว่าง' });
    } catch (err) { // ✅ catch
        console.error("Error adding table:", err);
        return res.status(500).json({ error: 'Error adding table' });
    }
});

app.put('/api/tables/:id', async (req, res) => { // ✅ async
    const { id } = req.params;
    const { table_number, seat_capacity, status } = req.body;
     if (!table_number || seat_capacity === undefined || seat_capacity === null || !status) {
         return res.status(400).json({ error: 'Missing required table information' });
    }
    try { // ✅ try
        const sql = "UPDATE tables SET table_number = ?, seat_capacity = ?, status = ? WHERE table_id = ?";
        const [result] = await db.query(sql, [table_number, seat_capacity, status, id]); // ✅ await db.query()
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Table not found' });
        console.log('🚀 Emitting tables_updated (table edited)');
        io.emit('tables_updated');
        res.json({ message: 'Table updated successfully' });
    } catch (err) { // ✅ catch
        return res.status(500).json({ error: err.message });
    }
});

app.delete('/api/tables/:id', async (req, res) => { // ✅ async
    const { id } = req.params;
    try { // ✅ try
        const checkOrdersSql = "SELECT COUNT(*) as orderCount FROM orders WHERE table_id = ? AND order_status = 'in-progress'";
        const [checkResult] = await db.query(checkOrdersSql, [id]); // ✅ await db.query()
        if (checkResult[0].orderCount > 0) {
            return res.status(400).json({ error: 'Cannot delete table with active orders' });
        }

        const sql = "DELETE FROM tables WHERE table_id = ?";
        const [result] = await db.query(sql, [id]); // ✅ await db.query()
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Table not found' });
        
        console.log('🚀 Emitting tables_updated (table deleted)');
        io.emit('tables_updated');
        res.json({ message: 'Table deleted successfully' });
   } catch (err) { // ✅ catch
        console.error("Error deleting table:", err);
        return res.status(500).json({ error: 'Could not delete table' });
   }
});

// ============================
// PROMOTIONS API (✅ FIX: เปลี่ยนเป็น async/await)
// ============================
app.get('/api/promotions', async (req, res) => { // ✅ async
  let sql = "SELECT * FROM promotions";
  const params = [];
  if (req.query.active === 'true') {
    sql += " WHERE is_active = 1";
  } else if (req.query.active === 'false') {
    sql += " WHERE is_active = 0";
  }
  sql += " ORDER BY end_date DESC, start_date DESC"; 
  
  try { // ✅ try
    const [results] = await db.query(sql, params); // ✅ await db.query()
    res.json(results);
  } catch (err) { // ✅ catch
    console.error("Error fetching promotions:", err);
    return res.status(500).json({ error: 'Error fetching promotions data', details: err.message });
  }
});

app.get('/api/promotions/:id', async (req, res) => { // ✅ async
  const { id } = req.params;
  const sql = "SELECT * FROM promotions WHERE promotion_id = ?";
  try { // ✅ try
    const [results] = await db.query(sql, [id]); // ✅ await db.query()
    if (results.length === 0) {
      return res.status(404).json({ message: 'Promotion not found' });
    }
    res.json(results[0]); 
  } catch (err) { // ✅ catch
    console.error(`Error fetching promotion ${id}:`, err);
    return res.status(500).json({ error: 'Error fetching promotion data', details: err.message });
  }
});

app.post('/api/promotions', async (req, res) => { // ✅ async
  const { name, description, type, value, code, start_date, end_date, conditions } = req.body;
  if (!name || !type || value === undefined || value === null || !start_date || !end_date) {
    return res.status(400).json({ error: 'Missing required promotion fields (name, type, value, start_date, end_date)' });
  }
  
  try { // ✅ try
    const sql = "INSERT INTO promotions (name, description, type, value, code, start_date, end_date, conditions, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)"; 
    const params = [
      name, description || null, type, value, code || null, 
      start_date, end_date, conditions || null 
    ];
    const [result] = await db.query(sql, params); // ✅ await db.query()
    res.status(201).json({ message: 'Promotion created successfully', promotion_id: result.insertId });
  } catch (err) { // ✅ catch
    console.error("Error creating promotion:", err);
    if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'Promotion code already exists' });
    }
    return res.status(500).json({ error: 'Could not create promotion', details: err.message });
  }
});

app.put('/api/promotions/:id', async (req, res) => { // ✅ async
  const { id } = req.params;
  const { name, description, type, value, code, start_date, end_date, conditions } = req.body; 
  if (!name || !type || value === undefined || value === null || !start_date || !end_date) {
    return res.status(400).json({ error: 'Missing required promotion fields (name, type, value, start_date, end_date)' });
  }
  
  try { // ✅ try
    const sql = "UPDATE promotions SET name = ?, description = ?, type = ?, value = ?, code = ?, start_date = ?, end_date = ?, conditions = ? WHERE promotion_id = ?";
    const params = [
      name, description || null, type, value, code || null,
      start_date, end_date, conditions || null, id
    ];
    const [result] = await db.query(sql, params); // ✅ await db.query()
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Promotion not found' });
    }
    res.json({ message: 'Promotion updated successfully', promotion_id: id });
  } catch (err) { // ✅ catch
    console.error(`Error updating promotion ${id}:`, err);
     if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'Promotion code already exists' });
    }
    return res.status(500).json({ error: 'Could not update promotion', details: err.message });
  }
});

app.put('/api/promotions/:id/toggle', async (req, res) => { // ✅ async
  const { id } = req.params;
  const sql = "UPDATE promotions SET is_active = NOT is_active WHERE promotion_id = ?";
  try { // ✅ try
    const [result] = await db.query(sql, [id]); // ✅ await db.query()
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Promotion not found' });
    }
    res.json({ message: 'Promotion status toggled successfully', promotion_id: id });
  } catch (err) { // ✅ catch
    console.error(`Error toggling promotion ${id}:`, err);
    return res.status(500).json({ error: 'Could not toggle promotion status', details: err.message });
  }
});

app.delete('/api/promotions/:id', async (req, res) => { // ✅ async
  const { id } = req.params;
  const sql = "DELETE FROM promotions WHERE promotion_id = ?";
  try { // ✅ try
    const [result] = await db.query(sql, [id]); // ✅ await db.query()
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Promotion not found' });
    }
    res.json({ message: 'Promotion deleted successfully', promotion_id: id });
  } catch (err) { // ✅ catch
    console.error(`Error deleting promotion ${id}:`, err);
    return res.status(500).json({ error: 'Could not delete promotion', details: err.message });
  }
});

// ============================
// PRICING PLANS API (✅ FIX: เปลี่ยนเป็น async/await)
// ============================
app.get('/api/plans', async (req, res) => { // ✅ async
    try { // ✅ try
        const sql = "SELECT * FROM pricing_plans ORDER BY price_per_person ASC";
        const [results] = await db.query(sql); // ✅ await db.query()
        res.json(results);
    } catch (err) { // ✅ catch
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/plans', async (req, res) => { // ✅ async
    const { plan_name, price_per_person, description } = req.body;
    if (!plan_name || price_per_person === undefined || price_per_person === null) {
        return res.status(400).json({ error: 'Missing plan name or price' });
    }
    try { // ✅ try
        const sql = "INSERT INTO pricing_plans (plan_name, price_per_person, description) VALUES (?, ?, ?)";
        const [result] = await db.query(sql, [plan_name, price_per_person, description || null]); // ✅ await db.query()
        console.log('🚀 Emitting plans_updated');
        io.emit('plans_updated');
        res.status(201).json({ id: result.insertId, plan_name, price_per_person, description });
    } catch (err) { // ✅ catch
        return res.status(500).json({ error: 'Could not add pricing plan' });
    }
});

app.delete('/api/plans/:id', async (req, res) => { // ✅ async
    const { id } = req.params;
    try { // ✅ try
        const sql = "DELETE FROM pricing_plans WHERE id = ?";
        const [result] = await db.query(sql, [id]); // ✅ await db.query()
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Pricing plan not found' });
        console.log('🚀 Emitting plans_updated');
        io.emit('plans_updated');
        res.json({ message: 'Pricing plan deleted successfully' });
    } catch (err) { // ✅ catch
         console.error("Error deleting plan:", err);
        return res.status(500).json({ error: 'Could not delete pricing plan (it might be in use)' });
    }
});

// ============================
// ATTENDANCE API (✅ FIX: เปลี่ยน db.promise().query() เป็น db.query())
// ============================
const requireAuth = async (req, res, next) => { 
  const userIdFromHeader = req.headers['x-user-id'];
  if (!userIdFromHeader) {
    console.warn('Authentication failed: Missing x-user-id header');
    return res.status(401).json({ error: 'Authentication required (Missing User ID)' });
  }
  const userId = parseInt(userIdFromHeader, 10);
  if (isNaN(userId)) {
    console.warn('Authentication failed: Invalid x-user-id header:', userIdFromHeader);
    return res.status(401).json({ error: 'Authentication required (Invalid User ID)' });
  }
  
  try {
    const sqlGetUser = "SELECT id, role FROM users WHERE id = ?";
    const [users] = await db.query(sqlGetUser, [userId]); // ✅ FIX: db.query()

    if (users.length === 0) {
      console.warn(`Authentication failed: User ID ${userId} not found in database.`);
      return res.status(401).json({ error: 'Authentication required (User not found)' });
    }
    const user = users[0];
    
    req.user = { id: user.id, role: user.role }; 
    console.log(`Authenticated User: ID=${req.user.id}, Role=${req.user.role}`); 

    next(); 

  } catch (dbError) {
    console.error("Authentication error during DB query:", dbError);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

app.get('/api/attendance/status', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const todayDate = new Date().toISOString().split('T')[0];
  try {
    const sql = "SELECT attendance_id, clock_in_time, clock_out_time " +
                "FROM attendance " +
                "WHERE user_id = ? AND date = ? " +
                "ORDER BY clock_in_time DESC LIMIT 1";
    const [records] = await db.query(sql, [userId, todayDate]); // ✅ FIX: db.query()

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
  const now = new Date();
  const todayDate = now.toISOString().split('T')[0]; 
  try {
    const checkSql = "SELECT attendance_id FROM attendance WHERE user_id = ? AND date = ? AND clock_out_time IS NULL";
    const [existing] = await db.query(checkSql, [userId, todayDate]); // ✅ FIX: db.query()

    if (existing.length > 0) {
      return res.status(400).json({ message: 'คุณได้บันทึกเวลาเข้างานวันนี้ไปแล้ว' });
    }

    const insertSql = "INSERT INTO attendance (user_id, clock_in_time, date) VALUES (?, ?, ?)";
    await db.query(insertSql, [userId, now, todayDate]); // ✅ FIX: db.query()

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
  const now = new Date();
  const todayDate = now.toISOString().split('T')[0];
  try {
    const findSql = "SELECT attendance_id FROM attendance WHERE user_id = ? AND date = ? AND clock_out_time IS NULL ORDER BY clock_in_time DESC LIMIT 1";
    const [records] = await db.query(findSql, [userId, todayDate]); // ✅ FIX: db.query()

    if (records.length === 0) {
      return res.status(400).json({ message: 'ไม่พบข้อมูลเข้างานล่าสุด หรือคุณได้ออกงานไปแล้ว' });
    }

    const attendanceId = records[0].attendance_id;
    const updateSql = "UPDATE attendance SET clock_out_time = ? WHERE attendance_id = ?";
    await db.query(updateSql, [now, attendanceId]); // ✅ FIX: db.query()

    res.json({ message: 'บันทึกเวลาออกงานสำเร็จ', clockOutTime: now });
    io.emit(`attendance_updated_${userId}`); 
    io.emit('attendance_updated_admin'); 

  } catch (err) {
    console.error(`Clock-out error for user ${userId}:`, err);
    res.status(500).json({ error: 'ไม่สามารถบันทึกเวลาออกงานได้' });
  }
});

app.get('/api/attendance', requireAuth, async (req, res) => {
    if (req.user.role !== 'Admin') {
        return res.status(403).json({ error: 'Permission denied' });
    }
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
       const [results] = await db.query(sql, params); // ✅ FIX: db.query()
       res.json(results);
   } catch (err) {
       console.error("Error fetching attendance report:", err);
       res.status(500).json({ error: 'Could not fetch attendance report' });
   }
});

app.get('/api/attendance/summary', requireAuth, async (req, res) => {
    if (req.user.role !== 'Admin') {
         console.warn(`Permission denied for user ${req.user.id} (role: ${req.user.role}) trying to access attendance summary.`);
         return res.status(403).json({ error: 'Permission denied. Admin only.' });
    }
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
        const [results] = await db.query(sql, params); // ✅ FIX: db.query()
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
// STOCK HISTORY/SUMMARY API (✅ FIX: เปลี่ยน db.promise().query() เป็น db.query())
// ============================
app.get('/api/stock/summary', requireAuth, async (req, res) => {
    if (req.user.role !== 'Admin') {
        return res.status(403).json({ error: 'Permission denied. Admin only.' });
    }
    const { menuId, startDate, endDate, groupBy = 'day' } = req.query;
    if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Start date and end date are required.' });
    }
    if (!['day', 'month', 'year'].includes(groupBy)) {
         return res.status(400).json({ error: 'Invalid groupBy value. Use "day", "month", or "year".' });
    }
    let dateColumn;
    switch (groupBy) {
        case 'month': dateColumn = 'DATE_FORMAT(timestamp, "%Y-%m-01")'; break;
        case 'year': dateColumn = 'DATE_FORMAT(timestamp, "%Y-01-01")'; break;
        default: dateColumn = 'DATE(timestamp)'; break;
    }
    let sql = `
        SELECT
            ${dateColumn} AS period_start,
            m.menu_id, m.menu_name,
            COALESCE(SUM(CASE WHEN sl.change_quantity > 0 THEN sl.change_quantity ELSE 0 END), 0) AS total_in,
            COALESCE(SUM(CASE WHEN sl.change_quantity < 0 THEN ABS(sl.change_quantity) ELSE 0 END), 0) AS total_out,
            (SELECT sl_prev.new_quantity
             FROM stock_logs sl_prev
             WHERE sl.menu_id = sl.menu_id AND sl_prev.timestamp < DATE_ADD(DATE(${dateColumn}), INTERVAL 1 DAY)
             ORDER BY sl_prev.timestamp DESC, sl_prev.log_id DESC
             LIMIT 1
            ) AS ending_balance
        FROM stock_logs sl
        JOIN menu m ON sl.menu_id = m.menu_id
        WHERE sl.timestamp BETWEEN ? AND ?
    `;
    const params = [`${startDate} 00:00:00`, `${endDate} 23:59:59`];
    if (menuId && menuId !== '') {
        sql += " AND sl.menu_id = ?";
        params.push(menuId);
    }
    sql += ` GROUP BY period_start, m.menu_id, m.menu_name ORDER BY period_start ASC, m.menu_name ASC;`;
    try {
        const [results] = await db.query(sql, params); // ✅ FIX: db.query()
        const formattedResults = results.map(row => ({
            period_start: row.period_start, 
            menu_id: row.menu_id,
            menu_name: row.menu_name,
            period_label: format(new Date(row.period_start), groupBy === 'day' ? 'dd/MM/yy' : (groupBy === 'month' ? 'MMM yyyy' : 'yyyy'), { locale: th }),
            total_in: parseInt(row.total_in, 10),
            total_out: parseInt(row.total_out, 10),
            ending_balance: row.ending_balance !== null ? parseInt(row.ending_balance, 10) : null
        }));
        res.json(formattedResults);
    } catch (err) {
        console.error("Error fetching stock summary:", err);
        res.status(500).json({ error: 'Could not fetch stock summary data' });
    }
});

app.get('/api/stock/history/:menuId', requireAuth, async (req, res) => {
     if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Permission denied.' });
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
         const [logs] = await db.query(sql, params); // ✅ FIX: db.query()
         res.json(logs);
     } catch(err) {
         console.error(`Error fetching stock history for menu ${menuId}:`, err);
         res.status(500).json({ error: 'Could not fetch stock history' });
     }
});

// ============================
// 5. START SERVER
// ============================
const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});
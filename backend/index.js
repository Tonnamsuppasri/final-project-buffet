const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const app = express();
const bcrypt = require('bcrypt');
const saltRounds = 10;
const { format } = require('date-fns'); // 👈 Import format function
const { th } = require('date-fns/locale'); // 👈 Import Thai locale

// ✅ 1. IMPORT HTTP & SOCKET.IO
const http = require('http');
const { Server } = require("socket.io");

// Middleware
const allowedOrigins = [
  'http://localhost:5173',          // สำหรับตอนพัฒนาบนคอม
  'http://192.168.0.101:5173',   // ⭐️ เพิ่ม IP มือถือ/Network ของคุณ
  'http://10.160.136.160:5173'
  // เพิ่ม IP อื่นๆ ที่คุณอาจใช้ในอนาคตที่นี่
];

const corsOptions = {
  origin: allowedOrigins, // ⬅️ ⭐️ ใช้ Array ตรงๆ
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // ⬅️ ⭐️ เพิ่ม 'OPTIONS' ให้ชัดเจน
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-User-Id'], // ⬅️ ⭐️ เพิ่ม Header ที่จำเป็น (เผื่ออนาคต)
};

// ✅ 2. สร้าง Server
const server = http.createServer(app);
const io = new Server(server, {
  cors: corsOptions // ⬅️ ⭐️ ใช้ corsOptions ที่นี่
});

// ✅ 3. ใช้งาน CORS Middleware (สำคัญมาก)

// ⭐️ 3.1) เปิดรับ OPTIONS request (Preflight)
app.options(/.*/, cors(corsOptions));

// ⭐️ 3.2) ใช้งาน CORS สำหรับ request อื่นๆ
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
});

db.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Database connection failed:', err);
  } else {
    console.log('✅ Connected to MySQL database (using connection pool)');
    connection.release(); // คืน connection กลับเข้า pool
  }
});

// ============================
// ✅ 3. SOCKET.IO CONNECTION HANDLER
// ============================

// [FIX] เพิ่ม Cache สำหรับการ Join ของลูกค้า (แก้ปัญหา Strict Mode)
// โครงสร้าง: { 'orderId-sessionId': customerName }
const orderSessionCache = new Map();

io.on('connection', (socket) => {
  console.log(`✅ User connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`❌ User disconnected: ${socket.id}`);
  });

  // ⭐ Listener for staff call (for billing)
  socket.on('call_for_bill', (data) => {
    // data = { tableId: 1, tableNumber: 'A1' }
    console.log(`🚀 Table ${data.tableNumber} (ID: ${data.tableId}) is calling for the bill!`);
    
    // ✅ EMIT THE NOTIFICATION EVENT
    io.emit('notification', {
      message: `โต๊ะ ${data.tableNumber} เรียกเก็บเงิน!`,
      type: 'call_bill',
      linkTo: '/PaymentPage' // Link to the payment page
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
app.get('/api/shop', (req, res) => {
    const sql = "SELECT shop_name, shop_address, shop_phone, open_time, close_time, payment_qr_code, shop_logo FROM shop WHERE id = 1";
    db.query(sql, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.length === 0) return res.status(404).json({ message: 'Shop info not found' });
        const shopData = result[0];
        shopData.payment_qr_code = bufferToBase64(shopData.payment_qr_code);
        shopData.shop_logo = bufferToBase64(shopData.shop_logo);
        res.json(shopData);
    });
});

app.put('/api/shop', (req, res) => {
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
    db.query(sql, params, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        console.log('🚀 Emitting shop_updated');
        io.emit('shop_updated');
        res.json({ message: 'Shop info updated successfully' });
    });
});


// ============================
// Login API
// ============================
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const sqlUser = 'SELECT * FROM users WHERE username = ?';
  db.query(sqlUser, [username], async (err, users) => {
    if (err) return res.status(500).json({ error: err });
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
  });
});

// ============================
// Staff & User API
// ============================
app.get('/api/user/:id', (req, res) => {
  const { id } = req.params;
  const sql = `SELECT id, username, role, phone, email, first_name, last_name, nickname, image FROM users WHERE id = ?`;
  db.query(sql, [id], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    if (result.length === 0) return res.status(404).json({ message: 'User not found' });
    const user = result[0];
    user.image = bufferToBase64(user.image);
    res.json(user);
  });
});

app.get('/api/staff', (req, res) => {
  const sql = `SELECT id, username, role, phone, email, first_name, last_name, nickname, image FROM users`;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json({ error: 'Error fetching staff data' });
    const staff = result.map(user => ({ ...user, image: bufferToBase64(user.image) }));
    res.json(staff);
  });
});

app.post('/api/staff', async (req, res) => {
  const { username, email, password, phone, role, first_name, last_name, nickname, image } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const imageBuffer = image ? Buffer.from(image, 'base64') : null;
    const sql = `INSERT INTO users (username, email, password, phone, role, first_name, last_name, nickname, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    db.query(sql, [username, email, hashedPassword, phone, role, first_name, last_name, nickname, imageBuffer], (err, result) => {
      if (err) return res.status(500).json({ error: 'Could not add staff member' });
      console.log('🚀 Emitting staff_updated');
      io.emit('staff_updated');
      res.status(201).json({ id: result.insertId });
    });
  } catch (error) {
    res.status(500).json({ error: "Server error during password hashing." });
  }
});

app.put('/api/staff/:id', async (req, res) => {
    const { id } = req.params;
    const { username, email, phone, role, first_name, last_name, nickname, image, newPassword } = req.body;
    let params = [username, email, phone, role, first_name, last_name, nickname, image ? Buffer.from(image, 'base64') : null];
    let sql = `UPDATE users SET username = ?, email = ?, phone = ?, role = ?, first_name = ?, last_name = ?, nickname = ?, image = ?`;
    if (newPassword) {
        try {
            const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
            sql += `, password = ?`;
            params.push(hashedPassword);
        } catch (hashError) {
            return res.status(500).json({ error: "Server error during password hashing." });
        }
    }
    sql += ` WHERE id = ?`;
    params.push(id);
    db.query(sql, params, (err, result) => {
        if (err) return res.status(500).json({ error: 'Could not update staff member' });
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Staff member not found' });
        console.log('🚀 Emitting staff_updated');
        io.emit('staff_updated');
        res.json({ message: 'Staff member updated successfully', id: id });
    });
});

app.delete('/api/staff/:id', (req, res) => {
  const { id } = req.params;
  const sql = 'DELETE FROM users WHERE id = ?';
  db.query(sql, [id], (err, result) => {
    if (err) return res.status(500).json({ error: 'Could not delete staff member' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Staff member not found' });
    console.log('🚀 Emitting staff_updated');
    io.emit('staff_updated');
    res.json({ message: 'Staff member deleted successfully', id: id });
  });
});

// ============================
// MENU API
// ============================
app.get('/api/menu', (req, res) => {
    const sql = "SELECT * FROM menu ORDER BY menu_category, menu_name";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        const menuWithImages = results.map(item => ({
            ...item,
            menu_image: bufferToBase64(item.menu_image)
        }));
        res.json(menuWithImages);
    });
});

app.post('/api/menu', (req, res) => {
    const { menu_name, menu_description, menu_category, price, menu_quantity, menu_image } = req.body;
    const imageBuffer = menu_image ? Buffer.from(menu_image, 'base64') : null;
    const sql = "INSERT INTO menu (menu_name, menu_description, menu_category, price, menu_quantity, menu_image) VALUES (?, ?, ?, ?, ?, ?)";
    db.query(sql, [menu_name, menu_description || null, menu_category || null, price, menu_quantity || 0, imageBuffer], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        console.log('🚀 Emitting menu_updated');
        io.emit('menu_updated');
        res.status(201).json({ message: 'Menu item added successfully', menu_id: result.insertId });
    });
});

app.put('/api/menu/:id', async (req, res) => { // Make it async
    const { id } = req.params;
    const { menu_name, menu_description, menu_category, price, menu_quantity, menu_image } = req.body; // menu_quantity is the NEW quantity
    const imageBuffer = menu_image ? Buffer.from(menu_image, 'base64') : null;

    // --- Get current quantity BEFORE updating ---
    let currentQuantity = null;
    try {
        const [menuResult] = await db.promise().query("SELECT menu_quantity FROM menu WHERE menu_id = ?", [id]);
        if (menuResult.length > 0) {
            currentQuantity = menuResult[0].menu_quantity;
        } else {
             return res.status(404).json({ message: 'Menu item not found for getting current stock' });
        }
    } catch(err) {
         console.error("Error getting current stock before update:", err);
         return res.status(500).json({ error: "Failed to get current stock" });
    }
    // --- End Get current quantity ---


    const sqlUpdate = "UPDATE menu SET menu_name = ?, menu_description = ?, menu_category = ?, price = ?, menu_quantity = ?, menu_image = ? WHERE menu_id = ?";
    const paramsUpdate = [
        menu_name,
        menu_description || null,
        menu_category || null,
        price,
        // Ensure menu_quantity sent to DB is number or null
         menu_quantity === null || menu_quantity === '' ? null : Number(menu_quantity),
        imageBuffer,
        id
    ];

    db.query(sqlUpdate, paramsUpdate, async (errUpdate, resultUpdate) => { // Add async here too
        if (errUpdate) return res.status(500).json({ error: errUpdate.message });
        if (resultUpdate.affectedRows === 0) return res.status(404).json({ message: 'Menu item not found for update' });

        // --- 👇 Log stock change if quantity was managed and changed 👇 ---
        const newQuantityDb = menu_quantity === null || menu_quantity === '' ? null : Number(menu_quantity);
        if (newQuantityDb !== null && currentQuantity !== newQuantityDb) {
            const changeQuantity = (currentQuantity === null ? 0 : currentQuantity) - newQuantityDb; // Calculate difference
            const logSql = "INSERT INTO stock_logs (menu_id, change_quantity, new_quantity, reason, user_id, timestamp) VALUES (?, ?, ?, ?, ?, NOW())";
            // Assuming you have user ID from requireAuth middleware
            const adminUserId = req.user?.id || null; // Get user ID who made the change
            try {
                await db.promise().query(logSql, [id, changeQuantity * -1, newQuantityDb, 'adjustment', adminUserId]); // Multiply by -1 to show increase/decrease correctly
                console.log(`Stock log created for menu ${id}. Change: ${changeQuantity * -1}, New Qty: ${newQuantityDb}`);
            } catch (logErr) {
                console.error(`Error creating stock log for menu ${id} after manual update:`, logErr);
                // Don't fail the whole request, but log the error
            }
        }
        // --- 👆 End log stock change 👆 ---

        console.log('🚀 Emitting menu_updated');
        io.emit('menu_updated');
        res.json({ message: 'Menu item updated successfully' });
    });
});

app.delete('/api/menu/:id', (req, res) => {
    const { id } = req.params;
    const sql = "DELETE FROM menu WHERE menu_id = ?";
    db.query(sql, [id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Menu item not found' });
        console.log('🚀 Emitting menu_updated');
        io.emit('menu_updated');
        res.json({ message: 'Menu item deleted successfully' });
    });
});

// ============================
// ORDERS API
// ============================
app.post('/api/orders', (req, res) => {
  const { table_id, customer_quantity, plan_id, service_type } = req.body;
  const sql = `INSERT INTO orders (table_id, customer_quantity, plan_id, service_type, start_time, order_status) VALUES (?, ?, ?, ?, NOW(), 'in-progress')`;
  db.query(sql, [table_id, customer_quantity, plan_id, service_type], (err, result) => {
    if (err) return res.status(500).json({ error: 'Could not create order' });
    const updateTableSql = "UPDATE tables SET status = 'ไม่ว่าง' WHERE table_id = ?";
    db.query(updateTableSql, [table_id], (updateErr) => {
        if (!updateErr) {
            console.log('🚀 Emitting tables_updated (new order)');
            io.emit('tables_updated');

            // ✅ --- START: ADDED NOTIFICATION (OPEN TABLE) ---
            // Get table number for the notification message
            const getTableSql = "SELECT table_number FROM tables WHERE table_id = ?";
            db.query(getTableSql, [table_id], (tableErr, tableResult) => {
                if (!tableErr && tableResult.length > 0) {
                    const tableNumber = tableResult[0].table_number;
                    io.emit('notification', {
                        message: `โต๊ะ ${tableNumber} ได้เปิดใช้งานใหม่`,
                        type: 'new_order', // 'new_order' or 'open_table'
                        linkTo: '/table' // Link to the table status page
                    });
                }
            });
            // ✅ --- END: ADDED NOTIFICATION (OPEN TABLE) ---
        }
    });
    res.status(201).json({ message: 'Order created successfully', order_id: result.insertId });
  });
});

app.get('/api/orders/active', (req, res) => {
    // [FIX] Changed JOIN to LEFT JOIN for pricing_plans
    const sql = `
        SELECT
            o.order_id,
            o.customer_quantity,
            o.service_type,
            o.start_time,
            o.order_status,
            t.table_id,
            t.table_number,
            t.uuid,
            p.plan_name,
            p.price_per_person
        FROM orders o
        JOIN tables t ON o.table_id = t.table_id
        LEFT JOIN pricing_plans p ON o.plan_id = p.id 
        WHERE o.order_status = 'in-progress'
        ORDER BY o.start_time ASC
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/api/orders/:orderId/details', (req, res) => {
    const { orderId } = req.params;
    const orderDetails = req.body; // Expecting an array of items
    if (!Array.isArray(orderDetails) || orderDetails.length === 0) {
        return res.status(400).json({ error: 'Invalid order details format. Expected an array.' });
    }
    const values = orderDetails.map(item => [
        orderId,
        item.menu_id,
        item.quantity,
        item.price_per_item,
        'กำลังจัดทำ', // Default item_status
        item.customer_name || null // Get customer_name from request
    ]);
    // Added customer_name to the INSERT query
    const sql = "INSERT INTO order_details (order_id, menu_id, quantity, price_per_item, item_status, customer_name) VALUES ?";
    db.query(sql, [values], (err, result) => {
        if (err) {
            console.error("Order Detail Insert Error:", err.message);
            return res.status(500).json({ error: err.message });
        }
        
        // ✅ --- START: NOTIFICATION LOGIC (NEW ITEM) ---
        // We need the table number for a good notification
        const findTableSql = `
          SELECT t.table_number 
          FROM orders o
          JOIN tables t ON o.table_id = t.table_id
          WHERE o.order_id = ?
        `;
        
        db.query(findTableSql, [orderId], (tableErr, tableResult) => {
          let message = `มีออเดอร์ใหม่สำหรับ Order #${orderId}`; // Fallback message
          
          if (!tableErr && tableResult.length > 0) {
            const tableNumber = tableResult[0].table_number;
            message = `โต๊ะ ${tableNumber} สั่งอาหารเพิ่ม (Order #${orderId})`;
          }
          
          // Send Notification
          io.emit('notification', {
            message: message,
            type: 'new_order',
            linkTo: '/order' // Link to the order kitchen page
          });
        });
        // ✅ --- END: NOTIFICATION LOGIC (NEW ITEM) ---

        console.log(`🚀 Emitting new_order_item for order ${orderId}`);
        io.emit('new_order_item', { orderId: orderId, items: orderDetails });
        res.status(201).json({ message: 'Order details added successfully', affectedRows: result.affectedRows });
    });
});


app.get('/api/orders/:orderId/details', (req, res) => {
    const { orderId } = req.params;
    // [FIX] Changed JOIN to LEFT JOIN for menu
    const sql = `
        SELECT
            od.order_detail_id,
            od.quantity,
            od.item_status,
            od.created_at,
            od.price_per_item, 
            od.customer_name, 
            m.menu_name,
            m.menu_image
        FROM order_details od
        LEFT JOIN menu m ON od.menu_id = m.menu_id
        WHERE od.order_id = ?
        ORDER BY od.created_at DESC
    `;
    db.query(sql, [orderId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        const detailsWithImages = results.map(item => ({
            ...item,
            menu_image: bufferToBase64(item.menu_image)
        }));
        res.json(detailsWithImages);
    });
});

// [MODIFIED] This endpoint is now idempotent (fixes Strict Mode bug)
app.post('/api/orders/:orderId/join', async (req, res) => { // ⭐ ใช้ async
  const { orderId } = req.params;
  const { sessionId } = req.body; // Get the client's unique session ID

  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required' });
  }

  // 1. Check cache first
  const mapKey = `${orderId}-${sessionId}`;
  if (orderSessionCache.has(mapKey)) {
    return res.json({ customerName: orderSessionCache.get(mapKey) });
  }

  // ⭐ 2. Get a connection from the pool
  let connection;
  try {
    connection = await db.promise().getConnection(); // ใช้ await กับ promise pool
    await connection.beginTransaction(); // ⭐ Start transaction on the connection

    // 3. Select and lock the row within the transaction
    const selectSql = "SELECT customer_join_count FROM orders WHERE order_id = ? FOR UPDATE";
    const [results] = await connection.query(selectSql, [orderId]); // ⭐ ใช้ connection.query

    if (results.length === 0) {
      await connection.rollback(); // ⭐ Rollback on the connection
      connection.release(); // ⭐ Release connection
      return res.status(404).json({ message: 'Order not found' });
    }

    const currentCount = results[0].customer_join_count;
    const newCount = currentCount + 1;
    const customerLetter = String.fromCharCode(64 + newCount); // 1 -> 'A', 2 -> 'B'
    const customerName = `ลูกค้า ${customerLetter}`;

    // 4. Update the count within the transaction
    const updateSql = "UPDATE orders SET customer_join_count = ? WHERE order_id = ?";
    await connection.query(updateSql, [newCount, orderId]); // ⭐ ใช้ connection.query

    // 5. Commit the transaction
    await connection.commit(); // ⭐ Commit on the connection

    // 6. Save to cache AND send response
    orderSessionCache.set(mapKey, customerName);
    io.emit('tables_updated'); // Consider if this is needed here or just on order creation/payment
    res.json({ customerName: customerName });

  } catch (err) {
    console.error(`Error joining order ${orderId}:`, err);
    // If an error occurred, rollback the transaction
    if (connection) {
      await connection.rollback(); // ⭐ Rollback on the connection
    }
    res.status(500).json({ error: 'Failed to process join request' });
  } finally {
    // ⭐ 7. ALWAYS release the connection back to the pool
    if (connection) {
      connection.release();
    }
  }
});


app.put('/api/order-details/:detailId/deliver', (req, res) => {
    const { detailId } = req.params;
    const sql = "UPDATE order_details SET item_status = 'จัดส่งแล้ว' WHERE order_detail_id = ?";
    db.query(sql, [detailId], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Order detail item not found' });
        console.log(`🚀 Emitting item_status_updated for detail ${detailId}`);
        io.emit('item_status_updated', { detailId: detailId, newStatus: 'จัดส่งแล้ว' });
        res.json({ message: 'Item status updated successfully' });
    });
});

// ============================
// [REMOVED OLD DELETE ENDPOINT]
// ============================

// ============================
// [✅ NEW DELETE ENDPOINT with AUTO_INCREMENT reset]
// ============================
app.delete('/api/orders/:orderId', (req, res) => {
    const { orderId } = req.params;

    // Helper function for the last step
    const updateTableStatus = (tableId, res, successMessage) => {
        const updateTableSql = "UPDATE tables SET status = 'ว่าง' WHERE table_id = ?";
        db.query(updateTableSql, [tableId], (updateErr) => {
            if (!updateErr) {
                console.log('🚀 Emitting tables_updated (order cancelled)');
                io.emit('tables_updated');
            }
            if (updateErr) {
                console.error("Failed to update table status for table_id:", tableId);
                return res.json({ message: 'Order cancelled, but failed to update table status' });
            }
            res.json({ message: successMessage });
        });
    };

    // 1. Find the table associated with the order
    const findTableSql = "SELECT table_id FROM orders WHERE order_id = ? AND order_status = 'in-progress'";
    db.query(findTableSql, [orderId], (err, orders) => {
        if (err) return res.status(500).json({ error: 'Error finding order' });
        if (orders.length === 0) return res.status(404).json({ message: 'Active order not found or already completed' });
        
        const tableId = orders[0].table_id;

        // 2. Check if this is the max order_id
        const getMaxOrderIdSql = "SELECT MAX(order_id) as max_id FROM orders";
        db.query(getMaxOrderIdSql, (maxIdErr, maxIdResult) => {
            let isMaxId = false;
            if (maxIdErr) {
                 console.error("Error checking max order_id:", maxIdErr);
                 // Continue with deletion anyway, just don't reset auto_increment
            } else {
                isMaxId = (maxIdResult[0].max_id == orderId);
            }

            // 3. Delete details
            const deleteDetailsSql = "DELETE FROM order_details WHERE order_id = ?";
            db.query(deleteDetailsSql, [orderId], (deleteDetailsErr) => {
                if (deleteDetailsErr) return res.status(500).json({ error: 'Could not delete order details' });

                // 4. Delete order
                const deleteOrderSql = "DELETE FROM orders WHERE order_id = ?";
                db.query(deleteOrderSql, [orderId], (deleteErr, result) => {
                    if (deleteErr) return res.status(500).json({ error: 'Could not delete order' });
                    if (result.affectedRows === 0) return res.status(404).json({ message: 'Order not found for deletion' });

                    // 5. If it was the max ID, get the *new* max ID and reset auto_increment
                    if (isMaxId) {
                        const getNewMaxIdSql = "SELECT COALESCE(MAX(order_id), 0) + 1 as next_id FROM orders";
                        db.query(getNewMaxIdSql, (newMaxErr, newMaxResult) => {
                            if (!newMaxErr && newMaxResult.length > 0) {
                                const nextId = newMaxResult[0].next_id;
                                const resetId = Math.max(1, nextId); // Auto-increment should be at least 1
                                const alterSql = `ALTER TABLE orders AUTO_INCREMENT = ?`;
                                db.query(alterSql, [resetId], (alterErr) => {
                                    if (alterErr) console.error("Failed to reset AUTO_INCREMENT:", alterErr);
                                    else console.log(`🚀 AUTO_INCREMENT reset to ${resetId}`);
                                    
                                    // 6. Update table status
                                    updateTableStatus(tableId, res, 'Order cancelled, table status updated, and AUTO_INCREMENT reset.');
                                });
                            } else {
                                // Failed to get new max, just update table status
                                updateTableStatus(tableId, res, 'Order cancelled, but failed to reset auto_increment');
                            }
                        });
                    } else {
                        // Not the max ID, just update table status
                        updateTableStatus(tableId, res, 'Order cancelled and table status updated successfully');
                    }
                });
            });
        });
    });
});

// ============================
// PAYMENT API
// ============================
app.get('/api/payments', (req, res) => {
    const { searchTerm, startDate, endDate } = req.query;
    let sql = `
        SELECT
            p.payment_id,
            p.order_id,
            p.payment_time,
            p.total_price,
            p.payment_method,
            t.table_number,
            o.customer_quantity
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

    db.query(sql, params, (err, results) => {
        if (err) {
            console.error("Error fetching payments:", err);
            return res.status(500).json({ error: 'Error fetching payment data' });
        }
        res.json(results);
    });
});

app.get('/api/payments/:id', (req, res) => {
    const { id } = req.params; // This is payment_id
    const paymentDetailsSql = `
        SELECT
            p.payment_id,
            p.order_id,
            p.payment_time,
            p.total_price,
            p.payment_method,
            o.customer_quantity,
            o.service_type,
            o.start_time,
            t.table_number,
            pp.plan_name
        FROM payment p
        JOIN orders o ON p.order_id = o.order_id
        JOIN tables t ON o.table_id = t.table_id
        LEFT JOIN pricing_plans pp ON o.plan_id = pp.id
        WHERE p.payment_id = ?
    `;

    db.query(paymentDetailsSql, [id], (err, paymentResult) => {
        if (err) {
            console.error("Error fetching payment details:", err);
            return res.status(500).json({ error: 'Error fetching payment details' });
        }
        if (paymentResult.length === 0) {
            return res.status(404).json({ message: 'Payment record not found' });
        }
        const paymentDetails = paymentResult[0];
        const orderId = paymentDetails.order_id;

        const menuItemsSql = `
            SELECT
                od.quantity,
                od.price_per_item,
                m.menu_name
            FROM order_details od
            LEFT JOIN menu m ON od.menu_id = m.menu_id
            WHERE od.order_id = ?
        `;

        db.query(menuItemsSql, [orderId], (menuErr, menuResult) => {
            if (menuErr) {
                console.error("Error fetching menu items for payment:", menuErr);
                return res.status(500).json({ error: 'Error fetching associated menu items' });
            }
            res.json({ details: paymentDetails, menuItems: menuResult });
        });
    });
});

app.post('/api/payment', async (req, res) => { // ⭐ ใช้ async
  // ⭐ รับแค่ order_id และ payment_method จาก Frontend
  const { order_id, payment_method } = req.body;

  if (!order_id) {
    return res.status(400).json({ error: 'Missing required payment information (order_id)' });
  }

  try {
    // 1. ดึงข้อมูล Order และ ราคา Plan (ถ้ามี)
    const getOrderSql = "SELECT o.customer_quantity, o.plan_id, pp.price_per_person " +
                        "FROM orders o " +
                        "LEFT JOIN pricing_plans pp ON o.plan_id = pp.id " +
                        "WHERE o.order_id = ?";

    const [orderResult] = await db.promise().query(getOrderSql, [order_id]);

    if (orderResult.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderData = orderResult[0];
    // ⭐ FIX: แปลงเป็นตัวเลข
    const customerQuantity = parseInt(orderData.customer_quantity || '0', 10);
    const pricePerPerson = parseFloat(orderData.price_per_person || '0');

    // คำนวณยอดจากบุฟเฟต์
    const buffetTotal = customerQuantity * pricePerPerson;

    // 2. คำนวณยอดรวมจากเมนู A la carte (เฉพาะรายการที่มีราคา > 0)
    const getAlaCarteSql = "SELECT COALESCE(SUM(quantity * price_per_item), 0) AS aLaCarteTotal " +
                           "FROM order_details " +
                           "WHERE order_id = ? AND price_per_item > 0";

    const [alaCarteResult] = await db.promise().query(getAlaCarteSql, [order_id]);
    // ⭐ FIX: แปลงเป็นตัวเลข
    const aLaCarteTotal = parseFloat(alaCarteResult[0].aLaCarteTotal || '0');

    // 3. คำนวณยอดรวมสุดท้าย (ควรจะเป็น Number แล้ว)
    const finalTotalPrice = buffetTotal + aLaCarteTotal;

    // Optional: Log calculated values for debugging
    // console.log(`Order ID: ${order_id}, Buffet: ${buffetTotal}, A La Carte: ${aLaCarteTotal}, Final Total: ${finalTotalPrice}`);

    // 4. บันทึกการชำระเงินลง Database
    const insertPaymentSql = "INSERT INTO payment (order_id, payment_time, total_price, payment_method) VALUES (?, NOW(), ?, ?)";

    const [insertResult] = await db.promise().query(insertPaymentSql, [order_id, finalTotalPrice, payment_method || null]);
    const paymentId = insertResult.insertId;

    try { // Wrap stock deduction in its own try/catch to avoid failing payment if stock fails
        // --- 👇 Deduct stock and log changes for sold items 👇 ---
        const getOrderDetailsSql = "SELECT od.order_detail_id, od.menu_id, od.quantity, m.menu_quantity AS current_stock " +
                                   "FROM order_details od " +
                                   "JOIN menu m ON od.menu_id = m.menu_id " +
                                   "WHERE od.order_id = ? AND m.menu_quantity IS NOT NULL"; // Only items tracking stock

        const [detailsToDeduct] = await db.promise().query(getOrderDetailsSql, [order_id]);

        for (const detail of detailsToDeduct) {
            if (detail.current_stock !== null) { // Double check if stock is tracked
                const soldQuantity = detail.quantity;
                const newQuantity = detail.current_stock - soldQuantity;

                // Update stock in menu table
                const updateStockSql = "UPDATE menu SET menu_quantity = ? WHERE menu_id = ?";
                await db.promise().query(updateStockSql, [newQuantity, detail.menu_id]);

                // Log the change
                const logSql = "INSERT INTO stock_logs (menu_id, change_quantity, new_quantity, reason, order_detail_id, timestamp) VALUES (?, ?, ?, ?, ?, NOW())";
                await db.promise().query(logSql, [detail.menu_id, -soldQuantity, newQuantity, 'sale', detail.order_detail_id]); // Negative change for sale

                console.log(`Stock updated & logged for menu ${detail.menu_id} (Sale). Change: ${-soldQuantity}, New Qty: ${newQuantity}`);
                // Maybe emit a stock_updated event if needed elsewhere
                // io.emit('stock_updated', { menuId: detail.menu_id, newQuantity });
            }
        }
        // --- 👆 End deduct stock 👆 ---
    } catch(stockErr) {
        console.error(`Error deducting stock or logging for order ${order_id} after payment:`, stockErr);
        // Decide if this should cause the payment response to indicate a partial success/warning
    }
    // [FIX] Clear session cache
    for (const key of orderSessionCache.keys()) {
      if (key.startsWith(`${order_id}-`)) {
        orderSessionCache.delete(key);
      }
    }

    // อัปเดตสถานะ Order เป็น 'completed'
    const updateOrderStatusSql = "UPDATE orders SET order_status = 'completed' WHERE order_id = ?";
    await db.promise().query(updateOrderStatusSql, [order_id]);

    // อัปเดตสถานะ Table เป็น 'ว่าง' และส่ง Notification/Socket Event
    const updateTableSql = `UPDATE tables t JOIN orders o ON t.table_id = o.table_id SET t.status = 'ว่าง' WHERE o.order_id = ?`;
    const [updateTableResult] = await db.promise().query(updateTableSql, [order_id]);

    if (updateTableResult.affectedRows > 0) {
      console.log('🚀 Emitting tables_updated (payment complete)');
      io.emit('tables_updated');
      console.log('🚀 Emitting new_payment');
      io.emit('new_payment', { paymentId: paymentId, orderId: order_id, totalPrice: finalTotalPrice });

      // ส่ง Notification ปิดโต๊ะ
      const getTableSql = `SELECT t.table_number FROM orders o JOIN tables t ON o.table_id = t.table_id WHERE o.order_id = ?`;
      const [tableResult] = await db.promise().query(getTableSql, [order_id]);
      if (tableResult.length > 0) {
        const tableNumber = tableResult[0].table_number;
        // ⭐ ใช้ finalTotalPrice ที่เป็น Number แล้ว
        io.emit('notification', {
          message: `โต๊ะ ${tableNumber} ได้ชำระเงินและปิดโต๊ะแล้ว ยอดรวม ${finalTotalPrice.toFixed(2)} บาท`,
          type: 'close_table',
          linkTo: '/PaymentPage'
        });
      }
    }

    // ส่ง Response กลับไปหา Frontend
    res.status(201).json({
      message: 'Payment recorded and status updated successfully',
      payment_id: paymentId,
      calculated_total_price: finalTotalPrice
    });

  } catch (err) {
    console.error(`Error processing payment for order ${order_id}:`, err); // Log error with order_id
    res.status(500).json({ error: 'Error processing payment', details: err.message }); // Send details in response
  }
});

// ==========================================
// ✅ START: REPORTS API (เวอร์ชันแก้ไข ต่อ String)
// ==========================================

// 1. Helper function to validate dates (สำคัญมาก!)
const getDates = (req) => {
  let { startDate, endDate } = req.query;
  
  if (!startDate) {
    startDate = new Date().toISOString().split('T')[0]; // Today
  }
  if (!endDate) {
    endDate = new Date().toISOString().split('T')[0]; // Today
  }
  
  // [FIX] ปรับการกรองวันที่ให้ครอบคลุมถึงสิ้นวัน
  return [startDate, `${endDate} 23:59:59`];
};

// --- 2. Report Overview (Dashboard) ---

// API: /api/reports/overview/stats
app.get('/api/reports/overview/stats', (req, res) => {
  const [startDate, endDate] = getDates(req);
  // [FIX] เปลี่ยนเป็น String ธรรมดาต่อกัน
  const sql = "SELECT " +
    "COALESCE(SUM(p.total_price), 0) AS totalSales, " +
    "COALESCE(COUNT(p.payment_id), 0) AS totalOrders, " +
    "COALESCE(SUM(o.customer_quantity), 0) AS totalCustomers, " +
    "COALESCE(SUM(p.total_price) / NULLIF(SUM(o.customer_quantity), 0), 0) AS avgPerCustomer " +
    "FROM payment p " +
    "JOIN orders o ON p.order_id = o.order_id " +
    "WHERE p.payment_time BETWEEN ? AND ?;";
  
  db.query(sql, [startDate, endDate], (err, result) => {
    if (err) {
      console.error("Error fetching overview stats:", err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json(result[0] || { totalSales: 0, totalOrders: 0, totalCustomers: 0, avgPerCustomer: 0 });
  });
});

// API: /api/reports/overview/payment-methods
app.get('/api/reports/overview/payment-methods', (req, res) => {
  const [startDate, endDate] = getDates(req);
  // [FIX] เปลี่ยนเป็น String ธรรมดาต่อกัน
  const sql = "SELECT " +
    "payment_method AS method, " +
    "SUM(total_price) AS total " +
    "FROM payment " +
    "WHERE payment_time BETWEEN ? AND ? AND payment_method IS NOT NULL " +
    "GROUP BY payment_method " +
    "HAVING total > 0;";
  
  db.query(sql, [startDate, endDate], (err, results) => {
    if (err) {
      console.error("Error fetching payment methods:", err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

// API: /api/reports/overview/plan-popularity
app.get('/api/reports/overview/plan-popularity', (req, res) => {
  const [startDate, endDate] = getDates(req);
  // [FIX] เปลี่ยนเป็น String ธรรมดาต่อกัน
  const sql = "SELECT " +
    "COALESCE(pp.plan_name, 'A La Carte / อื่นๆ') AS plan_name, " +
    "SUM(o.customer_quantity) AS count " +
    "FROM orders o " +
    "JOIN payment p ON o.order_id = p.order_id " +
    "LEFT JOIN pricing_plans pp ON o.plan_id = pp.id " +
    "WHERE p.payment_time BETWEEN ? AND ? " +
    "GROUP BY pp.id, pp.plan_name " +
    "ORDER BY count DESC;";
  
  db.query(sql, [startDate, endDate], (err, results) => {
    if (err) {
      console.error("Error fetching plan popularity:", err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});


// --- 3. Report Sales (Sales Page) ---

// API: /api/reports/sales
app.get('/api/reports/sales', async (req, res) => {
  const [startDate, endDate] = getDates(req);
  
  try {
    // Query 1: Summary
    // [FIX] เปลี่ยนเป็น String ธรรมดาต่อกัน
    const summarySql = "SELECT " +
      "COALESCE(SUM(total_price), 0) AS totalSales, " +
      "COALESCE(COUNT(payment_id), 0) AS totalOrders, " +
      "COALESCE(SUM(total_price) / NULLIF(COUNT(payment_id), 0), 0) AS avgOrderValue " +
      "FROM payment " +
      "WHERE payment_time BETWEEN ? AND ?;";
    
    const [summaryResult] = await db.promise().query(summarySql, [startDate, endDate]);
    
    // Query 2: Daily Sales (for Line Chart)
    // [FIX] เปลี่ยนเป็น String ธรรมดาต่อกัน
    const dailySalesSql = "SELECT " +
      "DATE(payment_time) AS date, " +
      "SUM(total_price) AS total " +
      "FROM payment " +
      "WHERE payment_time BETWEEN ? AND ? " +
      "GROUP BY DATE(payment_time) " +
      "ORDER BY date ASC;";
    
    const [dailySales] = await db.promise().query(dailySalesSql, [startDate, endDate]);
    
    // Query 3: Payment Details (for Table)
    // [FIX] เปลี่ยนเป็น String ธรรมดาต่อกัน
    const paymentDetailsSql = "SELECT " +
      "p.payment_id, p.order_id, p.payment_time, p.total_price, p.payment_method, " +
      "t.table_number, o.customer_quantity " +
      "FROM payment p " +
      "JOIN orders o ON p.order_id = o.order_id " +
      "JOIN tables t ON o.table_id = t.table_id " +
      "WHERE p.payment_time BETWEEN ? AND ? " +
      "ORDER BY p.payment_time DESC;";
    
    const [paymentDetails] = await db.promise().query(paymentDetailsSql, [startDate, endDate]);
    
    // Send combined response
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


// --- 4. Report Menu (Menu/Buffet Page) ---

// API: /api/reports/menu/plans
app.get('/api/reports/menu/plans', (req, res) => {
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

  db.query(sql, [startDate, endDate], (err, results) => {
    if (err) {
      console.error("[/api/reports/menu/plans] SQL Error:", err.message);
      return res.status(500).json({ error: err.message });
    }

    // ⭐===== FIX: Convert potential strings to numbers =====⭐
    const processedResults = results.map(row => ({
      ...row,
      // Use parseFloat, ensuring null remains null, and convert valid strings to numbers
      price_per_person: row.price_per_person === null ? null : parseFloat(row.price_per_person),
      total_revenue: row.total_revenue === null ? null : parseFloat(row.total_revenue)
    }));
    // ⭐===== END FIX =====⭐

    // Optional: Log processed results for debugging
    // console.log(`\n[/api/reports/menu/plans] Processed Results for ${startDate} to ${endDate}:`);
    // console.log(JSON.stringify(processedResults, null, 2));

    res.json(processedResults); // Send the processed results
  });
});

// API: /api/reports/menu/items
app.get('/api/reports/menu/items', (req, res) => {
  const [startDate, endDate] = getDates(req); // endDate includes time up to 23:59:59

  // [FIX] Remove LIMIT 5 to get ALL items, still ordered by quantity
  const sql = "SELECT " +
    "m.menu_id, m.menu_name AS name, m.menu_category AS category, " +
    "SUM(od.quantity) AS total_quantity, " +
    "SUM(od.quantity * od.price_per_item) AS total_revenue " +
    "FROM order_details od " +
    "JOIN menu m ON od.menu_id = m.menu_id " +
    "WHERE od.created_at BETWEEN ? AND ? " +
    "GROUP BY m.menu_id, m.menu_name, m.menu_category " +
    "ORDER BY total_quantity DESC;"; // <-- ลบ LIMIT 5 ออกจากตรงนี้

  db.query(sql, [startDate, endDate], (err, results) => {
    if (err) {
      console.error("[/api/reports/menu/items] SQL Error:", err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

// ============================
// TABLES API
// ============================
app.get('/api/tables', (req, res) => {
    const sql = "SELECT * FROM tables ORDER BY table_number ASC";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// ⭐ Endpoint to get a single table by UUID
app.get('/api/tables/uuid/:uuid', (req, res) => {
  const { uuid } = req.params;
  const sql = "SELECT table_id, table_number, seat_capacity, status, uuid FROM tables WHERE uuid = ?";
  db.query(sql, [uuid], (err, results) => {
    if (err) {
      console.error("Error fetching table by UUID:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.length === 0) {
      // It's crucial to send 404 if not found
      return res.status(404).json({ message: 'Table not found for this UUID' });
    }
    res.json(results[0]); // Send the single table object
  });
});


app.post('/api/tables', (req, res) => {
    const { table_number, seat_capacity } = req.body;
    if (!table_number || seat_capacity === undefined || seat_capacity === null) {
         return res.status(400).json({ error: 'Missing table_number or seat_capacity' });
    }
    const newUuid = uuidv4();
    const sql = "INSERT INTO tables (uuid, table_number, seat_capacity, status) VALUES (?, ?, ?, 'ว่าง')";
    db.query(sql, [newUuid, table_number, seat_capacity], (err, result) => {
        if (err) {
            console.error("Error adding table:", err);
            return res.status(500).json({ error: 'Error adding table' });
        }
        console.log('🚀 Emitting tables_updated (new table added)');
        io.emit('tables_updated');
        res.status(201).json({ message: 'Table added successfully', table_id: result.insertId, uuid: newUuid, table_number, seat_capacity, status: 'ว่าง' });
    });
});

app.put('/api/tables/:id', (req, res) => {
    const { id } = req.params;
    const { table_number, seat_capacity, status } = req.body;
     if (!table_number || seat_capacity === undefined || seat_capacity === null || !status) {
         return res.status(400).json({ error: 'Missing required table information' });
    }
    const sql = "UPDATE tables SET table_number = ?, seat_capacity = ?, status = ? WHERE table_id = ?";
    db.query(sql, [table_number, seat_capacity, status, id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Table not found' });
        console.log('🚀 Emitting tables_updated (table edited)');
        io.emit('tables_updated');
        res.json({ message: 'Table updated successfully' });
    });
});

app.delete('/api/tables/:id', (req, res) => {
    const { id } = req.params;
    const checkOrdersSql = "SELECT COUNT(*) as orderCount FROM orders WHERE table_id = ? AND order_status = 'in-progress'";
    db.query(checkOrdersSql, [id], (checkErr, checkResult) => {
        if (checkErr) {
            return res.status(500).json({ error: 'Error checking for active orders' });
        }
        if (checkResult[0].orderCount > 0) {
            return res.status(400).json({ error: 'Cannot delete table with active orders' });
        }

        const sql = "DELETE FROM tables WHERE table_id = ?";
        db.query(sql, [id], (err, result) => {
            if (err) {
                 console.error("Error deleting table:", err);
                return res.status(500).json({ error: 'Could not delete table' });
            }
            if (result.affectedRows === 0) return res.status(404).json({ message: 'Table not found' });
            console.log('🚀 Emitting tables_updated (table deleted)');
            io.emit('tables_updated');
            res.json({ message: 'Table deleted successfully' });
        });
   });
});

// ============================
// PROMOTIONS API 🎉
// ============================

// GET /api/promotions - ดึงโปรโมชั่นทั้งหมด (กรองตามสถานะได้)
app.get('/api/promotions', (req, res) => {
  let sql = "SELECT * FROM promotions";
  const params = [];

  // เพิ่ม filter ?active=true หรือ ?active=false (optional)
  if (req.query.active === 'true') {
    sql += " WHERE is_active = 1";
  } else if (req.query.active === 'false') {
    sql += " WHERE is_active = 0";
  }

  sql += " ORDER BY end_date DESC, start_date DESC"; // เรียงตามวันที่สิ้นสุดล่าสุดก่อน

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error("Error fetching promotions:", err);
      return res.status(500).json({ error: 'Error fetching promotions data', details: err.message });
    }
    res.json(results);
  });
});

// GET /api/promotions/:id - ดึงโปรโมชั่นรายการเดียว (สำหรับหน้าแก้ไข)
app.get('/api/promotions/:id', (req, res) => {
  const { id } = req.params;
  const sql = "SELECT * FROM promotions WHERE promotion_id = ?";

  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error(`Error fetching promotion ${id}:`, err);
      return res.status(500).json({ error: 'Error fetching promotion data', details: err.message });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: 'Promotion not found' });
    }
    res.json(results[0]); // ส่งข้อมูล object เดียวกลับไป
  });
});


// POST /api/promotions - สร้างโปรโมชั่นใหม่
app.post('/api/promotions', (req, res) => {
  const { name, description, type, value, code, start_date, end_date, conditions } = req.body;

  // Basic Validation (ตรวจสอบข้อมูลที่จำเป็น)
  if (!name || !type || value === undefined || value === null || !start_date || !end_date) {
    return res.status(400).json({ error: 'Missing required promotion fields (name, type, value, start_date, end_date)' });
  }
  // เพิ่มเติม: ตรวจสอบ format วันที่/เวลา, type, value ให้ถูกต้อง

  const sql = "INSERT INTO promotions (name, description, type, value, code, start_date, end_date, conditions, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)"; // เริ่มต้นให้ active เลย
  const params = [
    name,
    description || null, // ถ้าไม่มี description ให้ใส่ NULL
    type,
    value,
    code || null, // ถ้าไม่มี code ให้ใส่ NULL
    start_date,
    end_date,
    conditions || null // ถ้าไม่มี conditions ให้ใส่ NULL
  ];

  db.query(sql, params, (err, result) => {
    if (err) {
      console.error("Error creating promotion:", err);
      // ตรวจสอบ error code สำหรับ duplicate code (ถ้ามี)
      if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ error: 'Promotion code already exists' });
      }
      return res.status(500).json({ error: 'Could not create promotion', details: err.message });
    }
    res.status(201).json({ message: 'Promotion created successfully', promotion_id: result.insertId });
    // Optional: io.emit('promotions_updated'); // แจ้งเตือน Client อื่น (ถ้าต้องการ)
  });
});

// PUT /api/promotions/:id - แก้ไขข้อมูลโปรโมชั่น
app.put('/api/promotions/:id', (req, res) => {
  const { id } = req.params;
  const { name, description, type, value, code, start_date, end_date, conditions, is_active } = req.body; // is_active อาจจะไม่ได้ใช้ ให้ใช้ /toggle แทน

  // Basic Validation
  if (!name || !type || value === undefined || value === null || !start_date || !end_date) {
    return res.status(400).json({ error: 'Missing required promotion fields (name, type, value, start_date, end_date)' });
  }

  const sql = "UPDATE promotions SET name = ?, description = ?, type = ?, value = ?, code = ?, start_date = ?, end_date = ?, conditions = ? WHERE promotion_id = ?";
  const params = [
    name,
    description || null,
    type,
    value,
    code || null,
    start_date,
    end_date,
    conditions || null,
    id
  ];

  db.query(sql, params, (err, result) => {
    if (err) {
      console.error(`Error updating promotion ${id}:`, err);
       if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ error: 'Promotion code already exists' });
      }
      return res.status(500).json({ error: 'Could not update promotion', details: err.message });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Promotion not found' });
    }
    res.json({ message: 'Promotion updated successfully', promotion_id: id });
    // Optional: io.emit('promotions_updated');
  });
});

// PUT /api/promotions/:id/toggle - สลับสถานะ Active/Inactive
app.put('/api/promotions/:id/toggle', (req, res) => {
  const { id } = req.params;
  // สลับค่า is_active โดยใช้ SQL (อ่านค่าปัจจุบันแล้วกลับค่า)
  const sql = "UPDATE promotions SET is_active = NOT is_active WHERE promotion_id = ?";

  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error(`Error toggling promotion ${id}:`, err);
      return res.status(500).json({ error: 'Could not toggle promotion status', details: err.message });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Promotion not found' });
    }
    res.json({ message: 'Promotion status toggled successfully', promotion_id: id });
    // Optional: io.emit('promotions_updated');
  });
});


// DELETE /api/promotions/:id - ลบโปรโมชั่น
app.delete('/api/promotions/:id', (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM promotions WHERE promotion_id = ?";

  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error(`Error deleting promotion ${id}:`, err);
      // คุณอาจต้องเช็ค Foreign Key Constraint ที่นี่ ถ้ามีตารางอื่นอ้างอิง promotion_id
      return res.status(500).json({ error: 'Could not delete promotion', details: err.message });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Promotion not found' });
    }
    res.json({ message: 'Promotion deleted successfully', promotion_id: id });
    // Optional: io.emit('promotions_updated');
  });
});

// ============================
// PRICING PLANS API
// ============================
app.get('/api/plans', (req, res) => {
    const sql = "SELECT * FROM pricing_plans ORDER BY price_per_person ASC";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/api/plans', (req, res) => {
    const { plan_name, price_per_person, description } = req.body;
    if (!plan_name || price_per_person === undefined || price_per_person === null) {
        return res.status(400).json({ error: 'Missing plan name or price' });
    }
    const sql = "INSERT INTO pricing_plans (plan_name, price_per_person, description) VALUES (?, ?, ?)";
    db.query(sql, [plan_name, price_per_person, description || null], (err, result) => {
        if (err) return res.status(500).json({ error: 'Could not add pricing plan' });
        console.log('🚀 Emitting plans_updated');
        io.emit('plans_updated');
        res.status(201).json({ id: result.insertId, plan_name, price_per_person, description });
    });
});

app.delete('/api/plans/:id', (req, res) => {
    const { id } = req.params;
    const sql = "DELETE FROM pricing_plans WHERE id = ?";
    db.query(sql, [id], (err, result) => {
        if (err) {
             console.error("Error deleting plan:", err);
             // Check for foreign key constraint error specifically if needed
            return res.status(500).json({ error: 'Could not delete pricing plan (it might be in use)' });
        }
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Pricing plan not found' });
        console.log('🚀 Emitting plans_updated');
        io.emit('plans_updated');
        res.json({ message: 'Pricing plan deleted successfully' });
    });
});



// ============================
// ATTENDANCE API ⏰
// ============================

// Middleware (ตัวอย่าง - คุณต้องสร้าง Middleware นี้เอง)
// ควรจะตรวจสอบ Token/Session และแนบข้อมูล user (เช่น id) ไปกับ req
const requireAuth = async (req, res, next) => { // 👈 เพิ่ม async
  // *** ใส่ Logic การตรวจสอบ Authentication ของคุณที่นี่ ***
  // ----- ตัวอย่าง: ดึง user_id จาก Header (ไม่ปลอดภัย! ควรใช้ Token/Session) -----
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
  // ----- จบตัวอย่าง -----

  try {
    // --- 👇 เพิ่มส่วนนี้: Query หาข้อมูล User (รวม Role) ---
    const sqlGetUser = "SELECT id, role FROM users WHERE id = ?";
    const [users] = await db.promise().query(sqlGetUser, [userId]);

    if (users.length === 0) {
      console.warn(`Authentication failed: User ID ${userId} not found in database.`);
      return res.status(401).json({ error: 'Authentication required (User not found)' });
    }
    const user = users[0];
    // --- 👆 สิ้นสุดส่วนที่เพิ่ม ---

    // แนบข้อมูล user (id และ role) ไปกับ req
    req.user = { id: user.id, role: user.role }; // 👈 แนบ role ไปด้วย
    console.log(`Authenticated User: ID=${req.user.id}, Role=${req.user.role}`); // Log เพื่อ Debug

    next(); // ไปยัง Handler ต่อไป

  } catch (dbError) {
    console.error("Authentication error during DB query:", dbError);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

// --- API Endpoints ---

// GET /api/attendance/status - ตรวจสอบสถานะล่าสุดของพนักงานที่ Login
app.get('/api/attendance/status', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const todayDate = new Date().toISOString().split('T')[0];

  try {
    // หา record ล่าสุดของวันนี้
    const sql = "SELECT attendance_id, clock_in_time, clock_out_time " +
                "FROM attendance " +
                "WHERE user_id = ? AND date = ? " +
                "ORDER BY clock_in_time DESC LIMIT 1";
    const [records] = await db.promise().query(sql, [userId, todayDate]);

    if (records.length === 0) {
      // ยังไม่เคยเข้างานวันนี้
      res.json({ status: 'not_clocked_in', lastClockIn: null });
    } else {
      const latestRecord = records[0];
      if (latestRecord.clock_out_time === null) {
        // เข้างานแล้ว ยังไม่ออก
        res.json({ status: 'clocked_in', lastClockIn: latestRecord.clock_in_time });
      } else {
        // เข้าและออกงานไปแล้ว
        res.json({ status: 'clocked_out', lastClockIn: latestRecord.clock_in_time });
      }
    }
  } catch (err) {
    console.error(`Error getting attendance status for user ${userId}:`, err);
    res.status(500).json({ error: 'Could not get attendance status' });
  }
});

// POST /api/attendance/clock-in - บันทึกเวลาเข้างาน
app.post('/api/attendance/clock-in', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const now = new Date();
  const todayDate = now.toISOString().split('T')[0]; // YYYY-MM-DD

  try {
    // 1. เช็คว่าเข้างานวันนี้แล้วหรือยัง (และยังไม่ออก)
    const checkSql = "SELECT attendance_id FROM attendance WHERE user_id = ? AND date = ? AND clock_out_time IS NULL";
    const [existing] = await db.promise().query(checkSql, [userId, todayDate]);

    if (existing.length > 0) {
      return res.status(400).json({ message: 'คุณได้บันทึกเวลาเข้างานวันนี้ไปแล้ว' });
    }

    // 2. บันทึกเข้างาน
    const insertSql = "INSERT INTO attendance (user_id, clock_in_time, date) VALUES (?, ?, ?)";
    await db.promise().query(insertSql, [userId, now, todayDate]);

    res.status(201).json({ message: 'บันทึกเวลาเข้างานสำเร็จ', clockInTime: now });
    io.emit(`attendance_updated_${userId}`); // ส่ง event เฉพาะ user นี้ (ถ้าต้องการ)
    io.emit('attendance_updated_admin'); // ส่ง event ให้ Admin (สำหรับหน้ารายงาน)

  } catch (err) {
    console.error(`Clock-in error for user ${userId}:`, err);
    res.status(500).json({ error: 'ไม่สามารถบันทึกเวลาเข้างานได้' });
  }
});

// POST /api/attendance/clock-out - บันทึกเวลาออกงาน
app.post('/api/attendance/clock-out', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const now = new Date();
  const todayDate = now.toISOString().split('T')[0];

  try {
    // 1. หา record ล่าสุดที่ยังไม่ออกงานของวันนี้
    const findSql = "SELECT attendance_id FROM attendance WHERE user_id = ? AND date = ? AND clock_out_time IS NULL ORDER BY clock_in_time DESC LIMIT 1";
    const [records] = await db.promise().query(findSql, [userId, todayDate]);

    if (records.length === 0) {
      return res.status(400).json({ message: 'ไม่พบข้อมูลเข้างานล่าสุด หรือคุณได้ออกงานไปแล้ว' });
    }

    // 2. บันทึกเวลาออกงาน
    const attendanceId = records[0].attendance_id;
    const updateSql = "UPDATE attendance SET clock_out_time = ? WHERE attendance_id = ?";
    await db.promise().query(updateSql, [now, attendanceId]);

    res.json({ message: 'บันทึกเวลาออกงานสำเร็จ', clockOutTime: now });
    io.emit(`attendance_updated_${userId}`); // ส่ง event เฉพาะ user นี้
    io.emit('attendance_updated_admin'); // ส่ง event ให้ Admin

  } catch (err) {
    console.error(`Clock-out error for user ${userId}:`, err);
    res.status(500).json({ error: 'ไม่สามารถบันทึกเวลาออกงานได้' });
  }
});

// GET /api/attendance - (Admin) ดูรายงานการเข้า-ออกงาน
app.get('/api/attendance', requireAuth, async (req, res) => {
    // Middleware ควรเช็คว่าเป็น Admin หรือไม่ด้วย
    if (req.user.role !== 'Admin') {
        return res.status(403).json({ error: 'Permission denied' });
    }

   const { userId, startDate, endDate } = req.query; // รับค่า filter จาก query params

   let sql = "SELECT a.attendance_id, a.user_id, a.clock_in_time, a.clock_out_time, a.date, a.notes, " +
             "u.username, u.first_name, u.last_name, u.nickname " + // เลือก field ที่ต้องการจาก users
             "FROM attendance a " +
             "JOIN users u ON a.user_id = u.id " +
             "WHERE 1=1"; // ใช้ 1=1 เพื่อให้ต่อ AND ง่าย

   const params = [];

   if (userId) {
       sql += " AND a.user_id = ?";
       params.push(userId);
   }
   if (startDate) {
       sql += " AND a.date >= ?";
       params.push(startDate); // ควรเป็น format YYYY-MM-DD
   }
   if (endDate) {
       sql += " AND a.date <= ?";
       params.push(endDate); // ควรเป็น format YYYY-MM-DD
   }

   sql += " ORDER BY a.date DESC, u.username ASC, a.clock_in_time DESC"; // เรียงตาม วันที่ -> ชื่อ -> เวลาเข้าล่าสุด

   try {
       const [results] = await db.promise().query(sql, params);
       res.json(results);
   } catch (err) {
       console.error("Error fetching attendance report:", err);
       res.status(500).json({ error: 'Could not fetch attendance report' });
   }
});
// --- ✨ NEW API Endpoint: GET /api/attendance/summary ✨ ---
app.get('/api/attendance/summary', requireAuth, async (req, res) => {
    // Middleware requireAuth ควรเช็คว่าเป็น Admin ด้วย (ถ้ายังไม่ได้ทำ)
    if (req.user.role !== 'Admin') {
         console.warn(`Permission denied for user ${req.user.id} (role: ${req.user.role}) trying to access attendance summary.`);
         return res.status(403).json({ error: 'Permission denied. Admin only.' });
    }

    const { userId, startDate, endDate } = req.query; // รับค่า filter

    // Validation: startDate and endDate are required for summary
    if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Start date and end date are required for summary report.' });
    }

    // สร้างส่วน WHERE และ parameters สำหรับ SQL Query
    let whereClause = "WHERE a.clock_out_time IS NOT NULL AND a.date BETWEEN ? AND ?";
    const params = [startDate, endDate]; // ใส่ startDate, endDate ก่อนเสมอ

    if (userId) {
        whereClause += " AND a.user_id = ?";
        params.push(userId); // เพิ่ม userId ถ้ามีการระบุ
    }

    const sql = `
        SELECT
            u.id AS user_id,
            u.username,
            u.first_name,
            u.last_name,
            u.nickname,
            COUNT(DISTINCT a.date) AS days_worked,
            COALESCE(SUM(TIMESTAMPDIFF(MINUTE, a.clock_in_time, a.clock_out_time)), 0) AS total_minutes_worked
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        ${whereClause} -- ใช้ whereClause ที่สร้างไว้
        GROUP BY u.id, u.username, u.first_name, u.last_name, u.nickname
        ORDER BY u.username ASC;
    `;

    try {
        const [results] = await db.promise().query(sql, params);

        // แปลง total_minutes_worked เป็น ชั่วโมง/นาที
        const summaryResults = results.map(row => {
            const totalMinutes = row.total_minutes_worked;
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            return {
                ...row, // เก็บข้อมูล user และ days_worked เดิม
                total_time_worked_formatted: `${hours} ชม. ${minutes} นาที`, // เพิ่ม field ที่ format แล้ว
                total_minutes_worked: totalMinutes // เก็บค่านาทีดิบไว้เผื่อใช้
            };
        });

        res.json(summaryResults);

    } catch (err) {
        console.error("Error fetching attendance summary report:", err);
        res.status(500).json({ error: 'Could not fetch attendance summary report' });
    }
});

// ============================
// STOCK HISTORY/SUMMARY API 📈
// ============================

// GET /api/stock/summary - Get aggregated stock changes for charts
app.get('/api/stock/summary', requireAuth, async (req, res) => {
    // Ensure Admin
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

    let dateFormat;
    let dateColumn;
    switch (groupBy) {
        case 'month':
            dateFormat = '%Y-%m';
            dateColumn = 'DATE_FORMAT(timestamp, "%Y-%m-01")';
            break;
        case 'year':
            dateFormat = '%Y';
            dateColumn = 'DATE_FORMAT(timestamp, "%Y-01-01")';
            break;
        case 'day':
        default:
            dateFormat = '%Y-%m-%d';
            dateColumn = 'DATE(timestamp)';
            break;
    }

    let sql = `
        SELECT
            ${dateColumn} AS period_start,
            m.menu_id,
            m.menu_name,
            COALESCE(SUM(CASE WHEN sl.change_quantity > 0 THEN sl.change_quantity ELSE 0 END), 0) AS total_in,
            COALESCE(SUM(CASE WHEN sl.change_quantity < 0 THEN ABS(sl.change_quantity) ELSE 0 END), 0) AS total_out,
            (SELECT sl_prev.new_quantity
             FROM stock_logs sl_prev
             WHERE sl_prev.menu_id = sl.menu_id AND sl_prev.timestamp < DATE_ADD(DATE(${dateColumn}), INTERVAL 1 DAY)
             ORDER BY sl_prev.timestamp DESC, sl_prev.log_id DESC
             LIMIT 1
            ) AS ending_balance
        FROM stock_logs sl
        JOIN menu m ON sl.menu_id = m.menu_id
        WHERE
            sl.timestamp BETWEEN ? AND ?
    `;
    const params = [`${startDate} 00:00:00`, `${endDate} 23:59:59`];

    if (menuId && menuId !== '') {
        sql += " AND sl.menu_id = ?";
        params.push(menuId);
    }

    sql += `
        GROUP BY period_start, m.menu_id, m.menu_name
        ORDER BY period_start ASC, m.menu_name ASC;
    `;

    try {
        const [results] = await db.promise().query(sql, params);

        // --- 👇 แก้ไขส่วนนี้ 👇 ---
        // Format วันที่ และแปลงค่าตัวเลขให้ถูกต้อง
        const formattedResults = results.map(row => ({
            // ... เก็บ field อื่นๆ เหมือนเดิม
            period_start: row.period_start, // เก็บค่าดิบไว้ (ถ้าต้องการ)
            menu_id: row.menu_id,
            menu_name: row.menu_name,
            // Format วันที่สำหรับแสดงผล
            period_label: format(new Date(row.period_start), groupBy === 'day' ? 'dd/MM/yy' : (groupBy === 'month' ? 'MMM yyyy' : 'yyyy'), { locale: th }),
            // แปลงค่า In/Out/Balance เป็น Integer
            total_in: parseInt(row.total_in, 10),
            total_out: parseInt(row.total_out, 10),
            ending_balance: row.ending_balance !== null ? parseInt(row.ending_balance, 10) : null
            // ลบ total_time_worked_formatted และ total_minutes_worked ออก
        }));
        // --- 👆 สิ้นสุดส่วนแก้ไข 👆 ---

        res.json(formattedResults);
    } catch (err) {
        console.error("Error fetching stock summary:", err);
        res.status(500).json({ error: 'Could not fetch stock summary data' });
    }
});

// Optional: GET /api/stock/history/:menuId - For detailed log view (simpler query)
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
         const [logs] = await db.promise().query(sql, params);
         res.json(logs);
     } catch(err) {
         console.error(`Error fetching stock history for menu ${menuId}:`, err);
         res.status(500).json({ error: 'Could not fetch stock history' });
     }
});

// ============================
// ✅ 5. START SERVER
// ============================
const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});
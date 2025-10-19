const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const app = express();
const bcrypt = require('bcrypt');
const saltRounds = 10;

// ✅ 1. IMPORT HTTP & SOCKET.IO
const http = require('http');
const { Server } = require("socket.io");

// ✅ 2. CREATE HTTP SERVER & SOCKET.IO INSTANCE
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Should change to your Frontend URL in production
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ============================
// Database Connection
// ============================
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'myappdb',
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

app.put('/api/menu/:id', (req, res) => {
    const { id } = req.params;
    const { menu_name, menu_description, menu_category, price, menu_quantity, menu_image } = req.body;
    const imageBuffer = menu_image ? Buffer.from(menu_image, 'base64') : null;
    const sql = "UPDATE menu SET menu_name = ?, menu_description = ?, menu_category = ?, price = ?, menu_quantity = ?, menu_image = ? WHERE menu_id = ?";
    db.query(sql, [menu_name, menu_description, menu_category, price, menu_quantity, imageBuffer, id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Menu item not found' });
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
app.post('/api/orders/:orderId/join', (req, res) => {
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

    // 2. If not in cache, use a transaction to safely increment
    db.beginTransaction(err => {
        if (err) return res.status(500).json({ error: 'Transaction start failed' });

        const selectSql = "SELECT customer_join_count FROM orders WHERE order_id = ? FOR UPDATE";
        
        db.query(selectSql, [orderId], (err, results) => {
            if (err) {
                db.rollback(() => res.status(500).json({ error: 'Failed to lock order' }));
                return;
            }
            if (results.length === 0) {
                db.rollback(() => res.status(404).json({ message: 'Order not found' }));
                return;
            }

            const newCount = results[0].customer_join_count + 1;
            const customerLetter = String.fromCharCode(64 + newCount); // 1 -> 'A', 2 -> 'B'
            const customerName = `ลูกค้า ${customerLetter}`;

            const updateSql = "UPDATE orders SET customer_join_count = ? WHERE order_id = ?";
            
            db.query(updateSql, [newCount, orderId], (err, updateResult) => {
                if (err) {
                    db.rollback(() => res.status(500).json({ error: 'Failed to update count' }));
                    return;
                }

                db.commit(err => {
                    if (err) {
                        db.rollback(() => res.status(500).json({ error: 'Transaction commit failed' }));
                        return;
                    }
                    
                    // 3. Save to cache AND send response
                    orderSessionCache.set(mapKey, customerName);
                    io.emit('tables_updated'); 
                    res.json({ customerName: customerName });
                });
            });
        });
    });
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

app.post('/api/payment', (req, res) => {
    const { order_id, total_price, payment_method } = req.body;
    if (!order_id || total_price === undefined || total_price === null) {
        return res.status(400).json({ error: 'Missing required payment information (order_id, total_price)' });
    }
    const sql = "INSERT INTO payment (order_id, payment_time, total_price, payment_method) VALUES (?, NOW(), ?, ?)";
    db.query(sql, [order_id, total_price, payment_method || null], (err, result) => {
        if (err) {
             console.error("Error inserting payment:", err);
            return res.status(500).json({ error: 'Error recording payment' });
        }

        // [FIX] Clear session cache when table is paid
        // We must clear any keys that start with `${order_id}-`
        for (const key of orderSessionCache.keys()) {
            if (key.startsWith(`${order_id}-`)) {
                orderSessionCache.delete(key);
            }
        }

        const paymentId = result.insertId;
        const updateOrderStatusSql = "UPDATE orders SET order_status = 'completed' WHERE order_id = ?";
        db.query(updateOrderStatusSql, [order_id], (orderErr) => {
            if (orderErr) console.error("Error updating order status:", orderErr);
        });

        const updateTableSql = `UPDATE tables t JOIN orders o ON t.table_id = o.table_id SET t.status = 'ว่าง' WHERE o.order_id = ?`;
        db.query(updateTableSql, [order_id], (updateErr, updateResult) => {
            if (updateErr) console.error("Error updating table status:", updateErr);
            if (!updateErr && updateResult.affectedRows > 0) {
                console.log('🚀 Emitting tables_updated (payment complete)');
                io.emit('tables_updated');
                console.log('🚀 Emitting new_payment');
                io.emit('new_payment', { paymentId: paymentId, orderId: order_id, totalPrice: total_price });

                // ✅ --- START: ADDED NOTIFICATION (CLOSE TABLE) ---
                // Get table number for the notification message
                const getTableSql = `
                    SELECT t.table_number 
                    FROM orders o
                    JOIN tables t ON o.table_id = t.table_id
                    WHERE o.order_id = ?
                `;
                db.query(getTableSql, [order_id], (tableErr, tableResult) => {
                    if (!tableErr && tableResult.length > 0) {
                        const tableNumber = tableResult[0].table_number;
                        io.emit('notification', {
                            message: `โต๊ะ ${tableNumber} ได้ชำระเงินและปิดโต๊ะแล้ว`,
                            type: 'close_table',
                            linkTo: '/PaymentPage' // Link to the payment page
                        });
                    }
                });
                // ✅ --- END: ADDED NOTIFICATION (CLOSE TABLE) ---
            }
        });

        res.status(201).json({ message: 'Payment recorded and status updated successfully', payment_id: paymentId });
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
// ✅ 5. START SERVER
// ============================
const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});
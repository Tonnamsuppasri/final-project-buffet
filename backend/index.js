const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const db = require('./config/db');
const { UPLOADS_ROOT, migrateExistingBlobsToDisk } = require('./utils/imageStorage');
const { ensureDefaultData } = require('./utils/seedDefaults');

// Route modules
const shopRoutes = require('./routes/shopRoutes');
const authRoutes = require('./routes/authRoutes');
const menuRoutes = require('./routes/menuRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const reportRoutes = require('./routes/reportRoutes');
const tableRoutes = require('./routes/tableRoutes');
const promotionRoutes = require('./routes/promotionRoutes');
const planRoutes = require('./routes/planRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const stockRoutes = require('./routes/stockRoutes');

const app = express();
const frontendUrl = process.env.FRONTEND_URL;

// ============================
// CORS & Middleware Setup
// ============================
const allowedOrigins = [
  'http://localhost:5173',
  'http://192.168.0.101:5173',
  'http://10.226.247.45:5173',
  frontendUrl,
  'https://salic-direly-jacquiline.ngrok-free.dev'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('http://192.168.')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-User-Id']
};

const server = http.createServer(app);
const io = new Server(server, { cors: corsOptions });

app.options(/.*/, cors(corsOptions));
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Serve uploaded images statically
app.use('/uploads', express.static(UPLOADS_ROOT));

// ============================
// Socket.IO Connection Handler
// ============================
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
// Register API Routes
// ============================
app.use(shopRoutes(io));
app.use(authRoutes(io));
app.use(menuRoutes(io));
app.use(orderRoutes(io));
app.use(paymentRoutes(io));
app.use(reportRoutes(io));
app.use(tableRoutes(io));
app.use(promotionRoutes(io));
app.use(planRoutes(io));
app.use(attendanceRoutes(io));
app.use(stockRoutes(io));

// Seed default shop/tables/plans if empty and migrate legacy BLOB images to disk on startup
ensureDefaultData(db);
migrateExistingBlobsToDisk(db);

// ============================
// Start Server
// ============================
const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});

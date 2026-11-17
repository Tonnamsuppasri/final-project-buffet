# 🍲 Buffet & Shabu POS Management System (ระบบจัดการร้านบุฟเฟต์ปิ้งย่างและชาบูครบวงจร)

Full-Stack Restaurant POS & Table Ordering System designed for Buffet, Shabu, and Yakiniku restaurants. Features real-time kitchen notifications, dynamic per-session QR code ordering for customers, concurrency-safe stock reservation, role-based access control (RBAC), staff attendance tracking, and sales/inventory analytics.

---

## ✨ Key Highlights & Technical Selling Points (จุดเด่นเชิงสถาปัตยกรรม)

* **Dynamic Per-Session QR Code (`order_uuid`)**: Generates a unique UUID per active dining session rather than static table QR codes. Automatically invalidates QR access once the table checks out, preventing unauthorized post-checkout orders.
* **Concurrency-Safe Inventory Reservation (`FOR UPDATE` Transactions)**: Uses MySQL InnoDB row-level locking (`SELECT ... FOR UPDATE`) combined with pending order calculations inside database transactions to prevent race conditions and overselling when multiple tables order the last item simultaneously.
* **Real-Time Multi-Client Synchronization (Socket.IO)**: Instant push updates across Kitchen Display, Cashier/Tables dashboard, Customer Bill view, and Staff Permission states without page reloads (table status updates, new orders, call-for-bill alerts, and live permission changes).
* **File-Based Image Storage & Legacy BLOB Auto-Migration**: Stores uploaded menu, shop logo, PromptPay QR, and user profile images as static files under `backend/uploads/` served via Express (`/uploads`), keeping API JSON payloads lightweight while automatically migrating any legacy MySQL `LONGBLOB` images to disk on startup.
* **Plan-Based Menu Filtering (`plan_menu_access`)**: Dynamically restricts customer-facing menus based on the buffet tier/package selected when opening the table, while supporting A La Carte add-ons.
* **Granular Role-Based Access Control (RBAC)**: Supports `Admin` and `Staff` roles with customizable per-user permissions (`view_reports`, `manage_stock`, `manage_settings`).

---

## 🛠️ Tech Stack

### Frontend
* **React 19** + **TypeScript** + **Vite 6**
* **Tailwind CSS v4**
* **React Router v7**
* **Socket.IO Client** (Real-time events & notifications)
* **Chart.js** + `react-chartjs-2` (Sales, Menu, and Overview analytics)
* **Axios**, **SweetAlert2**, **QRCode**, **react-to-print**, **date-fns**

### Backend
* **Node.js** + **Express 5** (Modular MVC-style `config/`, `middlewares/`, `routes/`, `utils/`)
* **MySQL 2** (Promise-based Connection Pool & Transactions)
* **Socket.IO 4**
* **Bcrypt** (Password hashing)
* **dotenv**, **cors**, **uuid**, **date-fns**

---

## 📁 Project Structure

```text
final-project-buffet-main/
├── package.json                  # Root script runner (concurrently)
├── mysql/                        # Database dumps & XAMPP-ready SQL scripts
│   ├── Dumpdb (1).sql            # Original full MySQL 8.0 dump
│   ├── xampp_ready.sql           # XAMPP/MariaDB compatible dump (with sample data)
│   └── schema_only.sql           # Clean schema-only script (13 tables)
├── backend/
│   ├── index.js                  # Express & Socket.IO server entry point
│   ├── .env.example              # Backend environment template
│   ├── config/
│   │   └── db.js                 # MySQL connection pool configuration
│   ├── middlewares/
│   │   └── auth.js               # Authentication & permission middlewares
│   ├── routes/                   # Modular REST API routes
│   │   ├── authRoutes.js         # Login, profile, staff CRUD & permissions
│   │   ├── menuRoutes.js         # Menu CRUD & image storage
│   │   ├── orderRoutes.js        # Dynamic QR sessions, ordering, delivery
│   │   ├── paymentRoutes.js      # Checkout calculation, stock deduction, bills
│   │   ├── planRoutes.js         # Buffet pricing plans & menu access mapping
│   │   ├── promotionRoutes.js    # Promotions & discounts
│   │   ├── reportRoutes.js       # Sales, overview & menu analytics
│   │   ├── shopRoutes.js         # Shop settings & service types
│   │   ├── stockRoutes.js        # Stock summary & audit logs
│   │   ├── tableRoutes.js        # Table CRUD & UUID lookup
│   │   └── attendanceRoutes.js   # Staff clock-in / clock-out & summary
│   ├── utils/
│   │   ├── imageStorage.js       # Disk image manager & BLOB migrator
│   │   └── sessionCache.js       # Shared customer join session cache
│   └── uploads/                  # Static image storage (menus/, shop/, users/)
└── frontend/
    └── src/
        ├── App.tsx               # Staff/Admin login & Axios interceptor
        ├── main.tsx              # Application routes
        ├── components/           # Sidebar layout & Clock-in/out button
        ├── customer-pages/       # Mobile QR Order & Live Bill pages
        ├── pages/                # POS, Kitchen, Payment, Stock, Staff, Reports, Settings
        └── utils/
            └── imageUtils.ts     # Unified image URL & Base64 resolver
```

---

## 🗄️ Database Schema Overview (`myappdb` — 13 Tables)

* **Users & Attendance**: `users`, `attendance`
* **Shop & Configuration**: `shop`, `tables`, `service_types`, `promotions`
* **Menu & Buffet Packages**: `menu`, `pricing_plans`, `plan_menu_access`
* **Orders & Billing**: `orders`, `order_details`, `payment`
* **Inventory Audit**: `stock_logs`

---

## 🚀 Getting Started (วิธีติดตั้งและรันโปรเจกต์)

### 1. Prerequisites
* **Node.js** (v18+ recommended)
* **MySQL** or **XAMPP** (Apache + MySQL/MariaDB)

### 2. Database Setup (XAMPP / phpMyAdmin)
1. Start **MySQL** in XAMPP Control Panel and open `http://localhost/phpmyadmin`.
2. Create a database named `myappdb` (`utf8mb4_unicode_ci`) and import `mysql/xampp_ready.sql`.
   *(See `mysql/schema_only.sql` if you only want empty table structures.)*

### 3. Environment Configuration
Ensure `backend/.env` is configured (copied from `backend/.env.example`):
```env
PORT=3001
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=myappdb
```

### 4. Install Dependencies
```bash
# Root (concurrently)
npm install

# Backend
npm --prefix backend install

# Frontend
npm --prefix frontend install
```

### 5. Run the Application (Single Command)
From the project root directory:
```bash
npm run dev
```
* **Frontend (Vite):** `http://localhost:5173`
* **Backend (Express + Socket.IO):** `http://localhost:3001`

*(Alternatively, run `npm --prefix backend start` and `npm --prefix frontend run dev` in separate terminals.)*

---

## 🔐 Demo Account
* **Username:** `Admin`
* **Password:** `123456` *(after running the password update SQL in phpMyAdmin)*

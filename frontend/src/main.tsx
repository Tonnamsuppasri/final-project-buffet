// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App' // <-- หน้าแรก (น่าจะเป็นหน้า Login ของคุณ)
import Report from './pages/report'
import Staff from './pages/staff'
import MonthReport from './pages/month-report'
import DayReport from './pages/day-report'
import Menu from './components/menu' // <-- ต้อง Import Menu component เข้ามาที่นี่ด้วย!
import EditProfile from './pages/edit-profile' // <-- หน้า Edit Profile
import Table from './pages/table' // <-- หน้า Table ที่ต้องการ Sidebar
import CheckBill from './pages/check-bill' // <-- หน้า Check Bill
import Setting from './pages/setting' // <-- หน้า Setting


import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Route สำหรับหน้าแรก (เช่น Login) ที่ไม่มี Sidebar */}
        <Route path="/" element={<App />} />

        {/* ---------------------------------------------------- */}
        {/* นี่คือส่วนสำคัญ: กำหนดให้ Menu เป็น Layout สำหรับกลุ่ม Route เหล่านี้ */}
        <Route element={<Menu/>}> {/* Menu component จะถูก Mount แค่ครั้งเดียวที่นี่ */}
          <Route path="/report" element={<Report />} />
          <Route path="/day-report" element={<DayReport />} />
          <Route path="/month-report" element={<MonthReport />} />
          <Route path="/staff" element={<Staff />} />
          <Route path="/edit-profile" element={<EditProfile />} />
          <Route path="/table" element={<Table />} />
          <Route path="/check-bill" element={<CheckBill />} />
          <Route path="/setting" element={<Setting />} />
          {/* เพิ่ม Route สำหรับหน้าอื่นๆ ที่ต้องการ Sidebar ที่นี่ */}
          {/* ตัวอย่าง: */}
          {/* <Route path="/table" element={<Table />} /> */}
          {/* <Route path="/check-bill" element={<CheckBill />} /> */}
          {/* <Route path="/setting" element={<Setting />} /> */}
        </Route>
        {/* ---------------------------------------------------- */}

        {/* ถ้ามี 404 Page (Optional) */}
        <Route path="*" element={<div>404 Not Found</div>} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
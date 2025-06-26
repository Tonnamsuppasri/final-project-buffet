// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'              // <-- สำคัญ!
import Home from './pages/home'     // <-- หน้า Home หลัง Login
import './index.css'
import Staff from './pages/staff'
import MonthReport from './pages/month-report'
import DayReport from './pages/day-report'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />         {/* App.tsx คือหน้าแรก */}
        <Route path="/home" element={<Home />} />
        <Route path="/day-report" element={<DayReport />} />
        <Route path="/month-report" element={<MonthReport />} />
        <Route path="/staff" element={<Staff />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App'; // This is your main login/entry page
import Report from './pages/report';
import Staff from './pages/staff';
import MonthReport from './pages/month-report';
import DayReport from './pages/day-report';
import Menu from './components/menu'; // This is your Sidebar/Layout component
import EditProfile from './pages/edit-profile';
import Table from './pages/table';
import PaymentPage from './pages/PaymentPage';
import Setting from './pages/setting';
import Welcome from './pages/welcome';
import Order from './pages/order';
import CustomerOrderPage from './customer-pages/CustomerOrderPage';
import CustomerBillPage from './customer-pages/CustomerBillPage';

import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Route for the initial page (e.g., Login) without a sidebar */}
        <Route path="/" element={<App />} />

        {/* --- Customer Order Page Route (No Sidebar) --- */}
        {/* ✅ FIXED: The path now correctly includes the ':uuid' parameter */}
        <Route path="/order/:uuid" element={<CustomerOrderPage />} />
          <Route path="/order/:uuid/bill" element={<CustomerBillPage />} />

        {/* --- Staff-facing routes with the Menu/Sidebar Layout --- */}
        <Route element={<Menu />}>
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/report" element={<Report />} />
          <Route path="/day-report" element={<DayReport />} />
          <Route path="/month-report" element={<MonthReport />} />
          <Route path="/staff" element={<Staff />} />
          <Route path="/edit-profile" element={<EditProfile />} />
          <Route path="/table" element={<Table />} />
          <Route path="/PaymentPage" element={<PaymentPage />} />
          <Route path="/setting" element={<Setting />} />
          <Route path="/order" element={<Order />} />
        </Route>

        {/* Catch-all 404 Page (Optional) */}
        <Route path="*" element={<div className=''>404 Not Found</div>} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { registerLocale } from "react-datepicker";
import { th as thLocale } from 'date-fns/locale/th';
registerLocale('th', thLocale);

import { 
    format, startOfMonth, endOfMonth, startOfYear, endOfYear, 
    startOfDay, endOfDay, subYears 
} from 'date-fns';
import { CalendarIcon, TrophyIcon, ClipboardIcon, ArrowPathIcon, FunnelIcon, ArchiveBoxIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface PlanSale { plan_name: string; price_per_person: number; total_orders: number; total_customers: number; total_revenue: number; }
interface MenuItemSale { menu_id: number; name: string; category: string; total_quantity: number; total_revenue: number; }
type SmartMode = 'hour' | 'day' | 'month' | 'year' | null;

const ReportMenu = () => {
  const [planSales, setPlanSales] = useState<PlanSale[]>([]);
  const [menuSales, setMenuSales] = useState<MenuItemSale[]>([]);
  const [loading, setLoading] = useState(false);
  
  // ✅ Pagination States
  const [planPage, setPlanPage] = useState(1);
  const [menuPage, setMenuPage] = useState(1);
  const itemsPerPage = 10;

  // Dates
  const [startDate, setStartDate] = useState(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState(endOfMonth(new Date()));

  // Smart Filter UI
  const [smartMode, setSmartMode] = useState<SmartMode>('day');
  const [smartDate, setSmartDate] = useState<Date>(new Date());
  const [smartStartYear, setSmartStartYear] = useState<Date>(subYears(new Date(), 4));
  const [smartEndYear, setSmartEndYear] = useState<Date>(new Date());

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync Logic
  useEffect(() => {
      if (!smartMode) return;
      let start, end;
      if (smartMode === 'hour') { start = startOfDay(smartDate); end = endOfDay(smartDate); }
      else if (smartMode === 'day') { start = startOfMonth(smartDate); end = endOfMonth(smartDate); }
      else if (smartMode === 'month') { start = startOfYear(smartDate); end = endOfYear(smartDate); }
      else { start = startOfYear(smartStartYear); end = endOfYear(smartEndYear); }
      setStartDate(start); setEndDate(end);
      setPlanPage(1); // Reset page when filter changes
      setMenuPage(1);
  }, [smartMode, smartDate, smartStartYear, smartEndYear]);

  const handleManualDateChange = (type: 'start' | 'end', date: Date | null) => {
      if (!date) return;
      setSmartMode(null);
      if (type === 'start') setStartDate(startOfDay(date));
      else setEndDate(endOfDay(date));
      setPlanPage(1);
      setMenuPage(1);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [planRes, menuRes] = await Promise.all([
        axios.get(`${apiUrl}/api/reports/menu/plans`, { params: { startDate: format(startDate,'yyyy-MM-dd'), endDate: format(endDate,'yyyy-MM-dd') } }),
        axios.get(`${apiUrl}/api/reports/menu/items`, { params: { startDate: format(startDate,'yyyy-MM-dd'), endDate: format(endDate,'yyyy-MM-dd') } }),
      ]);
      setPlanSales(planRes.data);
      setMenuSales(menuRes.data);
    } catch (err) { console.error("Error:", err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [startDate, endDate]);

  // ✅ Pagination Logic
  const paginatedPlans = useMemo(() => {
    const start = (planPage - 1) * itemsPerPage;
    return planSales.slice(start, start + itemsPerPage);
  }, [planSales, planPage]);

  const paginatedMenus = useMemo(() => {
    const start = (menuPage - 1) * itemsPerPage;
    return menuSales.slice(start, start + itemsPerPage);
  }, [menuSales, menuPage]);

  const totalPlanPages = Math.ceil(planSales.length / itemsPerPage);
  const totalMenuPages = Math.ceil(menuSales.length / itemsPerPage);

  const planChartData = {
    labels: planSales.slice(0, 10).map(p => p.plan_name), // กราฟโชว์แค่ Top 10 เพื่อความสวยงาม
    datasets: [{ label: 'ลูกค้า (คน)', data: planSales.slice(0, 10).map(p => p.total_customers), backgroundColor: '#34D399', borderRadius: 4 }],
  };
  const top5MenuSales = menuSales.slice(0, 5);
  const menuChartData = {
    labels: top5MenuSales.map(m => m.name),
    datasets: [{ label: 'จำนวน (จาน)', data: top5MenuSales.map(m => m.total_quantity), backgroundColor: '#F87171', borderRadius: 4 }],
  };

  const commonOptions = {
      responsive: true, maintainAspectRatio: false,
      indexAxis: 'y' as const,
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { font: { size: isMobile ? 10 : 12 } } }, y: { ticks: { font: { size: isMobile ? 10 : 12 } } } }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">รายงานเมนู & บุฟเฟต์</h1>

      {/* Hybrid Filter Card (Red Theme) */}
      <div className="bg-white rounded-lg shadow-md border-l-4 border-red-500 overflow-hidden">
          {/* ... ส่วน Filter (เหมือนเดิม) ... */}
          <div className="p-4 bg-gray-50 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-end md:items-center">
              <div className="w-full md:w-auto">
                  <label className="block text-xs text-gray-500 mb-1 font-bold flex items-center gap-1"><FunnelIcon className="w-3 h-3" /> มุมมองด่วน</label>
                  <div className="flex bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
                      {[{ id: 'hour', label: 'รายวัน' }, { id: 'day', label: 'รายเดือน' }, { id: 'month', label: 'รายปี' }, { id: 'year', label: 'ช่วงปี' }].map((mode) => (
                          <button key={mode.id} onClick={() => setSmartMode(mode.id as SmartMode)} className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all flex-1 ${smartMode === mode.id ? 'bg-red-50 text-red-600 border border-red-100 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>{mode.label}</button>
                      ))}
                  </div>
              </div>
              <div className="w-full md:w-auto flex-grow max-w-sm transition-opacity duration-300" style={{ opacity: smartMode ? 1 : 0.5 }}>
                  <label className="block text-xs text-gray-500 mb-1 font-bold">
                      {smartMode === 'hour' ? 'เลือกวันที่' : smartMode === 'day' ? 'เลือกเดือน' : smartMode === 'month' ? 'เลือกปี' : smartMode === 'year' ? 'เลือกช่วงปี' : 'กำหนดเอง'}
                  </label>
                  {smartMode === 'hour' && (<DatePicker selected={smartDate} onChange={(d: Date | null) => d && setSmartDate(d)} dateFormat="dd MMM yyyy" locale="th" className="input-field w-full p-2 border border-gray-300 rounded-md text-sm text-center focus:ring-red-500" withPortal={isMobile} />)}
                  {smartMode === 'day' && (<DatePicker selected={smartDate} onChange={(d: Date | null) => d && setSmartDate(d)} dateFormat="MMMM yyyy" showMonthYearPicker locale="th" className="input-field w-full p-2 border border-gray-300 rounded-md text-sm text-center focus:ring-red-500" withPortal={isMobile} />)}
                  {smartMode === 'month' && (<DatePicker selected={smartDate} onChange={(d: Date | null) => d && setSmartDate(d)} dateFormat="yyyy" showYearPicker locale="th" className="input-field w-full p-2 border border-gray-300 rounded-md text-sm text-center focus:ring-red-500" withPortal={isMobile} />)}
                  {smartMode === 'year' && (<div className="flex items-center gap-2"><DatePicker selected={smartStartYear} onChange={(d: Date | null) => d && setSmartStartYear(d)} dateFormat="yyyy" showYearPicker locale="th" className="input-field w-full p-2 border border-gray-300 rounded-md text-sm text-center w-24" /><span className="text-gray-400">-</span><DatePicker selected={smartEndYear} onChange={(d: Date | null) => d && setSmartEndYear(d)} dateFormat="yyyy" showYearPicker locale="th" className="input-field w-full p-2 border border-gray-300 rounded-md text-sm text-center w-24" /></div>)}
                  {!smartMode && (<div className="w-full p-2 border border-dashed border-gray-300 rounded-md text-sm text-gray-400 text-center bg-gray-50 cursor-not-allowed">(กำหนดเอง)</div>)}
              </div>
          </div>
          <div className="p-4 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                  <ArchiveBoxIcon className={`w-5 h-5 ${!smartMode ? 'text-red-600' : 'text-gray-400'}`} />
                  <span className={`text-sm font-bold ${!smartMode ? 'text-gray-800' : 'text-gray-500'}`}>ช่วงเวลา:</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                  <DatePicker selected={startDate} onChange={(d) => handleManualDateChange('start', d)} dateFormat="dd/MM/yyyy" locale="th" className={`input-field w-full sm:w-28 p-2 border rounded-md text-sm text-center outline-none transition-all ${!smartMode ? 'border-red-500 ring-1 ring-red-500 shadow-sm' : 'border-gray-300 text-gray-600'}`} withPortal={isMobile} />
                  <span className="text-gray-400">-</span>
                  <DatePicker selected={endDate} onChange={(d) => handleManualDateChange('end', d)} dateFormat="dd/MM/yyyy" locale="th" className={`input-field w-full sm:w-28 p-2 border rounded-md text-sm text-center outline-none transition-all ${!smartMode ? 'border-red-500 ring-1 ring-red-500 shadow-sm' : 'border-gray-300 text-gray-600'}`} withPortal={isMobile} />
              </div>
              <div className="ml-auto flex items-center gap-2">
                  <button onClick={fetchData} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition shadow-sm flex items-center gap-1 text-sm"><ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin': ''}`} /> อัปเดต</button>
              </div>
          </div>
      </div>

      {/* Buffet Plan Section */}
      <div className="p-4 sm:p-6 bg-white rounded-lg shadow-md overflow-hidden">
        <h2 className="text-xl font-bold mb-4 text-green-700 flex items-center gap-2"><ClipboardIcon className="w-6 h-6" /> แพ็กเกจบุฟเฟต์</h2>
        <div className="h-64 sm:h-80 w-full">{loading ? <div className="flex h-full items-center justify-center text-gray-400">Loading...</div> : <Bar data={planChartData} options={commonOptions} />}</div>
        
        <div className="overflow-x-auto mt-6">
          <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
            <thead className="bg-green-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-green-800 uppercase">แพ็กเกจ</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-green-800 uppercase">ลูกค้า</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-green-800 uppercase">ยอดรวม (฿)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 text-sm">
              {paginatedPlans.length > 0 ? paginatedPlans.map((plan, index) => (
                <tr key={index} className="hover:bg-green-50 transition">
                  <td className="px-4 py-3 font-medium text-gray-900">{plan.plan_name}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{plan.total_customers}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-800">{Number(plan.total_revenue).toLocaleString()}</td>
                </tr>
              )) : (
                <tr><td colSpan={3} className="px-4 py-4 text-center text-gray-400">ไม่มีข้อมูลในช่วงที่เลือก</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ✅ Pagination Controls for Plans */}
        {totalPlanPages > 1 && (
          <div className="flex justify-between items-center mt-4 px-2">
            <span className="text-xs text-gray-500">หน้า {planPage} จาก {totalPlanPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPlanPage(prev => Math.max(prev - 1, 1))} disabled={planPage === 1} className="p-1 rounded-md border disabled:opacity-30"><ChevronLeftIcon className="w-5 h-5"/></button>
              <button onClick={() => setPlanPage(prev => Math.min(prev + 1, totalPlanPages))} disabled={planPage === totalPlanPages} className="p-1 rounded-md border disabled:opacity-30"><ChevronRightIcon className="w-5 h-5"/></button>
            </div>
          </div>
        )}
      </div>

      {/* Best Sellers Section */}
      <div className="p-4 sm:p-6 bg-white rounded-lg shadow-md overflow-hidden">
        <h2 className="text-xl font-bold mb-4 text-red-600 flex items-center gap-2"><TrophyIcon className="w-6 h-6" /> เมนูขายดี</h2>
        <div className="h-64 sm:h-80 w-full">{loading ? <div className="flex h-full items-center justify-center text-gray-400">Loading...</div> : <Bar data={menuChartData} options={commonOptions} />}</div>
        
        <div className="overflow-x-auto mt-6">
          <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
            <thead className="bg-red-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-red-800 uppercase">เมนู</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-red-800 uppercase">จำนวน</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-red-800 uppercase">ยอดรวม (฿)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 text-sm">
              {paginatedMenus.length > 0 ? paginatedMenus.map((item) => (
                <tr key={item.menu_id} className="hover:bg-red-50 transition">
                  <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{item.total_quantity}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-800">{Number(item.total_revenue).toLocaleString()}</td>
                </tr>
              )) : (
                <tr><td colSpan={3} className="px-4 py-4 text-center text-gray-400">ไม่มีข้อมูลในช่วงที่เลือก</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ✅ Pagination Controls for Menus */}
        {totalMenuPages > 1 && (
          <div className="flex justify-between items-center mt-4 px-2">
            <span className="text-xs text-gray-500">หน้า {menuPage} จาก {totalMenuPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setMenuPage(prev => Math.max(prev - 1, 1))} disabled={menuPage === 1} className="p-1 rounded-md border disabled:opacity-30"><ChevronLeftIcon className="w-5 h-5"/></button>
              <button onClick={() => setMenuPage(prev => Math.min(prev + 1, totalMenuPages))} disabled={menuPage === totalMenuPages} className="p-1 rounded-md border disabled:opacity-30"><ChevronRightIcon className="w-5 h-5"/></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportMenu;
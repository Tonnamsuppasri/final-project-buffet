import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { registerLocale } from "react-datepicker";
import { th as thLocale } from 'date-fns/locale/th';
registerLocale('th', thLocale);

import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfDay, endOfDay, subYears } from 'date-fns';
import { CalendarIcon, CurrencyDollarIcon, UserGroupIcon, ClipboardDocumentListIcon, ArrowPathIcon, FunnelIcon, FireIcon } from '@heroicons/react/24/outline';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface OverviewStats {
  totalSales: number;
  totalOrders: number;
  totalCustomers: number;
  avgPerCustomer: number;
}

interface PaymentMethodSummary { method: string; total: number; }
interface PlanSummary { plan_name: string; count: number; }
// ✅ Interface ใหม่สำหรับ Service Type
interface ServiceTypeSummary { type: string; count: number; revenue: number; }

type SmartMode = 'hour' | 'day' | 'month' | 'year' | null;

const ReportOverview = () => {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodSummary[]>([]);
  const [planPopularity, setPlanPopularity] = useState<PlanSummary[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceTypeSummary[]>([]); // ✅ State ใหม่
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState(endOfMonth(new Date()));

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

  useEffect(() => {
      if (!smartMode) return;
      let start, end;
      if (smartMode === 'hour') { start = startOfDay(smartDate); end = endOfDay(smartDate); }
      else if (smartMode === 'day') { start = startOfMonth(smartDate); end = endOfMonth(smartDate); }
      else if (smartMode === 'month') { start = startOfYear(smartDate); end = endOfYear(smartDate); }
      else { start = startOfYear(smartStartYear); end = endOfYear(smartEndYear); }
      setStartDate(start); setEndDate(end);
  }, [smartMode, smartDate, smartStartYear, smartEndYear]);

  const handleManualDateChange = (type: 'start' | 'end', date: Date | null) => {
      if (!date) return;
      setSmartMode(null);
      if (type === 'start') setStartDate(startOfDay(date));
      else setEndDate(endOfDay(date));
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const formattedStart = format(startDate, 'yyyy-MM-dd');
      const formattedEnd = format(endDate, 'yyyy-MM-dd');
      
      const [statsRes, paymentRes, planRes, serviceRes] = await Promise.all([
        axios.get(`${apiUrl}/api/reports/overview/stats`, { params: { startDate: formattedStart, endDate: formattedEnd } }),
        axios.get(`${apiUrl}/api/reports/overview/payment-methods`, { params: { startDate: formattedStart, endDate: formattedEnd } }),
        axios.get(`${apiUrl}/api/reports/overview/plan-popularity`, { params: { startDate: formattedStart, endDate: formattedEnd } }),
        axios.get(`${apiUrl}/api/reports/overview/service-types`, { params: { startDate: formattedStart, endDate: formattedEnd } }), // ✅ ดึงข้อมูลใหม่
      ]);

      setStats(statsRes.data);
      setPaymentMethods(paymentRes.data);
      setPlanPopularity(planRes.data);
      setServiceTypes(serviceRes.data);
    } catch (err) {
      console.error("Error:", err);
      setError("ไม่สามารถดึงข้อมูลรายงานได้");
    } finally {
      setLoading(false);
    }
  };

  const paymentChartData = {
    labels: paymentMethods.map(p => p.method),
    datasets: [{
      label: 'ยอดขาย (บาท)',
      data: paymentMethods.map(p => p.total),
      backgroundColor: ['#10B981', '#F59E0B', '#3B82F6', '#EF4444'],
      borderWidth: 1,
    }],
  };

  const planChartData = {
    labels: planPopularity.map(p => p.plan_name),
    datasets: [{
      label: 'จำนวนลูกค้า (คน)',
      data: planPopularity.map(p => p.count),
      backgroundColor: '#3B82F6',
      borderRadius: 4,
    }],
  };

  // ✅ กราฟใหม่สำหรับ Service Type
  const serviceChartData = {
  // ใช้ค่าจาก DB โดยตรง ไม่ต้อง Hardcode คำว่า "ปิ้งย่าง" หรือ "ชาบู"
  labels: serviceTypes.map(s => s.type), 
  datasets: [{
    data: serviceTypes.map(s => s.count),
    backgroundColor: [
      '#EF4444', // แดง
      '#3B82F6', // ฟ้า
      '#10B981', // เขียว (เผื่อประเภทใหม่)
      '#F59E0B', // ส้ม
    ],
    borderWidth: 1,
  }],
};

  if (loading) return <div className="text-center p-10 text-gray-500">กำลังโหลดข้อมูล...</div>;
  if (error) return <div className="text-center p-10 text-red-500">{error}</div>;

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">ภาพรวม (Dashboard)</h1>
      
      {/* Hybrid Filter Card */}
      <div className="bg-white rounded-lg shadow-md border-l-4 border-blue-500 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-end md:items-center">
              <div className="w-full md:w-auto">
                  <label className="block text-xs text-gray-500 mb-1 font-bold flex items-center gap-1"><FunnelIcon className="w-3 h-3" /> มุมมองด่วน</label>
                  <div className="flex bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
                      {[{ id: 'hour', label: 'รายวัน' }, { id: 'day', label: 'รายเดือน' }, { id: 'month', label: 'รายปี' }, { id: 'year', label: 'ช่วงปี' }].map((mode) => (
                          <button key={mode.id} onClick={() => setSmartMode(mode.id as SmartMode)} className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all flex-1 ${smartMode === mode.id ? 'bg-blue-50 text-blue-600 border border-blue-100 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>{mode.label}</button>
                      ))}
                  </div>
              </div>
              <div className="w-full md:w-auto flex-grow max-w-sm transition-opacity duration-300" style={{ opacity: smartMode ? 1 : 0.5 }}>
                  <label className="block text-xs text-gray-500 mb-1 font-bold">{smartMode === 'hour' ? 'เลือกวันที่' : smartMode === 'day' ? 'เลือกเดือน' : smartMode === 'month' ? 'เลือกปี' : smartMode === 'year' ? 'เลือกช่วงปี' : 'กำหนดเอง'}</label>
                  {smartMode === 'hour' && (<DatePicker selected={smartDate} onChange={(d: Date | null) => d && setSmartDate(d)} dateFormat="dd MMMM yyyy" locale="th" className="input-field w-full p-2 border border-gray-300 rounded-md text-sm font-medium text-center focus:ring-blue-500" withPortal={isMobile} />)}
                  {smartMode === 'day' && (<DatePicker selected={smartDate} onChange={(d: Date | null) => d && setSmartDate(d)} dateFormat="MMMM yyyy" showMonthYearPicker locale="th" className="input-field w-full p-2 border border-gray-300 rounded-md text-sm font-medium text-center focus:ring-blue-500" withPortal={isMobile} />)}
                  {smartMode === 'month' && (<DatePicker selected={smartDate} onChange={(d: Date | null) => d && setSmartDate(d)} dateFormat="yyyy" showYearPicker locale="th" className="input-field w-full p-2 border border-gray-300 rounded-md text-sm font-medium text-center focus:ring-blue-500" withPortal={isMobile} />)}
                  {smartMode === 'year' && (<div className="flex items-center gap-2"><DatePicker selected={smartStartYear} onChange={(d: Date | null) => d && setSmartStartYear(d)} dateFormat="yyyy" showYearPicker locale="th" className="input-field w-full p-2 border border-gray-300 rounded-md text-sm text-center w-24" /><span className="text-gray-400">-</span><DatePicker selected={smartEndYear} onChange={(d: Date | null) => d && setSmartEndYear(d)} dateFormat="yyyy" showYearPicker locale="th" className="input-field w-full p-2 border border-gray-300 rounded-md text-sm text-center w-24" /></div>)}
                  {!smartMode && (<div className="w-full p-2 border border-dashed border-gray-300 rounded-md text-sm text-gray-400 text-center bg-gray-50 cursor-not-allowed">(กำหนดเอง)</div>)}
              </div>
          </div>
          <div className="p-4 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                  <CalendarIcon className={`w-5 h-5 ${!smartMode ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span className={`text-sm font-bold ${!smartMode ? 'text-gray-800' : 'text-gray-500'}`}>ช่วงเวลา:</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                  <DatePicker selected={startDate} onChange={(d) => handleManualDateChange('start', d)} dateFormat="dd/MM/yyyy" locale="th" className={`input-field w-full sm:w-32 p-2 border rounded-md text-sm text-center outline-none transition-all ${!smartMode ? 'border-blue-500 ring-1 ring-blue-500 shadow-sm' : 'border-gray-300 text-gray-600'}`} withPortal={isMobile} />
                  <span className="text-gray-400">-</span>
                  <DatePicker selected={endDate} onChange={(d) => handleManualDateChange('end', d)} dateFormat="dd/MM/yyyy" locale="th" className={`input-field w-full sm:w-32 p-2 border rounded-md text-sm text-center outline-none transition-all ${!smartMode ? 'border-blue-500 ring-1 ring-blue-500 shadow-sm' : 'border-gray-300 text-gray-600'}`} withPortal={isMobile} />
              </div>
              <div className="ml-auto flex items-center gap-2">
                  <button onClick={fetchData} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm flex items-center gap-1 text-sm"><ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin': ''}`} /> อัปเดต</button>
              </div>
          </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="ยอดขายรวม" value={`฿${stats?.totalSales.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0'}`} icon={<CurrencyDollarIcon className="w-8 h-8 text-green-500" />} color="green" />
        <StatCard title="จำนวนออเดอร์" value={`${stats?.totalOrders.toLocaleString('th-TH') || '0'} บิล`} icon={<ClipboardDocumentListIcon className="w-8 h-8 text-blue-500" />} color="blue" />
        <StatCard title="จำนวนลูกค้า" value={`${stats?.totalCustomers.toLocaleString('th-TH') || '0'} คน`} icon={<UserGroupIcon className="w-8 h-8 text-orange-500" />} color="orange" />
        <StatCard 
          title="ยอดเฉลี่ย/คน" 
          value={`฿${(stats?.avgPerCustomer || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
          icon={<CurrencyDollarIcon className="w-8 h-8 text-purple-500" />} 
          color="purple" 
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. แพ็กเกจยอดนิยม */}
        <div className="p-4 bg-white rounded-lg shadow-md">
          <h2 className="text-lg font-bold text-gray-700 mb-4">แพ็กเกจยอดนิยม</h2>
          <div className="h-64 sm:h-80 w-full">
            <Bar data={planChartData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
          </div>
        </div>

        {/* 2. สัดส่วนประเภทบริการ (ปิ้งย่าง/ชาบู) ✅ เพิ่มใหม่ */}
        <div className="p-4 bg-white rounded-lg shadow-md">
          <h2 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
            <FireIcon className="w-5 h-5 text-red-500" /> ประเภทบริการ
          </h2>
          <div className="h-64 sm:h-80 w-full flex justify-center">
            {serviceTypes.length > 0 ? (
                <Pie data={serviceChartData} options={{ maintainAspectRatio: false }} />
            ) : (
                <div className="flex items-center text-gray-400">ไม่มีข้อมูลการบริการ</div>
            )}
          </div>
        </div>

        {/* 3. ช่องทางการชำระเงิน */}
        <div className="p-4 bg-white rounded-lg shadow-md lg:col-span-2">
          <h2 className="text-lg font-bold text-gray-700 mb-4">ช่องทางการชำระเงิน</h2>
          <div className="h-64 sm:h-80 w-full flex justify-center">
            <Pie data={paymentChartData} options={{ maintainAspectRatio: false }} />
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, color }: { title: string, value: string, icon: React.ReactNode, color: string }) => {
    const colorClasses: {[key: string]: string} = {
        green: 'bg-green-50 border-green-200', blue: 'bg-blue-50 border-blue-200', orange: 'bg-orange-50 border-orange-200', purple: 'bg-purple-50 border-purple-200',
    };
    return (
        <div className={`p-5 rounded-lg shadow-sm border ${colorClasses[color] || 'bg-white'} flex items-center space-x-4`}>
            <div className="p-3 bg-white rounded-full shadow-sm">{icon}</div>
            <div><p className="text-xs text-gray-500 uppercase font-bold">{title}</p><p className="text-xl sm:text-2xl font-bold text-gray-800">{value}</p></div>
        </div>
    );
};

export default ReportOverview;
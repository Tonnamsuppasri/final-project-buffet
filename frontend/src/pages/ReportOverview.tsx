import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { format } from 'date-fns';
import { CalendarIcon, CurrencyDollarIcon, UserGroupIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Interfaces (โครงสร้างข้อมูลที่คาดหวังจาก API)
interface OverviewStats {
  totalSales: number;
  totalOrders: number;
  totalCustomers: number;
  avgPerCustomer: number;
}

interface PaymentMethodSummary {
  method: string;
  total: number;
}

interface PlanSummary {
  plan_name: string;
  count: number;
}

const ReportOverview = () => {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodSummary[]>([]);
  const [planPopularity, setPlanPopularity] = useState<PlanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const formattedStart = format(startDate, 'yyyy-MM-dd');
      const formattedEnd = format(endDate, 'yyyy-MM-dd');
      
      // เราจะยิง API 3 ส่วนพร้อมกัน
      const [statsRes, paymentRes, planRes] = await Promise.all([
        axios.get(`${apiUrl}/api/reports/overview/stats`, { 
          params: { startDate: formattedStart, endDate: formattedEnd } 
        }),
        axios.get(`${apiUrl}/api/reports/overview/payment-methods`, { 
          params: { startDate: formattedStart, endDate: formattedEnd } 
        }),
        axios.get(`${apiUrl}/api/reports/overview/plan-popularity`, { 
          params: { startDate: formattedStart, endDate: formattedEnd } 
        }),
      ]);

      setStats(statsRes.data);
      setPaymentMethods(paymentRes.data);
      setPlanPopularity(planRes.data);

    } catch (err) {
      console.error("Error fetching overview data:", err);
      setError("ไม่สามารถดึงข้อมูลรายงานได้");
    } finally {
      setLoading(false);
    }
  };

  // Data for Charts
  const paymentChartData = {
    labels: paymentMethods.map(p => p.method),
    datasets: [{
      label: 'ยอดขายตามช่องทาง',
      data: paymentMethods.map(p => p.total),
      backgroundColor: ['#4CAF50', '#FFC107', '#2196F3', '#E91E63'],
    }],
  };

  const planChartData = {
    labels: planPopularity.map(p => p.plan_name),
    datasets: [{
      label: 'แพ็กเกจบุฟเฟต์ยอดนิยม',
      data: planPopularity.map(p => p.count),
      backgroundColor: '#3B82F6',
    }],
  };

  if (loading) return <div className="text-center p-10">กำลังโหลดข้อมูล...</div>;
  if (error) return <div className="text-center p-10 text-red-500">{error}</div>;

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">ภาพรวมรายงาน (Dashboard)</h1>
      
      {/* Date Picker */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-white rounded-lg shadow">
        <label className="font-semibold">เลือกช่วงวันที่:</label>
        <DatePicker
          selected={startDate}
          onChange={(date: Date | null) => setStartDate(date || new Date())}
          selectsStart
          startDate={startDate}
          endDate={endDate}
          dateFormat="dd/MM/yyyy"
          className="p-2 border rounded-md"
        />
        <span className="mx-2">ถึง</span>
        <DatePicker
          selected={endDate}
          onChange={(date: Date | null) => setEndDate(date || startDate)}
          selectsEnd
          startDate={startDate}
          endDate={endDate}
          minDate={startDate}
          dateFormat="dd/MM/yyyy"
          className="p-2 border rounded-md"
        />
        <button 
          onClick={fetchData} 
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <CalendarIcon className="w-5 h-5 inline-block mr-2" />
          เรียกดู
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="ยอดขายรวม" 
          value={`฿${stats?.totalSales.toLocaleString('th-TH', { minimumFractionDigits: 2 }) || '0.00'}`} 
          icon={<CurrencyDollarIcon className="w-8 h-8 text-green-500" />} 
        />
        <StatCard 
          title="จำนวนออเดอร์" 
          value={`${stats?.totalOrders.toLocaleString('th-TH') || '0'} บิล`} 
          icon={<ClipboardDocumentListIcon className="w-8 h-8 text-blue-500" />} 
        />
        <StatCard 
          title="จำนวนลูกค้า" 
          value={`${stats?.totalCustomers.toLocaleString('th-TH') || '0'} คน`} 
          icon={<UserGroupIcon className="w-8 h-8 text-orange-500" />} 
        />
        <StatCard 
          title="ยอดเฉลี่ย/คน" 
          value={`฿${stats?.avgPerCustomer.toLocaleString('th-TH', { minimumFractionDigits: 2 }) || '0.00'}`} 
          icon={<CurrencyDollarIcon className="w-8 h-8 text-purple-500" />} 
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-4 bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">แพ็กเกจยอดนิยม</h2>
          <div className="h-64 md:h-80">
            <Bar data={planChartData} options={{ maintainAspectRatio: false }} />
          </div>
        </div>
        <div className="p-4 bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">ช่องทางการชำระเงิน</h2>
          <div className="h-64 md:h-80">
            <Pie data={paymentChartData} options={{ maintainAspectRatio: false }} />
          </div>
        </div>
      </div>
    </div>
  );
};

// Component ย่อยสำหรับการ์ดสรุป
const StatCard = ({ title, value, icon }: { title: string, value: string, icon: React.ReactNode }) => (
  <div className="p-5 bg-white rounded-lg shadow-md flex items-center space-x-4">
    <div className="p-3 bg-gray-100 rounded-full">
      {icon}
    </div>
    <div>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
  </div>
);

export default ReportOverview;
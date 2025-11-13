import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { format } from 'date-fns';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Interfaces
interface DailySale {
  date: string; // "yyyy-MM-dd"
  total: number;
}

interface PaymentDetail {
  payment_id: number;
  order_id: number;
  payment_time: string;
  total_price: number;
  payment_method: string;
  table_number: number;
  customer_quantity: number;
}

interface SalesReportData {
  summary: {
    totalSales: number;
    totalOrders: number;
    avgOrderValue: number;
  };
  dailySales: DailySale[];
  paymentDetails: PaymentDetail[];
}

const ReportSales = () => {
  const [reportData, setReportData] = useState<SalesReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Default 30 วันย้อนหลัง
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29); // 30 วันรวมวันนี้
    return d;
  });
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

      // API นี้จะไปเรียก Backend ที่คุณสร้างไว้
      const response = await axios.get(`${apiUrl}/api/reports/sales`, {
        params: { startDate: formattedStart, endDate: formattedEnd }
      });
      setReportData(response.data);
    } catch (err) {
      console.error("Error fetching sales data:", err);
      setError("ไม่สามารถดึงข้อมูลยอดขายได้");
    } finally {
      setLoading(false);
    }
  };

  // Data for Line Chart
  const lineChartData = {
    labels: reportData?.dailySales.map(d => format(new Date(d.date), 'dd/MM')) || [],
    datasets: [{
      label: 'ยอดขายรายวัน',
      data: reportData?.dailySales.map(d => d.total) || [],
      borderColor: 'rgb(75, 192, 192)',
      tension: 0.1,
    }],
  };

  if (loading) return <div className="text-center p-10">กำลังโหลดข้อมูล...</div>;
  if (error) return <div className="text-center p-10 text-red-500">{error}</div>;

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">รายงานยอดขาย</h1>

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
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-white rounded-lg shadow-md text-center">
          <p className="text-sm font-medium text-gray-500">ยอดขายรวม</p>
          <p className="text-3xl font-bold text-green-600">
            ฿{reportData?.summary.totalSales.toLocaleString('th-TH', { minimumFractionDigits: 2 }) || '0.00'}
          </p>
        </div>
        <div className="p-5 bg-white rounded-lg shadow-md text-center">
          <p className="text-sm font-medium text-gray-500">จำนวนบิลทั้งหมด</p>
          <p className="text-3xl font-bold text-blue-600">
            {reportData?.summary.totalOrders.toLocaleString('th-TH') || '0'}
          </p>
        </div>
        <div className="p-5 bg-white rounded-lg shadow-md text-center">
          <p className="text-sm font-medium text-gray-500">ยอดเฉลี่ย/บิล</p>
          <p className="text-3xl font-bold text-purple-600">
            ฿{reportData?.summary.avgOrderValue.toLocaleString('th-TH', { minimumFractionDigits: 2 }) || '0.00'}
          </p>
        </div>
      </div>

      {/* Sales Chart */}
      <div className="p-4 bg-white rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">ยอดขายตามช่วงเวลา</h2>
        <div className="h-80">
          <Line data={lineChartData} options={{ maintainAspectRatio: false }} />
        </div>
      </div>

      {/* Detailed Table */}
      <div className="p-4 bg-white rounded-lg shadow overflow-x-auto">
        <h2 className="text-xl font-semibold mb-4">รายการชำระเงินทั้งหมด</h2>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">เวลา</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">โต๊ะ</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">จำนวนคน</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ช่องทาง</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">ยอดรวม (฿)</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {reportData?.paymentDetails.map((payment) => (
              <tr key={payment.payment_id}>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">{payment.order_id}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm">
                  {format(new Date(payment.payment_time), 'dd/MM/yy HH:mm')}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm">{payment.table_number}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm">{payment.customer_quantity}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm">{payment.payment_method}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium">
                  {payment.total_price.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReportSales;
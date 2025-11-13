import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { format } from 'date-fns';

// ลงทะเบียน components ที่จำเป็นสำหรับ Chart.js
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

// URL ของ Backend API (ดึงจาก environment variable หรือใช้ค่า default)
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Interfaces กำหนดโครงสร้างข้อมูลที่คาดหวังจาก API
interface PlanSale {
  plan_id: number | null; // ID ของ Plan อาจเป็น null สำหรับ 'A La Carte / อื่นๆ'
  plan_name: string; // ชื่อ Plan
  price_per_person: number | null; // ราคาต่อหัว อาจเป็น null
  total_orders: number; // จำนวน Order ทั้งหมดที่ใช้ Plan นี้
  total_customers: number; // จำนวนลูกค้าทั้งหมดที่ใช้ Plan นี้
  total_revenue: number | null; // ยอดรวมจาก Plan นี้ อาจเป็น null
}

interface MenuItemSale {
  menu_id: number; // ID เมนู
  name: string; // ชื่อเมนู
  category: string; // หมวดหมู่เมนู
  total_quantity: number; // จำนวนที่สั่งทั้งหมด
  total_revenue: number; // ยอดรวมจากเมนูนี้ (เฉพาะ A la carte)
}

// Component หลัก
const ReportMenu = () => {
  // States สำหรับเก็บข้อมูลที่ได้จาก API
  const [planSales, setPlanSales] = useState<PlanSale[]>([]); // ข้อมูล Plan
  const [menuSales, setMenuSales] = useState<MenuItemSale[]>([]); // ข้อมูลเมนูทั้งหมด
  const [loading, setLoading] = useState(true); // สถานะกำลังโหลด
  const [error, setError] = useState<string | null>(null); // ข้อความ Error (ถ้ามี)

  // States สำหรับ Date Picker
  const [startDate, setStartDate] = useState(new Date()); // วันที่เริ่มต้น (default วันนี้)
  const [endDate, setEndDate] = useState(new Date()); // วันที่สิ้นสุด (default วันนี้)

  // useEffect: ทำงานเมื่อ Component ถูกสร้าง หรือเมื่อ startDate/endDate เปลี่ยน
  useEffect(() => {
    fetchData(); // เรียกฟังก์ชันดึงข้อมูล
  }, [startDate, endDate]);

  // ฟังก์ชันสำหรับดึงข้อมูลจาก Backend API
  const fetchData = async () => {
    setLoading(true); // เริ่มโหลด
    setError(null); // ล้าง Error เก่า
    try {
      // แปลงวันที่เป็น format 'yyyy-MM-dd' ที่ Backend ต้องการ
      const formattedStart = format(startDate, 'yyyy-MM-dd');
      const formattedEnd = format(endDate, 'yyyy-MM-dd');

      // เรียก API ทั้งสองส่วนพร้อมกันโดยใช้ Promise.all
      const [planRes, menuRes] = await Promise.all([
        axios.get(`${apiUrl}/api/reports/menu/plans`, { // API ดึงข้อมูล Plan
          params: { startDate: formattedStart, endDate: formattedEnd }
        }),
        axios.get(`${apiUrl}/api/reports/menu/items`, { // API ดึงข้อมูลเมนู
          params: { startDate: formattedStart, endDate: formattedEnd }
        }),
      ]);

      // อัปเดต State ด้วยข้อมูลที่ได้รับ
      setPlanSales(planRes.data);
      setMenuSales(menuRes.data); // เก็บข้อมูลเมนูทั้งหมด

    } catch (err) {
      // หากเกิด Error
      console.error("Error fetching menu report data:", err);
      setError("ไม่สามารถดึงข้อมูลรายงานเมนูได้");
    } finally {
      // ไม่ว่าจะสำเร็จหรือล้มเหลว
      setLoading(false); // หยุดโหลด
    }
  };

  // --- Chart Data ---
  // ข้อมูลสำหรับกราฟแท่งของ Plan
  const planChartData = {
    labels: planSales.map(p => p.plan_name), // ชื่อ Plan เป็นแกน Y
    datasets: [{
      label: 'จำนวนลูกค้า (คน)', // ชื่อชุดข้อมูล
      data: planSales.map(p => p.total_customers), // จำนวนลูกค้าเป็นค่า
      backgroundColor: '#34D399', // สีแท่งกราฟ
    }],
  };

  // ✅ FIX: ดึงข้อมูลเฉพาะ 5 อันดับแรกสำหรับกราฟเมนูขายดี
  const top5MenuSales = menuSales.slice(0, 5);

  // ข้อมูลสำหรับกราฟแท่งของเมนูขายดี (ใช้ top5MenuSales)
  const menuChartData = {
    labels: top5MenuSales.map(m => m.name), // ชื่อเมนู 5 อันดับแรกเป็นแกน Y
    datasets: [{
      label: 'จำนวนที่ขายได้ (จาน)', // ชื่อชุดข้อมูล
      data: top5MenuSales.map(m => m.total_quantity), // จำนวนที่ขายได้เป็นค่า
      backgroundColor: '#F87171', // สีแท่งกราฟ
    }],
  };
  // --- End Chart Data ---

  // แสดงผล "กำลังโหลด" ถ้ายังโหลดข้อมูลไม่เสร็จ
  if (loading) return <div className="text-center p-10">กำลังโหลดข้อมูล...</div>;
  // แสดงผล Error ถ้าการดึงข้อมูลล้มเหลว
  if (error) return <div className="text-center p-10 text-red-500">{error}</div>;

  // แสดงผล Component หลัก
  return (
    <div className="p-4 space-y-6 bg-gray-50 min-h-screen"> {/* เพิ่มพื้นหลังและ min-height */}
      <h1 className="text-3xl font-bold text-gray-800 mb-6">รายงานเมนูและบุฟเฟต์</h1> {/* เพิ่ม margin-bottom */}

      {/* Date Picker Section */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-white rounded-lg shadow-md mb-6"> {/* เพิ่ม shadow และ margin-bottom */}
        <label className="font-semibold text-gray-700">เลือกช่วงวันที่:</label>
        <DatePicker
          selected={startDate}
          onChange={(date: Date | null) => setStartDate(date || new Date())} // Handle null date
          selectsStart
          startDate={startDate}
          endDate={endDate}
          dateFormat="dd/MM/yyyy"
          className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" // ปรับสไตล์
        />
        <span className="mx-2 text-gray-500">ถึง</span>
        <DatePicker
          selected={endDate}
          onChange={(date: Date | null) => setEndDate(date || startDate)} // Handle null date, default to startDate if null
          selectsEnd
          startDate={startDate}
          endDate={endDate}
          minDate={startDate} // วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มต้น
          dateFormat="dd/MM/yyyy"
          className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" // ปรับสไตล์
        />
        {/* ไม่จำเป็นต้องมีปุ่ม "เรียกดู" เพราะ useEffect ทำงานอัตโนมัติเมื่อวันที่เปลี่ยน */}
      </div>

      {/* Plan (Buffet) Report Section */}
      <div className="p-6 bg-white rounded-lg shadow-md mb-6"> {/* เพิ่ม padding และ margin-bottom */}
        <h2 className="text-2xl font-semibold mb-4 text-green-700 border-b pb-2">รายงานแพ็กเกจบุฟเฟต์</h2> {/* เพิ่ม border-bottom */}
        {/* กราฟ Plan */}
        <div className="h-80 mb-6 relative"> {/* เพิ่ม margin-bottom และ relative positioning */}
          {planSales.length > 0 ? (
             <Bar data={planChartData} options={{ maintainAspectRatio: false, indexAxis: 'y' }} />
          ) : (
            <p className="text-center text-gray-500 absolute inset-0 flex items-center justify-center">ไม่มีข้อมูลแพ็กเกจในช่วงวันที่เลือก</p>
          )}
        </div>
        {/* ตาราง Plan */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 border border-gray-200"> {/* เพิ่ม border */}
            <thead className="bg-gray-100"> {/* เปลี่ยนสีพื้นหลัง a */}
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">แพ็กเกจ</th> {/* ปรับสีและ tracking */}
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">ราคา/คน</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">จำนวนบิล</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">จำนวนลูกค้า</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">ยอดรวม (฿)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {planSales.length > 0 ? (
                planSales.map((plan, index) => (
                  <tr key={plan.plan_id ?? `alacarte-${index}`} className="hover:bg-gray-50 transition-colors"> {/* เพิ่ม hover effect */}
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{plan.plan_name}</td>
                    {/* ตรวจสอบว่าเป็น Number ก่อนเรียก .toFixed() */}
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-700">
                      {typeof plan.price_per_person === 'number'
                        ? plan.price_per_person.toFixed(2)
                        : 'N/A'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-700">{plan.total_orders}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900">{plan.total_customers}</td> {/* ปรับ font-weight */}
                    {/* ตรวจสอบว่าเป็น Number ก่อนเรียก .toLocaleString() */}
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                       {typeof plan.total_revenue === 'number'
                         ? plan.total_revenue.toLocaleString('th-TH', { minimumFractionDigits: 2 })
                         : 'N/A'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-gray-500">ไม่มีข้อมูล</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* A La Carte Menu Report Section */}
      <div className="p-6 bg-white rounded-lg shadow-md"> {/* เพิ่ม padding */}
        <h2 className="text-2xl font-semibold mb-4 text-red-700 border-b pb-2">รายงานเมนู (ขายดี)</h2> {/* เพิ่ม border-bottom */}
        {/* กราฟ Menu (Top 5) */}
        <div className="h-80 mb-6 relative"> {/* เพิ่ม margin-bottom และ relative */}
         {top5MenuSales.length > 0 ? (
            <Bar data={menuChartData} options={{ maintainAspectRatio: false, indexAxis: 'y' }} />
          ) : (
            <p className="text-center text-gray-500 absolute inset-0 flex items-center justify-center">ไม่มีข้อมูลเมนู ในช่วงวันที่เลือก</p>
          )}
        </div>
        {/* ตาราง Menu (ทั้งหมด) */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 border border-gray-200"> {/* เพิ่ม border */}
            <thead className="bg-gray-100"> {/* เปลี่ยนสีพื้นหลัง */}
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">เมนู</th> {/* ปรับสีและ tracking */}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">หมวดหมู่</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">จำนวน (จาน)</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">ยอดรวม (฿)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {menuSales.length > 0 ? (
                 // ✅ ใช้ menuSales (ตัวเต็ม) ในการ render ตาราง
                menuSales.map((item) => (
                  <tr key={item.menu_id} className="hover:bg-gray-50 transition-colors"> {/* เพิ่ม hover effect */}
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.category}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900">{item.total_quantity}</td> {/* ปรับ font-weight */}
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900">{item.total_revenue.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))
              ) : (
                 <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-gray-500">ไม่มีข้อมูล</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReportMenu;
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { format } from 'date-fns';
import { th } from 'date-fns/locale'; // Import locale ภาษาไทย
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js'; // Import Chart.js components
import { Bar } from 'react-chartjs-2'; // Import Bar component
import { UserCircleIcon, CalendarDaysIcon, ClockIcon } from '@heroicons/react/24/outline'; // Icons

// ลงทะเบียน Chart.js components ที่จำเป็น
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// URL ของ Backend API
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// --- Interfaces ---
// Interface สำหรับข้อมูล User (จาก /api/staff)
interface User {
    id: number;
    username: string;
    first_name?: string;
    last_name?: string;
    nickname?: string;
}

// Interface สำหรับข้อมูลสรุปที่ได้รับจาก API /api/attendance/summary
interface AttendanceSummary {
    user_id: number;
    username: string;
    first_name: string | null;
    last_name: string | null;
    nickname: string | null;
    days_worked: number;
    total_minutes_worked: number; // นาทีรวม (ดิบ)
    total_time_worked_formatted: string; // รูปแบบ "X ชม. Y นาที"
}

// --- Component หลัก ---
const AttendanceSummaryReport = () => {
    // --- States ---
    const [summaryData, setSummaryData] = useState<AttendanceSummary[]>([]); // ข้อมูลสรุป
    const [staffList, setStaffList] = useState<User[]>([]); // รายชื่อพนักงาน
    const [loading, setLoading] = useState(false); // สถานะ Loading
    const [error, setError] = useState<string | null>(null); // ข้อความ Error

    // --- Filters States ---
    const [selectedUserId, setSelectedUserId] = useState<string>(''); // ID พนักงานที่เลือก
    // Default วันที่เริ่มเป็นวันแรกของเดือนปัจจุบัน
    const [startDate, setStartDate] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [endDate, setEndDate] = useState(new Date()); // Default วันที่สิ้นสุดเป็นวันนี้

    // --- 1. Fetch รายชื่อพนักงาน (สำหรับ Filter Dropdown) ---
    useEffect(() => {
        const fetchStaff = async () => {
            try {
                // *** สำคัญ: ต้องใส่ Header Authentication ที่ตรงกับ Backend ***
                const adminUserId = localStorage.getItem('userId');
                if (!adminUserId) {
                    console.warn("AttendanceSummaryReport: Admin User ID not found for fetching staff list.");
                    return;
                }
                const response = await axios.get<User[]>(`${apiUrl}/api/staff`, {
                    headers: { 'x-user-id': adminUserId } // <<< ตัวอย่าง Header
                    // headers: { 'Authorization': `Bearer ${yourAdminToken}` } // <<< ตัวอย่าง Token
                });
                setStaffList(response.data);
            } catch (err) {
                console.error("Error fetching staff list for summary:", err);
            }
        };
        fetchStaff();
    }, []); // ทำงานครั้งเดียว

    // --- 2. Fetch ข้อมูลสรุปตาม Filter ---
    useEffect(() => {
        const fetchSummaryData = async () => {
            if (!startDate || !endDate) {
                setError("กรุณาเลือกวันที่เริ่มต้นและสิ้นสุด");
                return;
            }
            setLoading(true);
            setError(null);
            try {
                const params: { [key: string]: string } = {
                    startDate: format(startDate, 'yyyy-MM-dd'),
                    endDate: format(endDate, 'yyyy-MM-dd'),
                };
                if (selectedUserId) params.userId = selectedUserId;

                const adminUserId = localStorage.getItem('userId');
                if (!adminUserId) {
                    setError("ไม่พบข้อมูล Admin User ID ใน localStorage");
                    setLoading(false);
                    return;
                }

                // เรียก API /api/attendance/summary
                const response = await axios.get<AttendanceSummary[]>(`${apiUrl}/api/attendance/summary`, {
                    params,
                    headers: { 'x-user-id': adminUserId } // <<< ตัวอย่าง Header
                    // headers: { 'Authorization': `Bearer ${yourAdminToken}` } // <<< ตัวอย่าง Token
                });
                setSummaryData(response.data);

            } catch (err: any) {
                console.error("Error fetching attendance summary:", err);
                setError(err.response?.data?.error || "ไม่สามารถดึงข้อมูลสรุปการลงเวลาได้");
            } finally {
                setLoading(false);
            }
        };
        fetchSummaryData();
    }, [selectedUserId, startDate, endDate]); // ทำงานใหม่เมื่อ Filter เปลี่ยน

    // --- 3. Helper แสดงชื่อพนักงาน ---
    const getDisplayName = (user: AttendanceSummary | User): string => {
        return user.nickname || user.first_name || user.username || `User ID: ${'user_id' in user ? user.user_id : user.id}`;
    };

    // --- 4. ✨ เตรียมข้อมูลสำหรับกราฟ ✨ ---
    const chartData = useMemo(() => {
        // เรียงข้อมูลตามชั่วโมงทำงาน (มากไปน้อย) สำหรับกราฟ
        const sortedSummary = [...summaryData].sort((a, b) => b.total_minutes_worked - a.total_minutes_worked);

        return {
            labels: sortedSummary.map(getDisplayName), // ชื่อพนักงาน
            datasets: [
                {
                    label: 'รวมเวลาทำงาน (นาที)', // ชื่อ dataset
                    data: sortedSummary.map(item => item.total_minutes_worked), // ใช้ข้อมูลนาทีดิบ
                    backgroundColor: 'rgba(75, 192, 192, 0.6)', // สีแท่งกราฟ (เขียวอมฟ้า)
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1,
                },
            ],
        };
    }, [summaryData]); // คำนวณใหม่เมื่อ summaryData เปลี่ยน

    // --- 5. ✨ ตั้งค่า Options สำหรับกราฟ ✨ ---
    const chartOptions = {
        indexAxis: 'y' as const, // ทำให้เป็นกราฟแท่งแนวนอน
        responsive: true,
        maintainAspectRatio: false, // สำคัญ: เพื่อให้กำหนดความสูงของกราฟได้
        plugins: {
            legend: {
                display: false, // ซ่อน legend ถ้ามีแค่ dataset เดียว
            },
            title: {
                display: true,
                text: 'สรุปชั่วโมงทำงาน (เรียงตามนาทีรวม)', // หัวข้อกราฟ
                font: { size: 16 } // ขนาด Font หัวข้อ (ปรับได้)
            },
            tooltip: { // ปรับแต่งข้อความตอน Hover
                callbacks: {
                    label: function(context: any) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.x !== null) {
                            // แปลงนาทีกลับเป็น "X ชม. Y นาที" สำหรับ Tooltip
                            const totalMinutes = context.parsed.x;
                            const hours = Math.floor(totalMinutes / 60);
                            const minutes = totalMinutes % 60;
                            label += `${hours} ชม. ${minutes} นาที`;
                        }
                        return label;
                    }
                }
            }
        },
        scales: { // ตั้งค่าแกน
            x: { // แกน X (แนวนอน - นาที)
                beginAtZero: true, // เริ่มที่ 0
                title: {
                    display: true,
                    text: 'นาทีรวม', // ชื่อแกน X
                },
            },
            y: { // แกน Y (แนวตั้ง - ชื่อพนักงาน)
                 ticks: {
                    autoSkip: false // พยายามแสดงชื่อทุกคน (อาจต้องเลื่อนถ้าเยอะมาก)
                }
            }
        },
    };


    // --- 6. Render Component ---
    return (
        <div className="p-4 sm:p-6 space-y-6 bg-gray-50 min-h-screen">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">สรุปรายงานการลงเวลาทำงาน</h1>

            {/* --- Filter Section --- */}
            <div className="p-4 bg-white rounded-lg shadow-md flex flex-col sm:flex-row flex-wrap items-end gap-4">
                 {/* Staff Filter */}
                 <div className="w-full sm:w-auto flex-grow sm:flex-grow-0">
                    <label htmlFor="userFilter" className="block text-sm font-medium text-gray-700 mb-1">พนักงาน</label>
                    <select id="userFilter" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="input-field w-full sm:min-w-[200px]">
                        <option value="">-- พนักงานทั้งหมด --</option>
                        {staffList.map(staff => (<option key={staff.id} value={staff.id}>{getDisplayName(staff)}</option>))}
                    </select>
                </div>
                 {/* Date Filters */}
                 <div className="w-full sm:w-auto">
                    <label className="block text-sm font-medium text-gray-700 mb-1">ตั้งแต่วันที่</label>
                    <DatePicker selected={startDate} onChange={(date: Date | null) => setStartDate(date || new Date())} selectsStart startDate={startDate} endDate={endDate} dateFormat="dd/MM/yyyy" className="input-field w-full" required/>
                </div>
                <div className="w-full sm:w-auto">
                    <label className="block text-sm font-medium text-gray-700 mb-1">ถึงวันที่</label>
                    <DatePicker selected={endDate} onChange={(date: Date | null) => setEndDate(date || startDate)} selectsEnd startDate={startDate} endDate={endDate} minDate={startDate} dateFormat="dd/MM/yyyy" className="input-field w-full" required/>
                </div>
            </div>

            {/* --- Loading / Error --- */}
            {loading && <div className="text-center p-6 text-blue-600">กำลังโหลดข้อมูลสรุป...</div>}
            {error && <div className="text-center p-6 text-red-600 bg-red-100 border border-red-400 rounded">{error}</div>}

            {/* --- ✨ Chart Section ✨ --- */}
            {!loading && !error && summaryData.length > 0 && (
                <div className="bg-white rounded-lg shadow-md p-4 h-[400px] md:h-[500px] lg:h-[600px]"> {/* กำหนดความสูงของ Chart Container */}
                    {/* <h2 className="text-xl font-semibold mb-4 text-center text-gray-700">กราฟสรุปเวลาทำงาน</h2> */} {/* หัวข้ออยู่ใน Chart Options แล้ว */}
                    <Bar options={chartOptions} data={chartData} />
                </div>
            )}
             {/* --- End Chart Section --- */}

            {/* --- Summary Table --- */}
            {!loading && !error && (
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                    <h2 className="text-xl font-semibold p-4 border-b text-gray-700">ตารางสรุปผล</h2> {/* เพิ่มหัวข้อตาราง */}
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                        <UserCircleIcon className="w-4 h-4 inline-block mr-1 text-gray-400"/>
                                        ชื่อพนักงาน
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                                        <CalendarDaysIcon className="w-4 h-4 inline-block mr-1 text-gray-400"/>
                                        จำนวนวันทำงาน
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                                        <ClockIcon className="w-4 h-4 inline-block mr-1 text-gray-400"/>
                                        เวลารวมโดยประมาณ
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {summaryData.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-6 text-center text-gray-500 italic">
                                            ไม่พบข้อมูลสรุปในช่วงวันที่และเงื่อนไขที่เลือก
                                        </td>
                                    </tr>
                                ) : (
                                    summaryData.map(summary => (
                                        <tr key={summary.user_id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {getDisplayName(summary)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-700">
                                                {summary.days_worked} วัน
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-800 font-semibold">
                                                {summary.total_time_worked_formatted}
                                                {/* (Optional) แสดงนาทีรวมในวงเล็บ */}
                                                {/* <span className="text-xs text-gray-500 ml-1">({summary.total_minutes_worked} นาที)</span> */}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                     {/* Footer ตาราง (Optional) */}
                     {summaryData.length > 0 && (
                        <div className="px-6 py-3 bg-gray-50 text-right text-sm font-semibold text-gray-700 border-t">
                            รวม {summaryData.length} รายการ
                         </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AttendanceSummaryReport;
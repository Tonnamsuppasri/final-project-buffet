import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { th } from 'date-fns/locale';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface User {
    id: number;
    username: string;
    first_name?: string;
    last_name?: string;
    nickname?: string;
}

interface AttendanceRecord {
    attendance_id: number;
    user_id: number;
    clock_in_time: string; // ISO String
    clock_out_time: string | null; // ISO String or null
    date: string; // YYYY-MM-DD
    notes: string | null;
    // Fields from JOIN with users
    username: string;
    first_name?: string;
    last_name?: string;
    nickname?: string;
}

const AttendanceReport = () => {
    const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
    const [staffList, setStaffList] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [selectedUserId, setSelectedUserId] = useState<string>(''); // Store ID as string for select value
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date());

    // --- Fetch Staff List for Filter Dropdown ---
    useEffect(() => {
        const fetchStaff = async () => {
            try {
                // *** ต้องมี Header สำหรับ Authentication ถ้า API /api/staff ต้องการ ***
                const response = await axios.get<User[]>(`${apiUrl}/api/staff`/*, { headers: { ... } }*/);
                setStaffList(response.data);
            } catch (err) {
                console.error("Error fetching staff list:", err);
            }
        };
        fetchStaff();
    }, []);

    // --- Fetch Attendance Data based on Filters ---
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const params: { [key: string]: string } = {};
                if (selectedUserId) params.userId = selectedUserId;
                if (startDate) params.startDate = format(startDate, 'yyyy-MM-dd');
                if (endDate) params.endDate = format(endDate, 'yyyy-MM-dd');

                // --- 👇 เพิ่ม headers ตรงนี้ 👇 ---
                // ดึง Admin User ID จาก localStorage (ต้องแน่ใจว่าเก็บไว้ตอน Login)
                const adminUserId = localStorage.getItem('userId');
                if (!adminUserId) {
                    setError("ไม่พบข้อมูล Admin User ID ใน localStorage");
                    setLoading(false);
                    return; // หยุดทำงานถ้าไม่เจอ ID
                }

                const response = await axios.get<AttendanceRecord[]>(`${apiUrl}/api/attendance`, {
                    params,
                    headers: {
                        'x-user-id': adminUserId // 👈 ส่ง ID ของ Admin ที่ Login อยู่
                        // ถ้าใช้ JWT: 'Authorization': `Bearer ${yourAdminToken}`
                    }
                });
                // --- 👆 เพิ่ม headers ตรงนี้ 👆 ---

                setAttendanceData(response.data);
            } catch (err: any) { // เพิ่ม any type ชั่วคราว
                console.error("Error fetching attendance report:", err);
                // แสดง error จาก backend ถ้ามี
                setError(err.response?.data?.error || "ไม่สามารถดึงข้อมูลรายงานการลงเวลาได้");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [selectedUserId, startDate, endDate]); // Refetch when filters change

    // --- Calculate Work Duration ---
    const calculateDuration = (start: string, end: string | null): string => {
        if (!end) return '-';
        try {
            const startTime = parseISO(start);
            const endTime = parseISO(end);
            const minutes = differenceInMinutes(endTime, startTime);
            if (minutes < 0) return 'N/A'; // Error case
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = minutes % 60;
            return `${hours} ชม. ${remainingMinutes} นาที`;
        } catch {
            return 'N/A';
        }
    };

     // --- Group data by date for better display ---
     const groupedData = useMemo(() => {
        return attendanceData.reduce((acc, record) => {
            const dateStr = format(parseISO(record.date), 'yyyy-MM-dd');
            if (!acc[dateStr]) {
                acc[dateStr] = [];
            }
            acc[dateStr].push(record);
            return acc;
        }, {} as { [key: string]: AttendanceRecord[] });
     }, [attendanceData]);

     const sortedDates = useMemo(() => Object.keys(groupedData).sort().reverse(), [groupedData]);


    return (
        <div className="p-4 sm:p-6 space-y-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">รายงานการลงเวลาทำงาน</h1>

            {/* Filters */}
            <div className="p-4 bg-white rounded-lg shadow-md flex flex-col sm:flex-row flex-wrap items-center gap-4">
                 <div className="w-full sm:w-auto">
                    <label htmlFor="userFilter" className="block text-sm font-medium text-gray-700 mb-1">พนักงาน</label>
                    <select
                        id="userFilter"
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        className="input-field w-full sm:w-48" // Responsive width
                    >
                        <option value="">-- ทั้งหมด --</option>
                        {staffList.map(staff => (
                            <option key={staff.id} value={staff.id}>
                                {staff.nickname || staff.first_name || staff.username}
                            </option>
                        ))}
                    </select>
                </div>
                 <div className="w-full sm:w-auto">
                    <label className="block text-sm font-medium text-gray-700 mb-1">ตั้งแต่</label>
                    <DatePicker
                        selected={startDate}
                        onChange={(date: Date | null) => setStartDate(date || new Date())}
                        selectsStart
                        startDate={startDate}
                        endDate={endDate}
                        dateFormat="dd/MM/yyyy"
                        className="input-field w-full"
                    />
                </div>
                <div className="w-full sm:w-auto">
                    <label className="block text-sm font-medium text-gray-700 mb-1">ถึง</label>
                    <DatePicker
                        selected={endDate}
                        onChange={(date: Date | null) => setEndDate(date || startDate)}
                        selectsEnd
                        startDate={startDate}
                        endDate={endDate}
                        minDate={startDate}
                        dateFormat="dd/MM/yyyy"
                        className="input-field w-full"
                    />
                </div>
                 {/* Optional: Add a refresh button if needed */}
            </div>

            {/* Loading/Error State */}
            {loading && <div className="text-center p-6">กำลังโหลดข้อมูล...</div>}
            {error && <div className="text-center p-6 text-red-500 bg-red-100 border border-red-400 rounded">{error}</div>}

            {/* Attendance Table - Grouped by Date */}
            {!loading && !error && (
                 <div className="space-y-6">
                    {sortedDates.length === 0 && <p className="text-center text-gray-500 py-6">ไม่พบข้อมูลการลงเวลาในช่วงที่เลือก</p>}
                    {sortedDates.map(date => (
                        <div key={date} className="bg-white rounded-lg shadow-md overflow-hidden">
                             <h2 className="p-3 bg-gray-100 text-lg font-semibold text-gray-700 border-b">
                                {format(parseISO(date), 'EEEE dd MMMM yyyy', { locale: th })}
                             </h2>
                             <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">พนักงาน</th>
                                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">เวลาเข้า</th>
                                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">เวลาออก</th>
                                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">รวมเวลาทำงาน</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">หมายเหตุ</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {groupedData[date].map(record => (
                                            <tr key={record.attendance_id}>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    {record.nickname || record.first_name || record.username}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-700">
                                                    {format(parseISO(record.clock_in_time), 'HH:mm:ss น.')}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-700">
                                                    {record.clock_out_time ? format(parseISO(record.clock_out_time), 'HH:mm:ss น.') : '-'}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-800 font-medium">
                                                    {calculateDuration(record.clock_in_time, record.clock_out_time)}
                                                </td>
                                                <td className="px-4 py-3 whitespace-normal text-sm text-gray-500">{record.notes || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                     ))}
                 </div>
            )}
        </div>
    );
};

export default AttendanceReport;
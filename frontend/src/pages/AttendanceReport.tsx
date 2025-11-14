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
    const [selectedUserId, setSelectedUserId] = useState<string>(''); 
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date());

    // --- Fetch Staff List for Filter Dropdown ---
    useEffect(() => {
        const fetchStaff = async () => {
            try {
                const adminUserId = localStorage.getItem('userId');
                const response = await axios.get<User[]>(`${apiUrl}/api/staff`, { 
                    headers: { 'x-user-id': adminUserId || '' }
                });
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

                const adminUserId = localStorage.getItem('userId');
                if (!adminUserId) {
                    setError("ไม่พบข้อมูล Admin User ID ใน localStorage");
                    setLoading(false);
                    return; 
                }

                const response = await axios.get<AttendanceRecord[]>(`${apiUrl}/api/attendance`, {
                    params,
                    headers: {
                        'x-user-id': adminUserId 
                    }
                });
                setAttendanceData(response.data);
            } catch (err: any) { 
                console.error("Error fetching attendance report:", err);
                setError(err.response?.data?.error || "ไม่สามารถดึงข้อมูลรายงานการลงเวลาได้");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [selectedUserId, startDate, endDate]); 

    // --- Calculate Work Duration ---
    const calculateDuration = (start: string, end: string | null): string => {
        if (!end) return '-';
        try {
            const startTime = parseISO(start);
            const endTime = parseISO(end);
            const minutes = differenceInMinutes(endTime, startTime);
            if (minutes < 0) return 'N/A'; 
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
            const dateStr = format(parseISO(record.date), 'yyyy-MM-dd'); //
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

            {/* Filters (คงเดิม) */}
            <div className="p-4 bg-white rounded-lg shadow-md flex flex-col sm:flex-row flex-wrap items-center gap-4">
                 <div className="w-full sm:w-auto">
                    <label htmlFor="userFilter" className="block text-sm font-medium text-gray-700 mb-1">พนักงาน</label>
                    <select
                        id="userFilter"
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        className="input-field w-full sm:w-48" 
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
            </div>

            {/* Loading/Error State (คงเดิม) */}
            {loading && <div className="text-center p-6">กำลังโหลดข้อมูล...</div>}
            {error && <div className="text-center p-6 text-red-500 bg-red-100 border border-red-400 rounded">{error}</div>}

            {/* Attendance Table - Grouped by Date */}
            {!loading && !error && (
                 <div className="space-y-6">
                    {sortedDates.length === 0 && <p className="text-center text-gray-500 py-6">ไม่พบข้อมูลการลงเวลาในช่วงที่เลือก</p>}
                    {sortedDates.map(date => (
                        // ลบ overflow-hidden ออก (ตามที่คุยกันครั้งก่อน)
                        <div key={date} className="bg-white rounded-lg shadow-md">
                             <h2 className="p-3 bg-gray-100 text-lg font-semibold text-gray-700 border-b">
                                {format(parseISO(date), 'EEEE dd MMMM yyyy', { locale: th })}
                             </h2>
                             {/* overflow-x-auto ยังจำเป็นเผื่อจอเล็กมากๆ หรือชื่อพนักงานยาวมาก */}
                             <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            {/* ✅ 1. หัวตาราง: ซ่อน 4 อันหลังบนมือถือ */}
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">พนักงาน</th>
                                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">เวลาเข้า</th>
                                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">เวลาออก</th>
                                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">รวมเวลาทำงาน</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">หมายเหตุ</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {groupedData[date].map(record => (
                                            <tr key={record.attendance_id}>
                                                
                                                {/* ✅ 2. เซลล์พนักงาน: แสดงข้อมูลทั้งหมดในนี้ */}
                                                <td className="px-4 py-3 whitespace-normal text-sm">
                                                    {/* ชื่อ (แสดงตลอด) */}
                                                    <div className="font-medium text-gray-900">
                                                        {record.nickname || record.first_name || record.username}
                                                    </div>
                                                    
                                                    {/* (ใหม่) ข้อมูลที่เหลือ (แสดงเฉพาะบนมือถือ) */}
                                                    <div className="md:hidden mt-2 text-gray-700 space-y-1 text-xs">
                                                        <div className="flex justify-between">
                                                            <span className="font-medium text-gray-500">เวลาเข้า:</span>
                                                            <span>{format(parseISO(record.clock_in_time), 'HH:mm:ss น.')}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="font-medium text-gray-500">เวลาออก:</span>
                                                            <span>{record.clock_out_time ? format(parseISO(record.clock_out_time), 'HH:mm:ss น.') : '-'}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="font-medium text-gray-500">รวมเวลา:</span>
                                                            <span className="font-bold">{calculateDuration(record.clock_in_time, record.clock_out_time)}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="font-medium text-gray-500">หมายเหตุ:</span>
                                                            <span className="truncate">{record.notes || '-'}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                
                                                {/* ✅ 3. เซลล์ที่เหลือ: ซ่อนบนมือถือ */}
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-700 hidden md:table-cell">
                                                    {format(parseISO(record.clock_in_time), 'HH:mm:ss น.')}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-700 hidden md:table-cell">
                                                    {record.clock_out_time ? format(parseISO(record.clock_out_time), 'HH:mm:ss น.') : '-'}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-800 font-medium hidden md:table-cell">
                                                    {calculateDuration(record.clock_in_time, record.clock_out_time)}
                                                </td>
                                                <td className="px-4 py-3 whitespace-normal text-sm text-gray-500 hidden md:table-cell">
                                                    {record.notes || '-'}
                                                </td>
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
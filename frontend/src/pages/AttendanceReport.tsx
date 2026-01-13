import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { 
    format, parseISO, differenceInMinutes, 
    startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths 
} from 'date-fns';
import { th } from 'date-fns/locale';
import { FunnelIcon, CalendarIcon } from '@heroicons/react/24/outline'; // เพิ่ม Icon

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
    clock_in_time: string;
    clock_out_time: string | null;
    date: string;
    notes: string | null;
    username: string;
    first_name?: string;
    last_name?: string;
    nickname?: string;
}

const AttendanceReport = () => {
    // --- States ---
    // เริ่มต้นที่ "วันนี้"
    const [startDate, setStartDate] = useState(startOfDay(new Date()));
    const [endDate, setEndDate] = useState(endOfDay(new Date()));
    const [filterMode, setFilterMode] = useState<'today' | 'yesterday' | 'thisMonth' | 'lastMonth' | 'custom'>('today');

    const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
    const [staffList, setStaffList] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedUserId, setSelectedUserId] = useState<string>(''); 

    // --- Smart Filter Logic ---
    const handleSmartFilter = (mode: 'today' | 'yesterday' | 'thisMonth' | 'lastMonth') => {
        const now = new Date();
        let start = new Date();
        let end = new Date();

        switch (mode) {
            case 'today':
                start = startOfDay(now);
                end = endOfDay(now);
                break;
            case 'yesterday':
                const yesterday = subDays(now, 1);
                start = startOfDay(yesterday);
                end = endOfDay(yesterday);
                break;
            case 'thisMonth':
                start = startOfMonth(now);
                end = endOfMonth(now);
                break;
            case 'lastMonth':
                const lastMonth = subMonths(now, 1);
                start = startOfMonth(lastMonth);
                end = endOfMonth(lastMonth);
                break;
        }
        setStartDate(start);
        setEndDate(end);
        setFilterMode(mode);
    };

    const handleDateChange = (dates: [Date | null, Date | null]) => {
        const [start, end] = dates;
        setStartDate(start || new Date());
        setEndDate(end || new Date());
        setFilterMode('custom'); // เปลี่ยนเป็นโหมดกำหนดเองเมื่อมีการเลือกวันที่
    };

    // --- Fetch Data ---
    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const formattedStart = format(startDate, 'yyyy-MM-dd HH:mm:ss');
            // ถ้า endDate ยังไม่เลือก ให้ใช้ startDate ไปก่อน
            const formattedEnd = format(endDate || startDate, 'yyyy-MM-dd HH:mm:ss');

            let url = `${apiUrl}/api/attendance?startDate=${formattedStart}&endDate=${formattedEnd}`;
            if (selectedUserId) {
                url += `&userId=${selectedUserId}`;
            }

            const response = await axios.get(url);
            setAttendanceData(response.data);
        } catch (err) {
            console.error("Error fetching attendance:", err);
            setError("ไม่สามารถโหลดข้อมูลได้");
        } finally {
            setLoading(false);
        }
    };

    // โหลดรายชื่อพนักงานครั้งแรก
    useEffect(() => {
        const fetchStaff = async () => {
            try {
                const res = await axios.get(`${apiUrl}/api/staff`);
                setStaffList(res.data);
            } catch (err) {
                console.error("Error fetching staff:", err);
            }
        };
        fetchStaff();
    }, []);

    // โหลดข้อมูลเมื่อ Filter เปลี่ยน
    useEffect(() => {
        if (startDate && endDate) {
            fetchData();
        }
    }, [startDate, endDate, selectedUserId]);

    // --- Helper Functions ---
    const calculateDuration = (start: string, end: string | null) => {
        if (!end) return 'ยังไม่เลิกงาน';
        const minutes = differenceInMinutes(parseISO(end), parseISO(start));
        const hrs = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hrs} ชม. ${mins} นาที`;
    };

    // จัดกลุ่มข้อมูลตามวันที่
    const groupedData = useMemo(() => {
        const groups: { [key: string]: AttendanceRecord[] } = {};
        attendanceData.forEach(record => {
            const dateKey = record.date;
            if (!groups[dateKey]) groups[dateKey] = [];
            groups[dateKey].push(record);
        });
        // Sort วันที่ล่าสุดขึ้นก่อน
        return Object.entries(groups).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
    }, [attendanceData]);

    return (
        <div className="p-4 sm:p-8 bg-gray-50 min-h-screen font-sans">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-2">
                    🕒 รายงานการเข้างาน
                </h1>
            </div>

            {/* --- Smart Filter Bar --- */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6">
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                    
                    {/* ปุ่มเลือกช่วงเวลาด่วน */}
                    <div className="flex flex-wrap gap-2">
                        {[
                            { label: 'วันนี้', value: 'today' },
                            { label: 'เมื่อวาน', value: 'yesterday' },
                            { label: 'เดือนนี้', value: 'thisMonth' },
                            { label: 'เดือนที่แล้ว', value: 'lastMonth' }
                        ].map((btn) => (
                            <button
                                key={btn.value}
                                onClick={() => handleSmartFilter(btn.value as any)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 border ${
                                    filterMode === btn.value
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                {btn.label}
                            </button>
                        ))}
                    </div>

                    {/* ส่วนเลือกวันที่และพนักงาน */}
                    <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                        {/* เลือกวันที่แบบกำหนดเอง */}
                        <div className="relative w-full sm:w-auto">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <CalendarIcon className="h-5 w-5 text-gray-400" />
                            </div>
                            <DatePicker
                                selectsRange={true}
                                startDate={startDate}
                                endDate={endDate}
                                onChange={handleDateChange}
                                dateFormat="dd/MM/yyyy"
                                locale={th}
                                className={`pl-10 w-full sm:w-64 p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none ${
                                    filterMode === 'custom' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300'
                                }`}
                                placeholderText="เลือกช่วงวันที่"
                            />
                        </div>

                        {/* Dropdown เลือกพนักงาน */}
                        <div className="relative w-full sm:w-auto">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <FunnelIcon className="h-5 w-5 text-gray-400" />
                            </div>
                            <select
                                value={selectedUserId}
                                onChange={(e) => setSelectedUserId(e.target.value)}
                                className="pl-10 w-full sm:w-48 p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                            >
                                <option value="">พนักงานทั้งหมด</option>
                                {staffList.map(staff => (
                                    <option key={staff.id} value={staff.id}>
                                        {staff.nickname || staff.username}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Content --- */}
            {loading ? (
                <div className="text-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-500">กำลังโหลดข้อมูล...</p>
                </div>
            ) : error ? (
                <div className="text-center py-20 text-red-500 bg-white rounded-lg shadow p-8">
                    <p className="text-lg font-semibold">⚠️ {error}</p>
                    <button onClick={fetchData} className="mt-4 px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200">ลองใหม่</button>
                </div>
            ) : attendanceData.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-lg shadow border border-gray-200">
                    <p className="text-gray-400 text-lg">ไม่พบข้อมูลการเข้างานในช่วงเวลานี้</p>
                </div>
            ) : (
                 <div className="space-y-6">
                     {groupedData.map(([date, records]) => (
                        <div key={date} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
                                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                                    📅 {format(parseISO(date), 'd MMMM yyyy', { locale: th })}
                                </h3>
                                <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                                    {records.length} รายการ
                                </span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">พนักงาน</th>
                                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">เวลาเข้า</th>
                                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">เวลาออก</th>
                                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">ระยะเวลา</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">หมายเหตุ</th>
                                            {/* Mobile View Header */}
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider md:hidden">รายละเอียด</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {records.map((record) => (
                                            <tr key={record.attendance_id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm mr-3">
                                                            {(record.nickname || record.username).charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-medium text-gray-900">
                                                                {record.first_name ? `${record.first_name} ${record.last_name || ''}` : record.username}
                                                            </div>
                                                            <div className="text-xs text-gray-500">
                                                                {record.nickname ? `(${record.nickname})` : ''}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                {/* Desktop View Columns */}
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-green-600 font-medium hidden md:table-cell">
                                                    {format(parseISO(record.clock_in_time), 'HH:mm')} น.
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-red-500 font-medium hidden md:table-cell">
                                                    {record.clock_out_time ? format(parseISO(record.clock_out_time), 'HH:mm') + ' น.' : '-'}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-800 font-medium hidden md:table-cell">
                                                    {calculateDuration(record.clock_in_time, record.clock_out_time)}
                                                </td>
                                                <td className="px-4 py-3 whitespace-normal text-sm text-gray-500 hidden md:table-cell max-w-xs">
                                                    {record.notes || '-'}
                                                </td>

                                                {/* Mobile View Column (Combine info) */}
                                                <td className="px-4 py-3 whitespace-nowrap text-right md:hidden">
                                                    <div className="text-sm text-gray-900">
                                                        <span className="text-green-600">{format(parseISO(record.clock_in_time), 'HH:mm')}</span> 
                                                        {' - '}
                                                        <span className="text-red-500">{record.clock_out_time ? format(parseISO(record.clock_out_time), 'HH:mm') : '...'}</span>
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        {calculateDuration(record.clock_in_time, record.clock_out_time)}
                                                    </div>
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
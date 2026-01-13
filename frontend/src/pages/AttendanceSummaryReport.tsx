import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { 
    format, startOfMonth, endOfMonth, startOfDay, endOfDay, subMonths, subDays 
} from 'date-fns';
import { th } from 'date-fns/locale'; 
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js'; 
import { Bar } from 'react-chartjs-2'; 
import { CalendarDaysIcon, ClockIcon } from '@heroicons/react/24/outline'; 

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface AttendanceSummary {
    user_id: number;
    username: string;
    first_name: string | null;
    last_name: string | null;
    nickname: string | null;
    days_worked: number;
    total_minutes_worked: number;
    total_time_worked_formatted: string;
}

const AttendanceSummaryReport = () => {
    // --- States ---
    const [startDate, setStartDate] = useState(startOfMonth(new Date()));
    const [endDate, setEndDate] = useState(endOfMonth(new Date()));
    const [filterMode, setFilterMode] = useState<'today' | 'yesterday' | 'thisMonth' | 'lastMonth' | 'custom'>('thisMonth');

    const [summaryData, setSummaryData] = useState<AttendanceSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
        setFilterMode('custom');
    };

    // --- Fetch Data ---
    const fetchSummary = async () => {
        setLoading(true);
        setError(null);
        try {
            const formattedStart = format(startDate, 'yyyy-MM-dd HH:mm:ss');
            const formattedEnd = format(endDate || startDate, 'yyyy-MM-dd HH:mm:ss');
            
            const response = await axios.get(`${apiUrl}/api/attendance/summary`, {
                params: { startDate: formattedStart, endDate: formattedEnd }
            });
            setSummaryData(response.data);
        } catch (err) {
            console.error("Error fetching summary:", err);
            setError("ไม่สามารถโหลดข้อมูลสรุปได้");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (startDate && endDate) {
            fetchSummary();
        }
    }, [startDate, endDate]);

    // --- Helper for Display Name ---
    const getDisplayName = (user: AttendanceSummary) => {
        if (user.nickname) return `${user.first_name || user.username} (${user.nickname})`;
        if (user.first_name) return `${user.first_name} ${user.last_name || ''}`;
        return user.username;
    };

    // --- Chart Data ---
    const chartData = useMemo(() => {
        return {
            labels: summaryData.map(item => item.nickname || item.username),
            datasets: [
                {
                    label: 'วันทำงาน (วัน)',
                    data: summaryData.map(item => item.days_worked),
                    backgroundColor: 'rgba(59, 130, 246, 0.6)', // Blue
                    borderColor: 'rgb(59, 130, 246)',
                    borderWidth: 1,
                    yAxisID: 'y',
                },
                {
                    label: 'ชั่วโมงทำงานรวม (ชม.)',
                    data: summaryData.map(item => Number((item.total_minutes_worked / 60).toFixed(1))),
                    backgroundColor: 'rgba(16, 185, 129, 0.6)', // Green
                    borderColor: 'rgb(16, 185, 129)',
                    borderWidth: 1,
                    yAxisID: 'y1',
                },
            ],
        };
    }, [summaryData]);

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top' as const },
            title: { display: false },
        },
        scales: {
            y: {
                type: 'linear' as const,
                display: true,
                position: 'left' as const,
                title: { display: true, text: 'วัน' },
                beginAtZero: true,
            },
            y1: {
                type: 'linear' as const,
                display: true,
                position: 'right' as const,
                title: { display: true, text: 'ชั่วโมง' },
                grid: { drawOnChartArea: false },
                beginAtZero: true,
            },
        },
    };

    return (
        <div className="p-4 sm:p-8 bg-gray-50 min-h-screen font-sans">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                📊 สรุปเวลาทำงานพนักงาน
            </h1>

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
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                {btn.label}
                            </button>
                        ))}
                    </div>

                    {/* เลือกวันที่แบบกำหนดเอง */}
                    <div className="relative w-full lg:w-auto">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <CalendarDaysIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <DatePicker
                            selectsRange={true}
                            startDate={startDate}
                            endDate={endDate}
                            onChange={handleDateChange}
                            dateFormat="dd/MM/yyyy"
                            locale={th}
                            className={`pl-10 w-full lg:w-64 p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none ${
                                filterMode === 'custom' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-300'
                            }`}
                            placeholderText="เลือกช่วงวันที่"
                        />
                    </div>
                </div>
            </div>

            {/* --- Content --- */}
            {loading ? (
                <div className="text-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                    <p className="text-gray-500">กำลังประมวลผลข้อมูล...</p>
                </div>
            ) : error ? (
                <div className="p-6 bg-red-50 text-red-600 rounded-lg text-center border border-red-200">
                    {error}
                </div>
            ) : (
                <div className="space-y-6 animate-fade-in-up">
                    
                    {/* กราฟ */}
                    <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
                        <h2 className="text-lg font-bold text-gray-700 mb-4">กราฟเปรียบเทียบการทำงาน</h2>
                        <div className="h-64 sm:h-80 w-full">
                            {summaryData.length > 0 ? (
                                <Bar data={chartData} options={chartOptions} />
                            ) : (
                                <div className="h-full flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 rounded-lg">
                                    ไม่มีข้อมูลแสดงกราฟ
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ตารางข้อมูล */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                            <h2 className="text-lg font-bold text-gray-800">รายละเอียดรายบุคคล</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">พนักงาน</th>
                                        <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                                            <div className="flex items-center justify-center gap-1"><CalendarDaysIcon className="w-4 h-4"/> วันทำงาน</div>
                                        </th>
                                        <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                                            <div className="flex items-center justify-center gap-1"><ClockIcon className="w-4 h-4"/> เวลารวม</div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {summaryData.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="px-6 py-10 text-center text-gray-400">
                                                ไม่พบข้อมูลในช่วงเวลานี้
                                            </td>
                                        </tr>
                                    ) : (
                                        summaryData.map((summary) => (
                                            <tr key={summary.user_id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                                                        {summary.username.charAt(0).toUpperCase()}
                                                    </div>
                                                    {getDisplayName(summary)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-700">
                                                    <span className="bg-blue-100 text-blue-800 py-1 px-3 rounded-full text-xs font-bold">
                                                        {summary.days_worked} วัน
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-800 font-semibold">
                                                    {summary.total_time_worked_formatted}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttendanceSummaryReport;
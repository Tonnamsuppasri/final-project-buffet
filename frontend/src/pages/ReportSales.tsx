import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, BarElement } from 'chart.js';
import { Line } from 'react-chartjs-2';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { registerLocale } from "react-datepicker";
import { th as thLocale } from 'date-fns/locale/th';
registerLocale('th', thLocale);

import {
    format, startOfMonth, endOfMonth, startOfYear, endOfYear,
    eachHourOfInterval, eachDayOfInterval, eachMonthOfInterval, eachYearOfInterval,
    startOfDay, endOfDay, subYears, isSameDay, isSameMonth, isSameYear, isSameHour
} from 'date-fns';
import { th } from 'date-fns/locale';
import { CalendarIcon, CurrencyDollarIcon, PresentationChartLineIcon, ReceiptPercentIcon, ArrowPathIcon, FunnelIcon, ArchiveBoxIcon } from '@heroicons/react/24/outline';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, BarElement);

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Interface
interface DailySale {
    date: string;
    total: number;
}

interface PaymentDetail {
    payment_id: number;
    order_id: number;
    payment_time: string; // "2026-01-11T15:20:00.000Z" (มีเวลามาด้วยแน่นอน)
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

type SmartMode = 'hour' | 'day' | 'month' | 'year' | null;

const ReportSales = () => {
    const [reportData, setReportData] = useState<SalesReportData | null>(null);
    const [loading, setLoading] = useState(false);
    
    // Date States
    const [startDate, setStartDate] = useState(startOfMonth(new Date()));
    const [endDate, setEndDate] = useState(endOfMonth(new Date()));

    // Smart Filter States
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

    // Sync Smart Filter
    useEffect(() => {
        if (!smartMode) return;
        let start, end;
        if (smartMode === 'hour') { start = startOfDay(smartDate); end = endOfDay(smartDate); }
        else if (smartMode === 'day') { start = startOfMonth(smartDate); end = endOfMonth(smartDate); }
        else if (smartMode === 'month') { start = startOfYear(smartDate); end = endOfYear(smartDate); }
        else { start = startOfYear(smartStartYear); end = endOfYear(smartEndYear); }
        setStartDate(start); setEndDate(end);
    }, [smartMode, smartDate, smartStartYear, smartEndYear]);

    // Manual Change
    const handleManualDateChange = (type: 'start' | 'end', date: Date | null) => {
        if (!date) return;
        setSmartMode(null);
        if (type === 'start') setStartDate(startOfDay(date));
        else setEndDate(endOfDay(date));
    };

    // Fetch Data
    const fetchData = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${apiUrl}/api/reports/sales`, {
                params: { 
                    startDate: format(startDate, 'yyyy-MM-dd'), 
                    endDate: format(endDate, 'yyyy-MM-dd')
                }
            });
            setReportData(response.data);
        } catch (err) {
            console.error("Error fetching sales:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [startDate, endDate]);

    // --- 🚨 จุดที่แก้ไข: เปลี่ยน Data Source จาก dailySales เป็น paymentDetails ---
    const chartData = useMemo(() => {
        // ถ้าไม่มีข้อมูล transaction เลย ก็ return ว่าง
        if (!reportData?.paymentDetails) return { labels: [], datasets: [] };

        let intervals: Date[] = [];
        let formatStr = 'dd MMM';
        let isSamePeriod = isSameDay; // Default Comparison

        try {
            let mode = smartMode;
            if (!mode) {
                const diff = (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24);
                if (diff <= 1) mode = 'hour'; else if (diff <= 31) mode = 'day'; else mode = 'month';
            }

            if (mode === 'hour') {
                intervals = eachHourOfInterval({ start: startDate, end: endDate });
                formatStr = 'HH:mm';
                isSamePeriod = isSameHour; // ✅ เทียบระดับชั่วโมง
            } else if (mode === 'day') {
                intervals = eachDayOfInterval({ start: startDate, end: endDate });
                formatStr = 'dd MMM';
                isSamePeriod = isSameDay;
            } else if (mode === 'month') {
                intervals = eachMonthOfInterval({ start: startDate, end: endDate });
                formatStr = 'MMM yy';
                isSamePeriod = isSameMonth;
            } else {
                intervals = eachYearOfInterval({ start: startDate, end: endDate });
                formatStr = 'yyyy';
                isSamePeriod = isSameYear;
            }
        } catch(e) { intervals = []; }

        const labels = intervals.map(d => format(d, formatStr, { locale: th }));
        
        const dataPoints = intervals.map(intervalDate => {
            // ✅ ใช้ paymentDetails (ที่มีเวลาละเอียด) แทน dailySales
            const salesInPeriod = reportData.paymentDetails.filter(d => {
                const recordDate = new Date(d.payment_time); // แปลง string เวลาเป็น Date Object
                return isSamePeriod(intervalDate, recordDate); // เทียบเวลา
            });

            // รวมยอดเงิน (total_price)
            const total = salesInPeriod.reduce((sum, record) => sum + Number(record.total_price), 0);
            return total;
        });

        return {
            labels,
            datasets: [{
                label: 'ยอดขาย (บาท)',
                data: dataPoints,
                borderColor: '#10B981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                pointBackgroundColor: '#fff',
                pointBorderColor: '#10B981',
                pointRadius: isMobile ? 3 : 4,
                borderWidth: 2.5,
                tension: 0, 
                fill: true,
            }],
        };
    }, [reportData, startDate, endDate, smartMode, isMobile]);

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                callbacks: {
                    label: (context: any) => `💰 ยอดขาย: ฿${Number(context.parsed.y).toLocaleString('th-TH', {minimumFractionDigits: 0})}`
                }
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { autoSkip: true, maxTicksLimit: isMobile ? 6 : 12, maxRotation: 0, font: { size: isMobile ? 10 : 12 } }
            },
            y: {
                beginAtZero: true,
                grid: { color: '#f3f4f6' },
                ticks: { font: { size: isMobile ? 10 : 12 } }
            }
        },
        interaction: { mode: 'nearest' as const, axis: 'x' as const, intersect: false }
    };

    return (
        <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 bg-gray-50 min-h-screen">
            <h1 className="text-xl sm:text-3xl font-bold text-gray-800">รายงานยอดขาย</h1>

            {/* Filter Card */}
            <div className="bg-white rounded-lg shadow-md border-l-4 border-green-500 overflow-hidden">
                <div className="p-3 sm:p-4 bg-gray-50 border-b border-gray-100 flex flex-col md:flex-row gap-3 items-start md:items-center">
                    <div className="w-full md:w-auto">
                        <label className="block text-xs text-gray-500 mb-1 font-bold flex items-center gap-1"><FunnelIcon className="w-3 h-3" /> มุมมองด่วน</label>
                        <div className="flex bg-white rounded-lg p-1 border border-gray-200 shadow-sm overflow-x-auto">
                            {[{ id: 'hour', label: 'รายวัน' }, { id: 'day', label: 'รายเดือน' }, { id: 'month', label: 'รายปี' }, { id: 'year', label: 'ช่วงปี' }].map((mode) => (
                                <button key={mode.id} onClick={() => setSmartMode(mode.id as SmartMode)} className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all whitespace-nowrap flex-1 ${smartMode === mode.id ? 'bg-green-50 text-green-600 border border-green-100 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>{mode.label}</button>
                            ))}
                        </div>
                    </div>
                    <div className="w-full md:w-auto flex-grow max-w-sm" style={{ opacity: smartMode ? 1 : 0.5 }}>
                        <label className="block text-xs text-gray-500 mb-1 font-bold">
                            {smartMode === 'hour' ? 'เลือกวันที่' : smartMode === 'day' ? 'เลือกเดือน' : smartMode === 'month' ? 'เลือกปี' : smartMode === 'year' ? 'เลือกช่วงปี' : 'กำหนดเอง'}
                        </label>
                        {smartMode === 'hour' && (<DatePicker selected={smartDate} onChange={(d: Date | null) => d && setSmartDate(d)} dateFormat="dd MMM yyyy" locale="th" className="input-field w-full p-2 border border-gray-300 rounded-md text-sm text-center focus:ring-green-500" withPortal={isMobile} />)}
                        {smartMode === 'day' && (<DatePicker selected={smartDate} onChange={(d: Date | null) => d && setSmartDate(d)} dateFormat="MMMM yyyy" showMonthYearPicker locale="th" className="input-field w-full p-2 border border-gray-300 rounded-md text-sm text-center focus:ring-green-500" withPortal={isMobile} />)}
                        {smartMode === 'month' && (<DatePicker selected={smartDate} onChange={(d: Date | null) => d && setSmartDate(d)} dateFormat="yyyy" showYearPicker locale="th" className="input-field w-full p-2 border border-gray-300 rounded-md text-sm text-center focus:ring-green-500" withPortal={isMobile} />)}
                        {smartMode === 'year' && (<div className="flex items-center gap-2"><DatePicker selected={smartStartYear} onChange={(d: Date | null) => d && setSmartStartYear(d)} dateFormat="yyyy" showYearPicker locale="th" className="input-field w-full p-2 border border-gray-300 rounded-md text-sm text-center w-24" /><span className="text-gray-400">-</span><DatePicker selected={smartEndYear} onChange={(d: Date | null) => d && setSmartEndYear(d)} dateFormat="yyyy" showYearPicker locale="th" className="input-field w-full p-2 border border-gray-300 rounded-md text-sm text-center w-24" /></div>)}
                        {!smartMode && (<div className="w-full p-2 border border-dashed border-gray-300 rounded-md text-sm text-gray-400 text-center bg-gray-50 cursor-not-allowed">(กำหนดเอง)</div>)}
                    </div>
                </div>

                <div className="p-3 sm:p-4 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <ArchiveBoxIcon className={`w-5 h-5 ${!smartMode ? 'text-green-600' : 'text-gray-400'}`} />
                        <span className={`text-xs sm:text-sm font-bold ${!smartMode ? 'text-gray-800' : 'text-gray-500'}`}>ช่วงเวลา:</span>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <DatePicker selected={startDate} onChange={(d) => handleManualDateChange('start', d)} dateFormat="dd/MM/yyyy" locale="th" className={`input-field w-full sm:w-28 p-2 border rounded-md text-sm text-center outline-none transition-all ${!smartMode ? 'border-green-500 ring-1 ring-green-500 shadow-sm' : 'border-gray-300 text-gray-600'}`} withPortal={isMobile} />
                        <span className="text-gray-400">-</span>
                        <DatePicker selected={endDate} onChange={(d) => handleManualDateChange('end', d)} dateFormat="dd/MM/yyyy" locale="th" className={`input-field w-full sm:w-28 p-2 border rounded-md text-sm text-center outline-none transition-all ${!smartMode ? 'border-green-500 ring-1 ring-green-500 shadow-sm' : 'border-gray-300 text-gray-600'}`} withPortal={isMobile} />
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                        <button onClick={fetchData} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow-sm flex items-center gap-1 text-sm"><ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin': ''}`} /> อัปเดต</button>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                <div className="p-4 bg-white rounded-lg shadow-md border-l-4 border-green-500 flex items-center justify-between">
                    <div><p className="text-xs text-gray-500 uppercase font-bold">ยอดขายรวม</p><p className="text-xl sm:text-2xl font-bold text-gray-800 mt-1">฿{reportData?.summary.totalSales.toLocaleString('th-TH', { minimumFractionDigits: 0 }) || '0'}</p></div>
                    <CurrencyDollarIcon className="w-8 h-8 text-green-100 bg-green-500 rounded-full p-2" />
                </div>
                <div className="p-4 bg-white rounded-lg shadow-md border-l-4 border-blue-500 flex items-center justify-between">
                    <div><p className="text-xs text-gray-500 uppercase font-bold">จำนวนบิล</p><p className="text-xl sm:text-2xl font-bold text-gray-800 mt-1">{reportData?.summary.totalOrders.toLocaleString() || '0'}</p></div>
                    <ReceiptPercentIcon className="w-8 h-8 text-blue-100 bg-blue-500 rounded-full p-2" />
                </div>
                <div className="p-4 bg-white rounded-lg shadow-md border-l-4 border-purple-500 flex items-center justify-between">
                    <div><p className="text-xs text-gray-500 uppercase font-bold">เฉลี่ยต่อบิล</p><p className="text-xl sm:text-2xl font-bold text-gray-800 mt-1">฿{reportData?.summary.avgOrderValue.toLocaleString('th-TH', { minimumFractionDigits: 0 }) || '0'}</p></div>
                    <PresentationChartLineIcon className="w-8 h-8 text-purple-100 bg-purple-500 rounded-full p-2" />
                </div>
            </div>

            {/* Sales Chart */}
            <div className="p-3 sm:p-4 bg-white rounded-lg shadow-md w-full overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-base sm:text-lg font-bold text-gray-700 flex items-center gap-2"><PresentationChartLineIcon className="w-5 h-5 text-green-600" /> แนวโน้มยอดขาย</h2>
                </div>
                <div className="w-full h-[250px] sm:h-[400px]">
                    {loading ? <div className="flex h-full items-center justify-center text-gray-400">กำลังโหลด...</div> : <Line data={chartData} options={chartOptions} />}
                </div>
            </div>

            {/* Table */}
            <div className="p-3 sm:p-4 bg-white rounded-lg shadow-md overflow-hidden">
                <h2 className="text-base sm:text-lg font-bold text-gray-700 mb-4">รายการล่าสุด</h2>
                <div className="overflow-x-auto w-full">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-green-50">
                            <tr>
                                <th className="px-3 py-2 text-left text-xs font-bold text-green-700 uppercase whitespace-nowrap">Order ID</th>
                                <th className="px-3 py-2 text-left text-xs font-bold text-green-700 uppercase whitespace-nowrap">เวลา</th>
                                <th className="px-3 py-2 text-left text-xs font-bold text-green-700 uppercase whitespace-nowrap">โต๊ะ</th>
                                <th className="px-3 py-2 text-right text-xs font-bold text-green-700 uppercase whitespace-nowrap">ยอดรวม (฿)</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200 text-sm">
                            {reportData?.paymentDetails.map((payment) => (
                                <tr key={payment.payment_id} className="hover:bg-green-50 transition">
                                    <td className="px-3 py-2 font-medium text-blue-600 whitespace-nowrap">#{payment.order_id}</td>
                                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{format(new Date(payment.payment_time), 'dd/MM HH:mm')}</td>
                                    <td className="px-3 py-2 text-gray-800 whitespace-nowrap">{payment.table_number}</td>
                                    <td className="px-3 py-2 text-right font-bold text-gray-800 whitespace-nowrap">{payment.total_price.toLocaleString()}</td>
                                </tr>
                            ))}
                            {(!reportData?.paymentDetails || reportData.paymentDetails.length === 0) && <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">ไม่มีข้อมูล</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ReportSales;
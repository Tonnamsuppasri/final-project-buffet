import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { registerLocale } from "react-datepicker";
import { th as thLocale } from 'date-fns/locale/th';
registerLocale('th', thLocale);

import { 
    format, startOfMonth, endOfMonth, startOfYear, endOfYear, 
    eachHourOfInterval, eachDayOfInterval, eachMonthOfInterval, eachYearOfInterval,
    startOfDay, endOfDay, subYears, isSameDay, isSameMonth, isSameYear, isSameHour, parseISO
} from 'date-fns';
import { th } from 'date-fns/locale'; 
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { ArrowPathIcon, FunnelIcon, ChartBarIcon, PresentationChartLineIcon, ArchiveBoxIcon } from '@heroicons/react/24/outline';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend);

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface MenuItem {
    menu_id: number;
    menu_name: string;
    menu_quantity?: number | null;
}

interface StockSummaryData {
    period_start: string; 
    period_label: string; 
    menu_id: number;
    menu_name: string;
    total_in: number;
    total_out: number;
    ending_balance: number | null; 
}

type GroupByType = 'hour' | 'day' | 'month' | 'year';
type SmartMode = GroupByType | null;
type CompareDataType = 'out' | 'in' | 'net';

const getDynamicColor = (index: number) => {
    const hue = (index * 137.508) % 360; 
    return `hsl(${hue}, 65%, 55%)`;
};

const ReportStock = () => {
    // Data States
    const [menuList, setMenuList] = useState<MenuItem[]>([]); 
    const [overviewData, setOverviewData] = useState<StockSummaryData[]>([]);
    const [compareData, setCompareData] = useState<StockSummaryData[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingCompare, setLoadingCompare] = useState(false);

    // --- Date States ---
    const [startDate, setStartDate] = useState(startOfMonth(new Date()));
    const [endDate, setEndDate] = useState(endOfMonth(new Date()));

    // --- Smart Filter UI States ---
    const [smartMode, setSmartMode] = useState<SmartMode>('day');
    const [smartDate, setSmartDate] = useState<Date>(new Date());
    const [smartStartYear, setSmartStartYear] = useState<Date>(subYears(new Date(), 4));
    const [smartEndYear, setSmartEndYear] = useState<Date>(new Date());

    // Filters
    const [selectedMenuId, setSelectedMenuId] = useState<string>(''); 
    const [compareMenuIds, setCompareMenuIds] = useState<number[]>([]);
    const [isCompareDropdownOpen, setIsCompareDropdownOpen] = useState(false);
    const [compareType, setCompareType] = useState<CompareDataType>('out');

    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // --- Logic 1: Smart Filter Sync ---
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

    // --- Fetch Data ---
    const { apiStartDate, apiEndDate } = useMemo(() => ({
        apiStartDate: format(startDate, 'yyyy-MM-dd'),
        apiEndDate: format(endDate, 'yyyy-MM-dd')
    }), [startDate, endDate]);

    useEffect(() => {
        const fetchMenus = async () => {
            try {
                const response = await axios.get<MenuItem[]>(`${apiUrl}/api/menu`);
                setMenuList(response.data);
                const validMenus = response.data.filter(m => m.menu_quantity !== null);
                if (validMenus.length > 0) setCompareMenuIds(validMenus.slice(0, 5).map(m => m.menu_id));
            } catch (err) { console.error("Error menu:", err); }
        };
        fetchMenus();
    }, []);

    const fetchOverview = useCallback(async () => {
        setLoading(true);
        try {
            const params: any = { startDate: apiStartDate, endDate: apiEndDate, groupBy: smartMode || 'day' };
            if (selectedMenuId) params.menuId = selectedMenuId;
            const response = await axios.get(`${apiUrl}/api/stock/summary`, { params });
            setOverviewData(response.data);
        } catch (err) { console.error("Error overview:", err); } finally { setLoading(false); }
    }, [apiStartDate, apiEndDate, smartMode, selectedMenuId]);

    const fetchComparison = useCallback(async () => {
        if (compareMenuIds.length === 0) { setCompareData([]); return; }
        setLoadingCompare(true);
        try {
            const params: any = { startDate: apiStartDate, endDate: apiEndDate, groupBy: smartMode || 'day' };
            const response = await axios.get(`${apiUrl}/api/stock/summary`, { params });
            setCompareData(response.data);
        } catch (err) { console.error("Error comparison:", err); } finally { setLoadingCompare(false); }
    }, [apiStartDate, apiEndDate, smartMode]); 

    useEffect(() => { fetchOverview(); }, [fetchOverview]);
    useEffect(() => { fetchComparison(); }, [fetchComparison]);

    // --- ✅ Logic ใหม่: สร้างช่วงเวลาและกำหนดตัวเปรียบเทียบ ---
    const timeline = useMemo(() => {
        let intervals: Date[];
        let formatStr: string;
        let isSamePeriod: (d1: Date, d2: Date) => boolean;

        const diffDays = (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24);
        let mode = smartMode;
        if (!mode) {
            if (diffDays <= 1) mode = 'hour';
            else if (diffDays <= 31) mode = 'day';
            else if (diffDays <= 365) mode = 'month';
            else mode = 'year';
        }

        if (mode === 'hour') { intervals = eachHourOfInterval({ start: startDate, end: endDate }); formatStr = 'HH:mm'; isSamePeriod = isSameHour; }
        else if (mode === 'day') { intervals = eachDayOfInterval({ start: startDate, end: endDate }); formatStr = 'dd MMM'; isSamePeriod = isSameDay; }
        else if (mode === 'month') { intervals = eachMonthOfInterval({ start: startDate, end: endDate }); formatStr = 'MMM yy'; isSamePeriod = isSameMonth; }
        else { intervals = eachYearOfInterval({ start: startDate, end: endDate }); formatStr = 'yyyy'; isSamePeriod = isSameYear; }

        return { intervals, formatStr, isSamePeriod };
    }, [smartMode, startDate, endDate]);

    // 1. Overview Chart
    const barChartData = useMemo(() => {
        const labels = timeline.intervals.map(d => format(d, timeline.formatStr, { locale: th }));
        
        const dataIn = timeline.intervals.map(intervalDate => {
            return overviewData
                .filter(d => timeline.isSamePeriod(intervalDate, new Date(d.period_start)))
                .reduce((sum, i) => sum + Number(i.total_in), 0);
        });

        const dataOut = timeline.intervals.map(intervalDate => {
            return overviewData
                .filter(d => timeline.isSamePeriod(intervalDate, new Date(d.period_start)))
                .reduce((sum, i) => sum + Number(i.total_out), 0);
        });

        return {
            labels,
            datasets: [
                { label: 'รับเข้า (+)', data: dataIn, backgroundColor: 'rgba(34, 197, 94, 0.7)', borderRadius: 4 },
                { label: 'จ่ายออก (-)', data: dataOut, backgroundColor: 'rgba(239, 68, 68, 0.7)', borderRadius: 4 },
            ],
        };
    }, [overviewData, timeline]);

    // 2. Comparison Chart
    const comparisonChartData = useMemo(() => {
        const labels = timeline.intervals.map(d => format(d, timeline.formatStr, { locale: th }));
        
        const datasets = compareMenuIds.map((menuId, index) => {
            const menu = menuList.find(m => m.menu_id === menuId);
            const color = getDynamicColor(index);
            
            const dataPoints = timeline.intervals.map(intervalDate => {
                // ค้นหาข้อมูลที่ตรงกับเมนู และ ตรงกับช่วงเวลา
                const recordsInPeriod = compareData.filter(d => 
                    d.menu_id === menuId && 
                    timeline.isSamePeriod(intervalDate, new Date(d.period_start))
                );

                if (recordsInPeriod.length === 0) return 0;
                
                // รวมยอด (กรณีมีหลาย record ในช่วงเวลาเดียวกัน)
                const totalIn = recordsInPeriod.reduce((sum, r) => sum + Number(r.total_in), 0);
                const totalOut = recordsInPeriod.reduce((sum, r) => sum + Number(r.total_out), 0);

                if (compareType === 'out') return totalOut;
                if (compareType === 'in') return totalIn;
                return totalIn - totalOut;
            });

            return {
                label: menu ? menu.menu_name : `ID: ${menuId}`,
                data: dataPoints,
                borderColor: color, backgroundColor: color, pointBackgroundColor: '#fff', pointBorderColor: color,
                tension: 0, pointRadius: isMobile ? 3 : 4, borderWidth: 2.5, fill: false,
            };
        });
        return { labels, datasets };
    }, [compareData, compareMenuIds, menuList, timeline, isMobile, compareType]);

    const overviewOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top' as const },
            tooltip: {
                callbacks: {
                    label: () => '',
                    footer: (items: any) => {
                        const index = items[0].dataIndex;
                        const intervalDate = timeline.intervals[index];
                        const active = overviewData
                            .filter(d => timeline.isSamePeriod(intervalDate, new Date(d.period_start)))
                            .filter(i => Number(i.total_in) > 0 || Number(i.total_out) > 0)
                            .sort((a,b) => (Number(b.total_in) + Number(b.total_out)) - (Number(a.total_in) + Number(a.total_out)))
                            .slice(0, 8);
                        return active.length ? active.map(i => `• ${i.menu_name}: ${Number(i.total_in) > 0 ? `🟢+${i.total_in} ` : ''}${Number(i.total_out) > 0 ? `🔴-${i.total_out}` : ''}`).join('\n') : 'ไม่มีความเคลื่อนไหว';
                    }
                }
            }
        },
        scales: {
            x: { grid: { display: false }, ticks: { autoSkip: true, maxTicksLimit: isMobile ? 6 : 12, font: { size: isMobile ? 10 : 12 } } },
            y: { beginAtZero: true, grid: { color: '#f3f4f6' }, ticks: { font: { size: isMobile ? 10 : 12 } } }
        }
    };

    const comparisonOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { 
                position: 'bottom' as const,
                labels: {
                    usePointStyle: true,
                    boxWidth: 8,
                    padding: 15,
                    font: { size: isMobile ? 11 : 12 }
                }
            },
            tooltip: {
                mode: 'index' as const, intersect: false,
                callbacks: {
                    label: (ctx: any) => {
                        const val = Number(ctx.parsed.y ?? 0);
                        const prefix = compareType === 'out' ? '🔴 -' : compareType === 'in' ? '🟢 +' : val > 0 ? '🟢 +' : '🔴 ';
                        return `${ctx.dataset.label}: ${prefix}${Math.abs(val)}`;
                    }
                }
            }
        },
        scales: {
            x: { grid: { display: false }, ticks: { autoSkip: true, maxTicksLimit: isMobile ? 6 : 12, font: { size: isMobile ? 10 : 12 } } },
            y: { beginAtZero: true, grid: { color: '#f3f4f6' }, ticks: { font: { size: isMobile ? 10 : 12 } } }
        }
    };

    return (
        <div className="p-4 sm:p-6 space-y-6 bg-gray-50 min-h-screen">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">รายงานสต็อก</h1>

            {/* Hybrid Filter */}
            <div className="bg-white rounded-lg shadow-md border-l-4 border-indigo-500 overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-end md:items-center">
                    <div className="w-full md:w-auto">
                        <label className="block text-xs text-gray-500 mb-1 font-bold flex items-center gap-1"><FunnelIcon className="w-3 h-3" /> มุมมองด่วน</label>
                        <div className="flex bg-white rounded-lg p-1 border border-gray-200 shadow-sm overflow-x-auto">
                            {[{ id: 'hour', label: 'รายวัน' }, { id: 'day', label: 'รายเดือน' }, { id: 'month', label: 'รายปี' }, { id: 'year', label: 'ช่วงปี' }].map((mode) => (
                                <button key={mode.id} onClick={() => setSmartMode(mode.id as SmartMode)} className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all whitespace-nowrap flex-1 ${smartMode === mode.id ? 'bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>{mode.label}</button>
                            ))}
                        </div>
                    </div>
                    <div className="w-full md:w-auto flex-grow max-w-sm transition-opacity duration-300" style={{ opacity: smartMode ? 1 : 0.5 }}>
                        <label className="block text-xs text-gray-500 mb-1 font-bold">
                            {smartMode === 'hour' ? 'เลือกวันที่' : smartMode === 'day' ? 'เลือกเดือน' : smartMode === 'month' ? 'เลือกปี' : smartMode === 'year' ? 'เลือกช่วงปี' : 'กำหนดเอง'}
                        </label>
                        {smartMode === 'hour' && (<DatePicker selected={smartDate} onChange={(d: Date | null) => d && setSmartDate(d)} dateFormat="dd MMMM yyyy" locale="th" className="input-field w-full p-2 border border-gray-300 rounded-md text-sm font-medium text-center focus:ring-indigo-500" withPortal={isMobile} />)}
                        {smartMode === 'day' && (<DatePicker selected={smartDate} onChange={(d: Date | null) => d && setSmartDate(d)} dateFormat="MMMM yyyy" showMonthYearPicker locale="th" className="input-field w-full p-2 border border-gray-300 rounded-md text-sm font-medium text-center focus:ring-indigo-500" withPortal={isMobile} />)}
                        {smartMode === 'month' && (<DatePicker selected={smartDate} onChange={(d: Date | null) => d && setSmartDate(d)} dateFormat="yyyy" showYearPicker locale="th" className="input-field w-full p-2 border border-gray-300 rounded-md text-sm font-medium text-center focus:ring-indigo-500" withPortal={isMobile} />)}
                        {smartMode === 'year' && (<div className="flex items-center gap-2"><DatePicker selected={smartStartYear} onChange={(d: Date | null) => d && setSmartStartYear(d)} dateFormat="yyyy" showYearPicker locale="th" className="input-field w-full p-2 border border-gray-300 rounded-md text-sm text-center w-24" /><span className="text-gray-400">-</span><DatePicker selected={smartEndYear} onChange={(d: Date | null) => d && setSmartEndYear(d)} dateFormat="yyyy" showYearPicker locale="th" className="input-field w-full p-2 border border-gray-300 rounded-md text-sm text-center w-24" /></div>)}
                        {!smartMode && (<div className="w-full p-2 border border-dashed border-gray-300 rounded-md text-sm text-gray-400 text-center bg-gray-50 cursor-not-allowed">(ใช้งานโหมดกำหนดเอง)</div>)}
                    </div>
                </div>
                <div className="p-4 flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <ArchiveBoxIcon className={`w-5 h-5 ${!smartMode ? 'text-indigo-600' : 'text-gray-400'}`} />
                        <span className={`text-sm font-bold ${!smartMode ? 'text-gray-800' : 'text-gray-500'}`}>ช่วงเวลา:</span>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <DatePicker selected={startDate} onChange={(d) => handleManualDateChange('start', d)} dateFormat="dd/MM/yyyy" locale="th" className={`input-field w-full sm:w-32 p-2 border rounded-md text-sm text-center outline-none transition-all ${!smartMode ? 'border-indigo-500 ring-1 ring-indigo-500 shadow-sm' : 'border-gray-300 text-gray-600'}`} withPortal={isMobile} />
                        <span className="text-gray-400">-</span>
                        <DatePicker selected={endDate} onChange={(d) => handleManualDateChange('end', d)} dateFormat="dd/MM/yyyy" locale="th" className={`input-field w-full sm:w-32 p-2 border rounded-md text-sm text-center outline-none transition-all ${!smartMode ? 'border-indigo-500 ring-1 ring-indigo-500 shadow-sm' : 'border-gray-300 text-gray-600'}`} withPortal={isMobile} />
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                        <button onClick={() => { fetchOverview(); fetchComparison(); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-sm flex items-center gap-1 text-sm"><ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin': ''}`} /> อัปเดต</button>
                    </div>
                </div>
            </div>

            {/* Chart 1: Overview */}
            <div className="bg-white rounded-lg shadow-md p-3 sm:p-6 relative w-full overflow-hidden">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-gray-700 flex items-center gap-2"><ChartBarIcon className="w-5 h-5 text-green-500" /> ภาพรวม รับเข้า/จ่ายออก</h2>
                    <select value={selectedMenuId} onChange={(e) => setSelectedMenuId(e.target.value)} className="text-xs sm:text-sm p-1.5 border border-gray-300 rounded-md focus:ring-indigo-500 flex-grow sm:w-56"><option value="">-- รวมทุกเมนู --</option>{menuList.filter(m => m.menu_quantity !== null).map(menu => (<option key={menu.menu_id} value={menu.menu_id}>{menu.menu_name}</option>))}</select>
                </div>
                <div className="w-full h-[300px] sm:h-[400px]">
                    {loading ? <div className="flex h-full items-center justify-center text-gray-400">กำลังโหลด...</div> : <Bar data={barChartData} options={overviewOptions} />}
                </div>
            </div>

            {/* Chart 2: Comparison */}
            <div className="bg-white rounded-lg shadow-md p-3 sm:p-6 relative w-full overflow-hidden">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-gray-700 flex items-center gap-2"><PresentationChartLineIcon className="w-5 h-5 text-indigo-500" /> เปรียบเทียบ</h2>
                    <div className="flex gap-2 items-center w-full sm:w-auto flex-wrap justify-end">
                        <div className="flex bg-gray-100 rounded-md p-1">
                            <button onClick={() => setCompareType('out')} className={`px-2 py-1 text-xs rounded ${compareType === 'out' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>ยอดใช้</button>
                            <button onClick={() => setCompareType('in')} className={`px-2 py-1 text-xs rounded ${compareType === 'in' ? 'bg-white shadow text-green-600' : 'text-gray-500'}`}>ยอดเติม</button>
                            <button onClick={() => setCompareType('net')} className={`px-2 py-1 text-xs rounded ${compareType === 'net' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>สุทธิ</button>
                        </div>
                        <div className="relative flex-grow sm:flex-grow-0 sm:w-48 z-10">
                            <button onClick={() => setIsCompareDropdownOpen(!isCompareDropdownOpen)} className="w-full bg-white border border-gray-300 text-gray-700 py-1.5 px-3 rounded-md text-xs sm:text-sm text-left flex justify-between items-center shadow-sm"><span className="truncate">{compareMenuIds.length > 0 ? `เลือก ${compareMenuIds.length} รายการ` : 'เลือกเมนูเทียบ'}</span><FunnelIcon className="w-4 h-4 text-gray-400" /></button>
                            {isCompareDropdownOpen && (<div className="absolute mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-xl max-h-60 overflow-y-auto p-2 right-0 sm:left-auto left-0 z-20"><div className="flex gap-2 mb-2 pb-2 border-b sticky top-0 bg-white"><button onClick={() => setCompareMenuIds(menuList.filter(m => m.menu_quantity !== null).map(m => m.menu_id))} className="text-xs text-indigo-600 font-medium px-2 py-1 hover:bg-indigo-50 rounded">เลือกหมด</button><button onClick={() => setCompareMenuIds([])} className="text-xs text-red-600 font-medium px-2 py-1 hover:bg-red-50 rounded">ล้าง</button></div>{menuList.filter(m => m.menu_quantity !== null).map(menu => (<div key={menu.menu_id} className="flex items-center mb-1 p-1.5 hover:bg-gray-100 rounded cursor-pointer" onClick={() => { setCompareMenuIds(prev => prev.includes(menu.menu_id) ? prev.filter(id => id !== menu.menu_id) : [...prev, menu.menu_id]); }}><input type="checkbox" checked={compareMenuIds.includes(menu.menu_id)} readOnly className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" /><label className="ml-2 text-xs sm:text-sm text-gray-700 cursor-pointer truncate flex-1">{menu.menu_name}</label></div>))}</div>)}
                        </div>
                    </div>
                </div>
                <div className="w-full h-[300px] sm:h-[400px]">
                    {loadingCompare ? <div className="flex h-full items-center justify-center text-gray-400">กำลังโหลด...</div> : 
                    compareMenuIds.length > 0 ? <Line data={comparisonChartData} options={comparisonOptions} /> : 
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50"><PresentationChartLineIcon className="w-10 h-10 mb-2 text-gray-300" /><p className="text-sm">กรุณาเลือกเมนูเพื่อเปรียบเทียบ</p></div>}
                </div>
            </div>
        </div>
    );
};

export default ReportStock;
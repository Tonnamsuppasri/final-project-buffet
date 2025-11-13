import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { format, startOfMonth } from 'date-fns';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend);

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Interface for menu items (for the dropdown)
interface MenuItem {
    menu_id: number;
    menu_name: string;
    menu_quantity?: number | null;
}

// Interface for the data from the NEW /api/stock/summary endpoint
interface StockSummaryData {
    period_start: string; 
    period_label: string; 
    menu_id: number;
    menu_name: string;
    total_in: number;
    total_out: number;
    ending_balance: number | null; 
}

// Group By options
type GroupByType = 'day' | 'month' | 'year';

const ReportStock = () => {
    // States
    const [menuList, setMenuList] = useState<MenuItem[]>([]); 
    const [summaryData, setSummaryData] = useState<StockSummaryData[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [selectedMenuId, setSelectedMenuId] = useState<string>(''); 
    const [groupBy, setGroupBy] = useState<GroupByType>('day'); 
    const [startDate, setStartDate] = useState(() => startOfMonth(new Date()));
    const [endDate, setEndDate] = useState(() => new Date());

    // --- 1. Fetch Menu List for Dropdown (Unchanged) ---
    useEffect(() => {
        const fetchMenus = async () => {
            try {
                const adminUserId = localStorage.getItem('userId');
                 if (!adminUserId) return; 
                const response = await axios.get<MenuItem[]>(`${apiUrl}/api/menu`, {
                     headers: { 'x-user-id': adminUserId } 
                });
                setMenuList(response.data);
            } catch (err) {
                console.error("Error fetching menu list for stock report:", err);
            }
        };
        fetchMenus();
    }, []);

    // --- 2. Fetch Summary Data based on Filters (Unchanged) ---
    const fetchSummary = useCallback(async () => {
        if (!startDate || !endDate) return; 
        setLoading(true);
        setError(null);
        try {
            const params: { [key: string]: string } = {
                startDate: format(startDate, 'yyyy-MM-dd'),
                endDate: format(endDate, 'yyyy-MM-dd'),
                groupBy: groupBy,
            };
            if (selectedMenuId) params.menuId = selectedMenuId;
            const adminUserId = localStorage.getItem('userId');
            if (!adminUserId) {
                setError("ไม่พบ Admin User ID"); setLoading(false); return;
            }
            const response = await axios.get<StockSummaryData[]>(`${apiUrl}/api/stock/summary`, {
                params,
                headers: { 'x-user-id': adminUserId } 
            });
            setSummaryData(response.data);
        } catch (err: any) {
            console.error("Error fetching stock summary:", err);
            setError(err.response?.data?.error || "ไม่สามารถดึงข้อมูลสรุปสต็อกได้");
            setSummaryData([]); 
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, groupBy, selectedMenuId]); 

    useEffect(() => {
        fetchSummary();
    }, [fetchSummary]); 


    // --- 3. Prepare Chart Data (Unchanged - using combined labels) ---
    
    const selectedMenuName = useMemo(() => {
        if (!selectedMenuId) return 'ทุกเมนู';
        const menu = menuList.find(m => m.menu_id === parseInt(selectedMenuId));
        return menu ? menu.menu_name : 'เมนูที่เลือก'; 
    }, [selectedMenuId, menuList]);

    const chartLabels = useMemo(() => {
        if (selectedMenuId) {
            return summaryData.map(d => d.period_label);
        } 
        // Combine period and menu name for all menus view
        return summaryData.map(d => `${d.period_label} (${d.menu_name})`);
    }, [summaryData, selectedMenuId]);

    const barChartData = useMemo(() => ({
        labels: chartLabels,
        datasets: [
            { label: 'รับเข้า (+)', data: summaryData.map(d => d.total_in), backgroundColor: 'rgba(75, 192, 192, 0.6)', borderColor: 'rgba(75, 192, 192, 1)', borderWidth: 1, },
            { label: 'จ่ายออก (-)', data: summaryData.map(d => d.total_out), backgroundColor: 'rgba(255, 99, 132, 0.6)', borderColor: 'rgba(255, 99, 132, 1)', borderWidth: 1, },
        ],
    }), [chartLabels, summaryData]);

    const lineChartData = useMemo(() => ({
        labels: chartLabels,
        datasets: [
            { label: 'ยอดคงเหลือ ณ สิ้นช่วง', data: summaryData.map(d => d.ending_balance), borderColor: 'rgb(54, 162, 235)', backgroundColor: 'rgba(54, 162, 235, 0.5)', tension: 0.1, fill: false, spanGaps: true, },
        ],
    }), [chartLabels, summaryData]);


    // --- 4. Chart Options (UPDATED for large data) ---
    const commonChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top' as const },
            tooltip: { mode: 'index' as const, intersect: false }, 
        },
        scales: {
            x: { 
                title: { display: true, text: 'ช่วงเวลา / เมนู' }, 
                // *** การปรับปรุงเพื่อจัดการ Label ที่เยอะ ***
                ticks: {
                    maxRotation: 45, // กำหนดการหมุน Label เป็น 45 องศา
                    minRotation: 45,
                    autoSkip: true, // อนุญาตให้ Chart.js ข้าม Label ที่ซ้อนทับกัน
                    // autoSkipPadding: 10, // สามารถเพิ่มระยะห่างได้
                },
            },
            y: { beginAtZero: true, title: { display: true, text: 'จำนวน' } },
        },
    };

    const barChartOptions = { 
        ...commonChartOptions, 
        plugins: { 
            ...commonChartOptions.plugins, 
            title: { display: true, text: `สรุปยอดรับเข้า/จ่ายออก (${selectedMenuName})` } 
        } 
    };

    const lineChartOptions = { 
        ...commonChartOptions, 
        plugins: { 
            ...commonChartOptions.plugins, 
            title: { display: true, text: `ยอดคงเหลือ ณ สิ้นช่วง (${selectedMenuName})` } 
        } 
    };

    // --- 5. Render Component (Unchanged) ---
    return (
        <div className="p-4 sm:p-6 space-y-6 bg-gray-100 min-h-screen">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">รายงานสต็อก (ประวัติ)</h1>

            {/* Filters */}
            <div className="p-4 bg-white rounded-lg shadow-md flex flex-col sm:flex-row flex-wrap items-end gap-4">
                 {/* Menu Filter */}
                <div className="w-full sm:w-auto flex-grow">
                    <label htmlFor="menuFilter" className="block text-sm font-medium text-gray-700 mb-1">เมนู</label>
                    <select 
                        id="menuFilter" 
                        value={selectedMenuId} 
                        onChange={(e) => setSelectedMenuId(e.target.value)} 
                        className="input-field w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" 
                    >
                        <option value="">-- ทุกเมนูที่นับสต็อก --</option>
                        {menuList.filter(m => m.menu_quantity !== null).map(menu => ( 
                            <option key={menu.menu_id} value={menu.menu_id}>{menu.menu_name}</option>
                        ))}
                    </select>
                </div>
                 {/* Group By Filter */}
                 <div className="w-full sm:w-auto">
                    <label htmlFor="groupByFilter" className="block text-sm font-medium text-gray-700 mb-1">สรุปตาม</label>
                    <select 
                        id="groupByFilter" 
                        value={groupBy} 
                        onChange={(e) => setGroupBy(e.target.value as GroupByType)} 
                        className="input-field w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" 
                    >
                        <option value="day">รายวัน</option>
                        <option value="month">รายเดือน</option>
                        <option value="year">รายปี</option>
                    </select>
                </div>
                 {/* Date Filters */}
                <div className="w-full sm:w-auto">
                    <label className="block text-sm font-medium text-gray-700 mb-1">ตั้งแต่</label>
                    <DatePicker 
                        selected={startDate} 
                        onChange={(date: Date | null) => setStartDate(date || new Date())} 
                        selectsStart 
                        startDate={startDate} 
                        endDate={endDate} 
                        dateFormat="dd/MM/yyyy" 
                        className="input-field w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" 
                        required
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
                        className="input-field w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" 
                        required
                    />
                </div>
                 {/* Refresh Button */}
                 <button 
                    onClick={fetchSummary} 
                    disabled={loading} 
                    className={`btn-secondary mt-auto px-4 py-2 rounded-md transition duration-150 ease-in-out flex items-center justify-center ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600 text-white'}`} 
                    title="รีเฟรชข้อมูล"
                 >
                     <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin': ''} mr-1`} />
                    {loading ? 'กำลังโหลด' : 'รีเฟรช'}
                 </button>
            </div>

            {/* Loading / Error */}
            {loading && <div className="text-center p-6 text-blue-600"><div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mr-2"></div> กำลังโหลดข้อมูล...</div>}
            {error && <div className="text-center p-6 text-red-600 bg-red-100 border border-red-400 rounded shadow">{error}</div>}

            {/* Charts */}
            {!loading && !error && summaryData.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                     {/* Bar Chart (In/Out) */}
                    <div className="bg-white rounded-lg shadow-md p-4 h-[400px]">
                        <Bar options={barChartOptions} data={barChartData} />
                    </div>
                     {/* Line Chart (Ending Balance) */}
                     <div className="bg-white rounded-lg shadow-md p-4 h-[400px]">
                        {summaryData.some(d => d.ending_balance !== null) ? ( 
                            <Line options={lineChartOptions} data={lineChartData} />
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-500">
                                ไม่สามารถคำนวณยอดคงเหลือได้ (อาจไม่มีข้อมูลเริ่มต้น)
                            </div>
                        )}
                     </div>
                 </div>
            )}
             {!loading && !error && summaryData.length === 0 && (
                 <p className="text-center text-gray-500 py-6 bg-white rounded-md shadow-sm">ไม่พบข้อมูลสต็อกในช่วงวันที่และเงื่อนไขที่เลือก</p>
             )}

        </div>
    );
};

export default ReportStock;
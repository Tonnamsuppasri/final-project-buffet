import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import {
    MagnifyingGlassIcon, ArrowPathIcon, PencilSquareIcon, CheckIcon, XMarkIcon, PlusIcon, MinusIcon
} from '@heroicons/react/24/outline'; 
import Swal from 'sweetalert2';

// Backend API URL
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
// Socket connection
export const socket = io(apiUrl, { autoConnect: false });

// Interface for Menu Item
interface StockMenuItem {
    menu_id: number;
    menu_name: string;
    menu_category: string | null; 
    price: number;
    menu_quantity: number | null; 
    menu_image: string | null;
    menu_description: string | null; 
}

// Interface for editing state
interface EditingStockState {
    id: number;
    currentQuantity: number | null; 
    editValue: string; 
    isSaving: boolean;
}

const StockManagement = () => {
    // --- States ---
    const [menuItems, setMenuItems] = useState<StockMenuItem[]>([]); 
    const [filteredItems, setFilteredItems] = useState<StockMenuItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingStockState, setEditingStockState] = useState<EditingStockState | null>(null); 
    
    // ✅ เพิ่ม State สำหรับหมวดหมู่
    const [selectedCategory, setSelectedCategory] = useState('All');

    // --- Fetch Data Function ---
    const fetchData = useCallback(async () => {
        setError(null);
        try {
            const adminUserId = localStorage.getItem('userId');
            const headers = adminUserId ? { 'x-user-id': adminUserId } : {};

            const response = await axios.get<StockMenuItem[]>(`${apiUrl}/api/menu`, { headers });
            setMenuItems(response.data); 
        } catch (err) {
            console.error("Error fetching menu data for stock:", err);
            setError("ไม่สามารถดึงข้อมูลเมนูได้");
        } finally {
            setLoading(false); 
        }
    }, []); 

    // --- Initial Fetch & Socket Connection ---
    useEffect(() => {
        setLoading(true); 
        fetchData();

        if (!socket.connected) {
            socket.connect();
        }
        socket.on('connect', () => console.log('✅ (StockMgmt) Connected to Socket.IO'));
        socket.on('menu_updated', fetchData); 

        return () => {
            socket.off('menu_updated', fetchData);
        };
    }, [fetchData]); 

    // ✅ สร้างรายการหมวดหมู่จากข้อมูลสินค้า (Memoized)
    const categories = useMemo(() => {
        const uniqueCategories = new Set(menuItems.map(item => item.menu_category || 'อื่นๆ'));
        return ['All', ...Array.from(uniqueCategories)];
    }, [menuItems]);

    // --- Filtering Logic (Updated) ---
    useEffect(() => {
        let items = menuItems;

        // 1. กรองตามหมวดหมู่
        if (selectedCategory !== 'All') {
            items = items.filter(item => (item.menu_category || 'อื่นๆ') === selectedCategory);
        }

        // 2. กรองตามคำค้นหา
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            items = items.filter(item =>
                item.menu_name.toLowerCase().includes(lowerTerm) ||
                (item.menu_category && item.menu_category.toLowerCase().includes(lowerTerm))
            );
        }
        setFilteredItems(items);
    }, [searchTerm, selectedCategory, menuItems]);

    // --- Edit Handlers (คงเดิม) ---
    const handleEditClick = (item: StockMenuItem) => {
        setEditingStockState({
            id: item.menu_id,
            currentQuantity: item.menu_quantity,
            editValue: item.menu_quantity === null ? '0' : item.menu_quantity.toString(),
            isSaving: false,
        });
    };

    const handleCancelEdit = () => {
        setEditingStockState(null); 
    };

    const handleEditValueChange = (value: string) => {
        if (editingStockState) {
            if (/^\d*$/.test(value)) {
                 setEditingStockState({ ...editingStockState, editValue: value });
            }
        }
    };

    const adjustEditValue = (amount: number) => {
        if (editingStockState) {
            const currentValue = parseInt(editingStockState.editValue || '0', 10); 
            const newValue = Math.max(0, currentValue + amount); 
            setEditingStockState({ ...editingStockState, editValue: newValue.toString() });
        }
    };

    const handleSaveEdit = async () => {
        if (!editingStockState) return;

        const { id, editValue, currentQuantity } = editingStockState;
        const valueToSave = editValue.trim(); 

        if (valueToSave === '' || !/^\d+$/.test(valueToSave)) {
            Swal.fire('ข้อมูลผิดพลาด', 'กรุณาป้อนจำนวนสต็อกเป็นตัวเลขจำนวนเต็มบวก หรือ 0', 'warning');
            return;
        }

        const newQuantity = parseInt(valueToSave, 10);

        if (newQuantity === currentQuantity) {
             setEditingStockState(null); 
             return;
        }

        setEditingStockState({ ...editingStockState, isSaving: true }); 

        try {
            const menuItem = menuItems.find(m => m.menu_id === id);
            if (!menuItem) {
                throw new Error("Menu item not found locally");
            }

            const fullMenuItemData = {
                menu_name: menuItem.menu_name,
                menu_description: menuItem.menu_description || null, 
                menu_category: menuItem.menu_category || null, 
                price: menuItem.price,
                menu_quantity: newQuantity, 
                menu_image: menuItem.menu_image 
            };

            const adminUserId = localStorage.getItem('userId');
            const headers = adminUserId ? { 'x-user-id': adminUserId } : {};

            await axios.put(`${apiUrl}/api/menu/${id}`, fullMenuItemData, { headers });

            setMenuItems(prev => prev.map(item =>
                item.menu_id === id ? { ...item, menu_quantity: newQuantity } : item
            ));
            setEditingStockState(null); 

        } catch (err: any) {
            console.error(`Error updating stock for menu ${id}:`, err);
            Swal.fire('ผิดพลาด!', err.response?.data?.error || `ไม่สามารถอัปเดตสต็อกสำหรับ ${editingStockState?.id} ได้`, 'error');
             setEditingStockState(prev => prev ? { ...prev, isSaving: false } : null); 
        }
    };

    // --- Component: Render Edit Control ---
    const renderQuantityControl = (item: StockMenuItem) => {
        if (editingStockState?.id === item.menu_id) {
            return (
                <div className="flex items-center justify-center gap-1">
                    <button
                        type="button"
                        onClick={() => adjustEditValue(-1)}
                        disabled={editingStockState.isSaving}
                        className="p-1 rounded-full text-red-600 hover:bg-red-100 disabled:opacity-50"
                    >
                        <MinusIcon className="w-4 h-4" />
                    </button>
                    <input
                        type="text"
                        inputMode='numeric'
                        value={editingStockState.editValue}
                        onChange={(e) => handleEditValueChange(e.target.value)}
                        disabled={editingStockState.isSaving}
                        className={`w-16 p-1 text-center border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 ${
                            (editingStockState.editValue !== '' && !/^\d+$/.test(editingStockState.editValue)) 
                            ? 'border-red-500 text-red-600' 
                            : 'border-gray-300'
                        }`}
                    />
                     <button
                        type="button"
                        onClick={() => adjustEditValue(1)}
                        disabled={editingStockState.isSaving}
                        className="p-1 rounded-full text-green-600 hover:bg-green-100 disabled:opacity-50"
                    >
                        <PlusIcon className="w-4 h-4" />
                    </button>
                </div>
            );
        } else {
            return (
                <span className={`text-sm font-semibold ${
                    item.menu_quantity === null ? 'text-gray-400 italic' :
                    item.menu_quantity <= 10 ? 'text-red-600' : 'text-gray-900'
                }`}>
                    {item.menu_quantity === null ? '-' : item.menu_quantity}
                </span>
            );
        }
    };

    // --- Component: Render Actions ---
    const renderActions = (item: StockMenuItem) => {
        if (editingStockState?.id === item.menu_id) {
            return (
                <div className="flex justify-center gap-2">
                     <button
                         onClick={handleSaveEdit}
                         disabled={editingStockState.isSaving}
                         className="p-1 rounded-full text-green-600 hover:bg-green-100 disabled:opacity-50"
                         title="บันทึก"
                     >
                         {editingStockState.isSaving
                             ? <ArrowPathIcon className="w-5 h-5 animate-spin"/>
                             : <CheckIcon className="w-5 h-5" />
                         }
                     </button>
                     <button
                         onClick={handleCancelEdit}
                         disabled={editingStockState.isSaving}
                         className="p-1 rounded-full text-gray-500 hover:bg-gray-200 disabled:opacity-50"
                         title="ยกเลิก"
                     >
                         <XMarkIcon className="w-5 h-5" />
                     </button>
                 </div>
            );
        } else {
            return (
                <button
                     onClick={() => handleEditClick(item)}
                     className="p-1 rounded-full text-blue-600 hover:bg-blue-100"
                     title="แก้ไขสต็อก"
                 >
                     <PencilSquareIcon className="w-5 h-5" />
                 </button>
            );
        }
    };


    // --- Render Logic ---
    if (loading) return <div className="text-center p-10 text-gray-500 text-lg">กำลังโหลดข้อมูลเมนู...</div>;
    if (error) return <div className="text-center p-10 text-red-500">{error}</div>;

    return (
        <div className="p-4 sm:p-6 space-y-6 bg-gray-50 min-h-screen">
            {/* Header and Refresh Button */}
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">จัดการสต็อกสินค้า</h1>
                <button
                    onClick={() => { setLoading(true); fetchData(); }} 
                    disabled={loading}
                    className="p-2 text-blue-600 rounded-full hover:bg-blue-100 disabled:opacity-50 transition-colors"
                    title="รีเฟรชข้อมูล"
                >
                    <ArrowPathIcon className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* ✅ Category Tabs */}
            <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
                {categories.map(category => (
                    <button
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className={`
                            px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors
                            ${selectedCategory === category 
                                ? 'bg-blue-600 text-white shadow-md' 
                                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}
                        `}
                    >
                        {category === 'All' ? 'ทั้งหมด' : category}
                    </button>
                ))}
            </div>

            {/* Search Bar */}
            <div className="relative mb-6 shadow-sm">
                <input
                    type="text"
                    placeholder="ค้นหาเมนู..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="p-3 pl-10 border border-gray-300 rounded-xl w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                />
                <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            </div>

            {/* ✅ Stock List (Responsive Card/Table) */}
            <div className="space-y-4">
                {filteredItems.length === 0 && (
                     <div className="text-center p-10 text-gray-500 italic bg-white rounded-xl shadow-sm">
                         ไม่พบรายการเมนู {searchTerm && 'ที่ตรงกับการค้นหา'}
                     </div>
                )}

                {/* MOBILE VIEW (CARDS) */}
                <div className="md:hidden space-y-4">
                    {filteredItems.map((item) => (
                        <div 
                            key={item.menu_id} 
                            className={`bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden p-4 ${editingStockState?.id === item.menu_id ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}
                        >
                            <div className="flex items-center gap-4 mb-3">
                                <img
                                    src={item.menu_image ? `data:image/png;base64,${item.menu_image}` : 'https://via.placeholder.com/50'}
                                    alt={item.menu_name}
                                    className="w-16 h-16 object-cover rounded-lg border border-gray-100"
                                />
                                <div className="flex-grow">
                                    <div className="font-bold text-gray-900">{item.menu_name}</div>
                                    <div className="text-sm text-gray-500">{item.menu_category || '-'}</div>
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between border-t border-gray-100 pt-3 mt-2">
                                <div className="flex flex-col items-center">
                                    <span className="text-xs text-gray-500 uppercase font-semibold mb-1">คงเหลือ</span>
                                    {renderQuantityControl(item)}
                                </div>
                                <div>
                                    {renderActions(item)}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* DESKTOP VIEW (TABLE) */}
                <div className="hidden md:block bg-white rounded-lg shadow-md overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">รูป</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">ชื่อเมนู</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">หมวดหมู่</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">จำนวนคงเหลือ</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredItems.map((item) => (
                                <tr key={item.menu_id} className={`transition-colors ${editingStockState?.id === item.menu_id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                                    <td className="px-4 py-3 whitespace-nowrap align-middle">
                                        <img
                                            src={item.menu_image ? `data:image/png;base64,${item.menu_image}` : 'https://via.placeholder.com/50'}
                                            alt={item.menu_name}
                                            className="w-12 h-12 object-cover rounded-md shadow-sm"
                                        />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap align-middle">
                                        <div className="text-sm font-medium text-gray-900">{item.menu_name}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 align-middle">
                                         {item.menu_category || '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center align-middle">
                                        {renderQuantityControl(item)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm align-middle">
                                         {renderActions(item)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default StockManagement;
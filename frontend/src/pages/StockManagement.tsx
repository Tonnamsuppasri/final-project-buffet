import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import {
    MagnifyingGlassIcon, ArrowPathIcon, PencilSquareIcon, CheckIcon, XMarkIcon, PlusIcon, MinusIcon
} from '@heroicons/react/24/outline'; // Import icons needed
import Swal from 'sweetalert2';

// Backend API URL
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
// Socket connection
export const socket = io(apiUrl, { autoConnect: false });

// Interface for Menu Item (ตรงกับ API /api/menu)
interface StockMenuItem {
    menu_id: number;
    menu_name: string;
    menu_category: string | null; // Allow null
    price: number;
    menu_quantity: number | null; // สต็อกปัจจุบัน (can be null)
    menu_image: string | null;
    menu_description: string | null; // Added based on previous correction
    // --- UI temporary fields ---
    // No editQuantity needed globally, handle locally during edit
}

// Interface for the state holding the item currently being edited
interface EditingStockState {
    id: number;
    currentQuantity: number | null; // Original quantity when edit started
    editValue: string; // The value in the input field (string)
    isSaving: boolean;
}

const StockManagement = () => {
    // --- States ---
    const [menuItems, setMenuItems] = useState<StockMenuItem[]>([]); // All menu items
    const [filteredItems, setFilteredItems] = useState<StockMenuItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingStockState, setEditingStockState] = useState<EditingStockState | null>(null); // State for inline editing

    // --- Fetch Data Function ---
    const fetchData = useCallback(async () => {
        // Don't reset loading if only refetching due to socket update
        // setLoading(true); // Set loading only on initial load or manual refresh
        setError(null);
        try {
            // *** Add Authentication Header if needed ***
            const adminUserId = localStorage.getItem('userId');
            const headers = adminUserId ? { 'x-user-id': adminUserId } : {};

            const response = await axios.get<StockMenuItem[]>(`${apiUrl}/api/menu`, { headers });
            setMenuItems(response.data); // Get ALL menu items
        } catch (err) {
            console.error("Error fetching menu data for stock:", err);
            setError("ไม่สามารถดึงข้อมูลเมนูได้");
        } finally {
            setLoading(false); // Stop loading after fetch completes
        }
    }, []); // Empty dependency array, fetchData instance won't change

    // --- Initial Fetch & Socket Connection ---
    useEffect(() => {
        setLoading(true); // Set loading true on initial mount
        fetchData();

        if (!socket.connected) {
            socket.connect();
        }
        socket.on('connect', () => console.log('✅ (StockMgmt) Connected to Socket.IO'));
        socket.on('menu_updated', fetchData); // Refetch data when menu updates

        return () => {
            socket.off('menu_updated', fetchData);
            // Consider disconnecting if appropriate for your app structure
            // socket.disconnect();
        };
    }, [fetchData]); // Run once on mount

    // --- Filtering Logic ---
    useEffect(() => {
        let items = menuItems;
        if (searchTerm) {
            items = items.filter(item =>
                item.menu_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.menu_category && item.menu_category.toLowerCase().includes(searchTerm.toLowerCase()))
            );
        }
        setFilteredItems(items);
    }, [searchTerm, menuItems]);

    // --- Edit Handlers ---
    const handleEditClick = (item: StockMenuItem) => {
        setEditingStockState({
            id: item.menu_id,
            currentQuantity: item.menu_quantity,
            // Initialize editValue: if null, start with '0', otherwise use current value
            editValue: item.menu_quantity === null ? '0' : item.menu_quantity.toString(),
            isSaving: false,
        });
    };

    const handleCancelEdit = () => {
        setEditingStockState(null); // Clear editing state
    };

    const handleEditValueChange = (value: string) => {
        if (editingStockState) {
            // Allow empty string temporarily, validation happens on save
             // Only allow numbers or empty string
            if (/^\d*$/.test(value)) {
                 setEditingStockState({ ...editingStockState, editValue: value });
            }
        }
    };

    // Handler for + / - buttons
    const adjustEditValue = (amount: number) => {
        if (editingStockState) {
            const currentValue = parseInt(editingStockState.editValue || '0', 10); // Default to 0 if empty
            const newValue = Math.max(0, currentValue + amount); // Ensure quantity doesn't go below 0
            setEditingStockState({ ...editingStockState, editValue: newValue.toString() });
        }
    };


    const handleSaveEdit = async () => {
        if (!editingStockState) return;

        const { id, editValue, currentQuantity } = editingStockState;
        const valueToSave = editValue.trim(); // Trim whitespace

        // Validate: Must not be empty and must be a non-negative integer
        if (valueToSave === '' || !/^\d+$/.test(valueToSave)) {
            Swal.fire('ข้อมูลผิดพลาด', 'กรุณาป้อนจำนวนสต็อกเป็นตัวเลขจำนวนเต็มบวก หรือ 0', 'warning');
            return;
        }

        const newQuantity = parseInt(valueToSave, 10);

        // Optional: Check if the value actually changed
        if (newQuantity === currentQuantity) {
             setEditingStockState(null); // No change, just cancel edit mode
             return;
        }


        setEditingStockState({ ...editingStockState, isSaving: true }); // Set saving state

        try {
            // Find the full menu item data to send (API needs all fields)
            const menuItem = menuItems.find(m => m.menu_id === id);
            if (!menuItem) {
                throw new Error("Menu item not found locally");
            }

            const fullMenuItemData = {
                menu_name: menuItem.menu_name,
                menu_description: menuItem.menu_description || null, // Handle null description
                menu_category: menuItem.menu_category || null, // Handle null category
                price: menuItem.price,
                menu_quantity: newQuantity, // Send the new number
                menu_image: menuItem.menu_image // Send existing image data (base64) back
            };

            // *** Add Authentication Header if needed ***
            const adminUserId = localStorage.getItem('userId');
            const headers = adminUserId ? { 'x-user-id': adminUserId } : {};


            // Call the PUT API
            await axios.put(`${apiUrl}/api/menu/${id}`, fullMenuItemData, { headers });

            // Success: Update local state and exit edit mode
            setMenuItems(prev => prev.map(item =>
                item.menu_id === id ? { ...item, menu_quantity: newQuantity } : item
            ));
            setEditingStockState(null); // Exit edit mode
            // Swal.fire('สำเร็จ', 'อัปเดตสต็อกเรียบร้อย', 'success'); // Optional success message

        } catch (err: any) {
            console.error(`Error updating stock for menu ${id}:`, err);
            Swal.fire('ผิดพลาด!', err.response?.data?.error || `ไม่สามารถอัปเดตสต็อกสำหรับ ${editingStockState?.id} ได้`, 'error');
             setEditingStockState(prev => prev ? { ...prev, isSaving: false } : null); // Unset saving state on error
        }
         // No finally block to reset saving, it's done on success/error
    };


    // --- Render Logic ---
    if (loading) return <div className="text-center p-10">กำลังโหลดข้อมูลเมนู...</div>;
    if (error) return <div className="text-center p-10 text-red-500">{error}</div>;

    return (
        <div className="p-4 sm:p-6 space-y-6">
            {/* Header and Refresh Button */}
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">จัดการสต็อกสินค้า</h1>
                <button
                    onClick={() => { setLoading(true); fetchData(); }} // Add setLoading true on manual refresh
                    disabled={loading}
                    className="p-2 text-blue-600 rounded-full hover:bg-blue-100 disabled:opacity-50"
                    title="รีเฟรชข้อมูล"
                >
                    <ArrowPathIcon className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Search Bar */}
            <div className="relative mb-6">
                <input
                    type="text"
                    placeholder="ค้นหาเมนู..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="p-3 pl-10 border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            </div>

            {/* Stock Table */}
            <div className="bg-white rounded-lg shadow-md overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider hidden sm:table-cell">รูป</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">ชื่อเมนู</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider hidden md:table-cell">หมวดหมู่</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">จำนวนคงเหลือ</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredItems.length === 0 && (
                             <tr>
                                <td colSpan={5} className="text-center p-6 text-gray-500 italic">
                                     ไม่พบรายการเมนู {searchTerm && 'ที่ตรงกับการค้นหา'}
                                </td>
                             </tr>
                        )}
                        {filteredItems.map((item) => (
                            <tr key={item.menu_id} className={`transition-colors ${editingStockState?.id === item.menu_id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                                {/* Image Column */}
                                <td className="px-4 py-3 whitespace-nowrap hidden sm:table-cell align-top">
                                    <img
                                        src={item.menu_image ? `data:image/png;base64,${item.menu_image}` : 'https://via.placeholder.com/50'}
                                        alt={item.menu_name}
                                        className="w-12 h-12 object-cover rounded-md shadow-sm"
                                    />
                                </td>
                                {/* Name/Category Column */}
                                <td className="px-6 py-4 whitespace-nowrap align-top">
                                    <div className="text-sm font-medium text-gray-900">{item.menu_name}</div>
                                    <div className="text-sm text-gray-500 mt-1">{item.menu_category || '-'}</div>
                                </td>
                                 {/* Category (hidden on medium down) */}
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 hidden md:table-cell align-top">
                                     {item.menu_category || '-'}
                                </td>

                                {/* --- Quantity Display/Edit Column --- */}
                                <td className="px-6 py-4 whitespace-nowrap text-center align-middle">
                                    {editingStockState?.id === item.menu_id ? (
                                        // --- Editing Mode ---
                                        <div className="flex items-center justify-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => adjustEditValue(-1)}
                                                disabled={editingStockState.isSaving}
                                                className="p-1 rounded-full text-red-600 hover:bg-red-100 disabled:opacity-50"
                                                title="ลดจำนวน"
                                            >
                                                <MinusIcon className="w-4 h-4" />
                                            </button>
                                            <input
                                                type="text" // Use text to allow empty string temporarily
                                                inputMode='numeric' // Hint for mobile keyboards
                                                pattern="[0-9]*" // Basic pattern check
                                                value={editingStockState.editValue}
                                                onChange={(e) => handleEditValueChange(e.target.value)}
                                                disabled={editingStockState.isSaving}
                                                className={`w-16 p-1 text-center border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 ${
                                                    (editingStockState.editValue !== '' && !/^\d+$/.test(editingStockState.editValue)) || (editingStockState.editValue !== '' && parseInt(editingStockState.editValue, 10) < 0)
                                                    ? 'border-red-500' // Invalid input style
                                                    : 'border-gray-300'
                                                }`}
                                            />
                                             <button
                                                type="button"
                                                onClick={() => adjustEditValue(1)}
                                                disabled={editingStockState.isSaving}
                                                className="p-1 rounded-full text-green-600 hover:bg-green-100 disabled:opacity-50"
                                                title="เพิ่มจำนวน"
                                            >
                                                <PlusIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        // --- Display Mode ---
                                        <span className={`text-sm font-semibold ${
                                            item.menu_quantity === null ? 'text-gray-400 italic' :
                                            item.menu_quantity <= 10 ? 'text-red-600' : 'text-gray-900'
                                        }`}>
                                            {item.menu_quantity === null ? '-' : item.menu_quantity}
                                        </span>
                                    )}
                                </td>

                                {/* --- Action Buttons Column --- */}
                                <td className="px-6 py-4 whitespace-nowrap text-center text-sm align-middle">
                                     {editingStockState?.id === item.menu_id ? (
                                         // --- Editing Actions ---
                                         <div className="flex justify-center gap-2">
                                             <button
                                                 onClick={handleSaveEdit}
                                                 disabled={editingStockState.isSaving}
                                                 className="p-1 rounded-full text-green-600 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
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
                                     ) : (
                                         // --- Display Action ---
                                          // Only show Edit button if stock is trackable (not null) OR if it's currently null (to allow adding initial stock)
                                         // if (item.menu_quantity !== null) { // <<< Alternative: Only allow editing if already tracked
                                         <button
                                             onClick={() => handleEditClick(item)}
                                             className="p-1 rounded-full text-blue-600 hover:bg-blue-100"
                                             title="แก้ไขสต็อก"
                                         >
                                             <PencilSquareIcon className="w-5 h-5" />
                                         </button>
                                        // }
                                     )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {/* No items message (already handled inside tbody) */}
            </div>
        </div>
    );
};

export default StockManagement;
import { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import './setting.css';

// --- Interfaces ---
interface ShopData {
    shop_name: string;
    shop_address: string;
    shop_phone: string;
    open_time: string;
    close_time: string;
    payment_qr_code: string | null;
    shop_logo: string | null;
}

interface TableData {
    table_id: number;
    table_number: number;
    seat_capacity: number;
    status: 'ว่าง' | 'ไม่ว่าง';
}

interface PlanData {
    id: number;
    plan_name: string;
    price_per_person: number;
    description: string;
}

interface MenuData {
    menu_id: number;
    menu_name: string;
    menu_description: string | null;
    menu_category: string | null;
    price: number;
    menu_quantity: number;
    menu_image: string | null; 
}

const Setting = () => {
    const location = useLocation();
    const role = location.state?.role;

    // --- States ---
    const [shopData, setShopData] = useState<ShopData>({ 
        shop_name: '', shop_address: '', shop_phone: '', 
        open_time: '', close_time: '', payment_qr_code: null,
        shop_logo: null
    });
    
    // Table states
    const [tables, setTables] = useState<TableData[]>([]);
    const [newTable, setNewTable] = useState({ table_number: '', seat_capacity: '' });
    const [editingTableId, setEditingTableId] = useState<number | null>(null);
    const [editingTableData, setEditingTableData] = useState({ table_number: '', seat_capacity: '' });

    // Plan states
    const [plans, setPlans] = useState<PlanData[]>([]);
    const [newPlan, setNewPlan] = useState({ plan_name: '', price_per_person: '', description: '' });

    // Menu states
    const [menuItems, setMenuItems] = useState<MenuData[]>([]);
    const [newMenu, setNewMenu] = useState({
        menu_name: '',
        menu_description: '',
        menu_category: '',
        price: '',
        menu_quantity: '0',
        menu_image: null as string | null 
    });
    const [editingMenuId, setEditingMenuId] = useState<number | null>(null);
    const [editingMenuData, setEditingMenuData] = useState({
        menu_name: '',
        menu_description: '',
        menu_category: '',
        price: '',
        menu_quantity: 0,
        menu_image: null as string | null 
    });
    
    // General states
    const [loading, setLoading] = useState(true);
    const [accordionState, setAccordionState] = useState({ shop: true, tables: false, plans: false, menu: false });

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

    // --- Data Fetching ---
    useEffect(() => {
        const fetchAllData = async () => {
            try {
                const [shopRes, tablesRes, plansRes, menuRes] = await Promise.all([
                    axios.get<ShopData>(`${apiUrl}/api/shop`),
                    axios.get<TableData[]>(`${apiUrl}/api/tables`),
                    axios.get<PlanData[]>(`${apiUrl}/api/plans`),
                    axios.get<MenuData[]>(`${apiUrl}/api/menu`) 
                ]);
                setShopData({
                    ...shopRes.data,
                    open_time: shopRes.data.open_time?.substring(0, 5) || '',
                    close_time: shopRes.data.close_time?.substring(0, 5) || ''
                });
                setTables(tablesRes.data);
                setPlans(plansRes.data);
                setMenuItems(menuRes.data);
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };
        if (role === 'Admin') { fetchAllData(); } else { setLoading(false); }
    }, [apiUrl, role]);

    // --- Handlers ---
    const toggleAccordion = (section: 'shop' | 'tables' | 'plans' | 'menu') => {
        setAccordionState(prevState => ({ ...prevState, [section]: !prevState[section] }));
    };

    // --- Shop Handlers ---
    const handleShopChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setShopData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    
    const handleLogoChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = (reader.result as string).split(',')[1];
                setShopData(prev => ({ ...prev, shop_logo: base64String }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleQrCodeChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = (reader.result as string).split(',')[1];
                setShopData(prev => ({ ...prev, payment_qr_code: base64String }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleShopSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        try {
            await axios.put(`${apiUrl}/api/shop`, shopData);
            Swal.fire('สำเร็จ!', 'บันทึกข้อมูลร้านค้าเรียบร้อย', 'success');
        } catch (error) {
            console.error("Error updating shop data:", error);
            Swal.fire('ผิดพลาด!', 'เกิดข้อผิดพลาดในการบันทึกข้อมูล', 'error');
        }
    };
    
    // --- Table Handlers ---
    const handleNewTableChange = (e: ChangeEvent<HTMLInputElement>) => setNewTable(prev => ({ ...prev, [e.target.name]: e.target.value }));
    
    const handleAddTable = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!newTable.table_number || !newTable.seat_capacity) return Swal.fire('ข้อมูลไม่ครบ', 'กรุณากรอกข้อมูลให้ครบถ้วน', 'warning');
        try {
            const response = await axios.post<TableData>(`${apiUrl}/api/tables`, newTable);
            setTables([...tables, response.data].sort((a,b) => a.table_number - b.table_number));
            setNewTable({ table_number: '', seat_capacity: '' });
            Swal.fire('สำเร็จ!', 'เพิ่มโต๊ะเรียบร้อย', 'success');
        } catch (error: any) {
            Swal.fire('ผิดพลาด!', error.response?.data?.error || 'ไม่สามารถเพิ่มโต๊ะได้', 'error');
        }
    };

    const handleDeleteTable = async (tableIdToDelete: number) => {
        const result = await Swal.fire({
            title: 'แน่ใจหรือไม่?', text: "คุณต้องการลบโต๊ะนี้ใช่หรือไม่", icon: 'warning',
            showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#6b7280',
            confirmButtonText: 'ใช่, ลบเลย!', cancelButtonText: 'ยกเลิก'
        });
        if (result.isConfirmed) {
            try {
                await axios.delete(`${apiUrl}/api/tables/${tableIdToDelete}`);
                setTables(tables.filter(table => table.table_id !== tableIdToDelete));
                Swal.fire('ลบแล้ว!', 'โต๊ะถูกลบเรียบร้อย', 'success');
            } catch (error: any) {
                Swal.fire('ผิดพลาด!', error.response?.data?.error || 'ไม่สามารถลบโต๊ะได้', 'error');
            }
        }
    };

    const handleEditClick = (table: TableData) => {
        setEditingTableId(table.table_id);
        setEditingTableData({
            table_number: String(table.table_number),
            seat_capacity: String(table.seat_capacity)
        });
    };
    const handleCancelEdit = () => setEditingTableId(null);
    const handleEditingTableChange = (e: ChangeEvent<HTMLInputElement>) => setEditingTableData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    
    const handleUpdateTable = async (tableToUpdate: TableData) => {
        if (!editingTableId) return;
        try {
            const updatedData = { ...tableToUpdate, ...editingTableData };
            await axios.put(`${apiUrl}/api/tables/${editingTableId}`, updatedData);
            setTables(tables.map(table => 
                table.table_id === editingTableId ? { ...table, table_number: Number(editingTableData.table_number), seat_capacity: Number(editingTableData.seat_capacity) } : table
            ).sort((a,b) => a.table_number - b.table_number));
            setEditingTableId(null);
            Swal.fire('สำเร็จ!', 'อัปเดตข้อมูลโต๊ะเรียบร้อย', 'success');
        } catch (error: any) {
            Swal.fire('ผิดพลาด!', error.response?.data?.error || 'ไม่สามารถอัปเดตข้อมูลโต๊ะได้', 'error');
        }
    };

    // --- Plan Handlers ---
    const handleNewPlanChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setNewPlan(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleAddPlan = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!newPlan.plan_name || !newPlan.price_per_person) return Swal.fire('ข้อมูลไม่ครบ', 'กรุณากรอกชื่อและราคาโปรโมชัน', 'warning');
        try {
            const response = await axios.post<PlanData>(`${apiUrl}/api/plans`, newPlan);
            setPlans([...plans, response.data]);
            setNewPlan({ plan_name: '', price_per_person: '', description: '' });
            Swal.fire('สำเร็จ!', 'เพิ่มโปรโมชันเรียบร้อย', 'success');
        } catch (error: any) {
            Swal.fire('ผิดพลาด!', error.response?.data?.error || 'ไม่สามารถเพิ่มโปรโมชันได้', 'error');
        }
    };

    const handleDeletePlan = async (planId: number) => {
        const result = await Swal.fire({
            title: 'แน่ใจหรือไม่?', text: "คุณต้องการลบโปรโมชันนี้ใช่หรือไม่?", icon: 'warning',
            showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#6b7280',
            confirmButtonText: 'ใช่, ลบเลย!', cancelButtonText: 'ยกเลิก'
        });
        if (result.isConfirmed) {
            try {
                await axios.delete(`${apiUrl}/api/plans/${planId}`);
                setPlans(plans.filter(p => p.id !== planId));
                Swal.fire('ลบแล้ว!', 'โปรโมชันถูกลบเรียบร้อย', 'success');
            } catch (error: any) {
                Swal.fire('ผิดพลาด!', error.response?.data?.error || 'ไม่สามารถลบโปรโมชันได้', 'error');
            }
        }
    };

    // --- Menu Handlers ---
    const handleNewMenuChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setNewMenu(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };
    
    const handleMenuImageChange = (e: ChangeEvent<HTMLInputElement>, type: 'new' | 'edit') => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = (reader.result as string).split(',')[1];
                if (type === 'new') {
                    setNewMenu(prev => ({ ...prev, menu_image: base64String }));
                } else {
                    setEditingMenuData(prev => ({ ...prev, menu_image: base64String }));
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAddMenu = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!newMenu.menu_name || !newMenu.price) return Swal.fire('ข้อมูลไม่ครบ', 'กรุณากรอกชื่อเมนูและราคา', 'warning');
        try {
            await axios.post(`${apiUrl}/api/menu`, newMenu);
            const menuRes = await axios.get<MenuData[]>(`${apiUrl}/api/menu`);
            setMenuItems(menuRes.data);
            setNewMenu({ menu_name: '', menu_description: '', menu_category: '', price: '', menu_quantity: '0', menu_image: null });
            Swal.fire('สำเร็จ!', 'เพิ่มเมนูเรียบร้อย', 'success');
        } catch (error: any) {
            Swal.fire('ผิดพลาด!', error.response?.data?.error || 'ไม่สามารถเพิ่มเมนูได้', 'error');
        }
    };

    const handleDeleteMenu = async (menuId: number) => {
        const result = await Swal.fire({
            title: 'แน่ใจหรือไม่?', text: "คุณต้องการลบเมนูนี้ใช่หรือไม่?", icon: 'warning',
            showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#6b7280',
            confirmButtonText: 'ใช่, ลบเลย!', cancelButtonText: 'ยกเลิก'
        });
        if (result.isConfirmed) {
            try {
                await axios.delete(`${apiUrl}/api/menu/${menuId}`);
                setMenuItems(menuItems.filter(m => m.menu_id !== menuId));
                Swal.fire('ลบแล้ว!', 'เมนูถูกลบเรียบร้อย', 'success');
            } catch (error: any) {
                Swal.fire('ผิดพลาด!', error.response?.data?.error || 'ไม่สามารถลบเมนูได้', 'error');
            }
        }
    };

    const handleEditMenuClick = (menu: MenuData) => {
        setEditingMenuId(menu.menu_id);
        setEditingMenuData({
            menu_name: menu.menu_name,
            menu_description: menu.menu_description || '',
            menu_category: menu.menu_category || '',
            price: String(menu.price),
            menu_quantity: menu.menu_quantity,
            menu_image: menu.menu_image 
        });
    };

    const handleCancelMenuEdit = () => setEditingMenuId(null);

    const handleEditingMenuChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setEditingMenuData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleUpdateMenu = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!editingMenuId) return;
        try {
            await axios.put(`${apiUrl}/api/menu/${editingMenuId}`, editingMenuData);
            setMenuItems(menuItems.map(menu => 
                menu.menu_id === editingMenuId ? { 
                    ...menu, 
                    ...editingMenuData,
                    price: Number(editingMenuData.price),
                    menu_quantity: Number(editingMenuData.menu_quantity),
                    menu_image: editingMenuData.menu_image
                } : menu
            ));
            setEditingMenuId(null);
            Swal.fire('สำเร็จ!', 'อัปเดตข้อมูลเมนูเรียบร้อย', 'success');
        } catch (error: any) {
            Swal.fire('ผิดพลาด!', error.response?.data?.error || 'ไม่สามารถอัปเดตข้อมูลเมนูได้', 'error');
        }
    };


    if (loading) {
        return <div className="p-8">กำลังโหลดข้อมูล...</div>;
    }

    // --- JSX ---
    return (
        <div className="p-8">
            <h1 className="text-4xl font-bold mb-6">ตั้งค่าทั่วไป</h1>
            {role === 'Admin' ? (
                <div className="space-y-4 max-w-3xl mx-auto">
                    
                    {/* Accordion: Shop Management */}
                    <div className="accordion-item">
                        <button onClick={() => toggleAccordion('shop')} className="accordion-header">
                            <span>จัดการข้อมูลร้านค้า</span>
                            <span className={`accordion-arrow ${accordionState.shop ? 'open' : ''}`}>▼</span>
                        </button>
                        <div className={`accordion-content ${accordionState.shop ? 'open' : ''}`}>
                            <form onSubmit={handleShopSubmit} className="p-6 space-y-4">

                                {/* ✅✅✅ START: โลโก้ (แก้ไข JSX) ✅✅✅ */}
                                <div>
                                    <label className="block text-gray-700 text-sm font-bold mb-2 text-center">
                                        โลโก้ร้าน
                                    </label>
                                    <div className="logo-section">
                                        <label htmlFor="logo-upload" className="logo-preview">
                                            {shopData.shop_logo ? (
                                                <img src={`data:image/png;base64,${shopData.shop_logo}`} alt="Shop Logo" />
                                            ) : (
                                                <div className="logo-placeholder">
                                                    <span>คลิกเพื่อ<br/>อัปโหลดโลโก้</span>
                                                </div>
                                            )}
                                        </label>
                                        <div className="logo-upload-text">
                                            <p className="text-xs text-gray-500">
                                                แนะนำไฟล์ .png หรือ .jpg
                                            </p>
                                        </div>
                                        <input
                                            id="logo-upload"
                                            type="file"
                                            accept="image/png, image/jpeg, image/webp"
                                            onChange={handleLogoChange}
                                            style={{ display: 'none' }}
                                        />
                                    </div>
                                </div>
                                {/* ✅✅✅ END: โลโก้ (แก้ไข JSX) ✅✅✅ */}

                                <div>
                                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="shop_name">ชื่อร้าน</label>
                                    <input type="text" name="shop_name" value={shopData.shop_name} onChange={handleShopChange} className="input-field" />
                                </div>
                                <div>
                                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="shop_address">ที่อยู่</label>
                                    <textarea name="shop_address" value={shopData.shop_address} onChange={handleShopChange} className="input-field" />
                                </div>
                                <div>
                                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="shop_phone">เบอร์ติดต่อ</label>
                                    <input type="text" name="shop_phone" value={shopData.shop_phone} onChange={handleShopChange} className="input-field" />
                                </div>
                                <div className="flex gap-4">
                                    <div className="w-1/2">
                                        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="open_time">เวลาเปิด</label>
                                        <input type="time" name="open_time" value={shopData.open_time} onChange={handleShopChange} className="input-field" />
                                    </div>
                                    <div className="w-1/2">
                                        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="close_time">เวลาปิด</label>
                                        <input type="time" name="close_time" value={shopData.close_time} onChange={handleShopChange} className="input-field" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-gray-700 text-sm font-bold mb-2">
                                        QR Code สำหรับชำระเงิน
                                    </label>
                                    <div className="qr-code-section">
                                        <div className="qr-code-preview">
                                            {shopData.payment_qr_code ? (
                                                <img src={`data:image/png;base64,${shopData.payment_qr_code}`} alt="Payment QR Code" />
                                            ) : (
                                                <div className="qr-placeholder">
                                                    <span>ไม่มีรูปภาพ</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="qr-code-upload">
                                            <label htmlFor="qr-upload" className="btn-secondary">
                                                เลือกไฟล์ใหม่
                                            </label>
                                            <input
                                                id="qr-upload"
                                                type="file"
                                                accept="image/png, image/jpeg, image/webp"
                                                onChange={handleQrCodeChange}
                                            />
                                            <p className="text-xs text-gray-500 mt-2">
                                                แนะนำไฟล์ .png หรือ .jpg
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex justify-end">
                                    <button type="submit" className="btn-primary">บันทึกข้อมูลร้านค้า</button>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* Accordion: Table Management */}
                    <div className="accordion-item">
                        <button onClick={() => toggleAccordion('tables')} className="accordion-header">
                            <span>จัดการโต๊ะ</span>
                            <span className={`accordion-arrow ${accordionState.tables ? 'open' : ''}`}>▼</span>
                        </button>
                        <div className={`accordion-content ${accordionState.tables ? 'open' : ''}`}>
                            <div className="p-6">
                                <h3 className="text-xl font-semibold mb-4">เพิ่มโต๊ะใหม่</h3>
                                <form onSubmit={handleAddTable} className="flex items-end gap-4 mb-6">
                                    <div>
                                        <label htmlFor="table_number" className="block text-sm font-medium text-gray-700">หมายเลขโต๊ะ</label>
                                        <input type="number" name="table_number" value={newTable.table_number} onChange={handleNewTableChange} className="input-field mt-1" placeholder="เช่น 1, 2, 3..." />
                                    </div>
                                    <div>
                                        <label htmlFor="seat_capacity" className="block text-sm font-medium text-gray-700">จำนวนที่นั่ง</label>
                                        <input type="number" name="seat_capacity" value={newTable.seat_capacity} onChange={handleNewTableChange} className="input-field mt-1" placeholder="เช่น 4" />
                                    </div>
                                    <button type="submit" className="btn-primary">เพิ่มโต๊ะ</button>
                                </form>
                                <hr className="my-6" />
                                <h3 className="text-xl font-semibold mb-4">โต๊ะที่มีอยู่ ({tables.length})</h3>
                                <ul className="space-y-3">
                                    {tables.map(table => (
                                        <li key={table.table_id} className="flex justify-between items-center bg-gray-50 p-3 rounded-md">
                                            {editingTableId === table.table_id ? (
                                                <>
                                                    <div className='flex items-center gap-4'>
                                                        <span>โต๊ะ</span>
                                                        <input type="number" name="table_number" value={editingTableData.table_number} onChange={handleEditingTableChange} className="input-field-sm" />
                                                        <span>(</span>
                                                        <input type="number" name="seat_capacity" value={editingTableData.seat_capacity} onChange={handleEditingTableChange} className="input-field-sm" />
                                                        <span>ที่นั่ง)</span>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => handleUpdateTable(table)} className="btn-success">บันทึก</button>
                                                        <button onClick={handleCancelEdit} className="btn-secondary">ยกเลิก</button>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div>
                                                        <span className="font-bold text-lg">โต๊ะ {table.table_number}</span>
                                                        <span className="text-gray-500 ml-4">({table.seat_capacity} ที่นั่ง)</span>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => handleEditClick(table)} className="btn-secondary">แก้ไข</button>
                                                        <button onClick={() => handleDeleteTable(table.table_id)} className="btn-danger">ลบ</button>
                                                    </div>
                                                </>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Accordion: Menu Management */}
                    <div className="accordion-item">
                        <button onClick={() => toggleAccordion('menu')} className="accordion-header">
                            <span>จัดการเมนูอาหาร</span>
                            <span className={`accordion-arrow ${accordionState.menu ? 'open' : ''}`}>▼</span>
                        </button>
                        <div className={`accordion-content ${accordionState.menu ? 'open' : ''}`}>
                            <div className="p-6">
                                {editingMenuId ? (
                                    /* --- Edit Menu Form --- */
                                    <>
                                        <h3 className="text-xl font-semibold mb-4">แก้ไขเมนู</h3>
                                        <form onSubmit={handleUpdateMenu} className="menu-form space-y-4">
                                            <div>
                                                <label htmlFor="menu_name" className="form-label">ชื่อเมนู</label>
                                                <input type="text" name="menu_name" value={editingMenuData.menu_name} onChange={handleEditingMenuChange} className="input-field" required />
                                            </div>
                                            <div className="form-grid">
                                                <div>
                                                    <label htmlFor="price" className="form-label">ราคา (บาท)</label>
                                                    <input type="number" name="price" value={editingMenuData.price} onChange={handleEditingMenuChange} className="input-field" required />
                                                </div>
                                                <div>
                                                    <label htmlFor="menu_category" className="form-label">หมวดหมู่</label>
                                                    <input type="text" name="menu_category" value={editingMenuData.menu_category || ''} onChange={handleEditingMenuChange} className="input-field" placeholder="เช่น เนื้อ, ของทานเล่น" />
                                                </div>
                                            </div>
                                            <div>
                                                <label htmlFor="menu_description" className="form-label">คำอธิบาย (ไม่บังคับ)</label>
                                                <textarea name="menu_description" value={editingMenuData.menu_description || ''} onChange={handleEditingMenuChange} className="input-field" rows={2} />
                                            </div>
                                            <div>
                                                <label className="form-label">รูปภาพเมนู</label>
                                                <div className="menu-image-uploader">
                                                    <div className="menu-image-preview">
                                                        {editingMenuData.menu_image ? (
                                                            <img src={`data:image/png;base64,${editingMenuData.menu_image}`} alt="Menu Preview" />
                                                        ) : (
                                                            <div className="qr-placeholder small"><span>ไม่มีรูปภาพ</span></div>
                                                        )}
                                                    </div>
                                                    <div className="qr-code-upload">
                                                        <label htmlFor="menu-image-edit-upload" className="btn-secondary">เลือกไฟล์</label>
                                                        <input id="menu-image-edit-upload" type="file" accept="image/png, image/jpeg, image/webp" onChange={(e) => handleMenuImageChange(e, 'edit')} />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex justify-end gap-2">
                                                <button type="button" onClick={handleCancelMenuEdit} className="btn-secondary">ยกเลิก</button>
                                                <button type="submit" className="btn-success">บันทึกการแก้ไข</button>
                                            </div>
                                        </form>
                                    </>
                                ) : (
                                    /* --- Add Menu Form --- */
                                    <>
                                        <h3 className="text-xl font-semibold mb-4">เพิ่มเมนูใหม่</h3>
                                        <form onSubmit={handleAddMenu} className="menu-form space-y-4">
                                            <div>
                                                <label htmlFor="menu_name" className="form-label">ชื่อเมนู</label>
                                                <input type="text" name="menu_name" value={newMenu.menu_name} onChange={handleNewMenuChange} className="input-field" placeholder="เช่น หมูสามชั้น" required />
                                            </div>
                                            <div className="form-grid">
                                                <div>
                                                    <label htmlFor="price" className="form-label">ราคา (บาท)</label>
                                                    <input type="number" name="price" value={newMenu.price} onChange={handleNewMenuChange} className="input-field" placeholder="เช่น 59" required />
                                                </div>
                                                <div>
                                                    <label htmlFor="menu_category" className="form-label">หมวดหมู่</label>
                                                    <input type="text" name="menu_category" value={newMenu.menu_category} onChange={handleNewMenuChange} className="input-field" placeholder="เช่น เนื้อ, ของทานเล่น" />
                                                </div>
                                            </div>
                                            <div>
                                                <label htmlFor="menu_description" className="form-label">คำอธิบาย (ไม่บังคับ)</label>
                                                <textarea name="menu_description" value={newMenu.menu_description} onChange={handleNewMenuChange} className="input-field" rows={2} placeholder="เช่น หมักซอสสูตรพิเศษ" />
                                            </div>
                                            <div>
                                                <label className="form-label">รูปภาพเมนู (ไม่บังคับ)</label>
                                                <div className="menu-image-uploader">
                                                    <div className="menu-image-preview">
                                                        {newMenu.menu_image ? (
                                                            <img src={`data:image/png;base64,${newMenu.menu_image}`} alt="Menu Preview" />
                                                        ) : (
                                                            <div className="qr-placeholder small"><span>ไม่มีรูปภาพ</span></div>
                                                        )}
                                                    </div>
                                                    <div className="qr-code-upload">
                                                        <label htmlFor="menu-image-new-upload" className="btn-secondary">เลือกไฟล์</label>
                                                        <input id="menu-image-new-upload" type="file" accept="image/png, image/jpeg, image/webp" onChange={(e) => handleMenuImageChange(e, 'new')} />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex justify-end">
                                                <button type="submit" className="btn-primary">เพิ่มเมนู</button>
                                            </div>
                                        </form>
                                    </>
                                )}
                                <hr className="my-6" />
                                <h3 className="text-xl font-semibold mb-4">รายการเมนูทั้งหมด ({menuItems.length})</h3>
                                <ul className="space-y-3">
                                    {menuItems.map(menu => (
                                        <li key={menu.menu_id} className="flex justify-between items-center bg-gray-50 p-3 rounded-md">
                                            <div className="flex items-center gap-4">
                                                <img 
                                                    src={menu.menu_image ? `data:image/png;base64,${menu.menu_image}` : 'https://via.placeholder.com/50'} 
                                                    alt={menu.menu_name} 
                                                    className="menu-list-thumbnail"
                                                />
                                                <div>
                                                    <span className="font-bold text-lg">{menu.menu_name}</span>
                                                    <span className="text-gray-600 ml-4">({menu.price} บาท)</span>
                                                    {menu.menu_category && <span className="ml-2 text-xs font-semibold px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">{menu.menu_category}</span>}
                                                    {menu.menu_description && <p className="text-sm text-gray-500 mt-1">{menu.menu_description}</p>}
                                                </div>
                                            </div>
                                            <div className="flex gap-2 flex-shrink-0">
                                                <button onClick={() => handleEditMenuClick(menu)} className="btn-secondary">แก้ไข</button>
                                                <button onClick={() => handleDeleteMenu(menu.menu_id)} className="btn-danger">ลบ</button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Accordion: Promotion Management */}
                    <div className="accordion-item">
                        <button onClick={() => toggleAccordion('plans')} className="accordion-header">
                            <span>จัดการโปรโมชัน/ราคา</span>
                            <span className={`accordion-arrow ${accordionState.plans ? 'open' : ''}`}>▼</span>
                        </button>
                        <div className={`accordion-content ${accordionState.plans ? 'open' : ''}`}>
                            <div className="p-6">
                                <h3 className="text-xl font-semibold mb-4">เพิ่มโปรโมชันใหม่</h3>
                                <form onSubmit={handleAddPlan} className="space-y-4">
                                    <div>
                                        <label htmlFor="plan_name" className="block text-sm font-medium text-gray-700">ชื่อโปรโมชัน</label>
                                        <input type="text" name="plan_name" value={newPlan.plan_name} onChange={handleNewPlanChange} className="input-field mt-1" placeholder="เช่น Standard Buffet" required />
                                    </div>
                                    <div>
                                        <label htmlFor="price_per_person" className="block text-sm font-medium text-gray-700">ราคาต่อคน (บาท)</label>
                                        <input type="number" name="price_per_person" value={newPlan.price_per_person} onChange={handleNewPlanChange} className="input-field mt-1" placeholder="เช่น 299" required />
                                    </div>
                                    <div>
                                        <label htmlFor="description" className="block text-sm font-medium text-gray-700">คำอธิบาย (ไม่บังคับ)</label>
                                        <textarea name="description" value={newPlan.description} onChange={handleNewPlanChange} className="input-field mt-1" rows={2} placeholder="เช่น พิเศษ! เพิ่มเมนูเนื้อพรีเมียม" />
                                    </div>

                                    <div className="flex justify-end">
                                        <button type="submit" className="btn-primary">เพิ่มโปรโมชัน</button>
                                    </div>
                                </form>
                                <hr className="my-6" />
                                <h3 className="text-xl font-semibold mb-4">โปรโมชันที่มีอยู่ ({plans.length})</h3>
                                <ul className="space-y-3">
                                    {plans.map(plan => (
                                        <li key={plan.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-md">
                                            <div>
                                                <span className="font-bold text-lg">{plan.plan_name}</span>
                                                <span className="text-gray-600 ml-4">({plan.price_per_person} บาท/คน)</span>
                                                {plan.description && <p className="text-sm text-gray-500 mt-1">{plan.description}</p>}
                                            </div>
                                            <button onClick={() => handleDeletePlan(plan.id)} className="btn-danger">ลบ</button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>

                </div>
            ) : (
                <div className="text-center p-10 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 rounded-lg">
                    <p className="text-xl font-semibold">ขออภัย!</p>
                    <p>คุณไม่มีสิทธิ์ในการเข้าถึงหน้านี้</p>
                </div>
            )}
        </div>
    );
}

export default Setting;
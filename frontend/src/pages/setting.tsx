import React, { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import DatePicker from 'react-datepicker'; 
import "react-datepicker/dist/react-datepicker.css"; 
import { format, parseISO } from 'date-fns'; 
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
    description: string | null; 
}

interface MenuData {
    menu_id: number;
    menu_name: string;
    menu_description: string | null;
    menu_category: string | null;
    price: number;
    menu_quantity: number | null; 
    menu_image: string | null;
}

interface PromotionData {
    promotion_id: number;
    name: string;
    description: string | null;
    type: 'percentage' | 'fixed_amount' | 'special';
    value: number;
    code: string | null;
    start_date: string; 
    end_date: string;   
    is_active: number; 
    conditions: string | null;
    created_at?: string; 
}

interface EditingMenuState {
  menu_name: string;
  menu_description: string | null;
  menu_category: string | null;
  price: string; 
  menu_quantity: string | null; 
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
        menu_quantity: null as number | null | string, 
        menu_image: null as string | null
    });
    const [editingMenuId, setEditingMenuId] = useState<number | null>(null);
    const [editingMenuData, setEditingMenuData] = useState<EditingMenuState>({
        menu_name: '',
        menu_description: '', 
        menu_category: '',   
        price: '',           
        menu_quantity: null, 
        menu_image: null
    });

    // Promotion States
    const [promotions, setPromotions] = useState<PromotionData[]>([]);
    const [newPromotion, setNewPromotion] = useState({
        name: '',
        description: '',
        type: 'percentage' as PromotionData['type'], 
        value: '', 
        code: '',
        start_date: new Date(), 
        end_date: new Date(),   
        conditions: ''
    });
    const [editingPromotionId, setEditingPromotionId] = useState<number | null>(null);
    const [editingPromotionData, setEditingPromotionData] = useState({
        name: '',
        description: '',
        type: 'percentage' as PromotionData['type'],
        value: '', 
        code: '',
        start_date: new Date(), 
        end_date: new Date(),   
        conditions: ''
    });

    const [loading, setLoading] = useState(true);
    const [accordionState, setAccordionState] = useState({
        shop: true, tables: false, plans: false, menu: false, promotions: false
    });

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

    // --- Data Fetching ---
    useEffect(() => {
        const fetchAllData = async () => {
            setLoading(true);
            try {
                const [shopRes, tablesRes, plansRes, menuRes, promotionsRes] = await Promise.all([
                    axios.get<ShopData>(`${apiUrl}/api/shop`),
                    axios.get<TableData[]>(`${apiUrl}/api/tables`),
                    axios.get<PlanData[]>(`${apiUrl}/api/plans`),
                    axios.get<MenuData[]>(`${apiUrl}/api/menu`),
                    axios.get<PromotionData[]>(`${apiUrl}/api/promotions`)
                ]);
                setShopData({
                    ...shopRes.data,
                    open_time: shopRes.data.open_time?.substring(0, 5) || '',
                    close_time: shopRes.data.close_time?.substring(0, 5) || ''
                });
                setTables(tablesRes.data.sort((a,b) => a.table_number - b.table_number)); 
                setPlans(plansRes.data);
                setMenuItems(menuRes.data);
                setPromotions(promotionsRes.data); 

            } catch (error) {
                console.error("Error fetching data:", error);
                Swal.fire('ผิดพลาด!', 'ไม่สามารถโหลดข้อมูลการตั้งค่าได้', 'error');
            } finally {
                setLoading(false);
            }
        };
        
        if (role === 'Admin') {
            fetchAllData();
        } else {
            setLoading(false); 
        }
    }, [apiUrl, role]); 

    // --- Handlers ---
    const toggleAccordion = (section: 'shop' | 'tables' | 'plans' | 'menu' | 'promotions') => {
        setAccordionState(prevState => ({
            shop: section === 'shop' ? !prevState.shop : false,
            tables: section === 'tables' ? !prevState.tables : false,
            plans: section === 'plans' ? !prevState.plans : false,
            menu: section === 'menu' ? !prevState.menu : false,
            promotions: section === 'promotions' ? !prevState.promotions : false,
        }));
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
            await axios.post(`${apiUrl}/api/tables`, newTable); 
            const tablesRes = await axios.get<TableData[]>(`${apiUrl}/api/tables`);
            setTables(tablesRes.data.sort((a,b) => a.table_number - b.table_number));
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
                Swal.fire('ผิดพลาด!', error.response?.data?.error || 'ไม่สามารถลบโต๊ะได้ (อาจมีออเดอร์ที่ใช้งานอยู่)', 'error');
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
            const updatedData = {
                table_number: editingTableData.table_number,
                seat_capacity: editingTableData.seat_capacity,
                status: tableToUpdate.status 
            };
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
    const handleNewPlanChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setNewPlan(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleAddPlan = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!newPlan.plan_name || !newPlan.price_per_person) return Swal.fire('ข้อมูลไม่ครบ', 'กรุณากรอกชื่อและราคาแพ็กเกจ', 'warning');
        try {
            const response = await axios.post<PlanData>(`${apiUrl}/api/plans`, newPlan);
            setPlans([...plans, response.data]);
            setNewPlan({ plan_name: '', price_per_person: '', description: '' });
            Swal.fire('สำเร็จ!', 'เพิ่มแพ็กเกจราคาเรียบร้อย', 'success');
        } catch (error: any) {
            Swal.fire('ผิดพลาด!', error.response?.data?.error || 'ไม่สามารถเพิ่มแพ็กเกจราคาได้', 'error');
        }
    };
    const handleDeletePlan = async (planId: number) => {
        const result = await Swal.fire({
            title: 'แน่ใจหรือไม่?', text: "คุณต้องการลบแพ็กเกจนี้ใช่หรือไม่?", icon: 'warning',
            showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#6b7280',
            confirmButtonText: 'ใช่, ลบเลย!', cancelButtonText: 'ยกเลิก'
        });
        if (result.isConfirmed) {
            try {
                await axios.delete(`${apiUrl}/api/plans/${planId}`);
                setPlans(plans.filter(p => p.id !== planId));
                Swal.fire('ลบแล้ว!', 'แพ็กเกจราคาถูกลบเรียบร้อย', 'success');
            } catch (error: any) {
                Swal.fire('ผิดพลาด!', error.response?.data?.error || 'ไม่สามารถลบแพ็กเกจราคาได้ (อาจมีออเดอร์อ้างอิงอยู่)', 'error');
            }
        }
    };

    // --- Menu Handlers ---
    const handleNewMenuChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (name === 'menu_quantity') {
            setNewMenu(prev => ({ ...prev, [name]: value === '' ? null : value }));
        } else {
             setNewMenu(prev => ({ ...prev, [name]: value }));
        }
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
            const dataToSend = {
                ...newMenu,
                price: parseFloat(newMenu.price) || 0,
                menu_quantity: newMenu.menu_quantity === null || newMenu.menu_quantity === '' ? null : parseInt(String(newMenu.menu_quantity), 10) || 0,
            };
            await axios.post(`${apiUrl}/api/menu`, dataToSend);
            const menuRes = await axios.get<MenuData[]>(`${apiUrl}/api/menu`); 
            setMenuItems(menuRes.data);
            setNewMenu({ menu_name: '', menu_description: '', menu_category: '', price: '', menu_quantity: null, menu_image: null }); 
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
                Swal.fire('ผิดพลาด!', error.response?.data?.error || 'ไม่สามารถลบเมนูได้ (อาจมีออเดอร์อ้างอิงอยู่)', 'error');
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
            menu_quantity: menu.menu_quantity === null ? null : String(menu.menu_quantity),
            menu_image: menu.menu_image
        });
    };
    const handleCancelMenuEdit = () => setEditingMenuId(null);
    const handleEditingMenuChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
         const { name, value } = e.target;
        if (name === 'menu_quantity') {
            setEditingMenuData(prev => ({ ...prev, [name]: value === '' ? '' : value })); 
        } else {
             setEditingMenuData(prev => ({ ...prev, [name]: value }));
        }
    };
    const handleUpdateMenu = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!editingMenuId) return;
        try {
            const dataToSend = {
                ...editingMenuData,
                price: parseFloat(editingMenuData.price) || 0,
                menu_quantity: editingMenuData.menu_quantity === null || editingMenuData.menu_quantity === '' ? null : parseInt(String(editingMenuData.menu_quantity), 10) || 0,
            };
            await axios.put(`${apiUrl}/api/menu/${editingMenuId}`, dataToSend);
            const menuRes = await axios.get<MenuData[]>(`${apiUrl}/api/menu`); 
            setMenuItems(menuRes.data);
            setEditingMenuId(null); 
            Swal.fire('สำเร็จ!', 'อัปเดตข้อมูลเมนูเรียบร้อย', 'success');
        } catch (error: any) {
            Swal.fire('ผิดพลาด!', error.response?.data?.error || 'ไม่สามารถอัปเดตข้อมูลเมนูได้', 'error');
        }
    };


    // --- Promotion Handlers ---
    const handleNewPromotionChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setNewPromotion(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleNewPromotionDateChange = (date: Date | null, field: 'start_date' | 'end_date') => {
        setNewPromotion(prev => ({ ...prev, [field]: date || new Date() })); 
    };

    const handleAddPromotion = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const { name, type, value, start_date, end_date } = newPromotion;
        if (!name || !type || !value || !start_date || !end_date) {
            return Swal.fire('ข้อมูลไม่ครบ', 'กรุณากรอกข้อมูลโปรโมชั่นที่จำเป็น (ชื่อ, ประเภท, ค่า, วันเริ่ม, วันสิ้นสุด)', 'warning');
        }
        try {
            const dataToSend = {
                ...newPromotion,
                start_date: format(start_date, 'yyyy-MM-dd HH:mm:ss'), 
                end_date: format(end_date, 'yyyy-MM-dd HH:mm:ss'),
                value: parseFloat(value) || 0 
            };
            await axios.post(`${apiUrl}/api/promotions`, dataToSend);
            const promoRes = await axios.get<PromotionData[]>(`${apiUrl}/api/promotions`);
            setPromotions(promoRes.data);
            setNewPromotion({
                name: '', description: '', type: 'percentage', value: '', code: '',
                start_date: new Date(), end_date: new Date(), conditions: ''
            });
            Swal.fire('สำเร็จ!', 'เพิ่มโปรโมชั่นเรียบร้อย', 'success');
        } catch (error: any) {
            Swal.fire('ผิดพลาด!', error.response?.data?.error || 'ไม่สามารถเพิ่มโปรโมชั่นได้', 'error');
        }
    };

    const handleDeletePromotion = async (promotionId: number) => {
        const result = await Swal.fire({
            title: 'แน่ใจหรือไม่?', text: "คุณต้องการลบโปรโมชั่นนี้ใช่หรือไม่?", icon: 'warning',
            showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#6b7280',
            confirmButtonText: 'ใช่, ลบเลย!', cancelButtonText: 'ยกเลิก'
        });
        if (result.isConfirmed) {
            try {
                await axios.delete(`${apiUrl}/api/promotions/${promotionId}`);
                setPromotions(promotions.filter(p => p.promotion_id !== promotionId)); 
                Swal.fire('ลบแล้ว!', 'โปรโมชั่นถูกลบเรียบร้อย', 'success');
            } catch (error: any) {
                Swal.fire('ผิดพลาด!', error.response?.data?.error || 'ไม่สามารถลบโปรโมชั่นได้', 'error');
            }
        }
    };

    const handleTogglePromotionStatus = async (promotionId: number) => {
        try {
            await axios.put(`${apiUrl}/api/promotions/${promotionId}/toggle`);
            setPromotions(promotions.map(p =>
                p.promotion_id === promotionId ? { ...p, is_active: p.is_active === 1 ? 0 : 1 } : p
            ));
        } catch (error: any) {
            Swal.fire('ผิดพลาด!', error.response?.data?.error || 'ไม่สามารถเปลี่ยนสถานะโปรโมชั่นได้', 'error');
        }
    };

    const handleEditPromotionClick = (promo: PromotionData) => {
        setEditingPromotionId(promo.promotion_id);
        setEditingPromotionData({
            name: promo.name,
            description: promo.description || '',
            type: promo.type,
            value: promo.value.toString(), 
            code: promo.code || '',
            start_date: promo.start_date ? parseISO(promo.start_date) : new Date(),
            end_date: promo.end_date ? parseISO(promo.end_date) : new Date(),
            conditions: promo.conditions || ''
        });
    };

    const handleCancelPromotionEdit = () => setEditingPromotionId(null);

    const handleEditingPromotionChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setEditingPromotionData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

     const handleEditingPromotionDateChange = (date: Date | null, field: 'start_date' | 'end_date') => {
        setEditingPromotionData(prev => ({ ...prev, [field]: date || new Date() }));
    };

    const handleUpdatePromotion = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!editingPromotionId) return;
        const { name, type, value, start_date, end_date } = editingPromotionData;
        if (!name || !type || !value || !start_date || !end_date) {
            return Swal.fire('ข้อมูลไม่ครบ', 'กรุณากรอกข้อมูลโปรโมชั่นที่จำเป็นให้ครบถ้วน', 'warning');
        }
         try {
            const dataToSend = {
                ...editingPromotionData,
                start_date: format(start_date, 'yyyy-MM-dd HH:mm:ss'),
                end_date: format(end_date, 'yyyy-MM-dd HH:mm:ss'),
                value: parseFloat(value) || 0
            };
            await axios.put(`${apiUrl}/api/promotions/${editingPromotionId}`, dataToSend);
            const promoRes = await axios.get<PromotionData[]>(`${apiUrl}/api/promotions`);
            setPromotions(promoRes.data);
            setEditingPromotionId(null); 
            Swal.fire('สำเร็จ!', 'อัปเดตโปรโมชั่นเรียบร้อย', 'success');
        } catch (error: any) {
            Swal.fire('ผิดพลาด!', error.response?.data?.error || 'ไม่สามารถอัปเดตโปรโมชั่นได้', 'error');
        }
    };


    // --- Render ---
    if (loading) {
        return <div className="p-8 text-center">กำลังโหลดข้อมูล...</div>;
    }

    if (role !== 'Admin') {
         return (
             <div className="p-8 text-center text-red-600 bg-red-100 border border-red-400 rounded-md">
                 คุณไม่มีสิทธิ์เข้าถึงหน้านี้
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-8 space-y-6"> 
            <h1 className="text-3xl sm:text-4xl font-bold mb-8 text-gray-800">ตั้งค่าทั่วไป</h1> 
            <div className="space-y-4 max-w-4xl mx-auto"> 

                {/* Accordion: Shop Management */}
                <div className="accordion-item border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                    <button onClick={() => toggleAccordion('shop')} className="accordion-header">
                        <span>จัดการข้อมูลร้านค้า</span>
                        <span className={`accordion-arrow ${accordionState.shop ? 'open' : ''}`}>▼</span>
                    </button>
                    <div className={`accordion-content ${accordionState.shop ? 'open' : ''}`}>
                         <form onSubmit={handleShopSubmit} className="p-6 space-y-4">
                             <div>
                                 <label className="block text-gray-700 text-sm font-bold mb-2 text-center">โลโก้ร้าน</label>
                                 <div className="logo-section">
                                     <label htmlFor="logo-upload" className="logo-preview">
                                         {shopData.shop_logo ? (
                                             <img src={`data:image/png;base64,${shopData.shop_logo}`} alt="Shop Logo" />
                                         ) : (
                                             <div className="logo-placeholder"><span>คลิกเพื่อ<br/>อัปโหลดโลโก้</span></div>
                                         )}
                                     </label>
                                     <div className="logo-upload-text"><p className="text-xs text-gray-500">แนะนำ .png หรือ .jpg</p></div>
                                     <input id="logo-upload" type="file" accept="image/png, image/jpeg, image/webp" onChange={handleLogoChange} style={{ display: 'none' }}/>
                                 </div>
                             </div>
                            <div>
                                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="shop_name">ชื่อร้าน</label>
                                <input type="text" name="shop_name" value={shopData.shop_name} onChange={handleShopChange} className="input-field" />
                            </div>
                            <div>
                                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="shop_address">ที่อยู่</label>
                                <textarea name="shop_address" value={shopData.shop_address} onChange={handleShopChange} className="input-field" rows={3}/>
                            </div>
                            <div>
                                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="shop_phone">เบอร์ติดต่อ</label>
                                <input type="text" name="shop_phone" value={shopData.shop_phone} onChange={handleShopChange} className="input-field" />
                            </div>
                            <div className="flex flex-col sm:flex-row gap-4">
                                <div className="w-full sm:w-1/2">
                                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="open_time">เวลาเปิด</label>
                                    <input type="time" name="open_time" value={shopData.open_time} onChange={handleShopChange} className="input-field" />
                                </div>
                                <div className="w-full sm:w-1/2">
                                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="close_time">เวลาปิด</label>
                                    <input type="time" name="close_time" value={shopData.close_time} onChange={handleShopChange} className="input-field" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-gray-700 text-sm font-bold mb-2">QR Code ชำระเงิน</label>
                                <div className="qr-code-section">
                                    <div className="qr-code-preview">
                                        {shopData.payment_qr_code ? (
                                            <img src={`data:image/png;base64,${shopData.payment_qr_code}`} alt="Payment QR Code" />
                                        ) : (
                                            <div className="qr-placeholder"><span>ไม่มีรูปภาพ</span></div>
                                        )}
                                    </div>
                                    <div className="qr-code-upload">
                                        <label htmlFor="qr-upload" className="btn-secondary">เลือกไฟล์ใหม่</label>
                                        <input id="qr-upload" type="file" accept="image/png, image/jpeg, image/webp" onChange={handleQrCodeChange} />
                                        <p className="text-xs text-gray-500 mt-2">แนะนำ .png หรือ .jpg</p>
                                    </div>
                                </div>
                            </div>
                            {/* ✅ FIX: เปลี่ยน justify-end เป็น justify-center */}
                            <div className="flex justify-center pt-4">
                                <button type="submit" className="btn-primary">บันทึกข้อมูลร้านค้า</button>
                            </div>
                        </form>
                    </div>
                 </div>

                {/* Accordion: Table Management */}
                 <div className="accordion-item border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                    <button onClick={() => toggleAccordion('tables')} className="accordion-header">
                        <span>จัดการโต๊ะ</span>
                        <span className={`accordion-arrow ${accordionState.tables ? 'open' : ''}`}>▼</span>
                    </button>
                     <div className={`accordion-content ${accordionState.tables ? 'open' : ''}`}>
                         <div className="p-6">
                            <h3 className="text-xl font-semibold mb-4 text-green-700">เพิ่มโต๊ะใหม่</h3>
                            <form onSubmit={handleAddTable} className="flex flex-col sm:flex-row items-end gap-4 mb-6">
                                <div className="w-full sm:w-auto">
                                    <label htmlFor="table_number" className="block text-sm font-medium text-gray-700">หมายเลขโต๊ะ</label>
                                    <input type="number" name="table_number" value={newTable.table_number} onChange={handleNewTableChange} className="input-field mt-1 w-full" placeholder="เช่น 1, 2..." required/>
                                </div>
                                <div className="w-full sm:w-auto">
                                    <label htmlFor="seat_capacity" className="block text-sm font-medium text-gray-700">จำนวนที่นั่ง</label>
                                    <input type="number" name="seat_capacity" value={newTable.seat_capacity} onChange={handleNewTableChange} className="input-field mt-1 w-full" placeholder="เช่น 4" required/>
                                </div>
                                <button type="submit" className="btn-primary w-full sm:w-auto">เพิ่มโต๊ะ</button>
                            </form>
                            <hr className="my-6 border-t border-gray-300" />
                            <h3 className="text-xl font-semibold mb-4 text-green-700">โต๊ะที่มีอยู่ ({tables.length})</h3>
                            <ul className="space-y-3">
                                {tables.map(table => (
                                    <li key={table.table_id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-50 p-3 rounded-md shadow-sm gap-2">
                                        {editingTableId === table.table_id ? (
                                            <>
                                                <div className='flex items-center gap-2 flex-wrap'>
                                                    <span>โต๊ะ</span>
                                                    <input type="number" name="table_number" value={editingTableData.table_number} onChange={handleEditingTableChange} className="input-field-sm w-20" required/>
                                                    <span>(</span>
                                                    <input type="number" name="seat_capacity" value={editingTableData.seat_capacity} onChange={handleEditingTableChange} className="input-field-sm w-16" required/>
                                                    <span>ที่นั่ง)</span>
                                                </div>
                                                <div className="flex gap-2 flex-shrink-0 mt-2 sm:mt-0">
                                                    <button onClick={() => handleUpdateTable(table)} className="btn-success btn-sm">บันทึก</button>
                                                    <button onClick={handleCancelEdit} className="btn-secondary btn-sm">ยกเลิก</button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div>
                                                    <span className="font-bold text-lg text-gray-800">โต๊ะ {table.table_number}</span>
                                                    <span className="text-gray-600 ml-3">({table.seat_capacity} ที่นั่ง)</span>
                                                     <span className={`ml-3 text-xs font-semibold px-2 py-0.5 rounded-full ${table.status === 'ว่าง' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{table.status}</span>
                                                </div>
                                                <div className="flex gap-2 flex-shrink-0 mt-2 sm:mt-0">
                                                    <button onClick={() => handleEditClick(table)} className="btn-secondary btn-sm">แก้ไข</button>
                                                    <button onClick={() => handleDeleteTable(table.table_id)} className="btn-danger btn-sm" disabled={table.status === 'ไม่ว่าง'} title={table.status === 'ไม่ว่าง' ? 'ไม่สามารถลบโต๊ะที่ไม่ว่างได้' : ''}>ลบ</button>
                                                </div>
                                            </>
                                        )}
                                    </li>
                                ))}
                                {tables.length === 0 && <p className="text-center text-gray-500 py-4">ยังไม่มีโต๊ะ</p>}
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Accordion: Menu Management */}
                <div className="accordion-item border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                    <button onClick={() => toggleAccordion('menu')} className="accordion-header">
                        <span>จัดการเมนูอาหาร</span>
                        <span className={`accordion-arrow ${accordionState.menu ? 'open' : ''}`}>▼</span>
                    </button>
                    <div className={`accordion-content ${accordionState.menu ? 'open' : ''}`}>
                         <div className="p-6">
                            {editingMenuId ? (
                                <>
                                    <h3 className="text-xl font-semibold mb-4 text-purple-700">แก้ไขเมนู</h3>
                                    <form onSubmit={handleUpdateMenu} className="menu-form space-y-4">
                                        <div>
                                            <label htmlFor="edit_menu_name" className="form-label">ชื่อเมนู</label>
                                            <input type="text" id="edit_menu_name" name="menu_name" value={editingMenuData.menu_name || ''} onChange={handleEditingMenuChange} className="input-field" required />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label htmlFor="edit_price" className="form-label">ราคา (บาท)</label>
                                                <input type="number" id="edit_price" name="price" value={editingMenuData.price} onChange={handleEditingMenuChange} className="input-field" required min="0" step="any" />
                                            </div>
                                            <div>
                                                <label htmlFor="edit_menu_category" className="form-label">หมวดหมู่</label>
                                                <input type="text" id="edit_menu_category" name="menu_category" value={editingMenuData.menu_category || ''} onChange={handleEditingMenuChange} className="input-field" placeholder="เช่น เนื้อ, ของทานเล่น" />
                                            </div>
                                             <div>
                                                <label htmlFor="edit_menu_quantity" className="form-label">จำนวนสต็อก (ไม่บังคับ)</label>
                                                <input type="number" id="edit_menu_quantity" name="menu_quantity" value={editingMenuData.menu_quantity ?? ''} onChange={handleEditingMenuChange} className="input-field" placeholder="ปล่อยว่าง ถ้าไม่นับสต็อก" min="0"/>
                                                <p className="text-xs text-gray-500 mt-1">ใส่จำนวนถ้าต้องการนับสต็อก</p>
                                            </div>
                                        </div>
                                        <div>
                                            <label htmlFor="edit_menu_description" className="form-label">คำอธิบาย</label>
                                            <textarea id="edit_menu_description" name="menu_description" value={editingMenuData.menu_description || ''} onChange={handleEditingMenuChange} className="input-field" rows={2} />
                                        </div>
                                        <div>
                                            <label className="form-label">รูปภาพเมนู</label>
                                            <div className="menu-image-uploader">
                                                <div className="menu-image-preview">
                                                    {editingMenuData.menu_image ? (
                                                        <img src={`data:image/png;base64,${editingMenuData.menu_image}`} alt="Menu Preview" />
                                                    ) : (
                                                        <div className="qr-placeholder small"><span>ไม่มีรูป</span></div>
                                                    )}
                                                </div>
                                                <div className="qr-code-upload">
                                                    <label htmlFor="menu-image-edit-upload" className="btn-secondary">เลือกไฟล์</label>
                                                    <input id="menu-image-edit-upload" type="file" accept="image/png, image/jpeg, image/webp" onChange={(e) => handleMenuImageChange(e, 'edit')} />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-2 pt-4">
                                            <button type="button" onClick={handleCancelMenuEdit} className="btn-secondary">ยกเลิก</button>
                                            <button type="submit" className="btn-success">บันทึกการแก้ไข</button>
                                        </div>
                                    </form>
                                </>
                            ) : (
                                <>
                                    <h3 className="text-xl font-semibold mb-4 text-purple-700">เพิ่มเมนูใหม่</h3>
                                    <form onSubmit={handleAddMenu} className="menu-form space-y-4">
                                        <div>
                                            <label htmlFor="menu_name" className="form-label">ชื่อเมนู</label>
                                            <input type="text" id="menu_name" name="menu_name" value={newMenu.menu_name} onChange={handleNewMenuChange} className="input-field" placeholder="เช่น หมูสามชั้น" required />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label htmlFor="price" className="form-label">ราคา (บาท)</label>
                                                <input type="number" id="price" name="price" value={newMenu.price} onChange={handleNewMenuChange} className="input-field" placeholder="เช่น 59 หรือ 0" required min="0" step="any"/>
                                            </div>
                                            <div>
                                                <label htmlFor="menu_category" className="form-label">หมวดหมู่</label>
                                                <input type="text" id="menu_category" name="menu_category" value={newMenu.menu_category} onChange={handleNewMenuChange} className="input-field" placeholder="เช่น เนื้อ, ของทานเล่น" />
                                            </div>
                                             <div>
                                                <label htmlFor="menu_quantity" className="form-label">จำนวนสต็อก (ไม่บังคับ)</label>
                                                <input type="number" id="menu_quantity" name="menu_quantity" value={newMenu.menu_quantity ?? ''} onChange={handleNewMenuChange} className="input-field" placeholder="ปล่อยว่าง ถ้าไม่นับสต็อก" min="0" />
                                                 <p className="text-xs text-gray-500 mt-1">ใส่จำนวนถ้าต้องการนับสต็อก</p>
                                            </div>
                                        </div>
                                        <div>
                                            <label htmlFor="menu_description" className="form-label">คำอธิบาย</label>
                                            <textarea id="menu_description" name="menu_description" value={newMenu.menu_description} onChange={handleNewMenuChange} className="input-field" rows={2} placeholder="เช่น หมักซอสสูตรพิเศษ" />
                                        </div>
                                        <div>
                                            <label className="form-label">รูปภาพเมนู</label>
                                            <div className="menu-image-uploader">
                                                <div className="menu-image-preview">
                                                    {newMenu.menu_image ? (
                                                        <img src={`data:image/png;base64,${newMenu.menu_image}`} alt="Menu Preview" />
                                                    ) : (
                                                        <div className="qr-placeholder small"><span>ไม่มีรูป</span></div>
                                                    )}
                                                </div>
                                                <div className="qr-code-upload">
                                                    <label htmlFor="menu-image-new-upload" className="btn-secondary">เลือกไฟล์</label>
                                                    <input id="menu-image-new-upload" type="file" accept="image/png, image/jpeg, image/webp" onChange={(e) => handleMenuImageChange(e, 'new')} />
                                                </div>
                                            </div>
                                        </div>
                                        {/* ✅ FIX: เปลี่ยน justify-end เป็น justify-center */}
                                        <div className="flex justify-center pt-4">
                                            <button type="submit" className="btn-primary">เพิ่มเมนู</button>
                                        </div>
                                    </form>
                                </>
                            )}
                            <hr className="my-8 border-t border-gray-300" />
                            <h3 className="text-xl font-semibold mb-4 text-purple-700">รายการเมนูทั้งหมด ({menuItems.length})</h3>
                            <ul className="space-y-3">
                                {menuItems.map(menu => (
                                    <li key={menu.menu_id} className="flex flex-col sm:flex-row justify-between items-center bg-gray-50 p-3 rounded-md shadow-sm gap-2">
                                        <div className="flex items-center gap-4 w-full">
                                            <img
                                                src={menu.menu_image ? `data:image/png;base64,${menu.menu_image}` : 'https://via.placeholder.com/50'}
                                                alt={menu.menu_name}
                                                className="menu-list-thumbnail"
                                            />
                                            {/* ✅ FIX: จัด layout ของ text ให้สวยงามขึ้น */}
                                            <div className="flex-grow">
                                                <span className="font-bold text-lg text-gray-800">{menu.menu_name}</span>
                                                <span className="text-gray-600 ml-2 sm:ml-3">({menu.price} บาท)</span>
                                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                                    {menu.menu_category && <span className="text-xs font-semibold px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">{menu.menu_category}</span>}
                                                    {menu.menu_quantity !== null && <span className="text-xs font-semibold px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full">สต็อก: {menu.menu_quantity}</span>}
                                                </div>
                                                {menu.menu_description && <p className="text-sm text-gray-500 mt-1">{menu.menu_description}</p>}
                                            </div>
                                        </div>
                                        {/* ✅ FIX: เปลี่ยน self-end เป็น self-center (สำหรับ mobile) */}
                                        <div className="flex gap-2 flex-shrink-0 mt-2 sm:mt-0 self-center">
                                            <button onClick={() => handleEditMenuClick(menu)} className="btn-secondary btn-sm">แก้ไข</button>
                                            <button onClick={() => handleDeleteMenu(menu.menu_id)} className="btn-danger btn-sm">ลบ</button>
                                        </div>
                                    </li>
                                ))}
                                 {menuItems.length === 0 && <p className="text-center text-gray-500 py-4">ยังไม่มีเมนู</p>}
                            </ul>
                        </div>
                    </div>
                 </div>

                {/* Accordion: Pricing Plan Management */}
                 <div className="accordion-item border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                    <button onClick={() => toggleAccordion('plans')} className="accordion-header">
                        <span>จัดการแพ็กเกจราคา (บุฟเฟต์)</span>
                        <span className={`accordion-arrow ${accordionState.plans ? 'open' : ''}`}>▼</span>
                    </button>
                    <div className={`accordion-content ${accordionState.plans ? 'open' : ''}`}>
                        <div className="p-6">
                            <h3 className="text-xl font-semibold mb-4 text-indigo-700">เพิ่มแพ็กเกจราคาใหม่</h3>
                            <form onSubmit={handleAddPlan} className="space-y-4 mb-6">
                                <div>
                                    <label htmlFor="plan_name" className="block text-sm font-medium text-gray-700">ชื่อแพ็กเกจ</label>
                                    <input type="text" name="plan_name" value={newPlan.plan_name} onChange={handleNewPlanChange} className="input-field mt-1" placeholder="เช่น Standard Buffet" required />
                                </div>
                                <div>
                                    <label htmlFor="price_per_person" className="block text-sm font-medium text-gray-700">ราคาต่อคน (บาท)</label>
                                    <input type="number" name="price_per_person" value={newPlan.price_per_person} onChange={handleNewPlanChange} className="input-field mt-1" placeholder="เช่น 299" required min="0" step="any"/>
                                </div>
                                <div>
                                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">คำอธิบาย (ไม่บังคับ)</label>
                                    <textarea name="description" value={newPlan.description} onChange={handleNewPlanChange} className="input-field mt-1" rows={2} placeholder="เช่น พิเศษ! เพิ่มเมนูเนื้อพรีเมียม" />
                                </div>
                                <div className="flex justify-center md:justify-end pt-2">
                                    <button type="submit" className="btn-primary w-full md:w-auto">เพิ่มแพ็กเกจ</button>
                                </div>
                            </form>
                             <hr className="my-6 border-t border-gray-300" />
                            <h3 className="text-xl font-semibold mb-4 text-indigo-700">แพ็กเกจที่มีอยู่ ({plans.length})</h3>
                            <ul className="space-y-3">
                                {plans.map(plan => (
                                    <li key={plan.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-50 p-3 rounded-md shadow-sm gap-2">
                                        <div>
                                            <span className="font-bold text-lg text-gray-800">{plan.plan_name}</span>
                                            <span className="text-gray-600 ml-3">({plan.price_per_person} บาท/คน)</span>
                                            {plan.description && <p className="text-sm text-gray-500 mt-1">{plan.description}</p>}
                                        </div>
                                        <button onClick={() => handleDeletePlan(plan.id)} className="btn-danger btn-sm mt-2 sm:mt-0 self-center md:self-auto">ลบ</button>
                                    </li>
                                ))}
                                {plans.length === 0 && <p className="text-center text-gray-500 py-4">ยังไม่มีแพ็กเกจราคา</p>}
                            </ul>
                        </div>
                    </div>
                 </div>


                {/* Accordion: Promotions */}
                <div className="accordion-item border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                    <button onClick={() => toggleAccordion('promotions')} className="accordion-header">
                        <span>จัดการโปรโมชั่น/ส่วนลด</span>
                        <span className={`accordion-arrow ${accordionState.promotions ? 'open' : ''}`}>▼</span>
                    </button>
                    <div className={`accordion-content ${accordionState.promotions ? 'open' : ''}`}>
                        <div className="p-6">
                             {editingPromotionId ? (
                                /* --- Edit Promotion Form --- */
                                <>
                                    <h3 className="text-xl font-semibold mb-4 text-blue-700">แก้ไขโปรโมชั่น</h3>
                                    <form onSubmit={handleUpdatePromotion} className="space-y-4 promotion-form">
                                        <div>
                                            <label htmlFor="edit_promo_name" className="form-label">ชื่อโปรโมชั่น</label>
                                            <input type="text" id="edit_promo_name" name="name" value={editingPromotionData.name} onChange={handleEditingPromotionChange} className="input-field" required />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label htmlFor="edit_promo_type" className="form-label">ประเภท</label>
                                                <select id="edit_promo_type" name="type" value={editingPromotionData.type} onChange={handleEditingPromotionChange} className="input-field" required>
                                                    <option value="percentage">เปอร์เซ็นต์ (%)</option>
                                                    <option value="fixed_amount">จำนวนเงิน (บาท)</option>
                                                    <option value="special">ข้อเสนอพิเศษ</option>
                                                </select>
                                            </div>
                                            <div className="md:col-span-2">
                                                <label htmlFor="edit_promo_value" className="form-label">ค่า</label>
                                                 <input type="number" id="edit_promo_value" name="value" value={editingPromotionData.value} onChange={handleEditingPromotionChange} className="input-field" required placeholder="เช่น 10 หรือ 100 หรือ 3 (สำหรับ มา 4 จ่าย 3)" min="0" step="any"/>
                                                 {editingPromotionData.type === 'special' && <p className="text-xs text-gray-500 mt-1">สำหรับ 'ข้อเสนอพิเศษ' เช่น ใส่ '3' สำหรับโปร 'มา 4 จ่าย 3'</p>}
                                             </div>
                                         </div>
                                        <div>
                                            <label htmlFor="edit_promo_code" className="form-label">รหัสคูปอง (ถ้ามี)</label>
                                            <input type="text" id="edit_promo_code" name="code" value={editingPromotionData.code} onChange={handleEditingPromotionChange} className="input-field" placeholder="เช่น SUMMERDEAL" />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                             <div>
                                                 <label htmlFor="edit_promo_start_date" className="form-label">วันที่เริ่ม</label>
                                                 <DatePicker
                                                    selected={editingPromotionData.start_date}
                                                    onChange={(date) => handleEditingPromotionDateChange(date, 'start_date')}
                                                    selectsStart
                                                    startDate={editingPromotionData.start_date}
                                                    endDate={editingPromotionData.end_date}
                                                    showTimeSelect
                                                    timeFormat="HH:mm"
                                                    timeIntervals={15}
                                                    dateFormat="dd/MM/yyyy HH:mm"
                                                    className="input-field w-full"
                                                    required
                                                />
                                             </div>
                                             <div>
                                                 <label htmlFor="edit_promo_end_date" className="form-label">วันที่สิ้นสุด</label>
                                                 <DatePicker
                                                    selected={editingPromotionData.end_date}
                                                    onChange={(date) => handleEditingPromotionDateChange(date, 'end_date')}
                                                    selectsEnd
                                                    startDate={editingPromotionData.start_date}
                                                    endDate={editingPromotionData.end_date}
                                                    minDate={editingPromotionData.start_date}
                                                    showTimeSelect
                                                    timeFormat="HH:mm"
                                                    timeIntervals={15}
                                                    dateFormat="dd/MM/yyyy HH:mm"
                                                    className="input-field w-full"
                                                    required
                                                />
                                             </div>
                                         </div>
                                        <div>
                                            <label htmlFor="edit_promo_description" className="form-label">คำอธิบาย</label>
                                            <textarea id="edit_promo_description" name="description" value={editingPromotionData.description} onChange={handleEditingPromotionChange} className="input-field" rows={2} />
                                        </div>
                                        <div>
                                            <label htmlFor="edit_promo_conditions" className="form-label">เงื่อนไขเพิ่มเติม</label>
                                            <textarea id="edit_promo_conditions" name="conditions" value={editingPromotionData.conditions} onChange={handleEditingPromotionChange} className="input-field" rows={2} placeholder="เช่น ใช้ได้เฉพาะวันจันทร์-ศุกร์, ยอดขั้นต่ำ 500 บาท" />
                                        </div>
                                        <div className="flex flex-col sm:flex-row justify-center sm:justify-end gap-2 pt-4">
                                            <button type="button" onClick={handleCancelPromotionEdit} className="btn-secondary w-full sm:w-auto">ยกเลิก</button>
                                            <button type="submit" className="btn-success w-full sm:w-auto">บันทึกการแก้ไข</button>
                                        </div>
                                    </form>
                                </>
                            ) : (
                                /* --- Add Promotion Form --- */
                                <>
                                    <h3 className="text-xl font-semibold mb-4 text-blue-700">เพิ่มโปรโมชั่นใหม่</h3>
                                    <form onSubmit={handleAddPromotion} className="space-y-4 promotion-form">
                                        <div>
                                            <label htmlFor="promo_name" className="form-label">ชื่อโปรโมชั่น</label>
                                            <input type="text" id="promo_name" name="name" value={newPromotion.name} onChange={handleNewPromotionChange} className="input-field" required placeholder="เช่น ส่วนลด 10% ฉลองเปิดร้าน" />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label htmlFor="promo_type" className="form-label">ประเภท</label>
                                                <select id="promo_type" name="type" value={newPromotion.type} onChange={handleNewPromotionChange} className="input-field" required>
                                                    <option value="percentage">เปอร์เซ็นต์ (%)</option>
                                                    <option value="fixed_amount">จำนวนเงิน (บาท)</option>
                                                    <option value="special">ข้อเสนอพิเศษ</option>
                                                </select>
                                            </div>
                                             <div className="md:col-span-2">
                                                <label htmlFor="promo_value" className="form-label">ค่า</label>
                                                <input type="number" id="promo_value" name="value" value={newPromotion.value} onChange={handleNewPromotionChange} className="input-field" required placeholder="เช่น 10 หรือ 100 หรือ 3 (สำหรับ มา 4 จ่าย 3)" min="0" step="any"/>
                                                 {newPromotion.type === 'special' && <p className="text-xs text-gray-500 mt-1">สำหรับ 'ข้อเสนอพิเศษ' เช่น ใส่ '3' สำหรับโปร 'มา 4 จ่าย 3'</p>}
                                             </div>
                                         </div>
                                        <div>
                                            <label htmlFor="promo_code" className="form-label">รหัสคูปอง (ถ้ามี)</label>
                                            <input type="text" id="promo_code" name="code" value={newPromotion.code} onChange={handleNewPromotionChange} className="input-field" placeholder="เช่น SUMMERDEAL" />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label htmlFor="promo_start_date" className="form-label">วันที่เริ่ม</label>
                                                <DatePicker
                                                    selected={newPromotion.start_date}
                                                    onChange={(date) => handleNewPromotionDateChange(date, 'start_date')}
                                                    selectsStart
                                                    startDate={newPromotion.start_date}
                                                    endDate={newPromotion.end_date}
                                                    showTimeSelect
                                                    timeFormat="HH:mm"
                                                    timeIntervals={15}
                                                    dateFormat="dd/MM/yyyy HH:mm"
                                                    className="input-field w-full"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                 <label htmlFor="promo_end_date" className="form-label">วันที่สิ้นสุด</label>
                                                 <DatePicker
                                                    selected={newPromotion.end_date}
                                                    onChange={(date) => handleNewPromotionDateChange(date, 'end_date')}
                                                    selectsEnd
                                                    startDate={newPromotion.start_date}
                                                    endDate={newPromotion.end_date}
                                                    minDate={newPromotion.start_date}
                                                    showTimeSelect
                                                    timeFormat="HH:mm"
                                                    timeIntervals={15}
                                                    dateFormat="dd/MM/yyyy HH:mm"
                                                    className="input-field w-full"
                                                    required
                                                />
                                             </div>
                                        </div>
                                        <div>
                                            <label htmlFor="promo_description" className="form-label">คำอธิบาย</label>
                                            <textarea id="promo_description" name="description" value={newPromotion.description} onChange={handleNewPromotionChange} className="input-field" rows={2} placeholder="เช่น เฉพาะวันจันทร์ - ศุกร์"/>
                                        </div>
                                        <div>
                                            <label htmlFor="promo_conditions" className="form-label">เงื่อนไขเพิ่มเติม</label>
                                            <textarea id="promo_conditions" name="conditions" value={newPromotion.conditions} onChange={handleNewPromotionChange} className="input-field" rows={2} placeholder="เช่น ยอดขั้นต่ำ 500 บาท, ไม่รวมเครื่องดื่ม" />
                                        </div>
                                        <div className="flex justify-center md:justify-end pt-4">
                                            <button type="submit" className="btn-primary w-full md:w-auto">เพิ่มโปรโมชั่น</button>
                                        </div>
                                    </form>
                                </>
                             )}

                            <hr className="my-8 border-t border-gray-300" />

                            <h3 className="text-xl font-semibold mb-4 text-blue-700">โปรโมชั่นที่มีอยู่ ({promotions.length})</h3>
                            
                            {/* ✅ Responsive Table/Card Container (เพิ่มคลาส mobile-card-table) */}
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-md mobile-card-table">
                                     <thead className="bg-gray-100">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">ชื่อ</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">ประเภท</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">ค่า</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Code</th>
                                             <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">ระยะเวลา</th>
                                             <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">สถานะ</th>
                                             <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">จัดการ</th>
                                         </tr>
                                     </thead>
                                     <tbody className="bg-white divide-y divide-gray-200">
                                         {promotions.length > 0 ? (
                                            promotions.map(promo => (
                                                <tr key={promo.promotion_id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-4 py-3 whitespace-normal text-sm font-medium text-gray-900 max-w-xs" data-label="ชื่อ">
                                                        {promo.name}
                                                        {promo.description && <p className="text-xs text-gray-500 mt-1">{promo.description}</p>}
                                                        {promo.conditions && <p className="text-xs text-red-500 mt-1">เงื่อนไข: {promo.conditions}</p>}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700" data-label="ประเภท">
                                                        {promo.type === 'percentage' && 'เปอร์เซ็นต์'}
                                                        {promo.type === 'fixed_amount' && 'จำนวนเงิน'}
                                                        {promo.type === 'special' && 'ข้อเสนอพิเศษ'}
                                                    </td>
                                                     <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-700" data-label="ค่า">
                                                        {promo.value} {promo.type === 'percentage' && '%'}
                                                        {promo.type === 'fixed_amount' && ' บาท'}
                                                        {promo.type === 'special' && ` (พิเศษ)`}
                                                    </td>
                                                     <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 font-mono" data-label="Code">
                                                        {promo.code || '-'}
                                                    </td>
                                                     <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700" data-label="ระยะเวลา">
                                                        {format(parseISO(promo.start_date), 'dd/MM/yy HH:mm')} - {format(parseISO(promo.end_date), 'dd/MM/yy HH:mm')}
                                                    </td>
                                                     <td className="px-4 py-3 whitespace-nowrap text-center" data-label="สถานะ">
                                                         <button
                                                            onClick={() => handleTogglePromotionStatus(promo.promotion_id)}
                                                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                                                             promo.is_active
                                                             ? 'bg-green-100 text-green-800 hover:bg-green-200 focus:ring-green-500'
                                                             : 'bg-red-100 text-red-800 hover:bg-red-200 focus:ring-red-500'
                                                            }`}
                                                            title="คลิกเพื่อสลับสถานะ"
                                                          >
                                                             {promo.is_active ? 'ใช้งาน' : 'ไม่ใช้งาน'}
                                                         </button>
                                                     </td>
                                                     <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium space-x-1 sm:space-x-2" data-label="จัดการ"> 
                                                          <button onClick={() => handleEditPromotionClick(promo)} className="btn-sm btn-secondary" title="แก้ไข">✏️</button>
                                                          <button onClick={() => handleDeletePromotion(promo.promotion_id)} className="btn-sm btn-danger" title="ลบ">🗑️</button>
                                                     </td>
                                                 </tr>
                                            ))
                                        ) : (
                                             <tr>
                                                <td colSpan={7} className="px-4 py-4 text-center text-gray-500">ยังไม่มีโปรโมชั่น</td>
                                            </tr>
                                        )}
                                     </tbody>
                                 </table>
                             </div>
                        </div>
                    </div>
                </div>

            </div> 
        </div> 
    );
}

export default Setting;
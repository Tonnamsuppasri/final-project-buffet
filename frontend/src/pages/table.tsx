import { useState, useEffect, type FormEvent, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import QRCode from 'qrcode';
import './table.css'; //
import { socket } from '../components/menu'; 

// --- Interfaces ---
interface TableData {
    table_id: number;
    table_number: number;
    seat_capacity: number;
    status: 'ว่าง' | 'ไม่ว่าง';
    uuid: string; // UUID ของโต๊ะ (สำหรับอ้างอิง)
}

interface PlanData {
    id: number;
    plan_name: string;
    price_per_person: number;
}

interface ActiveOrderData {
    order_id: number;
    table_id: number;
    table_number: number;
    uuid: string; 
    order_uuid: string; // ⬅️ UUID "ใหม่" ของออเดอร์นี้
    service_type: string;
    customer_quantity: number;
    plan_name: string;
    price_per_person: number;
    start_time: string;
}

interface ShopInfo {
    shop_name: string;
    payment_qr_code: string; 
}

const Timer = ({ startTime }: { startTime: string }) => {
    const [elapsedTime, setElapsedTime] = useState('--:--:--');

    useEffect(() => {
        if (!startTime) {
            setElapsedTime('--:--:--');
            return;
        }
        const compatibleStartTime = startTime.replace(' ', 'T');
        const startDate = new Date(compatibleStartTime);

        if (isNaN(startDate.getTime())) {
            setElapsedTime('--:--:--');
            return;
        }

        const timerInterval = setInterval(() => {
            const now = Date.now();
            const difference = now - startDate.getTime();

            if (difference < 0) {
                setElapsedTime('00:00:00');
                return;
            }

            const hours = Math.floor(difference / (1000 * 60 * 60));
            const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((difference % (1000 * 60)) / 1000);

            const formattedTime = [
                String(hours).padStart(2, '0'),
                String(minutes).padStart(2, '0'),
                String(seconds).padStart(2, '0')
            ].join(':');

            setElapsedTime(formattedTime);
        }, 1000);

        return () => clearInterval(timerInterval);
    }, [startTime]);

    return (
        <div className="table-timer">
            {elapsedTime}
        </div>
    );
};

const Table = () => {
    const location = useLocation();
    const role = location.state?.role;

    // --- States ---
    const [tables, setTables] = useState<TableData[]>([]);
    const [plans, setPlans] = useState<PlanData[]>([]);
    const [activeOrders, setActiveOrders] = useState<ActiveOrderData[]>([]);
    const [shopInfo, setShopInfo] = useState<ShopInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'grid' | 'form'>('grid');
    const [selectedTable, setSelectedTable] = useState<TableData | null>(null);
    const [customerQuantity, setCustomerQuantity] = useState(1);
    const [selectedPlanId, setSelectedPlanId] = useState('');
    const [serviceType, setServiceType] = useState('ปิ้งย่าง');
    const [totalPrice, setTotalPrice] = useState(0);
    const [showQrDetailsModal, setShowQrDetailsModal] = useState(false);
    const [currentOrderDetails, setCurrentOrderDetails] = useState<ActiveOrderData | null>(null);
    const [qrCodeImageUrl, setQrCodeImageUrl] = useState('');

    const printableBillRef = useRef<HTMLDivElement>(null);

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

    // ✅✅✅ FIX: แก้ไขบรรทัดนี้ ✅✅✅
    // (ใช้ค่าจาก .env ตรงๆ ห้ามบวก "/order" ซ้ำ)
    const customerOrderUrlBase = import.meta.env.VITE_CUSTOMER_URL || 'http://localhost:5173/order';


    const fetchAllData = useCallback(async () => {
        try {
            const [tablesRes, plansRes, activeOrdersRes, shopRes] = await Promise.all([
                axios.get<TableData[]>(`${apiUrl}/api/tables`),
                axios.get<PlanData[]>(`${apiUrl}/api/plans`),
                axios.get<ActiveOrderData[]>(`${apiUrl}/api/orders/active`),
                axios.get<ShopInfo>(`${apiUrl}/api/shop`)
            ]);
            setTables(tablesRes.data);
            setPlans(plansRes.data);
            setActiveOrders(activeOrdersRes.data);
            setShopInfo(shopRes.data);
            if (plansRes.data.length > 0 && !selectedPlanId) {
                setSelectedPlanId(String(plansRes.data[0].id));
            }
        } catch (error) {
            console.error("Error fetching data:", error);
            Swal.fire('ผิดพลาด!', 'ไม่สามารถโหลดข้อมูลได้', 'error');
        } finally {
            setLoading(false); 
        }
    }, [apiUrl, selectedPlanId]); 

    useEffect(() => {
        fetchAllData();

        const handleDataUpdate = () => {
            console.log("🎉 Socket event received: tables_updated. Refetching all data...");
            fetchAllData();
        };

        socket.on('tables_updated', handleDataUpdate);

        return () => {
            socket.off('tables_updated', handleDataUpdate);
        };
    }, [fetchAllData]); 


    useEffect(() => {
        if (view === 'form' && selectedPlanId && plans.length > 0) {
            const selectedPlan = plans.find(p => String(p.id) === selectedPlanId);
            if (selectedPlan) {
                setTotalPrice(customerQuantity * selectedPlan.price_per_person);
            }
        }
    }, [customerQuantity, selectedPlanId, plans, view]);

    // --- Handlers ---
    const handlePrintBill = (order: ActiveOrderData) => {
        // ... (โค้ดส่วนนี้คงเดิม) ...
    };

    const handleCheckBillButtonClick = async (table: TableData) => {
        // ... (โค้ดส่วนนี้คงเดิม) ...
    };

    const handleViewOrderDetails = async (table: TableData) => {
        const order = activeOrders.find(o => o.table_id === table.table_id);
        if (!order) return;

        setCurrentOrderDetails(order);
        try {
            // ✅✅✅ FIX: สร้าง QR Code จาก `order.order_uuid` (Dynamic) ✅✅✅
            const qrCodeDataUrl = await QRCode.toDataURL(`${customerOrderUrlBase}/${order.order_uuid}`, { width: 250 });
            setQrCodeImageUrl(qrCodeDataUrl);
            setShowQrDetailsModal(true);
        } catch (error) {
            console.error("Failed to generate QR Code:", error);
            Swal.fire('ผิดพลาด!', 'ไม่สามารถสร้าง QR Code ได้', 'error');
        }
    };

    const handleTableClick = (table: TableData) => {
        if (table.status === 'ว่าง') {
            setSelectedTable(table);
            setCustomerQuantity(1);
            setServiceType('ปิ้งย่าง');
            setView('form');
        } else {
            handleViewOrderDetails(table);
        }
    };

    const handleBackToGrid = () => {
        setView('grid');
        setSelectedTable(null);
    };

    const handleOrderSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!selectedTable || !selectedPlanId) return;

        const orderData = {
            table_id: selectedTable.table_id,
            customer_quantity: customerQuantity,
            plan_id: Number(selectedPlanId),
            service_type: serviceType
        };

        try {
            await axios.post(`${apiUrl}/api/orders`, orderData);
            await Swal.fire({
                icon: 'success',
                title: `เปิดโต๊ะ ${selectedTable.table_number} สำเร็จ!`,
                timer: 1500,
                showConfirmButton: false
            });
            handleBackToGrid();
        } catch (error: any) {
            Swal.fire('ผิดพลาด!', error.response?.data?.message || "ไม่สามารถเปิดโต๊ะได้", 'error');
        }
    };

    const handleCancelOrder = async (table: TableData) => {
        const order = activeOrders.find(o => o.table_id === table.table_id);
        if (!order) return;

        Swal.fire({
            title: `ยกเลิกออเดอร์โต๊ะ ${table.table_number}?`,
            text: "การกระทำนี้จะลบข้อมูลออเดอร์ปัจจุบันและทำให้โต๊ะกลับมาว่างอีกครั้ง",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'ใช่, ยกเลิกเลย',
            cancelButtonText: 'ไม่'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await axios.delete(`${apiUrl}/api/orders/${order.order_id}`);
                    await Swal.fire(
                        'ยกเลิกแล้ว!',
                        `ออเดอร์ของโต๊ะ ${table.table_number} ถูกยกเลิกเรียบร้อย`,
                        'success'
                    );
                } catch (error: any) {
                    Swal.fire('ผิดพลาด!', error.response?.data?.message || "ไม่สามารถยกเลิกออเดอร์ได้", 'error');
                }
            }
        });
    };

    const getStatusClass = (status: 'ว่าง' | 'ไม่ว่าง') => {
        return status === 'ว่าง'
            ? 'bg-green-500 hover:bg-green-600'
            : 'bg-red-500 hover:bg-red-600 cursor-pointer';
    };


    if (loading) {
        return <div className="p-8"><h1 className="text-3xl font-bold">กำลังโหลดข้อมูลโต๊ะ...</h1></div>;
    }

    return (
        <div className="p-4 sm:p-6 app-container">
            {view === 'grid' && (
                <>
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-4xl font-bold">สถานะโต๊ะทั้งหมด</h1>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                        {tables.map((table) => {
                            const order = table.status === 'ไม่ว่าง' ? activeOrders.find(o => o.table_id === table.table_id) : null;
                            return (
                                <div key={table.table_id} onClick={() => handleTableClick(table)} className={`table-card ${getStatusClass(table.status)}`}>
                                    <div className="table-card-header">
                                        <div className="table-number-info">
                                            <span className="table-number-main">T{String(table.table_number).padStart(2, '0')}</span>
                                            <span className="table-capacity-status">
                                                {table.seat_capacity} คน ({table.status})
                                            </span>
                                        </div>
                                        {order && <Timer startTime={order.start_time} />}
                                    </div>

                                    <div className="table-card-footer">
                                    {order ? (
                                        <>
                                            <div className="service-type-selector">
                                                <span className={`service-type-btn ${order?.service_type === 'ปิ้งย่าง' ? 'active' : 'inactive'}`}>
                                                    ปิ้งย่าง
                                                </span>
                                                <span className={`service-type-btn ${order?.service_type === 'ชาบู' ? 'active' : 'inactive'}`}>
                                                    ชาบู
                                                </span>
                                            </div>

                                            <div className="table-card-actions">
                                                <button className="cancel-order-button" onClick={(e) => { e.stopPropagation(); handleCancelOrder(table); }}>
                                                    ยกเลิก
                                                </button>
                                                <button className="check-bill-button" onClick={(e) => { e.stopPropagation(); handleCheckBillButtonClick(table); }}>
                                                    ชำระเงิน
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="table-card-call-to-action">
                                            คลิกเพื่อเปิดโต๊ะ
                                        </div>
                                    )}
                                </div>
                            </div>
                            );
                        })}
                    </div>
                </>
            )}

            {view === 'form' && selectedTable && (
                <div className="open-table-form-container">
                    <h2 className="text-3xl font-bold mb-6 text-center">เปิดโต๊ะ {selectedTable.table_number}</h2>
                    <form onSubmit={handleOrderSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="customer_quantity" className="form-label">จำนวนลูกค้า (คน)</label>
                            <input
                                type="number"
                                id="customer_quantity"
                                value={customerQuantity}
                                onChange={(e) => setCustomerQuantity(Math.max(1, Number(e.target.value)))}
                                min="1"
                                max={selectedTable.seat_capacity}
                                className="form-input"
                                required
                            />
                            <p className="text-xs text-gray-500 mt-1">โต๊ะนี้รองรับได้สูงสุด {selectedTable.seat_capacity} คน</p>
                        </div>

                        <div>
                            <label htmlFor="plan_id" className="form-label">เลือกโปรโมชัน</label>
                            <select
                                id="plan_id"
                                value={selectedPlanId}
                                onChange={(e) => setSelectedPlanId(e.target.value)}
                                className="form-input"
                                required
                            >
                                {plans.map(plan => (
                                    <option key={plan.id} value={plan.id}>
                                        {plan.plan_name} ({plan.price_per_person} บาท/คน)
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="form-label mb-2">ประเภทบริการ</label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="service_type" value="ปิ้งย่าง" checked={serviceType === 'ปิ้งย่าง'} onChange={(e) => setServiceType(e.target.value)} className="h-4 w-4"/>
                                    <span>ปิ้งย่าง</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="service_type" value="ชาบู" checked={serviceType === 'ชาบู'} onChange={(e) => setServiceType(e.target.value)} className="h-4 w-4" />
                                    <span>ชาบู</span>
                                </label>
                            </div>
                        </div>

                        <div className="text-center pt-4 border-t">
                            <p className="text-lg font-medium text-gray-700">ราคารวม</p>
                            <p className="text-4xl font-bold text-green-600">
                                {totalPrice.toLocaleString()} บาท
                            </p>
                        </div>

                        <div className="flex justify-end gap-4 pt-4">
                            <button type="button" onClick={handleBackToGrid} className="btn-secondary">ยกเลิก</button>
                            <button type="submit" className="btn-primary">ยืนยันเปิดโต๊ะ</button>
                        </div>
                    </form>
                </div>
            )}

            {/* QR Code Modal (Responsive) */}
            {showQrDetailsModal && currentOrderDetails && (
                <div className="fixed inset-0 bg-gray-900/80 bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-6 md:p-8 rounded-xl shadow-2xl relative w-full max-w-sm md:max-w-md modal-qr-details">
                        <button
                            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-xl md:top-4 md:right-4 md:text-2xl"
                            onClick={() => setShowQrDetailsModal(false)}
                        >
                            &times;
                        </button>
                        
                        <div className="flex flex-col items-center space-y-3 md:space-y-4">
                            <h2 className="text-2xl md:text-3xl font-bold mb-2 text-center">
                                โต๊ะ {currentOrderDetails.table_number}
                            </h2>

                            {/* (ลบส่วนแสดง PIN ออก) */}
                            
                            <h3 className="text-lg md:text-xl font-semibold text-gray-800 pt-2">สแกนเพื่อสั่งอาหาร</h3>
                            
                            {qrCodeImageUrl && (
                                <img 
                                    src={qrCodeImageUrl} 
                                    alt={`QR Code for Table ${currentOrderDetails.table_number}`} 
                                    className="w-48 h-48 md:w-64 md:h-64 border p-2 rounded-lg"
                                />
                            )}
                            
                            <div className="text-center space-y-1 text-sm text-gray-600">
                                <p>ประเภท: {currentOrderDetails.service_type}</p>
                                <p>ลูกค้า: {currentOrderDetails.customer_quantity} คน</p>
                                <p>โปรโมชัน: {currentOrderDetails.plan_name}</p>
                            </div>

                            <button
                                className="btn-secondary mt-4 w-full md:w-auto" 
                                onClick={() => setShowQrDetailsModal(false)}
                            >
                                ปิดหน้าต่าง
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Div นี้จะถูกซ่อน ใช้สำหรับพิมพ์เท่านั้น */}
            <div style={{ display: 'none' }}>
              <div id="printable-bill" ref={printableBillRef}></div>
            </div>
        </div>
    );
}

export default Table;
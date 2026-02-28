import React, { useState, useEffect, type FormEvent, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import QRCode from 'qrcode';
import { useReactToPrint } from 'react-to-print';
import { format } from 'date-fns'; 
import { th } from 'date-fns/locale'; 
import './table.css';
import { socket } from '../components/menu';

// --- Interfaces ---
interface TableData {
    table_id: number;
    table_number: number;
    seat_capacity: number;
    status: 'ว่าง' | 'ไม่ว่าง';
    uuid: string;
}

interface PlanData {
    id: number;
    plan_name: string;
    price_per_person: number;
    allow_refill: number; // ✅ เพิ่ม
}

interface ActiveOrderData {
    order_id: number;
    table_id: number;
    table_number: number;
    uuid: string;
    order_uuid: string;
    service_type: string;
    customer_quantity: number;
    plan_name: string;
    price_per_person: number;
    start_time: string;
    refill_water: number; // เพิ่ม
}

interface ShopInfo {
    shop_name: string;
    payment_qr_code: string;
    refill_water_price: number; // เพิ่ม
}

interface PromotionData {
    promotion_id: number;
    name: string;
    type: 'percent' | 'percentage' | 'fixed_amount' | 'special'; 
    value: number;
    code: string;
}

interface BillItem {
    name: string;
    quantity: number;
    price: number;
    total: number;
}

// --- Helper Components ---
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

// Component สำหรับพิมพ์ใบเสร็จ
class PrintableBill extends React.Component<any> {
    render() {
        const { order, items, totals, shop, date, refillWaterPrice } = this.props;
        if (!order || !shop) return null;

        // ✅ จัดรูปแบบเวลาเริ่มโต๊ะ
        let formattedStartTime = '-';
        if (order.start_time) {
            const startDate = new Date(order.start_time.replace(' ', 'T'));
            if (!isNaN(startDate.getTime())) {
                formattedStartTime = format(startDate, 'dd/MM/yyyy HH:mm', { locale: th });
            }
        }

        return (
            <div className="p-8 bg-white text-black font-mono w-[80mm] mx-auto print:w-full print:p-0">
                <div className="text-center mb-4">
                    <h3 className="text-xl font-bold">{shop.shop_name}</h3>
                    <p className="text-xs text-gray-600">ใบเสร็จรับเงิน / Receipt</p>
                    <p className="text-[10px] text-gray-500 mt-1">พิมพ์เมื่อ: {date}</p>
                </div>
                <div className="border-b-2 border-dashed border-gray-300 my-2"></div>

                <div className="text-sm mb-2 space-y-1">
                    <div className="flex justify-between">
                        <span>Table:</span>
                        <span className="font-bold">T{order.table_number}</span>
                    </div>
                    {/* ✅ เพิ่มเวลาเริ่มโต๊ะตรงนี้ */}
                    <div className="flex justify-between">
                        <span>Start Time:</span>
                        <span>{formattedStartTime}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Customers:</span>
                        <span>{order.customer_quantity} ท่าน</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Service:</span>
                        <span>{order.service_type}</span>
                    </div>
                </div>

                <div className="border-b-2 border-dashed border-gray-300 my-2"></div>

                <div className="space-y-1 text-sm">
                    <div className="flex justify-between font-semibold">
                        <span>Buffet ({order.plan_name})</span>
                        <span>{totals.buffetTotal.toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-gray-600 pl-2">
                        {order.customer_quantity} × {order.price_per_person.toLocaleString()}
                    </div>

                    {order.refill_water === 1 && (
                        <div className="flex justify-between font-semibold mt-1">
                            <span>🥤 รีฟิลน้ำ ({order.customer_quantity} คน)</span>
                            <span>{(order.customer_quantity * refillWaterPrice).toLocaleString()}</span>
                        </div>
                    )}

                    {items.length > 0 && (
                        <>
                            <div className="mt-2 font-semibold">รายการสั่งเพิ่ม:</div>
                            {items.map((item: BillItem, i: number) => (
                                <div key={i} className="pl-2 text-gray-700">
                                    <div className="flex justify-between">
                                        <span>{item.name} ×{item.quantity}</span>
                                        <span>{item.total.toLocaleString()}</span>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>

                <div className="border-b-2 border-dashed border-gray-300 my-4"></div>

                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span>Subtotal</span>
                        <span>{totals.total.toLocaleString()}</span>
                    </div>
                    {totals.discount > 0 && (
                        <div className="flex justify-between text-sm text-red-600">
                            <span>Discount</span>
                            <span>-{totals.discount.toLocaleString()}</span>
                        </div>
                    )}
                    <div className="flex justify-between font-bold text-xl mt-2 pt-2 border-t border-gray-800">
                        <span>NET TOTAL</span>
                        <span>{totals.netTotal.toLocaleString()} THB</span>
                    </div>
                </div>

                {shop.payment_qr_code && (
                    <>
                        <div className="border-b-2 border-dashed border-gray-300 my-4"></div>
                        <div className="text-center">
                            <p className="text-sm font-semibold mb-2">สแกนเพื่อชำระเงิน</p>
                            <div className="flex justify-center">
                                <img
                                    src={`data:image/png;base64,${shop.payment_qr_code}`}
                                    alt="Payment QR"
                                    className="w-40 h-40 object-contain border-2 border-gray-300 p-2"
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-2">PromptPay / QR Payment</p>
                        </div>
                    </>
                )}

                <div className="border-b-2 border-dashed border-gray-300 my-4"></div>
                <div className="text-center text-xs text-gray-500 mt-4">
                    <p>ขอบคุณที่ใช้บริการ</p>
                    <p>Thank you for dining with us!</p>
                </div>
            </div>
        );
    }
}

// Component สำหรับพิมพ์ QR โต๊ะ
class PrintableQRCode extends React.Component<any> {
    render() {
        const { order, shop, qrUrl } = this.props;
        if (!order || !qrUrl) return null;

        const startTime = new Date(order.start_time.replace(' ', 'T'));
        const formattedTime = startTime.toLocaleString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-10 text-center print:p-8">
                <div className="mb-6">
                    <h1 className="text-5xl font-bold mb-2">โต๊ะ {order.table_number}</h1>
                    <div className="inline-block bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-lg font-semibold">
                        {order.service_type}
                    </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-6 mb-6 w-full max-w-md">
                    <div className="grid grid-cols-2 gap-4 text-left">
                        <div>
                            <p className="text-sm text-gray-500">แพ็คเกจ</p>
                            <p className="text-lg font-bold">{order.plan_name}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">จำนวนลูกค้า</p>
                            <p className="text-lg font-bold">{order.customer_quantity} ท่าน</p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-sm text-gray-500">ราคา</p>
                            <p className="text-2xl font-bold text-green-600">
                                {(order.customer_quantity * order.price_per_person).toLocaleString()} บาท
                            </p>
                            <p className="text-xs text-gray-400">
                                ({order.price_per_person.toLocaleString()} บาท/ท่าน)
                            </p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-sm text-gray-500">เวลาเริ่ม</p>
                            <p className="text-sm font-medium">{formattedTime}</p>
                        </div>
                    </div>
                </div>

                <div className="border-4 border-gray-800 p-6 rounded-2xl mb-6 bg-white flex justify-center">
                    <img
                        src={qrUrl}
                        alt="Table QR"
                        className="w-72 h-72 object-contain"
                    />
                </div>

                <div className="mb-6">
                    <p className="text-2xl font-bold mb-2">สแกนเพื่อสั่งอาหาร</p>
                    <p className="text-gray-600 text-lg">Scan to Order Food</p>
                </div>

                {shop && (
                    <div className="mt-8 pt-6 border-t-2 border-gray-200 w-full max-w-md">
                        <p className="text-gray-400 font-medium text-lg">{shop.shop_name}</p>
                    </div>
                )}
            </div>
        );
    }
}

// --- Main Component ---
const Table = () => {
    // --- States ---
    const location = useLocation();
    const [tables, setTables] = useState<TableData[]>([]);
    const [plans, setPlans] = useState<PlanData[]>([]);
    const [activeOrders, setActiveOrders] = useState<ActiveOrderData[]>([]);
    const [shopInfo, setShopInfo] = useState<ShopInfo | null>(null);
    const [promotions, setPromotions] = useState<PromotionData[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'grid' | 'form'>('grid');
    const [selectedTable, setSelectedTable] = useState<TableData | null>(null);

    // Form States
    const [customerQuantity, setCustomerQuantity] = useState(1);
    const [selectedPlanId, setSelectedPlanId] = useState('');
    const [serviceType, setServiceType] = useState('');
    const [serviceTypes, setServiceTypes] = useState<{id: number, name: string}[]>([]);
    const [refillWater, setRefillWater] = useState(false);
    const [refillWaterPrice, setRefillWaterPrice] = useState(0);
    const [totalPrice, setTotalPrice] = useState(0);

    // Bill Modal States
    const [showCheckBillModal, setShowCheckBillModal] = useState(false);
    const [checkBillOrder, setCheckBillOrder] = useState<ActiveOrderData | null>(null);
    const [checkBillItems, setCheckBillItems] = useState<BillItem[]>([]);
    const [selectedPromotionId, setSelectedPromotionId] = useState<number | null>(null);
    const [paymentMethod, setPaymentMethod] = useState('เงินสด');

    // QR Modal States
    const [showQrModal, setShowQrModal] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [qrTargetOrder, setQrTargetOrder] = useState<ActiveOrderData | null>(null);

    const componentRefBill = useRef(null);
    const componentRefQR = useRef(null);

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const customerOrderUrlBase = import.meta.env.VITE_CUSTOMER_URL || 'http://localhost:5173/order';

    const fetchPromotions = async () => {
        try {
            const res = await axios.get(`${apiUrl}/api/promotions?active=true`);
            const formattedPromos = res.data.map((p: any) => ({
                ...p,
                promotion_id: Number(p.promotion_id),
                value: Number(p.value)
            }));
            setPromotions(formattedPromos);
        } catch (error) {
            console.error("Error fetching promotions", error);
        }
    };

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
            setRefillWaterPrice(shopRes.data.refill_water_price || 0); // เพิ่ม
            if (plansRes.data.length > 0 && !selectedPlanId) {
                setSelectedPlanId(String(plansRes.data[0].id));
            }
            fetchPromotions();
        } catch (error) {
            console.error("Error fetching data:", error);
            Swal.fire('ผิดพลาด!', 'ไม่สามารถโหลดข้อมูลได้', 'error');
        } finally {
            setLoading(false);
        }
    }, [apiUrl, selectedPlanId]);

    useEffect(() => {
    axios.get(`${apiUrl}/api/service-types`)
        .then(res => setServiceTypes(res.data));
    }, [apiUrl]);

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
                const buffet = customerQuantity * selectedPlan.price_per_person;
                const water = refillWater ? customerQuantity * refillWaterPrice : 0;
                setTotalPrice(buffet + water);
            }
        }
    }, [customerQuantity, selectedPlanId, plans, view, refillWater, refillWaterPrice]);

    // ✅ Calculation Logic
    const calculateBill = () => {
        if (!checkBillOrder) return { total: 0, discount: 0, netTotal: 0, buffetTotal: 0, alaCarteTotal: 0 };

        const buffetTotal = checkBillOrder.customer_quantity * checkBillOrder.price_per_person;
        const waterTotal = checkBillOrder.refill_water ? checkBillOrder.customer_quantity * refillWaterPrice : 0;
        const alaCarteTotal = checkBillItems.reduce((sum, item) => sum + item.total, 0);
        const total = buffetTotal + waterTotal + alaCarteTotal;

        let discount = 0;

        if (selectedPromotionId && promotions.length > 0) {
            const promo = promotions.find(p => Number(p.promotion_id) === Number(selectedPromotionId));

            if (promo) {
                const promoValue = Number(promo.value);
                const type = promo.type.toLowerCase().trim();

                if (type.includes('percent') || type === 'percentage') {
                    // แบบเปอร์เซ็นต์
                    discount = total * (promoValue / 100);
                } else if (type.includes('fixed') || type === 'amount' || type === 'fixed_amount') {
                    // แบบลดจำนวนเงินคงที่
                    discount = promoValue;
                } else if (type === 'special') {
                    // ✅ แบบพิเศษ: มา X จ่าย Y
                    const groupSize = promoValue + 1;
                    
                    if (groupSize > 1) {
                        const freeHeads = Math.floor(checkBillOrder.customer_quantity / groupSize);
                        discount = freeHeads * checkBillOrder.price_per_person;
                    }
                }
            }
        }

        const netTotal = Math.max(0, total - discount);
        return { buffetTotal, waterTotal, alaCarteTotal, total, discount, netTotal };
    };

    // --- Handlers ---
    const handlePrintBill = useReactToPrint({
        contentRef: componentRefBill,
        documentTitle: `Bill-T${checkBillOrder?.table_number}`,
    });

    const handlePrintQR = useReactToPrint({
        contentRef: componentRefQR,
        documentTitle: `QR-T${qrTargetOrder?.table_number}`,
        onAfterPrint: () => setShowQrModal(false)
    });

    const handleCheckBillButtonClick = async (table: TableData) => {
        const order = activeOrders.find(o => o.table_id === table.table_id);
        if (!order) return;

        try {
            const detailsRes = await axios.get(`${apiUrl}/api/orders/${order.order_id}/details`);
            const alaCarteItems = detailsRes.data.map((item: any) => ({
                name: item.menu_name,
                quantity: item.quantity,
                price: item.price_per_item,
                total: item.quantity * item.price_per_item
            }));

            setCheckBillItems(alaCarteItems);
            setCheckBillOrder(order);
            setSelectedPromotionId(null);
            setPaymentMethod('เงินสด');
            setShowCheckBillModal(true);
        } catch (error) {
            console.error("Error", error);
            Swal.fire('Error', 'ไม่สามารถดึงข้อมูลรายการอาหารได้', 'error');
        }
    };

    const handleQrButtonClick = async (table: TableData) => {
        const order = activeOrders.find(o => o.table_id === table.table_id);
        if (!order) return;

        try {
            const url = `${customerOrderUrlBase}/${order.order_uuid}`;
            const qrDataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2 });
            setQrCodeUrl(qrDataUrl);
            setQrTargetOrder(order);
            setShowQrModal(true);
        } catch (error) {
            console.error("QR Gen Error", error);
            Swal.fire('Error', 'สร้าง QR Code ไม่สำเร็จ', 'error');
        }
    };

    const confirmPayment = async () => {
        if (!checkBillOrder) return;
        const { netTotal, discount } = calculateBill();

        try {
            await axios.post(`${apiUrl}/api/payment`, {
                order_id: checkBillOrder.order_id,
                payment_method: paymentMethod,
                discount: discount,
                promotion_id: selectedPromotionId,
                final_price_client: netTotal
            });

            await Swal.fire({
                icon: 'success',
                title: 'ชำระเงินเรียบร้อย',
                text: `ยอดรับชำระ ${netTotal.toLocaleString()} บาท`,
                timer: 2000,
                showConfirmButton: false
            });
            setShowCheckBillModal(false);
            fetchAllData();
        } catch (error: any) {
            Swal.fire('ผิดพลาด', error.response?.data?.message || 'ไม่สามารถบันทึกการชำระเงินได้', 'error');
        }
    };

    const handleTableClick = (table: TableData) => {
        if (table.status === 'ว่าง') {
            setSelectedTable(table);
            setCustomerQuantity(1);
            setServiceType(serviceTypes[0]?.name || '');
            setView('form');
        }
    };

    const handleBackToGrid = () => {
        setView('grid');
        setSelectedTable(null);
        setRefillWater(false); // เพิ่ม
    };

    const handleOrderSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!selectedTable || !selectedPlanId) return;

        try {
            await axios.post(`${apiUrl}/api/orders`, {
                table_id: selectedTable.table_id,
                customer_quantity: customerQuantity,
                plan_id: Number(selectedPlanId),
                service_type: serviceType,
                refill_water: refillWater ? 1 : 0  // เพิ่ม
            });
            await Swal.fire({ icon: 'success', title: `เปิดโต๊ะสำเร็จ!`, timer: 1500, showConfirmButton: false });
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
                    await Swal.fire('ยกเลิกแล้ว!', `ออเดอร์ของโต๊ะ ${table.table_number} ถูกยกเลิกเรียบร้อย`, 'success');
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
        <div className="p-4 sm:p-6 app-container relative">
            {/* Grid View */}
            {view === 'grid' && (
                <>
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-4xl font-bold">สถานะโต๊ะทั้งหมด</h1>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
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
                                                    {serviceTypes.map(st => (
                                                        <span key={st.id} className={`service-type-btn ${order?.service_type === st.name ? 'active' : 'inactive'}`}>
                                                            {st.name}
                                                        </span>
                                                    ))}
                                                </div>

                                                <div className="table-card-actions mt-2 flex gap-2">
                                                    <button className="flex-1 bg-gray-600 hover:bg-gray-700 text-white p-2 rounded text-sm" onClick={(e) => { e.stopPropagation(); handleCancelOrder(table); }}>
                                                        ยกเลิก
                                                    </button>
                                                    <button className="flex-1 bg-blue-500 hover:bg-blue-600 text-white p-2 rounded text-sm font-bold" onClick={(e) => { e.stopPropagation(); handleQrButtonClick(table); }}>
                                                        QR Code
                                                    </button>
                                                    <button className="flex-1 bg-white text-green-600 hover:bg-gray-100 p-2 rounded text-sm font-bold" onClick={(e) => { e.stopPropagation(); handleCheckBillButtonClick(table); }}>
                                                        เช็คบิล
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

            {/* Form View */}
            {view === 'form' && selectedTable && (
                <div className="open-table-form-container">
                    <h2 className="text-3xl font-bold mb-6 text-center">เปิดโต๊ะ {selectedTable.table_number}</h2>
                    <form onSubmit={handleOrderSubmit} className="space-y-6">
                        <div>
                            <label className="form-label">จำนวนลูกค้า (คน)</label>
                            <input
                                type="number"
                                value={customerQuantity}
                                onChange={(e) => setCustomerQuantity(Math.max(1, Number(e.target.value)))}
                                min="1"
                                className="form-input"
                                required
                            />
                        </div>
                        <div>
                            <label className="form-label">เลือกโปรโมชัน</label>
                            <select
                                value={selectedPlanId}
                                onChange={(e) => setSelectedPlanId(e.target.value)}
                                className="form-input"
                                required
                            >
                                {plans.map(plan => (
                                    <option key={plan.id} value={plan.id}>
                                        {plan.plan_name} ({plan.price_per_person} บาท/คน){plan.allow_refill ? ' 🔄 รีฟิล' : ''}
                                    </option>
                                ))}
                            </select>
                            {plans.find(p => String(p.id) === selectedPlanId)?.allow_refill === 1 && (
                                <p className="mt-2 text-sm font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                                    🔄 แพ็กเกจนี้อนุญาตให้รีฟิลได้
                                </p>
                            )}
                        </div>
                        {serviceTypes.map(st => (
                        <label key={st.id} className="flex items-center gap-2">
                            <input 
                            type="radio" 
                            name="st" 
                            value={st.name} 
                            checked={serviceType === st.name} 
                            onChange={e => setServiceType(e.target.value)} 
                            /> 
                            {st.name}
                        </label>
                        ))}
                        {/* 🥤 รีฟิลน้ำ */}
                        {refillWaterPrice > 0 && (
                            <div
                                onClick={() => setRefillWater(prev => !prev)}
                                className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all
                                    ${refillWater ? 'bg-blue-50 border-blue-400' : 'bg-gray-50 border-gray-200'}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={refillWater}
                                    onChange={() => {}}
                                    className="w-5 h-5 accent-blue-500 pointer-events-none"
                                />
                                <div>
                                    <p className="font-semibold text-gray-800">🥤 รีฟิลน้ำ</p>
                                    <p className="text-sm text-gray-500">
                                        +{refillWaterPrice} บาท/คน × {customerQuantity} คน = +{(customerQuantity * refillWaterPrice).toLocaleString()} บาท
                                    </p>
                                </div>
                                {refillWater && (
                                    <span className="ml-auto text-sm font-bold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">✓ เพิ่มแล้ว</span>
                                )}
                            </div>
                        )}

                        <div className="text-center pt-4 border-t">
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

            {/* 🔥 QR Modal */}
            {showQrModal && qrTargetOrder && (
                <div className="fixed inset-0 bg-gray-900/80 flex items-center justify-center z-[15] p-4 qr-overlay">
                    <div className="qr-modal-container bg-white p-6 md:p-8 rounded-xl shadow-2xl relative w-full max-w-xs md:max-w-sm flex flex-col items-center">
                        <button className="absolute top-3 right-3 text-gray-500 hover:text-red-500 text-2xl" onClick={() => setShowQrModal(false)}>&times;</button>
                        <h2 className="text-xl md:text-2xl font-bold mb-4">โต๊ะ {qrTargetOrder.table_number}</h2>
                        <img 
                            src={qrCodeUrl} 
                            alt="Table QR" 
                            className="w-48 h-48 md:w-64 md:h-64 border p-2 rounded mb-4 object-contain" 
                        />
                        <p className="text-gray-600 mb-4 text-sm md:text-base">{qrTargetOrder.plan_name}</p>
                        <button onClick={handlePrintQR} className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 flex items-center justify-center gap-2 text-sm md:text-base">
                            🖨️ พิมพ์ QR Code
                        </button>
                    </div>
                </div>
            )}

            {/* 🔥 Check Bill Modal */}
            {showCheckBillModal && checkBillOrder && (
                <div className="fixed inset-0 bg-gray-900/80 flex items-center justify-center z-[15] p-4 animate-fade-in billing-overlay">
                    <div className="billing-modal-container bg-white rounded-xl shadow-2xl w-full md:max-w-3xl lg:max-w-4xl xl:max-w-5xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">

                        {/* Left Column: Details */}
                        <div className="billing-left-col p-4 md:p-5 lg:p-6 md:w-3/5 border-r overflow-y-auto bg-gray-50">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2">
                                    <span>🧾 บิลโต๊ะ {checkBillOrder.table_number}</span>
                                </h2>
                                <span className="text-xs md:text-sm bg-blue-100 text-blue-800 py-1 px-3 rounded-full">{checkBillOrder.service_type}</span>
                            </div>

                            <div className="space-y-3 md:space-y-4">
                                <div className="bg-white p-3 md:p-4 rounded-lg shadow-sm border border-gray-100">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-semibold text-gray-700 text-sm md:text-base">Buffet ({checkBillOrder.plan_name})</span>
                                        <span className="font-bold text-gray-900 text-sm md:text-base">{(checkBillOrder.customer_quantity * checkBillOrder.price_per_person).toLocaleString()}</span>
                                    </div>
                                    <div className="text-xs md:text-sm text-gray-500">
                                        {checkBillOrder.customer_quantity} ท่าน x {checkBillOrder.price_per_person.toLocaleString()} บาท
                                    </div>
                                </div>

                                {checkBillItems.length > 0 ? (
                                    <div className="bg-white p-3 md:p-4 rounded-lg shadow-sm border border-gray-100">
                                        <h4 className="text-xs md:text-sm font-semibold text-gray-500 mb-2 border-b pb-2">รายการสั่งเพิ่ม</h4>
                                        <div className="space-y-2">
                                            {checkBillItems.map((item, idx) => (
                                                <div key={idx} className="flex justify-between text-xs md:text-sm">
                                                    <span>{item.name} <span className="text-gray-400">x{item.quantity}</span></span>
                                                    <span>{item.total.toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center text-gray-400 py-4 text-xs md:text-sm">ไม่มีรายการสั่งเพิ่ม</div>
                                )}
                            </div>

                            <div className="mt-4 md:mt-6">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">ช่องทางชำระเงิน</label>
                                <div className="payment-method-grid grid grid-cols-3 gap-2 md:gap-3">
                                    {['เงินสด', 'โอนจ่าย', 'บัตรเครดิต'].map(method => (
                                        <button
                                            key={method}
                                            onClick={() => setPaymentMethod(method)}
                                            className={`py-2 md:py-3 px-2 rounded-lg border text-xs md:text-sm font-medium transition-all ${paymentMethod === method
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105'
                                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                                }`}
                                        >
                                            {method}
                                        </button>
                                    ))}
                                </div>
                                {paymentMethod === 'โอนจ่าย' && shopInfo?.payment_qr_code && (
                                    <div className="mt-4 flex flex-col items-center p-4 bg-white rounded-lg border">
                                        <p className="text-sm font-medium mb-2">สแกนเพื่อชำระเงิน</p>
                                        <img src={`data:image/png;base64,${shopInfo.payment_qr_code}`} alt="QR PromptPay" className="w-24 h-24 md:w-32 md:h-32 object-contain" />
                                        <p className="text-xs text-gray-500 mt-2">{shopInfo.shop_name}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Column: Calculation & Actions */}
                        <div className="billing-right-col p-4 md:p-5 lg:p-6 md:w-2/5 flex flex-col bg-white h-full relative">
                            <button
                                onClick={() => setShowCheckBillModal(false)}
                                className="absolute top-2 right-2 md:top-4 md:right-4 text-gray-400 hover:text-gray-600"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>

                            <div className="mt-6 md:mt-8 flex-grow">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">โปรโมชั่น / ส่วนลด</label>
                                <select
                                    className="w-full p-2 md:p-3 border border-gray-300 rounded-lg mb-4 md:mb-6 bg-white focus:ring-2 focus:ring-blue-500 outline-none transition text-sm md:text-base"
                                    value={selectedPromotionId || ''}
                                    onChange={(e) => setSelectedPromotionId(Number(e.target.value) || null)}
                                >
                                    <option value="">-- ราคาปกติ (ไม่ลด) --</option>
                                    {promotions.map(promo => (
                                        <option key={promo.promotion_id} value={promo.promotion_id}>
                                            {promo.name} ({promo.type.includes('percent') 
                                                ? `-${Number(promo.value)}%` 
                                                : promo.type === 'special'
                                                    ? `(มา ${Number(promo.value)+1} จ่าย ${promo.value})`
                                                    : `-${Number(promo.value)} บ.`})
                                        </option>
                                    ))}
                                </select>

                                {/* Price Display */}
                                {(() => {
                                    const { total, discount, netTotal } = calculateBill();
                                    const selectedPromoName = promotions.find(p => p.promotion_id === selectedPromotionId)?.name;
                                    return (
                                        <div className="space-y-3 p-4 md:p-5 rounded-xl bg-gray-50 border border-gray-100">
                                            {discount > 0 && (
                                                <div className="flex justify-end">
                                                    <span className="text-gray-400 line-through text-base md:text-lg font-medium decoration-red-400 decoration-2">
                                                        {total.toLocaleString()}
                                                    </span>
                                                </div>
                                            )}

                                            <div className="border-t border-gray-200 pt-3 mt-2">
                                                <div className="flex justify-between items-end">
                                                    <span className="font-bold text-gray-800 text-base md:text-lg">ยอดสุทธิ</span>
                                                    <div className="text-right flex flex-col items-end">
                                                        <span className={`total-price-display text-3xl md:text-3xl lg:text-4xl font-extrabold leading-none ${discount > 0 ? 'text-green-600' : 'text-blue-600'}`}>
                                                            {netTotal.toLocaleString()}
                                                        </span>
                                                        <span className="text-xs text-gray-500 mt-1">บาท</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {discount > 0 && (
                                                <div className="flex justify-between text-red-500 animate-pulse text-xs md:text-sm">
                                                    <span>ส่วนลด ({selectedPromoName})</span>
                                                    <span>-{discount.toLocaleString()}</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Actions */}
                            <div className="mt-4 md:mt-6 space-y-2 md:space-y-3">
                                <button
                                    onClick={handlePrintBill}
                                    className="w-full flex items-center justify-center gap-2 py-2 md:py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition text-sm md:text-base"
                                >
                                    🖨️ พิมพ์ใบเสร็จ
                                </button>

                                <button
                                    onClick={confirmPayment}
                                    className="w-full py-3 md:py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-bold text-lg md:text-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
                                >
                                    ยืนยันรับเงิน
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ display: 'none' }}>
                {checkBillOrder && shopInfo && (
                    <div ref={componentRefBill}>
                        <PrintableBill
                            order={checkBillOrder}
                            items={checkBillItems}
                            totals={calculateBill()}
                            shop={shopInfo}
                            date={format(new Date(), 'dd/MM/yyyy HH:mm น.', { locale: th })}
                            refillWaterPrice={refillWaterPrice}
                        />
                    </div>
                )}
                {qrTargetOrder && shopInfo && qrCodeUrl && (
                    <div ref={componentRefQR}>
                        <PrintableQRCode
                            order={qrTargetOrder}
                            shop={shopInfo}
                            qrUrl={qrCodeUrl}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

export default Table;
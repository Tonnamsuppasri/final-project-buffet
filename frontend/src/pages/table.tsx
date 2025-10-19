import { useState, useEffect, type FormEvent, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import QRCode from 'qrcode';
import './table.css';
import { socket } from '../components/menu'; // ✅ 1. Import socket

// --- Interfaces ---
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
}

interface ActiveOrderData {
    order_id: number;
    table_id: number;
    table_number: number;
    uuid: string;
    service_type: string;
    customer_quantity: number;
    plan_name: string;
    price_per_person: number;
    start_time: string;
}

interface ShopInfo {
    shop_name: string;
    payment_qr_code: string; // base64 string
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

    // Ref for printing
    const printableBillRef = useRef<HTMLDivElement>(null);

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const customerOrderUrlBase = import.meta.env.VITE_CUSTOMER_URL || 'http://localhost:5173/order';


    // ✅ 3. หุ้ม fetchAllData ด้วย useCallback
    const fetchAllData = useCallback(async () => {
        // ไม่ต้อง setLoading(true) ทุกครั้งที่ socket ทำงาน เพื่อให้หน้าจอกระพริบน้อยลง
        // setLoading(true); 
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
            setLoading(false); // ปิด loading แค่ครั้งแรก
        }
    }, [apiUrl, selectedPlanId]); // เพิ่ม dependency ที่จำเป็น

    // ✅ 4. สร้าง useEffect สำหรับจัดการ Socket
    useEffect(() => {
        // ดึงข้อมูลครั้งแรกเมื่อ Component โหลด
        fetchAllData();

        // ฟังก์ชัน Handler ที่จะถูกเรียกเมื่อมี event
        const handleDataUpdate = () => {
            console.log("🎉 Socket event received: tables_updated. Refetching all data...");
            fetchAllData();
        };

        // เริ่มดักฟัง event จาก server
        socket.on('tables_updated', handleDataUpdate);

        // Cleanup function: หยุดดักฟังเมื่อ Component ถูกปิด
        return () => {
            socket.off('tables_updated', handleDataUpdate);
        };
    }, [fetchAllData]); // ทำงานเมื่อ fetchAllData เปลี่ยน (ซึ่งจะเกิดแค่ครั้งเดียวเพราะ useCallback)


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
        if (!printableBillRef.current || !shopInfo || !shopInfo.payment_qr_code) {
            Swal.fire('ผิดพลาด', 'ไม่มีข้อมูลร้านค้าหรือ QR Code สำหรับการพิมพ์', 'error');
            return;
        };

        const finalPrice = order.customer_quantity * order.price_per_person;
        const now = new Date();
        const formattedDate = `${now.toLocaleDateString('th-TH')} ${now.toLocaleTimeString('th-TH')}`;

        const billHtml = `
            <div class="receipt-header"><h2>${shopInfo.shop_name}</h2><p>ใบแจ้งค่าบริการ (โต๊ะ ${order.table_number})</p></div>
            <div class="receipt-body"><p><strong>วันที่:</strong> ${formattedDate}</p><hr><div class="receipt-item"><span>${order.plan_name} (x${order.customer_quantity})</span><span>${finalPrice.toLocaleString()} บาท</span></div><hr><div class="receipt-total"><span>ยอดรวมสุทธิ</span><span>${finalPrice.toLocaleString()} บาท</span></div></div>
            <div class="receipt-qr"><p>สแกน QR Code เพื่อชำระเงิน</p><img src="data:image/png;base64,${shopInfo.payment_qr_code}" alt="Payment QR Code" /></div>
            <div class="receipt-footer"><p>ขอบคุณที่ใช้บริการ</p></div>
        `;

        printableBillRef.current.innerHTML = billHtml;
        // ใช้ handlePrint จาก useReactToPrint
        
    };

    const handleCheckBillButtonClick = async (table: TableData) => {
        const order = activeOrders.find(o => o.table_id === table.table_id);
        if (!order || !shopInfo) return;

        const finalPrice = order.customer_quantity * order.price_per_person;
        const paymentQrHtml = (shopInfo.payment_qr_code)
            ? `<div class="billing-modal-qr"><h3 class="modal-subtitle">สแกนเพื่อชำระเงิน</h3><img src="data:image/png;base64,${shopInfo.payment_qr_code}" alt="Payment QR Code" /></div>`
            : `<div class="billing-modal-qr"><p>ไม่มีข้อมูล QR Code</p></div>`;

        Swal.fire({
            title: `เช็คบิล: โต๊ะ ${table.table_number}`,
            html: `
                <div class="billing-modal-content">
                    <div class="billing-modal-details">
                        <h3 class="modal-subtitle">รายละเอียด</h3>
                        <p><strong>บริการ:</strong> ${order.service_type}</p>
                        <p><strong>โปรโมชัน:</strong> ${order.plan_name}</p>
                        <p><strong>จำนวนลูกค้า:</strong> ${order.customer_quantity} คน</p>
                        <div class="payment-method-selector">
                            <h4 class="modal-subtitle-small">เลือกวิธีชำระเงิน (เลือกได้หลายข้อ)</h4>
                            <div class="checkbox-group">
                                <label class="checkbox-label"><input type="checkbox" name="payment_method" value="เงินสด" id="swal-payment-cash"><span>เงินสด</span></label>
                                <label class="checkbox-label"><input type="checkbox" name="payment_method" value="เงินโอน" id="swal-payment-transfer"><span>เงินโอน</span></label>
                            </div>
                        </div>
                        <p class="total-price"><strong>ราคารวม:</strong> ${finalPrice.toLocaleString()} บาท</p>
                    </div>
                    ${paymentQrHtml}
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'ยืนยันชำระเงิน',
            confirmButtonColor: '#2563eb',
            cancelButtonText: 'ยกเลิก',
            showDenyButton: true,
            denyButtonText: '🖨️ พิมพ์ใบแจ้งหนี้',
            denyButtonColor: '#10b981',
            width: 'auto',
            customClass: { htmlContainer: 'custom-swal-container' },
            preConfirm: () => {
                const cashCheckbox = Swal.getPopup()?.querySelector('#swal-payment-cash') as HTMLInputElement;
                const transferCheckbox = Swal.getPopup()?.querySelector('#swal-payment-transfer') as HTMLInputElement;
                if (!cashCheckbox.checked && !transferCheckbox.checked) {
                    Swal.showValidationMessage('กรุณาเลือกวิธีชำระเงินอย่างน้อย 1 อย่าง');
                    return false;
                }
                const methods = [];
                if (cashCheckbox.checked) methods.push('เงินสด');
                if (transferCheckbox.checked) methods.push('เงินโอน');
                return methods.join(' + ');
            }
        }).then(async (result) => {
            if (result.isConfirmed && result.value) {
                const selectedPaymentMethod = result.value;
                try {
                    await axios.post(`${apiUrl}/api/payment`, {
                        order_id: order.order_id,
                        total_price: finalPrice,
                        payment_method: selectedPaymentMethod
                    });
                    await Swal.fire('สำเร็จ!', 'บันทึกการชำระเงินเรียบร้อย', 'success');
                    // fetchAllData(); // ❗ ไม่ต้องเรียกเอง Socket จะจัดการให้
                } catch (error: any) {
                    Swal.fire('ผิดพลาด!', error.response?.data?.message || "ไม่สามารถบันทึกการชำระเงินได้", 'error');
                }
            } else if (result.isDenied) {
                handlePrintBill(order);
            }
        });
    };

    const handleViewOrderDetails = async (table: TableData) => {
        const order = activeOrders.find(o => o.table_id === table.table_id);
        if (!order) return;

        setCurrentOrderDetails(order);
        try {
            const qrCodeDataUrl = await QRCode.toDataURL(`${customerOrderUrlBase}/${order.uuid}`, { width: 250 });
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
            // fetchAllData(); // ❗ ไม่ต้องเรียกเอง Socket จะจัดการให้
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
                    // fetchAllData(); // ❗ ไม่ต้องเรียกเอง Socket จะจัดการให้
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

            {showQrDetailsModal && currentOrderDetails && (
                <div className="fixed inset-0 bg-gray-900/80 bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-8 rounded-xl shadow-2xl relative w-full max-w-md modal-qr-details">
                        <button
                            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl"
                            onClick={() => setShowQrDetailsModal(false)}
                        >
                            &times;
                        </button>
                        <h2 className="text-3xl font-bold mb-6 text-center">โต๊ะ {currentOrderDetails.table_number}</h2>
                        <div className="flex flex-col items-center space-y-4">
                            <h3 className="text-xl font-semibold text-gray-800">สแกนเพื่อสั่งอาหาร</h3>
                            {qrCodeImageUrl && (
                                <img src={qrCodeImageUrl} alt={`QR Code for Table ${currentOrderDetails.table_number}`} className="w-64 h-64 border p-2"/>
                            )}
                            <p className="text-sm text-gray-600">ประเภท: {currentOrderDetails.service_type}</p>
                            <p className="text-sm text-gray-600">ลูกค้า: {currentOrderDetails.customer_quantity} คน</p>
                            <p className="text-sm text-gray-600">โปรโมชัน: {currentOrderDetails.plan_name}</p>
                            <button
                                className="btn-secondary mt-6"
                                onClick={() => setShowQrDetailsModal(false)}
                            >
                                ปิด
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
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io, Socket } from 'socket.io-client'; // ADDED: Import socket.io
import Swal from 'sweetalert2';
import './CustomerBillPage.css'; 
import { FaArrowLeft, FaBell } from 'react-icons/fa';

// --- Interfaces (ควรแยกไปไฟล์กลาง) ---
interface ActiveOrder {
    order_id: number;
    table_id: number;
    table_number: number;
    uuid: string;
}

interface OrderDetailItem {
    order_detail_id: number;
    menu_name: string;
    quantity: number;
    item_status: string;
    price_per_item: number;
    customer_name?: string; // (มีอยู่แล้วจากครั้งก่อน)
    menu_image?: string;
}

// ============================
//   Customer Bill Page Component
// ============================
const CustomerBillPage = () => {
    const { uuid } = useParams<{ uuid: string }>();
    const navigate = useNavigate();
    const [orderInfo, setOrderInfo] = useState<ActiveOrder | null>(null);
    const [allOrderItems, setAllOrderItems] = useState<OrderDetailItem[]>([]);
    // [ลบ] เราไม่จำเป็นต้องใช้ state นี้แล้ว ถ้าจะไม่แสดงใน Header
    // const [sessionCustomerName, setSessionCustomerName] = useState<string | null>(null); 
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    
    // ADDED: Memoized socket instance
    const socket = useMemo(() => {
        return io(apiUrl, {
            autoConnect: false, // [แก้ไข] ไม่ต้องเชื่อมต่ออัตโนมัติ
            reconnection: true,
            reconnectionAttempts: 5,
        });
    }, [apiUrl]);
    
    // 2. useEffect สำหรับการเชื่อมต่อ Socket
    useEffect(() => {
        socket.connect();
        return () => {
            socket.disconnect();
        };
    }, [socket]); // ทำงานแค่ครั้งเดียว

    // 3. useEffect หลักสำหรับ Fetch ข้อมูล
    useEffect(() => {
        const fetchData = async () => {
            if (!uuid) {
                setError("ไม่พบรหัสโต๊ะ (UUID)");
                setLoading(false);
                return;
            }
            try {
                // 1. หา Order ID ก่อน
                const activeOrdersRes = await axios.get<ActiveOrder[]>(`${apiUrl}/api/orders/active`);
                const currentOrder = activeOrdersRes.data.find(o => o.uuid === uuid);

                if (!currentOrder) {
                    setError("ไม่พบออเดอร์สำหรับโต๊ะนี้ หรือโต๊ะถูกปิดไปแล้ว");
                    setLoading(false);
                    return;
                }
                setOrderInfo(currentOrder); // <--- ตั้งค่า orderInfo ที่นี่
            } catch (err) {
                setError("ไม่สามารถโหลดข้อมูลออเดอร์ได้ กรุณาลองใหม่อีกครั้ง");
                console.error("Error fetching active order:", err);
                setLoading(false);
            }
        };
        
        fetchData();
        
        // [ลบ] เราไม่จำเป็นต้องดึงชื่อมาแสดงใน Header นี้แล้ว
        // const storedName = localStorage.getItem(`customerName-${uuid}`);
        // ...

    }, [uuid, apiUrl]);

    // 4. [แก้ไข] useEffect นี้จะทำงาน *หลังจาก* ที่เราได้ orderInfo แล้ว
    useEffect(() => {
        if (!orderInfo) {
            // ถ้ารอบแรกยังไม่มี orderInfo หรือหาไม่เจอ ก็ไม่ต้องทำอะไร
            if (!loading && !error) { // ถ้าโหลดเสร็จแล้วแต่ยังไม่มี orderInfo
                setError("ไม่พบข้อมูลออเดอร์");
            }
            return;
        }

        // Function สำหรับดึงรายละเอียดออเดอร์
        const fetchOrderDetails = async () => {
            try {
                const detailsRes = await axios.get<OrderDetailItem[]>(`${apiUrl}/api/orders/${orderInfo.order_id}/details`);
                setAllOrderItems(detailsRes.data);
            } catch (err) {
                setError("ไม่สามารถโหลดรายละเอียดออเดอร์ได้ กรุณาลองใหม่อีกครั้ง");
                console.error("Error fetching order details:", err);
            } finally {
                setLoading(false); // สิ้นสุดการโหลดหลัก
            }
        };

        fetchOrderDetails(); // เรียกใช้งานทันที

        // --- Socket Listeners (ทำงานเมื่อมี orderInfo แล้ว) ---

        const handleNewOrderItem = (data: { orderId: number; items: any[] }) => {
            if (String(data.orderId) === String(orderInfo.order_id)) {
                fetchOrderDetails(); // ดึงใหม่ทั้งหมดเมื่อมีรายการเพิ่ม
            }
        };

        const handleItemStatusUpdate = (data: { detailId: number; newStatus: string }) => {
            setAllOrderItems(prevItems =>
                prevItems.map(item =>
                    item.order_detail_id === data.detailId
                        ? { ...item, item_status: data.newStatus }
                        : item
                )
            );
        };

        socket.on('new_order_item', handleNewOrderItem);
        socket.on('item_status_updated', handleItemStatusUpdate);

        return () => {
            socket.off('new_order_item', handleNewOrderItem);
            socket.off('item_status_updated', handleItemStatusUpdate);
        };
    }, [orderInfo, socket, apiUrl, loading, error]); // ทำงานเมื่อ orderInfo พร้อม

    // --- Memoized Grouping ---
    const makingItems = useMemo(() => {
        return allOrderItems.filter(item => item.item_status === 'กำลังจัดทำ');
    }, [allOrderItems]);

    const completedItems = useMemo(() => {
        return allOrderItems.filter(item => item.item_status === 'จัดส่งแล้ว');
    }, [allOrderItems]);

    const totalBillPrice = useMemo(() => {
        return allOrderItems.reduce((sum, item) => sum + item.price_per_item * item.quantity, 0);
    }, [allOrderItems]);
    
    // --- Handlers ---
    const handleCallStaff = () => {
        if (orderInfo) {
            socket.emit('call_for_bill', { 
                tableId: orderInfo.table_id, 
                tableNumber: orderInfo.table_number 
            });

            Swal.fire({
                title: 'เรียกพนักงานแล้ว!',
                text: `พนักงานกำลังจะไปที่โต๊ะ ${orderInfo.table_number} เพื่อชำระเงินค่ะ`,
                icon: 'success',
                timer: 3000,
                showConfirmButton: false,
            });
        } else {
            Swal.fire('ผิดพลาด', 'ไม่พบข้อมูลออเดอร์', 'error');
        }
    };

    // --- Render Logic ---
    if (loading) return <div className="bill-loading-container">กำลังโหลด...</div>;
    if (error) return <div className="bill-error-container">{error}</div>;

    const renderOrderList = (items: OrderDetailItem[], title: string, status: 'making' | 'completed') => (
        <div className="order-card">
            <div className="order-card-header">
                <h3>{title}</h3>
                <span className={`status-badge ${status}`}>{status === 'making' ? 'making' : 'Completed'}</span>
            </div>
            {items.map(item => (
                <div key={item.order_detail_id} className="bill-item-row">
                    <img
                        src={item.menu_image ? `data:image/png;base64,${item.menu_image}` : '/path/to/placeholder.png'}
                        alt={item.menu_name || 'อาหาร'}
                        className="bill-item-image"
                    />
                    <span className="bill-item-name">
                        {item.menu_name || '(เมนูถูกลบ)'}
                        {item.customer_name && <span className="bill-item-customer"> (สั่งโดย: {item.customer_name})</span>}
                    </span>
                    <span className="bill-item-quantity">X {item.quantity}</span>
                </div>
            ))}
            <div className="bill-item-total">
                Total {items.reduce((sum, item) => sum + item.quantity, 0)}
            </div>
        </div>
    );

    return (
        <div className="bill-page-container">
            <header className="bill-header">
                <button onClick={() => navigate(`/order/${uuid}`)} className="bill-back-button">
                    <FaArrowLeft /> Back
                </button>
                 {/* --- [แก้ไข] ลบการแสดงชื่อลูกค้าออก --- */}
                <h2>รายการอาหาร</h2>
                <div style={{ width: '80px' }}></div> {/* Spacer */}
            </header>

            <main className="bill-body">
                {makingItems.length > 0 && renderOrderList(makingItems, 'รายการที่กำลังทำ', 'making')}
                {completedItems.length > 0 && renderOrderList(completedItems, 'รายการที่จัดส่งแล้ว', 'completed')}
                {allOrderItems.length === 0 && (
                     <p className="empty-bill-message">ยังไม่มีรายการอาหารที่สั่ง</p>
                )}
            </main>

            <footer className="bill-footer">
                <div className="bill-total-summary">
                    <span>ราคารวมทั้งหมด:</span>
                    <span className="total-price">฿{totalBillPrice.toLocaleString()}</span>
                </div>
                <button className="food-bill-button" onClick={handleCallStaff}>
                    <FaBell /> เรียกพนักงานเช็คบิล
                </button>
            </footer>
        </div>
    );
};

export default CustomerBillPage;
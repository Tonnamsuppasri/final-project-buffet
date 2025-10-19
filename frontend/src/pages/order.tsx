import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './order.css';
import { socket } from '../components/menu'; 

// --- Interfaces ---
interface ActiveOrderData {
    order_id: number;
    table_number: number;
    start_time: string;
    order_status: string;
}

interface OrderDetail {
    order_detail_id: number;
    quantity: number;
    item_status: 'กำลังจัดทำ' | 'จัดส่งแล้ว';
    created_at: string;
    menu_name: string;
    menu_image: string | null; 
}

// --- Helper Functions ---
const formatTimeAgo = (isoString: string): string => {
    if (!isoString) return ''; 
    
    const compatibleTimestamp = isoString.replace(' ', 'T');
    const date = new Date(compatibleTimestamp);
    if (isNaN(date.getTime())) return ''; 

    const now = new Date();
    const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
    const minutes = Math.round(seconds / 60);

    if (minutes < 1) return "เมื่อสักครู่";
    if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
    const days = Math.round(hours / 24);
    return `${days} วันที่แล้ว`;
};

// --- Sub-Components ---
const LoadingSpinner = () => (
    <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
    </div>
);

const EmptyState = () => (
    <div className="text-center py-20 px-6 bg-white rounded-lg shadow-sm">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="mt-2 text-lg font-medium text-gray-900">ไม่มีออเดอร์</h3>
        <p className="mt-1 text-sm text-gray-500">ยังไม่มีออเดอร์ที่กำลังใช้บริการในขณะนี้</p>
    </div>
);


// --- Order Details Modal Component ---
const OrderDetailsModal = ({
    order,
    onClose,
    apiUrl,
    socket
}: {
    order: ActiveOrderData;
    onClose: () => void;
    apiUrl: string;
    socket: any;
}) => {
    const [details, setDetails] = useState<OrderDetail[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchDetails = useCallback(async () => {
        setLoading(true);
        try {
            const response = await axios.get<OrderDetail[]>(`${apiUrl}/api/orders/${order.order_id}/details`);
            setDetails(response.data);
        } catch (error) {
            console.error("Error fetching order details:", error);
        } finally {
            setLoading(false);
        }
    }, [apiUrl, order.order_id]); 

    useEffect(() => {
        fetchDetails(); 

        const handleNewItem = (data: { orderId: number }) => {
            if (data.orderId === order.order_id) {
                console.log('🎉 Socket (Modal): new_order_item. Refetching details...');
                fetchDetails();
            }
        };

        const handleItemStatus = () => {
            console.log('🎉 Socket (Modal): item_status_updated. Refetching details...');
            fetchDetails();
        };

        socket.on('new_order_item', handleNewItem);
        socket.on('item_status_updated', handleItemStatus);

        return () => {
            socket.off('new_order_item', handleNewItem);
            socket.off('item_status_updated', handleItemStatus);
        };
    }, [order.order_id, socket, fetchDetails]); 

    const handleDeliverItem = async (detailId: number) => {
        try {
            setDetails(prevDetails =>
                prevDetails.map(item =>
                    item.order_detail_id === detailId
                        ? { ...item, item_status: 'จัดส่งแล้ว' }
                        : item
                )
            );
            await axios.put(`${apiUrl}/api/order-details/${detailId}/deliver`);
        } catch (error) {
            console.error("Error delivering item:", error);
            fetchDetails(); 
        }
    };

    const pendingItems = details.filter(item => item.item_status === 'กำลังจัดทำ');
    const deliveredItems = details.filter(item => item.item_status === 'จัดส่งแล้ว');

    return (
        <div className="modal-backdrop">
            <div className="modal-content">
                <div className="modal-header">
                    <h2 className="text-2xl font-bold">รายละเอียดออเดอร์ (โต๊ะ {order.table_number})</h2>
                    <button onClick={onClose} className="modal-close-btn">&times;</button>
                </div>
                
                {loading ? (
                    <LoadingSpinner />
                ) : (
                    <div className="modal-body">
                        {/* --- Section: Pending Items --- */}
                        <h3 className="text-lg font-semibold mb-3 text-red-600">รายการที่ต้องจัดทำ ({pendingItems.length})</h3>
                        {pendingItems.length > 0 ? (
                            <ul className="divide-y divide-gray-200 mb-6">
                                {pendingItems.map(item => (
                                    <li key={item.order_detail_id} className="modal-list-item">
                                        <div className="modal-item-details">
                                            <img 
                                                src={item.menu_image ? `data:image/png;base64,${item.menu_image}` : 'https://via.placeholder.com/60'} 
                                                alt={item.menu_name} 
                                                className="modal-item-image"
                                            />
                                            <div className="item-info">
                                                <span className="font-bold text-lg">{item.menu_name} (x{item.quantity})</span>
                                                <span className="text-sm text-gray-500">สั่งเมื่อ: {formatTimeAgo(item.created_at)}</span>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleDeliverItem(item.order_detail_id)}
                                            className="btn-deliver"
                                        >
                                            จัดส่งแล้ว
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                             <p className="text-center text-gray-500 mb-6">ไม่มีรายการที่ต้องจัดทำ</p>
                        )}

                        {/* --- Section: Delivered Items --- */}
                        <h3 className="text-lg font-semibold mb-3 text-green-600">รายการที่จัดส่งแล้ว ({deliveredItems.length})</h3>
                        {deliveredItems.length > 0 ? (
                            <ul className="divide-y divide-gray-200">
                                {deliveredItems.map(item => (
                                    <li key={item.order_detail_id} className="modal-list-item-delivered">
                                        <div className="modal-item-details">
                                            <img 
                                                src={item.menu_image ? `data:image/png;base64,${item.menu_image}` : 'https://via.placeholder.com/60'} 
                                                alt={item.menu_name} 
                                                className="modal-item-image"
                                            />
                                            <div className="item-info">
                                                <span className="font-bold text-gray-500">{item.menu_name} (x{item.quantity})</span>
                                                <span className="text-sm text-gray-400">สั่งเมื่อ: {formatTimeAgo(item.created_at)}</span>
                                            </div>
                                        </div>
                                        <span className="status-delivered">
                                            ✔️ จัดส่งแล้ว
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-center text-gray-500">ยังไม่มีรายการที่จัดส่ง</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};


// --- Main Page Component ---
const OrderPage = () => {
    const [activeOrders, setActiveOrders] = useState<ActiveOrderData[]>([]);
    const [loading, setLoading] = useState(true);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<ActiveOrderData | null>(null);

    const [newNotificationOrderIds, setNewNotificationOrderIds] = useState<number[]>([]);

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

    const fetchActiveOrders = useCallback(async () => {
        try {
            const response = await axios.get<ActiveOrderData[]>(`${apiUrl}/api/orders/active`);
            const sortedOrders = response.data.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
            setActiveOrders(sortedOrders);
        } catch (error) {
            console.error("Error fetching active orders:", error);
        } finally {
            setLoading(false);
        }
    }, [apiUrl]); 
    

    useEffect(() => {
        fetchActiveOrders(); 

        const handleOrdersUpdate = () => {
            console.log('🎉 Socket (Main): tables_updated. Refetching active orders...');
            fetchActiveOrders();
        };

        // ✅ --- START: นี่คือจุดที่แก้ไข ---
        // เปลี่ยน Type ของ data.orderId ให้รับ string หรือ number ก็ได้
        const handleNewItem = (data: { orderId: string | number }) => { 
            if (data && data.orderId) {
                // แปลงค่าที่ได้รับ (ไม่ว่าจะเป็น string หรือ number) ให้เป็น Number เสมอ
                const numericOrderId = Number(data.orderId); 
                
                console.log(`🎉 Socket (Main): new_order_item for ${numericOrderId}. Adding badge.`);
                
                // เก็บ numericOrderId (ที่เป็น Number) ลงใน State
                setNewNotificationOrderIds(prev => [...new Set([...prev, numericOrderId])]);
            }
        };
        // ✅ --- END: จุดที่แก้ไข ---

        socket.on('tables_updated', handleOrdersUpdate);
        socket.on('new_order_item', handleNewItem); 

        return () => {
            socket.off('tables_updated', handleOrdersUpdate);
            socket.off('new_order_item', handleNewItem); 
        };
    }, [fetchActiveOrders]); 

    const getStatusChipClass = (status: string) => {
        if (!status) {
            return "bg-gray-100 text-gray-800";
        }
        switch (status.toLowerCase()) {
            case 'in-progress':
                return "bg-blue-100 text-blue-800";
            case 'wait-for-bill':
                return "bg-yellow-100 text-yellow-800";
            default:
                return "bg-gray-100 text-gray-800";
        }
    };

    const handleViewDetails = (order: ActiveOrderData) => {
        // (ส่วนนี้ถูกต้องแล้ว เพราะ order.order_id เป็น Number และใน State ก็เป็น Number)
        setNewNotificationOrderIds(prev => prev.filter(id => id !== order.order_id));
        
        setSelectedOrder(order);
        setShowDetailModal(true);
    };

    const handleCloseModal = () => {
        setShowDetailModal(false);
        setSelectedOrder(null);
    };


    return (
        <div className="order-container">
            <header className="order-header sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-20">
                        <h1 className="text-3xl font-bold text-gray-900">
                            ออเดอร์ปัจจุบัน
                            {!loading && <span className="ml-2 text-lg font-medium text-gray-500">({activeOrders.length})</span>}
                        </h1>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {loading ? (
                    <LoadingSpinner />
                ) : activeOrders.length === 0 ? (
                    <EmptyState />
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {activeOrders.map(order => (
                            <div key={order.order_id} className="order-card bg-white rounded-xl shadow-md overflow-hidden flex flex-col">
                                <div className="p-6 flex-grow">
                                    <div className="flex justify-between items-start">
                                        
                                        <div className="relative bg-gray-800 text-white rounded-lg w-16 h-16 flex flex-col items-center justify-center">
                                            <span className="text-sm -mb-1">โต๊ะ</span>
                                            <span className="text-3xl font-bold">{order.table_number}</span>
                                            
                                            {/* (ส่วนนี้ถูกต้องแล้ว) */}
                                            {newNotificationOrderIds.includes(order.order_id) && (
                                                <span className="order-card-badge"></span>
                                            )}
                                        </div>
                                        
                                        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${getStatusChipClass(order.order_status)}`}>
                                            {order.order_status === 'in-progress' ? 'กำลังใช้บริการ' : (order.order_status || 'ไม่มีสถานะ')}
                                        </span>
                                    </div>
                                    <div className="mt-4">
                                        <p className="text-sm text-gray-500">
                                            เริ่มเมื่อ: {new Date(order.start_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                                        </p>
                                        <p className="text-sm text-gray-400">
                                            ({formatTimeAgo(order.start_time)})
                                        </p>
                                    </div>
                                </div>
                                <div className="px-6 pb-4">
                                    <button 
                                        onClick={() => handleViewDetails(order)}
                                        className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
                                    >
                                        ดูรายละเอียด
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {showDetailModal && selectedOrder && (
                <OrderDetailsModal
                    order={selectedOrder}
                    onClose={handleCloseModal}
                    apiUrl={apiUrl}
                    socket={socket} 
                />
            )}
        </div>
    );
}

export default OrderPage;
import { useState, useEffect, useCallback, type FormEvent } from 'react'; // ✅ 1. เพิ่ม useCallback
import axios from 'axios';
import './PaymentPage.css'; // เราจะใช้ไฟล์ CSS ที่รวมกันแล้ว
import { socket } from '../components/menu'; // ✅ 1. Import socket


// --- Interfaces (รวมจากทั้ง 2 ไฟล์) ---
interface PaymentHistoryItem {
    payment_id: number;
    order_id: number;
    payment_time: string;
    total_price: number;
    payment_method: string;
    table_number: number;
    customer_quantity: number;
}

interface PaymentDetails {
    payment_id: number;
    order_id: number;
    payment_time: string;
    total_price: string;
    payment_method: string;
    customer_quantity: number;
    service_type: string;
    start_time: string;
    table_number: number;
    plan_name: string;
}

interface MenuItem {
    quantity: number;
    price_per_item: string;
    menu_name: string;
}

interface PaymentDetailData {
    details: PaymentDetails;
    menuItems: MenuItem[];
}

// --- Main Component ---
const PaymentPage = () => {
    // State สำหรับควบคุมการแสดงผล
    const [view, setView] = useState<'list' | 'detail'>('list');
    const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null);

    // URL ของ API
    const apiUrl = 'http://localhost:3001';

    // --- Helper Function ---
    const formatDateTime = (isoString: string, style: 'short' | 'medium' = 'short') => {
        if (!isoString) return 'N/A';
        const date = new Date(isoString);
        if (style === 'short') {
            return date.toLocaleString('th-TH', {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit',
            });
        }
        return date.toLocaleString('th-TH', {
            dateStyle: 'medium',
            timeStyle: 'short',
        });
    };

    // =================================================================
    // View: List (Payment History)
    // =================================================================
    const [payments, setPayments] = useState<PaymentHistoryItem[]>([]);
    const [listLoading, setListLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // ✅ 3. หุ้ม fetchPayments ด้วย useCallback
    const fetchPayments = useCallback(async () => {
        setListLoading(true);
        try {
            const params = new URLSearchParams();
            if (searchTerm) params.append('searchTerm', searchTerm);
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            
            const response = await axios.get<PaymentHistoryItem[]>(`${apiUrl}/api/payments`, { params });
            setPayments(response.data);
            setListError(null);
        } catch (err) {
            setListError("ไม่สามารถโหลดข้อมูลการชำระเงินได้");
        } finally {
            setListLoading(false);
        }
    }, [apiUrl, searchTerm, startDate, endDate]); // ระบุ dependencies

    // ✅ 4. แก้ไข useEffect นี้ให้รวม Socket.IO
    useEffect(() => {
        if (view === 'list') {
            // 1. ดึงข้อมูลครั้งแรก (หรือเมื่อ filter เปลี่ยน)
            fetchPayments();

            // 2. ฟังก์ชัน handler สำหรับ Socket
            const handleNewPayment = () => {
                console.log('🎉 Socket event: new_payment. Refetching payment list...');
                // เรียก fetchPayments() ซึ่งจะใช้ filter ปัจจุบัน
                fetchPayments();
            };

            // 3. เริ่มดักฟัง
            socket.on('new_payment', handleNewPayment);

            // 4. Cleanup: หยุดดักฟังเมื่อ unmount หรือ view เปลี่ยน
            return () => {
                socket.off('new_payment', handleNewPayment);
            };
        }
    }, [view, fetchPayments]); // ทำงานใหม่เมื่อ view เปลี่ยน หรือ filter เปลี่ยน

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchPayments();
    };

    const handleRowClick = (paymentId: number) => {
        setSelectedPaymentId(paymentId);
        setView('detail');
    };

    // =================================================================
    // View: Detail (Payment Detail)
    // =================================================================
    const [detailData, setDetailData] = useState<PaymentDetailData | null>(null);
    const [detailLoading, setDetailLoading] = useState(true);
    const [detailError, setDetailError] = useState<string | null>(null);

    useEffect(() => {
        if (view === 'detail' && selectedPaymentId) {
            const fetchPaymentDetail = async () => {
                setDetailLoading(true);
                try {
                    const response = await axios.get<PaymentDetailData>(`${apiUrl}/api/payments/${selectedPaymentId}`);
                    setDetailData(response.data);
                    setDetailError(null);
                } catch (err) {
                    setDetailError("ไม่พบข้อมูลการชำระเงิน หรือเกิดข้อผิดพลาด");
                } finally {
                    setDetailLoading(false);
                }
            };
            fetchPaymentDetail();
        }
    }, [view, selectedPaymentId]); // โค้ดส่วนนี้เหมือนเดิม

    const handleBackToList = () => {
        setView('list');
        setSelectedPaymentId(null);
        setDetailData(null); // เคลียร์ข้อมูลเก่า
    };

    // --- Render Logic ---
    if (view === 'list') {
        return (
            <div className="payment-history-container">
                <h1 className="text-4xl font-bold mb-6">ประวัติการชำระเงิน</h1>
                <form onSubmit={handleSearch} className="search-form mb-6">
                    <input type="text" placeholder="ค้นหา Order ID, โต๊ะ, ช่องทาง..." className="search-input" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    <input type="date" className="date-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    <input type="date" className="date-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    <button type="submit" className="search-button">ค้นหา</button>
                </form>

                {listError && <p className="error-message">{listError}</p>}

                <div className="table-wrapper">
                    <table className="payment-table">
                        <thead>
                            <tr>
                                <th>Order ID</th>
                                <th>โต๊ะ</th>
                                <th>จำนวนลูกค้า</th>
                                <th>เวลาที่ชำระ</th>
                                <th>ช่องทาง</th>
                                <th style={{ textAlign: 'right' }}>ยอดรวม (บาท)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {listLoading ? (
                                <tr><td colSpan={6} className="loading-cell">กำลังโหลด...</td></tr>
                            ) : payments.length > 0 ? (
                                payments.map((payment) => (
                                    <tr key={payment.payment_id} onClick={() => handleRowClick(payment.payment_id)} className="clickable-row">
                                        <td>#{payment.order_id}</td>
                                        <td>{payment.table_number}</td>
                                        <td>{payment.customer_quantity} คน</td>
                                        <td>{formatDateTime(payment.payment_time, 'short')}</td>
                                        <td>{payment.payment_method || 'ไม่ระบุ'}</td>
                                        <td className="price-cell">{Number(payment.total_price).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={6} className="no-results-cell">ไม่พบข้อมูล</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    if (view === 'detail') {
        return (
            <div className="payment-detail-container">
                <button onClick={handleBackToList} className="back-link">
                    &larr; กลับไปที่ประวัติการชำระเงิน
                </button>

                {detailLoading && <h1 className="text-3xl font-bold mt-4">กำลังโหลดรายละเอียด...</h1>}
                {detailError && <h1 className="text-3xl font-bold text-red-500 mt-4">{detailError}</h1>}
                
                {detailData && (
                    <>
                        <h1 className="text-4xl font-bold mt-4 mb-6">
                            รายละเอียดบิล (Order #{detailData.details.order_id})
                        </h1>
                        <div className="details-grid">
                            <div className="detail-card">
                                <h2 className="card-title">ข้อมูลการชำระเงิน</h2>
                                <div className="card-content">
                                    <p><strong>Payment ID:</strong> {detailData.details.payment_id}</p>
                                    <p><strong>โต๊ะ:</strong> {detailData.details.table_number}</p>
                                    <p><strong>เวลาเปิดโต๊ะ:</strong> {formatDateTime(detailData.details.start_time, 'medium')}</p>
                                    <p><strong>เวลาชำระเงิน:</strong> {formatDateTime(detailData.details.payment_time, 'medium')}</p>
                                    <p><strong>ช่องทาง:</strong> {detailData.details.payment_method || 'ไม่ระบุ'}</p>
                                    <p className="total-price">
                                        <strong>ยอดรวม:</strong>
                                        <span>{Number(detailData.details.total_price).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</span>
                                    </p>
                                </div>
                            </div>
                            <div className="detail-card">
                                <h2 className="card-title">ข้อมูลออเดอร์</h2>
                                <div className="card-content">
                                    <p><strong>บริการ:</strong> {detailData.details.service_type}</p>
                                    <p><strong>โปรโมชัน:</strong> {detailData.details.plan_name}</p>
                                    <p><strong>จำนวนลูกค้า:</strong> {detailData.details.customer_quantity} คน</p>
                                </div>
                            </div>
                        </div>
                        <div className="detail-card menu-items-card">
                            <h2 className="card-title">รายการอาหารที่สั่ง</h2>
                            <div className="card-content">
                                {detailData.menuItems.length > 0 ? (
                                    <ul className="menu-list">
                                        {detailData.menuItems.map((item, index) => (
                                            <li key={index} className="menu-item">
                                                <span className="menu-name">{item.menu_name}</span>
                                                <span className="menu-qty">x{item.quantity}</span>
                                                <span className="menu-price">
                                                    {(Number(item.price_per_item) * item.quantity).toLocaleString('th-TH')} บาท
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p style={{padding: '1rem'}}>ไม่มีข้อมูลรายการอาหารที่สั่งเพิ่มเติม</p>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        );
    }

    return null; // Fallback
};

export default PaymentPage;
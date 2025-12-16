import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import './PaymentPage.css';

// Interface ข้อมูลการชำระเงินหลัก
interface PaymentData {
    payment_id: number;
    order_id: number;
    payment_time: string;
    total_price: number;
    discount: number;
    payment_method: string | null;
    table_number: number;
    customer_quantity: number;
    plan_name: string;
    price_per_person: number;
}

// Interface รายการอาหารย่อย (สำหรับ Modal)
interface OrderDetailItem {
    menu_name: string;
    quantity: number;
    price_per_item: number;
}

const PaymentPage: React.FC = () => {
    // --- States ---
    const [payments, setPayments] = useState<PaymentData[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Search & Filter
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Pagination States (เพิ่มใหม่)
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10; // กำหนดให้แสดงหน้าละ 10 รายการ

    // Modal States
    const [showModal, setShowModal] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState<PaymentData | null>(null);
    const [orderItems, setOrderItems] = useState<OrderDetailItem[]>([]);
    const [modalLoading, setModalLoading] = useState(false);

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

    // --- Fetch Payments ---
    const fetchPayments = async (filters?: { searchTerm?: string; startDate?: string; endDate?: string }) => {
        setLoading(true);
        setError(null);
        try {
            const params: any = {};
            const currentSearchTerm = filters?.searchTerm !== undefined ? filters.searchTerm : searchTerm;
            const currentStartDate = filters?.startDate !== undefined ? filters.startDate : startDate;
            const currentEndDate = filters?.endDate !== undefined ? filters.endDate : endDate;

            if (currentSearchTerm) params.searchTerm = currentSearchTerm;
            if (currentStartDate) params.startDate = currentStartDate;
            if (currentEndDate) params.endDate = currentEndDate;

            const response = await axios.get<PaymentData[]>(`${apiUrl}/api/payments`, { params });

            const formattedData = response.data.map(item => ({
                ...item,
                discount: Number(item.discount || 0),
                total_price: Number(item.total_price || 0),
                price_per_person: Number(item.price_per_person || 0)
            }));

            formattedData.sort((a, b) => new Date(b.payment_time).getTime() - new Date(a.payment_time).getTime());

            setPayments(formattedData);
            setCurrentPage(1); 
        } catch (err) {
            console.error("Fetch error:", err);
            setError('ไม่สามารถโหลดข้อมูลการชำระเงินได้');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPayments();
    }, [startDate, endDate]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchPayments();
    };

    const handleReset = () => {
        setSearchTerm('');
        setStartDate('');
        setEndDate('');
        fetchPayments({ searchTerm: '', startDate: '', endDate: '' });
    };

    // --- Pagination Logic (เพิ่มใหม่) ---
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentPayments = payments.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(payments.length / itemsPerPage);

    const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

    // --- Handle View Details ---
    const handleViewDetails = async (payment: PaymentData) => {
        setSelectedPayment(payment);
        setShowModal(true);
        setModalLoading(true);
        setOrderItems([]);

        try {
            const res = await axios.get(`${apiUrl}/api/orders/${payment.order_id}/details`);
            setOrderItems(res.data);
        } catch (error) {
            console.error("Error fetching details", error);
            Swal.fire('Error', 'ไม่สามารถดึงรายละเอียดบิลได้', 'error');
        } finally {
            setModalLoading(false);
        }
    };

    const closeModal = () => {
        setShowModal(false);
        setSelectedPayment(null);
    };

    // --- Summary Calculations ---
    const totalRevenue = payments.reduce((sum, p) => sum + p.total_price, 0);
    const totalDiscountAll = payments.reduce((sum, p) => sum + p.discount, 0);

    // --- Render Card View (ใช้ currentPayments แทน payments) ---
    const renderCardView = () => (
        <div className="payment-card-view">
            {currentPayments.map((payment) => (
                <div key={payment.payment_id} className="payment-card">
                    <div className="payment-card-header">
                        <span className="payment-card-id">#{payment.payment_id}</span>
                        <span className="payment-card-time">
                            {payment.payment_time ? format(new Date(payment.payment_time), 'dd/MM/yy HH:mm', { locale: th }) : '-'}
                        </span>
                    </div>

                    <div className="payment-card-body">
                        <div className="payment-card-field">
                            <span className="payment-card-label">โต๊ะ</span>
                            <span className="badge-table">T{payment.table_number}</span>
                        </div>

                        <div className="payment-card-field">
                            <span className="payment-card-label">วิธีชำระ</span>
                            <span className={`badge-method ${payment.payment_method === 'โอนจ่าย' ? 'transfer' : 'cash'}`}>
                                {payment.payment_method || '-'}
                            </span>
                        </div>

                        <div className="payment-card-field" style={{ gridColumn: '1 / -1' }}>
                            <span className="payment-card-label">ยอดสุทธิ</span>
                            <span className="payment-card-price">฿{payment.total_price.toLocaleString()}</span>
                        </div>
                    </div>

                    <div className="payment-card-footer">
                        <button onClick={() => handleViewDetails(payment)} className="btn-view-details">
                            📄 ดูรายละเอียด
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );

    // --- Render Table View (ใช้ currentPayments แทน payments) ---
    const renderTableView = () => (
        <div className="table-responsive shadow-sm rounded-lg">
            <table className="payment-table">
                <thead>
                    <tr>
                        <th>#ID</th>
                        <th>เวลา</th>
                        <th>โต๊ะ</th>
                        <th>ยอดสุทธิ</th>
                        <th>วิธีชำระ</th>
                        <th>จัดการ</th>
                    </tr>
                </thead>
                <tbody>
                    {currentPayments.map((payment) => (
                        <tr key={payment.payment_id} className="hover-row">
                            <td className="font-mono text-gray-500">#{payment.payment_id}</td>
                            <td>{payment.payment_time ? format(new Date(payment.payment_time), 'dd/MM/yyyy HH:mm', { locale: th }) : '-'}</td>
                            <td><span className="badge-table">T{payment.table_number}</span></td>
                            <td className="font-bold text-green-600">{payment.total_price.toLocaleString()}</td>
                            <td><span className={`badge-method ${payment.payment_method === 'โอนจ่าย' ? 'transfer' : 'cash'}`}>{payment.payment_method || '-'}</span></td>
                            <td>
                                <button onClick={() => handleViewDetails(payment)} className="btn-view-details">
                                    📄 รายละเอียด
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    // --- Render Pagination Controls ---
    const renderPagination = () => {
        if (totalPages <= 1) return null;

        const pageNumbers = [];
        // สร้าง array เลขหน้า (แบบง่าย)
        for (let i = 1; i <= totalPages; i++) {
            pageNumbers.push(i);
        }

        // Logic การแสดงเลขหน้าแบบย่อ ถ้าหน้าเยอะเกินไป
        let displayPages = pageNumbers;
        if (totalPages > 5) {
            if (currentPage <= 3) {
                displayPages = [...pageNumbers.slice(0, 5)];
            } else if (currentPage >= totalPages - 2) {
                displayPages = [...pageNumbers.slice(totalPages - 5)];
            } else {
                displayPages = pageNumbers.slice(currentPage - 3, currentPage + 2);
            }
        }

        return (
            <div className="pagination-container">
                <button 
                    className="page-btn nav-btn" 
                    onClick={() => paginate(currentPage - 1)} 
                    disabled={currentPage === 1}
                >
                    &lt;
                </button>
                
                {displayPages.map(number => (
                    <button
                        key={number}
                        onClick={() => paginate(number)}
                        className={`page-btn ${currentPage === number ? 'active' : ''}`}
                    >
                        {number}
                    </button>
                ))}

                <button 
                    className="page-btn nav-btn" 
                    onClick={() => paginate(currentPage + 1)} 
                    disabled={currentPage === totalPages}
                >
                    &gt;
                </button>
                
                <span className="pagination-info">
                    หน้า {currentPage} จาก {totalPages}
                </span>
            </div>
        );
    };

    return (
        <div className="payment-container fade-in">
            <header className="payment-header">
                <div className="header-title">
                    <h1>💰 ประวัติการชำระเงิน</h1>
                    <p className="subtitle">รายการธุรกรรมทั้งหมด</p>
                </div>

                <div className="summary-cards">
                    <div className="card green">
                        <span className="card-label">ยอดขายสุทธิ</span>
                        <span className="card-value">฿{totalRevenue.toLocaleString()}</span>
                    </div>
                    <div className="card red">
                        <span className="card-label">ส่วนลดรวม</span>
                        <span className="card-value">฿{totalDiscountAll.toLocaleString()}</span>
                    </div>
                    <div className="card blue">
                        <span className="card-label">จำนวนบิล</span>
                        <span className="card-value">{payments.length}</span>
                    </div>
                </div>
            </header>

            <form className="payment-filters" onSubmit={handleSearch}>
                <div className="filter-group search-box">
                    <i className="fas fa-search"></i>
                    <input type="text" placeholder="ระบุเลขบิล, เบอร์โต๊ะ, วิธีชำระ หรือยอดเงิน..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <div className="filter-group date-picker">
                    <label>ตั้งแต่:</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="filter-group date-picker">
                    <label>ถึง:</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
                <div className="filter-actions">
                    <button type="submit" className="btn-search">ค้นหา</button>
                    <button type="button" className="btn-reset" onClick={handleReset}>ล้างค่า</button>
                </div>
            </form>

            {loading ? (
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>กำลังโหลด...</p>
                </div>
            ) : error ? (
                <div className="error-state">
                    <p>❌ {error}</p>
                </div>
            ) : payments.length === 0 ? (
                <div className="empty-state">
                    <p>ไม่พบข้อมูล</p>
                </div>
            ) : (
                <>
                    {/* Render Content */}
                    {renderTableView()}
                    {renderCardView()}

                    {/* ✅ เพิ่ม Pagination ตรงนี้ */}
                    {renderPagination()}
                </>
            )}

            {/* Modal Code (เหมือนเดิม) */}
            {showModal && selectedPayment && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 fade-in">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="text-xl font-bold text-gray-800">รายละเอียดบิล #{selectedPayment.payment_id}</h3>
                            <button onClick={closeModal} className="text-gray-400 hover:text-red-500 text-2xl">&times;</button>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            <div className="mb-4 text-sm text-gray-600">
                                <p><strong>วันที่:</strong> {format(new Date(selectedPayment.payment_time), 'dd MMMM yyyy HH:mm', { locale: th })}</p>
                                <p><strong>โต๊ะ:</strong> {selectedPayment.table_number}</p>
                                <p><strong>วิธีชำระ:</strong> {selectedPayment.payment_method}</p>
                            </div>

                            <div className="border rounded-lg p-3 bg-gray-50 mb-4">
                                <h4 className="font-semibold mb-2 border-b pb-1 text-gray-700">รายการบุฟเฟต์</h4>
                                <div className="flex justify-between text-sm mb-1">
                                    <span>{selectedPayment.plan_name} (x{selectedPayment.customer_quantity})</span>
                                    <span>{(selectedPayment.customer_quantity * selectedPayment.price_per_person).toLocaleString()}</span>
                                </div>
                            </div>

                            {modalLoading ? <p className="text-center py-4">กำลังโหลดรายการอาหาร...</p> : orderItems.length > 0 && (
                                <div className="border rounded-lg p-3 bg-gray-50 mb-4">
                                    <h4 className="font-semibold mb-2 border-b pb-1 text-gray-700">รายการสั่งเพิ่ม</h4>
                                    {orderItems.map((item, idx) => (
                                        <div key={idx} className="flex justify-between text-sm mb-1">
                                            <span>{item.menu_name} (x{item.quantity})</span>
                                            <span>{(item.quantity * item.price_per_item).toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="space-y-2 pt-4 border-t mt-2">
                                {(() => {
                                    const buffetTotal = selectedPayment.customer_quantity * selectedPayment.price_per_person;
                                    const alaCarteTotal = orderItems.reduce((sum, item) => sum + (item.quantity * item.price_per_item), 0);
                                    const grossTotal = buffetTotal + alaCarteTotal;

                                    return (
                                        <>
                                            <div className="flex justify-between text-gray-600">
                                                <span>รวมเป็นเงิน</span>
                                                <span>{grossTotal.toLocaleString()}</span>
                                            </div>

                                            {selectedPayment.discount > 0 && (
                                                <div className="flex justify-between text-red-500 font-medium">
                                                    <span>ส่วนลด</span>
                                                    <span>-{selectedPayment.discount.toLocaleString()}</span>
                                                </div>
                                            )}

                                            <div className="flex justify-between text-xl font-bold text-green-700 pt-2 border-t">
                                                <span>ยอดสุทธิ</span>
                                                <span>{selectedPayment.total_price.toLocaleString()} บาท</span>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>

                        <div className="p-4 border-t bg-gray-50 text-right">
                            <button onClick={closeModal} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg">ปิดหน้าต่าง</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PaymentPage;
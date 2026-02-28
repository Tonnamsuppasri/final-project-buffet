import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; 
import axios from 'axios';
import Swal from 'sweetalert2';
import './CustomerOrder.css'; 
import { 
    FaShoppingCart, 
    FaPlus, 
    FaMinus, 
    FaTimes, 
    FaReceipt,
    FaInfoCircle, 
    FaQrcode,
    FaUser,
    FaArrowLeft,
    FaListUl,
    FaChevronDown
} from 'react-icons/fa';
import QRCode from 'qrcode'; 
import { v4 as uuidv4 } from 'uuid'; 

// --- Interfaces ---
interface MenuItem {
    menu_id: number;
    menu_name: string;
    menu_description?: string;
    menu_category: string | null;
    price: number;
    menu_image?: string; 
}

interface ActiveOrder {
    order_id: number;
    table_id: number; 
    table_number: number;
    table_uuid: string; 
    service_type: string;
    customer_quantity: number;
    plan_name: string;
    price_per_person: number;
    start_time: string;
}

interface ShopInfo {
    shop_name: string;
    shop_logo: string | null;
}

interface CartItem extends MenuItem {
    quantity: number;
}

// --- Custom Hook: useSheetDrag (สำหรับการลากปิด Bottom Sheet) ---
const useSheetDrag = (onClose: () => void, isOpen: boolean) => {
    const [dragOffset, setDragOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const touchStartY = useRef<number | null>(null);

    useEffect(() => {
        if (isOpen) {
            setDragOffset(0);
            setIsDragging(false);
        }
    }, [isOpen]);

    const onTouchStart = (e: React.TouchEvent) => {
        touchStartY.current = e.targetTouches[0].clientY;
        setIsDragging(true);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        if (touchStartY.current === null) return;
        const currentY = e.targetTouches[0].clientY;
        const deltaY = currentY - touchStartY.current;
        if (deltaY > 0) setDragOffset(deltaY);
    };

    const onTouchEnd = () => {
        setIsDragging(false);
        touchStartY.current = null;
        if (dragOffset > 150) onClose();
        else setDragOffset(0);
    };

    const style: React.CSSProperties = {
        transform: `translateY(${dragOffset}px)`,
        transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
    };

    return { style, handlers: { onTouchStart, onTouchMove, onTouchEnd } };
};

// --- Timer Component ---
const Timer = ({ startTime }: { startTime: string }) => {
    const [elapsedTime, setElapsedTime] = useState('00:00');
    useEffect(() => {
        if (!startTime) return;
        const compatibleStartTime = startTime.replace(' ', 'T');
        const startDate = new Date(compatibleStartTime);
        if (isNaN(startDate.getTime())) {
             setElapsedTime('--:--');
             return;
        }
        const updateTimer = () => {
            const now = Date.now();
            const difference = now - startDate.getTime();
            if (difference < 0) {
                setElapsedTime('0 นาที');
                return;
            }
            const hours = Math.floor(difference / (1000 * 60 * 60));
            const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
            let displayTime = '';
            if (hours > 0) displayTime += `${hours} ชม. `;
            displayTime += `${minutes} นาที`;
            setElapsedTime(displayTime);
        };
        updateTimer(); 
        const timerInterval = setInterval(updateTimer, 60000); 
        return () => clearInterval(timerInterval);
    }, [startTime]);
    return <span>{elapsedTime}</span>;
};

// ============================
//   Customer Order Page Component
// ============================
const CustomerOrderPage = () => {
    const { order_uuid } = useParams<{ order_uuid: string }>(); 
    const navigate = useNavigate();
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const customerOrderUrlBase = (import.meta.env.VITE_CUSTOMER_URL || 'http://localhost:5173');

    // ✅ Refs สำหรับจัดการ Logic การยิง API และ Animation
    const joinStarted = useRef(false); 
    const cartButtonRef = useRef<HTMLButtonElement>(null);

    // --- State Management ---
    const [orderInfo, setOrderInfo] = useState<ActiveOrder | null>(null);
    const [shopInfo, setShopInfo] = useState<ShopInfo | null>(null); 
    const [menu, setMenu] = useState<MenuItem[]>([]);
    const [categories, setCategories] = useState<string[]>(['All']);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [sessionCustomerName, setSessionCustomerName] = useState<string | null>(null);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isInfoSheetOpen, setIsInfoSheetOpen] = useState(false);
    const [infoSheetView, setInfoSheetView] = useState<'details' | 'qr'>('details');
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
    const [isCategorySheetOpen, setIsCategorySheetOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // ✅ แก้ไข: โหลดตะกร้าจาก LocalStorage ทันทีที่เปิดหน้า (Lazy Initializer)
    const [cart, setCart] = useState<CartItem[]>(() => {
        if (!order_uuid) return [];
        const savedCart = localStorage.getItem(`cart-${order_uuid}`);
        try {
            return savedCart ? JSON.parse(savedCart) : [];
        } catch (e) {
            return [];
        }
    });

    // ✅ แก้ไข: บันทึกตะกร้าลง LocalStorage ทุกครั้งที่มีการเปลี่ยนแปลง
    useEffect(() => {
        if (order_uuid) {
            localStorage.setItem(`cart-${order_uuid}`, JSON.stringify(cart));
        }
    }, [cart, order_uuid]);

    // Body Scroll Lock เมื่อเปิด Sheet
    useEffect(() => {
        document.body.style.overflow = (isCartOpen || isInfoSheetOpen || isCategorySheetOpen) ? 'hidden' : 'unset';
        return () => { document.body.style.overflow = 'unset'; };
    }, [isCartOpen, isInfoSheetOpen, isCategorySheetOpen]);

    // ✅ แก้ไข: ระบบ Join Table ที่ป้องกันการรันลำดับชื่อซ้ำซ้อน
    const joinTable = async (orderId: number, tableUuid: string) => {
        const storedNameKey = `customerName-${tableUuid}`; 
        const storedNameData = localStorage.getItem(storedNameKey);

        // 1. ถ้ามีชื่อเดิมที่ถูกต้องอยู่แล้ว ให้ใช้ชื่อเดิมทันที
        if (storedNameData) {
            try {
                const data = JSON.parse(storedNameData);
                if (data.orderId === orderId) {
                    setSessionCustomerName(data.name);
                    return; 
                }
            } catch (e) { localStorage.removeItem(storedNameKey); }
        }

        // 2. ป้องกัน Race Condition จาก StrictMode หรือการกดรีเฟรชรัวๆ
        if (joinStarted.current || sessionCustomerName) return;
        joinStarted.current = true;

        let sessionId = sessionStorage.getItem(`my-session-${tableUuid}`);
        if (!sessionId) {
            sessionId = uuidv4(); 
            sessionStorage.setItem(`my-session-${tableUuid}`, sessionId);
        }
        
        try {
            const joinRes = await axios.post<{ customerName: string }>(
                `${apiUrl}/api/orders/${orderId}/join`,
                { sessionId },
                { withCredentials: true } 
            );
            const newName = joinRes.data.customerName; 
            localStorage.setItem(storedNameKey, JSON.stringify({ name: newName, orderId: orderId }));
            setSessionCustomerName(newName);
        } catch (err) {
            joinStarted.current = false; // ปลดล็อคหากพลาด เพื่อให้ลองใหม่ได้
            console.error(err);
        }
    };

    // โหลดข้อมูลออเดอร์และเมนู
    useEffect(() => {
        const fetchOrderSession = async () => {
            if (!order_uuid) {
                setError("ไม่พบรหัสออเดอร์");
                setLoading(false);
                return;
            }
            try {
                const response = await axios.get(`${apiUrl}/api/order-session/${order_uuid}`, { withCredentials: true });
                const { orderInfo, menu, shopInfo } = response.data;
                setOrderInfo(orderInfo);
                setMenu(menu);
                setShopInfo(shopInfo);
                setCategories(['All', ...Array.from(new Set(menu.map((i: any) => i.menu_category || 'อื่น ๆ')))] as string[]);
                await joinTable(orderInfo.order_id, orderInfo.table_uuid);
            } catch (err: any) {
                setError(err.response?.data?.error || "ไม่สามารถโหลดข้อมูลได้");
            } finally {
                setLoading(false);
            }
        };
        fetchOrderSession();
    }, [order_uuid]);

    // การคำนวณต่างๆ
    const filteredMenu = useMemo(() => selectedCategory === 'All' ? [] : menu.filter(item => (item.menu_category || 'อื่น ๆ') === selectedCategory), [menu, selectedCategory]);
    const groupedMenu = useMemo(() => {
        const groups: Record<string, MenuItem[]> = menu.reduce((acc, item) => {
            const category = item.menu_category || 'อื่น ๆ';
            if (!acc[category]) acc[category] = [];
            acc[category].push(item);
            return acc;
        }, {} as Record<string, MenuItem[]>);
        return categories.filter(cat => cat !== 'All').map(cat => ({ category: cat, items: groups[cat] || [] })).filter(g => g.items.length > 0);
    }, [menu, categories]);

    const totalCartItems = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
    const totalCartPrice = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);

    const handleAddToCart = (item: MenuItem, event: React.MouseEvent<HTMLButtonElement>) => {
        setCart(prev => {
            const existing = prev.find(i => i.menu_id === item.menu_id);
            return existing ? prev.map(i => i.menu_id === item.menu_id ? { ...i, quantity: i.quantity + 1 } : i) : [...prev, { ...item, quantity: 1 }];
        });

        // 🛒 การแสดงผลรูปภาพลอยไปที่ตะกร้า
        const cartRect = cartButtonRef.current?.getBoundingClientRect();
        const buttonRect = event.currentTarget.getBoundingClientRect(); 
        if (cartRect && buttonRect) {
            const flyer = document.createElement('img');
            flyer.src = item.menu_image ? `data:image/png;base64,${item.menu_image}` : '/path/to/placeholder.png';
            flyer.className = 'item-flyer-image'; 
            flyer.style.left = `${buttonRect.left + buttonRect.width / 2}px`;
            flyer.style.top = `${buttonRect.top + buttonRect.height / 2}px`;
            document.body.appendChild(flyer);
            setTimeout(() => {
                flyer.style.left = `${cartRect.left + cartRect.width / 2}px`;
                flyer.style.top = `${cartRect.top + cartRect.height / 2}px`;
                flyer.style.transform = 'translate(-50%, -50%) scale(0.1)';
                flyer.style.opacity = '0';
            }, 10); 
            flyer.addEventListener('transitionend', () => flyer.remove());
        }
        cartButtonRef.current?.classList.add('animating');
        setTimeout(() => cartButtonRef.current?.classList.remove('animating'), 500);
    };

    const handleUpdateQuantity = (menuId: number, change: number) => {
        setCart(prev => prev.map(i => i.menu_id === menuId ? { ...i, quantity: Math.max(0, i.quantity + change) } : i).filter(i => i.quantity > 0));
    };

    const handleSubmitOrder = async () => {
        if (cart.length === 0 || !orderInfo || !sessionCustomerName) return;
        const details = cart.map(i => ({ menu_id: i.menu_id, quantity: i.quantity, price_per_item: i.price, customer_name: sessionCustomerName }));
        try {
            await axios.post(`${apiUrl}/api/orders/${orderInfo.order_id}/details`, details, { withCredentials: true });
            Swal.fire({ icon: 'success', title: 'ส่งออเดอร์สำเร็จ!', timer: 2000, showConfirmButton: false });
            setCart([]); // เคลียร์ State -> useEffect จะล้าง LocalStorage ให้เอง
            setIsCartOpen(false);
        } catch { Swal.fire('ผิดพลาด!', 'ไม่สามารถส่งออเดอร์ได้', 'error'); }
    };

    const handleShowQRCode = async () => {
        if (!qrCodeDataUrl) {
            const qrUrl = await QRCode.toDataURL(`${customerOrderUrlBase}/order/${order_uuid}`, { width: 250, margin: 2 });
            setQrCodeDataUrl(qrUrl);
        }
        setInfoSheetView('qr');
    };

    const cartDrag = useSheetDrag(() => setIsCartOpen(false), isCartOpen);
    const infoDrag = useSheetDrag(() => setIsInfoSheetOpen(false), isInfoSheetOpen);
    const categoryDrag = useSheetDrag(() => setIsCategorySheetOpen(false), isCategorySheetOpen);

    if (loading) return <div className="loading-container">กำลังโหลด...</div>;
    if (error || !orderInfo || !sessionCustomerName) return <div className="error-container">{error || 'กำลังลงทะเบียน...'}</div>;

    const MenuItemCard = ({ item }: { item: MenuItem }) => (
        <div key={item.menu_id} className="menu-item-list">
            <img src={item.menu_image ? `data:image/png;base64,${item.menu_image}` : '/path/to/placeholder.png'} alt={item.menu_name} className="menu-item-image" />
            <div className="menu-item-details">
                <h3 className="menu-item-name">{item.menu_name}</h3>
                <p className="menu-item-desc">{item.menu_description}</p>
            </div>
            <div className="menu-item-actions">
                <span className="menu-item-price">฿{item.price.toLocaleString()}</span>
                <button className="add-to-cart-btn" onClick={(e) => handleAddToCart(item, e)}><FaShoppingCart/></button>
            </div>
        </div>
    );

    return (
        <div className="customer-order-container">
            <header className="order-header" style={{ backgroundImage: `url('/src/assets/images/background.jpg')`}}>
                 <div className="header-overlay">
                    <div className="logo-container">
                         {shopInfo?.shop_logo ? <img src={`data:image/png;base64,${shopInfo.shop_logo}`} className="logo" alt="logo"/> : <div className="logo-placeholder">Logo</div>}
                    </div>
                    <div className="header-right-stack">
                        <div className="table-info"> 
                            <span>โต๊ะที่ {orderInfo.table_number} ({sessionCustomerName})</span>
                            <button className="info-icon-button" onClick={() => { setInfoSheetView('details'); setIsInfoSheetOpen(true); }}><FaInfoCircle /></button>
                        </div>
                        <div className="header-actions">
                            <button className="icon-button" onClick={() => navigate(`/order/${order_uuid}/bill`)}><FaReceipt /></button>
                            <button ref={cartButtonRef} className="cart-button icon-button" onClick={() => setIsCartOpen(true)}>
                                <FaShoppingCart /> {totalCartItems > 0 && <span className="cart-badge">{totalCartItems}</span>}
                            </button>
                        </div>
                    </div>
                 </div>
            </header>

            {/* หมวดหมู่แบบแถบเลื่อน (Horizontal Tabs) และแบบปุ่มกดเปิด Sheet */}
            <div className="category-container">
                <button className="category-list-btn" onClick={() => setIsCategorySheetOpen(true)} title="เปิดเมนูหมวดหมู่"><FaListUl /></button>
                <nav className="category-tabs">
                    {categories.map(cat => (
                        <button key={cat} className={`tab-item ${selectedCategory === cat ? 'active' : ''}`} onClick={() => setSelectedCategory(cat)}>{cat || 'อื่น ๆ'}</button>
                    ))}
                </nav>
            </div>

            <main className="menu-list-container">
                {selectedCategory === 'All' ? groupedMenu.map(group => (
                    <section key={group.category} className="menu-group-section">
                        <h2 className="menu-group-header">{group.category}</h2>
                        {group.items.map(item => <MenuItemCard key={item.menu_id} item={item} />)}
                    </section>
                )) : (
                    <section className="menu-group-section">
                        {filteredMenu.map(item => <MenuItemCard key={item.menu_id} item={item} />)}
                    </section>
                )}
            </main>

            {/* Cart Modal / Bottom Sheet */}
            {isCartOpen && (
                <div className="cart-modal-overlay" onClick={() => setIsCartOpen(false)}>
                    <div className="cart-modal" style={cartDrag.style} onClick={e => e.stopPropagation()}>
                        <div {...cartDrag.handlers} style={{ padding: '10px 0 0 0', cursor: 'grab' }}>
                            <div style={{ width: '40px', height: '4px', backgroundColor: '#e0e0e0', borderRadius: '2px', margin: '0 auto' }}></div>
                        </div>
                        <div className="cart-header">
                            <h2>รายการสั่งใหม่</h2>
                            <button className="close-cart-btn" onClick={() => setIsCartOpen(false)}><FaTimes /></button>
                        </div>
                        <div className="cart-body">
                            {cart.length === 0 ? <p className="empty-cart-message">ยังไม่มีรายการในตะกร้า</p> : cart.map(item => (
                                <div key={item.menu_id} className="cart-item">
                                    <img src={item.menu_image ? `data:image/png;base64,${item.menu_image}` : '/path/to/placeholder.png'} className="cart-item-image" alt="item"/>
                                    <div className="cart-item-info"><p>{item.menu_name}</p><p className="cart-item-price">฿{item.price}</p></div>
                                    <div className="cart-item-quantity">
                                        <button onClick={() => handleUpdateQuantity(item.menu_id, -1)}><FaMinus /></button>
                                        <span>{item.quantity}</span>
                                        <button onClick={() => handleUpdateQuantity(item.menu_id, 1)}><FaPlus /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="cart-footer">
                            <div className="cart-total"><span>ราคารวม:</span><span>฿{totalCartPrice.toLocaleString()}</span></div>
                            <button className="confirm-order-btn" onClick={handleSubmitOrder} disabled={cart.length === 0}>ยืนยันการสั่ง</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Info & QR Share Sheet */}
            {isInfoSheetOpen && (
                <div className="info-sheet-overlay" onClick={() => setIsInfoSheetOpen(false)}>
                    <div className="info-sheet-content" style={infoDrag.style} onClick={e => e.stopPropagation()}>
                        <div {...infoDrag.handlers} style={{ padding: '10px 0 0 0', cursor: 'grab' }}>
                            <div style={{ width: '40px', height: '4px', backgroundColor: '#e0e0e0', borderRadius: '2px', margin: '0 auto' }}></div>
                        </div>
                        <div className="info-sheet-header">
                            {infoSheetView === 'qr' && <button className="back-sheet-btn" onClick={() => setInfoSheetView('details')}><FaArrowLeft /></button>}
                            <span className="sheet-header-title">{infoSheetView === 'details' ? 'รายละเอียดโต๊ะ' : 'Share QR Code'}</span>
                            <button className="close-sheet-btn" onClick={() => setIsInfoSheetOpen(false)}><FaChevronDown /></button>
                        </div>
                        <div className="info-sheet-body">
                            {infoSheetView === 'details' ? (
                                <>
                                    <div className="info-sheet-block">
                                        <div className="info-sheet-row"><h3>{orderInfo.plan_name}</h3><span>{new Date(orderInfo.start_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</span></div>
                                        <div className="info-sheet-row"><span><FaUser /> {orderInfo.customer_quantity} ท่าน</span><span><Timer startTime={orderInfo.start_time} /></span></div>
                                    </div>
                                    <button className="share-qr-btn" onClick={handleShowQRCode}><FaQrcode /> Share QR Code with Friends</button>
                                </>
                            ) : (
                                <div className="qr-code-container">
                                    <h3>โต๊ะ {orderInfo.table_number}</h3>
                                    <p>สแกน QR Code นี้เพื่อร่วมสั่งอาหาร</p>
                                    {qrCodeDataUrl ? <img src={qrCodeDataUrl} alt="QR" /> : <p>กำลังสร้าง...</p>}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Category Grid Sheet */}
            {isCategorySheetOpen && (
                <div className="category-sheet-overlay" onClick={() => setIsCategorySheetOpen(false)}>
                    <div className="category-sheet-content" style={categoryDrag.style} onClick={e => e.stopPropagation()}>
                        <div {...categoryDrag.handlers} style={{ padding: '10px 0 0 0', cursor: 'grab' }}>
                            <div style={{ width: '40px', height: '4px', backgroundColor: '#e0e0e0', borderRadius: '2px', margin: '0 auto' }}></div>
                        </div>
                        <div className="category-sheet-header">
                            <h3>ประเภทอาหาร</h3>
                            <button className="close-sheet-btn" onClick={() => setIsCategorySheetOpen(false)}><FaChevronDown /></button>
                        </div>
                        <ul className="category-sheet-list">
                            {categories.map(cat => (
                                <li key={cat}>
                                    <button className={`category-sheet-item ${selectedCategory === cat ? 'active' : ''}`} onClick={() => { setSelectedCategory(cat); setIsCategorySheetOpen(false); }}>
                                        {cat || 'อื่น ๆ'}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerOrderPage;
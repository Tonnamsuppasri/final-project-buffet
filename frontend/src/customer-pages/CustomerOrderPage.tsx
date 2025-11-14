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

// --- Interfaces (คงเดิม) ---
interface MenuItem {
    menu_id: number;
    menu_name: string;
    menu_description?: string;
    menu_category: string;
    price: number;
    menu_image?: string; 
}

interface ActiveOrder {
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
    shop_logo: string | null;
}

interface CartItem extends MenuItem {
    quantity: number;
}

// ✅✅✅ Custom Hook: สำหรับทำ Drag to Close (ลากเพื่อปิด) ✅✅✅
const useSheetDrag = (onClose: () => void, isOpen: boolean) => {
    const [dragOffset, setDragOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const touchStartY = useRef<number | null>(null);

    // Reset เมื่อเปิดหน้าต่างใหม่
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

        // ยอมให้ลากลงเท่านั้น (deltaY > 0)
        if (deltaY > 0) {
            // e.preventDefault(); // (Optional: ป้องกัน scroll body ถ้าจำเป็น)
            setDragOffset(deltaY);
        }
    };

    const onTouchEnd = () => {
        setIsDragging(false);
        touchStartY.current = null;

        // ถ้าลากลงมาเกิน 150px ให้ปิดเลย
        if (dragOffset > 150) {
            onClose();
        } else {
            // ถ้าไม่ถึง ให้ดีดกลับ (Snap back)
            setDragOffset(0);
        }
    };

    // Style ที่จะเอาไปใส่ใน Sheet Content
    const style: React.CSSProperties = {
        transform: `translateY(${dragOffset}px)`,
        transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)', // ถ้าลากอยู่ไม่ต้องมี transition, ถ้าปล่อยให้ดีดกลับนุ่มๆ
    };

    // Handlers ที่จะเอาไปใส่ใน Header (พื้นที่ที่จับลากได้)
    const handlers = {
        onTouchStart,
        onTouchMove,
        onTouchEnd
    };

    return { style, handlers };
};


// --- Timer Component (คงเดิม) ---
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
    // --- State Management ---
    const { uuid } = useParams<{ uuid: string }>();
    const [orderInfo, setOrderInfo] = useState<ActiveOrder | null>(null);
    const [shopInfo, setShopInfo] = useState<ShopInfo | null>(null); 
    const [menu, setMenu] = useState<MenuItem[]>([]);
    const [categories, setCategories] = useState<string[]>(['All']);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [sessionCustomerName, setSessionCustomerName] = useState<string | null>(null);
    const [isInfoSheetOpen, setIsInfoSheetOpen] = useState(false);
    const [infoSheetView, setInfoSheetView] = useState<'details' | 'qr'>('details');
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
    const [isCategorySheetOpen, setIsCategorySheetOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const cartButtonRef = useRef<HTMLButtonElement>(null);
    
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const customerOrderUrlBase = import.meta.env.VITE_CUSTOMER_URL || 'http://localhost:5173/order';

    const navigate = useNavigate();

    // ✅ เรียกใช้ Hook สำหรับแต่ละหน้าต่าง
    const cartDrag = useSheetDrag(() => setIsCartOpen(false), isCartOpen);
    const infoDrag = useSheetDrag(() => setIsInfoSheetOpen(false), isInfoSheetOpen);
    const categoryDrag = useSheetDrag(() => setIsCategorySheetOpen(false), isCategorySheetOpen);

    // --- Body Scroll Lock Effect ---
    useEffect(() => {
        if (isCartOpen || isInfoSheetOpen || isCategorySheetOpen) {
            document.body.style.overflow = 'hidden'; 
        } else {
            document.body.style.overflow = 'unset'; 
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isCartOpen, isInfoSheetOpen, isCategorySheetOpen]);


    // --- Data Fetching (คงเดิม) ---
    useEffect(() => {
        const fetchDataAndAssignName = async () => {
            if (!uuid) {
                setError("ไม่พบรหัสโต๊ะ (UUID)");
                setLoading(false);
                return;
            }
            try {
                const [activeOrdersRes, menuRes, shopRes] = await Promise.all([
                    axios.get<ActiveOrder[]>(`${apiUrl}/api/orders/active`, { withCredentials: true }),
                    axios.get<MenuItem[]>(`${apiUrl}/api/menu`, { withCredentials: true }),
                    axios.get<ShopInfo>(`${apiUrl}/api/shop`, { withCredentials: true })
                ]);

                const currentOrder = activeOrdersRes.data.find(o => o.uuid === uuid);
                if (!currentOrder) {
                    setError("ไม่พบออเดอร์สำหรับโต๊ะนี้ หรือโต๊ะถูกปิดไปแล้ว");
                    setLoading(false);
                    return;
                }
                
                setOrderInfo(currentOrder);
                setMenu(menuRes.data);
                setShopInfo(shopRes.data);

                const uniqueCategories = ['All', ...Array.from(new Set(menuRes.data.map(item => item.menu_category)))];
                setCategories(uniqueCategories);

                const storedNameKey = `customerName-${uuid}`;
                const storedNameData = localStorage.getItem(storedNameKey);
                let sessionName: string | null = null;

                if (storedNameData) {
                    try {
                        const data = JSON.parse(storedNameData);
                        if (data.orderId === currentOrder.order_id) {
                            sessionName = data.name;
                        } else {
                            localStorage.removeItem(storedNameKey);
                        }
                    } catch (e) {
                        localStorage.removeItem(storedNameKey);
                    }
                }

                if (!sessionName) {
                    let sessionId = sessionStorage.getItem(`my-session-${uuid}`);
                    if (!sessionId) {
                        sessionId = uuidv4(); 
                        sessionStorage.setItem(`my-session-${uuid}`, sessionId);
                    }
                    
                    const joinRes = await axios.post<{ customerName: string }>(
                        `${apiUrl}/api/orders/${currentOrder.order_id}/join`,
                        { sessionId },
                        { withCredentials: true } 
                    );
                    
                    const newName = joinRes.data.customerName; 
                    localStorage.setItem(storedNameKey, JSON.stringify({ name: newName, orderId: currentOrder.order_id }));
                    setSessionCustomerName(newName);
                } else {
                    setSessionCustomerName(sessionName); 
                }
                
            } catch (err) {
                setError("ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchDataAndAssignName();
    }, [uuid, apiUrl]);

    // --- Memoized Calculations (คงเดิม) ---
    const filteredMenu = useMemo(() => {
        if (selectedCategory === 'All') return [];
        return menu.filter(item => item.menu_category === selectedCategory);
    }, [menu, selectedCategory]);

    const groupedMenu = useMemo(() => {
        const groups: Record<string, MenuItem[]> = menu.reduce((acc, item) => {
            const category = item.menu_category || 'อื่น ๆ';
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(item);
            return acc;
        }, {} as Record<string, MenuItem[]>);

        return categories
            .filter(cat => cat !== 'All')
            .map(category => ({
                category: category,
                items: groups[category] || []
            }))
            .filter(group => group.items.length > 0);
            
    }, [menu, categories]);

    const totalCartItems = useMemo(() => {
        return cart.reduce((sum, item) => sum + item.quantity, 0);
    }, [cart]);
    
    const totalCartPrice = useMemo(() => {
        return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    }, [cart]);

    // --- Cart Handlers (คงเดิม) ---
    const handleAddToCart = (item: MenuItem, event: React.MouseEvent<HTMLButtonElement>) => {
        setCart(prevCart => {
            const existingItem = prevCart.find(cartItem => cartItem.menu_id === item.menu_id);
            if (existingItem) {
                return prevCart.map(cartItem =>
                    cartItem.menu_id === item.menu_id
                        ? { ...cartItem, quantity: cartItem.quantity + 1 }
                        : cartItem
                );
            }
            return [...prevCart, { ...item, quantity: 1 }];
        });

        const cartRect = cartButtonRef.current?.getBoundingClientRect();
        const buttonRect = event.currentTarget.getBoundingClientRect(); 

        if (cartRect && buttonRect) {
            const flyerImage = document.createElement('img');
            flyerImage.src = item.menu_image ? `data:image/png;base64,${item.menu_image}` : '/path/to/placeholder.png';
            flyerImage.className = 'item-flyer-image'; 
            flyerImage.style.left = `${buttonRect.left + buttonRect.width / 2}px`;
            flyerImage.style.top = `${buttonRect.top + buttonRect.height / 2}px`;
            document.body.appendChild(flyerImage);

            flyerImage.addEventListener('transitionend', () => {
                flyerImage.remove();
            });

            setTimeout(() => {
                flyerImage.style.left = `${cartRect.left + cartRect.width / 2}px`;
                flyerImage.style.top = `${cartRect.top + cartRect.height / 2}px`;
                flyerImage.style.transform = 'translate(-50%, -50%) scale(0.1)';
                flyerImage.style.opacity = '0';
            }, 10); 
        }

        cartButtonRef.current?.classList.add('animating');
        setTimeout(() => {
            cartButtonRef.current?.classList.remove('animating');
        }, 500);
    };
    
    const handleUpdateQuantity = (menuId: number, change: number) => {
        setCart(prevCart => {
            const updatedCart = prevCart.map(item => {
                if (item.menu_id === menuId) {
                    return { ...item, quantity: Math.max(0, item.quantity + change) };
                }
                return item;
            });
            return updatedCart.filter(item => item.quantity > 0);
        });
    };

    // --- Order Submission (คงเดิม) ---
    const handleSubmitOrder = async () => {
        if (cart.length === 0 || !orderInfo || !sessionCustomerName) {
            Swal.fire('ผิดพลาด', 'ยังไม่มีชื่อลูกค้า (กรุณารอ) หรือไม่พบข้อมูลออเดอร์', 'warning');
            return;
        }
        
        const orderDetails = cart.map(item => ({
            menu_id: item.menu_id,
            quantity: item.quantity,
            price_per_item: item.price,
            customer_name: sessionCustomerName
        }));
        
        try {
            await axios.post(
                `${apiUrl}/api/orders/${orderInfo.order_id}/details`, 
                orderDetails,
                { withCredentials: true }
            );
            Swal.fire({
                icon: 'success',
                title: 'ส่งออเดอร์สำเร็จ!',
                text: 'รายการอาหารของคุณถูกส่งไปที่ครัวแล้ว',
                timer: 2000,
                showConfirmButton: false,
            });
            setCart([]);
            setIsCartOpen(false);
        } catch (err) {
            Swal.fire('ผิดพลาด!', 'ไม่สามารถส่งออเดอร์ได้', 'error');
            console.error(err);
        }
    };

    // --- Info Sheet Handlers (คงเดิม) ---
    const handleOpenInfoSheet = () => {
        setInfoSheetView('details'); 
        setIsInfoSheetOpen(true);
    };

    const handleCloseInfoSheet = () => {
        setIsInfoSheetOpen(false);
    };

    const handleShowQRCode = async () => {
        if (!orderInfo) return;
        
        if (!qrCodeDataUrl) {
            try {
                const url = `${customerOrderUrlBase}/${orderInfo.uuid}`;
                const qrUrl = await QRCode.toDataURL(url, { width: 250, margin: 2 });
                setQrCodeDataUrl(qrUrl);
            } catch (err) {
                console.error("Failed to generate QR Code:", err);
                Swal.fire('ผิดพลาด', 'ไม่สามารถสร้าง QR Code ได้', 'error');
                return;
            }
        }
        setInfoSheetView('qr');
    };
    
    // --- Category Sheet Handler (คงเดิม) ---
    const handleCategorySelect = (category: string) => {
        setSelectedCategory(category);
        setIsCategorySheetOpen(false);
    };


    // --- Render Logic ---
    if (loading) return <div className="loading-container">กำลังโหลด...</div>;
    
    if (error || !sessionCustomerName || !orderInfo) {
        return (
            <div className="error-container">
                {error ? error : 'กำลังลงทะเบียนลูกค้า...'}
            </div>
        );
    }
    
    // Helper component (คงเดิม)
    const MenuItemCard = ({ item }: { item: MenuItem }) => (
        <div key={item.menu_id} className="menu-item-list">
            <img 
                src={item.menu_image ? `data:image/png;base64,${item.menu_image}` : '/path/to/placeholder.png'} 
                alt={item.menu_name} 
                className="menu-item-image"
            />
            <div className="menu-item-details">
                <h3 className="menu-item-name">{item.menu_name}</h3>
                <p className="menu-item-desc">{item.menu_description}</p>
            </div>
            <div className="menu-item-actions">
                <span className="menu-item-price">฿{item.price}</span>
                <button className="add-to-cart-btn" onClick={(e) => handleAddToCart(item, e)}>
                    <FaShoppingCart/>
                </button>
            </div>
        </div>
    );

    return (
        <div className="customer-order-container">
            {/* Page Header (คงเดิม) */}
            <header className="order-header" style={{ backgroundImage: `url('/src/assets/images/background.jpg')`}}>
                 <div className="header-overlay">
                    <div className="logo-container">
                         {shopInfo?.shop_logo ? (
                            <img 
                                src={`data:image/png;base64,${shopInfo.shop_logo}`} 
                                alt="Shop Logo" 
                                className="logo"
                            />
                         ) : (
                            <div className="logo-placeholder">Logo</div>
                         )}
                    </div>
                    
                    <div className="header-right-stack">
                        <div className="table-info"> 
                            <span>โต๊ะที่ {orderInfo.table_number} ({sessionCustomerName})</span>
                            <button className="info-icon-button" onClick={handleOpenInfoSheet} title="ดูข้อมูลโต๊ะ">
                                <FaInfoCircle />
                            </button>
                        </div>
                        
                        <div className="header-actions">
                            <button 
                                className="icon-button" 
                                onClick={() => navigate(`/order/${uuid}/bill`)} 
                                title="ดูรายการทั้งหมด (เช็คบิล)"
                            >
                                 <FaReceipt />
                            </button>
                            
                            <button 
                                ref={cartButtonRef}
                                className="cart-button icon-button"
                                onClick={() => setIsCartOpen(true)}
                                title="ตะกร้า (สั่งเพิ่ม)"
                            >
                                <FaShoppingCart />
                                {totalCartItems > 0 && <span className="cart-badge">{totalCartItems}</span>}
                            </button>
                        </div>
                    </div>
                 </div>
            </header>
            
            {/* Category Tabs (คงเดิม) */}
            <div className="category-container">
                <button className="category-list-btn" onClick={() => setIsCategorySheetOpen(true)} title="แสดงประเภทอาหาร">
                    <FaListUl />
                </button>
                <nav className="category-tabs">
                    {categories.map(category => (
                        <button 
                            key={category}
                            className={`tab-item ${selectedCategory === category ? 'active' : ''}`}
                            onClick={() => setSelectedCategory(category)}
                        >
                            {category || 'อื่น ๆ'}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Main Menu List (คงเดิม) */}
            <main className="menu-list-container">
                {selectedCategory === 'All' ? (
                    groupedMenu.map(group => (
                        <section key={group.category} className="menu-group-section">
                            <h2 className="menu-group-header">{group.category}</h2>
                            {group.items.map(item => (
                                <MenuItemCard key={item.menu_id} item={item} />
                            ))}
                        </section>
                    ))
                ) : (
                    filteredMenu.map(item => (
                        <MenuItemCard key={item.menu_id} item={item} />
                    ))
                )}
            </main>

            {/* Cart Modal */}
            {isCartOpen && (
                <div className="cart-modal-overlay">
                    {/* ✅ ใส่ style (transform) ให้ content */}
                    <div className="cart-modal" style={cartDrag.style}>
                        
                        {/* ✅ ใส่ Handlers ให้ header */}
                        <div className="cart-header" {...cartDrag.handlers}>
                            {/* เพิ่มขีด visual cue ตรงกลาง */}
                            <div style={{position:'absolute', top:'8px', left:'50%', transform:'translateX(-50%)', width:'40px', height:'4px', backgroundColor:'#e0e0e0', borderRadius:'2px'}}></div>
                            
                            <h2>รายการสั่ง (ใหม่)</h2>
                            <button className="close-cart-btn" onClick={() => setIsCartOpen(false)}><FaTimes /></button>
                        </div>
                        
                        <div className="cart-body">
                            {cart.length === 0 ? (
                                <p className="empty-cart-message">ยังไม่มีรายการในตะกร้า</p>
                            ) : (
                                cart.map(item => (
                                    <div key={item.menu_id} className="cart-item">
                                        <img src={item.menu_image ? `data:image/png;base64,${item.menu_image}` : '/path/to/placeholder.png'} alt={item.menu_name} className="cart-item-image" />
                                        <div className="cart-item-info">
                                            <p>{item.menu_name}</p>
                                            <p className="cart-item-price">฿{item.price}</p>
                                        </div>
                                        <div className="cart-item-quantity">
                                            <button onClick={() => handleUpdateQuantity(item.menu_id, -1)}><FaMinus /></button>
                                            <span>{item.quantity}</span>
                                            <button onClick={() => handleUpdateQuantity(item.menu_id, 1)}><FaPlus /></button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="cart-footer">
                            <div className="cart-total">
                                <span>ราคารวม (ใหม่):</span>
                                <span>฿{totalCartPrice.toLocaleString()}</span>
                            </div>
                            <button 
                                className="confirm-order-btn" 
                                onClick={handleSubmitOrder}
                                disabled={cart.length === 0 || !sessionCustomerName} 
                            >
                                ยืนยันการสั่ง
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Info Sheet (Bottom Sheet) */}
            {isInfoSheetOpen && (
                <div className="info-sheet-overlay" onClick={handleCloseInfoSheet}>
                    {/* ✅ ใส่ style ให้ content */}
                    <div className="info-sheet-content" style={infoDrag.style} onClick={(e) => e.stopPropagation()}>
                        
                        {/* ✅ ใส่ Handlers ให้ header */}
                        <div className="info-sheet-header" {...infoDrag.handlers}>
                            {/* visual cue */}
                            <div style={{position:'absolute', top:'8px', left:'50%', transform:'translateX(-50%)', width:'40px', height:'4px', backgroundColor:'#e0e0e0', borderRadius:'2px'}}></div>

                            {infoSheetView === 'qr' && (
                                <button className="back-sheet-btn" onClick={() => setInfoSheetView('details')}>
                                    <FaArrowLeft />
                                </button>
                            )}
                            <span className="sheet-header-title">
                                {infoSheetView === 'details' ? 'รายละเอียดโต๊ะ' : 'Share QR Code'}
                            </span>
                            <button className="close-sheet-btn" onClick={handleCloseInfoSheet}>
                                <FaChevronDown />
                            </button>
                        </div>
                        
                        <div className="info-sheet-body">
                            <div className="shop-info-header">
                                {shopInfo?.shop_logo && (
                                    <img 
                                        src={`data:image/png;base64,${shopInfo.shop_logo}`} 
                                        alt="Shop Logo" 
                                        className="shop-logo-sheet"
                                    />
                                )}
                                <h2>{shopInfo?.shop_name || 'ข้อมูลร้าน'}</h2>
                            </div>
                            
                            {infoSheetView === 'details' ? (
                                <>
                                    <div className="info-sheet-block">
                                        <div className="info-sheet-row">
                                            <h3>{orderInfo.plan_name}</h3>
                                            <span>{new Date(orderInfo.start_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</span>
                                        </div>
                                        <div className="info-sheet-row">
                                            <span><FaUser /> {orderInfo.customer_quantity} persons</span>
                                            <span><Timer startTime={orderInfo.start_time} /></span>
                                        </div>
                                    </div>

                                    <h3 className="terms-title">Terms of Service</h3>
                                    <p className="terms-text">....................................</p>
                                    
                                    <button className="share-qr-btn" onClick={handleShowQRCode}>
                                        <FaQrcode /> Share QR Code with Friends
                                    </button>
                                </>
                            ) : (
                                <div className="qr-code-container">
                                    <h3>โต๊ะ {orderInfo.table_number}</h3>
                                    <p>สแกน QR Code นี้เพื่อสั่งอาหาร</p>
                                    {qrCodeDataUrl ? (
                                        <img src={qrCodeDataUrl} alt="Table QR Code" />
                                    ) : (
                                        <p>กำลังสร้าง QR Code...</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Category Sheet (Bottom Sheet) */}
            {isCategorySheetOpen && (
                <div className="category-sheet-overlay" onClick={() => setIsCategorySheetOpen(false)}>
                    {/* ✅ ใส่ style ให้ content */}
                    <div className="category-sheet-content" style={categoryDrag.style} onClick={(e) => e.stopPropagation()}>
                        
                        {/* ✅ ใส่ Handlers ให้ header */}
                        <div className="category-sheet-header" {...categoryDrag.handlers}>
                            {/* visual cue */}
                            <div style={{position:'absolute', top:'8px', left:'50%', transform:'translateX(-50%)', width:'40px', height:'4px', backgroundColor:'#e0e0e0', borderRadius:'2px'}}></div>

                            <h3>ประเภทอาหาร</h3>
                            <button className="close-sheet-btn" onClick={() => setIsCategorySheetOpen(false)}>
                                <FaChevronDown />
                            </button>
                        </div>
                        <ul className="category-sheet-list">
                            {categories.map(category => (
                                <li key={category}>
                                    <button 
                                        className={`category-sheet-item ${selectedCategory === category ? 'active' : ''}`}
                                        onClick={() => handleCategorySelect(category)}
                                    >
                                        {category || 'อื่น ๆ'}
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
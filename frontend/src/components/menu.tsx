import { useLocation, useNavigate, Outlet, type To } from 'react-router-dom';
import { useEffect, useState, useMemo, useRef } from 'react'; 
import axios from 'axios';
import { io, type Socket } from 'socket.io-client';
import {
  Bars3Icon,
  CalendarIcon,
  ChartBarIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  BookOpenIcon,
  ArrowRightStartOnRectangleIcon,
  Cog6ToothIcon,
  BellIcon, 
  XMarkIcon, 
} from '@heroicons/react/24/solid';
import './menu.css';
import Swal from 'sweetalert2';
import { v4 as uuidv4 } from 'uuid'; 

// --- Socket Connection (คงเดิม) ---
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
export const socket: Socket = io(apiUrl, {
  autoConnect: false, 
});

// --- Interfaces ---
interface ShopInfo {
  shop_logo: string | null;
}

interface NotificationItem {
  id: string; 
  message: string; 
  type: 'call_bill' | 'new_order' | 'other' | 'open_table' | 'close_table'; // ✅ เพิ่ม type
  read: boolean; 
  timestamp: Date; 
  linkTo: string; 
}

// ============================
//   Menu Component
// ============================
const Menu = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [shopLogo, setShopLogo] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isNotiOpen, setIsNotiOpen] = useState(false);
  const [toast, setToast] = useState<NotificationItem | null>(null);

  const bellButtonRef = useRef<HTMLButtonElement>(null);
  const notiPopoverRef = useRef<HTMLDivElement>(null);

  const username = location.state?.username;
  const role = location.state?.role;
  const isActive = (path: string) => location.pathname === path;

  const hasUnread = useMemo(() => {
    return notifications.some(n => !n.read);
  }, [notifications]);


  // Icon Component (คงเดิม)
  const DocumentListIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
      {...props} 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth="2" 
        d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
      />
    </svg>
  );

  useEffect(() => {
    if (!username) {
      navigate('/');
    }
  }, [username, navigate]);

  // ฟังก์ชันสำหรับจัดการ Toast (คงเดิม)
  const showToast = (notification: NotificationItem) => {
    setToast(notification);
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // useEffect หลักสำหรับ Socket และข้อมูลร้าน (คงเดิม)
  useEffect(() => {
    const fetchShopLogo = async () => {
      try {
        const response = await axios.get<ShopInfo>(`${apiUrl}/api/shop`);
        if (response.data && response.data.shop_logo) {
          setShopLogo(response.data.shop_logo);
        } else {
          setShopLogo(null);
        }
      } catch (error) {
        console.error("Error fetching shop logo:", error);
        setShopLogo(null);
      }
    };

    const handleNewNotification = (data: Omit<NotificationItem, 'id' | 'read' | 'timestamp'>) => {
      console.log('Received notification:', data);
      const newNoti: NotificationItem = {
        ...data,
        id: uuidv4(),
        read: false,
        timestamp: new Date(),
      };
      
      setNotifications(prev => [newNoti, ...prev]);
      showToast(newNoti);
    };

    fetchShopLogo();

    if (!socket.connected) {
      socket.connect();
    }
    
    socket.on('connect', () => {
      console.log('✅ (Menu) Connected to Socket.IO server:', socket.id);
    });

    socket.on('shop_updated', fetchShopLogo); 
    socket.on('notification', handleNewNotification); 

    return () => {
      socket.off('shop_updated', fetchShopLogo);
      socket.off('notification', handleNewNotification);
    };
  }, []); 

  // useEffect สำหรับ "Click Outside" (คงเดิม)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isNotiOpen &&
        bellButtonRef.current && 
        !bellButtonRef.current.contains(event.target as Node) &&
        notiPopoverRef.current && 
        !notiPopoverRef.current.contains(event.target as Node)
      ) {
        setIsNotiOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNotiOpen]); 


  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNavigation = (path: To) => {
    navigate(path, { state: { username, role } });
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleLogoClick = () => {
    navigate('/welcome', { state: { username, role } });
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  // ฟังก์ชันสำหรับจัดการ Popover (คงเดิม)
  const handleOpenNotiCenter = () => {
    const newState = !isNotiOpen;
    setIsNotiOpen(newState);

    if (newState) {
      setNotifications(prev => 
        prev.map(n => ({ ...n, read: true }))
      );
    }
  };

  // ฟังก์ชันสำหรับคลิกที่รายการแจ้งเตือน (คงเดิม)
  const handleNotiClick = (notification: NotificationItem) => {
    handleNavigation(notification.linkTo);
    setIsNotiOpen(false);
    setNotifications(prev => 
      prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
    );
  };


  return (
    <div className="flex h-screen overflow-hidden">
      {/* --- Sidebar --- */}
      <div
        className={`fixed top-0 left-0 h-full text-white flex-col z-30 side-bar
          transition-all duration-500 ease-out 
          ${sidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full'}
          md:w-64 md:relative md:flex md:flex-shrink-0
          md:translate-x-0
        `}
        /* ✅ แก้ไข 1: เปลี่ยน z-40 เป็น z-30 */
      >
        {/* ... (เนื้อหา Sidebar ทั้งหมดคงเดิม) ... */}
        {/* (Profile Section) */}
        <div className="flex flex-col h-full relative z-10">
          {/* Enhanced Profile Section */}
          <div className="p-0 flex flex-col items-center mt-5 relative group">
            <div className="relative cursor-pointer" onClick={handleLogoClick}>
              {shopLogo ? (
                <img
                  className="relative aspect-3/2 w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 
                    object-cover mx-auto rounded-full border-2 border-white/20 
                    shadow-2xl transition-all duration-500 transform 
                    group-hover:scale-105 group-hover:border-white/40 group-hover:shadow-3xl
                    hover:scale-110 cursor-pointer"
                  src={`data:image/png;base64,${shopLogo}`}
                  alt="profile"
                  title="กลับไปหน้าหลัก"
                />
              ) : (
                <div
                  className="relative w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 
                    bg-gray-700 mx-auto rounded-full border-2 border-white/20 
                    shadow-2xl flex items-center justify-center text-gray-400 text-xs text-center
                    transition-all duration-500 transform 
                    group-hover:scale-105 group-hover:border-white/40 group-hover:shadow-3xl
                    hover:scale-110 cursor-pointer"
                  title="กลับไปหน้าหลัก"
                >
                  Logo
                </div>
              )}
              <div className="absolute inset-0 rounded-full border-2 border-gradient-to-r 
                from-transparent via-blue-300/50 to-transparent animate-spin" 
                style={{ animation: 'spin 8s linear infinite' }} />
              <div className="absolute inset-0 rounded-full bg-white/10 scale-0 
                hover:scale-100 transition-transform duration-300" />
            </div>

            <h1 className="text-lg sm:text-xl font-bold mt-5 mx-auto text-center relative">
              <span className="relative z-10 bg-gradient-to-r from-blue-200 via-white to-purple-200 
                bg-clip-text text-transparent animate-pulse">
                ตำแหน่ง: {role}
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 via-white to-purple-400 
                bg-clip-text text-transparent blur-sm opacity-30" />
            </h1>

            <h1 className="text-lg sm:text-xl font-bold mt-1 mx-auto text-center flex items-center gap-2">
              <span className="text-lg sm:text-xl mx-auto bg-gradient-to-r from-green-200 to-blue-200 
                bg-clip-text text-transparent">{username}</span>
              <span className="mx-3 text-gray-400 animate-pulse">|</span>
              <button
                className="relative text-sm sm:text-base edit-bottom group/btn overflow-hidden 
                  transition-all duration-300 hover:scale-105"
                onClick={() => handleNavigation('/edit-profile')}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 
                  scale-0 group-hover/btn:scale-100 transition-transform duration-300 rounded" />
                <span className="relative z-10 transition-all duration-300 group-hover/btn:text-blue-200">
                  แก้ไขโปรไฟล์
                </span>
              </button>
            </h1>

            <div className="w-full mt-4 mb-4 relative">
              <hr className="border-gray-300 line-white-menu relative z-10" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent 
                via-blue-400/30 to-transparent h-px animate-pulse" />
              <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r 
                from-transparent via-white/50 to-transparent transform -translate-x-full 
                animate-pulse" style={{ animation: 'slideRight 3s ease-in-out infinite' }} />
            </div>
          </div>

          {/* (Scrollable menu) */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden pb-20 relative">
            
            {/* (Report Menu) */}
            {role === 'Admin' && (
              <>
                <div className="relative group mb-2">
                  <p className="text-lg sm:text-xl ms-8 mb-3 font-bold w-full text-left 
                    bg-gradient-to-r from-green-200 via-blue-200 to-purple-200 
                    bg-clip-text text-transparent">
                    รายงาน
                  </p>
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 
                    to-blue-500/5 rounded-lg opacity-0 group-hover:opacity-100 
                    transition-opacity duration-500" />
                </div>

                <nav className="space-y-2 w-full">
                  {[
                    { path: '/report', label: 'ภาพรวมรายงาน', color: 'text-white' },
                    { path: '/day-report', label: 'ยอดขายรายวัน', color: 'text-green-300' },
                    { path: '/month-report', label: 'ยอดขายรายเดือน', color: 'text-red-400' }
                  ].map((item, index) => (
                    <div key={item.path} className="relative group/item">
                      <a
                        className={`relative flex ps-8 sm:ps-12 items-center text-sm sm:text-base 
                          px-4 py-3 rounded-xl text-start menu-bottom menu-tap z-10
                          transition-all duration-300 transform
                          ${isActive(item.path) 
                            ? 'text-white scale-105 shadow-lg translate-x-2' 
                            : 'text-gray-200 hover:text-white hover:scale-105 hover:translate-x-2'
                          }`}
                        href={item.path}
                        onClick={(e) => {
                          e.preventDefault();
                          handleNavigation(item.path);
                        }}
                      >
                        <div className={`relative flex items-center justify-center mr-3 ${item.color}
                          transition-all duration-300 group-hover/item:drop-shadow-lg`}>
                          <div className="relative">
                            <CalendarIcon className={`w-6 h-6 sm:w-8 sm:h-8 transition-all duration-300
                              ${isActive(item.path) ? 'animate-pulse' : ''}
                              group-hover/item:scale-110 group-hover/item:rotate-3`} />
                            
                            <div className={`absolute inset-0 rounded-full transition-all duration-500
                              ${isActive(item.path) || hoveredItem === item.path 
                                ? 'bg-current blur-sm opacity-30 scale-150' 
                                : 'opacity-0 scale-100'
                              }`} />
                          </div>
                          
                          <ChartBarIcon className={`w-2 h-2 sm:w-3 sm:h-3 absolute top-3/5 left-1/2 
                            -translate-x-1/2 -translate-y-1/2 transition-all duration-300
                            group-hover/item:animate-bounce`} />
                        </div>
                        
                        <span className="transition-all duration-300 group-hover/item:translate-x-1">
                          {item.label}
                        </span>
                        
                        <div className={`absolute right-2 w-1 h-8 bg-gradient-to-b 
                          from-blue-400 to-purple-500 rounded-full transition-all duration-300
                          ${isActive(item.path) ? 'opacity-100 scale-100 animate-pulse' : 'opacity-0 scale-0'}`} />
                      </a>
                    </div>
                  ))}
                </nav>
                
                <div className="my-6 mx-4 relative">
                  <hr className="hr-menu w-full relative z-10" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent 
                    via-purple-400/20 to-transparent h-px animate-pulse" />
                </div>
              </>
            )}

            {/* (Staff Menu) */}
             {role === 'Admin' && (
              <>
                <div className="relative group mb-2">
                  <p className="text-lg sm:text-xl ms-8 mb-3 font-bold w-full text-left 
                    bg-gradient-to-r from-green-200 via-blue-200 to-purple-200 
                    bg-clip-text text-transparent">
                    การจัดการบุคลากร
                  </p>
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 
                    to-blue-500/5 rounded-lg opacity-0 group-hover:opacity-100 
                    transition-opacity duration-500" />
                </div>

                <nav className="space-y-2 w-full">
                  <div className="relative group/item">
                    <div className={`absolute inset-0 rounded-xl transition-all duration-300 
                      ${isActive('/staff') 
                        ? 'bg-gradient-to-r from-green-500/20 via-blue-500/20 to-purple-500/20 scale-100 opacity-100' 
                        : 'bg-gradient-to-r from-green-400/10 via-blue-400/10 to-purple-400/10 scale-95 opacity-0 group-hover/item:scale-100 group-hover/item:opacity-100'
                      }`} />

                    <a
                      className={`relative flex ps-8 sm:ps-12 items-center text-sm sm:text-base 
                        px-4 py-3 rounded-xl text-start menu-bottom menu-tap z-10
                        transition-all duration-300 transform
                        ${isActive('/staff') 
                          ? 'text-white scale-105 shadow-lg translate-x-2' 
                          : 'text-gray-200 hover:text-white hover:scale-105 hover:translate-x-2'
                        }`}
                      href="staff"
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavigation('/staff');
                      }}
                    >
                      <div className="relative flex items-center justify-center mr-3 text-white
                        transition-all duration-300 group-hover/item:drop-shadow-lg">
                        <UserGroupIcon className={`w-6 h-6 sm:w-8 sm:h-8 transition-all duration-300
                          ${isActive('/staff') ? 'animate-pulse' : ''}
                          group-hover/item:scale-110`} />
                      </div>
                      <span className="transition-all duration-300 group-hover/item:translate-x-1">
                        จัดการ Staff
                      </span>
                    </a>
                  </div>
                </nav>
                
                <div className="my-6 mx-4 relative">
                  <hr className="hr-menu w-full relative z-10" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent 
                    via-green-400/20 to-transparent h-px animate-pulse" />
                </div>
              </>
            )}

            {/* (Main Menu) */}
            <nav className="space-y-2 w-full">
              {[
                { path: '/table', label: 'สถานะโต๊ะ', icon: BookOpenIcon, color: 'text-blue-300' },
                { path: '/PaymentPage', label: 'รายการชำระเงิน', icon: CurrencyDollarIcon, color: 'text-yellow-300' },
                { path: '/order', label: 'รับออเดอร์', icon: DocumentListIcon, color: 'text-orange-400' },
              ].map((item) => (
                <div key={item.path} className="relative group/item">
                  <div className={`absolute inset-0 rounded-xl transition-all duration-300 
                    ${isActive(item.path) 
                      ? 'bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 scale-100 opacity-100' 
                      : 'bg-gradient-to-r from-blue-400/10 via-purple-400/10 to-pink-400/10 scale-95 opacity-0 group-hover/item:scale-100 group-hover/item:opacity-100'
                    }`} />

                  <a
                    className={`relative flex ps-8 sm:ps-12 items-center text-sm sm:text-base 
                      px-4 py-3 rounded-xl text-start menu-bottom menu-tap z-10
                      transition-all duration-300 transform
                      ${isActive(item.path) 
                        ? 'text-white scale-105 shadow-lg translate-x-2' 
                        : 'text-gray-200 hover:text-white hover:scale-105 hover:translate-x-2'
                      }`}
                    href={item.path}
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavigation(item.path);
                    }}
                  >
                    <div className={`relative flex items-center justify-center mr-3 ${item.color}
                      transition-all duration-300 group-hover/item:drop-shadow-lg`}>
                      <item.icon className={`w-6 h-6 sm:w-8 sm:h-8 transition-all duration-300
                        ${isActive(item.path) ? 'animate-pulse' : ''}
                        group-hover/item:scale-110`} />
                    </div>
                    <span className="transition-all duration-300 group-hover/item:translate-x-1">
                      {item.label}
                    </span>
                  </a>
                </div>
              ))}
            </nav>

            <div className="my-6 mx-4 relative">
              <hr className="w-full hr-menu relative z-10" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent 
                via-pink-400/20 to-transparent h-px animate-pulse" />
            </div>
          </div>

          {/* (Setting Button) */}
          <div className="absolute bottom-4 left-4 right-4 z-50">
            <div
              className={`w-full px-2 py-1 sm:px-4 sm:py-2 transition-colors duration-200 rounded-3xl shadow-2xl shadow-white
                ${isActive('/setting') ? 'bg-gray-400' : 'bg-gray-800 hover:bg-gray-700'}
                hover:-translate-y-1 hover:shadow-lg transform group/setting
              `}
            >
              <a
                className="relative flex items-center justify-center text-sm sm:text-base 
                  px-2 py-2 sm:px-4 sm:py-2 rounded-3xl text-start menu-bottom 
                  setting-tap text-white transition-all duration-500 z-10
                  group-hover/setting:-translate-y-2 group-hover/setting:scale-110
                  hover:-translate-y-1 hover:shadow-lg transform"
                href="setting"
                onClick={(e) => {
                  e.preventDefault();
                  handleNavigation('/setting');
                }}
              >
                <div className="flex items-center justify-center mr-2 relative">
                  <div className="relative">
                    <Cog6ToothIcon className="w-6 h-6 sm:w-8 sm:h-8 setting-icon-spin" />
                    <div className="absolute inset-0 border-2 border-transparent 
                      bg-gradient-to-r from-white/30 to-transparent rounded-full
                      group-hover/setting:animate-spin transition-all duration-300" />
                  </div>
                </div>
                
                <h1 className="relative transition-all duration-300 
                  group-hover/setting:text-blue-200">
                  ตั้งค่าร้านค้า
                  <span className="absolute inset-0 text-blue-200 opacity-0 
                    group-hover/setting:opacity-50 blur-sm transition-all duration-500">
                    ตั้งค่าร้านค้า
                  </span>
                </h1>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Overlay (คงเดิม) */}
      {sidebarOpen && window.innerWidth < 768 && (
        <div
          className="fixed inset-0 bg-gradient-to-br from-black/60 via-gray-900/40 to-black/60 
            backdrop-blur-sm z-20 transition-all duration-500" /* (ลด z-index ให้น้อยกว่า Sidebar) */
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div 
        className={`flex-1 flex flex-col h-full transition-all duration-500 ease-out
          ${sidebarOpen ? 'ml-64 md:ml-0' : 'ml-0'}
        `}
        /* ✅ แก้ไข 2: เพิ่ม transition และ margin-left เมื่อ sidebar เปิด (เฉพาะจอเล็ก) */
      >
        {/* Topbar */}
        <div 
          className="h-16 sm:h-20 md:h-24 flex items-center px-4 sm:px-6 shadow top-bar 
          justify-between relative z-40"
          /* ✅ แก้ไข 3: เปลี่ยน z-20 เป็น z-40 (ให้สูงกว่า Sidebar) */
        >
          
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden relative group z-10"
          >
            <Bars3Icon className="relative w-8 h-8 sm:w-10 sm:h-10 text-white 
              transition-all duration-300 group-hover:scale-110 group-hover:rotate-180 z-10" />
          </button>
          
          <h2 className="text-xl sm:text-3xl md:text-5xl lg:text-6xl text-white font-semibold 
            text-center flex-grow relative z-10">
            <span className="bg-gradient-to-r from-white via-blue-100 to-purple-100 
              bg-clip-text text-transparent animate-pulse">
              {location.pathname === '/welcome' && 'หน้าหลัก'}
              {location.pathname === '/report' && 'ภาพรวมรายงาน'}
              {location.pathname === '/day-report' && 'ยอดขายรายวัน'}
              {location.pathname === '/month-report' && 'ยอดขายรายเดือน'}
              {location.pathname === '/staff' && 'จัดการ Staff'}
              {location.pathname === '/table' && 'สถานะโต๊ะ'}
              {location.pathname === '/PaymentPage' && 'รายการชำระเงิน'}
              {location.pathname === '/order' && 'รับออเดอร์'}
              {location.pathname === '/setting' && 'ตั้งค่าร้านค้า'}
              {location.pathname === '/edit-profile' && 'แก้ไขโปรไฟล์'}
            </span>
          </h2>
          
          {/* ส่วนปุ่ม Notification และ Logout (คงเดิม) */}
          <div className="flex items-center gap-2 sm:gap-4 z-10">
            {/* --- Notification Bell Button --- */}
            <div className="relative">
              <button
                ref={bellButtonRef}
                onClick={handleOpenNotiCenter}
                className="relative p-2 text-white rounded-full 
                  transition-colors duration-200 hover:bg-white/10 group noti-button"
              >
                <BellIcon className="w-6 h-6 sm:w-7 sm:h-7 transition-transform duration-300 group-hover:scale-110" />
                {hasUnread && (
                  <span className="noti-badge"></span>
                )}
              </button>

              {/* --- Notification Popover --- */}
              {isNotiOpen && (
                <div ref={notiPopoverRef} className="noti-popover">
                  <div className="noti-header">
                    <span>การแจ้งเตือน</span>
                  </div>
                  <div className="noti-body">
                    {notifications.length === 0 ? (
                      <div className="noti-empty">
                        ไม่มีการแจ้งเตือน
                      </div>
                    ) : (
                      notifications.map(noti => (
                        <div 
                          key={noti.id} 
                          className={`noti-item ${!noti.read ? 'unread' : ''}`} 
                          onClick={() => handleNotiClick(noti)}
                        >
                          <p className="noti-message">{noti.message}</p>
                          <span className="noti-timestamp">
                            {new Date(noti.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* --- Logout Button --- */}
            <div
              className="relative flex items-center justify-center h-full text-white cursor-pointer
                p-3 rounded-lg transition-all duration-300 group/logout 
                hover:-translate-y-1 transform logout-button-container hover:underline"
              onClick={async () => {
                const result = await Swal.fire({
                  title: 'คุณแน่ใจหรือไม่?',
                  text: 'คุณต้องการออกจากระบบ',
                  icon: 'warning',
                  showCancelButton: true,
                  confirmButtonColor: '#d33',
                  cancelButtonColor: '#3085d6',
                  confirmButtonText: 'ออกจากระบบ',
                  cancelButtonText: 'ยกเลิก',
                });

                if (result.isConfirmed) {
                  await Swal.fire({
                    icon: 'success',
                    title: 'ออกจากระบบสำเร็จ',
                    timer: 1200,
                    showConfirmButton: false,
                  });
                  socket.disconnect();
                  console.log('❌ Manually disconnected socket on logout.');
                  navigate('/');
                }
              }}
            >
              <ArrowRightStartOnRectangleIcon className="relative w-5 h-5 sm:w-6 sm:h-6 
                menu-logout-icon z-10 transition-all duration-300 
                group-hover/logout:scale-110 group-hover/logout:rotate-12" />
                
              <span className="hidden sm:inline relative text-base sm:text-xl ml-1 sm:ml-2 z-10 
                transition-all duration-300 group-hover/logout:text-red-200">
                ออกจากระบบ
              </span>
            </div>
          </div>
          
        </div>

        {/* Page content */}
        <div className="flex-1 p-4 sm:p-6 overflow-auto bg-gradient-to-br from-gray-50 to-gray-100 relative z-10">
          <Outlet />
        </div>
      </div>

      {/* Notification Toast (คงเดิม) */}
      {toast && (
        <div className={`notification-toast ${toast ? 'toast-enter' : 'toast-exit'}`}>
          <div className="toast-content">
            <div className="toast-icon-container">
              <BellIcon className="w-6 h-6 text-yellow-500" />
            </div>
            <div className="toast-message">
              <p className="font-bold">การแจ้งเตือนใหม่!</p>
              <p className="text-sm">{toast.message}</p>
            </div>
            <button onClick={() => setToast(null)} className="toast-close-btn">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default Menu;
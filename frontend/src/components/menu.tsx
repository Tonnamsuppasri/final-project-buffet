import { useLocation, useNavigate, Outlet, type To } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  Bars3Icon,
  CalendarIcon,
  ChartBarIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  BookOpenIcon,
  ArrowRightStartOnRectangleIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/solid';
import './menu.css';
import Swal from 'sweetalert2';

const Menu = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const [hoveredItem, setHoveredItem] = useState(null);

  const username = location.state?.username;
  const role = location.state?.role;
  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    if (!username) {
      navigate('/');
    }
  }, [username, navigate]);

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

  // ฟังก์ชันสำหรับการนำทางและปิด sidebar ในมือถือ
  const handleNavigation = (path: To) => {
    navigate(path, { state: { username, role } });
    // ปิด sidebar หากเป็นหน้าจอมือถือ (ขนาดหน้าจอน้อยกว่า 768px)
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  // ฟังก์ชันสำหรับไปหน้า Welcome เมื่อคลิก Logo
  const handleLogoClick = () => {
    navigate('/welcome', { state: { username, role } });
    // ปิด sidebar หากเป็นหน้าจอมือถือ
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  console.log('Current sidebarOpen state (in render):', sidebarOpen);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Enhanced Sidebar Container */}
      <div
        className={`fixed top-0 left-0 h-full text-white flex-col z-40 side-bar
          transition-all duration-500 ease-out 
          ${sidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full'}
          md:w-64 md:relative md:flex md:flex-shrink-0
          md:translate-x-0
        `}
      >
        {/* Animated shine effect on sidebar */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5 
          opacity-0 hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />
        
        {/* Animated border glow */}
        <div className="absolute top-0 right-0 w-1 h-full bg-gradient-to-b 
          from-transparent via-blue-400/50 to-transparent opacity-50" />
        
        {/* Sidebar content */}
        <div className="flex flex-col h-full relative z-10">
          {/* Enhanced Profile Section */}
          <div className="p-0 flex flex-col items-center mt-5 relative group">
            <div className="relative cursor-pointer" onClick={handleLogoClick}>
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400/20 
                via-purple-500/20 to-pink-400/20 blur-md scale-110 animate-pulse" />
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-red-300/10 
                to-orange-300/10 blur-lg scale-125 group-hover:opacity-100 opacity-0 
                transition-opacity duration-700" />
              
              <img
                className="relative aspect-3/2 w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 
                  object-cover mx-auto rounded-full border-2 border-white/20 
                  shadow-2xl transition-all duration-500 transform 
                  group-hover:scale-105 group-hover:border-white/40 group-hover:shadow-3xl
                  hover:scale-110 cursor-pointer"
                src="/src/assets/images/logo-magin.jpg"
                alt="profile"
                title="กลับไปหน้าหลัก"
              />
              
              <div className="absolute inset-0 rounded-full border-2 border-gradient-to-r 
                from-transparent via-blue-300/50 to-transparent animate-spin" 
                style={{ animation: 'spin 8s linear infinite' }} />
              
              {/* Click indicator */}
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

          {/* Enhanced Scrollable menu items - ปรับให้สามารถเลื่อนได้ถึงล่างสุด */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden pb-20 relative">
            {/* Report Section */}
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
                  {/* Enhanced Report Menu Items */}
                  {[
                    { path: '/report', label: 'ภาพรวมรายงาน', color: 'text-white' },
                    { path: '/day-report', label: 'ยอดขายรายวัน', color: 'text-green-300' },
                    { path: '/month-report', label: 'ยอดขายรายเดือน', color: 'text-red-400' }
                  ].map((item, index) => (
                    <div key={item.path} className="relative group/item">
                      {/* Hover background with gradient */}
                      <div className={`absolute inset-0 rounded-xl transition-all duration-300 
                        ${isActive(item.path) 
                          ? 'bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 scale-100 opacity-100' 
                          : 'bg-gradient-to-r from-blue-400/10 via-purple-400/10 to-pink-400/10 scale-95 opacity-0 group-hover/item:scale-100 group-hover/item:opacity-100'
                        }`} />
                      
                      {/* Shine effect */}
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-r 
                        from-transparent via-white/10 to-transparent -translate-x-full 
                        group-hover/item:translate-x-full transition-transform duration-700" />

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
                          {/* Icon with enhanced effects */}
                          <div className="relative">
                            <CalendarIcon className={`w-6 h-6 sm:w-8 sm:h-8 transition-all duration-300
                              ${isActive(item.path) ? 'animate-pulse' : ''}
                              group-hover/item:scale-110 group-hover/item:rotate-3`} />
                            
                            {/* Icon glow */}
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
                        
                        {/* Active indicator with pulse */}
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

            {/* Enhanced Staff Management Section */}
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

            {/* Enhanced Table Status and Payment Section */}
            <nav className="space-y-2 w-full">
              {[
                { path: '/table', label: 'สถานะโต๊ะ', icon: BookOpenIcon, color: 'text-blue-300' },
                { path: '/check-bill', label: 'รายการชำระเงิน', icon: CurrencyDollarIcon, color: 'text-yellow-300' }
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

          {/* Floating Settings Button - ปรับให้ลอยอยู่ด้านล่างของ sidebar */}
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
                    {/* Spinning ring around icon */}
                    <div className="absolute inset-0 border-2 border-transparent 
                      bg-gradient-to-r from-white/30 to-transparent rounded-full
                      group-hover/setting:animate-spin transition-all duration-300" />
                  </div>
                </div>
                
                <h1 className="relative transition-all duration-300 
                  group-hover/setting:text-blue-200">
                  ตั้งค่าร้านค้า
                  
                  {/* Text glow effect */}
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

      {/* Enhanced Overlay */}
      {sidebarOpen && window.innerWidth < 768 && (
        <div
          className="fixed inset-0 bg-gradient-to-br from-black/60 via-gray-900/40 to-black/60 
            backdrop-blur-sm z-30 transition-all duration-500"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col h-full">
        {/* Enhanced Topbar */}
        <div className="h-16 sm:h-20 md:h-24 flex items-center px-4 sm:px-6 shadow top-bar 
          justify-between relative overflow-hidden">
          
          {/* Animated background particles */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-white/20 rounded-full 
              animate-pulse" style={{ animation: 'float 6s ease-in-out infinite' }} />
            <div className="absolute top-3/4 left-3/4 w-1 h-1 bg-white/30 rounded-full 
              animate-pulse" style={{ animation: 'float 8s ease-in-out infinite reverse' }} />
            <div className="absolute top-1/2 right-1/4 w-1.5 h-1.5 bg-white/25 rounded-full 
              animate-pulse" style={{ animation: 'float 7s ease-in-out infinite' }} />
          </div>
          
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden relative group z-10"
          >
            {/* Button glow effect */}
            <div className="absolute inset-0 bg-white/20 rounded-full blur-md opacity-0 
              group-hover:opacity-100 transition-all duration-300 scale-150" />
            
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
              {location.pathname === '/check-bill' && 'รายการชำระเงิน'}
              {location.pathname === '/setting' && 'ตั้งค่าร้านค้า'}
              {location.pathname === '/edit-profile' && 'แก้ไขโปรไฟล์'}
            </span>
          </h2>
          
          {/* Ultra Enhanced Logout Button */}
          <div
            className="relative flex items-center justify-center h-full text-white cursor-pointer
              p-3 rounded-lg transition-all duration-300 group/logout 
              hover:-translate-y-1 transform logout-button-container hover:underline z-10"
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
                navigate('/');
              }
            }}
          >
            {/* Multiple background layers */}
            <div className="absolute inset-0 bg-red-500/20 rounded-lg scale-0 
              group-hover/logout:scale-100 transition-transform duration-300" />
            <div className="absolute inset-0 bg-gradient-to-r from-red-400/10 to-pink-400/10 
              rounded-lg opacity-0 group-hover/logout:opacity-100 transition-opacity duration-500" />
            
            {/* Pulsing glow */}
            <div className="absolute inset-0 bg-red-400 rounded-lg blur-lg opacity-0 
              group-hover/logout:opacity-20 transition-all duration-500 scale-150" />

            <ArrowRightStartOnRectangleIcon className="relative w-5 h-5 sm:w-6 sm:h-6 
              menu-logout-icon z-10 transition-all duration-300 
              group-hover/logout:scale-110 group-hover/logout:rotate-12" />
              
            <span className="relative text-base sm:text-xl ml-1 sm:ml-2 z-10 
              transition-all duration-300 group-hover/logout:text-red-200">
              ออกจากระบบ
            </span>
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 p-4 sm:p-6 overflow-auto bg-gradient-to-br from-gray-50 to-gray-100">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default Menu;
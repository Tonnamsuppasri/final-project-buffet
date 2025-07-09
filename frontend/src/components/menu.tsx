import { useLocation, useNavigate, Outlet } from 'react-router-dom';
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

  console.log('Current sidebarOpen state (in render):', sidebarOpen);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar Container */}
      <div
        className={`fixed top-0 left-0 h-full text-white flex-col z-40 side-bar
          transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'w-64 translate-x-0 opacity-100' : 'w-0 -translate-x-full opacity-0'}
          md:w-64 md:relative md:flex md:flex-shrink-0
          md:translate-x-0 md:opacity-100
        `}
      >
        {/* Sidebar content - make this a flex column itself to control layout */}
        <div className="flex flex-col h-full"> {/* Added flex flex-col h-full here */}
          {/* Top section (profile, role, edit profile) - fixed at top */}
          <div className={`p-0 flex flex-col items-center mt-5`}>
            <img
              className="aspect-3/2 w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 object-cover mx-auto rounded-full"
              src="/src/assets/images/logo-magin.jpg"
              alt="profile"
            />
            <h1 className="text-lg sm:text-xl font-bold mt-5 mx-auto text-center">
              ตำแหน่ง: {role}
            </h1>
            <h1 className="text-lg sm:text-xl font-bold mt-1 mx-auto text-center flex items-center gap-2">
              <span className="text-lg sm:text-xl mx-auto">{username}</span>
              <span className="mx-3">|</span>
              <button
                className="relative text-sm sm:text-base hover:underline hover:decoration-white edit-bottom"
                onClick={() => navigate('/edit-profile', { state: { username, role } })}
              >
                Edit Profile
              </button>
            </h1>
            <hr className="my-4 border-gray-300 line-white-menu" />
          </div>

          {/* Scrollable menu items - This is the crucial part */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden pb-4"> {/* flex-1 and overflow-y-auto for scrolling */}
            {/* Report Section */}
            {role === 'ADMIN' && (
              <>
                <p className="text-lg sm:text-xl ms-8 mb-1 font-bold w-full text-left">
                  รายงาน
                </p>
                <nav className="space-y-1 w-full">
                  <a
                    className={`flex ps-8 sm:ps-12 items-center text-sm sm:text-base block px-4 py-1 rounded-xl text-start menu-bottom transition-colors duration-200 menu-tap ${
                      isActive('/report') ? 'bg-gray-400' : 'hover:bg-gray-400'
                    }`}
                    href="report"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate('/report', { state: { username, role } });
                    }}
                  >
                    <div className="relative flex items-center justify-center mr-2">
                      <CalendarIcon className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                      <ChartBarIcon className="w-2 h-2 sm:w-3 sm:h-3 text-white absolute top-3/5 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    ภาพรวมรายงาน
                  </a>
                  <a
                    className={`flex ps-8 sm:ps-12 items-center text-sm sm:text-base block px-4 py-1 rounded-xl text-start menu-bottom transition-colors duration-200 menu-tap ${
                      isActive('/day-report') ? 'bg-gray-400' : 'hover:bg-gray-400'
                    }`}
                    href="day-report"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate('/day-report', { state: { username, role } });
                    }}
                  >
                    <div className="relative flex items-center justify-center mr-2 text-green-300">
                      <CalendarIcon className="w-6 h-6 sm:w-8 sm:h-8" />
                      <ChartBarIcon className="w-2 h-2 sm:w-3 sm:h-3 absolute top-3/5 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    ยอดขายรายวัน
                  </a>
                  <a
                    className={`flex ps-8 sm:ps-12 items-center text-sm sm:text-base block px-4 py-1 rounded-xl text-start menu-bottom transition-colors duration-200 menu-tap ${
                      isActive('/month-report') ? 'bg-gray-400' : 'hover:bg-gray-400'
                    }`}
                    href="month-report"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate('/month-report', { state: { username, role } });
                    }}
                  >
                    <div className="relative flex items-center justify-center mr-2 text-red-600">
                      <CalendarIcon className="w-6 h-6 sm:w-8 sm:h-8" />
                      <ChartBarIcon className="w-2 h-2 sm:w-3 sm:h-3 absolute top-3/5 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    ยอดขายรายเดือน
                  </a>
                </nav>
                <hr className="my-4 hr-menu w-full" />
              </>
            )}

            {/* Staff Management Section */}
            {role === 'ADMIN' && (
              <>
                <p className="text-lg sm:text-xl ms-8 mb-1 font-bold w-full text-left">
                  การจัดการบุคลากร
                </p>
                <nav className="space-y-1 w-full">
                  <a
                    className={`flex ps-8 sm:ps-12 items-center text-sm sm:text-base block px-4 py-1 rounded-xl text-start menu-bottom transition-colors duration-200 menu-tap ${
                      isActive('/staff') ? 'bg-gray-400' : 'hover:bg-gray-400'
                    }`}
                    href="staff"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate('/staff', { state: { username, role } });
                    }}
                  >
                    <div className="relative flex items-center justify-center mr-2">
                      <UserGroupIcon className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                    </div>
                    จัดการ Staff
                  </a>
                </nav>
                <hr className="my-4 hr-menu w-full" />
              </>
            )}

            {/* Table Status and Payment List Section */}
            <>
              <nav className="space-y-1 w-full">
                <a
                  className={`flex ps-8 sm:ps-12 items-center text-sm sm:text-base block px-4 py-1 rounded-xl text-start menu-bottom transition-colors duration-200 menu-tap ${
                    isActive('/table') ? 'bg-gray-400' : 'hover:bg-gray-400'
                  }`}
                  href="table"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/table', { state: { username, role } });
                  }}
                >
                  <div className="relative flex items-center justify-center mr-2">
                    <BookOpenIcon className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                  </div>
                  สถานะโต๊ะ
                </a>
                <a
                  className={`flex ps-8 sm:ps-12 items-center text-sm sm:text-base block px-4 py-1 rounded-xl text-start menu-bottom transition-colors duration-200 menu-tap ${
                    isActive('/check-bill') ? 'bg-gray-400' : 'hover:bg-gray-400'
                  }`}
                  href="check-bill"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/check-bill', { state: { username, role } });
                  }}
                >
                  <div className="relative flex items-center justify-center mr-2">
                    <CurrencyDollarIcon className="w-6 h-6 sm:w-8 sm:h-8" />
                  </div>
                  รายการชำระเงิน
                </a>
              </nav>
            </>
            <hr className="my-4 w-full hr-menu" />
          </div>

          {/* Setting - Always at the bottom of the Sidebar (now correctly positioned at the bottom of the flex column) */}
          <div
            className={`w-4/5 px-2 py-1 sm:px-4 sm:py-2 transition-colors duration-200 mt-auto mx-auto rounded-3xl shadow-2xl shadow-white mb-2
              ${isActive('/setting') ? 'bg-gray-400' : 'bg-gray-800 hover:bg-gray-700'}
              hover:-translate-y-1 hover:shadow-lg transform
            `}
          >
            <a
              className="flex items-center justify-center text-sm sm:text-base px-2 py-1 sm:px-4 sm:py-1 rounded-xl text-start menu-bottom transition-colors duration-200 setting-tap text-white"
              href="setting"
              onClick={(e) => {
                e.preventDefault();
                navigate('/setting', { state: { username, role } });
              }}
            >
              <div className="flex items-center justify-center mr-2">
                <Cog6ToothIcon className="w-6 h-6 sm:w-8 sm:h-8 setting-icon-spin" />
              </div>
              <h1>ตั้งค่าร้านค้า</h1>
            </a>
          </div>
        </div>
      </div>

      {/* Overlay for small screens when sidebar is open */}
      {sidebarOpen && window.innerWidth < 768 && (
        <div
          className="fixed inset-0 bg-black opacity-50 z-30"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col h-full">
        {/* Topbar */}
        <div className="h-16 sm:h-20 md:h-24 flex items-center px-4 sm:px-6 shadow justify-between top-bar">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden" // Only show on small and medium screens
          >
            <Bars3Icon className="w-8 h-8 sm:w-10 sm:h-10 text-white transition-all duration-200 hover:w-10 hover:h-10 sm:hover:w-12 sm:hover:h-12" />
          </button>
          <h2 className="text-xl sm:text-3xl md:text-5xl lg:text-6xl text-white font-semibold my-auto text-center flex-grow">
            {/* Display current page title based on location.pathname */}
            {location.pathname === '/report' && 'ภาพรวมรายงาน'}
            {location.pathname === '/day-report' && 'ยอดขายรายวัน'}
            {location.pathname === '/month-report' && 'ยอดขายรายเดือน'}
            {location.pathname === '/staff' && 'จัดการ Staff'}
            {location.pathname === '/table' && 'สถานะโต๊ะ'}
            {location.pathname === '/check-bill' && 'รายการชำระเงิน'}
            {location.pathname === '/setting' && 'คั้งค่าร้านค้า'}
            {location.pathname === '/edit-profile' && 'แก้ไขโปรไฟล์'}
            {/* Fallback title if path not matched */}
            {/* {!isActive('/home') && !isActive('/day-report') && /* ...all other paths... */ ''}
          </h2>
          {/* Logout Button - เพิ่มคลาสที่นี่ */}
          <div
            className="relative flex items-center justify-center h-full text-white cursor-pointer
                       p-2 rounded-lg transition-all duration-300
                       hover:-translate-y-1 transform logout-button-container hover:underline" // เพิ่มคลาสเหล่านี้
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
            <ArrowRightStartOnRectangleIcon className="w-5 h-5 sm:w-6 sm:h-6 bordermenu-logout-icon" />
            <span className="text-base sm:text-xl ml-1 sm:ml-2">ออกจากระบบ</span>
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default Menu;
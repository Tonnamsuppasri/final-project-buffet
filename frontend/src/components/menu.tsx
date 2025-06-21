import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  Bars3Icon,
  CalendarIcon,
  ChartBarIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  BookOpenIcon,
  ArrowRightStartOnRectangleIcon,
} from '@heroicons/react/24/solid';
import './menu.css';
import Swal from 'sweetalert2';

const Menu = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  // Initialize sidebarOpen based on screen size, true for larger screens, false for smaller
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768); // md breakpoint
  const username = location.state?.username;
  const role = location.state?.role;
  const isActive = (path: string) => location.pathname === path;

  // Effect to handle initial authentication check
  useEffect(() => {
    if (!username) {
      navigate('/');
    }
  }, [username, navigate]);

  // Effect to adjust sidebar visibility on window resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarOpen(false); // Close sidebar on small screens
      } else {
        setSidebarOpen(true); // Open sidebar on larger screens
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar Container */}
      <div
        className={`text-white flex-col h-full transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'w-64 md:w-64' : 'w-0 md:w-0'
        } overflow-hidden flex-shrink-0 side-bar ${
          sidebarOpen ? 'flex' : 'hidden md:flex'
        }`}
      >
        <div className={`p-0 flex flex-col items-center mt-5`}>
          <img
            className="aspect-3/2 w-32 h-32 object-cover mx-auto rounded-3xl"
            src="/src/assets/images/background.jpg"
            alt="profile"
          />
          <h1 className="text-xl font-bold mt-5 mx-auto text-center">
            ตำแหน่ง: {role}
          </h1>
          <h1 className="text-xl font-bold mt-5 mx-auto text-center flex items-center gap-2">
            <span className="text-xl mx-auto">{username}</span>
            <span className="mx-3">|</span>
            <button
              className="relative text-base hover:underline hover:decoration-white edit-bottom"
              onClick={() => navigate('/edit-profile', { state: { username, role } })}
            >
              Edit Profile
            </button>
          </h1>
          <hr className="mx-20 my-4 border-gray-300 line-white-menu" />

          {/* Report Section */}
          {role === 'ADMIN' && (
            <>
              <p className="text-xl ms-16 mt-4 mb-1 font-bold w-full text-left">
                รายงาน
              </p>
              <nav className="space-y-1 w-full">
                <a
                  className={`flex ps-12 items-center text-base block px-4 py-1 rounded-xl text-start menu-bottom transition-colors duration-200 menu-tap ${
                    isActive('/home') ? 'bg-gray-400' : 'hover:bg-gray-400'
                  }`}
                  href="home"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/home', { state: { username, role } });
                  }}
                >
                  <div className="relative flex items-center justify-center mr-2">
                    <CalendarIcon className="w-8 h-8 text-white" />
                    <ChartBarIcon className="w-3 h-3 text-white absolute top-3/5 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  ภาพรวมรายงาน
                </a>
                <a
                  className={`flex ps-12 items-center text-base block px-4 py-1 rounded-xl text-start menu-bottom transition-colors duration-200 menu-tap ${
                    isActive('/day-report') ? 'bg-gray-400' : 'hover:bg-gray-400'
                  }`}
                  href="day-report"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/day-report', { state: { username, role } });
                  }}
                >
                  <div className="relative flex items-center justify-center mr-2 text-green-300">
                    <CalendarIcon className="w-8 h-8" />
                    <ChartBarIcon className="w-3 h-3 absolute top-3/5 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  ยอดขายรายวัน
                </a>
                <a
                  className={`flex ps-12 items-center text-base block px-4 py-1 rounded-xl text-start menu-bottom transition-colors duration-200 menu-tap ${
                    isActive('/month-report') ? 'bg-gray-400' : 'hover:bg-gray-400'
                  }`}
                  href="month-report"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/month-report', { state: { username, role } });
                  }}
                >
                  <div className="relative flex items-center justify-center mr-2 text-red-600">
                    <CalendarIcon className="w-8 h-8" />
                    <ChartBarIcon className="w-3 h-3 absolute top-3/5 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  ยอดขายรายเดือน
                </a>
              </nav>
              <hr className="my-4 border-black w-full" />
            </>
          )}

          {/* Staff Management Section */}
          {role === 'ADMIN' && (
            <>
              <p className="text-xl ms-8 mb-1 font-bold w-full text-left">
                Staff Management
              </p>
              <nav className="space-y-1 w-full">
                <a
                  className={`flex ps-12 items-center text-base block px-4 py-1 rounded-xl text-start menu-bottom transition-colors duration-200 menu-tap ${
                    isActive('/staff') ? 'bg-gray-400' : 'hover:bg-gray-400'
                  }`}
                  href="staff"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/staff', { state: { username, role } });
                  }}
                >
                  <div className="relative flex items-center justify-center mr-2">
                    <UserGroupIcon className="w-8 h-8 text-white" />
                  </div>
                  จัดการ Staff
                </a>
              </nav>
              <hr className="my-4 border-black w-full" />
            </>
          )}

          {/* Table Status and Payment List Section */}
          <>
            <nav className="space-y-1 w-full">
              <a
                className={`flex ps-12 items-center text-base block px-4 py-1 rounded-xl text-start menu-bottom transition-colors duration-200 menu-tap ${
                  isActive('/table') ? 'bg-gray-400' : 'hover:bg-gray-400'
                }`}
                href="table"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/table', { state: { username, role } });
                }}
              >
                <div className="relative flex items-center justify-center mr-2">
                  <BookOpenIcon className="w-8 h-8 text-white" />
                </div>
                สถานะโต๊ะ
              </a>
              <a
                className={`flex ps-12 items-center text-base block px-4 py-1 rounded-xl text-start menu-bottom transition-colors duration-200 menu-tap ${
                  isActive('/check-bill') ? 'bg-gray-400' : 'hover:bg-gray-400'
                }`}
                href="check-bill"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/check-bill', { state: { username, role } });
                }}
              >
                <div className="relative flex items-center justify-center mr-2">
                  <CurrencyDollarIcon className="w-8 h-8" />
                </div>
                รายการชำระเงิน
              </a>
            </nav>
          </>
          <hr className="my-4 border-black w-full" />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col h-full">
        {/* Topbar */}
        <div className="h-24 flex items-center px-6 shadow justify-between top-bar">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden" // Only show on small screens
          >
            <Bars3Icon className="w-10 h-10 text-white transition-all duration-200 hover:w-12 hover:h-12" />
          </button>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-white font-semibold my-auto text-center flex-grow">Home</h2>
          <div
            className="flex items-center justify-center h-full text-white hover:underline hover:decoration-white cursor-pointer"
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
            <ArrowRightStartOnRectangleIcon className="w-5 h-5" />
            <span className="text-xl ml-2">ออกจากระบบ</span>
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

export default Menu;
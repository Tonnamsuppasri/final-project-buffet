import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import { UserIcon, LockClosedIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/solid';
// 🗑️ ลบ import useAuth ออก
import './App.css';

function App() {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  const navigate = useNavigate();
  // 🗑️ ลบ const { login } = useAuth() ออก

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const res = await axios.post(`${apiUrl}/api/login`, { username, password });

      if (res.data.success) {
        await Swal.fire({
          icon: 'success',
          title: 'เข้าสู่ระบบสำเร็จ',
          timer: 1500,
          showConfirmButton: false
        });

        const user = res.data.user;
        localStorage.setItem('userId', user.id.toString());
        // ✅ กลับมาใช้วิธีส่งข้อมูลผ่าน navigate state เหมือนเดิม
        navigate('/welcome', { state: { username: user.username, role: user.role } });
      }
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'เข้าสู่ระบบล้มเหลว',
        text: err.response?.data?.message || 'เกิดข้อผิดพลาด'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        backgroundImage: 'url(/src/assets/images/background.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* ... โค้ด JSX ที่เหลือเหมือนเดิมทั้งหมด ... */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
      
      <div className="absolute inset-0">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-red-600 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-red-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse" style={{animationDelay: '2s'}}></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-orange-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse" style={{animationDelay: '4s'}}></div>
      </div>

      <div className="relative w-full max-w-6xl">
        <div className="backdrop-blur-l rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
          <div className="flex flex-col lg:flex-row min-h-[600px]">
            {/* Left Side - Red Theme Branding */}
            <div className="lg:w-1/2 flex flex-col items-center justify-center p-8 lg:p-16 text-center text-white relative overflow-hidden left-side">
              <div className="absolute top-8 left-8 w-16 h-16 border border-white/30 rounded-full animate-spin" style={{animationDuration: '20s'}}></div>
              <div className="absolute bottom-8 right-8 w-12 h-12 border border-white/30 rounded-full animate-bounce"></div>
              <div className="absolute top-1/2 left-12 w-4 h-4 bg-white/40 rounded-full animate-pulse"></div>
              <div className="absolute top-1/4 right-16 w-6 h-6 bg-white/30 rounded-full animate-pulse" style={{animationDelay: '1s'}}></div>

              <div className="relative z-10 max-w-md">
                <div className="mb-8">
                  <div className="w-60 h-60 mx-auto mb-6 rounded-full overflow-hidden shadow-2xl transform hover:scale-105 transition-transform duration-300 border-4 border-white/30">
                    <img 
                      src="/src/assets/images/logo-magin.jpg" 
                      alt="Logo" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
                <h2 className="text-3xl lg:text-5xl mb-6 font-black text-yellow-300 drop-shadow-lg transform hover:scale-105 transition-transform duration-300">
                  <p>มากินปิ้งย่างยากินิกึ </p>
                  <p>&</p>
                  <p>ชาบู</p>
                </h2>
                <div className="space-y-3 text-base lg:text-lg font-medium opacity-95">
                  <div className="flex items-center justify-center space-x-3 transform hover:translate-x-2 transition-transform duration-300">
                    <span className="text-2xl">🍲</span>
                    <p>ระบบจัดการร้านชาบูครบวงจร</p>
                  </div>
                  <div className="flex items-center justify-center space-x-3 transform hover:translate-x-2 transition-transform duration-300" style={{transitionDelay: '100ms'}}>
                    <span className="text-2xl">📊</span>
                    <p>รายงานยอดขายแบบเรียลไทม์</p>
                  </div>
                  <div className="flex items-center justify-center space-x-3 transform hover:translate-x-2 transition-transform duration-300" style={{transitionDelay: '200ms'}}>
                    <span className="text-2xl">👥</span>
                    <p>จัดการลูกค้าและโต๊ะอาหาร</p>
                  </div>
                </div>
                <div className="mt-8 p-4 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20">
                  <p className="text-sm font-medium opacity-90">
                    💬 Please contact us for support
                  </p>
                </div>
              </div>
            </div>

            {/* Right Side - White Theme Login Form */}
            <div className="lg:w-1/2 p-8 lg:p-16 bg-white flex items-center justify-center">
              <div className="w-full max-w-md">
                <div className="text-center mb-8">
                  <h1 className="text-4xl lg:text-5xl font-black mb-3 bg-gradient-to-r from-red-600 to-orange-500 bg-clip-text text-transparent">
                    LOGIN
                  </h1>
                  <p className="text-gray-600 font-medium">เข้าสู่ระบบเพื่อเริ่มต้นการทำงาน</p>
                </div>
                <form className="space-y-6" onSubmit={handleLogin}>
                  <div className="group">
                    <label className="block text-gray-700 font-semibold mb-2 group-focus-within:text-red-600 transition-colors">
                      Username
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <UserIcon className="h-5 w-5 text-gray-400 group-focus-within:text-red-600 transition-colors" />
                      </div>
                      <input
                        type="text"
                        className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-4 focus:ring-red-500/20 outline-none transition-all duration-300 text-gray-800 placeholder-gray-400 hover:border-gray-300 focus:bg-white"
                        placeholder="Enter username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="group">
                    <label className="block text-gray-700 font-semibold mb-2 group-focus-within:text-red-600 transition-colors">
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <LockClosedIcon className="h-5 w-5 text-gray-400 group-focus-within:text-red-600 transition-colors" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        className="w-full pl-12 pr-12 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-4 focus:ring-red-500/20 outline-none transition-all duration-300 text-gray-800 placeholder-gray-400 hover:border-gray-300 focus:bg-white"
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-4 flex items-center hover:bg-gray-100 rounded-r-xl transition-colors"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeSlashIcon className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                        ) : (
                          <EyeIcon className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                        )}
                      </button>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="group relative w-full bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white font-bold py-4 rounded-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] hover:shadow-2xl disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                    <div className="relative flex items-center justify-center">
                      {isLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                          <span>กำลังเข้าสู่ระบบ...</span>
                        </>
                      ) : (
                        <>
                          <span>เข้าสู่ระบบ</span>
                          <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                          </svg>
                        </>
                      )}
                    </div>
                  </button>
                </form>
                <div className="mt-8 pt-6 border-t border-gray-200 text-center">
                  <p className="text-gray-500 text-xs">
                    © 2025 Buffet Shabu System. All rights reserved.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App


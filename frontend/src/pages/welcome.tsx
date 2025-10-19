import { useLocation, useNavigate, type To } from 'react-router-dom';
import './welcome.css'
import { useEffect } from 'react';

const Welcome = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const username = location.state?.username;
    const role = location.state?.role;
    const nickname = location.state?.nickname; // ✅ ดึง nickname มาด้วย

    useEffect(() => {
        if (!username) {
            navigate('/');
        }
    }, [username, navigate]);

    // ✅ ใช้ nickname ถ้ามี ไม่งั้น fallback เป็น username
    const displayName = nickname && nickname.trim() !== '' ? nickname : username;

    // Admin feature cards
    const adminFeatures = [
        {
            icon: (
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                </svg>
            ),
            gradient: "from-blue-500 to-blue-600",
            title: "ภาพรวมรายงาน",
            description: "ตรวจสอบยอดขายรายวันและรายเดือน",
            path: "/report"
        },
        {
            icon: (
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                </svg>
            ),
            gradient: "from-purple-500 to-purple-600",
            title: "จัดการ Staff",
            description: "เพิ่ม แก้ไข และจัดการข้อมูลพนักงาน",
            path: "/staff"
        }
    ];

    // Staff feature cards
    const staffFeatures = [
        {
            icon: (
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                </svg>
            ),
            gradient: "from-pink-500 to-pink-600",
            title: "จัดการโต๊ะ",
            description: "ตรวจสอบสถานะโต๊ะและรับออเดอร์",
            path: "/table"
        },
        {
            icon: (
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
                </svg>
            ),
            gradient: "from-blue-500 to-blue-600",
            title: "รับออเดอร์",
            description: "รับออเดอร์และจัดการออเดอร์",
            path: "/order"
        },
        {
            icon: (
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path>
                </svg>
            ),
            gradient: "from-green-500 to-green-600",
            title: "ชำระเงิน",
            description: "ประมวลผลการชำระเงินและออกใบเสร็จ",
            path: "/check-bill"
        }
    ];

    const currentFeatures = role === 'Admin' ? [...adminFeatures, ...staffFeatures] : staffFeatures;

    // ✅ ใช้ displayName แทน username
    const welcomeMessage = role === 'Admin' 
        ? `ยินดีต้อนรับ Admin ${displayName}` 
        : `ยินดีต้อนรับ ${displayName}`;

    const handleCardClick = (path: To) => {
        navigate(path, { 
            state: { 
                username: username,
                nickname: nickname, // ✅ ส่ง nickname ต่อไป
                role: role 
            } 
        });
    };

    const subMessage = role === 'Admin' 
        ? 'จัดการระบบร้านค้าของคุณแบบเต็มรูปแบบ' 
        : 'เริ่มต้นการทำงานวันนี้กันเลย';

    return (
        <div className="h-full w-full bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden">
            {/* Background decorative elements */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-blue-200/20 rounded-full blur-xl animate-pulse"></div>
                <div className="absolute top-3/4 right-1/4 w-24 h-24 bg-purple-200/20 rounded-full blur-xl animate-pulse" style={{animationDelay: '2s'}}></div>
                <div className="absolute bottom-1/4 left-1/3 w-20 h-20 bg-pink-200/20 rounded-full blur-xl animate-pulse" style={{animationDelay: '4s'}}></div>
                <div className="absolute top-10 right-10 w-40 h-40 bg-gradient-to-br from-blue-100/30 to-purple-100/30 rounded-full blur-2xl"></div>
                <div className="absolute bottom-10 left-10 w-36 h-36 bg-gradient-to-br from-pink-100/30 to-orange-100/30 rounded-full blur-2xl"></div>
            </div>

            {/* Main content */}
            <div className="relative z-10 min-h-full flex flex-col items-center justify-start pt-8 px-6 text-center overflow-y-auto">
                
                {/* Welcome header */}
                <div className="mb-8 relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 blur-3xl scale-150 animate-pulse"></div>
                    <h1 className="relative text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-4 animate-fade-in">
                        {welcomeMessage}
                    </h1>
                    <div className="h-1 w-24 mx-auto bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full animate-expand"></div>
                </div>

                {/* Role badge */}
                <div className="mb-6">
                    <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
                        role === 'Admin' 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-blue-100 text-blue-800'
                    }`}>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                        </svg>
                        {role === 'Admin' ? 'ผู้ดูแลระบบ' : 'พนักงาน'}
                    </span>
                </div>

                {/* Subtitle */}
                <p className="text-lg sm:text-xl md:text-2xl text-gray-600 mb-8 max-w-2xl leading-relaxed animate-slide-up">
                    {subMessage}
                    <span className="block text-base sm:text-lg text-gray-500 mt-2">
                        เลือกเมนูจากแถบด้านข้างเพื่อเริ่มต้นการทำงาน
                    </span>
                </p>

                {/* Feature cards */}
                <div className={`grid grid-cols-1 sm:grid-cols-2 ${role === 'admin' ? 'lg:grid-cols-2' : 'lg:grid-cols-3'} gap-6 max-w-6xl w-full mb-12`}>
                    {currentFeatures.map((feature, index) => (
                        <div 
                            key={index}
                            onClick={() => handleCardClick(feature.path)}
                            className="group bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-lg hover:shadow-xl transition-all duration-500 hover:transform hover:scale-105 animate-card-up cursor-pointer flex flex-col items-center text-center" 
                            style={{animationDelay: `${0.2 + (index * 0.1)}s`}}
                        >
                            <div className={`w-12 h-12 bg-gradient-to-br ${feature.gradient} rounded-xl flex items-center justify-center mb-4 group-hover:rotate-12 transition-transform duration-300`}>
                                {feature.icon}
                            </div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">{feature.title}</h3>
                            <p className="text-gray-600 text-sm">{feature.description}</p>
                        </div>
                    ))}
                </div>

                {/* Status indicator */}
                <div className="flex items-center justify-center space-x-3 animate-fade-in" style={{animationDelay: '0.8s'}}>
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-gray-600 font-medium">ระบบพร้อมใช้งาน</span>
                </div>
            </div>
        </div>
    );
};

export default Welcome;

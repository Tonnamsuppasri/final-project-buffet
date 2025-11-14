import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { 
    ClockIcon, 
    ArrowRightEndOnRectangleIcon, 
    ArrowLeftStartOnRectangleIcon,
    ChevronRightIcon // ✅ 1. Import ไอคอนสำหรับ "หด" (ชี้ซ้าย)
} from '@heroicons/react/24/outline';
import { format, parseISO, differenceInSeconds } from 'date-fns'; 
import { th } from 'date-fns/locale';
import { io } from 'socket.io-client'; 

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
// ✅ FIX: อ้างอิง path ไปยัง menu.tsx ให้ถูกต้อง (ขึ้นอยู่กับโครงสร้างไฟล์ของคุณ)
// หาก ClockInOutButton.tsx อยู่ใน components/ ให้ใช้ import { socket } from './menu';
// หาก ClockInOutButton.tsx อยู่ที่เดียวกับ menu.tsx ให้ใช้ import { socket } from './menu';
// *** กรุณาตรวจสอบ Path นี้ให้ถูกต้อง ***
import { socket } from './menu'; //

interface AttendanceStatus {
    status: 'not_clocked_in' | 'clocked_in' | 'clocked_out';
    lastClockIn: string | null;
}

const ClockInOutButton = () => {
    const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus | null>(null);
    const [loading, setLoading] = useState(false); 
    const [statusLoading, setStatusLoading] = useState(true); 
    const [userId, setUserId] = useState<number | null>(null);
    const [elapsedTime, setElapsedTime] = useState<string>('');

    // ✅ 2. เปลี่ยน State เริ่มต้นเป็น 'false' (หด)
    const [isExpanded, setIsExpanded] = useState(false);

    // --- (Effect, fetchStatus, Handlers ทั้งหมดคงเดิม) ---
    useEffect(() => {
        const storedUserId = localStorage.getItem('userId');
        if (storedUserId) {
            const parsedId = parseInt(storedUserId, 10);
            if (!isNaN(parsedId)) {
                setUserId(parsedId);
            } else {
                 setStatusLoading(false); 
            }
        } else {
             setStatusLoading(false); 
        }
    }, []); 

    const fetchStatus = useCallback(async () => {
        if (!userId) {
             setStatusLoading(false); 
            return;
        }
        // ไม่ต้อง setStatusLoading(true) ทุกครั้งที่ refetch
        try {
            // ✅ FIX: เพิ่ม withCredentials: true (สำคัญมากสำหรับ CORS)
            const response = await axios.get<AttendanceStatus>(`${apiUrl}/api/attendance/status`, {
                headers: { 'x-user-id': userId },
                withCredentials: true 
            });
            setAttendanceStatus(response.data);
        } catch (error: any) {
            console.error("ClockInOutButton: Error fetching status:", error);
            setAttendanceStatus(null); 
        } finally {
             setStatusLoading(false); 
        }
    }, [userId]); 

    useEffect(() => {
        if (userId) { 
            fetchStatus(); 
            const attendanceUpdateEvent = `attendance_updated_${userId}`;
            socket.on(attendanceUpdateEvent, fetchStatus); 
            return () => {
                socket.off(attendanceUpdateEvent, fetchStatus);
            };
        }
    }, [userId, fetchStatus]); 

    const handleClockIn = async () => {
        if (!userId) return;
        setLoading(true); 
        try {
            // ✅ FIX: เพิ่ม withCredentials: true
            await axios.post(`${apiUrl}/api/attendance/clock-in`, {}, {
               headers: { 'x-user-id': userId },
               withCredentials: true 
            });
            Swal.fire('สำเร็จ', 'บันทึกเวลาเข้างานเรียบร้อย', 'success');
        } catch (error: any) {
             Swal.fire('ผิดพลาด', error.response?.data?.message || 'ไม่สามารถบันทึกเวลาเข้างานได้', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleClockOut = async () => {
        if (!userId) return;
        setLoading(true); 
        try {
            // ✅ FIX: เพิ่ม withCredentials: true
             await axios.post(`${apiUrl}/api/attendance/clock-out`, {}, {
                 headers: { 'x-user-id': userId },
                 withCredentials: true 
             });
             Swal.fire('สำเร็จ', 'บันทึกเวลาออกงานเรียบร้อย', 'success');
        } catch (error: any) {
             Swal.fire('ผิดพลาด', error.response?.data?.message || 'ไม่สามารถบันทึกเวลาออกงานได้', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let timer: NodeJS.Timeout | undefined;

        if (attendanceStatus?.status === 'clocked_in' && attendanceStatus.lastClockIn) {
            const clockInTime = parseISO(attendanceStatus.lastClockIn);
            
            const updateTimer = () => {
                const now = new Date();
                const totalSeconds = differenceInSeconds(now, clockInTime);

                if (totalSeconds < 0) {
                    setElapsedTime('00:00:00');
                    return;
                }

                const hours = Math.floor(totalSeconds / 3600);
                const minutes = Math.floor((totalSeconds % 3600) / 60);
                const seconds = totalSeconds % 60;
                
                setElapsedTime(
                    `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
                );
            };
            
            updateTimer(); // เรียกครั้งแรกทันที
            timer = setInterval(updateTimer, 1000); 
        
        }

        return () => {
            if (timer) {
                clearInterval(timer); 
            }
            if (attendanceStatus?.status !== 'clocked_in') {
                setElapsedTime(''); 
            }
        };
    }, [attendanceStatus]); 

    // ฟังก์ชันคำนวณสีปุ่ม (หด)
    const collapsedColorClass = useMemo(() => {
        if (statusLoading) return 'bg-gray-500 hover:bg-gray-600';
        if (attendanceStatus?.status === 'clocked_in') return 'bg-green-600 hover:bg-green-700';
        return 'bg-red-600 hover:bg-red-700'; 
    }, [statusLoading, attendanceStatus]);


    if (!userId) {
        return null;
    }

    // ฟังก์ชัน Render ปุ่มเข้า/ออกงาน
    const renderButton = () => {
        if (statusLoading) {
            return <div className="text-sm font-medium text-gray-500">รอ...</div>;
        }
        if (!attendanceStatus) {
             return <div className="text-sm font-medium text-gray-500">Error</div>;
        }

        switch (attendanceStatus.status) {
            case 'not_clocked_in':
            case 'clocked_out':
                return (
                    <button onClick={handleClockIn} disabled={loading} className="btn-success btn-sm flex items-center gap-1 justify-center whitespace-nowrap">
                        <ArrowRightEndOnRectangleIcon className="w-4 h-4" /> 
                        <span>เข้างาน</span>
                    </button>
                );
            case 'clocked_in':
                return (
                    <button onClick={handleClockOut} disabled={loading} className="btn-danger btn-sm flex items-center gap-1 justify-center whitespace-nowrap">
                        <ArrowLeftStartOnRectangleIcon className="w-4 h-4" /> 
                        <span>
                            ออกงาน
                        </span>
                    </button>
                );
            default:
                return <div className="text-sm font-medium text-gray-500">?</div>;
        }
    };

    // ==========================================================
    // ✅ 3. แก้ไข Container หลัก (return) ใหม่ทั้งหมด
    // ==========================================================
    return (
        <div 
            className={`
                flex items-center shadow-lg backdrop-blur-sm
                transition-all duration-300 ease-in-out
                ${isExpanded 
                    ? 'w-auto max-w-xs bg-white bg-opacity-80 rounded-lg p-2 gap-1' // 🔹 สไตล์ตอนขยาย
                    : `w-12 h-12 justify-center rounded-full text-white ${collapsedColorClass}` // 🔹 สไตล์ตอนหด
                }
            `}
        >
            
            {/* 1. ปุ่ม "หด" (Chevron) - อยู่ซ้ายสุด */}
            <button 
                onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }} 
                title="ย่อ"
                className={`
                    flex-shrink-0 p-1 rounded-full text-gray-500 hover:bg-gray-200 
                    transition-all duration-200 ease-in-out
                    ${isExpanded 
                        ? 'w-6 opacity-100' // แสดง
                        : 'w-0 opacity-0 hidden'   // ✅ FIX: ซ่อน (hidden) ตอนหด
                    }
                `}
            >
                <ChevronRightIcon className="w-5 h-5" />
            </button>
            
            {/* 2. ไอคอนนาฬิกา (ปุ่ม "ขยาย") */}
            <button
                onClick={(e) => { e.stopPropagation(); setIsExpanded(true); }}
                title="ขยาย"
                className={`
                    flex items-center justify-center flex-shrink-0
                    transition-colors duration-200 rounded-full
                    ${isExpanded 
                        ? 'p-0.5 text-gray-600' // สีตอนขยาย
                        : 'w-12 h-12 text-white' // ✅ FIX: ขนาดตอนหด
                    }
                `}
                disabled={isExpanded}
            >
                <ClockIcon className="w-6 h-6" /> 
            </button>
            
            {/* 3. เนื้อหา (เวลา, ปุ่มเข้า/ออก) */}
            <div className={`
                flex items-center gap-2 overflow-hidden
                transition-all duration-200 ease-in-out
                ${isExpanded 
                    ? 'max-w-xs opacity-100 ml-1' // แสดง
                    : 'max-w-0 opacity-0 hidden' // ✅ FIX: ซ่อน (hidden) ตอนหด
                }
            `}>
                <span className="text-gray-700 whitespace-nowrap flex-shrink-0">
                    {statusLoading ? (
                        "กำลังโหลด..."
                    ) : attendanceStatus?.status === 'clocked_in' ? (
                        <span className="font-mono text-gray-900 text-base w-20">
                            {elapsedTime || '00:00:00'}
                        </span>
                    ) : (
                        "ยังไม่ได้เข้างาน"
                    )}
                </span>
                
                <div className="flex-shrink-0">
                    {renderButton()}
                </div>
            </div>

        </div>
    );
};

export default ClockInOutButton;
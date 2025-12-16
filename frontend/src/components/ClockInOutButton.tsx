import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { 
    ClockIcon, 
    ArrowRightEndOnRectangleIcon, 
    ArrowLeftStartOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { socket } from './menu'; // ✅ ตรวจสอบ path ให้ถูกต้อง

interface AttendanceStatus {
    status: 'not_clocked_in' | 'clocked_in' | 'clocked_out';
    lastClockIn: string | null;
}

const ClockInOutButton = () => {
    const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus | null>(null);
    const [loading, setLoading] = useState(false); 
    const [statusLoading, setStatusLoading] = useState(true); 
    const [userId, setUserId] = useState<string | null>(null);
    const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');
    const [isExpanded, setIsExpanded] = useState(false);

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

    useEffect(() => {
        const storedUserId = localStorage.getItem('userId');
        if (storedUserId) {
            setUserId(storedUserId);
        } else {
            setStatusLoading(false);
        }
    }, []);

    const fetchStatus = useCallback(async () => {
        if (!userId) return;
        try {
            const res = await axios.get(`${apiUrl}/api/attendance/status`, {
                withCredentials: true,
                headers: { 'X-User-Id': userId }
            });
            setAttendanceStatus(res.data);
        } catch (error) {
            console.error("Error fetching status:", error);
        } finally {
            setStatusLoading(false);
        }
    }, [userId, apiUrl]);

    useEffect(() => {
        if (userId) fetchStatus();
    }, [userId, fetchStatus]);

    useEffect(() => {
        if (!userId) return;
        const handleUpdate = () => {
            console.log("Attendance updated via socket");
            fetchStatus();
        };
        socket.on(`attendance_updated_${userId}`, handleUpdate);
        return () => {
            socket.off(`attendance_updated_${userId}`, handleUpdate);
        };
    }, [userId, fetchStatus]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (attendanceStatus?.status === 'clocked_in' && attendanceStatus.lastClockIn) {
            const startTime = new Date(attendanceStatus.lastClockIn).getTime();
            const updateTimer = () => {
                const now = new Date().getTime();
                const diff = Math.floor((now - startTime) / 1000);
                if (diff < 0) {
                    setElapsedTime("00:00:00");
                    return;
                }
                const hours = Math.floor(diff / 3600);
                const minutes = Math.floor((diff % 3600) / 60);
                const seconds = diff % 60;
                setElapsedTime(
                    `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
                );
            };
            updateTimer();
            interval = setInterval(updateTimer, 1000);
        } else {
            setElapsedTime("00:00:00");
        }
        return () => clearInterval(interval);
    }, [attendanceStatus]);

    const handleClockIn = async () => {
        if (!userId) return;
        try {
            const { value: note, isConfirmed } = await Swal.fire({
                title: 'ยืนยันการเข้างาน',
                input: 'text',
                inputLabel: 'หมายเหตุ (ถ้ามี)',
                inputPlaceholder: 'เช่น มาสายเนื่องจาก...',
                showCancelButton: true,
                confirmButtonText: 'บันทึกเวลา',
                cancelButtonText: 'ยกเลิก',
                confirmButtonColor: '#10B981',
                cancelButtonColor: '#d33'
            });

            if (isConfirmed) {
                setLoading(true);
                await axios.post(`${apiUrl}/api/attendance/clock-in`, 
                    { note: note || '' }, 
                    { withCredentials: true, headers: { 'X-User-Id': userId } }
                );
                
                await Swal.fire({ icon: 'success', title: 'บันทึกเวลาเข้างานสำเร็จ', timer: 1500, showConfirmButton: false });
                fetchStatus();
                setIsExpanded(true);
            }
        } catch (error: any) {
            Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: error.response?.data?.message || 'ไม่สามารถบันทึกเวลาได้' });
        } finally {
            setLoading(false);
        }
    };

    const handleClockOut = async () => {
        if (!userId) return;
        try {
            const { value: note, isConfirmed } = await Swal.fire({
                title: 'ยืนยันการออกงาน',
                input: 'text',
                inputLabel: 'หมายเหตุ (ถ้ามี)',
                inputPlaceholder: 'เช่น กลับก่อนเวลาเนื่องจาก...',
                showCancelButton: true,
                confirmButtonText: 'บันทึกเวลาออก',
                cancelButtonText: 'ยกเลิก',
                confirmButtonColor: '#F59E0B',
                cancelButtonColor: '#d33'
            });

            if (isConfirmed) {
                setLoading(true);
                await axios.post(`${apiUrl}/api/attendance/clock-out`, 
                    { note: note || '' },
                    { withCredentials: true, headers: { 'X-User-Id': userId } }
                );

                await Swal.fire({ icon: 'success', title: 'บันทึกเวลาออกงานสำเร็จ', timer: 1500, showConfirmButton: false });
                fetchStatus();
                setIsExpanded(false);
            }
        } catch (error: any) {
            Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: error.response?.data?.message || 'ไม่สามารถบันทึกเวลาได้' });
        } finally {
            setLoading(false);
        }
    };

    const renderButton = () => {
        if (loading || statusLoading) {
            return <button className="bg-gray-400 text-white font-bold py-2 px-4 rounded-full cursor-not-allowed">...</button>;
        }

        if (attendanceStatus?.status === 'clocked_in') {
            return (
                <button onClick={handleClockOut} className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-1.5 px-4 rounded-full shadow-lg transition-all flex items-center gap-2 text-sm whitespace-nowrap">
                    <ArrowLeftStartOnRectangleIcon className="w-5 h-5" />
                    ออกงาน
                </button>
            );
        } else {
            return (
                <button onClick={handleClockIn} className="bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 px-4 rounded-full shadow-lg transition-all flex items-center gap-2 text-sm whitespace-nowrap">
                    <ArrowRightEndOnRectangleIcon className="w-5 h-5" />
                    เข้างาน
                </button>
            );
        }
    };

    // --- Logic เลือกสีปุ่มตอนยังไม่ขยาย ---
    const getCollapsedStyle = () => {
        if (statusLoading) return 'bg-gray-400 text-white';
        
        if (attendanceStatus?.status === 'clocked_in') {
            // 🟢 กำลังทำงาน: สีเขียว + กระพริบ
            return 'bg-green-500 text-white ring-4 ring-green-200 animate-pulse';
        } else {
            // 🔴 ยังไม่เข้างาน: สีแดง (เพื่อให้เด่นว่าต้องกด)
            return 'bg-red-500 text-white hover:bg-red-600';
        }
    };

    if (!userId) return null;

    return (
        <div 
            className={`
                flex items-center bg-white shadow-xl rounded-full p-1 border border-gray-200 
                transition-all duration-300 ease-in-out
                ${isExpanded ? 'pr-4 pl-1' : 'w-14 h-14 justify-center hover:scale-110 cursor-pointer'}
            `}
            onMouseEnter={() => !isExpanded && setIsExpanded(true)}
            onMouseLeave={() => setIsExpanded(false)}
        >
            {/* ส่วนหัวปุ่ม (Icon) ที่เปลี่ยนสีตามสถานะ */}
            <div className={`
                flex items-center justify-center rounded-full transition-all duration-300 shadow-md
                ${isExpanded 
                    ? 'bg-blue-100 text-blue-600 w-10 h-10'  // ตอนขยายแล้ว (เป็นสีฟ้าอ่อนๆ สบายตา)
                    : `w-12 h-12 ${getCollapsedStyle()}`      // ตอนหดอยู่ (แดง/เขียว ตามสถานะ)
                }
            `}>
                <ClockIcon className={`${isExpanded ? 'w-6 h-6' : 'w-7 h-7'}`} />
            </div>
            
            {/* เนื้อหาที่จะยืด/หด */}
            <div className={`
                flex items-center gap-3 overflow-hidden transition-all duration-300 ease-in-out
                ${isExpanded ? 'max-w-[300px] opacity-100 ml-3' : 'max-w-0 opacity-0'}
            `}>
                <div className="flex flex-col">
                    <span className="text-xs text-gray-500 font-medium">
                        {attendanceStatus?.status === 'clocked_in' ? 'เวลาทำงาน' : 'สถานะ'}
                    </span>
                    <span className={`font-mono font-bold text-lg leading-none min-w-[80px] ${attendanceStatus?.status === 'clocked_in' ? 'text-green-600' : 'text-gray-900'}`}>
                         {attendanceStatus?.status === 'clocked_in' ? elapsedTime : 'พร้อมทำงาน'}
                    </span>
                </div>
                
                <div className="pl-2 border-l border-gray-200">
                    {renderButton()}
                </div>
            </div>
        </div>
    );
};

export default ClockInOutButton;
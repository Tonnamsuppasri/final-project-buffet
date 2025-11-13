import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { ClockIcon, ArrowRightEndOnRectangleIcon, ArrowLeftStartOnRectangleIcon } from '@heroicons/react/24/outline';
import { format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';
import { io } from 'socket.io-client'; // Assuming you have socket.io-client installed

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
// Assuming socket is exported correctly from './menu'
import { socket } from './menu';

interface AttendanceStatus {
    status: 'not_clocked_in' | 'clocked_in' | 'clocked_out';
    lastClockIn: string | null;
}

const ClockInOutButton = () => {
    const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus | null>(null);
    const [loading, setLoading] = useState(false); // Loading state for API calls
    const [statusLoading, setStatusLoading] = useState(true); // Separate loading state for initial status fetch
    const [userId, setUserId] = useState<number | null>(null);

    // --- 1. Effect to get userId from localStorage on mount ---
    useEffect(() => {
        const storedUserId = localStorage.getItem('userId');
        console.log("ClockInOutButton Mount: Stored User ID:", storedUserId);
        if (storedUserId) {
            const parsedId = parseInt(storedUserId, 10);
            if (!isNaN(parsedId)) {
                setUserId(parsedId);
                console.log("ClockInOutButton Mount: userId state set to:", parsedId);
            } else {
                console.error("ClockInOutButton Mount: Stored User ID is not a valid number:", storedUserId);
                 setStatusLoading(false); // Stop loading if ID is invalid
            }
        } else {
            console.warn("ClockInOutButton Mount: User ID not found in localStorage.");
             setStatusLoading(false); // Stop loading if no ID found
        }
    }, []); // Run only once on mount

    // --- 2. Function to fetch current status ---
    const fetchStatus = useCallback(async () => {
        if (!userId) {
             console.log("ClockInOutButton: fetchStatus aborted, userId is null.");
             setStatusLoading(false); // Ensure loading stops if userId is somehow null
            return;
        }
        console.log("ClockInOutButton: Proceeding with fetchStatus for userId:", userId);
        setStatusLoading(true); // Start loading status
        try {
            const response = await axios.get<AttendanceStatus>(`${apiUrl}/api/attendance/status`, {
                headers: { 'x-user-id': userId } // Send userId for authentication
            });
            setAttendanceStatus(response.data);
            console.log("ClockInOutButton: Fetched status:", response.data);
        } catch (error: any) {
            console.error("ClockInOutButton: Error fetching status:", error);
            setAttendanceStatus(null); // Reset status on error
            // Optionally show an error message, but maybe not automatically
            // Swal.fire('ผิดพลาด', 'ไม่สามารถตรวจสอบสถานะการลงเวลาได้', 'error');
        } finally {
             setStatusLoading(false); // Stop loading status
        }
    }, [userId]); // Recreate this function if userId changes

    // --- 3. Effect to fetch status when userId is available & listen to socket ---
    useEffect(() => {
        if (userId) { // Only run if userId has a value
            console.log("ClockInOutButton: userId available, fetching initial status.");
            fetchStatus(); // Fetch initial status now

            const attendanceUpdateEvent = `attendance_updated_${userId}`;
            console.log("ClockInOutButton: Setting up socket listener for:", attendanceUpdateEvent);
            socket.on(attendanceUpdateEvent, fetchStatus); // Listen for updates for this user

            // Also listen for general admin updates if your backend sends them
            // socket.on('attendance_updated_admin', fetchStatus);

            // Cleanup function when component unmounts or userId changes
            return () => {
                console.log("ClockInOutButton: Cleaning up socket listener for user:", userId);
                socket.off(attendanceUpdateEvent, fetchStatus);
                // socket.off('attendance_updated_admin', fetchStatus);
            };
        } else {
             console.log("ClockInOutButton: Skipping initial status fetch and socket listener, userId not available yet.");
        }
    }, [userId, fetchStatus]); // Dependencies: Run when userId becomes available or fetchStatus function changes


    // --- Clock In/Out Handlers ---
    const handleClockIn = async () => {
        if (!userId) return;
        setLoading(true); // Loading for button action
        try {
            await axios.post(`${apiUrl}/api/attendance/clock-in`, {}, {
               headers: { 'x-user-id': userId }
            });
            Swal.fire('สำเร็จ', 'บันทึกเวลาเข้างานเรียบร้อย', 'success');
            // fetchStatus(); // Socket event should trigger this automatically if backend emits correctly
        } catch (error: any) {
             Swal.fire('ผิดพลาด', error.response?.data?.message || 'ไม่สามารถบันทึกเวลาเข้างานได้', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleClockOut = async () => {
        if (!userId) return;
        setLoading(true); // Loading for button action
        try {
             await axios.post(`${apiUrl}/api/attendance/clock-out`, {}, {
                 headers: { 'x-user-id': userId }
             });
             Swal.fire('สำเร็จ', 'บันทึกเวลาออกงานเรียบร้อย', 'success');
             // fetchStatus(); // Socket event should trigger this automatically
        } catch (error: any) {
             Swal.fire('ผิดพลาด', error.response?.data?.message || 'ไม่สามารถบันทึกเวลาออกงานได้', 'error');
        } finally {
            setLoading(false);
        }
    };

    // --- Render Logic ---
    if (!userId) {
        // Don't render anything if there's no user ID after mount check
        return null;
    }

    const renderButton = () => {
        // Show "Loading..." while fetching initial status
        if (statusLoading) {
            return <button className="btn-secondary btn-sm" disabled>รอข้อมูล...</button>;
        }
        // Show generic "Waiting" if fetch failed (status is null)
        if (!attendanceStatus) {
             return <button className="btn-secondary btn-sm" disabled>รอข้อมูลสถานะ</button>;
        }

        switch (attendanceStatus.status) {
            case 'not_clocked_in':
            case 'clocked_out':
                return (
                    <button onClick={handleClockIn} disabled={loading} className="btn-success btn-sm flex items-center gap-1">
                        <ArrowRightEndOnRectangleIcon className="w-4 h-4" /> เข้างาน
                    </button>
                );
            case 'clocked_in':
                return (
                    <button onClick={handleClockOut} disabled={loading} className="btn-danger btn-sm flex items-center gap-1">
                        <ArrowLeftStartOnRectangleIcon className="w-4 h-4" /> ออกงาน
                    </button>
                );
            default:
                // Should not happen, but good to have a fallback
                console.error("Unknown attendance status:", attendanceStatus);
                return <button className="btn-secondary btn-sm" disabled>?</button>;
        }
    };

    return (
        <div className="flex items-center gap-2 text-sm text-white bg-white bg-opacity-10 rounded-lg px-3 py-2"> {/* Ensure text is visible */}
            <ClockIcon className="w-5 h-5 text-gray-400" /> {/* Slightly lighter icon */}
            {attendanceStatus?.status === 'clocked_in' && attendanceStatus.lastClockIn ? (
                <span className="text-gray-400"> {/* Lighter text */}
                    เข้างาน: {format(parseISO(attendanceStatus.lastClockIn), 'HH:mm น.', { locale: th })}
                </span>
            ) : statusLoading ? (
                 <span className="text-gray-400">กำลังโหลด...</span>
            ): (
                 <span className="text-gray-400">ยังไม่ได้เข้างาน</span> // More specific text
            )}
            {renderButton()}
        </div>
    );
};

export default ClockInOutButton;
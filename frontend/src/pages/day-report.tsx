import { useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import './day-report.css'

const DayReport = () => {
    const location = useLocation()
    const navigate = useNavigate()
    const username = location.state?.username

    // ถ้าเข้าหน้านี้ตรง ๆ ไม่มี username ให้ย้อนกลับไป login
    useEffect(() => {
        if (!username) {
            navigate('/')
        }
    }, [username, navigate])

    return (
        <div className="rounded-t-3xl day-report-container">
            <div className="w-full h-30 rounded-t-3xl mx-auto day-report-header">
                <h1 className="text-5xl font-bold text-white flex items-center h-full pl-8">Report Day</h1>
            </div>

            <div className="day-report-info">

            </div>
            
            <div className="">

            </div>
        </div>
    )
}

export default DayReport
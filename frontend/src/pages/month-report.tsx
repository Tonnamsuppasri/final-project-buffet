import { useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import './month-report.css'
import Menu from '../components/menu' // path ขึ้นอยู่กับตำแหน่งไฟล์นี้

const MonthReport = () => {
    const location = useLocation()
    const navigate = useNavigate()
    const username = location.state?.username
    const role = location.state?.role

    // ถ้าเข้าหน้านี้ตรง ๆ ไม่มี username ให้ย้อนกลับไป login
    useEffect(() => {
        if (!username) {
            navigate('/')
        }
    }, [username, navigate])

    return (
        <Menu>
        <div className="rounded-t-3xl month-report-container">
            <div className="w-full h-30  bg-black rounded-t-3xl mx-auto month-report-header">
                <h1 className="text-5xl font-bold text-white flex items-center h-full pl-8">Report Month</h1>
            </div>

            <div className="month-report-info">

            </div>
            
            <div className="">

            </div>
        </div>
        </Menu>
    )
}

export default MonthReport
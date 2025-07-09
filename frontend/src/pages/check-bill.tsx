import { useLocation } from 'react-router-dom'
import './check-bill.css'

const CheckBill = () => {
    const location = useLocation()
    const username = location.state?.username
    const role = location.state?.role

    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold">สวัสดี, {username}!</h1>
            <p>ยินดีต้อนรับเข้าสู่หน้า Check Bill</p>
            <p>Role ของคุณ คือ {role}</p>
            {role === 'ADMIN' && (
                <div className="admin-section">
                    <h2 className="text-xl font-semibold mt-4">เนื้อหาสำหรับ ADMIN</h2>
                    <p>นี่คือเนื้อหาพิเศษที่แสดงเฉพาะผู้ดูแลระบบเท่านั้น</p>
                </div>
            )}
        </div>
    )
}

export default CheckBill
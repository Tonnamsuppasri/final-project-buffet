import { useLocation } from 'react-router-dom'
import './table.css'

const Table = () => {
    const location = useLocation()
    const username = location.state?.username
    const role = location.state?.role

    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold">สวัสดี, {username}!</h1>
            <p>ยินดีต้อนรับเข้าสู่หน้า Table</p>
            <p>Role ของคุณ คือ {role}</p>
            {role === 'ADMIN' && (
                <div className="admin-section">
                    <h2 className="text-xl font-semibold mt-4">เนื้อหาสำหรับทุกคน</h2>
                    <p>นี่คือเนื้อหาสำหรับจัดการสถานะโต๊ะ</p>
                </div>
            )}
        </div>
    )
}

export default Table
import { useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import './home.css'
import Menu from '../components/menu' // path ขึ้นอยู่กับตำแหน่งไฟล์นี้

const Home = () => {
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
        <div className="p-8">
            <h1 className="text-3xl font-bold">สวัสดี, {username}!</h1>
            <p>ยินดีต้อนรับเข้าสู่หน้า Home</p>
            <p>Role ของคุณ คือ {role}</p>
            {role === 'ADMIN' && (
                <div className="admin-section">
                    <h2 className="text-xl font-semibold mt-4">เนื้อหาสำหรับ ADMIN</h2>
                    <p>นี่คือเนื้อหาพิเศษที่แสดงเฉพาะผู้ดูแลระบบเท่านั้น</p>
                </div>
            )}
        </div>
        </Menu>
    )
}

export default Home
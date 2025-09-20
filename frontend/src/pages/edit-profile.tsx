import { useState, useEffect, useRef, type FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import axios from 'axios'
import Swal from 'sweetalert2'
import { 
  UserIcon, 
  LockClosedIcon, 
  PhoneIcon, 
  EnvelopeIcon,
  UserCircleIcon,
  IdentificationIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowLeftIcon,
  CameraIcon
} from '@heroicons/react/24/solid'
import './edit-profile.css'

interface UserProfile {
  id: number
  username: string
  email: string
  phone: string
  role: string
  nickname: string
  first_name: string
  last_name: string
  image?: string // แก้ไขจาก profile_image เป็น image ให้ตรงกับ backend
}

function EditProfile() {
  const [profile, setProfile] = useState<UserProfile>({
    id: 0,
    username: '',
    email: '',
    phone: '',
    role: '',
    nickname: '',
    first_name: '',
    last_name: '',
    image: '' // แก้ไขจาก profile_image เป็น image
  })
  const [newPassword, setNewPassword] = useState<string>('')
  const [confirmPassword, setConfirmPassword] = useState<string>('')
  const [showPassword, setShowPassword] = useState<boolean>(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(true)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [previewImage, setPreviewImage] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const navigate = useNavigate()
  const location = useLocation()
  
  // Get user data from location state (passed from Menu component)
  const username = location.state?.username
  const role = location.state?.role
  const userId = location.state?.userId

  useEffect(() => {
    // Redirect to login if no user data
    if (!username || !role) {
      Swal.fire({
        icon: 'error',
        title: 'ข้อผิดพลาด',
        text: 'ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่',
        confirmButtonText: 'ตกลง'
      }).then(() => {
        navigate('/')
      })
      return
    }
    
    fetchUserProfile()
  }, [username, role])

  const fetchUserProfile = async () => {
    try {
      setIsLoadingProfile(true)
      
      // Try to get all staff first and find matching username
      const staffRes = await axios.get('http://localhost:3001/api/staff')
      const user = staffRes.data.find((u: any) => u.username === username)
      
      if (!user) {
        throw new Error('ไม่พบข้อมูลผู้ใช้')
      }
      
      setProfile({
        id: user.iduser, // API staff ใช้ iduser
        username: user.username,
        email: user.email || '',
        phone: user.phone || '',
        role: user.role,
        nickname: user.nickname || '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        image: user.image || '' // ใช้ image field จาก backend
      })
    } catch (error: any) {
      console.error('Error fetching profile:', error)
      Swal.fire({
        icon: 'error',
        title: 'ไม่สามารถโหลดข้อมูลได้',
        text: error.response?.data?.error || error.message || 'เกิดข้อผิดพลาด'
      })
    } finally {
      setIsLoadingProfile(false)
    }
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    // Validate password confirmation
    if (newPassword && newPassword !== confirmPassword) {
      Swal.fire({
        icon: 'error',
        title: 'รหัสผ่านไม่ตรงกัน',
        text: 'โปรดตรวจสอบรหัสผ่านให้ตรงกัน'
      })
      return
    }

    // Validate required fields
    if (!profile.username || !profile.email || !profile.phone) {
      Swal.fire({
        icon: 'error',
        title: 'ข้อมูลไม่ครบถ้วน',
        text: 'โปรดกรอกข้อมูล ชื่อผู้ใช้, อีเมล และเบอร์โทรศัพท์'
      })
      return
    }

    setIsLoading(true)
    
    try {
      // สร้าง object สำหรับส่งไป backend
      const updateData: any = {
        username: profile.username,
        email: profile.email,
        phone: profile.phone,
        role: profile.role,
        nickname: profile.nickname || null,
        first_name: profile.first_name || null,
        last_name: profile.last_name || null,
      }
      
      if (newPassword) {
        updateData.newPassword = newPassword
      }
      
      // จัดการรูปภาพ - ถ้ามีรูปใหม่ให้แปลง หากไม่มีให้ส่งรูปเดิม
      if (selectedImage) {
        const base64 = await convertImageToBase64(selectedImage)
        updateData.image = base64
      } else {
        // ถ้าไม่มีรูปใหม่ให้ส่งรูปเดิมไป (เพื่อไม่ให้หาย)
        updateData.image = profile.image || null
      }

      const res = await axios.put(`http://localhost:3001/api/staff/${profile.id}`, updateData, {
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (res.status === 200) {
        await Swal.fire({
          icon: 'success',
          title: 'อัปเดตข้อมูลสำเร็จ',
          text: 'ข้อมูลของคุณได้รับการอัปเดตแล้ว',
          timer: 2000,
          showConfirmButton: false
        })
        
        // Clear password fields
        setNewPassword('')
        setConfirmPassword('')
        setSelectedImage(null)
        setPreviewImage('')
        
        // Refresh profile data
        fetchUserProfile()
        
        // If username was changed, navigate back to login
        if (profile.username !== username) {
          await Swal.fire({
            icon: 'info',
            title: 'ชื่อผู้ใช้ถูกเปลี่ยน',
            text: 'กรุณาเข้าสู่ระบบใหม่ด้วยชื่อผู้ใช้ใหม่',
            confirmButtonText: 'ตกลง'
          })
          navigate('/')
        }
      }
    } catch (error: any) {
      console.error('Error updating profile:', error)
      Swal.fire({
        icon: 'error',
        title: 'ไม่สามารถอัปเดตข้อมูลได้',
        text: error.response?.data?.error || 'เกิดข้อผิดพลาด'
      })
    } finally {
      setIsLoading(false)
    }
  }

  // ฟังก์ชันแปลงรูปเป็น base64
  const convertImageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        // ตัด "data:image/...;base64," ออก เหลือแต่ base64 string
        const base64Data = result.split(',')[1]
        resolve(base64Data)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const handleInputChange = (field: keyof UserProfile, value: string) => {
    setProfile(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        Swal.fire({
          icon: 'error',
          title: 'ไฟล์ไม่ถูกต้อง',
          text: 'กรุณาเลือกไฟล์รูปภาพเท่านั้น'
        })
        return
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        Swal.fire({
          icon: 'error',
          title: 'ไฟล์ใหญ่เกินไป',
          text: 'กรุณาเลือกไฟล์ที่มีขนาดไม่เกิน 5MB'
        })
        return
      }

      setSelectedImage(file)
      
      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => {
        setPreviewImage(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleImageClick = () => {
    fileInputRef.current?.click()
  }

  const getImageSource = () => {
    // ถ้ามี preview image (รูปที่เลือกใหม่)
    if (previewImage) {
      return previewImage
    }
    // ถ้ามีรูปใน database (base64)
    if (profile.image) {
      return `data:image/jpeg;base64,${profile.image}`
    }
    // ถ้าไม่มีรูปให้ใช้ default
    return '/src/assets/images/no-profile.png'
  }

  const handleGoBack = () => {
    navigate('/welcome', { state: { username, role } })
  }

  const formatPhone = (phone: string) => {
    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length === 10) {
      return `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
    }
    return phone;
  }

  if (isLoadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-300">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-700 text-lg">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header Section - ใช้ style เหมือน staff-header */}
        <div className="rounded-t-3xl border bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-700 p-6 mb-0">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-4 mb-4 md:mb-0">
              <div className="text-center md:text-left">
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white">
                  แก้ไขข้อมูลส่วนตัว
                </h1>
                <p className="text-gray-200 mt-1">จัดการข้อมูลบัญชีของคุณ</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 px-4 py-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <UserCircleIcon className="h-6 w-6 text-white" />
              <span className="text-white font-bold">{role}</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-b-3xl border-l border-r border-b p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Profile Picture Section */}
            <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
              <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                <CameraIcon className="h-6 w-6 mr-3 text-blue-600" />
                รูปโปรไฟล์
              </h2>
              
              <div className="flex flex-col items-center space-y-4">
                <div className="relative group">
                  <div className="w-32 h-32 rounded-full border-4 border-white shadow-lg overflow-hidden bg-gray-100">
                    <img
                      src={getImageSource()}
                      alt="Profile"
                      className="w-full h-full object-cover cursor-pointer group-hover:opacity-80 transition-opacity"
                      onClick={handleImageClick}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.src = '/src/assets/images/no-profile.png'
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer bg-black/20 rounded-full"
                         onClick={handleImageClick}>
                      <CameraIcon className="h-8 w-8 text-white" />
                    </div>
                  </div>
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                
                <button
                  type="button"
                  onClick={handleImageClick}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center space-x-2"
                >
                  <CameraIcon className="h-4 w-4" />
                  <span>เปลี่ยนรูปภาพ</span>
                </button>
                
                <p className="text-sm text-gray-500 text-center">
                  รองรับไฟล์ JPG, PNG (สูงสุด 5MB)
                </p>
              </div>
            </div>

            {/* Personal Information Section */}
            <div className="bg-gray-50 rounded-xl p-6 border">
              <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                <UserIcon className="h-6 w-6 mr-3 text-indigo-600" />
                ข้อมูลส่วนตัว
              </h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Username */}
                <div className="space-y-2">
                  <label className="flex items-center text-gray-700 font-semibold">
                    <UserIcon className="h-4 w-4 mr-2" />
                    ชื่อผู้ใช้ *
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="กรอกชื่อผู้ใช้"
                    value={profile.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    required
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <label className="flex items-center text-gray-700 font-semibold">
                    <EnvelopeIcon className="h-4 w-4 mr-2" />
                    อีเมล *
                  </label>
                  <input
                    type="email"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="กรอกอีเมล"
                    value={profile.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    required
                  />
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <label className="flex items-center text-gray-700 font-semibold">
                    <PhoneIcon className="h-4 w-4 mr-2" />
                    เบอร์โทรศัพท์ *
                  </label>
                  <input
                    type="tel"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="กรอกเบอร์โทรศัพท์"
                    value={profile.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    required
                  />
                  {profile.phone && (
                    <p className="text-sm text-gray-500">
                      รูปแบบที่จัดรูป: {formatPhone(profile.phone)}
                    </p>
                  )}
                </div>

                {/* Nickname */}
                <div className="space-y-2">
                  <label className="flex items-center text-gray-700 font-semibold">
                    <UserCircleIcon className="h-4 w-4 mr-2" />
                    ชื่อเล่น
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="กรอกชื่อเล่น"
                    value={profile.nickname}
                    onChange={(e) => handleInputChange('nickname', e.target.value)}
                  />
                </div>

                {/* First Name */}
                <div className="space-y-2">
                  <label className="flex items-center text-gray-700 font-semibold">
                    <IdentificationIcon className="h-4 w-4 mr-2" />
                    ชื่อจริง
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="กรอกชื่อจริง"
                    value={profile.first_name}
                    onChange={(e) => handleInputChange('first_name', e.target.value)}
                  />
                </div>

                {/* Last Name */}
                <div className="space-y-2">
                  <label className="flex items-center text-gray-700 font-semibold">
                    <IdentificationIcon className="h-4 w-4 mr-2" />
                    นามสกุล
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="กรอกนามสกุล"
                    value={profile.last_name}
                    onChange={(e) => handleInputChange('last_name', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Password Section */}
            <div className="bg-yellow-50 rounded-xl p-6 border border-yellow-200">
              <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                <LockClosedIcon className="h-6 w-6 mr-3 text-yellow-600" />
                เปลี่ยนรหัสผ่าน (ไม่บังคับ)
              </h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* New Password */}
                <div className="space-y-2">
                  <label className="block text-gray-700 font-semibold">
                    รหัสผ่านใหม่
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all"
                      placeholder="กรอกรหัสผ่านใหม่"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-4 flex items-center hover:bg-gray-100 rounded-r-lg transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      ) : (
                        <EyeIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <label className="block text-gray-700 font-semibold">
                    ยืนยันรหัสผ่าน
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all"
                      placeholder="ยืนยันรหัสผ่านใหม่"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-4 flex items-center hover:bg-gray-100 rounded-r-lg transition-colors"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeSlashIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      ) : (
                        <EyeIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-6">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                    <span>กำลังอัปเดต...</span>
                  </>
                ) : (
                  <span>บันทึกการเปลี่ยนแปลง</span>
                )}
              </button>

              <button
                type="button"
                onClick={handleGoBack}
                className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 active:scale-95"
              >
                ยกเลิก
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default EditProfile
import { useState, useEffect } from 'react';
import './staff.css';
import { PlusCircleIcon } from '@heroicons/react/24/solid';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import axios from 'axios';

interface StaffType {
  id: number;
  username: string;
  role: string;
  phone: string | null; 
  email: string;
  first_name?: string;
  last_name?: string;
  nickname?: string;
  image?: string;
}

// SVG Icons สำหรับใช้ใน SweetAlert HTML string
const eyeIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#9ca3af" class="w-6 h-6" style="width: 20px; height: 20px;"><path d="M12 15a3 3 0 100-6 3 3 0 000 6z" /><path fill-rule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 010-1.113zM17.25 12a5.25 5.25 0 11-10.5 0 5.25 5.25 0 0110.5 0z" clip-rule="evenodd" /></svg>`;
const eyeSlashIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#9ca3af" class="w-6 h-6" style="width: 20px; height: 20px;"><path d="M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06l-18-18zM22.676 12.553a11.249 11.249 0 01-2.631 4.31l-3.099-3.099a5.25 5.25 0 00-6.71-6.71L7.759 4.577a11.217 11.217 0 014.242-.827c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113z" /><path d="M15.75 12c0 .18-.013.357-.037.53l-4.244-4.243A3.75 3.75 0 0115.75 12zM12.53 15.713l-4.243-4.244a3.75 3.75 0 004.243 4.243z" /><path d="M6.75 12c0-.619.107-1.213.304-1.764l-3.1-3.1a11.25 11.25 0 00-2.63 4.31c-.12.362-.12.752 0 1.114 1.489 4.467 5.702 7.69 10.675 7.69 1.5 0 2.933-.294 4.242-.827l-2.477-2.477A5.25 5.25 0 016.75 12z" /></svg>`;

const Staff = () => {
  const MySwal = withReactContent(Swal);
  const [staffList, setStaffList] = useState<StaffType[]>([]);
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      const res = await axios.get<StaffType[]>(`${apiUrl}/api/staff`);
      setStaffList(res.data);
    } catch (err) {
      console.error('Error fetching staff:', err);
      setStaffList([]); 
      Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถดึงข้อมูลพนักงานได้', 'error');
    }
  };

  const handleImageUpload = (event: Event): Promise<string | null> => {
    return new Promise((resolve) => {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0];
      
      if (file) {
        if (!file.type.startsWith('image/')) {
          Swal.showValidationMessage('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
          resolve(null);
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          Swal.showValidationMessage('ขนาดไฟล์ต้องไม่เกิน 5MB');
          resolve(null);
          return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = e.target?.result as string;
          const base64Data = base64.split(',')[1];
          resolve(base64Data);
        };
        reader.readAsDataURL(file);
      } else {
        resolve(null);
      }
    });
  };

  // ✅ ฟังก์ชันช่วยสลับ icon และ type input
  const setupPasswordToggle = (toggleId: string, inputId: string) => {
    const toggleBtn = document.getElementById(toggleId);
    const passwordInput = document.getElementById(inputId) as HTMLInputElement;
    
    if (toggleBtn && passwordInput) {
      toggleBtn.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        toggleBtn.innerHTML = type === 'password' ? eyeIcon : eyeSlashIcon;
      });
    }
  };

  const addStaff = async () => {
    const { value: formValues } = await MySwal.fire({
      title: '<h3 style="font-size: 1.5rem; color: #1e293b;">เพิ่มพนักงานใหม่</h3>',
      width: '600px',
      html: `
        <div class="swal-form-layout">
          <div class="swal-image-upload-container">
            <div class="image-preview-circle">
              <img id="preview-image" style="width: 100%; height: 100%; object-fit: cover; display: none;" />
              <div id="upload-placeholder" style="text-align: center;">
                <span style="font-size: 24px;">📷</span><br/>
                <span style="font-size: 11px; color: #64748b;">อัปโหลดรูป</span>
              </div>
              <input type="file" id="image-upload" accept="image/*" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer;" />
            </div>
          </div>

          <div class="swal-form-row">
            <div class="swal-input-group">
               <label class="swal-label">ชื่อบัญชี (Username)*</label>
               <input id="swal-username" class="swal2-input custom-input" placeholder="ระบุชื่อบัญชี">
            </div>
            <div class="swal-input-group">
               <label class="swal-label">รหัสผ่าน (Password)*</label>
               <div style="position: relative;">
                 <input id="swal-password" class="swal2-input custom-input" type="password" placeholder="ระบุรหัสผ่าน" style="padding-right: 40px;">
                 <button type="button" id="toggle-password-add" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 5px;">
                   ${eyeIcon}
                 </button>
               </div>
            </div>
          </div>

          <div class="swal-form-row">
            <div class="swal-input-group">
               <label class="swal-label">อีเมล (Email)*</label>
               <input id="swal-email" class="swal2-input custom-input" placeholder="ex: user@email.com">
            </div>
             <div class="swal-input-group">
               <label class="swal-label">เบอร์โทรศัพท์</label>
               <input id="swal-phone" class="swal2-input custom-input" placeholder="0xx-xxx-xxxx">
            </div>
          </div>

          <div class="swal-form-row">
            <div class="swal-input-group">
               <label class="swal-label">ชื่อจริง</label>
               <input id="swal-firstname" class="swal2-input custom-input" placeholder="ชื่อจริง">
            </div>
            <div class="swal-input-group">
               <label class="swal-label">นามสกุล</label>
               <input id="swal-lastname" class="swal2-input custom-input" placeholder="นามสกุล">
            </div>
          </div>

          <div class="swal-form-row">
             <div class="swal-input-group" style="flex: 0.5;">
               <label class="swal-label">ชื่อเล่น</label>
               <input id="swal-nickname" class="swal2-input custom-input" placeholder="ชื่อเล่น">
            </div>
             <div class="swal-input-group">
               <label class="swal-label">ตำแหน่ง*</label>
               <div class="swal-role-selector">
                  <div class="role-option">
                    <input type="radio" id="role-admin" name="role" value="Admin">
                    <label for="role-admin">Admin</label>
                  </div>
                  <div class="role-option">
                    <input type="radio" id="role-staff" name="role" value="Staff" checked>
                    <label for="role-staff">Staff</label>
                  </div>
               </div>
            </div>
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'บันทึกข้อมูล',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#4f46e5',
      cancelButtonColor: '#94a3b8',
      didOpen: () => {
        // ✅ Setup Toggle Password
        setupPasswordToggle('toggle-password-add', 'swal-password');

        const imageInput = document.getElementById('image-upload') as HTMLInputElement;
        const previewImage = document.getElementById('preview-image') as HTMLImageElement;
        const uploadPlaceholder = document.getElementById('upload-placeholder') as HTMLDivElement;
        
        imageInput?.addEventListener('change', (event) => {
          handleImageUpload(event).then((base64Data) => {
            if (base64Data) {
              previewImage.src = `data:image/jpeg;base64,${base64Data}`;
              previewImage.style.display = 'block';
              uploadPlaceholder.style.display = 'none';
            }
          });
        });
      },
      preConfirm: async () => {
        const username = (document.getElementById('swal-username') as HTMLInputElement)?.value;
        const email = (document.getElementById('swal-email') as HTMLInputElement)?.value;
        const password = (document.getElementById('swal-password') as HTMLInputElement)?.value;
        const phone = (document.getElementById('swal-phone') as HTMLInputElement)?.value;
        const first_name = (document.getElementById('swal-firstname') as HTMLInputElement)?.value;
        const last_name = (document.getElementById('swal-lastname') as HTMLInputElement)?.value;
        const nickname = (document.getElementById('swal-nickname') as HTMLInputElement)?.value;
        const selectedRoleElement = document.querySelector('input[name="role"]:checked') as HTMLInputElement;
        const role = selectedRoleElement ? selectedRoleElement.value : '';
        const imageInput = document.getElementById('image-upload') as HTMLInputElement;
        let imageBase64 = null;
        
        if (imageInput?.files?.[0]) {
          const result = await handleImageUpload({ target: imageInput } as any);
          imageBase64 = result === null ? undefined : result;
        }

        if (!username || !email || !password || !role) {
          Swal.showValidationMessage('กรุณากรอกข้อมูล Username, Email, Password และ Role ให้ครบถ้วน');
          return;
        }

        return { 
          username, email, password, role,
          phone: phone || null,
          first_name: first_name || null,
          last_name: last_name || null,
          nickname: nickname || null,
          image: imageBase64 
        };
      },
    });

    if (formValues) {
      try {
        await axios.post(`${apiUrl}/api/staff`, formValues);
        fetchStaff();
        Swal.fire({
          icon: 'success',
          title: 'เพิ่มพนักงานสำเร็จ',
          timer: 1500,
          showConfirmButton: false,
        });
      } catch (error) {
        console.error(error);
        Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถเพิ่มพนักงานได้', 'error');
      }
    }
  };

  const editStaff = async (staff: StaffType) => {
    const { value: formValues } = await MySwal.fire({
      title: '<h3 style="font-size: 1.5rem; color: #1e293b;">แก้ไขข้อมูลพนักงาน</h3>',
      width: '600px',
      html: `
        <div class="swal-form-layout">
          <div class="swal-image-upload-container">
            <div class="image-preview-circle">
              <img id="preview-image" style="width: 100%; height: 100%; object-fit: cover; ${staff.image ? 'display: block;' : 'display: none;'}" ${staff.image ? `src="data:image/jpeg;base64,${staff.image}"` : ''} />
              <div id="upload-placeholder" style="text-align: center; ${staff.image ? 'display: none;' : 'display: block;'}">
                <span style="font-size: 24px;">📷</span><br/>
                <span style="font-size: 11px; color: #64748b;">เปลี่ยนรูป</span>
              </div>
              <input type="file" id="image-upload" accept="image/*" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer;" />
            </div>
          </div>

          <div class="swal-form-row">
            <div class="swal-input-group">
               <label class="swal-label">ชื่อบัญชี (Username)</label>
               <input id="swal-username" class="swal2-input custom-input" value="${staff.username}">
            </div>
             <div class="swal-input-group">
               <label class="swal-label">อีเมล (Email)</label>
               <input id="swal-email" class="swal2-input custom-input" value="${staff.email}">
            </div>
          </div>

          <div class="swal-form-row">
            <div class="swal-input-group">
               <label class="swal-label">รหัสผ่านใหม่ (ว่างไว้ถ้าไม่เปลี่ยน)</label>
               <div style="position: relative;">
                 <input id="swal-password" class="swal2-input custom-input" type="password" placeholder="********" style="padding-right: 40px;">
                 <button type="button" id="toggle-password-edit" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 5px;">
                   ${eyeIcon}
                 </button>
               </div>
            </div>
             <div class="swal-input-group">
               <label class="swal-label">เบอร์โทรศัพท์</label>
               <input id="swal-phone" class="swal2-input custom-input" value="${staff.phone || ''}">
            </div>
          </div>

          <div class="swal-form-row">
            <div class="swal-input-group">
               <label class="swal-label">ชื่อจริง</label>
               <input id="swal-firstname" class="swal2-input custom-input" value="${staff.first_name || ''}">
            </div>
            <div class="swal-input-group">
               <label class="swal-label">นามสกุล</label>
               <input id="swal-lastname" class="swal2-input custom-input" value="${staff.last_name || ''}">
            </div>
          </div>

          <div class="swal-form-row">
             <div class="swal-input-group" style="flex: 0.5;">
               <label class="swal-label">ชื่อเล่น</label>
               <input id="swal-nickname" class="swal2-input custom-input" value="${staff.nickname || ''}">
            </div>
             <div class="swal-input-group">
               <label class="swal-label">ตำแหน่ง</label>
               <div class="swal-role-selector">
                  <div class="role-option">
                    <input type="radio" id="role-admin" name="role" value="Admin" ${staff.role === 'Admin' ? 'checked' : ''}>
                    <label for="role-admin">Admin</label>
                  </div>
                  <div class="role-option">
                    <input type="radio" id="role-staff" name="role" value="Staff" ${staff.role === 'Staff' ? 'checked' : ''}>
                    <label for="role-staff">Staff</label>
                  </div>
               </div>
            </div>
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'บันทึกการแก้ไข',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#4f46e5',
      cancelButtonColor: '#94a3b8',
      didOpen: () => {
        // ✅ Setup Toggle Password สำหรับหน้าแก้ไข
        setupPasswordToggle('toggle-password-edit', 'swal-password');

        const imageInput = document.getElementById('image-upload') as HTMLInputElement;
        const previewImage = document.getElementById('preview-image') as HTMLImageElement;
        const uploadPlaceholder = document.getElementById('upload-placeholder') as HTMLDivElement;
        
        imageInput?.addEventListener('change', (event) => {
          handleImageUpload(event).then((base64Data) => {
            if (base64Data) {
              previewImage.src = `data:image/jpeg;base64,${base64Data}`;
              previewImage.style.display = 'block';
              uploadPlaceholder.style.display = 'none';
            }
          });
        });
      },
      preConfirm: async () => {
        const username = (document.getElementById('swal-username') as HTMLInputElement)?.value;
        const email = (document.getElementById('swal-email') as HTMLInputElement)?.value;
        const phone = (document.getElementById('swal-phone') as HTMLInputElement)?.value;
        const first_name = (document.getElementById('swal-firstname') as HTMLInputElement)?.value;
        const last_name = (document.getElementById('swal-lastname') as HTMLInputElement)?.value;
        const nickname = (document.getElementById('swal-nickname') as HTMLInputElement)?.value;
        const newPassword = (document.getElementById('swal-password') as HTMLInputElement)?.value;
        const selectedRoleElement = document.querySelector('input[name="role"]:checked') as HTMLInputElement;
        const role = selectedRoleElement ? selectedRoleElement.value : '';
        const imageInput = document.getElementById('image-upload') as HTMLInputElement;
        let imageBase64: string | undefined | null = staff.image;
        
        if (imageInput?.files?.[0]) {
          const result = await handleImageUpload({ target: imageInput } as any);
          imageBase64 = result;
        }

        if (!username || !email || !role) {
          Swal.showValidationMessage('กรุณากรอกข้อมูล Username, Email และ Role ให้ครบถ้วน');
          return;
        }

        return { 
          username, email, role,
          phone: phone || null, 
          first_name: first_name || null,
          last_name: last_name || null,
          nickname: nickname || null,
          newPassword: newPassword || null,
          image: imageBase64 
        };
      },
    });

    if (formValues) {
      try {
        await axios.put(`${apiUrl}/api/staff/${staff.id}`, formValues);
        fetchStaff();
        Swal.fire({
          icon: 'success',
          title: 'แก้ไขข้อมูลพนักงานสำเร็จ',
          timer: 1500,
          showConfirmButton: false,
        });
      } catch (error) {
        console.error(error);
        Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถแก้ไขข้อมูลพนักงานได้', 'error');
      }
    }
  };

  const deleteStaff = async (id: number) => {
    const result = await MySwal.fire({
      title: 'คุณแน่ใจหรือไม่?',
      text: "คุณต้องการลบพนักงานคนนี้จริงหรือไม่?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'ใช่, ลบเลย!',
      cancelButtonText: 'ยกเลิก'
    });

    if (result.isConfirmed) {
      try {
        await axios.delete(`${apiUrl}/api/staff/${id}`);
        fetchStaff();
        Swal.fire(
          'ลบสำเร็จ!',
          'ข้อมูลพนักงานถูกลบเรียบร้อยแล้ว',
          'success'
        );
      } catch (error: any) {
        console.error(error);
        Swal.fire('เกิดข้อผิดพลาด', error.response?.data?.message || 'ไม่สามารถลบพนักงานได้', 'error');
      }
    }
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return '-';
    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length === 10) {
      return `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
    }
    return phone;
  };

  return (
    <div className="rounded-t-3xl border staff-container">
      <div className="w-full rounded-t-3xl mx-auto 
                    bg-gradient-to-br from-slate-800 to-slate-900 min-h-[150px] 
                    flex flex-col items-center gap-4 p-5 
                    md:flex-row md:justify-between md:items-center md:p-8">
        
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white staff-header-title">
          จัดการพนักงาน
        </h1>
        
        <button
          onClick={addStaff}
          className="bg-white text-black font-bold py-2 px-4 rounded flex items-center gap-2 transition duration-300 hover:bg-gray-200 hover:scale-105"
        >
          <PlusCircleIcon className="w-6 h-6 sm:w-8 sm:h-8" />
          เพิ่มพนักงานใหม่
        </button>
      </div>

      <div className="p-4 overflow-x-auto">
        <table className="border border-gray-300 rounded-lg table-staff">
          <thead className="bg-gray-400 text-black text-center">
            <tr>
              <th className="py-2 px-2 sm:px-4 border">ลำดับ</th>
              <th className="py-2 px-2 sm:px-4 border">รูปภาพ</th>
              <th className="py-2 px-2 sm:px-4 border">Username</th>
              <th className="py-2 px-2 sm:px-4 border">ตำแหน่ง</th>
              <th className="py-2 px-2 sm:px-4 border">Contact</th>
              <th className="py-2 px-2 sm:px-4 border staff-actions-header">Actions</th>
            </tr>
          </thead>
          <tbody className="text-center">
            {Array.isArray(staffList) && staffList.map((staff, index) => (
              <tr key={staff.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-200'}>
                <td className="py-2 px-2 sm:px-4 border font-bold text-base sm:text-lg" data-label="ID">{index + 1}.</td>
                <td className="py-2 px-2 sm:px-4 border" data-label="รูปภาพ">
                  <div className="flex justify-center">
                    <img 
                      src={staff.image ? `data:image/jpeg;base64,${staff.image}` : '/src/assets/images/no-profile.png'} 
                      alt={`รูปของ ${staff.username}`}
                      className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-gray-300"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/src/assets/images/no-profile.png'; }}
                    />
                  </div>
                </td>
                <td className="py-2 px-2 sm:px-4 border text-sm sm:text-base" data-label="Username">
                  <div>
                    <div className="font-semibold">{staff.username}</div>
                    {(staff.first_name || staff.last_name || staff.nickname) && (
                      <div className="text-xs text-gray-600">
                        {staff.first_name} {staff.last_name} 
                        {staff.nickname && ` (${staff.nickname})`}
                      </div>
                    )}
                  </div>
                </td>
                <td className="py-2 px-2 sm:px-4 border text-sm sm:text-base" data-label="ตำแหน่ง">{staff.role}</td>
                <td className="py-2 px-2 sm:px-4 border text-left text-sm sm:text-base" data-label="Contact">
                  <div><strong>เบอร์ติดต่อ:</strong> {formatPhone(staff.phone)}</div>
                  <div><strong>Email:</strong> {staff.email}</div>
                </td>
                <td className="py-2 px-2 sm:px-4 border" data-label="Actions">
                  <div className="staff-actions-buttons">
                    <button
                      onClick={() => editStaff(staff)}
                      className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1 rounded flex items-center gap-1 mx-auto text-sm sm:text-base"
                    >
                      ✏️ <span className="hidden sm:inline">แก้ไข</span>
                    </button>
                    <button
                      onClick={() => deleteStaff(staff.id)}
                      className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded flex items-center gap-1 mx-auto text-sm sm:text-base"
                    >
                      🗑️ <span className="hidden sm:inline">ลบ</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {Array.isArray(staffList) && Array.from({ length: Math.max(0, 10 - staffList.length) }).map((_, i) => (
              <tr key={`empty-${i}`} className={(staffList.length + i) % 2 === 0 ? 'bg-white' : 'bg-gray-200'}>
                <td className="py-2 px-2 sm:px-4 border font-bold text-base sm:text-lg" data-label="ID">{staffList.length + i + 1}.</td>
                <td className="py-2 px-2 sm:px-4 border" data-label="รูปภาพ">&nbsp;</td>
                <td className="py-2 px-2 sm:px-4 border" data-label="Username">&nbsp;</td>
                <td className="py-2 px-2 sm:px-4 border" data-label="ตำแหน่ง">&nbsp;</td>
                <td className="py-2 px-2 sm:px-4 border" data-label="Contact">&nbsp;</td>
                <td className="py-2 px-2 sm:px-4 border" data-label="Actions">&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Staff;
import { useState, useEffect } from 'react';
import './staff.css';
import { PlusCircleIcon } from '@heroicons/react/24/solid';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

interface StaffType {
  id: number;
  username: string;
  role: string;
  phone: string | null; // ✅ แก้ไข: ทำให้ phone สามารถเป็น null ได้
  email: string;
  first_name?: string;
  last_name?: string;
  nickname?: string;
  image?: string; // base64 string
}

const Staff = () => {
  const MySwal = withReactContent(Swal);

  const [staffList, setStaffList] = useState<StaffType[]>([]);

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = () => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    fetch(`${apiUrl}/api/staff`)
      .then(res => res.json())
      .then(data => setStaffList(data))
      .catch(err => {
        console.error('Error fetching staff:', err);
        Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถดึงข้อมูลพนักงานได้', 'error');
      });
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

  const addStaff = async () => {
    const { value: formValues } = await MySwal.fire({
      title: 'เพิ่มพนักงานใหม่',
      html: `
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; justify-content: center; margin-bottom: 15px;">
            <div style="width: 100px; height: 100px; border: 2px dashed #ccc; display: flex; align-items: center; justify-content: center; border-radius: 50%; overflow: hidden; position: relative;">
              <img id="preview-image" style="width: 100%; height: 100%; object-fit: cover; display: none;" />
              <span id="upload-text" style="font-size: 12px; text-align: center; color: #666;">คลิกเพื่อเลือกรูป</span>
              <input type="file" id="image-upload" accept="image/*" style="position: absolute; width: 100%; height: 100%; opacity: 0; cursor: pointer;" />
            </div>
          </div>
          <input id="swal-input1" class="swal2-input" placeholder="ชื่อบัญชี*">
          <input id="swal-input2" class="swal2-input" placeholder="อีเมล*">
          <input id="swal-input3" class="swal2-input" placeholder="รหัสผ่าน*" type="password">
          <input id="swal-input4" class="swal2-input" placeholder="เบอร์โทรศัพท์ (ไม่บังคับ)">
          <input id="swal-input5" class="swal2-input" placeholder="ชื่อจริง (ไม่บังคับ)">
          <input id="swal-input6" class="swal2-input" placeholder="นามสกุล (ไม่บังคับ)">
          <input id="swal-input7" class="swal2-input" placeholder="ชื่อเล่น (ไม่บังคับ)">
          <div style="display: flex; align-items: center; justify-content: center; margin-top: 10px;">
            <label style="margin-right: 15px; font-weight: bold;">ตำแหน่ง* :</label>
            <input type="radio" id="role-admin" name="role" value="Admin" class="swal2-radio-custom" style="margin-right: 5px;">
            <label for="role-admin" style="margin-right: 15px;">Admin</label>
            <input type="radio" id="role-staff" name="role" value="Staff" class="swal2-radio-custom" style="margin-right: 5px;" checked>
            <label for="role-staff">Staff</label>
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'บันทึก',
      cancelButtonText: 'ยกเลิก',
      didOpen: () => {
        const imageInput = document.getElementById('image-upload') as HTMLInputElement;
        const previewImage = document.getElementById('preview-image') as HTMLImageElement;
        const uploadText = document.getElementById('upload-text') as HTMLSpanElement;
        
        imageInput?.addEventListener('change', (event) => {
          handleImageUpload(event).then((base64Data) => {
            if (base64Data) {
              previewImage.src = `data:image/jpeg;base64,${base64Data}`;
              previewImage.style.display = 'block';
              uploadText.style.display = 'none';
            }
          });
        });
      },
      preConfirm: async () => {
        const username = (document.getElementById('swal-input1') as HTMLInputElement)?.value;
        const email = (document.getElementById('swal-input2') as HTMLInputElement)?.value;
        const password = (document.getElementById('swal-input3') as HTMLInputElement)?.value;
        const phone = (document.getElementById('swal-input4') as HTMLInputElement)?.value;
        const first_name = (document.getElementById('swal-input5') as HTMLInputElement)?.value;
        const last_name = (document.getElementById('swal-input6') as HTMLInputElement)?.value;
        const nickname = (document.getElementById('swal-input7') as HTMLInputElement)?.value;
        const selectedRoleElement = document.querySelector('input[name="role"]:checked') as HTMLInputElement;
        const role = selectedRoleElement ? selectedRoleElement.value : '';
        const imageInput = document.getElementById('image-upload') as HTMLInputElement;
        let imageBase64 = null;
        
        if (imageInput?.files?.[0]) {
          const result = await handleImageUpload({ target: imageInput } as any);
          imageBase64 = result === null ? undefined : result;
        }

        if (!username || !email || !password || !role) {
          Swal.showValidationMessage('กรุณากรอกข้อมูลที่มีเครื่องหมาย * ให้ครบถ้วน');
          return;
        }

        return { 
          username, 
          email, 
          password, 
          phone: phone || null,
          role, 
          first_name: first_name || null,
          last_name: last_name || null,
          nickname: nickname || null,
          image: imageBase64 
        };
      },
    });

    if (formValues) {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const res = await fetch(`${apiUrl}/api/staff`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formValues),
        });
        if (!res.ok) throw new Error('เพิ่มพนักงานล้มเหลว');

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
      title: 'แก้ไขข้อมูลพนักงาน',
      html: `
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; justify-content: center; margin-bottom: 15px;">
            <div style="width: 100px; height: 100px; border: 2px dashed #ccc; display: flex; align-items: center; justify-content: center; border-radius: 50%; overflow: hidden; position: relative;">
              <img id="preview-image" style="width: 100%; height: 100%; object-fit: cover; ${staff.image ? 'display: block;' : 'display: none;'}" ${staff.image ? `src="data:image/jpeg;base64,${staff.image}"` : ''} />
              <span id="upload-text" style="font-size: 12px; text-align: center; color: #666; ${staff.image ? 'display: none;' : 'display: block;'}">คลิกเพื่อเลือกรูป</span>
              <input type="file" id="image-upload" accept="image/*" style="position: absolute; width: 100%; height: 100%; opacity: 0; cursor: pointer;" />
            </div>
          </div>
          <input id="swal-input1" class="swal2-input" placeholder="ชื่อพนักงาน" value="${staff.username}">
          <input id="swal-input2" class="swal2-input" placeholder="อีเมล" value="${staff.email}">
          <input id="swal-input3" class="swal2-input" placeholder="เบอร์โทรศัพท์" value="${staff.phone || ''}">
          <input id="swal-input5" class="swal2-input" placeholder="ชื่อจริง" value="${staff.first_name || ''}">
          <input id="swal-input6" class="swal2-input" placeholder="นามสกุล" value="${staff.last_name || ''}">
          <input id="swal-input7" class="swal2-input" placeholder="ชื่อเล่น" value="${staff.nickname || ''}">
          <div style="display: flex; align-items: center; justify-content: center; margin-top: 10px;">
            <label style="margin-right: 15px; font-weight: bold;">ตำแหน่ง :</label>
            <input type="radio" id="role-admin" name="role" value="Admin" class="swal2-radio-custom" style="margin-right: 5px;" ${staff.role === 'Admin' ? 'checked' : ''}>
            <label for="role-admin" style="margin-right: 15px;">Admin</label>
            <input type="radio" id="role-staff" name="role" value="Staff" class="swal2-radio-custom" style="margin-right: 5px;" ${staff.role === 'Staff' ? 'checked' : ''}>
            <label for="role-staff">Staff</label>
          </div>
          <input id="swal-input4" class="swal2-input" placeholder="รหัสผ่านใหม่ (ไม่ต้องกรอกหากไม่ต้องการเปลี่ยน)" type="password" style="margin-top: 10px;">
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'บันทึกการแก้ไข',
      cancelButtonText: 'ยกเลิก',
      didOpen: () => {
        const imageInput = document.getElementById('image-upload') as HTMLInputElement;
        const previewImage = document.getElementById('preview-image') as HTMLImageElement;
        const uploadText = document.getElementById('upload-text') as HTMLSpanElement;
        
        imageInput?.addEventListener('change', (event) => {
          handleImageUpload(event).then((base64Data) => {
            if (base64Data) {
              previewImage.src = `data:image/jpeg;base64,${base64Data}`;
              previewImage.style.display = 'block';
              uploadText.style.display = 'none';
            }
          });
        });
      },
      preConfirm: async () => {
        const username = (document.getElementById('swal-input1') as HTMLInputElement)?.value;
        const email = (document.getElementById('swal-input2') as HTMLInputElement)?.value;
        const phone = (document.getElementById('swal-input3') as HTMLInputElement)?.value;
        const first_name = (document.getElementById('swal-input5') as HTMLInputElement)?.value;
        const last_name = (document.getElementById('swal-input6') as HTMLInputElement)?.value;
        const nickname = (document.getElementById('swal-input7') as HTMLInputElement)?.value;
        const newPassword = (document.getElementById('swal-input4') as HTMLInputElement)?.value;
        const selectedRoleElement = document.querySelector('input[name="role"]:checked') as HTMLInputElement;
        const role = selectedRoleElement ? selectedRoleElement.value : '';
        const imageInput = document.getElementById('image-upload') as HTMLInputElement;
        let imageBase64: string | undefined | null = staff.image;
        
        if (imageInput?.files?.[0]) {
          const result = await handleImageUpload({ target: imageInput } as any);
          imageBase64 = result;
        }

        if (!username || !email || !role) {
          Swal.showValidationMessage('กรุณากรอกข้อมูลให้ครบทุกช่อง');
          return;
        }

        return { 
          username, email, 
          phone: phone || null, 
          role, 
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
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const res = await fetch(`${apiUrl}/api/staff/${staff.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formValues),
        });
        if (!res.ok) throw new Error('แก้ไขข้อมูลพนักงานล้มเหลว');

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
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'ใช่, ลบเลย!',
      cancelButtonText: 'ยกเลิก'
    });

    if (result.isConfirmed) {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const res = await fetch(`${apiUrl}/api/staff/${id}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'ลบพนักงานล้มเหลว');
        }

        fetchStaff();
        Swal.fire(
          'ลบสำเร็จ!',
          'ข้อมูลพนักงานถูกลบเรียบร้อยแล้ว',
          'success'
        );
      } catch (error: any) {
        console.error(error);
        Swal.fire('เกิดข้อผิดพลาด', error.message || 'ไม่สามารถลบพนักงานได้', 'error');
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
      <div className="w-full h-30 rounded-t-3xl mx-auto flex md:flex-row items-center justify-between staff-header ">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white text-center staff-header-title">
          จัดการพนักงาน
        </h1>
        <button
          onClick={addStaff}
          className="bg-white text-black font-bold py-2 px-4 rounded flex items-center gap-2 transition duration-300 hover:bg-gray-200 hover:scale-105 justify-center"
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
            {staffList.map((staff, index) => (
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
            {Array.from({ length: Math.max(0, 10 - staffList.length) }).map((_, i) => (
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


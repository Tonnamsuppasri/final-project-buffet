import { useState, useEffect } from 'react';
import './staff.css';
import { PlusCircleIcon } from '@heroicons/react/24/solid';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

interface StaffType {
  iduser: number;
  username: string;
  role: string;
  phone: string;
  email: string;
}

const Staff = () => {
  const MySwal = withReactContent(Swal);

  const [staffList, setStaffList] = useState<StaffType[]>([]);

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = () => {
    fetch('http://localhost:3001/api/staff')
      .then(res => res.json())
      .then(data => setStaffList(data))
      .catch(err => {
        console.error('Error fetching staff:', err);
        Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถดึงข้อมูลพนักงานได้', 'error');
      });
  };

  const addStaff = async () => {
    const { value: formValues } = await MySwal.fire({
      title: 'เพิ่มพนักงานใหม่',
      html: `
        <input id="swal-input1" class="swal2-input" placeholder="ชื่อพนักงาน">
        <input id="swal-input2" class="swal2-input" placeholder="อีเมล">
        <input id="swal-input3" class="swal2-input" placeholder="รหัสผ่าน" type="password">
        <input id="swal-input4" class="swal2-input" placeholder="เบอร์โทรศัพท์">
        <div style="display: flex; align-items: center; justify-content: center; margin-top: 10px;">
          <label style="margin-right: 15px; font-weight: bold;">ตำแหน่ง :</label>
          <input type="radio" id="role-admin" name="role" value="Admin" class="swal2-radio-custom" style="margin-right: 5px;">
          <label for="role-admin" style="margin-right: 15px;">Admin</label>
          <input type="radio" id="role-staff" name="role" value="Staff" class="swal2-radio-custom" style="margin-right: 5px;">
          <label for="role-staff">Staff</label>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'บันทึก',
      cancelButtonText: 'ยกเลิก',
      preConfirm: () => {
        const username = (document.getElementById('swal-input1') as HTMLInputElement)?.value;
        const email = (document.getElementById('swal-input2') as HTMLInputElement)?.value;
        const password = (document.getElementById('swal-input3') as HTMLInputElement)?.value;
        const phone = (document.getElementById('swal-input4') as HTMLInputElement)?.value;

        const selectedRoleElement = document.querySelector('input[name="role"]:checked') as HTMLInputElement;
        const role = selectedRoleElement ? selectedRoleElement.value : '';

        if (!username || !email || !password || !phone || !role) {
          Swal.showValidationMessage('กรุณากรอกข้อมูลให้ครบทุกช่อง');
          return;
        }

        return { username, email, password, phone, role };
      },
    });

    if (formValues) {
      try {
        const res = await fetch('http://localhost:3001/api/staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formValues),
        });
        if (!res.ok) throw new Error('เพิ่มพนักงานล้มเหลว');

        fetchStaff(); // Re-fetch staff list to show the new staff
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
        <input id="swal-input1" class="swal2-input" placeholder="ชื่อพนักงาน" value="${staff.username}">
        <input id="swal-input2" class="swal2-input" placeholder="อีเมล" value="${staff.email}">
        <input id="swal-input3" class="swal2-input" placeholder="เบอร์โทรศัพท์" value="${staff.phone}">
        <div style="display: flex; align-items: center; justify-content: center; margin-top: 10px;">
          <label style="margin-right: 15px; font-weight: bold;">ตำแหน่ง :</label>
          <input type="radio" id="role-admin" name="role" value="Admin" class="swal2-radio-custom" style="margin-right: 5px;" ${staff.role === 'Admin' ? 'checked' : ''}>
          <label for="role-admin" style="margin-right: 15px;">Admin</label>
          <input type="radio" id="role-staff" name="role" value="Staff" class="swal2-radio-custom" style="margin-right: 5px;" ${staff.role === 'Staff' ? 'checked' : ''}>
          <label for="role-staff">Staff</label>
        </div>
        <input id="swal-input4" class="swal2-input" placeholder="รหัสผ่านใหม่ (ไม่ต้องกรอกหากไม่ต้องการเปลี่ยน)" type="password" style="margin-top: 10px;">
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'บันทึกการแก้ไข',
      cancelButtonText: 'ยกเลิก',
      preConfirm: () => {
        const username = (document.getElementById('swal-input1') as HTMLInputElement)?.value;
        const email = (document.getElementById('swal-input2') as HTMLInputElement)?.value;
        const phone = (document.getElementById('swal-input3') as HTMLInputElement)?.value;
        const newPassword = (document.getElementById('swal-input4') as HTMLInputElement)?.value;

        const selectedRoleElement = document.querySelector('input[name="role"]:checked') as HTMLInputElement;
        const role = selectedRoleElement ? selectedRoleElement.value : '';

        if (!username || !email || !phone || !role) {
          Swal.showValidationMessage('กรุณากรอกข้อมูลให้ครบทุกช่อง');
          return;
        }

        return { username, email, phone, role, newPassword };
      },
    });

    if (formValues) {
      try {
        const res = await fetch(`http://localhost:3001/api/staff/${staff.iduser}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formValues),
        });
        if (!res.ok) throw new Error('แก้ไขข้อมูลพนักงานล้มเหลว');

        fetchStaff(); // Re-fetch staff list to show updated data
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

  const deleteStaff = async (iduser: number) => {
    const result = await MySwal.fire({
      title: 'คุณแน่ใจหรือไม่?',
      text: "คุณต้องการลบพนักงานคนนี้จริงหรือไม่?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'ใช่, ลบเลย!',
      cancelButtonText: 'ยกเลิก'
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`http://localhost:3001/api/staff/${iduser}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('ลบพนักงานล้มเหลว');

        fetchStaff(); // Re-fetch staff list to reflect the deletion
        Swal.fire(
          'ลบสำเร็จ!',
          'ข้อมูลพนักงานถูกลบเรียบร้อยแล้ว',
          'success'
        );
      } catch (error) {
        console.error(error);
        Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถลบพนักงานได้', 'error');
      }
    }
  };

  const formatPhone = (phone: string) => {
    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length === 10) {
      return `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
    }
    return phone; // return as-is if not 10 digits
  };

  return (
    <div className="rounded-t-3xl border staff-container">
      <div className="w-full h-30 rounded-t-3xl mx-auto flex md:flex-row items-center justify-between staff-header ">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white text-center  staff-header-title">
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
      {/* Added a wrapper div for responsive scrolling */}
      <div className="p-4 table-responsive-wrapper">
        <table className="border border-gray-300 rounded-lg table-staff">
          <thead className="bg-gray-400 text-black text-center">
            <tr>
              <th className="py-2 px-2 sm:px-4 border">ID</th>
              <th className="py-2 px-2 sm:px-4 border">Username</th>
              <th className="py-2 px-2 sm:px-4 border">ตำแหน่ง</th>
              <th className="py-2 px-2 sm:px-4 border">Contact</th>
              {/* คอลัมน์สำหรับ Actions ที่รวมปุ่มไว้ */}
              <th className="py-2 px-2 sm:px-4 border staff-actions-header">Actions</th>
            </tr>
          </thead>
          <tbody className="text-center">
            {staffList.map((staff, index) => (
              <tr
                key={staff.iduser}
                className={index % 2 === 0 ? 'bg-white' : 'bg-gray-200'}
              >
                <td className="py-2 px-2 sm:px-4 border font-bold text-base sm:text-lg" data-label="ID">{index + 1}.</td>
                <td className="py-2 px-2 sm:px-4 border text-sm sm:text-base" data-label="Username">{staff.username}</td>
                <td className="py-2 px-2 sm:px-4 border text-sm sm:text-base" data-label="ตำแหน่ง">{staff.role}</td>
                <td className="py-2 px-2 sm:px-4 border text-left text-sm sm:text-base" data-label="Contact">
                  <div><strong>เบอร์ติดต่อ:</strong> {formatPhone(staff.phone)}</div>
                  <div><strong>Email:</strong> {staff.email}</div>
                </td>
                {/* รวมปุ่มแก้ไขและลบไว้ใน <td> เดียวกัน */}
                <td className="py-2 px-2 sm:px-4 border" data-label="Actions">
                  <div className="staff-actions-buttons"> {/* เพิ่ม div wrapper สำหรับจัด flexbox */}
                    <button
                      onClick={() => editStaff(staff)}
                      className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1 rounded flex items-center gap-1 mx-auto text-sm sm:text-base"
                    >
                      ✏️ <span className="hidden sm:inline">แก้ไข</span>
                    </button>
                    <button
                      onClick={() => deleteStaff(staff.iduser)}
                      className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded flex items-center gap-1 mx-auto text-sm sm:text-base"
                    >
                      🗑️ <span className="hidden sm:inline">ลบ</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {/* Fill empty rows to ensure at least 10 rows */}
            {Array.from({ length: Math.max(0, 10 - staffList.length) }).map((_, i) => (
              <tr
                key={`empty-${i}`}
                className={(staffList.length + i) % 2 === 0 ? 'bg-white' : 'bg-gray-200'}
              >
                <td className="py-2 px-2 sm:px-4 border font-bold text-base sm:text-lg" data-label="ID">{staffList.length + i + 1}.</td>
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
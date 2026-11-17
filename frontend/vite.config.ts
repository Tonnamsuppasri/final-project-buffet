import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  server: {
    host: true, 
    allowedHosts: true, // อนุญาตให้ ngrok เข้ามาได้
    proxy: {
      // ✅ เพิ่ม Proxy: ส่งต่อ API ทุกอย่างไปที่ Backend
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // ✅ ส่งต่อ Socket.io ด้วย (พวกระบบแจ้งเตือน)
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
        changeOrigin: true,
      }
    }
  }
})
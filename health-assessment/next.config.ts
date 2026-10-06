import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },

  // ให้เปิดทดสอบจากมือถือ/เครื่องอื่นในวง Wi-Fi เดียวกันได้ตอน npm run dev
  // (Next บล็อกไฟล์สำหรับ dev จาก origin อื่นนอกจาก localhost ทำให้ปุ่มบนหน้าไม่ทำงาน)
  // มีผลเฉพาะโหมด dev ไม่กระทบตอน build/production
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
};

export default nextConfig;

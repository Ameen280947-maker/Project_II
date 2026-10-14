// ดึงมาแค่ชนิดข้อมูลของ config ของ Next.js (ช่วยให้ TypeScript ตรวจค่าที่ตั้ง)
import type { NextConfig } from "next";
// path ของ Node.js ใช้ต่อชื่อโฟลเดอร์ให้ถูกต้องทุกระบบปฏิบัติการ
import path from "path";

// ค่าตั้งค่าหลักของโปรเจกต์ Next.js
const nextConfig: NextConfig = {
  // ตั้งค่า Turbopack (ตัว bundle ตอนรัน dev)
  turbopack: {
    // บอกว่าโฟลเดอร์ราก (root) ของโปรเจกต์คือโฟลเดอร์ที่ไฟล์นี้อยู่ (__dirname)
    root: path.join(__dirname),
  },

  // ให้เปิดทดสอบจากมือถือ/เครื่องอื่นในวง Wi-Fi เดียวกันได้ตอน npm run dev
  // (Next บล็อกไฟล์สำหรับ dev จาก origin อื่นนอกจาก localhost ทำให้ปุ่มบนหน้าไม่ทำงาน)
  // มีผลเฉพาะโหมด dev ไม่กระทบตอน build/production
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
};

// ส่งค่าตั้งค่าออกไปให้ Next.js ใช้
export default nextConfig;

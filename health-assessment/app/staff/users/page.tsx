import UsersClient, { type Filter } from "./UsersClient";

/* =========================================================
   หน้า "จัดการผู้ใช้งาน" (Staff)
   รองรับ ?status=active|inactive|suspended ให้เลือกแท็บไว้ล่วงหน้า (ลิงก์จากหน้าภาพรวม)
========================================================= */

const STATUSES: Filter[] = ["all", "active", "inactive", "suspended"];

export default async function StaffUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = (await searchParams).status;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const status = STATUSES.find((s) => s === value) ?? "all";
  // key ทำให้สถานะในหน้ารีเซ็ตเมื่อเปิดลิงก์ที่มี ?status ต่างกัน
  return <UsersClient key={status} initialStatus={status} />;
}

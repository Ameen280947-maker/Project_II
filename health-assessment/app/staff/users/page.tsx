import UsersClient, { type Filter } from "./UsersClient";

const STATUSES: Filter[] = ["all", "active", "inactive", "suspended"];

// หน้า: จัดการบัญชีผู้ใช้ อ่านตัวกรองสถานะจาก query ?status= แล้วส่งให้ UsersClient
export default async function StaffUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = (await searchParams).status;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const status = STATUSES.find((s) => s === value) ?? "all";
  return <UsersClient key={status} initialStatus={status} />;
}

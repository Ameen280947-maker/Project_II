"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Bug,
  ClipboardCheck,
  HardDriveDownload,
  RefreshCw,
  UsersRound,
} from "lucide-react";
import {
  Card,
  LoadingBlock,
  Notice,
  PageHeader,
  PrimaryButton,
  StatCard,
  StatusBadge,
  type Status,
} from "./components/AdminUI";
import { adminFetch, formatDateTime } from "./components/adminApi";

// ข้อมูลผลตรวจระบบที่ได้จาก API /api/admin/system
type SystemData = {
  checkedAt: string;
  overall: Status;
  checks: { key: string; label: string; status: Status; detail: string }[];
  stats: {
    totalUsers: number;
    usersByRole: { role_name: string; total: number }[];
    assessments: { total: number; last7: number; today: number };
    openErrors: number;
    lastBackup: string | null;
  };
};

// ชื่อแสดงผลของแต่ละ role
const ROLE_LABEL: Record<string, string> = {
  user: "ผู้ทำแบบประเมิน",
  staff: "Staff",
  system_admin: "System Admin",
};

// หน้า Admin หลัก: แสดงสถานะสุขภาพของระบบ ฐานข้อมูล และสถิติผู้ใช้
export default function AdminSystemPage() {
  // state ของหน้า: ผลตรวจระบบ สถานะโหลด และข้อความ error
  const [data, setData] = useState<SystemData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ดึงผลตรวจสอบระบบจาก API /api/admin/system
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await adminFetch<SystemData>("/api/admin/system");
    if (res.success) setData(res);
    else setError(res.message ?? "ตรวจสอบระบบไม่สำเร็จ");
    setLoading(false);
  }, []);

  // ตรวจระบบตอนเปิดหน้า
  useEffect(() => {
    load();
  }, [load]);

  // ข้อความสรุปตามสถานะรวมของระบบ
  const overallText: Record<Status, string> = {
    ok: "ระบบทำงานปกติทุกส่วน",
    warning: "ระบบทำงานได้ แต่มีบางส่วนที่ควรตรวจสอบ",
    error: "พบปัญหาที่ต้องแก้ไข",
  };

  return (
    <>
      <PageHeader
        icon={<Activity size={28} />}
        title="ตรวจสอบระบบ"
        subtitle="สถานะการทำงานของระบบ และภาพรวมการใช้งาน"
        action={
          <PrimaryButton onClick={load} loading={loading}>
            {!loading && <RefreshCw size={16} />} ตรวจสอบอีกครั้ง
          </PrimaryButton>
        }
      />

      {/* ข้อความ error และสถานะกำลังโหลดครั้งแรก */}
      {error && <Notice kind="error">{error}</Notice>}
      {loading && !data && <LoadingBlock />}

      {data && (
        <div className="space-y-6">
          {/* แถบสรุปสถานะรวม (สีเปลี่ยนตาม ok/warning/error) */}
          <div
            className={`flex flex-col gap-2 rounded-3xl p-6 text-white sm:flex-row sm:items-center sm:justify-between ${
              data.overall === "ok"
                ? "bg-gradient-to-r from-[#1e3a8a] to-[#2563eb]"
                : data.overall === "warning"
                  ? "bg-gradient-to-r from-[#1e3a8a] to-[#b45309]"
                  : "bg-gradient-to-r from-[#1e3a8a] to-[#b91c1c]"
            }`}
          >
            <div>
              <p className="text-sm text-blue-100">สถานะรวมของระบบ</p>
              <p className="mt-1 text-xl font-bold">{overallText[data.overall]}</p>
            </div>
            <p className="text-sm text-blue-100">ตรวจล่าสุด {formatDateTime(data.checkedAt)}</p>
          </div>

          {/* การ์ดสถิติ: ผู้ใช้ การประเมิน ข้อผิดพลาดค้าง และสำรองล่าสุด */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={<UsersRound size={22} />} label="ผู้ใช้ทั้งหมด" value={data.stats.totalUsers} />
            <StatCard
              icon={<ClipboardCheck size={22} />}
              label="การประเมินทั้งหมด"
              value={data.stats.assessments.total}
              hint={`วันนี้ ${data.stats.assessments.today} · 7 วัน ${data.stats.assessments.last7}`}
            />
            <StatCard icon={<Bug size={22} />} label="ข้อผิดพลาดค้างอยู่" value={data.stats.openErrors} />
            <StatCard
              icon={<HardDriveDownload size={22} />}
              label="สำรองข้อมูลล่าสุด"
              value={<span className="text-base">{formatDateTime(data.stats.lastBackup)}</span>}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3 [&>*]:min-w-0">
            {/* รายการผลตรวจแต่ละส่วนของระบบ */}
            <Card className="min-w-0 lg:col-span-2">
              <h2 className="mb-4 text-lg font-bold">ผลการตรวจสอบ</h2>
              <ul className="divide-y divide-[#eef1f7]">
                {data.checks.map((c) => (
                  <li key={c.key} className="flex items-center justify-between gap-4 py-3.5">
                    <div>
                      <p className="font-semibold">{c.label}</p>
                      <p className="text-sm text-[#64748b]">{c.detail}</p>
                    </div>
                    <StatusBadge status={c.status} />
                  </li>
                ))}
              </ul>
            </Card>

            {/* การ์ดจำนวนผู้ใช้แยกตามบทบาท พร้อมแถบสัดส่วน */}
            <div className="min-w-0 space-y-6">
              <Card>
                <h2 className="mb-4 text-lg font-bold">ผู้ใช้ตามบทบาท</h2>
                <div className="space-y-3">
                  {data.stats.usersByRole.map((r) => {
                    const pct = data.stats.totalUsers
                      ? Math.round((r.total / data.stats.totalUsers) * 100)
                      : 0;
                    return (
                      <div key={r.role_name}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span>{ROLE_LABEL[r.role_name] ?? r.role_name}</span>
                          <span className="font-semibold">{r.total}</span>
                        </div>
                        <div className="h-2 rounded-full bg-[#eef1f7]">
                          <div className="h-2 rounded-full bg-[#1e3a8a]" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

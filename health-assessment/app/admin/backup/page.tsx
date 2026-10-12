"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, HardDriveDownload, ShieldAlert } from "lucide-react";
import {
  Card,
  GhostButton,
  LoadingBlock,
  Notice,
  PageHeader,
  PrimaryButton,
  StatusBadge,
} from "../components/AdminUI";
import { adminFetch, adminHeaders, formatBytes, formatDateTime } from "../components/adminApi";

/* =========================================================
   หน้า: สำรองข้อมูล  (/admin/backup)
========================================================= */

type Backup = {
  backup_id: number;
  file_name: string;
  tables: string[];
  total_rows: number;
  file_size_bytes: string | number;
  status: "success" | "failed";
  note: string | null;
  created_by_name: string | null;
  created_at: string;
};

// หน้าสำรองข้อมูลของแอดมิน: กดสร้างไฟล์สำรอง (ดาวน์โหลด JSON) และดูประวัติการสำรอง
export default function AdminBackupPage() {
  const [history, setHistory] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  // โหลดประวัติการสำรองข้อมูลจาก API
  const load = useCallback(async () => {
    const res = await adminFetch<{ history: Backup[] }>("/api/admin/backup");
    if (res.success) setHistory(res.history);
    else setNotice({ kind: "error", text: res.message ?? "โหลดไม่สำเร็จ" });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // สั่งสำรองข้อมูล แล้วดาวน์โหลดไฟล์ที่ได้ลงเครื่องทันที จากนั้นโหลดประวัติใหม่
  const runBackup = async () => {
    setRunning(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/backup", {
        method: "POST",
        headers: adminHeaders(),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message ?? "สำรองข้อมูลไม่สำเร็จ");
      }

      const fileName = response.headers.get("X-Backup-File-Name") ?? "health-backup.json";
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      setNotice({ kind: "success", text: `สำรองข้อมูลเรียบร้อย ดาวน์โหลดไฟล์ ${fileName} แล้ว` });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "สำรองข้อมูลไม่สำเร็จ" });
    } finally {
      setRunning(false);
      load();
    }
  };

  return (
    <>
      <PageHeader
        icon={<HardDriveDownload size={28} />}
        title="สำรองข้อมูล"
        subtitle="ดาวน์โหลดข้อมูลในฐานข้อมูลเป็นไฟล์ JSON และดูประวัติการสำรอง"
      />

      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}
      {loading ? (
        <LoadingBlock />
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          {/* สร้าง backup */}
          <Card className="lg:col-span-2">
            <h2 className="text-lg font-bold">สำรองข้อมูลทั้งหมด</h2>
            <p className="mt-1 text-sm text-[#64748b]">
              ดาวน์โหลดข้อมูลทุกตารางเป็นไฟล์ JSON (ไม่รวมรหัสผ่านของผู้ใช้)
            </p>

            <PrimaryButton className="mt-5 w-full py-4" loading={running} onClick={runBackup}>
              {!running && <Download size={18} />}
              {running ? "กำลังสำรองข้อมูล..." : "สำรองข้อมูล"}
            </PrimaryButton>

            <div className="mt-4 flex gap-2 rounded-2xl bg-[#fef5e2] p-3 text-xs text-[#92400e]">
              <ShieldAlert size={16} className="shrink-0" />
              ไฟล์สำรองมีข้อมูลส่วนตัวและข้อมูลสุขภาพของผู้ใช้ ควรเก็บในที่ปลอดภัย
            </div>
          </Card>

          {/* ประวัติ */}
          <Card className="overflow-hidden p-0 lg:col-span-3">
            <div className="flex items-center justify-between p-6 pb-3">
              <h2 className="text-lg font-bold">ประวัติการสำรองข้อมูล</h2>
              <GhostButton onClick={load} className="py-2">รีเฟรช</GhostButton>
            </div>
            {history.length === 0 ? (
              <p className="px-6 pb-8 pt-4 text-center text-sm text-[#64748b]">ยังไม่เคยสำรองข้อมูล</p>
            ) : (
              <ul className="divide-y divide-[#eef1f7]">
                {history.map((b) => (
                  <li key={b.backup_id} className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-semibold text-[#1e3a8a]">{b.file_name}</p>
                      <p className="text-xs text-[#64748b]">
                        {formatDateTime(b.created_at)} · โดย {b.created_by_name ?? "-"} · {b.tables.length} ตาราง ·{" "}
                        {b.total_rows.toLocaleString()} แถว · {formatBytes(Number(b.file_size_bytes))}
                      </p>
                      {b.note && <p className="mt-1 text-xs text-[#475569]">“{b.note}”</p>}
                    </div>
                    <StatusBadge
                      status={b.status === "success" ? "ok" : "error"}
                      label={b.status === "success" ? "สำเร็จ" : "ล้มเหลว"}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

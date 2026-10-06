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

export default function AdminBackupPage() {
  const [tables, setTables] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<Backup[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await adminFetch<{ tables: string[]; history: Backup[] }>("/api/admin/backup");
    if (res.success) {
      setTables(res.tables);
      setHistory(res.history);
      setSelected((prev) => (prev.size ? prev : new Set(res.tables)));
    } else setNotice({ kind: "error", text: res.message ?? "โหลดไม่สำเร็จ" });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (t: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  const allSelected = selected.size === tables.length && tables.length > 0;

  const runBackup = async () => {
    setRunning(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/backup", {
        method: "POST",
        headers: adminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ tables: allSelected ? [] : [...selected], note }),
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
      setNote("");
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
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">เลือกตารางที่ต้องการสำรอง</h2>
              <button
                onClick={() => setSelected(allSelected ? new Set() : new Set(tables))}
                className="text-sm font-semibold text-[#1e3a8a] hover:underline"
              >
                {allSelected ? "ไม่เลือกทั้งหมด" : "เลือกทั้งหมด"}
              </button>
            </div>

            <div className="max-h-72 space-y-1 overflow-y-auto rounded-2xl border border-[#eef1f7] p-2">
              {tables.map((t) => (
                <label key={t} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 hover:bg-[#f5f7fb]">
                  <input
                    type="checkbox"
                    checked={selected.has(t)}
                    onChange={() => toggle(t)}
                    className="h-4 w-4 accent-[#1e3a8a]"
                  />
                  <span className="font-mono text-sm">{t}</span>
                </label>
              ))}
            </div>

            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="หมายเหตุ (ไม่บังคับ) เช่น ก่อนอัปเดตระบบ"
              className="mt-4 w-full rounded-2xl border border-[#e3e8f2] px-4 py-3 text-sm outline-none focus:border-[#1e3a8a]"
            />

            <PrimaryButton
              className="mt-4 w-full py-4"
              loading={running}
              disabled={selected.size === 0}
              onClick={runBackup}
            >
              {!running && <Download size={18} />}
              {running ? "กำลังสำรองข้อมูล..." : `สำรองข้อมูล (${selected.size} ตาราง)`}
            </PrimaryButton>

            <div className="mt-4 flex gap-2 rounded-2xl bg-[#fef5e2] p-3 text-xs text-[#92400e]">
              <ShieldAlert size={16} className="shrink-0" />
              ไฟล์สำรองมีข้อมูลส่วนตัวและรหัสผ่านที่เข้ารหัสของผู้ใช้ ควรเก็บในที่ปลอดภัย
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

"use client";

import { useCallback, useEffect, useState } from "react";
import { Database, RefreshCw, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import {
  Card,
  GhostButton,
  LoadingBlock,
  Notice,
  PageHeader,
  PrimaryButton,
  StatusBadge,
} from "../components/AdminUI";
import { adminFetch, formatDateTime } from "../components/adminApi";

/* =========================================================
   หน้า: ดูแลฐานข้อมูล  (/admin/database)
========================================================= */

type TableInfo = {
  table_name: string;
  rows: number;
  dead_rows: number;
  size: string;
  last_vacuum: string | null;
  last_analyze: string | null;
};

type Integrity = { key: string; label: string; count: number | null; error: string | null };

type DbData = { databaseSize: string; tables: TableInfo[]; integrity: Integrity[] };

export default function AdminDatabasePage() {
  const [data, setData] = useState<DbData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await adminFetch<DbData>("/api/admin/database");
    if (res.success) setData(res);
    else setNotice({ kind: "error", text: res.message ?? "โหลดข้อมูลไม่สำเร็จ" });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (key: string, json: Record<string, string>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(key);
    setNotice(null);
    const res = await adminFetch("/api/admin/database", { method: "POST", json });
    setNotice({ kind: res.success ? "success" : "error", text: res.message ?? "" });
    setBusy(null);
    load();
  };

  const totalRows = data?.tables.reduce((s, t) => s + t.rows, 0) ?? 0;
  const totalDead = data?.tables.reduce((s, t) => s + t.dead_rows, 0) ?? 0;

  return (
    <>
      <PageHeader
        icon={<Database size={28} />}
        title="ดูแลฐานข้อมูล"
        subtitle="ดูขนาดตาราง ปรับปรุงประสิทธิภาพ และตรวจความถูกต้องของข้อมูล"
        action={
          <div className="flex gap-2">
            <GhostButton onClick={load} disabled={loading}>
              <RefreshCw size={16} /> รีเฟรช
            </GhostButton>
            <PrimaryButton
              loading={busy === "vacuum-all"}
              onClick={() =>
                run("vacuum-all", { action: "vacuum" }, "VACUUM ทุกตาราง? อาจใช้เวลาสักครู่")
              }
            >
              {busy !== "vacuum-all" && <Sparkles size={16} />} ปรับปรุงทุกตาราง
            </PrimaryButton>
          </div>
        }
      />

      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}
      {loading && !data && <LoadingBlock />}

      {data && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <p className="text-sm text-[#64748b]">ขนาดฐานข้อมูล</p>
              <p className="text-2xl font-bold">{data.databaseSize}</p>
            </Card>
            <Card>
              <p className="text-sm text-[#64748b]">ตาราง / แถวทั้งหมด</p>
              <p className="text-2xl font-bold">
                {data.tables.length} <span className="text-base font-medium text-[#64748b]">/ {totalRows.toLocaleString()}</span>
              </p>
            </Card>
            <Card>
              <p className="text-sm text-[#64748b]">แถวที่รอเคลียร์ (dead rows)</p>
              <p className="text-2xl font-bold">{totalDead.toLocaleString()}</p>
            </Card>
          </div>

          {/* ตรวจความถูกต้อง */}
          <Card>
            <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
              <ShieldCheck size={18} className="text-[#1e3a8a]" /> ตรวจความถูกต้องของข้อมูล
            </h2>
            <p className="mb-4 text-sm text-[#64748b]">ค้นหาข้อมูลกำพร้าที่อ้างถึงข้อมูลที่ถูกลบไปแล้ว</p>
            <ul className="divide-y divide-[#eef1f7]">
              {data.integrity.map((c) => (
                <li key={c.key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{c.label}</p>
                    {c.error && <p className="text-xs text-[#b91c1c]">{c.error}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    {c.count === null ? (
                      <StatusBadge status="warning" label="ตรวจไม่ได้" />
                    ) : c.count === 0 ? (
                      <StatusBadge status="ok" label="ไม่พบปัญหา" />
                    ) : (
                      <>
                        <StatusBadge status="error" label={`พบ ${c.count} แถว`} />
                        <GhostButton
                          disabled={busy !== null}
                          onClick={() =>
                            run(c.key, { action: "fix_integrity", check: c.key }, `แก้ไข "${c.label}" ${c.count} แถว?`)
                          }
                        >
                          <Wrench size={15} /> แก้ไข
                        </GhostButton>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          {/* ตาราง */}
          <Card className="overflow-hidden p-0">
            <div className="p-6 pb-3">
              <h2 className="text-lg font-bold">ตารางในฐานข้อมูล</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-[#f5f7fb] text-left text-[#64748b]">
                  <tr>
                    <th className="px-6 py-3 font-semibold">ตาราง</th>
                    <th className="px-4 py-3 text-right font-semibold">จำนวนแถว</th>
                    <th className="px-4 py-3 text-right font-semibold">Dead rows</th>
                    <th className="px-4 py-3 text-right font-semibold">ขนาด</th>
                    <th className="px-4 py-3 font-semibold">Vacuum ล่าสุด</th>
                    <th className="px-6 py-3 text-right font-semibold">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef1f7]">
                  {data.tables.map((t) => (
                    <tr key={t.table_name} className="hover:bg-[#fafbfe]">
                      <td className="px-6 py-3 font-mono font-medium text-[#1e3a8a]">{t.table_name}</td>
                      <td className="px-4 py-3 text-right">{t.rows.toLocaleString()}</td>
                      <td className={`px-4 py-3 text-right ${t.dead_rows > t.rows * 0.2 && t.dead_rows > 50 ? "font-semibold text-[#b45309]" : ""}`}>
                        {t.dead_rows.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">{t.size}</td>
                      <td className="px-4 py-3 text-[#64748b]">{formatDateTime(t.last_vacuum)}</td>
                      <td className="px-6 py-3 text-right">
                        <div className="inline-flex gap-2">
                          <button
                            disabled={busy !== null}
                            onClick={() => run(`a-${t.table_name}`, { action: "analyze", table: t.table_name })}
                            className="rounded-xl px-3 py-1.5 text-xs font-semibold text-[#1e3a8a] hover:bg-[#eef2ff] disabled:opacity-40"
                          >
                            {busy === `a-${t.table_name}` ? "..." : "Analyze"}
                          </button>
                          <button
                            disabled={busy !== null}
                            onClick={() => run(`v-${t.table_name}`, { action: "vacuum", table: t.table_name })}
                            className="rounded-xl bg-[#e8eefc] px-3 py-1.5 text-xs font-semibold text-[#1e3a8a] hover:bg-[#dbe4fb] disabled:opacity-40"
                          >
                            {busy === `v-${t.table_name}` ? "..." : "Vacuum"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

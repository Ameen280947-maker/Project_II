"use client";

import { useCallback, useEffect, useState } from "react";
import { Bug, CheckCircle2, EyeOff, Plus, RotateCcw, Search, Trash2, X } from "lucide-react";
import {
  Card,
  GhostButton,
  LoadingBlock,
  Notice,
  PageHeader,
  PrimaryButton,
} from "../components/AdminUI";
import { adminFetch, formatDateTime } from "../components/adminApi";

/* =========================================================
   หน้า: แก้ไขข้อผิดพลาด  (/admin/errors)
========================================================= */

type Log = {
  log_id: number;
  source: string;
  message: string;
  stack: string | null;
  level: "error" | "warning" | "info";
  status: "open" | "resolved" | "ignored";
  resolution_note: string | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
  created_at: string;
};

type Tab = "open" | "resolved" | "ignored" | "all";

const TABS: { key: Tab; label: string }[] = [
  { key: "open", label: "ยังไม่แก้ไข" },
  { key: "resolved", label: "แก้ไขแล้ว" },
  { key: "ignored", label: "ข้ามไป" },
  { key: "all", label: "ทั้งหมด" },
];

const LEVEL_STYLE = {
  error: "bg-[#fdecec] text-[#b91c1c]",
  warning: "bg-[#fef5e2] text-[#b45309]",
  info: "bg-[#e8eefc] text-[#1e3a8a]",
};

export default function AdminErrorsPage() {
  const [tab, setTab] = useState<Tab>("open");
  const [q, setQ] = useState("");
  const [logs, setLogs] = useState<Log[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [resolving, setResolving] = useState<Log | null>(null);
  const [note, setNote] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ source: "", message: "", level: "error" });

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ status: tab, q });
    const res = await adminFetch<{ logs: Log[]; counts: Record<string, number> }>(
      `/api/admin/errors?${params}`,
    );
    if (res.success) {
      setLogs(res.logs);
      setCounts(res.counts);
    } else setNotice({ kind: "error", text: res.message ?? "โหลดไม่สำเร็จ" });
    setLoading(false);
  }, [tab, q]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const updateStatus = async (log: Log, status: Log["status"], resolutionNote = "") => {
    const res = await adminFetch("/api/admin/errors", {
      method: "PATCH",
      json: { logId: log.log_id, status, note: resolutionNote },
    });
    setNotice({ kind: res.success ? "success" : "error", text: res.message ?? "" });
    setResolving(null);
    setNote("");
    load();
  };

  const createLog = async () => {
    const res = await adminFetch("/api/admin/errors", { method: "POST", json: form });
    setNotice({ kind: res.success ? "success" : "error", text: res.message ?? "" });
    if (res.success) {
      setShowNew(false);
      setForm({ source: "", message: "", level: "error" });
      load();
    }
  };

  const clearClosed = async () => {
    if (!window.confirm("ลบรายการที่ 'แก้ไขแล้ว' และ 'ข้ามไป' ทั้งหมด?")) return;
    const res = await adminFetch("/api/admin/errors", { method: "DELETE" });
    setNotice({ kind: res.success ? "success" : "error", text: res.message ?? "" });
    load();
  };

  return (
    <>
      <PageHeader
        icon={<Bug size={28} />}
        title="แก้ไขข้อผิดพลาด"
        subtitle="ติดตามข้อผิดพลาดที่ระบบบันทึกไว้ และบันทึกวิธีแก้ไข"
        action={
          <div className="flex gap-2">
            <GhostButton onClick={clearClosed}>
              <Trash2 size={16} /> ล้างที่ปิดแล้ว
            </GhostButton>
            <PrimaryButton onClick={() => setShowNew(true)}>
              <Plus size={16} /> บันทึกปัญหา
            </PrimaryButton>
          </div>
        }
      />

      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const n = t.key === "all" ? Object.values(counts).reduce((a, b) => a + b, 0) : counts[t.key] ?? 0;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                  tab === t.key ? "bg-[#1e3a8a] text-white" : "bg-white text-[#475569] hover:bg-[#eef2ff]"
                }`}
              >
                {t.label} <span className="opacity-70">({n})</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-[#e3e8f2] bg-white px-4 py-2.5 focus-within:border-[#1e3a8a]">
          <Search size={17} className="text-[#94a3b8]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหา..."
            className="w-48 bg-transparent text-sm outline-none"
          />
        </div>
      </div>

      {loading && logs.length === 0 ? (
        <LoadingBlock />
      ) : logs.length === 0 ? (
        <Card className="py-14 text-center">
          <CheckCircle2 size={40} className="mx-auto text-[#15803d]" />
          <p className="mt-3 font-semibold">ไม่มีรายการในหมวดนี้</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <Card key={log.log_id} className="p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <button className="min-w-0 flex-1 text-left" onClick={() => setExpanded(expanded === log.log_id ? null : log.log_id)}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${LEVEL_STYLE[log.level]}`}>
                      {log.level}
                    </span>
                    <span className="font-mono text-sm font-semibold text-[#1e3a8a]">{log.source}</span>
                    <span className="text-xs text-[#94a3b8]">#{log.log_id} · {formatDateTime(log.created_at)}</span>
                  </div>
                  <p className="mt-2 break-words text-sm text-[#334155]">{log.message}</p>
                  {log.status !== "open" && (
                    <p className="mt-2 text-xs text-[#15803d]">
                      {log.status === "resolved" ? "แก้ไขแล้ว" : "ข้ามไป"} โดย {log.resolved_by_name ?? "-"} ·{" "}
                      {formatDateTime(log.resolved_at)}
                      {log.resolution_note && ` — ${log.resolution_note}`}
                    </p>
                  )}
                </button>
                <div className="flex shrink-0 gap-2">
                  {log.status === "open" ? (
                    <>
                      <GhostButton onClick={() => updateStatus(log, "ignored")} title="ข้ามไป">
                        <EyeOff size={15} />
                      </GhostButton>
                      <PrimaryButton className="py-2.5" onClick={() => setResolving(log)}>
                        <CheckCircle2 size={15} /> แก้ไขแล้ว
                      </PrimaryButton>
                    </>
                  ) : (
                    <GhostButton onClick={() => updateStatus(log, "open")}>
                      <RotateCcw size={15} /> เปิดใหม่
                    </GhostButton>
                  )}
                </div>
              </div>
              {expanded === log.log_id && log.stack && (
                <pre className="mt-4 max-h-64 overflow-auto rounded-2xl bg-[#0f172a] p-4 text-xs text-blue-100">
                  {log.stack}
                </pre>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* ---------- MODAL: ยืนยันแก้ไข ---------- */}
      {resolving && (
        <Modal title="บันทึกการแก้ไข" onClose={() => setResolving(null)}>
          <p className="mb-3 text-sm text-[#64748b]">{resolving.message}</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            placeholder="อธิบายวิธีแก้ไข (ไม่บังคับ)"
            className="w-full rounded-2xl border border-[#e3e8f2] p-3 text-sm outline-none focus:border-[#1e3a8a]"
          />
          <div className="mt-4 flex justify-end gap-2">
            <GhostButton onClick={() => setResolving(null)}>ยกเลิก</GhostButton>
            <PrimaryButton onClick={() => updateStatus(resolving, "resolved", note)}>บันทึก</PrimaryButton>
          </div>
        </Modal>
      )}

      {/* ---------- MODAL: บันทึกปัญหาใหม่ ---------- */}
      {showNew && (
        <Modal title="บันทึกปัญหาที่พบ" onClose={() => setShowNew(false)}>
          <div className="space-y-3">
            <input
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              placeholder="ตำแหน่งที่พบ เช่น หน้า Dashboard"
              className="w-full rounded-2xl border border-[#e3e8f2] px-4 py-3 text-sm outline-none focus:border-[#1e3a8a]"
            />
            <textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              rows={4}
              placeholder="รายละเอียดปัญหา"
              className="w-full rounded-2xl border border-[#e3e8f2] p-3 text-sm outline-none focus:border-[#1e3a8a]"
            />
            <select
              value={form.level}
              onChange={(e) => setForm({ ...form, level: e.target.value })}
              className="w-full rounded-2xl border border-[#e3e8f2] px-4 py-3 text-sm outline-none focus:border-[#1e3a8a]"
            >
              <option value="error">Error — ใช้งานไม่ได้</option>
              <option value="warning">Warning — ใช้งานได้แต่ผิดปกติ</option>
              <option value="info">Info — ข้อสังเกต</option>
            </select>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <GhostButton onClick={() => setShowNew(false)}>ยกเลิก</GhostButton>
            <PrimaryButton onClick={createLog}>บันทึก</PrimaryButton>
          </div>
        </Modal>
      )}
    </>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} aria-label="ปิด" className="rounded-xl p-1.5 text-[#64748b] hover:bg-[#f1f5f9]">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

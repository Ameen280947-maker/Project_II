"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Lock, Search, UserCheck } from "lucide-react";
import { FOLLOW_UP_UPDATED_EVENT, staffFetch } from "@/lib/staff/client";
import { CASE_STATUSES, CASE_STATUS_LABEL, type CaseStatus } from "@/lib/staff/cases";
import { SEVERITY_LABEL, type Severity } from "@/lib/staff/riskLevels";
import {
  Avatar,
  Card,
  Chips,
  Empty,
  ErrorBox,
  PageHeader,
  RiskPill,
  btnGhost,
  btnPrimary,
  inputCls,
  thDate,
} from "../components/ui";

/* =========================================================
   TYPES (ตรงกับ /api/staff/follow-up)
========================================================= */

type CaseRow = {
  caseId: number;
  status: CaseStatus;
  severity: number;
  username: string;
  email: string;
  assessment: string;
  riskLevel: string;
  score: number | null;
  createdAt: string;
  updatedAt: string;
  nextFollowUp: string | null;
};

type CaseDetail = {
  caseId: number;
  status: CaseStatus;
  severity: number;
  assessment: string;
  riskLevel: string;
  score: number | null;
  createdAt: string;
  nextFollowUp: string | null;
  owner: string | null;
  ownedByMe: boolean;
  user: {
    username: string;
    email: string;
    gender: string | null;
    age: number | null;
    firstAssessed: string | null;
    emergency: string | null;
  };
  latest: { assessment: string; riskLevel: string; score: number | null; severity: number; assessedAt: string }[];
  notes: { id: number; staff: string | null; status: CaseStatus; note: string; at: string }[];
};

type Filter = "all" | CaseStatus;

const STATUS_PILL: Record<CaseStatus, string> = {
  waiting: "bg-[#fde6e7] text-[#a61e28]",
  progress: "bg-[#fff3dc] text-[#8a5a00]",
  referred: "bg-[#e3f0ff] text-[#1d5fa8]",
  closed: "bg-staff-100 text-staff-800",
};

const GENDER: Record<string, string> = { male: "ชาย", female: "หญิง", M: "ชาย", F: "หญิง" };

const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short" });

function waitText(c: CaseRow) {
  if (c.status === "referred") return `แนะนำ ${shortDate(c.updatedAt)}`;
  if (c.status === "closed") return `ปิด ${shortDate(c.updatedAt)}`;
  const d = daysSince(c.createdAt);
  return d === 0 ? "วันนี้" : `รอ ${d} วัน`;
}

/* =========================================================
   PAGE
========================================================= */

export default function FollowUpPage() {
  return (
    <Suspense>
      <FollowUp />
    </Suspense>
  );
}

function FollowUp() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = Number(params.get("case")) || null;

  const [cases, setCases] = useState<CaseRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [notConsented, setNotConsented] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadList = useCallback(() => {
    return staffFetch<{ cases: CaseRow[]; counts: Record<string, number>; notConsented: number }>("/api/staff/follow-up")
      .then((d) => {
        setCases(d.cases);
        setCounts(d.counts);
        setNotConsented(d.notConsented);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return cases.filter(
      (c) =>
        (filter === "all" || c.status === filter) &&
        (!term || c.username.toLowerCase().includes(term) || (c.email ?? "").toLowerCase().includes(term))
    );
  }, [cases, filter, q]);

  // เลือกเคสแรกอัตโนมัติบนจอใหญ่
  useEffect(() => {
    if (!selectedId && shown.length && window.matchMedia("(min-width: 1024px)").matches) {
      router.replace(`/staff/follow-up?case=${shown[0].caseId}`, { scroll: false });
    }
  }, [selectedId, shown, router]);

  const select = (id: number) => router.replace(`/staff/follow-up?case=${id}`, { scroll: false });

  const chips = [
    { key: "all" as Filter, label: "ทั้งหมด", count: counts.all ?? 0 },
    ...CASE_STATUSES.map((s) => ({ key: s as Filter, label: CASE_STATUS_LABEL[s], count: counts[s] ?? 0 })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Follow-up"
        title="ติดตามผู้มีความเสี่ยง"
        highlight="สูง"
        desc="แสดงเฉพาะผู้ใช้ที่ยินยอมให้เจ้าหน้าที่เข้าถึงข้อมูลสุขภาพ"
        actions={
          <label className="relative block w-full sm:w-72">
            <span className="sr-only">ค้นหาผู้ใช้</span>
            <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-staff-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อผู้ใช้หรืออีเมล" className={`${inputCls} h-12 pl-10`} />
          </label>
        }
      />

      <Chips label="สถานะเคส" items={chips} value={filter} onChange={setFilter} />
      {notConsented > 0 && (
        <p className="-mt-2 flex items-start gap-2 rounded-2xl border border-staff-line bg-white px-4 py-3 text-sm text-staff-muted">
          <Lock size={16} className="mt-0.5 shrink-0" />
          มีผู้ใช้อีก {notConsented} คนที่ผลล่าสุดอยู่ในระดับต้องติดตาม แต่ยังไม่ยินยอมให้เจ้าหน้าที่เข้าถึงข้อมูล จึงไม่แสดงในรายการนี้ (ผู้ใช้เปิดความยินยอมได้ที่หน้าตั้งค่า)
        </p>
      )}
      <ErrorBox message={error} />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* LIST */}
        <Card className={`!p-3 lg:w-[400px] lg:shrink-0 ${selectedId ? "hidden lg:block" : ""}`}>
          {loading && <Empty>กำลังโหลด…</Empty>}
          {!loading && shown.length === 0 && (
            <Empty>{cases.length === 0 ? "ยังไม่มีเคสติดตามจากผู้ใช้ที่ยินยอม" : "ไม่พบเคสตามเงื่อนไข"}</Empty>
          )}
          <ul className="flex flex-col gap-1">
            {shown.map((c) => {
              const on = c.caseId === selectedId;
              const late = c.status === "waiting" && daysSince(c.createdAt) >= 3;
              return (
                <li key={c.caseId}>
                  <button
                    type="button"
                    onClick={() => select(c.caseId)}
                    aria-current={on ? "true" : undefined}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                      on ? "bg-staff-50 ring-2 ring-staff-300" : "hover:bg-staff-soft"
                    }`}
                  >
                    <Avatar name={c.username} tone={c.status === "closed" ? "brand" : "danger"} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{c.username}</span>
                      <span className="block truncate text-[13px] text-staff-muted">
                        {c.assessment}
                        {c.score !== null ? ` ${c.score} คะแนน` : ""} · {c.riskLevel}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_PILL[c.status]}`}>
                        {CASE_STATUS_LABEL[c.status]}
                      </span>
                      <span className={`text-xs font-semibold ${late ? "text-risk-high" : "text-staff-muted"}`}>{waitText(c)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* DETAIL */}
        <div className={`min-w-0 flex-1 ${selectedId ? "" : "hidden lg:block"}`}>
          {selectedId ? (
            <CasePanel
              key={selectedId}
              caseId={selectedId}
              onBack={() => router.replace("/staff/follow-up", { scroll: false })}
              onSaved={loadList}
            />
          ) : (
            !loading && cases.length > 0 && <Card><Empty>เลือกเคสจากรายการเพื่อดูรายละเอียด</Empty></Card>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   รายละเอียดเคส + บันทึกการติดตาม
========================================================= */

function CasePanel({ caseId, onBack, onSaved }: { caseId: number; onBack: () => void; onSaved: () => void }) {
  const [data, setData] = useState<CaseDetail | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<CaseStatus>("progress");
  const [next, setNext] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    staffFetch<{ case: CaseDetail }>(`/api/staff/follow-up?case=${caseId}`)
      .then((d) => {
        setData(d.case);
        setStatus(d.case.status === "waiting" ? "progress" : d.case.status);
        setNext(d.case.nextFollowUp ? String(d.case.nextFollowUp).slice(0, 10) : "");
      })
      .catch((e) => setError(e.message));
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (assignToMe = false) => {
    if (!data) return;
    setSaving(true);
    setError("");
    try {
      await staffFetch("/api/staff/follow-up", {
        method: "POST",
        body: JSON.stringify({
          caseId,
          status: assignToMe ? data.status : status,
          nextFollowUp: next || null,
          note,
          assignToMe,
        }),
      });
      // "บันทึกแล้ว" แสดงเฉพาะตอนบันทึกฟอร์ม ส่วนการรับเคสเห็นผลจากชื่อผู้รับผิดชอบที่เปลี่ยน
      if (!assignToMe) {
        setNote("");
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
      load();
      onSaved();
      window.dispatchEvent(new Event(FOLLOW_UP_UPDATED_EVENT));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (error && !data) return <ErrorBox message={error} />;
  if (!data) return <Card><Empty>กำลังโหลด…</Empty></Card>;

  const u = data.user;
  const meta = [GENDER[u.gender ?? ""] ?? u.gender, u.age ? `${u.age} ปี` : null, u.firstAssessed ? `ประเมินครั้งแรก ${thDate(u.firstAssessed)}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onBack} className="self-start text-sm font-semibold text-staff-600 lg:hidden">
        ← กลับไปรายการ
      </button>

      <Card>
        <div className="flex flex-wrap items-start gap-4">
          <Avatar name={u.username} tone="danger" size={56} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-2xl font-bold">{u.username}</h2>
            <p className="text-sm text-staff-muted">{meta || "ยังไม่มีข้อมูลโปรไฟล์สุขภาพ"}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-staff-100 px-3 py-1 text-xs font-semibold text-staff-800">
            <Check size={14} /> ยินยอมให้เจ้าหน้าที่ติดต่อ
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Info label="ช่องทางติดต่อ" value={u.email || "-"} />
          <Info label="ผู้ติดต่อฉุกเฉิน" value={u.emergency || "ไม่ได้ระบุ"} />
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-staff-soft px-4 py-3 sm:col-span-2">
            <div className="min-w-0">
              <p className="text-xs text-staff-muted">ผู้รับผิดชอบเคส</p>
              <p className="truncate font-semibold">{data.owner || "ยังไม่มอบหมาย"}</p>
            </div>
            {!data.owner && data.status !== "closed" && (
              <button type="button" onClick={() => save(true)} disabled={saving} className={`${btnGhost} h-10`}>
                <UserCheck size={16} /> รับเป็นผู้รับผิดชอบ
              </button>
            )}
          </div>
        </div>

        <h3 className="mb-2 mt-6 font-bold">ผลการประเมินล่าสุด</h3>
        <div className="flex flex-col gap-2">
          {data.latest.map((r) => (
            <div key={r.assessment} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-staff-line px-4 py-2.5">
              <span className="min-w-0 flex-1 truncate font-semibold">{r.assessment}</span>
              <span className="text-sm text-staff-muted">{r.score !== null ? r.score : ""}</span>
              <RiskPill severity={r.severity}>{r.riskLevel || SEVERITY_LABEL[r.severity as Severity]}</RiskPill>
              <span className="w-24 text-right text-xs text-staff-muted">{thDate(r.assessedAt)}</span>
            </div>
          ))}
          {data.latest.length === 0 && <Empty>ยังไม่มีผลการประเมิน</Empty>}
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-bold">บันทึกการติดตาม</h3>
        <ol className="mt-4 flex flex-col border-l-2 border-staff-line pl-5">
          <TimelineItem dot="bg-risk-high" who="ระบบสร้างเคสอัตโนมัติ" at={data.createdAt}>
            ผล{data.assessment} อยู่ในระดับ {data.riskLevel}
          </TimelineItem>
          {data.notes.map((n) => (
            <TimelineItem key={n.id} dot="bg-staff-500" who={n.staff || "เจ้าหน้าที่"} at={n.at}>
              {n.note}
            </TimelineItem>
          ))}
        </ol>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            เปลี่ยนสถานะเป็น
            <select value={status} onChange={(e) => setStatus(e.target.value as CaseStatus)} className={inputCls}>
              {CASE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {CASE_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            นัดติดตามครั้งถัดไป
            <input
              type="date"
              value={next}
              disabled={status === "closed"}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setNext(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold sm:col-span-2">
            บันทึกเพิ่มเติม
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="เช่น โทรติดตามแล้ว ผู้ใช้รับทราบ และแนะนำให้ไปพบแพทย์ที่สถานพยาบาลใกล้บ้าน"
              className={`${inputCls} resize-y`}
            />
          </label>
        </div>

        <ErrorBox message={error} />

        <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-1.5 text-xs text-staff-muted">
            <Lock size={14} /> การเปิดดูข้อมูลนี้ถูกบันทึกในประวัติการเข้าถึง (PDPA)
          </p>
          <button type="button" onClick={() => save(false)} disabled={saving} className={btnPrimary}>
            {saved ? <><Check size={16} /> บันทึกแล้ว</> : saving ? "กำลังบันทึก…" : "บันทึกการติดตาม"}
          </button>
        </div>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-staff-soft px-4 py-3">
      <p className="text-xs text-staff-muted">{label}</p>
      <p className="truncate font-semibold">{value}</p>
    </div>
  );
}

function TimelineItem({ dot, who, at, children }: { dot: string; who: string; at: string; children: ReactNode }) {
  return (
    <li className="relative pb-4 last:pb-0">
      <span className={`absolute -left-[27px] top-1.5 h-3 w-3 rounded-full ring-4 ring-white ${dot}`} />
      <p className="text-sm">
        <span className="font-semibold">{who}</span> <span className="text-xs text-staff-muted">{thDate(at, true)}</span>
      </p>
      <p className="text-sm text-staff-muted">{children}</p>
    </li>
  );
}

"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Lock, Search, X } from "lucide-react";
import { staffFetch } from "@/lib/staff/client";
import {
  Avatar,
  Card,
  Chips,
  Empty,
  ErrorBox,
  PageHeader,
  RiskPill,
  StatCard,
  btnGhost,
  btnPrimary,
  inputCls,
  thDate,
} from "../components/ui";

/* =========================================================
   TYPES (ตรงกับ /api/staff/users)
========================================================= */

type Status = "active" | "inactive" | "suspended";
type Filter = "all" | Status;
type Sort = "recent" | "newest" | "name";

type UserRow = {
  userId: number;
  username: string;
  email: string;
  createdAt: string;
  lastAssessed: string | null;
  assessments: number;
  consent: boolean;
  worst: { label: string; severity: number } | null;
  status: Status;
};

type ListResponse = {
  stats: { total: number; active: number; newMonth: number; suspended: number };
  total: number;
  page: number;
  pageSize: number;
  users: UserRow[];
};

type UserDetail = {
  userId: number;
  username: string;
  email: string;
  gender: string | null;
  age: number | null;
  createdAt: string;
  lastAssessed: string | null;
  assessments: number;
  isActive: boolean;
  suspendedReason: string | null;
  suspendedAt: string | null;
  consent: boolean;
  latest: { assessment: string; riskLevel: string; severity: number; assessedAt: string }[] | null;
};

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "active", label: "ใช้งานอยู่" },
  { key: "inactive", label: "ไม่ได้ใช้งานเกิน 30 วัน" },
  { key: "suspended", label: "ถูกระงับ" },
];

const STATUS_VIEW: Record<Status, { label: string; dot: string; text: string }> = {
  active: { label: "ใช้งาน", dot: "bg-staff-500", text: "text-staff-700" },
  inactive: { label: "ไม่ได้ใช้งานเกิน 30 วัน", dot: "bg-risk-mid", text: "text-[#8a5a00]" },
  suspended: { label: "ระงับ", dot: "bg-risk-high", text: "text-risk-crit" },
};

/* =========================================================
   PAGE
========================================================= */

export default function StaffUsersPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("recent");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [reload, setReload] = useState(0);
  const [error, setError] = useState("");
  const [viewId, setViewId] = useState<number | null>(null);
  const [suspendUser, setSuspendUser] = useState<UserRow | null>(null);

  // หน่วงการค้นหาเล็กน้อย ไม่ยิง API ทุกตัวอักษร
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const key = `${new URLSearchParams({ filter, sort, q: query, page: String(page) })}#${reload}`;
  const loading = loadedKey !== key;
  const load = useCallback(() => setReload((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    staffFetch<ListResponse>(`/api/staff/users?${key.split("#")[0]}`)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError("");
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoadedKey(key));
    return () => {
      cancelled = true;
    };
  }, [key]);

  const activate = async (u: UserRow) => {
    try {
      await staffFetch("/api/staff/users", { method: "PATCH", body: JSON.stringify({ userId: u.userId, action: "activate" }) });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const from = data && data.total ? (data.page - 1) * data.pageSize + 1 : 0;
  const to = data ? Math.min(data.total, data.page * data.pageSize) : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Users"
        title="จัดการ"
        highlight="ผู้ใช้งาน"
        desc="ดูสถานะการใช้งาน ระงับหรือเปิดใช้งานบัญชี · การกำหนดบทบาทและสิทธิ์ดูแลโดย System Admin"
      />

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="ผู้ใช้ทั้งหมด" value={data?.stats.total} />
        <StatCard label="ใช้งานใน 30 วัน" value={data?.stats.active} />
        <StatCard label="สมัครใหม่เดือนนี้" value={data ? `+${data.stats.newMonth}` : undefined} tone="ok" />
        <StatCard label="ถูกระงับ" value={data?.stats.suspended} tone={data?.stats.suspended ? "danger" : "brand"} />
      </section>

      <ErrorBox message={error} />

      <Card className="!p-4 sm:!p-6">
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <Chips
            label="สถานะผู้ใช้"
            items={FILTERS}
            value={filter}
            onChange={(v) => {
              setFilter(v);
              setPage(1);
            }}
          />
          <div className="flex gap-2">
            <label className="relative block min-w-0 flex-1 xl:w-64">
              <span className="sr-only">ค้นหาผู้ใช้</span>
              <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-staff-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อผู้ใช้หรืออีเมล" className={`${inputCls} pl-10`} />
            </label>
            <label className="shrink-0">
              <span className="sr-only">เรียงลำดับ</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={inputCls}>
                <option value="recent">ใช้งานล่าสุดก่อน</option>
                <option value="newest">สมัครล่าสุดก่อน</option>
                <option value="name">ชื่อ ก–ฮ / A–Z</option>
              </select>
            </label>
          </div>
        </div>

        <div className={`overflow-x-auto ${loading ? "opacity-60" : ""}`}>
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-staff-line text-left text-xs font-semibold text-staff-muted">
                <th className="py-3 pr-3 font-semibold">ผู้ใช้</th>
                <th className="px-3 font-semibold">สมัครเมื่อ</th>
                <th className="px-3 font-semibold">ประเมินล่าสุด</th>
                <th className="px-3 text-right font-semibold">จำนวนครั้ง</th>
                <th className="px-3 font-semibold">ความเสี่ยงสูงสุด</th>
                <th className="px-3 font-semibold">สถานะ</th>
                <th className="pl-3 text-right font-semibold">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {data?.users.map((u) => {
                const st = STATUS_VIEW[u.status];
                return (
                  <tr key={u.userId} className="border-b border-staff-line/70 last:border-0">
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.username} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{u.username}</p>
                          <p className="truncate text-xs text-staff-muted">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3">{thDate(u.createdAt)}</td>
                    <td className="whitespace-nowrap px-3">{u.lastAssessed ? thDate(u.lastAssessed) : <span className="text-staff-muted">ยังไม่ได้ประเมิน</span>}</td>
                    <td className="px-3 text-right font-bold">{u.assessments}</td>
                    <td className="max-w-[220px] px-3">
                      {!u.consent ? (
                        <span className="inline-flex items-center gap-1 text-xs text-staff-muted" title="ผู้ใช้ไม่ได้ยินยอมให้เจ้าหน้าที่เห็นผลรายบุคคล">
                          <Lock size={12} /> ไม่เปิดเผย
                        </span>
                      ) : u.worst ? (
                        <RiskPill severity={u.worst.severity}>{u.worst.label}</RiskPill>
                      ) : (
                        <RiskPill severity={0}>-</RiskPill>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3">
                      <span className={`inline-flex items-center gap-1.5 font-semibold ${st.text}`}>
                        <span className={`h-2 w-2 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap pl-3 text-right">
                      <div className="inline-flex gap-2">
                        <button type="button" onClick={() => setViewId(u.userId)} className={`${btnGhost} h-9 rounded-xl px-3`}>
                          ดูข้อมูล
                        </button>
                        {u.status === "suspended" ? (
                          <button type="button" onClick={() => activate(u)} className={`${btnPrimary} h-9 rounded-xl px-3 shadow-none`}>
                            เปิดใช้งาน
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSuspendUser(u)}
                            className="inline-flex h-9 items-center rounded-xl border border-[#f7c6c9] bg-white px-3 text-sm font-semibold text-risk-crit transition hover:bg-[#fff5f5]"
                          >
                            ระงับ
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {data && data.users.length === 0 && <Empty>ไม่พบผู้ใช้ตามเงื่อนไข</Empty>}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-staff-muted">
          <span>
            แสดง {from}–{to} จาก {data?.total ?? 0} คน
          </span>
          <nav aria-label="เปลี่ยนหน้า" className="flex items-center gap-1.5">
            <PageBtn label="หน้าก่อน" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft size={16} />
            </PageBtn>
            {pageNumbers(page, pages).map((n, i) =>
              n === 0 ? (
                <span key={`gap${i}`} className="px-1">…</span>
              ) : (
                <PageBtn key={n} label={`หน้า ${n}`} active={n === page} onClick={() => setPage(n)}>
                  {n}
                </PageBtn>
              )
            )}
            <PageBtn label="หน้าถัดไป" disabled={page >= pages} onClick={() => setPage(page + 1)}>
              <ChevronRight size={16} />
            </PageBtn>
          </nav>
        </div>
      </Card>

      {viewId !== null && <UserDrawer userId={viewId} onClose={() => setViewId(null)} />}
      {suspendUser && (
        <SuspendDialog
          user={suspendUser}
          onClose={() => setSuspendUser(null)}
          onDone={() => {
            setSuspendUser(null);
            load();
          }}
        />
      )}
    </div>
  );
}

// เลขหน้าแบบย่อ: 1 … 4 5 6 … 20 (0 = ช่องว่าง)
function pageNumbers(cur: number, total: number) {
  const set = new Set([1, total, cur - 1, cur, cur + 1].filter((n) => n >= 1 && n <= total));
  const list = Array.from(set).sort((a, b) => a - b);
  const out: number[] = [];
  list.forEach((n, i) => {
    if (i && n - list[i - 1] > 1) out.push(0);
    out.push(n);
  });
  return out;
}

function PageBtn({
  children,
  label,
  active,
  disabled,
  onClick,
}: {
  children: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={active ? "page" : undefined}
      disabled={disabled}
      onClick={onClick}
      className={`grid h-9 min-w-9 place-items-center rounded-xl border px-2 text-sm font-semibold transition disabled:opacity-40 ${
        active ? "border-staff-600 bg-staff-600 text-white" : "border-staff-line bg-white text-staff-ink hover:border-staff-300"
      }`}
    >
      {children}
    </button>
  );
}

/* =========================================================
   ดูข้อมูลผู้ใช้ (แผงด้านขวา)
========================================================= */

function UserDrawer({ userId, onClose }: { userId: number; onClose: () => void }) {
  const [u, setU] = useState<UserDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    staffFetch<{ user: UserDetail }>(`/api/staff/users?user=${userId}`)
      .then((d) => setU(d.user))
      .catch((e) => setError(e.message));
  }, [userId]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const gender = u?.gender === "male" ? "ชาย" : u?.gender === "female" ? "หญิง" : null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="ข้อมูลผู้ใช้">
      <button type="button" aria-label="ปิด" className="absolute inset-0 bg-staff-ink/30" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col gap-5 overflow-y-auto bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">ข้อมูลผู้ใช้</h2>
          <button type="button" onClick={onClose} aria-label="ปิด" className="grid h-10 w-10 place-items-center rounded-xl hover:bg-staff-bg">
            <X size={20} />
          </button>
        </div>
        <ErrorBox message={error} />
        {!u && !error && <Empty>กำลังโหลด…</Empty>}
        {u && (
          <>
            <div className="flex items-center gap-4">
              <Avatar name={u.username} size={56} />
              <div className="min-w-0">
                <p className="truncate text-xl font-bold">{u.username}</p>
                <p className="truncate text-sm text-staff-muted">{u.email}</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Field label="สมัครเมื่อ" value={thDate(u.createdAt)} />
              <Field label="ประเมินล่าสุด" value={u.lastAssessed ? thDate(u.lastAssessed) : "ยังไม่ได้ประเมิน"} />
              <Field label="จำนวนครั้งที่ประเมิน" value={String(u.assessments)} />
              <Field label="สถานะบัญชี" value={u.isActive ? "ใช้งาน" : "ระงับ"} />
              {u.consent && <Field label="เพศ / อายุ" value={[gender, u.age ? `${u.age} ปี` : null].filter(Boolean).join(" · ") || "-"} />}
            </dl>
            {!u.isActive && (
              <div className="rounded-2xl bg-[#fff5f5] p-4 text-sm text-risk-crit">
                ระงับเมื่อ {thDate(u.suspendedAt, true)} · เหตุผล: {u.suspendedReason || "-"}
              </div>
            )}
            <div>
              <h3 className="mb-2 font-bold">ผลการประเมินล่าสุด</h3>
              {u.latest === null ? (
                <p className="flex items-start gap-2 rounded-2xl bg-staff-soft p-4 text-sm text-staff-muted">
                  <Lock size={16} className="mt-0.5 shrink-0" />
                  ผู้ใช้ยังไม่ยินยอมให้เจ้าหน้าที่เข้าถึงผลประเมินรายบุคคล จึงแสดงเฉพาะข้อมูลบัญชี
                </p>
              ) : u.latest.length === 0 ? (
                <Empty>ยังไม่มีผลการประเมิน</Empty>
              ) : (
                <ul className="flex flex-col gap-2">
                  {u.latest.map((r) => (
                    <li key={r.assessment} className="flex items-center gap-3 rounded-2xl border border-staff-line px-4 py-2.5 text-sm">
                      <span className="min-w-0 flex-1 truncate font-semibold">{r.assessment}</span>
                      <RiskPill severity={r.severity}>{r.riskLevel}</RiskPill>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {u.latest !== null && (
              <p className="mt-auto flex items-center gap-1.5 text-xs text-staff-muted">
                <Lock size={13} /> การเปิดดูข้อมูลนี้ถูกบันทึกในประวัติการเข้าถึง (PDPA)
              </p>
            )}
          </>
        )}
      </aside>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-staff-soft px-4 py-3">
      <dt className="text-xs text-staff-muted">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

/* =========================================================
   ยืนยันการระงับบัญชี
========================================================= */

function SuspendDialog({ user, onClose, onDone }: { user: UserRow; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      await staffFetch("/api/staff/users", {
        method: "PATCH",
        body: JSON.stringify({ userId: user.userId, action: "suspend", reason }),
      });
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="suspend-title">
      <button type="button" aria-label="ปิด" className="absolute inset-0 bg-staff-ink/30" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <h2 id="suspend-title" className="text-lg font-bold">
          ระงับบัญชี {user.username}?
        </h2>
        <p className="mt-1 text-sm text-staff-muted">ผู้ใช้จะเข้าสู่ระบบไม่ได้จนกว่าจะเปิดใช้งานอีกครั้ง ข้อมูลเดิมยังอยู่ครบ</p>
        <label className="mt-4 flex flex-col gap-1.5 text-sm font-semibold">
          เหตุผลการระงับ
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} className={inputCls} placeholder="เช่น ผู้ใช้แจ้งขอระงับบัญชีชั่วคราว" />
        </label>
        <div className="mt-3">
          <ErrorBox message={error} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnGhost}>
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || !reason.trim()}
            className="inline-flex h-11 items-center rounded-2xl bg-risk-high px-5 text-sm font-semibold text-white transition hover:bg-risk-crit disabled:opacity-50"
          >
            {saving ? "กำลังระงับ…" : "ระงับบัญชี"}
          </button>
        </div>
      </div>
    </div>
  );
}

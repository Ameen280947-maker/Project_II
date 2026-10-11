"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Info, Search } from "lucide-react";
import { staffFetch } from "@/lib/staff/client";
import { Avatar, Card, Chips, Empty, ErrorBox, PageHeader, StatCard, btnGhost, btnPrimary, inputCls } from "../components/ui";

/* =========================================================
   จัดการผู้ใช้งาน (Staff)
   - แสดงเฉพาะข้อมูลบัญชีและ "จำนวนครั้ง" ที่ใช้งาน ไม่แสดงผลประเมินรายบุคคล
   - ระงับ / เปิดใช้งานบัญชี (บันทึกใน access_logs ฝั่ง API)
========================================================= */

type Status = "active" | "inactive" | "suspended";
export type Filter = "all" | Status;
type Sort = "recent" | "newest" | "most" | "name";

type UserRow = {
  userId: number;
  username: string;
  email: string;
  createdAt: string;
  lastActive: string;
  assessments: number;
  status: Status;
};

type ListResponse = {
  kpis: { total: number; active30: number; newMonth: number; suspended: number };
  counts: Record<Filter, number>;
  total: number;
  page: number;
  pageSize: number;
  users: UserRow[];
};

type UserDetail = UserRow & {
  isActive: boolean;
  suspendedReason: string | null;
  suspendedAt: string | null;
  byType: { name: string; count: number }[];
  history: { action: "suspend" | "activate"; reason: string | null; staff: string; at: string }[];
};

type Pending = { user: Pick<UserRow, "userId" | "username">; action: "suspend" | "activate" };

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "active", label: "ใช้งานอยู่" },
  { key: "inactive", label: "ไม่ใช้งานเกิน 30 วัน" },
  { key: "suspended", label: "ถูกระงับ" },
];

const STATUS_VIEW: Record<Status, { label: string; dot: string; text: string }> = {
  active: { label: "ใช้งาน", dot: "bg-staff-ink", text: "text-staff-ink" },
  inactive: { label: "ไม่ใช้งานเกิน 30 วัน", dot: "bg-risk-mid", text: "text-[#8a5a00]" },
  suspended: { label: "ระงับ", dot: "bg-risk-high", text: "text-risk-crit" },
};

const REASON_MAX = 200;

// วันที่แบบย่อ ปี พ.ศ. 2 หลัก เช่น "12 มี.ค. 69"
const shortDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : "-";

/* =========================================================
   PAGE
========================================================= */

export default function UsersClient({ initialStatus }: { initialStatus: Filter }) {
  const [filter, setFilter] = useState<Filter>(initialStatus);
  const [sort, setSort] = useState<Sort>("recent");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [reload, setReload] = useState(0);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  // หน่วงการค้นหาเล็กน้อย ไม่ยิง API ทุกตัวอักษร
  useEffect(() => {
    const t = setTimeout(() => {
      const next = q.trim();
      if (next !== query) {
        setQuery(next);
        setPage(1);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, query]);

  const params = new URLSearchParams({ status: filter, sort, q: query, page: String(page) }).toString();
  const key = `${params}#${reload}`;
  const loading = loadedKey !== key;

  useEffect(() => {
    let cancelled = false;
    staffFetch<ListResponse>(`/api/staff/users?${params}`)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        if (d.page !== page) setPage(d.page);
        setError("");
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoadedKey(key));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key รวม params + reload แล้ว
  }, [key]);

  const view = (id: number) => {
    setSelectedId(id);
    // จอเล็ก: แผงข้อมูลอยู่ใต้ตาราง เลื่อนลงไปให้เห็น
    if (window.matchMedia("(max-width: 1279px)").matches) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const from = data && data.total ? (data.page - 1) * data.pageSize + 1 : 0;
  const to = data ? Math.min(data.total, data.page * data.pageSize) : 0;
  const k = data?.kpis;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="USERS"
        title="จัดการ"
        highlight="ผู้ใช้งาน"
        desc="ดูข้อมูลบัญชีและการใช้งาน ระงับหรือเปิดใช้งานบัญชี · ไม่แสดงผลประเมินรายบุคคล · การกำหนดสิทธิ์ดูแลโดย System Admin"
      />

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4" aria-label="สรุปผู้ใช้งาน">
        <StatCard label="ผู้ใช้ทั้งหมด" value={k?.total} />
        <StatCard label="ใช้งานใน 30 วัน" value={k?.active30} note="สมัครหรือทำแบบประเมิน" />
        <StatCard
          label="สมัครใหม่เดือนนี้"
          value={k ? <span className="text-risk-ok">+{k.newMonth}</span> : undefined}
          tone="ok"
        />
        <StatCard label="ถูกระงับ" value={k?.suspended} tone="danger" />
      </section>

      <ErrorBox message={error} />

      {/* กล่องรายชื่อกว้างขึ้น แผงรายละเอียดด้านขวาแคบลง */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        {/* ===== รายชื่อผู้ใช้ ===== */}
        <Card className="!p-4 sm:!p-6">
          <div className="mb-4 flex flex-col gap-3">
            <Chips
              label="สถานะผู้ใช้"
              items={FILTERS.map((f) => ({ ...f, count: data?.counts[f.key] }))}
              value={filter}
              onChange={(v) => {
                setFilter(v);
                setPage(1);
              }}
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative block min-w-0 flex-1">
                <span className="sr-only">ค้นหาชื่อหรืออีเมล</span>
                <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-staff-muted" />
                <input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="ค้นหาชื่อหรืออีเมล"
                  className={`${inputCls} pl-10`}
                />
              </label>
              <label className="shrink-0 sm:w-52">
                <span className="sr-only">เรียงลำดับ</span>
                <select
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value as Sort);
                    setPage(1);
                  }}
                  className={inputCls}
                >
                  <option value="recent">ใช้งานล่าสุดก่อน</option>
                  <option value="newest">สมัครล่าสุดก่อน</option>
                  <option value="most">ประเมินมากที่สุด</option>
                  <option value="name">ชื่อ ก-ฮ</option>
                </select>
              </label>
            </div>
          </div>

          <div className={`transition-opacity ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
            {/* ตารางเลื่อนแนวนอนภายในการ์ดบนจอเล็ก */}
            <div className="-mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-staff-line text-left text-xs text-staff-muted">
                    <th scope="col" className="py-3 pr-3 font-semibold">ผู้ใช้</th>
                    <th scope="col" className="px-2 font-semibold">สมัครเมื่อ</th>
                    <th scope="col" className="px-2 font-semibold">ใช้งานล่าสุด</th>
                    <th scope="col" className="px-2 text-right font-semibold">ประเมิน</th>
                    <th scope="col" className="px-2 font-semibold">สถานะ</th>
                    <th scope="col" className="pl-3 text-right font-semibold">
                      <span className="sr-only">จัดการ</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data?.users.map((u) => (
                    <tr
                      key={u.userId}
                      className={`border-b border-staff-line/70 last:border-0 ${selectedId === u.userId ? "bg-staff-soft" : ""}`}
                    >
                      <td className="py-3 pr-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar name={u.username} tone={u.status === "suspended" ? "danger" : "brand"} />
                          <div className="min-w-0">
                            <p className="break-all font-semibold">{u.username}</p>
                            <p className="break-all text-xs text-staff-muted">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-2">{shortDate(u.createdAt)}</td>
                      <td className="whitespace-nowrap px-2">{shortDate(u.lastActive)}</td>
                      <td className="px-2 text-right font-bold tabular-nums">{u.assessments}</td>
                      <td className="whitespace-nowrap px-2">
                        <StatusBadge status={u.status} />
                      </td>
                      <td className="whitespace-nowrap py-3 pl-3 text-right">
                        <div className="inline-flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => view(u.userId)}
                            aria-label={`ดูข้อมูล ${u.username}`}
                            className={`${smallBtn} border-staff-line bg-white text-staff-ink hover:border-staff-300`}
                          >
                            ดูข้อมูล
                          </button>
                          <ActionButton user={u} suspended={u.status === "suspended"} onAction={setPending} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data && data.users.length === 0 && <Empty>ไม่พบผู้ใช้ตามเงื่อนไข</Empty>}
            {!data && !error && <Empty>กำลังโหลด…</Empty>}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-staff-muted">
            <span>
              แสดง {from}–{to} จาก {data?.total ?? 0} คน
            </span>
            {pages > 1 && (
              <nav aria-label="เปลี่ยนหน้า" className="flex items-center gap-1.5">
                <PageBtn label="หน้าก่อน" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft size={16} />
                </PageBtn>
                {pageNumbers(page, pages).map((n, i) =>
                  n === 0 ? (
                    <span key={`gap${i}`} className="px-1" aria-hidden>
                      …
                    </span>
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
            )}
          </div>
        </Card>

        {/* ===== ข้อมูลผู้ใช้ที่เลือก ===== */}
        <div ref={detailRef} className="scroll-mt-6 xl:sticky xl:top-6">
          <UserPanel userId={selectedId} reload={reload} onAction={setPending} />
        </div>
      </div>

      {pending && (
        <ActionDialog
          pending={pending}
          onClose={() => setPending(null)}
          onDone={() => {
            setPending(null);
            setReload((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

/* =========================================================
   ชิ้นส่วนย่อย
========================================================= */

const smallBtn = "inline-flex h-9 items-center justify-center whitespace-nowrap rounded-xl border px-2.5 text-sm font-semibold transition";

function ActionButton({
  user,
  suspended,
  onAction,
}: {
  user: Pick<UserRow, "userId" | "username">;
  suspended: boolean;
  onAction: (p: Pending) => void;
}) {
  return suspended ? (
    <button
      type="button"
      onClick={() => onAction({ user, action: "activate" })}
      aria-label={`เปิดใช้งานบัญชี ${user.username}`}
      className={`${smallBtn} border-staff-600 bg-staff-600 text-white hover:bg-staff-700`}
    >
      เปิดใช้งาน
    </button>
  ) : (
    <button
      type="button"
      onClick={() => onAction({ user, action: "suspend" })}
      aria-label={`ระงับบัญชี ${user.username}`}
      className={`${smallBtn} border-[#f7c6c9] bg-white text-risk-crit hover:bg-[#fff5f5]`}
    >
      ระงับ
    </button>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const st = STATUS_VIEW[status];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold ${st.text}`}>
      <span className={`h-2 w-2 rounded-full ${st.dot}`} aria-hidden />
      {st.label}
    </span>
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
   แผง "ข้อมูลผู้ใช้"
========================================================= */

function UserPanel({
  userId,
  reload,
  onAction,
}: {
  userId: number | null;
  reload: number;
  onAction: (p: Pending) => void;
}) {
  const [u, setU] = useState<UserDetail | null>(null);
  const [error, setError] = useState("");
  const [loadedKey, setLoadedKey] = useState("");
  const key = `${userId}#${reload}`;

  useEffect(() => {
    if (userId === null) return;
    let cancelled = false;
    staffFetch<{ user: UserDetail }>(`/api/staff/users?userId=${userId}`)
      .then((d) => {
        if (cancelled) return;
        setU(d.user);
        setError("");
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoadedKey(key));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key รวม userId + reload แล้ว
  }, [key]);

  const shown = u && u.userId === userId ? u : null;
  const loading = userId !== null && loadedKey !== key;

  return (
    <Card className="!p-5 sm:!p-6">
      <h2 className="text-lg font-bold">ข้อมูลผู้ใช้</h2>

      {userId === null ? (
        <Empty>เลือก “ดูข้อมูล” จากรายชื่อเพื่อดูรายละเอียดบัญชี</Empty>
      ) : !shown ? (
        error ? (
          <div className="mt-4">
            <ErrorBox message={error} />
          </div>
        ) : (
          <Empty>กำลังโหลด…</Empty>
        )
      ) : (
        <div className={`mt-4 flex flex-col gap-5 transition-opacity ${loading ? "opacity-60" : ""}`}>
          <ErrorBox message={error} />
          <div className="flex items-center gap-4">
            <Avatar name={shown.username} size={56} tone={shown.isActive ? "brand" : "danger"} />
            <div className="min-w-0">
              <p className="truncate text-xl font-bold">{shown.username}</p>
              <p className="truncate text-sm text-staff-muted">{shown.email}</p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Field label="สมัครเมื่อ">{shortDate(shown.createdAt)}</Field>
            <Field label="ใช้งานล่าสุด">{shortDate(shown.lastActive)}</Field>
            <Field label="ประเมินทั้งหมด">{shown.assessments} ครั้ง</Field>
            <Field label="สถานะบัญชี">
              <StatusBadge status={shown.status} />
            </Field>
          </dl>

          {!shown.isActive && (
            <div className="rounded-2xl bg-[#fff5f5] p-4 text-sm text-risk-crit">
              <p className="font-semibold">ระงับเมื่อ {shortDate(shown.suspendedAt)}</p>
              <p className="mt-0.5 break-words">เหตุผล: {shown.suspendedReason || "-"}</p>
            </div>
          )}

          <div className="flex">
            <ActionButton user={shown} suspended={!shown.isActive} onAction={onAction} />
          </div>

          <section>
            <h3 className="mb-2 font-bold">การใช้งานแยกตามแบบประเมิน</h3>
            {shown.byType.length === 0 ? (
              <p className="rounded-2xl bg-staff-soft p-4 text-center text-sm text-staff-muted">ยังไม่เคยทำแบบประเมิน</p>
            ) : (
              <ul className="flex flex-col divide-y divide-staff-line rounded-2xl border border-staff-line">
                {shown.byType.map((t) => (
                  <li key={t.name} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="min-w-0 truncate">{t.name}</span>
                    <span className="shrink-0 font-semibold tabular-nums">{t.count} ครั้ง</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 flex items-start gap-1.5 text-xs text-staff-muted">
              <Info size={13} className="mt-0.5 shrink-0" aria-hidden />
              แสดงเฉพาะจำนวนครั้ง ไม่แสดงผลประเมินรายบุคคล
            </p>
          </section>

          <section>
            <h3 className="mb-2 font-bold">ประวัติการจัดการบัญชี</h3>
            {shown.history.length === 0 ? (
              <p className="rounded-2xl bg-staff-soft p-4 text-center text-sm text-staff-muted">ยังไม่มีประวัติการจัดการบัญชี</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {shown.history.map((h, i) => (
                  <li key={`${h.at}-${i}`} className="flex gap-2.5 text-sm">
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${h.action === "suspend" ? "bg-risk-high" : "bg-staff-ink"}`}
                      aria-hidden
                    />
                    <p className="min-w-0 break-words">
                      <span className="font-semibold">{h.staff}</span>{" "}
                      {h.action === "suspend" ? "ระงับบัญชี" : "เปิดใช้งานบัญชี"}
                      {h.reason && <> — “{h.reason}”</>}
                      <span className="text-staff-muted"> · {shortDate(h.at)}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl bg-staff-soft px-4 py-3">
      <dt className="text-xs text-staff-muted">{label}</dt>
      <dd className="mt-0.5 font-semibold">{children}</dd>
    </div>
  );
}

/* =========================================================
   กล่องยืนยัน ระงับ (ต้องระบุเหตุผล) / เปิดใช้งาน
========================================================= */

function ActionDialog({ pending, onClose, onDone }: { pending: Pending; onClose: () => void; onDone: () => void }) {
  const { user, action } = pending;
  const suspend = action === "suspend";
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const firstRef = useRef<HTMLTextAreaElement | HTMLButtonElement | null>(null);

  useEffect(() => {
    firstRef.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      await staffFetch("/api/staff/users", {
        method: "PATCH",
        body: JSON.stringify({ userId: user.userId, action, ...(suspend ? { reason: reason.trim() } : {}) }),
      });
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-action-title"
      aria-describedby="user-action-desc"
    >
      <button type="button" aria-label="ปิด" tabIndex={-1} className="absolute inset-0 bg-staff-ink/30" onClick={onClose} />
      <form
        className="relative w-full max-w-md rounded-[22px] bg-white p-6 shadow-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          if (!saving && (!suspend || reason.trim())) void submit();
        }}
      >
        <h2 id="user-action-title" className="text-lg font-bold">
          {suspend ? "ระงับบัญชี" : "เปิดใช้งานบัญชี"} {user.username}?
        </h2>
        <p id="user-action-desc" className="mt-1 text-sm text-staff-muted">
          {suspend
            ? "ผู้ใช้จะเข้าสู่ระบบไม่ได้จนกว่าจะเปิดใช้งานอีกครั้ง ข้อมูลเดิมยังอยู่ครบ"
            : "ผู้ใช้จะกลับมาเข้าสู่ระบบและใช้งานได้ตามปกติ"}
        </p>
        {suspend && (
          <label className="mt-4 flex flex-col gap-1.5 text-sm font-semibold">
            เหตุผลการระงับ (จำเป็น)
            <textarea
              ref={(el) => {
                firstRef.current = el;
              }}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={REASON_MAX}
              required
              className={inputCls}
              placeholder="เช่น ผู้ใช้แจ้งขอระงับบัญชีชั่วคราว"
            />
            <span className="self-end text-xs font-normal text-staff-muted">
              {reason.length}/{REASON_MAX}
            </span>
          </label>
        )}
        <div className="mt-3">
          <ErrorBox message={error} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className={btnGhost}
            ref={(el) => {
              if (!suspend) firstRef.current = el;
            }}
          >
            ยกเลิก
          </button>
          {suspend ? (
            <button
              type="submit"
              disabled={saving || !reason.trim()}
              className="inline-flex h-11 items-center rounded-2xl bg-risk-high px-5 text-sm font-semibold text-white transition hover:bg-risk-crit disabled:opacity-50"
            >
              {saving ? "กำลังระงับ…" : "ระงับบัญชี"}
            </button>
          ) : (
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? "กำลังเปิดใช้งาน…" : "เปิดใช้งาน"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

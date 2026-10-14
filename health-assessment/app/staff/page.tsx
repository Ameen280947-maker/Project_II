"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, ClipboardList, Download, Info, Users } from "lucide-react";
import { relativeTime, staffFetch } from "@/lib/staff/client";
import { Card, ErrorBox, StatCard, PageHeader, btnPrimary } from "./components/ui";
import { formatThaiDate, rangeText, shiftDate, todayInBangkok } from "./components/DateRangePicker";
import {
  HBars,
  MiniStat,
  MonthlyBars,
  OutcomeBreakdown,
  SystemCard,
  TaskItem,
  UsageChart,
  UsageLegend,
} from "./components/overview/OverviewParts";
import type { Overview } from "./components/overview/types";

// ช่วงวันที่ใช้สรุปภาพรวม และข้อความกำกับที่ใช้ซ้ำในหน้า
const RANGE_DAYS = 30;
const AS_OF = "ณ วันนี้";
const IN_RANGE = "30 วันล่าสุด";
const CONSENT_NOTE = "นับเฉพาะผู้ใช้ที่ยินยอมให้ประมวลผลข้อมูลสุขภาพ";

// จัดรูปแบบตัวเลขแบบไทย หรือแสดง "–" เมื่อไม่มีค่า
const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "–" : n.toLocaleString("th-TH"));

// แสดง % การเปลี่ยนแปลงของจำนวนการประเมินเทียบกับ 30 วันก่อนหน้า (ลูกศรขึ้น/ลง)
function Delta({ cur, prev }: { cur: number; prev: number }) {
  if (prev === 0) return <>{cur > 0 ? "ช่วงก่อนไม่มีการประเมิน" : "ไม่มีการประเมินทั้งสองช่วง"}</>;
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return <>เท่ากับ 30 วันก่อนหน้า</>;
  return (
    <span className={pct > 0 ? "font-semibold text-[#21733f]" : "font-semibold text-risk-crit"}>
      {pct > 0 ? "▲" : "▼"} {Math.abs(pct).toLocaleString("th-TH")}% <span className="font-normal text-staff-muted">จาก 30 วันก่อนหน้า</span>
    </span>
  );
}

// หน้า: ภาพรวมระบบเจ้าหน้าที่ 30 วันล่าสุด ดึงข้อมูลจาก /api/staff/overview มาแสดง KPI กราฟ และงานค้าง
// ส่วนประกอบ: KPI → กราฟการใช้งาน/สัดส่วนผล → การ์ดแต่ละระบบ → งานค้างและกิจกรรมล่าสุด
export default function StaffOverviewPage() {
  // ช่วงวันที่ 30 วันล่าสุด และ state ผลการโหลด
  const today = todayInBangkok();
  const from = shiftDate(today, -(RANGE_DAYS - 1));
  const to = today;
  const reqKey = `${from}|${to}`;
  const [result, setResult] = useState<{ key: string; error?: string } | null>(null);
  const [data, setData] = useState<Overview | null>(null);

  // โหลดข้อมูลภาพรวมจาก /api/staff/overview ตอนเปิดหน้า
  useEffect(() => {
    let cancelled = false;
    staffFetch<Overview>(`/api/staff/overview?from=${from}&to=${to}`)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setResult({ key: `${from}|${to}` });
      })
      .catch((e) => !cancelled && setResult({ key: `${from}|${to}`, error: e.message }));
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  // ค่าที่คำนวณสำหรับแสดงผล
  const loading = result?.key !== reqKey;
  const period = rangeText(from, to);
  const error = result?.key === reqKey ? result.error ?? "" : "";

  const k = data?.kpi;
  const acc = data?.accounts;
  const rep = data?.reports;
  const tasks = data?.tasks;
  const accountTotal = (acc?.active30 ?? 0) + (acc?.inactive30 ?? 0);
  const taskCount = (tasks?.missing.length ?? 0) + (tasks?.drafts.length ?? 0) + (tasks?.suspended ?? 0);

  return (
    <div className={`flex flex-col gap-6 transition-opacity ${loading && data ? "opacity-60" : ""}`}>
      {/* หัวหน้าเพจ */}
      <PageHeader
        eyebrow="Staff Dashboard"
        title="ภาพรวม"
        highlight="ระบบ"
        desc={`ข้อมูล ณ ${formatThaiDate(today)} · ตัวเลขรายช่วงใช้ ${IN_RANGE} (${period})`}
        actions={
          <Link href="/staff/reports" className={btnPrimary}>
            <Download size={18} />
            ส่งออกรายงาน
          </Link>
        }
      />

      <ErrorBox message={error} />

      {/* การ์ด KPI 4 ใบ */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={`ผู้ใช้งานทั้งหมด · ${AS_OF}`}
          value={fmt(k?.totalUsers)}
          note={<span className="font-semibold text-[#21733f]">+{fmt(k?.newUsers ?? 0)} คนใหม่ใน {IN_RANGE}</span>}
        />
        <StatCard
          label={`การประเมิน · ${IN_RANGE}`}
          value={fmt(k?.assessments)}
          note={k ? <Delta cur={k.assessments} prev={k.prevAssessments} /> : undefined}
        />
        <StatCard
          label={`ผู้ใช้ที่ใช้งาน · ${IN_RANGE}`}
          value={fmt(k?.activeUsers)}
          note={k ? `${k.totalUsers ? Math.round((k.activeUsers / k.totalUsers) * 100) : 0}% ของผู้ใช้ทั้งหมด` : undefined}
        />
        <StatCard
          label={`แบบประเมินที่เปิดใช้งาน · ${AS_OF}`}
          value={k ? `${k.activeTypes} / ${k.totalTypes}` : "–"}
          note={k ? (k.totalTypes > k.activeTypes ? `ปิดใช้งาน ${k.totalTypes - k.activeTypes} แบบ` : "เปิดใช้งานครบทุกแบบ") : undefined}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* กราฟการใช้งานระบบ */}
        <Card className="lg:col-span-3">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">การใช้งานระบบ</h2>
              <p className="text-sm text-staff-muted">จำนวนการประเมิน · {period}</p>
            </div>
            <UsageLegend />
          </div>
          {data ? <UsageChart chart={data.chart} /> : <div className="h-60 animate-pulse rounded-2xl bg-staff-soft" />}
        </Card>

        {/* สัดส่วนผลการประเมินโดยรวม */}
        <Card className="flex flex-col lg:col-span-2">
          <h2 className="text-lg font-bold">ผลการประเมินโดยรวม</h2>
          <p className="mb-5 text-sm text-staff-muted">
            สัดส่วนผลจากการประเมิน {data?.outcome.counts ? fmt(data.outcome.total) : "–"} ครั้งใน {IN_RANGE} (ไม่ระบุตัวบุคคล)
          </p>
          {data && <OutcomeBreakdown outcome={data.outcome} minGroup={data.minGroup} />}
          <p className="mt-3 text-xs text-staff-muted">
            {CONSENT_NOTE} · กลุ่มที่น้อยกว่า {data?.minGroup ?? 5} คนจะไม่แสดงผล
          </p>
          <div className="mt-auto flex gap-2.5 rounded-2xl bg-staff-soft p-3.5 text-[13px] text-staff-muted">
            <Info size={16} className="mt-0.5 shrink-0" />
            ผู้ที่ได้ผลเสี่ยงสูงจะเห็นคำแนะนำให้พบแพทย์และสายด่วนบนหน้าผลของตนเอง
          </div>
        </Card>
      </section>

      {/* การ์ดสรุปแต่ละส่วนของระบบ (ผู้ใช้ แบบประเมิน รายงาน) */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">ส่วนต่าง ๆ ของระบบ</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <SystemCard
            icon={<Users size={20} />}
            title="ผู้ใช้งาน"
            subtitle="บัญชีและสถานะการใช้งาน"
            href="/staff/users"
            linkText="จัดการผู้ใช้งาน"
          >
            <div className="grid grid-cols-3 gap-2">
              <MiniStat label="สมัครใหม่" value={fmt(acc?.newUsers)} note={IN_RANGE} />
              <MiniStat label="ใช้งาน 30 วัน" value={fmt(acc?.active30)} note={AS_OF} />
              <MiniStat label="ถูกระงับ" value={fmt(acc?.suspended)} note={AS_OF} />
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">สถานะบัญชี · {AS_OF}</p>
              <div className="flex h-3 gap-[2px] overflow-hidden rounded-full bg-staff-bg">
                {accountTotal > 0 && (
                  <>
                    <span className="bg-staff-600" style={{ width: `${((acc?.active30 ?? 0) / accountTotal) * 100}%` }} />
                    <span className="bg-staff-300" style={{ width: `${((acc?.inactive30 ?? 0) / accountTotal) * 100}%` }} />
                  </>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-staff-muted">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[3px] bg-staff-600" />
                  ใช้งานอยู่ {fmt(acc?.active30)}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[3px] bg-staff-300" />
                  ไม่ได้ใช้งานเกิน 30 วัน {fmt(acc?.inactive30)}
                </span>
                <span>ถูกระงับ {fmt(acc?.suspended)} บัญชี</span>
              </div>
            </div>
          </SystemCard>

          <SystemCard
            icon={<ClipboardList size={20} />}
            title="แบบประเมิน"
            subtitle="เนื้อหา เกณฑ์ และคำแนะนำ"
            href="/staff/assessments"
            linkText="จัดการแบบประเมิน"
          >
            {data && data.topAssessments.length === 0 ? (
              <p className="py-4 text-center text-sm text-staff-muted">ยังไม่มีการทำแบบประเมินใน {IN_RANGE}</p>
            ) : (
              <HBars items={(data?.topAssessments ?? []).map((t) => ({ key: t.id, label: t.label, value: t.count }))} />
            )}
            <p className="mt-auto text-xs text-staff-muted">
              จำนวนครั้งที่ถูกทำใน {IN_RANGE} · เปิดใช้งาน {fmt(k?.activeTypes)} จาก {fmt(k?.totalTypes)} แบบ ({AS_OF})
            </p>
          </SystemCard>

          <SystemCard
            icon={<BarChart3 size={20} />}
            title="รายงานและสถิติ"
            subtitle="ภาพรวมแบบไม่ระบุตัวตน"
            href="/staff/reports"
            linkText="ดูรายงานฉบับเต็ม / ส่งออก"
          >
            <div className="grid grid-cols-2 gap-2">
              <MiniStat
                label="ปัญหาที่พบมากที่สุด"
                value={rep?.topIssue ? <span className="block truncate text-base" title={rep.topIssue.label}>{rep.topIssue.label}</span> : "–"}
                note={rep?.topIssue ? `${rep.topIssue.pct.toLocaleString("th-TH")}% ของผู้ใช้ · ${IN_RANGE}` : "ข้อมูลยังไม่พอ"}
              />
              <MiniStat
                label="ประเมินซ้ำตามรอบ"
                value={rep?.onTime !== null && rep?.onTime !== undefined ? `${rep.onTime.toLocaleString("th-TH")}%` : "–"}
                note={
                  rep?.onTimeChange !== null && rep?.onTimeChange !== undefined
                    ? `${rep.onTimeChange >= 0 ? "▲" : "▼"} ${Math.abs(rep.onTimeChange).toLocaleString("th-TH")} จุด จาก 30 วันก่อน`
                    : rep?.onTime !== null && rep?.onTime !== undefined
                      ? "30 วันล่าสุด"
                      : "ข้อมูลยังไม่พอ"
                }
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">การประเมินรายเดือน (6 เดือน)</p>
              {rep ? <MonthlyBars months={rep.monthly} /> : <div className="h-28 animate-pulse rounded-2xl bg-staff-soft" />}
            </div>
            <p className="mt-auto text-xs text-staff-muted">
              สถิติผลและการประเมินซ้ำ{CONSENT_NOTE} · จำนวนครั้งนับทุกคน
            </p>
          </SystemCard>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* รายการงานค้าง */}
        <Card className="lg:col-span-3">
          <h2 className="text-lg font-bold">สิ่งที่ต้องดูแลในระบบ</h2>
          <p className="mb-4 text-sm text-staff-muted">งานด้านเนื้อหาและบัญชีที่ยังค้างอยู่ · {AS_OF}</p>
          <div className="flex flex-col gap-2.5">
            {tasks && tasks.missing.length > 0 && (
              <TaskItem title="ระดับผลที่ยังไม่มีข้อความคำแนะนำ" count={tasks.missing.length} href={`/staff/assessments?type=${tasks.missing[0].typeId}`}>
                {tasks.missing.slice(0, 2).map((m, i) => (
                  <span key={i} className="block truncate">
                    {m.assessment} · ระดับ {m.level} — ผู้ใช้จะไม่เห็นคำแนะนำ
                  </span>
                ))}
                {tasks.missing.length > 2 && <span className="block">และอีก {tasks.missing.length - 2} ระดับ</span>}
              </TaskItem>
            )}
            {tasks && tasks.drafts.length > 0 && (
              <TaskItem title="ฉบับร่างที่ยังไม่เผยแพร่" count={tasks.drafts.length} href={`/staff/assessments?type=${tasks.drafts[0].typeId}`}>
                {tasks.drafts.slice(0, 2).map((d) => (
                  <span key={d.typeId} className="block truncate">
                    {d.assessment} · แก้ไขล่าสุด {relativeTime(d.updatedAt)}
                    {d.updatedBy ? ` โดย ${d.updatedBy}` : ""}
                  </span>
                ))}
                {tasks.drafts.length > 2 && <span className="block">และอีก {tasks.drafts.length - 2} ฉบับ</span>}
              </TaskItem>
            )}
            {tasks && tasks.suspended > 0 && (
              <TaskItem title="บัญชีที่ถูกระงับ" count={tasks.suspended} href="/staff/users?status=suspended">
                ตรวจสอบว่าควรเปิดใช้งานคืนหรือไม่
              </TaskItem>
            )}
            {tasks && taskCount === 0 && <p className="py-8 text-center text-sm text-staff-muted">ไม่มีงานค้าง</p>}
          </div>
        </Card>

        {/* กิจกรรมล่าสุดในระบบ */}
        <Card className="lg:col-span-2">
          <h2 className="text-lg font-bold">กิจกรรมล่าสุดในระบบ</h2>
          <p className="mb-3 text-sm text-staff-muted">{IN_RANGE} ({period})</p>
          {data && data.activity.length === 0 && <p className="py-8 text-center text-sm text-staff-muted">ไม่มีกิจกรรมใน {IN_RANGE}</p>}
          <ol className="relative">
            {(data?.activity ?? []).map((a, i, all) => (
              <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                {i < all.length - 1 && <span aria-hidden className="absolute left-[4.5px] top-4 h-full w-px bg-staff-line" />}
                <span className={`relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${a.kind === "signup" ? "bg-risk-ok" : "bg-staff-600"}`} />
                <div className="min-w-0">
                  <p className="text-sm [overflow-wrap:anywhere]">{a.text}</p>
                  <p className="text-xs text-staff-muted">{relativeTime(a.at)}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </section>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { ChevronDown, History } from "lucide-react";
import { staffFetch } from "@/lib/staff/client";
import type { Change } from "@/lib/staff/assessmentHistory";
import { Empty, ErrorBox, thDate } from "../ui";
import { rangeText, type Snapshot } from "./shared";

/* =========================================================
   แท็บ "ประวัติการแก้ไข"
   - แต่ละครั้งที่เผยแพร่: สิ่งที่เปลี่ยนเทียบกับครั้งก่อน (ค่าเดิม → ค่าใหม่)
   - กด "ดูเนื้อหาทั้งหมด" เพื่อดูข้อมูลเดิมทั้งชุดของครั้งนั้น (อ่านอย่างเดียว)
   - การเปิด/ปิดใช้งาน แสดงเป็นรายการในประวัติด้วย
========================================================= */

type Entry = {
  kind: "publish" | "baseline" | "enable" | "disable";
  at: string;
  by: string | null;
  versionId?: number;
  changes?: Change[];
};

const TITLE: Record<Entry["kind"], string> = {
  publish: "แก้ไขและเผยแพร่",
  baseline: "เนื้อหาตั้งต้น (ก่อนเริ่มบันทึกประวัติการแก้ไข)",
  enable: "เปิดใช้งานแบบประเมิน",
  disable: "ปิดใช้งานแบบประเมิน",
};

const DOT: Record<Entry["kind"], string> = {
  publish: "bg-staff-600",
  baseline: "bg-staff-300",
  enable: "bg-risk-ok",
  disable: "bg-risk-crit",
};

const SECTIONS: Change["section"][] = ["ข้อมูลทั่วไป", "คำถามและคะแนน", "เกณฑ์ผลและคำแนะนำ"];

// แท็บประวัติ: โหลดรายการเผยแพร่/เปิด-ปิดใช้งานของแบบประเมินแล้วแสดงเป็นไทม์ไลน์
export default function HistoryTab({ typeId, refreshKey }: { typeId: number; refreshKey: string }) {
  const reqKey = `${typeId}|${refreshKey}`;
  const [result, setResult] = useState<{ key: string; entries?: Entry[]; error?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    staffFetch<{ entries: Entry[] }>(`/api/staff/assessments?type=${typeId}&changes=1`)
      .then((d) => !cancelled && setResult({ key: `${typeId}|${refreshKey}`, entries: d.entries }))
      .catch((e) => !cancelled && setResult({ key: `${typeId}|${refreshKey}`, error: e.message }));
    return () => {
      cancelled = true;
    };
  }, [typeId, refreshKey]);

  if (result?.key !== reqKey) return <div className="h-40 animate-pulse rounded-2xl bg-staff-soft" />;
  if (result.error) return <ErrorBox message={result.error} />;
  const entries = result.entries ?? [];
  if (entries.length === 0) return <Empty>ยังไม่มีประวัติการแก้ไข</Empty>;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-staff-muted">
        การแก้ไขจะบันทึกในประวัติเมื่อกด &quot;เผยแพร่&quot; แสดงค่าเดิมและค่าใหม่ของแต่ละจุดที่เปลี่ยน
      </p>
      <ol className="relative">
        {entries.map((e, i) => (
          <li key={`${e.kind}-${e.at}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
            {i < entries.length - 1 && <span aria-hidden className="absolute left-[4.5px] top-4 h-full w-px bg-staff-line" />}
            <span className={`relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[e.kind]}`} />
            <EntryCard entry={e} />
          </li>
        ))}
      </ol>
    </div>
  );
}

// การ์ดหนึ่งรายการในประวัติ: หัวข้อ วันเวลา ผู้ทำ และจุดที่เปลี่ยนแยกตามส่วน
function EntryCard({ entry }: { entry: Entry }) {
  const changes = entry.changes ?? [];
  return (
    <div className="min-w-0 flex-1 rounded-2xl border border-staff-line bg-white p-4">
      <p className="font-semibold">{TITLE[entry.kind]}</p>
      <p className="text-xs text-staff-muted">
        {thDate(entry.at, true)} · {entry.by ?? (entry.kind === "baseline" ? "ระบบ" : "-")}
        {entry.kind === "publish" && ` · ${changes.length.toLocaleString("th-TH")} จุดที่เปลี่ยน`}
      </p>

      {changes.length > 0 && (
        <div className="mt-3 flex flex-col gap-3">
          {SECTIONS.map((section) => {
            const list = changes.filter((c) => c.section === section);
            if (list.length === 0) return null;
            return (
              <div key={section}>
                <p className="mb-1.5 text-xs font-bold text-staff-muted">{section}</p>
                <ul className="flex flex-col gap-2">
                  {list.map((c, i) => (
                    <ChangeRow key={i} change={c} />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {entry.versionId && <SnapshotViewer versionId={entry.versionId} />}
    </div>
  );
}

// แถวแสดงการเปลี่ยนแปลงหนึ่งจุด (ประเภท ค่าเดิม → ค่าใหม่)
function ChangeRow({ change }: { change: Change }) {
  const label = { add: "เพิ่ม", remove: "ลบ", change: "แก้ไข" }[change.kind];
  return (
    <li className="rounded-xl bg-staff-soft p-3 text-sm">
      <p className="font-semibold">
        <span className="mr-1.5 rounded-full bg-white px-2 py-0.5 text-xs text-staff-muted">{label}</span>
        <span className="[overflow-wrap:anywhere]">{change.title}</span>
      </p>
      {change.before !== undefined && (
        <p className="mt-1.5 whitespace-pre-line rounded-lg bg-[#fde6e7] px-2.5 py-1.5 text-[13px] text-[#8e1b25] [overflow-wrap:anywhere]">
          <span className="font-semibold">เดิม: </span>
          {change.before}
        </p>
      )}
      {change.after !== undefined && (
        <p className="mt-1.5 whitespace-pre-line rounded-lg bg-[#e8f7ed] px-2.5 py-1.5 text-[13px] text-[#21733f] [overflow-wrap:anywhere]">
          <span className="font-semibold">ใหม่: </span>
          {change.after}
        </p>
      )}
    </li>
  );
}

/* ดูเนื้อหาทั้งชุดของครั้งนั้น (ข้อมูลเดิมย้อนหลัง) — โหลดเมื่อกดเปิด */
function SnapshotViewer({ versionId }: { versionId: number }) {
  const [open, setOpen] = useState(false);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");

  // เปิด/ปิดส่วนเนื้อหา และโหลด snapshot เมื่อเปิดครั้งแรก
  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !snap) {
      staffFetch<{ version: { snapshot: Snapshot } }>(`/api/staff/assessments?version=${versionId}`)
        .then((d) => setSnap(d.version.snapshot))
        .catch((e) => setError(e.message));
    }
  };

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-staff-600 hover:underline"
      >
        <History size={14} />
        {open ? "ซ่อนเนื้อหาทั้งหมด" : "ดูเนื้อหาทั้งหมดของครั้งนี้"}
        <ChevronDown size={14} className={`transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-2 rounded-xl border border-staff-line p-3 text-sm">
          {error ? (
            <ErrorBox message={error} />
          ) : !snap ? (
            <div className="h-20 animate-pulse rounded-xl bg-staff-soft" />
          ) : (
            <div className="flex flex-col gap-3">
              {(snap.description || snap.source) && (
                <div className="text-[13px] text-staff-muted">
                  {snap.description && <p>คำอธิบาย: {snap.description}</p>}
                  {snap.source && <p>แหล่งอ้างอิง: {snap.source}</p>}
                </div>
              )}
              <div>
                <p className="mb-1 text-xs font-bold text-staff-muted">คำถามและคะแนน</p>
                <ol className="list-decimal space-y-1 pl-5">
                  {snap.questions.map((q, i) => (
                    <li key={i} className="[overflow-wrap:anywhere]">
                      {q.text}
                      {q.choices.length > 0 && (
                        <span className="block text-xs text-staff-muted">
                          {q.choices.map((c) => `${c.text} (${c.score})`).join(" · ")}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <p className="mb-1 text-xs font-bold text-staff-muted">เกณฑ์ผลและคำแนะนำ</p>
                <ul className="space-y-1.5">
                  {snap.levels.map((l, i) => (
                    <li key={i} className="[overflow-wrap:anywhere]">
                      <span className="font-semibold">{l.riskLevel}</span>
                      <span className="text-xs text-staff-muted">
                        {" "}
                        · {rangeText(l)}
                        {l.reassessDays ? ` · ประเมินซ้ำ ${l.reassessDays} วัน` : ""}
                        {l.hotline ? ` · ${l.hotline}` : ""}
                      </span>
                      <span className="block whitespace-pre-line text-[13px] text-staff-muted">{l.text || "(ยังไม่มีคำแนะนำ)"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

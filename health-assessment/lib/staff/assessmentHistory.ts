import type { SnapLevel, SnapQuestion, Snapshot } from "./assessmentVersions";

/* =========================================================
   ประวัติการแก้ไขแบบประเมิน: เทียบเนื้อหาแต่ละครั้งที่เผยแพร่กับครั้งก่อนหน้า
   - จับคู่คำถาม / ตัวเลือก / ระดับด้วย id (ไม่มี id → ใช้ข้อความ/ชื่อระดับ)
   - คืนรายการสิ่งที่เปลี่ยน พร้อมค่าเดิม (before) และค่าใหม่ (after) เพื่อดูข้อมูลเดิมย้อนหลังได้
========================================================= */

export type ChangeKind = "add" | "remove" | "change";
export type Change = {
  section: "ข้อมูลทั่วไป" | "คำถามและคะแนน" | "เกณฑ์ผลและคำแนะนำ";
  kind: ChangeKind;
  title: string;
  before?: string;
  after?: string;
};

// แปลงค่าเป็นข้อความตัดช่องว่าง (null/undefined = "")
const clean = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
// ข้อความสำหรับแสดงผล ถ้าว่างใช้คำแทน เช่น "(ว่าง)"
const shown = (v: unknown, empty = "(ว่าง)") => clean(v) || empty;
// ข้อความช่วงคะแนนของระดับผล เช่น "0–4" (ไม่มีช่วง = "คำนวณในระบบ")
const range = (l: SnapLevel) => (l.min === null && l.max === null ? "คำนวณในระบบ" : `${l.min ?? "–"}–${l.max ?? "–"}`);

// จับคู่รายการเก่า/ใหม่: id ก่อน แล้วค่อยใช้ key สำรอง
function pair<T extends { id?: number }>(prev: T[], next: T[], key: (x: T) => string) {
  const used = new Set<T>();
  const pairs: { a?: T; b?: T }[] = [];
  for (const b of next) {
    const a =
      prev.find((x) => !used.has(x) && x.id !== undefined && x.id === b.id) ??
      prev.find((x) => !used.has(x) && (x.id === undefined || b.id === undefined) && key(x) === key(b));
    if (a) used.add(a);
    pairs.push({ a, b });
  }
  for (const a of prev) if (!used.has(a)) pairs.push({ a });
  return pairs;
}

// ถ้าค่าเดิมกับค่าใหม่ต่างกัน เพิ่มรายการ "change" ลงในผลลัพธ์
function field(out: Change[], section: Change["section"], title: string, before: unknown, after: unknown) {
  if (clean(before) !== clean(after)) out.push({ section, kind: "change", title, before: shown(before), after: shown(after) });
}

// ข้อความสรุปคำถามพร้อมตัวเลือกและคะแนน ใช้แสดงตอนเพิ่ม/ลบคำถาม
function questionText(q: SnapQuestion) {
  const choices = q.choices.map((c) => `${c.text} (${c.score})`).join(" / ");
  return choices ? `${q.text} — ${choices}` : q.text;
}

// เทียบ snapshot สองเวอร์ชัน คืนรายการสิ่งที่เพิ่ม/ลบ/แก้ไข แยกตามส่วนของแบบประเมิน
export function diffSnapshots(prev: Snapshot, next: Snapshot): Change[] {
  const out: Change[] = [];

  /* ---------- ข้อมูลทั่วไป ---------- */
  field(out, "ข้อมูลทั่วไป", "ชื่อแบบประเมิน", prev.name, next.name);
  field(out, "ข้อมูลทั่วไป", "คำอธิบายสั้นที่ผู้ใช้เห็น", prev.description, next.description);
  field(out, "ข้อมูลทั่วไป", "แหล่งอ้างอิงของแบบประเมิน", prev.source, next.source);

  /* ---------- คำถาม ตัวเลือก คะแนน ---------- */
  const qs = pair(prev.questions, next.questions, (q) => clean(q.text));
  qs.forEach(({ a, b }) => {
    const no = b ? next.questions.indexOf(b) + 1 : prev.questions.indexOf(a!) + 1;
    const S = "คำถามและคะแนน" as const;
    if (!a) return out.push({ section: S, kind: "add", title: `เพิ่มคำถามข้อ ${no}`, after: questionText(b!) });
    if (!b) return out.push({ section: S, kind: "remove", title: `ลบคำถามเดิมข้อ ${no}`, before: questionText(a) });

    field(out, S, `ข้อ ${no} · ข้อความคำถาม`, a.text, b.text);
    if (a.type !== b.type) field(out, S, `ข้อ ${no} · รูปแบบคำตอบ`, a.type === "number" ? "กรอกตัวเลข" : "เลือกตอบ", b.type === "number" ? "กรอกตัวเลข" : "เลือกตอบ");
    pair(a.choices, b.choices, (c) => clean(c.text)).forEach(({ a: ca, b: cb }) => {
      if (!ca) return out.push({ section: S, kind: "add", title: `ข้อ ${no} · เพิ่มตัวเลือก`, after: `${cb!.text} (${cb!.score} คะแนน)` });
      if (!cb) return out.push({ section: S, kind: "remove", title: `ข้อ ${no} · ลบตัวเลือก`, before: `${ca.text} (${ca.score} คะแนน)` });
      field(out, S, `ข้อ ${no} · ตัวเลือก "${cb.text}"`, `${ca.text} (${ca.score} คะแนน)`, `${cb.text} (${cb.score} คะแนน)`);
    });
  });

  /* ---------- เกณฑ์ผลและคำแนะนำ ---------- */
  const S = "เกณฑ์ผลและคำแนะนำ" as const;
  pair(prev.levels, next.levels, (l) => clean(l.riskLevel)).forEach(({ a, b }) => {
    if (!a) return out.push({ section: S, kind: "add", title: `เพิ่มระดับ "${b!.riskLevel}"`, after: `คะแนน ${range(b!)} · ${shown(b!.text, "ยังไม่มีคำแนะนำ")}` });
    if (!b) return out.push({ section: S, kind: "remove", title: `ลบระดับ "${a.riskLevel}"`, before: `คะแนน ${range(a)} · ${shown(a.text, "ยังไม่มีคำแนะนำ")}` });

    const name = b.riskLevel;
    field(out, S, `ชื่อระดับ`, a.riskLevel, b.riskLevel);
    field(out, S, `ระดับ "${name}" · ช่วงคะแนน`, range(a), range(b));
    field(out, S, `ระดับ "${name}" · ข้อความคำแนะนำ`, a.text, b.text);
    field(out, S, `ระดับ "${name}" · รอบประเมินซ้ำ`, a.reassessDays === null ? "" : `${a.reassessDays} วัน`, b.reassessDays === null ? "" : `${b.reassessDays} วัน`);
    field(out, S, `ระดับ "${name}" · สายด่วน`, a.hotline, b.hotline);
    field(out, S, `ระดับ "${name}" · แหล่งอ้างอิงคำแนะนำ`, a.source, b.source);
  });

  return out;
}

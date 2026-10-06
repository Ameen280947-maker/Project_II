import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { logAccess, requireStaff } from "@/lib/staff/auth";
import { loadCustomSeverities } from "@/lib/customAssessments";
import { EXCLUDED_TYPES, TYPE_LABELS, severityOf, typeLabel } from "@/lib/staff/riskLevels";

/* =========================================================
   /api/staff/assessments
   GET                 → รายการแบบประเมิน + จำนวนข้อ
   GET ?type=<id>      → คำถาม ตัวเลือก คะแนน + เกณฑ์แปลผล (ตาราง recommendation)
   PUT { typeId, questions } → เผยแพร่ชุดคำถามใหม่
       - คำถาม/ตัวเลือกที่ถูกลบ → is_active = false (ไม่ลบจริง เพื่อให้ผลเก่ายังอ้างอิงได้)
   PATCH { typeId, isActive } → เปิด/ปิดแบบประเมิน
   POST  { name, description } → สร้างแบบประเมินใหม่ (เริ่มแบบปิดใช้งาน)
   PUT   { typeId, levels }    → บันทึกเกณฑ์แปลผลตามช่วงคะแนน (เฉพาะแบบประเมินทั่วไป)
   DELETE { typeId, confirmName } → ลบแบบประเมินที่สร้างใหม่และยังไม่มีใครทำ
========================================================= */

// แบบประเมินเดิมที่มีหน้าและโค้ดเฉพาะ ห้ามลบเด็ดขาด
const BUILT_IN = new Set([...Object.keys(TYPE_LABELS), ...EXCLUDED_TYPES]);

type ChoiceInput = { id?: number; text: string; score: number };
type QuestionInput = { id?: number; text: string; type: "choice" | "number"; choices: ChoiceInput[] };

export async function GET(request: NextRequest) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;
  const typeId = Number(new URL(request.url).searchParams.get("type"));

  try {
    if (!typeId) {
      const { rows } = await pool.query(
        `SELECT t.assessment_type_id, t.assessment_name, t.description, t.is_active,
                COUNT(q.question_id) FILTER (WHERE q.is_active)::int AS questions
           FROM assessment_types t
           LEFT JOIN questions q ON q.assessment_type_id = t.assessment_type_id
          WHERE NOT (t.assessment_name = ANY($1))
          GROUP BY t.assessment_type_id
          ORDER BY t.assessment_type_id`,
        [EXCLUDED_TYPES]
      );
      return NextResponse.json({
        success: true,
        types: rows.map((r) => ({
          id: r.assessment_type_id,
          name: r.assessment_name,
          label: typeLabel(r.assessment_name),
          description: r.description,
          isActive: r.is_active,
          questions: r.questions,
        })),
      });
    }

    await loadCustomSeverities();
    const [typeRes, qRes, cRes, recRes, editRes, usedRes] = await Promise.all([
      pool.query("SELECT * FROM assessment_types WHERE assessment_type_id = $1", [typeId]),
      pool.query(
        `SELECT question_id, question_text, question_type, display_order
           FROM questions WHERE assessment_type_id = $1 AND is_active
          ORDER BY display_order, question_id`,
        [typeId]
      ),
      pool.query(
        `SELECT c.choice_id, c.question_id, c.choice_text, c.score
           FROM question_choices c JOIN questions q USING (question_id)
          WHERE q.assessment_type_id = $1 AND q.is_active AND c.is_active
          ORDER BY c.display_order, c.score, c.choice_id`,
        [typeId]
      ),
      pool.query(
        `SELECT rec_id, risk_level, reassess_days, min_score, max_score, recommendation_text
           FROM recommendation WHERE assessment_type_id = $1 ORDER BY min_score NULLS LAST, rec_id`,
        [typeId]
      ),
      pool.query(
        `SELECT q.updated_at, u.username
           FROM questions q LEFT JOIN users u ON u.user_id = q.updated_by
          WHERE q.assessment_type_id = $1 AND q.updated_by IS NOT NULL
          ORDER BY q.updated_at DESC LIMIT 1`,
        [typeId]
      ),
      pool.query("SELECT COUNT(*)::int AS n FROM assessment WHERE assessment_type_id = $1", [typeId]),
    ]);

    const t = typeRes.rows[0];
    if (!t) return NextResponse.json({ success: false, message: "ไม่พบแบบประเมิน" }, { status: 404 });

    const name: string = t.assessment_name;
    // แก้เกณฑ์ช่วงคะแนนได้เฉพาะแบบประเมินทั่วไป หรือแบบใหม่ที่ยังไม่มีเกณฑ์
    const generic = recRes.rows.length === 0 || recRes.rows.every((r) => r.min_score !== null && r.max_score !== null);
    return NextResponse.json({
      success: true,
      assessment: {
        id: t.assessment_type_id,
        name,
        label: typeLabel(name),
        description: t.description,
        isActive: t.is_active,
        generic,
        resultCount: usedRes.rows[0].n,
        deletable: generic && !BUILT_IN.has(name) && usedRes.rows[0].n === 0,
        lastEdit: editRes.rows[0] ? { by: editRes.rows[0].username, at: editRes.rows[0].updated_at } : null,
        questions: qRes.rows.map((q) => ({
          id: q.question_id,
          text: q.question_text,
          type: q.question_type === "number" ? "number" : "choice",
          choices: cRes.rows
            .filter((c) => c.question_id === q.question_id)
            .map((c) => ({ id: c.choice_id, text: c.choice_text, score: c.score })),
        })),
        levels: recRes.rows
          .map((r) => ({
            id: r.rec_id,
            riskLevel: r.risk_level,
            severity: severityOf(name, r.risk_level),
            reassessDays: r.reassess_days,
            min: r.min_score === null ? null : Number(r.min_score),
            max: r.max_score === null ? null : Number(r.max_score),
            text: r.recommendation_text ?? "",
          }))
          .sort((a, b) => (generic ? 0 : a.severity - b.severity)),
      },
    });
  } catch (error) {
    console.error("GET /api/staff/assessments error:", error);
    return NextResponse.json({ success: false, message: "ไม่สามารถโหลดแบบประเมินได้" }, { status: 500 });
  }
}

// ตรวจข้อมูลที่ส่งมาให้อยู่ในรูปที่บันทึกได้
function cleanQuestions(raw: unknown): QuestionInput[] | string {
  if (!Array.isArray(raw) || raw.length === 0) return "ต้องมีคำถามอย่างน้อย 1 ข้อ";
  if (raw.length > 60) return "คำถามมากเกินไป";
  const out: QuestionInput[] = [];
  for (const [i, q] of raw.entries()) {
    const text = String(q?.text ?? "").trim();
    if (!text) return `กรุณากรอกข้อความคำถามข้อ ${i + 1}`;
    const type = q?.type === "number" ? "number" : "choice";
    const choices: ChoiceInput[] = [];
    if (type === "choice") {
      if (!Array.isArray(q.choices) || q.choices.length < 2) return `คำถามข้อ ${i + 1} ต้องมีตัวเลือกอย่างน้อย 2 ตัว`;
      for (const c of q.choices) {
        const ct = String(c?.text ?? "").trim();
        const score = Number(c?.score);
        if (!ct) return `กรุณากรอกข้อความตัวเลือกในข้อ ${i + 1}`;
        if (!Number.isInteger(score) || score < -100 || score > 100) return `คะแนนในข้อ ${i + 1} ต้องเป็นจำนวนเต็ม`;
        choices.push({ id: Number(c.id) || undefined, text: ct.slice(0, 255), score });
      }
    }
    out.push({ id: Number(q.id) || undefined, text: text.slice(0, 1000), type, choices });
  }
  return out;
}

export async function PUT(request: NextRequest) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  if (Array.isArray(body.levels)) return saveLevels(Number(body.typeId), body.levels, auth.staff.userId);
  const typeId = Number(body.typeId);
  const questions = cleanQuestions(body.questions);
  if (!typeId) return NextResponse.json({ success: false, message: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  if (typeof questions === "string") return NextResponse.json({ success: false, message: questions }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const staffId = auth.staff.userId;

    const existing = await client.query(
      "SELECT question_id FROM questions WHERE assessment_type_id = $1 AND is_active",
      [typeId]
    );
    const keep = new Set<number>();

    for (const [i, q] of questions.entries()) {
      let qid = q.id;
      if (qid) {
        const r = await client.query(
          `UPDATE questions SET question_text = $3, question_type = $4, display_order = $5, updated_by = $6, updated_at = NOW()
            WHERE question_id = $1 AND assessment_type_id = $2 RETURNING question_id`,
          [qid, typeId, q.text, q.type, i + 1, staffId]
        );
        if (!r.rowCount) qid = undefined; // id ไม่ใช่ของแบบประเมินนี้ → สร้างใหม่
      }
      if (!qid) {
        const r = await client.query(
          `INSERT INTO questions (assessment_type_id, question_text, question_type, display_order, is_required, is_active, created_by, updated_by)
           VALUES ($1, $2, $3, $4, TRUE, TRUE, $5, $5) RETURNING question_id`,
          [typeId, q.text, q.type, i + 1, staffId]
        );
        qid = r.rows[0].question_id as number;
      }
      keep.add(qid);

      // ตัวเลือก
      const keepChoices: number[] = [];
      for (const [j, c] of q.choices.entries()) {
        let cid = c.id;
        if (cid) {
          const r = await client.query(
            `UPDATE question_choices SET choice_text = $3, score = $4, display_order = $5, is_active = TRUE, updated_at = NOW()
              WHERE choice_id = $1 AND question_id = $2 RETURNING choice_id`,
            [cid, qid, c.text, c.score, j + 1]
          );
          if (!r.rowCount) cid = undefined;
        }
        if (!cid) {
          const r = await client.query(
            `INSERT INTO question_choices (question_id, choice_text, score, display_order, is_active)
             VALUES ($1, $2, $3, $4, TRUE) RETURNING choice_id`,
            [qid, c.text, c.score, j + 1]
          );
          cid = r.rows[0].choice_id as number;
        }
        keepChoices.push(cid!);
      }
      // คำถามแบบกรอกตัวเลขไม่มีตัวเลือกให้แก้ จึงไม่แตะตัวเลือกเดิม
      if (q.type === "choice") {
        await client.query(
          "UPDATE question_choices SET is_active = FALSE, updated_at = NOW() WHERE question_id = $1 AND NOT (choice_id = ANY($2))",
          [qid, keepChoices]
        );
      }
    }

    const removed = existing.rows.map((r) => r.question_id as number).filter((id) => !keep.has(id));
    if (removed.length) {
      await client.query(
        "UPDATE questions SET is_active = FALSE, updated_by = $2, updated_at = NOW() WHERE question_id = ANY($1)",
        [removed, staffId]
      );
    }
    await client.query("UPDATE assessment_types SET updated_at = NOW() WHERE assessment_type_id = $1", [typeId]);
    await client.query("COMMIT");

    await logAccess(staffId, null, "publish_assessment", `type ${typeId} · ${questions.length} ข้อ`);
    return NextResponse.json({ success: true });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("PUT /api/staff/assessments error:", error);
    return NextResponse.json({ success: false, message: "เผยแพร่ไม่สำเร็จ" }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const typeId = Number(body.typeId);
  if (!typeId || typeof body.isActive !== "boolean") {
    return NextResponse.json({ success: false, message: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  try {
    // เปิดใช้งานได้เมื่อมีคำถามและเกณฑ์แปลผลแล้ว
    if (body.isActive) {
      const { rows } = await pool.query(
        `SELECT (SELECT COUNT(*) FROM questions WHERE assessment_type_id = $1 AND is_active)::int AS q,
                (SELECT COUNT(*) FROM recommendation WHERE assessment_type_id = $1)::int AS r`,
        [typeId]
      );
      if (!rows[0].q || !rows[0].r) {
        return NextResponse.json(
          { success: false, message: "ต้องเผยแพร่คำถามและบันทึกเกณฑ์แปลผลก่อนเปิดใช้งาน" },
          { status: 400 }
        );
      }
    }
    await pool.query("UPDATE assessment_types SET is_active = $2, updated_at = NOW() WHERE assessment_type_id = $1", [
      typeId,
      body.isActive,
    ]);
    await logAccess(auth.staff.userId, null, body.isActive ? "enable_assessment" : "disable_assessment", `type ${typeId}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/staff/assessments error:", error);
    return NextResponse.json({ success: false, message: "บันทึกไม่สำเร็จ" }, { status: 500 });
  }
}

/* ---------- สร้างแบบประเมินใหม่ ---------- */

export async function POST(request: NextRequest) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 500) : "";
  if (!name) return NextResponse.json({ success: false, message: "กรุณากรอกชื่อแบบประเมิน" }, { status: 400 });

  try {
    const dup = await pool.query("SELECT 1 FROM assessment_types WHERE LOWER(assessment_name) = LOWER($1)", [name]);
    if (dup.rowCount) return NextResponse.json({ success: false, message: "มีแบบประเมินชื่อนี้แล้ว" }, { status: 409 });

    const { rows } = await pool.query(
      `INSERT INTO assessment_types (assessment_name, description, is_active, created_at, updated_at)
       VALUES ($1, $2, FALSE, NOW(), NOW()) RETURNING assessment_type_id`,
      [name, description || null]
    );
    await logAccess(auth.staff.userId, null, "create_assessment", name);
    return NextResponse.json({ success: true, id: rows[0].assessment_type_id });
  } catch (error) {
    console.error("POST /api/staff/assessments error:", error);
    return NextResponse.json({ success: false, message: "สร้างแบบประเมินไม่สำเร็จ" }, { status: 500 });
  }
}

/* ---------- เกณฑ์แปลผลตามช่วงคะแนน ---------- */

type LevelInput = { id?: number; riskLevel: string; min: number; max: number; text: string };

async function saveLevels(typeId: number, raw: unknown[], staffId: number) {
  if (!typeId) return NextResponse.json({ success: false, message: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  if (raw.length < 2 || raw.length > 8) {
    return NextResponse.json({ success: false, message: "ต้องมีระดับผล 2–8 ระดับ" }, { status: 400 });
  }

  const levels: LevelInput[] = [];
  for (const [i, l] of raw.entries()) {
    const v = l as Record<string, unknown>;
    const riskLevel = String(v.riskLevel ?? "").trim().slice(0, 100);
    const text = String(v.text ?? "").trim().slice(0, 1000);
    const min = Number(v.min);
    const max = Number(v.max);
    if (!riskLevel) return NextResponse.json({ success: false, message: `กรุณาตั้งชื่อระดับที่ ${i + 1}` }, { status: 400 });
    if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
      return NextResponse.json({ success: false, message: `ช่วงคะแนนของ "${riskLevel}" ไม่ถูกต้อง` }, { status: 400 });
    }
    if (!text) return NextResponse.json({ success: false, message: `กรุณากรอกคำแนะนำของ "${riskLevel}"` }, { status: 400 });
    levels.push({ id: Number(v.id) || undefined, riskLevel, min, max, text });
  }
  levels.sort((a, b) => a.min - b.min);
  for (let i = 1; i < levels.length; i++) {
    if (levels[i].min !== levels[i - 1].max + 1) {
      return NextResponse.json(
        { success: false, message: `ช่วงคะแนนต้องต่อกันพอดี: "${levels[i - 1].riskLevel}" จบที่ ${levels[i - 1].max} ระดับถัดไปต้องเริ่มที่ ${levels[i - 1].max + 1}` },
        { status: 400 }
      );
    }
  }
  if (new Set(levels.map((l) => l.riskLevel)).size !== levels.length) {
    return NextResponse.json({ success: false, message: "ชื่อระดับผลต้องไม่ซ้ำกัน" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query("SELECT rec_id, min_score FROM recommendation WHERE assessment_type_id = $1", [typeId]);
    if (existing.rows.some((r) => r.min_score === null)) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, message: "แบบประเมินนี้แปลผลด้วยสูตรในระบบ แก้ช่วงคะแนนจากหน้านี้ไม่ได้" },
        { status: 400 }
      );
    }

    const keep: number[] = [];
    for (const l of levels) {
      let id = l.id && existing.rows.some((r) => r.rec_id === l.id) ? l.id : undefined;
      if (id) {
        await client.query(
          `UPDATE recommendation SET risk_level = $2, min_score = $3, max_score = $4, recommendation_text = $5,
                  updated_by = $6, updated_at = NOW() WHERE rec_id = $1`,
          [id, l.riskLevel, l.min, l.max, l.text, staffId]
        );
      } else {
        const r = await client.query(
          `INSERT INTO recommendation (assessment_type_id, risk_level, min_score, max_score, recommendation_text, updated_by, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING rec_id`,
          [typeId, l.riskLevel, l.min, l.max, l.text, staffId]
        );
        id = r.rows[0].rec_id as number;
      }
      keep.push(id!);
    }

    // ลบระดับที่ไม่ใช้แล้ว ถ้ามีผลประเมินอ้างถึงอยู่จะลบไม่ได้
    const removed = existing.rows.map((r) => r.rec_id as number).filter((id) => !keep.includes(id));
    if (removed.length) {
      const used = await client.query("SELECT 1 FROM assessment WHERE recommendation_id = ANY($1) LIMIT 1", [removed]);
      if (used.rowCount) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { success: false, message: "ลบระดับนี้ไม่ได้ เพราะมีผลประเมินของผู้ใช้อ้างอิงอยู่ (แก้ชื่อหรือช่วงคะแนนแทนได้)" },
          { status: 409 }
        );
      }
      await client.query("DELETE FROM recommendation WHERE rec_id = ANY($1)", [removed]);
    }
    await client.query("COMMIT");
    await logAccess(staffId, null, "save_assessment_levels", `type ${typeId} · ${levels.length} ระดับ`);
    return NextResponse.json({ success: true });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("PUT levels /api/staff/assessments error:", error);
    return NextResponse.json({ success: false, message: "บันทึกเกณฑ์แปลผลไม่สำเร็จ" }, { status: 500 });
  } finally {
    client.release();
  }
}

/* ---------- ลบแบบประเมิน ---------- */

export async function DELETE(request: NextRequest) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const typeId = Number(body.typeId);
  if (!typeId) return NextResponse.json({ success: false, message: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // ล็อกแถวไว้ กันมีคนส่งแบบประเมินเข้ามาระหว่างลบ
    const t = await client.query("SELECT assessment_name FROM assessment_types WHERE assessment_type_id = $1 FOR UPDATE", [typeId]);
    const name: string | undefined = t.rows[0]?.assessment_name;
    const refuse = async (message: string, status = 400) => {
      await client.query("ROLLBACK");
      return NextResponse.json({ success: false, message }, { status });
    };

    if (!name) return refuse("ไม่พบแบบประเมิน", 404);
    if (String(body.confirmName ?? "").trim() !== name) return refuse("ชื่อที่พิมพ์ยืนยันไม่ตรงกับชื่อแบบประเมิน");
    if (BUILT_IN.has(name)) return refuse("แบบประเมินหลักของระบบลบไม่ได้");

    const legacy = await client.query(
      "SELECT 1 FROM recommendation WHERE assessment_type_id = $1 AND (min_score IS NULL OR max_score IS NULL) LIMIT 1",
      [typeId]
    );
    if (legacy.rowCount) return refuse("แบบประเมินนี้แปลผลด้วยสูตรในระบบ ลบไม่ได้");

    const used = await client.query("SELECT COUNT(*)::int AS n FROM assessment WHERE assessment_type_id = $1", [typeId]);
    if (used.rows[0].n > 0) {
      return refuse(`มีผลการประเมินของผู้ใช้แล้ว ${used.rows[0].n} รายการ จึงลบไม่ได้ ใช้การปิดใช้งานแทน`, 409);
    }

    await client.query(
      "DELETE FROM question_choices WHERE question_id IN (SELECT question_id FROM questions WHERE assessment_type_id = $1)",
      [typeId]
    );
    await client.query("DELETE FROM questions WHERE assessment_type_id = $1", [typeId]);
    await client.query("DELETE FROM recommendation WHERE assessment_type_id = $1", [typeId]);
    await client.query("DELETE FROM assessment_types WHERE assessment_type_id = $1", [typeId]);
    await client.query("COMMIT");

    await logAccess(auth.staff.userId, null, "delete_assessment", `type ${typeId} · ${name}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("DELETE /api/staff/assessments error:", error);
    return NextResponse.json({ success: false, message: "ลบแบบประเมินไม่สำเร็จ" }, { status: 500 });
  } finally {
    client.release();
  }
}

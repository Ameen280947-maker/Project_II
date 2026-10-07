import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getGenericLevels, levelForScore, listGenericTypes } from "@/lib/customAssessments";
import { requireUser } from "@/lib/session";
import {
  badRequest,
  loadActiveChoices,
  readJsonObject,
  resolveChoiceAnswers,
  toId,
  userExists,
} from "../_lib/validate";
import { logSystemError } from "@/lib/errorLogger";

/* =========================================================
   /api/assessments/custom  (แบบประเมินที่เจ้าหน้าที่สร้างเพิ่ม)
   GET                                  → รายการแบบประเมินที่เปิดใช้งาน
   GET ?type=<id>                       → คำถาม + ตัวเลือก (id ไม่ใช่ตัวเลข/ไม่มีจริง = 404)
   GET ?assessmentId=<id>&userId=<id>   → ผลการประเมินของผู้ใช้ใน session เท่านั้น
   POST { userId, typeId, answers: [{ questionId, choiceId }] }
   - คะแนนคิดจากฐานข้อมูลเสมอ ไม่เชื่อคะแนนที่ส่งมาจากเบราว์เซอร์
   - ต้องตอบครบทุกข้อ ข้อละ 1 คำตอบ
========================================================= */

export async function GET(request: NextRequest) {
  const p = new URL(request.url).searchParams;
  try {
    if (p.has("assessmentId")) {
      const auth = requireUser(request, p.get("userId"));
      if (!auth.ok) return auth.response;

      const assessmentId = toId(p.get("assessmentId"));
      if (assessmentId === null) return badRequest("assessmentId ไม่ถูกต้อง");
      return result(assessmentId, auth.userId);
    }

    if (!p.has("type")) return NextResponse.json({ success: true, types: await listGenericTypes() });

    const typeId = toId(p.get("type"));
    if (typeId === null) {
      return NextResponse.json({ success: false, message: "ไม่พบแบบประเมินนี้" }, { status: 404 });
    }

    const levels = await getGenericLevels(typeId);
    const t = await pool.query("SELECT assessment_name, description, is_active FROM assessment_types WHERE assessment_type_id = $1", [typeId]);
    if (!levels || !t.rows[0]?.is_active) {
      return NextResponse.json({ success: false, message: "ไม่พบแบบประเมินนี้ หรือยังไม่เปิดให้ใช้งาน" }, { status: 404 });
    }

    const { rows } = await pool.query(
      `SELECT q.question_id, q.question_text, c.choice_id, c.choice_text
         FROM questions q
         JOIN question_choices c ON c.question_id = q.question_id AND c.is_active
        WHERE q.assessment_type_id = $1 AND q.is_active
        ORDER BY q.display_order, q.question_id, c.display_order, c.choice_id`,
      [typeId]
    );
    const questions: { id: number; text: string; choices: { id: number; text: string }[] }[] = [];
    for (const r of rows) {
      let q = questions.find((x) => x.id === r.question_id);
      if (!q) questions.push((q = { id: r.question_id, text: r.question_text, choices: [] }));
      q.choices.push({ id: r.choice_id, text: r.choice_text });
    }

    return NextResponse.json({
      success: true,
      assessment: { id: typeId, name: t.rows[0].assessment_name, description: t.rows[0].description, questions },
    });
  } catch (error) {
    void logSystemError("GET /api/assessments/custom", error);
    console.error("GET /api/assessments/custom error:", error);
    return NextResponse.json({ success: false, message: "ไม่สามารถโหลดแบบประเมินได้" }, { status: 500 });
  }
}

async function result(assessmentId: number, userId: number) {
  const { rows } = await pool.query(
    `SELECT a.assessment_id, a.assessment_type_id, a.total_score, a.risk_level, a.assessed_at,
            t.assessment_name, r.recommendation_text, r.reassess_days, r.hotline, r.source
       FROM assessment a
       JOIN assessment_types t USING (assessment_type_id)
       LEFT JOIN recommendation r ON r.rec_id = a.recommendation_id
      WHERE a.assessment_id = $1 AND a.user_id = $2`,
    [assessmentId, userId]
  );
  const a = rows[0];
  if (!a) return NextResponse.json({ success: false, message: "ไม่พบผลการประเมิน" }, { status: 404 });

  const levels = (await getGenericLevels(a.assessment_type_id)) ?? [];
  const level = levels.find((l) => l.riskLevel === a.risk_level);
  return NextResponse.json({
    success: true,
    result: {
      assessmentId: a.assessment_id,
      typeId: a.assessment_type_id,
      name: a.assessment_name,
      score: Number(a.total_score),
      maxScore: levels.length ? levels[levels.length - 1].max : null,
      riskLevel: a.risk_level,
      severity: level?.severity ?? 0,
      recommendation: a.recommendation_text ?? "",
      reassessDays: a.reassess_days,
      hotline: a.hotline,
      source: a.source,
      assessedAt: a.assessed_at,
    },
  });
}

export async function POST(request: NextRequest) {
  const body = await readJsonObject(request);
  if (!body) return badRequest("รูปแบบข้อมูลไม่ถูกต้อง");

  // ผู้ใช้มาจาก session เท่านั้น (userId ที่ส่งมาต้องตรงกับ session)
  const auth = requireUser(request, body.userId ?? body.user_id);
  if (!auth.ok) return auth.response;
  const userId = auth.userId;

  const typeId = toId(body.typeId);
  if (typeId === null) {
    return NextResponse.json({ success: false, message: "แบบประเมินนี้ยังไม่เปิดให้ใช้งาน" }, { status: 404 });
  }
  if (!Array.isArray(body.answers)) return badRequest("ไม่พบคำตอบแบบประเมิน");
  const answers = body.answers as { questionId?: unknown; choiceId?: unknown }[];

  const client = await pool.connect();
  try {
    if (!(await userExists(client, userId))) return badRequest("ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่");

    const levels = await getGenericLevels(typeId, client);
    const t = await client.query("SELECT is_active FROM assessment_types WHERE assessment_type_id = $1", [typeId]);
    if (!levels || !t.rows[0]?.is_active) {
      return NextResponse.json({ success: false, message: "แบบประเมินนี้ยังไม่เปิดให้ใช้งาน" }, { status: 404 });
    }

    // คำถามที่ใช้งานอยู่ และคะแนนของแต่ละตัวเลือก (ตอบซ้ำ/ตัวเลือกไม่มีจริง/ไม่ครบ = 400)
    const resolved = resolveChoiceAnswers(
      await loadActiveChoices(client, typeId),
      answers.map((a) => ({ questionId: a?.questionId, choiceId: a?.choiceId ?? null }))
    );
    if (!resolved.ok) return badRequest(resolved.message);
    const picked = resolved.picked;

    const total = resolved.total;
    const level = levelForScore(levels, total);
    if (!level) {
      console.error(`custom assessment ${typeId}: score ${total} อยู่นอกเกณฑ์แปลผล`);
      return NextResponse.json(
        { success: false, message: "ระบบแปลผลคะแนนนี้ไม่ได้ กรุณาแจ้งเจ้าหน้าที่ให้ตรวจสอบเกณฑ์แปลผล" },
        { status: 500 }
      );
    }

    await client.query("BEGIN");
    const ins = await client.query(
      `INSERT INTO assessment (user_id, assessment_type_id, recommendation_id, total_score, risk_level, assessed_at)
       VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING assessment_id`,
      [userId, typeId, level.recId, total, level.riskLevel]
    );
    const assessmentId = ins.rows[0].assessment_id as number;
    for (const c of picked) {
      await client.query(
        `INSERT INTO assessment_answers (assessment_id, question_id, choice_id, answer_value, score, answered_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [assessmentId, c.question_id, c.choice_id, c.choice_text, c.score]
      );
    }
    await client.query("COMMIT");

    return NextResponse.json({ success: true, assessmentId, totalScore: total, riskLevel: level.riskLevel });
  } catch (error) {
    void logSystemError("POST /api/assessments/custom", error);
    await client.query("ROLLBACK").catch(() => {});
    console.error("POST /api/assessments/custom error:", error);
    return NextResponse.json({ success: false, message: "ไม่สามารถบันทึกผลการประเมินได้" }, { status: 500 });
  } finally {
    client.release();
  }
}

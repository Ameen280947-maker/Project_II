import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { logAccess, requireStaff } from "@/lib/staff/auth";
import { loadCustomSeverities } from "@/lib/customAssessments";
import { EXCLUDED_TYPES, severityOf, typeLabel } from "@/lib/staff/riskLevels";

/* =========================================================
   /api/staff/recommendations
   GET                    → รายการแบบประเมิน + จำนวนระดับที่ยังไม่มีข้อความ
   GET ?type=<id>         → ทุกระดับของแบบประเมินนั้น
   GET ?history=<rec_id>  → ประวัติการแก้ไข (เก็บใน access_logs)
   PUT { recId, text, reassessDays, hotline, source }
========================================================= */

const HISTORY_ACTION = "edit_recommendation";

export async function GET(request: NextRequest) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;
  const p = new URL(request.url).searchParams;

  try {
    const historyId = Number(p.get("history"));
    if (historyId) {
      const { rows } = await pool.query(
        `SELECT l.detail, l.created_at, u.username
           FROM access_logs l LEFT JOIN users u ON u.user_id = l.staff_id
          WHERE l.action = $1 AND l.detail LIKE $2
          ORDER BY l.created_at DESC LIMIT 20`,
        [HISTORY_ACTION, `{"recId":${historyId},%`]
      );
      return NextResponse.json({
        success: true,
        history: rows.map((r) => {
          let prev = "";
          try {
            prev = JSON.parse(r.detail).before ?? "";
          } catch {}
          return { by: r.username, at: r.created_at, before: prev };
        }),
      });
    }

    const typeId = Number(p.get("type"));
    if (!typeId) {
      const { rows } = await pool.query(
        `SELECT t.assessment_type_id, t.assessment_name,
                COUNT(r.rec_id)::int AS levels,
                COUNT(r.rec_id) FILTER (WHERE COALESCE(TRIM(r.recommendation_text), '') = '')::int AS missing
           FROM assessment_types t
           JOIN recommendation r ON r.assessment_type_id = t.assessment_type_id
          WHERE NOT (t.assessment_name = ANY($1))
          GROUP BY t.assessment_type_id
          ORDER BY t.assessment_type_id`,
        [EXCLUDED_TYPES]
      );
      return NextResponse.json({
        success: true,
        types: rows.map((r) => ({ id: r.assessment_type_id, label: typeLabel(r.assessment_name), levels: r.levels, missing: r.missing })),
      });
    }

    await loadCustomSeverities();
    const { rows } = await pool.query(
      `SELECT r.*, t.assessment_name, u.username AS editor
         FROM recommendation r
         JOIN assessment_types t ON t.assessment_type_id = r.assessment_type_id
         LEFT JOIN users u ON u.user_id = r.updated_by
        WHERE r.assessment_type_id = $1
        ORDER BY r.rec_id`,
      [typeId]
    );
    return NextResponse.json({
      success: true,
      levels: rows
        .map((r) => ({
          id: r.rec_id,
          riskLevel: r.risk_level,
          severity: severityOf(r.assessment_name, r.risk_level),
          text: r.recommendation_text ?? "",
          reassessDays: r.reassess_days,
          hotline: r.hotline ?? "",
          source: r.source ?? "",
          editor: r.editor,
          updatedAt: r.updated_at,
          range: r.min_score === null || r.max_score === null ? null : { min: Number(r.min_score), max: Number(r.max_score) },
        }))
        .sort((a, b) => (a.range && b.range ? a.range.min - b.range.min : a.severity - b.severity || a.id - b.id)),
    });
  } catch (error) {
    console.error("GET /api/staff/recommendations error:", error);
    return NextResponse.json({ success: false, message: "ไม่สามารถโหลดคำแนะนำได้" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const recId = Number(body.recId);
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const days = body.reassessDays === null || body.reassessDays === "" ? null : Number(body.reassessDays);
  const hotline = typeof body.hotline === "string" ? body.hotline.trim().slice(0, 100) : "";
  const source = typeof body.source === "string" ? body.source.trim().slice(0, 300) : "";

  if (!recId) return NextResponse.json({ success: false, message: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  if (!text) return NextResponse.json({ success: false, message: "กรุณากรอกข้อความคำแนะนำ" }, { status: 400 });
  if (text.length > 1000) return NextResponse.json({ success: false, message: "ข้อความยาวเกิน 1,000 ตัวอักษร" }, { status: 400 });
  if (days !== null && (!Number.isInteger(days) || days < 1 || days > 730)) {
    return NextResponse.json({ success: false, message: "รอบประเมินซ้ำต้องอยู่ระหว่าง 1–730 วัน" }, { status: 400 });
  }

  try {
    const before = await pool.query("SELECT recommendation_text FROM recommendation WHERE rec_id = $1", [recId]);
    if (!before.rows[0]) return NextResponse.json({ success: false, message: "ไม่พบคำแนะนำ" }, { status: 404 });

    await pool.query(
      `UPDATE recommendation
          SET recommendation_text = $2, reassess_days = $3, hotline = $4, source = $5,
              updated_by = $6, updated_at = NOW()
        WHERE rec_id = $1`,
      [recId, text, days, hotline || null, source || null, auth.staff.userId]
    );
    await logAccess(
      auth.staff.userId,
      null,
      HISTORY_ACTION,
      JSON.stringify({ recId, before: before.rows[0].recommendation_text ?? "" })
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/staff/recommendations error:", error);
    return NextResponse.json({ success: false, message: "บันทึกคำแนะนำไม่สำเร็จ" }, { status: 500 });
  }
}

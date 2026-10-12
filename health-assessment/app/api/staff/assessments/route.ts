import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { logAccess, requireStaff } from "@/lib/staff/auth";
import { EXCLUDED_TYPES, typeLabel } from "@/lib/staff/riskLevels";
import { logSystemError } from "@/lib/errorLogger";
import { listCategories } from "@/lib/assessmentCategoriesDb";
import { CATEGORY_NAME_MAX, CATEGORY_SUBTITLE_MAX, isCategoryTheme } from "@/lib/assessmentCategories";
import {
  BUILT_IN,
  applySnapshot,
  buildSnapshot,
  ensureBaselines,
  normalizeSnapshot,
  validateForPublish,
  type Snapshot,
} from "@/lib/staff/assessmentVersions";
import { diffSnapshots, type Change } from "@/lib/staff/assessmentHistory";

/* =========================================================
   /api/staff/assessments
   GET                      → รายการแบบประเมิน (จำนวนข้อ, เวอร์ชันล่าสุด, ระดับที่ขาดคำแนะนำ, หมวดหมู่) + categories
   GET ?type=<id>           → เนื้อหาสำหรับแก้ไข (ฉบับร่างถ้ามี ไม่งั้นเนื้อหาที่ใช้งานอยู่) + ข้อมูลเวอร์ชัน
   GET ?type=<id>&changes=1 → ประวัติการแก้ไข (แต่ละครั้งที่เผยแพร่เทียบกับครั้งก่อน + เปิด/ปิดใช้งาน)
   GET ?version=<id>        → snapshot ของเวอร์ชันนั้น (ดูอย่างเดียว)
   GET ?history=<rec_id>    → ประวัติการแก้คำแนะนำ (recommendation_history)
   PUT   { typeId, snapshot }               → บันทึกฉบับร่าง
   POST  { action: "discard", typeId }      → ทิ้งฉบับร่าง
   POST  { action: "publish", typeId, snapshot? } → เผยแพร่ (เขียนลงตารางจริง + เวอร์ชันใหม่)
   POST  { name, description, categoryId }  → สร้างแบบประเมินใหม่ (เริ่มแบบปิดใช้งาน) ในหมวดที่มีอยู่
   POST  { name, description, newCategory: { name, subtitle?, theme } }
                                            → สร้างหมวดใหม่ + แบบประเมิน ใน transaction เดียว
   PATCH { typeId, isActive }               → เปิด/ปิดแบบประเมิน (มีผลทันที ไม่ผ่านฉบับร่าง)
   PATCH { typeId, categoryId }             → ย้ายหมวดหมู่ (มีผลทันที, เฉพาะแบบประเมินที่สร้างเพิ่ม)
   DELETE { typeId, confirmName }           → ลบแบบประเมินที่สร้างใหม่และยังไม่มีใครทำ
========================================================= */

// สร้าง response JSON แจ้งข้อผิดพลาด (ค่าเริ่มต้น status 400)
const fail = (message: string, status = 400) => NextResponse.json({ success: false, message }, { status });

// GET: คืนรายการแบบประเมิน / รายละเอียด / ประวัติการแก้ไข / เวอร์ชัน ตาม query
export async function GET(request: NextRequest) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;
  const p = new URL(request.url).searchParams;
  const typeId = Number(p.get("type"));
  const versionId = Number(p.get("version"));
  const historyId = Number(p.get("history"));

  try {
    if (historyId) return NextResponse.json({ success: true, history: await recHistory(historyId) });
    if (versionId) return getVersion(versionId);
    if (typeId && p.get("changes")) return NextResponse.json({ success: true, entries: await listChanges(typeId) });
    if (typeId) return getDetail(typeId);

    const ids = await pool.query("SELECT assessment_type_id FROM assessment_types WHERE NOT (assessment_name = ANY($1))", [
      EXCLUDED_TYPES,
    ]);
    await ensureBaselines(ids.rows.map((r) => r.assessment_type_id));
    const { rows } = await pool.query(
      `SELECT t.assessment_type_id, t.assessment_name, t.description, t.is_active, t.category_id,
              (SELECT COUNT(*) FROM questions q WHERE q.assessment_type_id = t.assessment_type_id AND q.is_active)::int AS questions,
              (SELECT COUNT(*) FROM recommendation r WHERE r.assessment_type_id = t.assessment_type_id
                  AND COALESCE(TRIM(r.recommendation_text), '') = '')::int AS missing,
              (SELECT MAX(version_no) FROM assessment_versions v
                WHERE v.assessment_type_id = t.assessment_type_id AND v.status = 'published') AS version_no,
              EXISTS (SELECT 1 FROM assessment_versions v
                       WHERE v.assessment_type_id = t.assessment_type_id AND v.status = 'draft') AS has_draft
         FROM assessment_types t
        WHERE NOT (t.assessment_name = ANY($1))
        ORDER BY t.assessment_type_id`,
      [EXCLUDED_TYPES]
    );
    const categories = await listCategories();
    return NextResponse.json({
      success: true,
      categories: categories.map((c) => ({ ...c, types: rows.filter((r) => r.category_id === c.id).length })),
      types: rows.map((r) => ({
        id: r.assessment_type_id,
        name: r.assessment_name,
        label: typeLabel(r.assessment_name),
        description: r.description,
        isActive: r.is_active,
        questions: r.questions,
        missing: r.missing,
        versionNo: r.version_no,
        hasDraft: r.has_draft,
        categoryId: r.category_id,
        builtIn: BUILT_IN.has(r.assessment_name),
      })),
    });
  } catch (error) {
    void logSystemError("GET /api/staff/assessments", error);
    console.error("GET /api/staff/assessments error:", error);
    return fail("ไม่สามารถโหลดแบบประเมินได้", 500);
  }
}

// ดึงเนื้อหาสำหรับแก้ไข (ฉบับร่างถ้ามี ไม่งั้นเนื้อหาที่ใช้งานอยู่) พร้อมข้อมูลเวอร์ชัน
async function getDetail(typeId: number) {
  const t = await pool.query("SELECT assessment_name, is_active, category_id FROM assessment_types WHERE assessment_type_id = $1", [typeId]);
  const type = t.rows[0];
  if (!type) return fail("ไม่พบแบบประเมิน", 404);
  await ensureBaselines([typeId]);

  const [live, draftRes, pubRes, usedRes, metaRes] = await Promise.all([
    buildSnapshot(pool, typeId),
    pool.query(
      `SELECT v.snapshot, v.updated_at, u.username FROM assessment_versions v
         LEFT JOIN users u ON u.user_id = v.updated_by
        WHERE v.assessment_type_id = $1 AND v.status = 'draft'`,
      [typeId]
    ),
    pool.query(
      `SELECT v.version_id, v.version_no, v.published_at, u.username,
              (SELECT COUNT(*) FROM assessment a WHERE a.version_id = v.version_id)::int AS used
         FROM assessment_versions v LEFT JOIN users u ON u.user_id = v.published_by
        WHERE v.assessment_type_id = $1 AND v.status = 'published'
        ORDER BY v.version_no DESC LIMIT 1`,
      [typeId]
    ),
    pool.query("SELECT COUNT(*)::int AS n FROM assessment WHERE assessment_type_id = $1", [typeId]),
    pool.query(
      `SELECT r.rec_id, r.updated_at, u.username FROM recommendation r
         LEFT JOIN users u ON u.user_id = r.updated_by
        WHERE r.assessment_type_id = $1`,
      [typeId]
    ),
  ]);
  if (!live) return fail("ไม่พบแบบประเมิน", 404);

  const name: string = type.assessment_name;
  const resultCount: number = usedRes.rows[0].n;
  const draft = draftRes.rows[0];
  const pub = pubRes.rows[0];
  // ฉบับร่างที่สร้างก่อนเกณฑ์แปลผลเปลี่ยนรูปแบบ ใช้ต่อไม่ได้ → แสดงเนื้อหาปัจจุบันแทน
  const draftOk = draft && (draft.snapshot as Snapshot).generic === live.generic;

  return NextResponse.json({
    success: true,
    assessment: {
      id: typeId,
      name,
      label: typeLabel(name),
      isActive: type.is_active,
      categoryId: type.category_id,
      generic: live.generic,
      builtIn: BUILT_IN.has(name),
      resultCount,
      // แบบประเมินที่สร้างเพิ่มลบได้เสมอ (ถ้ามีผลประเมิน หน้ายืนยันจะแจ้งว่าผลจะถูกลบด้วย)
      deletable: live.generic && !BUILT_IN.has(name),
      content: draftOk ? { ...(draft.snapshot as Snapshot), name } : live,
      live,
      draft: draft ? { updatedAt: draft.updated_at, by: draft.username } : null,
      published: pub
        ? { versionId: pub.version_id, versionNo: pub.version_no, at: pub.published_at, by: pub.username, used: pub.used }
        : null,
      levelMeta: Object.fromEntries(metaRes.rows.map((r) => [r.rec_id, { at: r.updated_at, by: r.username }])),
    },
  });
}

// ประวัติการแก้ไข ใหม่ → เก่า
// - เผยแพร่: เทียบเนื้อหากับครั้งที่เผยแพร่ก่อนหน้า (ครั้งแรก = เนื้อหาตั้งต้น ไม่มีให้เทียบ)
// - เปิด/ปิดใช้งาน: จาก access_logs (มีผลทันที ไม่ผ่านการเผยแพร่)
type HistoryEntry = {
  kind: "publish" | "baseline" | "enable" | "disable";
  at: string;
  by: string | null;
  versionId?: number;
  changes?: Change[];
};

// รวมประวัติการเผยแพร่แต่ละเวอร์ชัน (เทียบกับครั้งก่อน) และการเปิด/ปิดใช้งาน
async function listChanges(typeId: number): Promise<HistoryEntry[]> {
  const [versions, toggles] = await Promise.all([
    pool.query<{ version_id: number; published_at: Date; published_by: number | null; username: string | null; snapshot: Snapshot }>(
      `SELECT v.version_id, v.published_at, v.published_by, u.username, v.snapshot
         FROM assessment_versions v LEFT JOIN users u ON u.user_id = v.published_by
        WHERE v.assessment_type_id = $1 AND v.status = 'published'
        ORDER BY v.version_no ASC`,
      [typeId]
    ),
    pool.query<{ action: string; created_at: Date; username: string | null }>(
      `SELECT l.action, l.created_at, u.username
         FROM access_logs l LEFT JOIN users u ON u.user_id = l.staff_id
        WHERE l.action IN ('enable_assessment', 'disable_assessment') AND l.detail = $1`,
      [`type ${typeId}`]
    ),
  ]);

  const entries: HistoryEntry[] = versions.rows.map((v, i) => {
    // lib/db.ts อ่าน timestamp เป็นเวลา UTC ให้แล้ว
    const at = new Date(v.published_at).toISOString();
    if (i === 0) return { kind: "baseline", at, by: v.username, versionId: v.version_id };
    return { kind: "publish", at, by: v.username, versionId: v.version_id, changes: diffSnapshots(versions.rows[i - 1].snapshot, v.snapshot) };
  });
  for (const t of toggles.rows) {
    entries.push({ kind: t.action === "enable_assessment" ? "enable" : "disable", at: new Date(t.created_at).toISOString(), by: t.username });
  }
  return entries.sort((a, b) => b.at.localeCompare(a.at));
}

// คืน snapshot ของเวอร์ชันที่เผยแพร่แล้ว (ดูอย่างเดียว)
async function getVersion(versionId: number) {
  const { rows } = await pool.query(
    `SELECT v.version_id, v.assessment_type_id, v.version_no, v.published_at, v.snapshot, u.username
       FROM assessment_versions v LEFT JOIN users u ON u.user_id = v.published_by
      WHERE v.version_id = $1 AND v.status = 'published'`,
    [versionId]
  );
  const v = rows[0];
  if (!v) return fail("ไม่พบเวอร์ชันนี้", 404);
  return NextResponse.json({
    success: true,
    version: { id: v.version_id, typeId: v.assessment_type_id, versionNo: v.version_no, at: v.published_at, by: v.username, snapshot: v.snapshot },
  });
}

// ฉบับเดิมของคำแนะนำ (trigger เก็บไว้ทุกครั้งที่แก้) ใหม่ → เก่า
async function recHistory(recId: number) {
  const { rows } = await pool.query(
    `SELECT h.history_id, h.risk_level, h.recommendation_text, h.reassess_days, h.hotline, h.source,
            h.min_score, h.max_score, h.valid_to, u.username
       FROM recommendation_history h LEFT JOIN users u ON u.user_id = h.updated_by
      WHERE h.rec_id = $1
      ORDER BY h.valid_to DESC LIMIT 30`,
    [recId]
  );
  return rows.map((r) => ({
    id: r.history_id,
    riskLevel: r.risk_level,
    text: r.recommendation_text ?? "",
    reassessDays: r.reassess_days,
    hotline: r.hotline ?? "",
    source: r.source ?? "",
    min: r.min_score === null ? null : Number(r.min_score),
    max: r.max_score === null ? null : Number(r.max_score),
    until: r.valid_to,
    by: r.username,
  }));
}

/* ---------- บันทึกฉบับร่าง ---------- */

// ดึงชื่อแบบประเมินและเช็กว่าเป็นแบบทั่วไป (generic) หรือไม่ (lock = ล็อกแถวไว้)
async function liveBase(db: Pick<typeof pool, "query">, typeId: number, lock = false) {
  const { rows } = await db.query(
    `SELECT t.assessment_name,
            NOT EXISTS (SELECT 1 FROM recommendation r WHERE r.assessment_type_id = t.assessment_type_id
                          AND (r.min_score IS NULL OR r.max_score IS NULL)) AS generic
       FROM assessment_types t WHERE t.assessment_type_id = $1 ${lock ? "FOR UPDATE OF t" : ""}`,
    [typeId]
  );
  return rows[0] ? { name: rows[0].assessment_name as string, generic: rows[0].generic as boolean } : null;
}

// PUT: ตรวจและบันทึก snapshot เป็นฉบับร่างของแบบประเมิน
export async function PUT(request: NextRequest) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => ({}));
  const typeId = Number(body.typeId);
  if (!typeId) return fail("ข้อมูลไม่ถูกต้อง");

  try {
    const base = await liveBase(pool, typeId);
    if (!base) return fail("ไม่พบแบบประเมิน", 404);
    const snap = normalizeSnapshot(body.snapshot, base);
    if (typeof snap === "string") return fail(snap);

    const staffId = auth.staff.userId;
    await pool.query(
      `INSERT INTO assessment_versions (assessment_type_id, status, snapshot, created_by, updated_by)
       VALUES ($1, 'draft', $2::jsonb, $3, $3)
       ON CONFLICT (assessment_type_id) WHERE status = 'draft'
       DO UPDATE SET snapshot = EXCLUDED.snapshot, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
      [typeId, JSON.stringify(snap), staffId]
    );
    await logAccess(staffId, null, "save_assessment_draft", `type ${typeId} · ${base.name}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    void logSystemError("PUT /api/staff/assessments", error);
    console.error("PUT /api/staff/assessments error:", error);
    return fail("บันทึกฉบับร่างไม่สำเร็จ", 500);
  }
}

/* ---------- เปิด/ปิดใช้งาน ---------- */

// PATCH: เปิด/ปิดใช้งานแบบประเมิน หรือย้ายหมวดหมู่ (ถ้าส่ง categoryId)
export async function PATCH(request: NextRequest) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const typeId = Number(body.typeId);
  if (typeId && "categoryId" in body) return changeCategory(typeId, body.categoryId, auth.staff.userId);
  if (!typeId || typeof body.isActive !== "boolean") return fail("ข้อมูลไม่ถูกต้อง");
  try {
    // เปิดใช้งานได้เมื่อมีคำถามและเกณฑ์แปลผลแล้ว
    if (body.isActive) {
      const { rows } = await pool.query(
        `SELECT (SELECT COUNT(*) FROM questions WHERE assessment_type_id = $1 AND is_active)::int AS q,
                (SELECT COUNT(*) FROM recommendation WHERE assessment_type_id = $1)::int AS r`,
        [typeId]
      );
      if (!rows[0].q || !rows[0].r) return fail("ต้องเผยแพร่คำถามและเกณฑ์แปลผลก่อนเปิดใช้งาน");
    }
    await pool.query("UPDATE assessment_types SET is_active = $2, updated_at = NOW() WHERE assessment_type_id = $1", [
      typeId,
      body.isActive,
    ]);
    await logAccess(auth.staff.userId, null, body.isActive ? "enable_assessment" : "disable_assessment", `type ${typeId}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    void logSystemError("PATCH /api/staff/assessments", error);
    console.error("PATCH /api/staff/assessments error:", error);
    return fail("บันทึกไม่สำเร็จ", 500);
  }
}

/* ---------- ย้ายหมวดหมู่ (มีผลทันที) ---------- */

// ย้ายแบบประเมินไปหมวดอื่น (แบบประเมินหลักของระบบย้ายไม่ได้)
async function changeCategory(typeId: number, rawCategoryId: unknown, staffId: number) {
  const categoryId = Number(rawCategoryId);
  if (!Number.isInteger(categoryId) || categoryId <= 0) return fail("กรุณาเลือกหมวดหมู่");
  try {
    const [t, c] = await Promise.all([
      pool.query("SELECT assessment_name, category_id FROM assessment_types WHERE assessment_type_id = $1", [typeId]),
      pool.query("SELECT name FROM assessment_categories WHERE category_id = $1", [categoryId]),
    ]);
    const type = t.rows[0];
    if (!type) return fail("ไม่พบแบบประเมิน", 404);
    if (!c.rows[0]) return fail("ไม่พบหมวดหมู่นี้", 404);
    // แบบประเมินหลักของระบบมีการ์ดเขียนไว้ในหน้าเมนูของหมวดเดิม ย้ายหมวดไม่ได้
    if (BUILT_IN.has(type.assessment_name)) return fail("แบบประเมินหลักของระบบย้ายหมวดหมู่ไม่ได้");
    if (type.category_id === categoryId) return NextResponse.json({ success: true });

    await pool.query("UPDATE assessment_types SET category_id = $2, updated_at = NOW() WHERE assessment_type_id = $1", [typeId, categoryId]);
    await logAccess(staffId, null, "change_assessment_category", `type ${typeId} · ${type.assessment_name} · หมวด ${c.rows[0].name}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    void logSystemError("PATCH category /api/staff/assessments", error);
    console.error("PATCH category /api/staff/assessments error:", error);
    return fail("ย้ายหมวดหมู่ไม่สำเร็จ", 500);
  }
}

/* ---------- สร้างใหม่ / ทิ้งฉบับร่าง / เผยแพร่ ---------- */

// POST: เผยแพร่ / ทิ้งฉบับร่าง ตาม action หรือสร้างแบบประเมินใหม่ (สร้างหมวดใหม่พร้อมกันได้)
export async function POST(request: NextRequest) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => ({}));
  if (body.action === "publish") return publish(Number(body.typeId), body.snapshot, auth.staff.userId);
  if (body.action === "discard") return discard(Number(body.typeId), auth.staff.userId);

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 500) : "";
  if (!name) return fail("กรุณากรอกชื่อแบบประเมิน");

  /* ===== หมวดหมู่: เลือกหมวดที่มีอยู่ หรือสร้างหมวดใหม่ (ต้องมีอย่างใดอย่างหนึ่ง) ===== */
  const nc = body.newCategory && typeof body.newCategory === "object" ? body.newCategory : null;
  const newCat = nc
    ? {
        name: typeof nc.name === "string" ? nc.name.trim() : "",
        subtitle: typeof nc.subtitle === "string" ? nc.subtitle.trim() : "",
        theme: nc.theme,
      }
    : null;
  const categoryId = newCat ? null : Number(body.categoryId);
  if (newCat) {
    if (!newCat.name) return fail("กรุณากรอกชื่อหมวดหมู่");
    if (newCat.name.length > CATEGORY_NAME_MAX) return fail(`ชื่อหมวดหมู่ยาวได้ไม่เกิน ${CATEGORY_NAME_MAX} ตัวอักษร`);
    if (newCat.subtitle.length > CATEGORY_SUBTITLE_MAX) return fail(`คำอธิบายสั้นยาวได้ไม่เกิน ${CATEGORY_SUBTITLE_MAX} ตัวอักษร`);
    if (!isCategoryTheme(newCat.theme)) return fail("กรุณาเลือกสีของหมวดหมู่");
  } else if (!Number.isInteger(categoryId) || !categoryId || categoryId <= 0) {
    return fail("กรุณาเลือกหมวดหมู่");
  }

  const staffId = auth.staff.userId;
  const client = await pool.connect();
  const refuse = async (message: string, status = 400) => {
    await client.query("ROLLBACK");
    return fail(message, status);
  };
  try {
    await client.query("BEGIN");
    const dup = await client.query("SELECT 1 FROM assessment_types WHERE LOWER(assessment_name) = LOWER($1)", [name]);
    if (dup.rowCount) return await refuse("มีแบบประเมินชื่อนี้แล้ว", 409);

    let catId: number;
    let catName: string;
    if (newCat) {
      const catDup = await client.query("SELECT 1 FROM assessment_categories WHERE LOWER(name) = LOWER($1)", [newCat.name]);
      if (catDup.rowCount) return await refuse("มีหมวดหมู่ชื่อนี้แล้ว เลือกจากรายการแทนได้", 409);
      const ins = await client.query(
        `INSERT INTO assessment_categories (name, subtitle, theme, route_path, is_builtin, display_order, created_by)
         SELECT $1, $2, $3, NULL, FALSE, GREATEST(COALESCE(MAX(display_order), 0), 100) + 1, $4 FROM assessment_categories
         RETURNING category_id, name`,
        [newCat.name, newCat.subtitle || null, newCat.theme, staffId]
      );
      catId = ins.rows[0].category_id;
      catName = ins.rows[0].name;
    } else {
      const c = await client.query("SELECT category_id, name FROM assessment_categories WHERE category_id = $1", [categoryId]);
      if (!c.rows[0]) return await refuse("ไม่พบหมวดหมู่ที่เลือก กรุณาเลือกใหม่", 404);
      catId = c.rows[0].category_id;
      catName = c.rows[0].name;
    }

    const { rows } = await client.query(
      `INSERT INTO assessment_types (assessment_name, description, is_active, category_id, created_at, updated_at)
       VALUES ($1, $2, FALSE, $3, NOW(), NOW()) RETURNING assessment_type_id`,
      [name, description || null, catId]
    );
    await client.query("COMMIT");

    if (newCat) await logAccess(staffId, null, "create_assessment_category", `category ${catId} · ${catName}`);
    await logAccess(staffId, null, "create_assessment", name);
    return NextResponse.json({ success: true, id: rows[0].assessment_type_id, categoryId: catId });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    // ชื่อหมวดชนกับที่เพิ่งสร้างพร้อมกัน (unique index LOWER(name))
    if ((error as { code?: string }).code === "23505") return fail("มีหมวดหมู่ชื่อนี้แล้ว เลือกจากรายการแทนได้", 409);
    void logSystemError("POST /api/staff/assessments", error);
    console.error("POST /api/staff/assessments error:", error);
    return fail("สร้างแบบประเมินไม่สำเร็จ", 500);
  } finally {
    client.release();
  }
}

// ลบฉบับร่างของแบบประเมิน และบันทึก access log
async function discard(typeId: number, staffId: number) {
  if (!typeId) return fail("ข้อมูลไม่ถูกต้อง");
  try {
    const r = await pool.query("DELETE FROM assessment_versions WHERE assessment_type_id = $1 AND status = 'draft'", [typeId]);
    if (r.rowCount) await logAccess(staffId, null, "discard_assessment_draft", `type ${typeId}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    void logSystemError("POST discard /api/staff/assessments", error);
    console.error("discard draft error:", error);
    return fail("ทิ้งฉบับร่างไม่สำเร็จ", 500);
  }
}

// เผยแพร่: เขียนเนื้อหาลงตารางจริงและสร้างเวอร์ชันใหม่ใน transaction เดียว
async function publish(typeId: number, rawSnapshot: unknown, staffId: number) {
  if (!typeId) return fail("ข้อมูลไม่ถูกต้อง");
  const client = await pool.connect();
  const refuse = async (message: string, status = 400) => {
    await client.query("ROLLBACK");
    return fail(message, status);
  };
  try {
    await client.query("BEGIN");
    // ล็อกแบบประเมินไว้ กันเผยแพร่ซ้อนกันจนเลขเวอร์ชันชน
    const base = await liveBase(client, typeId, true);
    if (!base) return await refuse("ไม่พบแบบประเมิน", 404);

    const draft = await client.query(
      "SELECT version_id, snapshot, created_by FROM assessment_versions WHERE assessment_type_id = $1 AND status = 'draft' FOR UPDATE",
      [typeId]
    );
    const source = rawSnapshot ?? draft.rows[0]?.snapshot;
    if (!source) return await refuse("ไม่มีฉบับร่างให้เผยแพร่");
    const snap = normalizeSnapshot(source, base);
    if (typeof snap === "string") return await refuse(snap);
    if ((source as Snapshot).generic !== undefined && (source as Snapshot).generic !== base.generic) {
      return await refuse("เกณฑ์แปลผลของแบบประเมินนี้เปลี่ยนไปแล้ว กรุณาทิ้งฉบับร่างแล้วแก้ไขใหม่", 409);
    }
    const invalid = validateForPublish(snap);
    if (invalid) return await refuse(invalid);

    const applyError = await applySnapshot(client, typeId, snap, staffId);
    if (applyError) return await refuse(applyError, 409);

    // snapshot ที่เก็บเป็นเวอร์ชัน = เนื้อหาจริงหลังเผยแพร่ (มี id ของคำถาม/ตัวเลือก/ระดับครบ)
    const published = await buildSnapshot(client, typeId);
    const latest = await client.query(
      `SELECT snapshot = $2::jsonb AS same FROM assessment_versions
        WHERE assessment_type_id = $1 AND status = 'published' ORDER BY version_no DESC LIMIT 1`,
      [typeId, JSON.stringify(published)]
    );
    if (latest.rows[0]?.same) return await refuse("ไม่มีการเปลี่ยนแปลงจากเวอร์ชันล่าสุด");

    const ver = await client.query(
      `INSERT INTO assessment_versions (assessment_type_id, version_no, status, snapshot, created_by, updated_by, published_by, published_at)
       SELECT $1, COALESCE(MAX(version_no), 0) + 1, 'published', $2::jsonb, $3, $4, $4, NOW()
         FROM assessment_versions WHERE assessment_type_id = $1 AND status = 'published'
       RETURNING version_no`,
      [typeId, JSON.stringify(published), draft.rows[0]?.created_by ?? staffId, staffId]
    );
    await client.query("DELETE FROM assessment_versions WHERE assessment_type_id = $1 AND status = 'draft'", [typeId]);
    await client.query("COMMIT");

    const no = ver.rows[0].version_no as number;
    await logAccess(staffId, null, "publish_assessment", `type ${typeId} · ${base.name} · v${no} · ${snap.questions.length} ข้อ`);
    return NextResponse.json({ success: true, versionNo: no });
  } catch (error) {
    void logSystemError("POST publish /api/staff/assessments", error);
    await client.query("ROLLBACK").catch(() => {});
    console.error("publish /api/staff/assessments error:", error);
    return fail("เผยแพร่ไม่สำเร็จ", 500);
  } finally {
    client.release();
  }
}

/* ---------- ลบแบบประเมิน ---------- */

// DELETE: ลบแบบประเมินที่สร้างใหม่และยังไม่มีใครทำ
export async function DELETE(request: NextRequest) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const typeId = Number(body.typeId);
  if (!typeId) return fail("ข้อมูลไม่ถูกต้อง");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // ล็อกแถวไว้ กันมีคนส่งแบบประเมินเข้ามาระหว่างลบ
    const t = await client.query("SELECT assessment_name FROM assessment_types WHERE assessment_type_id = $1 FOR UPDATE", [typeId]);
    const name: string | undefined = t.rows[0]?.assessment_name;
    const refuse = async (message: string, status = 400) => {
      await client.query("ROLLBACK");
      return fail(message, status);
    };

    if (!name) return refuse("ไม่พบแบบประเมิน", 404);
    if (String(body.confirmName ?? "").trim() !== name) return refuse("ชื่อที่พิมพ์ยืนยันไม่ตรงกับชื่อแบบประเมิน");
    if (BUILT_IN.has(name)) return refuse("แบบประเมินหลักของระบบลบไม่ได้");

    const legacy = await client.query(
      "SELECT 1 FROM recommendation WHERE assessment_type_id = $1 AND (min_score IS NULL OR max_score IS NULL) LIMIT 1",
      [typeId]
    );
    if (legacy.rowCount) return refuse("แบบประเมินนี้แปลผลด้วยสูตรในระบบ ลบไม่ได้");

    // ผลประเมินของผู้ใช้ในแบบนี้ถูกลบไปด้วย (หน้ายืนยันแจ้งจำนวนไว้แล้ว)
    // ลบตารางที่อ้างถึงก่อน: การแจ้งเตือน / เคสเดิม (notes ลบตาม cascade) / log แดชบอร์ด แล้วจึงลบผล (คำตอบลบตาม cascade)
    const used = await client.query("SELECT COUNT(*)::int AS n FROM assessment WHERE assessment_type_id = $1", [typeId]);
    const results: number = used.rows[0].n;
    await client.query("DELETE FROM user_notifications WHERE assessment_type_id = $1", [typeId]);
    await client.query("DELETE FROM follow_up_cases WHERE assessment_type_id = $1", [typeId]);
    await client.query(
      "DELETE FROM log_dashboard WHERE assessment_id IN (SELECT assessment_id FROM assessment WHERE assessment_type_id = $1)",
      [typeId]
    );
    await client.query("DELETE FROM assessment WHERE assessment_type_id = $1", [typeId]);
    await client.query("DELETE FROM recommendation_history WHERE assessment_type_id = $1", [typeId]);

    await client.query(
      "DELETE FROM question_choices WHERE question_id IN (SELECT question_id FROM questions WHERE assessment_type_id = $1)",
      [typeId]
    );
    await client.query("DELETE FROM questions WHERE assessment_type_id = $1", [typeId]);
    await client.query("DELETE FROM recommendation WHERE assessment_type_id = $1", [typeId]);
    await client.query("DELETE FROM assessment_versions WHERE assessment_type_id = $1", [typeId]);
    await client.query("DELETE FROM assessment_types WHERE assessment_type_id = $1", [typeId]);
    await client.query("COMMIT");

    await logAccess(auth.staff.userId, null, "delete_assessment", `type ${typeId} · ${name}${results ? ` · ลบผลประเมิน ${results} รายการ` : ""}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    void logSystemError("DELETE /api/staff/assessments", error);
    await client.query("ROLLBACK").catch(() => {});
    console.error("DELETE /api/staff/assessments error:", error);
    return fail("ลบแบบประเมินไม่สำเร็จ", 500);
  } finally {
    client.release();
  }
}

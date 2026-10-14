import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { logAccess, requireStaff } from "@/lib/staff/auth";
import { logSystemError } from "@/lib/errorLogger";
import { CATEGORY_NAME_MAX, CATEGORY_SUBTITLE_MAX, isCategoryTheme } from "@/lib/assessmentCategories";

// สร้าง JSON response แจ้งข้อผิดพลาดพร้อม status code
const fail = (message: string, status = 400) => NextResponse.json({ success: false, message }, { status });

// โหลดหมวดหมู่และตรวจว่าแก้ไขได้ (ไม่ใช่หมวดหลักของระบบ is_builtin)
async function loadEditable(categoryId: number) {
  const { rows } = await pool.query("SELECT category_id, name, is_builtin FROM assessment_categories WHERE category_id = $1", [categoryId]);
  const c = rows[0];
  if (!c) return { error: fail("ไม่พบหมวดหมู่นี้", 404) };
  if (c.is_builtin) return { error: fail("หมวดหลักของระบบแก้ไขหรือลบไม่ได้") };
  return { category: c as { category_id: number; name: string } };
}

// API (เจ้าหน้าที่): แก้ชื่อ คำอธิบาย และธีมของหมวดหมู่ โดยห้ามชื่อซ้ำ
export async function PATCH(request: NextRequest) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => ({}));

  const categoryId = Number(body.categoryId);
  const name = String(body.name ?? "").trim();
  // ตรวจข้อมูลที่ส่งมา: id ชื่อ คำอธิบาย และธีมสี
  const subtitle = String(body.subtitle ?? "").trim();
  const theme = body.theme;
  if (!Number.isInteger(categoryId) || categoryId <= 0) return fail("ไม่พบหมวดหมู่นี้");
  if (!name) return fail("กรุณาใส่ชื่อหมวดหมู่");
  if (name.length > CATEGORY_NAME_MAX) return fail(`ชื่อหมวดหมู่ยาวได้ไม่เกิน ${CATEGORY_NAME_MAX} ตัวอักษร`);
  if (subtitle.length > CATEGORY_SUBTITLE_MAX) return fail(`คำอธิบายสั้นยาวได้ไม่เกิน ${CATEGORY_SUBTITLE_MAX} ตัวอักษร`);
  if (!isCategoryTheme(theme)) return fail("สีของหมวดไม่ถูกต้อง");

  try {
    const found = await loadEditable(categoryId);
    if (found.error) return found.error;

    // ตรวจชื่อซ้ำ แล้วอัปเดตหมวดหมู่และบันทึก log
    const dup = await pool.query("SELECT 1 FROM assessment_categories WHERE LOWER(name) = LOWER($1) AND category_id <> $2", [name, categoryId]);
    if (dup.rowCount) return fail("มีหมวดหมู่ชื่อนี้แล้ว", 409);

    await pool.query("UPDATE assessment_categories SET name = $2, subtitle = $3, theme = $4 WHERE category_id = $1", [
      categoryId,
      name,
      subtitle || null,
      theme,
    ]);
    const renamed = found.category.name !== name ? ` (เดิม ${found.category.name})` : "";
    await logAccess(auth.staff.userId, null, "update_assessment_category", `category ${categoryId} · ${name}${renamed}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return fail("มีหมวดหมู่ชื่อนี้แล้ว", 409);
    void logSystemError("PATCH /api/staff/categories", error);
    console.error("PATCH /api/staff/categories error:", error);
    return fail("บันทึกหมวดหมู่ไม่สำเร็จ", 500);
  }
}

// API (เจ้าหน้าที่): ลบหมวดหมู่ และย้ายแบบประเมินในหมวดไปหมวดปลายทาง (moveTo) ถ้ากำหนด
export async function DELETE(request: NextRequest) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => ({}));

  const categoryId = Number(body.categoryId);
  const moveTo = body.moveTo === null || body.moveTo === undefined || body.moveTo === "" ? null : Number(body.moveTo);
  if (!Number.isInteger(categoryId) || categoryId <= 0) return fail("ไม่พบหมวดหมู่นี้");
  if (moveTo !== null && (!Number.isInteger(moveTo) || moveTo <= 0 || moveTo === categoryId)) return fail("หมวดปลายทางไม่ถูกต้อง");

  const client = await pool.connect();
  try {
    const found = await loadEditable(categoryId);
    if (found.error) return found.error;

    // ใน transaction: ตรวจหมวดปลายทาง ย้ายแบบประเมิน แล้วลบหมวดหมู่
    await client.query("BEGIN");
    let targetName = "ไม่มีหมวดหมู่";
    if (moveTo !== null) {
      const t = await client.query("SELECT name FROM assessment_categories WHERE category_id = $1", [moveTo]);
      if (!t.rowCount) {
        await client.query("ROLLBACK");
        return fail("ไม่พบหมวดปลายทาง", 404);
      }
      targetName = t.rows[0].name;
    }
    const moved = await client.query(
      "UPDATE assessment_types SET category_id = $2, updated_at = NOW() WHERE category_id = $1",
      [categoryId, moveTo]
    );
    await client.query("DELETE FROM assessment_categories WHERE category_id = $1", [categoryId]);
    await client.query("COMMIT");

    await logAccess(
      auth.staff.userId,
      null,
      "delete_assessment_category",
      `category ${categoryId} · ${found.category.name} · ย้าย ${moved.rowCount ?? 0} แบบประเมินไป ${targetName}`
    );
    return NextResponse.json({ success: true, moved: moved.rowCount ?? 0 });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    void logSystemError("DELETE /api/staff/categories", error);
    console.error("DELETE /api/staff/categories error:", error);
    return fail("ลบหมวดหมู่ไม่สำเร็จ", 500);
  } finally {
    client.release();
  }
}

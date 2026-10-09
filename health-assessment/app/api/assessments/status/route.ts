import pool from "@/lib/db";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { logSystemError } from "@/lib/errorLogger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   GET /api/assessments/status?typeId=...
   สถานะเปิด/ปิดของแบบประเมิน ใช้แสดงแจ้งเตือนในหน้าทำแบบประเมิน
========================================================= */

export async function GET(request: Request) {
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;

  const typeId = Number(new URL(request.url).searchParams.get("typeId"));

  if (!Number.isInteger(typeId) || typeId <= 0) {
    return NextResponse.json({ success: false, message: "typeId ไม่ถูกต้อง" }, { status: 400 });
  }

  try {
    const { rows } = await pool.query<{ is_active: boolean | null }>(
      "SELECT is_active FROM assessment_types WHERE assessment_type_id = $1",
      [typeId],
    );

    if (!rows[0]) {
      return NextResponse.json({ success: false, message: "ไม่พบแบบประเมิน" }, { status: 404 });
    }

    return NextResponse.json({ success: true, isActive: rows[0].is_active !== false });
  } catch (error) {
    void logSystemError("GET /api/assessments/status", error);
    console.error("GET ASSESSMENT STATUS ERROR:", error);
    return NextResponse.json({ success: false, message: "ไม่สามารถตรวจสอบสถานะแบบประเมินได้" }, { status: 500 });
  }
}

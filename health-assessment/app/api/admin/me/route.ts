import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, serverError } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   GET /api/admin/me
   ใช้ตอนเปิดหน้า /admin เพื่อตรวจสิทธิ์จาก session cookie
   - เป็น admin → 200 { success, admin: { user_id, username } }
   - ไม่มี session → 401, ไม่ใช่ admin → 403
========================================================= */

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    return NextResponse.json({ success: true, admin: auth.admin });
  } catch (error) {
    console.error("ADMIN ME ERROR:", error);
    return serverError("ตรวจสิทธิ์ไม่สำเร็จ", error);
  }
}

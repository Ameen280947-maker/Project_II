import { NextRequest, NextResponse } from "next/server";
import { getSession, roleFromRequest } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   GET /api/auth/session?role=user|staff|admin
   ตรวจว่ายังมี session ของ role นั้นที่ใช้ได้อยู่หรือไม่ (ค่าเริ่มต้น user)
   - มี   → 200 { success, user: { user_id, role_id } }
   - ไม่มี → 401
========================================================= */

export async function GET(request: NextRequest) {
  const session = getSession(request, roleFromRequest(request));

  if (!session) {
    return NextResponse.json(
      { success: false, message: "กรุณาเข้าสู่ระบบใหม่" },
      { status: 401 },
    );
  }

  return NextResponse.json({
    success: true,
    user: {
      user_id: session.userId,
      role_id: session.roleId,
    },
  });
}

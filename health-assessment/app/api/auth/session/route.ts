import { NextRequest, NextResponse } from "next/server";
import { getSession, roleFromRequest } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// API: คืนข้อมูลผู้ใช้จาก session cookie ปัจจุบัน หรือ 401 ถ้ายังไม่เข้าสู่ระบบ
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

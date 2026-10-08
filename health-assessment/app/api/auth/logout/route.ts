import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, roleFromRequest } from "@/lib/session";

export const runtime = "nodejs";

/* =========================================================
   POST /api/auth/logout?role=user|staff|admin
   ลบ session cookie ของ role นั้นเท่านั้น (ค่าเริ่มต้น user)
   role อื่นที่เปิดอยู่ในแท็บอื่นยังใช้งานต่อได้
========================================================= */

export async function POST(request: NextRequest) {
  const response = NextResponse.json({
    success: true,
    message: "ออกจากระบบแล้ว",
  });

  clearSessionCookie(response, roleFromRequest(request));

  return response;
}

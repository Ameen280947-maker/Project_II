import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session";

export const runtime = "nodejs";

/* =========================================================
   POST /api/auth/logout
   ลบ session cookie ฝั่ง server
========================================================= */

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: "ออกจากระบบแล้ว",
  });

  clearSessionCookie(response);

  return response;
}

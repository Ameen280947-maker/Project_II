import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, roleFromRequest } from "@/lib/session";

export const runtime = "nodejs";

// API: ออกจากระบบโดยลบ session cookie ตามบทบาทของคำขอ
export async function POST(request: NextRequest) {
  const response = NextResponse.json({
    success: true,
    message: "ออกจากระบบแล้ว",
  });

  clearSessionCookie(response, roleFromRequest(request));

  return response;
}

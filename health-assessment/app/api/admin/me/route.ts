import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, serverError } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// API: ตรวจสิทธิ์ Admin ของผู้ที่ล็อกอินอยู่ และคืนข้อมูลผู้ดูแล
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

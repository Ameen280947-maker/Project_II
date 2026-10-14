import { NextRequest, NextResponse } from "next/server";
import { listPublicCategories } from "@/lib/assessmentCategoriesDb";
import { logSystemError } from "@/lib/errorLogger";

// API: คืนหมวดหมู่แบบประเมินที่เปิดใช้งานทั้งหมด หรือเฉพาะหมวดเดียวถ้าระบุ id
export async function GET(request: NextRequest) {
  const idParam = new URL(request.url).searchParams.get("id");
  try {
    const data = await listPublicCategories();
    if (idParam === null) return NextResponse.json({ success: true, ...data });

    const id = Number(idParam);
    const category = Number.isInteger(id) ? data.categories.find((c) => c.id === id) : undefined;
    if (!category) {
      return NextResponse.json({ success: false, message: "ไม่พบหมวดหมู่นี้ หรือยังไม่มีแบบประเมินที่เปิดใช้งาน" }, { status: 404 });
    }
    return NextResponse.json({ success: true, category });
  } catch (error) {
    void logSystemError("GET /api/assessments/categories", error);
    console.error("GET /api/assessments/categories error:", error);
    return NextResponse.json({ success: false, message: "ไม่สามารถโหลดหมวดหมู่แบบประเมินได้" }, { status: 500 });
  }
}

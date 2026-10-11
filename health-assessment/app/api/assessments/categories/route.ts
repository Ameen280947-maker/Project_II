import { NextRequest, NextResponse } from "next/server";
import { listPublicCategories } from "@/lib/assessmentCategoriesDb";
import { logSystemError } from "@/lib/errorLogger";

/* =========================================================
   /api/assessments/categories  (ไม่ต้องเข้าสู่ระบบ เหมือน GET /api/assessments/custom)
   GET          → { categories: [...หมวด + แบบประเมินที่เปิดใช้งาน], uncategorized: [...] }
   GET ?id=<id> → { category } ของหมวดเดียว (ไม่มีจริง / หมวดที่ staff สร้างแต่ไม่มีแบบประเมินที่เปิดใช้งาน = 404)
   - แสดงเฉพาะแบบประเมินที่เปิดใช้งาน หมวดที่ staff สร้างแต่ยังว่างจะไม่ถูกส่งออกไป
========================================================= */

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

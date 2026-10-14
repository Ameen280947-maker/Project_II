"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ClipboardList } from "lucide-react";

import Sidebar from "@/app/components/Sidebar";
import NotificationBell from "@/app/components/NotificationBell";
import AssessmentMenuCard from "@/app/components/AssessmentMenuCard";
import { THEME_INFO, cardToneFor, type AssessmentCategory } from "@/lib/assessmentCategories";

// ข้อความเมื่อไม่พบหมวดหมู่หรือไม่มีแบบประเมินที่เปิดใช้
const NOT_FOUND_TEXT = "ไม่พบหมวดหมู่นี้ หรือยังไม่มีแบบประเมินที่เปิดใช้งาน";

// หน้า: แสดงแบบประเมินในหมวดหมู่ตาม id (ดึงจาก /api/assessments/categories หรือ redirect ถ้ามี routePath)
export default function AssessmentCategoryPage() {
  // state ของหน้า: id หมวดหมู่ ข้อมูลหมวด และข้อความ error
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);
  const validId = Number.isInteger(id) && id > 0;
  const [category, setCategory] = useState<AssessmentCategory | null>(null);
  const [error, setError] = useState(validId ? "" : NOT_FOUND_TEXT);

  // โหลดข้อมูลหมวดหมู่จาก API ตอนเปิดหน้า (มี routePath → redirect ไปหน้าเฉพาะ)
  useEffect(() => {
    if (!validId) return;
    fetch(`/api/assessments/categories?id=${id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { success: boolean; category?: AssessmentCategory; message?: string }) => {
        if (!d.success || !d.category) return setError(d.message || NOT_FOUND_TEXT);
        if (d.category.routePath) return router.replace(d.category.routePath);
        if (d.category.assessments.length === 0) return setError(NOT_FOUND_TEXT);
        setCategory(d.category);
      })
      .catch(() => setError("โหลดหมวดหมู่ไม่สำเร็จ"));
  }, [id, validId, router]);

  const theme = THEME_INFO[category?.theme ?? "red"];

  return (
    <main className="min-h-screen bg-[#fbf9f9] text-[#2f3037]">
      <div className="flex min-h-screen">

        <Sidebar />

        <section className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-12">

          {/* ส่วนหัว: ชื่อหมวดหมู่และกระดิ่งแจ้งเตือน */}
          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className={`text-sm font-bold uppercase tracking-[0.18em] ${theme.eyebrow}`}>
                Health Assessment
              </p>

              <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl lg:text-[44px]">
                Assessment-
                <span className={theme.accent}>
                  {category?.name ?? (error ? "ไม่พบหมวดหมู่" : "")}
                </span>
              </h1>

              {category?.subtitle && (
                <p className={`mt-2 text-xl font-bold ${theme.accent}`}>{category.subtitle}</p>
              )}

            </div>

            <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
              <NotificationBell />
            </div>
          </header>

          {/* เนื้อหา: error / กำลังโหลด / การ์ดแบบประเมินในหมวด */}
          {error ? (
            <div className="mt-8 grid min-h-[40vh] place-items-center rounded-[28px] border border-[#eee8e9] bg-white px-6 text-center">
              <div>
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#fff0f2] text-[#b91c2b]">
                  <ClipboardList size={26} />
                </span>
                <p className="mt-4 text-lg font-semibold">{error}</p>
                <Link href="/assessment-type" className="mt-3 inline-block font-semibold text-[#b91c2b] hover:underline">
                  กลับไปเลือกแบบประเมิน
                </Link>
              </div>
            </div>
          ) : !category ? (
            <div className="grid min-h-[40vh] place-items-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#f1e9ea] border-t-[#b91c2b]" role="status" aria-label="กำลังโหลด" />
            </div>
          ) : (
            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              {category.assessments.map((a) => (
                <AssessmentMenuCard key={a.id} title={a.name} href={`/assessment/${a.id}`} icon={ClipboardList} tone={cardToneFor(a.id)} />
              ))}
            </div>
          )}

          {/* ปุ่มย้อนกลับไปหน้าเลือกประเภทแบบประเมิน */}
          <div className="mt-8 flex justify-end">

            <Link
              href="/assessment-type"
              className={`flex items-center gap-2 rounded-full px-5 py-3 font-semibold transition ${theme.back}`}
            >
              <ArrowLeft
                size={19}
              />

              ย้อนกลับ
            </Link>

          </div>

        </section>

      </div>
    </main>
  );
}

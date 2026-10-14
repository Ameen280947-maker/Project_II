"use client";

import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import AssessmentMenuCard from "@/app/components/AssessmentMenuCard";
import { cardToneFor, type AssessmentCategory, type CategoryAssessment } from "@/lib/assessmentCategories";

// ดึงแบบประเมินเพิ่มเติมของหมวดตาม routePath จาก API categories แล้วแสดงเป็นการ์ดเมนู
export default function CategoryAssessmentCards({ routePath }: { routePath: string }) {
  // state เก็บแบบประเมินที่ผู้ดูแลเพิ่มไว้ในหมวดนี้
  const [items, setItems] = useState<CategoryAssessment[]>([]);

  // โหลดหมวดทั้งหมดแล้วเลือกเฉพาะหมวดที่ตรงกับ routePath
  useEffect(() => {
    fetch("/api/assessments/categories", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { success: boolean; categories?: AssessmentCategory[] }) => {
        if (!d.success) return;
        setItems(d.categories?.find((c) => c.routePath === routePath)?.assessments ?? []);
      })
      .catch(() => {});
  }, [routePath]);

  return (
    <>
      {/* การ์ดเมนูของแต่ละแบบประเมิน ลิงก์ไป /assessment/[id] */}
      {items.map((a) => (
        <AssessmentMenuCard key={a.id} title={a.name} href={`/assessment/${a.id}`} icon={ClipboardList} tone={cardToneFor(a.id)} />
      ))}
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import AssessmentMenuCard from "@/app/components/AssessmentMenuCard";
import { cardToneFor, type AssessmentCategory, type CategoryAssessment } from "@/lib/assessmentCategories";

/* =========================================================
   การ์ดแบบประเมินที่เจ้าหน้าที่สร้างเพิ่มในหมวดเดิม
   - ใส่ไว้ใน grid ของหน้าเมนูหมวดเดิม ต่อท้ายการ์ดที่เขียนไว้ในโค้ด
   - หาหมวดจาก route_path ของหน้านั้น (เช่น /assessment-menu)
========================================================= */

export default function CategoryAssessmentCards({ routePath }: { routePath: string }) {
  const [items, setItems] = useState<CategoryAssessment[]>([]);

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
      {items.map((a) => (
        <AssessmentMenuCard key={a.id} title={a.name} href={`/assessment/${a.id}`} icon={ClipboardList} tone={cardToneFor(a.id)} />
      ))}
    </>
  );
}

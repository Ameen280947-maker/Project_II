"use client";

import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";

// โครงข้อมูลแหล่งอ้างอิงที่ได้จาก API (แบบประเมิน/คำแนะนำ)
type Sources = { assessmentSource?: string | null; recommendationSource?: string | null };

// Hook: ดึงแหล่งอ้างอิงของแบบประเมิน/คำแนะนำจาก API /api/assessments/sources ตาม query ที่ส่งมา
function useSources(query: string | null) {
  // state เก็บผลลัพธ์พร้อม query ที่ใช้ดึง เพื่อกันแสดงข้อมูลของ query เก่า
  const [data, setData] = useState<{ query: string; sources: Sources } | null>(null);

  // ดึงแหล่งอ้างอิงใหม่ทุกครั้งที่ query เปลี่ยน และยกเลิกผลถ้า component ถูก unmount
  useEffect(() => {
    if (!query) return;
    let cancelled = false;
    fetch(`/api/assessments/sources?${query}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (!cancelled && d?.success) setData({ query, sources: d });
      })
      .catch((error) => console.error("Load assessment sources error:", error));
    return () => {
      cancelled = true;
    };
  }, [query]);

  return data?.query === query ? data.sources : null;
}

// แสดงข้อความแหล่งอ้างอิงของแบบประเมินตาม typeId (ใช้ในหน้าทำแบบประเมิน)
export function AssessmentSourceNote({ typeId, className = "" }: { typeId: number | null | undefined; className?: string }) {
  const sources = useSources(typeId ? `typeId=${typeId}` : null);
  if (!sources?.assessmentSource) return null;

  return (
    <p className={`flex items-start gap-1.5 text-xs leading-5 text-[#858791] ${className}`}>
      <BookOpen size={14} className="mt-0.5 shrink-0" />
      <span>แบบประเมินนี้อ้างอิงจาก: {sources.assessmentSource}</span>
    </p>
  );
}

// แสดงแหล่งอ้างอิงของคำแนะนำและแบบประเมินในหน้าผลลัพธ์ตาม assessmentId
export function ResultSources({ assessmentId, className = "" }: { assessmentId: string | number | null | undefined; className?: string }) {
  const sources = useSources(assessmentId ? `assessmentId=${assessmentId}` : null);
  if (!sources || (!sources.recommendationSource && !sources.assessmentSource)) return null;

  return (
    <div className={`flex items-start gap-1.5 text-xs leading-5 text-[#858791] ${className}`}>
      <BookOpen size={14} className="mt-0.5 shrink-0" />
      <div>
        {sources.recommendationSource && <p>อ้างอิงคำแนะนำ: {sources.recommendationSource}</p>}
        {sources.assessmentSource && <p>แหล่งอ้างอิงแบบประเมิน: {sources.assessmentSource}</p>}
      </div>
    </div>
  );
}

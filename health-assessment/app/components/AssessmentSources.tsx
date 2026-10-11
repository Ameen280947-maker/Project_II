"use client";

import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";

/* =========================================================
   แหล่งอ้างอิงที่เจ้าหน้าที่กรอกในหน้า staff
   - AssessmentSourceNote : หน้าทำแบบประเมิน (แหล่งอ้างอิงของแบบประเมิน)
   - ResultSources        : หน้าผล (แหล่งอ้างอิงคำแนะนำ + ของแบบประเมิน)
   ไม่ได้กรอกไว้ = ไม่แสดงอะไร
========================================================= */

type Sources = { assessmentSource?: string | null; recommendationSource?: string | null };

function useSources(query: string | null) {
  const [data, setData] = useState<{ query: string; sources: Sources } | null>(null);

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

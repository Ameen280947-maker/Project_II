import type { ReactNode } from "react";
import AssessmentClosedNotice from "@/app/components/AssessmentClosedNotice";

// เลย์เอาต์: ครอบหน้า BMI และแสดงประกาศเมื่อแบบประเมิน (typeId 1) ถูกปิด
export default function AssessmentBmiLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AssessmentClosedNotice typeId={1} />
    </>
  );
}

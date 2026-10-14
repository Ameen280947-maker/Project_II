import type { ReactNode } from "react";
import AssessmentClosedNotice from "@/app/components/AssessmentClosedNotice";

// เลย์เอาต์: ครอบหน้าประเมินการนอนและแสดงประกาศถ้าแบบประเมิน (typeId 9) ถูกปิด
export default function SleepAssessmentLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AssessmentClosedNotice typeId={9} />
    </>
  );
}

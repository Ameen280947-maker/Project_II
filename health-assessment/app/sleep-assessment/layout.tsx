import type { ReactNode } from "react";
import AssessmentClosedNotice from "@/app/components/AssessmentClosedNotice";

// แบบประเมินการนอนหลับ (assessment_type_id = 9) แจ้งผู้ใช้เมื่อ staff ปิดแบบประเมินนี้อยู่
export default function SleepAssessmentLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AssessmentClosedNotice typeId={9} />
    </>
  );
}

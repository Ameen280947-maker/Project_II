import type { ReactNode } from "react";
import AssessmentClosedNotice from "@/app/components/AssessmentClosedNotice";

// แบบประเมินความเครียด (assessment_type_id = 12) แจ้งผู้ใช้เมื่อ staff ปิดแบบประเมินนี้อยู่
export default function AssessmentStressLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AssessmentClosedNotice typeId={12} />
    </>
  );
}

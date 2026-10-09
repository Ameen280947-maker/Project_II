import type { ReactNode } from "react";
import AssessmentClosedNotice from "@/app/components/AssessmentClosedNotice";

// แบบประเมินเบาหวาน (assessment_type_id = 4) แจ้งผู้ใช้เมื่อ staff ปิดแบบประเมินนี้อยู่
export default function AssessmentDiabetesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AssessmentClosedNotice typeId={4} />
    </>
  );
}

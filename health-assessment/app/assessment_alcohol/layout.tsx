import type { ReactNode } from "react";
import AssessmentClosedNotice from "@/app/components/AssessmentClosedNotice";

// แบบประเมินแอลกอฮอล์ (assessment_type_id = 7) แจ้งผู้ใช้เมื่อ staff ปิดแบบประเมินนี้อยู่
export default function AssessmentAlcoholLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AssessmentClosedNotice typeId={7} />
    </>
  );
}

import type { ReactNode } from "react";
import AssessmentClosedNotice from "@/app/components/AssessmentClosedNotice";

// แบบประเมินอาหาร (assessment_type_id = 10) แจ้งผู้ใช้เมื่อ staff ปิดแบบประเมินนี้อยู่
export default function AssessmentDietLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AssessmentClosedNotice typeId={10} />
    </>
  );
}

import type { ReactNode } from "react";
import AssessmentClosedNotice from "@/app/components/AssessmentClosedNotice";

// แบบประเมิน2Q (assessment_type_id = 13) แจ้งผู้ใช้เมื่อ staff ปิดแบบประเมินนี้อยู่
export default function AssessmentDepression2qLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AssessmentClosedNotice typeId={13} />
    </>
  );
}

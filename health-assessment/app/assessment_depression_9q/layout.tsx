import type { ReactNode } from "react";
import AssessmentClosedNotice from "@/app/components/AssessmentClosedNotice";

// เลย์เอาต์: ห่อหน้าประเมินซึมเศร้า 9Q และแสดงประกาศเมื่อแบบประเมินถูกปิด
export default function AssessmentDepression9qLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AssessmentClosedNotice typeId={14} />
    </>
  );
}

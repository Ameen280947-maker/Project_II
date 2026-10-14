import type { ReactNode } from "react";
import AssessmentClosedNotice from "@/app/components/AssessmentClosedNotice";

// เลย์เอาต์: ห่อหน้าประเมินความเครียดและแสดงประกาศเมื่อแบบประเมินถูกปิด
export default function AssessmentStressLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AssessmentClosedNotice typeId={12} />
    </>
  );
}

import type { ReactNode } from "react";
import AssessmentClosedNotice from "@/app/components/AssessmentClosedNotice";

// เลย์เอาต์: ห่อหน้าประเมินความเสี่ยงเบาหวานและแสดงประกาศเมื่อแบบประเมินถูกปิด
export default function AssessmentDiabetesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AssessmentClosedNotice typeId={4} />
    </>
  );
}

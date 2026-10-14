import type { ReactNode } from "react";
import AssessmentClosedNotice from "@/app/components/AssessmentClosedNotice";

// เลย์เอาต์: ห่อหน้าประเมินความเสี่ยงโรคหัวใจ (Thai CVD) และแสดงประกาศเมื่อแบบประเมินถูกปิด
export default function AssessmentCvdLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AssessmentClosedNotice typeId={3} />
    </>
  );
}

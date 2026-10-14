import type { ReactNode } from "react";
import AssessmentClosedNotice from "@/app/components/AssessmentClosedNotice";

// เลย์เอาต์: ห่อหน้าประเมินพฤติกรรมการกินและแสดงประกาศเมื่อแบบประเมินถูกปิด
export default function AssessmentDietLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AssessmentClosedNotice typeId={10} />
    </>
  );
}

import type { ReactNode } from "react";
import AssessmentClosedNotice from "@/app/components/AssessmentClosedNotice";

// เลย์เอาต์: ห่อหน้าประเมินความดันโลหิตและแสดงประกาศเมื่อแบบประเมินถูกปิด
export default function AssessmentDbLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AssessmentClosedNotice typeId={2} />
    </>
  );
}

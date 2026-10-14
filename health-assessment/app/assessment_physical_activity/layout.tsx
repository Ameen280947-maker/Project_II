import type { ReactNode } from "react";
import AssessmentClosedNotice from "@/app/components/AssessmentClosedNotice";

// เลย์เอาต์: ห่อหน้าประเมินกิจกรรมทางกายและแสดงประกาศเมื่อแบบประเมินถูกปิด
export default function AssessmentPhysicalActivityLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AssessmentClosedNotice typeId={8} />
    </>
  );
}

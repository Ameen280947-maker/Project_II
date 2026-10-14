import type { ReactNode } from "react";
import AssessmentClosedNotice from "@/app/components/AssessmentClosedNotice";

// เลย์เอาต์: ห่อหน้าประเมินการสูบบุหรี่และแสดงประกาศเมื่อแบบประเมินถูกปิด
export default function AssessmentSmokingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AssessmentClosedNotice typeId={6} />
    </>
  );
}

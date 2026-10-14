import type { ReactNode } from "react";
import AssessmentClosedNotice from "@/app/components/AssessmentClosedNotice";

// เลย์เอาต์: ห่อหน้าประเมินการดื่มแอลกอฮอล์และแสดงประกาศเมื่อแบบประเมินถูกปิด
export default function AssessmentAlcoholLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AssessmentClosedNotice typeId={7} />
    </>
  );
}

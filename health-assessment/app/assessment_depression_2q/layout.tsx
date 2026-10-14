import type { ReactNode } from "react";
import AssessmentClosedNotice from "@/app/components/AssessmentClosedNotice";

// เลย์เอาต์: ห่อหน้าคัดกรองซึมเศร้า 2Q และแสดงประกาศเมื่อแบบประเมินถูกปิด
export default function AssessmentDepression2qLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AssessmentClosedNotice typeId={13} />
    </>
  );
}

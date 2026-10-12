import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Health Risk Assessment",
  description: "ระบบประเมินความเสี่ยงสุขภาพ",
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

// เลย์เอาต์หลักของทั้งแอป กำหนดภาษาไทยและโหลด CSS ส่วนกลาง
export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
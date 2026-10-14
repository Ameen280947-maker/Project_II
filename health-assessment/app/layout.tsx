import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

// metadata ของเว็บ (title/description ที่แสดงบนแท็บเบราว์เซอร์)
export const metadata: Metadata = {
  title: "Health Risk Assessment",
  description: "ระบบประเมินความเสี่ยงสุขภาพ",
};

// props ของ RootLayout: หน้าลูกที่จะถูกครอบ
type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

// Layout หลักของทั้งแอป: กำหนดภาษา th และโหลด globals.css
export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
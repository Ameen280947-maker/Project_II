import { redirect } from "next/navigation";

// หน้าแรก: redirect ไปหน้า /welcome ทันที
export default function HomePage() {
  redirect("/welcome");
}
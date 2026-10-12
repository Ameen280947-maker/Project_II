import { redirect } from "next/navigation";

// หน้าแรกของเว็บ ส่งต่อไปหน้า /welcome ทันที
export default function HomePage() {
  redirect("/welcome");
}
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  HeartPulse,
  LogIn,
  ShieldCheck,
  UserPlus,
  UsersRound,
} from "lucide-react";

const healthItems = [
  {
    icon: ShieldCheck,
    position: "left-[10%] top-[8%]",
  },
  {
    icon: ClipboardCheck,
    position: "right-[7%] top-[10%]",
  },
  {
    icon: UsersRound,
    position: "left-0 top-[42%]",
  },
  {
    icon: Activity,
    position: "right-0 top-[43%]",
  },
  {
    icon: BarChart3,
    position: "bottom-[5%] left-[13%]",
  },
  {
    icon: HeartPulse,
    position: "bottom-[7%] right-[12%]",
  },
];

export default function WelcomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#fbf7f7] text-[#2f3037]">
      {/* พื้นหลังตกแต่ง */}
      <div className="pointer-events-none absolute -right-48 -top-48 h-[520px] w-[520px] rounded-full bg-[#f4dfe2]/60 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-72 -left-40 h-[650px] w-[800px] rounded-full bg-[#f1dadd]/55 blur-3xl" />

      <div className="pointer-events-none absolute right-10 top-10 grid grid-cols-6 gap-2 opacity-35">
        {Array.from({ length: 30 }).map((_, index) => (
          <span
            key={index}
            className="h-1 w-1 rounded-full bg-[#a99699]"
          />
        ))}
      </div>

      <section className="relative mx-auto grid min-h-screen max-w-[1500px] items-center gap-12 px-6 py-10 sm:px-10 lg:grid-cols-2 lg:px-16 xl:px-24">
        {/* ฝั่งข้อความ */}
        <div className="relative z-10">
          <div className="mb-12 flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-[22px] bg-gradient-to-br from-[#b91c2b] to-[#8a1420] text-white shadow-[0_14px_35px_rgba(138,20,32,0.25)]">
              <HeartPulse size={34} />
            </div>

            <div>
              <p className="text-lg font-bold sm:text-xl">
                ระบบประเมินความเสี่ยงสุขภาพ
              </p>

              <p className="mt-1 text-xs font-semibold tracking-[0.12em] text-[#85858d]">
                HEALTH RISK ASSESSMENT SYSTEM
              </p>
            </div>
          </div>

          <p className="mb-4 text-sm font-bold uppercase tracking-[0.22em] text-[#b91c2b]">
            Your health, your future
          </p>

          <h1 className="text-[54px] font-black leading-none tracking-[-0.05em] sm:text-[72px] xl:text-[82px]">
            <span className="text-[#37383f]">WEL</span>
            <span className="text-[#b91c2b]">COME</span>
          </h1>

          <h2 className="mt-7 text-2xl font-bold leading-relaxed sm:text-[31px]">
            ประเมินความเสี่ยงสุขภาพ
            <span className="block text-[#b91c2b]">
              เพื่ออนาคตที่ดีกว่า
            </span>
          </h2>

          <div className="my-7 flex max-w-[300px] items-center gap-3">
            <span className="h-px flex-1 bg-[#ddb5ba]" />
            <HeartPulse size={20} className="text-[#b91c2b]" />
            <span className="h-px flex-1 bg-[#ddb5ba]" />
          </div>

          <p className="max-w-[520px] text-base leading-8 text-[#6d6e76]">
            ประเมินความเสี่ยงด้านสุขภาพของคุณได้อย่างสะดวก
            พร้อมติดตามผลและรับคำแนะนำที่เหมาะสม
            เพื่อเริ่มต้นดูแลตัวเองตั้งแต่วันนี้
          </p>

          <div className="mt-10 flex max-w-[520px] flex-col gap-4 sm:flex-row">
            <Link
              href="/login"
              className="flex min-h-14 flex-1 items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#b91c2b] to-[#8a1420] px-7 py-4 font-bold text-white shadow-[0_14px_32px_rgba(138,20,32,0.28)] transition hover:-translate-y-0.5"
            >
              <LogIn size={21} />
              เข้าสู่ระบบ
              <ArrowRight size={19} />
            </Link>

            <Link
              href="/register"
              className="flex min-h-14 flex-1 items-center justify-center gap-3 rounded-2xl border border-[#ead9db] bg-white px-7 py-4 font-bold text-[#8a1420] shadow-[0_10px_28px_rgba(47,48,55,0.06)] transition hover:-translate-y-0.5 hover:bg-[#fff9fa]"
            >
              <UserPlus size={21} />
              สมัครสมาชิก
            </Link>
          </div>

          <p className="mt-7 text-xs leading-6 text-[#98989f]">
            ข้อมูลของคุณจะถูกจัดเก็บอย่างปลอดภัย
            และใช้สำหรับการประเมินสุขภาพเท่านั้น
          </p>
        </div>

        {/* ฝั่งภาพประกอบ */}
        <div className="relative hidden min-h-[610px] items-center justify-center lg:flex">
          <div className="absolute h-[540px] w-[540px] rounded-full border border-dashed border-[#ddb5ba]" />
          <div className="absolute h-[430px] w-[430px] rounded-full border border-[#ead9db]" />
          <div className="absolute h-[330px] w-[330px] rounded-full bg-white/50 shadow-[0_30px_90px_rgba(138,20,32,0.08)]" />

          <div className="relative z-10 grid h-[205px] w-[205px] place-items-center rounded-full bg-white shadow-[0_30px_70px_rgba(138,20,32,0.2)]">
            <div className="grid h-[150px] w-[150px] place-items-center rounded-full bg-[#f8e8ea] text-[#b91c2b]">
              <HeartPulse size={82} strokeWidth={1.6} />
            </div>
          </div>

          {healthItems.map(({ icon: Icon, position }, index) => (
            <div
              key={index}
              className={`absolute grid h-[90px] w-[90px] place-items-center rounded-full border border-white bg-white text-[#b91c2b] shadow-[0_16px_40px_rgba(138,20,32,0.12)] ${position}`}
            >
              <Icon size={37} strokeWidth={1.8} />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
import nodemailer from "nodemailer";

// อายุของรหัส OTP (นาที)
export const OTP_VALID_MINUTES = 10;

// ตรวจว่าตั้งค่า GMAIL_USER และ GMAIL_APP_PASSWORD สำหรับส่งอีเมลแล้วหรือยัง
export function isMailerConfigured() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

// ตัวส่งอีเมลที่สร้างไว้แล้ว (สร้างครั้งแรกที่ใช้)
let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

// สร้าง (ครั้งเดียว) และคืนตัวส่งอีเมล nodemailer ผ่าน Gmail
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, ""),
      },
    });
  }
  return transporter;
}

// ส่งอีเมลรหัส OTP สำหรับตั้งรหัสผ่านใหม่ (ทั้งแบบข้อความและ HTML)
export async function sendOtpEmail(to: string, otp: string) {
  if (!isMailerConfigured()) {
    throw new Error("ยังไม่ได้ตั้งค่า GMAIL_USER / GMAIL_APP_PASSWORD ใน .env.local");
  }

  // เนื้อหาอีเมล: หัวเรื่อง ข้อความธรรมดา และ HTML
  const subject = `รหัส OTP สำหรับตั้งรหัสผ่านใหม่: ${otp}`;

  const text = [
    "สวัสดีค่ะ",
    "",
    "เราได้รับคำขอตั้งรหัสผ่านใหม่สำหรับบัญชีระบบประเมินความเสี่ยงสุขภาพของคุณ",
    "",
    `รหัส OTP ของคุณคือ: ${otp}`,
    `รหัสนี้ใช้ได้ภายใน ${OTP_VALID_MINUTES} นาที และใช้ได้ครั้งเดียว`,
    "",
    "หากคุณไม่ได้ขอตั้งรหัสผ่านใหม่ ไม่ต้องดำเนินการใด ๆ บัญชีของคุณยังปลอดภัย",
    "ห้ามบอกรหัสนี้กับผู้อื่น รวมถึงเจ้าหน้าที่",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #2f3037;">
      <h2 style="color: #b91c2b;">ตั้งรหัสผ่านใหม่</h2>
      <p>เราได้รับคำขอตั้งรหัสผ่านใหม่สำหรับบัญชีระบบประเมินความเสี่ยงสุขภาพของคุณ</p>
      <p>รหัส OTP ของคุณคือ</p>
      <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #b91c2b; margin: 16px 0;">${otp}</p>
      <p>รหัสนี้ใช้ได้ภายใน <b>${OTP_VALID_MINUTES} นาที</b> และใช้ได้ครั้งเดียว</p>
      <p style="color: #96969e; font-size: 13px;">
        หากคุณไม่ได้ขอตั้งรหัสผ่านใหม่ ไม่ต้องดำเนินการใดๆ บัญชีของคุณยังปลอดภัย<br />
        ห้ามบอกรหัสนี้กับผู้อื่น รวมถึงเจ้าหน้าที่
      </p>
    </div>
  `;

  // ส่งอีเมลผ่าน Gmail
  await getTransporter().sendMail({
    from: `"Health Risk Assessment" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  });
}

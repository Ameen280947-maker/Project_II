import crypto from "crypto";
import { NextResponse } from "next/server";

// ชื่อคุกกี้ session แยกตามบทบาท (ผู้ใช้ / เจ้าหน้าที่ / ผู้ดูแล) ให้ล็อกอินพร้อมกันได้
export const SESSION_COOKIE = "session";

export const SESSION_COOKIES = {
  user: SESSION_COOKIE,
  staff: "session_staff",
  admin: "session_admin",
} as const;

// ชนิดบทบาทของ session
export type SessionRole = keyof typeof SESSION_COOKIES;

// แปลง role_id เป็นชนิด session (1=admin, 3=staff, อื่น ๆ=user)
export const roleOf = (roleId: number | null): SessionRole =>
  roleId === 1 ? "admin" : roleId === 3 ? "staff" : "user";

// อ่านชนิด session จาก query ?role= ของ request (ค่าเริ่มต้น user)
export const roleFromRequest = (request: Request): SessionRole => {
  const role = new URL(request.url).searchParams.get("role");
  return role === "staff" || role === "admin" ? role : "user";
};
// อายุ session 7 วัน (วินาที)
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

// ข้อมูล session ที่ถอดได้ และ payload ที่เก็บในคุกกี้ (uid, rid, exp)
export type Session = {
  userId: number;
  roleId: number | null;
};

type Payload = {
  uid: number;
  rid: number | null;
  exp: number;
};

// อ่าน SESSION_SECRET จาก env และตรวจว่ายาวอย่างน้อย 32 ตัวอักษร
function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ไม่พบ SESSION_SECRET (อย่างน้อย 32 ตัวอักษร) ใน .env.local");
  }
  return secret;
}

// สร้างลายเซ็น HMAC-SHA256 ของข้อมูล session
function sign(data: string) {
  return crypto.createHmac("sha256", getSecret()).update(data).digest("base64url");
}

// อ่านค่าคุกกี้ตามชื่อจาก header Cookie ของ request
function readCookie(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      return decodeURIComponent(part.slice(index + 1).trim());
    }
  }
  return null;
}

// ตั้งคุกกี้ session แบบลงลายเซ็น (httpOnly อายุ 7 วัน) แยกชื่อคุกกี้ตาม role
export function setSessionCookie(
  response: NextResponse,
  user: { userId: number; roleId: number | null }
) {
  const payload: Payload = {
    uid: user.userId,
    rid: user.roleId,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");

  response.cookies.set(SESSION_COOKIES[roleOf(user.roleId)], `${data}.${sign(data)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

// ลบคุกกี้ session ของ role ที่ระบุ (ใช้ตอนออกจากระบบ)
export function clearSessionCookie(response: NextResponse, role: SessionRole = "user") {
  response.cookies.set(SESSION_COOKIES[role], "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

// อ่านและตรวจลายเซ็น/วันหมดอายุของคุกกี้ session คืน userId และ roleId หรือ null
export function getSession(request: Request, role: SessionRole = "user"): Session | null {
  const token = readCookie(request, SESSION_COOKIES[role]);
  if (!token) return null;

  // ตรวจลายเซ็นแบบ timing-safe
  const [data, signature] = token.split(".");
  if (!data || !signature) return null;

  const expected = Buffer.from(sign(data));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    return null;
  }

  // ถอด payload และตรวจวันหมดอายุ
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as Payload;
    if (!Number.isInteger(payload.uid) || payload.exp < Date.now() / 1000) return null;
    return { userId: payload.uid, roleId: payload.rid ?? null };
  } catch {
    return null;
  }
}

// ผลของ requireUser: ผ่าน (ได้ userId) หรือไม่ผ่าน (ได้ response error)
type RequireUserResult =
  | { ok: true; userId: number; session: Session }
  | { ok: false; response: NextResponse };

// บังคับว่าต้องล็อกอิน และ userId ที่ส่งมา (ถ้ามี) ต้องตรงกับ session ไม่งั้นคืน 401/403
export function requireUser(request: Request, claimedUserId?: unknown): RequireUserResult {
  const session = getSession(request);

  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "กรุณาเข้าสู่ระบบใหม่" },
        { status: 401 }
      ),
    };
  }

  // ถ้ามีการระบุ userId มา ต้องตรงกับเจ้าของ session
  const hasClaim = claimedUserId !== undefined && claimedUserId !== null && claimedUserId !== "";

  if (hasClaim && Number(claimedUserId) !== session.userId) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "ไม่มีสิทธิ์เข้าถึงข้อมูลของผู้ใช้อื่น" },
        { status: 403 }
      ),
    };
  }

  return { ok: true, userId: session.userId, session };
}

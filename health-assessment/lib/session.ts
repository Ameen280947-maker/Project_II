import crypto from "crypto";
import { NextResponse } from "next/server";

/* =========================================================
   Session ฝั่งผู้ใช้ (cookie ที่ลงลายเซ็น HMAC)

   - ตอน login สำเร็จ server ตั้ง cookie "session" (HttpOnly)
   - API อ่านผู้ใช้จาก cookie นี้ แทนการเชื่อ userId ที่หน้าเว็บส่งมา
   - หน้าเว็บยังส่ง userId มาได้เหมือนเดิม แต่ต้องตรงกับ session
     ไม่งั้นตอบ 403 (กันการเปลี่ยน userId เพื่อดูข้อมูลคนอื่น)

   ต้องตั้ง SESSION_SECRET ใน .env.local (สุ่มยาวอย่างน้อย 32 ตัวอักษร)
========================================================= */

export const SESSION_COOKIE = "session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 วัน

export type Session = {
  userId: number;
  roleId: number | null;
};

type Payload = {
  uid: number;
  rid: number | null;
  exp: number;
};

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ไม่พบ SESSION_SECRET (อย่างน้อย 32 ตัวอักษร) ใน .env.local");
  }
  return secret;
}

function sign(data: string) {
  return crypto.createHmac("sha256", getSecret()).update(data).digest("base64url");
}

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

/* ---------- ตั้ง / ลบ cookie ---------- */

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

  response.cookies.set(SESSION_COOKIE, `${data}.${sign(data)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

/* ---------- อ่าน session ---------- */

export function getSession(request: Request): Session | null {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;

  const [data, signature] = token.split(".");
  if (!data || !signature) return null;

  const expected = Buffer.from(sign(data));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as Payload;
    if (!Number.isInteger(payload.uid) || payload.exp < Date.now() / 1000) return null;
    return { userId: payload.uid, roleId: payload.rid ?? null };
  } catch {
    return null;
  }
}

/* =========================================================
   requireUser
   ใช้ใน API ฝั่งผู้ใช้:

     const auth = requireUser(request, body.userId);
     if (!auth.ok) return auth.response;
     const userId = auth.userId;

   claimedUserId = userId ที่หน้าเว็บส่งมา (ไม่ส่งก็ได้)
   - ไม่มี session            → 401
   - ส่งมาแต่ไม่ตรงกับ session → 403
========================================================= */

type RequireUserResult =
  | { ok: true; userId: number; session: Session }
  | { ok: false; response: NextResponse };

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

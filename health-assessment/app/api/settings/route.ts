import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

/* =========================================================
   GET  /api/settings?userId=...   → อ่านการตั้งค่า (ถ้ายังไม่มีจะคืนค่าเริ่มต้น)
   PUT  /api/settings              → บันทึกเฉพาะฟิลด์ที่ส่งมา (body: { userId, ...fields })
========================================================= */

const DEFAULTS = {
  notify_reassess: true,
  notify_weekly: true,
  notify_goals: false,
  notify_tips: true,
  notify_channel: "app_email",
  notify_time: "20:00",
  reassess_overrides: {} as Record<string, string>,
  font_size: "normal",
  language: "th",
  year_format: "be",
  require_otp: true,
  emergency_name: null as string | null,
  emergency_relation: null as string | null,
  emergency_phone: null as string | null,
  consent_health: true,
  consent_health_at: null as string | null,
  consent_research: false,
  consent_research_at: null as string | null,
};

type SettingKey = keyof typeof DEFAULTS;

// คอลัมน์ที่อนุญาตให้แก้ไขได้ (กันการส่งชื่อคอลัมน์แปลก ๆ เข้ามาใน SQL)
const EDITABLE: SettingKey[] = [
  "notify_reassess",
  "notify_weekly",
  "notify_goals",
  "notify_tips",
  "notify_channel",
  "notify_time",
  "reassess_overrides",
  "font_size",
  "language",
  "year_format",
  "require_otp",
  "emergency_name",
  "emergency_relation",
  "emergency_phone",
  "consent_health",
  "consent_research",
];

const ALLOWED_VALUES: Partial<Record<SettingKey, string[]>> = {
  notify_channel: ["app_email", "app", "email"],
  font_size: ["normal", "large", "xl"],
  language: ["th", "en"],
  year_format: ["be", "ce"],
};

export async function GET(request: NextRequest) {
  try {
    const userId = new URL(request.url).searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ success: false, message: "ไม่พบข้อมูลผู้ใช้" }, { status: 400 });
    }

    const { rows } = await pool.query("SELECT * FROM user_settings WHERE user_id = $1", [String(userId)]);

    return NextResponse.json({
      success: true,
      settings: { ...DEFAULTS, ...(rows[0] ?? {}) },
    });
  } catch (error) {
    console.error("GET /api/settings error:", error);
    return NextResponse.json({ success: false, message: "ไม่สามารถโหลดการตั้งค่าได้" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = body?.userId;
    if (!userId) {
      return NextResponse.json({ success: false, message: "ไม่พบข้อมูลผู้ใช้" }, { status: 400 });
    }

    // เลือกเฉพาะฟิลด์ที่แก้ไขได้ และตรวจค่าที่อนุญาต
    const updates: Record<string, unknown> = {};
    for (const key of EDITABLE) {
      if (!(key in body)) continue;
      const value = body[key];
      const allowed = ALLOWED_VALUES[key];
      if (allowed && !allowed.includes(String(value))) {
        return NextResponse.json({ success: false, message: `ค่า ${key} ไม่ถูกต้อง` }, { status: 400 });
      }
      if (key === "notify_time" && !/^\d{2}:\d{2}$/.test(String(value))) {
        return NextResponse.json({ success: false, message: "รูปแบบเวลาไม่ถูกต้อง" }, { status: 400 });
      }
      updates[key] = key === "reassess_overrides" ? JSON.stringify(value ?? {}) : value;
    }

    // บันทึกเวลาที่ให้/เปลี่ยนความยินยอม
    if ("consent_health" in updates) updates.consent_health_at = new Date().toISOString();
    if ("consent_research" in updates) updates.consent_research_at = new Date().toISOString();

    const keys = Object.keys(updates);
    if (keys.length === 0) {
      return NextResponse.json({ success: false, message: "ไม่มีข้อมูลที่ต้องบันทึก" }, { status: 400 });
    }

    const columns = ["user_id", ...keys];
    const values = [String(userId), ...keys.map((k) => updates[k])];
    const placeholders = columns.map((_, i) => `$${i + 1}`);
    const setClause = keys.map((k) => `${k} = EXCLUDED.${k}`).join(", ");

    const { rows } = await pool.query(
      `INSERT INTO user_settings (${columns.join(", ")})
       VALUES (${placeholders.join(", ")})
       ON CONFLICT (user_id) DO UPDATE SET ${setClause}, updated_at = NOW()
       RETURNING *`,
      values
    );

    return NextResponse.json({ success: true, settings: { ...DEFAULTS, ...rows[0] } });
  } catch (error) {
    console.error("PUT /api/settings error:", error);
    return NextResponse.json({ success: false, message: "ไม่สามารถบันทึกการตั้งค่าได้" }, { status: 500 });
  }
}
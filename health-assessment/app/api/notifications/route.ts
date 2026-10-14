import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { syncUserNotifications } from "@/lib/notificationRules";
import { requireUser } from "@/lib/session";
import { logSystemError } from "@/lib/errorLogger";

// API: ซิงก์การแจ้งเตือนประเมินซ้ำของผู้ใช้ แล้วแยกเป็นรายการถึงกำหนด/ใกล้ถึง พร้อมจำนวนที่ยังไม่อ่าน
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const auth = requireUser(request, searchParams.get("userId"));
    if (!auth.ok) return auth.response;
    const userIdNumber = auth.userId;

    // ซิงก์การแจ้งเตือนจากผลประเมินล่าสุด แล้วแยกกลุ่มถึงกำหนด/ใกล้ถึง/ยังไม่อ่าน
    const notifications = await syncUserNotifications(pool, userIdNumber);

    const dueNotifications = notifications.filter(
      (n) => n.status === "overdue" || n.status === "due_today"
    );

    const upcomingNotifications = notifications.filter(
      (n) => n.status === "upcoming"
    );

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return NextResponse.json({
      success: true,
      summary: {
        total: notifications.length,
        unreadCount,
        dueCount: dueNotifications.length,
        upcomingCount: upcomingNotifications.length,
      },
      notifications,
      dueNotifications,
      upcomingNotifications,
    });
  } catch (error) {
    void logSystemError("GET /api/notifications", error);
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    const errStack = error instanceof Error ? error.stack : undefined;
    console.error("Notifications GET Error:", errMsg);
    if (errStack) console.error("Stack:", errStack);
    return NextResponse.json(
      {
        success: false,
        message: "เกิดข้อผิดพลาดในการดึงข้อมูลการแจ้งเตือน",
        error: errMsg,
      },
      { status: 500 }
    );
  }
}

// API: ทำเครื่องหมายการแจ้งเตือนว่าอ่านแล้ว ทีละรายการหรือทั้งหมด (user_notifications)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, notificationId, markAll } = body;

    const auth = requireUser(request, userId);
    if (!auth.ok) return auth.response;
    const userIdNumber = auth.userId;

    // markAll → อ่านทั้งหมด
    if (markAll) {
      await pool.query(
        `
        UPDATE user_notifications
        SET is_read = TRUE, read_at = NOW()
        WHERE user_id = $1 AND is_read = FALSE
        `,
        [userIdNumber]
      );

      return NextResponse.json({
        success: true,
        message: "อ่านการแจ้งเตือนทั้งหมดแล้ว",
      });
    }

    // ไม่งั้นอ่านเฉพาะรายการที่ระบุ (ต้องเป็นของผู้ใช้เอง)
    if (!notificationId) {
      return NextResponse.json(
        { success: false, message: "ไม่พบ Notification ID" },
        { status: 400 }
      );
    }

    await pool.query(
      `
      UPDATE user_notifications
      SET is_read = TRUE, read_at = NOW()
      WHERE notification_id = $1 AND user_id = $2
      `,
      [Number(notificationId), userIdNumber]
    );

    return NextResponse.json({
      success: true,
      message: "ทำเครื่องหมายอ่านแล้วสำเร็จ",
    });
  } catch (error) {
    void logSystemError("PATCH /api/notifications", error);
    console.error("Notifications PATCH Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "ไม่สามารถอัปเดตสถานะการแจ้งเตือนได้",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

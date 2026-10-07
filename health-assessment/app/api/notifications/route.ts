import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { syncUserNotifications } from "@/lib/notificationRules";
import { requireUser } from "@/lib/session";
import { logSystemError } from "@/lib/errorLogger";

/* =========================================================
   GET /api/notifications?userId=xxx
========================================================= */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // ใช้ผู้ใช้จาก session (userId ที่ส่งมาต้องตรงกับ session)
    const auth = requireUser(request, searchParams.get("userId"));
    if (!auth.ok) return auth.response;
    const userIdNumber = auth.userId;

    // ซิงค์และดึงการแจ้งเตือนทั้งหมดของผู้ใช้
    const notifications = await syncUserNotifications(pool, userIdNumber);

    // จำแนกตามสถานะ
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

/* =========================================================
   PATCH /api/notifications
   Mark notification(s) as read
========================================================= */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, notificationId, markAll } = body;

    // ใช้ผู้ใช้จาก session (userId ที่ส่งมาต้องตรงกับ session)
    const auth = requireUser(request, userId);
    if (!auth.ok) return auth.response;
    const userIdNumber = auth.userId;

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

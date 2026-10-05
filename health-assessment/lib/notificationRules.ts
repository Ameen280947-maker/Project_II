import { Pool } from "pg";

export type NotificationUrgency = "critical" | "high" | "medium" | "low";
export type NotificationStatus = "overdue" | "due_today" | "upcoming" | "scheduled";

export interface AssessmentNotificationRule {
  intervalDays: number;
  intervalLabel: string;
  urgency: NotificationUrgency;
  actionUrl: string;
  assessmentName: string;
  category: "ncd" | "behavior" | "mental";
  title: string;
  message: string;
}

export interface CalculatedNotification {
  notificationId?: number;
  userId: number;
  assessmentId: number;
  assessmentTypeId: number;
  assessmentName: string;
  category: "ncd" | "behavior" | "mental";
  riskLevel: string;
  totalScore?: number;
  assessedAt: string;
  dueDate: string;
  intervalDays: number;
  intervalLabel: string;
  status: NotificationStatus;
  statusText: string;
  daysDiff: number; // positive = days overdue, negative = days until due
  urgency: NotificationUrgency;
  title: string;
  message: string;
  actionUrl: string;
  isRead: boolean;
  readAt?: string | null;
}

/**
 * กำหนดเกณฑ์มาตรฐานทางการแพทย์สำหรับระยะเวลาการแจ้งเตือนและติดตามประเมินซ้ำ
 * อิงตามประเภทโรค/แบบประเมินและระดับความเสี่ยง
 */
export function getNotificationRule(
  assessmentTypeId: number,
  riskLevelRaw?: string | null
): AssessmentNotificationRule {
  const risk = String(riskLevelRaw || "").toLowerCase().trim();

  switch (assessmentTypeId) {
    // ---------------------------------------------------------
    // 1. BMI (ดัชนีมวลกาย)
    // ---------------------------------------------------------
    case 1: {
      const assessmentName = "ดัชนีมวลกาย (BMI)";
      const actionUrl = "/assessment_BMI";
      const category = "ncd";

      if (
        risk.includes("อ้วนระดับ 2") ||
        risk.includes("อ้วนระดับ 1") ||
        risk.includes("เสี่ยงสูง")
      ) {
        return {
          intervalDays: 30,
          intervalLabel: "ทุก 1 เดือน",
          urgency: "high",
          actionUrl,
          assessmentName,
          category,
          title: "ถึงกำหนดติดตามภาวะน้ำหนักตัวและ BMI",
          message:
            "ควรติดตามและประเมินค่าดัชนีมวลกายซ้ำเพื่อดูผลลัพธ์จากการควบคุมอาหารและออกกำลังกาย",
        };
      }

      if (risk.includes("เกิน") || risk.includes("ต่ำ") || risk.includes("ผอม")) {
        return {
          intervalDays: 60,
          intervalLabel: "ทุก 2 เดือน",
          urgency: "medium",
          actionUrl,
          assessmentName,
          category,
          title: "ถึงกำหนดติดตามดัชนีมวลกาย (BMI)",
          message: "ติดตามค่าน้ำหนักตัวเพื่อปรับให้เข้าสู่เกณฑ์มาตรฐานสุขภาพ",
        };
      }

      return {
        intervalDays: 180,
        intervalLabel: "ทุก 6 เดือน",
        urgency: "low",
        actionUrl,
        assessmentName,
        category,
        title: "ถึงรอบประเมินดัชนีมวลกาย (BMI)",
        message: "ตรวจวัดน้ำหนักและส่วนสูงสม่ำเสมอเพื่อรักษาน้ำหนักในเกณฑ์สุขภาพดี",
      };
    }

    // ---------------------------------------------------------
    // 2. Blood Pressure (ความดันโลหิต)
    // ---------------------------------------------------------
    case 2: {
      const assessmentName = "แบบประเมินความดันโลหิต";
      const actionUrl = "/assessment_DB";
      const category = "ncd";

      if (risk.includes("อันตราย")) {
        return {
          intervalDays: 1,
          intervalLabel: "ติดตามทันที / ทุกวัน",
          urgency: "critical",
          actionUrl,
          assessmentName,
          category,
          title: "แจ้งเตือนด่วน: เฝ้าระวังความดันโลหิตสูงอันตราย",
          message:
            "ความดันโลหิตอยู่ในระดับอันตราย ควรวัดซ้ำและพบแพทย์หรือไปสถานพยาบาลโดยด่วน",
        };
      }

      if (risk.includes("น่าจะเป็นโรคความดัน")) {
        return {
          intervalDays: 30,
          intervalLabel: "ทุก 1 เดือน",
          urgency: "high",
          actionUrl,
          assessmentName,
          category,
          title: "ถึงกำหนดตรวจติดตามความดันโลหิต (ระดับสูง)",
          message:
            "ความดันโลหิตอยู่ในเกณฑ์สูง ควรตรวจวัดความดันซ้ำและพบแพทย์เพื่อติดตามอาการ",
        };
      }

      if (risk.includes("อาจเป็นโรคความดัน")) {
        return {
          intervalDays: 90,
          intervalLabel: "ทุก 3 เดือน",
          urgency: "medium",
          actionUrl,
          assessmentName,
          category,
          title: "ถึงกำหนดตรวจวัดความดันโลหิตซ้ำ",
          message:
            "ควรวัดความดันโลหิตซ้ำเพื่อประเมินความเสี่ยงและติดตามการปรับเปลี่ยนพฤติกรรม",
        };
      }

      if (risk.includes("เริ่มสูง")) {
        return {
          intervalDays: 180,
          intervalLabel: "ทุก 6 เดือน",
          urgency: "medium",
          actionUrl,
          assessmentName,
          category,
          title: "ถึงกำหนดตรวจติดตามความดันโลหิต",
          message: "ควรตรวจวัดความดันโลหิตอย่างน้อยปีละ 2 ครั้งเพื่อเฝ้าระวัง",
        };
      }

      return {
        intervalDays: 365,
        intervalLabel: "ทุก 1 ปี",
        urgency: "low",
        actionUrl,
        assessmentName,
        category,
        title: "ถึงรอบตรวจความดันโลหิตประจำปี",
        message: "ตรวจวัดความดันโลหิตเป็นประจำอย่างน้อยปีละ 1 ครั้งเพื่อสุขภาพที่สมบูรณ์",
      };
    }

    // ---------------------------------------------------------
    // 3. Thai CVD (โรคหัวใจและหลอดเลือด)
    // ---------------------------------------------------------
    case 3: {
      const assessmentName = "ความเสี่ยงโรคหัวใจและหลอดเลือด (Thai CVD)";
      const actionUrl = "/assessment_CVD";
      const category = "ncd";

      if (risk.includes("สูง")) {
        return {
          intervalDays: 60,
          intervalLabel: "ทุก 2 เดือน",
          urgency: "high",
          actionUrl,
          assessmentName,
          category,
          title: "ถึงกำหนดติดตามความเสี่ยงโรคหัวใจและหลอดเลือด",
          message:
            "ความเสี่ยงอยู่ในระดับสูง ควรพบแพทย์และประเมินปัจจัยเสี่ยงซ้ำอย่างต่อเนื่อง",
        };
      }

      if (risk.includes("ปานกลาง")) {
        return {
          intervalDays: 180,
          intervalLabel: "ทุก 6 เดือน",
          urgency: "medium",
          actionUrl,
          assessmentName,
          category,
          title: "ถึงกำหนดติดตามความเสี่ยงโรคหัวใจและหลอดเลือด",
          message:
            "ความเสี่ยงอยู่ในระดับปานกลาง ควรประเมินซ้ำเพื่อติดตามการควบคุมระดับน้ำตาลและความดัน",
        };
      }

      return {
        intervalDays: 365,
        intervalLabel: "ทุก 1 ปี",
        urgency: "low",
        actionUrl,
        assessmentName,
        category,
        title: "ถึงรอบประเมินความเสี่ยงโรคหัวใจประจำปี",
        message:
          "ประเมินความเสี่ยงโรคหัวใจและหลอดเลือดประจำปีเพื่อเฝ้าระวังสุขภาพ",
      };
    }

    // ---------------------------------------------------------
    // 4. Diabetes TDS (Thai Diabetes Score)
    // ---------------------------------------------------------
    case 4: {
      const assessmentName = "ความเสี่ยงโรคเบาหวาน (TDS)";
      const actionUrl = "/assessment_diabetes";
      const category = "ncd";

      if (risk.includes("very_high") || risk.includes("สูงมาก")) {
        return {
          intervalDays: 180,
          intervalLabel: "ทุก 6 เดือน",
          urgency: "high",
          actionUrl,
          assessmentName,
          category,
          title: "ถึงกำหนดติดตามความเสี่ยงโรคเบาหวาน (เสี่ยงสูงมาก)",
          message:
            "มีความเสี่ยงสูงมากต่อการเกิดโรคเบาหวาน ควรตรวจน้ำตาลในเลือดและประเมินซ้ำ",
        };
      }

      if (risk.includes("high") || risk.includes("สูง")) {
        return {
          intervalDays: 365,
          intervalLabel: "ทุก 1 ปี",
          urgency: "medium",
          actionUrl,
          assessmentName,
          category,
          title: "ถึงกำหนดประเมินความเสี่ยงโรคเบาหวานประจำปี",
          message:
            "ความเสี่ยงอยู่ในระดับสูง ควรตรวจระดับน้ำตาลในเลือดและประเมินความเสี่ยงซ้ำ",
        };
      }

      if (risk.includes("moderate") || risk.includes("ปานกลาง")) {
        return {
          intervalDays: 365,
          intervalLabel: "ทุก 1 ปี",
          urgency: "medium",
          actionUrl,
          assessmentName,
          category,
          title: "ถึงกำหนดประเมินความเสี่ยงโรคเบาหวาน",
          message:
            "ความเสี่ยงอยู่ในระดับปานกลาง ควรควบคุมน้ำหนักและประเมินซ้ำตามกำหนด",
        };
      }

      return {
        intervalDays: 730,
        intervalLabel: "ทุก 2 ปี",
        urgency: "low",
        actionUrl,
        assessmentName,
        category,
        title: "ถึงรอบติดตามความเสี่ยงโรคเบาหวาน",
        message:
          "ความเสี่ยงต่ำ ควรรักษาสุขภาพและตรวจคัดกรองเบาหวานตามรอบนัดหมาย",
      };
    }

    // ---------------------------------------------------------
    // 5. Diabetes Risk (ปัจจัยเสี่ยงเบาหวาน)
    // ---------------------------------------------------------
    case 5: {
      const assessmentName = "ปัจจัยเสี่ยงโรคเบาหวาน (Diabetes Risk)";
      const actionUrl = "/assessment_diabetes";
      const category = "ncd";

      if (risk.includes("มีความเสี่ยง")) {
        return {
          intervalDays: 90,
          intervalLabel: "ทุก 3 เดือน",
          urgency: "high",
          actionUrl,
          assessmentName,
          category,
          title: "ถึงกำหนดตรวจติดตามปัจจัยเสี่ยงโรคเบาหวาน",
          message:
            "พบปัจจัยเสี่ยงโรคเบาหวาน ควรตรวจระดับน้ำตาลและวัดความดันซ้ำ",
        };
      }

      return {
        intervalDays: 365,
        intervalLabel: "ทุก 1 ปี",
        urgency: "low",
        actionUrl,
        assessmentName,
        category,
        title: "ถึงรอบประเมินปัจจัยเสี่ยงโรคเบาหวาน",
        message: "ติดตามปัจจัยเสี่ยงโรคเบาหวานประจำปี",
      };
    }

    // ---------------------------------------------------------
    // 6. Smoking (การสูบบุหรี่)
    // ---------------------------------------------------------
    case 6: {
      const assessmentName = "แบบประเมินการสูบบุหรี่";
      const actionUrl = "/assessment_smoking";
      const category = "behavior";

      if (risk.includes("สูง")) {
        return {
          intervalDays: 30,
          intervalLabel: "ทุก 1 เดือน",
          urgency: "high",
          actionUrl,
          assessmentName,
          category,
          title: "ถึงกำหนดติดตามพฤติกรรมการสูบบุหรี่ (ติดนิโคตินสูง)",
          message:
            "ติดตามการลด/เลิกบุหรี่เพื่อประเมินความก้าวหน้าและลดอันตรายต่อปอดและหัวใจ",
        };
      }

      if (risk.includes("ปานกลาง")) {
        return {
          intervalDays: 60,
          intervalLabel: "ทุก 2 เดือน",
          urgency: "medium",
          actionUrl,
          assessmentName,
          category,
          title: "ถึงกำหนดติดตามการลดปริมาณการสูบบุหรี่",
          message:
            "ประเมินพฤติกรรมการสูบบุหรี่ซ้ำเพื่อช่วยสนับสนุนการเลิกบุหรี่สำเร็จ",
        };
      }

      return {
        intervalDays: 180,
        intervalLabel: "ทุก 6 เดือน",
        urgency: "low",
        actionUrl,
        assessmentName,
        category,
        title: "ถึงรอบประเมินพฤติกรรมการสูบบุหรี่",
        message: "ประเมินเพื่อรักษาพฤติกรรมปลอดบุหรี่อย่างยั่งยืน",
      };
    }

    // ---------------------------------------------------------
    // 7. Alcohol (การดื่มแอลกอฮอล์)
    // ---------------------------------------------------------
    case 7: {
      const assessmentName = "แบบประเมินการดื่มแอลกอฮอล์";
      const actionUrl = "/assessment_alcohol";
      const category = "behavior";

      if (risk.includes("สูง")) {
        return {
          intervalDays: 30,
          intervalLabel: "ทุก 1 เดือน",
          urgency: "high",
          actionUrl,
          assessmentName,
          category,
          title: "ถึงกำหนดติดตามการดื่มแอลกอฮอล์ (เสี่ยงสูง)",
          message:
            "การดื่มอยู่ในระดับเสี่ยงสูง ควรติดตามการลดปริมาณการดื่มเพื่อความปลอดภัยของตับและสุขภาพ",
        };
      }

      if (risk.includes("ปานกลาง")) {
        return {
          intervalDays: 60,
          intervalLabel: "ทุก 2 เดือน",
          urgency: "medium",
          actionUrl,
          assessmentName,
          category,
          title: "ถึงกำหนดติดตามการดื่มแอลกอฮอล์",
          message:
            "มีสัญญาณเสี่ยงจากการดื่ม ควรประเมินซ้ำเพื่อติดตามการควบคุมปริมาณการดื่ม",
        };
      }

      return {
        intervalDays: 180,
        intervalLabel: "ทุก 6 เดือน",
        urgency: "low",
        actionUrl,
        assessmentName,
        category,
        title: "ถึงรอบประเมินการดื่มแอลกอฮอล์",
        message: "ประเมินเพื่อติดตามการรักษาสุขภาพและพฤติกรรมที่ดี",
      };
    }

    // ---------------------------------------------------------
    // 8. Physical Activity (กิจกรรมทางกาย)
    // ---------------------------------------------------------
    case 8: {
      const assessmentName = "แบบประเมินกิจกรรมทางกาย";
      const actionUrl = "/assessment_physical_activity";
      const category = "behavior";

      if (risk.includes("ไม่มี") || risk.includes("เสี่ยงสูง")) {
        return {
          intervalDays: 30,
          intervalLabel: "ทุก 1 เดือน",
          urgency: "high",
          actionUrl,
          assessmentName,
          category,
          title: "ถึงกำหนดติดตามระดับการออกกำลังกาย",
          message:
            "ไม่มีกิจกรรมทางกายเพียงพอ ควรเริ่มขยับร่างกายและประเมินผลความคืบหน้า",
        };
      }

      if (risk.includes("ไม่เพียงพอ") || risk.includes("ปานกลาง")) {
        return {
          intervalDays: 60,
          intervalLabel: "ทุก 2 เดือน",
          urgency: "medium",
          actionUrl,
          assessmentName,
          category,
          title: "ถึงกำหนดติดตามกิจกรรมทางกาย",
          message:
            "ติดตามเพื่อเพิ่มการออกกำลังกายให้ถึงเกณฑ์สะสม 150 นาที/สัปดาห์",
        };
      }

      return {
        intervalDays: 180,
        intervalLabel: "ทุก 6 เดือน",
        urgency: "low",
        actionUrl,
        assessmentName,
        category,
        title: "ถึงรอบประเมินกิจกรรมทางกาย",
        message: "ติดตามเพื่อรักษาระดับการออกกำลังกายอย่างต่อเนื่อง",
      };
    }

    // ---------------------------------------------------------
    // 9. Sleep (การนอนหลับ)
    // ---------------------------------------------------------
    case 9: {
      const assessmentName = "แบบประเมินการนอนหลับ";
      const actionUrl = "/sleep-assessment";
      const category = "behavior";

      if (risk.includes("เสี่ยงสูง")) {
        return {
          intervalDays: 30,
          intervalLabel: "ทุก 1 เดือน",
          urgency: "high",
          actionUrl,
          assessmentName,
          category,
          title: "ถึงกำหนดติดตามคุณภาพการนอนหลับ (เสี่ยงสูง)",
          message:
            "นอนหลับไม่เพียงพออย่างมาก ส่งผลกระทบต่อระบบหัวใจและความดัน ควรประเมินซ้ำ",
        };
      }

      if (risk.includes("ไม่เพียงพอ")) {
        return {
          intervalDays: 60,
          intervalLabel: "ทุก 2 เดือน",
          urgency: "medium",
          actionUrl,
          assessmentName,
          category,
          title: "ถึงกำหนดติดตามพฤติกรรมการนอนหลับ",
          message: "ควรปรับสุขอนามัยการนอนและประเมินคุณภาพการนอนหลับซ้ำ",
        };
      }

      return {
        intervalDays: 180,
        intervalLabel: "ทุก 6 เดือน",
        urgency: "low",
        actionUrl,
        assessmentName,
        category,
        title: "ถึงรอบประเมินการนอนหลับ",
        message: "ติดตามเพื่อรักษาคุณภาพการนอนหลับที่ดีสม่ำเสมอ",
      };
    }

    // ---------------------------------------------------------
    // 10. Diet (การรับประทานอาหาร)
    // ---------------------------------------------------------
    case 10: {
      const assessmentName = "แบบประเมินพฤติกรรมการรับประทานอาหาร";
      const actionUrl = "/assessment_diet";
      const category = "behavior";

      if (
        risk.includes("ปรับพฤติกรรมมาก") ||
        risk.includes("สูงมาก") ||
        risk.includes("เสี่ยงสูง")
      ) {
        return {
          intervalDays: 30,
          intervalLabel: "ทุก 1 เดือน",
          urgency: "high",
          actionUrl,
          assessmentName,
          category,
          title: "ถึงกำหนดติดตามพฤติกรรมการกินอาหาร",
          message:
            "ควรลดหวาน มัน เค็ม และอาหารแปรรูป แล้วประเมินผลการปรับพฤติกรรม",
        };
      }

      if (risk.includes("ควรใส่ใจ") || risk.includes("ปานกลาง")) {
        return {
          intervalDays: 60,
          intervalLabel: "ทุก 2 เดือน",
          urgency: "medium",
          actionUrl,
          assessmentName,
          category,
          title: "ถึงกำหนดติดตามการรับประทานอาหาร",
          message:
            "ติดตามผลการปรับเปลี่ยนโภชนาการเพื่อลดความเสี่ยงต่อโรคเรื้อรัง",
        };
      }

      return {
        intervalDays: 180,
        intervalLabel: "ทุก 6 เดือน",
        urgency: "low",
        actionUrl,
        assessmentName,
        category,
        title: "ถึงรอบประเมินพฤติกรรมการรับประทานอาหาร",
        message: "ประเมินเพื่อรักษาพฤติกรรมการบริโภคที่ถูกต้องและปลอดภัย",
      };
    }

    // ---------------------------------------------------------
    // 11. Oral Health (สุขภาพช่องปาก)
    // ---------------------------------------------------------
    case 11: {
      const assessmentName = "แบบประเมินสุขภาพช่องปาก";
      const actionUrl = "/assessment-menu-behavior";
      const category = "behavior";

      if (risk.includes("สูง")) {
        return {
          intervalDays: 60,
          intervalLabel: "ทุก 2 เดือน",
          urgency: "medium",
          actionUrl,
          assessmentName,
          category,
          title: "ถึงกำหนดติดตามสุขภาพช่องปาก",
          message: "ควรพบทันตแพทย์และปรับพฤติกรรมการแปรงฟันอย่างถูกวิธี",
        };
      }

      if (risk.includes("ปานกลาง")) {
        return {
          intervalDays: 90,
          intervalLabel: "ทุก 3 เดือน",
          urgency: "low",
          actionUrl,
          assessmentName,
          category,
          title: "ถึงกำหนดติดตามการดูแลช่องปาก",
          message: "ติดตามการแปรงฟันอย่างน้อยวันละ 2 ครั้ง และพบทันตแพทย์ตามรอบ",
        };
      }

      return {
        intervalDays: 365,
        intervalLabel: "ทุก 1 ปี",
        urgency: "low",
        actionUrl,
        assessmentName,
        category,
        title: "ถึงรอบตรวจสุขภาพช่องปากประจำปี",
        message: "พบทันตแพทย์อย่างน้อยปีละ 1 ครั้งเพื่อสุขภาพฟันที่แข็งแรง",
      };
    }

    // ---------------------------------------------------------
    // 12. Stress (ความเครียด ST-5)
    // ---------------------------------------------------------
    case 12: {
      const assessmentName = "แบบประเมินความเครียด (ST-5)";
      const actionUrl = "/assessment_stress";
      const category = "mental";

      if (risk.includes("เครียดมากที่สุด")) {
        return {
          intervalDays: 7,
          intervalLabel: "ทุก 7 วัน (ด่วน)",
          urgency: "critical",
          actionUrl,
          assessmentName,
          category,
          title: "แจ้งเตือนด่วน: ติดตามระดับความเครียดรุนแรง",
          message:
            "ความเครียดอยู่ในระดับรุนแรงมาก ควรพบแพทย์หรือโทรสายด่วนสุขภาพจิต 1323 และประเมินซ้ำ",
        };
      }

      if (risk.includes("เครียดมาก")) {
        return {
          intervalDays: 14,
          intervalLabel: "ทุก 14 วัน",
          urgency: "high",
          actionUrl,
          assessmentName,
          category,
          title: "ถึงกำหนดประเมินระดับความเครียดซ้ำ",
          message:
            "ความเครียดอยู่ในระดับค่อนข้างมาก หากอาการยังไม่ดีขึ้นภายใน 2 สัปดาห์ควรพบแพทย์",
        };
      }

      if (risk.includes("เครียดปานกลาง")) {
        return {
          intervalDays: 30,
          intervalLabel: "ทุก 1 เดือน",
          urgency: "medium",
          actionUrl,
          assessmentName,
          category,
          title: "ถึงกำหนดติดตามระดับความเครียด",
          message: "ติดตามระดับความเครียดเพื่อป้องกันการสะสมจนส่งผลต่อร่างกาย",
        };
      }

      return {
        intervalDays: 90,
        intervalLabel: "ทุก 3 เดือน",
        urgency: "low",
        actionUrl,
        assessmentName,
        category,
        title: "ถึงรอบประเมินความเครียด",
        message: "ประเมินสุขภาพจิตเพื่อรักษาสมดุลในการใช้ชีวิตประจำวัน",
      };
    }

    // ---------------------------------------------------------
    // 13. PHQ-2 (คัดกรองซึมเศร้า 2Q)
    // ---------------------------------------------------------
    case 13: {
      const assessmentName = "แบบคัดกรองภาวะซึมเศร้า (2Q)";
      const actionUrl = "/assessment_depression_2q";
      const category = "mental";

      if (risk.includes("เสี่ยง") || risk.includes("แนวโน้ม")) {
        return {
          intervalDays: 1,
          intervalLabel: "ประเมินต่อทันที",
          urgency: "critical",
          actionUrl: "/assessment_depression_9q",
          assessmentName,
          category,
          title: "แนะนำทำแบบประเมินโรคซึมเศร้า 9Q ต่อเนื่อง",
          message:
            "พบความเสี่ยงภาวะซึมเศร้าเบื้องต้น ควรทำแบบประเมิน 9Q ต่อเพื่อการดูแลที่เหมาะสม",
        };
      }

      return {
        intervalDays: 90,
        intervalLabel: "ทุก 3 เดือน",
        urgency: "low",
        actionUrl,
        assessmentName,
        category,
        title: "ถึงรอบคัดกรองภาวะซึมเศร้า (2Q)",
        message: "ไม่พบความเสี่ยง คัดกรองสุขภาพจิตเป็นประจำเพื่อเฝ้าระวัง",
      };
    }

    // ---------------------------------------------------------
    // 14. 9Q (แบบประเมินโรคซึมเศร้า 9Q)
    // ---------------------------------------------------------
    case 14: {
      const assessmentName = "แบบประเมินโรคซึมเศร้า (9Q)";
      const actionUrl = "/assessment_depression_9q";
      const category = "mental";

      if (risk.includes("รุนแรง")) {
        return {
          intervalDays: 7,
          intervalLabel: "ทุก 7 วัน (ด่วน)",
          urgency: "critical",
          actionUrl,
          assessmentName,
          category,
          title: "แจ้งเตือนด่วน: เฝ้าระวังภาวะซึมเศร้าระดับรุนแรง",
          message:
            "มีอาการซึมเศร้าระดับรุนแรง ควรเข้ารับการดูแลจากแพทย์โดยเร็ว และประเมินซ้ำ",
        };
      }

      if (risk.includes("ปานกลาง")) {
        return {
          intervalDays: 14,
          intervalLabel: "ทุก 14 วัน",
          urgency: "high",
          actionUrl,
          assessmentName,
          category,
          title: "ถึงกำหนดติดตามภาวะซึมเศร้า (9Q)",
          message:
            "มีอาการซึมเศร้าระดับปานกลาง ควรพบแพทย์เพื่อวางแผนการรักษาและติดตามประเมินซ้ำ",
        };
      }

      if (risk.includes("น้อย")) {
        return {
          intervalDays: 30,
          intervalLabel: "ทุก 1 เดือน",
          urgency: "medium",
          actionUrl,
          assessmentName,
          category,
          title: "ถึงกำหนดติดตามภาวะซึมเศร้า (9Q)",
          message:
            "มีอาการระดับน้อย ควรสังเกตอาการตนเองและประเมินซ้ำอย่างสม่ำเสมอ",
        };
      }

      return {
        intervalDays: 90,
        intervalLabel: "ทุก 3 เดือน",
        urgency: "low",
        actionUrl,
        assessmentName,
        category,
        title: "ถึงรอบประเมินสุขภาพจิต 9Q",
        message: "ประเมินสุขภาพจิตสม่ำเสมอเพื่อดูแลสุขภาวะทางอารมณ์",
      };
    }

    // ---------------------------------------------------------
    // Default Fallback
    // ---------------------------------------------------------
    default: {
      return {
        intervalDays: 90,
        intervalLabel: "ทุก 3 เดือน",
        urgency: "medium",
        actionUrl: "/assessment-type",
        assessmentName: "แบบประเมินสุขภาพ",
        category: "ncd",
        title: "ถึงกำหนดติดตามและประเมินสุขภาพซ้ำ",
        message: "ติดตามประเมินสุขภาพเป็นประจำเพื่อสุขภาพที่แข็งแรง",
      };
    }
  }
}

/**
 * คำนวณสถานะความเร่งด่วนและวันที่ครบกำหนด
 */
export function calculateNotificationStatus(
  assessedAt: Date | string,
  intervalDays: number
): {
  dueDate: Date;
  daysDiff: number;
  status: NotificationStatus;
  statusText: string;
} {
  const assessedDate = new Date(assessedAt);
  const dueDate = new Date(assessedDate.getTime() + intervalDays * 24 * 60 * 60 * 1000);
  const now = new Date();

  // คำนวณความต่างของวัน (ไม่นับเศษมิลลิวินาทีของเวลา)
  const msPerDay = 24 * 60 * 60 * 1000;
  const startOfDue = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime();
  const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffDays = Math.round((startOfNow - startOfDue) / msPerDay);

  let status: NotificationStatus;
  let statusText: string;

  if (diffDays > 0) {
    status = "overdue";
    statusText = `เลยกำหนดมาแล้ว ${diffDays} วัน`;
  } else if (diffDays === 0) {
    status = "due_today";
    statusText = "ครบกำหนดประเมินซ้ำวันนี้";
  } else if (diffDays >= -7) {
    status = "upcoming";
    statusText = `อีก ${Math.abs(diffDays)} วันจะถึงกำหนด`;
  } else {
    status = "scheduled";
    statusText = `อีก ${Math.abs(diffDays)} วัน`;
  }

  return {
    dueDate,
    daysDiff: diffDays,
    status,
    statusText,
  };
}

/**
 * ซิงค์การแจ้งเตือนของผู้ใช้จากประวัติการประเมินล่าสุดในฐานข้อมูล
 * ระบบจะตรวจหาการประเมินล่าสุดของแต่ละประเภท และลงทะเบียนใน user_notifications
 */
export async function syncUserNotifications(
  pool: Pool,
  userId: number
): Promise<CalculatedNotification[]> {
  // ดึงผลการประเมินล่าสุด 1 รายการของแต่ละประเภท
  const latestAssessmentsRes = await pool.query(
    `
    WITH RankedAssessments AS (
      SELECT
        a.assessment_id,
        a.user_id,
        a.assessment_type_id,
        t.assessment_name,
        a.total_score,
        a.risk_level,
        a.assessed_at,
        ROW_NUMBER() OVER(
          PARTITION BY a.assessment_type_id 
          ORDER BY a.assessed_at DESC, a.assessment_id DESC
        ) as rn
      FROM assessment a
      JOIN assessment_types t ON t.assessment_type_id = a.assessment_type_id
      WHERE a.user_id = $1
    )
    SELECT
      assessment_id,
      user_id,
      assessment_type_id,
      assessment_name,
      total_score,
      risk_level,
      assessed_at
    FROM RankedAssessments
    WHERE rn = 1
    ORDER BY assessed_at DESC
    `,
    [userId]
  );

  const latestAssessments = latestAssessmentsRes.rows;
  if (!latestAssessments || latestAssessments.length === 0) {
    return [];
  }

  const results: CalculatedNotification[] = [];

  for (const item of latestAssessments) {
    const rule = getNotificationRule(item.assessment_type_id, item.risk_level);
    const { dueDate, daysDiff, status, statusText } = calculateNotificationStatus(
      item.assessed_at,
      rule.intervalDays
    );

    // ตรวจสอบว่ามีบันทึกใน user_notifications หรือยัง
    const existingRes = await pool.query(
      `
      SELECT notification_id, is_read, read_at
      FROM user_notifications
      WHERE user_id = $1 AND assessment_id = $2
      LIMIT 1
      `,
      [userId, item.assessment_id]
    );

    let notificationId: number;
    let isRead = false;
    let readAt: string | null = null;

    if (existingRes.rows.length === 0) {
      // สร้างใหม่
      const insertRes = await pool.query(
        `
        INSERT INTO user_notifications (
          user_id,
          assessment_id,
          assessment_type_id,
          title,
          message,
          risk_level,
          interval_days,
          due_date,
          status,
          is_read,
          action_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING notification_id, is_read, read_at
        `,
        [
          userId,
          item.assessment_id,
          item.assessment_type_id,
          rule.title,
          rule.message,
          item.risk_level || "ทั่วไป",
          rule.intervalDays,
          dueDate,
          status,
          false,
          rule.actionUrl,
        ]
      );
      notificationId = insertRes.rows[0].notification_id;
    } else {
      notificationId = existingRes.rows[0].notification_id;
      isRead = existingRes.rows[0].is_read;
      readAt = existingRes.rows[0].read_at ? new Date(existingRes.rows[0].read_at).toISOString() : null;

      // อัปเดตข้อมูลและสถานะล่าสุด
      await pool.query(
        `
        UPDATE user_notifications
        SET
          status = $1,
          due_date = $2,
          interval_days = $3,
          title = $4,
          message = $5,
          action_url = $6
        WHERE notification_id = $7
        `,
        [
          status,
          dueDate,
          rule.intervalDays,
          rule.title,
          rule.message,
          rule.actionUrl,
          notificationId,
        ]
      );
    }

    results.push({
      notificationId,
      userId,
      assessmentId: item.assessment_id,
      assessmentTypeId: item.assessment_type_id,
      assessmentName: rule.assessmentName || item.assessment_name,
      category: rule.category,
      riskLevel: item.risk_level || "-",
      totalScore: item.total_score != null ? Number(item.total_score) : undefined,
      assessedAt: new Date(item.assessed_at).toISOString(),
      dueDate: dueDate.toISOString(),
      intervalDays: rule.intervalDays,
      intervalLabel: rule.intervalLabel,
      status,
      statusText,
      daysDiff,
      urgency: rule.urgency,
      title: rule.title,
      message: rule.message,
      actionUrl: rule.actionUrl,
      isRead,
      readAt,
    });
  }

  // เรียงลำดับ: รายการที่เลยกำหนด/ถึงกำหนดก่อน -> วันที่ถึงกำหนดเร็วสุด -> ระดับความเร่งด่วน
  results.sort((a, b) => {
    // 1. Overdue & Due today ขึ้นก่อน
    const isDueA = a.status === "overdue" || a.status === "due_today";
    const isDueB = b.status === "overdue" || b.status === "due_today";
    if (isDueA && !isDueB) return -1;
    if (!isDueA && isDueB) return 1;

    // 2. เรียงตาม due_date ใกล้ที่สุด
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  return results;
}

/* =========================================================
   Rate limit แบบง่าย (นับใน memory ด้วย Map)

   ข้อจำกัด (ยอมรับได้สำหรับโปรเจกต์นี้):
   - ค่าจะหายเมื่อรีสตาร์ต server
   - นับแยกต่อ process ถ้า deploy หลาย instance แต่ละตัวนับของตัวเอง
   ถ้าต้องการให้แม่นยำ ควรย้ายไปเก็บใน DB หรือ Redis
========================================================= */

type Bucket = {
  count: number;
  resetAt: number; // ms
};

export class FixedWindowCounter {
  private buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  private current(key: string, now = Date.now()) {
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.delete(key);
      return null;
    }
    return bucket;
  }

  /** ครบโควตาแล้วหรือยัง (ไม่เพิ่มจำนวน) */
  isLimited(key: string) {
    const bucket = this.current(key);
    return bucket !== null && bucket.count >= this.limit;
  }

  /** เพิ่มจำนวน 1 ครั้ง คืนค่าจำนวนล่าสุดในรอบนี้ */
  hit(key: string) {
    const now = Date.now();
    this.prune(now);

    const bucket = this.current(key, now);
    if (bucket) {
      bucket.count += 1;
      return bucket.count;
    }

    this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
    return 1;
  }

  reset(key: string) {
    this.buckets.delete(key);
  }

  // ล้างรายการที่หมดเวลาแล้ว กัน Map โตไม่หยุด
  private prune(now: number) {
    if (this.buckets.size < 1000) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}

/* ---------- ตัวนับที่ใช้ร่วมกันระหว่าง route ---------- */

// เก็บไว้ที่ globalThis เพื่อไม่ให้รีเซ็ตตอน dev server โหลดโมดูลใหม่
declare global {
  var otpRateLimits:
    | {
        forgotPassword: FixedWindowCounter;
        verifyOtpFailures: FixedWindowCounter;
      }
    | undefined;
}

export const otpRateLimits = (globalThis.otpRateLimits ??= {
  // ขอ OTP ได้สูงสุด 3 ครั้ง / อีเมล / 15 นาที
  forgotPassword: new FixedWindowCounter(3, 15 * 60 * 1000),
  // กรอก OTP ผิดได้สูงสุด 5 ครั้ง / อีเมล / 10 นาที
  verifyOtpFailures: new FixedWindowCounter(5, 10 * 60 * 1000),
});

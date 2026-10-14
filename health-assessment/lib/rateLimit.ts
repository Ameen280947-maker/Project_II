// ตัวนับของ key หนึ่ง: จำนวนครั้ง และเวลาที่จะรีเซ็ต
type Bucket = {
  count: number;
  resetAt: number;
};

// ตัวจำกัดจำนวนครั้งแบบ fixed window (เก็บในหน่วยความจำ) เช่น จำกัดการขอ OTP
export class FixedWindowCounter {
  private buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  // คืน bucket ปัจจุบันของ key ถ้ายังไม่หมดเวลา (หมดแล้วลบทิ้งและคืน null)
  private current(key: string, now = Date.now()) {
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.delete(key);
      return null;
    }
    return bucket;
  }

  // ตรวจว่า key นี้ใช้ครบจำนวนครั้งที่กำหนดในช่วงเวลานี้แล้วหรือยัง
  isLimited(key: string) {
    const bucket = this.current(key);
    return bucket !== null && bucket.count >= this.limit;
  }

  // นับเพิ่มหนึ่งครั้งให้ key (เริ่มช่วงเวลาใหม่ถ้ายังไม่มี) แล้วคืนจำนวนครั้งล่าสุด
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

  // ล้างตัวนับของ key
  reset(key: string) {
    this.buckets.delete(key);
  }

  // ลบ bucket ที่หมดเวลาแล้วเมื่อมีจำนวนมากเกิน 1000 เพื่อไม่ให้หน่วยความจำโต
  private prune(now: number) {
    if (this.buckets.size < 1000) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}

// เก็บตัวจำกัดไว้ใน global ให้คงอยู่ข้าม hot reload
declare global {
  var otpRateLimits:
    | {
        forgotPassword: FixedWindowCounter;
        verifyOtpFailures: FixedWindowCounter;
      }
    | undefined;
}

// ขอ OTP ได้ 3 ครั้ง/15 นาที และกรอก OTP ผิดได้ 5 ครั้ง/10 นาที
export const otpRateLimits = (globalThis.otpRateLimits ??= {
  forgotPassword: new FixedWindowCounter(3, 15 * 60 * 1000),
  verifyOtpFailures: new FixedWindowCounter(5, 10 * 60 * 1000),
});

import { Pool, types } from "pg";

// ฐานข้อมูลตั้ง TimeZone = UTC และคอลัมน์เวลาเป็น timestamp without time zone
// ค่าที่ NOW() บันทึกจึงเป็นเวลา UTC ต้องอ่านเป็น UTC ไม่งั้นเวลาจะเพี้ยน 7 ชั่วโมง
types.setTypeParser(
  types.builtins.TIMESTAMP,
  (value) => new Date(`${value.replace(" ", "T")}Z`),
);

declare global {
  var postgresPool: Pool | undefined;
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "ไม่พบ DATABASE_URL กรุณาตรวจสอบไฟล์ .env.local",
  );
}

const pool =
  global.postgresPool ??
  new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

if (process.env.NODE_ENV !== "production") {
  global.postgresPool = pool;
}

pool.on("error", (error) => {
  console.error("PostgreSQL pool error:", error);
});

export default pool;
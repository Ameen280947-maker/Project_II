import { Pool, types } from "pg";

// ให้คอลัมน์ TIMESTAMP (ไม่มี timezone) ถูกอ่านเป็นเวลา UTC
types.setTypeParser(
  types.builtins.TIMESTAMP,
  (value) => new Date(`${value.replace(" ", "T")}Z`),
);

// เก็บ pool ไว้ใน global เพื่อไม่สร้างซ้ำตอน hot reload
declare global {
  var postgresPool: Pool | undefined;
}

// อ่าน DATABASE_URL จาก env ถ้าไม่มีให้หยุดทำงานทันที
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "ไม่พบ DATABASE_URL กรุณาตรวจสอบไฟล์ .env.local",
  );
}

// connection pool ของ PostgreSQL (สูงสุด 5 การเชื่อมต่อต่อแอป)
const pool =
  global.postgresPool ??
  new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

if (process.env.NODE_ENV !== "production") {
  global.postgresPool = pool;
}

// log error ของ connection ที่ว่างอยู่ ไม่ให้แอปล่ม
pool.on("error", (error) => {
  console.error("PostgreSQL pool error:", error);
});

export default pool;
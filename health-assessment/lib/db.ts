import { Pool } from "pg";

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
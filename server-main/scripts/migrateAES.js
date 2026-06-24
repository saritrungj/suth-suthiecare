/**
 * ============================================================
 *  server/scripts/migrateAES.js
 *  เพิ่ม column phone, national_id, phone_hash, national_id_hash
 *  ลงใน table users ของ database suthie1
 *
 *  รันคำสั่ง:  node server/scripts/migrateAES.js
 * ============================================================
 */

require("dotenv").config();
const mysql = require("mysql2/promise");

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "suthie1",
  });

  console.log("\n🔌 เชื่อมต่อ DB:", process.env.DB_NAME || "suthie1");
  console.log("📦 เริ่ม Migration เพิ่ม column AES...\n");

  // ดูโครงสร้าง table users ปัจจุบัน
  const [columns] = await conn.query("DESCRIBE users");
  const existingCols = columns.map((c) => c.Field);
  console.log("📋 Column ที่มีอยู่แล้ว:", existingCols.join(", "), "\n");

  // รายการ column ที่ต้องเพิ่ม
  const toAdd = [
    {
      name: "phone",
      sql: "ALTER TABLE users ADD COLUMN phone TEXT NULL COMMENT 'AES-256-GCM encrypted' AFTER name",
    },
    {
      name: "national_id",
      sql: "ALTER TABLE users ADD COLUMN national_id TEXT NULL COMMENT 'AES-256-GCM encrypted' AFTER phone",
    },
    {
      name: "phone_hash",
      sql: "ALTER TABLE users ADD COLUMN phone_hash VARCHAR(64) NULL COMMENT 'HMAC-SHA256 for search' AFTER national_id",
    },
    {
      name: "national_id_hash",
      sql: "ALTER TABLE users ADD COLUMN national_id_hash VARCHAR(64) NULL COMMENT 'HMAC-SHA256 for search' AFTER phone_hash",
    },
  ];

  for (const col of toAdd) {
    if (existingCols.includes(col.name)) {
      console.log(`⚠️  Column "${col.name}" มีอยู่แล้ว → ข้าม`);
    } else {
      await conn.execute(col.sql);
      console.log(`✅ เพิ่ม column "${col.name}" สำเร็จ`);
    }
  }

  // เพิ่ม Index สำหรับค้นหา
  console.log("\n📌 เพิ่ม Index...");
  const indexes = [
    {
      name: "idx_phone_hash",
      sql: "CREATE INDEX idx_phone_hash ON users (phone_hash)",
    },
    {
      name: "idx_national_id_hash",
      sql: "CREATE INDEX idx_national_id_hash ON users (national_id_hash)",
    },
  ];
  for (const idx of indexes) {
    try {
      await conn.execute(idx.sql);
      console.log(`✅ Index "${idx.name}" สร้างสำเร็จ`);
    } catch (e) {
      if (e.code === "ER_DUP_KEYNAME") {
        console.log(`⚠️  Index "${idx.name}" มีอยู่แล้ว → ข้าม`);
      } else throw e;
    }
  }

  await conn.end();

  console.log("\n🎉 Migration เสร็จสิ้น!");
  console.log("──────────────────────────────────────");
  console.log("ขั้นตอนถัดไป:");
  console.log("  1. node server/scripts/generateKeys.js  → สร้าง AES_KEY");
  console.log("  2. ใส่ AES_KEY และ AES_SEARCH_KEY ลงใน .env");
  console.log("  3. รัน server ได้เลย\n");
}

migrate().catch((err) => {
  console.error("\n❌ Migration ล้มเหลว:", err.message);
  process.exit(1);
});

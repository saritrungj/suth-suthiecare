/**
 * Makes users.name safe for AES-256-GCM Base64 ciphertext and Unicode names.
 * Run once per environment: npm run migrate:user-name-storage
 */
const db = require("../config/db");

async function migrate() {
  try {
    const [columns] = await db.query("SHOW FULL COLUMNS FROM users LIKE 'name'");
    if (!columns.length) throw new Error("ไม่พบคอลัมน์ users.name");

    const column = columns[0];
    const isText = /text/i.test(column.Type);
    const isUtf8mb4 = String(column.Collation || "").toLowerCase().startsWith("utf8mb4");
    if (isText && isUtf8mb4) {
      console.log("users.name รองรับข้อความเข้ารหัสและ Unicode อยู่แล้ว");
      return;
    }

    await db.query("ALTER TABLE users MODIFY COLUMN name TEXT CHARACTER SET utf8mb4 NULL");
    console.log("อัปเดต users.name เป็น TEXT utf8mb4 สำเร็จ");
  } finally {
    await db.end();
  }
}

migrate().catch((error) => {
  console.error("Migration users.name ล้มเหลว:", error.message);
  process.exitCode = 1;
});

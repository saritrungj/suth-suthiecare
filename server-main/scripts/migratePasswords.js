/**
 * ============================================================
 *  server/scripts/migratePasswords.js
 *  แปลง password เดิมที่เป็น plain text → bcrypt hash
 *
 *  รัน:  node server/scripts/migratePasswords.js
 *
 *  ขั้นตอน:
 *   1. ดึง user ทุกคนที่ password ยังไม่ใช่ bcrypt hash
 *   2. hash แต่ละ password ด้วย bcryptjs (cost 12)
 *   3. update กลับ DB
 *   4. แสดงสรุปผล
 * ============================================================
 */

require("dotenv").config();
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

// ── bcrypt hash จะขึ้นต้นด้วย $2b$ หรือ $2a$ เสมอ ──────────
function isAlreadyHashed(password) {
  return (
    typeof password === "string" &&
    (password.startsWith("$2b$") || password.startsWith("$2a$"))
  );
}

async function migratePasswords() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "suthie1",
  });

  console.log("\n🔌 เชื่อมต่อ DB:", process.env.DB_NAME || "suthie1");
  console.log("🔐 เริ่ม Migrate passwords → bcrypt hash\n");
  console.log("─".repeat(55));

  // ── ดึงทุก user ──────────────────────────────────────────
  const [users] = await conn.query("SELECT id, username, password FROM users");
  console.log(`📋 พบผู้ใช้ทั้งหมด: ${users.length} คน\n`);

  let countSkipped = 0;
  let countMigrated = 0;
  let countFailed = 0;

  for (const user of users) {
    const { id, username, password } = user;

    // ── ข้ามถ้า hash แล้ว ──────────────────────────────────
    if (isAlreadyHashed(password)) {
      console.log(`  ⚠️  [${id}] ${username.padEnd(20)} → ข้าม (hash แล้ว)`);
      countSkipped++;
      continue;
    }

    // ── ข้ามถ้า password ว่างเปล่า ─────────────────────────
    if (!password || password.trim() === "") {
      console.log(
        `  ⚠️  [${id}] ${username.padEnd(20)} → ข้าม (password ว่าง)`,
      );
      countSkipped++;
      continue;
    }

    try {
      // ── Hash password ──────────────────────────────────────
      const hashed = await bcrypt.hash(password, 12);

      // ── Update DB ──────────────────────────────────────────
      await conn.execute("UPDATE users SET password = ? WHERE id = ?", [
        hashed,
        id,
      ]);

      console.log(`  ✅ [${id}] ${username.padEnd(20)} → hash สำเร็จ`);
      countMigrated++;
    } catch (err) {
      console.error(
        `  ❌ [${id}] ${username.padEnd(20)} → ล้มเหลว:`,
        err.message,
      );
      countFailed++;
    }
  }

  // ── สรุปผล ────────────────────────────────────────────────
  console.log("\n" + "─".repeat(55));
  console.log("📊 สรุปผลการ Migrate:");
  console.log(`   ✅ สำเร็จ   : ${countMigrated} คน`);
  console.log(
    `   ⚠️  ข้าม    : ${countSkipped} คน (hash แล้ว หรือ password ว่าง)`,
  );
  console.log(`   ❌ ล้มเหลว  : ${countFailed} คน`);
  console.log("─".repeat(55));

  if (countFailed > 0) {
    console.log("\n⚠️  มีบางรายการล้มเหลว กรุณาตรวจสอบ log ด้านบน");
  } else if (countMigrated > 0) {
    console.log("\n🎉 Migrate สำเร็จทั้งหมด!");
    console.log("   ผู้ใช้ทุกคนสามารถ login ด้วย password เดิมได้ตามปกติ");
  } else {
    console.log("\n✅ ทุก password เป็น bcrypt hash แล้ว ไม่ต้องทำอะไรเพิ่ม");
  }

  console.log("\n📌 ขั้นตอนถัดไป:");
  console.log("   รัน: node server/scripts/migrateAES.js\n");

  await conn.end();
}

// ── ยืนยันก่อนรัน ────────────────────────────────────────────
const readline = require("readline");
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("\n⚠️  Script นี้จะแก้ไข password ของ user ทุกคนใน DB");
console.log(`   Database: ${process.env.DB_NAME || "suthie1"}`);
rl.question(
  '\nยืนยันการ Migrate? (พิมพ์ "yes" เพื่อดำเนินการ): ',
  async (answer) => {
    rl.close();
    if (answer.trim().toLowerCase() !== "yes") {
      console.log("\n❌ ยกเลิกการ Migrate\n");
      process.exit(0);
    }
    try {
      await migratePasswords();
    } catch (err) {
      console.error("\n❌ เกิดข้อผิดพลาด:", err.message);
      process.exit(1);
    }
  },
);

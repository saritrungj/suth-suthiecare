/**
 * ============================================================
 *  server/scripts/generateKeys.js
 *  สร้าง AES Key ใหม่สำหรับใส่ใน .env
 *  รัน:  node server/scripts/generateKeys.js
 * ============================================================
 */

const crypto = require("crypto");

const aesKey = crypto.randomBytes(32).toString("hex");
const searchKey = crypto.randomBytes(32).toString("hex");

console.log("\n🔑 Copy 2 บรรทัดนี้ไปวางในไฟล์ .env:\n");
console.log("─".repeat(70));
console.log(`AES_KEY=${aesKey}`);
console.log(`AES_SEARCH_KEY=${searchKey}`);
console.log("─".repeat(70));
console.log("\n⚠️  สำคัญมาก:");
console.log("  • ถ้า AES_KEY หาย → ข้อมูลใน DB จะอ่านไม่ได้ตลอดกาล");
console.log("  • Backup key ไว้ใน Password Manager เช่น Bitwarden, 1Password");
console.log("  • อย่า commit .env เข้า Git เด็ดขาด (.gitignore)");
console.log("");

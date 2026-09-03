// utils/telegram.js
const axios = require("axios");
require("dotenv").config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// 🟢 เพิ่มพารามิเตอร์ replyMarkup = null
async function sendTelegramAlert(message, replyMarkup = null) {
  console.log("🔍 TOKEN:", TELEGRAM_BOT_TOKEN ? "✅ มีค่า" : "❌ ไม่มีค่า");
  console.log("🔍 CHAT_ID:", TELEGRAM_CHAT_ID ? "✅ มีค่า" : "❌ ไม่มีค่า");

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error("❌ ไม่มี Token หรือ Chat ID กรุณาเช็ค .env");
    return;
  }

  try {
    // 🟢 สร้างก้อนข้อมูลเตรียมส่งไป
    const payload = {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "HTML",
    };

    // 🟢 ถ้ามีการแนบปุ่มมาด้วย ให้ยัดใส่ payload
    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }

    const result = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      payload,
    );
    console.log("✅ Telegram sent successfully");
  } catch (err) {
    console.error("❌ Telegram error:", err.response?.data || err.message);
  }
}

function dispatchTelegramAlert(
  message,
  replyMarkup = null,
  sender = sendTelegramAlert,
) {
  Promise.resolve()
    .then(() => sender(message, replyMarkup))
    .catch((err) => {
      console.error("[Telegram dispatch error]:", err?.message || err);
    });
}

module.exports = { sendTelegramAlert, dispatchTelegramAlert };

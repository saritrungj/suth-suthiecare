// utils/telegram.js
const axios = require("axios");
require("dotenv").config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// 🟢 เพิ่มพารามิเตอร์ replyMarkup = null
async function sendTelegramAlert() {
  throw Object.assign(new Error("GLOBAL_NOTIFICATION_RETIRED"), {
    status: 410,
    code: "GLOBAL_NOTIFICATION_RETIRED",
  });
}

function dispatchTelegramAlert(
  message,
  replyMarkup = null,
  sender = sendTelegramAlert,
) {
  Promise.resolve()
    .then(() => sender(message, replyMarkup))
    .catch((err) => {
      console.error(
        "[Telegram dispatch error]:",
        require("./safeError").safeError(err),
      );
    });
}

module.exports = { sendTelegramAlert, dispatchTelegramAlert };

const axios = require("axios");

const isTurnstileDisabled = () => process.env.DISABLE_TURNSTILE === "true";

async function verifyTurnstile(token, remoteip) {
  if (isTurnstileDisabled()) return true;
  if (!token || !process.env.TURNSTILE_SECRET_KEY) return false;
  try {
    const params = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY, response: token });
    if (remoteip) params.append("remoteip", remoteip);
    const response = await axios.post("https://challenges.cloudflare.com/turnstile/v0/siteverify", params, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 8000,
    });
    return response.data.success === true;
  } catch { return false; }
}

module.exports = { isTurnstileDisabled, verifyTurnstile };

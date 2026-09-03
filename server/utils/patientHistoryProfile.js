const { decrypt, validateThaiPhone } = require("./encryption");

const normalizePhone = (value) => String(value || "").replace(/\D/g, "");

function extractExistingPhone(rows = []) {
  for (const row of rows) {
    let summary = row?.summary_data;
    try {
      summary = typeof summary === "string" ? JSON.parse(summary) : summary || {};
    } catch {
      summary = {};
    }

    const answers = summary.raw_answers || {};
    const candidate =
      summary.display_phone ||
      summary.phone ||
      answers.phone ||
      answers["เบอร์โทร"] ||
      answers["เบอร์โทรศัพท์"] ||
      Object.entries(answers).find(([key]) => /โทร|phone|mobile/i.test(key))?.[1];
    if (!candidate) continue;

    const phone = normalizePhone(decrypt(candidate));
    if (validateThaiPhone(phone)) return phone;
  }
  return null;
}

module.exports = { extractExistingPhone };

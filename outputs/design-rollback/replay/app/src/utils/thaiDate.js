// Dates typed as วว/ดด/ปปปป in the Buddhist era, sent to the API as
// YYYY-MM-DD (Christian era). Mirrors normalizeBirthDate on the server
// (server/utils/studentImport.js): a year above 2400 is Buddhist.

const pad = (n) => String(n).padStart(2, "0");

// "2013-05-31" -> "31/05/2556"; anything else -> "".
export function isoToThai(iso) {
  const match = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "";
  const [, year, month, day] = match;
  return `${day}/${month}/${Number(year) + 543}`;
}

// Keeps digits only and inserts the slashes while typing: "3105255" -> "31/05/255".
export function maskThaiDate(text) {
  const digits = String(text || "")
    .replace(/\D/g, "")
    .slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

// "31/05/2556" -> { iso: "2013-05-31" }; "" -> { iso: "" };
// an impossible or future date -> { error }.
export function parseThaiDate(text, { allowFuture = false, today } = {}) {
  const raw = String(text || "").trim();
  if (!raw) return { iso: "" };
  const match = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!match) return { error: "format" };
  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = Number(match[3]);
  if (year > 2400) year -= 543;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    year < 1900
  )
    return { error: "invalid" };
  const iso = `${year}-${pad(month)}-${pad(day)}`;
  if (!allowFuture) {
    const now = today || new Date();
    const todayIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    if (iso > todayIso) return { error: "future" };
  }
  return { iso };
}

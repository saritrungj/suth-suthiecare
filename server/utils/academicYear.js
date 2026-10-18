// Thai school years start in May, using the school's Bangkok calendar.
function currentAcademicYear(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "numeric",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return Number(parts.year) + 543 - (Number(parts.month) < 5 ? 1 : 0);
}
function validAcademicYear(value, now = new Date()) {
  return (
    /^\d{4}$/.test(String(value)) &&
    Number(value) >= currentAcademicYear(now) - 10
  );
}
module.exports = { currentAcademicYear, validAcademicYear };

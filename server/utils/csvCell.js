// One quoted CSV cell. A leading formula character is prefixed so a
// spreadsheet never runs it.
function csvCell(value) {
  const text = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

module.exports = { csvCell };

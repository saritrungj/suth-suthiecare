const { csvCell } = require("./csvCell");

// Sends a UTF-8 CSV (with BOM, so Excel reads Thai) as a download.
function sendCsv(res, fileName, header, rows) {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(","));
  res.set({
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    "Cache-Control": "no-store",
  });
  res.send(`﻿${lines.join("\r\n")}`);
}

module.exports = { sendCsv };

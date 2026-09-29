// RFC 4180-style CSV rows, including quoted commas/newlines and escaped quotes.
export function parseAgencyCsv(text) {
  const input = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [],
    field = "",
    quoted = false,
    closed = false;
  const pushField = () => {
    row.push(field);
    field = "";
    closed = false;
  };
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += char;
    } else if (char === ",") pushField();
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      pushField();
      rows.push(row);
      row = [];
    } else if (char === '"' && !field && !closed) quoted = true;
    else {
      if (closed || char === '"') throw new Error("รูปแบบ CSV ไม่ถูกต้อง");
      field += char;
    }
  }
  if (quoted) throw new Error("CSV มีเครื่องหมายคำพูดที่ไม่ครบคู่");
  if (field || row.length || closed) {
    pushField();
    rows.push(row);
  }
  if (rows.some((values) => values.some((value) => /^\s*[=+@]/.test(value))))
    throw new Error("ไม่อนุญาตให้ใช้สูตรในไฟล์นำเข้า");
  return rows;
}

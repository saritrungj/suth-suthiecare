// The school's document library: handbooks, forms and guidelines from the
// health promotion team. Files live in school_document_files; their type is
// read from the file's own signature, never from the name or the client.
const DEFAULT_CATEGORIES = ["คู่มือ", "แบบฟอร์ม", "แนวทาง", "ประชาสัมพันธ์"];
const AUDIENCES = Object.freeze({
  all_staff: "บุคลากรทุกคน",
  mental_staff: "ทีมสุขภาพใจ",
  physical_staff: "ทีมสุขภาพกาย",
  students: "นักเรียน",
});
const MAX_BYTES = 10 * 1024 * 1024;
const OFFICE = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

// Returns { buffer, mime, name } or { error }.
function decodeFile(file) {
  if (!file || typeof file.data !== "string" || typeof file.name !== "string")
    return { error: "กรุณาเลือกไฟล์" };
  const name = file.name
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
    .slice(0, 200);
  const base64 = file.data.replace(/^data:[^;]*;base64,/, "");
  if (!/^[A-Za-z0-9+/=\s]+$/.test(base64)) return { error: "ไฟล์ไม่ถูกต้อง" };
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length) return { error: "ไฟล์ว่างเปล่า" };
  if (buffer.length > MAX_BYTES) return { error: "ไฟล์ใหญ่เกิน 10 MB" };
  const ext = (name.split(".").pop() || "").toLowerCase();
  const starts = (...bytes) => bytes.every((b, i) => buffer[i] === b);
  let mime = null;
  if (starts(0x25, 0x50, 0x44, 0x46, 0x2d) && ext === "pdf")
    mime = "application/pdf";
  else if (starts(0x89, 0x50, 0x4e, 0x47) && ext === "png") mime = "image/png";
  else if (starts(0xff, 0xd8, 0xff) && ["jpg", "jpeg"].includes(ext))
    mime = "image/jpeg";
  else if (starts(0x50, 0x4b, 0x03, 0x04) && OFFICE[ext]) mime = OFFICE[ext];
  if (!mime)
    return {
      error: "รองรับไฟล์ PDF, Word, Excel, PowerPoint, PNG และ JPG เท่านั้น",
    };
  return { buffer, mime, name: name || `document.${ext}` };
}

function validUrl(value) {
  if (typeof value !== "string" || value.length > 1000) return false;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function normalizeAudience(value) {
  if (!Array.isArray(value)) return null;
  const list = [...new Set(value)];
  return list.length && list.every((a) => Object.hasOwn(AUDIENCES, a))
    ? list
    : null;
}

const parseAudience = (value) => {
  try {
    const list = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(list) ? list : ["all_staff"];
  } catch {
    return ["all_staff"];
  }
};

// A staff member reads a document when the roles page lets them view the
// library and the document is meant for them. Those who edit or arrange the
// library see every document.
function staffCanSee(access, rights, doc) {
  if (access.isSystemAdmin || rights.update || rights.assign || rights.delete)
    return true;
  if (!rights.view || doc.status !== "active") return false;
  const audience = parseAudience(doc.audience);
  return (
    audience.includes("all_staff") ||
    (audience.includes("mental_staff") && Boolean(access.canMental)) ||
    (audience.includes("physical_staff") && Boolean(access.canPhysical))
  );
}

async function categoriesFor(connection, schoolId, { all = false } = {}) {
  const [[count]] = await connection.query(
    "SELECT COUNT(*) AS n FROM school_document_categories WHERE school_id=?",
    [schoolId],
  );
  if (!Number(count.n))
    await connection.query(
      "INSERT INTO school_document_categories (school_id,name,sort_order) VALUES ?",
      [DEFAULT_CATEGORIES.map((name, i) => [schoolId, name, i + 1])],
    );
  const [rows] = await connection.query(
    `SELECT id,name,sort_order,status FROM school_document_categories WHERE school_id=?${all ? "" : " AND status='active'"} ORDER BY sort_order,id`,
    [schoolId],
  );
  return rows;
}

const DOCUMENT_SELECT = `SELECT d.id,d.school_id,d.category_id,d.title,d.description,d.kind,d.url,d.mime,d.size_bytes,
    d.audience,d.status,d.uploaded_by,d.updated_by,d.created_at,d.updated_at,c.name AS category_name,
    f.file_name,u.name AS uploader_name,u.username AS uploader_username
  FROM school_documents d
  JOIN schools s ON s.id=d.school_id
  LEFT JOIN school_document_categories c ON c.id=d.category_id
  LEFT JOIN school_document_files f ON f.document_id=d.id
  LEFT JOIN users u ON u.id=d.uploaded_by`;

function documentView(row) {
  return {
    id: row.id,
    school_id: row.school_id,
    category_id: row.category_id,
    category_name: row.category_name,
    title: row.title,
    description: row.description || "",
    kind: row.kind,
    url: row.kind === "link" ? row.url : null,
    file_name: row.file_name || null,
    mime: row.mime,
    size_bytes: row.size_bytes,
    audience: parseAudience(row.audience),
    status: row.status,
    uploader_name:
      require("../utils/privateField").readField(
        row.uploader_name,
        "users",
        "name",
      ) ||
      row.uploader_username ||
      null,
    updated_at: row.updated_at,
  };
}

// File download headers that keep the browser from running the file.
function sendFile(res, { buffer, mime, name }) {
  res.set({
    "Content-Type": mime,
    "Content-Length": buffer.length,
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  });
  res.end(buffer);
}

module.exports = {
  AUDIENCES,
  MAX_BYTES,
  DEFAULT_CATEGORIES,
  DOCUMENT_SELECT,
  decodeFile,
  validUrl,
  normalizeAudience,
  parseAudience,
  staffCanSee,
  categoriesFor,
  documentView,
  sendFile,
};

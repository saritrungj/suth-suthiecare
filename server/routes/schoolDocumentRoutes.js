// Staff side of the document library (roles page school_documents.*):
// view/download, create = upload or add a link, update = edit, assign =
// categories and who may see a document, delete = hide it.
const express = require("express");
const db = require("../config/db");
const { requiredAudit } = require("../utils/pdpaAudit");
const docs = require("../services/schoolDocuments");
const router = express.Router();
const fail = (res, status, message) => res.status(status).json({ message });
const positiveId = (value) =>
  /^\d+$/.test(String(value)) && Number(value) > 0 ? Number(value) : null;
const PAGE_SIZES = [10, 20, 50];

router.use(["/documents", "/document-categories"], (req, res, next) =>
  req.schoolAccess ? next() : fail(res, 422, "กรุณาเลือกโรงเรียน"),
);
const rights = (req) =>
  Object.fromEntries(
    ["view", "create", "update", "delete", "assign", "export"].map((a) => [
      a,
      Boolean(
        req.schoolAccess.isSystemAdmin || req.schoolAccess.documents?.[a],
      ),
    ]),
  );
const anyRight = (r) => r.view || r.create || r.update || r.delete || r.assign;

async function schoolInUnit(req, schoolId) {
  const [[school]] = await db.query(
    "SELECT id FROM schools WHERE id=? AND organization_id=?",
    [positiveId(schoolId) || 0, req.organizationContext],
  );
  return school || null;
}
async function inTransaction(work) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

router.get("/document-categories", async (req, res) => {
  if (!anyRight(rights(req))) return fail(res, 403, "ไม่มีสิทธิ์ดูคลังเอกสาร");
  const school = await schoolInUnit(req, req.query.school_id);
  if (!school) return fail(res, 404, "ไม่พบโรงเรียน");
  res.json({
    categories: await docs.categoriesFor(db, school.id, {
      all: rights(req).assign,
    }),
    audiences: docs.AUDIENCES,
    actions: rights(req),
  });
});

// Replaces the category list ([{ id?, name, status }]); in-use categories
// are deactivated, never deleted.
router.put("/document-categories", async (req, res) => {
  if (!rights(req).assign) return fail(res, 403, "ไม่มีสิทธิ์จัดหมวดเอกสาร");
  const school = await schoolInUnit(req, req.body?.school_id);
  if (!school) return fail(res, 404, "ไม่พบโรงเรียน");
  const list = req.body?.categories;
  if (
    !Array.isArray(list) ||
    !list.length ||
    list.length > 30 ||
    list.some(
      (c) =>
        typeof c?.name !== "string" ||
        !c.name.trim() ||
        c.name.trim().length > 120 ||
        !["active", "inactive"].includes(c.status || "active") ||
        (c.id != null && !positiveId(c.id)),
    )
  )
    return fail(res, 422, "หมวดเอกสารไม่ถูกต้อง");
  await inTransaction(async (c) => {
    await docs.categoriesFor(c, school.id);
    for (const [i, cat] of list.entries())
      if (cat.id)
        await c.query(
          "UPDATE school_document_categories SET name=?,status=?,sort_order=? WHERE id=? AND school_id=?",
          [cat.name.trim(), cat.status || "active", i + 1, cat.id, school.id],
        );
      else
        await c.query(
          "INSERT INTO school_document_categories (school_id,name,status,sort_order) VALUES (?,?,?,?)",
          [school.id, cat.name.trim(), cat.status || "active", i + 1],
        );
    await requiredAudit(
      req,
      "school_documents.categories",
      "school",
      school.id,
      {},
      c,
    );
  });
  res.json({ success: true });
});

router.get("/documents", async (req, res) => {
  const r = rights(req);
  if (!anyRight(r)) return fail(res, 403, "ไม่มีสิทธิ์ดูคลังเอกสาร");
  const school = await schoolInUnit(req, req.query.school_id);
  if (!school) return fail(res, 404, "ไม่พบโรงเรียน");
  const where = ["d.school_id=?"],
    params = [school.id];
  if (positiveId(req.query.category_id)) {
    where.push("d.category_id=?");
    params.push(Number(req.query.category_id));
  }
  if (req.query.status === "hidden" && (r.update || r.delete))
    where.push("d.status='hidden'");
  else where.push("d.status='active'");
  const [rows] = await db.query(
    `${docs.DOCUMENT_SELECT} WHERE ${where.join(" AND ")} ORDER BY d.updated_at DESC,d.id DESC LIMIT 1000`,
    params,
  );
  const search = String(req.query.q || "")
    .trim()
    .toLocaleLowerCase();
  const items = rows
    .filter((row) => docs.staffCanSee(req.schoolAccess, r, row))
    .map(docs.documentView)
    .filter(
      (d) =>
        !search ||
        `${d.title} ${d.description} ${d.category_name || ""} ${d.file_name || ""}`
          .toLocaleLowerCase()
          .includes(search),
    );
  if (req.query.format === "csv") {
    if (!r.export) return fail(res, 403, "ไม่มีสิทธิ์ส่งออกรายการเอกสาร");
    return require("../utils/sendCsv").sendCsv(
      res,
      "รายการเอกสาร.csv",
      [
        "ชื่อเอกสาร",
        "หมวด",
        "ชนิด",
        "ไฟล์หรือลิงก์",
        "ผู้มองเห็น",
        "สถานะ",
        "ผู้เพิ่ม",
        "ปรับปรุงล่าสุด",
      ],
      items.map((d) => [
        d.title,
        d.category_name,
        d.kind === "file" ? "ไฟล์" : "ลิงก์",
        d.kind === "file" ? d.file_name : d.url,
        d.audience.map((a) => docs.AUDIENCES[a] || a).join(", "),
        d.status === "active" ? "ใช้งาน" : "ซ่อน",
        d.uploader_name,
        d.updated_at instanceof Date
          ? d.updated_at.toISOString().slice(0, 10)
          : String(d.updated_at || "").slice(0, 10),
      ]),
    );
  }
  const limit = PAGE_SIZES.includes(Number(req.query.limit))
    ? Number(req.query.limit)
    : 10;
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  res.set("Cache-Control", "no-store");
  res.json({
    data: items.slice((page - 1) * limit, page * limit),
    pagination: {
      total: items.length,
      page,
      limit,
      total_pages: Math.max(1, Math.ceil(items.length / limit)),
    },
  });
});

// Shared checks for a new or edited document body.
async function readBody(req, school, { requireContent }) {
  const b = req.body || {};
  const title = typeof b.title === "string" ? b.title.trim() : "";
  const description =
    typeof b.description === "string" ? b.description.trim() : "";
  if (!title || title.length > 200 || description.length > 2000)
    return { error: "กรุณาตั้งชื่อเอกสาร (ไม่เกิน 200 ตัวอักษร)" };
  let categoryId = null;
  if (b.category_id) {
    const [[category]] = await db.query(
      "SELECT id FROM school_document_categories WHERE id=? AND school_id=?",
      [positiveId(b.category_id) || 0, school.id],
    );
    if (!category) return { error: "ไม่พบหมวดเอกสาร" };
    categoryId = category.id;
  }
  const value = {
    title,
    description: description || null,
    category_id: categoryId,
  };
  if (b.kind === "link" || (!requireContent && b.url !== undefined)) {
    if (!docs.validUrl(b.url))
      return { error: "ลิงก์ต้องขึ้นต้นด้วย https:// หรือ http://" };
    value.kind = "link";
    value.url = b.url;
  } else if (b.kind === "file" || (!requireContent && b.file)) {
    const file = docs.decodeFile(b.file);
    if (file.error) return file;
    value.kind = "file";
    value.file = file;
  } else if (requireContent) return { error: "กรุณาแนบไฟล์หรือใส่ลิงก์" };
  if (b.audience !== undefined) {
    // Only those who arrange the library decide who may see a document.
    if (!rights(req).assign)
      return { error: "ไม่มีสิทธิ์กำหนดผู้มองเห็นเอกสาร", status: 403 };
    const audience = docs.normalizeAudience(b.audience);
    if (!audience) return { error: "กรุณาเลือกผู้มองเห็นอย่างน้อยหนึ่งกลุ่ม" };
    value.audience = audience;
  }
  return { value };
}

router.post("/documents", async (req, res) => {
  if (!rights(req).create) return fail(res, 403, "ไม่มีสิทธิ์เพิ่มเอกสาร");
  const school = await schoolInUnit(req, req.body?.school_id);
  if (!school) return fail(res, 404, "ไม่พบโรงเรียน");
  const body = await readBody(req, school, { requireContent: true });
  if (body.error) return fail(res, body.status || 422, body.error);
  const v = body.value;
  const id = await inTransaction(async (c) => {
    const [r] = await c.query(
      `INSERT INTO school_documents (school_id,category_id,title,description,kind,storage_key,url,mime,size_bytes,audience,uploaded_by,updated_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        school.id,
        v.category_id,
        v.title,
        v.description,
        v.kind,
        v.kind === "file" ? "db" : null,
        v.kind === "link" ? v.url : null,
        v.kind === "file" ? v.file.mime : null,
        v.kind === "file" ? v.file.buffer.length : null,
        JSON.stringify(v.audience || ["all_staff"]),
        req.user.id,
        req.user.id,
      ],
    );
    if (v.kind === "file")
      await c.query(
        "INSERT INTO school_document_files (document_id,file_name,content) VALUES (?,?,?)",
        [r.insertId, v.file.name, v.file.buffer],
      );
    await requiredAudit(
      req,
      "school_documents.create",
      "school",
      school.id,
      { document_id: r.insertId },
      c,
    );
    return r.insertId;
  });
  res.status(201).json({ id });
});

async function loadDocument(req) {
  const [[row]] = await db.query(
    `${docs.DOCUMENT_SELECT} WHERE d.id=? AND s.organization_id=?`,
    [positiveId(req.params.id) || 0, req.organizationContext],
  );
  return row || null;
}

router.put("/documents/:id", async (req, res) => {
  if (!rights(req).update && !rights(req).assign)
    return fail(res, 403, "ไม่มีสิทธิ์แก้ไขเอกสาร");
  const row = await loadDocument(req);
  if (!row) return fail(res, 404, "ไม่พบเอกสาร");
  const school = { id: row.school_id };
  // Arranging alone (assign) may move a document or change who sees it.
  const body = await readBody(req, school, { requireContent: false });
  if (body.error) return fail(res, body.status || 422, body.error);
  const v = body.value;
  if (
    !rights(req).update &&
    (v.kind ||
      v.title !== row.title ||
      (v.description || null) !== (row.description || null))
  )
    return fail(res, 403, "ไม่มีสิทธิ์แก้ไขเนื้อหาเอกสาร");
  const restore =
    req.body?.status === "active" &&
    row.status === "hidden" &&
    rights(req).delete;
  await inTransaction(async (c) => {
    await c.query(
      `UPDATE school_documents SET title=?,description=?,category_id=?,updated_by=?${v.audience ? ",audience=?" : ""}${v.kind === "link" ? ",kind='link',url=?,mime=NULL,size_bytes=NULL,storage_key=NULL" : ""}${v.kind === "file" ? ",kind='file',url=NULL,mime=?,size_bytes=?,storage_key='db'" : ""}${restore ? ",status='active'" : ""} WHERE id=?`,
      [
        v.title,
        v.description,
        v.category_id,
        req.user.id,
        ...(v.audience ? [JSON.stringify(v.audience)] : []),
        ...(v.kind === "link" ? [v.url] : []),
        ...(v.kind === "file" ? [v.file.mime, v.file.buffer.length] : []),
        row.id,
      ],
    );
    if (v.kind === "link")
      await c.query("DELETE FROM school_document_files WHERE document_id=?", [
        row.id,
      ]);
    if (v.kind === "file")
      await c.query(
        "INSERT INTO school_document_files (document_id,file_name,content) VALUES (?,?,?) ON DUPLICATE KEY UPDATE file_name=VALUES(file_name),content=VALUES(content)",
        [row.id, v.file.name, v.file.buffer],
      );
    await requiredAudit(
      req,
      "school_documents.update",
      "school",
      row.school_id,
      { document_id: row.id },
      c,
    );
  });
  res.json({ success: true });
});

// Hides a document; it stays for the record and can be restored.
router.delete("/documents/:id", async (req, res) => {
  if (!rights(req).delete) return fail(res, 403, "ไม่มีสิทธิ์ลบเอกสาร");
  const row = await loadDocument(req);
  if (!row) return fail(res, 404, "ไม่พบเอกสาร");
  await db.query(
    "UPDATE school_documents SET status='hidden',updated_by=? WHERE id=?",
    [req.user.id, row.id],
  );
  await requiredAudit(req, "school_documents.delete", "school", row.school_id, {
    document_id: row.id,
  });
  res.json({ success: true });
});

router.get("/documents/:id/file", async (req, res) => {
  const row = await loadDocument(req);
  if (
    !row ||
    row.kind !== "file" ||
    !docs.staffCanSee(req.schoolAccess, rights(req), row)
  )
    return fail(res, 404, "ไม่พบเอกสาร");
  const [[file]] = await db.query(
    "SELECT file_name,content FROM school_document_files WHERE document_id=?",
    [row.id],
  );
  if (!file) return fail(res, 404, "ไม่พบไฟล์");
  docs.sendFile(res, {
    buffer: file.content,
    mime: row.mime,
    name: file.file_name,
  });
});

module.exports = router;

// Documents the school shares with its students ("นักเรียน" audience), for a
// signed-in student account. Mounted under /api/patient.
const express = require("express");
const db = require("../config/db");
const { verifyPatientToken } = require("../middleware/patientAuthMiddleware");
const docs = require("../services/schoolDocuments");
const { studentsForPatient } = require("../services/schoolAppointments");
const router = express.Router();
const positiveId = (value) =>
  /^\d+$/.test(String(value)) && Number(value) > 0 ? Number(value) : null;

router.use("/school-documents", verifyPatientToken);

async function studentDocuments(req, id = null) {
  const schools = [
    ...new Set(
      (await studentsForPatient(db, req.patient.id)).map((s) => s.school_id),
    ),
  ];
  if (!schools.length) return null;
  const [rows] = await db.query(
    `${docs.DOCUMENT_SELECT} WHERE d.school_id IN (?) AND d.status='active'${id ? " AND d.id=?" : ""} ORDER BY c.sort_order,d.updated_at DESC LIMIT 500`,
    [schools, ...(id ? [id] : [])],
  );
  return rows.filter((row) =>
    docs.parseAudience(row.audience).includes("students"),
  );
}

router.get("/school-documents", async (req, res) => {
  const rows = await studentDocuments(req);
  res.set("Cache-Control", "no-store");
  if (!rows) return res.json({ success: true, eligible: false, documents: [] });
  res.json({
    success: true,
    eligible: true,
    documents: rows.map((row) => {
      const { uploader_name, audience, status, ...rest } =
        docs.documentView(row);
      return rest;
    }),
  });
});

router.get("/school-documents/:id/file", async (req, res) => {
  const [row] =
    (await studentDocuments(req, positiveId(req.params.id) || 0)) || [];
  if (!row || row.kind !== "file")
    return res.status(404).json({ success: false, message: "ไม่พบเอกสาร" });
  const [[file]] = await db.query(
    "SELECT file_name,content FROM school_document_files WHERE document_id=?",
    [row.id],
  );
  if (!file)
    return res.status(404).json({ success: false, message: "ไม่พบไฟล์" });
  docs.sendFile(res, {
    buffer: file.content,
    mime: row.mime,
    name: file.file_name,
  });
});

module.exports = router;

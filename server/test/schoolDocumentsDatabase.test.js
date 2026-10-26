const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const crypto = require("crypto");

// Document library against local MySQL (rolled back): a manager uploads, the
// audience decides who reads and downloads, students see only theirs, hidden
// documents disappear, and narrower rights are refused.
test(
  "local MySQL shares each document only with its audience",
  { skip: process.env.SCHOOL_DB_TESTS !== "1", timeout: 60000 },
  async () => {
    require("../config/env");
    assert.ok(
      ["localhost", "127.0.0.1", "::1"].includes(process.env.DB_HOST),
      "Integration fixture is restricted to local MySQL",
    );
    const pool = require("../config/db"),
      connection = await pool.getConnection();
    let server;
    try {
      await connection.beginTransaction();
      await connection.query("SET time_zone='+07:00'");
      const q = connection.query.bind(connection);
      const [[school]] = await q(
        "SELECT s.id,s.organization_id FROM schools s JOIN organizations o ON o.id=s.organization_id WHERE o.org_type='school' LIMIT 1",
      );
      assert.ok(school, "Requires a local school fixture");
      const [[account]] = await q(
        `SELECT pa.id,pa.token_version FROM patient_accounts pa WHERE pa.status='active' AND COALESCE(pa.must_change_password,0)=0
          AND NOT EXISTS (SELECT 1 FROM school_students ss WHERE ss.patient_account_id=pa.id) ORDER BY RAND() LIMIT 1`,
      );
      assert.ok(
        account,
        "Requires an active patient account not linked to a student",
      );
      const [[role]] = await q("SELECT id FROM roles ORDER BY id LIMIT 1");
      const tag = crypto.randomBytes(4).toString("hex");
      const user = async (name, duty) => {
        const [u] = await q(
          "INSERT INTO users (username,password,status) VALUES (?,'x','active')",
          [`${name}_${tag}`],
        );
        await q(
          "INSERT INTO organization_memberships (organization_id,user_id,role_id,status) VALUES (?,?,?,'active')",
          [school.organization_id, u.insertId, role.id],
        );
        if (duty)
          await q(
            "INSERT INTO school_staff_roles (school_id,user_id,role_code,status) VALUES (?,?,?,'active')",
            [school.id, u.insertId, duty],
          );
        return u.insertId;
      };
      const manager = await user("mgr", "admin"),
        teacher = await user("tch", "other"),
        counselor = await user("cs", "counselor"),
        arranger = await user("arr", "admin");
      await q(
        "INSERT INTO school_students (school_id,student_code,status,patient_account_id) VALUES (?,?,'active',?)",
        [school.id, `doc_${tag}`, account.id],
      );
      const { sha, csrf } = require("../services/sessionService");
      const token = crypto.randomBytes(32).toString("base64url");
      await q(
        "INSERT INTO auth_sessions (token_hash,account_type,account_id,auth_version,csrf_hash,last_seen_at,expires_at) VALUES (?,?,?,?,?,NOW(),DATE_ADD(NOW(),INTERVAL 1 HOUR))",
        [
          sha(token),
          "patient",
          account.id,
          Number(account.token_version || 0),
          sha(csrf(token)),
        ],
      );

      const db = {
        query: q,
        getConnection: async () => ({
          query: q,
          beginTransaction: async () => {},
          commit: async () => {},
          rollback: async () => {},
          release: () => {},
        }),
      };
      require.cache[require.resolve("../config/db")] = { exports: db };
      for (const p of [
        "../routes/schoolDocumentRoutes",
        "../routes/patientSchoolDocumentRoutes",
        "../middleware/patientAuthMiddleware",
        "../utils/patientAuth",
        "../services/sessionService",
        "../services/schoolAppointments",
        "../utils/pdpaAudit",
      ])
        delete require.cache[require.resolve(p)];
      const { loadSchoolAccess } = require("../utils/schoolAccess");
      const { expandManage } = require("../authorization/permissionMatrix");
      const keys = {
        [manager]: ["school_documents.manage"],
        [teacher]: ["school_documents.view"],
        [counselor]: [
          "school_documents.view",
          "clinical.view",
          "student_health.view",
          "students.view",
        ],
        [arranger]: ["school_documents.view", "school_documents.assign"],
      };
      let actor = manager;
      const app = express();
      app.use(require("cookie-parser")());
      app.use(express.json({ limit: "25mb" }));
      app.use("/patient", require("../routes/patientSchoolDocumentRoutes"));
      app.use("/school", async (req, res, next) => {
        req.user = { id: actor };
        req.organizationContext = school.organization_id;
        req.authorization = {
          isSystemAdmin: false,
          permissions: new Set(expandManage(keys[actor])),
        };
        req.schoolAccess = await loadSchoolAccess(db, req);
        next();
      });
      app.use("/school", require("../routes/schoolDocumentRoutes"));
      app.use((e, req, res, next) =>
        res.status(e.status || 500).json({ message: e.message }),
      );
      server = app.listen(0, "127.0.0.1");
      await new Promise((r) => server.once("listening", r));
      const origin = (
        process.env.CORS_ORIGINS ||
        process.env.FRONTEND_URL ||
        "http://localhost:3001"
      )
        .split(",")[0]
        .trim();
      const call = async (path, method = "GET", body, as) => {
        if (as) actor = as;
        const r = await fetch(
          `http://127.0.0.1:${server.address().port}${path}`,
          {
            method,
            headers: {
              "Content-Type": "application/json",
              ...(path.startsWith("/patient")
                ? {
                    Cookie: `suth_patient_session=${token}`,
                    "X-CSRF-Token": csrf(token),
                    Origin: origin,
                  }
                : {}),
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
          },
        );
        const type = r.headers.get("content-type") || "";
        return {
          status: r.status,
          headers: r.headers,
          body: type.includes("json")
            ? await r.json()
            : Buffer.from(await r.arrayBuffer()),
        };
      };
      const pdfBytes = Buffer.concat([
        Buffer.from("%PDF-1.7\n"),
        Buffer.from("synthetic test document"),
      ]);
      const upload = (title, audience, as = manager) =>
        call(
          "/school/documents",
          "POST",
          {
            school_id: school.id,
            title,
            kind: "file",
            file: {
              name: "คู่มือทดสอบ.pdf",
              data: pdfBytes.toString("base64"),
            },
            ...(audience ? { audience } : {}),
          },
          as,
        );
      const cats = await call(
        `/school/document-categories?school_id=${school.id}`,
        "GET",
        null,
        manager,
      );
      assert.ok(cats.body.categories.length >= 4, "default categories");

      const mental = await upload(`แนวทางสุขภาพใจ ${tag}`, ["mental_staff"]);
      assert.equal(mental.status, 201, mental.body.message);
      const forStudents = await upload(`เอกสารนักเรียน ${tag}`, ["students"]);
      const link = await call("/school/documents", "POST", {
        school_id: school.id,
        title: `ลิงก์ ${tag}`,
        kind: "link",
        url: "https://example.org/guide",
      });
      assert.equal(link.status, 201);
      assert.equal(
        (
          await call("/school/documents", "POST", {
            school_id: school.id,
            title: "x",
            kind: "link",
            url: "javascript:alert(1)",
          })
        ).status,
        422,
      );

      const titles = async (as) =>
        (
          await call(
            `/school/documents?school_id=${school.id}&q=${tag}`,
            "GET",
            null,
            as,
          )
        ).body.data
          .map((d) => d.title)
          .sort();
      assert.deepEqual(
        await titles(teacher),
        [`ลิงก์ ${tag}`],
        "a teacher sees all-staff documents only",
      );
      assert.ok(
        (await titles(counselor)).includes(`แนวทางสุขภาพใจ ${tag}`),
        "the mental-health team sees theirs",
      );
      assert.equal(
        (
          await call(
            `/school/documents/${mental.body.id}/file`,
            "GET",
            null,
            teacher,
          )
        ).status,
        404,
      );
      const download = await call(
        `/school/documents/${mental.body.id}/file`,
        "GET",
        null,
        counselor,
      );
      assert.equal(download.status, 200);
      assert.ok(download.body.equals(pdfBytes));
      assert.equal(download.headers.get("content-type"), "application/pdf");
      assert.match(download.headers.get("content-disposition"), /^attachment;/);
      assert.equal(download.headers.get("x-content-type-options"), "nosniff");

      // Students: only the students audience, download included.
      const studentList = await call("/patient/school-documents");
      assert.equal(studentList.status, 200, studentList.body.message);
      const studentTitles = studentList.body.documents.map((d) => d.title);
      assert.ok(studentTitles.includes(`เอกสารนักเรียน ${tag}`));
      assert.ok(
        !studentTitles.includes(`แนวทางสุขภาพใจ ${tag}`) &&
          !studentTitles.includes(`ลิงก์ ${tag}`),
      );
      assert.equal(
        (await call(`/patient/school-documents/${forStudents.body.id}/file`))
          .status,
        200,
      );
      assert.equal(
        (await call(`/patient/school-documents/${mental.body.id}/file`)).status,
        404,
      );

      // Narrower rights: view-only cannot upload, setting the audience needs assign,
      // arranging cannot rewrite the content.
      assert.equal((await upload("x", null, teacher)).status, 403);
      assert.equal(
        (
          await call(
            `/school/documents/${link.body.id}`,
            "PUT",
            { title: `ลิงก์ ${tag}`, audience: ["students"] },
            arranger,
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await call(
            `/school/documents/${link.body.id}`,
            "PUT",
            { title: "ชื่อใหม่", audience: ["students"] },
            arranger,
          )
        ).status,
        403,
      );

      // The list exports only with school_documents.export.
      assert.equal(
        (
          await call(
            `/school/documents?school_id=${school.id}&format=csv`,
            "GET",
            null,
            teacher,
          )
        ).status,
        403,
      );
      const csv = await call(
        `/school/documents?school_id=${school.id}&format=csv`,
        "GET",
        null,
        manager,
      );
      assert.equal(csv.status, 200);
      assert.match(
        csv.body.toString("utf8"),
        new RegExp(`แนวทางสุขภาพใจ ${tag}`),
      );

      // Hiding removes it from readers.
      assert.equal(
        (
          await call(
            `/school/documents/${forStudents.body.id}`,
            "DELETE",
            null,
            manager,
          )
        ).status,
        200,
      );
      assert.ok(
        !(await call("/patient/school-documents")).body.documents.some(
          (d) => d.id === forStudents.body.id,
        ),
      );
    } finally {
      if (server) await new Promise((r) => server.close(r));
      await connection.rollback();
      connection.release();
      delete require.cache[require.resolve("../config/db")];
      await pool.end?.();
    }
  },
);

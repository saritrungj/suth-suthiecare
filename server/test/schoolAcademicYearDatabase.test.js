const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

test(
  "local MySQL persists unique school years and uses them for classrooms, with rollback",
  { skip: process.env.SCHOOL_DB_TESTS !== "1", timeout: 30000 },
  async () => {
    require("../config/env");
    assert.ok(["localhost", "127.0.0.1", "::1"].includes(process.env.DB_HOST));
    const pool = require("../config/db"),
      connection = await pool.getConnection();
    let server;
    try {
      await connection.beginTransaction();
      const [[school]] = await connection.query(
        "SELECT s.id,s.organization_id FROM schools s JOIN organizations o ON o.id=s.organization_id WHERE o.org_type='school' LIMIT 1",
      );
      assert.ok(school, "Requires a local school fixture");
      const [[grade]] = await connection.query(
        "SELECT id FROM school_grade_levels WHERE school_id=? LIMIT 1",
        [school.id],
      );
      assert.ok(grade);
      const { currentAcademicYear } = require("../utils/academicYear");
      let year = currentAcademicYear() + 1;
      while (
        (
          await connection.query(
            "SELECT 1 FROM school_academic_years WHERE school_id=? AND academic_year=?",
            [school.id, year],
          )
        )[0].length
      )
        year++;
      require.cache[require.resolve("../config/db")] = {
        exports: { query: connection.query.bind(connection) },
      };
      delete require.cache[require.resolve("../routes/schoolRoutes")];
      const app = express();
      app.use(express.json());
      app.use((req, res, next) => {
        req.user = { id: 1 };
        req.authorization = { isSystemAdmin: true };
        req.organizationContext = school.organization_id;
        req.schoolAccess = {
          isSystemAdmin: true,
          canViewSchool: true,
          canCreateSchool: true,
        };
        next();
      });
      app.use(require("../routes/schoolRoutes"));
      server = app.listen(0, "127.0.0.1");
      await new Promise((resolve) => server.once("listening", resolve));
      const request = (path, body) =>
        fetch(
          `http://127.0.0.1:${server.address().port}${path}`,
          body
            ? {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              }
            : {},
        );
      const endpoint = `/schools/${school.id}/academic-years`;
      assert.equal(
        (await request(endpoint, { academic_year: year })).status,
        201,
      );
      assert.equal(
        (await request(endpoint, { academic_year: year })).status,
        409,
      );
      const response = await request(endpoint);
      assert.equal(response.status, 200);
      assert.ok((await response.json()).years.includes(year));
      const room = await request(`/schools/${school.id}/classrooms`, {
        grade_level_id: grade.id,
        name: "year_test_" + Date.now(),
        academic_year: year,
      });
      assert.equal(room.status, 201);
      const roomId = (await room.json()).id;
      const [[stored]] = await connection.query(
        "SELECT academic_year FROM school_classrooms WHERE id=?",
        [roomId],
      );
      assert.equal(stored.academic_year, year);
      const rejected = await request(`/schools/${school.id}/classrooms`, {
        grade_level_id: grade.id,
        name: "invalid_year",
        academic_year: currentAcademicYear() - 11,
      });
      assert.equal(rejected.status, 422);
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      await connection.rollback();
      connection.release();
      await pool.end();
    }
  },
);

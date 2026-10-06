require("../config/env");
const test = require("node:test"),
  assert = require("node:assert/strict"),
  mysql = require("mysql2/promise");
test(
  "isolated MySQL schema, idempotent migration, JSON roundtrip and single-use race",
  { skip: process.env.PDPA_DB_TESTS !== "1", timeout: 60000 },
  async () => {
    if (
      !["localhost", "127.0.0.1", "::1"].includes(process.env.DB_HOST) ||
      process.env.NODE_ENV === "production"
    )
      throw new Error("LOCAL_TEST_DATABASE_REQUIRED");
    const name = "suth_pdpa_test_" + Date.now(),
      source = process.env.DB_NAME;
    const c = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });
    let pool;
    try {
      await c.query("CREATE DATABASE `" + name + "`");
      await c.query("USE `" + name + "`");
      await c.query("SET FOREIGN_KEY_CHECKS=0");
      const [tables] = await c.query(
        'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_TYPE="BASE TABLE"',
        [source],
      );
      for (const { TABLE_NAME: table } of tables) {
        const [[ddl]] = await c.query(
          "SHOW CREATE TABLE `" + source + "`.`" + table + "`",
        );
        await c.query(ddl["Create Table"]);
      }
      await c.query("SET FOREIGN_KEY_CHECKS=1");
      await c.query(
        "INSERT INTO organizations (id,code,name,org_level,org_type) VALUES (100001,'PERM-A','Synthetic A','unit','hospital'),(100002,'PERM-B','Synthetic B','unit','hospital')",
      );
      await c.query(
        "INSERT INTO roles (id,name) VALUES (100001,'Synthetic role')",
      );
      await c.query(
        "INSERT INTO role_permissions (role_id,permission_key) VALUES (100001,'cases.view')",
      );
      const { migrate } = require("../scripts/migratePdpaSecurity");
      await migrate(c);
      await migrate(c);
      const {
        organizationRolePermissions,
      } = require("../authorization/organizationPermissions");
      assert.deepEqual(await organizationRolePermissions(c, 100001, 100001), [
        "cases.view",
      ]);
      await c.query(
        "DELETE FROM organization_role_permissions WHERE organization_id=100001 AND role_id=100001",
      );
      await c.query(
        "INSERT INTO organization_role_permissions VALUES (100001,100001,'patient_members.view')",
      );
      await c.query(
        "UPDATE organization_role_permission_sets SET source='explicit',version=2 WHERE organization_id=100001 AND role_id=100001",
      );
      await c.query(
        "UPDATE role_permissions SET permission_key='forms.view' WHERE role_id=100001",
      );
      await migrate(c);
      assert.deepEqual(await organizationRolePermissions(c, 100001, 100001), [
        "patient_members.view",
      ]);
      assert.deepEqual(await organizationRolePermissions(c, 100002, 100001), [
        "cases.view",
      ]);
      await c.query(
        "INSERT INTO organizations (id,code,name,org_level,org_type) VALUES (100003,'PERM-C','Synthetic C','unit','hospital')",
      );
      await migrate(c);
      assert.deepEqual(
        await organizationRolePermissions(c, 100003, 100001),
        [],
      );
      const key = process.env.AES_KEY;
      process.env.AES_KEY = "b".repeat(64);
      await assert.rejects(
        require("../services/pdpaReadiness").schemaReadiness(c),
        { code: "CIPHERTEXT_AUTHENTICATION_FAILED" },
      );
      process.env.AES_KEY = key;
      const { sealJson, openJson } = require("../utils/privateData"),
        encoded = sealJson(
          { weight: 0, checked: false, options: ["ไทย"] },
          "synthetic:org:1",
        );
      await c.query(
        "CREATE TABLE pdpa_test_json (id INT PRIMARY KEY, payload JSON)",
      );
      await c.query("INSERT INTO pdpa_test_json VALUES (1,?)", [
        JSON.stringify(encoded),
      ]);
      const [[row]] = await c.query("SELECT payload FROM pdpa_test_json");
      assert.deepEqual(
        openJson(
          typeof row.payload === "string"
            ? JSON.parse(row.payload)
            : row.payload,
          "synthetic:org:1",
        ),
        { weight: 0, checked: false, options: ["ไทย"] },
      );
      await c.query("SET FOREIGN_KEY_CHECKS=0");
      await c.query(
        "INSERT INTO forms (id,title,organization_id,status,questions) VALUES (1,'Synthetic form',1,'published','[]')",
      );
      await c.query(
        "INSERT INTO mastercases (id,organization_id,clinicType,status) VALUES (1,1,'general','Open')",
      );
      await c.query(
        "INSERT INTO form_responses (id,form_id,organization_id,master_case_id,patient_account_id,summary_data) VALUES (1,1,1,1,1,?),(2,1,NULL,NULL,NULL,?)",
        [
          JSON.stringify({
            display_name: "Synthetic patient",
            raw_answers: { value: false },
          }),
          JSON.stringify({ display_name: "Unassigned synthetic" }),
        ],
      );
      const original = {
        number: 0,
        boolean: false,
        nothing: null,
        list: [1, "ไทย"],
        object: { a: 1 },
      };
      await c.query(
        'INSERT INTO form_answers (id,response_id,form_id,question_id,answer_value) VALUES (1,1,1,"typed",?)',
        [JSON.stringify(original)],
      );
      await c.query("SET FOREIGN_KEY_CHECKS=1");
      const {
        hash,
        resolveInvitation,
        consumeInvitation,
      } = require("../services/formInvitationService");
      const token = "a".repeat(43);
      await c.query(
        "INSERT INTO form_invitations (token_hash,form_id,organization_id,response_id,master_case_id,patient_account_id,created_by,expires_at) VALUES (?,1,1,1,1,1,1,DATE_ADD(NOW(),INTERVAL 1 DAY))",
        [hash(token)],
      );
      pool = mysql.createPool({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: name,
        connectionLimit: 2,
      });
      const consume = async () => {
        const connection = await pool.getConnection();
        try {
          await connection.beginTransaction();
          const invite = await resolveInvitation(
            connection,
            token,
            { id: 1 },
            1,
            { lock: true },
          );
          await consumeInvitation(connection, invite, 1);
          await connection.commit();
          return true;
        } catch (error) {
          await connection.rollback();
          if (error.code === "INVITATION_UNAVAILABLE") return false;
          throw error;
        } finally {
          connection.release();
        }
      };
      assert.deepEqual((await Promise.all([consume(), consume()])).sort(), [
        false,
        true,
      ]);
      const { run } = require("../scripts/backfillPrivateData");
      const dry = await run(pool, { batch: 1 });
      assert.equal(dry.dry_run, true);
      assert.equal(
        dry.results.find((v) => v.table === "form_responses").failed,
        1,
      );
      const applied = await run(pool, { apply: true, batch: 1 });
      assert.equal(
        applied.results.find((v) => v.table === "form_responses").failed,
        1,
      );
      const [[saved]] = await c.query(
        "SELECT answer_value FROM form_answers WHERE id=1",
      );
      const { normalizeStoredAnswer } = require("../utils/storedAnswer");
      assert.deepEqual(
        normalizeStoredAnswer(saved.answer_value, "", undefined, 1),
        original,
      );
      const rerun = await run(pool, { apply: true, batch: 1, resume: true });
      assert.equal(
        rerun.results.find((v) => v.table === "form_answers").completed,
        0,
      );
      const edited = { ...original, number: 1 };
      await c.query("UPDATE form_answers SET answer_value=? WHERE id=1", [
        JSON.stringify(sealJson(edited, "form_answers:answer_value:org:1")),
      ]);
      await run(pool, { apply: true, batch: 1 });
      await c.query("CREATE TABLE pdpa_test_restore LIKE form_answers");
      await c.query("INSERT INTO pdpa_test_restore SELECT * FROM form_answers");
      const [[restored]] = await c.query(
        "SELECT answer_value FROM pdpa_test_restore WHERE id=1",
      );
      assert.deepEqual(
        normalizeStoredAnswer(restored.answer_value, "", undefined, 1),
        edited,
      );
      const [[issue]] = await c.query(
        'SELECT reason_code FROM pdpa_migration_issues WHERE migration_key="private-v1:form_responses" AND record_id=2',
      );
      assert.equal(issue.reason_code, "OWNER_UNRESOLVED");
    } finally {
      if (pool) await pool.end();
      if (/^suth_pdpa_test_\d+$/.test(name))
        await c.query("DROP DATABASE IF EXISTS `" + name + "`");
      await c.end();
      await require("../config/db").end();
    }
  },
);

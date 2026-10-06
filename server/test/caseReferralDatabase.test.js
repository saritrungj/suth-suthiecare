require("../config/env");
const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { encrypt } = require("../utils/encryption");

test(
  "MySQL prevents duplicate open referrals across form responses of one case",
  {
    skip:
      process.env.REFERRAL_DB_TEST !== "true" ||
      !["localhost", "127.0.0.1", "::1"].includes(process.env.DB_HOST),
  },
  async () => {
    const db = require("../config/db");
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const orgIds = [];
      for (const label of ["source", "destination"]) {
        const [unit] = await connection.query(
          "INSERT INTO organizations (code,name,status,org_type,org_level) VALUES (?,?,'active','hospital','unit')",
          [`REF-TEST-${randomUUID()}`, `Referral test ${label} (synthetic)`],
        );
        orgIds.push(unit.insertId);
      }
      const [form] = await connection.query(
        "INSERT INTO forms (title,organization_id) VALUES (?,?)",
        ["Referral test form (synthetic)", orgIds[0]],
      );
      const [master] = await connection.query(
        "INSERT INTO mastercases (clinicType,organization_id,status) VALUES ('general',?,'Open')",
        [orgIds[0]],
      );
      const responses = [];
      for (let i = 0; i < 2; i += 1) {
        const [response] = await connection.query(
          "INSERT INTO form_responses (form_id,master_case_id,organization_id) VALUES (?,?,?)",
          [form.insertId, master.insertId, orgIds[0]],
        );
        responses.push(response.insertId);
      }
      const insert = (responseId) =>
        connection.query(
          "INSERT INTO case_referrals (source_organization_id,destination_organization_id,source_response_id,source_master_case_id,reason_encrypted,created_by) VALUES (?,?,?,?,?,?)",
          [
            ...orgIds,
            responseId,
            master.insertId,
            encrypt("Synthetic database test summary"),
            0,
          ],
        );
      const [first] = await insert(responses[0]);
      await assert.rejects(
        insert(responses[1]),
        (error) => error.code === "ER_DUP_ENTRY",
      );
      await connection.query(
        "UPDATE case_referrals SET status='completed',version=version+1 WHERE id=?",
        [first.insertId],
      );
      const [second] = await insert(responses[1]);
      assert.ok(second.insertId);
      const [rows] = await connection.query(
        "SELECT status,version,active_slot FROM case_referrals WHERE id IN (?,?) ORDER BY id",
        [first.insertId, second.insertId],
      );
      assert.equal(rows[0].status, "completed");
      assert.equal(rows[0].version, 2);
      assert.equal(rows[0].active_slot, null);
      assert.equal(rows[1].active_slot, 1);
    } finally {
      await connection.rollback();
      connection.release();
      await db.end();
    }
  },
);

const express = require("express");
const db = require("../config/db");
const { verifyToken } = require("../middleware/authMiddleware");
const {
  concreteOrganization,
  httpError,
} = require("../utils/operationalOwnership");
const { encrypt, decrypt } = require("../utils/encryption");
const { requiredAudit } = require("../utils/pdpaAudit");
const { fieldContext } = require("../utils/privateData");
const router = express.Router();
router.use((req, res, next) => {
  if (
    !/^\/(staffs|services|templates|case-statuses|status-options)(\/|$)/.test(
      req.path,
    )
  )
    return next();
  const action = ["GET", "HEAD"].includes(req.method)
    ? "view"
    : req.method === "POST"
      ? "create"
      : req.method === "DELETE"
        ? "delete"
        : "update";
  return verifyToken(req, res, () =>
    require("../authorization/authorization").requireAction(
      (req.path.startsWith("/staffs") ? "patient_members" : "cases") +
        "." +
        action,
    )(req, res, next),
  );
});
const definitions = [
  {
    paths: ["/staffs"],
    table: "staffs",
    fields: ["fullname"],
    required: ["fullname"],
    private: ["fullname"],
    active: "is_active",
  },
  {
    paths: ["/services"],
    table: "service_types",
    active: "is_active",
    fields: ["name", "color"],
    required: ["name"],
  },
  {
    paths: ["/templates"],
    table: "note_templates",
    active: "is_active",
    fields: ["clinic_type", "label", "text"],
    required: ["clinic_type", "label", "text"],
    private: ["text"],
  },
  {
    paths: ["/case-statuses", "/status-options"],
    table: "case_statuses",
    fields: ["name", "color", "clinic_type"],
    required: ["name"],
    active: "is_active",
  },
];
function fail(res, error) {
  res
    .status(
      error.status ||
        (error.code === "ER_NO_SUCH_TABLE" ||
        error.code === "ER_BAD_FIELD_ERROR"
          ? 503
          : 500),
    )
    .json({ message: error.status ? error.code : "LOOKUP_UNAVAILABLE" });
}
for (const def of definitions)
  for (const path of def.paths) {
    router.get(
      [path, ...(def.table === "case_statuses" ? [path + "/active"] : [])],
      verifyToken,
      async (req, res) => {
        try {
          const all =
            req.authorization?.isSystemAdmin &&
            req.organizationContext === "all";
          const org = all ? null : concreteOrganization(req);
          const params = all ? [] : [org];
          let where = all
            ? " WHERE organization_id IS NOT NULL"
            : " WHERE organization_id=?";
          if (def.active) where += ` AND ${def.active}=1`;
          if (
            def.fields.includes("clinic_type") &&
            (req.query.clinic_type || req.query.clinic)
          ) {
            where +=
              " AND (clinic_type=? OR clinic_type='all' OR clinic_type='general')";
            params.push(req.query.clinic_type || req.query.clinic);
          }
          const [rows] = await db.query(
            `SELECT id, organization_id, ${def.fields.join(",")} FROM ${def.table}${where} ORDER BY ${def.table === "staffs" ? "id" : "sort_order,id"}`,
            params,
          );
          const items = rows.map((row) =>
            Object.fromEntries(
              Object.entries(row).map(([key, value]) => [
                key,
                def.private?.includes(key)
                  ? require("../utils/privateField").readField(
                      value,
                      def.table,
                      key,
                      row.organization_id,
                    )
                  : value,
              ]),
            ),
          );
          res.json(items);
        } catch (error) {
          fail(res, error);
        }
      },
    );
    router.post(path, verifyToken, async (req, res) => {
      const connection = await db.getConnection();
      try {
        const org = concreteOrganization(req);
        const data = Object.fromEntries(
          def.fields
            .filter((key) => req.body[key] !== undefined)
            .map((key) => [key, req.body[key]]),
        );
        if (
          def.required.some(
            (key) => typeof data[key] !== "string" || !data[key].trim(),
          ) ||
          Object.values(data).some(
            (v) => typeof v !== "string" || v.length > 4000,
          )
        )
          throw httpError(422, "INVALID_LOOKUP");
        for (const [key, value] of Object.entries(data))
          if (
            value.length >
            {
              name: 100,
              color: 20,
              clinic_type: 50,
              label: 255,
              fullname: 255,
              text: 4000,
            }[key]
          )
            throw httpError(422, "LOOKUP_VALUE_TOO_LONG");
        if (def.fields.includes("color")) data.color ||= "#2d7d81";
        if (def.fields.includes("clinic_type")) data.clinic_type ||= "general";
        const keys = Object.keys(data),
          values = keys.map((key) =>
            def.private?.includes(key)
              ? encrypt(data[key].trim(), fieldContext(def.table, key, org))
              : data[key].trim(),
          );
        await connection.beginTransaction();
        const [result] = await connection.query(
          `INSERT INTO ${def.table} (${keys.join(",")},organization_id) VALUES (${keys.map(() => "?").join(",")},?)`,
          [...values, org],
        );
        await requiredAudit(
          req,
          "lookup.create",
          def.table,
          result.insertId,
          {},
          connection,
        );
        await connection.commit();
        res
          .status(201)
          .json({ id: result.insertId, organization_id: org, ...data });
      } catch (error) {
        await connection.rollback();
        fail(res, error);
      } finally {
        connection.release();
      }
    });
    router.put(
      [path + "/:id", ...(def.active ? [path + "/:id/deactivate"] : [])],
      verifyToken,
      async (req, res) => {
        const connection = await db.getConnection();
        try {
          const org = concreteOrganization(req);
          const keys = def.fields.filter((key) => req.body[key] !== undefined);
          const deactivating = req.path.endsWith("/deactivate");
          if (
            !deactivating &&
            (!keys.length ||
              keys.some(
                (key) =>
                  typeof req.body[key] !== "string" ||
                  !req.body[key].trim() ||
                  req.body[key].length > 4000,
              ))
          )
            throw httpError(422, "INVALID_LOOKUP");
          for (const key of keys)
            if (
              req.body[key].length >
              {
                name: 100,
                color: 20,
                clinic_type: 50,
                label: 255,
                fullname: 255,
                text: 4000,
              }[key]
            )
              throw httpError(422, "LOOKUP_VALUE_TOO_LONG");
          const sets = deactivating
            ? [`${def.active}=0`]
            : keys.map((key) => `${key}=?`);
          const values = deactivating
            ? []
            : keys.map((key) =>
                def.private?.includes(key)
                  ? encrypt(
                      req.body[key].trim(),
                      fieldContext(def.table, key, org),
                    )
                  : req.body[key].trim(),
              );
          await connection.beginTransaction();
          const [result] = await connection.query(
            `UPDATE ${def.table} SET ${sets.join(",")} WHERE id=? AND organization_id=?`,
            [...values, req.params.id, org],
          );
          if (!result.affectedRows) throw httpError(404, "LOOKUP_NOT_FOUND");
          await requiredAudit(
            req,
            "lookup.update",
            def.table,
            req.params.id,
            {},
            connection,
          );
          await connection.commit();
          res.json({ success: true });
        } catch (error) {
          await connection.rollback();
          fail(res, error);
        } finally {
          connection.release();
        }
      },
    );
    router.delete(path + "/:id", verifyToken, async (req, res) => {
      const connection = await db.getConnection();
      try {
        const org = concreteOrganization(req);
        await connection.beginTransaction();
        const [result] = await connection.query(
          `DELETE FROM ${def.table} WHERE id=? AND organization_id=?`,
          [req.params.id, org],
        );
        if (!result.affectedRows) throw httpError(404, "LOOKUP_NOT_FOUND");
        await requiredAudit(
          req,
          "lookup.delete",
          def.table,
          req.params.id,
          {},
          connection,
        );
        await connection.commit();
        res.json({ success: true });
      } catch (error) {
        await connection.rollback();
        fail(res, error);
      } finally {
        connection.release();
      }
    });
  }
module.exports = router;

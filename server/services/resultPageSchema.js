// services/resultPageSchema.js
// Creates the result page tables on first use, so a deploy that skipped
// `npm run migrate:result-images` still lets organizations save their pictures.
const fs = require("fs");
const path = require("path");
const db = require("../config/db");

const MIGRATIONS = [
  "20261018_organization_result_images.sql",
  "20261018_result_page_customization.sql",
];

const statementsOf = (sql) =>
  sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .split(";")
    .map((query) => query.trim())
    .filter(Boolean);

const resultPageStatements = () =>
  MIGRATIONS.flatMap((file) =>
    statementsOf(
      fs.readFileSync(path.join(__dirname, "../migrations", file), "utf8"),
    ),
  );

let pending = null;

// Resolves true once every table exists; false when the database refused.
function ensureResultPageTables() {
  if (!pending) {
    pending = (async () => {
      for (const query of resultPageStatements()) await db.query(query);
      return true;
    })().catch((error) => {
      console.error(
        "Result page tables could not be created:",
        error.code || error.message,
      );
      pending = null;
      return false;
    });
  }
  return pending;
}

module.exports = { ensureResultPageTables, resultPageStatements, MIGRATIONS };

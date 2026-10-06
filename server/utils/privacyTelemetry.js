// Bounded codes only. Never accept subjects, tokens, SQL, URLs or free text.
const counters = new Map();
const ALLOWED = new Set([
  "decrypt_failure",
  "audit_failure",
  "scope_denial",
  "migration_mismatch",
]);
function record(code) {
  if (ALLOWED.has(code)) counters.set(code, (counters.get(code) || 0) + 1);
}
function snapshot() {
  return {
    process_uptime_seconds: Math.floor(process.uptime()),
    counters: Object.fromEntries(
      [...ALLOWED].map((code) => [code, counters.get(code) || 0]),
    ),
  };
}
module.exports = { record, snapshot };

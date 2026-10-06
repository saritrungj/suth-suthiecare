function safeError(error) {
  const code = error?.code || error?.name || "ERROR";
  return /^[A-Za-z0-9_]{1,80}$/.test(code) ? code : "ERROR";
}
module.exports = { safeError };

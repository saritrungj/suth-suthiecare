// Backward-compatible entry point for operators who previously started PM2
// from the server directory. The canonical configuration lives at repo root.
module.exports = require("../ecosystem.config.cjs");

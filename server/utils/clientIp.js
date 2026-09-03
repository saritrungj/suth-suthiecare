const { ipKeyGenerator } = require("express-rate-limit");

const withoutProxyPort = (value) => {
  const first = String(value || "")
    .split(",")[0]
    .trim();
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(first);
  if (bracketed) return bracketed[1];
  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(first)) {
    return first.replace(/:\d+$/, "");
  }
  return first;
};

const getClientIp = (req) =>
  withoutProxyPort(req.headers["cf-connecting-ip"] || req.ip || req.socket.remoteAddress);

const clientIpKeyGenerator = (req) => ipKeyGenerator(getClientIp(req));

module.exports = { getClientIp, clientIpKeyGenerator };

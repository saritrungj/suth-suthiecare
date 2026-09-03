const sanitizeHtml = require("sanitize-html");

const DEFAULT_TRUSTED_HOSTS = ["suth.go.th", "*.suth.go.th"];

const trustedHostRules = () => {
  const configured = String(process.env.TRUSTED_EXTERNAL_HOSTS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const rules = configured.length ? configured : [...DEFAULT_TRUSTED_HOSTS];
  try {
    const frontendHost = new URL(process.env.FRONTEND_URL).hostname.toLowerCase();
    if (frontendHost && !rules.includes(frontendHost)) rules.push(frontendHost);
  } catch {
    // FRONTEND_URL is validated separately at startup.
  }
  return rules;
};

const hostMatches = (hostname, rule) => {
  if (rule.startsWith("*.")) return hostname.endsWith(`.${rule.slice(2)}`);
  return hostname === rule;
};

const normalizeTrustedLink = (value) => {
  if (typeof value !== "string") return null;
  const input = value.trim();
  if (!input || /[\u0000-\u001f\u007f\\]/.test(input)) return null;
  if (input.startsWith("/") && !input.startsWith("//")) return input;
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const hostname = url.hostname.toLowerCase();
    if (!trustedHostRules().some((rule) => hostMatches(hostname, rule))) return null;
    return url.href;
  } catch {
    return null;
  }
};

const normalizeTrustedAssetUrl = (value) => {
  if (typeof value !== "string") return null;
  const input = value.trim();
  if (/^data:image\/(?:avif|gif|jpeg|png|webp);base64,[a-z0-9+/=\s]+$/i.test(input)) {
    return input;
  }
  return normalizeTrustedLink(input);
};

const normalizeYoutubeUrl = (value) => {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" &&
      ["youtube.com", "www.youtube.com", "youtu.be", "www.youtu.be"].includes(host)
      ? url.href
      : null;
  } catch {
    return null;
  }
};

const sanitizeRichText = (value) =>
  sanitizeHtml(String(value || ""), {
    allowedTags: [
      "p", "br", "strong", "b", "em", "i", "u", "s", "ol", "ul", "li",
      "h2", "h3", "h4", "blockquote", "span", "a",
    ],
    allowedAttributes: { span: ["style"], a: ["href", "target", "rel"] },
    allowedStyles: {
      span: { color: [/^#[0-9a-f]{3,8}$/i, /^rgb\([\d\s,.%]+\)$/i] },
    },
    transformTags: {
      a: (tagName, attribs) => {
        const href = normalizeTrustedLink(attribs.href);
        if (!href) return { tagName: "span", attribs: {} };
        return {
          tagName,
          attribs: { href, target: "_blank", rel: "nofollow noopener noreferrer" },
        };
      },
    },
  });

const RICH_TEXT_KEYS = new Set([
  "title", "text", "description", "desc", "label", "advice",
  "bannerText", "stepName", "formStepName",
]);
const RICH_TEXT_ARRAY_KEYS = new Set(["options", "rows", "cols"]);

const sanitizeFormContent = (value, key = "") => {
  if (Array.isArray(value)) {
    return value.map((item) =>
      typeof item === "string" && RICH_TEXT_ARRAY_KEYS.has(key)
        ? sanitizeRichText(item)
        : sanitizeFormContent(item, key),
    );
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        sanitizeFormContent(childValue, childKey),
      ]),
    );
  }
  if (typeof value === "string" && RICH_TEXT_KEYS.has(key)) return sanitizeRichText(value);
  if (typeof value === "string" && ["image", "headerImage"].includes(key)) {
    return normalizeTrustedAssetUrl(value) || "";
  }
  if (typeof value === "string" && key === "videoUrl") return normalizeYoutubeUrl(value) || "";
  return value;
};

module.exports = {
  normalizeTrustedLink,
  normalizeTrustedAssetUrl,
  normalizeYoutubeUrl,
  sanitizeRichText,
  sanitizeFormContent,
};

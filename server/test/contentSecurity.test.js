const test = require("node:test");
const assert = require("node:assert/strict");

process.env.FRONTEND_URL = "https://care.suth.go.th";
delete process.env.TRUSTED_EXTERNAL_HOSTS;

const {
  normalizeTrustedAssetUrl,
  normalizeTrustedLink,
  sanitizeFormContent,
  sanitizeRichText,
} = require("../utils/contentSecurity");

test("trusted links only allow local and official HTTPS destinations", () => {
  assert.equal(normalizeTrustedLink("/docs/manual.pdf"), "/docs/manual.pdf");
  assert.equal(normalizeTrustedLink("https://vitalcare.suth.go.th/path"), "https://vitalcare.suth.go.th/path");
  assert.equal(normalizeTrustedLink("https://evil.example/phish"), null);
  assert.equal(normalizeTrustedLink("javascript:alert(1)"), null);
  assert.equal(normalizeTrustedLink("//evil.example/phish"), null);
});

test("rich text strips executable HTML and untrusted backlinks", () => {
  const result = sanitizeRichText(
    '<p onclick="alert(1)">Safe <script>alert(1)</script>' +
      '<a href="https://evil.example">bait</a>' +
      '<a href="https://www.suth.go.th/page">official</a></p>',
  );
  assert.doesNotMatch(result, /script|onclick|evil\.example/i);
  assert.match(result, /nofollow noopener noreferrer/);
  assert.match(result, /https:\/\/www\.suth\.go\.th\/page/);
});

test("form content removes unsafe HTML and untrusted media", () => {
  const result = sanitizeFormContent({
    title: '<img src=x onerror=alert(1)>Title',
    headerImage: "https://evil.example/tracker.png",
    videoUrl: "https://evil.example/video",
    options: ['<b onclick="x()">Choice</b>'],
  });
  assert.equal(result.title, "Title");
  assert.equal(result.headerImage, "");
  assert.equal(result.videoUrl, "");
  assert.equal(result.options[0], "<b>Choice</b>");
  assert.ok(normalizeTrustedAssetUrl("data:image/png;base64,AAAA"));
});

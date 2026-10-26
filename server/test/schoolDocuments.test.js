const test = require("node:test");
const assert = require("node:assert/strict");
const {
  decodeFile,
  validUrl,
  normalizeAudience,
  staffCanSee,
  MAX_BYTES,
} = require("../services/schoolDocuments");

const b64 = (bytes) => Buffer.from(bytes).toString("base64");
const pdf = b64([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
const zip = b64([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);

test("files are typed by their signature and extension together", () => {
  assert.equal(
    decodeFile({ name: "คู่มือ.pdf", data: pdf }).mime,
    "application/pdf",
  );
  assert.equal(
    decodeFile({
      name: "form.docx",
      data: `data:application/octet-stream;base64,${zip}`,
    }).mime,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  assert.ok(
    decodeFile({ name: "renamed.exe.pdf", data: zip }).error,
    "a zip named .pdf",
  );
  assert.ok(
    decodeFile({ name: "page.html", data: b64([0x3c, 0x68, 0x74]) }).error,
  );
  assert.ok(decodeFile({ name: "x.pdf", data: "" }).error);
  assert.ok(decodeFile({ name: "x.pdf", data: "%%%" }).error);
  assert.ok(
    decodeFile({
      name: "big.pdf",
      data: Buffer.alloc(MAX_BYTES + 1, 0x25).toString("base64"),
    }).error,
  );
  assert.equal(
    decodeFile({ name: "..\\..\\a<b>.pdf", data: pdf }).name,
    ".._.._a_b_.pdf",
    "path and reserved characters are replaced",
  );
});

test("links must be http(s)", () => {
  assert.equal(validUrl("https://dmh.go.th/handbook"), true);
  assert.equal(validUrl("javascript:alert(1)"), false);
  assert.equal(validUrl("data:text/html,hi"), false);
  assert.equal(validUrl("ftp://example.com/x"), false);
});

test("audiences and who sees a document", () => {
  assert.equal(normalizeAudience([]), null);
  assert.equal(normalizeAudience(["everyone"]), null);
  assert.deepEqual(normalizeAudience(["students", "students"]), ["students"]);
  const doc = (audience, status = "active") => ({
    audience: JSON.stringify(audience),
    status,
  });
  const viewer = { view: true };
  assert.equal(staffCanSee({}, viewer, doc(["all_staff"])), true);
  assert.equal(staffCanSee({}, viewer, doc(["mental_staff"])), false);
  assert.equal(
    staffCanSee({ canMental: true }, viewer, doc(["mental_staff"])),
    true,
  );
  assert.equal(
    staffCanSee(
      { canPhysical: true },
      viewer,
      doc(["mental_staff", "physical_staff"]),
    ),
    true,
  );
  assert.equal(
    staffCanSee({}, viewer, doc(["students"])),
    false,
    "a students-only file is not for every teacher",
  );
  assert.equal(staffCanSee({}, viewer, doc(["all_staff"], "hidden")), false);
  assert.equal(
    staffCanSee({}, { assign: true }, doc(["students"], "hidden")),
    true,
    "those who arrange see all",
  );
  assert.equal(staffCanSee({}, {}, doc(["all_staff"])), false);
});

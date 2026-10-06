const test = require("node:test"),
  assert = require("node:assert/strict");
process.env.AES_KEY = "a".repeat(64);
process.env.AES_SEARCH_KEY = "search-".repeat(8);
const codec = require("../utils/privateData");
test("private JSON preserves all scalar and compound types with fresh IVs", () => {
  for (const value of [
    "",
    0,
    false,
    null,
    [],
    {},
    ["ไทย", 0, false],
    { a: 0, b: false, c: null, d: [1, 2] },
  ]) {
    const a = codec.sealJson(value, "answers:org:1"),
      b = codec.sealJson(value, "answers:org:1");
    assert.deepEqual(codec.openJson(a, "answers:org:1"), value);
    assert.notEqual(a.iv, b.iv);
    assert.deepEqual(codec.readJson(JSON.stringify(a), "answers:org:1"), value);
  }
});
test("wrong key, edited ciphertext, wrong owner and unknown versions fail closed", () => {
  const value = codec.sealJson({ secret: "health" }, "org:1");
  assert.throws(() => codec.openJson(value, "org:2"), {
    code: "CIPHERTEXT_CONTEXT_MISMATCH",
  });
  assert.throws(
    () =>
      codec.openJson({
        ...value,
        ct: Buffer.from("corrupt").toString("base64"),
      }),
    { code: "CIPHERTEXT_AUTHENTICATION_FAILED" },
  );
  const original = process.env.AES_KEY;
  process.env.AES_KEY = "b".repeat(64);
  assert.throws(() => codec.openJson(value));
  process.env.AES_KEY = original;
  assert.throws(() => codec.readJson({ __enc: "suth-private-v2" }));
  assert.throws(() => codec.readJson("suthenc:v2:bad"));
});
test("rotation reads a prior key while the active key changes", () => {
  process.env.DATA_ENCRYPTION_KEYS = JSON.stringify({
    old: "a".repeat(64),
    current: "b".repeat(64),
  });
  process.env.DATA_ENCRYPTION_ACTIVE_KEY = "old";
  const a = codec.sealJson(0, "field");
  process.env.DATA_ENCRYPTION_ACTIVE_KEY = "current";
  assert.equal(codec.openJson(a, "field"), 0);
  assert.equal(codec.sealJson(false, "field").kid, "current");
  delete process.env.DATA_ENCRYPTION_KEYS;
  delete process.env.DATA_ENCRYPTION_ACTIVE_KEY;
});
test("DTO hides hashes, private storage, unknown case fields and unauthorized health", () => {
  const { serialize } = require("../utils/privateDto");
  const value = {
    id: 1,
    identity_value: "1234567890123",
    identity_hash: "hash",
    password: "secret",
    internal_new_column: "internal",
    summary_data: {
      display_name: "สมชาย ใจดี",
      score_results: [{ score: 0 }],
      raw_answers: { secret: "private" },
    },
  };
  const masked = serialize(value);
  assert.equal(masked.identity_value, "***0123");
  assert.equal(masked.summary_data.display_name, "ส***");
  assert.equal(masked.summary_data.score_results, undefined);
  assert.equal(masked.identity_hash, undefined);
  assert.equal(masked.internal_new_column, undefined);
  const full = serialize(value, { pii: true, clinical: true });
  assert.equal(full.identity_value, value.identity_value);
  assert.equal(full.summary_data.score_results[0].score, 0);
  assert.equal(full.identity_hash, undefined);
});
test("context-bound field and school measurements reject copied data and retired plaintext", () => {
  const { writeField, readField } = require("../utils/privateField"),
    school = require("../utils/schoolPrivateData");
  const name = writeField(
    "Synthetic name",
    "school_students",
    "first_name_encrypted",
    7,
  );
  assert.equal(
    readField(name, "school_students", "first_name_encrypted", 7),
    "Synthetic name",
  );
  assert.throws(
    () => readField(name, "school_students", "first_name_encrypted", 8),
    { code: "CIPHERTEXT_CONTEXT_MISMATCH" },
  );
  assert.throws(
    () => readField(name, "school_students", "last_name_encrypted", 7),
    { code: "CIPHERTEXT_CONTEXT_MISMATCH" },
  );
  const measurements = school.encodeMeasurements(
    Object.fromEntries(school.MEASUREMENTS.map((key) => [key, null])).valueOf(),
    7,
  );
  assert.equal(
    school.physicalRecord({ measurements_encrypted: measurements }, 7)
      .weight_kg,
    null,
  );
  const previous = process.env.PDPA_LEGACY_READ_ENABLED;
  process.env.PDPA_LEGACY_READ_ENABLED = "false";
  try {
    assert.throws(() => readField("plain", "users", "name"), {
      code: "LEGACY_PRIVATE_DATA_RETIRED",
    });
    assert.throws(() => school.physicalRecord({ weight_kg: 42 }, 7), {
      code: "LEGACY_PRIVATE_DATA_RETIRED",
    });
    assert.throws(() => school.bloodType({ blood_type: "O" }, 7), {
      code: "LEGACY_PRIVATE_DATA_RETIRED",
    });
  } finally {
    if (previous === undefined) delete process.env.PDPA_LEGACY_READ_ENABLED;
    else process.env.PDPA_LEGACY_READ_ENABLED = previous;
  }
});

const test = require("node:test");
const assert = require("node:assert/strict");
const { decryptCaseResponse } = require("../utils/decryptCaseData");

const decrypt = (value) =>
  typeof value === "string" && value.startsWith("enc:")
    ? value.slice(4)
    : value;

test("decrypts sensitive case fields without exposing identity hashes", () => {
  const response = decryptCaseResponse(
    {
      identity_value: "enc:1234567890123",
      identity_hash: "one-way-hash",
      summary_data: JSON.stringify({
        display_name: "enc:สมชาย ใจดี",
        display_phone: "enc:0812345678",
        raw_answers: {
          "Full name": "enc:สมชาย ใจดี",
          "Phone number": "enc:0812345678",
          "อาการที่พบ": "ปวดหัว",
        },
      }),
    },
    decrypt,
  );

  assert.equal(response.identity_value, "1234567890123");
  assert.equal(response.identity_hash, "one-way-hash");
  assert.equal(response.summary_data.display_name, "สมชาย ใจดี");
  assert.equal(response.summary_data.display_phone, "0812345678");
  assert.equal(response.summary_data.raw_answers["Full name"], "สมชาย ใจดี");
  assert.equal(response.summary_data.raw_answers["Phone number"], "0812345678");
  assert.equal(response.summary_data.raw_answers["อาการที่พบ"], "ปวดหัว");
});

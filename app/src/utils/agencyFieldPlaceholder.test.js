import { test } from "node:test";
import assert from "node:assert/strict";
import { agencyFieldPlaceholder as placeholder } from "./agencyFieldPlaceholder.js";

test("placeholders provide field-specific examples without becoming data defaults", () => {
  assert.equal(placeholder({ id: "employee_id" }), "เช่น EMP-001");
  assert.match(placeholder({ id: "first_name" }), /สมชาย/);
  assert.match(placeholder({ id: "last_name" }), /ใจดี/);
  assert.match(placeholder({ id: "department" }), /ฝ่ายบุคคล/);
  assert.match(placeholder({ type: "phone" }), /0812345678/);
  assert.match(placeholder({ type: "email" }), /example.com/);
  assert.equal(
    placeholder({ type: "multiselect", options: ["A", "B"] }),
    "เช่น A|B",
  );
  assert.equal(placeholder({ type: "date" }), undefined);
  assert.equal(placeholder({ type: "text", label: "ตำแหน่ง" }), "ระบุตำแหน่ง");
});

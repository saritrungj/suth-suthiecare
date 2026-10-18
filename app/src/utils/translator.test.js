import test from "node:test";
import assert from "node:assert/strict";
import { splitForTranslation, translateTextSmart } from "./translator.js";

test("long text is split into pieces no longer than the limit", () => {
  const text = "คำ ".repeat(400) + "ก".repeat(700);
  const chunks = splitForTranslation(text, 300);
  assert.ok(chunks.length > 1);
  for (const chunk of chunks) assert.ok(chunk.length <= 300);
  assert.equal(chunks.join(""), text);
});

test("short text stays in one piece", () => {
  assert.deepEqual(splitForTranslation("สวัสดี ครับ", 300), ["สวัสดี ครับ"]);
});

test("text without Thai is returned without calling the service", async () => {
  let calls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error("should not be called");
  };
  try {
    assert.equal(await translateTextSmart("Hello 9Q"), "Hello 9Q");
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = original;
  }
});

test("a failing service falls back to the original text once, quietly", async () => {
  let calls = 0;
  const original = globalThis.fetch;
  const warn = console.warn;
  console.warn = () => {};
  globalThis.fetch = async () => {
    calls += 1;
    return { ok: false, status: 414 };
  };
  try {
    assert.equal(await translateTextSmart("ทดสอบหนึ่ง"), "ทดสอบหนึ่ง");
    assert.equal(await translateTextSmart("ทดสอบสอง"), "ทดสอบสอง");
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = original;
    console.warn = warn;
  }
});

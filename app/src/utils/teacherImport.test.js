import test from "node:test";
import assert from "node:assert/strict";
import { mapTeacherRows } from "./teacherImport.js";
test("teacher workbook mapping preserves codes and assigns the explicit school role and room", () => {
  const rows = mapTeacherRows([
    [
      "ชื่อผู้ใช้",
      "ชื่อ-นามสกุล",
      "อีเมล",
      "บทบาท",
      "รหัสครู",
      "ชั้นปี",
      "ห้อง",
      "ปีการศึกษา",
    ],
    [
      "teacher.1",
      "ครู ทดสอบ",
      "teacher@example.com",
      "ครูประจำชั้น",
      "0001",
      "ม.1",
      "1/1",
      "2569",
    ],
  ]);
  assert.equal(rows[0].role_code, "homeroom");
  assert.equal(rows[0].employee_code, "0001");
  assert.equal(rows[0].classroom, "1/1");
  assert.throws(() => mapTeacherRows([["ชื่อผู้ใช้"]]), /ต้องมีคอลัมน์/);
});

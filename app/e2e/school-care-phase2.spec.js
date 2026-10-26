import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const school = {
  id: 3,
  name: "โรงเรียนจำลอง",
  org_type: "school",
  org_level: "unit",
};
const flags = (value, overrides = {}) => ({
  ...Object.fromEntries(
    ["view", "create", "update", "delete", "assign", "export", "manage"].map(
      (a) => [a, value],
    ),
  ),
  ...overrides,
});
const student = {
  id: 11,
  school_id: 2,
  student_code: "DEMO011",
  prefix: "ด.ช.",
  first_name: "นักเรียน",
  last_name: "จำลอง",
  classroom_name: "1",
  grade_name: "ม.1",
  status: "active",
  can_view_health: false,
};
const options = (actions) => ({
  categories: { emotion: "อารมณ์และความรู้สึก", conduct: "ความประพฤติ" },
  levels: { low: "เล็กน้อย", medium: "ควรติดตาม", high: "เร่งด่วน" },
  statuses: {
    new: "ใหม่",
    acknowledged: "รับทราบแล้ว",
    following: "กำลังติดตาม",
    closed: "ปิดแล้ว",
    cancelled: "ยกเลิก",
  },
  actions,
});
const report = {
  id: 7,
  student_id: 11,
  student_code: "DEMO011",
  student_name: "ด.ช. นักเรียน จำลอง",
  grade_name: "ม.1",
  classroom_name: "1",
  category: "emotion",
  concern_level: "high",
  observed_on: "2026-10-15",
  details: "รายละเอียดจำลอง",
  status: "following",
  reporter_name: "ครูรายวิชา จำลอง",
  assignee_name: null,
  access: "own",
  history: [
    {
      id: 1,
      status: "new",
      note: "",
      by: "ครูรายวิชา จำลอง",
      created_at: "2026-10-15",
    },
    {
      id: 2,
      status: "following",
      note: "",
      by: "ครูประจำชั้น",
      created_at: "2026-10-16",
    },
  ],
  assignees: [],
};

async function setup(
  page,
  {
    behavior = flags(false),
    workflows = flags(false),
    physical = false,
    health = flags(false),
  } = {},
) {
  const writes = [];
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "suth_user",
      JSON.stringify({ id: 5, username: "synthetic-teacher", role_id: 7 }),
    );
    localStorage.setItem("suth_active_organization_5", "3");
    document.cookie = "suth_staff_session=synthetic; path=/";
  });
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname.replace(/^\/api/, ""),
      method = req.method();
    if (method !== "GET")
      writes.push({ method, path, body: req.postDataJSON?.() });
    if (path === "/session/staff")
      return route.fulfill({
        json: { user: { id: 5, role_id: 7 }, csrf_token: "synthetic" },
      });
    if (path === "/session/patient")
      return route.fulfill({ status: 401, json: {} });
    if (path === "/me/authorization")
      return route.fulfill({
        json: {
          user: { id: 5, role_id: 7 },
          is_system_admin: false,
          organizations: [school],
          memberships: [
            {
              organization: school,
              role: { name: "ครู" },
              permissions: ["students.view"],
            },
          ],
        },
      });
    if (path === "/school/access")
      return route.fulfill({
        json: {
          is_guardian: false,
          can_view_students: true,
          can_view_school: true,
          can_view_risk: false,
          can_view_physical: physical,
          can_view_health: physical,
          staff_actions: flags(false),
          workflow_actions: workflows,
          health_actions: health,
          behavior_actions: behavior,
          can_use_behavior: behavior.view || behavior.create,
          appointment_actions: flags(false),
          document_actions: flags(false),
        },
      });
    if (path === "/school/notifications/unread-count")
      return route.fulfill({ json: { count: 0 } });
    if (path === "/school/schools")
      return route.fulfill({
        json: [{ id: 2, name: "โรงเรียนจำลอง", status: "active" }],
      });
    if (path === "/school/behavior-reports/options")
      return route.fulfill({ json: options(behavior) });
    if (path === "/school/behavior-reports" && method === "GET")
      return route.fulfill({
        json: {
          data: [report],
          pagination: { total: 1, page: 1, limit: 10, total_pages: 1 },
        },
      });
    if (path === "/school/behavior-reports" && method === "POST")
      return route.fulfill({ status: 201, json: { id: 8 } });
    if (path === "/school/behavior-reports/7")
      return route.fulfill({ json: report });
    if (path === "/school/students/11") return route.fulfill({ json: student });
    if (path === "/school/students")
      return route.fulfill({
        json: {
          data: [student],
          pagination: { total: 1, page: 1, total_pages: 1, limit: 20 },
        },
      });
    if (path === "/school/follow-ups" && method === "GET")
      return route.fulfill({
        json: {
          data: [
            {
              id: 3,
              student_id: 11,
              student_code: "DEMO011",
              student_name: "ด.ช. นักเรียน จำลอง",
              grade_name: "ม.1",
              classroom_name: "1",
              rule_label: "BMI เกินเกณฑ์ (ตัวอย่าง)",
              value: 27.3,
              measured_at: "2026-10-10",
              status: "open",
              due_on: "2020-01-01",
              assignee_name: null,
            },
          ],
          pagination: { total: 1, page: 1, limit: 10, total_pages: 1 },
          statuses: {
            open: "รอติดตาม",
            in_progress: "กำลังติดตาม",
            done: "ติดตามแล้ว",
            cancelled: "ยกเลิก",
          },
          can_update: true,
        },
      });
    if (path === "/school/follow-ups/3" && method === "GET")
      return route.fulfill({
        json: {
          id: 3,
          student_code: "DEMO011",
          student_name: "ด.ช. นักเรียน จำลอง",
          rule_label: "BMI เกินเกณฑ์ (ตัวอย่าง)",
          value: 27.3,
          measured_at: "2026-10-10",
          status: "open",
          due_on: "2026-11-09",
          result: "",
          assigned_to: null,
          assignees: [{ id: 9, name: "ครูประจำชั้น จำลอง" }],
        },
      });
    if (path === "/school/care-guidance/2" && method === "GET")
      return route.fulfill({
        json: {
          care_advice: { high: "", medium: "", normal: "", none: "" },
          care_guidance: Object.fromEntries(
            ["high", "medium", "normal", "none"].map((r) => [
              r,
              { observe: "", talk: "", follow_up: "", refer: "" },
            ]),
          ),
        },
      });
    if (path === "/school/physical-risk-rules" && method === "GET")
      return route.fulfill({
        json: {
          rules: [],
          metrics: {
            bmi: "ดัชนีมวลกาย (BMI)",
            systolic: "ความดันตัวบน (มม.ปรอท)",
          },
          comparators: { lt: "ต่ำกว่า", gt: "สูงกว่า", outside: "อยู่นอกช่วง" },
        },
      });
    if (path === "/school/notification-settings/2" && method === "GET")
      return route.fulfill({
        json: {
          risk_alerts: {
            enabled: true,
            levels: ["high"],
            mental_admins: false,
          },
        },
      });
    if (method !== "GET") return route.fulfill({ json: { success: true } });
    return route.fulfill({ json: [] });
  });
  return writes;
}

const openSidebarItem = async (page, name) => {
  if (page.viewportSize().width <= 768)
    await page.getByRole("button", { name: "Open Menu" }).click();
  await page.getByRole("link", { name }).click();
};

test("a reporter sees their own report's status but not the follow-up notes", async ({
  page,
}) => {
  await setup(page, { behavior: flags(false, { create: true }) });
  await page.goto("/admin/school/students");
  await openSidebarItem(page, "บันทึกพฤติกรรม");
  await expect(page).toHaveURL(/\/admin\/school\/behavior$/);
  await expect(page.getByText("แสดงเฉพาะรายงานที่คุณเป็นผู้ส่ง")).toBeVisible();
  await page.getByRole("button", { name: "เปิดรายงานของ DEMO011" }).click();
  const dialog = page.getByRole("dialog", { name: "รายงานพฤติกรรม" });
  await expect(dialog.getByText("กำลังติดตาม").first()).toBeVisible();
  await expect(
    dialog.getByText("บันทึกการติดตามเห็นได้เฉพาะผู้รับผิดชอบดูแลนักเรียน"),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "บันทึกการติดตาม" }),
  ).toHaveCount(0);
  const axe = await new AxeBuilder({ page }).include(".sch-modal").analyze();
  expect(axe.violations).toEqual([]);
});

test("a teacher reports a behaviour from the student file", async ({
  page,
}) => {
  const writes = await setup(page, {
    behavior: flags(false, { create: true }),
  });
  await page.goto("/admin/school/students?student=11");
  await page.getByRole("tab", { name: "พฤติกรรม" }).click();
  await page.getByRole("button", { name: "บันทึกพฤติกรรม" }).click();
  const dialog = page.getByRole("dialog", { name: "บันทึกพฤติกรรม" });
  await dialog.getByRole("button", { name: "ส่งรายงาน" }).click();
  await expect(dialog.getByRole("alert")).toContainText("กรุณาเลือกเรื่อง");
  await dialog.getByLabel("เรื่องที่พบ").selectOption("conduct");
  await dialog.getByRole("radio", { name: "ควรติดตาม" }).check();
  await dialog.getByLabel("สิ่งที่สังเกตเห็น").fill("ข้อสังเกตจำลอง");
  await dialog.getByRole("button", { name: "ส่งรายงาน" }).click();
  await expect
    .poll(() => writes.find((w) => w.path === "/school/behavior-reports"))
    .toBeTruthy();
  expect(
    writes.find((w) => w.path === "/school/behavior-reports").body,
  ).toMatchObject({
    student_id: 11,
    category: "conduct",
    concern_level: "medium",
    details: "ข้อสังเกตจำลอง",
  });
});

test("physical follow-ups list overdue items and save a result", async ({
  page,
}) => {
  const writes = await setup(page, { physical: true, health: flags(true) });
  await page.goto("/admin/school/follow-ups");
  await expect(
    page.getByRole("heading", { name: "ติดตามสุขภาพกาย" }),
  ).toBeVisible();
  await expect(page.getByText("(เลยกำหนด)")).toBeVisible();
  await page
    .getByRole("button", { name: "เปิดรายการติดตามของ DEMO011" })
    .click();
  const dialog = page.getByRole("dialog", { name: "ติดตามภาวะเสี่ยงทางกาย" });
  await dialog.getByLabel("ผลการติดตาม").fill("ผลจำลอง");
  await dialog.getByRole("button", { name: "บันทึกการติดตาม" }).click();
  await expect
    .poll(() => writes.find((w) => w.path === "/school/follow-ups/3"))
    .toBeTruthy();
  expect(
    writes.find((w) => w.path === "/school/follow-ups/3").body,
  ).toMatchObject({
    status: "in_progress",
    result: "ผลจำลอง",
  });
});

test("care settings save guidance steps and require rule approval", async ({
  page,
}) => {
  const writes = await setup(page, { workflows: flags(true), physical: true });
  await page.goto("/admin/school/workflows");
  await page.getByRole("button", { name: "ตั้งค่าการดูแล" }).click();
  await page.getByRole("button", { name: "เสี่ยงสูง" }).click();
  await page.getByLabel("2. พูดคุย").fill("ขั้นพูดคุยจำลอง");
  await page.getByRole("button", { name: "บันทึกคำแนะนำทุกระดับ" }).click();
  await expect
    .poll(() => writes.find((w) => w.path === "/school/care-guidance/2"))
    .toBeTruthy();
  expect(
    writes.find((w) => w.path === "/school/care-guidance/2").body.care_guidance
      .high.talk,
  ).toBe("ขั้นพูดคุยจำลอง");
  await page.getByRole("button", { name: "เพิ่มเกณฑ์" }).click();
  const dialog = page.getByRole("dialog", {
    name: "เพิ่มเกณฑ์ภาวะเสี่ยงทางกาย",
  });
  await dialog.getByLabel("ชื่อเกณฑ์").fill("BMI สูง (ตัวอย่าง)");
  await dialog.getByLabel("ค่าเกณฑ์").fill("25");
  await dialog.getByRole("button", { name: "บันทึกเกณฑ์" }).click();
  await expect(dialog.getByRole("alert")).toContainText("ผ่านการเห็นชอบ");
  expect(writes.some((w) => w.path === "/school/physical-risk-rules")).toBe(
    false,
  );
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "บันทึกเกณฑ์" }).click();
  await expect
    .poll(() => writes.find((w) => w.path === "/school/physical-risk-rules"))
    .toBeTruthy();
  expect(
    writes.find((w) => w.path === "/school/physical-risk-rules").body,
  ).toMatchObject({
    metric: "bmi",
    comparator: "gt",
    threshold_high: "25",
    approved: true,
  });
});

test("risk alert settings turn on the medium level", async ({ page }) => {
  const writes = await setup(page, { workflows: flags(true) });
  await page.goto("/admin/school/workflows");
  await page.getByRole("button", { name: "ตั้งค่าการดูแล" }).click();
  const section = page.getByRole("region", { name: "แจ้งเตือนกลุ่มเสี่ยง" });
  await expect(
    section.getByRole("checkbox", { name: "เปิดการแจ้งเตือนกลุ่มเสี่ยง" }),
  ).toBeChecked();
  await section.getByRole("checkbox", { name: "เฝ้าระวัง" }).check();
  await section.getByRole("button", { name: "บันทึกการแจ้งเตือน" }).click();
  await expect
    .poll(() =>
      writes.find((w) => w.path === "/school/notification-settings/2"),
    )
    .toBeTruthy();
  expect(
    writes.find((w) => w.path === "/school/notification-settings/2").body,
  ).toEqual({
    risk_alerts: {
      enabled: true,
      levels: ["high", "medium"],
      mental_admins: false,
    },
  });
});

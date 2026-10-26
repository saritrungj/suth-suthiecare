import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockPublicApi } from "./helpers/api-mocks.js";

const flags = (value, overrides = {}) => ({
  ...Object.fromEntries(
    ["view", "create", "update", "delete", "assign", "export", "manage"].map(
      (a) => [a, value],
    ),
  ),
  ...overrides,
});
const school = {
  id: 3,
  name: "โรงเรียนจำลอง",
  org_type: "school",
  org_level: "unit",
};
const docs = [
  {
    id: 1,
    title: "คู่มือดูแลสุขภาพใจ",
    description: "ฉบับจำลอง",
    category_id: 1,
    category_name: "คู่มือ",
    kind: "file",
    file_name: "handbook.pdf",
    size_bytes: 20480,
    audience: ["mental_staff"],
    status: "active",
    updated_at: "2026-10-19T08:00:00+07:00",
  },
  {
    id: 2,
    title: "แหล่งความรู้ภายนอก",
    description: "",
    category_id: 3,
    category_name: "แนวทาง",
    kind: "link",
    url: "https://example.org/guide",
    audience: ["all_staff"],
    status: "active",
    updated_at: "2026-10-18T08:00:00+07:00",
  },
];

async function staff(
  page,
  { documents = flags(false), permissions = [] } = {},
) {
  const writes = [];
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "suth_user",
      JSON.stringify({ id: 5, username: "synthetic-staff", role_id: 7 }),
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
            { organization: school, role: { name: "ครู" }, permissions },
          ],
        },
      });
    if (path === "/school/access")
      return route.fulfill({
        json: {
          is_guardian: false,
          can_view_students: true,
          document_actions: documents,
          can_use_documents: Object.values(documents).some(Boolean),
          staff_actions: flags(false),
          workflow_actions: flags(false),
          health_actions: flags(false),
          behavior_actions: flags(false),
          appointment_actions: flags(false),
        },
      });
    if (path === "/school/notifications/unread-count")
      return route.fulfill({ json: { count: 0 } });
    if (path === "/school/schools")
      return route.fulfill({
        json: [{ id: 2, name: "โรงเรียนจำลอง", status: "active" }],
      });
    if (path === "/school/document-categories")
      return route.fulfill({
        json: {
          categories: [
            { id: 1, name: "คู่มือ", status: "active" },
            { id: 3, name: "แนวทาง", status: "active" },
          ],
          audiences: {
            all_staff: "บุคลากรทุกคน",
            mental_staff: "ทีมสุขภาพใจ",
            physical_staff: "ทีมสุขภาพกาย",
            students: "นักเรียน",
          },
          actions: documents,
        },
      });
    if (path === "/school/documents" && method === "GET")
      return route.fulfill({
        json: {
          data: docs,
          pagination: { total: 2, page: 1, limit: 10, total_pages: 1 },
        },
      });
    if (path === "/school/documents/1/file")
      return route.fulfill({
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "content-disposition": "attachment; filename*=UTF-8''handbook.pdf",
        },
        body: "%PDF-1.7 synthetic",
      });
    if (path === "/audit-logs/actors")
      return route.fulfill({
        json: { actors: [{ id: 9, name: "ครูแนะแนว จำลอง" }] },
      });
    if (path === "/audit-logs")
      return route.fulfill({
        json: {
          data: [
            {
              id: 1,
              created_at: "2026-10-19T14:05:09",
              actor_name: "ครูแนะแนว จำลอง",
              action: "students.update",
              target_type: "student",
              target_id: "11",
              student_code: "DEMO011",
              fields: ["first_name", "phone"],
              details: {},
            },
          ],
          pagination: { total: 1, page: 1, limit: 10, total_pages: 1 },
        },
      });
    if (method !== "GET")
      return route.fulfill({ status: 201, json: { id: 9, success: true } });
    return route.fulfill({ json: [] });
  });
  return writes;
}

test("a librarian uploads a file for chosen readers", async ({ page }) => {
  const writes = await staff(page, { documents: flags(true) });
  await page.goto("/admin/school/documents");
  await expect(
    page.getByRole("cell", { name: /^คู่มือดูแลสุขภาพใจ/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "เปิดลิงก์ แหล่งความรู้ภายนอก" }),
  ).toHaveAttribute("rel", "noopener noreferrer");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "ดาวน์โหลด คู่มือดูแลสุขภาพใจ" })
    .click();
  expect((await download).suggestedFilename()).toBe("handbook.pdf");
  await page.getByRole("button", { name: "เพิ่มเอกสาร" }).click();
  const dialog = page.getByRole("dialog", { name: "เพิ่มเอกสาร" });
  await dialog.getByLabel("ชื่อเอกสาร").fill("แบบฟอร์มจำลอง");
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "form.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7 synthetic"),
  });
  await dialog.getByRole("checkbox", { name: "นักเรียน" }).check();
  const axe = await new AxeBuilder({ page }).include(".sch-modal").analyze();
  expect(axe.violations).toEqual([]);
  await dialog.getByRole("button", { name: "บันทึกเอกสาร" }).click();
  await expect
    .poll(() => writes.find((w) => w.path === "/school/documents"))
    .toBeTruthy();
  const body = writes.find((w) => w.path === "/school/documents").body;
  expect(body).toMatchObject({
    title: "แบบฟอร์มจำลอง",
    kind: "file",
    audience: ["all_staff", "students"],
  });
  expect(Buffer.from(body.file.data, "base64").toString()).toBe(
    "%PDF-1.7 synthetic",
  );
});

test("a reader without arrange rights sees no audience controls", async ({
  page,
}) => {
  await staff(page, { documents: flags(false, { view: true }) });
  await page.goto("/admin/school/documents");
  await expect(
    page.getByRole("cell", { name: /^แหล่งความรู้ภายนอก/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "เพิ่มเอกสาร" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("columnheader", { name: "ผู้มองเห็น" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^แก้ไข/ })).toHaveCount(0);
});

test("the change history lists who changed what, without values", async ({
  page,
}) => {
  await staff(page, { permissions: ["audit.view"] });
  await page.goto("/admin/audit");
  await expect(
    page.getByRole("heading", { name: "ประวัติการแก้ไขข้อมูล" }),
  ).toBeVisible();
  const row = page.getByRole("row", { name: /DEMO011/ });
  await expect(row).toContainText("แก้ไขข้อมูลนักเรียน");
  await expect(row).toContainText("first_name, phone");
  await expect(page.getByRole("button", { name: "ส่งออก CSV" })).toHaveCount(0);
});

test("students see only the documents shared with students", async ({
  page,
}) => {
  await mockPublicApi(page);
  await page.addInitScript(() => {
    document.cookie = "suth_patient_session=synthetic-session; path=/";
    sessionStorage.setItem(
      "patient_user",
      JSON.stringify({ id: 1, username: "student", status: "active" }),
    );
  });
  await page.route("**/api/patient/history", (route) =>
    route.fulfill({
      json: {
        success: true,
        profile: { id: 1, username: "student", status: "active" },
        member_type: { type: "school_student", source: "school" },
        masterCases: [],
        responses: [],
      },
    }),
  );
  await page.route("**/api/patient/me/**", (route) =>
    route.fulfill({ json: { success: true, tasks: [], records: [] } }),
  );
  await page.route("**/api/patient/school-appointments**", (route) =>
    route.fulfill({
      json: { success: true, eligible: false, appointments: [] },
    }),
  );
  await page.route("**/api/patient/school-documents", (route) =>
    route.fulfill({
      json: {
        success: true,
        eligible: true,
        documents: [
          {
            id: 4,
            title: "เคล็ดลับจัดการความเครียด",
            category_name: "คู่มือ",
            kind: "link",
            url: "https://example.org/tips",
          },
        ],
      },
    }),
  );
  await page.goto("/history/result");
  const panel = page.getByRole("region", { name: "เอกสารจากโรงเรียน" });
  await expect(panel).toContainText("เคล็ดลับจัดการความเครียด");
  await expect(panel.getByRole("link", { name: /เปิดลิงก์/ })).toHaveAttribute(
    "href",
    "https://example.org/tips",
  );
});

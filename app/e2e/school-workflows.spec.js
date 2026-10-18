import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const student = {
  id: 1,
  school_id: 1,
  student_code: "0001",
  prefix: "เด็กหญิง",
  first_name: "สมหญิง",
  last_name: "สุขใจ",
  classroom_id: 11,
  classroom_name: "1/1",
  grade_name: "ม.1",
  status: "active",
  status_label: "กำลังศึกษา",
  is_boarder: true,
  can_view_health: false,
};
async function setup(page, { mental = true, manage = true } = {}) {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "suth_user",
      JSON.stringify({ id: 1, username: "demo", role_id: 2 }),
    );
    localStorage.setItem("suth_active_organization_1", "3");
    document.cookie = "suth_staff_session=synthetic; path=/";
  });
  const requests = [];
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname.replace(/^\/api/, "");
    if (path === "/session/staff")
      return route.fulfill({
        json: {
          user: { id: 1, username: "demo", role_id: 2 },
          csrf_token: "synthetic",
        },
      });
    if (path === "/session/patient")
      return route.fulfill({ status: 401, json: {} });
    if (path === "/me/authorization")
      return route.fulfill({
        json: {
          user: { id: 1, role_id: 2 },
          is_system_admin: false,
          organizations: [
            {
              id: 3,
              name: "โรงเรียนตัวอย่าง",
              org_type: "school",
              org_level: "unit",
              status: "active",
            },
          ],
          memberships: [
            {
              organization: {
                id: 3,
                name: "โรงเรียนตัวอย่าง",
                org_type: "school",
                org_level: "unit",
                status: "active",
              },
              role: { id: 2, name: "School staff" },
              permissions: [
                "school.view",
                "students.view",
                "students.create",
                // Importing students records who they are (derived by the migration).
                "pii.create",
                "forms.view",
                "students.export",
              ],
            },
          ],
        },
      });
    if (path === "/school/access")
      return route.fulfill({
        json: {
          can_view_school: true,
          can_view_students: true,
          can_view_all_students: manage,
          can_create_students: manage,
          can_manage_staff: manage,
          // Roles-page actions the school access endpoint now reports.
          staff_actions: {
            view: manage,
            create: manage,
            update: manage,
            delete: manage,
            assign: manage,
            export: manage,
            manage: manage,
          },
          workflow_actions: {
            view: manage,
            create: manage,
            update: manage,
            delete: manage,
            assign: manage,
            export: manage,
            manage: manage,
          },
          health_actions: {
            view: true,
            create: true,
            update: true,
            delete: true,
            assign: true,
            export: true,
            manage: true,
          },
          can_assign_school: manage,
          can_assign_students: manage,
          can_manage_workflows: manage,
          can_view_health: mental,
          can_view_mental: mental,
          can_view_physical: mental,
          can_view_risk: true,
          classroom_ids: [11],
        },
      });
    if (path === "/school/schools")
      return route.fulfill({
        json: [
          { id: 1, name: "โรงเรียนตัวอย่าง", code: "DEMO", status: "active" },
        ],
      });
    if (path === "/forms")
      return route.fulfill({
        json: [
          { id: 5, title: "แบบคัดกรองตัวอย่าง", health_domain: "mental" },
          { id: 6, title: "สุขภาพกายตัวอย่าง", health_domain: "physical" },
        ],
      });
    if (path === "/forms/5")
      return route.fulfill({
        json: {
          id: 5,
          questions: [
            {
              id: "q_grid",
              type: "grid_multiple",
              title: "กลุ่มคำถาม",
              rows: ["ข้อทั่วไป", "ข้อที่โรงเรียนต้องติดตาม"],
              cols: ["ไม่มี", "มี"],
            },
          ],
        },
      });
    if (path === "/school/students/import") {
      const b = req.postDataJSON();
      requests.push({ path, body: b });
      return route.fulfill({
        json: {
          results: b.rows.map((r, i) => ({
            ...r,
            row: b.row_offset + i + 1,
            name: "ข้อมูลทดสอบ",
            status: b.dry_run ? "will_create" : "created",
            errors: [],
            ...(b.dry_run ? {} : { password: "DemoStrong#2026" }),
          })),
        },
      });
    }
    if (path === "/school/promotions" && req.method() === "POST") {
      const body = req.postDataJSON();
      requests.push({ path, body });
      return route.fulfill({
        json: {
          dry_run: body.dry_run,
          data: [
            {
              from_classroom_id: 11,
              to_classroom_id: 12,
              count: 1,
            },
          ],
        },
      });
    }
    if (req.method() !== "GET") {
      const body = req.postDataJSON();
      requests.push({ path, body });
      return route.fulfill({
        json: { success: true, id: 9, data: [], results: [] },
      });
    }
    if (path === "/school/risk-summary")
      return route.fulfill({
        json: {
          data: [
            {
              id: 1,
              student_code: "0001",
              student_name: "เด็กหญิง สมหญิง สุขใจ",
              grade_name: "ม.1",
              classroom_name: "1/1",
              is_boarder: true,
              risk_status: "high",
              assessed_on: "2026-11-03",
              care_advice: "คำแนะนำที่โรงเรียนยืนยัน",
            },
          ],
        },
      });
    if (path === "/school/screening-rounds")
      return route.fulfill({
        json: [
          {
            id: 4,
            school_id: 1,
            name: "ต้นภาคเรียน",
            academic_year: 2569,
            semester: 2,
            health_domain: "mental",
            form_id: 5,
            form_title: "แบบคัดกรองตัวอย่าง",
            starts_on: "2026-11-02",
            ends_on: "2026-11-15",
            status: "active",
          },
        ],
      });
    if (path === "/school/screening-rounds/4/progress")
      return route.fulfill({
        json: {
          total: 2,
          completed: 1,
          outstanding: 1,
          data: [
            {
              id: 1,
              student_code: "0001",
              student_name: "เด็กหญิง สมหญิง สุขใจ",
              grade_name: "ม.1",
              classroom_name: "1/1",
              completed_on: null,
            },
          ],
        },
      });
    if (path === "/school/rescreen-tasks")
      return route.fulfill({
        json: [
          {
            id: 8,
            school_id: 1,
            student_id: 1,
            student_code: "0001",
            source_response_id: 30,
            target_form_id: 5,
            assigned_user_id: 2,
            assigned_username: "teacher-demo",
            created_at: "2026-11-04T08:00:00.000Z",
            due_on: "2026-11-15",
            status: "pending",
            overdue: false,
          },
        ],
      });
    if (path === "/school/workflow-settings/1")
      return route.fulfill({
        json: {
          care_advice: {
            high: "คำแนะนำที่โรงเรียนยืนยัน",
            medium: "",
            normal: "",
            none: "",
          },
          retention_years: 2,
        },
      });
    if (path === "/school/students")
      return route.fulfill({
        json: {
          data: [student],
          pagination: { page: 1, total_pages: 1, total: 1 },
        },
      });
    if (path === "/school/teachers")
      return route.fulfill({
        json: [{ id: 2, user_id: 2, name: "ครูตัวอย่าง" }],
      });
    if (path === "/school/rescreen-assignees")
      return route.fulfill({ json: [{ id: 2, username: "teacher-demo" }] });
    if (path === "/school/students/1/health")
      return route.fulfill({
        json: {
          assessments: {
            mental: [
              {
                id: 31,
                form_id: 5,
                form_title: "แบบคัดกรองตัวอย่าง",
                submitted_at: "2026-11-05T09:30:00.000Z",
                risk: "medium",
              },
              {
                id: 30,
                form_id: 5,
                form_title: "แบบคัดกรองตัวอย่าง",
                submitted_at: "2026-11-03",
                risk: "high",
              },
            ],
          },
        },
      });
    if (path.includes("/classrooms"))
      return route.fulfill({
        json:
          Number(url.searchParams.get("academic_year")) === 2570
            ? [
                {
                  id: 12,
                  name: "2/1",
                  academic_year: 2570,
                  grade_name: "ม.2",
                  level_order: 2,
                },
              ]
            : [
                {
                  id: 11,
                  name: "1/1",
                  academic_year: 2569,
                  grade_name: "ม.1",
                  level_order: 1,
                },
                {
                  id: 13,
                  name: "1/2",
                  academic_year: 2569,
                  grade_name: "ม.1",
                  level_order: 1,
                },
              ],
      });
    if (path.includes("/grades"))
      return route.fulfill({ json: [{ id: 5, name: "ม.1" }] });
    return route.fulfill({ json: [] });
  });
  return requests;
}
test("school workflows show minimal risk, actual round progress and accessible desktop/mobile layout", async ({
  page,
}, info) => {
  await setup(page);
  await page.goto("/admin/school/workflows");
  await expect(
    page.getByRole("heading", {
      name: "คัดกรองและติดตามโรงเรียน",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("คำแนะนำที่โรงเรียนยืนยัน", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('td[data-label="รหัสนักเรียน"]', { hasText: "0001" }),
  ).toBeVisible();
  await expect(
    page.locator('td[data-label="ชื่อ–นามสกุล"]', {
      hasText: "เด็กหญิง สมหญิง สุขใจ",
    }),
  ).toBeVisible();
  await expect(
    page.locator('td[data-label="ชั้น / ห้อง"]', { hasText: "ม.1 ห้อง 1/1" }),
  ).toBeVisible();
  await expect(
    page.locator('td[data-label="ที่พัก"]', { hasText: "หอพัก" }),
  ).toBeVisible();
  const audit = await new AxeBuilder({ page })
    .include(".sch-page")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
  await page.screenshot({
    path: `../outputs/school-workflows-risk-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "รอบประเมิน", exact: true }).click();
  const outstandingButton = page.getByRole("button", {
    name: "ดูผู้ยังไม่ประเมิน รอบ ต้นภาคเรียน",
  });
  await expect(outstandingButton).toHaveText("");
  await expect(
    page.getByRole("button", { name: "ปิดรอบ ต้นภาคเรียน" }),
  ).toHaveClass(/is-close/);
  await outstandingButton.click();
  await expect(
    page.getByRole("dialog", { name: "ผู้ยังไม่ประเมิน" }),
  ).toBeVisible();
  await expect(
    page.getByText("เด็กหญิง สมหญิง สุขใจ", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("ม.1 ห้อง 1/1", { exact: true })).toBeVisible();
  await expect(
    page.getByText("ทั้งหมด 2 คน · ประเมินแล้ว 1 คน · ยังไม่ประเมิน 1 คน"),
  ).toBeVisible();
  const size = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  expect(size.width).toBeLessThanOrEqual(size.viewport);
  await page.screenshot({
    path: `../outputs/school-workflows-rounds-${info.project.name}.png`,
    fullPage: true,
  });
});
test("school imports are separated from workflows and provide student and teacher templates", async ({
  page,
}, info) => {
  await setup(page);
  await page.goto("/admin/school/workflows");
  await expect(
    page.locator('summary[aria-label="เปิดเมนูจัดการ"]'),
  ).toHaveCount(0);
  await expect(
    page.locator('.sidebar a[href="/admin/school/import"]'),
  ).toHaveCount(1);
  await page.goto("/admin/school/import");
  await expect(
    page.getByRole("heading", { name: "นำเข้าข้อมูลโรงเรียน" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "ดาวน์โหลดแบบฟอร์ม" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ครู", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "ดาวน์โหลดแบบฟอร์ม" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "เลือกไฟล์" })).toBeVisible();
  await page.screenshot({
    path: `../.impeccable/review/import-${info.project.name === "mobile-chromium" ? "mobile" : "desktop"}.png`,
    fullPage: true,
  });
});
test("general and dormitory staff have the minimal workflow without insight management", async ({
  page,
}) => {
  await setup(page, { mental: false, manage: false });
  await page.goto("/admin/school/workflows");
  await expect(
    page.getByText("คำแนะนำที่โรงเรียนยืนยัน", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "คัดกรองซ้ำ", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator('summary[aria-label="เปิดเมนูจัดการ"]'),
  ).toHaveCount(0);
});
test("rescreen workflow selects an eligible assignee, source response and actual due date", async ({
  page,
}, info) => {
  const writes = await setup(page);
  await page.goto("/admin/school/workflows");
  await page.getByRole("button", { name: "คัดกรองซ้ำ", exact: true }).click();
  await expect(
    page.locator('td[data-label="รหัสนักเรียน"]', { hasText: "0001" }),
  ).toBeVisible();
  await expect(
    page.locator('td[data-label="ชื่อ–นามสกุล"]', {
      hasText: "เด็กหญิง สมหญิง สุขใจ",
    }),
  ).toBeVisible();
  await expect(
    page.locator('td[data-label="ชั้น / ห้อง"]', { hasText: "ม.1 ห้อง 1/1" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "สร้างงานใหม่", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "สร้างงานคัดกรองซ้ำ" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "นักเรียน", exact: true })
    .selectOption("1");
  await expect(
    page.getByRole("combobox", { name: "ผลประเมินต้นทาง" }),
  ).toHaveValue("31");
  await expect(
    page.getByRole("combobox", { name: "แบบประเมิน", exact: true }),
  ).toHaveValue("5");
  await page.getByRole("combobox", { name: "ผู้รับผิดชอบ" }).selectOption("2");
  await page
    .getByRole("textbox", { name: "กำหนดประเมินซ้ำ" })
    .fill("15/11/2569");
  await page.getByRole("button", { name: "สร้างงานติดตาม" }).click();
  await expect
    .poll(() => writes.some((w) => w.path === "/school/rescreen-tasks"))
    .toBe(true);
  expect(
    writes.find((w) => w.path === "/school/rescreen-tasks").body,
  ).toMatchObject({
    student_id: "1",
    source_response_id: "31",
    assigned_user_id: "2",
    target_form_id: "5",
    due_on: "2026-11-15",
  });
  const loadLatest = page.getByRole("button", {
    name: "โหลดการประเมินล่าสุดของ 0001",
  });
  await expect(loadLatest).toHaveText("");
  await loadLatest.click();
  await expect
    .poll(() => writes.some((w) => w.path === "/school/rescreen-tasks/8"))
    .toBe(true);
  expect(
    writes.find((w) => w.path === "/school/rescreen-tasks/8").body,
  ).toEqual({
    status: "completed",
    completed_response_id: 31,
  });
  await page.screenshot({
    path: `../.impeccable/review/followup-${info.project.name === "mobile-chromium" ? "mobile" : "desktop"}.png`,
    fullPage: true,
  });
});
test("student Excel/CSV onboarding processes 800 rows in batches with email and boarding metadata", async ({
  page,
}) => {
  const writes = await setup(page);
  await page.goto("/admin/school/students/import");
  const csv = [
    "รหัสนักเรียน,ชื่อ,นามสกุล,ชั้นปี,ห้อง,อีเมล,นักเรียนหอพัก",
    ...Array.from(
      { length: 800 },
      (_, i) =>
        `${String(i + 1).padStart(5, "0")},นักเรียน,ทดสอบ,ม.1,1/1,student${i + 1}@example.com,ใช่`,
    ),
  ].join("\n");
  await page.locator("input[type=file]").setInputFiles({
    name: "students-800.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await page
    .getByRole("button", { name: "ตรวจสอบข้อมูล", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "นำเข้า 800 คน", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "นำเข้า 800 คน", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "ผลการนำเข้า", exact: true }),
  ).toBeVisible();
  const imports = writes.filter((w) => w.path === "/school/students/import");
  expect(imports.length).toBe(16);
  expect(
    imports
      .filter((w) => w.body.dry_run === false)
      .reduce((n, w) => n + w.body.rows.length, 0),
  ).toBe(800);
  expect(imports[0].body.rows[0]).toMatchObject({
    student_code: "00001",
    email: "student1@example.com",
    is_boarder: "ใช่",
  });
});

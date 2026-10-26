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
          {
            id: 6,
            school_id: 1,
            name: "โฮมรูม ม.1 ห้อง 1/2",
            academic_year: 2569,
            semester: 2,
            health_domain: "mental",
            form_id: 5,
            form_title: "แบบคัดกรองตัวอย่าง",
            starts_on: "2026-10-27",
            ends_on: "2026-10-27",
            status: "active",
            grades: [],
            classrooms: [
              { id: 13, name: "1/2", grade_level_id: 5, grade_name: "ม.1" },
            ],
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
            target_form_title: "แบบคัดกรองสุขภาพจิต",
            has_account: true,
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
                  grade_level_id: 5,
                  grade_name: "ม.1",
                  level_order: 1,
                },
                {
                  id: 13,
                  name: "1/2",
                  academic_year: 2569,
                  grade_level_id: 5,
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
  await page.getByRole("button", { name: "รอบคัดกรอง", exact: true }).click();
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
    page.getByRole("button", { name: "ติดตามรายบุคคล", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator('summary[aria-label="เปิดเมนูจัดการ"]'),
  ).toHaveCount(0);
});
test("rescreen workflow lists tasks, filters by status and opens the student file to create one", async ({
  page,
}, info) => {
  const writes = await setup(page);
  await page.goto("/admin/school/workflows");
  await page
    .getByRole("button", { name: "ติดตามรายบุคคล", exact: true })
    .click();
  const studentCell = page.locator('td[data-label="นักเรียน"]').first();
  await expect(studentCell).toContainText("เด็กหญิง สมหญิง สุขใจ");
  await expect(studentCell).toContainText("0001");
  await expect(studentCell).toContainText("ม.1 ห้อง 1/1");
  await expect(
    page.locator('td[data-label="แบบประเมิน"]').first(),
  ).toContainText("แสดงในบัญชีนักเรียนแล้ว");
  // The status chips filter the list and keep their counts.
  await page.getByRole("button", { name: /^ประเมินแล้ว/ }).click();
  await expect(page.getByText("ไม่พบงานตามตัวกรอง")).toBeVisible();
  await page.getByRole("button", { name: /^ทั้งหมด/ }).click();
  // New tasks are made in the student file: pick the student, and the file
  // opens on the insights tab where the screening record and task are made.
  const opened = page.waitForRequest((r) =>
    new URL(r.url()).pathname.endsWith("/school/students/1"),
  );
  await page.getByRole("button", { name: "สร้างงานใหม่", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "สร้างงานคัดกรองหรือติดตาม" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "นักเรียน", exact: true })
    .selectOption("1");
  await page.getByRole("button", { name: "เปิดแฟ้มนักเรียน" }).click();
  await opened;
  await expect(
    page.getByRole("dialog", { name: "สร้างงานคัดกรองหรือติดตาม" }),
  ).toHaveCount(0);
  // The student file opens on its own page, on the insights tab.
  await expect(page).toHaveURL(/\/admin\/school\/students\/1\?tab=insights$/);
  await page.getByRole("button", { name: "กลับไปรายการ" }).click();
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

test("a screening round can be limited to grade levels, or cover the whole school", async ({
  page,
}) => {
  const requests = await setup(page);
  await page.goto("/admin/school/workflows");
  await page.getByRole("button", { name: "รอบคัดกรอง", exact: true }).click();
  // A round with no grade levels covers the whole school.
  await expect(
    page.locator("tr").filter({ hasText: "ต้นภาคเรียน" }),
  ).toContainText("ทั้งโรงเรียน");
  await page.getByRole("button", { name: "สร้างรอบประเมิน" }).click();
  const dialog = page.getByRole("dialog", { name: "สร้างรอบประเมิน" });
  await dialog.getByLabel("ชื่อรอบ").fill("ปลายภาคเรียน");
  await dialog
    .getByRole("combobox", { name: "แบบประเมิน", exact: true })
    .selectOption("5");
  await dialog
    .getByRole("textbox", { name: "เริ่มประเมิน" })
    .fill("01/02/2570");
  await dialog
    .getByRole("textbox", { name: "สิ้นสุดประเมิน" })
    .fill("15/02/2570");
  await dialog.getByRole("checkbox", { name: "ม.1" }).check();
  await dialog
    .getByRole("button", { name: "สร้างรอบประเมิน", exact: true })
    .click();
  await expect
    .poll(() => requests.find((r) => r.path === "/school/screening-rounds"))
    .toBeTruthy();
  expect(
    requests.find((r) => r.path === "/school/screening-rounds").body,
  ).toMatchObject({
    name: "ปลายภาคเรียน",
    form_id: "5",
    starts_on: "2027-02-01",
    ends_on: "2027-02-15",
    grade_level_ids: [5],
  });
});

test("a screening round can target single classrooms of a grade", async ({
  page,
}) => {
  const requests = await setup(page);
  await page.goto("/admin/school/workflows");
  await page.getByRole("button", { name: "รอบคัดกรอง", exact: true }).click();
  // The rounds table names the classroom a round is for.
  await expect(
    page.locator("tr").filter({ hasText: "โฮมรูม ม.1 ห้อง 1/2" }),
  ).toContainText("ม.1 ห้อง 1/2");
  await page.getByRole("button", { name: "สร้างรอบประเมิน" }).click();
  const dialog = page.getByRole("dialog", { name: "สร้างรอบประเมิน" });
  const room11 = dialog.getByRole("checkbox", { name: "ห้อง 1/1" });
  const room12 = dialog.getByRole("checkbox", { name: "ห้อง 1/2" });
  // Choosing the grade covers all its classrooms.
  await dialog.getByRole("checkbox", { name: "ม.1", exact: true }).check();
  await expect(room11).toBeChecked();
  await expect(room11).toBeDisabled();
  await dialog.getByRole("checkbox", { name: "ม.1", exact: true }).uncheck();
  await expect(room11).not.toBeChecked();
  await room12.check();
  await dialog.getByLabel("ชื่อรอบ").fill("โฮมรูม 1/2");
  await dialog
    .getByRole("combobox", { name: "แบบประเมิน", exact: true })
    .selectOption("5");
  await dialog
    .getByRole("textbox", { name: "เริ่มประเมิน" })
    .fill("27/10/2569");
  await dialog
    .getByRole("textbox", { name: "สิ้นสุดประเมิน" })
    .fill("27/10/2569");
  await dialog
    .getByRole("button", { name: "สร้างรอบประเมิน", exact: true })
    .click();
  await expect
    .poll(() => requests.find((r) => r.path === "/school/screening-rounds"))
    .toBeTruthy();
  expect(
    requests.find((r) => r.path === "/school/screening-rounds").body,
  ).toMatchObject({
    name: "โฮมรูม 1/2",
    grade_level_ids: [],
    classroom_ids: [13],
    starts_on: "2026-10-27",
    ends_on: "2026-10-27",
  });
});

test("rounds for every classroom follow the homeroom timetable in one request", async ({
  page,
}) => {
  const requests = await setup(page);
  await page.goto("/admin/school/workflows");
  await page.getByRole("button", { name: "รอบคัดกรอง", exact: true }).click();
  await page
    .getByRole("button", { name: "สร้างรอบให้ทุกห้องตามตาราง" })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "สร้างรอบให้ทุกห้องตามตาราง",
  });
  await dialog
    .getByRole("combobox", { name: "แบบประเมิน", exact: true })
    .selectOption("5");
  // Friday 23 Oct 2026, one classroom a day, weekends skipped.
  await dialog
    .getByRole("textbox", { name: "วันแรกของตาราง" })
    .fill("23/10/2569");
  await dialog.getByLabel("จำนวนห้องต่อวัน").fill("1");
  const timetable = dialog.getByRole("region", { name: "ตารางรอบรายห้อง" });
  await expect(
    timetable.locator("tr").filter({ hasText: "ม.1 ห้อง 1/1" }),
  ).toContainText("คัดกรองคาบโฮมรูม ม.1 ห้อง 1/1");
  await expect(
    timetable.locator("tr").filter({ hasText: "ม.1 ห้อง 1/2" }),
  ).toContainText("26");
  await dialog.getByRole("button", { name: "สร้าง 2 รอบ" }).click();
  await expect
    .poll(() =>
      requests.find((r) => r.path === "/school/screening-rounds/batch"),
    )
    .toBeTruthy();
  const body = requests.find(
    (r) => r.path === "/school/screening-rounds/batch",
  ).body;
  expect(body.school_id).toBe(1);
  expect(body.rounds).toHaveLength(2);
  expect(body.rounds[0]).toMatchObject({
    name: "คัดกรองคาบโฮมรูม ม.1 ห้อง 1/1",
    form_id: "5",
    starts_on: "2026-10-23",
    ends_on: "2026-10-23",
    classroom_ids: [11],
  });
  expect(body.rounds[1]).toMatchObject({
    starts_on: "2026-10-26",
    ends_on: "2026-10-26",
    classroom_ids: [13],
  });
  await expect(
    page.getByRole("dialog", { name: "สร้างรอบให้ทุกห้องตามตาราง" }),
  ).toHaveCount(0);
});

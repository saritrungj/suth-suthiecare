import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const student = {
  id: 11,
  school_id: 2,
  student_code: "DEMO011",
  first_name: "นักเรียนจำลอง",
  last_name: "ในความดูแล",
  status: "active",
  can_view_health: true,
  can_view_mental: true,
  can_view_physical: true,
  can_update_health: false,
};
async function setup(
  page,
  admin = false,
  organizations = [
    { id: 3, name: "โรงเรียนจำลอง", org_type: "school", org_level: "unit" },
  ],
  students = [student],
) {
  const writes = [];
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "suth_user",
      JSON.stringify({ id: 5, username: "synthetic-parent", role_id: 7 }),
    );
    localStorage.setItem("suth_active_organization_5", "3");
    document.cookie = "suth_staff_session=synthetic; path=/";
  });
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname.replace(/^\/api/, "");
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
          // A school administrator, not a system admin: system admins manage
          // duties in the Add User modal and no longer see this page.
          is_system_admin: admin && organizations.length === 0,
          organizations,
          memberships: [
            {
              organization: organizations[0],
              role: { name: "school_guardian" },
              permissions: [
                "students.view",
                "student_health.view",
                "clinical.view",
                "pii.view",
                "cases.view",
              ],
            },
          ],
        },
      });
    if (path === "/school/access")
      return route.fulfill({
        json: {
          is_guardian: !admin,
          can_view_students: true,
          can_view_school: admin,
          can_manage_staff: admin,
          // Roles-page actions the school access endpoint now reports.
          staff_actions: {
            view: admin,
            create: admin,
            update: admin,
            delete: admin,
            assign: admin,
            export: admin,
            manage: admin,
          },
          workflow_actions: {
            view: admin,
            create: admin,
            update: admin,
            delete: admin,
            assign: admin,
            export: admin,
            manage: admin,
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
          can_assign_school: admin,
          can_assign_students: admin,
          can_view_health: true,
          can_view_mental: true,
          can_view_physical: true,
          can_update_health: admin,
        },
      });
    if (path === "/school/students")
      return route.fulfill({
        json: {
          data: [student],
          pagination: { total: 1, page: 1, total_pages: 1, limit: 20 },
        },
      });
    if (path === "/school/students/11") return route.fulfill({ json: student });
    if (path === "/school/students/11/health")
      return route.fulfill({
        json: {
          student,
          can_update: false,
          profile: { blood_type: "O", allergies: "ข้อมูลจำลอง" },
          physical_records: [],
          assessments: { mental: [], physical: [], other: [] },
        },
      });
    if (path === "/school/students/11/insights")
      return route.fulfill({
        json: {
          can_update: false,
          profile: {
            guardian_name: "ผู้ปกครองจำลอง",
            living_conditions: "ข้อมูลครอบครัวจำลอง",
          },
          records: [
            {
              id: 1,
              recorded_at: "2026-10-15",
              recorded_by: 8,
              recorded_by_name: "ครู สมใจ ดูแล",
              issue: "บันทึกจำลอง",
              support: "ติดตามต่อเนื่อง",
            },
          ],
        },
      });
    if (path === "/school/staff-roles")
      return route.fulfill({
        json: {
          schools: [
            { id: 2, name: "โรงเรียนจำลอง" },
            { id: 4, name: "โรงเรียนตัวอย่าง" },
          ],
          members: [],
          roles: [],
          guardians: [],
          students,
          role_labels: { guardian: "ผู้ปกครอง", other: "ครูทั่วไป" },
        },
      });
    if (path === "/school/guardian-accounts") {
      writes.push(req.postDataJSON());
      return route.fulfill({
        status: 201,
        json: { id: 50, username: "demo-parent" },
      });
    }
    return route.fulfill({ json: [] });
  });
  return writes;
}

test("guardian opens only their student file and all health and insight tabs are read only", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/admin/dashboard");
  await expect(
    page.getByRole("heading", { name: "นักเรียนในความดูแล", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "เพิ่มนักเรียน", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "ดูข้อมูล", exact: true }).click();
  await page.getByRole("tab", { name: "ข้อมูลเชิงลึก", exact: true }).click();
  await expect(page.getByText("ข้อมูลครอบครัวจำลอง")).toBeVisible();
  await expect(page.getByText("บันทึกจำลอง", { exact: true })).toBeVisible();
  await expect(page.getByText(/ครู สมใจ ดูแล/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "บันทึกข้อมูลเชิงลึก" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "เพิ่มบันทึกแนะแนว" }),
  ).toHaveCount(0);
  await page.screenshot({
    path: `../outputs/guardian-insights-${test.info().project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const accessibility = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test("school administrator creates a guardian account with a password and explicit child links", async ({
  page,
}) => {
  const writes = await setup(page, true);
  await page.goto("/admin/school/roles");
  await page
    .getByRole("button", { name: "สร้างบัญชีผู้ปกครอง", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("ชื่อผู้ใช้", { exact: true }).fill("demo-parent");
  await dialog
    .getByLabel("ชื่อ–นามสกุล", { exact: true })
    .fill("ผู้ปกครองจำลอง");
  await dialog
    .getByLabel("อีเมล", { exact: true })
    .fill("demo-parent@example.test");
  await dialog.getByLabel("รหัสผ่าน", { exact: true }).fill("Synthetic-901!");
  await dialog.getByRole("checkbox", { name: "รหัสนักเรียน DEMO011" }).check();
  await page.screenshot({
    path: `../outputs/guardian-create-${test.info().project.name}.png`,
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "สร้างบัญชี", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes[0]).toMatchObject({
    school_id: 2,
    student_ids: [11],
    username: "demo-parent",
    password: "Synthetic-901!",
  });
  await expect(page.getByRole("status")).toContainText(
    "สร้างบัญชีผู้ปกครอง demo-parent เรียบร้อยแล้ว",
  );
});

test("missing school organization gives a branded recovery page", async ({
  page,
}) => {
  await setup(page, true, []);
  await page.goto("/admin/school/students");
  await expect(
    page.getByRole("heading", {
      name: "ยังไม่มีหน่วยงานโรงเรียนที่พร้อมใช้งาน",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "จัดการหน่วยงาน", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `../outputs/organization-empty-${test.info().project.name}.png`,
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .include(".organization-workspace-empty")
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("guardian student picker shows names, paginates and keeps selections across search and pages", async ({
  page,
}) => {
  const students = Array.from({ length: 56 }, (_, i) => ({
    ...student,
    id: i + 1,
    student_code: `DEMO${String(i + 1).padStart(3, "0")}`,
    first_name: `นักเรียนจำลอง${i + 1}`,
    last_name: "ทดสอบ",
  }));
  students.push({
    ...student,
    id: 99,
    school_id: 4,
    first_name: "นักเรียนต่างโรงเรียน",
  });
  const writes = await setup(page, true, undefined, students);
  await page.goto("/admin/school/roles");
  await page
    .getByRole("button", { name: "สร้างบัญชีผู้ปกครอง", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const picker = dialog.locator("fieldset");
  const search = picker.getByLabel("ค้นหาชื่อหรือรหัสนักเรียน");
  const size = picker.getByLabel("จำนวนรายการต่อหน้า");
  await expect(picker.getByRole("checkbox")).toHaveCount(10);
  await expect(
    picker.getByText("นักเรียนจำลอง1 ทดสอบ", { exact: true }),
  ).toBeVisible();
  await expect(
    picker.getByText("นักเรียนต่างโรงเรียน ทดสอบ", { exact: true }),
  ).toHaveCount(0);
  await expect(
    picker.getByRole("button", { name: "หน้าก่อนหน้า" }),
  ).toBeDisabled();
  await page.screenshot({
    path: `../outputs/guardian-pagination-first-${test.info().project.name}.png`,
    fullPage: true,
  });
  await picker.getByRole("checkbox", { name: /DEMO001/ }).check();
  await picker.getByRole("button", { name: "หน้าถัดไป" }).click();
  await picker.getByRole("checkbox", { name: /DEMO011/ }).check();
  await expect(picker.locator("legend")).toContainText("2 คน");
  await search.fill("นักเรียนจำลอง56");
  await expect(picker.getByRole("checkbox")).toHaveCount(1);
  await expect(
    picker.getByRole("button", { name: "หน้าถัดไป" }),
  ).toBeDisabled();
  await search.fill("ไม่พบชื่อนี้");
  await expect(picker.getByRole("status")).toHaveText(
    "ไม่พบนักเรียนที่ตรงกับการค้นหา",
  );
  await search.fill("");
  await expect(picker.getByRole("checkbox", { name: /DEMO001/ })).toBeChecked();
  await size.selectOption("25");
  await expect(picker.getByRole("checkbox")).toHaveCount(25);
  await expect(picker.getByRole("checkbox", { name: /DEMO011/ })).toBeChecked();
  await picker.getByRole("button", { name: "หน้าถัดไป" }).click();
  await size.selectOption("50");
  await expect(picker.getByRole("checkbox")).toHaveCount(50);
  await picker.getByRole("button", { name: "หน้าถัดไป" }).click();
  await expect(picker.getByRole("checkbox")).toHaveCount(6);
  await expect(
    picker.getByRole("button", { name: "หน้าถัดไป" }),
  ).toBeDisabled();
  await dialog.getByLabel("โรงเรียน", { exact: true }).selectOption("4");
  await expect(picker.getByRole("checkbox")).toHaveCount(1);
  await expect(picker.locator("legend")).toContainText("0 คน");
  await dialog.getByLabel("โรงเรียน", { exact: true }).selectOption("2");
  await picker.getByRole("checkbox", { name: /DEMO001/ }).check();
  await picker.getByRole("button", { name: "หน้าถัดไป" }).click();
  await picker.getByRole("checkbox", { name: /DEMO056/ }).check();
  await dialog.getByLabel("ชื่อผู้ใช้", { exact: true }).fill("demo-parent");
  await dialog
    .getByLabel("ชื่อ–นามสกุล", { exact: true })
    .fill("ผู้ปกครองจำลอง");
  await dialog
    .getByLabel("อีเมล", { exact: true })
    .fill("demo-parent@example.test");
  await dialog.getByLabel("รหัสผ่าน", { exact: true }).fill("Synthetic-901!");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    (await new AxeBuilder({ page }).include('[role="dialog"]').analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({
    path: `../outputs/guardian-pagination-${test.info().project.name}.png`,
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "สร้างบัญชี", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes[0].student_ids).toEqual([1, 56]);
});

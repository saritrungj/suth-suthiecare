import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function setup(page, { system = true, role = 3, initial = "1" } = {}) {
  const requests = [],
    writes = [];
  let rows = [
    {
      id: 1,
      code: "demo",
      label: "รายการทดสอบ",
      sort_order: 0,
      is_active: true,
    },
  ];
  let rejectSave = false,
    rejectRead = false;
  await page.addInitScript(
    ({ role, initial }) => {
      sessionStorage.setItem(
        "suth_user",
        JSON.stringify({ id: 5, username: "synthetic-admin", role_id: role }),
      );
      localStorage.setItem("suth_active_organization_5", initial);
      document.cookie = "suth_staff_session=synthetic; path=/";
    },
    { role, initial },
  );
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname.replace(/^\/api/, "");
    const org =
      new URL(request.url()).searchParams.get("organization_id") ||
      request.headers()["x-organization-id"];
    requests.push({ path, org });
    if (path === "/session/staff")
      return route.fulfill({
        json: {
          user: { id: 5, username: "synthetic-admin", role_id: role },
          csrf_token: "synthetic",
        },
      });
    if (path === "/session/patient")
      return route.fulfill({ status: 401, json: {} });
    if (path === "/me/authorization")
      return route.fulfill({
        json: {
          user: { id: 5, role_id: role },
          is_system_admin: system,
          organizations: [
            {
              id: 1,
              name: "โรงพยาบาลจำลอง",
              org_type: "hospital",
              org_level: "unit",
            },
            {
              id: 3,
              name: "โรงเรียนจำลอง",
              org_type: "school",
              org_level: "unit",
            },
          ],
          memberships: system
            ? []
            : [
                {
                  organization: {
                    id: 1,
                    name: "โรงพยาบาลจำลอง",
                    org_type: "hospital",
                  },
                  role: { id: 3 },
                  permissions: ["master_data.view"],
                },
              ],
        },
      });
    if (path === "/school/access")
      return route.fulfill({
        json: {
          can_view_school: true,
          can_create_school: true,
          can_update_school: true,
          can_delete_school: true,
        },
      });
    if (path === "/master-data/categories")
      return route.fulfill({
        json: {
          can_manage: system,
          categories: [
            {
              code: "prefix",
              label: "คำนำหน้า",
              group: "general",
              fields: ["label"],
            },
            {
              code: "teacher_types",
              label: "ประเภทครู",
              group: "school",
              hint: "ใช้กับรายชื่อครูและไฟล์นำเข้าครู",
              fields: ["name", "description"],
            },
            {
              code: "templates",
              label: "แม่แบบบันทึก",
              group: "service",
              fields: ["label", "text", "clinic_type"],
            },
          ],
        },
      });
    if (path.startsWith("/master-data/")) {
      if (request.method() !== "GET") {
        if (rejectSave)
          return route.fulfill({
            status: 409,
            json: { message: "รหัสหรือชื่อนี้มีอยู่แล้ว" },
          });
        const body = request.postDataJSON();
        writes.push({ path, org, body });
        if (request.method() === "POST") rows.push({ ...body, id: 2 });
        else
          rows = rows.map((row) => (row.id === 1 ? { ...row, ...body } : row));
        return route.fulfill({ json: { id: 2 } });
      }
      if (rejectRead)
        return route.fulfill({
          status: 503,
          json: { message: "โหลดข้อมูลหลักไม่สำเร็จ" },
        });
      return route.fulfill({
        json:
          org === "all"
            ? rows.map((row) => ({
                ...row,
                organization_id: 3,
                organization_name: "โรงเรียนจำลอง",
              }))
            : rows,
      });
    }
    return route.fulfill({ json: [] });
  });
  return {
    requests,
    writes,
    rejectSave(value) {
      rejectSave = value;
    },
    rejectRead(value) {
      rejectRead = value;
    },
  };
}

async function selectOrganization(page, value) {
  await expect(
    page.getByLabel("หน่วยงานที่กำลังใช้งาน", { exact: true }),
  ).toBeAttached();
  const open = page.getByRole("button", { name: "Open Menu", exact: true });
  if (await open.isVisible()) await open.click();
  await page
    .getByLabel("หน่วยงานที่กำลังใช้งาน", { exact: true })
    .selectOption(value);
  const close = page.getByRole("button", { name: "Close Menu", exact: true });
  if (await close.isVisible()) await close.click();
}

test("the old school types address opens teacher types in master data", async ({
  page,
}) => {
  await setup(page, { initial: "all" });
  await page.goto("/admin/school/types");
  await expect(page).toHaveURL(/\/admin\/master-data\?category=teacher_types/);
  const nav = page.getByRole("navigation", { name: "หมวดข้อมูล" });
  // Phones get the category list as a select; wider screens the side list.
  const phone = (page.viewportSize()?.width || 1280) <= 760;
  const picker = page.getByRole("combobox", { name: "หมวดข้อมูล" });
  if (phone) await expect(picker).toHaveValue("teacher_types");
  else
    await expect(
      nav.getByRole("button", { name: "ประเภทครู" }),
    ).toHaveAttribute("aria-current", "true");
  await expect(
    page.getByRole("heading", { name: "ประเภทครู", level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByText("ใช้กับรายชื่อครูและไฟล์นำเข้าครู"),
  ).toBeVisible();
  if (phone) await picker.selectOption("prefix");
  else await nav.getByRole("button", { name: "คำนำหน้า" }).click();
  await expect(page).toHaveURL(/category=prefix/);
  await expect(
    page.getByRole("columnheader", { name: "รหัส", exact: true }),
  ).toBeVisible();
});

test("master starts with all organizations and saves under each row organization", async ({
  page,
}) => {
  const state = await setup(page, { initial: "all" });
  await page.goto("/admin/master-data");
  await expect(
    page.getByRole("combobox", { name: "หน่วยงานที่จัดการ" }),
  ).toHaveValue("all");
  await expect(
    page.getByRole("columnheader", { name: "หน่วยงาน", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".organization-workspace-scope")).toHaveCount(0);
  await expect(page.getByText("รายการทดสอบ", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "แก้ไข", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("ชื่อรายการ", { exact: true }).fill("รายการที่แก้ไข");
  await dialog.getByLabel("ใช้งาน", { exact: true }).uncheck();
  await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.writes[0]).toMatchObject({
    org: "3",
    body: { code: "demo", label: "รายการที่แก้ไข", is_active: false },
  });
  await page
    .getByRole("combobox", { name: "สถานะ", exact: true })
    .selectOption("active");
  await expect(page.getByText("ไม่พบรายการตามตัวกรอง")).toBeVisible();
  await page
    .getByRole("combobox", { name: "สถานะ", exact: true })
    .selectOption("");
  await page.getByRole("searchbox").fill("ไม่มีคำนี้");
  await expect(page.getByText("ไม่พบรายการตามตัวกรอง")).toBeVisible();
  await page.getByRole("searchbox").fill("");
  await expect(page.getByRole("table")).toHaveAttribute("aria-busy", "false");
  await expect(page.getByRole("button", { name: "โหลดใหม่" })).toBeEnabled();
  const searchBox = await page
    .locator(".master-toolbar .sch-search-group")
    .boundingBox();
  expect(searchBox.height).toBeGreaterThanOrEqual(44);
  expect(searchBox.height).toBeLessThan(50);
  await page.getByRole("searchbox").blur();
  await page
    .locator(".master-page")
    .evaluate((node) => node.parentElement.scrollTo(0, 0));
  await page.screenshot({
    path: `../outputs/master-unified-${test.info().project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const results = await new AxeBuilder({ page })
    .include(".organization-workspace")
    .analyze();
  expect(results.violations).toEqual([]);
});

test("master validates new codes, keeps failed edits and retries reads", async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto("/admin/master-data");
  await page
    .getByRole("combobox", { name: "หน่วยงานที่จัดการ" })
    .selectOption("1");
  await page.getByRole("button", { name: "เพิ่มรายการ", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("รหัส", { exact: true }).fill("new-code");
  await dialog.getByLabel("ชื่อรายการ", { exact: true }).fill("รายการใหม่");
  state.rejectSave(true);
  await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("มีอยู่แล้ว");
  await expect(dialog.getByLabel("ชื่อรายการ", { exact: true })).toHaveValue(
    "รายการใหม่",
  );
  state.rejectSave(false);
  await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("รายการใหม่", { exact: true })).toBeVisible();
  expect(state.writes[0].body.code).toBe("new-code");
  state.rejectRead(true);
  await page.getByRole("button", { name: "โหลดใหม่" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "โหลดข้อมูลหลักไม่สำเร็จ",
  );
  state.rejectRead(false);
  await page.getByRole("button", { name: "โหลดใหม่" }).click();
  await expect(page.getByText("รายการใหม่", { exact: true })).toBeVisible();
});

test("ordinary staff remains limited to membership and cannot edit master", async ({
  page,
}) => {
  await setup(page, { system: false });
  await page.goto("/admin/master-data");
  await expect(page.getByText("รายการทดสอบ", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "เพิ่มรายการ", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "แก้ไข", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "หน่วยงานที่จัดการ" }),
  ).toHaveCount(0);
  await page.goto("/admin/school/types");
  await expect(page).toHaveURL(/\/admin\/master-data/);
});

test("school workflows can switch between every school in the selected organization", async ({
  page,
}) => {
  await setup(page);
  await page.route("**/api/school/schools", (route) =>
    route.fulfill({
      json: [
        { id: 11, name: "โรงเรียนจำลอง ก", status: "active" },
        { id: 12, name: "โรงเรียนจำลอง ข", status: "active" },
      ],
    }),
  );
  await page.goto("/admin/school/workflows");
  await expect(
    page.getByLabel("หน่วยงานที่กำลังใช้งาน", { exact: true }),
  ).toHaveValue("3");
  const select = page.getByRole("combobox", { name: "โรงเรียน", exact: true });
  await expect(select).toHaveValue("11");
  const request = page.waitForRequest((request) =>
    request.url().includes("/school/risk-summary?school_id=12"),
  );
  await select.selectOption("12");
  expect((await request).headers()["x-organization-id"]).toBe("3");
  await expect(select).toHaveValue("12");
});

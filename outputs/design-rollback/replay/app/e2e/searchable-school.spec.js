import { test, expect } from "@playwright/test";

async function setup(page) {
  await page.clock.setFixedTime(new Date("2026-10-15T03:00:00Z"));
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "suth_user",
      JSON.stringify({ id: 1, username: "demo", role_id: 1 }),
    );
    localStorage.setItem("suth_active_organization_1", "3");
    document.cookie = "suth_staff_session=synthetic; path=/";
  });
  const writes = [],
    reads = [];
  const years = [2570, 2569, 2559];
  const school = {
    id: 1,
    name: "โรงเรียนตัวอย่าง",
    code: "DEMO",
    status: "active",
  };
  const grades = [
    { id: 5, name: "ม.1", level_order: 1, status: "active" },
    { id: 6, name: "ม.2", level_order: 2, status: "active" },
  ];
  const roles = {
    admin: "ผู้ดูแลโรงเรียน",
    homeroom: "ครูประจำชั้น",
    counselor: "ครูแนะแนว",
    guardian: "ผู้ปกครอง",
    other: "ครูอื่น",
  };
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname.replace(/^\/api/, "");
    const send = (json) => route.fulfill({ json });
    if (req.method() === "POST" || req.method() === "PUT") {
      const body = req.postDataJSON();
      writes.push({ path, body });
      if (path.endsWith("/academic-years")) {
        years.push(body.academic_year);
        return route.fulfill({ status: 201, json: body });
      }
      return send({ success: true, id: 1, name: "3" });
    }
    if (path === "/session/staff")
      return send({
        user: { id: 1, role_id: 1, username: "demo" },
        csrf_token: "synthetic",
      });
    if (path === "/session/patient")
      return route.fulfill({ status: 401, json: {} });
    if (path === "/me/authorization")
      return send({
        user: { id: 1, role_id: 1 },
        is_system_admin: true,
        organizations: [
          {
            id: 3,
            name: school.name,
            org_type: "school",
            org_level: "unit",
            status: "active",
          },
        ],
        memberships: [],
      });
    if (path === "/school/access")
      return send({
        can_view_school: true,
        can_create_school: true,
        can_update_school: true,
        can_delete_school: true,
        can_manage_staff: true,
        can_view_students: true,
        can_export_students: true,
      });
    if (path === "/school/schools") return send([school]);
    if (path.endsWith("/academic-years"))
      return send({ current_year: 2569, minimum_year: 2559, years });
    if (path.endsWith("/grades")) return send(grades);
    if (path.endsWith("/classrooms")) {
      reads.push(url.searchParams.get("academic_year"));
      const year = Number(url.searchParams.get("academic_year")) || 2569;
      return send([
        {
          id: 11,
          grade_level_id: 5,
          grade_name: "ม.1",
          name: "1",
          academic_year: year,
          status: "active",
          student_count: 28,
          teachers: [{ teacher_id: 2, role: "homeroom", name: "ครูตัวอย่าง" }],
        },
        {
          id: 12,
          grade_level_id: 6,
          grade_name: "ม.2",
          name: "2",
          academic_year: year,
          status: "active",
          student_count: 24,
          teachers: [],
        },
      ]);
    }
    if (path === "/school/teachers")
      return send([
        {
          id: 2,
          name: "ครูตัวอย่าง",
          username: "teacher-demo",
          status: "active",
        },
      ]);
    if (path === "/school/staff-roles")
      return send({
        schools: [school],
        members: [
          { id: 2, username: "teacher-demo" },
          { id: 3, username: "counselor-demo" },
        ],
        roles: [
          { school_id: 1, user_id: 2, role_code: "homeroom", status: "active" },
        ],
        role_labels: roles,
      });
    return send([]);
  });
  return { writes, reads };
}

test("search changes a year, supports keyboard and resets to current on return", async ({
  page,
}, info) => {
  const { reads } = await setup(page);
  await page.goto("/admin/school");
  const select = page.getByLabel("ปีการศึกษา (พ.ศ.)", { exact: true });
  await expect(select).toHaveValue("2569");
  await page.screenshot({
    path: `../outputs/school-structure-search-${info.project.name}.png`,
    fullPage: true,
  });
  await select.click();
  const search = page.getByRole("combobox", { name: "ค้นหาปีการศึกษา (พ.ศ.)" });
  await expect(search).toBeFocused();
  await search.fill("2570");
  await expect(
    page.getByRole("option", { name: "2570", exact: true }).last(),
  ).toBeVisible();
  await page.screenshot({
    path: `../outputs/searchable-select-${info.project.name}.png`,
    fullPage: true,
  });
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(select).toHaveValue("2570");
  await expect.poll(() => reads.at(-1)).toBe("2570");
  await expect(select).toBeFocused();
  await page
    .getByRole("navigation", { name: "จัดการโรงเรียน" })
    .getByRole("link", { name: "รายชื่อครู" })
    .click();
  await expect(
    page.getByRole("heading", { name: "รายชื่อครู", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "จัดการโรงเรียน" })
    .getByRole("link", { name: "ชั้นปีและห้องเรียน" })
    .click();
  await expect(select).toHaveValue("2569");
  expect(
    await page
      .locator("body")
      .evaluate((el) => el.scrollWidth > window.innerWidth),
  ).toBe(false);
});

test("master year creation validates boundary and updates room editor options", async ({
  page,
}) => {
  const { writes } = await setup(page);
  await page.goto("/admin/school");
  await page.getByText("ตั้งค่าปีการศึกษาและชั้นปี", { exact: true }).click();
  await page.getByLabel("ปีการศึกษาใหม่ (พ.ศ.)").fill("2558");
  await page
    .getByRole("button", { name: "เพิ่มปีการศึกษา", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("2559");
  expect(writes).toHaveLength(0);
  await page.getByLabel("ปีการศึกษาใหม่ (พ.ศ.)").fill("2571");
  await page
    .getByRole("button", { name: "เพิ่มปีการศึกษา", exact: true })
    .click();
  await expect(
    page
      .getByLabel("ปีการศึกษา (พ.ศ.)", { exact: true })
      .locator('option[value="2571"]'),
  ).toHaveCount(1);
  await expect(
    page.getByLabel("ปีการศึกษา (พ.ศ.)", { exact: true }),
  ).toHaveValue("2569");
  await page
    .getByRole("button", { name: "แก้ไข ม.1 ห้อง 1", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "แก้ไขห้องเรียน" });
  const select = dialog.getByLabel("ปีการศึกษา (พ.ศ.)");
  await select.click();
  await page.getByRole("combobox", { name: /ค้นหาปีการศึกษา/ }).fill("2571");
  await page
    .getByRole("listbox")
    .getByRole("option", { name: "2571", exact: true })
    .click();
  await expect(select).toHaveValue("2571");
  await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect
    .poll(() =>
      writes.some(
        (w) =>
          w.path === "/school/classrooms/11" && w.body.academic_year === "2571",
      ),
    )
    .toBe(true);
});

test("unassigned filter and teacher role search work inside a dialog", async ({
  page,
}) => {
  const { writes } = await setup(page);
  await page.goto("/admin/school");
  await page.getByLabel(/เฉพาะห้องที่ยังไม่มีครู/).check();
  await expect(
    page.getByRole("region", { name: "ม.1", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "กำหนดครู ม.2 ห้อง 2" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox", { name: /ครูตัวอย่าง/ }).check();
  const select = dialog.getByLabel("บทบาทของ ครูตัวอย่าง");
  await select.click();
  const search = page.getByRole("combobox", {
    name: "ค้นหาบทบาทของ ครูตัวอย่าง",
  });
  await search.fill("แนะแนว");
  await search.press("Enter");
  await expect(select).toHaveValue("counselor");
  await select.click();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(select).toBeFocused();
  await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect
    .poll(() =>
      writes.some(
        (w) =>
          w.path === "/school/classrooms/12/teachers" &&
          JSON.stringify(w.body).includes("counselor"),
      ),
    )
    .toBe(true);
});

test("role workspace lists members first and opens searchable edit form", async ({
  page,
}, info) => {
  const { writes } = await setup(page);
  await page.goto("/admin/school/roles");
  await expect(
    page.getByRole("cell", { name: "teacher-demo", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.screenshot({
    path: `../outputs/school-role-workspace-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "แก้ไข", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const select = dialog.getByRole("combobox", { name: "บทบาท", exact: true });
  await select.click();
  await page
    .getByRole("combobox", { name: "ค้นหาบทบาท", exact: true })
    .fill("แนะแนว");
  await page
    .getByRole("listbox")
    .getByRole("option", { name: "ครูแนะแนว", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "บันทึกบทบาท", exact: true })
    .click();
  await expect
    .poll(() =>
      writes.some(
        (w) =>
          w.path === "/school/staff-roles" && w.body.role_code === "counselor",
      ),
    )
    .toBe(true);
  await expect(dialog).toHaveCount(0);
});

test("empty year filters can be reset and failed loading does not claim missing grades", async ({
  page,
}, info) => {
  await setup(page);
  await page.route("**/api/school/schools/1/classrooms?*", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.goto("/admin/school");
  await expect(
    page.getByText("ยังไม่มีห้องในปีการศึกษา 2569").first(),
  ).toBeVisible();
  await page.getByLabel(/เฉพาะห้องที่ยังไม่มีครู/).check();
  await expect(
    page.getByText("ไม่พบห้องเรียนตามตัวกรอง", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `../outputs/school-structure-empty-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "ล้างตัวกรอง", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "ม.1", exact: true }),
  ).toBeVisible();
  await page.route("**/api/school/schools/1/classrooms?*", (route) =>
    route.fulfill({
      status: 500,
      json: { message: "โหลดข้อมูลทดสอบไม่สำเร็จ" },
    }),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "โหลดข้อมูลทดสอบไม่สำเร็จ",
  );
  await expect(page.getByText("ยังไม่มีชั้นปี", { exact: true })).toHaveCount(
    0,
  );
  await page.screenshot({
    path: `../outputs/school-structure-error-${info.project.name}.png`,
    fullPage: true,
  });
});

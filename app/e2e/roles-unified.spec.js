import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function setup(page) {
  const organizations = [
    {
      id: 1,
      name: "หน่วยงานหนึ่ง",
      org_type: "hospital",
      org_level: "unit",
      kind: "unit",
      status: "active",
    },
    {
      id: 2,
      name: "โรงเรียนสอง",
      org_type: "school",
      org_level: "unit",
      kind: "unit",
      status: "active",
    },
  ];
  const roles = {
    1: [{ id: 3, name: "เจ้าหน้าที่หน่วยงานหนึ่ง" }],
    2: [{ id: 4, name: "ผู้ติดตามหน่วยงานสอง" }],
  };
  const writes = [];
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "suth_user",
      JSON.stringify({ id: 1, username: "synthetic-admin", role_id: 1 }),
    );
    localStorage.setItem("suth_active_organization_1", "1");
    document.cookie = "suth_staff_session=synthetic; path=/";
  });
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname.replace(/^\/api/, "");
    if (path === "/session/staff")
      return route.fulfill({
        json: { user: { id: 1, role_id: 1 }, csrf_token: "synthetic" },
      });
    if (path === "/session/patient")
      return route.fulfill({ status: 401, json: {} });
    if (path === "/me/authorization")
      return route.fulfill({
        json: {
          user: { id: 1, role_id: 1 },
          is_system_admin: true,
          organizations,
          memberships: [],
          system_permissions: ["roles.manage"],
        },
      });
    if (path === "/organizations")
      return route.fulfill({ json: organizations });
    if (path === "/users") return route.fulfill({ json: [] });
    if (path === "/users/assignment-options")
      return route.fulfill({
        json: {
          organizations: {
            2: {
              schools: [{ id: 21, name: "โรงเรียนสาธิต" }],
              teacher_types: [{ id: 31, name: "ครูประจำการ" }],
              role_labels: {
                admin: "ผู้ดูแลข้อมูลทั่วไป",
                homeroom: "ครูประจำชั้น",
                other: "ครูทั่วไป",
              },
            },
          },
        },
      });
    if (path.match(/^\/organizations\/\d+\/members$/))
      return route.fulfill({ json: [] });
    const rolePath = path.match(/^\/organizations\/(\d+)\/roles$/);
    if (rolePath) {
      if (req.method() === "POST") {
        const body = req.postDataJSON();
        writes.push({ path, body });
        const role = { id: 20, ...body };
        roles[rolePath[1]].push(role);
        return route.fulfill({ status: 201, json: role });
      }
      return route.fulfill({ json: roles[rolePath[1]] });
    }
    if (path.match(/^\/organizations\/\d+\/roles\/\d+\/permissions$/)) {
      if (req.method() === "PUT") {
        writes.push({ path, body: req.postDataJSON() });
        return route.fulfill({ json: { version: 2, success: true } });
      }
      return route.fulfill({
        json: {
          permissions: path.includes("/1/")
            ? ["cases.view"]
            : ["students.view"],
          version: 1,
          configured: true,
        },
      });
    }
    return route.fulfill({ json: [] });
  });
  return writes;
}

test("roles edits only the selected unit and separates system authority", async ({
  page,
}) => {
  const writes = await setup(page);
  await page.goto("/admin/roles");
  const section = page.getByRole("region", {
    name: "บทบาทและสิทธิ์ในหน่วยงาน",
    exact: true,
  });
  await expect(
    section.getByRole("radio", {
      name: "เจ้าหน้าที่หน่วยงานหนึ่ง",
      exact: true,
    }),
  ).toBeChecked();
  await expect(
    section
      .getByRole("group", { name: "ข้อมูลเคสและเคสเสี่ยง" })
      .getByRole("checkbox", { name: "ดูข้อมูล", exact: true }),
  ).toBeChecked();
  await expect(
    section.getByRole("group", { name: "นักเรียนและบัญชีนักเรียน" }),
  ).toHaveCount(0);
  await section
    .getByRole("group", { name: "จัดการฟอร์ม", exact: true })
    .getByRole("checkbox", { name: "ดูข้อมูล", exact: true })
    .check();
  await section
    .getByRole("button", { name: "บันทึกสิทธิ์ในหน่วยงานนี้", exact: true })
    .click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toEqual({
    path: "/organizations/1/roles/3/permissions",
    body: { permissions: ["cases.view", "forms.view"], version: 1 },
  });
  await page.getByLabel("หน่วยงานที่จัดการ", { exact: true }).selectOption("2");
  await expect(
    section.getByRole("radio", { name: "ผู้ติดตามหน่วยงานสอง", exact: true }),
  ).toBeChecked();
  await expect(
    section.getByRole("radio", { name: "เจ้าหน้าที่หน่วยงานหนึ่ง" }),
  ).toHaveCount(0);
  await expect(
    section
      .getByRole("group", { name: "ข้อมูลเคสและเคสเสี่ยง" })
      .getByRole("checkbox", { name: "ดูข้อมูล", exact: true }),
  ).not.toBeChecked();
  await expect(
    section
      .getByRole("group", { name: "นักเรียนและบัญชีนักเรียน" })
      .getByRole("checkbox", { name: "ดูข้อมูล", exact: true }),
  ).toBeChecked();
  await expect(
    section.getByRole("group", { name: "ตารางนัดหมาย" }),
  ).toHaveCount(0);
  await page.getByText("เพิ่มบทบาทในหน่วยงานนี้", { exact: true }).click();
  await page
    .getByLabel("ชื่อบทบาท", { exact: true })
    .fill("เจ้าหน้าที่ติดตามใหม่");
  await page.getByRole("button", { name: "เพิ่มบทบาท", exact: true }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1].path).toBe("/organizations/2/roles");
  await expect(
    section.getByRole("radio", { name: "เจ้าหน้าที่ติดตามใหม่", exact: true }),
  ).toBeChecked();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .include(".srp-roles-permissions-page")
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: `../outputs/roles-unified-${test.info().project.name}.png`,
    fullPage: true,
  });
  await expect(
    page.getByRole("button", { name: "ผู้ดูแลระบบ", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "สมาชิกและบทบาท", exact: true }),
  ).toHaveCount(0);
  await page.goto("/admin/users");
  await expect(
    page.getByRole("heading", {
      name: "ผู้ดูแลระบบและเจ้าหน้าที่",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "เพิ่มผู้ใช้งาน", exact: true })
    .click();
  const staffDialog = page.getByRole("dialog", {
    name: "เพิ่มผู้ใช้งาน",
    exact: true,
  });
  await staffDialog
    .getByLabel("เพิ่มหน่วยงาน", { exact: true })
    .selectOption("1");
  await expect(staffDialog.getByLabel("บทบาทของ หน่วยงานหนึ่ง")).toHaveValue(
    "3",
  );
  await expect(
    staffDialog
      .getByLabel("บทบาทของ หน่วยงานหนึ่ง")
      .getByRole("option", { name: "ผู้ติดตามหน่วยงานสอง" }),
  ).toHaveCount(0);
  await staffDialog
    .getByLabel("เพิ่มหน่วยงาน", { exact: true })
    .selectOption("2");
  await expect(staffDialog.getByLabel("บทบาทของ โรงเรียนสอง")).toHaveValue("4");
  await expect(
    staffDialog.getByLabel("โรงเรียนของ โรงเรียนสอง", { exact: true }),
  ).toHaveValue("21");
  await expect(
    staffDialog.getByRole("button", { name: "ครู", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(staffDialog.getByLabel("ประเภทครูของ โรงเรียนสอง")).toHaveValue(
    "31",
  );
  await staffDialog
    .getByRole("button", { name: "บุคลากรสนับสนุน", exact: true })
    .click();
  await expect(
    staffDialog.getByLabel("หน้าที่ในโรงเรียนของ โรงเรียนสอง"),
  ).toHaveValue("admin");
  await expect(staffDialog.getByLabel("ประเภทครูของ โรงเรียนสอง")).toHaveCount(
    0,
  );
  await staffDialog.getByRole("button", { name: "ครู", exact: true }).click();
  await expect(
    staffDialog.getByLabel("หน้าที่ในโรงเรียนของ โรงเรียนสอง"),
  ).toHaveValue("other");
  await staffDialog
    .getByRole("button", { name: "ปิดหน้าต่าง", exact: true })
    .click();
  await page.goto("/admin/organizations");
  await expect(
    page.getByRole("heading", { name: "หน่วยงานหลักและหน่วยงานย่อย" }),
  ).toBeVisible();
  await expect(section).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "+ เพิ่มสมาชิก", exact: true }),
  ).toHaveCount(0);
});

test("school administrators keep school member management without system role access", async ({
  page,
}) => {
  await setup(page);
  const unit = {
    id: 1,
    name: "โรงเรียนตัวอย่าง",
    org_type: "school",
    org_level: "unit",
    status: "active",
  };
  await page.route("**/api/me/authorization", (route) =>
    route.fulfill({
      json: {
        user: { id: 1, role_id: 3 },
        is_system_admin: false,
        organizations: [unit],
        memberships: [
          {
            organization: unit,
            status: "active",
            role: { id: 3, name: "เจ้าหน้าที่" },
            permissions: ["school.view"],
          },
        ],
      },
    }),
  );
  await page.route("**/api/school/access", (route) =>
    route.fulfill({
      json: {
        can_manage_staff: true,
        // Roles-page actions the school access endpoint now reports.
        staff_actions: {
          view: true,
          create: true,
          update: true,
          delete: true,
          assign: true,
          export: true,
          manage: true,
        },
        workflow_actions: {
          view: true,
          create: true,
          update: true,
          delete: true,
          assign: true,
          export: true,
          manage: true,
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
        can_assign_school: true,
        can_assign_students: true,
        can_view_school: true,
        can_view_students: true,
      },
    }),
  );
  await page.route("**/api/school/staff-roles", (route) =>
    route.fulfill({
      json: {
        schools: [{ id: 1, name: "โรงเรียนตัวอย่าง" }],
        students: [],
        members: [],
        roles: [],
        guardians: [],
        role_labels: { admin: "ผู้ดูแลโรงเรียน" },
      },
    }),
  );
  await page.goto("/admin/school/roles");
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(
    page.getByRole("button", { name: "สร้างบัญชีผู้ปกครอง", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "ผู้ดูแลระบบ", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "บทบาทและสิทธิ์ในหน่วยงาน", exact: true }),
  ).toHaveCount(0);
});

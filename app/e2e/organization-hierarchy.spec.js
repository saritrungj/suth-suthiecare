import { test, expect } from "@playwright/test";

const ORGANIZATIONS = [
  {
    id: 3,
    code: "HOSP-MAIN",
    name: "โรงพยาบาล",
    kind: "main",
    org_level: "main",
    org_type: "hospital",
    parent_id: null,
    status: "active",
    child_count: 1,
    member_count: 0,
  },
  {
    id: 4,
    code: "SCH-MAIN",
    name: "โรงเรียน",
    kind: "main",
    org_level: "main",
    org_type: "school",
    parent_id: null,
    status: "active",
    child_count: 1,
    member_count: 0,
  },
  {
    id: 1,
    code: "TEEN",
    name: "คลินิกวัยรุ่น",
    kind: "unit",
    org_level: "unit",
    org_type: "hospital",
    parent_id: 3,
    status: "active",
    child_count: 0,
    member_count: 0,
  },
  {
    id: 2,
    code: "SUR",
    name: "โรงเรียนสุรวิวัฒน์",
    kind: "unit",
    org_level: "unit",
    org_type: "school",
    parent_id: 4,
    status: "active",
    child_count: 0,
    member_count: 0,
  },
];

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile-chromium" &&
      testInfo.title !==
        "unit role rights are edited under the selected organization",
  );
  await page.addInitScript(() => {
    localStorage.setItem("i18nextLng", "th");
    document.cookie = "suth_staff_session=synthetic-session; path=/";
    sessionStorage.setItem(
      "suth_user",
      JSON.stringify({ id: 1, username: "e2e-admin", role_id: 1 }),
    );
    localStorage.setItem("suth_active_organization_1", "2");
  });
});

async function mockApi(page, received) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    if (pathname.endsWith("/api/session/staff"))
      return route.fulfill({
        json: {
          user: { id: 1, username: "e2e-admin", role_id: 1 },
          csrf_token: "synthetic-staff-csrf",
        },
      });
    if (pathname.endsWith("/api/session/patient"))
      return route.fulfill({ status: 401, json: {} });
    if (pathname.endsWith("/api/me/authorization"))
      return route.fulfill({
        json: {
          user: { id: 1, username: "e2e-admin" },
          is_system_admin: true,
          system_permissions: ["organizations.manage"],
          memberships: [],
          organizations: ORGANIZATIONS.filter((o) => o.kind === "unit").map(
            (o) => ({
              ...o,
              parent_name: ORGANIZATIONS.find((p) => p.id === o.parent_id).name,
            }),
          ),
        },
      });
    if (pathname.endsWith("/api/school/access"))
      return route.fulfill({
        json: {
          can_view_school: true,
          can_view_students: true,
          can_view_all_students: true,
          can_view_health: true,
          classroom_ids: [],
        },
      });
    if (pathname.endsWith("/api/organizations") && request.method() === "GET")
      return route.fulfill({ json: ORGANIZATIONS });
    if (
      pathname.endsWith("/api/organizations") &&
      request.method() === "POST"
    ) {
      received.created = request.postDataJSON();
      return route.fulfill({ status: 201, json: { id: 9, code: "NEW" } });
    }
    if (pathname.endsWith("/api/organizations/2/members")) {
      if (request.method() === "POST") {
        received.members = request.postDataJSON();
        return route.fulfill({
          status: 201,
          json: {
            added: received.members.user_ids,
            reactivated: [],
            skipped: [],
          },
        });
      }
      return route.fulfill({ json: [] });
    }
    if (pathname.endsWith("/api/users"))
      return route.fulfill({
        json: [
          { id: 11, username: "teacher1", name: "ครูหนึ่ง", status: "active" },
          { id: 12, username: "teacher2", name: "ครูสอง", status: "active" },
          { id: 13, username: "nurse1", name: "พยาบาลหนึ่ง", status: "active" },
        ],
      });
    if (pathname.endsWith("/api/roles"))
      return route.fulfill({ json: [{ id: 3, name: "Staff" }] });
    return route.fulfill({ json: {} });
  });
}

test("system admin sees both school and hospital menus while changing unit context", async ({
  page,
}) => {
  await mockApi(page, {});
  await page.goto("/admin/organizations");
  const nav = page.locator("aside.sidebar");
  // The active unit is โรงเรียนสุรวิวัฒน์ (under โรงเรียน), so school menus show.
  await expect(
    nav.getByRole("link", { name: "นักเรียน", exact: true }),
  ).toBeVisible();
  await expect(nav.getByRole("link", { name: "จัดการคลินิก" })).toHaveCount(1);
  await expect(
    page.locator('#active-organization optgroup[label="โรงเรียน"] option'),
  ).toHaveText(["โรงเรียนสุรวิวัฒน์ (โรงเรียน)"]);

  // Switching to the clinic under โรงพยาบาล brings the hospital menus back.
  await page.locator("#active-organization").selectOption("1");
  await expect(nav.getByRole("link", { name: "จัดการคลินิก" })).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "นักเรียน", exact: true }),
  ).toHaveCount(1);
});

test("unit role rights are edited under the selected organization", async ({
  page,
}) => {
  await mockApi(page, {});
  let saved;
  await page.route(
    "**/api/organizations/*/roles/*/permissions",
    async (route) => {
      if (route.request().method() === "PUT") {
        saved = {
          path: new URL(route.request().url()).pathname,
          body: route.request().postDataJSON(),
        };
        return route.fulfill({ json: { success: true, version: 2 } });
      }
      return route.fulfill({
        json: { permissions: ["cases.view"], configured: true, version: 1 },
      });
    },
  );
  await page.goto("/admin/organizations");
  await page
    .getByRole("complementary", { name: "โครงสร้างหน่วยงาน" })
    .getByRole("button", { name: /โรงเรียนสุรวิวัฒน์/ })
    .click();
  const section = page.getByRole("region", {
    name: "บทบาทและสิทธิ์ในหน่วยงาน",
    exact: true,
  });
  await section.getByLabel("บทบาทที่ตั้งสิทธิ์").selectOption("3");
  await expect(
    section
      .getByRole("group", { name: "ข้อมูลเคสและเคสเสี่ยง" })
      .getByRole("checkbox", { name: "ดูข้อมูล" }),
  ).toBeChecked();
  await section
    .getByRole("group", { name: "ข้อมูลเคสและเคสเสี่ยง" })
    .getByRole("checkbox", { name: "ดูข้อมูล" })
    .uncheck();
  await section
    .getByRole("group", { name: "จัดการฟอร์ม" })
    .getByRole("checkbox", { name: "ดูข้อมูล" })
    .check();
  await section
    .getByRole("button", { name: "บันทึกสิทธิ์ในหน่วยงานนี้" })
    .click();
  await expect
    .poll(() => saved)
    .toEqual({
      path: "/api/organizations/2/roles/3/permissions",
      body: { permissions: ["forms.view"], version: 1 },
    });
  await expect(section.getByRole("status")).toContainText(
    "ไม่มีผลกับหน่วยงานอื่น",
  );
});

test("main organizations choose the type, sub-units inherit it, members are added by checkbox", async ({
  page,
}) => {
  const received = {};
  await mockApi(page, received);
  await page.goto("/admin/organizations");
  const directory = page.getByRole("complementary", {
    name: "โครงสร้างหน่วยงาน",
  });
  await expect(
    directory.getByText("หน่วยงานหลักประเภทโรงเรียน · 1 หน่วยงานย่อย"),
  ).toBeVisible();

  // A new sub-unit under โรงเรียน shows the inherited type and sends none.
  await directory
    .getByRole("button", { name: /^โรงเรียน หน่วยงานหลัก/ })
    .click();
  await page.getByRole("button", { name: "+ เพิ่มหน่วยงานย่อย" }).click();
  await expect(page.getByText("(ตามหน่วยงานหลัก โรงเรียน)")).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);
  await page.getByLabel("ชื่อหน่วยงานย่อย").fill("โรงเรียนใหม่");
  await page.getByRole("button", { name: "บันทึกหน่วยงาน" }).click();
  await expect
    .poll(() => received.created)
    .toEqual({
      kind: "unit",
      name: "โรงเรียนใหม่",
      description: "",
      parent_id: 4,
    });

  // Members of a sub-unit are picked with checkboxes and added together.
  await directory.getByRole("button", { name: /โรงเรียนสุรวิวัฒน์/ }).click();
  await page.getByRole("button", { name: "+ เพิ่มสมาชิก" }).click();
  await page.getByRole("checkbox", { name: /ครูหนึ่ง/ }).check();
  await page.getByRole("checkbox", { name: /ครูสอง/ }).check();
  await page.getByLabel("บทบาทในหน่วยงานนี้").selectOption("3");
  await page.getByRole("button", { name: "เพิ่ม 2 คน" }).click();
  await expect
    .poll(() => received.members)
    .toEqual({
      user_ids: [11, 12],
      role_id: 3,
    });
});

test("system-wide settings sit in their own admin section", async ({
  page,
}) => {
  await mockApi(page, {});
  await page.goto("/admin/organizations");
  const nav = page.locator("aside.sidebar nav");
  const headers = nav.locator(".menu-header-label");
  await expect(headers.filter({ hasText: "จัดการหลักของระบบ" })).toContainText(
    "ไม่ขึ้นกับหน่วยงานที่เลือก",
  );
  const labels = await nav
    .locator(".menu-header-label, .menu-item .label")
    .allTextContents();
  const admin = labels.findIndex((text) =>
    text.startsWith("จัดการหลักของระบบ"),
  );
  const account = labels.indexOf("บัญชีของฉัน");
  expect(labels.slice(admin + 1, account)).toEqual([
    "หน่วยงานหลักและหน่วยงานย่อย",
    "ผู้ดูแลระบบและเจ้าหน้าที่",
    "บทบาทและสิทธิ์",
    "จัดการภาพแบนเนอร์",
  ]);
  const unit = labels.indexOf("จัดการหน่วยงาน");
  expect(labels.slice(unit + 1, admin)).toEqual([
    "จัดการฟอร์ม",
    "จัดการคลินิก",
    "ผู้มารับบริการ",
    "จัดการศูนย์ช่วยเหลือ",
  ]);
});

test("an organization member does not get the admin section", async ({
  page,
}) => {
  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith("/api/session/staff"))
      return route.fulfill({
        json: {
          user: { id: 1, username: "e2e-staff", role_id: 3 },
          csrf_token: "synthetic-staff-csrf",
        },
      });
    if (pathname.endsWith("/api/session/patient"))
      return route.fulfill({ status: 401, json: {} });
    if (pathname.endsWith("/api/me/authorization"))
      return route.fulfill({
        json: {
          user: { id: 1, username: "e2e-staff", role_id: 3 },
          system_role: "staff",
          is_system_admin: false,
          system_permissions: [],
          organizations: [],
          memberships: [
            {
              status: "active",
              organization: {
                id: 1,
                name: "คลินิกวัยรุ่น",
                org_type: "hospital",
                parent_id: 3,
                parent_name: "โรงพยาบาล",
                status: "active",
              },
              role: { id: 3, name: "Staff" },
              permissions: ["cases.view", "forms.view", "patient_members.view"],
            },
          ],
        },
      });
    return route.fulfill({ json: [] });
  });
  await page.addInitScript(() =>
    localStorage.setItem("suth_active_organization_1", "1"),
  );
  await page.goto("/admin/profile");
  const nav = page.locator("aside.sidebar nav");
  await expect(nav.getByRole("link", { name: "ผู้มารับบริการ" })).toBeVisible();
  await expect(nav.getByText("ผู้ดูแลระบบ", { exact: false })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "บทบาทและสิทธิ์" })).toHaveCount(
    0,
  );
});

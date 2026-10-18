import { test, expect } from "@playwright/test";
import { mockAdminApi } from "./helpers/api-mocks.js";

const unitPermissions = [
  "dashboard.view",
  "cases.view",
  "patient_members.view",
  "forms.view",
  "clinics.view",
  "appointments.view",
  "help_center.view",
  "content.view",
  "roles.manage",
  "organizations.manage",
];
const organizations = [
  {
    id: 1,
    code: "DEMO-A",
    name: "หน่วยงาน A (ข้อมูลจำลอง)",
    org_type: "hospital",
  },
  {
    id: 2,
    code: "DEMO-B",
    name: "หน่วยงาน B (ข้อมูลจำลอง)",
    org_type: "school",
  },
];
async function setup(page, role, secondPermissions = unitPermissions) {
  await page.addInitScript(() => {
    localStorage.setItem("i18nextLng", "th");
    localStorage.setItem("suth_active_organization_1", "1");
    // A forged/stale session role must not determine navigation.
    sessionStorage.setItem("suth_user", JSON.stringify({ id: 1, role_id: 1 }));
    document.cookie = "suth_staff_session=synthetic-session; path=/";
  });
  await mockAdminApi(page);
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/me/authorization"))
      return route.fulfill({
        json: {
          user: {
            id: 1,
            role_id: role === "admin" ? 2 : 3,
            username: "synthetic-user",
          },
          is_system_admin: role === "system_admin",
          system_role: role,
          organizations: role === "system_admin" ? organizations : [],
          memberships:
            role === "system_admin"
              ? []
              : organizations.map((organization, index) => ({
                  id: index + 1,
                  organization,
                  role: {
                    id: index === 0 ? 2 : 3,
                    name: index === 0 ? "Admin" : "Staff",
                  },
                  permissions:
                    index === 0 ? unitPermissions : secondPermissions,
                })),
        },
      });
    if (path.endsWith("/patient-members"))
      return route.fulfill({
        json: {
          data: [],
          pagination: { page: 1, limit: 10, total: 0, total_pages: 1 },
        },
      });
    if (path.endsWith("/school/access"))
      return route.fulfill({
        json: {
          can_view_school: true,
          can_view_health: true,
          can_view_students: true,
        },
      });
    return route.fallback();
  });
}
async function openSidebar(page) {
  await expect(
    page.getByLabel("หน่วยงานที่กำลังใช้งาน", { exact: true }),
  ).toBeAttached();
  const open = page.getByRole("button", { name: "Open Menu", exact: true });
  if (await open.isVisible()) await open.click();
}
const links = (page) => page.locator(".sidebar nav.menu a");
const mainPaths = [
  "/admin/organizations",
  "/admin/users",
  "/admin/roles",
  "/admin/banner",
];

for (const role of ["system_admin", "admin", "staff"]) {
  test(`${role} uses unit menus independently of system role`, async ({
    page,
  }) => {
    await setup(page, role);
    await page.goto(role === "staff" ? "/admin" : "/admin/members");
    if (role === "staff") {
      await expect(page).toHaveURL(/\/admin\/dashboard$/);
      // Keep navigation checks on the directory; dashboard data has its own fixtures.
      await page.goto("/admin/members");
    }
    await openSidebar(page);
    const organizationSelector = page.getByLabel("หน่วยงานที่กำลังใช้งาน", {
      exact: true,
    });
    await expect(
      organizationSelector.locator('option[value="all"]'),
    ).toHaveCount(role === "system_admin" ? 1 : 0);
    if (role === "system_admin") {
      await organizationSelector.selectOption("all");
      await expect(organizationSelector).toHaveValue("all");
      for (const path of [
        "/admin/school/students",
        "/admin/schedule",
        "/admin/clinics",
      ])
        await expect(page.locator(`.sidebar a[href="${path}"]`)).toHaveCount(1);
      for (const path of mainPaths)
        await expect(page.locator(`.sidebar a[href="${path}"]`)).toHaveCount(1);
      await organizationSelector.selectOption("1");
      await expect(
        page.locator('.sidebar a[href="/admin/school/students"]'),
      ).toHaveCount(0);
      await expect(
        page.locator('.sidebar a[href="/admin/schedule"]'),
      ).toHaveCount(1);
    }
    await expect(
      page.locator('.sidebar a[href="/admin/members"]'),
    ).toBeVisible();
    await expect(page.locator('.sidebar a[href="/admin/cases"]')).toBeVisible();
    for (const path of mainPaths)
      await expect(page.locator(`.sidebar a[href="${path}"]`)).toHaveCount(
        role === "system_admin" ? 1 : 0,
      );
    await page
      .getByLabel("หน่วยงานที่กำลังใช้งาน", { exact: true })
      .selectOption("2");
    await expect(
      page.locator('.sidebar a[href="/admin/school/students"]'),
    ).toBeVisible();
    if (role === "system_admin") {
      await expect(
        page.locator('.sidebar a[href="/admin/school/students"]'),
      ).toBeVisible();
      await expect(
        page.locator('.sidebar a[href="/admin/schedule"]'),
      ).toHaveCount(0);
      await expect(
        page.locator('.sidebar a[href="/admin/clinics"]'),
      ).toHaveCount(0);
    }
  });
}

test("staff user menu follows the active unit's permissions", async ({
  page,
}) => {
  await setup(page, "staff", ["cases.view"]);
  await page.goto("/admin/members");
  await openSidebar(page);
  await expect(page.locator('.sidebar a[href="/admin/cases"]')).toBeVisible();
  await page
    .getByLabel("หน่วยงานที่กำลังใช้งาน", { exact: true })
    .selectOption("2");
  await expect(page).toHaveURL(/\/403$/);
});

test("admin cannot open main system pages by entering their URLs", async ({
  page,
}) => {
  await setup(page, "admin");
  for (const path of mainPaths) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/403$/);
  }
});

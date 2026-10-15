import { test, expect } from "@playwright/test";
import { mockAdminApi, mockPublicApi } from "./helpers/api-mocks.js";

const publicRoutes = [
  "/",
  "/login",
  "/help-center",
  "/history",
  "/account/login",
  "/account/register",
  "/account/change-password",
  "/__unknown__",
];
const adminRoutes = [
  "/admin/dashboard",
  "/admin/forms",
  "/admin/forms/create",
  "/admin/schedule",
  "/admin/cases",
  "/admin/roles",
  "/admin/users",
  "/admin/members",
  "/admin/risk-cases",
  "/admin/banner",
  "/admin/clinics",
  "/admin/help-center",
  "/admin/organizations",
  "/admin/school",
  "/admin/school/students",
  "/admin/school/students/import",
  "/admin/school/teachers",
  "/admin/school/types",
];

test.describe("declared route smoke checks", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile-chromium");
    await page.addInitScript(() => localStorage.setItem("i18nextLng", "th"));
  });

  for (const routePath of publicRoutes) {
    test(`public route ${routePath} renders without a runtime exception`, async ({
      page,
    }) => {
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await mockPublicApi(page);

      await page.goto(routePath);
      await expect(page.locator("#root > *").first()).toBeVisible();
      expect(pageErrors).toEqual([]);
      // Unknown URLs render the 404 status page in place instead of redirecting.
      if (routePath === "/__unknown__")
        await expect(
          page.getByRole("heading", { name: "ไม่พบหน้าที่ต้องการ" }),
        ).toBeVisible();
    });
  }

  for (const routePath of adminRoutes) {
    test(`admin route ${routePath} renders without a runtime exception`, async ({
      page,
    }) => {
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await page.addInitScript(() => {
        document.cookie = "suth_staff_session=synthetic-session; path=/";
        sessionStorage.setItem(
          "suth_user",
          JSON.stringify({
            id: 1,
            username: "e2e-admin",
            role: "admin",
            role_id: 1,
          }),
        );
      });
      await mockAdminApi(page);

      await page.goto(routePath);
      await expect(page.locator("#root > *").first()).toBeVisible();
      await page.waitForTimeout(250);
      expect(pageErrors).toEqual([]);
    });
  }
});

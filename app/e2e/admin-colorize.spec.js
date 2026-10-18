import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";
import { mockAdminApi } from "./helpers/api-mocks";

// Synthetic fixtures only: audit the actual admin routes without staff or
// patient data, including both organization types and viewport classes.
test("admin colors, navigation and route accessibility inventory", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  page.on("pageerror", (error) =>
    console.error("Admin audit runtime:", page.url(), error.message),
  );
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      message.text().includes("Application render error")
    )
      console.error("Admin audit console:", page.url(), message.text());
  });
  await mockAdminApi(page);
  await page.addInitScript(() => {
    document.cookie = "suth_staff_session=synthetic; path=/";
    localStorage.setItem("suth_active_organization_1", "1");
  });
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    if (path === "/me/authorization")
      return route.fulfill({
        json: {
          user: { id: 1, username: "synthetic-admin", role_id: 1 },
          is_system_admin: true,
          organizations: [
            {
              id: 1,
              name: "โรงพยาบาลสาธิต",
              org_type: "hospital",
              org_level: "unit",
            },
            {
              id: 3,
              name: "โรงเรียนสาธิต",
              org_type: "school",
              org_level: "unit",
            },
          ],
          memberships: [],
        },
      });
    if (path === "/school/access")
      return route.fulfill({
        json: {
          can_view_school: true,
          can_create_school: true,
          can_manage_staff: true,
          can_view_students: true,
          can_view_health: true,
        },
      });
    if (
      [
        "/dashboard/forms",
        "/organizations",
        "/members",
        "/patient-members",
        "/school/schools",
        "/school/teacher-types",
        "/school/student-types",
      ].includes(path)
    )
      return route.fulfill({ json: [] });
    if (path === "/me/profile")
      return route.fulfill({
        json: {
          success: true,
          profile: {
            id: 1,
            username: "synthetic-admin",
            name: "ผู้ดูแลสาธิต",
            email: "demo@example.test",
            status: "active",
          },
        },
      });
    if (path === "/master-data/categories")
      return route.fulfill({
        json: {
          can_manage: true,
          categories: [
            { code: "prefix", label: "คำนำหน้า", fields: ["label"] },
          ],
        },
      });
    if (path === "/master-data/prefix")
      return route.fulfill({
        json: [
          {
            id: 1,
            code: "demo",
            label: "รายการสาธิต",
            is_active: true,
            sort_order: 1,
          },
        ],
      });
    return route.fallback();
  });
  const inventory = [];
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  for (const route of [
    "dashboard",
    "cases",
    "risk-cases",
    "schedule",
    "referrals",
    "forms",
    "clinics",
    "members",
    "help-center",
    "master-data",
    "organizations",
    "users",
    "roles",
    "banner",
    "profile",
  ]) {
    console.log("Audit route:", route);
    await page.goto(`/admin/${route}`);
    await expect(page.locator(".admin-shell")).toBeVisible();
    await expect(page.locator(".admin-shell-content")).not.toBeEmpty();
    // Wait for data/loading states to settle through a visible page title.
    await expect(
      page.locator(".admin-shell-content :is(h1,h2)").first(),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    // Scan after entrance animations finish so colours are not mid-fade.
    await page.waitForFunction(() =>
      document
        .getAnimations()
        .every(
          (a) =>
            a.playState !== "running" ||
            a.effect?.getTiming().iterations === Infinity,
        ),
    );
    const audit = await new AxeBuilder({ page })
      .include(".admin-shell")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    inventory.push({
      route,
      violations: audit.violations.map(({ id, impact, nodes }) => ({
        id,
        impact,
        nodes: nodes.map(({ target, failureSummary }) => ({
          target,
          failureSummary,
        })),
      })),
    });
    if (
      ["dashboard", "master-data", "clinics", "roles", "forms"].includes(route)
    ) {
      await page.screenshot({
        path: `../outputs/admin-colorize-${route.replace("/", "-")}-${testInfo.project.name}.png`,
      });
    }
  }
  const openMenu = page.getByRole("button", { name: "Open Menu", exact: true });
  if (await openMenu.isVisible()) {
    await openMenu.click();
    await expect(openMenu).toHaveAttribute("aria-expanded", "true");
  }
  // Current design: bright orange gradient with dark ink text, darker-orange active item.
  await expect(page.locator(".sidebar")).toHaveCSS(
    "background-image",
    /linear-gradient\(rgb\(255, 138, 61\)/,
  );
  // Dashboard kit (2026-10-17): the current page is a white pill with orange ink.
  await expect(page.locator('.sidebar a[aria-current="page"]')).toHaveCSS(
    "color",
    "rgb(180, 71, 12)",
  );
  const navigationAudit = await new AxeBuilder({ page })
    .include(".sidebar")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  await page.screenshot({
    path: `../outputs/orange-navigation-${testInfo.project.name}.png`,
  });
  await writeFile(
    `../outputs/admin-colorize-a11y-${testInfo.project.name}.json`,
    JSON.stringify(inventory, null, 2),
  );
  expect(runtimeErrors).toEqual([]);
  expect(
    inventory.filter((item) => item.violations.length),
    "All audited routes meet automated WCAG A/AA checks",
  ).toEqual([]);
  expect(
    navigationAudit.violations,
    "Open navigation is accessible on both viewport classes",
  ).toEqual([]);
});

import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import {
  mockResponsiveApi,
  setRouteSession,
} from "./helpers/responsive-fixtures.js";

const publicRoutes = [
  "/",
  "/login",
  "/account/login",
  "/account/register",
  "/account/verify-email",
  "/account/change-password",
  "/help-center",
  "/help-center/clinic/1",
  "/terms",
  "/privacy-policy",
  "/assessment/101",
  "/assessment-result",
  "/history",
  "/history/result",
  "/clinic-detail",
  "/403",
  "/404",
  "/500",
];
const adminRoutes = [
  "dashboard",
  "forms",
  "forms/create",
  "forms/edit/101",
  "schedule",
  "referrals",
  "cases",
  "roles",
  "users",
  "members",
  "risk-cases",
  "banner",
  "clinics",
  "help-center",
  "organizations",
  "school",
  "school/students",
  "school/students/import",
  "school/teachers",
  "school/types",
  "master-data",
  "school/roles",
  "school/workflows",
  "profile",
].map((r) => "/admin/" + r);
const baseline = process.env.RESPONSIVE_BASELINE === "1";
const selected = new Set([
  "/",
  "/account/register",
  "/history/result",
  "/assessment/101",
  "/admin/dashboard",
  "/admin/forms/create",
  "/admin/roles",
  "/admin/school",
]);

test("all routed surfaces fit the viewport and preserve readable working space", async ({
  page,
  baseURL,
}, testInfo) => {
  test.setTimeout(240_000);
  await mkdir("../outputs/responsive-unification", { recursive: true });

  test("forms and dialogs stay usable in landscape and wide workspaces", async ({
    page,
    baseURL,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "tablet");
    await mockResponsiveApi(page);
    await page.setViewportSize({ width: 844, height: 390 });
    await setRouteSession(page, "/admin/forms/create", baseURL);
    await page.goto("/admin/forms/create");
    const builder = page.locator(".sfb-builder-container");
    await expect(page.locator(".sfb-builder-header")).toBeVisible();
    const builderBox = await builder.boundingBox();
    expect(builderBox.y + builderBox.height).toBeLessThanOrEqual(390);
    await expect(
      page
        .locator(".sfb-header-actions")
        .getByRole("button", { name: "บันทึก", exact: true }),
    ).toBeInViewport();
    const toolbar = await page.locator(".sfb-floating-toolbar").boundingBox();
    expect(toolbar.y + toolbar.height).toBeLessThanOrEqual(390);
    await setRouteSession(page, "/assessment-result", baseURL);
    await page.goto("/assessment-result");
    await page.locator(".ar-actions button").last().click();
    const dialog = page.locator(".suth-evaluation-dialog");
    await expect(dialog).toBeVisible();
    expect(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    await expect(dialog.locator(".evaluation-scale label").first()).toHaveCSS(
      "min-height",
      "44px",
    );
    await dialog.locator(".swal2-close").click();
    await page.setViewportSize({ width: 2560, height: 1440 });
    await setRouteSession(page, "/admin/dashboard", baseURL);
    await page.goto("/admin/dashboard");
    await expect(page.locator(".main-dashboard-container")).toBeVisible();
    expect(
      (await page.locator(".admin-content").boundingBox()).width,
    ).toBeLessThanOrEqual(1500);
  });
  await mockResponsiveApi(page);
  const report = [],
    errors = [];
  page.on("pageerror", (error) =>
    errors.push({
      route: new URL(page.url()).pathname,
      message: error.message,
    }),
  );
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      message.text().startsWith("Application render error:")
    )
      errors.push({
        route: new URL(page.url()).pathname,
        message: message.text(),
      });
  });
  const routes = baseline ? [...selected] : [...publicRoutes, ...adminRoutes];
  for (const path of routes) {
    await setRouteSession(page, path, baseURL);
    await page.goto(path);
    await expect(page.locator("#root > *").first()).toBeVisible();
    await expect(
      page.locator("h1,h2,.sfb-builder-header").first(),
    ).toBeVisible();
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.allSettled(
        document
          .getAnimations()
          .filter((a) => a.effect?.getTiming().iterations !== Infinity)
          .map((a) => a.finished),
      );
    });
    const metrics = await page.evaluate(() => {
      const visible = (el) =>
        el.getClientRects().length &&
        getComputedStyle(el).visibility !== "hidden";
      const overflow = [...document.querySelectorAll("#root *")]
        .filter(visible)
        .filter((el) => {
          if (
            el.closest(
              '.sidebar,.mobile-drawer-overlay,[aria-hidden="true"],.swal2-container',
            )
          )
            return false;
          let ancestor = el.parentElement;
          while (ancestor && ancestor.id !== "root") {
            if (
              /auto|scroll|hidden|clip/.test(
                getComputedStyle(ancestor).overflowX,
              )
            )
              return false;
            ancestor = ancestor.parentElement;
          }
          const r = el.getBoundingClientRect();
          return r.left < -2 || r.right > innerWidth + 2;
        })
        .slice(0, 10)
        .map((el) => ({
          tag: el.tagName,
          class: el.className?.baseVal ?? el.className,
          width: Math.round(el.getBoundingClientRect().width),
        }));
      const shell = document.querySelector(".admin-shell");
      const register = document.querySelector(".patient-register-form-panel");
      const clippedWorkspaces = [
        ...document.querySelectorAll(
          ".admin-shell-content > div:not(.excel-export-toolbar),.admin-shell-content > main",
        ),
      ]
        .filter(visible)
        .filter(
          (el) =>
            getComputedStyle(el).position !== "fixed" &&
            el.getBoundingClientRect().bottom > innerHeight + 1,
        )
        .map((el) => ({
          class: el.className,
          bottom: Math.round(el.getBoundingClientRect().bottom),
        }));
      return {
        width: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        overflow,
        clippedWorkspaces,
        shellBottom: shell
          ? Math.round(shell.getBoundingClientRect().bottom)
          : null,
        registerRight: register
          ? Math.round(register.getBoundingClientRect().right)
          : null,
        title: document
          .querySelector("h1,h2")
          ?.textContent?.trim()
          .slice(0, 120),
        path: location.pathname,
      };
    });
    report.push({ route: path, ...metrics });
    if (selected.has(path))
      await page.screenshot({
        path: `../outputs/responsive-unification/${baseline ? "before" : "after"}-${path.replaceAll("/", "-") || "home"}-${testInfo.project.name}.png`,
        fullPage: false,
      });
  }
  await writeFile(
    `../outputs/responsive-unification/${baseline ? "before" : "after"}-${testInfo.project.name}.json`,
    JSON.stringify({ routes: report, errors }, null, 2),
  );
  if (!baseline) {
    expect(errors).toEqual([]);
    expect(
      report.filter(
        (r) =>
          r.path !== (r.route === "/history" ? "/history/result" : r.route),
      ),
    ).toEqual([]);
    expect(
      report.filter((r) => r.documentWidth > r.width + 1 || r.overflow.length),
    ).toEqual([]);
    expect(report.filter((r) => r.clippedWorkspaces.length)).toEqual([]);
    expect(
      report.filter(
        (r) =>
          r.shellBottom !== null &&
          r.shellBottom > testInfo.project.use.viewport.height + 1,
      ),
    ).toEqual([]);
    expect(
      report.filter(
        (r) => r.registerRight !== null && r.registerRight > r.width + 1,
      ),
    ).toEqual([]);
  }
});

test("student import and feedback keep their complete controls on narrow screens", async ({
  page,
  baseURL,
}) => {
  await mockResponsiveApi(page);
  await setRouteSession(page, "/admin/school/students/import", baseURL);
  await page.goto("/admin/school/students/import");
  await expect(
    page.getByRole("heading", {
      name: "นำเข้านักเรียนจาก Excel / CSV",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await setRouteSession(page, "/assessment-result", baseURL);
  await page.goto("/assessment-result");
  await page.locator(".ar-actions button").last().click();
  const dialog = page.locator(".suth-evaluation-dialog");
  await expect(dialog).toBeVisible();
  expect(
    await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  await expect(dialog.locator(".evaluation-scale label").first()).toHaveCSS(
    "min-height",
    "44px",
  );
});

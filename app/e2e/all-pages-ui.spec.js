import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import {
  mockResponsiveApi,
  setRouteSession,
} from "./helpers/responsive-fixtures.js";
import { publicRoutes, adminRoutes } from "./helpers/ui-routes.js";

const output = "../outputs/all-pages-ui";
const confirmRoutes = process.env.UI_CONFIRM_ROUTES?.split(",").filter(Boolean);
const suffix = confirmRoutes ? "-confirmation" : "";

test("every public, patient and admin route: accessibility, runtime, brand and layout", async ({
  page,
  baseURL,
}, info) => {
  test.setTimeout(360_000);
  await mkdir(output, { recursive: true });
  await mockResponsiveApi(page);
  const errors = [],
    rows = [];
  page.on("pageerror", (error) =>
    errors.push({ path: new URL(page.url()).pathname, message: error.message }),
  );
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      message.text().startsWith("Application render error:")
    )
      errors.push({ message: message.text() });
  });
  for (const path of confirmRoutes || [...publicRoutes, ...adminRoutes]) {
    console.log("UI audit:", path);
    await setRouteSession(page, path, baseURL);
    await page.goto(path);
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
    const metrics = await page.evaluate(() => ({
      path: location.pathname,
      width: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      brand: getComputedStyle(document.documentElement)
        .getPropertyValue("--suth-accent")
        .trim(),
      title: document.querySelector("h1,h2")?.textContent?.trim(),
    }));
    if (path === "/help-center/clinic/1")
      await expect(page.locator(".hc-clinic-logo-frame svg")).toBeVisible();
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    const screenshot = `${path.replaceAll("/", "-") || "home"}-${info.project.name}.png`;
    await page.screenshot({
      path: `${output}/${screenshot}`,
      fullPage: !path.startsWith("/admin"),
    });
    rows.push({
      route: path,
      ...metrics,
      screenshot,
      violations: audit.violations.map(({ id, impact, nodes }) => ({
        id,
        impact,
        nodes: nodes.map(({ target, failureSummary, html }) => ({
          target,
          failureSummary,
          html,
        })),
      })),
    });
  }
  await writeFile(
    `${output}/audit-${info.project.name}${suffix}.json`,
    JSON.stringify({ rows, errors }, null, 2),
  );
  expect(errors, "No route render errors").toEqual([]);
  expect(
    rows.filter((row) => row.brand.toLowerCase() !== "#ff8a3d"),
    "Exact shared brand on every route",
  ).toEqual([]);
  expect(
    rows.filter((row) => row.documentWidth > row.width + 1),
    "No page-level horizontal overflow",
  ).toEqual([]);
  expect(
    rows.filter((row) => row.violations.length),
    "All routes pass automated WCAG A/AA checks",
  ).toEqual([]);
});

test("mobile drawer traps focus, restores focus and keeps organization search usable", async ({
  page,
  baseURL,
}, info) => {
  test.skip(info.project.name !== "mobile");
  await mockResponsiveApi(page);
  await setRouteSession(page, "/admin/dashboard", baseURL);
  await page.goto("/admin/dashboard");
  const open = page.getByRole("button", { name: "Open Menu", exact: true });
  await open.click();
  const close = page.getByRole("button", { name: "Close Menu", exact: true });
  await expect(close).toBeFocused();
  await expect(page.locator(".admin-shell-content")).toHaveAttribute(
    "inert",
    "",
  );
  await page.keyboard.press("Shift+Tab");
  expect(
    await page
      .locator(".sidebar")
      .evaluate((el) => el.contains(document.activeElement)),
  ).toBe(true);
  await page.getByLabel("หน่วยงานที่กำลังใช้งาน").click();
  const search = page.getByRole("combobox", {
    name: "ค้นหาหน่วยงานที่กำลังใช้งาน",
  });
  await expect(search).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(open).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(open).toHaveAttribute("aria-expanded", "false");
  await expect(open).toBeFocused();
  await expect(page.locator(".admin-shell-content")).not.toHaveAttribute(
    "inert",
    "",
  );
});

test("school-specific dashboard and case variants remain accessible", async ({
  page,
  baseURL,
}, info) => {
  await mkdir(output, { recursive: true });
  await mockResponsiveApi(page, { organizationId: 3 });
  const rows = [];
  for (const path of [
    "/admin/dashboard",
    "/admin/cases",
    "/admin/risk-cases",
  ]) {
    await setRouteSession(page, path, baseURL);
    await page.goto(path);
    await expect(page.locator(".admin-shell-content h1").first()).toBeVisible();
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    await page.screenshot({
      path: `${output}/school-${path.split("/").at(-1)}-${info.project.name}.png`,
    });
    rows.push({ path, violations: audit.violations });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await writeFile(
    `${output}/school-${info.project.name}.json`,
    JSON.stringify(rows, null, 2),
  );
  expect(rows.filter((row) => row.violations.length)).toEqual([]);
});

test("populated assessment: labels, validation, choices, BMI and narrow grid", async ({
  page,
  baseURL,
}, info) => {
  await mkdir(output, { recursive: true });
  await mockResponsiveApi(page);
  const form = {
    id: 101,
    title: "แบบประเมินสาธิตสำหรับตรวจทุกชนิดคำตอบ",
    description: "ข้อมูลสมมติสำหรับทดสอบเท่านั้น",
    status: "published",
    theme: {},
    questions: [
      {
        id: "demo_name",
        type: "short_text",
        title: "ชื่อสำหรับการทดสอบ",
        required: true,
      },
      { id: "demo_bmi", type: "bmi", title: "น้ำหนักและส่วนสูง" },
      {
        id: "demo_choice",
        type: "multiple_choice",
        title: "การรับบริการ",
        options: ["รับบริการที่คลินิก", "รับคำปรึกษาออนไลน์"],
      },
      {
        id: "demo_check",
        type: "checkboxes",
        title: "ช่องทางติดต่อ",
        options: ["โทรศัพท์", "อีเมล"],
      },
      {
        id: "demo_grid",
        type: "grid_multiple",
        title: "ความถี่ของอาการ",
        rows: ["นอนหลับยาก", "รู้สึกเหนื่อย"],
        cols: ["ไม่เคย", "บางครั้ง", "บ่อยครั้ง"],
      },
      { id: "demo_notes", type: "paragraph", title: "ข้อมูลเพิ่มเติม" },
      { id: "demo_date", type: "date", title: "วันที่สะดวก" },
      {
        id: "demo_dropdown",
        type: "dropdown",
        title: "ช่วงเวลาที่สะดวก",
        options: ["ช่วงเช้า", "ช่วงบ่าย"],
      },
    ],
  };
  await page.route("**/api/forms/101", (route) =>
    route.fulfill({ json: form }),
  );
  await setRouteSession(page, "/assessment/101", baseURL);
  await page.goto("/assessment/101");
  const name = page.getByRole("textbox", {
    name: "ชื่อสำหรับการทดสอบ",
    exact: true,
  });
  await expect(name).toBeVisible();
  await page.getByRole("button", { name: "ส่งคำตอบ", exact: true }).click();
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.locator("#question-demo_name .preview-error-msg"),
  ).toBeVisible();
  await name.fill("บุคคลสาธิต");
  await page
    .getByRole("radio", { name: "รับคำปรึกษาออนไลน์", exact: true })
    .check();
  await page
    .getByRole("radio", { name: "นอนหลับยาก: บางครั้ง", exact: true })
    .check();
  await page.getByRole("checkbox", { name: "อีเมล", exact: true }).check();
  await page.locator("#bmi-weight-demo_bmi").fill("60");
  await page.locator("#bmi-height-demo_bmi").fill("170");
  await page
    .getByRole("textbox", { name: "ข้อมูลเพิ่มเติม", exact: true })
    .fill("ข้อมูลสาธิต");
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  await writeFile(
    `${output}/questions-${info.project.name}.json`,
    JSON.stringify(audit.violations, null, 2),
  );
  await page.screenshot({
    path: `${output}/assessment-populated-${info.project.name}.png`,
    fullPage: true,
  });
  expect(audit.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .locator("#question-demo_name")
    .getByRole("button", { name: "ล้างคำตอบข้อนี้" })
    .click();
  await expect(name).toHaveValue("");
});

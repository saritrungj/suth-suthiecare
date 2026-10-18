import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockAdminApi } from "./helpers/api-mocks";

test("recent cases and evaluation charts share the app colors; only the evaluation list opens a modal", async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mockAdminApi(page);
  await page.addInitScript(() => {
    document.cookie = "suth_staff_session=synthetic-session; path=/";
    localStorage.setItem("suth_active_organization_1", "1");
  });
  const now = new Date().toISOString();
  const evaluation = {
    id: 1,
    created_at: now,
    sat_ui: 4,
    sat_speed: 4,
    sat_content: 4,
    sat_access: 5,
    sat_overall: 4,
    sus_total_score: 78,
    suggestions: "ข้อมูลสาธิตสำหรับตรวจรูปแบบหน้าจอ",
  };
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname;
    if (path.endsWith("/forms"))
      return route.fulfill({
        json: [
          {
            id: 1,
            title: "แบบฟอร์มสาธิต",
            clinic_type: "teenager",
            status: "published",
          },
        ],
      });
    if (path.endsWith("/forms/1"))
      return route.fulfill({ json: { id: 1, questions: [] } });
    if (path.endsWith("/dashboard/forms")) return route.fulfill({ json: [] });
    if (path.endsWith("/dashboard-settings/settings"))
      return route.fulfill({ json: { active_charts: {} } });
    if (path.endsWith("/dashboard/recent"))
      return route.fulfill({
        json: Array.from({ length: 15 }, (_, i) => ({
          id: i + 1,
          master_case_id: i + 1,
          form_id: 1,
          first_name: `ผู้ใช้สาธิต ${i + 1}`,
          submitted_at: now,
          status: "รอติดต่อ (รอดำเนินการ)",
          summary_data: { score_results: [{ label: "ต่ำ", color: "#17663a" }] },
        })),
      });
    if (path.endsWith("/evaluations/stats"))
      return route.fulfill({
        json: {
          avg_ui: 4,
          avg_speed: 4.1,
          avg_content: 4.2,
          avg_access: 4.5,
          avg_overall: 4.3,
          avg_sus: 78,
          ...Object.fromEntries(
            Array.from({ length: 10 }, (_, i) => [
              `avg_sus${i + 1}`,
              i % 2 ? 2 : 4,
            ]),
          ),
          total_votes: 12,
          recent_comments: [evaluation],
        },
      });
    if (path.endsWith("/evaluations/list"))
      return route.fulfill({ json: { data: [evaluation], totalPages: 2 } });
    return route.fallback();
  });
  await page.goto("/admin/dashboard");
  // The widget kept its inline styles after the 2026-10-15 design rollback.
  const widget = page.locator(".dash-evaluation-wrapper");
  await expect(
    widget.getByRole("heading", { name: "สรุปผลการประเมินระบบ" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".ui-modal-overlay")).toHaveCount(0);
  if (testInfo.project.name === "mobile-chromium")
    await expect(
      page.locator(".dash-case-table-scroll-area .cw-card").first(),
    ).toBeVisible();
  else
    await expect(
      page.locator(".dash-case-table-scroll-area thead th").first(),
    ).toHaveCSS("background-color", "rgb(243, 246, 248)");
  await expect(
    page.locator(".dash-case-table-header .db-view-all-btn"),
  ).toHaveCSS("color", "rgb(180, 71, 12)");
  const tableArea = page.locator(".dash-case-table-scroll-area");
  await page.locator(".dash-case-table-wrapper select").selectOption("25");
  // Current design keeps the list in a fixed-height area that scrolls inside.
  await expect(tableArea).not.toHaveCSS("max-height", "none");
  if (testInfo.project.name === "mobile-chromium")
    await expect(tableArea.locator(".cw-card")).toHaveCount(15);
  else await expect(tableArea.locator("tbody tr")).toHaveCount(15);
  await page.locator(".dash-case-table-wrapper").screenshot({
    path: `../outputs/recent-cases-colors-${testInfo.project.name}.png`,
  });
  await widget.screenshot({
    path: `../outputs/evaluation-colors-${testInfo.project.name}.png`,
  });
  await widget.getByRole("button", { name: "ดูทั้งหมด" }).click();
  const modal = page.getByRole("dialog", { name: "รายการการประเมินทั้งหมด" });
  await expect(modal).toBeVisible();
  await expect(
    modal.getByRole("cell", { name: evaluation.suggestions, exact: false }),
  ).toBeVisible();
  await modal.getByRole("button", { name: "ถัดไป" }).click();
  await expect(modal.getByText("หน้า 2 จาก 2")).toBeVisible();
  await page.screenshot({
    path: `../outputs/evaluation-modal-colors-${testInfo.project.name}.png`,
  });
  const axe = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(widget.getByRole("button", { name: "ดูทั้งหมด" })).toBeFocused();
  const backToTop = page.getByRole("button", { name: "กลับขึ้นด้านบน" });
  await expect(backToTop).toBeVisible();
  await backToTop.click();
  await expect
    .poll(() =>
      page.locator(".dz-surface").evaluate((el) => Math.round(el.scrollTop)),
    )
    .toBe(0);
  await expect(backToTop).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

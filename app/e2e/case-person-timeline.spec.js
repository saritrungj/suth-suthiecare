import { test, expect } from "@playwright/test";
import { mockAdminApi } from "./helpers/api-mocks.js";

const current = {
  id: 101,
  master_case_id: 10,
  person_id: 7,
  form_id: 1,
  form_title: "แบบประเมินปัจจุบัน",
  clinic_type: "general",
  submitted_at: "2026-10-03T09:00:00+07:00",
  summary_data: { display_name: "ผู้รับบริการทดสอบ", raw_answers: {} },
};
const previous = {
  ...current,
  id: 99,
  master_case_id: 9,
  form_id: 2,
  form_title: "แบบประเมินจากคลินิกวัยรุ่น",
  clinic_type: "teenager",
  submitted_at: "2026-09-01T09:00:00+07:00",
  summary_data: { raw_answers: { คำตอบครั้งก่อน: "ข้อมูลจากฟอร์มเดิม" } },
};

async function openCase(
  page,
  { caseFails = false, timelineFails = false } = {},
) {
  await page.clock.setFixedTime(new Date("2026-10-03T10:00:00+07:00"));
  let releaseCase;
  const caseGate = new Promise((resolve) => {
    releaseCase = resolve;
  });
  await page.addInitScript(() => {
    localStorage.setItem("i18nextLng", "th");
    document.cookie = "suth_staff_session=synthetic-session; path=/";
    sessionStorage.setItem("suth_user", JSON.stringify({ id: 1, role_id: 1 }));
  });
  await mockAdminApi(page);
  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith("/master-cases/by-id/10")) {
      await caseGate;
      return route.fulfill({
        status: caseFails ? 500 : 200,
        json: caseFails
          ? {}
          : { masterCases: [{ id: 10, status: "Open" }], responses: [current] },
      });
    }
    if (pathname.endsWith("/master-cases/10/person-timeline"))
      return route.fulfill({
        status: timelineFails ? 500 : 200,
        json: timelineFails ? {} : { responses: [current, previous] },
      });
    if (pathname.endsWith("/forms"))
      return route.fulfill({
        json: [
          {
            id: 1,
            title: current.form_title,
            status: "published",
            clinic_type: "general",
          },
        ],
      });
    if (/\/forms\/[12]$/.test(pathname))
      return route.fulfill({
        json: {
          id: 1,
          title: current.form_title,
          clinic_type: "general",
          questions: [],
        },
      });
    if (pathname.includes("/forms/1/responses"))
      return route.fulfill({ json: [current] });
    if (
      /\/(staffs|status-options|case-statuses|services|note-templates|templates)$/.test(
        pathname,
      ) ||
      /\/(answers|logs|appointments)$/.test(pathname)
    )
      return route.fulfill({ json: [] });
    return route.fallback();
  });
  await page.goto("/admin/cases");
  await page
    .getByRole("button", { name: "ผู้รับบริการทดสอบ", exact: true })
    .click();
  // Mobile drawers default to the action tab; explicitly open the profile.
  await page
    .getByRole("tab", { name: /แฟ้ม|ข้อมูล|ประวัติ/ })
    .first()
    .click();
  return releaseCase;
}

for (const caseFails of [false, true]) {
  test(`person history survives a later ${caseFails ? "failed" : "successful"} case request`, async ({
    page,
  }) => {
    const releaseCase = await openCase(page, { caseFails });
    const olderForm = page
      .locator(".cdm-timeline-title")
      .filter({ hasText: previous.form_title });
    await expect(olderForm).toBeVisible();
    const completed = page.waitForResponse("**/master-cases/by-id/10");
    releaseCase();
    await completed;
    // Allow React to process the later response before checking for overwrite.
    await page.waitForTimeout(150);
    await expect(olderForm).toBeVisible();
    await olderForm.click();
    await expect(
      page.getByText("ข้อมูลจากฟอร์มเดิม", { exact: true }),
    ).toBeVisible();
  });
}

test("uses the current case history when the person timeline fails", async ({
  page,
}) => {
  const releaseCase = await openCase(page, { timelineFails: true });
  releaseCase();
  await expect(page.locator(".cdm-timeline-title")).toHaveText([
    current.form_title,
  ]);
});

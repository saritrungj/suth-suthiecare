import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockAdminApi } from "./helpers/api-mocks.js";

const current = {
  id: 101,
  first_name: "สมชาย",
  status: "ส่งพบสูติแพทย์ ชั้น 2 อาคารศูนย์ความเป็นเลิศทางการแพทย์",
  latest_activity: {
    type: "note",
    title: "บันทึกการติดตาม",
    occurred_at: "2026-10-08T09:00:00+07:00",
  },
  master_case_id: 10,
  person_id: 7,
  form_id: 1,
  form_title: "แบบประเมินปัจจุบัน",
  clinic_type: "general",
  submitted_at: "2026-10-03T09:00:00+07:00",
  summary_data: { display_name: "สมชาย ใจดี", raw_answers: {} },
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
    if (pathname.endsWith("/logs"))
      return route.fulfill({
        json: [
          {
            id: 1,
            type: "note",
            created_at: current.latest_activity.occurred_at,
            detail: "บันทึกทดสอบ",
          },
        ],
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
  await page.locator(".cw-person-open").first().click();
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

for (const width of [1440, 768, 390]) {
  test(`case activity layout at ${width}px`, async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "explicit viewport coverage",
    );
    await page.setViewportSize({ width, height: 1000 });
    const release = await openCase(page);
    release();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("tab", { name: /ดำเนินการ|ติดตาม/ })
      .first()
      .click();
    await expect(
      dialog.getByRole("heading", { name: "สถานะและผู้รับผิดชอบ" }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "ประเมินและบันทึกติดตาม" }),
    ).toBeAttached();
    await expect(dialog.locator(".cw-activity-title")).toHaveText(
      "บันทึกการติดตาม",
    );
    expect(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    const tabs = dialog.getByRole("tablist");
    expect(await tabs.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
    for (const tab of await tabs.getByRole("tab").all()) {
      expect((await tab.boundingBox()).height).toBeGreaterThanOrEqual(44);
    }
    const tabAccessibility = await new AxeBuilder({ page })
      .include(".cw-tabs")
      .analyze();
    expect(tabAccessibility.violations).toEqual([]);
    await tabs.screenshot({ path: `../outputs/case-tabs-${width}.png` });
    await tabs.getByRole("tab", { name: "ติดตาม", exact: true }).focus();
    await page.keyboard.press("End");
    await expect(tabs.getByRole("tab", { name: /ประวัติ/ })).toBeFocused();
    await expect(tabs.getByRole("tab", { name: /ประวัติ/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.keyboard.press("Home");
    await expect(
      tabs.getByRole("tab", { name: "ติดตาม", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    const fields = dialog.locator(".cw-action-fields");
    expect(
      await fields.evaluate(
        (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
      ),
    ).toBe(width <= 760 ? 1 : 2);
    await page.screenshot({
      path: `../outputs/case-drawer-${width}.png`,
      fullPage: true,
    });
    await dialog
      .getByRole("button", { name: "ปิดหน้าต่าง", exact: true })
      .click();
    const person = page.locator(".cw-person-open").first();
    await expect(person).toBeVisible();
    await expect(page.locator(".cw-activity")).toHaveCount(0);
    const accessibility = await new AxeBuilder({ page })
      .include(".cw-person")
      .analyze();
    expect(accessibility.violations).toEqual([]);
    await page.screenshot({
      path: `../outputs/case-list-${width}.png`,
      fullPage: true,
    });
    await person.focus();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeVisible();
  });
}

test("saving a follow-up refreshes the activity without resetting the queue", async ({
  page,
}) => {
  const release = await openCase(page);
  const masterLoaded = page.waitForResponse("**/master-cases/by-id/10");
  release();
  await masterLoaded;
  let logs = [];
  await page.route("**/api/cases/*/logs*", async (route) => {
    if (route.request().method() === "POST") {
      logs = [
        {
          id: 9,
          type: "note",
          created_at: "2026-10-09T10:00:00+07:00",
          detail: "ติดตามครั้งใหม่",
        },
      ];
      return route.fulfill({ json: { success: true } });
    }
    return route.fulfill({ json: logs });
  });
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("tab", { name: /ดำเนินการ|ติดตาม/ })
    .first()
    .click();
  await dialog
    .getByPlaceholder("ระบุรายละเอียดการติดตาม หรือสรุปอาการในครั้งนี้...")
    .fill("ติดตามครั้งใหม่");
  await dialog
    .getByRole("button", { name: "บันทึกการดำเนินการทั้งหมด" })
    .click();
  await expect(dialog.locator(".cw-activity-date")).toContainText("9 ต.ค.");
  await expect(dialog.getByRole("tab", { name: /ประวัติ/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const alert = page.locator(".swal2-container");
  await expect(alert).not.toBeVisible();
  await dialog
    .getByRole("button", { name: "ปิดหน้าต่าง", exact: true })
    .click();
  await expect(
    page.locator(".cw-col-date, .cw-card-date").last(),
  ).toContainText("9 ต.ค.");
});

test("activity fallback identifies forms and walk-in records and exposes long titles", async ({
  page,
}) => {
  const release = await openCase(page);
  release();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "ปิดหน้าต่าง", exact: true })
    .click();
  const longTitle =
    "แบบประเมินสุขภาพและการติดตามผู้รับบริการต่อเนื่องสำหรับคลินิกวัยรุ่นและครอบครัวในโรงพยาบาล";
  for (const case_source of ["assessment_form", "walkin"]) {
    const row = {
      ...current,
      case_source,
      latest_activity: null,
      form_title: longTitle,
    };
    await page.route("**/api/forms/1/responses*", (route) =>
      route.fulfill({ json: [row] }),
    );
    await page.route("**/api/cases/*/logs*", (route) =>
      route.fulfill({ json: [] }),
    );
    await page.reload();
    await expect(page.locator(".cw-activity")).toHaveCount(0);
    const title = case_source === "walkin" ? "บันทึกโดยเจ้าหน้าที่" : longTitle;
    await page.locator(".cw-person-open").first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator(".cw-activity-title")).toHaveText(title);
    await dialog
      .getByRole("button", { name: "ปิดหน้าต่าง", exact: true })
      .click();
  }
});

test("case queues show the full name immediately when the list provides it", async ({
  page,
}) => {
  const release = await openCase(page);
  release();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "ปิดหน้าต่าง", exact: true })
    .click();
  await page.route("**/api/forms/1/responses*", (route) =>
    route.fulfill({ json: [{ ...current, last_name: "ใจดี" }] }),
  );
  await page.reload();
  await expect(page.locator(".cw-person-name")).toContainText("สมชาย");
  await expect(page.locator(".cw-person-name")).toContainText("ใจดี");
  await expect(
    page.getByRole("button", { name: "เปิดดูนามสกุล", exact: true }),
  ).toHaveCount(0);
});

test("surname reveal keeps the first name visible and can be hidden again", async ({
  page,
}, testInfo) => {
  const release = await openCase(page);
  release();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "ปิดหน้าต่าง", exact: true })
    .click();
  let requests = 0;
  await page.route("**/api/cases/101/last-name", async (route) => {
    requests++;
    return route.fulfill({ json: { last_name: "ใจดี" } });
  });
  await expect(page.locator(".cw-person-name")).toContainText("สมชาย");
  expect(requests).toBe(0);
  await expect(page.locator(".cw-person-name")).not.toContainText("ใจดี");
  const nameBox = await page.locator(".cw-person-name").boundingBox();
  const codeBox = await page.locator(".cw-person-code").boundingBox();
  expect(Math.abs(nameBox.x - codeBox.x)).toBeLessThan(1);
  expect(codeBox.y).toBeGreaterThan(nameBox.y);
  const eye = page.getByRole("button", { name: "เปิดดูนามสกุล", exact: true });
  expect((await eye.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await eye.hover();
  await expect(eye).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(eye).toHaveCSS("border-top-width", "0px");
  await page
    .locator(".cw-scroll, .cw-cards")
    .first()
    .screenshot({
      path: `../outputs/case-name-hidden-${testInfo.project.name}.png`,
    });
  await eye.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".cw-person-name")).toContainText("สมชาย");
  await expect(page.locator(".cw-person")).toContainText("ใจดี");
  expect(requests).toBe(1);
  const hideEye = page.getByRole("button", {
    name: "ซ่อนนามสกุล",
    exact: true,
  });
  await hideEye.hover();
  await expect(hideEye).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(hideEye).toHaveCSS("border-top-width", "0px");
  await page
    .locator(".cw-scroll, .cw-cards")
    .first()
    .screenshot({
      path: `../outputs/case-name-revealed-${testInfo.project.name}.png`,
    });
  await page.getByRole("button", { name: "ซ่อนนามสกุล", exact: true }).click();
  await expect(page.locator(".cw-person-name")).toContainText("สมชาย");
  await expect(page.locator(".cw-person-name")).not.toContainText("ใจดี");
});

test("surname reveal retries a failed request without opening case details", async ({
  page,
}) => {
  const release = await openCase(page);
  release();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "ปิดหน้าต่าง", exact: true })
    .click();
  let attempts = 0;
  await page.route("**/api/cases/101/last-name", (route) =>
    route.fulfill(
      ++attempts === 1
        ? { status: 503, json: {} }
        : { json: { last_name: "ใจดี" } },
    ),
  );
  await page
    .getByRole("button", { name: "เปิดดูนามสกุล", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "เปิดนามสกุลไม่สำเร็จ" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "เปิดดูนามสกุล", exact: true })
    .click();
  await expect(page.locator(".cw-person-name")).toContainText("สมชาย");
});

test("case viewers without PII permission do not have a name reveal control", async ({
  page,
}) => {
  const release = await openCase(page);
  release();
  let requests = 0;
  await page.route("**/api/me/authorization", (route) =>
    route.fulfill({
      json: {
        user: { id: 1 },
        is_system_admin: false,
        system_permissions: [],
        memberships: [
          {
            id: 1,
            organization: {
              id: 1,
              name: "หน่วยงานทดสอบ",
              org_type: "hospital",
            },
            permissions: ["cases.view", "forms.view", "clinical.view"],
          },
        ],
      },
    }),
  );
  await page.route("**/api/cases/101/last-name", (route) => {
    requests++;
    return route.fulfill({ json: { last_name: "ใจดี" } });
  });
  await page.reload();
  await expect(page.locator(".cw-person-open")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "เปิดดูนามสกุล", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".cw-person-name")).not.toContainText("สมชาย");
  expect(requests).toBe(0);
});

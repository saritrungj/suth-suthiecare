import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockAdminApi, mockPublicApi } from "./helpers/api-mocks.js";

const organizations = [
  {
    id: 10,
    name: "โรงพยาบาลสาธิต",
    code: "DEMO",
    kind: "main",
    org_level: "main",
    org_type: "hospital",
    status: "active",
    child_count: 2,
  },
  {
    id: 1,
    name: "หน่วยงานต้นทาง (ข้อมูลจำลอง)",
    code: "A",
    kind: "unit",
    org_level: "unit",
    org_type: "hospital",
    status: "active",
    parent_id: 10,
  },
  {
    id: 2,
    name: "หน่วยงานปลายทาง (ข้อมูลจำลอง)",
    code: "B",
    kind: "unit",
    org_level: "unit",
    org_type: "hospital",
    status: "active",
    parent_id: 10,
  },
];
async function setup(page, received = {}, options = {}) {
  await mockAdminApi(page);
  await page.addInitScript(() => {
    document.cookie = "suth_staff_session=synthetic-session; path=/";
    localStorage.setItem("suth_active_organization_1", "1");
    localStorage.setItem("i18nextLng", "th");
  });
  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url()),
      method = route.request().method();
    if (pathname === "/api/organizations")
      return route.fulfill({ json: organizations });
    if (pathname === "/api/organizations/1/members")
      return route.fulfill({
        json: [
          {
            id: 17,
            user_id: 5,
            name: "เจ้าหน้าที่สาธิต",
            username: "demo-staff",
            role_id: 3,
            role_name: "Staff",
            status: "active",
          },
        ],
      });
    if (pathname === "/api/roles")
      return route.fulfill({ json: [{ id: 3, name: "Staff" }] });
    if (pathname.endsWith("/roles/3/permissions")) {
      if (method === "PUT") {
        received.role = route.request().postDataJSON();
        return route.fulfill({ json: { success: true, version: 2 } });
      }
      return route.fulfill({
        json: { permissions: ["cases.view"], version: 1, configured: true },
      });
    }
    if (pathname.endsWith("/referral-destinations")) {
      if (method === "PUT") {
        received.referral = route.request().postDataJSON();
        return route.fulfill({ json: { success: true } });
      }
      return route.fulfill({ json: [] });
    }
    if (pathname.endsWith("/notification-target")) {
      if (method === "PUT") {
        received.notification = route.request().postDataJSON();
        return route.fulfill({ json: { success: true } });
      }
      if (options.notificationFailure)
        return route.fulfill({ status: 503, json: { code: "UNAVAILABLE" } });
      return route.fulfill({
        json: {
          destination_masked: "****1234",
          enabled: true,
          verified_at: "2026-10-01",
        },
      });
    }
    if (pathname.endsWith("/data-permissions")) {
      if (method === "PUT") {
        received.member = route.request().postDataJSON();
        return route.fulfill({ json: { success: true } });
      }
      return route.fulfill({
        json: [
          { permission_key: "pii.view", granted: true },
          { permission_key: "clinical.view", granted: false },
        ],
      });
    }
    if (pathname === "/api/pdpa/requests")
      return route.fulfill({
        json: [
          {
            id: 7,
            request_type: "access",
            status: "submitted",
            version: 1,
            detail: "คำขอข้อมูลสาธิต ไม่มีข้อมูลผู้รับบริการจริง",
            created_at: "2026-10-03",
          },
        ],
      });
    if (/\/purposes\/\d+$/.test(pathname)) {
      received.purpose = route.request().postDataJSON();
      return route.fulfill({ json: { success: true } });
    }
    if (pathname.endsWith("/purposes")) return route.fulfill({ json: [] });
    if (pathname.endsWith("/retention/dry-run"))
      return route.fulfill({
        json: { dry_run: true, candidates: 12, automatic_deletion: false },
      });
    if (pathname.endsWith("/retention"))
      return route.fulfill({
        json: [
          { data_type: "form_responses", retention_days: 365, version: 1 },
        ],
      });
    if (pathname === "/api/forms")
      return route.fulfill({
        json: [{ id: 101, organization_id: 1, title: "ฟอร์มสาธิต" }],
      });
    return route.fallback();
  });
  await page.goto("/admin/organizations");
  await page
    .getByRole("complementary", { name: "โครงสร้างหน่วยงาน" })
    .getByRole("button", { name: /หน่วยงานต้นทาง/ })
    .click();
}

test("new management sections follow the existing controls on desktop and mobile", async ({
  page,
}, testInfo) => {
  await setup(page);
  const role = page.getByRole("region", {
    name: "บทบาทและสิทธิ์ในหน่วยงาน",
    exact: true,
  });
  await role.getByLabel("บทบาทที่ตั้งสิทธิ์").selectOption("3");
  await expect(
    role.getByRole("checkbox", { name: "ดูข้อมูล" }).first(),
  ).toBeAttached();
  if (process.env.PDPA_UI_BASELINE === "1") {
    await role.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `../outputs/pdpa/evidence/ui-before-${testInfo.project.name}.png`,
    });
    return;
  }
  await role.evaluate((element) => element.scrollIntoView({ block: "start" }));
  await page.screenshot({
    path: `../outputs/pdpa/evidence/ui-role-${testInfo.project.name}.png`,
  });
  const settings = page.getByRole("region", {
    name: "การตั้งค่าความปลอดภัยและ PDPA",
  });
  await settings
    .locator("summary")
    .filter({ hasText: "กลุ่มแจ้งเตือน Telegram" })
    .click();
  await settings.getByLabel("Chat ID ใหม่").fill("-100123456");
  await settings.evaluate((element) =>
    element.scrollIntoView({ block: "start" }),
  );
  await page.screenshot({
    path: `../outputs/pdpa/evidence/ui-pdpa-${testInfo.project.name}.png`,
  });
  const results = await new AxeBuilder({ page })
    .include(".management-settings")
    .analyze();
  expect(results.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("settings save independently, preserve other edits, and report the retention preview", async ({
  page,
}, testInfo) => {
  const received = {};
  await setup(page, received);
  const settings = page.getByRole("region", {
    name: "การตั้งค่าความปลอดภัยและ PDPA",
  });
  const panel = (title) =>
    settings
      .locator("details")
      .filter({ has: page.locator("summary").filter({ hasText: title }) });
  const telegram = panel("กลุ่มแจ้งเตือน Telegram");
  await telegram.locator("summary").click();
  await telegram.getByLabel("Chat ID ใหม่").fill("-100123456");
  const referral = panel("หน่วยงานปลายทางที่อนุญาต");
  await referral.locator("summary").click();
  await referral
    .getByRole("checkbox", { name: organizations[2].name, exact: true })
    .check();
  await referral.getByRole("button", { name: "บันทึกคู่ส่งต่อ" }).click();
  await expect(referral.getByRole("status")).toContainText(
    "บันทึกคู่ส่งต่อแล้ว",
  );
  await expect(telegram.getByLabel("Chat ID ใหม่")).toHaveValue("-100123456");
  await telegram
    .getByRole("checkbox", { name: "ตรวจสมาชิกและปลายทาง" })
    .check();
  await telegram
    .getByRole("button", { name: "บันทึกปลายทาง", exact: true })
    .click();
  await expect
    .poll(() => received.notification)
    .toEqual({ destination: "-100123456", enabled: true, verified: true });
  const member = panel("สิทธิ์ข้อมูลละเอียด");
  await member.locator("summary").click();
  await member.getByRole("button", { name: "ตรวจสิทธิ์", exact: true }).click();
  await expect(
    member.getByRole("checkbox", { name: "เปิดข้อมูลส่วนบุคคลเต็ม" }),
  ).toBeChecked();
  await member.getByRole("checkbox", { name: "เปิดข้อมูลสุขภาพ" }).check();
  await member
    .getByRole("button", { name: "บันทึกสิทธิ์", exact: true })
    .click();
  await expect
    .poll(() => received.member)
    .toEqual({ permissions: { "pii.view": true, "clinical.view": true } });
  const purpose = panel("วัตถุประสงค์และประกาศ");
  await purpose.locator("summary").click();
  await purpose
    .getByRole("combobox", { name: "ฟอร์ม", exact: true })
    .selectOption("101");
  await purpose.getByLabel("รหัสวัตถุประสงค์").fill("demo");
  await purpose.getByLabel("รุ่นประกาศ").fill("v1");
  await purpose
    .getByRole("combobox", {
      name: "ฐานการประมวลผลที่ผู้รับผิดชอบยืนยัน",
      exact: true,
    })
    .selectOption("consent");
  await purpose
    .getByLabel("ข้อความประกาศ")
    .fill("ประกาศสาธิตสำหรับตรวจหน้าจอ ไม่มีข้อมูลผู้รับบริการจริง");
  await purpose.getByRole("checkbox", { name: "ผู้รับผิดชอบ PDPA" }).check();
  await purpose
    .getByRole("button", { name: "บันทึกประกาศ" })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `../outputs/pdpa/evidence/ui-purpose-${testInfo.project.name}.png`,
  });
  await purpose.getByRole("button", { name: "บันทึกประกาศ" }).click();
  await expect.poll(() => received.purpose?.notice_version).toBe("v1");
  const requests = panel("คำขอใช้สิทธิ");
  await requests.locator("summary").click();
  await expect(requests.getByText("รอตรวจสอบตัวตน")).toBeVisible();
  const retention = panel("อายุเก็บข้อมูล");
  await retention.locator("summary").click();
  await retention.getByRole("button", { name: "ตรวจรายการโดยไม่ลบ" }).click();
  await expect(retention.getByRole("status")).toContainText(
    "พบ 12 รายการตามนโยบาย ยังไม่ได้ลบข้อมูล",
  );
});

test("a failed section does not block the other settings", async ({ page }) => {
  await setup(page, {}, { notificationFailure: true });
  const settings = page.getByRole("region", {
    name: "การตั้งค่าความปลอดภัยและ PDPA",
  });
  await settings
    .locator("summary")
    .filter({ hasText: "กลุ่มแจ้งเตือน Telegram" })
    .click();
  await expect(settings.getByRole("alert")).toContainText(
    "โหลดปลายทางแจ้งเตือนไม่สำเร็จ",
  );
  await settings
    .locator("summary")
    .filter({ hasText: "หน่วยงานปลายทางที่อนุญาต" })
    .click();
  await expect(
    settings.getByRole("checkbox", {
      name: organizations[2].name,
      exact: true,
    }),
  ).toBeEnabled();
});

test("patient requests retain input on failure and show readable status after retry", async ({
  page,
}, testInfo) => {
  await mockPublicApi(page);
  await page.addInitScript(() => {
    document.cookie = "suth_patient_session=synthetic-session; path=/";
    localStorage.setItem("i18nextLng", "th");
  });
  await page.route("**/api/patient/history", (route) =>
    route.fulfill({
      json: {
        success: true,
        profile: { id: 1, display_name: "บัญชีสาธิต", status: "active" },
        masterCases: [],
        responses: [],
      },
    }),
  );
  await page.route("**/api/patient/privacy/organizations", (route) =>
    route.fulfill({ json: [organizations[1]] }),
  );
  let fail = true,
    received;
  await page.route("**/api/patient/privacy/requests", (route) => {
    if (route.request().method() === "POST") {
      if (fail)
        return route.fulfill({ status: 503, json: { code: "UNAVAILABLE" } });
      received = route.request().postDataJSON();
      return route.fulfill({ status: 201, json: { id: 7 } });
    }
    return route.fulfill({
      json: fail
        ? []
        : [
            {
              id: 7,
              request_type: "access",
              status: "submitted",
              created_at: "2026-10-03",
            },
          ],
    });
  });
  await page.goto("/history/result");
  const section = page.getByRole("region", {
    name: "คำขอเกี่ยวกับข้อมูลส่วนบุคคล",
  });
  await section.locator("summary").click();
  await section
    .getByRole("combobox", { name: "หน่วยงาน", exact: true })
    .selectOption("1");
  await section
    .getByRole("textbox", { name: /^รายละเอียด/ })
    .fill("ขอข้อมูลสาธิต");
  await section.getByRole("button", { name: "ส่งคำขอ", exact: true }).click();
  await expect(section.getByRole("alert")).toContainText("ส่งคำขอไม่สำเร็จ");
  await expect(
    section.getByRole("textbox", { name: /^รายละเอียด/ }),
  ).toHaveValue("ขอข้อมูลสาธิต");
  fail = false;
  await section.getByRole("button", { name: "ส่งคำขอ", exact: true }).click();
  await expect
    .poll(() => received)
    .toEqual({
      organization_id: 1,
      request_type: "access",
      detail: "ขอข้อมูลสาธิต",
    });
  await expect(section.getByText("รอตรวจสอบตัวตน")).toBeVisible();
  await section.evaluate((element) =>
    element.scrollIntoView({ block: "start" }),
  );
  await page.screenshot({
    path: `../outputs/pdpa/evidence/ui-patient-${testInfo.project.name}.png`,
  });
  expect(
    (await new AxeBuilder({ page }).include(".patient-privacy").analyze())
      .violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("privacy notice sits with the form and consent remains keyboard accessible", async ({
  page,
}, testInfo) => {
  await mockPublicApi(page);
  await page.addInitScript(() => localStorage.setItem("i18nextLng", "th"));
  await page.route("**/api/forms/101", (route) =>
    route.fulfill({
      json: {
        id: 101,
        title: "แบบประเมินสาธิต",
        description: "ใช้ข้อมูลจำลองสำหรับตรวจหน้าจอ",
        questions: [],
        theme: {},
        login_enforcement: "none",
      },
    }),
  );
  await page.route("**/api/forms/101/privacy-notice", (route) =>
    route.fulfill({
      json: {
        notice_version: "demo-v1",
        legal_basis: "consent",
        notice_text:
          "ประกาศสำหรับทดสอบการแสดงผลเท่านั้น\nไม่มีข้อมูลผู้รับบริการจริง",
      },
    }),
  );
  await page.goto("/assessment/101");
  const notice = page.getByRole("region", { name: "ประกาศความเป็นส่วนตัว" });
  await notice.locator("summary").click();
  await expect(
    notice.getByText("ไม่มีข้อมูลผู้รับบริการจริง", { exact: false }),
  ).toBeVisible();
  const consent = notice.getByRole("checkbox");
  await consent.focus();
  await page.keyboard.press("Space");
  await expect(consent).toBeChecked();
  await notice.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `../outputs/pdpa/evidence/ui-notice-${testInfo.project.name}.png`,
  });
  expect(
    (await new AxeBuilder({ page }).include(".form-privacy-notice").analyze())
      .violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("patient-visible case note uses the existing case workspace controls", async ({
  page,
}, testInfo) => {
  await mockAdminApi(page);
  await page.addInitScript(() => {
    document.cookie = "suth_staff_session=synthetic-session; path=/";
    localStorage.setItem("i18nextLng", "th");
    localStorage.setItem("suth_active_organization_1", "1");
  });
  const response = {
    id: 101,
    master_case_id: 10,
    form_id: 1,
    clinic_type: "general",
    form_title: "ฟอร์มสาธิต",
    submitted_at: "2026-10-03T09:00:00+07:00",
    summary_data: { display_name: "บัญชีสาธิต", raw_answers: {} },
  };
  await page.route("**/api/**", (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith("/forms"))
      return route.fulfill({
        json: [
          {
            id: 1,
            title: response.form_title,
            status: "published",
            clinic_type: "general",
          },
        ],
      });
    if (pathname.endsWith("/forms/1"))
      return route.fulfill({
        json: { id: 1, title: response.form_title, questions: [] },
      });
    if (pathname.endsWith("/forms/1/responses"))
      return route.fulfill({ json: [response] });
    if (
      pathname.endsWith("/master-cases/by-id/10") ||
      pathname.endsWith("/master-cases/10/person-timeline")
    )
      return route.fulfill({
        json: {
          masterCases: [{ id: 10, status: "Open" }],
          responses: [response],
        },
      });
    if (
      /\/(staffs|status-options|case-statuses|services|templates|answers|logs|appointments)$/.test(
        pathname,
      )
    )
      return route.fulfill({ json: [] });
    return route.fallback();
  });
  await page.goto("/admin/cases");
  await page.getByRole("button", { name: "บัญชีสาธิต", exact: true }).click();
  await page
    .getByRole("tab", { name: /จัดการ|ติดตาม|ดำเนินการ/ })
    .first()
    .click();
  const checkbox = page.getByRole("checkbox", {
    name: /แสดงบันทึกนี้ในประวัติ/,
  });
  await checkbox.check();
  await expect(checkbox).toBeChecked();
  await page.locator(".cdm-note-visibility").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `../outputs/pdpa/evidence/ui-case-note-${testInfo.project.name}.png`,
  });
  expect(
    (await new AxeBuilder({ page }).include(".cdm-note-visibility").analyze())
      .violations,
  ).toEqual([]);
});

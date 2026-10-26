import { test, expect } from "@playwright/test";
import { mockPublicApi } from "./helpers/api-mocks.js";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("i18nextLng", "th"));
  await mockPublicApi(page);
});

test("history requires patient login before loading any record", async ({
  page,
}) => {
  await page.goto("/history");
  await expect(page).toHaveURL(/\/account\/login\?returnTo=%2Fhistory/);
  await expect(
    page.getByRole("heading", { name: "เข้าสู่ระบบผู้รับบริการ" }),
  ).toBeVisible();
  await expect(page.getByLabel("ชื่อผู้ใช้")).toBeVisible();
});

test("patient authentication keeps the selected language across login and register", async ({
  page,
}) => {
  await page.goto("/account/login");
  await page.getByRole("button", { name: "EN" }).click();
  await expect(
    page.getByRole("heading", { name: "Patient sign in" }),
  ).toBeVisible();

  await page
    .getByRole("link", { name: "Create an account to view history" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Create patient account" }),
  ).toBeVisible();
  await expect(page.getByLabel("13-digit national ID")).toBeVisible();
});

test("patient login can continue to the protected history route", async ({
  page,
}) => {
  await page.route("**/api/patient-auth/login", (route) =>
    route.fulfill({
      status: 200,
      json: {
        success: true,
        csrf_token: "synthetic-patient-csrf",
        user: { id: 1, username: "patient", status: "active" },
      },
    }),
  );
  await page.route("**/api/patient/history", (route) =>
    route.fulfill({
      status: 200,
      json: {
        success: true,
        identity_masked: "1234*****0123",
        masterCases: [],
        responses: [],
      },
    }),
  );
  await page.goto("/account/login?returnTo=%2Fhistory");
  await page.getByLabel("ชื่อผู้ใช้").fill("patient");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL(/\/history$/);
});

test("public navbars stay visible and usable on mobile and tablet", async ({
  page,
}) => {
  for (const viewport of [
    { width: 393, height: 852 },
    { width: 820, height: 1180 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/help-center");

    await expect(page.locator(".main-nav__logo-frame")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "กลับหน้าหลัก" }),
    ).toBeVisible();

    await page.goto("/");
    const landingNav = page.locator(".sut2-nav");
    // The restored design uses a transparent navbar over the homepage hero.
    await expect(landingNav).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(landingNav).toHaveCSS("background-image", "none");
    await expect(landingNav).toHaveCSS("box-shadow", "none");
    const menuButton = page.getByRole("button", { name: "เปิดเมนู" });
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    await expect(page.locator("#sut2-nav-actions")).toBeVisible();

    const menuBox = await page.locator("#sut2-nav-actions").boundingBox();
    expect(menuBox).not.toBeNull();
    expect(menuBox.x).toBeGreaterThanOrEqual(0);
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(viewport.width);
  }
});

test("history hero shows the currently signed-in patient profile", async ({
  page,
}) => {
  await page.addInitScript(() => {
    document.cookie = "suth_patient_session=synthetic-session; path=/";
    sessionStorage.setItem(
      "patient_user",
      JSON.stringify({
        id: 1,
        username: "session-user",
        first_name: "Session",
        last_name: "Fallback",
        status: "active",
      }),
    );
  });
  await page.route("**/api/patient/history", (route) =>
    route.fulfill({
      json: {
        success: true,
        profile: {
          id: 1,
          username: "patient",
          display_name: "Current Account",
          phone: "0812345678",
          status: "active",
        },
        identity_masked: "1300*****3319",
        masterCases: [],
        responses: [],
      },
    }),
  );

  await page.goto("/history/result");

  await expect(page.locator(".hr-name")).toHaveText("Current Account");
  await expect(page.locator(".hr-avatar")).toHaveText("C");
  await expect(
    page.locator(".hr-profile-meta .hr-id-value").first(),
  ).toHaveText("1300*****3319");
  await expect(page.locator(".hr-profile-meta .hr-id-value").nth(1)).toHaveText(
    "0812345678",
  );
});

test("homepage navbar shows the signed-in patient and can log out", async ({
  page,
  isMobile,
}) => {
  await page.addInitScript(() => {
    document.cookie = "suth_patient_session=synthetic-session; path=/";
    sessionStorage.setItem(
      "patient_user",
      JSON.stringify({
        id: 1,
        username: "patient",
        first_name: "สมชาย",
        last_name: "ใจดี",
        status: "active",
      }),
    );
  });
  await page.route("**/api/patient/me", (route) =>
    route.fulfill({
      json: {
        success: true,
        user: {
          id: 1,
          username: "patient",
          first_name: "สมชาย",
          last_name: "ใจดี",
          status: "active",
        },
      },
    }),
  );
  await page.route("**/api/patient-auth/logout", (route) =>
    route.fulfill({ json: { success: true } }),
  );

  await page.goto("/");
  if (isMobile) await page.getByRole("button", { name: "เปิดเมนู" }).click();
  await page.getByRole("button", { name: /สมชาย ใจดี/ }).click();

  const accountDropdown = page.locator(".patient-account-dropdown");
  await expect(accountDropdown).toBeVisible();
  await expect(page.locator(".patient-account-summary")).toHaveCount(0);
  const dropdownBox = await accountDropdown.boundingBox();
  const viewport = page.viewportSize();
  expect(dropdownBox).not.toBeNull();
  expect(dropdownBox.x).toBeGreaterThanOrEqual(0);
  expect(dropdownBox.x + dropdownBox.width).toBeLessThanOrEqual(viewport.width);

  await page.getByRole("menuitem", { name: "ออกจากระบบ" }).click();

  await expect(page).toHaveURL(/\/$/);
  if (isMobile) await page.getByRole("button", { name: "เปิดเมนู" }).click();
  await expect(page.locator(".patient-account-login")).toHaveText(
    "เข้าสู่ระบบ",
  );
  expect(
    await page.evaluate(() => sessionStorage.getItem("patient_token")),
  ).toBeNull();
});

test("register creates a patient account and activates it with the email code", async ({
  page,
}) => {
  let registerPayload = null;
  let verifyPayload = null;
  await page.route("**/api/patient-auth/register", (route) => {
    registerPayload = route.request().postDataJSON();
    return route.fulfill({
      status: 201,
      json: {
        success: true,
        requiresEmailVerification: true,
        challengeToken: "7.e2e-challenge-token-0123456789abcdef0123456789",
        maskedEmail: "s****y@example.test",
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
        resendAfter: new Date(Date.now() + 60_000).toISOString(),
      },
    });
  });
  await page.route("**/api/patient-auth/email/verify", (route) => {
    verifyPayload = route.request().postDataJSON();
    return route.fulfill({
      json: {
        success: true,
        csrf_token: "synthetic-patient-csrf",
        user: { id: 1, username: "patient", status: "active" },
      },
    });
  });
  await page.goto("/account/register");
  await page.getByLabel("ชื่อ", { exact: true }).fill("สมชาย");
  await page.getByLabel("นามสกุล", { exact: true }).fill("ใจดี");
  await page.getByLabel("ชื่อผู้ใช้").fill("patient");
  await page.getByLabel("อีเมล").fill("somchay@example.test");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("Password#123");
  await page.getByLabel("ยืนยันรหัสผ่าน").fill("Password#123");
  await page.getByLabel("เลขบัตรประชาชน 13 หลัก").fill("1101700203456");
  await page.getByRole("button", { name: "สมัครสมาชิก" }).click();

  // The account is pending until the emailed code is entered.
  await expect(page.getByLabel("รหัสยืนยัน")).toBeVisible();
  expect(registerPayload.email).toBe("somchay@example.test");
  await page.getByLabel("รหัสยืนยัน").fill("123456");
  await page.getByRole("button", { name: /ยืนยัน/ }).click();

  await expect(page).toHaveURL(/\/history\/result$/);
  expect(verifyPayload).toEqual({
    challengeToken: "7.e2e-challenge-token-0123456789abcdef0123456789",
    otp: "123456",
  });
  expect(
    await page.evaluate(() => sessionStorage.getItem("patient_token")),
  ).toBeNull();
});

test("assessment stays public but preserves the draft and requires login to submit", async ({
  page,
}) => {
  let receivedAuthorization = "";
  await page.route("**/api/forms/101", (route) =>
    route.fulfill({
      json: {
        id: 101,
        title: "แบบประเมินทดสอบ",
        description: "แบบประเมินสามารถทำได้โดยไม่ต้องเข้าสู่ระบบ",
        questions: [],
        theme: {},
        // "optional" shows the guest prompt but still requires login to submit.
        login_enforcement: "optional",
      },
    }),
  );
  await page.route("**/api/forms/101/submit", (route) => {
    receivedAuthorization = route.request().headers().authorization || "";
    return route.fulfill({
      status: 201,
      json: { message: "บันทึกคำตอบสำเร็จ", responseId: 1 },
    });
  });
  await page.route("**/api/patient-auth/login", (route) =>
    route.fulfill({
      json: {
        success: true,
        csrf_token: "synthetic-patient-csrf",
        user: {
          id: 1,
          username: "patient",
          first_name: "สมชาย",
          last_name: "ใจดี",
          status: "active",
        },
      },
    }),
  );

  await page.goto("/assessment/101");
  await expect(
    page.getByRole("dialog", { name: "คุณยังไม่ได้เข้าสู่ระบบ" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ทดลองประเมินก่อน" }).click();
  await expect(
    page.getByRole("heading", { name: "แบบประเมินทดสอบ" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ส่งคำตอบ" }).click();
  await expect(page.getByText("เข้าสู่ระบบก่อนส่งคำตอบ")).toBeVisible();
  await page.getByRole("button", { name: "เข้าสู่ระบบเพื่อส่ง" }).click();
  await expect(page).toHaveURL(/\/account\/login\?returnTo=/);

  await page.getByLabel("ชื่อผู้ใช้").fill("patient");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL(/\/assessment\/101$/);
  await expect(page.getByText(/นำคำตอบฉบับร่างกลับมาแล้ว/)).toBeVisible();

  await page.getByRole("button", { name: "ส่งคำตอบ" }).click();
  await page.getByRole("button", { name: "ยินยอม" }).click();
  await expect(page).toHaveURL(/\/assessment-result$/);
  expect(receivedAuthorization).toBe("");
});

test("a school student sees the re-screening their school asked for", async ({
  page,
}) => {
  await page.addInitScript(() => {
    document.cookie = "suth_patient_session=synthetic-session; path=/";
    sessionStorage.setItem(
      "patient_user",
      JSON.stringify({ id: 1, username: "student", status: "active" }),
    );
  });
  await page.route("**/api/patient/history", (route) =>
    route.fulfill({
      json: {
        success: true,
        profile: { id: 1, username: "student", status: "active" },
        member_type: { type: "school_student", source: "school" },
        masterCases: [],
        responses: [],
      },
    }),
  );
  await page.route("**/api/patient/me/school-health", (route) =>
    route.fulfill({ json: { success: true, profile: {}, records: [] } }),
  );
  await page.route("**/api/patient/me/assessment-tasks", (route) =>
    route.fulfill({
      json: {
        success: true,
        tasks: [
          {
            id: 4,
            form_id: 75,
            title: "แบบประเมินความเครียดนักเรียน (ST-5)",
            due_on: "2000-01-02",
            overdue: true,
            available: true,
          },
        ],
        rounds: [
          {
            id: 9,
            form_id: 80,
            title: "แบบคัดกรอง SDQ",
            round_name: "คัดกรองต้นภาคเรียน 1/2569",
            due_on: "2099-01-31",
            available: true,
          },
        ],
      },
    }),
  );

  await page.goto("/history/result");

  const panel = page.getByRole("region", { name: /แบบประเมินที่ต้องทำ/ });
  await expect(panel).toBeVisible();
  // Screening rounds for the group and the student's own follow-ups are
  // listed apart.
  await expect(panel.locator(".at-count")).toHaveText("2");
  const screening = panel.locator(".at-group").filter({
    hasText: "แบบคัดกรองประจำภาคเรียน",
  });
  await expect(screening).toContainText("คัดกรองต้นภาคเรียน 1/2569");
  await expect(
    screening.getByRole("link", { name: "เริ่มทำ" }),
  ).toHaveAttribute("href", "/assessment/80");
  const followUp = panel.locator(".at-group").filter({
    hasText: "แบบประเมินติดตาม",
  });
  await expect(followUp).toContainText("แบบประเมินความเครียดนักเรียน (ST-5)");
  await expect(followUp).toContainText("เลยกำหนด");
  // The student never sees why the school asked for it.
  await expect(panel).not.toContainText("เสี่ยง");
  await expect(followUp.getByRole("link", { name: "เริ่มทำ" })).toHaveAttribute(
    "href",
    "/assessment/75",
  );
});

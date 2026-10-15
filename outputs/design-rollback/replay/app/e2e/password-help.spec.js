import { expect, test } from "@playwright/test";

// Password recovery is a three-step email flow (email → 6-digit code → new
// password) for both patients and staff. The API is mocked so the test only
// checks the UI wiring and the payloads the page sends.
function mockRecoveryApi(page, prefix, received) {
  return Promise.all([
    page.route(`**/api${prefix}/password-recovery/request`, (route) => {
      received.request = route.request().postDataJSON();
      return route.fulfill({
        json: {
          success: true,
          message: "ok",
          challengeToken: "9.e2e-recovery-token-0123456789abcdef0123456789",
          maskedEmail: "s****y@example.test",
          expiresAt: new Date(Date.now() + 300_000).toISOString(),
        },
      });
    }),
    page.route(`**/api${prefix}/password-recovery/verify`, (route) => {
      received.verify = route.request().postDataJSON();
      return route.fulfill({
        json: {
          success: true,
          recoveryToken: "e2e-recovery-jwt",
          username: "user",
        },
      });
    }),
    page.route(`**/api${prefix}/password-recovery/reset`, (route) => {
      received.reset = route.request().postDataJSON();
      return route.fulfill({
        json: {
          success: true,
          message: "ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบ",
        },
      });
    }),
  ]);
}

async function completeRecovery(page, received) {
  await page.getByLabel("อีเมล").fill("somchay@example.test");
  await page.getByRole("button", { name: "ส่งรหัสยืนยัน" }).click();
  await expect(
    page.getByText(/กรอกรหัสที่ส่งไปยัง s\*\*\*\*y@example.test/),
  ).toBeVisible();
  expect(received.request).toEqual({ email: "somchay@example.test" });

  const digits = "246810".split("");
  for (const [index, digit] of digits.entries()) {
    await page
      .getByLabel(`ตัวเลขรหัสยืนยันตำแหน่งที่ ${index + 1}`)
      .fill(digit);
  }
  await page.getByRole("button", { name: "ยืนยันรหัส" }).click();
  await expect(page.getByLabel("รหัสผ่านใหม่", { exact: true })).toBeVisible();
  expect(received.verify).toEqual({
    challengeToken: "9.e2e-recovery-token-0123456789abcdef0123456789",
    otp: "246810",
  });

  await page
    .getByLabel("รหัสผ่านใหม่", { exact: true })
    .fill("New-Password#123");
  await page.getByLabel("ยืนยันรหัสผ่านใหม่").fill("New-Password#123");
  await page.getByRole("button", { name: "ตั้งรหัสผ่านใหม่" }).click();
  await expect(
    page.getByText("ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว สามารถเข้าสู่ระบบได้เลย"),
  ).toBeVisible();
  expect(received.reset).toEqual({
    recoveryToken: "e2e-recovery-jwt",
    password: "New-Password#123",
  });
}

test("patient password recovery walks through email, code, and new password", async ({
  page,
}) => {
  const received = {};
  await mockRecoveryApi(page, "/patient-auth", received);
  await page.goto("/account/login");
  await page
    .getByRole("button", { name: "ลืมรหัสผ่าน? ตั้งรหัสผ่านใหม่ทางอีเมล" })
    .click();
  await expect(
    page.getByRole("heading", { name: "ตั้งรหัสผ่านใหม่" }),
  ).toBeVisible();
  await completeRecovery(page, received);
});

test("staff password recovery uses the staff endpoints", async ({ page }) => {
  const received = {};
  await mockRecoveryApi(page, "", received);
  await page.goto("/login");
  await page.getByRole("button", { name: "ลืมรหัสผ่าน?" }).click();
  await expect(
    page.getByRole("heading", { name: "ตั้งรหัสผ่านเจ้าหน้าที่ใหม่" }),
  ).toBeVisible();
  await completeRecovery(page, received);
});

test("password recovery shows a neutral notice for an unknown email", async ({
  page,
}) => {
  await page.route("**/api/patient-auth/password-recovery/request", (route) =>
    route.fulfill({ json: { success: true, message: "ok" } }),
  );
  await page.goto("/account/login");
  await page
    .getByRole("button", { name: "ลืมรหัสผ่าน? ตั้งรหัสผ่านใหม่ทางอีเมล" })
    .click();
  await page.getByLabel("อีเมล").fill("nobody@example.test");
  await page.getByRole("button", { name: "ส่งรหัสยืนยัน" }).click();
  await expect(
    page.getByText("หากอีเมลนี้ผูกกับบัญชี ระบบได้ส่งรหัสยืนยันให้แล้ว"),
  ).toBeVisible();
});

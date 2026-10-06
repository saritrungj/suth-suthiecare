# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: password-help.spec.js >> patient password recovery walks through email, code, and new password
- Location: e2e\password-help.spec.js:75:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว สามารถเข้าสู่ระบบได้เลย')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByText('ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว สามารถเข้าสู่ระบบได้เลย')

```

```yaml
- main:
    - link "กลับหน้าแรก":
        - /url: /
    - group "เปลี่ยนภาษา":
        - button "ไทย" [pressed]
        - button "EN"
    - region "เข้าสู่ระบบดูประวัติ":
        - complementary:
            - img "SUTH"
            - paragraph: พื้นที่ส่วนตัวของผู้รับบริการ
            - heading "ดูประวัติสุขภาพของคุณได้อย่างมั่นใจ" [level=2]
        - tablist "เลือกประเภทผู้ใช้งาน":
            - tab "ผู้มารับบริการ" [selected]
            - tab "เจ้าหน้าที่"
        - heading "เข้าสู่ระบบผู้รับบริการ" [level=1]
        - paragraph: กรอกชื่อผู้ใช้และรหัสผ่านเพื่อเปิดประวัติของคุณ
        - region "ตั้งรหัสผ่านใหม่":
            - text: 1 อีเมล 2 รหัส 3 รหัสใหม่
            - heading "ตั้งรหัสผ่านใหม่" [level=2]
            - paragraph: ตั้งรหัสผ่านใหม่เพื่อกลับเข้าสู่ระบบ
            - alert: รหัสผ่านยังไม่ตรงตามเงื่อนไขทุกข้อ
            - text: รหัสผ่านใหม่
            - textbox "รหัสผ่านใหม่": new-password-1
            - button "แสดงรหัสผ่าน":
                - img
            - list:
                - listitem: ความยาว 8-16 ตัวอักษร (ผ่าน)
                - listitem: ตัวอักษรภาษาอังกฤษตัวใหญ่ (A-Z) อย่างน้อย 1 ตัว (ยังไม่ผ่าน)
                - listitem: ตัวอักษรภาษาอังกฤษตัวเล็ก (a-z) อย่างน้อย 1 ตัว (ผ่าน)
                - listitem: ตัวเลข (0-9) อย่างน้อย 1 ตัว (ผ่าน)
                - listitem: "สัญลักษณ์ เช่น ! @ # $ % อย่างน้อย 1 ตัว (ผ่าน)"
            - text: ยืนยันรหัสผ่านใหม่
            - textbox "ยืนยันรหัสผ่านใหม่": new-password-1
            - button "แสดงรหัสผ่าน":
                - img
            - button "ตั้งรหัสผ่านใหม่"
            - button "ยกเลิก"
        - text: ยังไม่มีบัญชี?
        - link "สมัครสมาชิกเพื่อดูประวัติ":
            - /url: /account/register?returnTo=%2Fhistory
        - paragraph: ระบบจะแสดงเฉพาะข้อมูลที่เชื่อมโยงกับบัญชีของคุณเท่านั้น
```

# Test source

```ts
  1   | import { expect, test } from "@playwright/test";
  2   |
  3   | // Password recovery is a three-step email flow (email → 6-digit code → new
  4   | // password) for both patients and staff. The API is mocked so the test only
  5   | // checks the UI wiring and the payloads the page sends.
  6   | function mockRecoveryApi(page, prefix, received) {
  7   |   return Promise.all([
  8   |     page.route(`**/api${prefix}/password-recovery/request`, (route) => {
  9   |       received.request = route.request().postDataJSON();
  10  |       return route.fulfill({
  11  |         json: {
  12  |           success: true,
  13  |           message: "ok",
  14  |           challengeToken: "9.e2e-recovery-token-0123456789abcdef0123456789",
  15  |           maskedEmail: "s****y@example.test",
  16  |           expiresAt: new Date(Date.now() + 300_000).toISOString(),
  17  |         },
  18  |       });
  19  |     }),
  20  |     page.route(`**/api${prefix}/password-recovery/verify`, (route) => {
  21  |       received.verify = route.request().postDataJSON();
  22  |       return route.fulfill({
  23  |         json: {
  24  |           success: true,
  25  |           recoveryToken: "e2e-recovery-jwt",
  26  |           username: "user",
  27  |         },
  28  |       });
  29  |     }),
  30  |     page.route(`**/api${prefix}/password-recovery/reset`, (route) => {
  31  |       received.reset = route.request().postDataJSON();
  32  |       return route.fulfill({
  33  |         json: {
  34  |           success: true,
  35  |           message: "ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบ",
  36  |         },
  37  |       });
  38  |     }),
  39  |   ]);
  40  | }
  41  |
  42  | async function completeRecovery(page, received) {
  43  |   await page.getByLabel("อีเมล").fill("somchay@example.test");
  44  |   await page.getByRole("button", { name: "ส่งรหัสยืนยัน" }).click();
  45  |   await expect(
  46  |     page.getByText(/กรอกรหัสที่ส่งไปยัง s\*\*\*\*y@example.test/),
  47  |   ).toBeVisible();
  48  |   expect(received.request).toEqual({ email: "somchay@example.test" });
  49  |
  50  |   const digits = "246810".split("");
  51  |   for (const [index, digit] of digits.entries()) {
  52  |     await page
  53  |       .getByLabel(`ตัวเลขรหัสยืนยันตำแหน่งที่ ${index + 1}`)
  54  |       .fill(digit);
  55  |   }
  56  |   await page.getByRole("button", { name: "ยืนยันรหัส" }).click();
  57  |   await expect(page.getByLabel("รหัสผ่านใหม่", { exact: true })).toBeVisible();
  58  |   expect(received.verify).toEqual({
  59  |     challengeToken: "9.e2e-recovery-token-0123456789abcdef0123456789",
  60  |     otp: "246810",
  61  |   });
  62  |
  63  |   await page.getByLabel("รหัสผ่านใหม่", { exact: true }).fill("New-Password#123");
  64  |   await page.getByLabel("ยืนยันรหัสผ่านใหม่").fill("New-Password#123");
  65  |   await page.getByRole("button", { name: "ตั้งรหัสผ่านใหม่" }).click();
  66  |   await expect(
  67  |     page.getByText("ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว สามารถเข้าสู่ระบบได้เลย"),
> 68  |   ).toBeVisible();
      |     ^ Error: expect(locator).toBeVisible() failed
  69  |   expect(received.reset).toEqual({
  70  |     recoveryToken: "e2e-recovery-jwt",
  71  |     password: "New-Password#123",
  72  |   });
  73  | }
  74  |
  75  | test("patient password recovery walks through email, code, and new password", async ({
  76  |   page,
  77  | }) => {
  78  |   const received = {};
  79  |   await mockRecoveryApi(page, "/patient-auth", received);
  80  |   await page.goto("/account/login");
  81  |   await page
  82  |     .getByRole("button", { name: "ลืมรหัสผ่าน? ตั้งรหัสผ่านใหม่ทางอีเมล" })
  83  |     .click();
  84  |   await expect(
  85  |     page.getByRole("heading", { name: "ตั้งรหัสผ่านใหม่" }),
  86  |   ).toBeVisible();
  87  |   await completeRecovery(page, received);
  88  | });
  89  |
  90  | test("staff password recovery uses the staff endpoints", async ({ page }) => {
  91  |   const received = {};
  92  |   await mockRecoveryApi(page, "", received);
  93  |   await page.goto("/login");
  94  |   await page.getByRole("button", { name: "ลืมรหัสผ่าน?" }).click();
  95  |   await expect(
  96  |     page.getByRole("heading", { name: "ตั้งรหัสผ่านเจ้าหน้าที่ใหม่" }),
  97  |   ).toBeVisible();
  98  |   await completeRecovery(page, received);
  99  | });
  100 |
  101 | test("password recovery shows a neutral notice for an unknown email", async ({
  102 |   page,
  103 | }) => {
  104 |   await page.route("**/api/patient-auth/password-recovery/request", (route) =>
  105 |     route.fulfill({ json: { success: true, message: "ok" } }),
  106 |   );
  107 |   await page.goto("/account/login");
  108 |   await page
  109 |     .getByRole("button", { name: "ลืมรหัสผ่าน? ตั้งรหัสผ่านใหม่ทางอีเมล" })
  110 |     .click();
  111 |   await page.getByLabel("อีเมล").fill("nobody@example.test");
  112 |   await page.getByRole("button", { name: "ส่งรหัสยืนยัน" }).click();
  113 |   await expect(
  114 |     page.getByText("หากอีเมลนี้ผูกกับบัญชี ระบบได้ส่งรหัสยืนยันให้แล้ว"),
  115 |   ).toBeVisible();
  116 | });
  117 |
```

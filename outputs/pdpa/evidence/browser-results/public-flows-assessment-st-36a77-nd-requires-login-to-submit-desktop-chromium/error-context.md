# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: public-flows.spec.js >> assessment stays public but preserves the draft and requires login to submit
- Location: e2e\public-flows.spec.js:262:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "Bearer patient-e2e-token"
Received: ""
```

# Page snapshot

```yaml
- generic [ref=e3]:
    - navigation [ref=e4]:
        - img "SUTH Healthcare" [ref=e6]
        - generic [ref=e7]:
            - button "เปลี่ยนภาษาเป็นภาษาอังกฤษ" [ref=e8] [cursor=pointer]: EN
            - button "✕ ปิดหน้าต่าง" [ref=e12] [cursor=pointer]
    - generic [ref=e13]:
        - generic [ref=e14]:
            - heading "ส่งข้อมูลให้เจ้าหน้าที่สำเร็จ" [level=2] [ref=e19]
            - paragraph [ref=e20]: ข้อมูลของท่านได้รับการบันทึกเรียบร้อยแล้ว และระบบได้แจ้งให้เจ้าหน้าที่ที่เกี่ยวข้องทราบแล้ว
        - generic [ref=e21]:
            - button "← กลับหน้าหลัก" [ref=e22] [cursor=pointer]
            - button "ตรวจสอบประวัติ" [ref=e23] [cursor=pointer]
            - button "ประเมินการใช้งานระบบ" [ref=e27] [cursor=pointer]
```

# Test source

```ts
  224 |     });
  225 |   });
  226 |   await page.route("**/api/patient-auth/email/verify", (route) => {
  227 |     verifyPayload = route.request().postDataJSON();
  228 |     return route.fulfill({
  229 |       json: {
  230 |         success: true,
  231 |         csrf_token: "synthetic-patient-csrf",
  232 |         user: { id: 1, username: "patient", status: "active" },
  233 |       },
  234 |     });
  235 |   });
  236 |   await page.goto("/account/register");
  237 |   await page.getByLabel("ชื่อ", { exact: true }).fill("สมชาย");
  238 |   await page.getByLabel("นามสกุล", { exact: true }).fill("ใจดี");
  239 |   await page.getByLabel("ชื่อผู้ใช้").fill("patient");
  240 |   await page.getByLabel("อีเมล").fill("somchay@example.test");
  241 |   await page.getByLabel("รหัสผ่าน", { exact: true }).fill("password123");
  242 |   await page.getByLabel("ยืนยันรหัสผ่าน").fill("password123");
  243 |   await page.getByLabel("เลขบัตรประชาชน 13 หลัก").fill("1101700203456");
  244 |   await page.getByRole("button", { name: "สมัครสมาชิก" }).click();
  245 |
  246 |   // The account is pending until the emailed code is entered.
  247 |   await expect(page.getByLabel("รหัสยืนยัน")).toBeVisible();
  248 |   expect(registerPayload.email).toBe("somchay@example.test");
  249 |   await page.getByLabel("รหัสยืนยัน").fill("123456");
  250 |   await page.getByRole("button", { name: /ยืนยัน/ }).click();
  251 |
  252 |   await expect(page).toHaveURL(/\/history\/result$/);
  253 |   expect(verifyPayload).toEqual({
  254 |     challengeToken: "7.e2e-challenge-token-0123456789abcdef0123456789",
  255 |     otp: "123456",
  256 |   });
  257 |   expect(
  258 |     await page.evaluate(() => sessionStorage.getItem("patient_token")),
  259 |   ).toBe("patient-e2e-token");
  260 | });
  261 |
  262 | test("assessment stays public but preserves the draft and requires login to submit", async ({
  263 |   page,
  264 | }) => {
  265 |   let receivedAuthorization = "";
  266 |   await page.route("**/api/forms/101", (route) =>
  267 |     route.fulfill({
  268 |       json: {
  269 |         id: 101,
  270 |         title: "แบบประเมินทดสอบ",
  271 |         description: "แบบประเมินสามารถทำได้โดยไม่ต้องเข้าสู่ระบบ",
  272 |         questions: [],
  273 |         theme: {},
  274 |         // "optional" shows the guest prompt but still requires login to submit.
  275 |         login_enforcement: "optional",
  276 |       },
  277 |     }),
  278 |   );
  279 |   await page.route("**/api/forms/101/submit", (route) => {
  280 |     receivedAuthorization = route.request().headers().authorization || "";
  281 |     return route.fulfill({
  282 |       status: 201,
  283 |       json: { message: "บันทึกคำตอบสำเร็จ", responseId: 1 },
  284 |     });
  285 |   });
  286 |   await page.route("**/api/patient-auth/login", (route) =>
  287 |     route.fulfill({
  288 |       json: {
  289 |         success: true,
  290 |         csrf_token: "synthetic-patient-csrf",
  291 |         user: {
  292 |           id: 1,
  293 |           username: "patient",
  294 |           first_name: "สมชาย",
  295 |           last_name: "ใจดี",
  296 |           status: "active",
  297 |         },
  298 |       },
  299 |     }),
  300 |   );
  301 |
  302 |   await page.goto("/assessment/101");
  303 |   await expect(
  304 |     page.getByRole("dialog", { name: "คุณยังไม่ได้เข้าสู่ระบบ" }),
  305 |   ).toBeVisible();
  306 |   await page.getByRole("button", { name: "ทดลองประเมินก่อน" }).click();
  307 |   await expect(
  308 |     page.getByRole("heading", { name: "แบบประเมินทดสอบ" }),
  309 |   ).toBeVisible();
  310 |   await page.getByRole("button", { name: "ส่งคำตอบ" }).click();
  311 |   await expect(page.getByText("เข้าสู่ระบบก่อนส่งคำตอบ")).toBeVisible();
  312 |   await page.getByRole("button", { name: "เข้าสู่ระบบเพื่อส่ง" }).click();
  313 |   await expect(page).toHaveURL(/\/account\/login\?returnTo=/);
  314 |
  315 |   await page.getByLabel("ชื่อผู้ใช้").fill("patient");
  316 |   await page.getByLabel("รหัสผ่าน", { exact: true }).fill("password123");
  317 |   await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  318 |   await expect(page).toHaveURL(/\/assessment\/101$/);
  319 |   await expect(page.getByText(/นำคำตอบฉบับร่างกลับมาแล้ว/)).toBeVisible();
  320 |
  321 |   await page.getByRole("button", { name: "ส่งคำตอบ" }).click();
  322 |   await page.getByRole("button", { name: "ยินยอม" }).click();
  323 |   await expect(page).toHaveURL(/\/assessment-result$/);
> 324 |   expect(receivedAuthorization).toBe("Bearer patient-e2e-token");
      |                                 ^ Error: expect(received).toBe(expected) // Object.is equality
  325 | });
  326 |
```

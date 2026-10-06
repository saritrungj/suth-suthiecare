# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: public-flows.spec.js >> register creates a patient account and activates it with the email code
- Location: e2e\public-flows.spec.js:207:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByLabel('รหัสยืนยัน')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByLabel('รหัสยืนยัน')

```

```yaml
- main:
    - link "กลับหน้าแรก":
        - /url: /
    - group "เปลี่ยนภาษา":
        - button "ไทย" [pressed]
        - button "EN"
    - region "สมัครสมาชิกผู้รับบริการ":
        - complementary:
            - img "SUTH"
            - paragraph: บัญชีสำหรับตรวจสอบประวัติ
            - heading "สร้างบัญชีเพื่อส่งและติดตามผลของคุณ" [level=2]
            - paragraph: กรอกชื่อและนามสกุลเพื่อสร้างบัญชีสำหรับส่งแบบประเมิน หากมีประวัติเดิมสามารถเพิ่มเลขบัตรประชาชนเพื่อเชื่อมโยงข้อมูลได้
            - text: กรอกชื่อและนามสกุลให้ตรงกับข้อมูลของคุณ กำหนดชื่อผู้ใช้และรหัสผ่านสำหรับเข้าใช้งานครั้งถัดไป ข้อมูลได้รับการปกป้องและเข้าถึงได้เฉพาะบัญชีของคุณ
        - heading "สมัครสมาชิกผู้รับบริการ" [level=1]
        - paragraph: กรอกข้อมูลส่วนตัวและสร้างข้อมูลเข้าสู่ระบบ
        - alert: รหัสผ่านยังไม่ตรงตามเงื่อนไขทุกข้อ
        - form "สมัครสมาชิกผู้รับบริการ":
            - group "ข้อมูลบัญชี":
                - text: ข้อมูลบัญชี
                - paragraph: สร้างข้อมูลสำหรับใช้เข้าสู่ระบบในครั้งถัดไป
                - text: ชื่อผู้ใช้
                - textbox "ชื่อผู้ใช้":
                    - /placeholder: ตั้งชื่อผู้ใช้สำหรับเข้าสู่ระบบ
                    - text: patient
                - text: อีเมล
                - textbox "อีเมล":
                    - /placeholder: name@example.com
                    - text: somchay@example.test
                - text: ระบบจะส่งรหัสยืนยันไปยังอีเมลนี้ รหัสผ่าน
                - textbox "รหัสผ่าน":
                    - /placeholder: อย่างน้อย 8 ตัวอักษร
                    - text: password123
                - button "แสดงรหัสผ่าน":
                    - img
                - list:
                    - listitem: ความยาว 8-16 ตัวอักษร (ผ่าน)
                    - listitem: ตัวอักษรภาษาอังกฤษตัวใหญ่ (A-Z) อย่างน้อย 1 ตัว (ยังไม่ผ่าน)
                    - listitem: ตัวอักษรภาษาอังกฤษตัวเล็ก (a-z) อย่างน้อย 1 ตัว (ผ่าน)
                    - listitem: ตัวเลข (0-9) อย่างน้อย 1 ตัว (ผ่าน)
                    - listitem: "สัญลักษณ์ เช่น ! @ # $ % อย่างน้อย 1 ตัว (ยังไม่ผ่าน)"
                - text: ยืนยันรหัสผ่าน
                - textbox "ยืนยันรหัสผ่าน":
                    - /placeholder: กรอกรหัสผ่านอีกครั้ง
                    - text: password123
                - button "แสดงรหัสผ่าน":
                    - img
            - group "ข้อมูลส่วนตัว":
                - text: ข้อมูลส่วนตัว
                - paragraph: ชื่อและนามสกุลใช้ระบุเจ้าของผลประเมิน ส่วนเลขบัตรใช้เชื่อมประวัติเดิมเท่านั้น
                - text: ชื่อ
                - textbox "ชื่อ":
                    - /placeholder: กรอกชื่อจริง
                    - text: สมชาย
                - text: นามสกุล
                - textbox "นามสกุล":
                    - /placeholder: กรอกนามสกุล
                    - text: ใจดี
                - text: เลขบัตรประชาชน 13 หลัก
                - textbox "เลขบัตรประชาชน 13 หลัก":
                    - /placeholder: กรอกตัวเลข 13 หลัก
                    - text: "1101700203456"
                - text: เบอร์โทรศัพท์ไม่บังคับ
                - textbox "เบอร์โทรศัพท์ไม่บังคับ":
                    - /placeholder: กรอกเบอร์โทรศัพท์
            - button "สมัครสมาชิก"
        - text: มีบัญชีแล้ว?
        - link "เข้าสู่ระบบเพื่อดูประวัติ":
            - /url: /account/login?returnTo=%2Fhistory
```

# Test source

```ts
  147 | test("homepage navbar shows the signed-in patient and can log out", async ({
  148 |   page,
  149 |   isMobile,
  150 | }) => {
  151 |   await page.addInitScript(() => {
  152 |     document.cookie="suth_patient_session=synthetic-session; path=/";
  153 |     sessionStorage.setItem(
  154 |       "patient_user",
  155 |       JSON.stringify({
  156 |         id: 1,
  157 |         username: "patient",
  158 |         first_name: "สมชาย",
  159 |         last_name: "ใจดี",
  160 |         status: "active",
  161 |       }),
  162 |     );
  163 |   });
  164 |   await page.route("**/api/patient/me", (route) =>
  165 |     route.fulfill({
  166 |       json: {
  167 |         success: true,
  168 |         user: {
  169 |           id: 1,
  170 |           username: "patient",
  171 |           first_name: "สมชาย",
  172 |           last_name: "ใจดี",
  173 |           status: "active",
  174 |         },
  175 |       },
  176 |     }),
  177 |   );
  178 |   await page.route("**/api/patient-auth/logout", (route) =>
  179 |     route.fulfill({ json: { success: true } }),
  180 |   );
  181 |
  182 |   await page.goto("/");
  183 |   if (isMobile) await page.getByRole("button", { name: "เปิดเมนู" }).click();
  184 |   await page.getByRole("button", { name: /สมชาย ใจดี/ }).click();
  185 |
  186 |   const accountDropdown = page.locator(".patient-account-dropdown");
  187 |   await expect(accountDropdown).toBeVisible();
  188 |   await expect(page.locator(".patient-account-summary")).toHaveCount(0);
  189 |   const dropdownBox = await accountDropdown.boundingBox();
  190 |   const viewport = page.viewportSize();
  191 |   expect(dropdownBox).not.toBeNull();
  192 |   expect(dropdownBox.x).toBeGreaterThanOrEqual(0);
  193 |   expect(dropdownBox.x + dropdownBox.width).toBeLessThanOrEqual(viewport.width);
  194 |
  195 |   await page.getByRole("menuitem", { name: "ออกจากระบบ" }).click();
  196 |
  197 |   await expect(page).toHaveURL(/\/$/);
  198 |   if (isMobile) await page.getByRole("button", { name: "เปิดเมนู" }).click();
  199 |   await expect(page.locator(".patient-account-login")).toHaveText(
  200 |     "เข้าสู่ระบบ",
  201 |   );
  202 |   expect(
  203 |     await page.evaluate(() => sessionStorage.getItem("patient_token")),
  204 |   ).toBeNull();
  205 | });
  206 |
  207 | test("register creates a patient account and activates it with the email code", async ({
  208 |   page,
  209 | }) => {
  210 |   let registerPayload = null;
  211 |   let verifyPayload = null;
  212 |   await page.route("**/api/patient-auth/register", (route) => {
  213 |     registerPayload = route.request().postDataJSON();
  214 |     return route.fulfill({
  215 |       status: 201,
  216 |       json: {
  217 |         success: true,
  218 |         requiresEmailVerification: true,
  219 |         challengeToken: "7.e2e-challenge-token-0123456789abcdef0123456789",
  220 |         maskedEmail: "s****y@example.test",
  221 |         expiresAt: new Date(Date.now() + 300_000).toISOString(),
  222 |         resendAfter: new Date(Date.now() + 60_000).toISOString(),
  223 |       },
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
> 247 |   await expect(page.getByLabel("รหัสยืนยัน")).toBeVisible();
      |                                               ^ Error: expect(locator).toBeVisible() failed
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
  259 |   ).toBeNull();
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
  324 |   expect(receivedAuthorization).toBe("");
  325 | });
  326 |
```

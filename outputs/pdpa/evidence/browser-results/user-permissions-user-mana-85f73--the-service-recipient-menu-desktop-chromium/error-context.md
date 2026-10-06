# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: user-permissions.spec.js >> user management data integrity >> edits patient details and resets the password from the service-recipient menu
- Location: e2e\user-permissions.spec.js:204:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'แก้ไขข้อมูล สมชาย ใจดี' })

```

# Page snapshot

```yaml
- main [ref=e3]:
    - generic [ref=e4]:
        - link "กลับหน้าแรก" [ref=e5] [cursor=pointer]:
            - /url: /
        - group "เปลี่ยนภาษา" [ref=e9]:
            - button "ไทย" [pressed] [ref=e10] [cursor=pointer]
            - button "EN" [ref=e11] [cursor=pointer]
    - region "เข้าสู่ระบบเจ้าหน้าที่" [ref=e12]:
        - complementary [ref=e13]:
            - img "SUTH" [ref=e14]
            - generic [ref=e15]:
                - paragraph [ref=e16]: ระบบปฏิบัติงานสำหรับเจ้าหน้าที่
                - heading "ดูแลข้อมูลและติดตามบริการได้อย่างมั่นใจ" [level=2] [ref=e17]
                - paragraph [ref=e18]: จัดการเคส แบบประเมิน นัดหมาย และสมาชิกผู้รับบริการ ตามสิทธิ์ที่ได้รับจากผู้ดูแลระบบ
            - generic "เข้าสู่ระบบเจ้าหน้าที่" [ref=e19]:
                - generic [ref=e20]: ภาพรวมข้อมูลและงานติดตามในที่เดียว
                - generic [ref=e27]: จัดการเจ้าหน้าที่และดูรายชื่อสมาชิกตามสิทธิ์
                - generic [ref=e34]: ควบคุมการเข้าถึงด้วย Role และ Permission
        - generic [ref=e38]:
            - tablist "เลือกประเภทผู้ใช้งาน" [ref=e39]:
                - tab "ผู้มารับบริการ" [ref=e40] [cursor=pointer]
                - tab "เจ้าหน้าที่" [selected] [ref=e41] [cursor=pointer]
            - generic [ref=e47]:
                - heading "เข้าสู่ระบบเจ้าหน้าที่" [level=1] [ref=e48]
                - paragraph [ref=e49]: ใช้บัญชีเจ้าหน้าที่ที่ได้รับอนุญาตจากผู้ดูแลระบบ
            - form "เข้าสู่ระบบเจ้าหน้าที่" [ref=e50]:
                - generic [ref=e51]:
                    - generic [ref=e52]: ชื่อผู้ใช้งาน
                    - textbox "ชื่อผู้ใช้งาน" [ref=e53]:
                        - /placeholder: กรอกชื่อผู้ใช้งาน
                - generic [ref=e54]:
                    - generic [ref=e55]: รหัสผ่าน
                    - generic [ref=e56]:
                        - textbox "รหัสผ่าน" [ref=e57]:
                            - /placeholder: กรอกรหัสผ่าน
                        - button "แสดงรหัสผ่าน" [ref=e58] [cursor=pointer]
                - button "ลืมรหัสผ่าน?" [ref=e63] [cursor=pointer]
                - generic "การยืนยันความปลอดภัย"
                - button "เข้าสู่ระบบ" [ref=e64] [cursor=pointer]
            - paragraph [ref=e65]: หากไม่สามารถเข้าสู่ระบบได้ กรุณาติดต่อผู้ดูแลระบบของหน่วยงาน
```

# Test source

```ts
  111 | test.describe("user management data integrity", () => {
  112 |   test.beforeEach(async ({ page }) => {
  113 |     await page.addInitScript(() => {
  114 |       document.cookie="suth_staff_session=synthetic-session; path=/";
  115 |       sessionStorage.setItem(
  116 |         "suth_user",
  117 |         JSON.stringify({ id: 1, username: "e2e-admin", role_id: 1 }),
  118 |       );
  119 |     });
  120 |   });
  121 |
  122 |   test("saves a long Thai full name without truncating it", async ({
  123 |     page,
  124 |   }) => {
  125 |     const received = {};
  126 |     const fullName = `นางสาว ${"ก".repeat(220)} นามสกุลทดสอบ`;
  127 |     await mockUserApi(page, received);
  128 |     await page.goto("/admin/users");
  129 |
  130 |     await page.getByRole("button", { name: "เพิ่มผู้ใช้งาน" }).click();
  131 |     await page.getByPlaceholder("เช่น admin_01").fill("long-thai-name");
  132 |     await page.getByPlaceholder("ตั้งรหัสผ่าน").fill("password-123");
  133 |     await page.getByPlaceholder("กรอกชื่อ-นามสกุล").fill(fullName);
  134 |     await page
  135 |       .getByPlaceholder("example@mail.com")
  136 |       .fill("long.name@example.test");
  137 |     await page.getByRole("button", { name: "บันทึกข้อมูล" }).click();
  138 |
  139 |     await expect.poll(() => received.created?.name).toBe(fullName);
  140 |     expect(received.created.role_id).toBe(2);
  141 |   });
  142 |
  143 |   test("loads the unmasked record before editing a user", async ({ page }) => {
  144 |     const received = {};
  145 |     await mockUserApi(page, received);
  146 |     await page.goto("/admin/users");
  147 |
  148 |     await page.locator("button.sum-edit").click();
  149 |     await expect(page.getByPlaceholder("กรอกชื่อ-นามสกุล")).toHaveValue(
  150 |       "นาย เจ้าหน้าที่ ชื่อจริงที่ไม่ถูกปกปิด",
  151 |     );
  152 |     expect(received.fullRecordRequested).toBe(true);
  153 |   });
  154 |
  155 |   test("shows patient members without exposing sensitive identity fields", async ({
  156 |     page,
  157 |   }) => {
  158 |     const received = {};
  159 |     await mockUserApi(page, received);
  160 |     await page.goto("/admin/members");
  161 |
  162 |     await expect(
  163 |       page.getByRole("heading", { name: "ผู้มารับบริการ" }),
  164 |     ).toBeVisible();
  165 |     await expect(page.getByText("patient-member")).toBeVisible();
  166 |     await expect(page.getByText("สมชาย ใจดี", { exact: true })).toBeVisible();
  167 |     await expect(
  168 |       page.getByRole("table").getByText("ใช้งานปกติ", { exact: true }),
  169 |     ).toBeVisible();
  170 |     await expect(
  171 |       page.getByText(/identity_hash|เลขบัตรประชาชน|phone_encrypted/),
  172 |     ).toHaveCount(0);
  173 |     await expect.poll(() => received.memberListLimit).toBe("10");
  174 |   });
  175 |
  176 |   test("user management page provides its own vertical scroll area", async ({
  177 |     page,
  178 |     isMobile,
  179 |   }) => {
  180 |     const received = {};
  181 |     await page.setViewportSize({ width: isMobile ? 390 : 1280, height: 320 });
  182 |     await mockUserApi(page, received);
  183 |     await page.goto("/admin/users");
  184 |
  185 |     const pageScroller = page.locator(".sum-user-wrapper");
  186 |     await expect(pageScroller).toBeVisible();
  187 |     await expect
  188 |       .poll(() =>
  189 |         pageScroller.evaluate((element) => ({
  190 |           canScroll: element.scrollHeight > element.clientHeight,
  191 |           overflowY: getComputedStyle(element).overflowY,
  192 |         })),
  193 |       )
  194 |       .toEqual({ canScroll: true, overflowY: "auto" });
  195 |
  196 |     await pageScroller.evaluate((element) =>
  197 |       element.scrollTo(0, element.scrollHeight),
  198 |     );
  199 |     await expect
  200 |       .poll(() => pageScroller.evaluate((element) => element.scrollTop))
  201 |       .toBeGreaterThan(0);
  202 |   });
  203 |
  204 |   test("edits patient details and resets the password from the service-recipient menu", async ({
  205 |     page,
  206 |   }) => {
  207 |     const received = {};
  208 |     await mockUserApi(page, received);
  209 |     await page.goto("/admin/members");
  210 |
> 211 |     await page.getByRole("button", { name: "แก้ไขข้อมูล สมชาย ใจดี" }).click();
      |                                                                        ^ Error: locator.click: Test timeout of 30000ms exceeded.
  212 |     await expect(
  213 |       page.getByRole("heading", { name: "แก้ไขข้อมูลผู้มารับบริการ" }),
  214 |     ).toBeVisible();
  215 |     const phoneInput = page.locator(
  216 |       '.sum-member-modal input[autocomplete="tel"]',
  217 |     );
  218 |     await expect(phoneInput).toHaveValue("0812345678");
  219 |     await phoneInput.fill("089-876-5432");
  220 |     await expect(phoneInput).toHaveValue("0898765432");
  221 |     await page.getByLabel("ชื่อ", { exact: true }).fill("สมหญิง");
  222 |     await page.getByLabel(/รหัสผ่านใหม่/).fill("new-password-123");
  223 |     await page.getByRole("button", { name: "บันทึกการเปลี่ยนแปลง" }).click();
  224 |
  225 |     await expect.poll(() => received.memberUpdated?.first_name).toBe("สมหญิง");
  226 |     expect(received.memberUpdated.phone).toBe("0898765432");
  227 |     expect(received.memberUpdated.password).toBe("new-password-123");
  228 |     expect(received.memberFullRequested).toBe(true);
  229 |   });
  230 |
  231 |   test("deletes a patient login only after explicit confirmation", async ({
  232 |     page,
  233 |   }) => {
  234 |     const received = {};
  235 |     await mockUserApi(page, received);
  236 |     await page.goto("/admin/members");
  237 |
  238 |     await page.getByRole("button", { name: "ลบบัญชี สมชาย ใจดี" }).click();
  239 |     await expect(
  240 |       page.getByRole("heading", { name: "ลบบัญชีผู้มารับบริการ?" }),
  241 |     ).toBeVisible();
  242 |     await page.getByRole("button", { name: "ลบบัญชีถาวร" }).click();
  243 |
  244 |     await expect.poll(() => received.memberDeleted).toBe(true);
  245 |   });
  246 | });
  247 |
```

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: user-permissions.spec.js >> user management data integrity >> deletes a patient login only after explicit confirmation
- Location: e2e\user-permissions.spec.js:231:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'ลบบัญชี สมชาย ใจดี' })

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
  138 |       .fill("long.name@example.test");
  139 |     await page.getByRole("button", { name: "บันทึกข้อมูล" }).click();
  140 |
  141 |     await expect.poll(() => received.created?.name).toBe(fullName);
  142 |     expect(received.created.role_id).toBe(2);
  143 |   });
  144 |
  145 |   test("loads the unmasked record before editing a user", async ({ page }) => {
  146 |     const received = {};
  147 |     await mockUserApi(page, received);
  148 |     await page.goto("/admin/users");
  149 |
  150 |     await page.locator("button.sum-edit").click();
  151 |     await expect(page.getByPlaceholder("กรอกชื่อ-นามสกุล")).toHaveValue(
  152 |       "นาย เจ้าหน้าที่ ชื่อจริงที่ไม่ถูกปกปิด",
  153 |     );
  154 |     expect(received.fullRecordRequested).toBe(true);
  155 |   });
  156 |
  157 |   test("shows patient members without exposing sensitive identity fields", async ({
  158 |     page,
  159 |   }) => {
  160 |     const received = {};
  161 |     await mockUserApi(page, received);
  162 |     await page.goto("/admin/members");
  163 |
  164 |     await expect(
  165 |       page.getByRole("heading", { name: "ผู้มารับบริการ" }),
  166 |     ).toBeVisible();
  167 |     await expect(page.getByText("patient-member")).toBeVisible();
  168 |     await expect(page.getByText("สมชาย ใจดี", { exact: true })).toBeVisible();
  169 |     await expect(
  170 |       page.getByRole("table").getByText("ใช้งานปกติ", { exact: true }),
  171 |     ).toBeVisible();
  172 |     await expect(
  173 |       page.getByText(/identity_hash|เลขบัตรประชาชน|phone_encrypted/),
  174 |     ).toHaveCount(0);
  175 |     await expect.poll(() => received.memberListLimit).toBe("10");
  176 |   });
  177 |
  178 |   test("user management page provides its own vertical scroll area", async ({
  179 |     page,
  180 |     isMobile,
  181 |   }) => {
  182 |     const received = {};
  183 |     await page.setViewportSize({ width: isMobile ? 390 : 1280, height: 320 });
  184 |     await mockUserApi(page, received);
  185 |     await page.goto("/admin/users");
  186 |
  187 |     const pageScroller = page.locator(".sum-user-wrapper");
  188 |     await expect(pageScroller).toBeVisible();
  189 |     await expect
  190 |       .poll(() =>
  191 |         pageScroller.evaluate((element) => ({
  192 |           canScroll: element.scrollHeight > element.clientHeight,
  193 |           overflowY: getComputedStyle(element).overflowY,
  194 |         })),
  195 |       )
  196 |       .toEqual({ canScroll: true, overflowY: "auto" });
  197 |
  198 |     await pageScroller.evaluate((element) =>
  199 |       element.scrollTo(0, element.scrollHeight),
  200 |     );
  201 |     await expect
  202 |       .poll(() => pageScroller.evaluate((element) => element.scrollTop))
  203 |       .toBeGreaterThan(0);
  204 |   });
  205 |
  206 |   test("edits patient details and resets the password from the service-recipient menu", async ({
  207 |     page,
  208 |   }) => {
  209 |     const received = {};
  210 |     await mockUserApi(page, received);
  211 |     await page.goto("/admin/members");
  212 |
  213 |     await page.getByRole("button", { name: "แก้ไขข้อมูล สมชาย ใจดี" }).click();
  214 |     await expect(
  215 |       page.getByRole("heading", { name: "แก้ไขข้อมูลผู้มารับบริการ" }),
  216 |     ).toBeVisible();
  217 |     const phoneInput = page.locator(
  218 |       '.sum-member-modal input[autocomplete="tel"]',
  219 |     );
  220 |     await expect(phoneInput).toHaveValue("0812345678");
  221 |     await phoneInput.fill("089-876-5432");
  222 |     await expect(phoneInput).toHaveValue("0898765432");
  223 |     await page.getByLabel("ชื่อ", { exact: true }).fill("สมหญิง");
  224 |     await page.getByLabel(/รหัสผ่านใหม่/).fill("new-password-123");
  225 |     await page.getByRole("button", { name: "บันทึกการเปลี่ยนแปลง" }).click();
  226 |
  227 |     await expect.poll(() => received.memberUpdated?.first_name).toBe("สมหญิง");
  228 |     expect(received.memberUpdated.phone).toBe("0898765432");
  229 |     expect(received.memberUpdated.password).toBe("new-password-123");
  230 |     expect(received.memberFullRequested).toBe(true);
  231 |   });
  232 |
  233 |   test("deletes a patient login only after explicit confirmation", async ({
  234 |     page,
  235 |   }) => {
  236 |     const received = {};
  237 |     await mockUserApi(page, received);
> 238 |     await page.goto("/admin/members");
      |                                                                    ^ Error: locator.click: Test timeout of 30000ms exceeded.
  239 |
  240 |     await page.getByRole("button", { name: "ลบบัญชี สมชาย ใจดี" }).click();
  241 |     await expect(
  242 |       page.getByRole("heading", { name: "ลบบัญชีผู้มารับบริการ?" }),
  243 |     ).toBeVisible();
  244 |     await page.getByRole("button", { name: "ลบบัญชีถาวร" }).click();
  245 |
  246 |     await expect.poll(() => received.memberDeleted).toBe(true);
  247 |   });
  248 | });
  249 |
```

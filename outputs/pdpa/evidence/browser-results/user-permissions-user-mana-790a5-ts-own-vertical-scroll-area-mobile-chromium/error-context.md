# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: user-permissions.spec.js >> user management data integrity >> user management page provides its own vertical scroll area
- Location: e2e\user-permissions.spec.js:176:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.sum-user-wrapper')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('.sum-user-wrapper')

```

```yaml
- main:
    - link "กลับหน้าแรก":
        - /url: /
    - group "เปลี่ยนภาษา":
        - button "ไทย" [pressed]
        - button "EN"
    - region "เข้าสู่ระบบเจ้าหน้าที่":
        - complementary:
            - img "SUTH"
            - paragraph: ระบบปฏิบัติงานสำหรับเจ้าหน้าที่
            - heading "ดูแลข้อมูลและติดตามบริการได้อย่างมั่นใจ" [level=2]
        - tablist "เลือกประเภทผู้ใช้งาน":
            - tab "ผู้มารับบริการ"
            - tab "เจ้าหน้าที่" [selected]
        - heading "เข้าสู่ระบบเจ้าหน้าที่" [level=1]
        - paragraph: ใช้บัญชีเจ้าหน้าที่ที่ได้รับอนุญาตจากผู้ดูแลระบบ
        - form "เข้าสู่ระบบเจ้าหน้าที่":
            - text: ชื่อผู้ใช้งาน
            - textbox "ชื่อผู้ใช้งาน":
                - /placeholder: กรอกชื่อผู้ใช้งาน
            - text: รหัสผ่าน
            - textbox "รหัสผ่าน":
                - /placeholder: กรอกรหัสผ่าน
            - button "แสดงรหัสผ่าน":
                - img
            - button "ลืมรหัสผ่าน?"
            - button "เข้าสู่ระบบ"
        - paragraph: หากไม่สามารถเข้าสู่ระบบได้ กรุณาติดต่อผู้ดูแลระบบของหน่วยงาน
```

# Test source

```ts
  86  |           status: "active",
  87  |         },
  88  |       });
  89  |     }
  90  |     if (
  91  |       pathname.endsWith("/api/patient-members/15") &&
  92  |       request.method() === "PUT"
  93  |     ) {
  94  |       received.memberUpdated = request.postDataJSON();
  95  |       return route.fulfill({
  96  |         json: { message: "บันทึกข้อมูลผู้มารับบริการเรียบร้อยแล้ว" },
  97  |       });
  98  |     }
  99  |     if (
  100 |       pathname.endsWith("/api/patient-members/15") &&
  101 |       request.method() === "DELETE"
  102 |     ) {
  103 |       received.memberDeleted = true;
  104 |       return route.fulfill({
  105 |         json: { message: "ลบบัญชีผู้มารับบริการเรียบร้อยแล้ว" },
  106 |       });
  107 |     }
  108 |     if (pathname.includes("/permissions")) return route.fulfill({ json: [] });
  109 |     return route.fulfill({ json: [] });
  110 |   });
  111 | }
  112 |
  113 | test.describe("user management data integrity", () => {
  114 |   test.beforeEach(async ({ page }) => {
  115 |     await page.addInitScript(() => {
  116 |       document.cookie="suth_staff_session=synthetic-session; path=/";
  117 |       sessionStorage.setItem(
  118 |         "suth_user",
  119 |         JSON.stringify({ id: 1, username: "e2e-admin", role_id: 1 }),
  120 |       );
  121 |     });
  122 |   });
  123 |
  124 |   test("saves a long Thai full name without truncating it", async ({
  125 |     page,
  126 |   }) => {
  127 |     const received = {};
  128 |     const fullName = `นางสาว ${"ก".repeat(220)} นามสกุลทดสอบ`;
  129 |     await mockUserApi(page, received);
  130 |     await page.goto("/admin/users");
  131 |
  132 |     await page.getByRole("button", { name: "เพิ่มผู้ใช้งาน" }).click();
  133 |     await page.getByPlaceholder("เช่น admin_01").fill("long-thai-name");
  134 |     await page.getByPlaceholder("ตั้งรหัสผ่าน").fill("password-123");
  135 |     await page.getByPlaceholder("กรอกชื่อ-นามสกุล").fill(fullName);
  136 |     await page
  137 |       .getByPlaceholder("example@mail.com")
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
> 186 |
      |                                ^ Error: expect(locator).toBeVisible() failed
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
  238 |     await page.goto("/admin/members");
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

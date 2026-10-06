# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: school-management.spec.js >> school organization >> imports a CSV after a dry run and offers the credentials file
- Location: e2e\school-management.spec.js:326:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.setInputFiles: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('input[type="file"]')

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
  232 |                   errors: ["ไม่มีรหัสนักเรียน"],
  233 |                 },
  234 |           ),
  235 |         },
  236 |       });
  237 |     }
  238 |     if (pathname.endsWith("/api/forms")) return route.fulfill({ json: [] });
  239 |     return route.fulfill({ json: {} });
  240 |   });
  241 | }
  242 |
  243 | test.describe("school organization", () => {
  244 |   test.beforeEach(async ({}, testInfo) => {
  245 |     test.skip(testInfo.project.name === "mobile-chromium");
  246 |   });
  247 |
  248 |   test("shows school menus instead of hospital-only menus", async ({
  249 |     page,
  250 |   }) => {
  251 |     await openAsSchoolAdmin(page);
  252 |     await page.goto("/admin/school/students");
  253 |     const nav = page.locator("aside.sidebar");
  254 |     await expect(
  255 |       nav.getByRole("link", { name: "นักเรียน", exact: true }),
  256 |     ).toBeVisible();
  257 |     await expect(
  258 |       nav.getByRole("link", { name: "ครู", exact: true }),
  259 |     ).toBeVisible();
  260 |     await expect(nav.getByRole("link", { name: "จัดการคลินิก" })).toHaveCount(
  261 |       0,
  262 |     );
  263 |     await expect(nav.getByRole("link", { name: "ตารางนัดหมาย" })).toHaveCount(
  264 |       0,
  265 |     );
  266 |   });
  267 |
  268 |   test("the structure page is the sub-unit's school: grades and their rooms only", async ({
  269 |     page,
  270 |   }) => {
  271 |     const received = {};
  272 |     await openAsSchoolAdmin(page, received);
  273 |     await page.goto("/admin/school");
  274 |     await expect(
  275 |       page.getByRole("heading", { name: "ชั้นปีและห้องเรียน" }),
  276 |     ).toBeVisible();
  277 |     await expect(
  278 |       page.getByText(/โรงเรียนทดสอบ · รหัสโรงเรียน TST01/),
  279 |     ).toBeVisible();
  280 |     await expect(
  281 |       page.getByRole("button", { name: /เพิ่มโรงเรียน/ }),
  282 |     ).toHaveCount(0);
  283 |     const grade = page.getByRole("region", { name: "ม.1" });
  284 |     await expect(grade.getByText("ห้อง 1/1")).toBeVisible();
  285 |     await grade.getByRole("button", { name: "เพิ่มห้อง" }).click();
  286 |     await expect
  287 |       .poll(() => received.classroom)
  288 |       .toEqual({
  289 |         grade_level_id: 5,
  290 |         academic_year: String(
  291 |           new Date().getFullYear() + 543 - (new Date().getMonth() < 4 ? 1 : 0),
  292 |         ),
  293 |       });
  294 |   });
  295 |
  296 |   test("student list opens the student health file", async ({ page }) => {
  297 |     await openAsSchoolAdmin(page);
  298 |     await page.goto("/admin/school/students");
  299 |     await expect(
  300 |       page.getByRole("heading", { name: "รายชื่อนักเรียน" }),
  301 |     ).toBeVisible();
  302 |     await page
  303 |       .getByRole("button", { name: "ดูข้อมูล ด.ช. สมชาย ใจดี" })
  304 |       .click();
  305 |     const dialog = page.getByRole("dialog", { name: "ด.ช. สมชาย ใจดี" });
  306 |     await expect(dialog).toBeVisible();
  307 |     await dialog.getByRole("tab", { name: "สุขภาพกาย" }).click();
  308 |     await expect(dialog.getByText("แพ้กุ้ง")).toBeVisible();
  309 |     await dialog.getByRole("tab", { name: "สุขภาพจิต" }).click();
  310 |     await expect(dialog.getByText("เครียดสูง").first()).toBeVisible();
  311 |     await page.keyboard.press("Escape");
  312 |     await expect(dialog).toHaveCount(0);
  313 |   });
  314 |
  315 |   test("the case list of a school organization is the student health view", async ({
  316 |     page,
  317 |   }) => {
  318 |     await openAsSchoolAdmin(page);
  319 |     await page.goto("/admin/cases");
  320 |     await expect(
  321 |       page.getByRole("heading", { name: "ข้อมูลสุขภาพนักเรียน" }),
  322 |     ).toBeVisible();
  323 |     await expect(page.getByText("เครียดสูง")).toBeVisible();
  324 |   });
  325 |
  326 |   test("imports a CSV after a dry run and offers the credentials file", async ({
  327 |     page,
  328 |   }) => {
  329 |     const received = {};
  330 |     await openAsSchoolAdmin(page, received);
  331 |     await page.goto("/admin/school/students/import");
> 332 |     await page.locator('input[type="file"]').setInputFiles({
      |     ^ Error: locator.setInputFiles: Test timeout of 30000ms exceeded.
  333 |       name: "students.csv",
  334 |       mimeType: "text/csv",
  335 |       buffer: Buffer.from(
  336 |         "﻿รหัสนักเรียน,ชื่อ,นามสกุล,ชั้นปี,ห้อง\n69010,มานี,มีนา,ม.1,1/1\n,ไม่มี,รหัส,ม.1,1/1\n",
  337 |         "utf8",
  338 |       ),
  339 |     });
  340 |     await expect(page.getByText(/พบนักเรียน\s*2\s*แถว/)).toBeVisible();
  341 |     await page.getByRole("button", { name: "ตรวจสอบข้อมูล" }).click();
  342 |     await expect(page.getByText("ผลการตรวจสอบ (ยังไม่บันทึก)")).toBeVisible();
  343 |     await expect(page.getByText("ไม่มีรหัสนักเรียน")).toBeVisible();
  344 |     expect(received.imports[0].dry_run).toBe(true);
  345 |
  346 |     await page.getByRole("button", { name: /นำเข้า 1 คน/ }).click();
  347 |     await expect(page.getByText("ผลการนำเข้า")).toBeVisible();
  348 |     expect(received.imports[1].dry_run).toBe(false);
  349 |     await expect(page.getByText("Temp#Pass2569")).toBeVisible();
  350 |     const download = page.waitForEvent("download");
  351 |     await page.getByRole("button", { name: /ดาวน์โหลดบัญชีนักเรียน/ }).click();
  352 |     expect((await download).suggestedFilename()).toMatch(/^บัญชีนักเรียน-/);
  353 |   });
  354 | });
  355 |
  356 | test("a guest must accept PDPA before the national ID is sent", async ({
  357 |   page,
  358 | }, testInfo) => {
  359 |   test.skip(testInfo.project.name === "mobile-chromium");
  360 |   let payload;
  361 |   await page.addInitScript(() => localStorage.setItem("i18nextLng", "th"));
  362 |   await page.route("**/api/**", (route) => route.fulfill({ json: {} }));
  363 |   await page.route("**/api/forms/88", (route) =>
  364 |     route.fulfill({
  365 |       json: {
  366 |         id: 88,
  367 |         title: "แบบประเมินที่ใช้เลขบัตร",
  368 |         theme: {},
  369 |         login_enforcement: "none",
  370 |         questions: [
  371 |           { id: "nid", type: "national_id", title: "เลขบัตรประชาชน" },
  372 |           { id: "q1", type: "short_text", title: "ชื่อเล่น" },
  373 |         ],
  374 |       },
  375 |     }),
  376 |   );
  377 |   await page.route("**/api/forms/88/submit", (route) => {
  378 |     payload = route.request().postDataJSON();
  379 |     return route.fulfill({ status: 201, json: { responseId: 1 } });
  380 |   });
  381 |
  382 |   await page.goto("/assessment/88");
  383 |   await page.getByPlaceholder("0-0000-00000-00-0").fill("1101700230708");
  384 |   await expect(
  385 |     page.getByText("นโยบายคุ้มครองข้อมูลส่วนบุคคล (PDPA)"),
  386 |   ).toBeVisible();
  387 |   await page.getByRole("button", { name: "ส่งคำตอบ" }).click();
  388 |   // Without acknowledging PDPA the form does not submit.
  389 |   await expect(
  390 |     page.getByText("กรุณากดรับทราบในการเก็บข้อมูล (ด้านล่างฟอร์ม)"),
  391 |   ).toBeVisible();
  392 |   await page.getByText("รับทราบ", { exact: true }).click();
  393 |   await page.getByRole("button", { name: "ส่งคำตอบ" }).click();
  394 |   await page.getByRole("button", { name: "ยินยอม" }).click();
  395 |   await expect.poll(() => payload?.consent_given).toBe(true);
  396 |   expect(payload.identityValue).toBe("1101700230708");
  397 |   expect(payload.summaryData.raw_answers["เลขบัตรประชาชน"]).not.toContain(
  398 |     "0023",
  399 |   );
  400 | });
  401 |
```

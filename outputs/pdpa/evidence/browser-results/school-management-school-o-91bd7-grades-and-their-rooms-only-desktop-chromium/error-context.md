# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: school-management.spec.js >> school organization >> the structure page is the sub-unit's school: grades and their rooms only
- Location: e2e\school-management.spec.js:268:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'ชั้นปีและห้องเรียน' })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByRole('heading', { name: 'ชั้นปีและห้องเรียน' })

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
            - paragraph: จัดการเคส แบบประเมิน นัดหมาย และสมาชิกผู้รับบริการ ตามสิทธิ์ที่ได้รับจากผู้ดูแลระบบ
            - text: ภาพรวมข้อมูลและงานติดตามในที่เดียว จัดการเจ้าหน้าที่และดูรายชื่อสมาชิกตามสิทธิ์ ควบคุมการเข้าถึงด้วย Role และ Permission
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
  176 |     if (pathname.endsWith("/api/school/students"))
  177 |       return route.fulfill({
  178 |         json: {
  179 |           data: [STUDENT],
  180 |           pagination: { page: 1, limit: 20, total: 1, total_pages: 1 },
  181 |         },
  182 |       });
  183 |     if (pathname.endsWith("/api/school/students/1/health"))
  184 |       return route.fulfill({ json: HEALTH });
  185 |     if (pathname.endsWith("/api/school/cases"))
  186 |       return route.fulfill({
  187 |         json: {
  188 |           data: [
  189 |             {
  190 |               ...STUDENT,
  191 |               mental: {
  192 |                 risk: "high",
  193 |                 label: "เครียดสูง",
  194 |                 form_title: "แบบคัดกรองความเครียดนักเรียน",
  195 |                 submitted_at: "2026-10-01T03:00:00.000Z",
  196 |               },
  197 |               physical: null,
  198 |               latest_vitals: { bmi: 20 },
  199 |               overall_risk: "high",
  200 |             },
  201 |           ],
  202 |           pagination: { page: 1, limit: 20, total: 1, total_pages: 1 },
  203 |           counts: { high: 1, medium: 0, normal: 0, none: 0 },
  204 |           classrooms: [],
  205 |         },
  206 |       });
  207 |     if (pathname.endsWith("/api/school/students/import") && method === "POST") {
  208 |       const body = request.postDataJSON();
  209 |       (received.imports ||= []).push(body);
  210 |       return route.fulfill({
  211 |         json: {
  212 |           dry_run: body.dry_run,
  213 |           summary: {},
  214 |           results: body.rows.map((row, index) =>
  215 |             row.student_code
  216 |               ? {
  217 |                   row: body.row_offset + index + 1,
  218 |                   student_code: row.student_code,
  219 |                   name: `${row.first_name} ${row.last_name}`,
  220 |                   grade: row.grade,
  221 |                   classroom: row.classroom,
  222 |                   username: `tst01${row.student_code}`,
  223 |                   status: body.dry_run ? "will_create" : "created",
  224 |                   errors: [],
  225 |                   ...(body.dry_run ? {} : { password: "Temp#Pass2569" }),
  226 |                 }
  227 |               : {
  228 |                   row: body.row_offset + index + 1,
  229 |                   student_code: "",
  230 |                   name: "",
  231 |                   status: "error",
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
> 276 |     ).toBeVisible();
      |       ^ Error: expect(locator).toBeVisible() failed
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
  332 |     await page.locator('input[type="file"]').setInputFiles({
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
```

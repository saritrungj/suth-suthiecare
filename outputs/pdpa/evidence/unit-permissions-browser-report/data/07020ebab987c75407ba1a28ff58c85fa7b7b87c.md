# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: school-management.spec.js >> school organization >> shows school menus instead of hospital-only menus
- Location: e2e\school-management.spec.js:250:3

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('aside.sidebar').getByRole('link', { name: 'จัดการคลินิก' })
Expected: 0
Received: 1
Timeout:  10000ms

Call log:
  - Expect "toHaveCount" with timeout 10000ms
  - waiting for locator('aside.sidebar').getByRole('link', { name: 'จัดการคลินิก' })
    23 × locator resolved to 1 element
       - unexpected value "1"

```

# Page snapshot

```yaml
- generic [ref=e3]:
    - complementary [ref=e4]:
        - generic [ref=e5]:
            - img "SUTH Logo" [ref=e7]
            - button "Toggle sidebar" [ref=e8] [cursor=pointer]
        - generic [ref=e11]:
            - generic [ref=e12]: หน่วยงานที่กำลังใช้งาน
            - combobox "หน่วยงานที่กำลังใช้งาน" [ref=e13] [cursor=pointer]:
                - option "ทุกหน่วยงาน"
                - option "โรงพยาบาลทดสอบ (โรงพยาบาล)"
                - option "เขตการศึกษาทดสอบ (โรงเรียน)" [selected]
            - generic [ref=e14]: หน่วยงานย่อยประเภทโรงเรียน
        - navigation [ref=e15]:
            - generic [ref=e16]: หน้าหลัก
            - link "แดชบอร์ด" [ref=e17] [cursor=pointer]:
                - /url: /admin/dashboard
            - generic [ref=e22]: ทั่วไป
            - link "ข้อมูลเคส" [ref=e23] [cursor=pointer]:
                - /url: /admin/cases
            - link "เคสเสี่ยง" [ref=e28] [cursor=pointer]:
                - /url: /admin/risk-cases
            - link "ตารางนัดหมาย" [ref=e33] [cursor=pointer]:
                - /url: /admin/schedule
            - link "ส่งต่อระหว่างหน่วยงาน" [ref=e38] [cursor=pointer]:
                - /url: /admin/referrals
            - generic [ref=e43]: โรงเรียน
            - link "นักเรียน" [ref=e44] [cursor=pointer]:
                - /url: /admin/school/students
            - link "ครู" [ref=e49] [cursor=pointer]:
                - /url: /admin/school/teachers
            - link "ชั้นปีและห้องเรียน" [ref=e54] [cursor=pointer]:
                - /url: /admin/school
            - link "ประเภทครูและนักเรียน" [ref=e59] [cursor=pointer]:
                - /url: /admin/school/types
            - generic [ref=e64]: จัดการหน่วยงาน
            - link "จัดการฟอร์ม" [ref=e65] [cursor=pointer]:
                - /url: /admin/forms
            - link "จัดการคลินิก" [ref=e70] [cursor=pointer]:
                - /url: /admin/clinics
            - link "ผู้มารับบริการ" [ref=e75] [cursor=pointer]:
                - /url: /admin/members
            - link "จัดการศูนย์ช่วยเหลือ" [ref=e80] [cursor=pointer]:
                - /url: /admin/help-center
            - generic "ใช้กับทั้งระบบ ไม่ขึ้นกับหน่วยงานที่เลือก" [ref=e85]: จัดการหลักของระบบ
            - link "หน่วยงานหลักและหน่วยงานย่อย" [ref=e89] [cursor=pointer]:
                - /url: /admin/organizations
            - link "ผู้ดูแลระบบและเจ้าหน้าที่" [ref=e94] [cursor=pointer]:
                - /url: /admin/users
            - link "บทบาทและสิทธิ์" [ref=e99] [cursor=pointer]:
                - /url: /admin/roles
            - link "จัดการภาพแบนเนอร์" [ref=e104] [cursor=pointer]:
                - /url: /admin/banner
            - generic [ref=e109]: บัญชีของฉัน
            - link "ข้อมูลส่วนตัว" [ref=e110] [cursor=pointer]:
                - /url: /admin/profile
            - link "คู่มือการใช้งาน" [ref=e115] [cursor=pointer]:
                - /url: /api/private-files/admin_manual.pdf
        - button "ออกจากระบบ" [ref=e121] [cursor=pointer]
    - main [ref=e128]:
        - generic [ref=e129]:
            - generic [ref=e130]:
                - heading "รายชื่อนักเรียน" [level=1] [ref=e131]
                - paragraph [ref=e132]: นักเรียนทั้งหมดของโรงเรียน คลิกชื่อเพื่อดูข้อมูลสุขภาพจิตและสุขภาพกาย
            - generic [ref=e133]:
                - button "ส่งออก Excel" [ref=e134] [cursor=pointer]
                - link "นำเข้าจาก Excel/CSV" [ref=e138] [cursor=pointer]:
                    - /url: /admin/school/students/import
                - button "เพิ่มนักเรียน" [ref=e142] [cursor=pointer]
        - generic [ref=e144]:
            - generic [ref=e145]:
                - generic [ref=e146]:
                    - generic [ref=e150]: ค้นหานักเรียน
                    - searchbox "ค้นหานักเรียน" [ref=e151]
                - generic [ref=e152]:
                    - generic [ref=e153]: ชั้นปี
                    - combobox "ชั้นปี" [ref=e154]:
                        - option "ทุกชั้นปี" [selected]
                        - option "ม.1"
                - generic [ref=e155]:
                    - generic [ref=e156]: ห้อง
                    - combobox "ห้อง" [ref=e157]:
                        - option "ทุกห้อง" [selected]
                        - option "ม.1 ห้อง 1/1 (2569)"
                - group [ref=e158]:
                    - generic "ตัวกรองเพิ่มเติม" [ref=e159] [cursor=pointer]
                    - option "ทุกประเภท" [selected]
                    - option "ทุกสถานะ"
                    - option "กำลังศึกษา" [selected]
                    - option "จบการศึกษา"
                    - option "ย้ายโรงเรียน"
                    - option "ปิดใช้งาน"
            - region "ตารางรายชื่อนักเรียน" [ref=e165]:
                - table [ref=e166]:
                    - rowgroup [ref=e167]:
                        - row [ref=e168]:
                            - columnheader "รหัส" [ref=e169]
                            - columnheader "ชื่อ-นามสกุล" [ref=e170]
                            - columnheader "ชั้น/ห้อง" [ref=e171]
                            - columnheader "ประเภท" [ref=e172]
                            - columnheader "บัญชีผู้ใช้" [ref=e173]
                            - columnheader "สถานะ" [ref=e174]
                            - columnheader "จัดการ" [ref=e175]
                    - rowgroup [ref=e176]:
                        - row [ref=e177]:
                            - cell "69001" [ref=e178]
                            - cell "ด.ช. สมชาย ใจดี (ต้น)" [ref=e179]:
                                - button "ด.ช. สมชาย ใจดี" [ref=e180] [cursor=pointer]
                                - generic [ref=e182]: (ต้น)
                            - cell "ม.1 ห้อง 1/1" [ref=e183]
                            - cell "-" [ref=e184]
                            - cell "tst0169001 ยังไม่เปลี่ยนรหัส" [ref=e185]:
                                - text: tst0169001
                                - generic [ref=e186]: ยังไม่เปลี่ยนรหัส
                            - cell "กำลังศึกษา" [ref=e187]
                            - cell [ref=e189]:
                                - generic [ref=e190]:
                                    - button "ดูข้อมูล ด.ช. สมชาย ใจดี" [ref=e191] [cursor=pointer]
                                    - button "แก้ไขข้อมูล ด.ช. สมชาย ใจดี" [ref=e195] [cursor=pointer]
                                    - button "ตั้งรหัสผ่านใหม่ให้ ด.ช. สมชาย ใจดี" [ref=e198] [cursor=pointer]
                                    - button "ปิดข้อมูล ด.ช. สมชาย ใจดี" [ref=e201] [cursor=pointer]
            - generic [ref=e204]:
                - generic [ref=e205]:
                    - generic [ref=e206]: แสดง
                    - combobox "จำนวนรายการต่อหน้า" [ref=e207]:
                        - option "20" [selected]
                        - option "50"
                        - option "100"
                    - generic [ref=e208]: จากทั้งหมด 1 รายการ
                - generic [ref=e209]:
                    - button "หน้าก่อนหน้า" [disabled] [ref=e210]
                    - generic [ref=e213]:
                        - text: หน้า
                        - strong [ref=e214]: "1"
                        - text: จาก 1
                    - button "หน้าถัดไป" [disabled] [ref=e215]
```

# Test source

```ts
  162 |       return route.fulfill({
  163 |         json: [
  164 |           {
  165 |             id: 11,
  166 |             grade_level_id: 5,
  167 |             grade_name: "ม.1",
  168 |             name: "1/1",
  169 |             academic_year: 2569,
  170 |             student_count: 1,
  171 |             status: "active",
  172 |             teachers: [],
  173 |           },
  174 |         ],
  175 |       });
  176 |     if (/\/api\/school\/(student|teacher)-types$/.test(pathname))
  177 |       return route.fulfill({ json: [] });
  178 |     if (pathname.endsWith("/api/school/students"))
  179 |       return route.fulfill({
  180 |         json: {
  181 |           data: [STUDENT],
  182 |           pagination: { page: 1, limit: 20, total: 1, total_pages: 1 },
  183 |         },
  184 |       });
  185 |     if (pathname.endsWith("/api/school/students/1/health"))
  186 |       return route.fulfill({ json: HEALTH });
  187 |     if (pathname.endsWith("/api/school/cases"))
  188 |       return route.fulfill({
  189 |         json: {
  190 |           data: [
  191 |             {
  192 |               ...STUDENT,
  193 |               mental: {
  194 |                 risk: "high",
  195 |                 label: "เครียดสูง",
  196 |                 form_title: "แบบคัดกรองความเครียดนักเรียน",
  197 |                 submitted_at: "2026-10-01T03:00:00.000Z",
  198 |               },
  199 |               physical: null,
  200 |               latest_vitals: { bmi: 20 },
  201 |               overall_risk: "high",
  202 |             },
  203 |           ],
  204 |           pagination: { page: 1, limit: 20, total: 1, total_pages: 1 },
  205 |           counts: { high: 1, medium: 0, normal: 0, none: 0 },
  206 |           classrooms: [],
  207 |         },
  208 |       });
  209 |     if (pathname.endsWith("/api/school/students/import") && method === "POST") {
  210 |       const body = request.postDataJSON();
  211 |       (received.imports ||= []).push(body);
  212 |       return route.fulfill({
  213 |         json: {
  214 |           dry_run: body.dry_run,
  215 |           summary: {},
  216 |           results: body.rows.map((row, index) =>
  217 |             row.student_code
  218 |               ? {
  219 |                   row: body.row_offset + index + 1,
  220 |                   student_code: row.student_code,
  221 |                   name: `${row.first_name} ${row.last_name}`,
  222 |                   grade: row.grade,
  223 |                   classroom: row.classroom,
  224 |                   username: `tst01${row.student_code}`,
  225 |                   status: body.dry_run ? "will_create" : "created",
  226 |                   errors: [],
  227 |                   ...(body.dry_run ? {} : { password: "Temp#Pass2569" }),
  228 |                 }
  229 |               : {
  230 |                   row: body.row_offset + index + 1,
  231 |                   student_code: "",
  232 |                   name: "",
  233 |                   status: "error",
  234 |                   errors: ["ไม่มีรหัสนักเรียน"],
  235 |                 },
  236 |           ),
  237 |         },
  238 |       });
  239 |     }
  240 |     if (pathname.endsWith("/api/forms")) return route.fulfill({ json: [] });
  241 |     return route.fulfill({ json: {} });
  242 |   });
  243 | }
  244 |
  245 | test.describe("school organization", () => {
  246 |   test.beforeEach(async ({}, testInfo) => {
  247 |     test.skip(testInfo.project.name === "mobile-chromium" && !/student list opens|case list of a school/.test(testInfo.title));
  248 |   });
  249 |
  250 |   test("shows school menus instead of hospital-only menus", async ({
  251 |     page,
  252 |   }) => {
  253 |     await openAsSchoolAdmin(page);
  254 |     await page.goto("/admin/school/students");
  255 |     const nav = page.locator("aside.sidebar");
  256 |     await expect(
  257 |       nav.getByRole("link", { name: "นักเรียน", exact: true }),
  258 |     ).toBeVisible();
  259 |     await expect(
  260 |       nav.getByRole("link", { name: "ครู", exact: true }),
  261 |     ).toBeVisible();
> 262 |     await expect(nav.getByRole("link", { name: "จัดการคลินิก" })).toHaveCount(
      |                                                                   ^ Error: expect(locator).toHaveCount(expected) failed
  263 |       0,
  264 |     );
  265 |     await expect(nav.getByRole("link", { name: "ตารางนัดหมาย" })).toHaveCount(
  266 |       0,
  267 |     );
  268 |   });
  269 |
  270 |   test("the structure page is the sub-unit's school: grades and their rooms only", async ({
  271 |     page,
  272 |   }) => {
  273 |     const received = {};
  274 |     await openAsSchoolAdmin(page, received);
  275 |     await page.goto("/admin/school");
  276 |     await expect(
  277 |       page.getByRole("heading", { name: "ชั้นปีและห้องเรียน" }),
  278 |     ).toBeVisible();
  279 |     await expect(
  280 |       page.getByText(/โรงเรียนทดสอบ · รหัสโรงเรียน TST01/),
  281 |     ).toBeVisible();
  282 |     await expect(
  283 |       page.getByRole("button", { name: /เพิ่มโรงเรียน/ }),
  284 |     ).toHaveCount(0);
  285 |     const grade = page.getByRole("region", { name: "ม.1" });
  286 |     await expect(grade.getByText("ห้อง 1/1")).toBeVisible();
  287 |     await grade.getByRole("button", { name: "เพิ่มห้อง" }).click();
  288 |     await expect
  289 |       .poll(() => received.classroom)
  290 |       .toEqual({
  291 |         grade_level_id: 5,
  292 |         academic_year: String(
  293 |           new Date().getFullYear() + 543 - (new Date().getMonth() < 4 ? 1 : 0),
  294 |         ),
  295 |       });
  296 |   });
  297 |
  298 |   test("student list opens the student health file", async ({ page }) => {
  299 |     await openAsSchoolAdmin(page);
  300 |     await page.goto("/admin/school/students");
  301 |     await expect(
  302 |       page.getByRole("heading", { name: "รายชื่อนักเรียน" }),
  303 |     ).toBeVisible();
  304 |     await page
  305 |       .getByRole("button", { name: "ดูข้อมูล ด.ช. สมชาย ใจดี" })
  306 |       .click();
  307 |     const dialog = page.getByRole("dialog", { name: "ด.ช. สมชาย ใจดี" });
  308 |     await expect(dialog).toBeVisible();
  309 |     await dialog.getByRole("tab", { name: "สุขภาพกาย" }).click();
  310 |     await expect(dialog.getByText("แพ้กุ้ง")).toBeVisible();
  311 |     await dialog.getByRole("tab", { name: "สุขภาพจิต" }).click();
  312 |     await expect(dialog.getByText("เครียดสูง").first()).toBeVisible();
  313 |     await page.keyboard.press("Escape");
  314 |     await expect(dialog).toHaveCount(0);
  315 |   });
  316 |
  317 |   test("the case list of a school organization is the student health view", async ({
  318 |     page,
  319 |   },testInfo) => {
  320 |     await openAsSchoolAdmin(page);
  321 |     await page.goto("/admin/cases");
  322 |     await expect(
  323 |       page.getByRole("heading", { name: "ข้อมูลสุขภาพนักเรียน" }),
  324 |     ).toBeVisible();
  325 |     if(testInfo.project.name==='mobile-chromium') {
  326 |       await page.getByRole('button',{name:'ด.ช. สมชาย ใจดี',exact:true}).click();
  327 |       const dialog=page.getByRole('dialog',{name:'ด.ช. สมชาย ใจดี'});
  328 |       await dialog.getByRole('tab',{name:'สุขภาพจิต'}).click();
  329 |       await expect(dialog.getByText('เครียดสูง').first()).toBeVisible();
  330 |     } else await expect(page.getByText("เครียดสูง")).toBeVisible();
  331 |   });
  332 |
  333 |   test("imports a CSV after a dry run and offers the credentials file", async ({
  334 |     page,
  335 |   }) => {
  336 |     const received = {};
  337 |     await openAsSchoolAdmin(page, received);
  338 |     await page.goto("/admin/school/students/import");
  339 |     await page.locator('input[type="file"]').setInputFiles({
  340 |       name: "students.csv",
  341 |       mimeType: "text/csv",
  342 |       buffer: Buffer.from(
  343 |         "﻿รหัสนักเรียน,ชื่อ,นามสกุล,ชั้นปี,ห้อง\n69010,มานี,มีนา,ม.1,1/1\n,ไม่มี,รหัส,ม.1,1/1\n",
  344 |         "utf8",
  345 |       ),
  346 |     });
  347 |     await expect(page.getByText(/พบนักเรียน\s*2\s*แถว/)).toBeVisible();
  348 |     await page.getByRole("button", { name: "ตรวจสอบข้อมูล" }).click();
  349 |     await expect(page.getByText("ผลการตรวจสอบ (ยังไม่บันทึก)")).toBeVisible();
  350 |     await expect(page.getByText("ไม่มีรหัสนักเรียน")).toBeVisible();
  351 |     expect(received.imports[0].dry_run).toBe(true);
  352 |
  353 |     await page.getByRole("button", { name: /นำเข้า 1 คน/ }).click();
  354 |     await expect(page.getByText("ผลการนำเข้า")).toBeVisible();
  355 |     expect(received.imports[1].dry_run).toBe(false);
  356 |     await expect(page.getByText("Temp#Pass2569")).toBeVisible();
  357 |     const download = page.waitForEvent("download");
  358 |     await page.getByRole("button", { name: /ดาวน์โหลดบัญชีนักเรียน/ }).click();
  359 |     expect((await download).suggestedFilename()).toMatch(/^บัญชีนักเรียน-/);
  360 |   });
  361 | });
  362 |
```

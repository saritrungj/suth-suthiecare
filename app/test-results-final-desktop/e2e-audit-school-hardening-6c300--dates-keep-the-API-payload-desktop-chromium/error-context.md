# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e-audit\school-hardening.spec.js >> classroom rollup reflows and Buddhist dates keep the API payload
- Location: e2e-audit\school-hardening.spec.js:150:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('dialog', { name: 'เพิ่มนักเรียน', exact: true }).getByLabel('ชื่อ', { exact: true })

```

# Page snapshot

```yaml
- generic [ref=f1e1]:
    - generic [ref=f1e3]:
        - complementary [ref=f1e4]:
            - generic [ref=f1e5]:
                - img "SUTH Logo" [ref=f1e7]
                - button "Toggle sidebar" [ref=f1e8] [cursor=pointer]
            - generic [ref=f1e11]:
                - generic [ref=f1e12]: หน่วยงานที่กำลังใช้งาน
                - combobox "หน่วยงานที่กำลังใช้งาน" [ref=f1e13] [cursor=pointer]:
                    - option "ทุกหน่วยงาน"
                    - option "โรงพยาบาลทดสอบ (โรงพยาบาล)"
                    - option "เขตการศึกษาทดสอบ (โรงเรียน)" [selected]
                - generic [ref=f1e14]: หน่วยงานย่อยประเภทโรงเรียน
            - navigation [ref=f1e15]:
                - generic [ref=f1e16]: หน้าหลัก
                - link "แดชบอร์ด" [ref=f1e17] [cursor=pointer]:
                    - /url: /admin/dashboard
                - generic [ref=f1e22]: ทั่วไป
                - link "ข้อมูลเคส" [ref=f1e23] [cursor=pointer]:
                    - /url: /admin/cases
                - link "เคสเสี่ยง" [ref=f1e28] [cursor=pointer]:
                    - /url: /admin/risk-cases
                - generic [ref=f1e33]: โรงเรียน
                - link "นักเรียน" [ref=f1e34] [cursor=pointer]:
                    - /url: /admin/school/students
                - link "ครู" [ref=f1e39] [cursor=pointer]:
                    - /url: /admin/school/teachers
                - link "ชั้นปีและห้องเรียน" [ref=f1e44] [cursor=pointer]:
                    - /url: /admin/school
                - link "ประเภทครูและนักเรียน" [ref=f1e49] [cursor=pointer]:
                    - /url: /admin/school/types
                - generic [ref=f1e54]: จัดการหน่วยงาน
                - link "จัดการฟอร์ม" [ref=f1e55] [cursor=pointer]:
                    - /url: /admin/forms
                - link "ผู้มารับบริการ" [ref=f1e60] [cursor=pointer]:
                    - /url: /admin/members
                - link "จัดการศูนย์ช่วยเหลือ" [ref=f1e65] [cursor=pointer]:
                    - /url: /admin/help-center
                - generic "ใช้กับทั้งระบบ ไม่ขึ้นกับหน่วยงานที่เลือก" [ref=f1e70]: ผู้ดูแลระบบ
                - link "หน่วยงานหลักและหน่วยงานย่อย" [ref=f1e74] [cursor=pointer]:
                    - /url: /admin/organizations
                - link "ผู้ดูแลระบบและเจ้าหน้าที่" [ref=f1e79] [cursor=pointer]:
                    - /url: /admin/users
                - link "บทบาทและสิทธิ์" [ref=f1e84] [cursor=pointer]:
                    - /url: /admin/roles
                - link "จัดการภาพแบนเนอร์" [ref=f1e89] [cursor=pointer]:
                    - /url: /admin/banner
                - generic [ref=f1e94]: บัญชีของฉัน
                - link "ข้อมูลส่วนตัว" [ref=f1e95] [cursor=pointer]:
                    - /url: /admin/profile
                - link "คู่มือการใช้งาน" [ref=f1e100] [cursor=pointer]:
                    - /url: /docs/admin_manual.pdf
            - button "ออกจากระบบ" [ref=f1e106] [cursor=pointer]
        - main [ref=f1e113]:
            - generic [ref=f1e114]:
                - generic [ref=f1e115]:
                    - heading "รายชื่อนักเรียน" [level=1] [ref=f1e116]
                    - paragraph [ref=f1e117]: นักเรียนทั้งหมดของโรงเรียน คลิกชื่อเพื่อดูข้อมูลสุขภาพจิตและสุขภาพกาย
                - generic [ref=f1e118]:
                    - button "ส่งออก Excel" [ref=f1e119] [cursor=pointer]
                    - link "นำเข้าจาก Excel/CSV" [ref=f1e123] [cursor=pointer]:
                        - /url: /admin/school/students/import
                    - button "เพิ่มนักเรียน" [ref=f1e127] [cursor=pointer]
            - generic [ref=f1e129]:
                - generic [ref=f1e130]:
                    - generic [ref=f1e131]:
                        - generic [ref=f1e135]: ค้นหานักเรียน
                        - searchbox "ค้นหานักเรียน" [ref=f1e136]
                    - generic [ref=f1e137]:
                        - generic [ref=f1e138]: ชั้นปี
                        - combobox "ชั้นปี" [ref=f1e139]:
                            - option "ทุกชั้นปี" [selected]
                            - option "ม.1"
                    - generic [ref=f1e140]:
                        - generic [ref=f1e141]: ห้อง
                        - combobox "ห้อง" [ref=f1e142]:
                            - option "ทุกห้อง" [selected]
                            - option "ม.1 ห้อง 1/1 (2569)"
                    - group [ref=f1e143]:
                        - generic "ตัวกรองเพิ่มเติม" [ref=f1e144] [cursor=pointer]
                        - option "ทุกประเภท" [selected]
                        - option "ทุกสถานะ"
                        - option "กำลังศึกษา" [selected]
                        - option "จบการศึกษา"
                        - option "ย้ายโรงเรียน"
                        - option "ปิดใช้งาน"
                - region "ตารางรายชื่อนักเรียน" [ref=f1e150]:
                    - table [ref=f1e151]:
                        - rowgroup [ref=f1e152]:
                            - row [ref=f1e153]:
                                - columnheader "รหัส" [ref=f1e154]
                                - columnheader "ชื่อ-นามสกุล" [ref=f1e155]
                                - columnheader "ชั้น/ห้อง" [ref=f1e156]
                                - columnheader "ประเภท" [ref=f1e157]
                                - columnheader "บัญชีผู้ใช้" [ref=f1e158]
                                - columnheader "สถานะ" [ref=f1e159]
                                - columnheader "จัดการ" [ref=f1e160]
                        - rowgroup [ref=f1e161]:
                            - row [ref=f1e162]:
                                - cell "69001" [ref=f1e163]
                                - cell "ด.ช. สมชาย ใจดี (ต้น)" [ref=f1e164]:
                                    - button "ด.ช. สมชาย ใจดี" [ref=f1e165] [cursor=pointer]
                                    - generic [ref=f1e167]: (ต้น)
                                - cell "ม.1 ห้อง 1/1" [ref=f1e168]
                                - cell "-" [ref=f1e169]
                                - cell "tst0169001 ยังไม่เปลี่ยนรหัส" [ref=f1e170]:
                                    - text: tst0169001
                                    - generic [ref=f1e171]: ยังไม่เปลี่ยนรหัส
                                - cell "กำลังศึกษา" [ref=f1e172]
                                - cell [ref=f1e174]:
                                    - generic [ref=f1e175]:
                                        - button "ดูข้อมูล ด.ช. สมชาย ใจดี" [ref=f1e176] [cursor=pointer]
                                        - button "แก้ไขข้อมูล ด.ช. สมชาย ใจดี" [ref=f1e180] [cursor=pointer]
                                        - button "ตั้งรหัสผ่านใหม่ให้ ด.ช. สมชาย ใจดี" [ref=f1e183] [cursor=pointer]
                                        - button "ปิดข้อมูล ด.ช. สมชาย ใจดี" [ref=f1e186] [cursor=pointer]
                - generic [ref=f1e189]:
                    - generic [ref=f1e190]:
                        - generic [ref=f1e191]: แสดง
                        - combobox "จำนวนรายการต่อหน้า" [ref=f1e192]:
                            - option "20" [selected]
                            - option "50"
                            - option "100"
                        - generic [ref=f1e193]: จากทั้งหมด 1 รายการ
                    - generic [ref=f1e194]:
                        - button "หน้าก่อนหน้า" [disabled] [ref=f1e195]
                        - generic [ref=f1e198]:
                            - text: หน้า
                            - strong [ref=f1e199]: "1"
                            - text: จาก 1
                        - button "หน้าถัดไป" [disabled] [ref=f1e200]
    - dialog [ref=f1e203]:
        - banner [ref=f1e204]:
            - generic [ref=f1e205]:
                - heading "เพิ่มนักเรียน" [level=2] [ref=f1e206]
                - text: ระบบจะสร้างบัญชีผู้ใช้ให้อัตโนมัติ หากมีเลขบัตรประชาชนที่มีบัญชีอยู่แล้วจะผูกกับบัญชีเดิม
            - button "ปิดหน้าต่าง" [ref=f1e207] [cursor=pointer]
        - generic [ref=f1e212]:
            - paragraph [ref=f1e213]: ช่องที่มีเครื่องหมาย * ต้องกรอก
            - generic [ref=f1e214]:
                - generic [ref=f1e215]: รหัสนักเรียน*
                - textbox "รหัสนักเรียน" [active] [ref=f1e216]: "69002"
            - generic [ref=f1e217]:
                - generic [ref=f1e218]: ชั้น/ห้อง*
                - combobox "ชั้น/ห้อง" [ref=f1e219]:
                    - option "เลือกห้อง"
                    - option "ม.1 ห้อง 1/1 (2569)" [selected]
            - generic [ref=f1e220]:
                - text: ประเภทนักเรียน
                - combobox "ประเภทนักเรียน" [ref=f1e221]:
                    - option "ไม่ระบุ" [selected]
            - generic [ref=f1e222]:
                - text: คำนำหน้า
                - combobox "คำนำหน้า" [ref=f1e223]
            - generic [ref=f1e224]:
                - generic [ref=f1e225]: ชื่อ*
                - textbox "ชื่อ" [ref=f1e226]
            - generic [ref=f1e227]:
                - generic [ref=f1e228]: นามสกุล*
                - textbox "นามสกุล" [ref=f1e229]
            - generic [ref=f1e230]:
                - text: ชื่อเล่น
                - textbox "ชื่อเล่น" [ref=f1e231]
            - generic [ref=f1e232]:
                - text: เพศ
                - combobox "เพศ" [ref=f1e233]:
                    - option "ไม่ระบุ" [selected]
                    - option "ชาย"
                    - option "หญิง"
                    - option "อื่น ๆ"
            - generic [ref=f1e234]:
                - generic [ref=f1e235]: วันเกิด
                - textbox "วันเกิด" [ref=f1e236]:
                    - /placeholder: วว/ดด/ปปปป
                - generic [ref=f1e237]: ปีพุทธศักราช เช่น 31/05/2556
            - generic [ref=f1e238]:
                - text: เลขบัตรประชาชน (ไม่บังคับ)
                - textbox "เลขบัตรประชาชน (ไม่บังคับ)" [ref=f1e239]
        - contentinfo [ref=f1e240]:
            - button "ยกเลิก" [ref=f1e241] [cursor=pointer]
            - button "บันทึก" [ref=f1e242] [cursor=pointer]
```

# Test source

```ts
  74  |   await page.keyboard.press('ArrowRight');
  75  |   await expect(file.getByRole('tab', {name: 'สุขภาพกาย'})).toBeFocused();
  76  |   await expect(file.getByRole('tab', {name: 'สุขภาพกาย'})).toHaveAttribute('aria-selected', 'true');
  77  |   await expect(file.locator('.recharts-wrapper')).toBeVisible();
  78  |   await audit('student-physical');
  79  |   const addRecord = file.getByRole('button', {name: 'บันทึกผลตรวจ'});
  80  |   await addRecord.click();
  81  |   const record = page.getByRole('dialog', {name: 'บันทึกผลตรวจร่างกาย'});
  82  |   await expect(record.getByLabel('วันที่ตรวจ')).toBeFocused();
  83  |   await record.getByLabel('วันที่ตรวจ').fill('31/02/2569');
  84  |   await record.getByRole('button', {name: 'บันทึก', exact: true}).click();
  85  |   await expect(record.getByLabel('วันที่ตรวจ')).toHaveAttribute('aria-invalid', 'true');
  86  |   await audit('physical-form-errors');
  87  |   await page.keyboard.press('Escape');
  88  |   await expect(record).toHaveCount(0);
  89  |   await expect(addRecord).toBeFocused();
  90  |   await file.getByRole('tab', {name: 'สุขภาพกาย'}).focus();
  91  |   await page.keyboard.press('End');
  92  |   await expect(file.getByRole('tab', {name: 'สุขภาพจิต'})).toBeFocused();
  93  |   await expect(file.locator('.recharts-wrapper')).toBeVisible();
  94  |   await audit('student-mental');
  95  |   await page.keyboard.press('Home');
  96  |   await expect(file.getByRole('tab', {name: 'ข้อมูลทั่วไป'})).toBeFocused();
  97  |   await page.keyboard.press('ArrowLeft');
  98  |   await expect(file.getByRole('tab', {name: 'สุขภาพจิต'})).toBeFocused();
  99  |   const activeId = await file.getByRole('tab', {name: 'สุขภาพจิต'}).getAttribute('id');
  100 |   await expect(file.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', activeId);
  101 |   await close(openFile);
  102 |
  103 |   await page.goto('/admin/cases');
  104 |   await expect(page.getByRole('button', {name: 'ด.ช. สมชาย ใจดี'})).toBeVisible();
  105 |   await audit('school-cases');
  106 |   await page.getByRole('button', {name: 'เสี่ยงสูง 1', exact: true}).click();
  107 |   await expect(page.getByRole('heading', {name: 'นักเรียนกลุ่มเสี่ยง'})).toBeVisible();
  108 |   await audit('school-cases-filtered');
  109 |
  110 |   for (const [route, title] of [['/admin/school','ชั้นปีและห้องเรียน'], ['/admin/school/teachers','รายชื่อครู'], ['/admin/school/types','ประเภทครูและนักเรียน'], ['/admin/school/students/import','นำเข้านักเรียนจาก Excel / CSV']]) {
  111 |     await page.goto(route);
  112 |     await expect(page.getByRole('heading', {name: title, exact: true})).toBeVisible();
  113 |     await expect(page.locator('.sch-loading-row')).toHaveCount(0);
  114 |     await audit(route.split('/').at(-1));
  115 |     if (route.endsWith('/teachers')) {
  116 |       const opener = page.getByRole('button', {name: 'เพิ่มครู', exact: true});
  117 |       await opener.click();
  118 |       await audit('teacher-form');
  119 |       await page.getByRole('dialog', {name: 'เพิ่มครู', exact: true}).getByRole('button', {name: 'บันทึก', exact: true}).click();
  120 |       const alert = page.getByRole('dialog', {name: 'ยังไม่ได้เลือกเจ้าหน้าที่'});
  121 |       await expect(alert).toBeVisible();
  122 |       await audit('teacher-required-alert');
  123 |       await alert.getByRole('button', {name: 'ตกลง'}).click();
  124 |       await expect(alert).toHaveCount(0);
  125 |       await expect(page.locator('.sch-modal-overlay')).not.toHaveAttribute('inert');
  126 |       await audit('teacher-required-error');
  127 |       await close(opener);
  128 |     }
  129 |     if (route === '/admin/school') {
  130 |       const opener = page.getByRole('region', {name: 'ม.1'}).getByRole('button', {name: 'แก้ไข ม.1 ห้อง 1/1', exact: true});
  131 |       await opener.click();
  132 |       await audit('classroom-form');
  133 |       await close(opener);
  134 |     }
  135 |   }
  136 |   await mockOrganizations(page, {});
  137 |   await page.route("**/api/organizations/2/members", route => route.fulfill({json: Array.from({length: 7}, (_, i) => ({id: 30+i, user_id: 30+i, username: `member${i}`, name: `สมาชิกทดสอบ ${i+1}`, role_id: 3, role_name: 'Staff', status: 'active'}))}));
  138 |   await page.goto('/admin/organizations');
  139 |   await expect(page.getByRole('heading', {name: 'หน่วยงานหลักและหน่วยงานย่อย'})).toBeVisible();
  140 |   await page.getByRole('complementary', {name: 'โครงสร้างหน่วยงาน'}).getByRole('button', {name: /โรงเรียนสุรวิวัฒน์/}).click();
  141 |   if (phone) await expect(page.getByRole('heading', {name: 'รายละเอียดหน่วยงานย่อย'})).toBeFocused();
  142 |   await audit('organization-details');
  143 |   await page.getByRole('button', {name: '+ เพิ่มสมาชิก'}).click();
  144 |   await audit('organization-members-picker');
  145 |   await testInfo.attach('hardening-report', {body: JSON.stringify({states, findings}, null, 2), contentType: 'application/json'});
  146 |   console.log(JSON.stringify({viewport: phone ? 390 : 1366, findings}));
  147 |   expect(findings).toEqual([]);
  148 | });
  149 |
  150 | test("classroom rollup reflows and Buddhist dates keep the API payload", async ({ page }, testInfo) => {
  151 |   await openAsSchoolAdmin(page);
  152 |   let payload;
  153 |   await page.route('**/api/school/cases*', route => route.fulfill({json: {
  154 |     data: [{...HEALTH.student, mental: {risk: 'high', label: 'เครียดสูง', submitted_at: '2026-10-01'}, physical: null, overall_risk: 'high', latest_vitals: {bmi:20}}],
  155 |     pagination: {page:1,limit:20,total:1,total_pages:1}, counts:{high:1,medium:0,normal:0,none:0},
  156 |     classrooms: [{classroom_id:11,name:'ม.1 ห้อง 1/1',high:1,medium:0,normal:0,none:0},{classroom_id:12,name:'ม.1 ห้อง 1/2',high:0,medium:0,normal:1,none:0}],
  157 |   }}));
  158 |   await page.goto('/admin/cases');
  159 |   await expect(page.getByRole('heading',{name:'สรุปตามห้องเรียน'})).toBeVisible();
  160 |   const phone = testInfo.project.name === 'mobile-chromium';
  161 |   await expect(page.locator('.sch-classroom-summary')).toHaveCount(phone ? 1 : 0);
  162 |   if (phone) expect(await page.locator('.sch-page').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  163 |   expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations).toEqual([]);
  164 |   await page.route('**/api/school/students', route => {
  165 |     if (route.request().method() !== 'POST') return route.fallback();
  166 |     payload = route.request().postDataJSON();
  167 |     return route.fulfill({status:201,json:{id:2,username:'test-student'}});
  168 |   });
  169 |   await page.goto('/admin/school/students');
  170 |   await page.getByRole('button',{name:'เพิ่มนักเรียน',exact:true}).click();
  171 |   const form = page.getByRole('dialog',{name:'เพิ่มนักเรียน',exact:true});
  172 |   await form.getByLabel('รหัสนักเรียน').fill('69002');
  173 |   await form.getByLabel('ชั้น/ห้อง').selectOption('11');
> 174 |   await form.getByLabel(/^ชื่อ\s*\*?$/).fill('นักเรียน');
      |                                              ^ Error: locator.fill: Test timeout of 30000ms exceeded.
  175 |   await form.getByLabel(/^นามสกุล\s*\*?$/).fill('ทดสอบ');
  176 |   await form.getByLabel('วันเกิด').fill('31/05/2556');
  177 |   await form.getByRole('button',{name:'บันทึก',exact:true}).click();
  178 |   await expect.poll(() => payload?.birth_date).toBe('2013-05-31');
  179 |   expect(payload).toMatchObject({student_code:'69002',first_name:'นักเรียน',last_name:'ทดสอบ',classroom_id:'11'});
  180 | });
  181 |
```

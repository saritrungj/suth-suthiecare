# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e-audit\school-hardening.spec.js >> school and organization hardening: WCAG, layout, keyboard and dates
- Location: e2e-audit\school-hardening.spec.js:7:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 79

- Array []
+ Array [
+   Object {
+     "layout": Object {
+       "dialogs": Array [
+         Object {
+           "scrollWidth": 390,
+           "width": 390,
+         },
+       ],
+       "document": 390,
+       "viewport": 390,
+     },
+     "name": "student-physical",
+     "violations": Array [
+       Object {
+         "help": "Elements must meet minimum color contrast ratio thresholds",
+         "id": "color-contrast",
+         "nodes": Array [
+           Object {
+             "summary": "Fix any of the following:
+   Element has insufficient color contrast of 2.75 (foreground color: #f47932, background color: #ffffff, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "target": Array [
+               ".recharts-tooltip-item:nth-child(1) > .recharts-tooltip-item-name",
+             ],
+           },
+           Object {
+             "summary": "Fix any of the following:
+   Element has insufficient color contrast of 2.75 (foreground color: #f47932, background color: #ffffff, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "target": Array [
+               ".recharts-tooltip-item:nth-child(1) > .recharts-tooltip-item-value",
+             ],
+           },
+           Object {
+             "summary": "Fix any of the following:
+   Element has insufficient color contrast of 3.29 (foreground color: #16a34a, background color: #ffffff, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "target": Array [
+               ".recharts-tooltip-item:nth-child(3) > .recharts-tooltip-item-name",
+             ],
+           },
+           Object {
+             "summary": "Fix any of the following:
+   Element has insufficient color contrast of 3.29 (foreground color: #16a34a, background color: #ffffff, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "target": Array [
+               ".recharts-tooltip-item:nth-child(3) > .recharts-tooltip-item-value",
+             ],
+           },
+         ],
+       },
+     ],
+   },
+   Object {
+     "layout": Object {
+       "dialogs": Array [
+         Object {
+           "scrollWidth": 366,
+           "width": 366,
+         },
+       ],
+       "document": 390,
+       "viewport": 390,
+     },
+     "name": "classroom-form",
+     "violations": Array [
+       Object {
+         "help": "Elements must meet minimum color contrast ratio thresholds",
+         "id": "color-contrast",
+         "nodes": Array [
+           Object {
+             "summary": "Fix any of the following:
+   Element has insufficient color contrast of 4.33 (foreground color: #ffffff, background color: #c95626, font size: 12.0pt (16px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "target": Array [
+               "button[form=\"classroom-form\"]",
+             ],
+           },
+         ],
+       },
+     ],
+   },
+ ]
```

# Page snapshot

```yaml
- generic [ref=f6e3]:
    - generic [ref=f6e4]:
        - button "Open Menu" [ref=f6e5] [cursor=pointer]
        - img "SUTH Logo" [ref=f6e8]
    - complementary [ref=f6e9]:
        - button "Close Menu" [ref=f6e10] [cursor=pointer]
        - img "SUTH Logo" [ref=f6e15]
        - generic [ref=f6e16]:
            - generic [ref=f6e17]: หน่วยงานที่กำลังใช้งาน
            - combobox "หน่วยงานที่กำลังใช้งาน" [ref=f6e18] [cursor=pointer]:
                - option "ทุกหน่วยงาน" [selected]
                - option "คลินิกวัยรุ่น (โรงพยาบาล)"
                - option "โรงเรียนสุรวิวัฒน์ (โรงเรียน)"
            - generic [ref=f6e19]: ดูข้อมูลรวมทุกหน่วยงาน
        - navigation [ref=f6e20]:
            - generic [ref=f6e21]: หน้าหลัก
            - link "แดชบอร์ด" [ref=f6e22] [cursor=pointer]:
                - /url: /admin/dashboard
            - generic [ref=f6e27]: ทั่วไป
            - link "ข้อมูลเคส" [ref=f6e28] [cursor=pointer]:
                - /url: /admin/cases
            - link "เคสเสี่ยง" [ref=f6e33] [cursor=pointer]:
                - /url: /admin/risk-cases
            - link "ตารางนัดหมาย" [ref=f6e38] [cursor=pointer]:
                - /url: /admin/schedule
            - generic [ref=f6e43]: จัดการหน่วยงาน
            - link "จัดการฟอร์ม" [ref=f6e44] [cursor=pointer]:
                - /url: /admin/forms
            - link "จัดการคลินิก" [ref=f6e49] [cursor=pointer]:
                - /url: /admin/clinics
            - link "ผู้มารับบริการ" [ref=f6e54] [cursor=pointer]:
                - /url: /admin/members
            - link "จัดการศูนย์ช่วยเหลือ" [ref=f6e59] [cursor=pointer]:
                - /url: /admin/help-center
            - generic "ใช้กับทั้งระบบ ไม่ขึ้นกับหน่วยงานที่เลือก" [ref=f6e64]: ผู้ดูแลระบบ
            - link "หน่วยงานหลักและหน่วยงานย่อย" [ref=f6e68] [cursor=pointer]:
                - /url: /admin/organizations
            - link "ผู้ดูแลระบบและเจ้าหน้าที่" [ref=f6e73] [cursor=pointer]:
                - /url: /admin/users
            - link "บทบาทและสิทธิ์" [ref=f6e78] [cursor=pointer]:
                - /url: /admin/roles
            - link "จัดการภาพแบนเนอร์" [ref=f6e83] [cursor=pointer]:
                - /url: /admin/banner
            - generic [ref=f6e88]: บัญชีของฉัน
            - link "ข้อมูลส่วนตัว" [ref=f6e89] [cursor=pointer]:
                - /url: /admin/profile
            - link "คู่มือการใช้งาน" [ref=f6e94] [cursor=pointer]:
                - /url: /docs/admin_manual.pdf
        - button "ออกจากระบบ" [ref=f6e100] [cursor=pointer]
    - main [ref=f6e107]:
        - generic [ref=f6e108]:
            - generic [ref=f6e109]:
                - heading "หน่วยงานหลักและหน่วยงานย่อย" [level=1] [ref=f6e110]
                - paragraph [ref=f6e111]: หน่วยงานหลักใช้จัดกลุ่ม ส่วนหน่วยงานย่อยคือหน่วยที่ทำงานจริง (โรงพยาบาลหรือโรงเรียน) มีสมาชิก บทบาท และข้อมูลของตัวเอง
            - generic [ref=f6e112]:
                - button "+ หน่วยงานหลัก" [ref=f6e113] [cursor=pointer]
                - button "+ หน่วยงานย่อย" [ref=f6e114] [cursor=pointer]
        - generic [ref=f6e115]:
            - complementary "โครงสร้างหน่วยงาน" [ref=f6e116]:
                - generic [ref=f6e117]:
                    - text: โครงสร้างหน่วยงาน
                    - generic [ref=f6e118]: "4"
                - generic [ref=f6e119]:
                    - button "โรงพยาบาล หน่วยงานหลักประเภทโรงพยาบาล · 1 หน่วยงานย่อย" [ref=f6e120] [cursor=pointer]:
                        - generic [ref=f6e121]:
                            - generic [ref=f6e122]: โรงพยาบาล
                            - generic [ref=f6e123]: หน่วยงานหลักประเภทโรงพยาบาล · 1 หน่วยงานย่อย
                    - button "คลินิกวัยรุ่น โรงพยาบาล · สมาชิก 0 คน" [ref=f6e125] [cursor=pointer]:
                        - generic [ref=f6e126]:
                            - generic [ref=f6e127]: คลินิกวัยรุ่น
                            - generic [ref=f6e128]: โรงพยาบาล · สมาชิก 0 คน
                - generic [ref=f6e129]:
                    - button "โรงเรียน หน่วยงานหลักประเภทโรงเรียน · 1 หน่วยงานย่อย" [ref=f6e130] [cursor=pointer]:
                        - generic [ref=f6e131]:
                            - generic [ref=f6e132]: โรงเรียน
                            - generic [ref=f6e133]: หน่วยงานหลักประเภทโรงเรียน · 1 หน่วยงานย่อย
                    - button "โรงเรียนสุรวิวัฒน์ โรงเรียน · สมาชิก 0 คน" [ref=f6e135] [cursor=pointer]:
                        - generic [ref=f6e136]:
                            - generic [ref=f6e137]: โรงเรียนสุรวิวัฒน์
                            - generic [ref=f6e138]: โรงเรียน · สมาชิก 0 คน
            - generic [ref=f6e139]:
                - generic [ref=f6e140]:
                    - generic [ref=f6e141]:
                        - heading "รายละเอียดหน่วยงานย่อย" [level=2] [ref=f6e142]
                        - button "ปิดใช้งาน" [ref=f6e143] [cursor=pointer]
                    - generic [ref=f6e144]:
                        - generic [ref=f6e145]:
                            - text: รหัสหน่วยงาน
                            - textbox "รหัสหน่วยงานที่ระบบสร้าง" [ref=f6e146]: SUR
                        - generic [ref=f6e147]:
                            - text: อยู่ภายใต้หน่วยงานหลัก
                            - combobox "อยู่ภายใต้หน่วยงานหลัก" [ref=f6e148]:
                                - option "ยังไม่ได้อยู่ภายใต้หน่วยงานหลัก"
                                - option "โรงพยาบาล"
                                - option "โรงเรียน" [selected]
                        - generic [ref=f6e149]:
                            - text: ชื่อหน่วยงานย่อย
                            - textbox "ชื่อหน่วยงานย่อย" [ref=f6e150]: โรงเรียนสุรวิวัฒน์
                        - paragraph [ref=f6e151]:
                            - text: "ประเภท:"
                            - strong [ref=f6e152]: โรงเรียน
                            - text: (ตามหน่วยงานหลัก โรงเรียน)
                        - generic [ref=f6e153]:
                            - text: รายละเอียด
                            - textbox "รายละเอียด" [ref=f6e154]
                    - button "บันทึกหน่วยงาน" [ref=f6e156] [cursor=pointer]
                - region [ref=f6e157]:
                    - heading "สมาชิก 0" [level=2] [ref=f6e159]:
                        - text: สมาชิก
                        - generic [ref=f6e160]: "0"
                    - generic [ref=f6e161]:
                        - group "ติ๊กเลือกเจ้าหน้าที่ (เลือกได้หลายคน)" [ref=f6e162]:
                            - generic [ref=f6e164]:
                                - generic [ref=f6e165]:
                                    - generic [ref=f6e169]: ค้นหาเจ้าหน้าที่
                                    - searchbox "ค้นหาเจ้าหน้าที่" [ref=f6e170]
                                - button "เลือกที่แสดงทั้งหมด" [ref=f6e171] [cursor=pointer]
                            - list [ref=f6e172]:
                                - listitem [ref=f6e173]:
                                    - generic [ref=f6e174] [cursor=pointer]:
                                        - checkbox "ครูหนึ่ง @teacher1" [ref=f6e175]
                                        - generic [ref=f6e176]:
                                            - strong [ref=f6e177]: ครูหนึ่ง
                                            - generic [ref=f6e178]: "@teacher1"
                                - listitem [ref=f6e179]:
                                    - generic [ref=f6e180] [cursor=pointer]:
                                        - checkbox "ครูสอง @teacher2" [ref=f6e181]
                                        - generic [ref=f6e182]:
                                            - strong [ref=f6e183]: ครูสอง
                                            - generic [ref=f6e184]: "@teacher2"
                                - listitem [ref=f6e185]:
                                    - generic [ref=f6e186] [cursor=pointer]:
                                        - checkbox "พยาบาลหนึ่ง @nurse1" [ref=f6e187]
                                        - generic [ref=f6e188]:
                                            - strong [ref=f6e189]: พยาบาลหนึ่ง
                                            - generic [ref=f6e190]: "@nurse1"
                            - paragraph [ref=f6e191]: เลือกแล้ว 0 คน
                        - generic [ref=f6e192]:
                            - generic [ref=f6e193]:
                                - generic [ref=f6e194]: บทบาทในหน่วยงานนี้
                                - combobox "บทบาทในหน่วยงานนี้" [ref=f6e195]:
                                    - option "เลือกบทบาท" [selected]
                                    - option "Staff"
                            - generic [ref=f6e196]:
                                - button "ยกเลิก" [ref=f6e197] [cursor=pointer]
                                - button "เพิ่มสมาชิก" [disabled] [ref=f6e198]
                    - paragraph [ref=f6e199]: ยังไม่มีสมาชิก กด "+ เพิ่มสมาชิก" เพื่อเลือกเจ้าหน้าที่
```

# Test source

```ts
  37  |     await page.keyboard.press("Escape");
  38  |     await expect(page.getByRole("dialog")).toHaveCount(0);
  39  |     await expect(opener).toBeFocused();
  40  |     await expect(page.locator('#root')).not.toHaveAttribute('inert');
  41  |   };
  42  |
  43  |   await page.goto('/admin/school/students');
  44  |   await expect(page.getByRole('heading', {name: 'รายชื่อนักเรียน'})).toBeVisible();
  45  |   await expect(page.locator('.sch-loading-row')).toHaveCount(0);
  46  |   await audit('students');
  47  |   const addStudent = page.getByRole('button', {name: 'เพิ่มนักเรียน', exact: true});
  48  |   await addStudent.click();
  49  |   const studentForm = page.getByRole('dialog', {name: 'เพิ่มนักเรียน', exact: true});
  50  |   await expect(studentForm.getByLabel('รหัสนักเรียน')).toBeFocused();
  51  |   await expect(page.locator('#root')).toHaveAttribute('inert');
  52  |   await studentForm.getByRole('button', {name: 'บันทึก', exact: true}).click();
  53  |   await expect(studentForm.locator('[aria-invalid="true"]').first()).toHaveAttribute('aria-describedby', /error/);
  54  |   await studentForm.getByLabel('วันเกิด').fill('31/05/2556');
  55  |   await expect(studentForm.getByLabel('วันเกิด')).toHaveValue('31/05/2556');
  56  |   await audit('student-form-errors');
  57  |   await studentForm.getByRole('button', {name: 'ปิดหน้าต่าง'}).focus();
  58  |   await page.keyboard.press('Shift+Tab');
  59  |   await expect(studentForm.getByRole('button', {name: 'บันทึก', exact: true})).toBeFocused();
  60  |   await page.keyboard.press('Tab');
  61  |   await expect(studentForm.getByRole('button', {name: 'ปิดหน้าต่าง'})).toBeFocused();
  62  |   await close(addStudent);
  63  |
  64  |   const openFile = page.getByRole('button', {name: 'ดูข้อมูล ด.ช. สมชาย ใจดี'});
  65  |   const requests = [];
  66  |   page.on('request', request => { if (/StudentHealthCharts|recharts/.test(request.url())) requests.push(request.url()); });
  67  |   await openFile.click();
  68  |   const file = page.getByRole('dialog', {name: 'ด.ช. สมชาย ใจดี'});
  69  |   await expect(file.getByText('ชื่อ-นามสกุล', {exact: true})).toBeVisible();
  70  |   expect(requests).toEqual([]);
  71  |   await audit('student-general');
  72  |   await file.getByRole('tab', {name: 'ข้อมูลทั่วไป'}).focus();
  73  |   await page.keyboard.press('ArrowRight');
  74  |   await expect(file.getByRole('tab', {name: 'สุขภาพกาย'})).toBeFocused();
  75  |   await expect(file.getByRole('tab', {name: 'สุขภาพกาย'})).toHaveAttribute('aria-selected', 'true');
  76  |   await expect(file.locator('.recharts-wrapper')).toBeVisible();
  77  |   await audit('student-physical');
  78  |   const addRecord = file.getByRole('button', {name: 'บันทึกผลตรวจ'});
  79  |   await addRecord.click();
  80  |   const record = page.getByRole('dialog', {name: 'บันทึกผลตรวจร่างกาย'});
  81  |   await expect(record.getByLabel('วันที่ตรวจ')).toBeFocused();
  82  |   await record.getByLabel('วันที่ตรวจ').fill('31/02/2569');
  83  |   await record.getByRole('button', {name: 'บันทึก', exact: true}).click();
  84  |   await expect(record.getByLabel('วันที่ตรวจ')).toHaveAttribute('aria-invalid', 'true');
  85  |   await audit('physical-form-errors');
  86  |   await page.keyboard.press('Escape');
  87  |   await expect(record).toHaveCount(0);
  88  |   await expect(addRecord).toBeFocused();
  89  |   await file.getByRole('tab', {name: 'สุขภาพกาย'}).focus();
  90  |   await page.keyboard.press('End');
  91  |   await expect(file.getByRole('tab', {name: 'สุขภาพจิต'})).toBeFocused();
  92  |   await expect(file.locator('.recharts-wrapper')).toBeVisible();
  93  |   await audit('student-mental');
  94  |   await page.keyboard.press('Home');
  95  |   await expect(file.getByRole('tab', {name: 'ข้อมูลทั่วไป'})).toBeFocused();
  96  |   await page.keyboard.press('ArrowLeft');
  97  |   await expect(file.getByRole('tab', {name: 'สุขภาพจิต'})).toBeFocused();
  98  |   const activeId = await file.getByRole('tab', {name: 'สุขภาพจิต'}).getAttribute('id');
  99  |   await expect(file.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', activeId);
  100 |   await close(openFile);
  101 |
  102 |   await page.goto('/admin/cases');
  103 |   await expect(page.getByRole('button', {name: 'ด.ช. สมชาย ใจดี'})).toBeVisible();
  104 |   await audit('school-cases');
  105 |   await page.getByRole('button', {name: 'เสี่ยงสูง 1', exact: true}).click();
  106 |   await expect(page.getByRole('heading', {name: 'นักเรียนกลุ่มเสี่ยง'})).toBeVisible();
  107 |   await audit('school-cases-filtered');
  108 |
  109 |   for (const [route, title] of [['/admin/school','ชั้นปีและห้องเรียน'], ['/admin/school/teachers','รายชื่อครู'], ['/admin/school/types','ประเภทครูและนักเรียน'], ['/admin/school/students/import','นำเข้านักเรียนจาก Excel / CSV']]) {
  110 |     await page.goto(route);
  111 |     await expect(page.getByRole('heading', {name: title, exact: true})).toBeVisible();
  112 |     await expect(page.locator('.sch-loading-row')).toHaveCount(0);
  113 |     await audit(route.split('/').at(-1));
  114 |     if (route.endsWith('/teachers')) {
  115 |       const opener = page.getByRole('button', {name: 'เพิ่มครู', exact: true});
  116 |       await opener.click();
  117 |       await audit('teacher-form');
  118 |       await close(opener);
  119 |     }
  120 |     if (route === '/admin/school') {
  121 |       const opener = page.getByRole('region', {name: 'ม.1'}).getByRole('button', {name: 'แก้ไข ม.1 ห้อง 1/1', exact: true});
  122 |       await opener.click();
  123 |       await audit('classroom-form');
  124 |       await close(opener);
  125 |     }
  126 |   }
  127 |   await mockOrganizations(page, {});
  128 |   await page.goto('/admin/organizations');
  129 |   await expect(page.getByRole('heading', {name: 'หน่วยงานหลักและหน่วยงานย่อย'})).toBeVisible();
  130 |   await page.getByRole('complementary', {name: 'โครงสร้างหน่วยงาน'}).getByRole('button', {name: /โรงเรียนสุรวิวัฒน์/}).click();
  131 |   if (phone) await expect(page.getByRole('heading', {name: 'รายละเอียดหน่วยงานย่อย'})).toBeFocused();
  132 |   await audit('organization-details');
  133 |   await page.getByRole('button', {name: '+ เพิ่มสมาชิก'}).click();
  134 |   await audit('organization-members-picker');
  135 |   await testInfo.attach('hardening-report', {body: JSON.stringify({states, findings}, null, 2), contentType: 'application/json'});
  136 |   console.log(JSON.stringify({viewport: phone ? 390 : 1366, findings}));
> 137 |   expect(findings).toEqual([]);
      |                    ^ Error: expect(received).toEqual(expected) // deep equality
  138 | });
  139 |
```

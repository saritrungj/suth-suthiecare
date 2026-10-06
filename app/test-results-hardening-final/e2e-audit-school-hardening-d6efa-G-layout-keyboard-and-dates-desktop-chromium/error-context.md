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
+ Received  + 34

- Array []
+ Array [
+   Object {
+     "layout": Object {
+       "dialogs": Array [
+         Object {
+           "scrollWidth": 787,
+           "width": 560,
+         },
+       ],
+       "document": 1366,
+       "viewport": 1366,
+     },
+     "name": "student-physical",
+     "violations": Array [],
+   },
+   Object {
+     "layout": Object {
+       "dialogs": Array [
+         Object {
+           "scrollWidth": 787,
+           "width": 560,
+         },
+         Object {
+           "scrollWidth": 560,
+           "width": 560,
+         },
+       ],
+       "document": 1366,
+       "viewport": 1366,
+     },
+     "name": "physical-form-errors",
+     "violations": Array [],
+   },
+ ]
```

# Page snapshot

```yaml
- generic [ref=f6e3]:
    - complementary [ref=f6e4]:
        - generic [ref=f6e5]:
            - img "SUTH Logo" [ref=f6e7]
            - button "Toggle sidebar" [ref=f6e8] [cursor=pointer]
        - generic [ref=f6e11]:
            - generic [ref=f6e12]: หน่วยงานที่กำลังใช้งาน
            - combobox "หน่วยงานที่กำลังใช้งาน" [ref=f6e13] [cursor=pointer]:
                - option "ทุกหน่วยงาน" [selected]
                - option "คลินิกวัยรุ่น (โรงพยาบาล)"
                - option "โรงเรียนสุรวิวัฒน์ (โรงเรียน)"
            - generic [ref=f6e14]: ดูข้อมูลรวมทุกหน่วยงาน
        - navigation [ref=f6e15]:
            - generic [ref=f6e16]: หน้าหลัก
            - link "แดชบอร์ด" [ref=f6e17] [cursor=pointer]:
                - /url: /admin/dashboard
            - generic [ref=f6e22]: ทั่วไป
            - link "ข้อมูลเคส" [ref=f6e23] [cursor=pointer]:
                - /url: /admin/cases
            - link "เคสเสี่ยง" [ref=f6e28] [cursor=pointer]:
                - /url: /admin/risk-cases
            - link "ตารางนัดหมาย" [ref=f6e33] [cursor=pointer]:
                - /url: /admin/schedule
            - generic [ref=f6e38]: จัดการหน่วยงาน
            - link "จัดการฟอร์ม" [ref=f6e39] [cursor=pointer]:
                - /url: /admin/forms
            - link "จัดการคลินิก" [ref=f6e44] [cursor=pointer]:
                - /url: /admin/clinics
            - link "ผู้มารับบริการ" [ref=f6e49] [cursor=pointer]:
                - /url: /admin/members
            - link "จัดการศูนย์ช่วยเหลือ" [ref=f6e54] [cursor=pointer]:
                - /url: /admin/help-center
            - generic "ใช้กับทั้งระบบ ไม่ขึ้นกับหน่วยงานที่เลือก" [ref=f6e59]: ผู้ดูแลระบบ
            - link "หน่วยงานหลักและหน่วยงานย่อย" [ref=f6e63] [cursor=pointer]:
                - /url: /admin/organizations
            - link "ผู้ดูแลระบบและเจ้าหน้าที่" [ref=f6e68] [cursor=pointer]:
                - /url: /admin/users
            - link "บทบาทและสิทธิ์" [ref=f6e73] [cursor=pointer]:
                - /url: /admin/roles
            - link "จัดการภาพแบนเนอร์" [ref=f6e78] [cursor=pointer]:
                - /url: /admin/banner
            - generic [ref=f6e83]: บัญชีของฉัน
            - link "ข้อมูลส่วนตัว" [ref=f6e84] [cursor=pointer]:
                - /url: /admin/profile
            - link "คู่มือการใช้งาน" [ref=f6e89] [cursor=pointer]:
                - /url: /docs/admin_manual.pdf
        - button "ออกจากระบบ" [ref=f6e95] [cursor=pointer]
    - main [ref=f6e102]:
        - generic [ref=f6e103]:
            - generic [ref=f6e104]:
                - heading "หน่วยงานหลักและหน่วยงานย่อย" [level=1] [ref=f6e105]
                - paragraph [ref=f6e106]: หน่วยงานหลักใช้จัดกลุ่ม ส่วนหน่วยงานย่อยคือหน่วยที่ทำงานจริง (โรงพยาบาลหรือโรงเรียน) มีสมาชิก บทบาท และข้อมูลของตัวเอง
            - generic [ref=f6e107]:
                - button "+ หน่วยงานหลัก" [ref=f6e108] [cursor=pointer]
                - button "+ หน่วยงานย่อย" [ref=f6e109] [cursor=pointer]
        - generic [ref=f6e110]:
            - complementary "โครงสร้างหน่วยงาน" [ref=f6e111]:
                - generic [ref=f6e112]:
                    - text: โครงสร้างหน่วยงาน
                    - generic [ref=f6e113]: "4"
                - generic [ref=f6e114]:
                    - button "โรงพยาบาล หน่วยงานหลักประเภทโรงพยาบาล · 1 หน่วยงานย่อย" [ref=f6e115] [cursor=pointer]:
                        - generic [ref=f6e116]:
                            - generic [ref=f6e117]: โรงพยาบาล
                            - generic [ref=f6e118]: หน่วยงานหลักประเภทโรงพยาบาล · 1 หน่วยงานย่อย
                    - button "คลินิกวัยรุ่น โรงพยาบาล · สมาชิก 0 คน" [ref=f6e120] [cursor=pointer]:
                        - generic [ref=f6e121]:
                            - generic [ref=f6e122]: คลินิกวัยรุ่น
                            - generic [ref=f6e123]: โรงพยาบาล · สมาชิก 0 คน
                - generic [ref=f6e124]:
                    - button "โรงเรียน หน่วยงานหลักประเภทโรงเรียน · 1 หน่วยงานย่อย" [ref=f6e125] [cursor=pointer]:
                        - generic [ref=f6e126]:
                            - generic [ref=f6e127]: โรงเรียน
                            - generic [ref=f6e128]: หน่วยงานหลักประเภทโรงเรียน · 1 หน่วยงานย่อย
                    - button "โรงเรียนสุรวิวัฒน์ โรงเรียน · สมาชิก 0 คน" [ref=f6e130] [cursor=pointer]:
                        - generic [ref=f6e131]:
                            - generic [ref=f6e132]: โรงเรียนสุรวิวัฒน์
                            - generic [ref=f6e133]: โรงเรียน · สมาชิก 0 คน
            - generic [ref=f6e134]:
                - generic [ref=f6e135]:
                    - generic [ref=f6e136]:
                        - heading "รายละเอียดหน่วยงานย่อย" [level=2] [ref=f6e137]
                        - button "ปิดใช้งาน" [ref=f6e138] [cursor=pointer]
                    - generic [ref=f6e139]:
                        - generic [ref=f6e140]:
                            - text: รหัสหน่วยงาน
                            - textbox "รหัสหน่วยงานที่ระบบสร้าง" [ref=f6e141]: SUR
                        - generic [ref=f6e142]:
                            - text: อยู่ภายใต้หน่วยงานหลัก
                            - combobox "อยู่ภายใต้หน่วยงานหลัก" [ref=f6e143]:
                                - option "ยังไม่ได้อยู่ภายใต้หน่วยงานหลัก"
                                - option "โรงพยาบาล"
                                - option "โรงเรียน" [selected]
                        - generic [ref=f6e144]:
                            - text: ชื่อหน่วยงานย่อย
                            - textbox "ชื่อหน่วยงานย่อย" [ref=f6e145]: โรงเรียนสุรวิวัฒน์
                        - paragraph [ref=f6e146]:
                            - text: "ประเภท:"
                            - strong [ref=f6e147]: โรงเรียน
                            - text: (ตามหน่วยงานหลัก โรงเรียน)
                        - generic [ref=f6e148]:
                            - text: รายละเอียด
                            - textbox "รายละเอียด" [ref=f6e149]
                    - button "บันทึกหน่วยงาน" [ref=f6e151] [cursor=pointer]
                - region [ref=f6e152]:
                    - heading "สมาชิก 7" [level=2] [ref=f6e154]:
                        - text: สมาชิก
                        - generic [ref=f6e155]: "7"
                    - generic [ref=f6e156]:
                        - group "ติ๊กเลือกเจ้าหน้าที่ (เลือกได้หลายคน)" [ref=f6e157]:
                            - generic [ref=f6e159]:
                                - generic [ref=f6e160]:
                                    - generic [ref=f6e164]: ค้นหาเจ้าหน้าที่
                                    - searchbox "ค้นหาเจ้าหน้าที่" [ref=f6e165]
                                - button "เลือกที่แสดงทั้งหมด" [ref=f6e166] [cursor=pointer]
                            - list [ref=f6e167]:
                                - listitem [ref=f6e168]:
                                    - generic [ref=f6e169] [cursor=pointer]:
                                        - checkbox "ครูหนึ่ง @teacher1" [ref=f6e170]
                                        - generic [ref=f6e171]:
                                            - strong [ref=f6e172]: ครูหนึ่ง
                                            - generic [ref=f6e173]: "@teacher1"
                                - listitem [ref=f6e174]:
                                    - generic [ref=f6e175] [cursor=pointer]:
                                        - checkbox "ครูสอง @teacher2" [ref=f6e176]
                                        - generic [ref=f6e177]:
                                            - strong [ref=f6e178]: ครูสอง
                                            - generic [ref=f6e179]: "@teacher2"
                                - listitem [ref=f6e180]:
                                    - generic [ref=f6e181] [cursor=pointer]:
                                        - checkbox "พยาบาลหนึ่ง @nurse1" [ref=f6e182]
                                        - generic [ref=f6e183]:
                                            - strong [ref=f6e184]: พยาบาลหนึ่ง
                                            - generic [ref=f6e185]: "@nurse1"
                            - paragraph [ref=f6e186]: เลือกแล้ว 0 คน
                        - generic [ref=f6e187]:
                            - generic [ref=f6e188]:
                                - generic [ref=f6e189]: บทบาทในหน่วยงานนี้
                                - combobox "บทบาทในหน่วยงานนี้" [ref=f6e190]:
                                    - option "เลือกบทบาท" [selected]
                                    - option "Staff"
                            - generic [ref=f6e191]:
                                - button "ยกเลิก" [ref=f6e192] [cursor=pointer]
                                - button "เพิ่มสมาชิก" [disabled] [ref=f6e193]
                    - generic [ref=f6e194]:
                        - generic [ref=f6e198]: ค้นหาสมาชิก
                        - searchbox "ค้นหาสมาชิก" [ref=f6e199]
                    - list [ref=f6e200]:
                        - listitem [ref=f6e201]:
                            - generic [ref=f6e202]: ส
                            - generic [ref=f6e203]:
                                - strong [ref=f6e204]: สมาชิกทดสอบ 1
                                - generic [ref=f6e205]: "@member0"
                            - combobox "บทบาทของ member0" [ref=f6e206]:
                                - option "Staff" [selected]
                            - button "ถอด member0 ออกจากหน่วยงาน" [ref=f6e207] [cursor=pointer]
                        - listitem [ref=f6e211]:
                            - generic [ref=f6e212]: ส
                            - generic [ref=f6e213]:
                                - strong [ref=f6e214]: สมาชิกทดสอบ 2
                                - generic [ref=f6e215]: "@member1"
                            - combobox "บทบาทของ member1" [ref=f6e216]:
                                - option "Staff" [selected]
                            - button "ถอด member1 ออกจากหน่วยงาน" [ref=f6e217] [cursor=pointer]
                        - listitem [ref=f6e221]:
                            - generic [ref=f6e222]: ส
                            - generic [ref=f6e223]:
                                - strong [ref=f6e224]: สมาชิกทดสอบ 3
                                - generic [ref=f6e225]: "@member2"
                            - combobox "บทบาทของ member2" [ref=f6e226]:
                                - option "Staff" [selected]
                            - button "ถอด member2 ออกจากหน่วยงาน" [ref=f6e227] [cursor=pointer]
                        - listitem [ref=f6e231]:
                            - generic [ref=f6e232]: ส
                            - generic [ref=f6e233]:
                                - strong [ref=f6e234]: สมาชิกทดสอบ 4
                                - generic [ref=f6e235]: "@member3"
                            - combobox "บทบาทของ member3" [ref=f6e236]:
                                - option "Staff" [selected]
                            - button "ถอด member3 ออกจากหน่วยงาน" [ref=f6e237] [cursor=pointer]
                        - listitem [ref=f6e241]:
                            - generic [ref=f6e242]: ส
                            - generic [ref=f6e243]:
                                - strong [ref=f6e244]: สมาชิกทดสอบ 5
                                - generic [ref=f6e245]: "@member4"
                            - combobox "บทบาทของ member4" [ref=f6e246]:
                                - option "Staff" [selected]
                            - button "ถอด member4 ออกจากหน่วยงาน" [ref=f6e247] [cursor=pointer]
                        - listitem [ref=f6e251]:
                            - generic [ref=f6e252]: ส
                            - generic [ref=f6e253]:
                                - strong [ref=f6e254]: สมาชิกทดสอบ 6
                                - generic [ref=f6e255]: "@member5"
                            - combobox "บทบาทของ member5" [ref=f6e256]:
                                - option "Staff" [selected]
                            - button "ถอด member5 ออกจากหน่วยงาน" [ref=f6e257] [cursor=pointer]
                        - listitem [ref=f6e261]:
                            - generic [ref=f6e262]: ส
                            - generic [ref=f6e263]:
                                - strong [ref=f6e264]: สมาชิกทดสอบ 7
                                - generic [ref=f6e265]: "@member6"
                            - combobox "บทบาทของ member6" [ref=f6e266]:
                                - option "Staff" [selected]
                            - button "ถอด member6 ออกจากหน่วยงาน" [ref=f6e267] [cursor=pointer]
```

# Test source

```ts
  47  |   await audit('students');
  48  |   const addStudent = page.getByRole('button', {name: 'เพิ่มนักเรียน', exact: true});
  49  |   await addStudent.click();
  50  |   const studentForm = page.getByRole('dialog', {name: 'เพิ่มนักเรียน', exact: true});
  51  |   await expect(studentForm.getByLabel('รหัสนักเรียน')).toBeFocused();
  52  |   await expect(page.locator('#root')).toHaveAttribute('inert');
  53  |   await studentForm.getByRole('button', {name: 'บันทึก', exact: true}).click();
  54  |   await expect(studentForm.locator('[aria-invalid="true"]').first()).toHaveAttribute('aria-describedby', /error/);
  55  |   await studentForm.getByLabel('วันเกิด').fill('31/05/2556');
  56  |   await expect(studentForm.getByLabel('วันเกิด')).toHaveValue('31/05/2556');
  57  |   await audit('student-form-errors');
  58  |   await studentForm.getByRole('button', {name: 'ปิดหน้าต่าง'}).focus();
  59  |   await page.keyboard.press('Shift+Tab');
  60  |   await expect(studentForm.getByRole('button', {name: 'บันทึก', exact: true})).toBeFocused();
  61  |   await page.keyboard.press('Tab');
  62  |   await expect(studentForm.getByRole('button', {name: 'ปิดหน้าต่าง'})).toBeFocused();
  63  |   await close(addStudent);
  64  |
  65  |   const openFile = page.getByRole('button', {name: 'ดูข้อมูล ด.ช. สมชาย ใจดี'});
  66  |   const requests = [];
  67  |   page.on('request', request => { if (/StudentHealthCharts|recharts/.test(request.url())) requests.push(request.url()); });
  68  |   await openFile.click();
  69  |   const file = page.getByRole('dialog', {name: 'ด.ช. สมชาย ใจดี'});
  70  |   await expect(file.getByText('ชื่อ-นามสกุล', {exact: true})).toBeVisible();
  71  |   expect(requests).toEqual([]);
  72  |   await audit('student-general');
  73  |   await file.getByRole('tab', {name: 'ข้อมูลทั่วไป'}).focus();
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
> 147 |   expect(findings).toEqual([]);
      |                    ^ Error: expect(received).toEqual(expected) // deep equality
  148 | });
  149 |
```

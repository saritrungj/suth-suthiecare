# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pdpa-settings-ui.spec.js >> settings save independently, preserve other edits, and report the retention preview
- Location: e2e\pdpa-settings-ui.spec.js:69:1

# Error details

```
Error: locator.selectOption: Error: strict mode violation: getByRole('region', { name: 'การตั้งค่าความปลอดภัยและ PDPA' }).locator('details').filter({ has: locator('summary').filter({ hasText: 'วัตถุประสงค์และประกาศ' }) }).getByLabel('ฐานการประมวลผล') resolved to 2 elements:
    1) <select required="">…</select> aka getByLabel('ฐานการประมวลผลที่ผู้รับผิดชอบยืนยัน เลือกฐานการประมวลผลความยินยอมการดูแลรักษาสุข')
    2) <input type="checkbox"/> aka getByRole('checkbox', { name: 'ผู้รับผิดชอบ PDPA' })

Call log:
  - waiting for getByRole('region', { name: 'การตั้งค่าความปลอดภัยและ PDPA' }).locator('details').filter({ has: locator('summary').filter({ hasText: 'วัตถุประสงค์และประกาศ' }) }).getByLabel('ฐานการประมวลผล')

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
                - option "หน่วยงานทดสอบ (โรงพยาบาล)" [selected]
            - generic [ref=e14]: หน่วยงานย่อยประเภทโรงพยาบาล
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
                - heading "หน่วยงานหลักและหน่วยงานย่อย" [level=1] [ref=e131]
                - paragraph [ref=e132]: หน่วยงานหลักใช้จัดกลุ่ม ส่วนหน่วยงานย่อยคือหน่วยที่ทำงานจริง (โรงพยาบาลหรือโรงเรียน) มีสมาชิก บทบาท และข้อมูลของตัวเอง
            - generic [ref=e133]:
                - button "+ หน่วยงานหลัก" [ref=e134] [cursor=pointer]
                - button "+ หน่วยงานย่อย" [ref=e135] [cursor=pointer]
        - generic [ref=e136]:
            - complementary "โครงสร้างหน่วยงาน" [ref=e137]:
                - generic [ref=e138]:
                    - text: โครงสร้างหน่วยงาน
                    - generic [ref=e139]: "3"
                - generic [ref=e140]:
                    - button "โรงพยาบาลสาธิต หน่วยงานหลักประเภทโรงพยาบาล · 2 หน่วยงานย่อย" [ref=e141] [cursor=pointer]:
                        - generic [ref=e142]:
                            - generic [ref=e143]: โรงพยาบาลสาธิต
                            - generic [ref=e144]: หน่วยงานหลักประเภทโรงพยาบาล · 2 หน่วยงานย่อย
                    - generic [ref=e145]:
                        - button "หน่วยงานต้นทาง (ข้อมูลจำลอง) โรงพยาบาล · สมาชิก undefined คน" [ref=e146] [cursor=pointer]:
                            - generic [ref=e147]:
                                - generic [ref=e148]: หน่วยงานต้นทาง (ข้อมูลจำลอง)
                                - generic [ref=e149]: โรงพยาบาล · สมาชิก undefined คน
                        - button "หน่วยงานปลายทาง (ข้อมูลจำลอง) โรงพยาบาล · สมาชิก undefined คน" [ref=e150] [cursor=pointer]:
                            - generic [ref=e151]:
                                - generic [ref=e152]: หน่วยงานปลายทาง (ข้อมูลจำลอง)
                                - generic [ref=e153]: โรงพยาบาล · สมาชิก undefined คน
            - generic [ref=e154]:
                - generic [ref=e155]:
                    - generic [ref=e156]:
                        - heading "รายละเอียดหน่วยงานย่อย" [level=2] [ref=e157]
                        - button "ปิดใช้งาน" [ref=e158] [cursor=pointer]
                    - generic [ref=e159]:
                        - generic [ref=e160]:
                            - text: รหัสหน่วยงาน
                            - textbox "รหัสหน่วยงานที่ระบบสร้าง" [ref=e161]: A
                        - generic [ref=e162]:
                            - text: อยู่ภายใต้หน่วยงานหลัก
                            - combobox "อยู่ภายใต้หน่วยงานหลัก" [ref=e163]:
                                - option "ยังไม่ได้อยู่ภายใต้หน่วยงานหลัก"
                                - option "โรงพยาบาลสาธิต" [selected]
                        - generic [ref=e164]:
                            - text: ชื่อหน่วยงานย่อย
                            - textbox "ชื่อหน่วยงานย่อย" [ref=e165]: หน่วยงานต้นทาง (ข้อมูลจำลอง)
                        - paragraph [ref=e166]:
                            - text: "ประเภท:"
                            - strong [ref=e167]: โรงพยาบาล
                            - text: (ตามหน่วยงานหลัก โรงพยาบาลสาธิต)
                        - generic [ref=e168]:
                            - text: รายละเอียด
                            - textbox "รายละเอียด" [ref=e169]
                    - button "บันทึกหน่วยงาน" [ref=e171] [cursor=pointer]
                - region [ref=e172]:
                    - generic [ref=e173]:
                        - heading "สมาชิก 1" [level=2] [ref=e174]:
                            - text: สมาชิก
                            - generic [ref=e175]: "1"
                        - button "+ เพิ่มสมาชิก" [ref=e176] [cursor=pointer]
                    - list [ref=e177]:
                        - listitem [ref=e178]:
                            - generic [ref=e179]: เ
                            - generic [ref=e180]:
                                - strong [ref=e181]: เจ้าหน้าที่สาธิต
                                - generic [ref=e182]: "@demo-staff"
                            - combobox "บทบาทของ demo-staff" [ref=e183]:
                                - option "Staff" [selected]
                            - button "ถอด demo-staff ออกจากหน่วยงาน" [ref=e184] [cursor=pointer]
                - region "บทบาทและสิทธิ์ในหน่วยงาน" [ref=e188]:
                    - generic [ref=e190]:
                        - heading "บทบาทและสิทธิ์ในหน่วยงาน" [level=2] [ref=e191]
                        - paragraph [ref=e192]: กำหนดสิทธิ์เฉพาะ หน่วยงานต้นทาง (ข้อมูลจำลอง) บทบาทชื่อเดียวกันในหน่วยงานอื่นตั้งสิทธิ์ต่างกันได้ สิทธิ์ System Admin แยกจากส่วนนี้
                    - generic [ref=e194]:
                        - text: บทบาทที่ตั้งสิทธิ์
                        - combobox "บทบาทที่ตั้งสิทธิ์" [ref=e195]:
                            - option "เลือกบทบาท" [selected]
                            - option "Staff"
                    - paragraph [ref=e199]: เลือกบทบาทเพื่อดูและกำหนดสิทธิ์ในหน่วยงานนี้
                - region "การตั้งค่าความปลอดภัยและ PDPA" [ref=e200]:
                    - generic [ref=e202]:
                        - heading "ความปลอดภัยและ PDPA" [level=2] [ref=e203]
                        - paragraph [ref=e204]: จัดการการส่งต่อ การแจ้งเตือน และการใช้ข้อมูลเฉพาะหน่วยงานนี้ เลือกหัวข้อที่ต้องการตั้งค่า
                    - group [ref=e205]:
                        - generic "หน่วยงานปลายทางที่อนุญาตให้ส่งต่อ กำหนดคู่ส่งต่อและตรวจปลายทางที่เปิดใช้งาน" [ref=e206] [cursor=pointer]:
                            - generic [ref=e211]:
                                - strong [ref=e212]: หน่วยงานปลายทางที่อนุญาตให้ส่งต่อ
                                - generic [ref=e213]: กำหนดคู่ส่งต่อและตรวจปลายทางที่เปิดใช้งาน
                        - generic [ref=e216]:
                            - paragraph [ref=e217]: การปิดปลายทางหยุดการส่งต่อใหม่ ประวัติเดิมยังติดตามได้
                            - list [ref=e218]:
                                - listitem [ref=e219]:
                                    - generic [ref=e220] [cursor=pointer]:
                                        - checkbox "หน่วยงานปลายทาง (ข้อมูลจำลอง)" [ref=e221]
                                        - generic [ref=e222]: หน่วยงานปลายทาง (ข้อมูลจำลอง)
                            - status [ref=e223]:
                                - generic [ref=e227]: บันทึกคู่ส่งต่อแล้ว
                            - generic [ref=e228]:
                                - generic [ref=e229]: อนุญาต 0 หน่วยงาน
                                - button "บันทึกคู่ส่งต่อ" [ref=e230] [cursor=pointer]
                    - group [ref=e235]:
                        - generic "กลุ่มแจ้งเตือน Telegram ของหน่วยงาน กำหนดปลายทางที่ตรวจสอบสมาชิกแล้ว" [ref=e236] [cursor=pointer]:
                            - generic [ref=e240]:
                                - strong [ref=e241]: กลุ่มแจ้งเตือน Telegram ของหน่วยงาน
                                - generic [ref=e242]: กำหนดปลายทางที่ตรวจสอบสมาชิกแล้ว
                        - generic [ref=e246]:
                            - generic [ref=e247]:
                                - paragraph [ref=e248]:
                                    - text: "ปลายทางปัจจุบัน:"
                                    - strong [ref=e249]: "****1234"
                                - generic [ref=e250]: เปิดแจ้งเตือน
                            - generic [ref=e251]:
                                - text: Chat ID ใหม่
                                - textbox "Chat ID ใหม่ กรอก Chat ID ของหน่วยงานเมื่อต้องการเปลี่ยนปลายทางหรือสถานะการแจ้งเตือน" [ref=e252]
                                - generic [ref=e253]: กรอก Chat ID ของหน่วยงานเมื่อต้องการเปลี่ยนปลายทางหรือสถานะการแจ้งเตือน
                            - generic [ref=e254] [cursor=pointer]:
                                - checkbox "เปิดแจ้งเตือน" [checked] [ref=e255]
                                - generic [ref=e256]: เปิดแจ้งเตือน
                            - generic [ref=e257] [cursor=pointer]:
                                - checkbox "ตรวจสมาชิกและปลายทางกับผู้รับผิดชอบหน่วยงานแล้ว" [ref=e258]
                                - generic [ref=e259]: ตรวจสมาชิกและปลายทางกับผู้รับผิดชอบหน่วยงานแล้ว
                            - status [ref=e260]:
                                - generic [ref=e264]: บันทึกปลายทางแจ้งเตือนแล้ว
                            - button "บันทึกปลายทาง" [disabled] [ref=e266]
                    - group [ref=e271]:
                        - generic "สิทธิ์ข้อมูลละเอียดรายสมาชิก กำหนดการเปิดข้อมูลส่วนบุคคลและสุขภาพรายคน" [ref=e272] [cursor=pointer]:
                            - generic [ref=e275]:
                                - strong [ref=e276]: สิทธิ์ข้อมูลละเอียดรายสมาชิก
                                - generic [ref=e277]: กำหนดการเปิดข้อมูลส่วนบุคคลและสุขภาพรายคน
                        - generic [ref=e280]:
                            - paragraph [ref=e281]: สิทธิ์เหล่านี้ใช้ร่วมกับสิทธิ์อ่านและขอบเขตข้อมูลเดิม
                            - article [ref=e282]:
                                - generic [ref=e283]:
                                    - generic [ref=e284]:
                                        - strong [ref=e285]: เจ้าหน้าที่สาธิต
                                        - paragraph [ref=e286]: Staff
                                    - button "ตรวจสิทธิ์" [ref=e287] [cursor=pointer]
                                - generic [ref=e288]:
                                    - generic [ref=e289] [cursor=pointer]:
                                        - checkbox "เปิดข้อมูลส่วนบุคคลเต็ม" [checked] [ref=e290]
                                        - generic [ref=e291]: เปิดข้อมูลส่วนบุคคลเต็ม
                                    - generic [ref=e292] [cursor=pointer]:
                                        - checkbox "เปิดข้อมูลสุขภาพ" [checked] [ref=e293]
                                        - generic [ref=e294]: เปิดข้อมูลสุขภาพ
                                - button "บันทึกสิทธิ์" [ref=e296] [cursor=pointer]
                                - status [ref=e301]:
                                    - generic [ref=e305]: บันทึกสิทธิ์ของสมาชิกแล้ว
                    - group [ref=e306]:
                        - generic "วัตถุประสงค์และประกาศความเป็นส่วนตัว เลือกฟอร์มและบันทึกประกาศที่ผู้รับผิดชอบยืนยันแล้ว" [ref=e307] [cursor=pointer]:
                            - generic [ref=e311]:
                                - strong [ref=e312]: วัตถุประสงค์และประกาศความเป็นส่วนตัว
                                - generic [ref=e313]: เลือกฟอร์มและบันทึกประกาศที่ผู้รับผิดชอบยืนยันแล้ว
                        - generic [ref=e317]:
                            - generic [ref=e319]:
                                - text: ฟอร์ม
                                - combobox "ฟอร์ม" [ref=e320]:
                                    - option "เลือกฟอร์ม"
                                    - option "ฟอร์มสาธิต" [selected]
                            - generic [ref=e321]:
                                - generic [ref=e322]:
                                    - text: รหัสวัตถุประสงค์
                                    - textbox "รหัสวัตถุประสงค์ ใช้ตัวอักษรอังกฤษ ตัวเลข จุด ขีดกลาง หรือขีดล่าง" [ref=e323]: demo
                                    - generic [ref=e324]: ใช้ตัวอักษรอังกฤษ ตัวเลข จุด ขีดกลาง หรือขีดล่าง
                                - generic [ref=e325]:
                                    - text: รุ่นประกาศ
                                    - textbox "รุ่นประกาศ เมื่อแก้เนื้อหาประกาศเดิม ต้องใช้รุ่นใหม่" [active] [ref=e326]: v1
                                    - generic [ref=e327]: เมื่อแก้เนื้อหาประกาศเดิม ต้องใช้รุ่นใหม่
                                - generic [ref=e328]:
                                    - text: ฐานการประมวลผลที่ผู้รับผิดชอบยืนยัน
                                    - combobox "ฐานการประมวลผลที่ผู้รับผิดชอบยืนยัน" [ref=e329]:
                                        - option "เลือกฐานการประมวลผล" [selected]
                                        - option "ความยินยอม"
                                        - option "การดูแลรักษาสุขภาพ"
                                        - option "การปฏิบัติตามกฎหมาย"
                                        - option "ภารกิจเพื่อประโยชน์สาธารณะ"
                                        - option "การป้องกันอันตรายต่อชีวิต"
                                        - option "การปฏิบัติตามสัญญา"
                                        - option "ประโยชน์โดยชอบด้วยกฎหมาย"
                                - generic [ref=e330]:
                                    - text: ข้อความประกาศ
                                    - textbox "ข้อความประกาศ" [ref=e331]
                            - generic [ref=e332] [cursor=pointer]:
                                - checkbox "ผู้รับผิดชอบ PDPA ยืนยันข้อความและฐานการประมวลผลแล้ว" [ref=e333]
                                - generic [ref=e334]: ผู้รับผิดชอบ PDPA ยืนยันข้อความและฐานการประมวลผลแล้ว
                            - button "บันทึกประกาศ" [disabled] [ref=e336]
                    - group [ref=e341]:
                        - generic "คำขอใช้สิทธิ ตรวจสอบตัวตนและติดตามการพิจารณาคำขอ" [ref=e342] [cursor=pointer]:
                            - generic [ref=e347]:
                                - strong [ref=e348]: คำขอใช้สิทธิ
                                - generic [ref=e349]: ตรวจสอบตัวตนและติดตามการพิจารณาคำขอ
                    - group [ref=e352]:
                        - generic "อายุเก็บข้อมูลและการตรวจรายการก่อนลบ บันทึกนโยบายและตรวจจำนวนรายการ ระบบยังไม่ลบอัตโนมัติ" [ref=e353] [cursor=pointer]:
                            - generic [ref=e357]:
                                - strong [ref=e358]: อายุเก็บข้อมูลและการตรวจรายการก่อนลบ
                                - generic [ref=e359]: บันทึกนโยบายและตรวจจำนวนรายการ ระบบยังไม่ลบอัตโนมัติ
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import AxeBuilder from '@axe-core/playwright';
  3   | import { mockAdminApi, mockPublicApi } from './helpers/api-mocks.js';
  4   |
  5   | const organizations = [
  6   |   { id: 10, name: 'โรงพยาบาลสาธิต', code: 'DEMO', kind: 'main', org_level: 'main', org_type: 'hospital', status: 'active', child_count: 2 },
  7   |   { id: 1, name: 'หน่วยงานต้นทาง (ข้อมูลจำลอง)', code: 'A', kind: 'unit', org_level: 'unit', org_type: 'hospital', status: 'active', parent_id: 10 },
  8   |   { id: 2, name: 'หน่วยงานปลายทาง (ข้อมูลจำลอง)', code: 'B', kind: 'unit', org_level: 'unit', org_type: 'hospital', status: 'active', parent_id: 10 },
  9   | ];
  10  | async function setup(page, received = {}, options = {}) {
  11  |   await mockAdminApi(page);
  12  |   await page.addInitScript(() => { document.cookie='suth_staff_session=synthetic-session; path=/'; localStorage.setItem('suth_active_organization_1','1'); localStorage.setItem('i18nextLng','th'); });
  13  |   await page.route('**/api/**', async route => {
  14  |     const { pathname } = new URL(route.request().url()), method=route.request().method();
  15  |     if (pathname === '/api/organizations') return route.fulfill({ json: organizations });
  16  |     if (pathname === '/api/organizations/1/members') return route.fulfill({ json: [{ id: 17, user_id: 5, name: 'เจ้าหน้าที่สาธิต', username: 'demo-staff', role_id: 3, role_name: 'Staff', status: 'active' }] });
  17  |     if (pathname === '/api/roles') return route.fulfill({ json: [{ id: 3, name: 'Staff' }] });
  18  |     if (pathname.endsWith('/roles/3/permissions')) {
  19  |       if(method==='PUT'){ received.role=route.request().postDataJSON(); return route.fulfill({ json: { success:true,version:2 } }); }
  20  |       return route.fulfill({ json: { permissions: ['cases.view'],version:1,configured:true } });
  21  |     }
  22  |     if(pathname.endsWith('/referral-destinations')){
  23  |       if(method==='PUT'){received.referral=route.request().postDataJSON();return route.fulfill({json:{success:true}});}
  24  |       return route.fulfill({json:[]});
  25  |     }
  26  |     if(pathname.endsWith('/notification-target')){
  27  |       if(method==='PUT'){received.notification=route.request().postDataJSON();return route.fulfill({json:{success:true}});}
  28  |       if(options.notificationFailure)return route.fulfill({status:503,json:{code:'UNAVAILABLE'}});
  29  |       return route.fulfill({json:{destination_masked:'****1234',enabled:true,verified_at:'2026-10-01'}});
  30  |     }
  31  |     if(pathname.endsWith('/data-permissions')){
  32  |       if(method==='PUT'){received.member=route.request().postDataJSON();return route.fulfill({json:{success:true}});}
  33  |       return route.fulfill({json:[{permission_key:'pii.view',granted:true},{permission_key:'clinical.view',granted:false}]});
  34  |     }
  35  |     if(pathname==='/api/pdpa/requests') return route.fulfill({json:[{id:7,request_type:'access',status:'submitted',version:1,detail:'คำขอข้อมูลสาธิต ไม่มีข้อมูลผู้รับบริการจริง',created_at:'2026-10-03'}]});
  36  |     if(/\/purposes\/\d+$/.test(pathname)){received.purpose=route.request().postDataJSON();return route.fulfill({json:{success:true}});}
  37  |     if(pathname.endsWith('/purposes'))return route.fulfill({json:[]});
  38  |     if(pathname.endsWith('/retention/dry-run'))return route.fulfill({json:{dry_run:true,candidates:12,automatic_deletion:false}});
  39  |     if(pathname.endsWith('/retention'))return route.fulfill({json:[{data_type:'form_responses',retention_days:365,version:1}]});
  40  |     if(pathname==='/api/forms')return route.fulfill({json:[{id:101,organization_id:1,title:'ฟอร์มสาธิต'}]});
  41  |     return route.fallback();
  42  |   });
  43  |   await page.goto('/admin/organizations');
  44  |   await page.getByRole('complementary',{name:'โครงสร้างหน่วยงาน'}).getByRole('button',{name:/หน่วยงานต้นทาง/}).click();
  45  | }
  46  |
  47  | test('new management sections follow the existing controls on desktop and mobile', async ({page},testInfo) => {
  48  |   await setup(page);
  49  |   const role=page.getByRole('region',{name:'บทบาทและสิทธิ์ในหน่วยงาน',exact:true});
  50  |   await role.getByLabel('บทบาทที่ตั้งสิทธิ์').selectOption('3');
  51  |   await expect(role.getByRole('checkbox',{name:'ดูข้อมูล'}).first()).toBeAttached();
  52  |   if(process.env.PDPA_UI_BASELINE==='1'){
  53  |     await role.scrollIntoViewIfNeeded();
  54  |     await page.screenshot({path:`../outputs/pdpa/evidence/ui-before-${testInfo.project.name}.png`});
  55  |     return;
  56  |   }
  57  |   await role.scrollIntoViewIfNeeded();
  58  |   await page.screenshot({path:`../outputs/pdpa/evidence/ui-role-${testInfo.project.name}.png`});
  59  |   const settings=page.getByRole('region',{name:'การตั้งค่าความปลอดภัยและ PDPA'});
  60  |   await settings.locator('summary').filter({hasText:'กลุ่มแจ้งเตือน Telegram'}).click();
  61  |   await settings.getByLabel('Chat ID ใหม่').fill('-100123456');
  62  |   await settings.scrollIntoViewIfNeeded();
  63  |   await page.screenshot({path:`../outputs/pdpa/evidence/ui-pdpa-${testInfo.project.name}.png`});
  64  |   const results=await new AxeBuilder({page}).include('.management-settings').analyze();
  65  |   expect(results.violations).toEqual([]);
  66  |   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  67  | });
  68  |
  69  | test('settings save independently, preserve other edits, and report the retention preview',async({page},testInfo)=>{
  70  |   const received={}; await setup(page,received);
  71  |   const settings=page.getByRole('region',{name:'การตั้งค่าความปลอดภัยและ PDPA'});
  72  |   const panel=title=>settings.locator('details').filter({has:page.locator('summary').filter({hasText:title})});
  73  |   const telegram=panel('กลุ่มแจ้งเตือน Telegram'); await telegram.locator('summary').click();
  74  |   await telegram.getByLabel('Chat ID ใหม่').fill('-100123456');
  75  |   const referral=panel('หน่วยงานปลายทางที่อนุญาต'); await referral.locator('summary').click();
  76  |   await referral.getByRole('checkbox',{name:organizations[2].name,exact:true}).check();
  77  |   await referral.getByRole('button',{name:'บันทึกคู่ส่งต่อ'}).click();
  78  |   await expect(referral.getByRole('status')).toContainText('บันทึกคู่ส่งต่อแล้ว');
  79  |   await expect(telegram.getByLabel('Chat ID ใหม่')).toHaveValue('-100123456');
  80  |   await telegram.getByRole('checkbox',{name:'ตรวจสมาชิกและปลายทาง'}).check();
  81  |   await telegram.getByRole('button',{name:'บันทึกปลายทาง',exact:true}).click();
  82  |   await expect.poll(()=>received.notification).toEqual({destination:'-100123456',enabled:true,verified:true});
  83  |   const member=panel('สิทธิ์ข้อมูลละเอียด'); await member.locator('summary').click();
  84  |   await member.getByRole('button',{name:'ตรวจสิทธิ์',exact:true}).click();
  85  |   await expect(member.getByRole('checkbox',{name:'เปิดข้อมูลส่วนบุคคลเต็ม'})).toBeChecked();
  86  |   await member.getByRole('checkbox',{name:'เปิดข้อมูลสุขภาพ'}).check();
  87  |   await member.getByRole('button',{name:'บันทึกสิทธิ์',exact:true}).click();
  88  |   await expect.poll(()=>received.member).toEqual({permissions:{'pii.view':true,'clinical.view':true}});
  89  |   const purpose=panel('วัตถุประสงค์และประกาศ'); await purpose.locator('summary').click();
  90  |   await purpose.getByRole('combobox',{name:'ฟอร์ม',exact:true}).selectOption('101');
  91  |   await purpose.getByLabel('รหัสวัตถุประสงค์').fill('demo');
  92  |   await purpose.getByLabel('รุ่นประกาศ').fill('v1');
> 93  |   await purpose.getByLabel('ฐานการประมวลผล').selectOption('consent');
      |                                              ^ Error: locator.selectOption: Error: strict mode violation: getByRole('region', { name: 'การตั้งค่าความปลอดภัยและ PDPA' }).locator('details').filter({ has: locator('summary').filter({ hasText: 'วัตถุประสงค์และประกาศ' }) }).getByLabel('ฐานการประมวลผล') resolved to 2 elements:
  94  |   await purpose.getByLabel('ข้อความประกาศ').fill('ประกาศสาธิตสำหรับตรวจหน้าจอ ไม่มีข้อมูลผู้รับบริการจริง');
  95  |   await purpose.getByRole('checkbox',{name:'ผู้รับผิดชอบ PDPA'}).check();
  96  |   await purpose.getByRole('button',{name:'บันทึกประกาศ'}).scrollIntoViewIfNeeded();
  97  |   await page.screenshot({path:`../outputs/pdpa/evidence/ui-purpose-${testInfo.project.name}.png`});
  98  |   await purpose.getByRole('button',{name:'บันทึกประกาศ'}).click();
  99  |   await expect.poll(()=>received.purpose?.notice_version).toBe('v1');
  100 |   const requests=panel('คำขอใช้สิทธิ'); await requests.locator('summary').click();
  101 |   await expect(requests.getByText('รอตรวจสอบตัวตน')).toBeVisible();
  102 |   const retention=panel('อายุเก็บข้อมูล'); await retention.locator('summary').click();
  103 |   await retention.getByRole('button',{name:'ตรวจรายการโดยไม่ลบ'}).click();
  104 |   await expect(retention.getByRole('status')).toContainText('พบ 12 รายการตามนโยบาย ยังไม่ได้ลบข้อมูล');
  105 | });
  106 |
  107 | test('a failed section does not block the other settings',async({page})=>{
  108 |   await setup(page,{}, {notificationFailure:true});
  109 |   const settings=page.getByRole('region',{name:'การตั้งค่าความปลอดภัยและ PDPA'});
  110 |   await settings.locator('summary').filter({hasText:'กลุ่มแจ้งเตือน Telegram'}).click();
  111 |   await expect(settings.getByRole('alert')).toContainText('โหลดปลายทางแจ้งเตือนไม่สำเร็จ');
  112 |   await settings.locator('summary').filter({hasText:'หน่วยงานปลายทางที่อนุญาต'}).click();
  113 |   await expect(settings.getByRole('checkbox',{name:organizations[2].name,exact:true})).toBeEnabled();
  114 | });
  115 |
  116 | test('patient requests retain input on failure and show readable status after retry',async({page},testInfo)=>{
  117 |   await mockPublicApi(page);
  118 |   await page.addInitScript(()=>{document.cookie='suth_patient_session=synthetic-session; path=/';localStorage.setItem('i18nextLng','th');});
  119 |   await page.route('**/api/patient/history',route=>route.fulfill({json:{success:true,profile:{id:1,display_name:'บัญชีสาธิต',status:'active'},masterCases:[],responses:[]}}));
  120 |   await page.route('**/api/patient/privacy/organizations',route=>route.fulfill({json:[organizations[1]]}));
  121 |   let fail=true, received;
  122 |   await page.route('**/api/patient/privacy/requests',route=>{
  123 |     if(route.request().method()==='POST'){
  124 |       if(fail)return route.fulfill({status:503,json:{code:'UNAVAILABLE'}});
  125 |       received=route.request().postDataJSON();return route.fulfill({status:201,json:{id:7}});
  126 |     }
  127 |     return route.fulfill({json:fail?[]:[{id:7,request_type:'access',status:'submitted',created_at:'2026-10-03'}]});
  128 |   });
  129 |   await page.goto('/history/result');
  130 |   const section=page.getByRole('region',{name:'คำขอเกี่ยวกับข้อมูลส่วนบุคคล'});
  131 |   await section.locator('summary').click();
  132 |   await section.getByRole('combobox',{name:'หน่วยงาน',exact:true}).selectOption('1');
  133 |   await section.getByRole('textbox',{name:/^รายละเอียด/}).fill('ขอข้อมูลสาธิต');
  134 |   await section.getByRole('button',{name:'ส่งคำขอ',exact:true}).click();
  135 |   await expect(section.getByRole('alert')).toContainText('ส่งคำขอไม่สำเร็จ');
  136 |   await expect(section.getByRole('textbox',{name:/^รายละเอียด/})).toHaveValue('ขอข้อมูลสาธิต');
  137 |   fail=false;await section.getByRole('button',{name:'ส่งคำขอ',exact:true}).click();
  138 |   await expect.poll(()=>received).toEqual({organization_id:1,request_type:'access',detail:'ขอข้อมูลสาธิต'});
  139 |   await expect(section.getByText('รอตรวจสอบตัวตน')).toBeVisible();
  140 |   await section.scrollIntoViewIfNeeded();
  141 |   await page.screenshot({path:`../outputs/pdpa/evidence/ui-patient-${testInfo.project.name}.png`});
  142 |   expect((await new AxeBuilder({page}).include('.patient-privacy').analyze()).violations).toEqual([]);
  143 |   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  144 | });
  145 |
  146 | test('privacy notice sits with the form and consent remains keyboard accessible',async({page},testInfo)=>{
  147 |   await mockPublicApi(page);
  148 |   await page.addInitScript(()=>localStorage.setItem('i18nextLng','th'));
  149 |   await page.route('**/api/forms/101',route=>route.fulfill({json:{id:101,title:'แบบประเมินสาธิต',description:'ใช้ข้อมูลจำลองสำหรับตรวจหน้าจอ',questions:[],theme:{},login_enforcement:'none'}}));
  150 |   await page.route('**/api/forms/101/privacy-notice',route=>route.fulfill({json:{notice_version:'demo-v1',legal_basis:'consent',notice_text:'ประกาศสำหรับทดสอบการแสดงผลเท่านั้น\nไม่มีข้อมูลผู้รับบริการจริง'}}));
  151 |   await page.goto('/assessment/101');
  152 |   const notice=page.getByRole('region',{name:'ประกาศความเป็นส่วนตัว'});
  153 |   await notice.locator('summary').click();
  154 |   await expect(notice.getByText('ไม่มีข้อมูลผู้รับบริการจริง',{exact:false})).toBeVisible();
  155 |   const consent=notice.getByRole('checkbox');await consent.focus();await page.keyboard.press('Space');
  156 |   await expect(consent).toBeChecked();
  157 |   await notice.scrollIntoViewIfNeeded();
  158 |   await page.screenshot({path:`../outputs/pdpa/evidence/ui-notice-${testInfo.project.name}.png`});
  159 |   expect((await new AxeBuilder({page}).include('.form-privacy-notice').analyze()).violations).toEqual([]);
  160 |   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  161 | });
  162 |
  163 | test('patient-visible case note uses the existing case workspace controls',async({page},testInfo)=>{
  164 |   await mockAdminApi(page);
  165 |   await page.addInitScript(()=>{document.cookie='suth_staff_session=synthetic-session; path=/';localStorage.setItem('i18nextLng','th');localStorage.setItem('suth_active_organization_1','1');});
  166 |   const response={id:101,master_case_id:10,form_id:1,clinic_type:'general',form_title:'ฟอร์มสาธิต',submitted_at:'2026-10-03T09:00:00+07:00',summary_data:{display_name:'บัญชีสาธิต',raw_answers:{}}};
  167 |   await page.route('**/api/**',route=>{
  168 |     const {pathname}=new URL(route.request().url());
  169 |     if(pathname.endsWith('/forms'))return route.fulfill({json:[{id:1,title:response.form_title,status:'published',clinic_type:'general'}]});
  170 |     if(pathname.endsWith('/forms/1'))return route.fulfill({json:{id:1,title:response.form_title,questions:[]}});
  171 |     if(pathname.endsWith('/forms/1/responses'))return route.fulfill({json:[response]});
  172 |     if(pathname.endsWith('/master-cases/by-id/10')||pathname.endsWith('/master-cases/10/person-timeline'))return route.fulfill({json:{masterCases:[{id:10,status:'Open'}],responses:[response]}});
  173 |     if(/\/(staffs|status-options|case-statuses|services|templates|answers|logs|appointments)$/.test(pathname))return route.fulfill({json:[]});
  174 |     return route.fallback();
  175 |   });
  176 |   await page.goto('/admin/cases');
  177 |   await page.getByRole('button',{name:'บัญชีสาธิต',exact:true}).click();
  178 |   await page.getByRole('tab',{name:/จัดการ|ติดตาม|ดำเนินการ/}).first().click();
  179 |   const checkbox=page.getByRole('checkbox',{name:/แสดงบันทึกนี้ในประวัติ/});
  180 |   await checkbox.check();await expect(checkbox).toBeChecked();
  181 |   await checkbox.scrollIntoViewIfNeeded();
  182 |   await page.screenshot({path:`../outputs/pdpa/evidence/ui-case-note-${testInfo.project.name}.png`});
  183 |   expect((await new AxeBuilder({page}).include('.cdm-note-visibility').analyze()).violations).toEqual([]);
  184 | });
  185 |
```

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pdpa-flows.spec.js >> System Admin configures explicit referral destinations in a unit with session CSRF
- Location: e2e\pdpa-flows.spec.js:18:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /หน่วยงานต้นทางทดสอบ หน่วยงานย่อย/ })

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
            - generic [ref=e43]: จัดการหน่วยงาน
            - link "จัดการฟอร์ม" [ref=e44] [cursor=pointer]:
                - /url: /admin/forms
            - link "จัดการคลินิก" [ref=e49] [cursor=pointer]:
                - /url: /admin/clinics
            - link "ผู้มารับบริการ" [ref=e54] [cursor=pointer]:
                - /url: /admin/members
            - link "จัดการศูนย์ช่วยเหลือ" [ref=e59] [cursor=pointer]:
                - /url: /admin/help-center
            - generic "ใช้กับทั้งระบบ ไม่ขึ้นกับหน่วยงานที่เลือก" [ref=e64]: จัดการหลักของระบบ
            - link "หน่วยงานหลักและหน่วยงานย่อย" [ref=e68] [cursor=pointer]:
                - /url: /admin/organizations
            - link "ผู้ดูแลระบบและเจ้าหน้าที่" [ref=e73] [cursor=pointer]:
                - /url: /admin/users
            - link "บทบาทและสิทธิ์" [ref=e78] [cursor=pointer]:
                - /url: /admin/roles
            - link "จัดการภาพแบนเนอร์" [ref=e83] [cursor=pointer]:
                - /url: /admin/banner
            - generic [ref=e88]: บัญชีของฉัน
            - link "ข้อมูลส่วนตัว" [ref=e89] [cursor=pointer]:
                - /url: /admin/profile
            - link "คู่มือการใช้งาน" [ref=e94] [cursor=pointer]:
                - /url: /api/private-files/admin_manual.pdf
        - button "ออกจากระบบ" [ref=e100] [cursor=pointer]
    - main [ref=e107]:
        - generic [ref=e108]:
            - generic [ref=e109]:
                - heading "หน่วยงานหลักและหน่วยงานย่อย" [level=1] [ref=e110]
                - paragraph [ref=e111]: หน่วยงานหลักใช้จัดกลุ่ม ส่วนหน่วยงานย่อยคือหน่วยที่ทำงานจริง (โรงพยาบาลหรือโรงเรียน) มีสมาชิก บทบาท และข้อมูลของตัวเอง
            - generic [ref=e112]:
                - button "+ หน่วยงานหลัก" [ref=e113] [cursor=pointer]
                - button "+ หน่วยงานย่อย" [ref=e114] [cursor=pointer]
        - generic [ref=e115]:
            - complementary "โครงสร้างหน่วยงาน" [ref=e116]:
                - generic [ref=e117]:
                    - text: โครงสร้างหน่วยงาน
                    - generic [ref=e118]: "3"
                - generic [ref=e119]:
                    - button "โรงพยาบาลทดสอบ หน่วยงานหลักประเภทโรงพยาบาล · 2 หน่วยงานย่อย" [ref=e120] [cursor=pointer]:
                        - generic [ref=e121]:
                            - generic [ref=e122]: โรงพยาบาลทดสอบ
                            - generic [ref=e123]: หน่วยงานหลักประเภทโรงพยาบาล · 2 หน่วยงานย่อย
                    - generic [ref=e124]:
                        - button "หน่วยงานต้นทางทดสอบ โรงพยาบาล · สมาชิก undefined คน" [ref=e125] [cursor=pointer]:
                            - generic [ref=e126]:
                                - generic [ref=e127]: หน่วยงานต้นทางทดสอบ
                                - generic [ref=e128]: โรงพยาบาล · สมาชิก undefined คน
                        - button "หน่วยงานปลายทางทดสอบ โรงพยาบาล · สมาชิก undefined คน" [ref=e129] [cursor=pointer]:
                            - generic [ref=e130]:
                                - generic [ref=e131]: หน่วยงานปลายทางทดสอบ
                                - generic [ref=e132]: โรงพยาบาล · สมาชิก undefined คน
            - generic [ref=e133]:
                - generic [ref=e134]:
                    - generic [ref=e135]:
                        - heading "รายละเอียดหน่วยงานหลัก" [level=2] [ref=e136]
                        - button "ปิดใช้งาน" [ref=e137] [cursor=pointer]
                    - generic [ref=e138]:
                        - generic [ref=e139]:
                            - text: รหัสหน่วยงาน
                            - textbox "รหัสหน่วยงานที่ระบบสร้าง" [ref=e140]: MAIN
                        - generic [ref=e141]:
                            - text: ชื่อหน่วยงานหลัก
                            - textbox "ชื่อหน่วยงานหลัก" [ref=e142]: โรงพยาบาลทดสอบ
                        - group "ประเภทของหน่วยงานหลัก (หน่วยงานย่อยทั้งหมดภายใต้จะเป็นประเภทนี้)" [ref=e143]:
                            - generic [ref=e145] [cursor=pointer]:
                                - radio "โรงพยาบาล หน่วยย่อยภายในคือคลินิก ใช้เมนูคลินิก ตารางนัดหมาย และเคสแบบโรงพยาบาล" [checked] [ref=e146]
                                - generic [ref=e147]:
                                    - strong [ref=e148]: โรงพยาบาล
                                    - generic [ref=e149]: หน่วยย่อยภายในคือคลินิก ใช้เมนูคลินิก ตารางนัดหมาย และเคสแบบโรงพยาบาล
                            - generic [ref=e150] [cursor=pointer]:
                                - radio "โรงเรียน หน่วยย่อยภายในคือโรงเรียน ใช้เมนูนักเรียน ครู ชั้นปี/ห้อง และเคสแบบรายนักเรียน" [ref=e151]
                                - generic [ref=e152]:
                                    - strong [ref=e153]: โรงเรียน
                                    - generic [ref=e154]: หน่วยย่อยภายในคือโรงเรียน ใช้เมนูนักเรียน ครู ชั้นปี/ห้อง และเคสแบบรายนักเรียน
                        - generic [ref=e155]:
                            - text: รายละเอียด
                            - textbox "รายละเอียด" [ref=e156]
                    - button "บันทึกหน่วยงาน" [ref=e158] [cursor=pointer]
                - generic [ref=e159]:
                    - generic [ref=e160]:
                        - generic [ref=e161]:
                            - heading "หน่วยงานย่อยภายใต้ โรงพยาบาลทดสอบ" [level=2] [ref=e162]
                            - paragraph [ref=e163]: หน่วยงานหลักไม่มีสมาชิกโดยตรง เพิ่มเจ้าหน้าที่ที่หน่วยงานย่อยที่ทำงานจริง
                        - button "+ เพิ่มหน่วยงานย่อย" [ref=e164] [cursor=pointer]
                    - generic [ref=e165]:
                        - article [ref=e166]:
                            - generic [ref=e167]:
                                - strong [ref=e168]: หน่วยงานต้นทางทดสอบ
                                - generic [ref=e169]: โรงพยาบาล · สมาชิก คน
                            - generic [ref=e170]: ใช้งาน
                            - button "จัดการ" [ref=e171] [cursor=pointer]
                        - article [ref=e172]:
                            - generic [ref=e173]:
                                - strong [ref=e174]: หน่วยงานปลายทางทดสอบ
                                - generic [ref=e175]: โรงพยาบาล · สมาชิก คน
                            - generic [ref=e176]: ใช้งาน
                            - button "จัดการ" [ref=e177] [cursor=pointer]
```

# Test source

```ts
  1  | import {test,expect} from '@playwright/test';
  2  | import {mockAdminApi,mockPublicApi} from './helpers/api-mocks.js';
  3  | test('case invitation requires the patient account and rejects another recipient',async({page})=>{
  4  |  await mockPublicApi(page);
  5  |  const token='a'.repeat(43);
  6  |  await page.goto('/assessment/101?invitation='+token);
  7  |  await expect(page).toHaveURL(/account\/login\?returnTo=/);
  8  |  await page.addInitScript(()=>document.cookie='suth_patient_session=synthetic-session; path=/');
  9  |  await page.route('**/api/form-invitations/resolve',route=>{
  10 |   expect(route.request().postDataJSON()).toEqual({token,form_id:'101'});
  11 |   expect(route.request().headers()['x-csrf-token']).toBe('synthetic-patient-csrf');
  12 |   return route.fulfill({status:403,json:{code:'INVITATION_RECIPIENT_MISMATCH'}});
  13 |  });
  14 |  await page.goto('/assessment/101?invitation='+token);
  15 |  await expect(page.getByRole('dialog').getByText('ไม่สามารถใช้ลิงก์เชิญนี้ได้')).toBeVisible();
  16 |  expect(await page.evaluate(()=>sessionStorage.getItem('patient_token'))).toBeNull();
  17 | });
  18 | test('System Admin configures explicit referral destinations in a unit with session CSRF',async({page})=>{
  19 |  await mockAdminApi(page);
  20 |  await page.addInitScript(()=>{document.cookie='suth_staff_session=synthetic-session; path=/';localStorage.setItem('i18nextLng','th');localStorage.setItem('suth_active_organization_1','1');});
  21 |  const organizations=[{id:10,name:'โรงพยาบาลทดสอบ',code:'MAIN',kind:'main',org_level:'main',org_type:'hospital',status:'active',parent_id:null,child_count:2},{id:1,name:'หน่วยงานต้นทางทดสอบ',code:'SRC',kind:'unit',org_level:'unit',org_type:'hospital',status:'active',parent_id:10},{id:2,name:'หน่วยงานปลายทางทดสอบ',code:'DEST',kind:'unit',org_level:'unit',org_type:'hospital',status:'active',parent_id:10}];
  22 |  await page.route('**/api/organizations',route=>route.fulfill({json:organizations}));
  23 |  await page.route('**/api/organizations/1/members',route=>route.fulfill({json:[]}));
  24 |  await page.route('**/api/pdpa/**',route=>route.fulfill({json:[]}));
  25 |  await page.route('**/api/organizations/1/notification-target',route=>route.fulfill({json:null}));
  26 |  let submitted;
  27 |  await page.route('**/api/organizations/1/referral-destinations',route=>{
  28 |   if(route.request().method()==='PUT'){submitted=route.request().postDataJSON();expect(route.request().headers()['x-csrf-token']).toBe('synthetic-staff-csrf');return route.fulfill({json:{success:true}});}
  29 |   return route.fulfill({json:[]});
  30 |  });
  31 |  await page.goto('/admin/organizations');
> 32 |  await page.getByRole('button',{name:/หน่วยงานต้นทางทดสอบ หน่วยงานย่อย/}).click();
     |                                                                           ^ Error: locator.click: Test timeout of 30000ms exceeded.
  33 |  const settings=page.getByRole('region',{name:'การตั้งค่าความปลอดภัยและ PDPA'});
  34 |  await settings.locator('summary').filter({hasText:'หน่วยงานปลายทางที่อนุญาตให้ส่งต่อ'}).click();
  35 |  await settings.getByLabel('หน่วยงานปลายทางทดสอบ',{exact:true}).check();
  36 |  await settings.getByRole('button',{name:'บันทึกคู่ส่งต่อ'}).click();
  37 |  await expect.poll(()=>submitted).toEqual({destinations:[{organization_id:2,enabled:true}]});
  38 | });
  39 |
```

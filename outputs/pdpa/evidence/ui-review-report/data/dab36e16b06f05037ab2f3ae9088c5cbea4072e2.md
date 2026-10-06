# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pdpa-settings-ui.spec.js >> patient requests retain input on failure and show readable status after retry
- Location: e2e\pdpa-settings-ui.spec.js:116:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.selectOption: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('region', { name: 'คำขอเกี่ยวกับข้อมูลส่วนบุคคล' }).getByLabel('หน่วยงาน', { exact: true })

```

# Page snapshot

```yaml
- generic [ref=e3]:
    - navigation [ref=e4]:
        - button "ไปหน้าแรก" [ref=e5] [cursor=pointer]
        - generic [ref=e7]:
            - button "เปลี่ยนภาษาเป็นภาษาอังกฤษ" [ref=e8] [cursor=pointer]: EN
            - button "กลับค้นหา" [ref=e12] [cursor=pointer]
            - button "บัญชีผู้มารับบริการ patient" [ref=e16] [cursor=pointer]:
                - generic [ref=e17]: P
    - generic [ref=e20]:
        - region "คำขอเกี่ยวกับข้อมูลส่วนบุคคล" [ref=e21]:
            - group [ref=e22]:
                - generic "คำขอเกี่ยวกับข้อมูลส่วนบุคคล ส่งคำขอและติดตามการพิจารณาจากหน่วยงานที่เคยรับบริการ" [active] [ref=e23] [cursor=pointer]:
                    - generic [ref=e26]:
                        - strong [ref=e27]: คำขอเกี่ยวกับข้อมูลส่วนบุคคล
                        - generic [ref=e28]: ส่งคำขอและติดตามการพิจารณาจากหน่วยงานที่เคยรับบริการ
                - generic [ref=e31]:
                    - generic [ref=e32]:
                        - generic [ref=e33]:
                            - generic [ref=e34]:
                                - text: หน่วยงาน
                                - combobox "หน่วยงาน" [ref=e35]:
                                    - option "เลือกหน่วยงานที่เคยรับบริการ" [selected]
                                    - option "หน่วยงานต้นทาง (ข้อมูลจำลอง)"
                            - generic [ref=e36]:
                                - text: ประเภทคำขอ
                                - combobox "ประเภทคำขอ" [ref=e37]:
                                    - option "ขอเข้าถึงข้อมูล" [selected]
                                    - option "ขอแก้ไขข้อมูล"
                                    - option "ขอลบข้อมูล"
                                    - option "ขอจำกัดการใช้ข้อมูล"
                                    - option "คัดค้านการใช้ข้อมูล"
                                    - option "ขอรับหรือโอนข้อมูล"
                                    - option "ถอนความยินยอม"
                            - generic [ref=e38]:
                                - text: รายละเอียด
                                - textbox "รายละเอียด ระบุข้อมูลและสิ่งที่ต้องการให้หน่วยงานดำเนินการ" [ref=e39]
                                - generic [ref=e40]: ระบุข้อมูลและสิ่งที่ต้องการให้หน่วยงานดำเนินการ
                        - button "ส่งคำขอ" [disabled] [ref=e42]
                    - generic [ref=e46]:
                        - heading "คำขอของฉัน" [level=3] [ref=e47]
                        - button "โหลดคำขอล่าสุด" [ref=e48] [cursor=pointer]
                    - paragraph [ref=e56]: ยังไม่มีคำขอที่ส่งจากบัญชีนี้
        - region [ref=e57]:
            - generic [ref=e61]:
                - heading "เพิ่มอีเมลเพื่อให้บัญชีสมบูรณ์" [level=2] [ref=e62]
                - paragraph [ref=e63]: กรอกอีเมลเพื่อใช้รับข้อมูลและกู้คืนบัญชีของคุณในอนาคต
                - generic [ref=e64]:
                    - generic [ref=e65]: อีเมล
                    - textbox "อีเมล" [ref=e66]:
                        - /placeholder: กรอกอีเมลของคุณ
                    - button "ส่งรหัสยืนยัน" [ref=e67] [cursor=pointer]
        - generic [ref=e69]:
            - generic [ref=e70]: บ
            - generic [ref=e71]:
                - generic [ref=e73]:
                    - generic [ref=e74]: บัญชีสาธิต
                    - button "แก้ไขข้อมูล" [ref=e75] [cursor=pointer]
                - generic [ref=e78]:
                    - generic [ref=e79]:
                        - generic [ref=e83]: ยืนยันตัวตนแล้ว
                        - button [ref=e84] [cursor=pointer]
                    - generic [ref=e89]:
                        - generic [ref=e92]: "-"
                        - button "แก้ไขข้อมูล" [ref=e93] [cursor=pointer]
                - generic [ref=e96]:
                    - generic [ref=e97]: คลินิกวัยรุ่น
                    - generic [ref=e98]: คลินิกปรับเปลี่ยนพฤติกรรม
                    - generic [ref=e99]: คลินิกโรคติดต่อฯ
            - button "เริ่มการประเมินใหม่ ▾" [ref=e102] [cursor=pointer]
        - generic [ref=e105]:
            - generic [ref=e106]:
                - img "SUTH App Phone" [ref=e107]
                - generic [ref=e108]:
                    - heading "กรุณาดาวน์โหลด SUTH App" [level=2] [ref=e109]
                    - paragraph [ref=e110]: เพื่อรับการแจ้งเตือนการนัดหมายและติดตามข้อมูลการเข้ารับบริการได้สะดวกยิ่งขึ้น
            - generic [ref=e111]:
                - generic [ref=e112]:
                    - img "QR Code" [ref=e113]
                    - img "Download Buttons" [ref=e115]
                - button "ดาวน์โหลดเลย" [ref=e116] [cursor=pointer]
        - generic [ref=e120]: ประวัติการเข้ารับบริการ (ไทม์ไลน์)
        - button "ทั้งหมด (0)" [ref=e123] [cursor=pointer]
        - paragraph [ref=e129]: ไม่มีประวัติในหมวดหมู่นี้
```

# Test source

```ts
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
  93  |   await purpose.getByLabel('ฐานการประมวลผล').selectOption('consent');
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
> 132 |   await section.getByRole('combobox',{name:'หน่วยงาน',exact:true}).selectOption('1');
      |                                                     ^ Error: locator.selectOption: Test timeout of 30000ms exceeded.
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
```

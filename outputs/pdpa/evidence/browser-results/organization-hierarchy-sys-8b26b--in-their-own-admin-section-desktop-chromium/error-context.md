# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: organization-hierarchy.spec.js >> system-wide settings sit in their own admin section
- Location: e2e\organization-hierarchy.spec.js:202:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('aside.sidebar nav').locator('.menu-header-label').filter({ hasText: 'ผู้ดูแลระบบ' })
Expected substring: "ไม่ขึ้นกับหน่วยงานที่เลือก"
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" with timeout 10000ms
  - waiting for locator('aside.sidebar nav').locator('.menu-header-label').filter({ hasText: 'ผู้ดูแลระบบ' })

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
  109 |           status: 201,
  110 |           json: {
  111 |             added: received.members.user_ids,
  112 |             reactivated: [],
  113 |             skipped: [],
  114 |           },
  115 |         });
  116 |       }
  117 |       return route.fulfill({ json: [] });
  118 |     }
  119 |     if (pathname.endsWith("/api/users"))
  120 |       return route.fulfill({
  121 |         json: [
  122 |           { id: 11, username: "teacher1", name: "ครูหนึ่ง", status: "active" },
  123 |           { id: 12, username: "teacher2", name: "ครูสอง", status: "active" },
  124 |           { id: 13, username: "nurse1", name: "พยาบาลหนึ่ง", status: "active" },
  125 |         ],
  126 |       });
  127 |     if (pathname.endsWith("/api/roles"))
  128 |       return route.fulfill({ json: [{ id: 3, name: "Staff" }] });
  129 |     return route.fulfill({ json: {} });
  130 |   });
  131 | }
  132 |
  133 | test("a school sub-unit inherits its main organization's type and shows school menus", async ({
  134 |   page,
  135 | }) => {
  136 |   await mockApi(page, {});
  137 |   await page.goto("/admin/organizations");
  138 |   const nav = page.locator("aside.sidebar");
  139 |   // The active unit is โรงเรียนสุรวิวัฒน์ (under โรงเรียน), so school menus show.
  140 |   await expect(
  141 |     nav.getByRole("link", { name: "นักเรียน", exact: true }),
  142 |   ).toBeVisible();
  143 |   await expect(nav.getByRole("link", { name: "จัดการคลินิก" })).toHaveCount(0);
  144 |   await expect(
  145 |     page.locator('#active-organization optgroup[label="โรงเรียน"] option'),
  146 |   ).toHaveText(["โรงเรียนสุรวิวัฒน์ (โรงเรียน)"]);
  147 |
  148 |   // Switching to the clinic under โรงพยาบาล brings the hospital menus back.
  149 |   await page.locator("#active-organization").selectOption("1");
  150 |   await expect(nav.getByRole("link", { name: "จัดการคลินิก" })).toBeVisible();
  151 |   await expect(
  152 |     nav.getByRole("link", { name: "นักเรียน", exact: true }),
  153 |   ).toHaveCount(0);
  154 | });
  155 |
  156 | test("main organizations choose the type, sub-units inherit it, members are added by checkbox", async ({
  157 |   page,
  158 | }) => {
  159 |   const received = {};
  160 |   await mockApi(page, received);
  161 |   await page.goto("/admin/organizations");
  162 |   const directory = page.getByRole("complementary", {
  163 |     name: "โครงสร้างหน่วยงาน",
  164 |   });
  165 |   await expect(
  166 |     directory.getByText("หน่วยงานหลักประเภทโรงเรียน · 1 หน่วยงานย่อย"),
  167 |   ).toBeVisible();
  168 |
  169 |   // A new sub-unit under โรงเรียน shows the inherited type and sends none.
  170 |   await directory
  171 |     .getByRole("button", { name: /^โรงเรียน หน่วยงานหลัก/ })
  172 |     .click();
  173 |   await page.getByRole("button", { name: "+ เพิ่มหน่วยงานย่อย" }).click();
  174 |   await expect(page.getByText("(ตามหน่วยงานหลัก โรงเรียน)")).toBeVisible();
  175 |   await expect(page.getByRole("radio")).toHaveCount(0);
  176 |   await page.getByLabel("ชื่อหน่วยงานย่อย").fill("โรงเรียนใหม่");
  177 |   await page.getByRole("button", { name: "บันทึกหน่วยงาน" }).click();
  178 |   await expect
  179 |     .poll(() => received.created)
  180 |     .toEqual({
  181 |       kind: "unit",
  182 |       name: "โรงเรียนใหม่",
  183 |       description: "",
  184 |       parent_id: 4,
  185 |     });
  186 |
  187 |   // Members of a sub-unit are picked with checkboxes and added together.
  188 |   await directory.getByRole("button", { name: /โรงเรียนสุรวิวัฒน์/ }).click();
  189 |   await page.getByRole("button", { name: "+ เพิ่มสมาชิก" }).click();
  190 |   await page.getByRole("checkbox", { name: /ครูหนึ่ง/ }).check();
  191 |   await page.getByRole("checkbox", { name: /ครูสอง/ }).check();
  192 |   await page.getByLabel("บทบาทในหน่วยงานนี้").selectOption("3");
  193 |   await page.getByRole("button", { name: "เพิ่ม 2 คน" }).click();
  194 |   await expect
  195 |     .poll(() => received.members)
  196 |     .toEqual({
  197 |       user_ids: [11, 12],
  198 |       role_id: 3,
  199 |     });
  200 | });
  201 |
  202 | test("system-wide settings sit in their own admin section", async ({
  203 |   page,
  204 | }) => {
  205 |   await mockApi(page, {});
  206 |   await page.goto("/admin/organizations");
  207 |   const nav = page.locator("aside.sidebar nav");
  208 |   const headers = nav.locator(".menu-header-label");
> 209 |   await expect(headers.filter({ hasText: "ผู้ดูแลระบบ" })).toContainText(
      |                                                            ^ Error: expect(locator).toContainText(expected) failed
  210 |     "ไม่ขึ้นกับหน่วยงานที่เลือก",
  211 |   );
  212 |   const labels = await nav
  213 |     .locator(".menu-header-label, .menu-item .label")
  214 |     .allTextContents();
  215 |   const admin = labels.findIndex((text) => text.startsWith("ผู้ดูแลระบบ"));
  216 |   const account = labels.indexOf("บัญชีของฉัน");
  217 |   expect(labels.slice(admin + 1, account)).toEqual([
  218 |     "หน่วยงานหลักและหน่วยงานย่อย",
  219 |     "ผู้ดูแลระบบและเจ้าหน้าที่",
  220 |     "บทบาทและสิทธิ์",
  221 |     "จัดการภาพแบนเนอร์",
  222 |   ]);
  223 |   const unit = labels.indexOf("จัดการหน่วยงาน");
  224 |   expect(labels.slice(unit + 1, admin)).toEqual([
  225 |     "จัดการฟอร์ม",
  226 |     "ผู้มารับบริการ",
  227 |     "จัดการศูนย์ช่วยเหลือ",
  228 |   ]);
  229 | });
  230 |
  231 | test("an organization member does not get the admin section", async ({
  232 |   page,
  233 | }) => {
  234 |   await page.route("**/api/**", async (route) => {
  235 |     const { pathname } = new URL(route.request().url());
  236 |     if (pathname.endsWith("/api/me/authorization"))
  237 |       return route.fulfill({
  238 |         json: {
  239 |           user: { id: 1, username: "e2e-staff" },
  240 |           is_system_admin: false,
  241 |           system_permissions: [],
  242 |           organizations: [],
  243 |           memberships: [
  244 |             {
  245 |               status: "active",
  246 |               organization: {
  247 |                 id: 1,
  248 |                 name: "คลินิกวัยรุ่น",
  249 |                 org_type: "hospital",
  250 |                 parent_id: 3,
  251 |                 parent_name: "โรงพยาบาล",
  252 |                 status: "active",
  253 |               },
  254 |               role: { id: 3, name: "Staff" },
  255 |               permissions: ["cases.view", "forms.view", "patient_members.view"],
  256 |             },
  257 |           ],
  258 |         },
  259 |       });
  260 |     return route.fulfill({ json: [] });
  261 |   });
  262 |   await page.addInitScript(() =>
  263 |     localStorage.setItem("suth_active_organization_1", "1"),
  264 |   );
  265 |   await page.goto("/admin/profile");
  266 |   const nav = page.locator("aside.sidebar nav");
  267 |   await expect(nav.getByRole("link", { name: "ผู้มารับบริการ" })).toBeVisible();
  268 |   await expect(nav.getByText("ผู้ดูแลระบบ", { exact: false })).toHaveCount(0);
  269 |   await expect(nav.getByRole("link", { name: "บทบาทและสิทธิ์" })).toHaveCount(
  270 |     0,
  271 |   );
  272 | });
  273 |
```

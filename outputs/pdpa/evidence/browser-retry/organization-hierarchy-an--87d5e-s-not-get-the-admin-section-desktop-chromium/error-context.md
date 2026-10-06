# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: organization-hierarchy.spec.js >> an organization member does not get the admin section
- Location: e2e\organization-hierarchy.spec.js:233:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('aside.sidebar nav').getByRole('link', { name: 'ผู้มารับบริการ' })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('aside.sidebar nav').getByRole('link', { name: 'ผู้มารับบริการ' })

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
  169 |   ).toBeVisible();
  170 |
  171 |   // A new sub-unit under โรงเรียน shows the inherited type and sends none.
  172 |   await directory
  173 |     .getByRole("button", { name: /^โรงเรียน หน่วยงานหลัก/ })
  174 |     .click();
  175 |   await page.getByRole("button", { name: "+ เพิ่มหน่วยงานย่อย" }).click();
  176 |   await expect(page.getByText("(ตามหน่วยงานหลัก โรงเรียน)")).toBeVisible();
  177 |   await expect(page.getByRole("radio")).toHaveCount(0);
  178 |   await page.getByLabel("ชื่อหน่วยงานย่อย").fill("โรงเรียนใหม่");
  179 |   await page.getByRole("button", { name: "บันทึกหน่วยงาน" }).click();
  180 |   await expect
  181 |     .poll(() => received.created)
  182 |     .toEqual({
  183 |       kind: "unit",
  184 |       name: "โรงเรียนใหม่",
  185 |       description: "",
  186 |       parent_id: 4,
  187 |     });
  188 |
  189 |   // Members of a sub-unit are picked with checkboxes and added together.
  190 |   await directory.getByRole("button", { name: /โรงเรียนสุรวิวัฒน์/ }).click();
  191 |   await page.getByRole("button", { name: "+ เพิ่มสมาชิก" }).click();
  192 |   await page.getByRole("checkbox", { name: /ครูหนึ่ง/ }).check();
  193 |   await page.getByRole("checkbox", { name: /ครูสอง/ }).check();
  194 |   await page.getByLabel("บทบาทในหน่วยงานนี้").selectOption("3");
  195 |   await page.getByRole("button", { name: "เพิ่ม 2 คน" }).click();
  196 |   await expect
  197 |     .poll(() => received.members)
  198 |     .toEqual({
  199 |       user_ids: [11, 12],
  200 |       role_id: 3,
  201 |     });
  202 | });
  203 |
  204 | test("system-wide settings sit in their own admin section", async ({
  205 |   page,
  206 | }) => {
  207 |   await mockApi(page, {});
  208 |   await page.goto("/admin/organizations");
  209 |   const nav = page.locator("aside.sidebar nav");
  210 |   const headers = nav.locator(".menu-header-label");
  211 |   await expect(headers.filter({ hasText: "ผู้ดูแลระบบ" })).toContainText(
  212 |     "ไม่ขึ้นกับหน่วยงานที่เลือก",
  213 |   );
  214 |   const labels = await nav
  215 |     .locator(".menu-header-label, .menu-item .label")
  216 |     .allTextContents();
  217 |   const admin = labels.findIndex((text) => text.startsWith("ผู้ดูแลระบบ"));
  218 |   const account = labels.indexOf("บัญชีของฉัน");
  219 |   expect(labels.slice(admin + 1, account)).toEqual([
  220 |     "หน่วยงานหลักและหน่วยงานย่อย",
  221 |     "ผู้ดูแลระบบและเจ้าหน้าที่",
  222 |     "บทบาทและสิทธิ์",
  223 |     "จัดการภาพแบนเนอร์",
  224 |   ]);
  225 |   const unit = labels.indexOf("จัดการหน่วยงาน");
  226 |   expect(labels.slice(unit + 1, admin)).toEqual([
  227 |     "จัดการฟอร์ม",
  228 |     "ผู้มารับบริการ",
  229 |     "จัดการศูนย์ช่วยเหลือ",
  230 |   ]);
  231 | });
  232 |
  233 | test("an organization member does not get the admin section", async ({
  234 |   page,
  235 | }) => {
  236 |   await page.route("**/api/**", async (route) => {
  237 |     const { pathname } = new URL(route.request().url());
  238 |     if (pathname.endsWith("/api/me/authorization"))
  239 |       return route.fulfill({
  240 |         json: {
  241 |           user: { id: 1, username: "e2e-staff" },
  242 |           is_system_admin: false,
  243 |           system_permissions: [],
  244 |           organizations: [],
  245 |           memberships: [
  246 |             {
  247 |               status: "active",
  248 |               organization: {
  249 |                 id: 1,
  250 |                 name: "คลินิกวัยรุ่น",
  251 |                 org_type: "hospital",
  252 |                 parent_id: 3,
  253 |                 parent_name: "โรงพยาบาล",
  254 |                 status: "active",
  255 |               },
  256 |               role: { id: 3, name: "Staff" },
  257 |               permissions: ["cases.view", "forms.view", "patient_members.view"],
  258 |             },
  259 |           ],
  260 |         },
  261 |       });
  262 |     return route.fulfill({ json: [] });
  263 |   });
  264 |   await page.addInitScript(() =>
  265 |     localStorage.setItem("suth_active_organization_1", "1"),
  266 |   );
  267 |   await page.goto("/admin/profile");
  268 |   const nav = page.locator("aside.sidebar nav");
> 269 |   await expect(nav.getByRole("link", { name: "ผู้มารับบริการ" })).toBeVisible();
      |                                                                   ^ Error: expect(locator).toBeVisible() failed
  270 |   await expect(nav.getByText("ผู้ดูแลระบบ", { exact: false })).toHaveCount(0);
  271 |   await expect(nav.getByRole("link", { name: "บทบาทและสิทธิ์" })).toHaveCount(
  272 |     0,
  273 |   );
  274 | });
  275 |
```

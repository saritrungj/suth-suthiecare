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
- complementary:
    - img "SUTH Logo"
    - button "Toggle sidebar"
    - text: หน่วยงานที่กำลังใช้งาน
    - combobox "หน่วยงานที่กำลังใช้งาน"
    - text: หน่วยงานย่อยประเภทโรงพยาบาล · ภายใต้ โรงพยาบาล
    - navigation
    - button "ออกจากระบบ"
- banner:
    - heading "ข้อมูลส่วนตัว" [level=1]
    - paragraph: จัดการชื่อที่แสดงในระบบ อีเมล และรหัสผ่านสำหรับบัญชีของคุณ
- alert: Cannot read properties of undefined (reading 'name')
```

# Test source

```ts
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
  211 |   await expect(headers.filter({ hasText: "จัดการหลักของระบบ" })).toContainText(
  212 |     "ไม่ขึ้นกับหน่วยงานที่เลือก",
  213 |   );
  214 |   const labels = await nav
  215 |     .locator(".menu-header-label, .menu-item .label")
  216 |     .allTextContents();
  217 |   const admin = labels.findIndex((text) => text.startsWith("จัดการหลักของระบบ"));
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
  238 |     if(pathname.endsWith('/api/session/staff'))return route.fulfill({json:{user:{id:1,username:'e2e-staff',role_id:3},csrf_token:'synthetic-staff-csrf'}});
  239 |     if(pathname.endsWith('/api/session/patient'))return route.fulfill({status:401,json:{}});
  240 |     if (pathname.endsWith("/api/me/authorization"))
  241 |       return route.fulfill({
  242 |         json: {
  243 |           user: { id: 1, username: "e2e-staff" },
  244 |           is_system_admin: false,
  245 |           system_permissions: [],
  246 |           organizations: [],
  247 |           memberships: [
  248 |             {
  249 |               status: "active",
  250 |               organization: {
  251 |                 id: 1,
  252 |                 name: "คลินิกวัยรุ่น",
  253 |                 org_type: "hospital",
  254 |                 parent_id: 3,
  255 |                 parent_name: "โรงพยาบาล",
  256 |                 status: "active",
  257 |               },
  258 |               role: { id: 3, name: "Staff" },
  259 |               permissions: ["cases.view", "forms.view", "patient_members.view"],
  260 |             },
  261 |           ],
  262 |         },
  263 |       });
  264 |     return route.fulfill({ json: [] });
  265 |   });
  266 |   await page.addInitScript(() =>
  267 |     localStorage.setItem("suth_active_organization_1", "1"),
  268 |   );
  269 |   await page.goto("/admin/profile");
  270 |   const nav = page.locator("aside.sidebar nav");
> 271 |   await expect(nav.getByRole("link", { name: "ผู้มารับบริการ" })).toBeVisible();
      |                                                                   ^ Error: expect(locator).toBeVisible() failed
  272 |   await expect(nav.getByText("ผู้ดูแลระบบ", { exact: false })).toHaveCount(0);
  273 |   await expect(nav.getByRole("link", { name: "บทบาทและสิทธิ์" })).toHaveCount(
  274 |     0,
  275 |   );
  276 | });
  277 |
```

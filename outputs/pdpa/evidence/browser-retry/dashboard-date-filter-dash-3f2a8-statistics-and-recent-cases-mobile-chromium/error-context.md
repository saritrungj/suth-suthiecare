# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard-date-filter.spec.js >> dashboard applies the selected date range to statistics and recent cases
- Location: e2e\dashboard-date-filter.spec.js:3:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 6
+ Received  + 1

- Array [
-   "07",
-   "02",
-   "01",
-   "03",
- ]
+ Array []

Call Log:
- Timeout 10000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- main [ref=e3]:
    - generic [ref=e4]:
        - link "กลับหน้าแรก" [ref=e5] [cursor=pointer]:
            - /url: /
        - group "เปลี่ยนภาษา" [ref=e9]:
            - button "ไทย" [pressed] [ref=e10] [cursor=pointer]
            - button "EN" [ref=e11] [cursor=pointer]
    - region "เข้าสู่ระบบเจ้าหน้าที่" [ref=e12]:
        - complementary [ref=e13]:
            - img "SUTH" [ref=e14]
            - generic [ref=e15]:
                - paragraph [ref=e16]: ระบบปฏิบัติงานสำหรับเจ้าหน้าที่
                - heading "ดูแลข้อมูลและติดตามบริการได้อย่างมั่นใจ" [level=2] [ref=e17]
        - generic [ref=e18]:
            - tablist "เลือกประเภทผู้ใช้งาน" [ref=e19]:
                - tab "ผู้มารับบริการ" [ref=e20] [cursor=pointer]
                - tab "เจ้าหน้าที่" [selected] [ref=e21] [cursor=pointer]
            - generic [ref=e27]:
                - heading "เข้าสู่ระบบเจ้าหน้าที่" [level=1] [ref=e28]
                - paragraph [ref=e29]: ใช้บัญชีเจ้าหน้าที่ที่ได้รับอนุญาตจากผู้ดูแลระบบ
            - form "เข้าสู่ระบบเจ้าหน้าที่" [ref=e30]:
                - generic [ref=e31]:
                    - generic [ref=e32]: ชื่อผู้ใช้งาน
                    - textbox "ชื่อผู้ใช้งาน" [ref=e33]:
                        - /placeholder: กรอกชื่อผู้ใช้งาน
                - generic [ref=e34]:
                    - generic [ref=e35]: รหัสผ่าน
                    - generic [ref=e36]:
                        - textbox "รหัสผ่าน" [ref=e37]:
                            - /placeholder: กรอกรหัสผ่าน
                        - button "แสดงรหัสผ่าน" [ref=e38] [cursor=pointer]
                - button "ลืมรหัสผ่าน?" [ref=e43] [cursor=pointer]
                - generic "การยืนยันความปลอดภัย"
                - button "เข้าสู่ระบบ" [ref=e44] [cursor=pointer]
            - paragraph [ref=e45]: หากไม่สามารถเข้าสู่ระบบได้ กรุณาติดต่อผู้ดูแลระบบของหน่วยงาน
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   |
  3   | test("dashboard applies the selected date range to statistics and recent cases", async ({
  4   |   page,
  5   | }) => {
  6   |   const requests = [];
  7   |   const pageErrors = [];
  8   |   page.on("pageerror", (error) => pageErrors.push(error.message));
  9   |   await page.addInitScript(() => {
  10  |     document.cookie="suth_staff_session=synthetic-session; path=/";
  11  |     sessionStorage.setItem(
  12  |       "suth_user",
  13  |       JSON.stringify({ id: 1, username: "e2e-admin", role_id: 1 }),
  14  |     );
  15  |   });
  16  |   await page.route("**/api/**", async (route) => {
  17  |     const request = route.request();
  18  |     const url = new URL(request.url());
  19  |     const { pathname } = url;
  20  |     if(pathname.endsWith('/api/session/staff'))return route.fulfill({json:{user:{id:1,username:'e2e-admin',role_id:1},csrf_token:'synthetic-staff-csrf'}});
  21  |     if(pathname.endsWith('/api/session/patient'))return route.fulfill({status:401,json:{}});
  22  |     if (pathname.endsWith("/api/me/authorization")) {
  23  |       return route.fulfill({
  24  |         json: {
  25  |           user: { id: 1, username: "e2e-admin" },
  26  |           is_system_admin: true,
  27  |           organizations: [{ id: 1, name: "หน่วยงานทดสอบ" }],
  28  |           memberships: [],
  29  |         },
  30  |       });
  31  |     }
  32  |     if (pathname.endsWith("/api/forms")) {
  33  |       return route.fulfill({
  34  |         json: [
  35  |           {
  36  |             id: 1,
  37  |             title: "แบบประเมินทดสอบ",
  38  |             clinic_type: "teenager",
  39  |             status: "published",
  40  |           },
  41  |         ],
  42  |       });
  43  |     }
  44  |     if (pathname.endsWith("/api/forms/1")) {
  45  |       return route.fulfill({
  46  |         json: { id: 1, questions: [{ id: 10, type: "text", title: "คำถาม" }] },
  47  |       });
  48  |     }
  49  |     if (
  50  |       pathname.endsWith("/api/dashboard-settings/settings") &&
  51  |       request.method() === "GET"
  52  |     )
  53  |       return route.fulfill({ json: {} });
  54  |     if (pathname.endsWith("/api/evaluations/stats")) {
  55  |       return route.fulfill({
  56  |         json: {
  57  |           avg_ui: 0,
  58  |           avg_speed: 0,
  59  |           avg_content: 0,
  60  |           avg_access: 0,
  61  |           avg_overall: 0,
  62  |           avg_sus: 0,
  63  |           avg_sus1: 0,
  64  |           avg_sus2: 0,
  65  |           avg_sus3: 0,
  66  |           avg_sus4: 0,
  67  |           avg_sus5: 0,
  68  |           avg_sus6: 0,
  69  |           avg_sus7: 0,
  70  |           avg_sus8: 0,
  71  |           avg_sus9: 0,
  72  |           avg_sus10: 0,
  73  |           total_votes: 0,
  74  |           recent_comments: [],
  75  |         },
  76  |       });
  77  |     }
  78  |     if (pathname.endsWith("/api/clinics"))
  79  |       return route.fulfill({ json: { data: [] } });
  80  |     if (
  81  |       pathname.endsWith("/api/admin/master-cases/stats") ||
  82  |       pathname.endsWith("/api/dashboard/recent")
  83  |     ) {
  84  |       requests.push(url.search);
  85  |       return route.fulfill({
  86  |         json: pathname.endsWith("/stats")
  87  |           ? { totalActive: 7, newToday: 2, highRisk: 1, closed: 3 }
  88  |           : [],
  89  |       });
  90  |     }
  91  |     return route.fulfill({ json: [] });
  92  |   });
  93  |
  94  |   await page.goto("/admin/dashboard");
  95  |   await expect.poll(() => pageErrors).toEqual([]);
> 96  |   await expect
      |      ^ Error: expect(received).toEqual(expected) // deep equality
  97  |     .poll(async () => page.locator(".stat-modern-value").allTextContents())
  98  |     .toEqual(["07", "02", "01", "03"]);
  99  |   await expect(page.locator('input[type="date"]').first()).toBeVisible();
  100 |   const dateInputs = page.locator('input[type="date"]');
  101 |   const expectedDefaultRange = await page.evaluate(() => {
  102 |     const today = new Date();
  103 |     const key = (date) =>
  104 |       [
  105 |         date.getFullYear(),
  106 |         String(date.getMonth() + 1).padStart(2, "0"),
  107 |         String(date.getDate()).padStart(2, "0"),
  108 |       ].join("-");
  109 |     return [
  110 |       key(new Date(today.getFullYear(), today.getMonth(), 1)),
  111 |       key(today),
  112 |     ];
  113 |   });
  114 |   await expect(dateInputs.nth(0)).toHaveValue(expectedDefaultRange[0]);
  115 |   await expect(dateInputs.nth(1)).toHaveValue(expectedDefaultRange[1]);
  116 |
  117 |   await dateInputs.nth(0).evaluate((element, value) => {
  118 |     const setter = Object.getOwnPropertyDescriptor(
  119 |       HTMLInputElement.prototype,
  120 |       "value",
  121 |     ).set;
  122 |     setter.call(element, value);
  123 |     element.dispatchEvent(new Event("input", { bubbles: true }));
  124 |     element.dispatchEvent(new Event("change", { bubbles: true }));
  125 |   }, "2026-08-10");
  126 |   await page.waitForTimeout(250);
  127 |   expect(pageErrors).toEqual([]);
  128 |   await dateInputs.nth(1).evaluate((element, value) => {
  129 |     const setter = Object.getOwnPropertyDescriptor(
  130 |       HTMLInputElement.prototype,
  131 |       "value",
  132 |     ).set;
  133 |     setter.call(element, value);
  134 |     element.dispatchEvent(new Event("input", { bubbles: true }));
  135 |     element.dispatchEvent(new Event("change", { bubbles: true }));
  136 |   }, "2026-08-10");
  137 |
  138 |   await expect
  139 |     .poll(() =>
  140 |       requests.some(
  141 |         (search) =>
  142 |           search.includes("startDate=2026-08-10") &&
  143 |           search.includes("endDate=2026-08-10"),
  144 |       ),
  145 |     )
  146 |     .toBe(true);
  147 |   await expect(page.getByText("เคสใหม่ในช่วงที่เลือก").first()).toBeVisible();
  148 | });
  149 |
```

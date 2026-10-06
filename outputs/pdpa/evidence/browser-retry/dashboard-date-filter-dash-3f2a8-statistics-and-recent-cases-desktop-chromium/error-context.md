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
                - paragraph [ref=e18]: จัดการเคส แบบประเมิน นัดหมาย และสมาชิกผู้รับบริการ ตามสิทธิ์ที่ได้รับจากผู้ดูแลระบบ
            - generic "เข้าสู่ระบบเจ้าหน้าที่" [ref=e19]:
                - generic [ref=e20]: ภาพรวมข้อมูลและงานติดตามในที่เดียว
                - generic [ref=e27]: จัดการเจ้าหน้าที่และดูรายชื่อสมาชิกตามสิทธิ์
                - generic [ref=e34]: ควบคุมการเข้าถึงด้วย Role และ Permission
        - generic [ref=e38]:
            - tablist "เลือกประเภทผู้ใช้งาน" [ref=e39]:
                - tab "ผู้มารับบริการ" [ref=e40] [cursor=pointer]
                - tab "เจ้าหน้าที่" [selected] [ref=e41] [cursor=pointer]
            - generic [ref=e47]:
                - heading "เข้าสู่ระบบเจ้าหน้าที่" [level=1] [ref=e48]
                - paragraph [ref=e49]: ใช้บัญชีเจ้าหน้าที่ที่ได้รับอนุญาตจากผู้ดูแลระบบ
            - form "เข้าสู่ระบบเจ้าหน้าที่" [ref=e50]:
                - generic [ref=e51]:
                    - generic [ref=e52]: ชื่อผู้ใช้งาน
                    - textbox "ชื่อผู้ใช้งาน" [ref=e53]:
                        - /placeholder: กรอกชื่อผู้ใช้งาน
                - generic [ref=e54]:
                    - generic [ref=e55]: รหัสผ่าน
                    - generic [ref=e56]:
                        - textbox "รหัสผ่าน" [ref=e57]:
                            - /placeholder: กรอกรหัสผ่าน
                        - button "แสดงรหัสผ่าน" [ref=e58] [cursor=pointer]
                - button "ลืมรหัสผ่าน?" [ref=e63] [cursor=pointer]
                - generic "การยืนยันความปลอดภัย"
                - button "เข้าสู่ระบบ" [ref=e64] [cursor=pointer]
            - paragraph [ref=e65]: หากไม่สามารถเข้าสู่ระบบได้ กรุณาติดต่อผู้ดูแลระบบของหน่วยงาน
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
  20  |     if (pathname.endsWith("/api/me/authorization")) {
  21  |       return route.fulfill({
  22  |         json: {
  23  |           user: { id: 1, username: "e2e-admin" },
  24  |           is_system_admin: true,
  25  |           organizations: [{ id: 1, name: "หน่วยงานทดสอบ" }],
  26  |           memberships: [],
  27  |         },
  28  |       });
  29  |     }
  30  |     if (pathname.endsWith("/api/forms")) {
  31  |       return route.fulfill({
  32  |         json: [
  33  |           {
  34  |             id: 1,
  35  |             title: "แบบประเมินทดสอบ",
  36  |             clinic_type: "teenager",
  37  |             status: "published",
  38  |           },
  39  |         ],
  40  |       });
  41  |     }
  42  |     if (pathname.endsWith("/api/forms/1")) {
  43  |       return route.fulfill({
  44  |         json: { id: 1, questions: [{ id: 10, type: "text", title: "คำถาม" }] },
  45  |       });
  46  |     }
  47  |     if (
  48  |       pathname.endsWith("/api/dashboard-settings/settings") &&
  49  |       request.method() === "GET"
  50  |     )
  51  |       return route.fulfill({ json: {} });
  52  |     if (pathname.endsWith("/api/evaluations/stats")) {
  53  |       return route.fulfill({
  54  |         json: {
  55  |           avg_ui: 0,
  56  |           avg_speed: 0,
  57  |           avg_content: 0,
  58  |           avg_access: 0,
  59  |           avg_overall: 0,
  60  |           avg_sus: 0,
  61  |           avg_sus1: 0,
  62  |           avg_sus2: 0,
  63  |           avg_sus3: 0,
  64  |           avg_sus4: 0,
  65  |           avg_sus5: 0,
  66  |           avg_sus6: 0,
  67  |           avg_sus7: 0,
  68  |           avg_sus8: 0,
  69  |           avg_sus9: 0,
  70  |           avg_sus10: 0,
  71  |           total_votes: 0,
  72  |           recent_comments: [],
  73  |         },
  74  |       });
  75  |     }
  76  |     if (pathname.endsWith("/api/clinics"))
  77  |       return route.fulfill({ json: { data: [] } });
  78  |     if (
  79  |       pathname.endsWith("/api/admin/master-cases/stats") ||
  80  |       pathname.endsWith("/api/dashboard/recent")
  81  |     ) {
  82  |       requests.push(url.search);
  83  |       return route.fulfill({
  84  |         json: pathname.endsWith("/stats")
  85  |           ? { totalActive: 7, newToday: 2, highRisk: 1, closed: 3 }
  86  |           : [],
  87  |       });
  88  |     }
  89  |     return route.fulfill({ json: [] });
  90  |   });
  91  |
  92  |   await page.goto("/admin/dashboard");
  93  |   await expect.poll(() => pageErrors).toEqual([]);
  94  |   await expect
  95  |     .poll(async () => page.locator(".stat-modern-value").allTextContents())
> 96  |     .toEqual(["07", "02", "01", "03"]);
      |      ^ Error: expect(received).toEqual(expected) // deep equality
  97  |   await expect(page.locator('input[type="date"]').first()).toBeVisible();
  98  |   const dateInputs = page.locator('input[type="date"]');
  99  |   const expectedDefaultRange = await page.evaluate(() => {
  100 |     const today = new Date();
  101 |     const key = (date) =>
  102 |       [
  103 |         date.getFullYear(),
  104 |         String(date.getMonth() + 1).padStart(2, "0"),
  105 |         String(date.getDate()).padStart(2, "0"),
  106 |       ].join("-");
  107 |     return [
  108 |       key(new Date(today.getFullYear(), today.getMonth(), 1)),
  109 |       key(today),
  110 |     ];
  111 |   });
  112 |   await expect(dateInputs.nth(0)).toHaveValue(expectedDefaultRange[0]);
  113 |   await expect(dateInputs.nth(1)).toHaveValue(expectedDefaultRange[1]);
  114 |
  115 |   await dateInputs.nth(0).evaluate((element, value) => {
  116 |     const setter = Object.getOwnPropertyDescriptor(
  117 |       HTMLInputElement.prototype,
  118 |       "value",
  119 |     ).set;
  120 |     setter.call(element, value);
  121 |     element.dispatchEvent(new Event("input", { bubbles: true }));
  122 |     element.dispatchEvent(new Event("change", { bubbles: true }));
  123 |   }, "2026-08-10");
  124 |   await page.waitForTimeout(250);
  125 |   expect(pageErrors).toEqual([]);
  126 |   await dateInputs.nth(1).evaluate((element, value) => {
  127 |     const setter = Object.getOwnPropertyDescriptor(
  128 |       HTMLInputElement.prototype,
  129 |       "value",
  130 |     ).set;
  131 |     setter.call(element, value);
  132 |     element.dispatchEvent(new Event("input", { bubbles: true }));
  133 |     element.dispatchEvent(new Event("change", { bubbles: true }));
  134 |   }, "2026-08-10");
  135 |
  136 |   await expect
  137 |     .poll(() =>
  138 |       requests.some(
  139 |         (search) =>
  140 |           search.includes("startDate=2026-08-10") &&
  141 |           search.includes("endDate=2026-08-10"),
  142 |       ),
  143 |     )
  144 |     .toBe(true);
  145 |   await expect(page.getByText("เคสใหม่ในช่วงที่เลือก").first()).toBeVisible();
  146 | });
  147 |
```

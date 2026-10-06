# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: case-referrals.spec.js >> a third organization cannot open the shared referral
- Location: e2e\case-referrals.spec.js:120:1

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4173/admin/referrals?referral=8
Call log:
  - navigating to "http://127.0.0.1:4173/admin/referrals?referral=8", waiting until "load"

```

# Page snapshot

```yaml
- generic [ref=e3]:
    - generic [ref=e6]:
        - heading "This site can’t be reached" [level=1] [ref=e7]
        - paragraph [ref=e8]:
            - strong [ref=e9]: 127.0.0.1
            - text: refused to connect.
        - generic [ref=e10]:
            - paragraph [ref=e11]: "Try:"
            - list [ref=e12]:
                - listitem [ref=e13]: Checking the connection
                - listitem [ref=e14]:
                    - link "Checking the proxy and the firewall" [ref=e15] [cursor=pointer]:
                        - /url: "#buttons"
        - generic [ref=e16]: ERR_CONNECTION_REFUSED
    - generic [ref=e17]:
        - button "Reload" [ref=e19] [cursor=pointer]
        - button "Details" [ref=e20] [cursor=pointer]
```

# Test source

```ts
  24  |     const url = new URL(request.url());
  25  |     const path = url.pathname;
  26  |     const org = Number(request.headers()["x-organization-id"]);
  27  |     const project = () => ({
  28  |       ...store.row,
  29  |       direction: org === 1 ? "outgoing" : "incoming",
  30  |       allowed_statuses: org === 1 ? store.row.status === "pending" ? ["cancelled"] : [] : ({ pending: ["accepted", "rejected"], accepted: ["in_progress"], in_progress: ["completed"] }[store.row.status] || []),
  31  |       updates: store.updates,
  32  |     });
  33  |     if (path.endsWith("/me/authorization")) return route.fulfill({ json: {
  34  |       user: { id: 1, username: "e2e-admin" }, is_system_admin: true, system_permissions: [], memberships: [],
  35  |       organizations: [
  36  |         { id: 1, code: "SOURCE", name: "โรงพยาบาลต้นทางทดสอบ", org_type: "hospital" },
  37  |         { id: 2, code: "TARGET", name: "โรงพยาบาลปลายทางทดสอบ", org_type: "hospital" },
  38  |         { id: 3, code: "OTHER", name: "หน่วยงานที่สามทดสอบ", org_type: "school" },
  39  |       ],
  40  |     } });
  41  |     if (path.endsWith("/case-referrals/destinations")) return route.fulfill({ json: [{ id: 2, code: "TARGET", name: "โรงพยาบาลปลายทางทดสอบ" }] });
  42  |     if (path.endsWith("/case-referrals") && request.method() === "POST") {
  43  |       const body = request.postDataJSON(); store.received.push(body);
  44  |       store.row = { id: 8, source_organization_id: 1, destination_organization_id: 2, source_organization_name: "โรงพยาบาลต้นทางทดสอบ", destination_organization_name: "โรงพยาบาลปลายทางทดสอบ", display_name: "ผู้รับบริการ **********", form_title: current.form_title, reason: body.reason, status: "pending", version: 1, created_at: current.submitted_at, updated_at: current.submitted_at };
  45  |       store.updates.push({ id: 1, kind: "created", status: "pending", organization_name: "โรงพยาบาลต้นทางทดสอบ", actor_name: "เจ้าหน้าที่ทดสอบ", summary: "", created_at: current.submitted_at });
  46  |       return route.fulfill({ status: 201, json: { id: 8 } });
  47  |     }
  48  |     if (path.endsWith("/case-referrals")) {
  49  |       const matches = store.row && (url.searchParams.get("direction") === "outgoing" ? org === 1 : org === 2);
  50  |       return route.fulfill({ json: { items: matches ? [project()] : [], has_more: false, page: 1 } });
  51  |     }
  52  |     if (path.endsWith("/case-referrals/8/updates")) {
  53  |       const body = request.postDataJSON();
  54  |       if (body.version !== store.row.version) return route.fulfill({ status: 409, json: { message: "รายการนี้มีการอัปเดตแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนบันทึก" } });
  55  |       if (body.status) store.row.status = body.status;
  56  |       store.row.version += 1;
  57  |       store.updates.push({ id: store.updates.length + 1, kind: body.status ? "status" : "note", status: body.status, summary: body.summary || "", actor_name: "เจ้าหน้าที่ปลายทางทดสอบ", organization_name: "โรงพยาบาลปลายทางทดสอบ", created_at: current.submitted_at });
  58  |       return route.fulfill({ json: { success: true } });
  59  |     }
  60  |     if (path.endsWith("/case-referrals/8")) return route.fulfill({ status: org === 1 || org === 2 ? 200 : 404, json: org === 1 || org === 2 ? project() : { message: "ไม่พบรายการส่งต่อในหน่วยงานนี้" } });
  61  |     if (path.endsWith("/forms")) return route.fulfill({ json: [{ id: 1, title: current.form_title, status: "published", clinic_type: "general" }] });
  62  |     if (/\/forms\/1$/.test(path)) return route.fulfill({ json: { id: 1, title: current.form_title, questions: [], clinic_type: "general" } });
  63  |     if (path.includes("/forms/1/responses")) return route.fulfill({ json: [current] });
  64  |     if (path.endsWith("/master-cases/by-id/10") || path.endsWith("/master-cases/10/person-timeline")) return route.fulfill({ json: { masterCases: [{ id: 10, status: "Open" }], responses: [current] } });
  65  |     if (/\/(staffs|status-options|services|templates|answers|logs|appointments)$/.test(path)) return route.fulfill({ json: [] });
  66  |     if (path.endsWith("/school/access")) return route.fulfill({ json: {} });
  67  |     return route.fallback();
  68  |   });
  69  | }
  70  |
  71  | test("send, receive and sync only the shared status and summary across organizations", async ({ page, browser }, testInfo) => {
  72  |   const store = sharedStore();
  73  |   await mockPage(page, 1, store);
  74  |   await page.goto("/admin/cases");
  75  |   await page.getByRole("button", { name: current.summary_data.display_name, exact: true }).click();
  76  |   await page.getByRole("tab", { name: "ส่งต่อ", exact: true }).click();
  77  |   await page.getByLabel("หน่วยงานปลายทาง", { exact: true }).selectOption("2");
  78  |   await page.getByLabel("เหตุผลส่งต่อ / ข้อมูลเบื้องต้น", { exact: true }).fill("ขอประสานงานติดตามผู้รับบริการ (ข้อมูลจำลอง)");
  79  |   await page.getByRole("button", { name: "ส่งต่อเคส", exact: true }).click();
  80  |   await expect(page.getByRole("status").filter({ hasText: "ส่งต่อแล้ว" })).toBeVisible();
  81  |   expect(Object.keys(store.received[0]).sort()).toEqual(["destination_organization_id", "reason", "source_response_id"]);
  82  |   expect(JSON.stringify(store.received)).not.toContain("รายละเอียดเชิงลึกที่ไม่แชร์");
  83  |   await page.getByRole("link", { name: "โรงพยาบาลปลายทางทดสอบ", exact: true }).click();
  84  |   const sourceDrawer = page.getByRole("dialog");
  85  |   await expect(sourceDrawer.locator(".ref-status")).toHaveText(labels.pending);
  86  |
  87  |   const receivingContext = await browser.newContext({
  88  |     baseURL: "http://127.0.0.1:4173", locale: "th-TH",
  89  |     viewport: testInfo.project.use.viewport,
  90  |     isMobile: testInfo.project.use.isMobile,
  91  |     hasTouch: testInfo.project.use.hasTouch,
  92  |   });
  93  |   const receiving = await receivingContext.newPage();
  94  |   await mockPage(receiving, 2, store);
  95  |   await receiving.goto("/admin/referrals");
  96  |   await expect(receiving.getByRole("list", { name: "เคสรับเข้า" })).toContainText("ผู้รับบริการ");
  97  |   await receiving.getByRole("button", { name: store.row.display_name, exact: true }).click();
  98  |   const targetDrawer = receiving.getByRole("dialog");
  99  |   for (const next of ["accepted", "in_progress", "completed"]) {
  100 |     await targetDrawer.getByLabel("การดำเนินการ", { exact: true }).selectOption(next);
  101 |     if (next === "completed") await targetDrawer.getByLabel(/บันทึกสรุปที่แชร์ร่วมกัน/).fill("ดำเนินการประสานงานเรียบร้อย (ข้อมูลจำลอง)");
  102 |     await targetDrawer.getByRole("button", { name: "บันทึกการดำเนินการ", exact: true }).click();
  103 |     await expect(targetDrawer.locator(".ref-status")).toHaveText(labels[next]);
  104 |   }
  105 |   await sourceDrawer.getByRole("button", { name: "โหลดล่าสุด", exact: true }).click();
  106 |   await expect(sourceDrawer.locator(".ref-status")).toHaveText(labels.completed);
  107 |   await expect(sourceDrawer).toContainText("ดำเนินการประสานงานเรียบร้อย (ข้อมูลจำลอง)");
  108 |   await expect(targetDrawer).not.toContainText("รายละเอียดเชิงลึกที่ไม่แชร์");
  109 |   await expect(sourceDrawer).not.toContainText("รายละเอียดเชิงลึกที่ไม่แชร์");
  110 |   await expect(sourceDrawer.getByLabel(/บันทึกสรุปที่แชร์ร่วมกัน/)).toHaveCount(0);
  111 |   await sourceDrawer.getByRole("button", { name: "ปิดหน้าต่าง", exact: true }).click();
  112 |   await page.getByRole("button", { name: "ส่งออก", exact: true }).click();
  113 |   await expect(page.locator(".ref-queue")).toContainText(labels.completed);
  114 |   await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  115 |   await page.screenshot({ path: `../.impeccable/review/referrals/${testInfo.project.name}-list.png`, fullPage: true });
  116 |   await receiving.screenshot({ path: `../.impeccable/review/referrals/${testInfo.project.name}-detail.png`, fullPage: true });
  117 |   await receivingContext.close();
  118 | });
  119 |
  120 | test("a third organization cannot open the shared referral", async ({ page }) => {
  121 |   const store = sharedStore();
  122 |   store.row = { id: 8, status: "pending", version: 1 };
  123 |   await mockPage(page, 3, store);
> 124 |   await page.goto("/admin/referrals?referral=8");
      |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4173/admin/referrals?referral=8
  125 |   await expect(page.getByRole("dialog").getByRole("alert")).toContainText("ไม่พบรายการส่งต่อในหน่วยงานนี้");
  126 |   await expect(page.getByRole("dialog").getByLabel(/บันทึกสรุปที่แชร์ร่วมกัน/)).toHaveCount(0);
  127 | });
  128 |
```

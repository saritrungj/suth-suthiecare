import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const orgType of ["school", "hospital"])
  test(`${orgType}: create, edit, reorder and delete charts from all forms`, async ({
    page,
  }, testInfo) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      document.cookie = "suth_staff_session=synthetic; path=/";
      sessionStorage.setItem(
        "suth_user",
        JSON.stringify({ id: 1, username: "demo", role_id: 1 }),
      );
      localStorage.setItem("suth_active_organization_1", "3");
    });
    const forms = [
      {
        id: 1,
        title: "แบบฟอร์มตัวอย่าง",
        status: "published",
        clinic_type: "teenager",
        questions: [
          { id: "choice", title: "กิจกรรมที่ชอบ", type: "checkboxes" },
        ],
      },
      {
        id: 2,
        title: "แบบฟอร์มฉบับร่าง",
        status: "draft",
        clinic_type: "general",
        questions: [{ id: "weight", title: "น้ำหนัก", type: "number" }],
      },
    ];
    let settings = { active_charts: {}, last_selected_form_id: null },
      failSave = false;
    const chartRequests = [];
    await page.route("**/api/**", async (route) => {
      const req = route.request(),
        url = new URL(req.url()),
        path = url.pathname.replace(/^\/api/, "");
      const json = (body) => route.fulfill({ json: body });
      if (path === "/session/staff")
        return json({
          user: { id: 1, username: "demo", role_id: 1 },
          csrf_token: "synthetic",
        });
      if (path === "/session/patient")
        return route.fulfill({ status: 401, json: {} });
      if (path === "/me/authorization")
        return json({
          user: { id: 1 },
          is_system_admin: true,
          organizations: [
            {
              id: 3,
              name: "หน่วยงานตัวอย่าง",
              org_type: orgType,
              org_level: "unit",
              status: "active",
            },
          ],
          memberships: [],
        });
      if (path === "/school/access")
        return json({
          can_view_students: true,
          can_view_school: true,
          can_view_health: true,
          can_view_mental: true,
          can_view_risk: true,
        });
      if (path === "/school/schools")
        return json([
          {
            id: 1,
            name: "โรงเรียนตัวอย่าง (ข้อมูลสาธิต)",
            classroom_count: 8,
            teacher_count: 12,
          },
        ]);
      if (path === "/school/students")
        return json({ data: [], pagination: { total: 120 } });
      if (path === "/forms" || path === "/dashboard/forms") return json(forms);
      if (path === "/forms/1") return json(forms[0]);
      if (path === "/clinics") return json({ data: [] });
      if (path === "/dashboard-settings/settings") {
        if (req.method() === "POST") {
          if (failSave)
            return route.fulfill({
              status: 500,
              json: { message: "ทดสอบบันทึกล้มเหลว" },
            });
          const body = req.postDataJSON();
          settings = {
            active_charts: body.charts,
            last_selected_form_id: body.formId,
          };
          return json({ success: true });
        }
        return json(settings);
      }
      if (path.startsWith("/charts/")) {
        chartRequests.push(url.search);
        return json(
          path.includes("/2/")
            ? [
                { answer: 0, value: 1, submitted_date: "2026-10-01" },
                { answer: 20, value: 1, submitted_date: "2026-10-02" },
                { answer: 40, value: 1, submitted_date: "2026-10-02" },
              ]
            : [
                { answer: ["อ่าน", "อ่าน", "กีฬา"], value: 1 },
                { answer: ["กีฬา"], value: 1 },
              ],
        );
      }
      if (path === "/admin/master-cases/stats")
        return json({ totalActive: 5, newToday: 1, highRisk: 1, closed: 2 });
      if (path === "/evaluations/stats")
        return json({ total_votes: 0, recent_comments: [] });
      return json([]);
    });
    await page.goto("/admin/dashboard");
    await page.getByRole("button", { name: "สร้างกราฟ", exact: true }).click();
    let dialog = page.getByRole("dialog", { name: "สร้างกราฟจากแบบฟอร์ม" });
    await dialog.getByLabel("คำถาม", { exact: true }).selectOption("choice");
    for (const type of ["horizontal", "line", "pie", "donut", "table", "bar"]) {
      await dialog.getByLabel("รูปแบบ", { exact: true }).selectOption(type);
      await expect(dialog.locator(".fc-visual")).toBeVisible();
    }
    await dialog
      .getByLabel("ชื่อกราฟ", { exact: true })
      .fill("กิจกรรมของผู้ตอบ");
    await dialog.getByRole("button", { name: "บันทึกกราฟ" }).click();
    let card = page
      .locator(".fc-card")
      .filter({ has: page.getByRole("heading", { name: "กิจกรรมของผู้ตอบ" }) });
    await expect(card).toBeVisible();
    await card.getByText("ดูข้อมูลในตาราง").click();
    await expect(card.getByRole("row", { name: "กีฬา 2" })).toBeVisible();
    await expect(card.getByRole("row", { name: "อ่าน 1" })).toBeVisible();
    await card
      .getByRole("button", { name: "แก้ไข กิจกรรมของผู้ตอบ", exact: true })
      .click();
    dialog = page.getByRole("dialog", { name: "แก้ไขกราฟ" });
    await dialog
      .getByLabel("ชื่อกราฟ", { exact: true })
      .fill("กิจกรรมที่แก้ไข");
    await dialog.getByLabel("รูปแบบ", { exact: true }).selectOption("donut");
    failSave = true;
    await dialog.getByRole("button", { name: "บันทึกกราฟ" }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(dialog.getByLabel("ชื่อกราฟ", { exact: true })).toHaveValue(
      "กิจกรรมที่แก้ไข",
    );
    failSave = false;
    await dialog.getByRole("button", { name: "บันทึกกราฟ" }).click();
    await expect(dialog).toHaveCount(0);
    await page.getByRole("button", { name: "สร้างกราฟ", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "สร้างกราฟจากแบบฟอร์ม" });
    await dialog.getByLabel("แบบฟอร์ม", { exact: true }).selectOption("2");
    await dialog.getByLabel("คำถาม", { exact: true }).selectOption("weight");
    await dialog.getByLabel("ชื่อกราฟ", { exact: true }).fill("น้ำหนักเฉลี่ย");
    await dialog
      .getByLabel("วิธีคำนวณ", { exact: true })
      .selectOption("average");
    await dialog
      .getByLabel("จัดกลุ่มตาม", { exact: true })
      .selectOption("month");
    await dialog.getByRole("button", { name: "บันทึกกราฟ" }).click();
    card = page
      .locator(".fc-card")
      .filter({ has: page.getByRole("heading", { name: "น้ำหนักเฉลี่ย" }) });
    await card.getByText("ดูข้อมูลในตาราง").click();
    await expect(card.getByRole("row", { name: "2026-10 20" })).toBeVisible();
    await card
      .getByRole("button", { name: "เลื่อน น้ำหนักเฉลี่ย ขึ้น" })
      .click();
    await page.reload();
    await expect(
      page
        .locator(".fc-card")
        .first()
        .getByRole("heading", { name: "น้ำหนักเฉลี่ย" }),
    ).toBeVisible();
    await expect(page.locator(".fc-card")).toHaveCount(2);
    if (orgType === "school") {
      await expect(
        page.getByRole("heading", { name: "ภาพรวมโรงเรียน" }),
      ).toBeVisible();
      await page.getByLabel("ตั้งแต่วันที่").fill("2026-08-01");
      await page.getByLabel("ถึงวันที่").fill("2026-08-31");
      await expect
        .poll(() =>
          chartRequests.some(
            (q) =>
              q.includes("startDate=2026-08-01") &&
              q.includes("endDate=2026-08-31"),
          ),
        )
        .toBe(true);
    }
    await page
      .locator(".fc-card")
      .last()
      .screenshot({
        path: `../outputs/rounded-chart-${orgType}-${testInfo.project.name}.png`,
      });
    await page.screenshot({
      path: `../outputs/dashboard-${orgType}-${testInfo.project.name}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "แก้ไข น้ำหนักเฉลี่ย", exact: true })
      .click();
    await page.locator(".fc-preview").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `../outputs/chart-editor-${orgType}-${testInfo.project.name}.png`,
      fullPage: true,
    });
    const accessibility = await new AxeBuilder({ page })
      .include(".fc-editor")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    await page
      .getByRole("button", { name: "ปิดหน้าต่าง", exact: true })
      .click();
    await page
      .getByRole("button", { name: "ลบ กิจกรรมที่แก้ไข", exact: true })
      .click();
    await page
      .getByRole("button", { name: "ยืนยันลบกราฟ", exact: true })
      .click();
    await expect(page.locator(".fc-card")).toHaveCount(1);
    expect(errors).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });

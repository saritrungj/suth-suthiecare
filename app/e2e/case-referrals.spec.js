import { test, expect } from "@playwright/test";
import { mockAdminApi } from "./helpers/api-mocks.js";

const current = {
  id: 101,
  master_case_id: 10,
  form_id: 1,
  clinic_type: "general",
  form_title: "แบบประเมินทดสอบ",
  submitted_at: "2026-10-03T09:00:00+07:00",
  summary_data: {
    display_name: "ผู้รับบริการ ข้อมูลจำลอง",
    raw_answers: { บันทึกภายใน: "รายละเอียดเชิงลึกที่ไม่แชร์" },
  },
};
const labels = {
  pending: "รอรับเรื่อง",
  accepted: "รับเรื่องแล้ว",
  in_progress: "กำลังดำเนินการ",
  completed: "เสร็จสิ้น",
};
function sharedStore() {
  return { row: null, received: [], updates: [] };
}
async function mockPage(page, organization, store) {
  await page.clock.setFixedTime(new Date("2026-10-03T10:00:00+07:00"));
  await page.addInitScript((org) => {
    localStorage.setItem("i18nextLng", "th");
    localStorage.setItem("suth_active_organization_1", String(org));
    document.cookie = "suth_staff_session=synthetic-session; path=/";
    sessionStorage.setItem("suth_user", JSON.stringify({ id: 1, role_id: 1 }));
  }, organization);
  await mockAdminApi(page);
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const org = Number(request.headers()["x-organization-id"]);
    const project = () => ({
      ...store.row,
      direction: org === 1 ? "outgoing" : "incoming",
      allowed_statuses:
        org === 1
          ? store.row.status === "pending"
            ? ["cancelled"]
            : []
          : {
              pending: ["accepted", "rejected"],
              accepted: ["in_progress"],
              in_progress: ["completed"],
            }[store.row.status] || [],
      updates: store.updates,
    });
    if (path.endsWith("/me/authorization"))
      return route.fulfill({
        json: {
          user: { id: 1, username: "e2e-admin" },
          is_system_admin: true,
          system_permissions: [],
          memberships: [],
          organizations: [
            {
              id: 1,
              code: "SOURCE",
              name: "โรงพยาบาลต้นทางทดสอบ",
              org_type: "hospital",
            },
            {
              id: 2,
              code: "TARGET",
              name: "โรงพยาบาลปลายทางทดสอบ",
              org_type: "hospital",
            },
            {
              id: 3,
              code: "OTHER",
              name: "หน่วยงานที่สามทดสอบ",
              org_type: "school",
            },
          ],
        },
      });
    if (path.endsWith("/case-referrals/destinations"))
      return route.fulfill({
        json: [{ id: 2, code: "TARGET", name: "โรงพยาบาลปลายทางทดสอบ" }],
      });
    if (path.endsWith("/case-referrals") && request.method() === "POST") {
      const body = request.postDataJSON();
      store.received.push(body);
      store.row = {
        id: 8,
        source_organization_id: 1,
        destination_organization_id: 2,
        source_organization_name: "โรงพยาบาลต้นทางทดสอบ",
        destination_organization_name: "โรงพยาบาลปลายทางทดสอบ",
        display_name: "ผู้รับบริการ **********",
        form_title: current.form_title,
        reason: body.reason,
        status: "pending",
        version: 1,
        created_at: current.submitted_at,
        updated_at: current.submitted_at,
      };
      store.updates.push({
        id: 1,
        kind: "created",
        status: "pending",
        organization_name: "โรงพยาบาลต้นทางทดสอบ",
        actor_name: "เจ้าหน้าที่ทดสอบ",
        summary: "",
        created_at: current.submitted_at,
      });
      return route.fulfill({ status: 201, json: { id: 8 } });
    }
    if (path.endsWith("/case-referrals")) {
      const matches =
        store.row &&
        (url.searchParams.get("direction") === "outgoing"
          ? org === 1
          : org === 2);
      return route.fulfill({
        json: { items: matches ? [project()] : [], has_more: false, page: 1 },
      });
    }
    if (path.endsWith("/case-referrals/8/updates")) {
      const body = request.postDataJSON();
      if (body.version !== store.row.version)
        return route.fulfill({
          status: 409,
          json: {
            message: "รายการนี้มีการอัปเดตแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนบันทึก",
          },
        });
      if (body.status) store.row.status = body.status;
      store.row.version += 1;
      store.updates.push({
        id: store.updates.length + 1,
        kind: body.status ? "status" : "note",
        status: body.status,
        summary: body.summary || "",
        actor_name: "เจ้าหน้าที่ปลายทางทดสอบ",
        organization_name: "โรงพยาบาลปลายทางทดสอบ",
        created_at: current.submitted_at,
      });
      return route.fulfill({ json: { success: true } });
    }
    if (path.endsWith("/case-referrals/8"))
      return route.fulfill({
        status: org === 1 || org === 2 ? 200 : 404,
        json:
          org === 1 || org === 2
            ? project()
            : { message: "ไม่พบรายการส่งต่อในหน่วยงานนี้" },
      });
    if (path.endsWith("/forms"))
      return route.fulfill({
        json: [
          {
            id: 1,
            title: current.form_title,
            status: "published",
            clinic_type: "general",
          },
        ],
      });
    if (/\/forms\/1$/.test(path))
      return route.fulfill({
        json: {
          id: 1,
          title: current.form_title,
          questions: [],
          clinic_type: "general",
        },
      });
    if (path.includes("/forms/1/responses"))
      return route.fulfill({ json: [current] });
    if (
      path.endsWith("/master-cases/by-id/10") ||
      path.endsWith("/master-cases/10/person-timeline")
    )
      return route.fulfill({
        json: {
          masterCases: [{ id: 10, status: "Open" }],
          responses: [current],
        },
      });
    if (
      /\/(staffs|status-options|services|templates|answers|logs|appointments)$/.test(
        path,
      )
    )
      return route.fulfill({ json: [] });
    if (path.endsWith("/school/access")) return route.fulfill({ json: {} });
    return route.fallback();
  });
}

test("send, receive and sync only the shared status and summary across organizations", async ({
  page,
  browser,
}, testInfo) => {
  const store = sharedStore();
  await mockPage(page, 1, store);
  await page.goto("/admin/cases");
  await page
    .locator(".cw-person-open").first()
    .click();
  await page.getByRole("tab", { name: "ส่งต่อ", exact: true }).click();
  await page.getByLabel("หน่วยงานปลายทาง", { exact: true }).selectOption("2");
  await page
    .getByLabel("เหตุผลส่งต่อ / ข้อมูลเบื้องต้น", { exact: true })
    .fill("ขอประสานงานติดตามผู้รับบริการ (ข้อมูลจำลอง)");
  await page.getByRole("button", { name: "ส่งต่อเคส", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "ส่งต่อแล้ว" }),
  ).toBeVisible();
  expect(Object.keys(store.received[0]).sort()).toEqual([
    "destination_organization_id",
    "reason",
    "source_response_id",
  ]);
  expect(JSON.stringify(store.received)).not.toContain(
    "รายละเอียดเชิงลึกที่ไม่แชร์",
  );
  await page
    .getByRole("link", { name: "โรงพยาบาลปลายทางทดสอบ", exact: true })
    .click();
  const sourceDrawer = page.getByRole("dialog");
  await expect(sourceDrawer.locator(".ref-status")).toHaveText(labels.pending);

  const receivingContext = await browser.newContext({
    baseURL: "http://127.0.0.1:4173",
    locale: "th-TH",
    viewport: testInfo.project.use.viewport,
    isMobile: testInfo.project.use.isMobile,
    hasTouch: testInfo.project.use.hasTouch,
  });
  const receiving = await receivingContext.newPage();
  await mockPage(receiving, 2, store);
  await receiving.goto("/admin/referrals");
  await expect(
    receiving.getByRole("list", { name: "เคสรับเข้า" }),
  ).toContainText("ผู้รับบริการ");
  await receiving
    .getByRole("button", { name: store.row.display_name, exact: true })
    .click();
  const targetDrawer = receiving.getByRole("dialog");
  for (const next of ["accepted", "in_progress", "completed"]) {
    await targetDrawer
      .getByLabel("การดำเนินการ", { exact: true })
      .selectOption(next);
    if (next === "completed")
      await targetDrawer
        .getByLabel(/บันทึกสรุปที่แชร์ร่วมกัน/)
        .fill("ดำเนินการประสานงานเรียบร้อย (ข้อมูลจำลอง)");
    await targetDrawer
      .getByRole("button", { name: "บันทึกการดำเนินการ", exact: true })
      .click();
    await expect(targetDrawer.locator(".ref-status")).toHaveText(labels[next]);
  }
  await sourceDrawer
    .getByRole("button", { name: "โหลดล่าสุด", exact: true })
    .click();
  await expect(sourceDrawer.locator(".ref-status")).toHaveText(
    labels.completed,
  );
  await expect(sourceDrawer).toContainText(
    "ดำเนินการประสานงานเรียบร้อย (ข้อมูลจำลอง)",
  );
  await expect(targetDrawer).not.toContainText("รายละเอียดเชิงลึกที่ไม่แชร์");
  await expect(sourceDrawer).not.toContainText("รายละเอียดเชิงลึกที่ไม่แชร์");
  await expect(sourceDrawer.getByLabel(/บันทึกสรุปที่แชร์ร่วมกัน/)).toHaveCount(
    0,
  );
  await sourceDrawer
    .getByRole("button", { name: "ปิดหน้าต่าง", exact: true })
    .click();
  await page.getByRole("button", { name: "ส่งออก", exact: true }).click();
  await expect(page.locator(".ref-queue")).toContainText(labels.completed);
  const captureViewport = testInfo.project.use.isMobile
    ? { width: 390, height: 844 }
    : { width: 1440, height: 900 };
  await page.setViewportSize(captureViewport);
  await receiving.setViewportSize(captureViewport);
  await targetDrawer.locator(".cw-drawer-body").evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page.screenshot({
    path: `../.impeccable/review/referrals/${testInfo.project.name}-list.png`,
    fullPage: true,
  });
  await receiving.screenshot({
    path: `../.impeccable/review/referrals/${testInfo.project.name}-detail.png`,
    fullPage: true,
  });
  await receivingContext.close();
});

test("a third organization cannot open the shared referral", async ({
  page,
}) => {
  const store = sharedStore();
  store.row = { id: 8, status: "pending", version: 1 };
  await mockPage(page, 3, store);
  await page.goto("/admin/referrals?referral=8");
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "ไม่พบรายการส่งต่อในหน่วยงานนี้",
  );
  await expect(
    page.getByRole("dialog").getByLabel(/บันทึกสรุปที่แชร์ร่วมกัน/),
  ).toHaveCount(0);
});

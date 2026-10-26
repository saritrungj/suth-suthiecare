import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const flags = (value) =>
  Object.fromEntries(
    ["view", "create", "update", "delete", "assign", "export", "manage"].map(
      (a) => [a, value],
    ),
  );
const school = {
  id: 3,
  name: "โรงเรียนจำลอง",
  org_type: "school",
  org_level: "unit",
};
const report = {
  school: { id: 2, name: "โรงเรียนจำลอง" },
  population: 120,
  scope: "school",
  suppressed_below: 5,
  trend_basis: "rounds",
  trend: [
    {
      key: "round-1",
      label: "รอบ 1/2569",
      high: 12,
      medium: 20,
      normal: 70,
      assessed: 102,
      not_assessed: 18,
    },
    {
      key: "round-2",
      label: "รอบ 2/2569",
      high: null,
      medium: 15,
      normal: 90,
      assessed: null,
      not_assessed: null,
    },
  ],
  follow_up: {
    behavior: { new: 6, following: null, closed: 9 },
    physical: { open: 7, overdue: 0, done: 11 },
    rescreen: { pending: 8, overdue: null, completed: 30 },
    guidance: { overdue: 5 },
    referrals: { pending: 0, in_progress: 6, completed: 10 },
    appointments: { upcoming: 9, completed: 14, no_show: null },
  },
};

async function setup(
  page,
  { permissions = ["dashboard.view"], access = {} } = {},
) {
  const requests = [];
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "suth_user",
      JSON.stringify({ id: 5, username: "synthetic-supervisor", role_id: 7 }),
    );
    localStorage.setItem("suth_active_organization_5", "3");
    document.cookie = "suth_staff_session=synthetic; path=/";
  });
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname.replace(/^\/api/, "");
    requests.push(`${path}${url.search}`);
    if (path === "/session/staff")
      return route.fulfill({
        json: { user: { id: 5, role_id: 7 }, csrf_token: "synthetic" },
      });
    if (path === "/session/patient")
      return route.fulfill({ status: 401, json: {} });
    if (path === "/me/authorization")
      return route.fulfill({
        json: {
          user: { id: 5, role_id: 7 },
          is_system_admin: false,
          organizations: [school],
          memberships: [
            { organization: school, role: { name: "หัวหน้างาน" }, permissions },
          ],
        },
      });
    if (path === "/school/access")
      return route.fulfill({
        json: {
          is_guardian: false,
          can_view_school: true,
          can_view_reports: true,
          staff_actions: flags(false),
          workflow_actions: flags(false),
          health_actions: flags(false),
          behavior_actions: flags(false),
          appointment_actions: flags(false),
          document_actions: flags(false),
          ...access,
        },
      });
    if (path === "/school/notifications/unread-count")
      return route.fulfill({ json: { count: 0 } });
    if (path === "/school/schools")
      return route.fulfill({
        json: [{ id: 2, name: "โรงเรียนจำลอง", status: "active" }],
      });
    if (path === "/school/reports/overview") {
      if (url.searchParams.get("format") === "csv")
        return route.fulfill({
          headers: {
            "content-type": "text/csv",
            "content-disposition": "attachment; filename*=UTF-8''report.csv",
          },
          body: "หมวด,รายการ,จำนวน",
        });
      return route.fulfill({ json: report });
    }
    return route.fulfill({ json: [] });
  });
  return requests;
}

test("a supervisor sees counts only, with small counts hidden and no drill-down", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/admin/school/reports");
  await expect(
    page.getByRole("heading", { name: "รายงานภาพรวม" }),
  ).toBeVisible();
  await expect(page.getByText(/นักเรียนทั้งโรงเรียน 120 คน/)).toBeVisible();
  const legend = page.getByRole("list", { name: "คำอธิบายสี" });
  for (const label of ["เสี่ยงสูง", "เฝ้าระวัง", "ปกติ"])
    await expect(legend).toContainText(label);
  await expect(
    page.getByText("ช่องที่มีนักเรียนน้อยกว่า 5 คนถูกซ่อน", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ดูเป็นตาราง" }).click();
  const row = page.getByRole("row", { name: /รอบ 2\/2569/ });
  await expect(row).toContainText("น้อยกว่า 5");
  await expect(row).toContainText("90");
  const group = page.getByRole("region", { name: "รายงานพฤติกรรม" });
  await expect(group).toContainText("น้อยกว่า 5");
  // No student lists for a supervisor: no "เปิดรายการ" links, no export without the right.
  await expect(page.getByRole("link", { name: /เปิดรายการ/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "ส่งออก CSV" })).toHaveCount(0);
  const axe = await new AxeBuilder({ page }).include(".rp-page").analyze();
  expect(axe.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("staff with list rights get links into their lists and can export", async ({
  page,
}) => {
  const requests = await setup(page, {
    permissions: ["dashboard.view", "dashboard.export"],
    access: { can_use_behavior: true, can_view_physical: true },
  });
  await page.goto("/admin/school/reports");
  await expect(
    page
      .getByRole("region", { name: "รายงานพฤติกรรม" })
      .getByRole("link", { name: /เปิดรายการ/ }),
  ).toHaveAttribute("href", "/admin/school/behavior");
  await expect(
    page.getByRole("region", { name: "ภาวะเสี่ยงทางกาย" }).getByRole("link"),
  ).toHaveAttribute("href", "/admin/school/follow-ups");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "ส่งออก CSV" }).click();
  await download;
  expect(
    requests.some(
      (r) => r.includes("/school/reports/overview") && r.includes("format=csv"),
    ),
  ).toBe(true);
});

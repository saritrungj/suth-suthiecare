import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const school = {
  id: 3,
  name: "โรงเรียนจำลอง",
  org_type: "school",
  org_level: "unit",
};
const flags = (value) =>
  Object.fromEntries(
    ["view", "create", "update", "delete", "assign", "export", "manage"].map(
      (a) => [a, value],
    ),
  );
const student = {
  id: 11,
  school_id: 2,
  student_code: "DEMO011",
  first_name: "นักเรียนจำลอง",
  last_name: "ในความดูแล",
  status: "active",
};

async function setup(page, { guardian = false } = {}) {
  const calls = [];
  let items = [
    {
      id: 1,
      kind: "risk_alert",
      student_id: 11,
      payload: {
        title: "พบนักเรียนกลุ่มเสี่ยง",
        body: "DEMO011 ห้อง ม.1/1 ระดับเสี่ยงสูง",
      },
      read_at: null,
      acknowledged_at: null,
      created_at: "2026-10-20T08:30:00+07:00",
    },
    {
      id: 2,
      kind: "behavior_report",
      student_id: null,
      payload: { title: "รายงานพฤติกรรมใหม่" },
      read_at: "2026-10-19T09:00:00+07:00",
      acknowledged_at: "2026-10-19T09:00:00+07:00",
      created_at: "2026-10-19T08:00:00+07:00",
    },
  ];
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "suth_user",
      JSON.stringify({ id: 5, username: "synthetic-counselor", role_id: 7 }),
    );
    localStorage.setItem("suth_active_organization_5", "3");
    document.cookie = "suth_staff_session=synthetic; path=/";
  });
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname.replace(/^\/api/, "");
    calls.push(`${req.method()} ${path}`);
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
            {
              organization: school,
              role: { name: guardian ? "school_guardian" : "teacher" },
              permissions: [
                "students.view",
                "student_health.view",
                "clinical.view",
              ],
            },
          ],
        },
      });
    if (path === "/school/access")
      return route.fulfill({
        json: {
          is_guardian: guardian,
          can_view_students: true,
          can_view_school: false,
          staff_actions: flags(false),
          workflow_actions: flags(false),
          health_actions: flags(false),
          behavior_actions: flags(false),
          appointment_actions: flags(false),
          document_actions: flags(false),
          counselor_grade_ids: [1],
          can_view_health: true,
          can_view_mental: true,
          can_view_physical: true,
        },
      });
    if (path === "/school/notifications/unread-count")
      return route.fulfill({
        json: { count: items.filter((n) => !n.read_at).length },
      });
    if (path === "/school/notifications")
      return route.fulfill({
        json: { items, total: items.length, page: 1, page_size: 10 },
      });
    if (path === "/school/notifications/read-all") {
      items = items.map((n) => ({
        ...n,
        read_at: n.read_at || "2026-10-20T09:00:00+07:00",
      }));
      return route.fulfill({ json: { updated: 1 } });
    }
    const ack = path.match(/^\/school\/notifications\/(\d+)\/ack$/);
    if (ack) {
      items = items.map((n) =>
        n.id === Number(ack[1])
          ? {
              ...n,
              read_at: "2026-10-20T09:00:00+07:00",
              acknowledged_at: "2026-10-20T09:00:00+07:00",
            }
          : n,
      );
      return route.fulfill({
        json: items.find((n) => n.id === Number(ack[1])),
      });
    }
    if (path === "/school/schools")
      return route.fulfill({
        json: [{ id: 2, name: "โรงเรียนจำลอง", status: "active" }],
      });
    if (path === "/school/students/11")
      return route.fulfill({ json: { ...student, can_view_health: false } });
    if (path === "/school/students")
      return route.fulfill({
        json: {
          data: [student],
          pagination: { total: 1, page: 1, total_pages: 1, limit: 20 },
        },
      });
    // Lookups the student list loads (types, grades, rooms, master data).
    return route.fulfill({ json: req.method() === "GET" ? [] : {} });
  });
  return calls;
}

// The sidebar is a drawer on phones.
const openSidebar = async (page) => {
  if (page.viewportSize().width <= 768)
    await page.getByRole("button", { name: "Open Menu" }).click();
};

// Runs in both the desktop and the mobile project.
test("school staff see unread notifications and act on them", async ({
  page,
}) => {
  const viewport = page.viewportSize();
  const calls = await setup(page);
  await page.goto("/admin/school/students");
  await openSidebar(page);
  const bell = page.getByRole("button", {
    name: "การแจ้งเตือน ยังไม่อ่าน 1 รายการ",
  });
  await expect(bell).toBeVisible();
  await bell.click();
  const panel = page.getByRole("dialog", { name: "การแจ้งเตือน" });
  await expect(panel).toBeVisible();
  await expect(
    panel.getByText("DEMO011 ห้อง ม.1/1 ระดับเสี่ยงสูง"),
  ).toBeVisible();
  await expect(panel.getByText("รับเรื่องแล้ว")).toBeVisible();
  // Only the unacknowledged item can still be acknowledged.
  await expect(panel.getByRole("button", { name: "รับเรื่อง" })).toHaveCount(1);
  const axe = await new AxeBuilder({ page })
    .include(".notification-panel")
    .analyze();
  expect(axe.violations).toEqual([]);
  const box = await panel.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  await panel.getByRole("button", { name: "รับเรื่อง" }).click();
  await expect(panel.getByRole("button", { name: "รับเรื่อง" })).toHaveCount(0);
  expect(calls).toContain("PUT /school/notifications/1/ack");
  await expect(
    page.getByRole("button", { name: "การแจ้งเตือน", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
});

test("the student link from a notification opens that student's file", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/admin/school/students");
  await openSidebar(page);
  await page.getByRole("button", { name: /การแจ้งเตือน/ }).click();
  await page.getByRole("link", { name: "เปิดแฟ้มนักเรียน" }).click();
  await expect(page).toHaveURL(/\/admin\/school\/students\/11$/);
  // Followed from the list page itself, the student file opens as a page.
  await expect(page.getByRole("tab", { name: "ข้อมูลทั่วไป" })).toBeVisible();
});

test("guardians do not get the notification inbox", async ({ page }) => {
  const calls = await setup(page, { guardian: true });
  await page.goto("/admin/school/students");
  await expect(page.getByText("นักเรียนจำลอง").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /การแจ้งเตือน/ })).toHaveCount(
    0,
  );
  expect(calls.some((c) => c.includes("/school/notifications"))).toBe(false);
});

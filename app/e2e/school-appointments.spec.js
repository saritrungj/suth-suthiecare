import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockPublicApi } from "./helpers/api-mocks.js";

const flags = (value, overrides = {}) => ({
  ...Object.fromEntries(
    ["view", "create", "update", "delete", "assign", "export", "manage"].map(
      (a) => [a, value],
    ),
  ),
  ...overrides,
});

test("a school student books counseling with one of their own teachers", async ({
  page,
}) => {
  await mockPublicApi(page);
  const posts = [];
  let booked = false;
  await page.addInitScript(() => {
    document.cookie = "suth_patient_session=synthetic-session; path=/";
    sessionStorage.setItem(
      "patient_user",
      JSON.stringify({ id: 1, username: "student", status: "active" }),
    );
  });
  await page.route("**/api/patient/history", (route) =>
    route.fulfill({
      json: {
        success: true,
        profile: { id: 1, username: "student", status: "active" },
        member_type: { type: "school_student", source: "school" },
        masterCases: [],
        responses: [],
      },
    }),
  );
  await page.route("**/api/patient/me/school-health", (route) =>
    route.fulfill({ json: { success: true, profile: {}, records: [] } }),
  );
  await page.route("**/api/patient/me/assessment-tasks", (route) =>
    route.fulfill({ json: { success: true, tasks: [] } }),
  );
  await page.route("**/api/patient/school-appointments**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname;
    if (path.endsWith("/options"))
      return route.fulfill({
        json: {
          success: true,
          students: [
            {
              student_id: 11,
              school_name: "โรงเรียนจำลอง",
              topics: [
                { id: 1, label: "การเรียน" },
                { id: 4, label: "อารมณ์และความรู้สึก" },
              ],
              staff: [
                {
                  id: 9,
                  name: "ครูแนะแนว จำลอง",
                  duty: "ครูแนะแนว",
                  slots: [
                    {
                      id: 31,
                      starts_at: "2030-01-15T09:00",
                      ends_at: "2030-01-15T09:30",
                    },
                  ],
                },
              ],
            },
          ],
        },
      });
    if (req.method() === "POST") {
      posts.push(req.postDataJSON());
      booked = true;
      return route.fulfill({ status: 201, json: { success: true, id: 5 } });
    }
    return route.fulfill({
      json: {
        success: true,
        eligible: true,
        appointments: booked
          ? [
              {
                id: 5,
                status: "requested",
                starts_at: "2030-01-15T09:00",
                ends_at: "2030-01-15T09:30",
                staff_name: "ครูแนะแนว จำลอง",
                topic_label: "อารมณ์และความรู้สึก",
                can_cancel: true,
              },
            ]
          : [],
      },
    });
  });

  await page.goto("/history/result");
  const panel = page.getByRole("region", { name: "นัดหมายรับคำปรึกษา" });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("ยังไม่มีนัดหมาย");
  await panel.getByRole("button", { name: "ขอนัดหมาย" }).click();
  await expect(panel.getByText(/สายด่วนสุขภาพจิต 1323/)).toBeVisible();
  const send = panel.getByRole("button", { name: "ส่งคำขอนัด" });
  await expect(send).toBeDisabled();
  await panel.getByRole("radio", { name: "อารมณ์และความรู้สึก" }).check();
  await panel.getByRole("radio", { name: /ครูแนะแนว จำลอง/ }).check();
  await panel.getByRole("radio", { name: /09:00–09:30/ }).check();
  await panel.getByLabel("เล่าเพิ่มเติม (ไม่บังคับ)").fill("ข้อความจำลอง");
  const axe = await new AxeBuilder({ page }).include(".cp-panel").analyze();
  expect(axe.violations).toEqual([]);
  await send.click();
  await expect(panel.getByRole("status")).toContainText("ส่งคำขอนัดแล้ว");
  expect(posts[0]).toEqual({
    student_id: 11,
    topic_id: 4,
    slot_id: 31,
    note: "ข้อความจำลอง",
  });
  await expect(panel).toContainText("รอครูยืนยัน");
  await expect(panel.getByRole("button", { name: /ยกเลิกนัด/ })).toBeVisible();
});

test("students who are not on a school roster never see the panel", async ({
  page,
}) => {
  await mockPublicApi(page);
  await page.addInitScript(() => {
    document.cookie = "suth_patient_session=synthetic-session; path=/";
    sessionStorage.setItem(
      "patient_user",
      JSON.stringify({ id: 1, username: "student", status: "active" }),
    );
  });
  await page.route("**/api/patient/history", (route) =>
    route.fulfill({
      json: {
        success: true,
        profile: { id: 1, username: "student", status: "active" },
        member_type: { type: "school_student", source: "school" },
        masterCases: [],
        responses: [],
      },
    }),
  );
  await page.route("**/api/patient/me/**", (route) =>
    route.fulfill({ json: { success: true, tasks: [], records: [] } }),
  );
  await page.route("**/api/patient/school-appointments**", (route) =>
    route.fulfill({
      json: { success: true, eligible: false, appointments: [] },
    }),
  );
  await page.goto("/history/result");
  await expect(page.locator(".hr-name, h1").first()).toBeVisible();
  await expect(
    page.getByRole("region", { name: "นัดหมายรับคำปรึกษา" }),
  ).toHaveCount(0);
});

const school = {
  id: 3,
  name: "โรงเรียนจำลอง",
  org_type: "school",
  org_level: "unit",
};
async function staffSetup(page, { bookable = true } = {}) {
  const writes = [];
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
      path = new URL(req.url()).pathname.replace(/^\/api/, ""),
      method = req.method();
    if (method !== "GET")
      writes.push({ method, path, body: req.postDataJSON?.() });
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
              role: { name: "ครูแนะแนว" },
              permissions: ["school_appointments.manage"],
            },
          ],
        },
      });
    if (path === "/school/access")
      return route.fulfill({
        json: {
          is_guardian: false,
          can_view_students: true,
          appointment_actions: flags(true),
          can_use_appointments: true,
          staff_actions: flags(false),
          workflow_actions: flags(false),
          health_actions: flags(false),
          behavior_actions: flags(false),
        },
      });
    if (path === "/school/notifications/unread-count")
      return route.fulfill({ json: { count: 0 } });
    if (path === "/school/schools")
      return route.fulfill({
        json: [{ id: 2, name: "โรงเรียนจำลอง", status: "active" }],
      });
    if (path === "/school/appointments" && method === "GET")
      return route.fulfill({
        json: {
          data: [
            {
              id: 5,
              status: "requested",
              starts_at: "2030-01-15T09:00",
              ends_at: "2030-01-15T09:30",
              student_id: 11,
              student_code: "DEMO011",
              student_name: "ด.ช. นักเรียน จำลอง",
              grade_name: "ม.1",
              classroom_name: "1",
              topic_label: "อารมณ์และความรู้สึก",
              staff_name: "ครูแนะแนว จำลอง",
            },
          ],
          pagination: { total: 1, page: 1, limit: 10, total_pages: 1 },
          oversees: false,
        },
      });
    if (path === "/school/appointments/5" && method === "GET")
      return route.fulfill({
        json: {
          id: 5,
          status: "requested",
          starts_at: "2030-01-15T09:00",
          ends_at: "2030-01-15T09:30",
          student_code: "DEMO011",
          student_name: "ด.ช. นักเรียน จำลอง",
          topic_label: "อารมณ์และความรู้สึก",
          staff_name: "ครูแนะแนว จำลอง",
          note: "ข้อความจำลอง",
          reschedule_slots: [
            {
              id: 32,
              starts_at: "2030-01-16T09:00",
              ends_at: "2030-01-16T09:30",
            },
          ],
          transfer_options: [],
          can_record_guidance: true,
        },
      });
    if (path === "/school/appointment-slots" && method === "GET")
      return route.fulfill({
        json: {
          slots: [
            {
              id: 31,
              starts_at: "2030-01-15T09:00",
              ends_at: "2030-01-15T09:30",
              capacity: 1,
              booked: 1,
              status: "open",
            },
          ],
          bookable,
        },
      });
    if (path === "/school/appointment-slots" && method === "POST")
      return route.fulfill({ status: 201, json: { ids: [40, 41] } });
    if (method !== "GET") return route.fulfill({ json: { success: true } });
    return route.fulfill({ json: [] });
  });
  return writes;
}

test("staff confirm a request and record the session afterwards", async ({
  page,
}) => {
  const writes = await staffSetup(page);
  await page.goto("/admin/school/appointments");
  await page.getByRole("button", { name: "เปิดนัดหมายของ DEMO011" }).click();
  const dialog = page.getByRole("dialog", { name: "นัดหมายรับคำปรึกษา" });
  await expect(dialog.getByText("ข้อความจำลอง")).toBeVisible();
  await dialog
    .getByRole("checkbox", { name: "บันทึกการให้คำปรึกษาไว้ในแฟ้มนักเรียน" })
    .check();
  const done = dialog.getByRole("button", { name: "บันทึกว่าพบแล้ว" });
  await expect(done).toBeDisabled();
  await dialog.getByLabel("เรื่องที่พูดคุย").fill("สรุปจำลอง");
  await done.click();
  await expect
    .poll(() => writes.find((w) => w.path === "/school/appointments/5"))
    .toBeTruthy();
  expect(
    writes.find((w) => w.path === "/school/appointments/5").body,
  ).toMatchObject({
    action: "complete",
    outcome: { issue: "สรุปจำลอง" },
  });
});

test("staff open repeating slots and cannot close a booked one", async ({
  page,
}) => {
  const writes = await staffSetup(page);
  await page.goto("/admin/school/appointments");
  await page.getByRole("button", { name: "ช่วงเวลาว่างของฉัน" }).click();
  await expect(
    page.getByRole("button", { name: /^ปิดช่วงเวลา/ }),
  ).toBeDisabled();
  await page.getByLabel("ทำซ้ำทุกสัปดาห์ (ครั้ง)").fill("2");
  await page.getByRole("button", { name: "เปิดช่วงเวลา" }).click();
  await expect
    .poll(() => writes.find((w) => w.path === "/school/appointment-slots"))
    .toBeTruthy();
  expect(
    writes.find((w) => w.path === "/school/appointment-slots").body,
  ).toMatchObject({
    school_id: 2,
    repeat_weeks: 2,
    capacity: 1,
  });
});

test("staff no student can book are told why instead of opening invisible slots", async ({
  page,
}) => {
  await staffSetup(page, { bookable: false });
  await page.goto("/admin/school/appointments");
  await page.getByRole("button", { name: "ช่วงเวลาว่างของฉัน" }).click();
  await expect(page.getByRole("note")).toContainText(
    "นักเรียนจะไม่เห็นช่วงเวลาของบัญชีนี้",
  );
  await expect(page.getByRole("button", { name: "เปิดช่วงเวลา" })).toHaveCount(
    0,
  );
});

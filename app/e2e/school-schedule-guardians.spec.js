import { test, expect } from "@playwright/test";

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
  prefix: "ด.ช.",
  first_name: "ทดสอบ",
  last_name: "จำลอง",
  grade_name: "ม.1",
  classroom_name: "1",
  status: "active",
  status_label: "กำลังศึกษา",
};

async function setup(page, { guardian = false } = {}) {
  const writes = [];
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "suth_user",
      JSON.stringify({ id: 5, username: "synthetic-user", role_id: 7 }),
    );
    localStorage.setItem("suth_active_organization_5", "3");
    document.cookie = "suth_staff_session=synthetic; path=/";
  });
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname.replace(/^\/api/, ""),
      method = req.method();
    if (method !== "GET")
      writes.push({ method, path, body: req.postDataJSON?.() });
    const json = (body, status = 200) => route.fulfill({ status, json: body });
    if (path === "/session/staff")
      return json({ user: { id: 5, role_id: 7 }, csrf_token: "synthetic" });
    if (path === "/session/patient") return json({}, 401);
    if (path === "/me/authorization")
      return json({
        user: { id: 5, role_id: 7 },
        is_system_admin: false,
        organizations: [school],
        memberships: [
          {
            organization: school,
            role: { name: guardian ? "school_guardian" : "ครูแนะแนว" },
            permissions: guardian
              ? [
                  "students.view",
                  "student_health.view",
                  "clinical.view",
                  "cases.view",
                ]
              : [
                  "students.view",
                  "student_health.view",
                  "school_staff.view",
                  "school_staff.create",
                  "school_staff.assign",
                  "school_appointments.view",
                  "school_appointments.update",
                  "cases.view",
                ],
          },
        ],
      });
    if (path === "/school/access")
      return json({
        is_guardian: guardian,
        can_view_students: true,
        can_view_school: !guardian,
        can_view_risk: true,
        can_view_mental: true,
        can_view_physical: true,
        can_view_health: true,
        staff_actions: guardian ? flags(false) : flags(true),
        workflow_actions: flags(false),
        health_actions: guardian ? { view: true } : flags(true),
        behavior_actions: flags(false),
        appointment_actions: guardian ? flags(false) : flags(true),
        can_use_appointments: !guardian,
        document_actions: flags(false),
      });
    if (path === "/school/notifications/unread-count")
      return json({ count: 0 });
    if (path === "/school/schools")
      return json([{ id: 2, name: "โรงเรียนจำลอง", status: "active" }]);
    if (path === "/school/appointment-schedule") {
      if (method === "PUT") return json({ success: true, slots_made: 44 });
      return json({
        schedule: {
          exists: false,
          weekdays: [1, 2, 3, 4, 5],
          start_time: "16:20",
          end_time: "17:00",
          slot_minutes: 40,
          capacity: 1,
          status: "inactive",
        },
        counselors: [
          { id: 8, name: "ครูแนะแนว ก" },
          { id: 9, name: "ครูแนะแนว ข" },
        ],
        can_update: true,
        booking_days: 30,
      });
    }
    if (path === "/school/appointments")
      return json({
        data: [],
        pagination: { page: 1, total_pages: 1, total: 0, limit: 10 },
        statuses: {},
      });
    if (path === "/school/students")
      return json({
        data: [student],
        pagination: { total: 1, page: 1, total_pages: 1, limit: 10 },
      });
    if (path === "/school/students/11")
      return json({
        ...student,
        can_view_health: true,
        can_view_mental: true,
        can_view_physical: true,
      });
    if (path === "/school/students/11/health")
      return json({
        student,
        can_view_mental: true,
        can_view_physical: true,
        care_statuses: [],
        profile: {},
        physical_records: [],
        assessments: { mental: [], physical: [], other: [] },
      });
    if (path === "/school/students/11/contacts")
      return json({
        student_id: 11,
        can_edit: false,
        can_view_care_note: !guardian,
        guardian_name: "ผู้ปกครองจำลอง",
        guardian_phone: "081-000-0000",
        student_phone: "",
        emergency_contact_name: "",
        emergency_contact_phone: "",
        ...(guardian ? {} : { care_instructions: "" }),
      });
    if (path === "/school/students/11/guardians") {
      if (method === "POST") return json({ id: 30 }, 201);
      return json({
        guardians: [
          {
            id: 21,
            username: "parent-old",
            name: "ผู้ปกครองเดิม",
            active: true,
          },
        ],
        can_create: true,
        can_assign: true,
      });
    }
    if (path.startsWith("/school/students/11/guardians/"))
      return json({ success: true });
    if (path.includes("care-guidance")) return json({});
    if (
      path === "/school/student-types" ||
      path.includes("/grades") ||
      path.includes("/classrooms")
    )
      return json([]);
    if (path.startsWith("/master-data")) return json({ data: [] });
    return json({});
  });
  return writes;
}

test("the shared schedule starts at Monday to Friday 16:20-17:00 for every counselor", async ({
  page,
}) => {
  const writes = await setup(page);
  await page.goto("/admin/school/appointments");
  await page.getByRole("button", { name: "ตารางกลาง", exact: true }).click();
  const card = page.locator("section.sch-card").filter({
    hasText: "ตารางนัดหมายกลางของครูแนะแนว",
  });
  for (const day of ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"])
    await expect(card.getByRole("checkbox", { name: day })).toBeChecked();
  await expect(card.getByRole("checkbox", { name: "เสาร์" })).not.toBeChecked();
  await expect(card.getByLabel("เริ่ม")).toHaveValue("16:20");
  await expect(card.getByLabel("สิ้นสุด")).toHaveValue("17:00");
  await expect(card).toContainText("ครูแนะแนว ก, ครูแนะแนว ข");
  await card.getByRole("button", { name: "บันทึกตารางกลาง" }).click();
  await expect
    .poll(() => writes.find((w) => w.path === "/school/appointment-schedule"))
    .toBeTruthy();
  expect(
    writes.find((w) => w.path === "/school/appointment-schedule").body,
  ).toMatchObject({
    school_id: 2,
    weekdays: [1, 2, 3, 4, 5],
    start_time: "16:20",
    end_time: "17:00",
    slot_minutes: 40,
    capacity: 1,
    status: "active",
  });
});

test("staff create or link a guardian account from the student file", async ({
  page,
}) => {
  const writes = await setup(page);
  await page.goto("/admin/school/students?student=11");
  const dialog = page.locator(".cw-drawer--page");
  const section = dialog.locator(".sch-guardians");
  await expect(section).toContainText("ผู้ปกครองเดิม");
  await section.getByRole("button", { name: "สร้างบัญชีผู้ปกครอง" }).click();
  // A temporary password is suggested.
  await expect(section.getByLabel("รหัสผ่านเริ่มต้น")).not.toHaveValue("");
  await section.getByLabel("ชื่อ-นามสกุลผู้ปกครอง").fill("ผู้ปกครองใหม่");
  await section.getByLabel(/อีเมล/).fill("parent-new@example.test");
  await section.getByLabel("ชื่อผู้ใช้").fill("parent-new");
  await section
    .getByRole("button", { name: "สร้างบัญชี", exact: true })
    .click();
  await expect
    .poll(() => writes.find((w) => w.path === "/school/students/11/guardians"))
    .toBeTruthy();
  expect(
    writes.find((w) => w.path === "/school/students/11/guardians").body,
  ).toMatchObject({
    name: "ผู้ปกครองใหม่",
    email: "parent-new@example.test",
    username: "parent-new",
  });

  await section.getByRole("button", { name: /เชื่อมบัญชีที่มีอยู่/ }).click();
  await section
    .getByLabel("ชื่อผู้ใช้ของบัญชีผู้ปกครองที่มีอยู่")
    .fill("parent-old");
  await section.getByRole("button", { name: "เชื่อมบัญชี" }).click();
  await expect
    .poll(() => writes.find((w) => w.body?.link_username === "parent-old"))
    .toBeTruthy();
});

test("a guardian sees their child's file without staff notes or referrals", async ({
  page,
}) => {
  await setup(page, { guardian: true });
  await page.goto("/admin/school/students");
  await page
    .getByRole("button", { name: /ดูข้อมูล/ })
    .first()
    .click();
  const dialog = page.locator(".cw-drawer--page");
  await expect(dialog.getByRole("tab", { name: "สุขภาพจิต" })).toBeVisible();
  await expect(dialog.getByRole("tab", { name: "ข้อมูลเชิงลึก" })).toHaveCount(
    0,
  );
  await expect(dialog.getByRole("tab", { name: "ส่งต่อ" })).toHaveCount(0);
  await expect(dialog.getByText("ผู้ปกครองจำลอง")).toBeVisible();
  await expect(
    dialog.getByText("คำแนะนำการปฏิบัติกับนักเรียนคนนี้"),
  ).toHaveCount(0);
  await expect(dialog.locator(".sch-guardians")).toHaveCount(0);
});

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
const base = {
  school_id: 2,
  prefix: "ด.ญ.",
  last_name: "จำลอง",
  grade_name: "ม.2",
  classroom_name: "1",
  status: "active",
  status_label: "กำลังศึกษา",
};
const students = [
  {
    ...base,
    id: 11,
    student_code: "DEMO011",
    first_name: "เสี่ยง",
    mental: {
      status: "screening",
      risk: "high",
      assessed_on: "2026-06-10",
      form_title: "แบบประเมิน SDQ",
      term_label: "ภาคเรียนที่ 1/2569",
      classroom_label: "ม.1 ห้อง 1",
      care_status: null,
      care_since: null,
    },
  },
  {
    ...base,
    id: 12,
    student_code: "DEMO012",
    first_name: "ส่งต่อ",
    mental: {
      status: "hospital_referral",
      risk: null,
      care_status: "hospital_referral",
      care_since: "2026-09-01",
    },
  },
];
const counts = {
  assessed: 1,
  not_assessed: 1,
  screening: 1,
  no_screening: 0,
  counselor_referral: 0,
  following: 0,
  hospital_referral: 1,
};
const assessment = (id, date, term, room, risk, year, semester) => ({
  id,
  form_id: 5,
  form_title: "แบบประเมิน SDQ",
  health_domain: "mental",
  submitted_at: date,
  risk,
  score_results: [{ label: risk === "high" ? "เสี่ยงสูง" : "ปกติ", score: 10 }],
  academic_year: year,
  semester,
  term_label: term,
  classroom_label: room,
});

async function setup(page) {
  const requests = [];
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
      url = new URL(req.url()),
      path = url.pathname.replace(/^\/api/, ""),
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
              permissions: [
                "students.view",
                "student_health.view",
                "student_health.update",
              ],
            },
          ],
        },
      });
    if (path === "/school/access")
      return route.fulfill({
        json: {
          is_guardian: false,
          can_view_students: true,
          can_view_school: true,
          can_view_all_students: true,
          can_view_risk: true,
          can_view_mental: true,
          can_view_health: true,
          staff_actions: flags(false),
          workflow_actions: flags(false),
          health_actions: flags(true),
          behavior_actions: flags(false),
          appointment_actions: flags(false),
          document_actions: flags(false),
        },
      });
    if (path === "/school/notifications/unread-count")
      return route.fulfill({ json: { count: 0 } });
    if (path === "/school/schools")
      return route.fulfill({
        json: [{ id: 2, name: "โรงเรียนจำลอง", status: "active" }],
      });
    if (path === "/school/schools/2/academic-years")
      return route.fulfill({
        json: {
          current_year: 2569,
          minimum_year: 2559,
          years: [2569, 2568],
          terms: {
            2569: {
              term1_starts_on: "2026-05-16",
              term1_ends_on: "2026-10-10",
              term2_starts_on: "2026-11-01",
              term2_ends_on: "2027-03-31",
            },
          },
        },
      });
    if (path === "/school/students") {
      requests.push(Object.fromEntries(url.searchParams));
      const wanted = url.searchParams.get("mental_status");
      const data = wanted
        ? students.filter((s) =>
            wanted === "screening"
              ? s.mental.risk && s.mental.risk !== "normal"
              : s.mental.status === wanted,
          )
        : students;
      return route.fulfill({
        json: {
          data,
          pagination: {
            total: data.length,
            page: 1,
            total_pages: 1,
            limit: 10,
          },
          mental_period: { from: null, to: "2026-10-20", can_view: true },
          mental_counts: counts,
        },
      });
    }
    if (path === "/school/students/11")
      return route.fulfill({
        json: {
          ...students[0],
          can_view_health: true,
          can_view_mental: true,
          can_view_physical: false,
        },
      });
    if (path === "/school/students/11/health")
      return route.fulfill({
        json: {
          student: students[0],
          can_view_mental: true,
          can_view_physical: false,
          can_set_care_status: true,
          care_statuses: [
            {
              id: 2,
              status: "following",
              effective_on: "2026-07-01",
              term_label: "ภาคเรียนที่ 1/2569",
              classroom_label: "ม.2 ห้อง 1",
              note: "นัดพูดคุยทุกสัปดาห์",
              recorded_by: "synthetic-counselor",
            },
          ],
          profile: {},
          physical_records: [],
          assessments: {
            mental: [
              assessment(
                31,
                "2026-06-10T09:00:00",
                "ภาคเรียนที่ 1/2569",
                "ม.2 ห้อง 1",
                "high",
                2569,
                1,
              ),
              assessment(
                30,
                "2025-12-01T09:00:00",
                "ภาคเรียนที่ 2/2568",
                "ม.1 ห้อง 1",
                "normal",
                2568,
                2,
              ),
            ],
            physical: [],
            other: [],
          },
        },
      });
    if (path.startsWith("/school/students/11/care-status"))
      return route.fulfill({ status: 201, json: { id: 3 } });
    if (path.includes("care-guidance"))
      return route.fulfill({ json: { steps: [] } });
    if (
      path === "/school/student-types" ||
      path.includes("/grades") ||
      path.includes("/classrooms")
    )
      return route.fulfill({ json: [] });
    if (path.startsWith("/master-data"))
      return route.fulfill({ json: { data: [] } });
    return route.fulfill({ json: {} });
  });
  return { requests, writes };
}

test("student list shows the latest mental result per period and filters by status", async ({
  page,
}) => {
  const { requests } = await setup(page);
  await page.goto("/admin/school/students");
  const table = page.locator("table.sch-table");
  await expect(
    table.getByRole("columnheader", { name: "ผลประเมินสุขภาพจิตล่าสุด" }),
  ).toBeVisible();
  const first = table.getByRole("row").filter({ hasText: "DEMO011" });
  await expect(first).toContainText("ภาคเรียนที่ 1/2569 · ม.1 ห้อง 1");
  await expect(first).toContainText("คัดกรอง");
  const second = table.getByRole("row").filter({ hasText: "DEMO012" });
  await expect(second).toContainText("ยังไม่มีการประเมินในช่วงนี้");
  await expect(second).toContainText("ส่งต่อ รพ.");
  await expect(
    page.getByRole("status").filter({ hasText: "ณ วันนี้" }),
  ).toBeVisible();
  expect(requests[0].mental_from).toBeUndefined();

  // A semester sends that semester's dates.
  await page
    .getByRole("combobox", { name: "ช่วงเวลาผลประเมินสุขภาพจิต" })
    .selectOption("term:2569:1");
  await expect
    .poll(() => requests.at(-1))
    .toMatchObject({ mental_from: "2026-05-16", mental_to: "2026-10-10" });
  await expect(
    page.getByText("ภาคเรียนที่ 1/2569 (16 พ.ค.", { exact: false }),
  ).toBeVisible();

  await page
    .getByRole("combobox", { name: "สถานะสุขภาพจิต" })
    .selectOption("hospital_referral");
  await expect
    .poll(() => requests.at(-1).mental_status)
    .toBe("hospital_referral");
  await expect(
    table.getByRole("row").filter({ hasText: "DEMO011" }),
  ).toHaveCount(0);
  await expect(
    table.getByRole("row").filter({ hasText: "DEMO012" }),
  ).toBeVisible();
});

test("student file lists assessments by semester and class and records a care step", async ({
  page,
}) => {
  const { writes } = await setup(page);
  await page.goto("/admin/school/students?student=11");
  const dialog = page.locator(".cw-drawer--page");
  await dialog.getByRole("tab", { name: "สุขภาพจิต" }).click();
  await expect(
    dialog.getByRole("heading", { name: "สถานะสุขภาพจิต ณ วันนี้" }),
  ).toBeVisible();
  // The latest care step (being followed) is the current status.
  await expect(dialog.locator(".sch-mental-now")).toContainText("กำลังติดตาม");
  await expect(
    dialog.getByRole("region", { name: "ภาคเรียนที่ 2/2568" }),
  ).toContainText("ชั้น ม.1 ห้อง 1");
  await expect(
    dialog.getByRole("region", { name: "ภาคเรียนที่ 1/2569" }),
  ).toContainText("ชั้น ม.2 ห้อง 1");
  await dialog
    .getByRole("combobox", { name: "บันทึกสถานะการดูแล" })
    .selectOption("hospital_referral");
  await dialog
    .getByRole("textbox", { name: "หมายเหตุ" })
    .fill("ส่งต่อโรงพยาบาลจำลอง");
  await dialog.getByRole("button", { name: "บันทึกสถานะ" }).click();
  await expect
    .poll(() => writes.find((w) => w.path.endsWith("/care-status")))
    .toBeTruthy();
  expect(
    writes.find((w) => w.path.endsWith("/care-status")).body,
  ).toMatchObject({
    status: "hospital_referral",
    note: "ส่งต่อโรงพยาบาลจำลอง",
  });
});

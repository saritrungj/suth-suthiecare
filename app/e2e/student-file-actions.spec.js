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
  gender: "male",
  birth_date: "2014-06-01",
};
const mental = (id, formId, title, date, score, risk) => ({
  id,
  form_id: formId,
  form_title: title,
  health_domain: "mental",
  submitted_at: date,
  risk,
  score_results: [{ label: risk, score }],
  term_label: "ภาคเรียนที่ 1/2569",
  classroom_label: "ม.1 ห้อง 1",
});

async function setup(
  page,
  { canEdit = true, approver = false, hidden = null } = {},
) {
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
            role: { name: "ครูแนะแนว" },
            permissions: [
              "students.view",
              "student_health.view",
              "student_health.update",
              "student_health.create",
              "student_health.assign",
              "cases.view",
              "cases.assign",
              ...(approver
                ? ["referral_approvals.view", "referral_approvals.update"]
                : []),
            ],
          },
        ],
      });
    if (path === "/school/access")
      return json({
        is_guardian: false,
        can_view_students: true,
        can_view_school: true,
        can_view_all_students: true,
        can_view_risk: true,
        can_view_mental: true,
        can_view_physical: true,
        can_view_health: true,
        staff_actions: flags(false),
        workflow_actions: flags(false),
        health_actions: flags(true),
        behavior_actions: flags(false),
        appointment_actions: flags(false),
        document_actions: flags(false),
      });
    if (path === "/school/notifications/unread-count")
      return json({ count: 0 });
    if (path === "/school/schools")
      return json([{ id: 2, name: "โรงเรียนจำลอง", status: "active" }]);
    if (path === "/school/schools/2/academic-years")
      return json({
        current_year: 2569,
        minimum_year: 2559,
        years: [2569],
        terms: {
          2569: {
            term1_starts_on: "2026-05-16",
            term1_ends_on: "2026-10-10",
            term2_starts_on: "2026-11-01",
            term2_ends_on: "2027-03-31",
          },
        },
      });
    if (path === "/school/students")
      return json({
        data: [{ ...student, mental: { status: "screening", risk: "high" } }],
        pagination: { total: 1, page: 1, total_pages: 1, limit: 10 },
        mental_period: { from: null, to: "2026-10-20", can_view: true },
        mental_counts: {},
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
        can_update: true,
        care_statuses: [],
        profile: {},
        physical_records: [
          {
            id: 1,
            measured_at: "2026-06-01",
            weight_kg: 60,
            height_cm: 151.9,
            bmi: 26,
            hearing_left: "normal",
            hearing_right: "normal",
          },
        ],
        assessments: {
          mental: [
            mental(
              33,
              5,
              "แบบประเมิน SDQ",
              "2026-09-01T09:00:00",
              14,
              "medium",
            ),
            mental(
              32,
              6,
              "แบบประเมินความเครียด ST-5",
              "2026-08-01T09:00:00",
              7,
              "normal",
            ),
            mental(
              31,
              5,
              "แบบประเมิน SDQ",
              "2026-06-10T09:00:00",
              10,
              "normal",
            ),
            mental(20, 5, "แบบประเมิน SDQ", "2025-12-01T09:00:00", 18, "high"),
          ],
          physical: [],
          other: [],
        },
      });
    if (path === "/school/students/11/contacts") {
      if (method === "PUT") return json({ success: true });
      return json({
        student_id: 11,
        can_edit: canEdit,
        can_view_care_note: true,
        guardian_name: "ผู้ปกครองจำลอง",
        guardian_relationship: "",
        guardian_phone: "081-000-0000",
        student_phone: "",
        emergency_contact_name: "ญาติจำลอง",
        emergency_contact_phone: "082-000-0000",
        care_instructions: "พูดคุยแบบตัวต่อตัว",
      });
    }
    if (path === "/school/students/11/insights")
      return json({
        student_id: 11,
        can_update: true,
        can_create: true,
        can_assign: true,
        profile: {},
        records: [],
      });
    if (path === "/school/students/11/guidance")
      return json({ id: 9, task_id: 4 }, 201);
    if (path === "/school/rescreen-assignees")
      return json([{ id: 9, username: "counselor-demo" }]);
    if (path === "/school/rescreen-tasks") return json([]);
    if (path === "/forms")
      return json([
        { id: 5, title: "แบบประเมิน SDQ", health_domain: "mental" },
        { id: 7, title: "แบบตรวจร่างกาย", health_domain: "physical" },
      ]);
    if (path === "/case-referrals/destinations")
      return json([{ id: 40, code: "H1", name: "โรงพยาบาลจำลอง" }]);
    if (path === "/case-referrals" && method === "POST")
      return json({ request_id: 3, status: "awaiting_approval" }, 201);
    if (path === "/case-referrals") return json({ items: [], total: 0 });
    if (path === "/referral-approvals")
      return json({
        data: [
          {
            id: 3,
            status: "pending",
            created_at: "2026-10-20T09:00:00",
            source_response_id: 33,
            destination_name: "โรงพยาบาลจำลอง",
            form_title: "แบบประเมิน SDQ",
            reason: "ต้องการประเมินเพิ่มเติม",
            requested_by: 5,
            requested_by_name: "synthetic-counselor",
            student: {
              id: 11,
              student_code: "DEMO011",
              name: "ด.ช. ทดสอบ จำลอง",
            },
            can_cancel: true,
            can_decide: approver,
          },
        ],
        ...(hidden && { hidden }),
      });
    if (path === "/referral-approvals/3/approve")
      return json({ success: true, referral_id: 8 });
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
const openFile = async (page) => {
  await page.goto("/admin/school/students?student=11");
  return page.locator(".cw-drawer--page");
};

test("general tab: counselors edit contacts and the care note, others read them", async ({
  page,
}) => {
  const writes = await setup(page);
  const dialog = await openFile(page);
  await expect(dialog.getByText("พูดคุยแบบตัวต่อตัว")).toBeVisible();
  await expect(
    dialog.getByRole("link", { name: "082-000-0000" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "แก้ไข", exact: true }).click();
  await dialog.getByLabel("โทรศัพท์นักเรียน").fill("090 111 2222");
  await dialog
    .getByLabel("คำแนะนำการปฏิบัติกับนักเรียนคนนี้")
    .fill("ให้นั่งหน้าห้อง");
  await dialog.getByRole("button", { name: "บันทึกข้อมูลติดต่อ" }).click();
  await expect
    .poll(() => writes.find((w) => w.path.endsWith("/contacts")))
    .toBeTruthy();
  expect(writes.find((w) => w.path.endsWith("/contacts")).body).toMatchObject({
    student_phone: "090 111 2222",
    care_instructions: "ให้นั่งหน้าห้อง",
    guardian_name: "ผู้ปกครองจำลอง",
    emergency_contact_phone: "082-000-0000",
  });
});

test("general tab: a homeroom teacher reads contacts without editing", async ({
  page,
}) => {
  await setup(page, { canEdit: false });
  const dialog = await openFile(page);
  await expect(dialog.getByText("ผู้ปกครองจำลอง")).toBeVisible();
  await expect(dialog.getByText("พูดคุยแบบตัวต่อตัว")).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "แก้ไข", exact: true }),
  ).toHaveCount(0);
});

test("physical tab judges BMI by WHO age and sex", async ({ page }) => {
  await setup(page);
  const dialog = await openFile(page);
  await dialog.getByRole("tab", { name: "สุขภาพกาย" }).click();
  // Boy aged 12 years with BMI 26: above +2 SD of WHO 2007.
  await expect(dialog.locator(".sch-physical-summary")).toContainText("อ้วน");
  await expect(dialog.getByText(/เกณฑ์องค์การอนามัยโลก/)).toBeVisible();
  await expect(
    dialog.locator('td[data-label="เกณฑ์ BMI"]').first(),
  ).toContainText("อ้วน");
});

test("mental tab follows the list period and charts the chosen forms", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/admin/school/students");
  await page
    .getByRole("combobox", { name: "ช่วงเวลาผลประเมินสุขภาพจิต" })
    .selectOption("term:2569:1");
  await page.locator("table.sch-table .sch-name-btn").first().click();
  const dialog = page.locator(".cw-drawer--page");
  await dialog.getByRole("tab", { name: "สุขภาพจิต" }).click();
  await expect(dialog.locator(".sch-period-banner")).toContainText(
    "ภาคเรียนที่ 1/2569",
  );
  // The December 2568 result is outside semester 1/2569.
  await expect(dialog.locator(".sch-term-history")).not.toContainText(
    "1 ธ.ค. 2568",
  );
  // One chart, one line per form.
  const chart = dialog.locator(".sch-chart--multi");
  await expect(chart).toHaveCount(1);
  const lines = chart.locator(".recharts-line");
  await expect(lines).toHaveCount(2);
  await expect(chart).toHaveAttribute("aria-label", /SDQ.*ST-5|ST-5.*SDQ/);
  // The file is a page of its own: the tab and period are in the address,
  // and there is no drawer over the list.
  await expect(page).toHaveURL(
    /\/admin\/school\/students\/11\?from=2026-05-16&.*tab=mental$/,
  );
  await expect(page.locator(".cw-drawer-overlay")).toHaveCount(0);
  await page.screenshot({
    path: `../outputs/student-file-page-${test.info().project.name}.png`,
    fullPage: true,
  });
  await dialog.getByRole("checkbox", { name: /ความเครียด ST-5/ }).uncheck();
  await expect(lines).toHaveCount(1);
  // Site-drawn checkboxes: no native look, the strong action fill when on.
  const box = dialog.getByRole("checkbox", { name: /SDQ/ });
  expect(
    await box.evaluate((el) => {
      const style = getComputedStyle(el);
      return [style.appearance, style.backgroundColor];
    }),
  ).toEqual(["none", "rgb(194, 65, 12)"]);
  await dialog
    .locator(".sch-form-checklist")
    .screenshot({
      path: `../outputs/choice-controls-${test.info().project.name}.png`,
    })
    .catch(() => {});
  await dialog.getByRole("button", { name: "ดูทั้งหมด" }).click();
  await expect(dialog.locator(".sch-term-history")).toContainText(
    "1 ธ.ค. 2568",
  );
  // Back returns to the list with its period filter kept.
  await dialog.getByRole("button", { name: "กลับไปรายการ" }).click();
  await expect(page).toHaveURL(/\/admin\/school\/students$/);
  await expect(
    page.getByRole("combobox", { name: "ช่วงเวลาผลประเมินสุขภาพจิต" }),
  ).toHaveValue("term:2569:1");
});

test("insights tab: a follow-up record opens a task with the chosen form", async ({
  page,
}) => {
  const writes = await setup(page);
  const dialog = await openFile(page);
  await dialog.getByRole("tab", { name: "ข้อมูลเชิงลึก" }).click();
  await dialog
    .getByRole("combobox", { name: "ประเภทบันทึก" })
    .selectOption("follow_up");
  await dialog
    .getByRole("combobox", { name: /แบบประเมินที่ต้องทำ/ })
    .selectOption("5");
  await dialog
    .getByRole("combobox", { name: /ผู้รับผิดชอบ/ })
    .selectOption("9");
  await dialog.getByRole("textbox", { name: /กำหนดเสร็จ/ }).fill("01/12/2569");
  await dialog.getByLabel("เรื่องที่พบ").fill("คะแนนสูงขึ้น");
  await dialog.getByRole("button", { name: "เพิ่มบันทึกแนะแนว" }).click();
  await expect
    .poll(() => writes.find((w) => w.path.endsWith("/guidance")))
    .toBeTruthy();
  expect(writes.find((w) => w.path.endsWith("/guidance")).body).toMatchObject({
    record_type: "follow_up",
    issue: "คะแนนสูงขึ้น",
    task: { target_form_id: "5", assigned_user_id: "9", due_on: "2026-12-01" },
  });
  // Only mental-health forms are offered.
  await expect(
    dialog.getByRole("option", { name: "แบบตรวจร่างกาย" }),
  ).toHaveCount(0);
});

test("a hospital referral waits for approval and approvers send it", async ({
  page,
}) => {
  const writes = await setup(page, { approver: true });
  const dialog = await openFile(page);
  await dialog.getByRole("tab", { name: "ส่งต่อ" }).click();
  await expect(dialog.getByText("รออนุมัติในโรงเรียน")).toBeVisible();
  await dialog.locator("#referral-destination").selectOption("40");
  await dialog.locator("#referral-reason").fill("ต้องการพบแพทย์");
  await dialog.getByRole("button", { name: "ส่งต่อเคส" }).click();
  await expect(dialog.locator(".ref-success")).toContainText("รอผู้มีสิทธิ์");
  await page.goto("/admin/referrals/approvals");
  const row = page.locator("tr").filter({ hasText: "DEMO011" });
  await expect(row).toContainText("โรงพยาบาลจำลอง");
  await row.getByRole("button", { name: "อนุมัติ", exact: true }).click();
  await page.getByRole("button", { name: "อนุมัติและส่งต่อ" }).click();
  await expect
    .poll(() => writes.some((w) => w.path === "/referral-approvals/3/approve"))
    .toBe(true);
});

test("the approval queue says how many requests it hides, without naming them", async ({
  page,
}) => {
  await setup(page, {
    approver: true,
    hidden: { count: 2, missing_permissions: ["clinical.view"] },
  });
  await page.goto("/admin/referrals/approvals");
  const note = page.getByRole("note");
  await expect(note).toContainText("มีคำขออีก 2 รายการที่ไม่แสดง");
  await expect(note).toContainText("clinical.view");
  await expect(page.locator("tr").filter({ hasText: "DEMO011" })).toHaveCount(
    1,
  );
});

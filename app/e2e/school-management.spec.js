import { test, expect } from "@playwright/test";

const ACCESS = {
  is_teacher: false,
  classroom_ids: [],
  can_view_school: true,
  can_create_school: true,
  can_update_school: true,
  can_delete_school: true,
  can_view_all_students: true,
  can_view_students: true,
  can_create_students: true,
  can_update_students: true,
  can_delete_students: true,
  can_export_students: true,
  can_view_health: true,
  can_update_health: true,
};

const STUDENT = {
  id: 1,
  school_id: 1,
  school_name: "โรงเรียนทดสอบ",
  school_code: "TST01",
  classroom_id: 11,
  classroom_name: "1/1",
  academic_year: 2569,
  grade_level_id: 5,
  grade_name: "ม.1",
  student_type_id: null,
  student_type_name: null,
  student_code: "69001",
  prefix: "ด.ช.",
  first_name: "สมชาย",
  last_name: "ใจดี",
  nickname: "ต้น",
  gender: "male",
  birth_date: "2013-05-31",
  status: "active",
  person_id: 7,
  patient_account_id: 9,
  username: "tst0169001",
  account_status: "active",
  must_change_password: true,
};

const HEALTH = {
  student: STUDENT,
  can_update: true,
  profile: {
    blood_type: "O",
    chronic_conditions: "",
    allergies: "แพ้กุ้ง",
    medications: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    notes: "",
  },
  physical_records: [
    {
      id: 1,
      measured_at: "2026-09-01",
      weight_kg: 45,
      height_cm: 150,
      bmi: 20,
      systolic: 110,
      diastolic: 70,
      pulse: null,
      vision_left: null,
      vision_right: null,
      hearing_left: "normal",
      hearing_right: "not_tested",
      note: "",
    },
  ],
  assessments: {
    mental: [
      {
        id: 50,
        form_id: 75,
        form_title: "แบบคัดกรองความเครียดนักเรียน",
        health_domain: "mental",
        submitted_at: "2026-10-01T03:00:00.000Z",
        risk: "high",
        score_results: [{ title: "ความเครียด", label: "เครียดสูง", score: 3 }],
      },
    ],
    physical: [],
    other: [],
  },
};

// Signs in a system admin whose active organization is a school organization
// and mocks every /api call the school pages make.
async function openAsSchoolAdmin(page, received = {}) {
  await page.addInitScript(() => {
    localStorage.setItem("i18nextLng", "th");
    document.cookie = "suth_staff_session=synthetic-session; path=/";
    sessionStorage.setItem(
      "suth_user",
      JSON.stringify({ id: 1, username: "e2e-admin", role_id: 1 }),
    );
    localStorage.setItem("suth_active_organization_1", "3");
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    if (pathname.endsWith("/api/session/staff"))
      return route.fulfill({
        json: {
          user: { id: 1, username: "e2e-admin", role_id: 1 },
          csrf_token: "synthetic-staff-csrf",
        },
      });
    if (pathname.endsWith("/api/session/patient"))
      return route.fulfill({ status: 401, json: {} });
    const method = request.method();
    if (pathname.endsWith("/api/me/authorization"))
      return route.fulfill({
        json: {
          user: { id: 1, username: "e2e-admin" },
          is_system_admin: true,
          system_permissions: [],
          organizations: [
            {
              id: 1,
              code: "HOSP",
              name: "โรงพยาบาลทดสอบ",
              org_type: "hospital",
            },
            {
              id: 3,
              code: "SCH",
              name: "เขตการศึกษาทดสอบ",
              org_type: "school",
            },
          ],
          memberships: [],
        },
      });
    if (pathname.endsWith("/api/school/access"))
      return route.fulfill({ json: ACCESS });
    if (pathname.endsWith("/api/school/schools"))
      return route.fulfill({
        json: [
          {
            id: 1,
            code: "TST01",
            name: "โรงเรียนทดสอบ",
            status: "active",
            student_count: 1,
            teacher_count: 0,
            classroom_count: 1,
          },
        ],
      });
    if (pathname.endsWith("/api/school/schools/1/grades"))
      return route.fulfill({
        json: [{ id: 5, name: "ม.1", level_order: 1, classroom_count: 1 }],
      });
    if (
      pathname.endsWith("/api/school/schools/1/classrooms") &&
      method === "POST"
    ) {
      received.classroom = request.postDataJSON();
      return route.fulfill({ status: 201, json: { id: 12, name: "2" } });
    }
    if (pathname.endsWith("/api/school/schools/1/classrooms"))
      return route.fulfill({
        json: [
          {
            id: 11,
            grade_level_id: 5,
            grade_name: "ม.1",
            name: "1/1",
            academic_year: 2569,
            student_count: 1,
            status: "active",
            teachers: [],
          },
        ],
      });
    if (/\/api\/school\/(student|teacher)-types$/.test(pathname))
      return route.fulfill({ json: [] });
    if (pathname.endsWith("/api/school/students"))
      return route.fulfill({
        json: {
          data: [STUDENT],
          pagination: { page: 1, limit: 20, total: 1, total_pages: 1 },
        },
      });
    if (pathname.endsWith("/api/school/students/1/health"))
      return route.fulfill({ json: HEALTH });
    if (pathname.endsWith("/api/school/cases"))
      return route.fulfill({
        json: {
          data: [
            {
              ...STUDENT,
              mental: {
                risk: "high",
                label: "เครียดสูง",
                form_title: "แบบคัดกรองความเครียดนักเรียน",
                submitted_at: "2026-10-01T03:00:00.000Z",
              },
              physical: null,
              latest_vitals: { bmi: 20 },
              overall_risk: "high",
            },
          ],
          pagination: { page: 1, limit: 20, total: 1, total_pages: 1 },
          counts: { high: 1, medium: 0, normal: 0, none: 0 },
          classrooms: [],
        },
      });
    if (pathname.endsWith("/api/school/students/import") && method === "POST") {
      const body = request.postDataJSON();
      (received.imports ||= []).push(body);
      return route.fulfill({
        json: {
          dry_run: body.dry_run,
          summary: {},
          results: body.rows.map((row, index) =>
            row.student_code
              ? {
                  row: body.row_offset + index + 1,
                  student_code: row.student_code,
                  name: `${row.first_name} ${row.last_name}`,
                  grade: row.grade,
                  classroom: row.classroom,
                  username: `tst01${row.student_code}`,
                  status: body.dry_run ? "will_create" : "created",
                  errors: [],
                  ...(body.dry_run ? {} : { password: "Temp#Pass2569" }),
                }
              : {
                  row: body.row_offset + index + 1,
                  student_code: "",
                  name: "",
                  status: "error",
                  errors: ["ไม่มีรหัสนักเรียน"],
                },
          ),
        },
      });
    }
    if (pathname.endsWith("/api/forms")) return route.fulfill({ json: [] });
    return route.fulfill({ json: {} });
  });
}

test.describe("school organization", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      testInfo.project.name === "mobile-chromium" &&
        !/student list opens|case list of a school/.test(testInfo.title),
    );
  });

  test("system admin sees school and hospital menus in a school unit", async ({
    page,
  }) => {
    await openAsSchoolAdmin(page);
    await page.goto("/admin/school/students");
    const nav = page.locator("aside.sidebar");
    await expect(
      nav.getByRole("link", { name: "นักเรียน", exact: true }),
    ).toBeVisible();
    await expect(
      nav.getByRole("link", { name: "ครู", exact: true }),
    ).toBeVisible();
    await expect(nav.getByRole("link", { name: "จัดการคลินิก" })).toHaveCount(
      1,
    );
    await expect(nav.getByRole("link", { name: "ตารางนัดหมาย" })).toHaveCount(
      1,
    );
  });

  test("the structure page is the sub-unit's school: grades and their rooms only", async ({
    page,
  }) => {
    const received = {};
    await openAsSchoolAdmin(page, received);
    await page.goto("/admin/school");
    await expect(
      page.getByRole("heading", { name: "ชั้นปีและห้องเรียน" }),
    ).toBeVisible();
    await expect(
      page.getByText(/โรงเรียนทดสอบ · รหัสโรงเรียน TST01/),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /เพิ่มโรงเรียน/ }),
    ).toHaveCount(0);
    const grade = page.getByRole("region", { name: "ม.1" });
    await expect(grade.getByText("ห้อง 1/1")).toBeVisible();
    await grade.getByRole("button", { name: "เพิ่มห้อง" }).click();
    await expect
      .poll(() => received.classroom)
      .toEqual({
        grade_level_id: 5,
        academic_year: String(
          new Date().getFullYear() + 543 - (new Date().getMonth() < 4 ? 1 : 0),
        ),
      });
  });

  test("student list opens the student health file", async ({ page }) => {
    await openAsSchoolAdmin(page);
    await page.goto("/admin/school/students");
    await expect(
      page.getByRole("heading", { name: "รายชื่อนักเรียน" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "ดูข้อมูล ด.ช. สมชาย ใจดี" })
      .click();
    const dialog = page.getByRole("dialog", { name: "ด.ช. สมชาย ใจดี" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("tab", { name: "สุขภาพกาย" }).click();
    await expect(dialog.getByText("แพ้กุ้ง")).toBeVisible();
    await dialog.getByRole("tab", { name: "สุขภาพจิต" }).click();
    await expect(dialog.getByText("เครียดสูง").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("the case list of a school organization is the student health view", async ({
    page,
  }, testInfo) => {
    await openAsSchoolAdmin(page);
    await page.goto("/admin/cases");
    await expect(
      page.getByRole("heading", { name: "ข้อมูลสุขภาพนักเรียน" }),
    ).toBeVisible();
    if (testInfo.project.name === "mobile-chromium") {
      await page
        .getByRole("button", { name: "ด.ช. สมชาย ใจดี", exact: true })
        .click();
      const dialog = page.getByRole("dialog", { name: "ด.ช. สมชาย ใจดี" });
      await dialog.getByRole("tab", { name: "สุขภาพจิต" }).click();
      await expect(dialog.getByText("เครียดสูง").first()).toBeVisible();
    } else await expect(page.getByText("เครียดสูง")).toBeVisible();
  });

  test("imports a CSV after a dry run and offers the credentials file", async ({
    page,
  }) => {
    const received = {};
    await openAsSchoolAdmin(page, received);
    await page.goto("/admin/school/students/import");
    await page.locator('input[type="file"]').setInputFiles({
      name: "students.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "﻿รหัสนักเรียน,ชื่อ,นามสกุล,ชั้นปี,ห้อง\n69010,มานี,มีนา,ม.1,1/1\n,ไม่มี,รหัส,ม.1,1/1\n",
        "utf8",
      ),
    });
    await expect(page.getByText(/พบนักเรียน\s*2\s*แถว/)).toBeVisible();
    await page.getByRole("button", { name: "ตรวจสอบข้อมูล" }).click();
    await expect(page.getByText("ผลการตรวจสอบ (ยังไม่บันทึก)")).toBeVisible();
    await expect(page.getByText("ไม่มีรหัสนักเรียน")).toBeVisible();
    expect(received.imports[0].dry_run).toBe(true);

    await page.getByRole("button", { name: /นำเข้า 1 คน/ }).click();
    await expect(page.getByText("ผลการนำเข้า")).toBeVisible();
    expect(received.imports[1].dry_run).toBe(false);
    await expect(page.getByText("Temp#Pass2569")).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /ดาวน์โหลดบัญชีนักเรียน/ }).click();
    expect((await download).suggestedFilename()).toMatch(/^บัญชีนักเรียน-/);
  });
});

test("a guest must accept PDPA before the national ID is sent", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium");
  let payload;
  await page.addInitScript(() => localStorage.setItem("i18nextLng", "th"));
  await page.route("**/api/**", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/forms/88", (route) =>
    route.fulfill({
      json: {
        id: 88,
        title: "แบบประเมินที่ใช้เลขบัตร",
        theme: {},
        login_enforcement: "none",
        questions: [
          { id: "nid", type: "national_id", title: "เลขบัตรประชาชน" },
          { id: "q1", type: "short_text", title: "ชื่อเล่น" },
        ],
      },
    }),
  );
  await page.route("**/api/forms/88/submit", (route) => {
    payload = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: { responseId: 1 } });
  });

  await page.goto("/assessment/88");
  await page.getByPlaceholder("0-0000-00000-00-0").fill("1101700230708");
  await expect(
    page.getByText("นโยบายคุ้มครองข้อมูลส่วนบุคคล (PDPA)"),
  ).toBeVisible();
  await page.getByRole("button", { name: "ส่งคำตอบ" }).click();
  // Without acknowledging PDPA the form does not submit.
  await expect(
    page.getByText("กรุณากดรับทราบในการเก็บข้อมูล (ด้านล่างฟอร์ม)"),
  ).toBeVisible();
  await page.getByText("รับทราบ", { exact: true }).click();
  await page.getByRole("button", { name: "ส่งคำตอบ" }).click();
  await page.getByRole("button", { name: "ยินยอม" }).click();
  await expect.poll(() => payload?.consent_given).toBe(true);
  expect(payload.identityValue).toBe("1101700230708");
  expect(payload.summaryData.raw_answers["เลขบัตรประชาชน"]).not.toContain(
    "0023",
  );
});

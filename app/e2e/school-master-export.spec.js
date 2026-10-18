import { test, expect } from "@playwright/test";
import ExcelJS from "exceljs";
const roleLabels = {
  admin: "Admin",
  counselor: "ครูแนะแนว",
  homeroom: "ครูประจำชั้น",
  other: "ครูอื่น",
};
const statuses = {
  active: "กำลังศึกษา",
  graduated: "จบการศึกษา",
  on_leave: "ลาพัก",
  withdrawn: "ลาออก",
  waived: "สละสิทธิ์",
};
const student = {
  id: 1,
  school_id: 1,
  classroom_id: 11,
  student_code: "0001",
  first_name: "นักเรียนทดสอบ",
  last_name: "ตัวอย่าง",
  status: "active",
  username: "demo0001",
  can_view_health: false,
  account_status: "active",
};
async function setup(page, { clinical = false, system = true } = {}) {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "suth_user",
      JSON.stringify({ id: 1, username: "demo", role_id: 1 }),
    );
    localStorage.setItem("suth_active_organization_1", "3");
    document.cookie = "suth_staff_session=synthetic; path=/";
  });
  const access = {
    can_view_school: true,
    can_view_students: true,
    can_view_all_students: true,
    can_update_students: true,
    can_create_students: true,
    can_export_students: true,
    can_manage_staff: true,
    // Roles-page actions the school access endpoint now reports.
    staff_actions: {
      view: true,
      create: true,
      update: true,
      delete: true,
      assign: true,
      export: true,
      manage: true,
    },
    workflow_actions: {
      view: true,
      create: true,
      update: true,
      delete: true,
      assign: true,
      export: true,
      manage: true,
    },
    health_actions: {
      view: true,
      create: true,
      update: true,
      delete: true,
      assign: true,
      export: true,
      manage: true,
    },
    can_assign_school: true,
    can_assign_students: true,
    can_view_health: clinical,
    can_update_health: clinical,
    classroom_ids: [11],
  };
  let writes = [];
  let insightProfile = {
    guardian_name: "ผู้ปกครองทดสอบ",
    guardian_relationship: "mother",
    guardian_phone: "",
    living_with: "parents",
    family_status: "together",
    living_conditions: "",
    support_needs: "",
  };
  let guidanceRecords = [
    {
      id: 1,
      recorded_at: "2026-10-14",
      follow_up_at: "2026-10-21",
      recorded_by: 2,
      recorded_by_name: "ครู สมใจ ดูแล",
      issue: "การปรับตัวในโรงเรียน",
      support: "รับฟังและติดตามกับครูประจำชั้น",
    },
  ];
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname.replace(/^\/api/, "");
    if (request.method() === "PUT") {
      const body = request.postDataJSON();
      writes.push({ path, body });
      if (path === "/school/students/1/insights") insightProfile = body;
      return route.fulfill({ json: { success: true, id: 1 } });
    }
    if (request.method() === "POST" && path === "/school/students/1/guidance") {
      const body = request.postDataJSON();
      writes.push({ path, body });
      guidanceRecords = [
        { id: 2, recorded_by: 1, recorded_by_name: "ครู ทดสอบ ระบบ", ...body },
        ...guidanceRecords,
      ];
      return route.fulfill({ status: 201, json: { id: 2 } });
    }
    if (path === "/session/staff")
      return route.fulfill({
        json: {
          user: { id: 1, username: "demo", role_id: system ? 1 : 2 },
          csrf_token: "synthetic",
        },
      });
    if (path === "/session/patient")
      return route.fulfill({ status: 401, json: {} });
    if (path === "/me/authorization")
      return route.fulfill({
        json: {
          user: { id: 1, role_id: system ? 1 : 2 },
          is_system_admin: system,
          organizations: [
            {
              id: 3,
              name: "โรงเรียนตัวอย่าง",
              org_type: "school",
              org_level: "unit",
              status: "active",
            },
          ],
          memberships: [
            {
              organization: {
                id: 3,
                name: "โรงเรียนตัวอย่าง",
                org_type: "school",
                org_level: "unit",
                status: "active",
              },
              role: { id: 2, name: "Admin" },
              permissions: [
                "school.view",
                "students.view",
                "students.update",
                "students.export",
                "master_data.view",
                "master_data.manage",
                "master_data.export",
              ],
            },
          ],
        },
      });
    if (path === "/school/access") return route.fulfill({ json: access });
    if (path === "/school/schools")
      return route.fulfill({
        json: [
          { id: 1, name: "โรงเรียนตัวอย่าง", code: "DEMO", status: "active" },
        ],
      });
    if (path === "/school/schools/1/grades")
      return route.fulfill({
        json: [{ id: 5, name: "ม.1", school_id: 1, status: "active" }],
      });
    if (path === "/school/schools/1/classrooms")
      return route.fulfill({
        json: [
          {
            id: 11,
            name: "1/1",
            grade_level_id: 5,
            school_id: 1,
            status: "active",
            academic_year: 2569,
          },
        ],
      });
    if (path === "/school/students")
      return route.fulfill({
        json: {
          data: [student],
          pagination: { page: 1, limit: 20, total: 401, total_pages: 21 },
        },
      });
    if (path === "/school/students/1")
      return route.fulfill({ json: { ...student, can_view_health: clinical } });
    if (path === "/school/students/1/health")
      return route.fulfill({
        json: {
          student,
          can_update: true,
          profile: { blood_type: "unknown" },
          physical_records: [],
          assessments: { mental: [], physical: [], other: [] },
        },
      });
    if (path === "/school/students/1/insights")
      return route.fulfill({
        json: {
          can_update: clinical,
          profile: insightProfile,
          records: guidanceRecords,
        },
      });
    if (path === "/school/staff-roles")
      return route.fulfill({
        json: {
          schools: [{ id: 1, name: "โรงเรียนตัวอย่าง" }],
          members: [{ id: 2, username: "teacher-demo" }],
          roles: [
            {
              school_id: 1,
              user_id: 2,
              role_code: "homeroom",
              status: "active",
            },
          ],
          role_labels: roleLabels,
        },
      });
    if (path === "/master-data/categories")
      return route.fulfill({
        json: {
          can_manage: true,
          categories: [
            {
              code: "student_status",
              label: "สถานะนักเรียน",
              fixed: true,
              fields: ["label"],
            },
            {
              code: "guardian_relationship",
              label: "ความสัมพันธ์ผู้ปกครอง",
              fields: ["label"],
            },
          ],
        },
      });
    if (path.startsWith("/master-data/")) {
      const category = path.split("/").at(-1),
        options =
          category === "student_status"
            ? Object.entries(statuses)
            : category === "guardian_relationship"
              ? [
                  ["father", "บิดา"],
                  ["mother", "มารดา"],
                ]
              : category === "gender"
                ? [["male", "ชาย"]]
                : category === "living_with"
                  ? [["parents", "บิดามารดา"]]
                  : category === "family_status"
                    ? [["together", "อยู่ร่วมกัน"]]
                    : [];
      return route.fulfill({
        json: options.map(([code, label], index) => ({
          id: index + 1,
          code,
          label,
          sort_order: index,
          is_active: true,
        })),
      });
    }
    if (path === "/exports/data")
      return route.fulfill({
        json: {
          sheets: [
            {
              resource: "students",
              data: Array.from({ length: 401 }, (_, i) => ({
                student_code: String(i + 1).padStart(4, "0"),
                first_name: "ทดสอบ",
                status: "active",
              })),
            },
          ],
        },
      });
    if (path === "/forms" || path.endsWith("-types"))
      return route.fulfill({ json: [] });
    return route.fulfill({ json: [] });
  });
  return writes;
}
test("student status editor contains all five choices and export includes every page", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/admin/school/students");
  await expect(page.getByText("0001", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: /แก้ไขข้อมูล นักเรียนทดสอบ/ }).click();
  const dialog = page.getByRole("dialog");
  const select = dialog.getByRole("combobox", { name: "สถานะ", exact: true });
  await expect(select.locator("option")).toHaveText(Object.values(statuses));
  await select.selectOption("on_leave");
  await dialog.getByRole("button", { name: "ยกเลิก" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Excel", exact: true }).click();
  const file = await download;
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(await file.path());
  expect(book.worksheets[0].rowCount).toBe(402);
  expect(book.worksheets[0].getCell("A2").value).toBe("0001");
  expect(book.worksheets[0].getCell("C2").value).toBe("กำลังศึกษา");
});
test("school Admin sees general details without health or insight tabs", async ({
  page,
}) => {
  await setup(page, { system: false });
  await page.goto("/admin/school/students");
  await page
    .getByRole("button", { name: /ดูข้อมูล นักเรียนทดสอบ/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("0001", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("tab", { name: "ข้อมูลเชิงลึก" })).toHaveCount(
    0,
  );
  await expect(dialog.getByRole("tab", { name: "สุขภาพกาย" })).toHaveCount(0);
  await expect(dialog.getByText("ผู้ปกครองทดสอบ")).toHaveCount(0);
  await page.screenshot({
    path: `../outputs/school-admin-general-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test("authorized teacher can open optional family information", async ({
  page,
}) => {
  const writes = await setup(page, { clinical: true });
  await page.goto("/admin/school/students");
  await page
    .getByRole("button", { name: /ดูข้อมูล นักเรียนทดสอบ/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("tab", { name: "ข้อมูลเชิงลึก" }).click();
  await expect(dialog.getByLabel("ชื่อผู้ปกครอง")).toHaveValue(
    "ผู้ปกครองทดสอบ",
  );
  await expect(dialog.getByText("ครู สมใจ ดูแล")).toBeVisible();
  const relationship = dialog.getByLabel("ความสัมพันธ์ผู้ปกครอง");
  await relationship.click();
  await page
    .locator(".searchable-select-menu")
    .getByRole("option", { name: "บิดา", exact: true })
    .click();
  await expect(relationship).toHaveValue("father");
  await dialog.getByLabel("ชื่อผู้ปกครอง").fill("ผู้ปกครองแก้ไข");
  await dialog
    .getByRole("button", { name: "บันทึกข้อมูล", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText(
    "บันทึกข้อมูลครอบครัวและความเป็นอยู่แล้ว",
  );
  await dialog.getByLabel("เรื่องที่พบ").fill("ต้องการคำปรึกษาเพิ่มเติม");
  await dialog.getByLabel("การช่วยเหลือ").fill("นัดพูดคุยกับครูแนะแนว");
  await dialog
    .getByRole("button", { name: "เพิ่มบันทึกแนะแนว", exact: true })
    .click();
  await expect(
    dialog.getByText("ต้องการคำปรึกษาเพิ่มเติม", { exact: true }),
  ).toBeVisible();
  expect(writes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        path: "/school/students/1/insights",
        body: expect.objectContaining({ guardian_name: "ผู้ปกครองแก้ไข" }),
      }),
      expect.objectContaining({
        path: "/school/students/1/guidance",
        body: expect.objectContaining({
          issue: "ต้องการคำปรึกษาเพิ่มเติม",
          support: "นัดพูดคุยกับครูแนะแนว",
        }),
      }),
    ]),
  );
  await dialog.locator(".cw-drawer-body").evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.screenshot({
    path: `../outputs/school-insights-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test("master editor preserves fixed codes and allows deactivation", async ({
  page,
}) => {
  const writes = await setup(page);
  await page.goto("/admin/master-data");
  await expect(
    page.getByRole("heading", { name: "จัดการข้อมูลหลัก" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "แก้ไข", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("รหัส", { exact: true })).toBeDisabled();
  await page.getByLabel("ใช้งาน", { exact: true }).uncheck();
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].body).toMatchObject({ code: "active", is_active: false });
  await page.screenshot({
    path: `../outputs/master-data-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test("school roles can be assigned and revoked independently of teacher types", async ({
  page,
}) => {
  const writes = await setup(page, { system: false });
  await page.goto("/admin/school/roles");
  await page
    .getByRole("button", { name: "กำหนดบทบาทสมาชิก", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "สมาชิก", exact: true })
    .selectOption("2");
  await page
    .getByRole("dialog")
    .getByRole("combobox", { name: "บทบาท", exact: true })
    .selectOption("counselor");
  await page.getByRole("button", { name: "บันทึกบทบาท" }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].body.role_code).toBe("counselor");
  await page.screenshot({
    path: `../outputs/school-roles-${test.info().project.name}.png`,
    fullPage: true,
  });
});

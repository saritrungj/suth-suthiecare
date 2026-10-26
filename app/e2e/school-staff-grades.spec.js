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

// A school administrator (not a system admin) limits a counselor to ม.ต้น on
// the school staff page.
async function setup(page, { scoped = false } = {}) {
  const writes = [];
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "suth_user",
      JSON.stringify({ id: 5, username: "synthetic-school-admin", role_id: 7 }),
    );
    localStorage.setItem("suth_active_organization_5", "3");
    document.cookie = "suth_staff_session=synthetic; path=/";
  });
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname.replace(/^\/api/, "");
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
              role: { name: "ผู้ดูแลโรงเรียน" },
              permissions: ["school.view", "school_staff.manage"],
            },
          ],
        },
      });
    if (path === "/school/access")
      return route.fulfill({
        json: {
          is_guardian: false,
          can_view_school: true,
          can_manage_staff: true,
          staff_actions: flags(true),
          workflow_actions: flags(false),
          health_actions: flags(false),
        },
      });
    if (path === "/school/staff-roles" && req.method() === "PUT") {
      writes.push(req.postDataJSON());
      return route.fulfill({ json: { success: true } });
    }
    if (path === "/school/staff-roles")
      return route.fulfill({
        json: {
          schools: [{ id: 2, name: "โรงเรียนจำลอง" }],
          members: [
            { id: 9, username: "counselor.demo", name: "ครูแนะแนว จำลอง" },
          ],
          teachers: [{ school_id: 2, user_id: 9 }],
          roles: [
            {
              school_id: 2,
              user_id: 9,
              role_code: "counselor",
              status: "active",
              grade_scoped: scoped ? 1 : 0,
            },
          ],
          grades: [
            { id: 21, school_id: 2, name: "ม.1" },
            { id: 22, school_id: 2, name: "ม.2" },
            { id: 23, school_id: 2, name: "ม.3" },
            { id: 24, school_id: 2, name: "ม.4" },
          ],
          role_grades: scoped
            ? [
                { school_id: 2, user_id: 9, grade_level_id: 21 },
                { school_id: 2, user_id: 9, grade_level_id: 22 },
              ]
            : [],
          guardians: [],
          students: [],
          role_labels: {
            counselor: "ครูแนะแนว",
            homeroom: "ครูประจำชั้น",
            subject_teacher: "ครูรายวิชา",
            other: "ครูทั่วไป",
            guardian: "ผู้ปกครอง",
          },
        },
      });
    return route.fulfill({ json: req.method() === "GET" ? [] : {} });
  });
  return writes;
}

test("a school admin limits a counselor to chosen grades", async ({ page }) => {
  const writes = await setup(page);
  await page.goto("/admin/school/roles");
  await page.getByRole("button", { name: "แก้ไข" }).click();
  const dialog = page.getByRole("dialog");
  const scope = dialog.getByRole("group", { name: "ระดับชั้นที่ดูแล" });
  await expect(
    scope.getByRole("radio", { name: "ทุกระดับชั้น" }),
  ).toBeChecked();
  await scope.getByRole("radio", { name: "เฉพาะระดับชั้นที่เลือก" }).check();
  // An empty limit is refused before anything is sent.
  await dialog.getByRole("button", { name: "บันทึกบทบาท" }).click();
  await expect(
    dialog.getByText("กรุณาเลือกระดับชั้นที่ครูแนะแนวดูแลอย่างน้อยหนึ่งระดับ"),
  ).toBeVisible();
  expect(writes).toHaveLength(0);
  for (const grade of ["ม.1", "ม.2", "ม.3"])
    await scope.getByRole("checkbox", { name: grade }).check();
  const axe = await new AxeBuilder({ page }).include(".grade-scope").analyze();
  expect(axe.violations).toEqual([]);
  await dialog.getByRole("button", { name: "บันทึกบทบาท" }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toMatchObject({
    school_id: 2,
    user_id: 9,
    role_code: "counselor",
    grade_level_ids: [21, 22, 23],
  });
});

test("a saved grade limit is shown in the list and loaded into the editor", async ({
  page,
}) => {
  const writes = await setup(page, { scoped: true });
  await page.goto("/admin/school/roles");
  await expect(
    page.getByRole("cell", { name: /ครูแนะแนว · ม\.1, ม\.2/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "แก้ไข" }).click();
  const scope = page.getByRole("group", { name: "ระดับชั้นที่ดูแล" });
  await expect(
    scope.getByRole("radio", { name: "เฉพาะระดับชั้นที่เลือก" }),
  ).toBeChecked();
  await expect(scope.getByRole("checkbox", { name: "ม.2" })).toBeChecked();
  await expect(scope.getByRole("checkbox", { name: "ม.4" })).not.toBeChecked();
  // Back to the whole school sends null, which clears the limit.
  await scope.getByRole("radio", { name: "ทุกระดับชั้น" }).check();
  await page.getByRole("button", { name: "บันทึกบทบาท" }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].grade_level_ids).toBeNull();
});

import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import {
  mockResponsiveApi,
  setRouteSession,
} from "./helpers/responsive-fixtures.js";

// End-to-end walk-throughs of the user guides: one journey per audience
// (service user, central admin, hospital admin, school admin). Each step
// opens a screen the guide describes and checks its main content. Set
// GUIDE_SHOTS=<dir> to also save the screenshots used in the guide slides.

const SHOT_DIR = process.env.GUIDE_SHOTS;

async function shot(page, testInfo, name) {
  if (!SHOT_DIR || testInfo.project.name !== "desktop-chromium") return;
  const dir = `${SHOT_DIR}/${testInfo.titlePath[1]}`;
  mkdirSync(dir, { recursive: true });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${dir}/${name}.png` });
}

const ACTIONS = [
  "view",
  "create",
  "update",
  "delete",
  "assign",
  "export",
  "manage",
];
const allOf = (modules) =>
  modules.flatMap((module) => ACTIONS.map((action) => `${module}.${action}`));
const HOSPITAL_MODULES = [
  "master_data",
  "pii",
  "clinical",
  "dashboard",
  "cases",
  "forms",
  "help_center",
  "appointments",
  "patient_members",
  "clinics",
];
const SCHOOL_MODULES = [
  "master_data",
  "pii",
  "clinical",
  "dashboard",
  "cases",
  "forms",
  "school",
  "students",
  "student_health",
  "school_staff",
  "school_workflows",
];
const ORGANIZATIONS = {
  hospital: {
    id: 1,
    name: "โรงพยาบาลสาธิต",
    org_type: "hospital",
    org_level: "unit",
  },
  school: {
    id: 3,
    name: "โรงเรียนสาธิต",
    org_type: "school",
    org_level: "unit",
  },
};

// A unit administrator: a member of one organization with every right of
// that organization type, and no system-wide rights.
async function signInUnitAdmin(page, baseURL, type) {
  const organization = ORGANIZATIONS[type];
  await mockResponsiveApi(page, { organizationId: organization.id });
  await setRouteSession(page, "/admin/dashboard", baseURL);
  await page.route("**/api/me/authorization", (route) =>
    route.fulfill({
      json: {
        user: { id: 1, username: `${type}-admin`, role_id: 2 },
        is_system_admin: false,
        system_role: "admin",
        organizations: [],
        memberships: [
          {
            id: 1,
            organization,
            role: { id: 2, name: "ผู้ดูแลหน่วยงาน" },
            permissions: allOf(
              type === "school" ? SCHOOL_MODULES : HOSPITAL_MODULES,
            ),
          },
        ],
      },
    }),
  );
}

async function openFromSidebar(page, label) {
  const link = page.getByRole("link", { name: label, exact: true }).first();
  // On phones the sidebar is a drawer slid off-screen behind "Open Menu".
  const onScreen = async () => {
    const box = await link.boundingBox();
    const width = page.viewportSize().width;
    return Boolean(box && box.x >= 0 && box.x + box.width <= width);
  };
  // Let a drawer that is still sliding shut from the previous step settle.
  await page.waitForTimeout(400);
  if (!(await onScreen())) {
    await page.getByRole("button", { name: "Open Menu", exact: true }).click();
    await expect.poll(onScreen).toBe(true);
  }
  await link.click();
}

async function expectHeading(page) {
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await expect(page.getByText(/^กำลังโหลด/)).toHaveCount(0);
}

// Sample data so the user journey shows filled-in screens.
const SCREENING_FORM = {
  id: 101,
  title: "แบบคัดกรองความเครียด (ST-5)",
  description: "ใช้เวลาประมาณ 3 นาที คำตอบของคุณจะถูกเก็บเป็นความลับ",
  status: "published",
  theme: {},
  questions: [
    {
      id: "q_name",
      type: "short_text",
      title: "ชื่อ-นามสกุล",
      required: true,
    },
    {
      id: "q_sleep",
      type: "multiple_choice",
      title: "ในช่วง 2-4 สัปดาห์ที่ผ่านมา มีปัญหาการนอนหรือไม่",
      options: ["ไม่มี", "มีบางครั้ง", "มีบ่อยครั้ง"],
    },
    {
      id: "q_contact",
      type: "checkboxes",
      title: "ช่องทางที่สะดวกให้เจ้าหน้าที่ติดต่อ",
      options: ["โทรศัพท์", "อีเมล"],
    },
  ],
};
const SCORES = { ปกติ: 2, ปานกลาง: 6, เสี่ยงสูง: 12 };
const visit = (id, date, title, clinic, label, color, extra = {}) => ({
  id,
  form_id: id,
  form_title: title,
  clinic_type: clinic,
  submitted_at: date,
  status: "กำลังดำเนินการ",
  summary_data: {
    score_results: label ? [{ score: SCORES[label], label, color }] : [],
  },
  ...extra,
});
const VISITS = [
  visit(
    4,
    "2026-08-20T05:04:00Z",
    "แบบประเมินความเครียด (ST-5)",
    "teenager",
    "ปกติ",
    "#34a853",
  ),
  visit(
    3,
    "2026-07-16T03:17:00Z",
    "แบบคัดกรองภาวะซึมเศร้า (9Q)",
    "teenager",
    "ปานกลาง",
    "#f59e0b",
  ),
  visit(
    2,
    "2026-06-28T05:36:00Z",
    "แบบคัดกรองโรคติดต่อทางเพศสัมพันธ์",
    "sti",
    "ปานกลาง",
    "#f59e0b",
    { master_case_id: 7 },
  ),
  visit(
    1,
    "2026-06-24T08:28:00Z",
    "แบบคัดกรองโรคติดต่อทางเพศสัมพันธ์",
    "sti",
    "เสี่ยงสูง",
    "#d93025",
    { master_case_id: 7 },
  ),
];
const CLINIC_STATE = {
  clinicType: "sti",
  masterCase: { id: 7 },
  responses: VISITS,
  timelineEvents: VISITS.map((data) => ({
    type: "form",
    data,
    clinic_type: data.clinic_type,
  })),
  adviceByClinic: {
    sti: [
      {
        detail: "ควรมาตรวจเลือดซ้ำภายใน 3 เดือน และใช้ถุงยางอนามัยทุกครั้ง",
        staff: "พยาบาลวิชาชีพ",
        created_at: "2026-07-01T03:00:00Z",
      },
    ],
  },
  logs: [
    {
      case_id: 2,
      detail: "นัดตรวจเลือดวันที่ 5 ก.ย. 2569 เวลา 09:00 น.",
      staff: "เจ้าหน้าที่คลินิก",
      created_at: "2026-07-02T02:00:00Z",
    },
    {
      case_id: 1,
      detail: "โทรติดต่อผู้รับบริการแล้ว ให้คำปรึกษาเบื้องต้น",
      staff: "พยาบาลวิชาชีพ",
      created_at: "2026-06-25T04:00:00Z",
    },
  ],
};

test.describe("user", () => {
  test("service user: choose a service, answer, read the result and history", async ({
    page,
  }, testInfo) => {
    await mockResponsiveApi(page);

    await page.goto("/");
    await expect(page.locator(".sut2-hero")).toBeVisible();
    await shot(page, testInfo, "01-home");

    await page.goto("/#services");
    await expect(page.locator("#services")).toBeVisible();
    await page.locator("#services").scrollIntoViewIfNeeded();
    await shot(page, testInfo, "02-services");

    await page.route("**/api/forms/101", (route) =>
      route.fulfill({ json: SCREENING_FORM }),
    );
    await page.goto("/assessment/101");
    const name = page.getByRole("textbox", {
      name: "ชื่อ-นามสกุล",
      exact: true,
    });
    await expect(name).toBeVisible();
    // Required answers are checked before sending.
    await page.getByRole("button", { name: "ส่งคำตอบ", exact: true }).click();
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await name.fill("ณิชาภัทร ใจงาม");
    await page.getByText("มีบางครั้ง", { exact: true }).click();
    await page.getByText("โทรศัพท์", { exact: true }).click();
    await shot(page, testInfo, "03-form");

    await page.goto("/assessment-result");
    await expect(page.locator(".ar-visual").first()).toBeVisible();
    await shot(page, testInfo, "04-result");

    await page.goto("/account/register");
    await expect(page.getByRole("heading").first()).toBeVisible();
    await shot(page, testInfo, "05-register");

    await page.goto("/account/login");
    await expect(
      page.getByRole("button", { name: "เข้าสู่ระบบ" }),
    ).toBeVisible();
    await shot(page, testInfo, "06-login");

    await page.addInitScript((state) => {
      document.cookie = "suth_patient_session=synthetic-session; path=/";
      if (location.pathname === "/clinic-detail")
        history.replaceState(
          { usr: state, key: "g", idx: 0 },
          "",
          location.href,
        );
    }, CLINIC_STATE);
    await page.route("**/api/patient/history", (route) =>
      route.fulfill({
        json: {
          success: true,
          profile: {
            id: 1,
            username: "nichapat",
            display_name: "ณิชาภัทร ใจงาม",
            phone: "0812345678",
            email: "nichapat@example.com",
            email_verified: true,
            status: "active",
          },
          identity_masked: "1300*****3319",
          masterCases: [],
          responses: VISITS,
        },
      }),
    );
    await page.goto("/history/result");
    await expect(page.locator(".hr-hero")).toBeVisible();
    await expect(page.locator(".hr-timeline-item")).toHaveCount(VISITS.length);
    await shot(page, testInfo, "07-history");

    await page.locator(".hr-timeline-item .hr-card-head").first().click();
    await expect(page.locator(".hr-timeline-item.is-open")).toHaveCount(1);
    await page.locator(".hr-timeline").scrollIntoViewIfNeeded();
    await shot(page, testInfo, "07b-history-detail");
    await page.evaluate(() => window.scrollTo(0, 0));

    await page.getByRole("button", { name: /เริ่มการประเมินใหม่/ }).click();
    await expect(page.getByRole("menu")).toBeVisible();
    await shot(page, testInfo, "08-new-assessment");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toBeHidden();

    await page.goto("/clinic-detail");
    await expect(page.locator(".cd-hero")).toBeVisible();
    await expect(page.locator(".cd-history__item")).toHaveCount(2);
    await shot(page, testInfo, "09-clinic-detail");

    await page.goto("/help-center");
    await expectHeading(page);
    await shot(page, testInfo, "10-help-center");
  });
});

test.describe("central-admin", () => {
  test("central admin: organizations, people, roles and shared content", async ({
    page,
    baseURL,
  }, testInfo) => {
    await mockResponsiveApi(page);
    await setRouteSession(page, "/login", baseURL);
    await page.goto("/login");
    await expect(
      page.getByRole("button", { name: /เข้าสู่ระบบ/ }).first(),
    ).toBeVisible();
    await shot(page, testInfo, "01-staff-login");

    await setRouteSession(page, "/admin/dashboard", baseURL);
    await page.goto("/admin/dashboard");
    await expectHeading(page);
    await shot(page, testInfo, "02-dashboard");

    for (const [label, name] of [
      ["หน่วยงานหลักและหน่วยงานย่อย", "03-organizations"],
      ["ผู้ดูแลระบบและเจ้าหน้าที่", "04-users"],
      ["บทบาทและสิทธิ์", "05-roles"],
      ["จัดการภาพแบนเนอร์", "06-banners"],
      ["จัดการฟอร์ม", "07-forms"],
      ["ภาพผลลัพธ์การประเมิน", "08-result-images"],
      ["จัดการข้อมูลหลัก", "09-master-data"],
    ]) {
      await openFromSidebar(page, label);
      await expectHeading(page);
      await shot(page, testInfo, name);
    }
  });
});

test.describe("hospital-admin", () => {
  test("hospital admin: cases, appointments, forms, clinics and help center", async ({
    page,
    baseURL,
  }, testInfo) => {
    await signInUnitAdmin(page, baseURL, "hospital");
    await page.goto("/admin/dashboard");
    await expectHeading(page);
    await shot(page, testInfo, "01-dashboard");

    // Unit admins see their own organization's menus only.
    await expect(
      page.getByRole("link", { name: "หน่วยงานหลักและหน่วยงานย่อย" }),
    ).toHaveCount(0);

    for (const [label, name] of [
      ["ข้อมูลเคส", "02-cases"],
      ["เคสเสี่ยง", "03-risk-cases"],
      ["ตารางนัดหมาย", "04-schedule"],
      ["ส่งต่อระหว่างหน่วยงาน", "05-referrals"],
      ["จัดการฟอร์ม", "06-forms"],
      ["ภาพผลลัพธ์การประเมิน", "07-result-images"],
      ["จัดการคลินิก", "08-clinics"],
      ["ผู้มารับบริการ", "09-members"],
      ["จัดการศูนย์ช่วยเหลือ", "10-help-center"],
      ["จัดการข้อมูลหลัก", "11-master-data"],
    ]) {
      await openFromSidebar(page, label);
      await expectHeading(page);
      await shot(page, testInfo, name);
    }

    await page.goto("/admin/forms/create");
    await expect(page.locator("main").first()).toBeVisible();
    await shot(page, testInfo, "12-form-builder");
  });
});

test.describe("school-admin", () => {
  test("school admin: classes, students, staff, screening and health cases", async ({
    page,
    baseURL,
  }, testInfo) => {
    await signInUnitAdmin(page, baseURL, "school");
    await page.goto("/admin/dashboard");
    await expectHeading(page);
    await shot(page, testInfo, "01-dashboard");

    // Hospital-only menus stay hidden in a school.
    await expect(page.getByRole("link", { name: "ตารางนัดหมาย" })).toHaveCount(
      0,
    );

    for (const [label, name] of [
      ["ชั้นปีและห้องเรียน", "02-classes"],
      ["นำเข้าข้อมูล", "03-import"],
      ["นักเรียน", "04-students"],
      ["ครู", "05-teachers"],
      ["บุคลากรและผู้ปกครอง", "06-staff"],
      ["คัดกรองและติดตามโรงเรียน", "07-workflows"],
      ["ข้อมูลเคส", "08-cases"],
      ["เคสเสี่ยง", "09-risk-cases"],
      ["จัดการฟอร์ม", "10-forms"],
      ["ภาพผลลัพธ์การประเมิน", "11-result-images"],
    ]) {
      await openFromSidebar(page, label);
      await expectHeading(page);
      await shot(page, testInfo, name);
    }
  });
});

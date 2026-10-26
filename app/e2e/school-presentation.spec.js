import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import {
  mockResponsiveApi,
  setRouteSession,
} from "./helpers/responsive-fixtures.js";
import {
  mockSchoolShowcase,
  mockStudentAccount,
} from "./helpers/school-showcase.js";

// The screens shown in the school presentation deck, walked with synthetic
// school data. Each step checks the screen it shows. Set
// PRESENTATION_SHOTS=<dir> to also save the screenshots (1920x1080 for the
// staff screens, phone-sized for the student ones).

const SHOT_DIR = process.env.PRESENTATION_SHOTS;
const PHONE = { width: 390, height: 844 };

test.describe.configure({ timeout: 180_000 });
if (SHOT_DIR) test.use({ deviceScaleFactor: 1.5 });
test.beforeEach(({}, testInfo) =>
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "One walk is enough; the phone shots set their own viewport.",
  ),
);

async function shot(page, name) {
  if (!SHOT_DIR) return;
  mkdirSync(SHOT_DIR, { recursive: true });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOT_DIR}/${name}.png` });
}

async function settled(page) {
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await expect(page.getByText(/^กำลังโหลด/)).toHaveCount(0);
}

const SCHOOL_FORM = {
  id: 75,
  title: "แบบประเมินความเครียดนักเรียน (ST-5)",
  description: "ใช้เวลาประมาณ 2 นาที คำตอบของเธอเก็บเป็นความลับ",
  status: "published",
  theme: {},
  questions: [
    {
      id: "q_sleep",
      type: "multiple_choice",
      title: "ช่วง 2 สัปดาห์ที่ผ่านมา นอนหลับเป็นอย่างไร",
      options: ["หลับสบายดี", "หลับยากบางคืน", "หลับยากเกือบทุกคืน"],
    },
    {
      id: "q_focus",
      type: "multiple_choice",
      title: "ช่วงนี้มีสมาธิในการเรียนแค่ไหน",
      options: ["มีสมาธิดี", "วอกแวกบ้าง", "จดจ่อได้ยากมาก"],
    },
  ],
};

async function asSchoolAdmin(page, baseURL) {
  await mockResponsiveApi(page, { organizationId: 3 });
  await setRouteSession(page, "/admin/dashboard", baseURL);
  await page.route("**/api/me/authorization", (route) =>
    route.fulfill({
      json: {
        user: { id: 1, username: "school-admin", role_id: 2 },
        is_system_admin: false,
        system_role: "admin",
        organizations: [],
        memberships: [
          {
            id: 1,
            organization: {
              id: 3,
              name: "โรงเรียนสาธิต",
              org_type: "school",
              org_level: "unit",
            },
            role: { id: 2, name: "ผู้ดูแลโรงเรียน" },
            permissions: [
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
              "student_behavior",
              "school_appointments",
              "school_documents",
              "audit",
            ].flatMap((m) =>
              [
                "view",
                "create",
                "update",
                "delete",
                "assign",
                "export",
                "manage",
              ].map((a) => `${m}.${a}`),
            ),
          },
        ],
      },
    }),
  );
  await mockSchoolShowcase(page);
}

test("school staff: roster, screening rounds, risk overview and follow-up", async ({
  page,
  baseURL,
}) => {
  await asSchoolAdmin(page, baseURL);

  await page.goto("/admin/dashboard");
  await settled(page);
  await expect(page.getByText(/เสี่ยงสูง/).first()).toBeVisible();
  await shot(page, "p-dashboard");

  await page.goto("/admin/school/students/import");
  await settled(page);
  await shot(page, "p-import");

  await page.goto("/admin/school/students");
  await settled(page);
  await expect(page.getByText("65001").first()).toBeVisible();
  await shot(page, "p-students");

  await page.goto("/admin/school/workflows");
  await settled(page);
  await expect(
    page.getByText("ภาพรวมความเสี่ยงและคำแนะนำการดูแล"),
  ).toBeVisible();
  await shot(page, "p-risk");

  await page.getByRole("button", { name: "รอบคัดกรอง", exact: true }).click();
  await page
    .getByRole("button", { name: "ดูผู้ยังไม่ประเมิน รอบ คัดกรองต้นภาคเรียน" })
    .click();
  await expect(page.locator(".sch-progress-summary")).toBeVisible();
  await shot(page, "p-rounds");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page
    .getByRole("button", { name: "ติดตามรายบุคคล", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "ติดตามรายบุคคล" }),
  ).toBeVisible();
  await shot(page, "p-rescreen");

  await page.goto("/admin/cases");
  await settled(page);
  await shot(page, "p-cases");

  // The care tools: alerts, behaviour, physical follow-up, counseling,
  // documents, reports and the change history.
  const bell = page.getByRole("button", { name: /^การแจ้งเตือน/ });
  await bell.click();
  await expect(page.getByText("พบนักเรียนกลุ่มเสี่ยงสูง")).toBeVisible();
  await shot(page, "p-alerts");
  await page.keyboard.press("Escape");

  for (const [path, name] of [
    ["/admin/school/behavior", "p-behavior"],
    ["/admin/school/follow-ups", "p-follow-ups"],
    ["/admin/school/appointments", "p-appointments"],
    ["/admin/school/documents", "p-documents"],
    ["/admin/school/reports", "p-reports"],
    ["/admin/audit", "p-audit"],
  ]) {
    await page.goto(path);
    await settled(page);
    await shot(page, name);
  }

  await page.goto("/admin/school/workflows");
  await settled(page);
  await page
    .getByRole("button", { name: "ตั้งค่าการดูแล", exact: true })
    .click();
  await expect(page.getByText(/^กำลังโหลด/)).toHaveCount(0);
  await shot(page, "p-care-settings");
});

test("student: answer on a phone, see the result and the school's to-do", async ({
  page,
}) => {
  await mockResponsiveApi(page);
  await page.setViewportSize(PHONE);

  await page.route("**/api/forms/75", (route) =>
    route.fulfill({ json: SCHOOL_FORM }),
  );
  await page.goto("/assessment/75");
  await page.getByText("หลับยากบางคืน", { exact: true }).click();
  await page.getByText("วอกแวกบ้าง", { exact: true }).click();
  await shot(page, "p-phone-form");

  // A result as the student sees it right after sending.
  await page.addInitScript(() => {
    if (location.pathname === "/assessment-result")
      history.replaceState(
        {
          usr: {
            formId: 75,
            isSaved: true,
            results: [
              {
                score: 6,
                label: "เครียดปานกลาง",
                color: "#f59e0b",
                advice:
                  "ลองพักสั้น ๆ ระหว่างอ่านหนังสือ นอนให้พอ และคุยกับคนที่ไว้ใจ ครูแนะแนวพร้อมรับฟังเสมอ",
              },
            ],
          },
          key: "deck",
          idx: 0,
        },
        "",
        location.href,
      );
  });
  await page.goto("/assessment-result");
  await expect(page.locator(".ar-visual").first()).toBeVisible();
  await shot(page, "p-phone-result");

  await page.addInitScript(() => {
    document.cookie = "suth_patient_session=synthetic-session; path=/";
  });
  await mockStudentAccount(page);
  await page.goto("/history/result");
  const tasks = page.getByRole("region", { name: /แบบประเมินที่ต้องทำ/ });
  await expect(tasks).toBeVisible();
  await tasks.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -90));
  await shot(page, "p-phone-tasks");

  const counseling = page.getByRole("region", { name: "นัดหมายรับคำปรึกษา" });
  await counseling.getByRole("button", { name: "ขอนัดหมาย" }).click();
  await expect(counseling.getByText(/สายด่วนสุขภาพจิต 1323/)).toBeVisible();
  await counseling.evaluate((el) => el.scrollIntoView({ block: "start" }));
  await page.evaluate(() => window.scrollBy(0, -80));
  await shot(page, "p-phone-counsel");
});

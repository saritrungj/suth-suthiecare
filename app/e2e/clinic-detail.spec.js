import { expect, test } from "@playwright/test";
import { mockResponsiveApi } from "./helpers/responsive-fixtures.js";

const response = (id, date, score, label, extra = {}) => ({
  id,
  form_id: id,
  form_title: `แบบคัดกรองครั้งที่ ${id}`,
  clinic_type: "sti",
  submitted_at: date,
  status: "กำลังดำเนินการ",
  master_case_id: 4,
  summary_data: { score_results: [{ score, label, color: "#f59e0b" }] },
  ...extra,
});
const responses = [
  response(2, "2026-08-20T05:00:00Z", 6, "ปานกลาง"),
  response(1, "2026-06-24T05:00:00Z", 11, "เสี่ยงสูง"),
];
const state = {
  clinicType: "sti",
  masterCase: { id: 4 },
  responses,
  timelineEvents: responses.map((data) => ({
    type: "form",
    data,
    clinic_type: "sti",
  })),
  adviceByClinic: {
    sti: [
      {
        detail: "ตรวจเลือดซ้ำใน 3 เดือน",
        staff: "พยาบาล",
        created_at: "2026-08-22",
      },
    ],
  },
  logs: [{ case_id: 2, detail: "นัดตรวจเลือดแล้ว", created_at: "2026-08-23" }],
};

test.beforeEach(async ({ page }) => {
  await mockResponsiveApi(page);
  await page.addInitScript(() => {
    document.cookie = "suth_patient_session=synthetic-session; path=/";
  });
});

test("clinic detail shows the latest result, advice, case progress and history", async ({
  page,
}) => {
  await page.addInitScript((usr) => {
    if (location.pathname === "/clinic-detail")
      history.replaceState({ usr, key: "t", idx: 0 }, "", location.href);
  }, state);

  await page.goto("/clinic-detail");

  await expect(
    page.getByRole("heading", { name: "คลินิกโรคติดต่อฯ" }),
  ).toBeVisible();
  // Latest by date, not by list order, and a falling score reads as better.
  await expect(page.locator(".cd-stat--main strong")).toHaveText("6");
  await expect(page.locator(".cd-trend")).toContainText("แนวโน้มดีขึ้น");
  await expect(page.locator(".cd-case-badge")).toContainText("MC-0004");
  await expect(page.getByText("ตรวจเลือดซ้ำใน 3 เดือน")).toBeVisible();
  await expect(page.getByText("นัดตรวจเลือดแล้ว")).toBeVisible();
  await expect(page.locator(".cd-history__item strong")).toHaveText([
    "แบบคัดกรองครั้งที่ 2",
    "แบบคัดกรองครั้งที่ 1",
  ]);
});

test("clinic detail without history data returns to the history page", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (location.pathname === "/clinic-detail")
      history.replaceState(null, "", location.href);
  });
  await page.goto("/clinic-detail");
  await expect(page).toHaveURL(/\/history\/result$/);
});

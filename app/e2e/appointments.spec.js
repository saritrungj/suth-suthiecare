import { expect, test } from "@playwright/test";
import {
  mockResponsiveApi,
  setRouteSession,
} from "./helpers/responsive-fixtures.js";

// Twelve appointments in the current month: ten waiting, one attended, one
// cancelled, with long names and notes to stress the column widths.
const appointments = () => {
  const now = new Date();
  const day = (d) =>
    new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), d, 3, 30),
    ).toISOString();
  return Array.from({ length: 12 }, (_, i) => ({
    id: 100 + i,
    appointment_id: 100 + i,
    case_id: 500 + i,
    master_case_id: 900 + i,
    service_name: "พบอาจารย์พยาบาลสาขาสุขภาพจิตเพื่อติดตามอาการต่อเนื่อง",
    appointment_date: day((i % 27) + 1),
    appt_status: i === 10 ? "Completed" : i === 11 ? "Cancelled" : "Scheduled",
    status: "ติดต่อไม่ได้ / ไม่รับสาย โทรติดตามอีกครั้งในสัปดาห์หน้า",
    note: "ผู้รับบริการขอเลื่อนนัดเนื่องจากติดสอบกลางภาค กรุณาโทรยืนยันก่อนวันนัดหนึ่งวัน",
    form_status: "published",
    summary_data: {
      display_name: `ผู้รับบริการทดสอบชื่อยาวมากเป็นพิเศษ ${i + 1}`,
      age: "19",
      phone: "081-234-5678",
      score_results: [],
    },
  }));
};

test("appointments fit the panel without sideways scrolling and filter by status", async ({
  page,
  baseURL,
}) => {
  await mockResponsiveApi(page);
  await setRouteSession(page, "/admin/schedule", baseURL);
  await page.route("**/api/appointments?**", (route) =>
    route.fulfill({ json: appointments() }),
  );

  await page.goto("/admin/schedule");

  const table = page.getByRole("table", { name: "ตารางนัดหมาย" });
  await expect(table.locator("tbody tr")).toHaveCount(10);

  // Every column, including the actions, is reachable without scrolling
  // sideways: nothing in the table reaches past the panel's right edge.
  const overflow = await table.evaluate((el) => {
    const frame = el.closest(".apt-container").getBoundingClientRect().right;
    return [...el.querySelectorAll("*")]
      .filter((child) => child.getBoundingClientRect().right > frame + 1)
      .map((child) => child.className || child.tagName);
  });
  expect(overflow).toEqual([]);
  const confirm = table.getByRole("button", { name: "มาตามนัด" }).first();
  await confirm.scrollIntoViewIfNeeded();
  await expect(confirm).toBeInViewport({ ratio: 1 });

  const tabs = page.getByRole("group", { name: "สถานะนัดหมาย" });
  await expect(
    tabs.getByRole("button", { name: /ทั้งหมด\s*12/ }),
  ).toBeVisible();
  await tabs.getByRole("button", { name: /มาตามนัด\s*1/ }).click();
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(table.getByText("จัดการแล้ว")).toBeVisible();
});

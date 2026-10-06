import { test, expect } from "@playwright/test";
import { mockAdminApi, mockPublicApi } from "./helpers/api-mocks.js";
test("case invitation requires the patient account and rejects another recipient", async ({
  page,
}) => {
  await mockPublicApi(page);
  const token = "a".repeat(43);
  await page.goto("/assessment/101?invitation=" + token);
  await expect(page).toHaveURL(/account\/login\?returnTo=/);
  await page.addInitScript(
    () => (document.cookie = "suth_patient_session=synthetic-session; path=/"),
  );
  await page.route("**/api/form-invitations/resolve", (route) => {
    expect(route.request().postDataJSON()).toEqual({ token, form_id: "101" });
    expect(route.request().headers()["x-csrf-token"]).toBe(
      "synthetic-patient-csrf",
    );
    return route.fulfill({
      status: 403,
      json: { code: "INVITATION_RECIPIENT_MISMATCH" },
    });
  });
  await page.goto("/assessment/101?invitation=" + token);
  await expect(
    page.getByRole("dialog").getByText("ไม่สามารถใช้ลิงก์เชิญนี้ได้"),
  ).toBeVisible();
  expect(
    await page.evaluate(() => sessionStorage.getItem("patient_token")),
  ).toBeNull();
});
test("System Admin configures explicit referral destinations in a unit with session CSRF", async ({
  page,
}) => {
  await mockAdminApi(page);
  await page.addInitScript(() => {
    document.cookie = "suth_staff_session=synthetic-session; path=/";
    localStorage.setItem("i18nextLng", "th");
    localStorage.setItem("suth_active_organization_1", "1");
  });
  const organizations = [
    {
      id: 10,
      name: "โรงพยาบาลทดสอบ",
      code: "MAIN",
      kind: "main",
      org_level: "main",
      org_type: "hospital",
      status: "active",
      parent_id: null,
      child_count: 2,
    },
    {
      id: 1,
      name: "หน่วยงานต้นทางทดสอบ",
      code: "SRC",
      kind: "unit",
      org_level: "unit",
      org_type: "hospital",
      status: "active",
      parent_id: 10,
    },
    {
      id: 2,
      name: "หน่วยงานปลายทางทดสอบ",
      code: "DEST",
      kind: "unit",
      org_level: "unit",
      org_type: "hospital",
      status: "active",
      parent_id: 10,
    },
  ];
  await page.route("**/api/organizations", (route) =>
    route.fulfill({ json: organizations }),
  );
  await page.route("**/api/organizations/1/members", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route("**/api/pdpa/**", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/organizations/1/notification-target", (route) =>
    route.fulfill({ json: null }),
  );
  let submitted;
  await page.route("**/api/organizations/1/referral-destinations", (route) => {
    if (route.request().method() === "PUT") {
      submitted = route.request().postDataJSON();
      expect(route.request().headers()["x-csrf-token"]).toBe(
        "synthetic-staff-csrf",
      );
      return route.fulfill({ json: { success: true } });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto("/admin/organizations");
  await page
    .getByRole("button", { name: /หน่วยงานต้นทางทดสอบ โรงพยาบาล/ })
    .click();
  const settings = page.getByRole("region", {
    name: "การตั้งค่าความปลอดภัยและ PDPA",
  });
  await settings
    .locator("summary")
    .filter({ hasText: "หน่วยงานปลายทางที่อนุญาตให้ส่งต่อ" })
    .click();
  await settings.getByLabel("หน่วยงานปลายทางทดสอบ", { exact: true }).check();
  await settings.getByRole("button", { name: "บันทึกคู่ส่งต่อ" }).click();
  await expect
    .poll(() => submitted)
    .toEqual({ destinations: [{ organization_id: 2, enabled: true }] });
});

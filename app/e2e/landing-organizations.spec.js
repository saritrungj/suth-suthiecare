import { test, expect } from "@playwright/test";

// Synthetic, labeled demonstration data: three organizations, four units.
const clinics = [
  ["general", "คลินิกทดสอบ ก", "ORG-A", "หน่วยงานทดสอบ ก"],
  ["mind", "คลินิกทดสอบ ข", "ORG-A", "หน่วยงานทดสอบ ก"],
  ["guidance", "งานแนะแนวทดสอบ", "ORG-B", "โรงเรียนทดสอบ ข"],
  ["nurse", "ห้องพยาบาลทดสอบ", "ORG-C", "โรงเรียนทดสอบ ค"],
].map(([slug, name, code, orgName], i) => ({
  id: i + 1,
  slug,
  name,
  organization_id: i + 1,
  organization_code: code,
  organization_name: orgName,
  sort_order: i + 1,
  show_icon: 0,
}));
const forms = [
  [101, "แบบประเมินทดสอบหนึ่ง", "general"],
  [102, "แบบประเมินทดสอบสอง", "mind"],
  [103, "แบบประเมินทดสอบสาม", "guidance"],
  [104, "แบบประเมินทดสอบสี่", "nurse"],
].map(([id, title, clinic_type]) => ({
  id,
  title,
  description: "ข้อมูลตัวอย่าง",
  clinic_type,
  status: "published",
}));

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/api/clinics"))
      return route.fulfill({ json: { data: clinics } });
    if (path.endsWith("/api/forms")) return route.fulfill({ json: forms });
    if (path.endsWith("/api/banners")) return route.fulfill({ json: [] });
    if (path.endsWith("/api/counts"))
      return route.fulfill({ json: { data: {} } });
    return route.fulfill({ status: 401, json: {} });
  });
});

test("landing groups services by organization and filters by the chosen one", async ({
  page,
}) => {
  await page.goto("/");
  const orgChips = page.locator(".cfp-org");
  await expect(orgChips).toHaveCount(4);
  await expect(page.locator(".sut2-hero__stats")).toContainText("3");
  await expect(page.locator(".cfp-card")).toHaveCount(4);

  await orgChips.filter({ hasText: "โรงเรียนทดสอบ ข" }).click();
  await expect(page).toHaveURL(/\?org=ORG-B$/);
  await expect(page.locator(".cfp-card")).toHaveCount(1);
  await expect(page.locator(".cfp-card")).toContainText("แบบประเมินทดสอบสาม");
  await expect(page.locator(".cfp-tile:not(.cfp-tile--all)")).toHaveCount(1);
});

test("a shared organization link opens with that organization selected", async ({
  page,
}) => {
  await page.goto("/?org=ORG-A");
  await expect(
    page.locator(".cfp-org", { hasText: "หน่วยงานทดสอบ ก" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".cfp-card")).toHaveCount(2);
});

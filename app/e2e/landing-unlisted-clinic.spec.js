import { expect, test } from "@playwright/test";

// The user's case: forms are counted but their clinic is not in the picker
// (the shared "general" type, or a clinic not shown), so nothing rendered.
const forms = [
  [201, "แบบประเมินทั่วไปหนึ่ง", "general"],
  [202, "แบบประเมินทั่วไปสอง", undefined],
  [203, "แบบประเมินคลินิกที่ไม่เปิดแสดง", "hidden-clinic"],
].map(([id, title, clinic_type]) => ({
  id,
  title,
  description: "ข้อมูลตัวอย่าง",
  clinic_type,
  status: "published",
}));

test("every counted form is shown when its clinic is not in the picker", async ({
  page,
}) => {
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/api/clinics"))
      return route.fulfill({ json: { data: [] } });
    if (path.endsWith("/api/forms")) return route.fulfill({ json: forms });
    if (path.endsWith("/api/banners")) return route.fulfill({ json: [] });
    if (path.endsWith("/api/counts"))
      return route.fulfill({ json: { data: {} } });
    return route.fulfill({ status: 401, json: {} });
  });

  await page.goto("/");

  await expect(page.locator(".cfp-toolbar")).toContainText("3");
  const group = page.locator(".cfp-group", {
    has: page.getByRole("heading", { name: "แบบประเมินทั่วไป" }),
  });
  await expect(group.locator(".cfp-card")).toHaveCount(3);
});

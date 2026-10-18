import { expect, test } from "@playwright/test";
import {
  mockResponsiveApi,
  setRouteSession,
} from "./helpers/responsive-fixtures.js";

const CUSTOM_LOW =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

test("back office lists result pictures per level and marks custom ones", async ({
  page,
  baseURL,
}) => {
  await mockResponsiveApi(page);
  await setRouteSession(page, "/admin/result-images", baseURL);
  await page.route("**/api/admin/result-images", (route) =>
    route.fulfill({
      json: {
        images: {
          low: { image: CUSTOM_LOW, filename: "low.png", updated_at: null },
          medium: null,
          high: null,
        },
      },
    }),
  );

  await page.goto("/admin/result-images");

  const low = page.getByRole("article", { name: "ความเสี่ยงต่ำ / ปกติ" });
  await expect(low.getByText("ภาพของหน่วยงาน")).toBeVisible();
  await expect(low.locator("img")).toHaveAttribute("src", CUSTOM_LOW);
  await expect(
    low.getByRole("button", { name: "ใช้ภาพเริ่มต้น" }),
  ).toBeVisible();

  const high = page.getByRole("article", { name: "ความเสี่ยงสูง" });
  await expect(high.getByText("ภาพเริ่มต้นของระบบ")).toBeVisible();
  await expect(high.getByRole("button", { name: "อัปโหลดภาพ" })).toBeVisible();
});

test("result page shows the form organization's picture for the level", async ({
  page,
}) => {
  await mockResponsiveApi(page);
  await page.route("**/api/result-images/forms/101", (route) =>
    route.fulfill({
      json: { images: { low: CUSTOM_LOW, medium: null, high: null } },
    }),
  );

  await page.goto("/assessment-result");

  await expect(page.locator(".ar-visual img").first()).toHaveAttribute(
    "src",
    CUSTOM_LOW,
  );
});

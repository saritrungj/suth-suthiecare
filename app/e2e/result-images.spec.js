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

test("back office lists the picture library and saves result page wording", async ({
  page,
  baseURL,
}) => {
  await mockResponsiveApi(page);
  await setRouteSession(page, "/admin/result-images", baseURL);
  let savedTexts;
  await page.route("**/api/admin/result-images", (route) =>
    route.fulfill({
      json: {
        images: { low: null, medium: null, high: null },
        assets: [{ id: 4, image: CUSTOM_LOW, filename: "calm.png" }],
        texts: { btn_eval: "ให้คะแนนระบบ" },
      },
    }),
  );
  await page.route("**/api/admin/result-images/texts", (route) => {
    savedTexts = route.request().postDataJSON().texts;
    return route.fulfill({ json: { success: true } });
  });

  await page.goto("/admin/result-images");

  const library = page.getByRole("list", { name: "ภาพในคลัง" });
  await expect(library.getByText("calm.png")).toBeVisible();
  await expect(
    library.getByRole("button", { name: "ลบ calm.png" }),
  ).toBeVisible();

  const texts = page.getByRole("form", { name: "ข้อความบนหน้าผลการประเมิน" });
  await expect(texts.getByLabel("ปุ่มประเมินการใช้งานระบบ")).toHaveValue(
    "ให้คะแนนระบบ",
  );
  await texts
    .getByLabel("หัวข้อเมื่อประเมินเสร็จ (ยังไม่ได้ส่งข้อมูล)")
    .fill("ประเมินเสร็จแล้ว");
  await texts.getByRole("button", { name: "บันทึกข้อความ" }).click();
  await expect
    .poll(() => savedTexts)
    .toEqual({
      btn_eval: "ให้คะแนนระบบ",
      hero_done_title: "ประเมินเสร็จแล้ว",
    });
});

test("result page uses a scoring range's library picture and the custom wording", async ({
  page,
}) => {
  await mockResponsiveApi(page);
  await page.route("**/api/result-images/forms/101", (route) =>
    route.fulfill({
      json: {
        images: { low: null, medium: null, high: null },
        assets: { 4: CUSTOM_LOW },
        texts: {
          hero_done_title: "ประเมินเสร็จแล้ว",
          btn_eval: "ให้คะแนนระบบ",
        },
      },
    }),
  );
  await page.addInitScript(() => {
    localStorage.setItem("i18nextLng", "th");
    window.history.replaceState(
      {
        usr: {
          formId: 101,
          results: [
            {
              question_id: "q1",
              title: "Mood",
              score: 9,
              label: "High",
              color: "#d93025",
              advice: "",
              resultImage: "asset:4",
            },
          ],
        },
        key: "e2e",
        idx: 0,
      },
      "",
    );
  });

  await page.goto("/assessment-result");

  await expect(page.locator(".ar-visual img").first()).toHaveAttribute(
    "src",
    CUSTOM_LOW,
  );
  await expect(page.locator(".ar-hero-title")).toHaveText("ประเมินเสร็จแล้ว");
  await expect(
    page.getByRole("button", { name: "ให้คะแนนระบบ" }),
  ).toBeVisible();
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

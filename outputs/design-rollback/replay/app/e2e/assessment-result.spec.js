import { test, expect } from "@playwright/test";

const resultState = {
  results: [
    {
      score: 3,
      label: "ปกติ / ไม่มีอาการซึมเศร้า",
      color: "#4caf50",
      advice: "รักษาสุขภาพจิตให้แจ่มใสต่อไป",
    },
  ],
  formId: "101",
  isSaved: true,
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript((state) => {
    window.history.replaceState(
      { usr: state, key: "assessment-result-e2e", idx: 0 },
      "",
      window.location.href,
    );
    window.localStorage.setItem("i18nextLng", "th");
  }, resultState);
});

test("assessment result renders one non-overlapping body per result", async ({
  page,
}) => {
  await page.goto("/assessment-result");

  const card = page.locator(".ar-result-card");
  await expect(card).toHaveCount(1);
  await expect(card.locator(".ar-result-card__body")).toHaveCount(1);
  await expect(card.locator(".ar-advice-box")).toHaveCount(1);
  await expect(card.locator(".ar-visual")).toHaveCount(1);

  const headBox = await card.locator(".ar-result-card__head").boundingBox();
  const bodyBox = await card.locator(".ar-result-card__body").boundingBox();
  expect(headBox).not.toBeNull();
  expect(bodyBox).not.toBeNull();
  expect(bodyBox.y).toBeGreaterThanOrEqual(headBox.y + headBox.height - 1);
});

test("successful submission closes loading dialog and opens result", async ({
  page,
}) => {
  await page.addInitScript(() => {
    document.cookie = "suth_patient_session=synthetic-session; path=/";
  });
  await page.route(/\/api\/forms\/101$/, (route) =>
    route.fulfill({
      json: {
        id: 101,
        title: "แบบประเมินทดสอบ",
        description: "แบบประเมินทดสอบ",
        questions: [],
        theme: {},
      },
    }),
  );
  await page.route(/\/api\/forms\/101\/submit$/, (route) =>
    route.fulfill({
      status: 201,
      json: { message: "บันทึกคำตอบสำเร็จ", responseId: 1 },
    }),
  );

  await page.goto("/assessment/101");
  await page.getByRole("button", { name: "ส่งคำตอบ" }).click();
  await page.getByRole("button", { name: "ยินยอม" }).click();

  await expect(page).toHaveURL(/\/assessment-result$/);
  await expect(page.locator(".swal2-container")).toHaveCount(0);
});

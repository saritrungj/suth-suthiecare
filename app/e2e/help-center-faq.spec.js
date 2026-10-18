import { test, expect } from "@playwright/test";
import { mockPublicApi } from "./helpers/api-mocks.js";

// Synthetic data shaped like GET /admin/help-center/public/faqs: the server
// returns only published rows and leaves out the `status` column.
const clinic = {
  id: 7,
  slug: "mind",
  name: "คลินิกสุขภาพใจทดสอบ",
  is_active: 1,
  show_in_help_center: 1,
};
const categories = [
  {
    id: 1,
    clinic_id: 7,
    category_name: "สุขภาพจิตทั่วไป",
    status: "published",
    display_order: 1,
  },
  {
    id: 2,
    clinic_id: 7,
    category_name: "โรคซึมเศร้า",
    status: "published",
    display_order: 2,
  },
  {
    id: 3,
    clinic_id: 7,
    category_name: "หมวดที่ยังไม่มีคำถาม",
    status: "published",
    display_order: 3,
  },
];
const faqs = [
  {
    faq_id: 11,
    clinic_id: 7,
    category_id: 1,
    category_name: "สุขภาพจิตทั่วไป",
    question: "ความเครียดคืออะไร",
    answer: "<p>คำตอบเรื่องความเครียด</p>",
    display_order: 1,
    is_homepage: 0,
  },
  {
    faq_id: 12,
    clinic_id: 7,
    category_id: 2,
    category_name: "โรคซึมเศร้า",
    question: "อาการซึมเศร้าเป็นอย่างไร",
    answer: "<p>คำตอบเรื่องซึมเศร้า</p>",
    display_order: 2,
    is_homepage: 0,
  },
  {
    faq_id: 13,
    clinic_id: 7,
    category_id: null,
    category_name: null,
    question: "ติดต่อคลินิกได้ทางไหน",
    answer: "<p>โทร 0-0000-0000</p>",
    display_order: 3,
    is_homepage: 1,
  },
];

test.beforeEach(async ({ page }) => {
  await mockPublicApi(page);
  await page.route(/\/api\/clinics$/, (route) =>
    route.fulfill({ json: { data: [clinic] } }),
  );
  await page.route(/\/api\/admin\/help-center\/public\/faqs$/, (route) =>
    route.fulfill({ json: { success: true, data: faqs } }),
  );
  await page.route(
    /\/api\/admin\/help-center\/public\/categories\/7$/,
    (route) => route.fulfill({ json: { success: true, data: categories } }),
  );
});

test("clinic help shows published questions grouped by category", async ({
  page,
}) => {
  await page.goto("/help-center/clinic/7");

  // The first question opens automatically with its answer.
  const answer = page.locator(".hc-answer-display-card");
  await expect(answer).toContainText("ความเครียดคืออะไร");
  await expect(answer).toContainText("คำตอบเรื่องความเครียด");
  await expect(page.getByText("ยังไม่มีคำถามที่เผยแพร่")).toHaveCount(0);

  // Uncategorised questions are listed on their own.
  await expect(
    page.locator(".hc-sub-question-item", { hasText: "ติดต่อคลินิกได้ทางไหน" }),
  ).toBeVisible();

  // Opening another category lists its question, and choosing it shows the answer.
  await page
    .locator(".hc-nested-cat-header", { hasText: "โรคซึมเศร้า" })
    .click();
  await page
    .locator(".hc-sub-question-item", { hasText: "อาการซึมเศร้าเป็นอย่างไร" })
    .click();
  await expect(answer).toContainText("คำตอบเรื่องซึมเศร้า");
  await expect(answer.locator(".hc-answer-tag-category")).toHaveText(
    "โรคซึมเศร้า",
  );

  // A category without questions says so instead of opening empty.
  await page
    .locator(".hc-nested-cat-header", { hasText: "หมวดที่ยังไม่มีคำถาม" })
    .click();
  await expect(page.getByText("ยังไม่มีคำถามในหมวดนี้")).toBeVisible();
});

test("clinic help search finds questions across categories", async ({
  page,
}) => {
  await page.goto("/help-center/clinic/7");
  await page.getByPlaceholder("ค้นหาข้อคำถามย่อย...").fill("ซึมเศร้า");
  await expect(
    page.locator(".hc-sub-question-item", {
      hasText: "อาการซึมเศร้าเป็นอย่างไร",
    }),
  ).toBeVisible();
  await expect(
    page.locator(".hc-sub-question-item", { hasText: "ความเครียดคืออะไร" }),
  ).toHaveCount(0);
});

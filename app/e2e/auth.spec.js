import { test, expect } from "@playwright/test";
import { mockAdminApi } from "./helpers/api-mocks.js";

test("admin route redirects unauthenticated users to login", async ({
  page,
}) => {
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "เข้าสู่ระบบ" })).toBeVisible();
});

test("login validates required fields and toggles password visibility", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(
    page.getByText("กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน"),
  ).toBeVisible();

  const password = page.getByPlaceholder("กรอกรหัสผ่าน");
  await password.fill("secret");
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "แสดงรหัสผ่าน" }).click();
  await expect(password).toHaveAttribute("type", "text");
});

test("successful login uses the cookie session without storing an access token", async ({
  page,
}) => {
  await mockAdminApi(page);
  await page.goto("/login");
  await page.getByPlaceholder("กรอกชื่อผู้ใช้งาน").fill("e2e-admin");
  await page.getByPlaceholder("กรอกรหัสผ่าน").fill("secret");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();

  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  // A system admin starts on the all-organizations overview.
  await expect(
    page.getByRole("heading", { name: "ภาพรวมทุกหน่วยงาน" }),
  ).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("suth_token"))).toBe(
    null,
  );
});

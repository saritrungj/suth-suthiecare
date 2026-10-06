import { test, expect } from "@playwright/test";

async function mockUserApi(page, received) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    const { pathname } = requestUrl;
    if (pathname.endsWith("/api/session/staff"))
      return route.fulfill({
        json: {
          user: { id: 1, username: "e2e-admin", role_id: 1 },
          csrf_token: "synthetic-staff-csrf",
        },
      });
    if (pathname.endsWith("/api/session/patient"))
      return route.fulfill({ status: 401, json: {} });

    if (pathname.endsWith("/api/me/authorization")) {
      return route.fulfill({
        json: {
          user: { id: 1, username: "e2e-admin" },
          is_system_admin: true,
          organizations: [{ id: 1, name: "หน่วยงานทดสอบ" }],
          memberships: [],
        },
      });
    }
    if (pathname.endsWith("/api/users") && request.method() === "GET") {
      return route.fulfill({
        json: [
          {
            id: 2,
            username: "staff-user",
            name: "เจ้าหน้าที่ ********",
            email: "staff@example.test",
            role_id: 3,
            status: "active",
          },
        ],
      });
    }
    if (pathname.endsWith("/api/users") && request.method() === "POST") {
      received.created = request.postDataJSON();
      return route.fulfill({
        status: 201,
        json: { id: 3, message: "สร้างผู้ใช้งานสำเร็จ" },
      });
    }
    if (pathname.endsWith("/api/users/2/full")) {
      received.fullRecordRequested = true;
      return route.fulfill({
        json: {
          id: 2,
          username: "staff-user",
          name: "นาย เจ้าหน้าที่ ชื่อจริงที่ไม่ถูกปกปิด",
          email: "staff@example.test",
          role_id: 3,
          status: "active",
        },
      });
    }
    if (pathname.endsWith("/api/patient-members")) {
      received.memberListLimit = requestUrl.searchParams.get("limit");
      return route.fulfill({
        json: {
          data: [
            {
              id: 15,
              username: "patient-member",
              full_name: "สมชาย ใจดี",
              status: "active",
              created_at: "2026-08-01T08:00:00.000Z",
              last_login_at: "2026-08-10T09:30:00.000Z",
            },
          ],
          pagination: { page: 1, limit: 20, total: 1, total_pages: 1 },
        },
      });
    }
    if (
      pathname.endsWith("/api/patient-members/15") &&
      request.method() === "GET"
    ) {
      received.memberFullRequested = true;
      return route.fulfill({
        json: {
          id: 15,
          username: "patient-member",
          first_name: "สมชาย",
          last_name: "ใจดี",
          phone: "0812345678",
          email: "patient@example.test",
          status: "active",
        },
      });
    }
    if (
      pathname.endsWith("/api/patient-members/15") &&
      request.method() === "PUT"
    ) {
      received.memberUpdated = request.postDataJSON();
      return route.fulfill({
        json: { message: "บันทึกข้อมูลผู้มารับบริการเรียบร้อยแล้ว" },
      });
    }
    if (
      pathname.endsWith("/api/patient-members/15") &&
      request.method() === "DELETE"
    ) {
      received.memberDeleted = true;
      return route.fulfill({
        json: { message: "ลบบัญชีผู้มารับบริการเรียบร้อยแล้ว" },
      });
    }
    if (pathname.includes("/permissions")) return route.fulfill({ json: [] });
    return route.fulfill({ json: [] });
  });
}

test.describe("user management data integrity", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      document.cookie = "suth_staff_session=synthetic-session; path=/";
      sessionStorage.setItem(
        "suth_user",
        JSON.stringify({ id: 1, username: "e2e-admin", role_id: 1 }),
      );
    });
  });

  test("saves a long Thai full name without truncating it", async ({
    page,
  }) => {
    const received = {};
    const fullName = `นางสาว ${"ก".repeat(220)} นามสกุลทดสอบ`;
    await mockUserApi(page, received);
    await page.goto("/admin/users");

    await page.getByRole("button", { name: "เพิ่มผู้ใช้งาน" }).click();
    await page.getByPlaceholder("เช่น admin_01").fill("long-thai-name");
    await page.getByPlaceholder("ตั้งรหัสผ่าน").fill("password-123");
    await page.getByPlaceholder("กรอกชื่อ-นามสกุล").fill(fullName);
    await page
      .getByPlaceholder("example@mail.com")
      .fill("long.name@example.test");
    await page.getByRole("button", { name: "บันทึกข้อมูล" }).click();

    await expect.poll(() => received.created?.name).toBe(fullName);
    expect(received.created.role_id).toBe(2);
  });

  test("loads the unmasked record before editing a user", async ({ page }) => {
    const received = {};
    await mockUserApi(page, received);
    await page.goto("/admin/users");

    await page.locator("button.sum-edit").click();
    await expect(page.getByPlaceholder("กรอกชื่อ-นามสกุล")).toHaveValue(
      "นาย เจ้าหน้าที่ ชื่อจริงที่ไม่ถูกปกปิด",
    );
    expect(received.fullRecordRequested).toBe(true);
  });

  test("shows patient members without exposing sensitive identity fields", async ({
    page,
  }) => {
    const received = {};
    await mockUserApi(page, received);
    await page.goto("/admin/members");

    await expect(
      page.getByRole("heading", { name: "ผู้มารับบริการ" }),
    ).toBeVisible();
    await expect(page.getByText("patient-member")).toBeVisible();
    await expect(page.getByText("สมชาย ใจดี", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("table").getByText("ใช้งานปกติ", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(/identity_hash|เลขบัตรประชาชน|phone_encrypted/),
    ).toHaveCount(0);
    await expect.poll(() => received.memberListLimit).toBe("10");
  });

  test("user management page provides its own vertical scroll area", async ({
    page,
    isMobile,
  }) => {
    const received = {};
    await page.setViewportSize({ width: isMobile ? 390 : 1280, height: 320 });
    await mockUserApi(page, received);
    await page.goto("/admin/users");

    const pageScroller = page.locator(".sum-user-wrapper");
    await expect(pageScroller).toBeVisible();
    await expect
      .poll(() =>
        pageScroller.evaluate((element) => ({
          canScroll: element.scrollHeight > element.clientHeight,
          overflowY: getComputedStyle(element).overflowY,
        })),
      )
      .toEqual({ canScroll: true, overflowY: "auto" });

    await pageScroller.evaluate((element) =>
      element.scrollTo(0, element.scrollHeight),
    );
    await expect
      .poll(() => pageScroller.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
  });

  test("edits patient details and resets the password from the service-recipient menu", async ({
    page,
  }) => {
    const received = {};
    await mockUserApi(page, received);
    await page.goto("/admin/members");

    await page.getByRole("button", { name: "แก้ไขข้อมูล สมชาย ใจดี" }).click();
    await expect(
      page.getByRole("heading", { name: "แก้ไขข้อมูลผู้มารับบริการ" }),
    ).toBeVisible();
    const phoneInput = page.locator(
      '.sum-member-modal input[autocomplete="tel"]',
    );
    await expect(phoneInput).toHaveValue("0812345678");
    await phoneInput.fill("089-876-5432");
    await expect(phoneInput).toHaveValue("0898765432");
    await page.getByLabel("ชื่อ", { exact: true }).fill("สมหญิง");
    await page.getByLabel(/รหัสผ่านใหม่/).fill("new-password-123");
    await page.getByRole("button", { name: "บันทึกการเปลี่ยนแปลง" }).click();

    await expect.poll(() => received.memberUpdated?.first_name).toBe("สมหญิง");
    expect(received.memberUpdated.phone).toBe("0898765432");
    expect(received.memberUpdated.password).toBe("new-password-123");
    expect(received.memberFullRequested).toBe(true);
  });

  test("deletes a patient login only after explicit confirmation", async ({
    page,
  }) => {
    const received = {};
    await mockUserApi(page, received);
    await page.goto("/admin/members");

    await page.getByRole("button", { name: "ลบบัญชี สมชาย ใจดี" }).click();
    await expect(
      page.getByRole("heading", { name: "ลบบัญชีผู้มารับบริการ?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "ลบบัญชีถาวร" }).click();

    await expect.poll(() => received.memberDeleted).toBe(true);
  });
});

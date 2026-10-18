import { test, expect } from "@playwright/test";

test("dashboard applies the selected date range to statistics and recent cases", async ({
  page,
}) => {
  const requests = [];
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    document.cookie = "suth_staff_session=synthetic-session; path=/";
    sessionStorage.setItem(
      "suth_user",
      JSON.stringify({ id: 1, username: "e2e-admin", role_id: 1 }),
    );
    // One organization: "all" now shows the cross-organization overview.
    localStorage.setItem("suth_active_organization_1", "1");
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;
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
    if (pathname.endsWith("/api/forms")) {
      return route.fulfill({
        json: [
          {
            id: 1,
            title: "แบบประเมินทดสอบ",
            clinic_type: "teenager",
            status: "published",
          },
        ],
      });
    }
    if (pathname.endsWith("/api/forms/1")) {
      return route.fulfill({
        json: { id: 1, questions: [{ id: 10, type: "text", title: "คำถาม" }] },
      });
    }
    if (
      pathname.endsWith("/api/dashboard-settings/settings") &&
      request.method() === "GET"
    )
      return route.fulfill({ json: {} });
    if (pathname.endsWith("/api/evaluations/stats")) {
      return route.fulfill({
        json: {
          avg_ui: 0,
          avg_speed: 0,
          avg_content: 0,
          avg_access: 0,
          avg_overall: 0,
          avg_sus: 0,
          avg_sus1: 0,
          avg_sus2: 0,
          avg_sus3: 0,
          avg_sus4: 0,
          avg_sus5: 0,
          avg_sus6: 0,
          avg_sus7: 0,
          avg_sus8: 0,
          avg_sus9: 0,
          avg_sus10: 0,
          total_votes: 0,
          recent_comments: [],
        },
      });
    }
    if (pathname.endsWith("/api/clinics"))
      return route.fulfill({ json: { data: [] } });
    if (
      pathname.endsWith("/api/admin/master-cases/stats") ||
      pathname.endsWith("/api/dashboard/recent")
    ) {
      requests.push(url.search);
      return route.fulfill({
        json: pathname.endsWith("/stats")
          ? { totalActive: 7, newToday: 2, highRisk: 1, closed: 3 }
          : [],
      });
    }
    return route.fulfill({ json: [] });
  });

  await page.goto("/admin/dashboard");
  await expect.poll(() => pageErrors).toEqual([]);
  // KPI tiles (dashboard kit): high risk, waiting contact, new, active, closed.
  await expect
    .poll(async () =>
      (await page.locator(".dz-kpi__value").allTextContents()).map((text) =>
        text.replace(/\D/g, ""),
      ),
    )
    .toEqual(["1", "0", "2", "7", "3"]);
  await expect(page.locator('input[type="date"]').first()).toBeVisible();
  const dateInputs = page.locator('input[type="date"]');
  const expectedDefaultRange = await page.evaluate(() => {
    const today = new Date();
    const key = (date) =>
      [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("-");
    return [
      key(new Date(today.getFullYear(), today.getMonth(), 1)),
      key(today),
    ];
  });
  await expect(dateInputs.nth(0)).toHaveValue(expectedDefaultRange[0]);
  await expect(dateInputs.nth(1)).toHaveValue(expectedDefaultRange[1]);

  await dateInputs.nth(0).evaluate((element, value) => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set;
    setter.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, "2026-08-10");
  await page.waitForTimeout(250);
  expect(pageErrors).toEqual([]);
  await dateInputs.nth(1).evaluate((element, value) => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set;
    setter.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, "2026-08-10");

  await expect
    .poll(() =>
      requests.some(
        (search) =>
          search.includes("startDate=2026-08-10") &&
          search.includes("endDate=2026-08-10"),
      ),
    )
    .toBe(true);
  await expect(page.getByText("เคสใหม่ในช่วงที่เลือก").first()).toBeVisible();
});

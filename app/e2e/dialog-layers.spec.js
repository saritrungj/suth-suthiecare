import { expect, test } from "@playwright/test";
import {
  mockResponsiveApi,
  setRouteSession,
} from "./helpers/responsive-fixtures.js";
import { mockSchoolShowcase } from "./helpers/school-showcase.js";

// A dialog opened from a drawer (the student file, the case file) must paint
// above that drawer. Open dialogs mark everything else inert, and inert nodes
// are skipped by hit-testing, so the check lifts inert for a moment to ask
// the browser what is really painted on top.

const MODULES = [
  "school",
  "students",
  "student_health",
  "student_behavior",
  "dashboard",
];
const ACTIONS = ["view", "create", "update", "delete", "assign", "export"];

async function paintedOnTop(page) {
  return page.evaluate(() => {
    const overlay = [...document.querySelectorAll(".sch-modal-overlay")].at(-1);
    const dialog = overlay.querySelector('[role="dialog"]') || overlay;
    const inert = [...document.querySelectorAll("[inert]")];
    inert.forEach((node) => node.removeAttribute("inert"));
    const box = dialog.getBoundingClientRect();
    const onTop = [
      [0.5, 0.15],
      [0.5, 0.5],
      [0.2, 0.3],
      [0.8, 0.3],
    ].every(([x, y]) =>
      dialog.contains(
        document.elementFromPoint(
          box.left + box.width * x,
          Math.min(box.top + box.height * y, innerHeight - 4),
        ),
      ),
    );
    inert.forEach((node) => node.setAttribute("inert", ""));
    return onTop;
  });
}

test("dialogs opened from the student drawer paint above it", async ({
  page,
  baseURL,
}) => {
  await mockResponsiveApi(page, { organizationId: 3 });
  await setRouteSession(page, "/admin/dashboard", baseURL);
  await page.route("**/api/me/authorization", (route) =>
    route.fulfill({
      json: {
        user: { id: 1, username: "school-admin", role_id: 2 },
        is_system_admin: false,
        system_role: "admin",
        organizations: [],
        memberships: [
          {
            id: 1,
            organization: {
              id: 3,
              name: "โรงเรียนสาธิต",
              org_type: "school",
              org_level: "unit",
            },
            role: { id: 2, name: "ผู้ดูแลโรงเรียน" },
            permissions: MODULES.flatMap((m) =>
              ACTIONS.map((a) => `${m}.${a}`),
            ),
          },
        ],
      },
    }),
  );
  await mockSchoolShowcase(page);
  await page.goto("/admin/school/students?student=1");
  const drawer = page.locator(".cw-drawer");
  await expect(drawer).toBeVisible();
  await drawer.getByRole("tab", { name: "พฤติกรรม", exact: true }).click();

  for (const label of ["บันทึกพฤติกรรม", "เปิด"]) {
    await drawer
      .locator(".cw-drawer-body")
      .getByRole("button", { name: label, exact: true })
      .first()
      .click();
    await expect(page.locator(".sch-modal-overlay")).toBeVisible();
    expect(await paintedOnTop(page), `${label} dialog is on top`).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.locator(".sch-modal-overlay")).toHaveCount(0);
    await expect(drawer).toBeVisible();
  }
});

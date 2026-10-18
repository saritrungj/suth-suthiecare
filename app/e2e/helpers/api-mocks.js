export async function mockPublicApi(page) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    // Mirror the server: an anonymous session probe answers 204, not 401.
    const session = pathname.match(/\/api\/session\/(staff|patient)$/);
    if (
      session &&
      new URL(request.url()).searchParams.has("probe") &&
      !request.headers().cookie?.includes(`suth_${session[1]}_session=`)
    )
      return route.fulfill({ status: 204, body: "" });

    if (pathname.endsWith("/api/session/patient"))
      return route.fulfill({
        status: request.headers().cookie?.includes("suth_patient_session=")
          ? 200
          : 401,
        json: {
          user: {
            id: 1,
            username: "patient",
            display_name: "ผู้รับบริการทดสอบ",
            status: "active",
          },
          csrf_token: "synthetic-patient-csrf",
        },
      });
    if (pathname.endsWith("/api/session/staff"))
      return route.fulfill({
        status: request.headers().cookie?.includes("suth_staff_session=")
          ? 200
          : 401,
        json: {
          user: { id: 1, username: "e2e-admin", role_id: 1 },
          csrf_token: "synthetic-staff-csrf",
        },
      });
    if (
      pathname.endsWith("/privacy/organizations") ||
      pathname.endsWith("/privacy/requests")
    )
      return route.fulfill({ json: [] });
    if (pathname.endsWith("/privacy-notice"))
      return route.fulfill({ json: null });
    if (pathname.endsWith("/api/clinics")) {
      return route.fulfill({
        json: {
          data: [
            {
              id: 1,
              slug: "general",
              name: "คลินิกสุขภาพทั่วไป",
              name_en: "General Health Clinic",
              sort_order: 1,
              show_icon: 0,
            },
          ],
        },
      });
    }

    if (pathname.endsWith("/api/banners")) {
      return route.fulfill({ json: [] });
    }

    if (pathname.endsWith("/api/forms")) {
      return route.fulfill({
        json: [
          {
            id: 101,
            title: "แบบประเมินสุขภาพทั่วไป",
            description: "ประเมินสุขภาพเบื้องต้น",
            clinic_type: "general",
            status: "published",
          },
        ],
      });
    }

    if (pathname.endsWith("/api/counts")) {
      return route.fulfill({ json: { data: { 101: 12 } } });
    }

    if (pathname.includes("/api/admin/help-center/faqs")) {
      return route.fulfill({ json: { success: true, data: [] } });
    }

    return route.fulfill({ json: {} });
  });
}

export async function mockAdminApi(page) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    // Mirror the server: an anonymous session probe answers 204, not 401.
    const session = pathname.match(/\/api\/session\/(staff|patient)$/);
    if (
      session &&
      new URL(request.url()).searchParams.has("probe") &&
      !request.headers().cookie?.includes(`suth_${session[1]}_session=`)
    )
      return route.fulfill({ status: 204, body: "" });

    if (pathname.endsWith("/api/login")) {
      return route.fulfill({
        json: {
          success: true,
          csrf_token: "synthetic-staff-csrf",
          user: {
            id: 1,
            username: "e2e-admin",
            name: "ผู้ดูแลระบบทดสอบ",
            role: "admin",
            role_id: 1,
          },
        },
      });
    }

    // Every admin page resolves permissions and the active organization from
    // this endpoint before rendering; a system admin sees everything.
    if (pathname.endsWith("/api/me/authorization")) {
      return route.fulfill({
        json: {
          user: { id: 1, username: "e2e-admin", name: "ผู้ดูแลระบบทดสอบ" },
          is_system_admin: true,
          system_permissions: [],
          organizations: [{ id: 1, code: "E2E", name: "หน่วยงานทดสอบ" }],
          memberships: [],
        },
      });
    }

    if (pathname.includes("/permissions")) return route.fulfill({ json: [] });
    if (/\/api\/users\/\d+\/full$/.test(pathname)) {
      return route.fulfill({
        json: {
          id: 2,
          username: "staff-user",
          name: "เจ้าหน้าที่ทดสอบ",
          email: "staff@example.test",
          role_id: 3,
          status: "active",
        },
      });
    }

    if (pathname.endsWith("/api/forms")) return route.fulfill({ json: [] });
    if (pathname.endsWith("/api/users")) return route.fulfill({ json: [] });
    if (pathname.endsWith("/api/roles")) return route.fulfill({ json: [] });
    if (pathname.endsWith("/api/banners")) return route.fulfill({ json: [] });
    if (pathname.endsWith("/api/services")) return route.fulfill({ json: [] });
    if (pathname.endsWith("/api/appointments")) {
      return route.fulfill({ json: [] });
    }
    if (pathname.endsWith("/api/all-cases")) {
      return route.fulfill({ json: [] });
    }
    if (pathname.endsWith("/api/clinics/all")) {
      return route.fulfill({ json: { data: [] } });
    }
    if (pathname.endsWith("/api/session/patient"))
      return route.fulfill({
        status: request.headers().cookie?.includes("suth_patient_session=")
          ? 200
          : 401,
        json: {
          user: {
            id: 1,
            username: "patient",
            display_name: "ผู้รับบริการทดสอบ",
            status: "active",
          },
          csrf_token: "synthetic-patient-csrf",
        },
      });
    if (pathname.endsWith("/api/session/staff"))
      return route.fulfill({
        status: request.headers().cookie?.includes("suth_staff_session=")
          ? 200
          : 401,
        json: {
          user: { id: 1, username: "e2e-admin", role_id: 1 },
          csrf_token: "synthetic-staff-csrf",
        },
      });
    if (
      pathname.endsWith("/privacy/organizations") ||
      pathname.endsWith("/privacy/requests")
    )
      return route.fulfill({ json: [] });
    if (pathname.endsWith("/privacy-notice"))
      return route.fulfill({ json: null });
    if (pathname.endsWith("/api/clinics")) {
      return route.fulfill({ json: { data: [] } });
    }
    if (pathname.includes("/api/admin/help-center/faqs")) {
      return route.fulfill({ json: { success: true, data: [] } });
    }
    if (pathname.endsWith("/api/dashboard-settings/settings")) {
      return route.fulfill({ json: { charts: [] } });
    }
    if (pathname.endsWith("/api/dashboard/recent")) {
      return route.fulfill({ json: [] });
    }
    if (pathname.endsWith("/api/admin/master-cases/stats")) {
      return route.fulfill({ json: {} });
    }
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

    return route.fulfill({ json: {} });
  });
}

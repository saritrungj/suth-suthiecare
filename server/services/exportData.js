const { serialize } = require("../utils/privateDto");
const definitions = {
  profile: { router: "authRoutes", path: "/me/profile", self: true },
  students: {
    router: "schoolRoutes",
    path: "/students",
    prefix: "/school",
    read: "students.view",
    export: "students.export",
    school: true,
  },
  school_cases: {
    router: "schoolRoutes",
    path: "/cases",
    prefix: "/school",
    read: "student_health.view",
    export: "student_health.export",
    school: true,
  },
  screening_rounds: {
    router: "schoolWorkflowRoutes",
    path: "/screening-rounds",
    prefix: "/school",
    read: "school_workflows.view",
    export: "school_workflows.export",
    school: true,
  },
  schools: {
    router: "schoolRoutes",
    path: "/schools",
    prefix: "/school",
    read: "school.view",
    export: "school.export",
    school: true,
  },
  grades: {
    router: "schoolRoutes",
    path: (id) => `/schools/${id}/grades`,
    prefix: "/school",
    read: "school.view",
    export: "school.export",
    school: true,
  },
  classrooms: {
    router: "schoolRoutes",
    path: (id) => `/schools/${id}/classrooms`,
    prefix: "/school",
    read: "school.view",
    export: "school.export",
    school: true,
  },
  teachers: {
    router: "schoolRoutes",
    path: "/teachers",
    prefix: "/school",
    read: "school.view",
    export: "school.export",
    school: true,
  },
  teacher_types: {
    router: "schoolRoutes",
    path: "/teacher-types",
    prefix: "/school",
    read: "school.view",
    export: "school.export",
    school: true,
  },
  student_types: {
    router: "schoolRoutes",
    path: "/student-types",
    prefix: "/school",
    read: "school.view",
    export: "school.export",
    school: true,
  },
  school_roles: {
    router: "schoolInsightRoutes",
    path: "/staff-roles",
    prefix: "/school",
    read: "school_staff.view",
    export: "school_staff.export",
    school: true,
  },
  student: {
    router: "schoolRoutes",
    path: (id) => `/students/${id}`,
    prefix: "/school",
    read: "students.view",
    export: "students.export",
    school: true,
  },
  student_health: {
    router: "schoolRoutes",
    path: (id) => `/students/${id}/health`,
    prefix: "/school",
    read: "student_health.view",
    export: "students.export",
    school: true,
    deep: true,
  },
  student_insights: {
    router: "schoolInsightRoutes",
    path: (id) => `/students/${id}/insights`,
    prefix: "/school",
    read: "student_health.view",
    export: "students.export",
    school: true,
    deep: true,
  },
  cases: {
    router: "caseRoutes",
    path: "/all-cases",
    read: "cases.view",
    export: "cases.export",
  },
  responses: {
    offset: true,
    router: "formRoutes",
    path: (id) => `/forms/${id}/responses`,
    read: "cases.view",
    export: "cases.export",
  },
  case: {
    router: "caseRoutes",
    path: (id) => `/cases/${id}`,
    read: "cases.view",
    export: "cases.export",
  },
  case_history: {
    router: "privateExportRoutes",
    path: (id) => `/cases/${id}/export-data`,
    method: "POST",
    read: "cases.view",
    export: "cases.export",
    deep: true,
  },
  appointments: {
    router: "caseRoutes",
    path: "/appointments",
    read: "appointments.view",
    export: "appointments.export",
    offset: true,
  },
  referrals: {
    router: "caseReferralRoutes",
    path: "/",
    prefix: "/case-referrals",
    read: "cases.view",
    export: "cases.export",
    hasMore: true,
  },
  referral: {
    router: "caseReferralRoutes",
    path: (id) => `/${id}`,
    prefix: "/case-referrals",
    read: "cases.view",
    export: "cases.export",
  },
  members: {
    router: "userRoutes",
    path: "/patient-members",
    read: "patient_members.view",
    export: "patient_members.export",
    paged: true,
  },
  member: {
    router: "userRoutes",
    path: (id) => `/patient-members/${id}`,
    read: "patient_members.view",
    export: "patient_members.export",
  },
  users: { router: "userRoutes", path: "/users", system: true },
  roles: { router: "roleRoutes", path: "/roles", system: true },
  role_permissions: {
    router: "roleRoutes",
    path: (id) => `/roles/${id}/permissions`,
    system: true,
  },
  organizations: {
    router: "organizationRoutes",
    path: "/organizations",
    system: true,
  },
  organization_members: {
    router: "organizationRoutes",
    path: (id) => `/organizations/${id}/members`,
    system: true,
  },
  forms: {
    router: "formRoutes",
    path: "/forms",
    read: "forms.view",
    export: "forms.export",
  },
  form: {
    router: "formRoutes",
    path: (id) => `/forms/${id}`,
    read: "forms.view",
    export: "forms.export",
  },
  clinics: {
    router: "clinicRoutes",
    path: "/all",
    prefix: "/clinics",
    read: "clinics.view",
    export: "clinics.export",
  },
  faqs: {
    router: "faqRoutes",
    path: "/faqs",
    prefix: "/admin/help-center",
    read: "help_center.view",
    export: "help_center.export",
  },
  faq_categories: {
    router: "faqRoutes",
    path: (id) => `/categories/${id}`,
    prefix: "/admin/help-center",
    read: "help_center.view",
    export: "help_center.export",
  },
  banners: {
    router: "bannerRoutes",
    path: "/banners",
    read: "content.view",
    export: "content.export",
  },
  dashboard: {
    router: "dashboardRoutes",
    path: "/dashboard/summary",
    read: "dashboard.view",
    export: "dashboard.export",
  },
  dashboard_recent: {
    router: "dashboardRoutes",
    path: "/dashboard/recent",
    read: "dashboard.view",
    export: "dashboard.export",
  },
  dashboard_stats: {
    router: "dashboardRoutes",
    path: "/admin/master-cases/stats",
    read: "dashboard.view",
    export: "dashboard.export",
  },
  chart: {
    router: "dashboardRoutes",
    path: (id) => `/charts/${id}`,
    read: "dashboard.view",
    export: "dashboard.export",
    deep: true,
  },
  master: {
    router: "masterDataRoutes",
    path: (id) => `/${id}`,
    prefix: "/master-data",
    read: "master_data.view",
    export: "master_data.export",
  },
};
// These resources contain organization/configuration labels, not patient
// names or assessment results. Their read/export rights protect the content.
for (const resource of [
  "schools",
  "grades",
  "classrooms",
  "teacher_types",
  "student_types",
  "forms",
  "form",
  "clinics",
  "faqs",
  "faq_categories",
  "banners",
  "roles",
  "role_permissions",
  "organizations",
  "master",
])
  definitions[resource].metadata = true;
function error(status, message) {
  return Object.assign(new Error(message), { status });
}
function canExport(req, def) {
  if (def.self) return Boolean(req.authorization && req.user);
  if (req.authorization?.isSystemAdmin) return true;
  if (def.system) return false;
  // Roles page only: the resource's view and export rights, within school scope.
  const { can } = require("../authorization/can");
  if (def.school) {
    const a = req.schoolAccess;
    return Boolean(
      can(req, def.export) &&
      (def.read === "students.view"
        ? a?.canViewStudents
        : def.read === "student_health.view"
          ? a?.canClinical
          : can(req, def.read)),
    );
  }
  return Boolean(can(req, def.read) && can(req, def.export));
}
// Reuse the existing scoped read handlers instead of maintaining a second SQL
// implementation. Only entries in the fixed registry can be dispatched.
function capture(req, def, query, id) {
  return new Promise((resolve, reject) => {
    const route = typeof def.path === "function" ? def.path(id) : def.path;
    const inner = Object.create(req);
    Object.defineProperties(inner, {
      method: { value: def.method || "GET", writable: true },
      url: { value: route, writable: true },
      originalUrl: { value: (def.prefix || "") + route, writable: true },
      query: { value: query },
      path: {
        get() {
          return this.url.split("?")[0];
        },
      },
      params: { value: {}, writable: true },
      exporting: { value: true },
      body: { value: { format: "json" } },
      _parsedUrl: { value: undefined, writable: true },
    });
    const response = {
      statusCode: 200,
      req: inner,
      locals: {},
      set() {
        return this;
      },
      header() {
        return this;
      },
      get() {
        return undefined;
      },
      getHeader() {
        return undefined;
      },
      setHeader() {
        return this;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.statusCode >= 400
          ? reject(
              error(
                this.statusCode,
                body.message || body.code || "ส่งออกไม่สำเร็จ",
              ),
            )
          : resolve(body);
        return this;
      },
      send(body) {
        return this.json(body);
      },
      end() {
        resolve(null);
      },
      cookie() {
        return this;
      },
      clearCookie() {
        return this;
      },
    };
    inner.res = response;
    const publicPath = (def.prefix || "") + route;
    const boundaryReq = Object.create(inner);
    Object.defineProperty(boundaryReq, "path", { value: publicPath });
    const run = () => {
      inner.schoolSubjectScope = boundaryReq.schoolSubjectScope;
      inner.schoolResourcePath = publicPath;
      inner.schoolAccess = boundaryReq.schoolAccess;
      require(`../routes/${def.router}`).handle(inner, response, (e) =>
        reject(e || error(404, "ไม่พบข้อมูลที่ส่งออก")),
      );
    };
    const disclose = () =>
      def.metadata
        ? run()
        : require("../middleware/privateDisclosure").privateDisclosure(
            boundaryReq,
            response,
            run,
          );
    Promise.resolve(
      require("../middleware/schoolPrivacyBoundary").schoolPrivacyBoundary(
        boundaryReq,
        response,
        disclose,
      ),
    ).catch(reject);
  });
}
function rowsOf(body) {
  if (Array.isArray(body)) return body;
  for (const k of ["data", "items", "responses", "cases"])
    if (Array.isArray(body?.[k])) return body[k];
  return null;
}
function sanitizeExport(value, clinical, pii) {
  const safe = serialize(value, { pii, clinical });
  const strip = (v) => {
    if (Array.isArray(v)) return v.map(strip);
    if (v instanceof Date || v == null || typeof v !== "object")
      return typeof v === "string" && v.startsWith("suthenc:") ? "" : v;
    return Object.fromEntries(
      Object.entries(v)
        .filter(
          ([key]) =>
            key === "must_change_password" ||
            !/(password|token|secret|hash|encrypted|otp|csrf|^auth_|^session|^__enc$|^ct$|^kid$|^iv$|^tag$)/i.test(
              key,
            ),
        )
        .map(([key, val]) => [key, strip(val)]),
    );
  };
  return strip(safe);
}
async function collectSource(req, source, includeInsights) {
  const rawDef = Object.hasOwn(definitions, source.resource)
    ? definitions[source.resource]
    : null;
  const def =
    source.resource === "case" && includeInsights
      ? definitions.case_history
      : rawDef;
  if (!def) throw error(422, "ไม่พบหมวดส่งออก");
  if (!canExport(req, def)) throw error(403, "ไม่มีสิทธิ์อ่านและส่งออกหมวดนี้");
  if (
    typeof def.path === "function" &&
    typeof source.id !== "string" &&
    typeof source.id !== "number"
  )
    throw error(422, "ต้องระบุระเบียนที่ส่งออก");
  if (
    typeof def.path === "function" &&
    !/^[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)?$/.test(String(source.id))
  )
    throw error(422, "รหัสระเบียนไม่ถูกต้อง");
  const { can } = require("../authorization/can");
  const clinical = Boolean(
    includeInsights &&
    (req.authorization.isSystemAdmin ||
      ((req.schoolAccess
        ? req.schoolAccess.canClinical
        : can(req, "clinical.view")) &&
        can(req, "clinical.export"))),
  );
  if (includeInsights && !clinical)
    throw error(403, "ไม่มีสิทธิ์ส่งออกข้อมูลเชิงลึก");
  if (def.deep && !includeInsights)
    throw error(422, "กรุณาเลือกแนบข้อมูลเชิงลึก");
  const query = {
    ...(source.filters || {}),
    page: "1",
    limit: "200",
    offset: "0",
  };
  delete query.all; // Never depend on an unlimited response to paginate exports.
  let page = 1,
    items = [],
    body;
  do {
    body = await capture(
      req,
      def,
      {
        ...query,
        page: String(page),
        offset: String((page - 1) * (def.offset ? 500 : 200)),
        limit: def.offset ? "500" : def.hasMore ? "50" : "200",
      },
      source.id,
    );
    const rows = rowsOf(body);
    if (def.self) return sanitizeExport(body?.profile || body, false, true);
    if (!rows)
      return sanitizeExport(
        body,
        def.metadata || clinical,
        Boolean(
          def.metadata ||
          req.authorization.isSystemAdmin ||
          (can(req, "pii.view") && can(req, "pii.export")),
        ),
      );
    items.push(...rows);
    page++;
    const pagination = body?.pagination;
    const more = def.offset
      ? rows.length === 500
      : def.hasMore
        ? body.has_more
        : Boolean(pagination && page <= pagination.total_pages);
    if (!more) break;
  } while (true);
  if (source.ids) {
    if (
      !Array.isArray(source.ids) ||
      source.ids.some((id) => !["string", "number"].includes(typeof id))
    )
      throw error(422, "รายการระเบียนไม่ถูกต้อง");
    const ids = new Set(source.ids.map(String));
    const byId = new Map(items.map((r) => [String(r.id ?? r.faq_id), r]));
    items = [...ids].filter((id) => byId.has(id)).map((id) => byId.get(id));
  }
  if (source.resource === "students" && clinical) {
    for (const student of items) {
      if (
        require("../utils/schoolAccess").canViewPhysicalHealth(
          req.schoolAccess,
          student,
        )
      ) {
        student.health = await capture(
          req,
          definitions.student_health,
          {},
          student.id,
        );
        if (
          require("../utils/schoolAccess").canViewStudentHealth(
            req.schoolAccess,
            student,
          )
        )
          student.insights = await capture(
            req,
            definitions.student_insights,
            {},
            student.id,
          );
      }
    }
  }
  return sanitizeExport(
    items,
    def.metadata || clinical,
    Boolean(
      def.metadata ||
      req.authorization.isSystemAdmin ||
      (can(req, "pii.view") && can(req, "pii.export")),
    ),
  );
}
module.exports = {
  definitions,
  canExport,
  capture,
  collectSource,
  sanitizeExport,
  rowsOf,
};

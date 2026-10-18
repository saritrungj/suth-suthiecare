import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import { FiDownload } from "react-icons/fi";
import api from "../services/api";
import { usePermissions } from "../permissions/PermissionsProvider";
import { downloadWorkbook } from "../utils/excelWorkbook";
import "./ExcelExport.css";
const ExportContext = createContext(null);
export function ExportProvider({ children }) {
  const [entries, setEntries] = useState({});
  const value = useMemo(() => ({ entries, setEntries }), [entries]);
  return (
    <ExportContext.Provider value={value}>{children}</ExportContext.Provider>
  );
}
export function usePageExport(spec) {
  const context = useContext(ExportContext),
    id = useId(),
    signature = JSON.stringify(spec);
  useEffect(() => {
    if (!context) return;
    context.setEntries((old) => ({ ...old, [id]: JSON.parse(signature) }));
    return () =>
      context.setEntries((old) => {
        const next = { ...old };
        delete next[id];
        return next;
      });
  }, [id, signature, context?.setEntries]);
}
const defaults = {
  "/admin/profile": [{ resource: "profile" }],
  "/admin/dashboard": [
    { resource: "dashboard" },
    { resource: "dashboard_recent" },
  ],
  "/admin/cases": [{ resource: "cases" }],
  "/admin/risk-cases": [{ resource: "cases" }],
  "/admin/referrals": [{ resource: "referrals" }],
  "/admin/schedule": [{ resource: "appointments" }],
  "/admin/members": [{ resource: "members" }],
  "/admin/users": [{ resource: "users" }],
  "/admin/roles": [{ resource: "roles" }],
  "/admin/organizations": [{ resource: "organizations" }],
  "/admin/forms": [{ resource: "forms" }],
  "/admin/clinics": [{ resource: "clinics" }],
  "/admin/help-center": [{ resource: "faqs" }],
  "/admin/banner": [{ resource: "banners" }],
  "/admin/school": [{ resource: "schools" }],
  "/admin/school/students": [{ resource: "students" }],
  "/admin/school/teachers": [{ resource: "teachers" }],
  "/admin/school/types": [
    { resource: "teacher_types" },
    { resource: "student_types" },
  ],
  "/admin/school/roles": [{ resource: "school_roles" }],
};
const rights = {
  dashboard: "dashboard.export",
  dashboard_recent: "dashboard.export",
  dashboard_stats: "dashboard.export",
  cases: "cases.export",
  case: "cases.export",
  responses: "cases.export",
  referrals: "cases.export",
  appointments: "appointments.export",
  members: "patient_members.export",
  member: "patient_members.export",
  forms: "forms.export",
  form: "forms.export",
  clinics: "clinics.export",
  faqs: "help_center.export",
  faq_categories: "help_center.export",
  banners: "content.export",
  master: "master_data.export",
};
export function ExportButton({
  sources,
  title = "ข้อมูล",
  localSheets,
  disabled = false,
}) {
  const { can, authorization, schoolAccess } = usePermissions();
  const [busy, setBusy] = useState(false),
    [include, setInclude] = useState(false),
    [error, setError] = useState("");
  const sys = authorization?.is_system_admin;
  const localResource = localSheets?.[0]?.resource;
  const allowed = localSheets
    ? Boolean(
        sys ||
        (localResource === "form_draft"
          ? can("forms.export")
          : schoolAccess?.can_export_students),
      )
    : sources?.every(
        (s) =>
          sys ||
          s.resource === "profile" ||
          ([
            "students",
            "student",
            "school_cases",
            "student_health",
            "student_insights",
          ].includes(s.resource)
            ? schoolAccess?.can_export_students
            : s.resource === "master" && schoolAccess?.can_manage_staff
              ? true
              : rights[s.resource]
                ? can(rights[s.resource])
                : (can("school.export") || schoolAccess?.can_export_students) &&
                  schoolAccess?.can_view_school),
      );
  const clinicalSources = [
    "student",
    "students",
    "school_cases",
    "case",
    "cases",
    "responses",
    "appointments",
    "referrals",
    "referral",
    "member",
    "members",
    "dashboard_stats",
    "chart",
  ];
  const deep = Boolean(
    sources?.some((s) => clinicalSources.includes(s.resource)) &&
    (sys ||
      schoolAccess?.can_view_health ||
      (!schoolAccess && can("clinical.view"))),
  );
  if (!allowed) return null;
  const run = async () => {
    setBusy(true);
    setError("");
    try {
      let sheets = localSheets;
      if (sheets)
        await api.post("/exports/local", {
          resource: localResource,
          count: sheets.reduce(
            (n, s) => n + (Array.isArray(s.data) ? s.data.length : 1),
            0,
          ),
        });
      if (!sheets) {
        const requested = [...sources];
        if (include) {
          for (const s of sources)
            if (s.resource === "student")
              requested.push(
                { resource: "student_health", id: s.id },
                { resource: "student_insights", id: s.id },
              );
        }
        const { data } = await api.post("/exports/data", {
          sources: requested,
          include_insights: include,
        });
        sheets = data.sheets;
      }
      if (
        !sheets?.some((s) =>
          Array.isArray(s.data)
            ? s.data.length
            : s.data && Object.keys(s.data).length,
        )
      ) {
        setError("ไม่มีข้อมูลตามตัวกรองที่เลือก");
        return;
      }
      await downloadWorkbook(sheets, title);
    } catch (e) {
      setError(e.response?.data?.message || "ส่งออกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="excel-export">
      {deep && !localSheets && (
        <label>
          <input
            type="checkbox"
            checked={include}
            onChange={(e) => setInclude(e.target.checked)}
            disabled={busy}
          />{" "}
          แนบข้อมูลเชิงลึก
        </label>
      )}
      <button
        type="button"
        className="sch-btn sch-btn-secondary"
        onClick={run}
        disabled={busy || disabled}
      >
        <FiDownload aria-hidden="true" />
        {busy ? "กำลังส่งออก…" : "Export Excel"}
      </button>
      {error && (
        <span className="sch-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
export function ExportToolbar() {
  const location = useLocation(),
    context = useContext(ExportContext),
    { activeOrganizationType } = usePermissions();
  const spec = Object.values(context?.entries || {})
    .sort((a, b) => (a.priority || 0) - (b.priority || 0))
    .at(-1);
  let sources = spec?.sources || defaults[location.pathname];
  if (
    !spec &&
    activeOrganizationType === "school" &&
    ["/admin/cases", "/admin/risk-cases"].includes(location.pathname)
  )
    sources = [
      {
        resource: "school_cases",
        filters: location.pathname.endsWith("risk-cases")
          ? { risk: "high" }
          : {},
      },
    ];
  if (!sources && !spec?.localSheets) return null;
  return (
    <div className="excel-export-toolbar">
      <ExportButton
        sources={sources}
        title={spec?.title || "ข้อมูล"}
        localSheets={spec?.localSheets}
        disabled={spec?.disabled}
      />
    </div>
  );
}

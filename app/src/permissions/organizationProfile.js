// What changes between organization types on the forms and dashboard
// pages: vocabulary, how forms are grouped, and which case counts lead the
// dashboard. Pure data so it can be unit tested without React.

export const HEALTH_DOMAINS = [
  { value: "mental", label: "สุขภาพจิต" },
  { value: "physical", label: "สุขภาพกาย" },
  { value: "general", label: "สุขภาพทั่วไป" },
  { value: "other", label: "ยังไม่ระบุด้านสุขภาพ" },
];

const KNOWN_DOMAINS = ["mental", "physical", "general"];

// A form health domain, with unset or unknown values as "other".
export const getFormDomain = (form) =>
  KNOWN_DOMAINS.includes(form?.health_domain) ? form.health_domain : "other";

const PROFILES = {
  hospital: {
    kind: "hospital",
    label: "โรงพยาบาล",
    icon: "hospital",
    personNoun: "ผู้รับบริการ",
    formGroupAxis: "clinic",
    formGroupLabel: "คลินิก",
    formsHint: "สร้าง แก้ไข และเผยแพร่แบบประเมินของแต่ละคลินิกบริการ",
  },
  school: {
    kind: "school",
    label: "โรงเรียน",
    icon: "school",
    personNoun: "นักเรียน",
    formGroupAxis: "health_domain",
    formGroupLabel: "ด้านสุขภาพ",
    formsHint:
      "สร้าง แก้ไข และเผยแพร่แบบคัดกรองสุขภาพจิตและสุขภาพกายของนักเรียน",
  },
  all: {
    kind: "all",
    label: "ทุกหน่วยงาน",
    icon: "all",
    personNoun: "ผู้รับบริการ",
    formGroupAxis: "organization",
    formGroupLabel: "หน่วยงาน",
    formsHint: "แบบประเมินของทุกหน่วยงาน แยกตามหน่วยงานเจ้าของ",
  },
};

// orgType is "hospital", "school", or null for the system-admin "all" scope.
export const getOrganizationProfile = (orgType) =>
  orgType == null ? PROFILES.all : PROFILES[orgType] || PROFILES.hospital;

const GENERAL_CLINIC = { slug: "general", name: "ทั่วไป" };

export const getClinicName = (slug, clinics = []) => {
  if (!slug || slug === "all") return "ทุกคลินิก";
  if (slug === GENERAL_CLINIC.slug) return GENERAL_CLINIC.name;
  return clinics.find((c) => c.slug === slug)?.name || null;
};

export const getHealthDomainLabel = (value) =>
  HEALTH_DOMAINS.find((d) => d.value === (value || "other"))?.label ||
  HEALTH_DOMAINS.at(-1).label;

// Groups forms along the profile's axis. Returns
// [{ key, label, forms, missing }] in a stable order; empty groups dropped.
export const groupForms = (forms = [], profile, clinics = []) => {
  const groups = new Map();
  const add = (key, label, form, extra = {}) => {
    if (!groups.has(key)) groups.set(key, { key, label, forms: [], ...extra });
    groups.get(key).forms.push(form);
  };

  if (profile.formGroupAxis === "health_domain") {
    forms.forEach((f) => {
      const value = getFormDomain(f);
      add(value, getHealthDomainLabel(value), f);
    });
    const order = HEALTH_DOMAINS.map((d) => d.value);
    return [...groups.values()].sort(
      (a, b) => order.indexOf(a.key) - order.indexOf(b.key),
    );
  }

  if (profile.formGroupAxis === "organization") {
    forms.forEach((f) =>
      add(
        String(f.organization_id || "none"),
        f.organization_name || "ยังไม่ระบุหน่วยงาน",
        f,
      ),
    );
    return [...groups.values()].sort((a, b) =>
      a.key === "none"
        ? 1
        : b.key === "none"
          ? -1
          : a.label.localeCompare(b.label, "th"),
    );
  }

  forms.forEach((f) => {
    const slug = f.clinic_type || GENERAL_CLINIC.slug;
    const name = getClinicName(slug, clinics);
    add(slug, name || slug, f, { missing: !name });
  });
  // Clinics in the organization's own order, general first, unknown last.
  const order = [GENERAL_CLINIC.slug, ...clinics.map((c) => c.slug)];
  const rank = (g) => (g.missing ? Infinity : order.indexOf(g.key));
  return [...groups.values()].sort((a, b) => rank(a) - rank(b));
};

// Dashboard counts per clinic. The first entries in `priority` are the
// people who need contact now (Risk first); `secondary` follows smaller.
const KPI = {
  highRisk: {
    key: "highRisk",
    label: "เคสเสี่ยงสูงที่ยังไม่ปิด",
    icon: "alert",
    tone: "danger",
  },
  waitingContact: {
    key: "waitingContact",
    label: "รอติดต่อกลับ",
    icon: "phone",
    tone: "warning",
  },
  newCases: {
    key: "newToday",
    label: "เคสใหม่",
    icon: "activity",
    tone: "info",
  },
  active: {
    key: "totalActive",
    label: "กำลังดูแล",
    icon: "users",
    tone: "neutral",
  },
  closed: {
    key: "closed",
    label: "ปิดเคสแล้ว",
    icon: "archive",
    tone: "neutral",
  },
  registered: {
    key: "registered",
    label: "ผู้ลงทะเบียนทั้งหมด",
    icon: "users",
    tone: "neutral",
  },
  forwardSafeClinic: {
    key: "forwardSafeClinic",
    label: "ส่งต่อ Safe Clinic",
    icon: "forward",
    tone: "info",
  },
  prepWithBlood: {
    key: "prepWithBlood",
    label: "รับยา PrEP (เจาะเลือดที่นี่)",
    icon: "plus",
    tone: "neutral",
  },
  prepWithoutBlood: {
    key: "prepWithoutBlood",
    label: "รับยา PrEP (มีผลเลือดมา)",
    icon: "shield",
    tone: "neutral",
  },
};

const KPI_PROFILES = {
  default: {
    priority: [KPI.highRisk, KPI.waitingContact],
    secondary: [KPI.newCases, KPI.active, KPI.closed],
  },
  behavior: {
    // The behavior clinic does not score risk; follow-up load leads.
    priority: [KPI.waitingContact],
    secondary: [KPI.newCases, KPI.registered, KPI.closed],
  },
  sti: {
    priority: [KPI.highRisk, KPI.waitingContact],
    secondary: [KPI.newCases, KPI.forwardSafeClinic, KPI.closed],
    extras: ["registration", "bloodTests", "prep"],
    prep: [KPI.prepWithBlood, KPI.prepWithoutBlood],
  },
};

export const getClinicKpiProfile = (clinicSlug) =>
  KPI_PROFILES[clinicSlug] || KPI_PROFILES.default;

export const readKpiValue = (stats = {}, key) => {
  if (key === "registered")
    return Number(stats.totalActive || 0) + Number(stats.closed || 0);
  return Number(stats[key] || 0);
};

// Picks the dashboard's starting clinic: the saved form's clinic if the
// organization still has it, else the first real clinic, else "all".
export const pickInitialClinic = (clinics = [], savedClinic) => {
  const slugs = [GENERAL_CLINIC.slug, ...clinics.map((c) => c.slug)];
  if (savedClinic && slugs.includes(savedClinic)) return savedClinic;
  return clinics[0]?.slug || "all";
};

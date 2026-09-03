export const PERMISSION_GROUPS = [
  { id: "dashboard", label: "แดชบอร์ด", actions: ["view"] },
  { id: "cases", label: "ข้อมูลเคสและเคสเสี่ยง", actions: ["view", "create", "update", "delete", "assign", "export"] },
  { id: "appointments", label: "ตารางนัดหมาย", actions: ["view", "create", "update", "delete"] },
  { id: "patient_members", label: "ผู้มารับบริการ", actions: ["view", "update", "delete"] },
  { id: "forms", label: "จัดการฟอร์ม", actions: ["view", "create", "update", "delete"] },
  { id: "clinics", label: "จัดการคลินิก", actions: ["view", "create", "update", "delete"] },
  { id: "help_center", label: "ศูนย์ช่วยเหลือ", actions: ["view", "create", "update", "delete"] },
  { id: "content", label: "จัดการภาพแบนเนอร์", actions: ["view", "create", "update", "delete"] },
];

export const MODULES = PERMISSION_GROUPS.map((group) => ({ id: group.id, label: group.label }));

const MODULE_ACTION = {
  Dashboard: "dashboard.view", "Case Management": "cases.view", Appointments: "appointments.view",
  "User Management": "patient_members.view", "Form Management": "forms.view",
  "Clinic Management": "clinics.view", "Help Center Management": "help_center.view", "Content Management": "content.view",
  "Roles & Permissions": "roles.manage",
  "จัดการผู้ใช้ (Users)": "patient_members.view", "จัดการผู้ใช้": "patient_members.view",
  "จัดการเคส": "cases.view", "ตารางนัดหมาย": "appointments.view", "จัดการฟอร์ม": "forms.view",
};

export function permissionMap(rows = []) {
  if (Array.isArray(rows) && rows.every((row) => typeof row === "string")) return new Set(rows);
  const set = new Set();
  rows.forEach((row) => {
    const base = MODULE_ACTION[row.module];
    if (!base) return;
    const [resource] = base.split(".");
    if (row.can_view || row.can_manage || row.can_full) set.add(`${resource}.view`);
    if (row.can_manage || row.can_full) ["create", "update", "delete", "assign", "export"].forEach((action) => set.add(`${resource}.${action}`));
  });
  return set;
}

export function canAccess(permissions, moduleOrPermission, level = "view", isSystemAdmin = false) {
  if (isSystemAdmin) return true;
  const manages = { "Case Management": "cases.update", Appointments: "appointments.update", "User Management": "patient_members.update", "Form Management": "forms.update", "Clinic Management": "clinics.update", "Help Center Management": "help_center.update", "Content Management": "content.update" };
  const key = moduleOrPermission.includes(".") ? moduleOrPermission : (level === "manage" ? (manages[moduleOrPermission] || MODULE_ACTION[moduleOrPermission]) : MODULE_ACTION[moduleOrPermission]);
  return Boolean(key && permissions?.has?.(key));
}

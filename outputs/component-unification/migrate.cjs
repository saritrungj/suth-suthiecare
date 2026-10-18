const fs = require("node:fs");
const path = require("node:path");
const {
  parse,
} = require("../../node_modules/.pnpm/@babel+parser@7.29.8/node_modules/@babel/parser");
const root = path.resolve(__dirname, "../..");
const ui = path.join(root, "app/src/components/ui/index.jsx");
const headers = new Set(
  "sch-header cw-header org-header sum-user-header srp-roles-header-section profile-header cm-header hc-header bm-header fm-content-header apt-header-wrapper content-header rc-header".split(
    " ",
  ),
);
const filters = new Set(
  "filter-bar scd-filter-bar sum-filter-bar sch-filter-bar dashboard-filters apt-filter-section hc-filter-panel fm-action-bar".split(
    " ",
  ),
);
const primary = new Set(
  "sch-btn sch-btn-primary cw-btn org-btn sum-add-btn srp-create-btn bm-add-btn cm-btn-add cm-btn-save hc-btn-add hc-btn-save fm-btn-add-form fm-btn-save sfb-btn-save sfb-btn-save-modal sfb-btn-primary scd-save-btn sum-member-save add-btn cdm-btn-confirm cdm-btn-confirm-sm cdm-btn-unified-save cdm-btn-save-tpl eem-export-btn preview-btn--primary".split(
    " ",
  ),
);
const secondary = new Set(
  "sch-btn-secondary cw-btn-secondary org-btn-secondary cm-btn-cancel hc-btn-cancel hc-btn-outline-custom fm-btn-cancel sfb-btn-back sfb-btn-cancel scd-cancel-btn cdm-btn-cancel cdm-btn-cancel-sm cdm-btn-outline eem-cancel-btn preview-btn--ghost".split(
    " ",
  ),
);
const danger = new Set(
  "sch-btn-danger sch-danger cm-btn-delete hc-btn-action-delete org-icon-btn--danger cdm-tpl-btn-delete".split(
    " ",
  ),
);
const ghosts = new Set("sch-btn-ghost cw-btn-ghost db-view-all-btn".split(" "));
const icons = new Set(
  "sch-icon-btn sch-page-btn cw-icon-btn org-icon-btn sum-page-btn page-btn cm-btn-edit hc-btn-action-edit cm-close-btn-custom hc-close-btn-custom scd-close-btn eem-close-btn cdm-close-btn fm-card-menu-btn".split(
    " ",
  ),
);
function walkFiles(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? walkFiles(path.join(dir, e.name))
        : /\.jsx?$/.test(e.name)
          ? [path.join(dir, e.name)]
          : [],
    );
}
const files = walkFiles(path.join(root, "app/src/pages/admin"));
for (const dir of ["case", "appointment"])
  files.push(...walkFiles(path.join(root, "app/src/components", dir)));
for (const name of [
  "AddAdminModal.jsx",
  "PatientMemberModal.jsx",
  "OrganizationRolePermissions.jsx",
  "OrganizationServiceSettings.jsx",
])
  files.push(path.join(root, "app/src/components", name));
const report = [];
for (const file of files) {
  let source = fs.readFileSync(file, "utf8");
  const ast = parse(source, { sourceType: "module", plugins: ["jsx"] });
  const edits = [],
    used = new Set(),
    counts = {};
  const inAdmin = file.includes(path.join("pages", "admin"));
  function visit(n) {
    if (!n || typeof n !== "object") return;
    if (
      n.type === "JSXElement" &&
      n.openingElement.name.type === "JSXIdentifier"
    ) {
      const o = n.openingElement,
        tag = o.name.name;
      const attr = o.attributes.find(
        (a) => a.type === "JSXAttribute" && a.name.name === "className",
      );
      const strings = [];
      function collect(v) {
        if (!v || typeof v !== "object") return;
        if (v.type === "StringLiteral") strings.push(v.value);
        if (v.type === "TemplateElement") strings.push(v.value.raw);
        for (const [k, c] of Object.entries(v))
          if (!["loc", "start", "end", "value"].includes(k))
            if (Array.isArray(c)) c.forEach(collect);
            else collect(c);
      }
      collect(attr?.value);
      const c = strings.join(" ").split(/\s+/),
        has = (set) => c.some((x) => set.has(x));
      let component,
        extra = "";
      if (tag === "button") {
        let variant = has(danger)
          ? "danger"
          : has(secondary)
            ? "secondary"
            : has(primary)
              ? "primary"
              : has(ghosts)
                ? "ghost"
                : has(icons)
                  ? "secondary"
                  : null;
        if (variant) {
          component = "Button";
          extra = ` variant="${variant}"`;
          if (has(icons)) extra += ' size="icon"';
          // A legacy native button without type submits an ancestor form.
          if (
            !o.attributes.some(
              (a) => a.type === "JSXAttribute" && a.name.name === "type",
            ) &&
            !o.attributes.some((a) => a.type === "JSXSpreadAttribute")
          )
            extra += ' type="submit"';
        }
      } else if (inAdmin && ["header", "div"].includes(tag) && has(headers))
        component = "PageHeader";
      else if (inAdmin && ["div", "section"].includes(tag) && has(filters))
        component = "FilterBar";
      else if (tag === "table") component = "DataTable";
      else if (inAdmin && tag === "textarea") component = "TextArea";
      else if (inAdmin && tag === "input") {
        const type = o.attributes.find(
          (a) => a.type === "JSXAttribute" && a.name.name === "type",
        );
        if (
          !type ||
          (type.value?.type === "StringLiteral" &&
            [
              "text",
              "email",
              "password",
              "search",
              "number",
              "tel",
              "url",
            ].includes(type.value.value))
        )
          component = "TextInput";
      }
      if (component) {
        const alias = `Ui${component}`;
        used.add(component);
        counts[component] = (counts[component] || 0) + 1;
        edits.push({
          start: o.name.start,
          end: o.name.end,
          text: alias + extra,
        });
        if (n.closingElement)
          edits.push({
            start: n.closingElement.name.start,
            end: n.closingElement.name.end,
            text: alias,
          });
      }
    }
    for (const [k, v] of Object.entries(n))
      if (!["loc", "start", "end", "tokens", "comments"].includes(k)) {
        if (Array.isArray(v)) v.forEach(visit);
        else if (v && typeof v === "object") visit(v);
      }
  }
  visit(ast);
  if (!used.size) continue;
  const relative = path.relative(root, file);
  const backup = path.join(__dirname, "before", relative);
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  if (!fs.existsSync(backup)) fs.writeFileSync(backup, source);
  edits
    .sort((a, b) => b.start - a.start)
    .forEach((e) => {
      source = source.slice(0, e.start) + e.text + source.slice(e.end);
    });
  let specifier = path.relative(path.dirname(file), ui).replaceAll("\\", "/");
  if (!specifier.startsWith(".")) specifier = "./" + specifier;
  source =
    `import { ${[...used].map((c) => `${c} as Ui${c}`).join(", ")} } from '${specifier}';\n` +
    source;
  fs.writeFileSync(file, source);
  report.push({ file: relative, counts });
}
fs.writeFileSync(
  path.join(__dirname, "migration.json"),
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify({
    files: report.length,
    components: report.reduce((total, r) => {
      for (const [k, v] of Object.entries(r.counts))
        total[k] = (total[k] || 0) + v;
      return total;
    }, {}),
  }),
);

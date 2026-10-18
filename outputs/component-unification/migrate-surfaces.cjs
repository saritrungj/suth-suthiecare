const fs = require("node:fs"),
  path = require("node:path");
const {
  parse,
} = require("../../node_modules/.pnpm/@babel+parser@7.29.8/node_modules/@babel/parser");
const root = path.resolve(__dirname, "../..");
const classes = {
  Surface: new Set(
    "sch-card org-card srp-card profile-card sum-table-card cm-table-container hc-table-container bm-table-card cw-surface".split(
      " ",
    ),
  ),
  SelectionGroup: new Set(
    "sch-management-nav sum-user-tabs apt-view-toggle cw-mode ref-directions".split(
      " ",
    ),
  ),
  Badge: new Set("sch-badge hc-status-badge cm-status".split(" ")),
};
function files(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? files(path.join(dir, e.name))
        : /\.jsx?$/.test(e.name)
          ? [path.join(dir, e.name)]
          : [],
    );
}
const report = [];
for (const file of files(path.join(root, "app/src/pages/admin"))) {
  let source = fs.readFileSync(file, "utf8");
  const ast = parse(source, { sourceType: "module", plugins: ["jsx"] }),
    edits = [],
    used = new Set(),
    counts = {};
  function visit(n) {
    if (!n || typeof n !== "object") return;
    if (
      n.type === "JSXElement" &&
      n.openingElement.name.type === "JSXIdentifier"
    ) {
      const o = n.openingElement,
        tag = o.name.name,
        a = o.attributes.find((a) => a.name?.name === "className");
      let strings = [];
      function collect(n) {
        if (!n || typeof n !== "object") return;
        if (n.type === "StringLiteral") strings.push(n.value);
        if (n.type === "TemplateElement") strings.push(n.value.raw);
        for (const [k, v] of Object.entries(n))
          if (!["loc", "value"].includes(k)) {
            if (Array.isArray(v)) v.forEach(collect);
            else collect(v);
          }
      }
      collect(a?.value);
      const c = strings.join(" ").split(/\s+/);
      let component;
      if (
        ["section", "div", "aside", "article"].includes(tag) &&
        c.some((c) => classes.Surface.has(c))
      )
        component = "Surface";
      if (
        ["nav", "div"].includes(tag) &&
        c.some((c) => classes.SelectionGroup.has(c))
      )
        component = "SelectionGroup";
      if (tag === "span" && c.some((c) => classes.Badge.has(c)))
        component = "Badge";
      if (component) {
        used.add(component);
        counts[component] = (counts[component] || 0) + 1;
        const alias = "Ui" + component;
        edits.push({
          start: o.name.start,
          end: o.name.end,
          text: alias + (component === "Badge" ? "" : ` as="${tag}"`),
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
      if (!["loc", "comments"].includes(k)) {
        if (Array.isArray(v)) v.forEach(visit);
        else if (v && typeof v === "object") visit(v);
      }
  }
  visit(ast);
  if (!used.size) continue;
  const relative = path.relative(root, file),
    backup = path.join(__dirname, "before", relative);
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  if (!fs.existsSync(backup)) fs.writeFileSync(backup, source);
  edits
    .sort((a, b) => b.start - a.start)
    .forEach(
      (e) => (source = source.slice(0, e.start) + e.text + source.slice(e.end)),
    );
  let imp = path
    .relative(
      path.dirname(file),
      path.join(root, "app/src/components/ui/index.jsx"),
    )
    .replaceAll("\\", "/");
  if (!imp.startsWith(".")) imp = "./" + imp;
  fs.writeFileSync(
    file,
    `import { ${[...used].map((c) => `${c} as Ui${c}`).join(", ")} } from '${imp}';\n` +
      source,
  );
  report.push({ file: relative, counts });
}
fs.writeFileSync(
  path.join(__dirname, "surfaces.json"),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report));

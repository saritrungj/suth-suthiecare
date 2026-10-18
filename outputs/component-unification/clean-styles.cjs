const fs = require("node:fs"),
  path = require("node:path");
const postcss = require("../../node_modules/.pnpm/postcss@8.5.26/node_modules/postcss");
const root = path.resolve(__dirname, "../..");
const targets = new Set(
  "cm-header hc-header fm-content-header bm-header cm-header-info hc-header-info fm-header-info cm-header-hint hc-header-hint fm-header-hint cm-btn-add cm-btn-save cm-btn-cancel cm-btn-edit cm-btn-delete hc-btn-add hc-btn-save hc-btn-cancel hc-btn-outline-custom hc-btn-action-edit hc-btn-action-delete fm-btn-add-form fm-btn-save fm-btn-cancel bm-add-btn sum-add-btn srp-create-btn cm-table-container hc-table-container bm-table-card profile-card srp-card".split(
    " ",
  ),
);
const properties = new Set(
  "background background-color background-image border border-color border-left border-bottom border-radius box-shadow transform font font-family font-size font-weight line-height letter-spacing padding".split(
    " ",
  ),
);
function files(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? files(path.join(dir, e.name))
        : /\.css$/.test(e.name)
          ? [path.join(dir, e.name)]
          : [],
    );
}
const report = [];
for (const file of files(path.join(root, "app/src/pages/admin"))) {
  const source = fs.readFileSync(file, "utf8"),
    css = postcss.parse(source);
  let removed = 0;
  css.walkRules((rule) => {
    const selectors = rule.selector.split(",").map((s) => s.trim());
    if (
      !selectors.every((s) => {
        const m = s.match(
          /^\.([\w-]+)(?::[\w-]+(?:\([^)]*\))?)?(?:\s+(?:h1|h2|p))?$/,
        );
        return m && targets.has(m[1]);
      })
    )
      return;
    rule.walkDecls((d) => {
      if (properties.has(d.prop)) {
        d.remove();
        removed++;
      }
    });
    if (!rule.nodes.length) rule.remove();
  });
  // Font family is one shared token even on elements that have not yet moved
  // into a primitive. All admin font declarations currently name Thai UI fonts.
  css.walkDecls("font-family", (d) => {
    if (/Sarabun|Noto Sans Thai/.test(d.value)) d.value = "var(--suth-font)";
  });
  const out = css.toString();
  if (out === source) continue;
  const rel = path.relative(root, file),
    backup = path.join(__dirname, "before", rel);
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  if (!fs.existsSync(backup)) fs.writeFileSync(backup, source);
  fs.writeFileSync(file, out);
  report.push({ file: rel, removed });
}
fs.writeFileSync(
  path.join(__dirname, "style-cleanup.json"),
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify({
    files: report.length,
    removed: report.reduce((s, r) => s + r.removed, 0),
  }),
);

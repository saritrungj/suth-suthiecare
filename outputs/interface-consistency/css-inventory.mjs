import { readFile, readdir, writeFile } from "node:fs/promises";
import postcss from "../../node_modules/.pnpm/node_modules/postcss/lib/postcss.js";
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory()
          ? files(`${dir}/${e.name}`)
          : e.name.endsWith(".css")
            ? [`${dir}/${e.name}`]
            : [],
      ),
    )
  ).flat();
}
const findings = [];
for (const path of await files("app/src")) {
  const root = postcss.parse(await readFile(path, "utf8"));
  root.walkRules((rule) => {
    if (rule.parent.type === "atrule" && /keyframes$/.test(rule.parent.name))
      return;
    const selectors = rule.selectors.filter((s) =>
      /^(?:body\b|html\b|label\b|input\b|button\b|select\b|textarea\b|table\b|tr\b|td\b|th\b|\.(?:modal-overlay|modal-header|modal-body|modal-footer|modal-actions|modal-content|close-btn|form-row|form-actions|form-body|filter-bar|table-box|main-content|case-table|page-btn|btn-add|btn-confirm|btn-cancel|risk-group)(?![\w-]))/.test(
        s,
      ),
    );
    if (selectors.length)
      findings.push({ path, line: rule.source.start.line, selectors });
  });
}
await writeFile(
  "outputs/interface-consistency/css-inventory.json",
  JSON.stringify(findings, null, 2),
);
const counts = Object.entries(Object.groupBy(findings, (f) => f.path)).map(
  ([path, items]) => ({ path, count: items.length }),
);
console.log(JSON.stringify(counts, null, 2));

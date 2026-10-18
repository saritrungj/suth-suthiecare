// Builds the user-guide PDFs that the back office offers under
// "คู่มือการใช้งาน" from the slide sources in docs/user-guides.
//
//   node scripts/build-user-guides.mjs
//
// Each docs/user-guides/<guide>/ holds deck.json (title and slide order),
// slides/<id>.html (one 1920x1080 <section> per slide, inline styles) and
// images/. The PDFs are written to server/private/docs/guide_<guide>.pdf.
// Set CHROMIUM_PATH to use a specific Chromium build.
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as Fi from "react-icons/fi";
import { chromium } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sources = path.join(root, "docs/user-guides");
const output = path.join(root, "server/private/docs");
const GUIDES = ["user", "central", "hospital", "school"];

// Slide icons are the Slides format's <x-icon>; draw them with Feather.
const ICONS = {
  Activity: Fi.FiActivity,
  Book: Fi.FiBook,
  Chart: Fi.FiBarChart2,
  CheckCircle: Fi.FiCheckCircle,
  Clock: Fi.FiClock,
  Database: Fi.FiDatabase,
  Home: Fi.FiHome,
  Key: Fi.FiKey,
  Lock: Fi.FiLock,
  Search: Fi.FiSearch,
  Settings: Fi.FiSettings,
  Star: Fi.FiStar,
  Trust: Fi.FiShield,
  Users: Fi.FiUsers,
  Warning: Fi.FiAlertTriangle,
};

function icons(html) {
  return html.replace(
    /<x-icon name="([A-Za-z]+)"([^>]*)><\/x-icon>/g,
    (match, name, attrs) => {
      const Icon = ICONS[name];
      if (!Icon) throw new Error(`No icon for <x-icon name="${name}">`);
      const style = attrs.match(/style="([^"]*)"/)?.[1] || "";
      const svg = renderToStaticMarkup(
        createElement(Icon, { "aria-hidden": "true" }),
      );
      return svg.replace(
        "<svg ",
        `<svg style="${style};display:block;flex-shrink:0" `,
      );
    },
  );
}

async function page(guide) {
  const dir = path.join(sources, guide);
  const deck = JSON.parse(await readFile(path.join(dir, "deck.json"), "utf8"));
  const slides = [];
  for (const id of deck.order) {
    const html = await readFile(path.join(dir, "slides", `${id}.html`), "utf8");
    // Speaker notes stay out of the printed guide.
    slides.push(icons(html.replace(/<aside>[\s\S]*?<\/aside>/, "")));
  }
  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<title>${deck.title}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anuphan:wght@400;500;600;700&display=swap">
<style>
  @page { size: 1920px 1080px; margin: 0; }
  * { box-sizing: border-box; margin: 0; }
  html, body { padding: 0; }
  section {
    position: relative;
    width: 1920px;
    height: 1080px;
    overflow: hidden;
    break-after: page;
  }
  ul, ol { padding-left: 1.2em; }
</style>
</head>
<body>
${slides.join("\n")}
</body>
</html>`;
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
try {
  const tab = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  for (const guide of GUIDES) {
    // Opened from a file beside the slides so their images/ paths resolve.
    const html = path.join(sources, guide, ".print.html");
    await writeFile(html, await page(guide));
    await tab.goto(pathToFileURL(html).href, { waitUntil: "networkidle" });
    await rm(html);
    await tab.evaluate(() => document.fonts.ready);
    const file = path.join(output, `guide_${guide}.pdf`);
    await tab.pdf({
      path: file,
      width: "1920px",
      height: "1080px",
      printBackground: true,
    });
    console.log(`wrote ${path.relative(root, file)}`);
  }
} finally {
  await browser.close();
}

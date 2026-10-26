"""Build the school deck as one self-contained HTML file.

Reads project/deck.json and project/slides/*.html, swaps the artifact-only
pieces (/_blob/ images, <x-icon>, <x-shape>) for inline equivalents, embeds
the screenshots and the Anuphan font as data URIs, and writes
suthiecare-school.html next to this script. The result opens offline in any
browser: arrows / space to move, F for full screen, N for speaker notes,
Ctrl+P prints one slide per page.

    python docs/presentations/school/build_single_html.py
"""

import base64
import html
import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "suthiecare-school.html"

# Artifact asset ids -> local screenshots in images/.
BLOBS = {
    "8075061bdf38b021c3b0af37ddf7a667": "p-dashboard.webp",
    "0a564900cb8ef2dd349397f4cd5782ef": "p-import.webp",
    "7a2962ad803f8938ddcf7eec32165bd7": "p-risk.webp",
    "55a6f87ca062077ac7a71507fd0aecfe": "p-rounds.webp",
    "d89eb8d9c7d74e2249fe9790022db687": "p-rescreen.webp",
    "74184ae3b0ccea401d4415eea06e5515": "p-cases.webp",
    "7e71224e25cc45af1015cb839e3fdc96": "p-alerts.webp",
    "be8140edbd3942df83f3f96b7baa4478": "p-behavior.webp",
    "9ee40b0115f13c5a7184afdf23008a1a": "p-follow-ups.webp",
    "d59f4ac05529a080d2186ca194c117fb": "p-appointments.webp",
    "509c1e51b5118172f6cdfc09b8309d34": "p-documents.webp",
    "63337761637a82d4f5d770673fadc403": "p-reports.webp",
    "1a99787c3b491fd3d5ff2cf19226190f": "p-phone-form.webp",
    "cbf9f9ad346120cfa3046185c1564ef7": "p-phone-result.webp",
    "a56e8d180cfba512de2d6a87ae931a4d": "p-phone-tasks.webp",
    "605f844c33bf4b640d1ece990da013e0": "p-phone-counsel.webp",
}

# 24px stroke icons (Lucide-style) for the names the slides use.
ICONS = {
    "CheckCircle": '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    "GraduationCap": '<path d="M21.42 10.92a1 1 0 0 0-.02-1.84L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.83l8.57 3.91a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
    "Lightning": '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
    "Lock": '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    "Search": '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    "Trust": '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    "Users": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    "Verified": '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76z"/><path d="m9 12 2 2 4-4"/>',
}

SHAPES = {
    "arrow-right": "clip-path:polygon(0 32%,58% 32%,58% 0,100% 50%,58% 100%,58% 68%,0 68%)",
}

FONT_CSS = "https://fonts.googleapis.com/css2?family=Anuphan:wght@400;500;600;700&display=swap"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"


def data_uri(path, mime):
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def embedded_font_css():
    """Inline the Anuphan woff2 files; fall back to the stylesheet link offline."""
    try:
        req = urllib.request.Request(FONT_CSS, headers={"User-Agent": UA})
        css = urllib.request.urlopen(req, timeout=20).read().decode("utf-8")

        def inline(match):
            url = match.group(1)
            if not url.startswith("https://fonts.gstatic.com/"):
                raise ValueError(f"unexpected font host: {url}")
            body = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=20).read()
            return "url(data:font/woff2;base64," + base64.b64encode(body).decode("ascii") + ")"

        return "<style>" + re.sub(r"url\((https://[^)]+)\)", inline, css) + "</style>", True
    except Exception as err:  # keep building; the font then loads online
        print(f"font not embedded ({err}); using the Google Fonts link", file=sys.stderr)
        return f'<link rel="stylesheet" href="{FONT_CSS}">', False


def convert(slide):
    def blob(match):
        name = BLOBS.get(match.group(1))
        if not name:
            raise SystemExit(f"unknown image asset {match.group(1)}")
        return data_uri(ROOT / "images" / name, "image/webp")

    slide = re.sub(r"/_blob/([0-9a-f]{32})", blob, slide)
    slide = re.sub(
        r'src="images/([\w-]+\.webp)"',
        lambda m: f'src="{data_uri(ROOT / "images" / m.group(1), "image/webp")}"',
        slide,
    )

    def icon(match):
        name, style = match.group(1), match.group(2)
        if name not in ICONS:
            raise SystemExit(f"no icon for {name}")
        style = " ".join(style.split())
        return (
            f'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
            f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" '
            f'style="flex-shrink:0;{style}">{ICONS[name]}</svg>'
        )

    slide = re.sub(r'<x-icon\s+name="([A-Za-z]+)"\s+style="([^"]*)"\s*>\s*</x-icon>', icon, slide)

    def shape(match):
        kind, style = match.group(1), " ".join(match.group(2).split())
        if kind not in SHAPES:
            raise SystemExit(f"no shape for {kind}")
        return f'<div aria-hidden="true" style="flex-shrink:0;{style};{SHAPES[kind]}"></div>'

    slide = re.sub(r'<x-shape\s+kind="([a-z-]+)"\s+style="([^"]*)"\s*>\s*</x-shape>', shape, slide)
    if "<x-" in slide:
        raise SystemExit("unconverted custom element left in a slide")
    return slide


TEMPLATE = """<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>$TITLE</title>
$FONT
<style>
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;height:100%;background:#1f2f3f;overflow:hidden}
body{font-family:'Anuphan',Tahoma,sans-serif;-webkit-font-smoothing:antialiased}
#viewport{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}
#stage{position:relative;width:1920px;height:1080px;flex-shrink:0;transform-origin:center center;box-shadow:0 20px 60px rgba(0,0,0,.35)}
#stage>section{position:absolute;inset:0;width:1920px;height:1080px;overflow:hidden;visibility:hidden}
#stage>section.active{visibility:visible}
section h1,section h2,section h3,section p{margin:0}
section img{display:block}
section aside{display:none}
section table{border-collapse:separate;border-spacing:0;border-radius:20px;overflow:hidden;border:1px solid #f3dcc8}
section th,section td{padding:22px 32px;vertical-align:top;line-height:1.4}
section th{font-weight:700}
section tr+tr td{border-top:1px solid #f3dcc8}
#bar{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);display:flex;align-items:center;gap:6px;padding:6px;border-radius:999px;background:rgba(31,47,63,.82);color:#fff;font:500 15px 'Anuphan',Tahoma,sans-serif;opacity:0;transition:opacity .25s;z-index:5}
body:hover #bar,#bar:focus-within{opacity:1}
#bar button{border:0;background:transparent;color:inherit;font:inherit;padding:8px 14px;border-radius:999px;cursor:pointer}
#bar button:hover,#bar button:focus-visible{background:rgba(255,255,255,.16);outline:none}
#count{min-width:64px;text-align:center}
#notes{position:fixed;left:16px;right:16px;bottom:72px;max-width:900px;margin:0 auto;padding:18px 22px;border-radius:16px;background:#fff;color:#1f2f3f;font:400 18px/1.6 'Anuphan',Tahoma,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.3);display:none;z-index:6}
#notes.show{display:block}
#notes b{display:block;color:#c2410c;font-size:14px;margin-bottom:4px}
@media print{
  @page{size:1920px 1080px;margin:0}
  html,body{height:auto;overflow:visible;background:#fff}
  #viewport{position:static;display:block}
  #stage{transform:none!important;width:auto;height:auto;box-shadow:none}
  #stage>section{position:relative;visibility:visible;break-after:page;page-break-after:always}
  #bar,#notes{display:none!important}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
</style>
</head>
<body>
<div id="viewport"><div id="stage">
$SLIDES
</div></div>
<div id="notes" role="note"><b>บันทึกผู้นำเสนอ</b><span></span></div>
<nav id="bar" aria-label="ควบคุมสไลด์">
<button type="button" id="prev" aria-label="สไลด์ก่อนหน้า">&#8592;</button>
<span id="count" aria-live="polite"></span>
<button type="button" id="next" aria-label="สไลด์ถัดไป">&#8594;</button>
<button type="button" id="toggleNotes">โน้ต (N)</button>
<button type="button" id="full">เต็มจอ (F)</button>
</nav>
<script>
(function () {
  var stage = document.getElementById("stage");
  var slides = Array.prototype.slice.call(stage.children);
  var notes = document.getElementById("notes");
  var count = document.getElementById("count");
  var index = 0;

  function fit() {
    var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.transform = "scale(" + s + ")";
  }

  function show(i) {
    index = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach(function (el, n) { el.classList.toggle("active", n === index); });
    count.textContent = (index + 1) + " / " + slides.length;
    var aside = slides[index].querySelector("aside");
    notes.querySelector("span").textContent = aside ? aside.textContent : "";
    if (location.hash !== "#" + (index + 1)) history.replaceState(null, "", "#" + (index + 1));
  }

  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(function () {});
  }

  document.addEventListener("keydown", function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key;
    if (k === "ArrowRight" || k === "ArrowDown" || k === "PageDown" || k === " " || k === "Enter") { e.preventDefault(); show(index + 1); }
    else if (k === "ArrowLeft" || k === "ArrowUp" || k === "PageUp" || k === "Backspace") { e.preventDefault(); show(index - 1); }
    else if (k === "Home") show(0);
    else if (k === "End") show(slides.length - 1);
    else if (k === "f" || k === "F") toggleFull();
    else if (k === "n" || k === "N") notes.classList.toggle("show");
  });

  document.getElementById("viewport").addEventListener("click", function (e) {
    show(e.clientX < window.innerWidth / 3 ? index - 1 : index + 1);
  });
  document.getElementById("prev").addEventListener("click", function () { show(index - 1); });
  document.getElementById("next").addEventListener("click", function () { show(index + 1); });
  document.getElementById("toggleNotes").addEventListener("click", function () { notes.classList.toggle("show"); });
  document.getElementById("full").addEventListener("click", toggleFull);

  var startX = null;
  document.addEventListener("touchstart", function (e) { startX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener("touchend", function (e) {
    if (startX === null) return;
    var dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 50) show(dx < 0 ? index + 1 : index - 1);
    startX = null;
  });

  window.addEventListener("hashchange", function () {
    var n = (parseInt(location.hash.slice(1), 10) || 1) - 1;
    if (n !== index) show(n);
  });
  window.addEventListener("resize", fit);
  fit();
  show((parseInt(location.hash.slice(1), 10) || 1) - 1);
})();
</script>
</body>
</html>
"""


def main():
    deck = json.loads((ROOT / "project" / "deck.json").read_text(encoding="utf-8"))
    slides = [convert((ROOT / "project" / "slides" / f"{sid}.html").read_text(encoding="utf-8")) for sid in deck["order"]]
    font, embedded = embedded_font_css()
    page = (
        TEMPLATE.replace("$TITLE", html.escape(deck["title"]))
        .replace("$FONT", font)
        .replace("$SLIDES", "\n".join(slides))
    )
    OUT.write_text(page, encoding="utf-8", newline="\n")
    size = OUT.stat().st_size / 1024 / 1024
    print(f"wrote {OUT.name}: {len(slides)} slides, {size:.1f} MB, font {'embedded' if embedded else 'linked'}")


if __name__ == "__main__":
    main()

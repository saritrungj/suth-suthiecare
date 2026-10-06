# Extract FAQ-related tables (clinics, faq_categories, faqs) from a SUTHieCare Navicat dump.
import re, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
dump = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE.parent.parent / "suthiecare_db_production_29092569.sql"
TABLES = ("clinics", "faq_categories", "faqs")
IMG = re.compile(r'<img[^>]*?data:image/\w+;base64,[A-Za-z0-9+/=]+[^>]*>')
B64 = re.compile(r"'data:image/[^']*'")

blocks, cur = {t: [] for t in TABLES}, None
for line in open(dump, encoding="utf-8"):
    m = re.match(r"-- Table structure for (\w+)", line)
    if m:
        cur = m.group(1) if m.group(1) in TABLES else None
    if cur:
        blocks[cur].append(line)

head = (f"-- SUTHieCare FAQ export from {dump.name}\n"
        "-- Tables: clinics (logo/bg images set to NULL), faq_categories, faqs\n"
        "SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS = 0;\n\n-- ----------------------------\n")
tail = "SET FOREIGN_KEY_CHECKS = 1;\n"

def body(lite):
    out = []
    for t in TABLES:
        for line in blocks[t]:
            if line.startswith("INSERT INTO `clinics`"):
                line = B64.sub("NULL", line)
            elif lite and line.startswith("INSERT INTO `faqs`"):
                line = IMG.sub("[รูปภาพ]", line)
            out.append(line)
    return "".join(out)

(HERE / "suthiecare_faq_full.sql").write_text(head + body(False) + tail, encoding="utf-8")
(HERE / "suthiecare_faq_lite.sql").write_text(head.replace("faqs\n", "faqs (inline base64 images replaced by [รูปภาพ])\n") + body(True) + tail, encoding="utf-8")

# -*- coding: utf-8 -*-
"""Build SUTH Operator knowledge documents from the SUTHieCare FAQ tables.

Usage:  python build_kb.py [path/to/suthiecare_dump.sql]
Output: suthiecare-faq-kb.json  (array of {title, content, keywords, categoryId, metadata}
                                 matching POST /api/knowledge in suth-operator-rag-service)
        suthiecare-faq-kb.md    (human-review copy of the same documents)
"""
import html
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_DUMP = HERE.parent.parent / "suthiecare_db_production_29092569.sql"
SOURCE_DATE = "2026-09-29"
KEYWORD_LIMIT = 191  # knowledge_documents.keywords is varchar(191)

# faqs.clinic_id -> label used in the knowledge base.
# NOTE: STI FAQs are stored with clinic_id=2 (slug "behavior" / คลินิก LSM) in production,
# but every one of them is about sexually transmitted infections, so they are labelled STI here.
CLINIC_LABEL = {
    "1": ("teenager", "คลินิกวัยรุ่น (สุขภาพจิต)"),
    "2": ("sti", "คลินิกวัยรุ่น (โรคติดต่อทางเพศสัมพันธ์)"),
    "4": ("general", "หน่วยบริการปฐมภูมิ PCU SUTH"),
}

# Source-text fixes (Thai PDF copy artefacts and missing words).
TYPO_FIXES = [
    ("ผู้เชี่ยวชำญ", "ผู้เชี่ยวชาญ"),
    ("ปรึกษำ", "ปรึกษา"),
    ("รับประทำน", "รับประทาน"),
    ("หายใจช้ำ ๆ", "หายใจช้า ๆ"),
    ("หาากไม่", "หากไม่"),
    ("การผู้เชี่ยวชาญด้านสุขภาพจิตน่ากลัวไหม", "การพบผู้เชี่ยวชาญด้านสุขภาพจิตน่ากลัวไหม"),
    ("รักษาได้ผู้ป่วย", "รักษาได้ ผู้ป่วย"),
    ("มีโอกาสโรคติดต่อ", "มีโอกาสติดโรคติดต่อ"),
    ("ไม่ได้รับการรักษา อาจส่งผลกระทบได้", "หากไม่ได้รับการรักษา อาจส่งผลกระทบได้"),
    ("บริการเสาร์-อาทิตย์ วันหยุดนักขัตฤกษ์ของ PCU", "บริการวันเสาร์-อาทิตย์ และวันหยุดนักขัตฤกษ์ของ PCU SUTH"),
]

# Term -> keywords. A FAQ gets the keywords of every term found in its question/answer.
TERM_KEYWORDS = [
    ("ซึมเศร้า", "โรคซึมเศร้า, depression"),
    ("2Q", "2Q, 9Q, แบบประเมินซึมเศร้า"),
    ("วิตกกังวล", "โรควิตกกังวล, anxiety"),
    ("แพนิค", "แพนิค, panic"),
    ("ใจสั่น", "ใจสั่น"),
    ("นอนไม่หลับ", "นอนไม่หลับ"),
    ("Burnout", "หมดไฟ, burnout"),
    ("หมดไฟ", "หมดไฟ"),
    ("เครียด", "ความเครียด, เครียด"),
    ("สอบตก", "สอบตก, เครียดเรื่องเรียน"),
    ("ผลการเรียน", "เครียดเรื่องเรียน"),
    ("สาขา", "เลือกสาขา"),
    ("หางาน", "อนาคต, หางาน"),
    ("เหงา", "เหงา, ปรับตัว"),
    ("เลิกรา", "อกหัก, เลิกกับแฟน"),
    ("อกหัก", "อกหัก"),
    ("แฟนเก่า", "แฟนเก่า, อกหัก"),
    ("Toxic", "toxic relationship, ความสัมพันธ์"),
    ("ความสัมพันธ์", "ความสัมพันธ์"),
    ("คาเฟอีน", "กาแฟ, คาเฟอีน"),
    ("ร้องไห้", "ร้องไห้"),
    ("ทำร้ายตนเอง", "ทำร้ายตัวเอง"),
    ("1323", "สายด่วนสุขภาพจิต, 1323"),
    ("1669", "ฉุกเฉิน, 1669"),
    ("เพื่อน", "ช่วยเพื่อน"),
    ("คนใกล้ชิด", "ช่วยคนใกล้ชิด"),
    ("HIV", "HIV, เอชไอวี"),
    ("PrEP", "PrEP, เพร็พ"),
    ("PEP", "PEP, เป๊ป, ยาต้านฉุกเฉิน"),
    ("ถุงยาง", "ถุงยางอนามัย, condom"),
    ("ซิฟิลิส", "ซิฟิลิส, syphilis"),
    ("หนองในเทียม", "หนองในเทียม, chlamydia"),
    ("หนองใน", "หนองใน, gonorrhea"),
    ("เริม", "เริม, herpes"),
    ("HPV", "HPV, วัคซีน HPV, หูดหงอนไก่"),
    ("ตับอักเสบบี", "ไวรัสตับอักเสบบี"),
    ("ออรัล", "ออรัลเซ็กส์, oral sex"),
    ("Sex Toy", "sex toy"),
    ("ตกขาว", "ตกขาว"),
    ("ปัสสาวะแสบ", "ปัสสาวะแสบ"),
    ("ยาคุมฉุกเฉิน", "ยาคุมฉุกเฉิน"),
    ("ยาคุมกำเนิด", "ยาคุมกำเนิด"),
    ("ประจำเดือน", "ประจำเดือน"),
    ("แอลกอฮอล์", "แอลกอฮอล์, สารเสพติด"),
    ("Window Period", "window period, ระยะฟักตัว"),
    ("ผู้หญิงกับผู้หญิง", "หญิงรักหญิง, LGBTQ"),
    ("คู่นอน", "คู่นอน"),
    ("ตรวจ", "ตรวจคัดกรอง"),
    ("ติดซ้ำ", "ติดซ้ำ"),
    ("หายขาด", "รักษาหาย"),
    ("น่าอาย", "อาย, ความลับ"),
]

CLINIC_KEYWORDS = {
    "1": "สุขภาพจิต, คลินิกวัยรุ่น",
    "2": "โรคติดต่อทางเพศสัมพันธ์, STI, STD, เพศสัมพันธ์",
    "4": "PCU SUTH, หน่วยบริการปฐมภูมิ",
}


def parse_values(s):
    out, i, n = [], 0, len(s)
    while i < n:
        c = s[i]
        if c in " ,":
            i += 1
            continue
        if c == "'":
            i += 1
            buf = []
            while i < n:
                ch = s[i]
                if ch == chr(92):
                    nx = s[i + 1]
                    buf.append({"n": "\n", "r": "\r", "t": "\t", "0": "\0"}.get(nx, nx))
                    i += 2
                    continue
                if ch == "'":
                    if i + 1 < n and s[i + 1] == "'":
                        buf.append("'")
                        i += 2
                        continue
                    i += 1
                    break
                buf.append(ch)
                i += 1
            out.append("".join(buf))
        else:
            j = i
            while j < n and s[j] != ",":
                j += 1
            v = s[i:j].strip()
            out.append(None if v == "NULL" else v)
            i = j
    return out


def html_to_text(h):
    h = re.sub(r"<img[^>]*>", "", h, flags=re.I)
    h = re.sub(r"<br\s*/?>", "\n", h, flags=re.I)
    h = re.sub(r"</(p|li|h\d|div|tr)>", "\n", h, flags=re.I)
    h = re.sub(r"<li[^>]*>", "- ", h, flags=re.I)
    h = re.sub(r"<[^>]+>", "", h)
    h = html.unescape(h).replace("\xa0", " ")
    h = re.sub(r"[ \t]+", " ", h)
    h = "\n".join(line.strip() for line in h.splitlines())
    return re.sub(r"\n{2,}", "\n", h).strip()


def fix(text):
    for bad, good in TYPO_FIXES:
        text = text.replace(bad, good)
    return text


def keywords_for(*parts):
    seen, out = set(), []
    for part in parts:
        for kw in part.split(","):
            kw = kw.strip()
            if kw and kw.lower() not in seen:
                seen.add(kw.lower())
                out.append(kw)
    # Trim to the column limit without cutting a keyword in half.
    result = []
    for kw in out:
        if len(", ".join(result + [kw])) > KEYWORD_LIMIT:
            break
        result.append(kw)
    return ", ".join(result)


def load_rows(dump):
    rows = {"faqs": [], "faq_categories": []}
    with open(dump, encoding="utf-8", errors="replace") as f:
        for line in f:
            m = re.match(r"INSERT INTO `(\w+)` VALUES \((.*)\);\s*$", line, re.S)
            if m and m.group(1) in rows:
                rows[m.group(1)].append(parse_values(m.group(2)))
    return rows


def build_faq_docs(rows, dump_name):
    cats = {r[0]: r[2] for r in rows["faq_categories"]}
    docs = []
    faqs = sorted(rows["faqs"], key=lambda r: (r[2] or "", r[1] or "", int(r[6] or 0), int(r[0])))
    for r in faqs:
        fid, cat_id, clinic_id, question, answer_html, is_home, _order, status = r[:8]
        if status != "published":
            continue
        answer = html_to_text(answer_html)
        if not answer:  # PCU FAQs are poster images only; covered by hand-written docs below
            continue
        question = fix(re.sub(r"^\s*\d+\.\s*", "", question.strip()))
        answer = fix(answer)
        slug, clinic_name = CLINIC_LABEL[clinic_id]
        topic = cats.get(cat_id)
        where = clinic_name + (f" › {topic}" if topic else "")
        found = [kws for term, kws in TERM_KEYWORDS if term.lower() in (question + answer).lower()]
        docs.append({
            "title": question,
            "content": f"คำถาม: {question}\nคำตอบ: {answer}\n(ที่มา: FAQ SUTHieCare – {where})",
            "keywords": keywords_for(*found, CLINIC_KEYWORDS[clinic_id], "SUTHieCare"),
            "categoryId": "services",
            "metadata": {
                "source": "suthiecare_faq",
                "category": f"suthiecare_faq_{slug}",
                "sourceFile": dump_name,
                "sourceTable": "faqs",
                "sourceId": int(fid),
                "faqCategory": topic,
                "isHomepage": is_home == "1",
                "importedAt": SOURCE_DATE,
            },
        })
    return docs


MANUAL_DOCS = [
    {
        "title": "SUTHieCare คืออะไร และขั้นตอนการรับบริการ",
        "content": (
            "SUTHieCare เป็นระบบลงทะเบียนขอรับคำปรึกษาปัญหาสุขภาพทางคลินิก ของโรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี (รพ.มทส.) "
            "สำหรับนักศึกษา บุคลากร มทส. นักเรียนโรงเรียนสุรวิวัฒน์ และผู้สนใจ\n"
            "ขั้นตอนการรับบริการ:\n"
            "1. เลือกคลินิก แล้วเลือกแบบประเมินที่ตรงกับปัญหาของคุณ\n"
            "2. กรอกข้อมูลตามความเป็นจริง ข้อมูลทั้งหมดถูกเก็บเป็นความลับ\n"
            "3. ระบบแสดงผลการประเมินพร้อมคำแนะนำเบื้องต้น\n"
            "4. รอเจ้าหน้าที่ติดต่อกลับทางเบอร์โทรศัพท์ที่ให้ไว้ (คลินิกวัยรุ่นแจ้งว่าจะติดต่อกลับภายใน 3 วัน)\n"
            "ผู้รับบริการสามารถเข้าสู่ระบบเพื่อตรวจสอบประวัติการประเมินของตนเองได้"
        ),
        "keywords": "SUTHieCare, ซูธี้แคร์, ลงทะเบียนขอรับคำปรึกษา, แบบประเมิน, ขั้นตอนรับบริการ, ปรึกษาออนไลน์, ติดต่อกลับ",
        "categoryId": "appointments",
        "source": "suthiecare_app",
    },
    {
        "title": "แบบประเมินและคลินิกที่ลงทะเบียนผ่าน SUTHieCare ได้",
        "content": (
            "แบบประเมิน/ลงทะเบียนที่เปิดให้ใช้งานใน SUTHieCare:\n"
            "- คลินิกวัยรุ่น: แบบแสดงความประสงค์เข้ารับคำปรึกษาคลินิกวัยรุ่น (สุขภาพกาย สุขภาพใจ) สำหรับนักศึกษา บุคลากร มทส. และนักเรียน รร.สุรวิวัฒน์\n"
            "- สุขภาพใจ: แบบประเมินสุขภาพใจด้วยตนเอง (พลังใจ ภาวะหมดไฟ ความเครียด ST-5 และคัดกรองซึมเศร้า 2Q 9Q 8Q)\n"
            "- โรคติดต่อทางเพศสัมพันธ์: แบบประเมินสุขภาพทางเพศ และลงทะเบียนเข้ารับการปรึกษาด้านโรคติดต่อทางเพศสัมพันธ์ "
            "ผู้ที่มีความเสี่ยงเข้าเกณฑ์จะได้รับการนัดหมายตรวจคัดกรองโดยไม่มีค่าใช้จ่ายและเป็นความลับ\n"
            "- คลินิกปรับเปลี่ยนพฤติกรรมสุขภาพ (LSM Clinic): แบบลงทะเบียนขอรับคำปรึกษา ประเมินสุขภาพ 3อ. 2ส. พฤติกรรมการกินและการออกกำลังกาย แล้วเลือกวันเวลาเข้ารับบริการ\n"
            "หลังส่งแบบประเมิน เจ้าหน้าที่จะติดต่อกลับตามเบอร์โทรศัพท์ที่ให้ไว้"
        ),
        "keywords": "แบบประเมิน, คลินิกวัยรุ่น, LSM Clinic, ปรับเปลี่ยนพฤติกรรม, ลดน้ำหนัก, ประเมินสุขภาพใจ, ตรวจ STI ฟรี, SUTHieCare",
        "categoryId": "clinics",
        "source": "suthiecare_forms",
    },
    {
        "title": "ช่องทางติดต่อคลินิกวัยรุ่น หน่วยบริการปฐมภูมิ PCU SUTH",
        "content": (
            "คลินิกวัยรุ่น หน่วยบริการปฐมภูมิ PCU SUTH โรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี\n"
            "ที่อยู่ 111 ถ.มหาวิทยาลัย ต.สุรนารี อ.เมือง จ.นครราชสีมา 30000\n"
            "โทร 044-376555 ต่อ 6799 หรือ 044-376799 ในวันและเวลาราชการ\n"
            "ให้คำปรึกษาคลินิกวัยรุ่นโดยนักจิตวิทยาการปรึกษา วันจันทร์-ศุกร์ 08.00-16.00 น. แนะนำให้นัดหมายล่วงหน้า\n"
            "ลงทะเบียนขอรับคำปรึกษาออนไลน์ได้ที่ระบบ SUTHieCare"
        ),
        "keywords": "คลินิกวัยรุ่น, ติดต่อคลินิกวัยรุ่น, เบอร์โทร, 6799, 044-376799, นักจิตวิทยา, PCU SUTH, SUTHieCare",
        "categoryId": "clinics",
        "source": "suthiecare_app",
    },
    {
        "title": "เวลาให้บริการ PCU SUTH วันจันทร์-ศุกร์",
        "content": (
            "หน่วยบริการปฐมภูมิ PCU SUTH เปิดบริการวันจันทร์-ศุกร์ เวลา 08.00-20.00 น.\n"
            "- ตรวจรักษาโดยแพทย์ 13.00-16.00 น.\n"
            "- ทำแผล / ฉีดวัคซีนต่อเนื่อง 08.00-19.30 น.\n"
            "- เจาะเลือดล่วงหน้า รอบเช้าก่อน 10.00 น. รอบบ่ายก่อน 14.00 น.\n"
            "- ตรวจรักษาเบื้องต้นโดยพยาบาลเวชปฏิบัติทั่วไป 17.00-20.00 น.\n"
            "- ให้คำปรึกษาคลินิกวัยรุ่น โดยนักจิตวิทยาการปรึกษา 08.00-16.00 น. (แนะนำนัดหมายก่อน)\n"
            "- ให้คำปรึกษาสุขภาพจิต โดยอาจารย์พยาบาลจิตเวช 18.00-20.00 น. (แนะนำนัดหมายก่อน)\n"
            "กรุณานำบัตรประชาชนและบัตรนักศึกษามาด้วยทุกครั้ง "
            "นอกเวลาให้บริการ นักศึกษาสามารถเข้ารับบริการได้ที่โรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี"
        ),
        "keywords": "PCU SUTH, เวลาเปิดปิด, เวลาทำการ, จันทร์-ศุกร์, หาหมอ, ทำแผล, ฉีดวัคซีน, เจาะเลือด, พยาบาลเวชปฏิบัติ, ปรึกษาสุขภาพจิต",
        "categoryId": "clinics",
        "source": "suthiecare_faq_image",
        "sourceId": 122,
    },
    {
        "title": "เวลาให้บริการ PCU SUTH วันเสาร์-อาทิตย์ และวันหยุดนักขัตฤกษ์",
        "content": (
            "หน่วยบริการปฐมภูมิ PCU SUTH วันเสาร์-อาทิตย์ และวันหยุดนักขัตฤกษ์\n"
            "- ตรวจรักษาโดยแพทย์ / ขอใบรับรองแพทย์ 08.30-16.00 น.\n"
            "- ทำแผล / ฉีดยา ฉีดวัคซีนต่อเนื่อง 08.00-16.00 น.\n"
            "- เจาะเลือดล่วงหน้า รอบเช้าก่อน 10.00 น. รอบบ่ายก่อน 14.00 น.\n"
            "กรุณานำบัตรประชาชนและบัตรนักศึกษามาด้วยทุกครั้ง "
            "นอกเวลาให้บริการ นักศึกษาสามารถเข้ารับบริการได้ที่โรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี"
        ),
        "keywords": "PCU SUTH, วันเสาร์, วันอาทิตย์, วันหยุด, นักขัตฤกษ์, ใบรับรองแพทย์, ทำแผล, ฉีดยา, เจาะเลือด, เวลาทำการ",
        "categoryId": "clinics",
        "source": "suthiecare_faq_image",
        "sourceId": 121,
    },
    {
        "title": "เหตุฉุกเฉินด้านสุขภาพจิต คิดทำร้ายตนเอง หรือเจ็บป่วยฉุกเฉิน",
        "content": (
            "หากคุณหรือคนใกล้ตัวมีความคิดทำร้ายตนเอง คิดอยากตาย หรือมีพฤติกรรมที่อาจเป็นอันตรายต่อตนเองหรือผู้อื่น "
            "ให้ขอความช่วยเหลือทันที ไม่ต้องรอ:\n"
            "- โทรแจ้งเหตุฉุกเฉินทางการแพทย์ 1669 ตลอด 24 ชั่วโมง\n"
            "- ไปแผนกอุบัติเหตุและฉุกเฉิน โรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี โทร 044-376555 ตลอด 24 ชั่วโมง\n"
            "- สายด่วนสุขภาพจิต 1323 ตลอด 24 ชั่วโมง\n"
            "- อยู่กับคนที่ไว้วางใจ และไม่อยู่คนเดียว"
        ),
        "keywords": "ฉุกเฉิน, อยากตาย, ฆ่าตัวตาย, ทำร้ายตัวเอง, กรีดข้อมือ, ไม่อยากอยู่แล้ว, วิกฤต, 1669, 1323, ห้องฉุกเฉิน, ER",
        "categoryId": "services",
        "source": "suthiecare_faq",
    },
]


def build_manual_docs(dump_name):
    docs = []
    for d in MANUAL_DOCS:
        meta = {
            "source": d["source"],
            "category": "suthiecare_service_info",
            "sourceFile": dump_name,
            "importedAt": SOURCE_DATE,
        }
        if "sourceId" in d:
            meta["sourceTable"] = "faqs"
            meta["sourceId"] = d["sourceId"]
        docs.append({
            "title": d["title"],
            "content": d["content"],
            "keywords": keywords_for(d["keywords"]),
            "categoryId": d["categoryId"],
            "metadata": meta,
        })
    return docs


def to_markdown(docs):
    lines = [
        "# SUTHieCare FAQ – Knowledge Base สำหรับ SUTH Operator",
        "",
        f"สร้างจาก production dump วันที่ {SOURCE_DATE} · ทั้งหมด {len(docs)} เอกสาร",
        "",
    ]
    for i, d in enumerate(docs, 1):
        m = d["metadata"]
        src = f"faqs#{m['sourceId']}" if "sourceId" in m else m["source"]
        lines += [
            f"## {i}. {d['title']}",
            "",
            f"`{d['categoryId']}` · {src} · keywords: {d['keywords']}",
            "",
            d["content"],
            "",
        ]
    return "\n".join(lines)


def main():
    dump = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DUMP
    rows = load_rows(dump)
    docs = build_manual_docs(dump.name) + build_faq_docs(rows, dump.name)
    for d in docs:
        assert len(d["keywords"]) <= KEYWORD_LIMIT and len(d["title"]) <= 191, d["title"]
    (HERE / "suthiecare-faq-kb.json").write_text(
        json.dumps(docs, ensure_ascii=False, indent=2), encoding="utf-8")
    (HERE / "suthiecare-faq-kb.md").write_text(to_markdown(docs), encoding="utf-8")
    print(f"{len(docs)} documents written")


if __name__ == "__main__":
    main()

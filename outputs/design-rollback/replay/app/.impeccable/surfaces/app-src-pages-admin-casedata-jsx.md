---
version: 1
slug: "app-src-pages-admin-casedata-jsx"
primary_target: "app/src/pages/admin/CaseData.jsx"
related_targets:
  [
    "app/src/pages/admin/school/SchoolCaseData.jsx",
    "app/src/components/case/CaseDetailModal.jsx",
  ]
---

# Surface: ข้อมูลเคส (hospital CaseData + school SchoolCaseData)

Mode: Operate. Staff triage and follow up cases, and review answers, equally
often on a phone and a computer. Keep API, statuses, PDPA masking, brand.

## Direction contract

THESIS: Two explicit modes, ติดตามเคส (work queue) and ทบทวนคำตอบ (answer
table), and a case opens as a drawer beside the queue that walks the follow-up
in steps. Refuses the category default of one wide table plus a centered modal
with every control at once.

OWN-WORLD: App tokens (tokens.css): grey canvas, white cards, action orange
#c2410c, Sarabun, 1px dividers instead of tinted boxes, tabular numerals for
IDs and dates, risk as word plus shape plus color.

STORY: Staff see how many cases wait in each status, open the riskiest,
contact, note, book or refer, close, and move to the next without losing the
list.

FIRST VIEWPORT: Header with form title, mode switch, Export right. Status
strip with counts, filter row with dates visible, queue rows with name, risk,
status leftmost. Drawer 560px from the right: identity, step rail, sticky save.
Phone: cards, full-screen drawer.

FORM: Two modes plus stepped case drawer; my list position 6; seed ff72cf95.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

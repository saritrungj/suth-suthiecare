# ผลตรวจส่วนหน่วยงานและโรงเรียน — 3 ตุลาคม 2569

ปรับ harden → layout → adapt → clarify → optimize → polish โดยยึด UserManagement เป็นแบบ และเลือก A: ปรับสี action เฉพาะหน่วยงาน/โรงเรียน ไม่แก้ button-system.css ทั้งแอป

## ผลตรวจ

- Build ผ่าน; unit tests 36/36 ผ่าน รวมการแปลงวันที่ พ.ศ. และ validation วันที่
- school-management 6/6, organization-hierarchy 4/4, route-smoke 26/26 ผ่านบน Chrome desktop
- ชุด hardening ตรวจ 18 สถานะต่อขนาดจอ: 1366×900 และ 390×844; axe WCAG 2.1 A/AA ไม่พบ violation และ document/dialog ไม่ล้นแนวนอน
- ทุกปุ่ม/ช่องกรอก/ช่องเลือก/ค้นหาที่เปิดใช้งานและมองเห็นในส่วนที่ตรวจบนมือถือ สูงอย่างน้อย 44px
- ตรวจ first focus, Tab/Shift+Tab trap, inert background, Escape, focus return, nested physical-record modal และ SweetAlert error ซ้อนบน teacher modal ผ่าน
- ArrowLeft/Right/Home/End, roving tabIndex และ tabpanel aria-labelledby ผ่าน
- ตรวจ classroom summary ที่มี 2 ห้องบนทั้งสองขนาดจอผ่าน; มือถือแสดงข้อมูลเป็นการ์ด ไม่ต้องเลื่อนข้าง
- ทดสอบสร้างนักเรียนด้วยวันเกิด 31/05/2556; payload birth_date = 2013-05-31 ผ่านทั้งสองขนาดจอ
- Impeccable detect: ไม่พบ findings (ผลดิบ ../school-impeccable-detect.json)
- ทดสอบด้วย API mock และข้อมูลจำลอง; original e2e มีการ skip mobile อยู่เดิม จึงเพิ่มชุด mobile hardening และ payload check แยก

## ความครบถ้วนตามคำขอ

| ข้อ                   | ผล  | หลักฐาน/สิ่งที่ตรวจ                                                                                                                                                                                |
| --------------------- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Tokens              | ครบ | tokens.css ใน :root; CSS ทั้งสามไม่มีสี hex ตายตัว ใช้ Sarabun/สี/ขนาดควบคุมกลาง                                                                                                                   |
| 2 Contrast A          | ครบ | action #c2410c, hover #9a3412; ชื่อหน้าใช้ ink; filter count/tooltip/legend อ่านได้; error alert ใช้สี AA เฉพาะส่วนนี้                                                                             |
| 3 SchoolModal         | ครบ | class อิสระไม่ชน ui-modal เดิม; focus/trap/inert/คืนโฟกัสผ่าน รวม nested modal/error alert                                                                                                         |
| 4 Tabs                | ครบ | ใช้ CaseDrawer เดิม ซึ่งมี roving index, arrow/Home/End และ id/tabpanel linkage                                                                                                                    |
| 5 Organizations       | ครบ | header เทียบ UserManagement; ไม่มี !important declarations; tree แสดงสถานะเฉพาะที่ปิด; เลือกหน่วยงานบนมือถือแล้ว scroll/focus หัวข้อ แม้เลือกหน่วยงานเดิมซ้ำ                                       |
| 6 Mobile              | ครบ | ควบคุม 44px; ชื่อนักเรียนกดได้ 44px; cards ต่อคน; risk counts 4 ช่องในแถวเดียวและกดกรองได้; summary ห้องเรียนและประวัติสุขภาพปรับเป็นข้อมูลแนวตั้ง                                                 |
| 7 Forms/dates         | ครบ | ThaiDateField รับ/แสดง พ.ศ. และคง ISO ค.ศ.; required marks/ARIA; field errors ผูก id; teacher picker ประกาศ required/invalid และ error description; ฟอร์มประเภท/ห้องเพิ่ม required/error ARIA ด้วย |
| 8 Details/performance | ครบ | ประวัติประเมินใช้ dot+badge ไม่ใช้แถบหนา; intrinsic risk pills; progress scaleX; lazy charts; ป้องกัน stale response ของแฟ้มนักเรียน/สมาชิกหน่วยงาน                                                |

## สถานะที่ตรวจด้วย axe

- students: 1366px และ 390px ไม่มี violation
- student-form-errors: 1366px และ 390px ไม่มี violation
- student-general: 1366px และ 390px ไม่มี violation
- student-physical: 1366px และ 390px ไม่มี violation
- physical-form-errors: 1366px และ 390px ไม่มี violation
- student-mental: 1366px และ 390px ไม่มี violation
- school-cases: 1366px และ 390px ไม่มี violation
- school-cases-filtered: 1366px และ 390px ไม่มี violation
- school: 1366px และ 390px ไม่มี violation
- classroom-form: 1366px และ 390px ไม่มี violation
- teachers: 1366px และ 390px ไม่มี violation
- teacher-form: 1366px และ 390px ไม่มี violation
- teacher-required-alert: 1366px และ 390px ไม่มี violation
- teacher-required-error: 1366px และ 390px ไม่มี violation
- types: 1366px และ 390px ไม่มี violation
- import: 1366px และ 390px ไม่มี violation
- organization-details: 1366px และ 390px ไม่มี violation
- organization-members-picker: 1366px และ 390px ไม่มี violation

## ขอบเขตและรายการคงเหลือ

ไม่พบข้อกำหนด 1–8 ที่ยังไม่ได้ทำในส่วนที่ระบุ งานนี้ไม่แก้ API/schema และไม่ commit; ไฟล์อื่นที่แก้ค้างไว้ใน workspace คงงานเดิมไว้
Build ยังเตือนขนาด chunks ส่วนรวม (main/ExcelJS) เกิน 500KB ซึ่งอยู่นอกขอบเขตครั้งนี้; chart ของนักเรียนแยก chunk และโหลดเมื่อเปิดแท็บสุขภาพ
การตรวจด้วย axe ไม่แทนการทดสอบกับ screen reader หรือมือถือจริง
Impeccable แจ้ง metadata เดิม: buildPath ยังไม่ตั้ง และ surface brief เก่าไม่ resolve กับ launcher; สามารถตั้ง buildPath และ repoint brief แยกภายหลัง โดยครั้งนี้ไม่แก้ metadata นั้น

## รันซ้ำ

```powershell
cd D:\github-clone\suth-suthiecare\app
node node_modules/@playwright/test/cli.js test --config playwright.school-hardening.config.mjs
pnpm build
pnpm test:unit
```

ชุดตรวจใหม่อยู่ใน app/e2e-audit (โฟลเดอร์เดิมถูก .gitignore); config เฉพาะขนาดจออยู่ app/playwright.school-hardening.config.mjs

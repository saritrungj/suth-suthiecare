# ตรวจรับ UX/UI ส่วนสิทธิ์หน่วยงานและ PDPA

วันที่: 3 ตุลาคม 2569

## ขอบเขตที่ปรับ

- หน้าจัดการหน่วยงาน: แสดงสมาชิกก่อนส่วนตั้งค่าสิทธิ์และ PDPA เพื่อให้เข้าถึงงานจัดการสมาชิกได้ตามลำดับเดิม
- สิทธิ์บทบาทรายหน่วยงาน: ใช้ช่องเลือกและชุด checkbox ที่มีรูปแบบเดียวกับหน้าจัดการ แสดงจำนวนสิทธิ์ การเปลี่ยนแปลงที่ยังไม่บันทึก และข้อความแจ้งผลในส่วนที่ดำเนินการ
- ตั้งค่า PDPA ทั้ง 6 หัวข้อ: คู่ส่งต่อ, Telegram, สิทธิ์ข้อมูลรายสมาชิก, วัตถุประสงค์/ประกาศ, คำขอใช้สิทธิ, อายุเก็บข้อมูล แยกหัวข้อเปิด/ปิดและใช้ control ชุดเดียวกัน
- คำขอใช้สิทธิของผู้รับบริการ: ใช้รูปแบบหน้าประวัติ แปลชื่อประเภท/สถานะ มี empty/loading/error/success และคงข้อความไว้เมื่อส่งไม่สำเร็จ
- ประกาศในฟอร์ม: อยู่หลังชื่อฟอร์ม ก่อนคำถาม ใช้พื้นผิวและสีธีมของฟอร์ม พร้อมความยินยอมที่ใช้คีย์บอร์ดได้
- บันทึกเคสที่ผู้รับบริการอ่านได้: checkbox และคำอธิบายเข้ากับ workspace เดิม มีระยะเลื่อนเผื่อแถบปุ่มบันทึก

ใช้ design tokens เดิม (Sarabun, สีส้มของระบบ, ขนาด control 44px, เส้นแบ่งและพื้นขาว) และ shared components ใน ManagementSettings แทน control แบบ native ที่ยังไม่ได้จัดรูปแบบ

## พฤติกรรมที่ตรวจ

- บันทึกหัวข้อหนึ่งไม่ล้างข้อมูลที่กำลังกรอกในหัวข้ออื่น
- โหลดปลายทาง Telegram ไม่สำเร็จยังตั้งคู่ส่งต่อได้ มีปุ่มลองโหลดใหม่ในหัวข้อที่ล้มเหลว
- ส่ง payload คู่ส่งต่อ, notification, member permissions และ purpose ตามสัญญา API เดิม
- Retention dry-run แสดงจำนวนที่ API คืนและระบุว่ายังไม่ได้ลบข้อมูล
- คำขอผู้รับบริการส่งซ้ำหลัง failure ได้ โดยไม่สูญเสียข้อความ
- คีย์บอร์ดสลับ consent ได้; checkbox บันทึกที่แสดงในประวัติยังทำงาน
- สิทธิ์รายหน่วยงาน, Sidebar, invitation recipient rejection และ login/history/register/form draft ผ่าน regression ที่เกี่ยวข้อง

## หลักฐาน

- Build: `ui-build.txt` — ผ่าน; มีคำเตือนขนาด bundle ของ dependency เดิม
- Unit tests: `pnpm test:unit` — 47 ผ่าน จากการรันในรอบงานนี้
- Browser tests: `ui-final.txt` และ `ui-final-report/index.html` — 38 ผ่าน, 4 ข้ามตามเงื่อนไขเดิมของ organization-hierarchy บนมือถือ; ใช้ installed Chrome, desktop 1280×720 และ Pixel 7 ส่วน UI ที่เพิ่มรอบนี้ทดสอบครบทั้งสองขนาด
- Axe accessibility scan ของ shared settings, patient requests, privacy notice และ note visibility: ไม่พบ violations ใน scope ที่ตรวจ
- ตรวจความกว้างหน้าจอของ settings/patient requests/notice: ไม่เกิด horizontal overflow ใน viewport ที่ทดสอบ
- Impeccable detector รันหนึ่งครั้ง: `ui-detector.json` เป็นรายการว่าง
- ภาพก่อนแก้: `ui-before-desktop-chromium.png`, `ui-before-mobile-chromium.png`
- ภาพหลังแก้: `ui-role-*`, `ui-pdpa-*`, `ui-purpose-*`, `ui-patient-*`, `ui-notice-*`, `ui-case-note-*`
- ตรวจภาพ desktop/mobile หนึ่งชุด แล้วแก้ findings รวมหนึ่งครั้ง และยืนยันภาพอีกหนึ่งชุด
- Local URL `http://localhost:3001/admin/organizations` ตอบ HTTP 200

ไฟล์ review/completion เก็บผลระหว่างเตรียม fixture; assertion ที่คาด payload permissions ผิดรูปแบบและ locator ที่จับ label กว้างเกินไปแก้แล้ว ใช้ผล `ui-final.txt` เป็นผลตรวจรับ

## ข้อจำกัดและการนำไปใช้

ทดสอบ interaction ด้วย API จำลองและบัญชี/หน่วยงานสาธิต ไม่ใช้ข้อมูลผู้รับบริการจริง การตรวจนี้ยืนยัน UX/UI และสัญญา API ที่ frontend เรียก ไม่ใช่การตรวจรับความถูกต้องทางกฎหมายหรือ Production readiness

งานรอบนี้เป็น frontend ไม่เปลี่ยน schema, migration, สิทธิ์ฝั่ง server หรือนโยบายข้อมูล ระบบส่งต่อที่มีอยู่ใช้รูปแบบเดียวกับ management workspace อยู่แล้ว การนำขึ้น Production ใช้กระบวนการ release เดิมหลังตรวจ backend readiness ตามแผน PDPA

หากย้อนเฉพาะ UI ให้ย้อน shared settings components/styles, imports และการจัดวางที่เพิ่มในรอบนี้ โดยรักษา API/session/สิทธิ์และข้อมูลจากการ implement PDPA รอบก่อน Workspace มีงานเดิมที่ยังไม่ commit จึงไม่ควรใช้คำสั่ง reset ทั้ง repository เพื่อย้อน UI

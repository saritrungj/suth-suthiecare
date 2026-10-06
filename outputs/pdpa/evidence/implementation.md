# ผล Implement การแก้ไข PDPA — SuthieCare

วันที่ตรวจรับ: 3 ตุลาคม 2569 · ขอบเขต: โค้ดและสภาพแวดล้อมพัฒนา

ทำงานทั้งสี่ชุดของแผนใน workspace นี้แล้ว พร้อม migration, เครื่องมือ backfill, tests และคู่มือ release งานนี้ **ไม่ได้ deploy, backfill, ล้าง plaintext หรือเปลี่ยน configuration ของ Production** และยังไม่ถือเป็นการรับรองการปฏิบัติตาม PDPA ขององค์กร

## สิ่งที่ส่งมอบ

| งาน       | การเปลี่ยนแปลงและจุดตรวจหลัก                                                                                                                                                                                                                                                                                                     |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PDPA-00   | `server/scripts/inventoryPdpa.js` คืนเฉพาะจำนวน เจ้าของข้อมูล schema และ SHA-256 ของคู่มือ ไม่มีค่าข้อมูลบุคคล; ผลใน `inventory.json`                                                                                                                                                                                            |
| PDPA-01   | `operationalOwnership`, `caseLogService`, `appointmentService` ตรวจ response/master/person/account/org และ foreign keys; log/status/risk/audit ใน transaction; แก้ join ข้อมูลเคสและนัดหมายให้ตรงหน่วยงาน                                                                                                                        |
| PDPA-02   | Telegram เหลือข้อความมีรายการใหม่ รหัสอ้างอิง และลิงก์เปิดระบบ; เฉพาะปลายทางหน่วยงานที่ยืนยันแล้ว; pending event บันทึกพร้อม response และส่งหลัง commit; ไม่มี fallback กลาง                                                                                                                                                     |
| PDPA-03   | `formInvitationRoutes`/`formInvitationService` ใช้ random token 32 bytes เก็บ hash ผูกบัญชีผู้รับ/เคส/ฟอร์ม/หน่วยงาน อายุ 24 ชั่วโมง ใช้ครั้งเดียว; login ผู้รับ; consume ใน transaction; AES endpoints ตอบ 410                                                                                                                  |
| PDPA-04   | `operationalLookupRoutes` รวม aliases ให้ตรวจสิทธิ์และ scope; GET ไม่ seed; เขียนต้องเลือกหน่วยงาน; defaults เป็นคำสั่งแยก; ไม่เปิดข้อมูล owner NULL                                                                                                                                                                             |
| คู่ส่งต่อ | System Admin ตั้ง allowed source/destination ในหน้าหน่วยงาน; ตรวจคู่ตอนเลือกและสร้าง; ปิดคู่ไม่ตัดประวัติ; ส่งเฉพาะข้อมูลสรุปและสถานะ                                                                                                                                                                                            |
| PDPA-05   | `privateData`/`privateField` ใช้ AES-256-GCM, IV ใหม่, typed JSON, marker/version/key ID/context; keyring และ encrypted canary ตรวจ key readiness; ciphertext รุ่นใหม่ผิด key/context/tamper ต้อง error                                                                                                                          |
| PDPA-06   | คำตอบ/summary/risk/clinical/log/appointment, ข้อมูลนักเรียนและผลตรวจร่างกาย, ชื่อและโทรศัพท์บัญชี/บุคคล, อีเมล/OTP destination ใช้ protected storage; การแก้คำตอบยังเข้ารหัส; รายงานสุขภาพคำนวณ server หลังตรวจ scope                                                                                                            |
| PDPA-07   | `backfillPrivateData.js` dry-run/apply/batch/resume, database lock, row lock, checkpoint, savepoint ต่อรายการ, reconciliation และ quarantine; clear legacy ต้องระบุ `--reconciled`; ไม่เปลี่ยน identity HMAC                                                                                                                     |
| PDPA-08   | DTO allowlist/minimum lists; `pii.view`/`clinical.view` ใช้ร่วมกับสิทธิ์และ record scope เดิม; grants ราย membership มี explicit overrides และคำนวณ legacy grants ใหม่เมื่อเปลี่ยน role; export case/student ผ่าน audited endpoint, school bulk สูงสุด 200                                                                       |
| PDPA-09   | mandatory metadata audit สำหรับ disclosure/export/permission/referral; audit ล้มเหลวตอบ 503; patient history เปิดเฉพาะ `patient_visible`; log เก่า internal; telemetry ไม่มีข้อมูลบุคคล                                                                                                                                          |
| PDPA-10   | opaque hashed sessions, cookie Staff/Patient แยก, session-bound CSRF + Origin, idle/absolute timeout, server revoke, Production Email OTP ทุก Staff; ไม่มี trusted-device bypass ใน Production; browser boot จาก API ไม่เก็บ access token/บัญชีเต็ม; draft TTL 4 ชั่วโมง ผูก account/guest flow และล้างเมื่อ logout/เปลี่ยนบัญชี |
| PDPA-11   | MySQL TLS ตรวจ CA/host, Production startup config checks, schema/column/key readiness และ encrypted-writer release gate; คู่มือ PDF ย้ายจาก public ไป private download + authorization/audit; Production ต้องยืนยัน privacy review ก่อนดาวน์โหลด                                                                                 |
| PDPA-12   | หน้าหน่วยงานจัด purpose/notice, grants, referral pairs, notification target, rights requests, retention dry-run; Patient ส่ง/ดูคำขอของตน; immutable notice versions, consent evidence, retention versions, legal hold; ไม่มี automatic deletion; กระบวนการองค์กรอยู่ใน runbook                                                   |
| PDPA-13   | Backend/unit/browser/MySQL จำลอง, migration ซ้ำ/resume/quarantine, invitation race, encrypted restore fixture; rollout/rollback และ Production evidence gates                                                                                                                                                                    |

ปรับข้อกำหนด Sidebar ตามคำยืนยันล่าสุด: System Admin เห็นทุกเมนูของทุกประเภทหน่วยงาน ไม่ต้องกำหนดสิทธิ์เพิ่มเติม; ผู้ใช้อื่นเห็นเมนูตามสิทธิ์ membership ของหน่วยงานที่เลือก ไม่ใช้บทบาทระดับระบบจำกัดเมนูหน่วยงาน และไม่มีเมนูจัดการหลัก ชุดสิทธิ์บทบาทแยกรายหน่วยงานแล้ว ดู `organization-permissions.md` และหลักฐาน `unit-permissions-*` สำหรับการเปลี่ยนแปลงและผลตรวจล่าสุด

## ผลตรวจรับ

| การตรวจ                          | ผล                                                                                                | หลักฐาน                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Backend `pnpm --dir server test` | 119 ผ่าน, 0 fail, 2 skip (database suites opt-in)                                                 | `backend-tests.txt`                             |
| MySQL จำลอง opt-in               | 1 ผ่าน ใช้ schema สำเนาในฐานชั่วคราว ไม่มีการ copy ข้อมูลผู้รับบริการ; ล้างฐานทดสอบเมื่อจบ        | `mysql-integration.txt`                         |
| Frontend unit tests              | 45 ผ่าน, 0 fail                                                                                   | `app-tests.txt`                                 |
| Browser Chrome desktop/mobile    | 108 ผ่าน, 0 fail, 34 skip ตามเงื่อนไข suite; flow สุขภาพนักเรียนบน mobile ผ่านด้วย                | `browser-final.txt` และ `browser-final-report/` |
| Frontend build                   | ผ่าน 915 modules; มีคำเตือนขนาด bundle ของ dependency เดิม                                        | `app-build.txt`                                 |
| Local schema migration           | additive/idempotent ผ่าน; ไม่มี backfill ข้อมูลจริง                                               | `local-schema-migration.txt`                    |
| Local readiness                  | schema/columns/key check ผ่าน; `production_ready=false` ตาม environment และหลักฐานที่ยังไม่ยืนยัน | `readiness.json`, `local-production-gate.txt`   |

ชุดทดสอบ security ครอบคลุมการปลอม master/foreign keys/org, lookup aliases/owner ที่ส่งใน body/GET ไม่ seed, system roles, invitation recipient/expiry/revoke/reuse/race/ciphertext substitution, typed JSON และ context/tamper, audit failure, grant reset, minimal notification, cookie/CSRF/OTP, draft ownership, private-file authorization และ migration reconciliation

การ restore ที่ทดสอบอัตโนมัติเป็น **fixture ciphertext ในฐานจำลอง** เท่านั้น ยังไม่ใช่ผล restore backup/key ของ infrastructure จริง ดูขั้นตอนซ้อมใน `rollout-rollback.md`

Inventory local: forms 25, responses 1,029, master cases 669; ไม่พบ owner NULL ในตาราง operational ที่สำรวจ และไม่พบ response/master organization mismatch จาก count query นี้ ผลดังกล่าวไม่ยืนยันคุณภาพข้อมูลทุกประเภทหรือ Production

## วิธีใช้งานส่วนใหม่

- System Admin: หน่วยงานหลักและหน่วยงานย่อย → เลือกหน่วยงานย่อย → ความปลอดภัยและ PDPA เพื่อกำหนดคู่ส่งต่อ ปลายทางแจ้งเตือน สิทธิ์ละเอียด วัตถุประสงค์/ประกาศ คำขอสิทธิ และนโยบายเก็บข้อมูล
- บันทึกเคส: เลือก “แสดงบันทึกนี้ในประวัติของผู้รับบริการ” เฉพาะบันทึกที่ตรวจแล้ว; ค่าเริ่มต้นไม่เปิดให้ผู้รับบริการ
- การออกลิงก์ผูกเคสต้องมี patient account ที่สัมพันธ์กับ response/master จริง; ลิงก์ AES เก่าต้องออกใหม่
- ผู้รับบริการ: เข้าบัญชีเพื่อดูประวัติและส่งคำขอสิทธิผ่านส่วนความเป็นส่วนตัว
- Cookie session เปลี่ยนรูปแบบการเข้าสู่ระบบ: ผู้ที่เคยใช้ JWT ใน browser ต้องเข้าสู่ระบบใหม่

## ขอบเขตที่ต้องตรวจรับก่อน Production

ต้องมี staging rehearsal/backup+key restore, HTTPS same-origin `/api`, DB TLS/least privilege, disk/backup encryption, Email OTP enrollment/recovery/delivery ทุกเจ้าหน้าที่ และนโยบายองค์กร/ผู้ให้บริการที่ยืนยันแล้ว ห้ามเดาฐานการประมวลผลหรืออายุเก็บแทนผู้รับผิดชอบ

คู่มือ PDF มีหลายหน้าที่เนื้อหาเป็นภาพ การอ่าน text และตรวจหน้าปกยังไม่ถือว่าตรวจครบทุกหน้า; ให้คง `MANUALS_PRIVACY_REVIEWED=false` จนผู้รับผิดชอบตรวจภาพ/ข้อมูลตัวอย่างครบ

คำขอสิทธิและ retention มี workflow/หลักฐานรองรับ การดำเนินการตามคำขอและข้อยกเว้นยังต้องทำตามนโยบายของหน่วยงาน ระบบไม่ลบข้อมูลอัตโนมัติ และไม่ได้เลือกฐานกฎหมายให้แทนองค์กร

ดู `rollout-rollback.md`, `production-readiness.md` และ `governance-runbook.md` สำหรับการนำขึ้นใช้จริง

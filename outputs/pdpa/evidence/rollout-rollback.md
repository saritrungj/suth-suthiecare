# Rollout / rollback — PDPA release

คำสั่งด้านล่างเป็นขั้นตอนสำหรับ staging/ผู้ดูแล release **ยังไม่ได้รันกับ Production** ใช้ PowerShell จาก root ของ repository และจัด secrets ผ่านระบบเก็บ secrets ของ deployment ห้ามใส่ key ลงใน command history หรือหลักฐาน

## เตรียมฐานและสิทธิ์

1. เก็บ snapshot ที่เข้ารหัสพร้อม schema, เวอร์ชันแอป, migration checkpoints, key IDs และทะเบียนผู้มีสิทธิ์กู้คืน; ทดสอบกู้คืนในพื้นที่แยก
2. ตรวจ baseline ขององค์กร/person/school/referral module ที่มีอยู่ก่อน release นี้ด้วย schema review
3. **ไม่ใช้ `migrate:all-forward` สำหรับ PDPA cutover**: tool เดิมมี migration ที่นำ owner ไม่ทราบไปลงโรงพยาบาล SUTH อัตโนมัติ งานนี้ไม่อนุญาตให้เดา owner; ห้ามใช้ rollback SQL เก่าลบคอลัมน์ protected
4. ใช้บัญชี migration เฉพาะกิจ; บัญชี API runtime ให้เฉพาะ DML ที่จำเป็น ไม่ให้ ALTER/CREATE/DROP
5. Inventory ไม่มีข้อมูลบุคคล:

```powershell
pnpm --dir server inventory:pdpa
pnpm --dir server migrate:pdpa -- --apply
pnpm --dir server check:pdpa-readiness
```

หากใช้ `pnpm` เวอร์ชันที่ส่ง `--` ต่างกัน ให้ใช้ `node scripts/migratePdpaSecurity.js --apply` จากโฟลเดอร์ `server` โดยตรง Production mutation tools ต้องมี `--allow-production` หลังผ่าน release gates; parameter นี้ไม่ใช่หลักฐานว่า gates ผ่าน

Schema migration สร้างตาราง/คอลัมน์ เพิ่มพื้นที่ TEXT และ legacy grants จากสิทธิ์ที่พิสูจน์ได้ ใช้ key canary เพื่อปฏิเสธ key ที่อ่านของเดิมไม่ได้; ตรวจ missing columns ก่อนเปิด feature

การปรับสิทธิ์หน่วยงานล่าสุดรวม `20261003_organization_role_permissions.sql` และ snapshot/checkpoint ครั้งแรกใน `migrate:pdpa` แล้ว ต้องมี baseline `organizations.org_level` ก่อนรัน หลังย้ายแล้วไม่อ่านแม่แบบกลางเป็นสิทธิ์ใช้งานจริงอีก ดู `organization-permissions.md` สำหรับการตรวจชุดสิทธิ์รายหน่วยงานและเงื่อนไข rollback

## ลำดับ release

1. ลง patch authorization/lookup/minimal notification และตั้งคู่ส่งต่อ/ปลายทางที่ยืนยันแล้วผ่าน System Admin; ไม่มีคู่ใดเปิดให้เอง
2. เปลี่ยน frontend และ invitation endpoint พร้อมกัน; ลิงก์ AES เดิมตอบ 410 และต้องออกใหม่; ไม่เปิด generic decrypt กลับมา
3. ลง additive schema และ reader ที่อ่าน envelope; ให้ Production `PDPA_ENCRYPTED_WRITER_ENABLED=false` ระหว่าง readiness rehearsal เพื่อหยุด business writes
4. เมื่อ create/edit/read/history/report/export บน staging ผ่านทั้งหมด เปิด writer ด้วย `PDPA_ENCRYPTED_WRITER_ENABLED=true`; backfill เป็น batch พร้อมติดตาม quarantine
5. เปิด DTO/grants/audit/session/OTP แบบ client/server คู่กัน; production server บังคับ OTP อยู่แล้ว จึงต้อง enroll และซ้อม recovery ก่อน cutover; ทุกคน login ใหม่
6. Reconcile ครบและซ้อม restore ผ่าน จึงล้าง legacy columns และตั้ง `PDPA_LEGACY_READ_ENABLED=false` ในรอบ release แยก

Repository นี้เป็น coherent release ที่มีทั้งสี่ชุด หากจะแบ่ง deploy ให้สร้าง release artifacts ที่ผ่าน integration tests ตามลำดับข้างต้น ไม่ deploy frontend กับ authentication API คนละ contract

## Defaults รายหน่วยงาน

GET ไม่สร้างข้อมูลอ้างอิง หากหน่วยงานใหม่ยังไม่มี status/service ให้ตรวจ preview และสร้างเฉพาะหน่วยงานที่ยืนยันแล้ว:

```powershell
pnpm --dir server configure:operational-defaults -- --organization=123
pnpm --dir server configure:operational-defaults -- --organization=123 --apply
```

ค่า owner ที่ยังพิสูจน์ไม่ได้อยู่รายการรอตรวจ ให้ผู้รับผิดชอบใช้หลักฐานความสัมพันธ์กำหนด owner ก่อน migration; ห้าม assign ทุกแถวไปองค์กรเริ่มต้น

## Backfill / resume / reconciliation

```powershell
pnpm --dir server backfill:private-data -- --batch=100
pnpm --dir server backfill:private-data -- --apply --batch=100
pnpm --dir server backfill:private-data -- --apply --resume --batch=100
```

Dry-run ไม่เขียนข้อมูล/checkpoints; apply ใช้ database advisory lock + transaction/row locks + savepoint ราย record จึงไม่ทับข้อมูลที่แก้ระหว่างถือ lock มี readback หลังเขียน; checkpoint ใช้ primary key ไม่ใช่ offset

`pdpa_migration_issues` เก็บ table/migration key, record ID และ reason code เท่านั้น ไม่ใส่ค่าข้อมูลจริงลงไฟล์ เมื่อเจอ owner ไม่ทราบ/legacy ถอดไม่ได้/reconciliation mismatch จะ rollback รายการนั้นแล้วแยกรายงาน ต้องแก้สาเหตุด้วยหลักฐาน; ไม่เดาหรือลบทิ้ง

Resume เริ่มหลัง checkpoint และไม่ได้ retry รายการเก่าที่ quarantine; หลังแก้สาเหตุให้รันเต็มโดย **ไม่ใส่ `--resume`** การอ่าน envelope ที่ย้ายแล้วผ่านและไม่ถูกเขียนซ้ำ

ก่อน clear: ตรวจจำนวนทุกตาราง, ความสัมพันธ์, unresolved issues เป็นศูนย์, readback ชนิด/ค่า create/edit/read/report/export และ restore drill ผ่าน บันทึก reconciliation โดยไม่ export plaintext

```powershell
pnpm --dir server backfill:private-data -- --apply --batch=100 --clear-legacy --reconciled
```

สำหรับ Production เพิ่ม `--allow-production` เฉพาะ release ที่ยืนยันแล้ว ตัว clear จะตรวจ legacy email/measurement ปัจจุบันเทียบ payload หากค่าเปลี่ยนหลัง backfill จะ quarantine ก่อนล้าง; ไม่มี automatic delete

## Key rotation / restore drill

- แยก field encryption, identity/email lookup, session-CSRF, OTP-HMAC และ recovery/session-related secrets; `AES_SEARCH_KEY` คงเดิมใน migration นี้เพื่อไม่เปลี่ยนการจับคู่เลขบัตร
- เพิ่ม key ID ใหม่ใน `DATA_ENCRYPTION_KEYS` และเลือก active key; เก็บ read keys ทุก ID ที่ยังปรากฏในข้อมูล/backups/canaries การเปลี่ยน active key มีผลกับ writes ใหม่ ไม่ได้ rekey existing ciphertext ให้เอง
- รัน schema/key readiness ก่อน traffic; **ห้ามแทน key material ใต้ ID เดิม** และห้ามลบ read key โดยเดาว่าไม่ใช้แล้ว
- Restore drill: กู้ snapshot เข้าฐานแยก → inject keys จาก escrow → ใช้ release ที่อ่าน envelope → schema/key readiness → ตรวจ record counts/FKs → เปิด synthetic create/edit/read/export/invitation race → เทียบ readback ภายใน process → ทดสอบ wrong key และ audit unavailable ต้อง fail closed → บันทึกผลเฉพาะ metadata
- อัตโนมัติใน `pdpaDatabase.test.js` พิสูจน์ encrypted fixture restore, migration/resume และ concurrency; ผู้ดูแลต้องซ้อม backup transport, disk encryption และ key escrow ของ infrastructure จริงต่างหาก

## Rollback

หยุด business writes และ notification ก่อนเมื่อพบ mismatch/decrypt/audit failure เก็บฐาน/keys/checkpoints/evidence ปัจจุบันอย่างปลอดภัย จากนั้น rollback ไป **release ที่อ่าน envelope รุ่นใหม่นี้และชุดสิทธิ์แยกรายหน่วยงานได้** เท่านั้น ไม่ถอด protected data กลับเป็น plaintext ไม่กลับไปใช้สิทธิ์แม่แบบกลางแทนชุดสิทธิ์หน่วยงาน และไม่ drop ตาราง session/invitation/grants

หากต้อง restore backup ให้ restore ในพื้นที่แยกก่อนตรวจ counts/relationship/key readiness แล้วกำหนด cutover/ข้อมูลหลัง snapshot กับเจ้าของงาน ลิงก์ที่ใช้แล้วและ session revoke ต้องไม่ฟื้นกลับมาใช้งานได้; revoke sessions/invitations ตาม incident procedure ก่อนเปิด traffic ใหม่

Monitor `GET /api/pdpa/telemetry` (System Admin), `GET /api/pdpa/migrations`, notification events รายหน่วยงานและ HTTP 503; telemetry counters อยู่ใน process ให้ monitoring เก็บ snapshot/uptime เพื่อเห็น restart และใช้ persistent migration/audit tables ประกอบ

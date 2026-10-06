# Production readiness และหลักฐานที่ต้องยืนยัน

สถานะการ Implement: ส่งมอบโค้ด/เครื่องมือ/การทดสอบแล้ว สถานะ Production: **ยังไม่เปิดใช้ และยังไม่ผ่านการตรวจรับ Production**

`readiness.json` เป็นผล local: schema/columns/key readiness ผ่าน แต่ Production mode, same-origin deployment, DB TLS, encrypted-writer release gate และหลักฐานภายนอกยังไม่ยืนยัน จึง `production_ready=false` เมื่อใช้ `--production` เครื่องมือออกด้วย exit code 2 ตามที่ทดสอบใน `local-production-gate.txt`

## Release gates

| Gate                       | เจ้าของหลักฐาน                | สิ่งที่ต้องแสดง                                                                                                                                   |
| -------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTPS same-origin `/api`   | ผู้ดูแล deployment            | reverse proxy, certificate/redirect, origin config และ browser network/cookie flags ของ deployment จริง                                           |
| DB TLS/CA/host             | DBA/infra                     | connection ผ่าน CA/hostname ที่ถูกต้อง และ reject CA/hostname ที่ผิด; ห้ามใช้ `rejectUnauthorized=false`                                          |
| DB least privilege/network | DBA/infra                     | runtime account ไม่มี DDL, DB จำกัด network, migration account แยกและปิดสิทธิ์หลังงาน                                                             |
| Disk/backup encryption     | infra                         | encryption ของ DB host, media, snapshots และ backup destination; สิทธิ์เข้าถึง backup                                                             |
| Backup/key restore         | DBA/ผู้ดูแล keys              | ผลกู้คืน snapshot + read keys ทุก version ใน staging พร้อม counts/FKs/readback, fail-closed checks และเวลา/ผู้ตรวจ                                |
| Secrets                    | infra                         | field/lookup/session/OTP secrets แยก, key IDs/escrow, runtime injection ไม่มี secrets ใน repo/log                                                 |
| Email OTP                  | เจ้าของบัญชี/ผู้ดูแลอีเมล     | เจ้าหน้าที่ทุกคน enroll, address verified, quota/provider delivery, recovery และ provider unavailable ไม่มี bypass                                |
| Private files              | ผู้รับผิดชอบเอกสาร            | ตรวจภาพ/ทุกหน้าของคู่มือ PDF ให้เป็นข้อมูลที่ได้รับอนุญาต; ใช้ protected download; `MANUALS_PRIVACY_REVIEWED=true` หลังตรวจเท่านั้น               |
| Unit policy                | ผู้รับผิดชอบ PDPA/หน่วยงาน    | purpose/legal basis/notice, referral authority, notification group membership, retention/legal holds, DSAR และ incident roles ตามกิจกรรมที่จะเปิด |
| Processors                 | เจ้าของระบบ/ผู้รับผิดชอบ PDPA | ข้อตกลงและการประเมินผู้ให้บริการ email/Telegram/hosting/backup ที่ใช้จริง รวมปลายทางการประมวลผล                                                   |
| Data reconciliation        | DBA/เจ้าของข้อมูล             | migration issues เป็นศูนย์, unknown owner ตรวจครบ, จำนวน/ความสัมพันธ์/readback/export ผ่าน ไม่มีไฟล์ plaintext                                    |
| Regression                 | ทีมพัฒนา/ผู้ใช้งานตรวจรับ     | roles/scope/OTP/CSRF/session/invitation/referral/guest/history/school/report/export บน staging ของ release เดียวกัน                               |

ไม่ใส่ข้อมูลผู้รับบริการ screenshots จริง keys หรือ OTP ลงใน evidence ให้เก็บ reference ไปหลักฐานที่มีสิทธิ์จำกัดพร้อมผู้ตรวจและวันที่แทน

## คำสั่งตรวจ Production

เตรียม environment ของ deployment ผ่าน secret manager ก่อน แล้วรันใน `server`:

```powershell
node scripts/checkPdpaReadiness.js --production --evidence=release-evidence.json
```

ตัวอย่าง manifest เริ่มต้นต่อไปนี้ **ยังไม่อนุมัติ** เปลี่ยนเป็น verified พร้อม reference เฉพาะเมื่อผู้รับผิดชอบได้ตรวจหลักฐานจริง:

```json
{
  "network_isolation": { "verified": false, "reference": "" },
  "database_least_privilege": { "verified": false, "reference": "" },
  "disk_and_backup_encryption": { "verified": false, "reference": "" },
  "key_restore_drill": { "verified": false, "reference": "" },
  "processor_agreements": { "verified": false, "reference": "" },
  "organization_policy_approval": { "verified": false, "reference": "" }
}
```

เครื่องมือตรวจ schema, columns, encrypted canaries และ config พร้อมความครบของ manifest ไม่สามารถพิสูจน์คุณภาพการตรวจเอกสารหรือ configuration ของ cloud แทนผู้ตรวจจริง

## Configuration ที่เกี่ยวข้อง

ดู `server/.env.example` และ `app/.env.example` เป็นชื่อ setting เท่านั้น ห้าม copy placeholder ไปใช้งานจริง

- `NODE_ENV=production` บังคับ HTTPS same-origin, keyring/separate secrets, DB TLS และ Email OTP ทุก Staff โดยไม่ให้โหมด enroll ปิดข้อบังคับ Production
- `DATA_ENCRYPTION_KEYS`/`DATA_ENCRYPTION_ACTIVE_KEY` ต้องมี active key และ read keys ที่ยังต้องใช้; `AES_KEY` เก็บอ่าน AES legacy ตามรอบ migration; `AES_SEARCH_KEY` ห้ามเปลี่ยนระหว่างงานนี้
- `SESSION_CSRF_SECRET` อย่างน้อย 32 ตัวอักษรและแยกจาก encryption/search/recovery secrets หากเปลี่ยน secret ให้ revoke sessions เก่าและให้ login ใหม่
- `PDPA_ENCRYPTED_WRITER_ENABLED` เริ่ม false บน Production; เปิดหลัง reader/schema/staging tests ผ่าน
- `PDPA_LEGACY_READ_ENABLED` เริ่ม true; เปลี่ยน false หลัง backfill/reconciliation/clear ผ่านเท่านั้น
- `STAFF_TRUSTED_DEVICE_ENABLED=false`; แม้ตั้ง true ก็ไม่ bypass OTP ใน Production
- `FORM_INVITATION_TTL_SECONDS=86400`; server จำกัดช่วง 60 วินาทีถึง 7 วัน
- `MANUALS_PRIVACY_REVIEWED=false` จนตรวจเอกสารจริงครบ; ไม่ใช้ flag เพื่อข้าม privacy review
- ใช้ frontend `/api` ผ่าน reverse proxy และ cookie host เดียวกัน ไม่มี cookie Domain, ไม่มี JWT ใน browser storage

## Monitoring หลังเปิด

System Admin อ่าน `GET /api/pdpa/telemetry` สำหรับ counters decrypt/audit/scope/migration mismatch (ไม่มี subject/token/free text) counters reset ตาม process จึงต้องเก็บ uptime ด้วย อ่าน `GET /api/pdpa/migrations` สำหรับ checkpoints/issue counts และ `GET /api/organizations/:id/notification-events` สำหรับ pending/sent/skipped/failed

หาก pending ค้างหลัง process หยุดระหว่าง commit/dispatch ให้ตรวจ event และปลายทางกับผู้ดูแล ห้ามส่งซ้ำแบบไม่ตรวจรายการ; release นี้ไม่มี automatic notification retry worker และไม่ให้ notification failure rollback คำตอบฟอร์มที่สำเร็จแล้ว

ติดตาม 503 `AUDIT_UNAVAILABLE`, readiness failures, new quarantine/mismatch และผิดปกติของ scope denial; หากไม่สามารถตรวจ/audit disclosure ให้คง fail-closed และทำ incident procedure

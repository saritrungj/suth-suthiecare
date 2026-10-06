# Sidebar และสิทธิ์แยกรายหน่วยงาน

ปรับตามคำยืนยันวันที่ 3 ตุลาคม 2569: หน่วยงาน A/B ตั้งสิทธิ์ของบทบาทชื่อเดียวกันแยกกัน และบทบาทระดับระบบไม่เป็นตัวจำกัดหรือเพิ่มสิทธิ์เมนูหน่วยงาน

## พฤติกรรม

- System Admin เห็นเมนูทุกประเภทหน่วยงานและเมนูจัดการหลักเสมอ ไม่ต้องตั้งสิทธิ์เพิ่ม ในเมนูโรงเรียนยังต้องเลือกหน่วยงานโรงเรียนก่อนโหลดข้อมูล หน่วยงาน `all` ไม่ใช่เจ้าของข้อมูลสำหรับการเขียน
- Admin/Staff/บทบาทอื่นเห็นเฉพาะหน่วยงานที่เป็นสมาชิก เมนูหน่วยงานขึ้นกับ permission ของ membership และขอบเขตครูที่ server ยืนยัน ไม่มีข้อบังคับ Staff เห็นเฉพาะผู้มารับบริการอีกต่อไป
- ผู้ใช้ทั่วไปไม่ได้เมนูจัดการหลักจากสิทธิ์หรือชื่อบทบาทของหน่วยงาน แม้บทบาทในหน่วยงานจะชื่อ SuperAdmin
- หน้าเริ่มต้น `/admin` เลือกหน้าที่มีสิทธิ์จริง ไม่ส่ง Staff ไปผู้มารับบริการหรือ Admin ไป dashboard ที่ไม่มีสิทธิ์เสมอ
- การเป็นสมาชิกอย่างเดียวไม่ bypass สิทธิ์ดูหน้าจัดการฟอร์ม/คลินิก/ศูนย์ช่วยเหลือ

## ตั้งค่า

System Admin เปิด **หน่วยงานหลักและหน่วยงานย่อย → เลือกหน่วยงานย่อย → บทบาทและสิทธิ์ในหน่วยงาน** เลือกบทบาทและบันทึกสิทธิ์ จากนั้นมอบหมายบทบาทให้สมาชิกในหน่วยงานนั้น สมาชิกคนเดียวกันมีบทบาทต่างกันใน A/B ได้

ชื่อและรายการบทบาทเป็นทะเบียนร่วม ชุดสิทธิ์ที่ใช้จริงอยู่ใน `organization_role_permissions` โดย key ประกอบด้วย organization/role/permission ชุดว่างมี metadata ใน `organization_role_permission_sets` จึงไม่ fallback ไปแม่แบบกลาง องค์กรใหม่หรือบทบาทใหม่ที่ยังไม่ตั้งค่าไม่มีสิทธิ์โดยปริยาย

เมนู **บทบาทและสิทธิ์** ระดับระบบจัดชื่อบทบาทและแม่แบบ การแก้แม่แบบไม่แก้ชุดสิทธิ์ของหน่วยงานที่ตั้งไว้ และไม่ให้สิทธิ์ System Admin

`pii.view`/`clinical.view` ยังคงมี explicit override ราย membership และยังต้องมีสิทธิ์อ่านกับ record scope เดิม การตั้งสิทธิ์หน่วยงานไม่ขยาย scope ครู/ห้องเรียนและไม่เพิ่มการเข้าถึงหน่วยงานอื่น

## API และความปลอดภัย

- `GET /api/organizations/:id/roles/:roleId/permissions` คืน permissions/version/configured
- `PUT /api/organizations/:id/roles/:roleId/permissions` รับ `{permissions: [...], version: n}` จำกัด System Admin ตรวจหน่วยงานย่อยและบทบาทจริง ไม่รับ system permission keys
- การบันทึกใช้ transaction/row lock/optimistic version; conflict ตอบ 409; mandatory audit ล้มเหลวตอบ 503 และ rollback สิทธิ์
- `/api/me/authorization` และ middleware อ่านชุดสิทธิ์หน่วยงานเดียวกัน ทุก request ตรวจ membership จากฐานข้อมูล การปลอมค่า role/org ใน browser ไม่ได้สิทธิ์เพิ่ม
- หลังเปลี่ยนสิทธิ์ให้ผู้ใช้นั้น reload เพื่อรับเมนูใหม่ Server ใช้สิทธิ์ล่าสุดทันทีโดยไม่รอ reload

## Migration และ release

เพิ่ม migration ใหม่ `20261003_organization_role_permissions.sql` โดยไม่แก้ SQL migration ที่ลงแล้ว การรัน `migrate:pdpa --apply` รวม migration นี้ หรือรันแยกบนฐานที่มี schema PDPA แล้ว:

```powershell
pnpm --dir server migrate:organization-permissions --apply
```

Migration ใช้ database advisory lock และ transaction ต่อชุดสิทธิ์ คัดลอกแม่แบบเดิมเป็น snapshot แยกต่อหน่วยงานที่มีอยู่ครั้งแรกเท่านั้น พร้อม checkpoint `organization-permissions:v1` ใน `pdpa_migration_progress` รันซ้ำไม่ทับ explicit config ไม่คืนสิทธิ์ที่ถูกล้าง และไม่ให้สิทธิ์อัตโนมัติแก่หน่วยงาน/บทบาทที่สร้างหลัง migration สำเร็จ

Readiness ตรวจทั้งตาราง/คอลัมน์และ checkpoint ก่อนเปิด API บน local migration ผ่าน (เริ่มต้นสร้าง 6 ชุด; รันซ้ำ 0 ชุด) ไม่มีการย้ายข้อมูลผู้รับบริการหรือเปลี่ยน Production ในรอบนี้

ก่อน Production: สำรอง schema/ชุดสิทธิ์เดิม ตรวจ snapshot เทียบรายหน่วยงานบน staging แล้ว deploy schema/migration และแอปพร้อมกันตาม release gates เดิม หาก rollback ต้องใช้ release ที่ยังอ่านชุดสิทธิ์แยกรายหน่วยงานได้ ห้ามย้อนกลับไป authorization ที่อ่านแม่แบบกลางอย่างเดียวหรือลบตารางจนกว่าจะ reconcile ชุดสิทธิ์ที่ปรับแล้ว

## หลักฐาน

- `unit-permissions-backend.txt`: backend 121 ผ่าน, 2 opt-in skip, 0 fail
- `unit-permissions-security.txt`: API isolation/version/system-only/audit rollback
- `unit-permissions-frontend.txt`: frontend 47 ผ่าน
- `unit-permissions-mysql.txt`: MySQL จำลอง migration ซ้ำ การแยก A/B แม่แบบแก้แล้วสิทธิ์หน่วยงานคงเดิม และหน่วยงานใหม่ default deny
- `unit-permissions-browser.txt` และ `unit-permissions-browser-report/`: รอบเต็ม desktop/mobile 108 ผ่าน พบ expectation เก่า 1 จุดที่ยังคาดว่า System Admin ไม่เห็นเมนูโรงพยาบาลในโรงเรียน; แก้ test ให้ตรงข้อกำหนดใหม่แล้ว ชุดที่ได้รับผลกระทบ `unit-permissions-school.txt` ผ่าน 8 tests และ `unit-permissions-editor.txt` ผ่าน 2 tests รวม editor บน mobile โดยไม่ได้เปลี่ยนโค้ดแอปหลังรอบเต็ม ผลรวมกรณีทดสอบที่เป็นปัจจุบัน 110 ผ่าน, 34 skip ตามเงื่อนไข suite, ไม่มี failure ที่ยังไม่แก้ ดู `unit-permissions-validation.json` สำหรับการรวมผลโดยไม่นับซ้ำ
- `unit-permissions-build.txt`: production build ผ่าน (คำเตือนขนาด dependency bundle เดิม)
- `unit-permissions-readiness.json`: local schema/key/checkpoint ผ่าน; ยังไม่ Production-ready

หลักฐานและการตรวจ Production เดิมยังจำเป็น ดู `production-readiness.md` และ `rollout-rollback.md`

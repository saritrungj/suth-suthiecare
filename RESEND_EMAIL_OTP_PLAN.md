# แผน Resend Email Verification และ Staff Login OTP

วันที่: 8 กันยายน 2026  
สถานะ: พัฒนาแล้วใน workspace — ยังไม่ได้รัน migration, ตั้งค่า Resend/DNS หรือเปิดโหมดบังคับใน production

## 1. เป้าหมายและขอบเขต

1. ส่งอีเมลผ่าน Resend API โดยใช้ infrastructure เดิมและแพ็กเกจฟรี
2. เจ้าหน้าที่ต้องผ่าน username/password และ Email OTP ก่อนรับ access token
3. เพิ่ม email ในฟอร์มสมัครผู้รับบริการ พร้อมตรวจสอบการรับอีเมลก่อนเปิดบัญชีใหม่
4. ปรับฟอร์มสร้าง/แก้ไขเจ้าหน้าที่ให้แสดงสถานะยืนยันอีเมลและรองรับการเชิญยืนยัน
5. เตรียมบัญชีเดิมที่ยังไม่มีอีเมล รวมถึงผู้ที่ลืมทั้ง username/password

การตีความคำว่า “ฟอร์มลงทะเบียน”: ครอบคลุมหน้าสมัครผู้รับบริการ เพราะเป็นฟอร์มที่ยังไม่มี email ส่วนฟอร์มสร้างเจ้าหน้าที่มีช่อง email แล้ว จึงเพิ่มขั้นตอนยืนยันแทนการเพิ่มช่องซ้ำ ผู้รับบริการไม่ต้องกรอก OTP ทุกครั้งที่ล็อกอินในแผนนี้

การกู้บัญชีด้วยตนเองเต็มรูปแบบเป็นระยะต่อยอดในข้อ 8; ระยะแรกต้องมีช่องทางผ่านผู้ดูแลสำหรับบัญชีเก่า

## 2. ข้อเท็จจริงจากโค้ดที่ตรวจ

| ส่วน                                                                        | สภาพปัจจุบัน                                                              | งานที่ต้องทำ                                              |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------- |
| `server/routes/authRoutes.js`                                               | `/login` ตรวจ Turnstile, password และออก JWT ทันที                        | แยก password challenge และ OTP verification               |
| `app/src/pages/patient/PatientLogin.jsx`                                    | ใช้หน้าร่วมสำหรับ staff/patient; staff โหลด authorization แล้วไป `/admin` | เพิ่มสถานะ OTP เฉพาะ staff; คงการเลือกปลายทางตามสิทธิ์    |
| `app/src/components/AddAdminModal.jsx` และ `server/utils/userValidation.js` | มี email และตรวจรูปแบบแล้ว                                                | เพิ่มสถานะ verified/pending และกระบวนการผูกอีเมล          |
| `app/src/pages/patient/PatientRegister.jsx`                                 | ไม่มี email; เลขบัตรและโทรศัพท์เป็น optional                              | เพิ่ม email บังคับสำหรับสมัครใหม่และหน้ากรอก OTP          |
| `server/routes/patientAuthRoutes.js`                                        | สมัครแล้วตั้ง active, `verified_at=NOW()` และออก token                    | บัญชีใหม่ pending จนยืนยันอีเมลสำเร็จ                     |
| `server/migrations/patient_auth.sql`                                        | มี pending_verification และ token_version แต่ไม่มี email                  | เพิ่ม email และ email_verified_at แยกจาก verified_at เดิม |
| `server/middleware/authMiddleware.js`                                       | ตรวจ JWT และโหลด authorization; มีบัญชีหน่วยงาน                           | แยกชนิด token, ตรวจ OTP assurance และเพิกถอน session ได้  |

ตรวจจากไฟล์เท่านั้น ยังไม่ได้ตรวจ schema/ข้อมูล production จริง โค้ดมีการแก้ไขค้างอยู่หลายส่วน โดยเฉพาะ authorization, agency และ login ผู้พัฒนาต้องอ่าน diff ล่าสุดและรักษางานเหล่านั้น

## 3. Resend และงบประมาณ

- สมัคร Resend Free และยืนยัน subdomain ที่หน่วยงานควบคุม เช่น `mail.suth.go.th` (ตัวอย่าง ยังไม่ใช่โดเมนที่ยืนยันแล้ว)
- ผู้ดูแล DNS เพิ่ม record ตาม Resend สำหรับ SPF/DKIM และจัด DMARC ให้สอดคล้องกับโดเมน ห้ามแทนที่ record ของอีเมลเดิมโดยไม่ตรวจ
- ใช้ sender เช่น `SUTH iCare <no-reply@mail.suth.go.th>`; ผู้รับใช้อีเมลโดเมนอื่นได้
- API key สำหรับส่งอีเมล เก็บเฉพาะ backend; ไม่ใช้ตัวแปร `VITE_*`, ไม่ commit และไม่ส่ง key ในแชต
- HTTPS backend ต้องออกไป Resend API ได้; ใช้ SDK `resend` หลังตรวจ Node version ที่ deployment รองรับ
- ฟรี ณ วันที่ตรวจ: 100 อีเมล/วัน และ 3,000 อีเมล/เดือน รวมทุก flow ในบัญชี Resend [Pricing](https://resend.com/pricing)
- คิดงบจาก login เจ้าหน้าที่ + สมัครใหม่ + resend + ยืนยันอีเมลเดิม + recovery เช่น 30 คน × 2 login + 15 สมัครใหม่ + 10 resend = 85 ฉบับ/วัน
- โควตารายวันหมดอาจทำให้เจ้าหน้าที่ใหม่เข้าไม่ได้ แม้โควตาเดือนยังเหลือ จึงต้องตรวจปริมาณจริงก่อนเปิดใช้ และทยอยเชิญบัญชีเก่า
- ใช้ Free ต่อไป ไม่เปิด paid/overage อัตโนมัติ; ทำตัวนับกลางใน DB และสำรองงบสำหรับ staff login เช่น 30 ฉบับ/วัน โดยตรวจงบรวมทุก flow แบบ atomic
- เมื่อโควตาไม่พอ ให้แจ้งรอ/ติดต่อผู้ดูแล ห้ามข้าม OTP; ต้นทุน server/domain เดิมและการดูแลยังมีอยู่ และนโยบายฟรีอาจเปลี่ยน

ค่าตั้งต้นที่เสนอใน `.env.example` และ production environment:

```dotenv
RESEND_API_KEY=replace_me
RESEND_FROM_EMAIL=SUTH iCare <no-reply@mail.suth.go.th>
OTP_HMAC_SECRET=replace_with_32_random_bytes_encoded_as_hex
OTP_TTL_SECONDS=300
OTP_RESEND_COOLDOWN_SECONDS=60
OTP_MAX_ATTEMPTS=5
STAFF_EMAIL_OTP_MODE=enroll
EMAIL_DAILY_BUDGET=100
EMAIL_MONTHLY_BUDGET=3000
EMAIL_STAFF_RESERVED_DAILY=30
```

`enroll` เป็นช่วงเตรียมข้อมูลโดยนโยบาย login เดิมยังใช้ได้; `required` บังคับ OTP สำหรับทุกบัญชีเจ้าหน้าที่รวม Super Admin และ agency ที่ใช้ `/api/login` ไม่ให้ role ใหม่หลุดจากนโยบาย บัญชีทดสอบต้องแยก environment

## 4. ข้อมูลและบริการกลาง

Migration ใหม่แบบเพิ่มข้อมูล รันซ้ำได้ และไม่แก้ migration เก่าที่ deploy แล้ว:

- `users`: ใช้ email เดิม เพิ่ม `email_verified_at`, `pending_email`, `auth_version` และข้อมูลผู้อนุมัติ/เวลาผูกอีเมลเมื่อเป็นการกู้บัญชี
- `patient_accounts`: เพิ่ม `email`, `email_verified_at`, `pending_email` แบบ nullable เพื่อให้บัญชีเดิมยังอยู่ได้ ใช้ encryption helper เดิมสำหรับเก็บที่อยู่อีเมลหากกำหนดให้เข้ารหัส และมี HMAC สำหรับ lookup; ต้องกำหนด schema/ชื่อฟิลด์ให้ตรงกับวิธีที่เลือกก่อน migration
- ห้ามตีความ `verified_at` เดิมว่า email verified เพราะโค้ดเดิมตั้งค่านี้ตอนสมัครโดยไม่ส่งอีเมล
- email normalize ด้วย trim และ lowercase domain; ไม่ลบจุดหรือ `+tag`; ใช้นโยบายเดียวกันตอนค้นและยืนยัน บัญชีเจ้าหน้าที่ควรใช้อีเมลรายบุคคลไม่ซ้ำ ต้องสำรวจและแก้ duplicate ก่อนสร้าง unique index; ผู้รับบริการอาจใช้อีเมลครอบครัวร่วมกัน จึงใช้ username/identity ร่วม lookup และไม่ตั้ง unique email โดยปริยาย
- ตาราง `auth_email_challenges`: opaque token digest, account_type, account_id, purpose, destination ที่ป้องกันตามแนวทางข้อมูลอีเมล, otp_hmac, generation, auth_version_snapshot, attempts, expires_at, resend_after, consumed_at, invalidated_at, send_status, provider_message_id, created_at
- purpose แยก `staff_login`, `email_verification`, `account_recovery`; ตรวจ account_type และ purpose ทุกครั้งเพื่อไม่ใช้รหัสข้าม flow
- ตาราง rate-limit/send-budget กลางใน MySQL และ audit events; ไม่อาศัย memory อย่างเดียว
- กำหนด cleanup challenge หมดอายุภายใน 24 ชั่วโมง; audit เก็บเฉพาะ event/account/result เวลาและข้อมูลติดตามที่จำเป็น เสนอ retention 90 วันให้หน่วยงานทบทวน

บริการใหม่ที่เสนอ: `server/services/emailService.js`, `server/services/otpService.js`, `server/services/emailBudgetService.js` และ email templates ไทย/อังกฤษ

OTP ใช้ `crypto.randomInt` สุ่ม 6 หลัก มี leading zero ได้; HMAC ครอบคลุม challenge/account/purpose/generation/OTP และใช้ secret แยกจาก JWT ตรวจเทียบแบบ constant-time ไม่เก็บ OTP plaintext ใน DB, log หรือ response

## 5. Staff login และการใช้ OTP

1. `POST /api/login`: ตรวจ Turnstile, credentials, active และ rate limit
2. ถ้า required แต่ไม่มี verified email ให้ส่งสถานะ `EMAIL_ENROLLMENT_REQUIRED` หลังรหัสผ่านถูกต้อง ไม่มี access token และห้ามให้กรอกอีเมลใหม่เพื่อรับสิทธิ์ทันที
3. ถ้าพร้อม สร้าง challenge ที่ผูกบัญชี/อีเมลใน DB และส่ง OTP ผ่าน Resend; response มี `requiresOtp`, `challengeToken`, `maskedEmail`, `expiresAt`, `resendAfter` ไม่มี user permissions หรือ access JWT
4. `POST /api/login/verify-otp` รับ challengeToken + otp; ตรวจหมดอายุ/attempts/purpose/สถานะบัญชี/อีเมล/auth_version อีกครั้ง
5. consume challenge ภายใต้ transaction/row lock ให้ concurrent verification สำเร็จได้เพียงครั้งเดียว จากนั้นออก staff access JWT ที่มี account_type, token purpose, auth_version และหลักฐานผ่าน email OTP
6. frontend เก็บ session และโหลด authorization หลังสำเร็จเท่านั้น ส่งต่อ `/admin` ตามพฤติกรรมปัจจุบันและ routing agency
7. `POST /api/login/resend-otp`: ต้องมี valid challenge หลังผ่าน password; cooldown 60 วินาที สร้าง generation ใหม่และยกเลิกรหัสเก่า ไม่มีการรับ email ปลายทางจาก request

ข้อกำหนดร่วม:

- อายุ OTP 5 นาที; ไม่เกิน 5 ครั้งต่อ challenge; rate limit เพิ่มตามบัญชีและ IP เพื่อไม่สร้าง challenge ใหม่แล้วเริ่มเดารหัสได้ไม่จำกัด
- ค่าตั้งต้นส่งไม่เกิน 5 ฉบับ/บัญชี/15 นาที และ IP limit ที่รองรับเครือข่ายโรงพยาบาลร่วมกัน; การ resend ไม่ล้าง account attempt counter
- หนึ่ง active login challenge ต่อบัญชี; serialize create/resend/verify ให้ไม่มี OTP รุ่นเก่าที่ใช้ได้หลังสร้างรุ่นใหม่
- ส่งอีเมลนอก DB transaction ที่ล็อกนาน; ใช้ sending/sent/failed/unknown และตรวจ generation ก่อนอัปเดตผล
- ใช้ Resend idempotency key ต่อ challenge generation และ payload เดิมเมื่อ retry; timeout ที่ไม่ทราบผลห้ามสร้างการส่งซ้ำแบบไม่จำกัด หาก process หายและไม่มี OTP เดิมใน memory ให้ยกเลิก challenge แล้วเริ่มรุ่นใหม่ภายใต้ cooldown/budget แทนเก็บ plaintext เพื่อ retry
- Resend รับคำขอสำเร็จไม่ได้ยืนยันว่าเมลถึง inbox; UI มี resend และคำแนะนำตรวจ spam; ใช้ verified webhooks สำหรับ delivery/bounce หากเพิ่มในระยะหลัง
- OTP UI รองรับ paste, numeric keyboard, `autocomplete=one-time-code`, countdown, expired, wrong code, rate limit และส่งไม่สำเร็จทั้งไทย/อังกฤษ
- middleware ไม่ยอมรับ challenge เป็น access token และไม่รับ patient token ใน staff API; ตรวจ `auth_version` ทุกครั้งและปฏิเสธ JWT เก่าที่ไม่ผ่าน OTP หลัง cutover
- ไม่เพิ่ม 4 หลักท้ายบัตรเป็นปัจจัยความปลอดภัย ไม่เปิด remember-device ในรุ่นแรก; session ที่ยังใช้ได้ไม่ต้อง OTP ซ้ำทุกหน้า

## 6. ฟอร์มลงทะเบียนและยืนยันอีเมล

### ผู้รับบริการสมัครใหม่

1. เพิ่ม email บังคับใน `PatientRegister.jsx`: type=email, autocomplete=email, maxlength=254 และคำอธิบายใช้ยืนยัน/กู้บัญชี
2. ตรวจ frontend และ backend; ไม่รับ email_verified_at หรือ status จาก client
3. `/api/patient-auth/register` สร้างบัญชี pending_verification และ challenge สำหรับ email verification; ยังไม่เรียก setPatientSession
4. เพิ่ม `/api/patient-auth/email/verify` และ `/api/patient-auth/email/resend` ที่ยืนยันได้เฉพาะ purpose นี้
5. OTP สำเร็จจึงตั้ง email_verified_at, active และออก patient token จากนั้นไป returnTo เดิม
6. สมัครซ้ำ/เมลส่งไม่สำเร็จต้องกลับมายืนยันได้: password login ของบัญชี pending ส่งเข้าสถานะ pending verification ไม่ออก full token มีแก้ email ที่พิมพ์ผิดได้เฉพาะหลังพิสูจน์ credentials ของบัญชี pending; ยกเลิก challenge เดิม
7. บัญชี pending ไม่มีสิทธิ์ดูประวัติ ตรวจทั้ง login และ patient middleware รวมถึง cleanup บัญชีสมัครไม่สำเร็จที่ยังไม่มีข้อมูลใช้งาน เพื่อไม่จอง username/identity ค้างถาวร (เสนอ 24 ชั่วโมง)
8. การตรวจเลขบัตรถูก format/checksum หรือจับคู่ identity_hash ไม่ได้พิสูจน์เจ้าของประวัติ การยืนยันอีเมลใหม่ก็ไม่ได้พิสูจน์ความสัมพันธ์กับเวชระเบียน ต้องคง/เพิ่มขั้นตอนตรวจสิทธิ์เชื่อมประวัติแยกต่างหาก ห้ามถือ email verified เป็น identity verified

### เจ้าหน้าที่ที่สร้างโดยผู้ดูแล

- ใช้ช่อง email เดิมใน AddAdminModal และเพิ่ม badge ยังไม่ยืนยัน/ยืนยันแล้วในหน้าจัดการ
- ผู้ดูแลตรวจว่าบัญชีและอีเมลเป็นบุคคลเดียวกันก่อนเริ่ม enrollment; ผู้ใช้ยืนยันการรับเมลผ่าน challenge หลัง password หรือ invitation token ที่จำกัดสิทธิ์
- การเปลี่ยนอีเมลเก็บ pending_email ก่อน ใช้ email เดิมจนยืนยันอันใหม่; ต้อง recent reauthentication และ OTP เดิม หรือผู้ดูแลตรวจตัวตนกรณีเข้าอีเมลเดิมไม่ได้
- เมื่อผูกอีเมลใหม่สำเร็จ เพิกถอน challenge/session เก่า เพิ่ม auth_version และบันทึก audit; การแก้ข้อมูลทั่วไปต้องไม่ล้าง email_verified_at หากอีเมลไม่เปลี่ยน

## 7. บัญชีเดิมและการเปิดบังคับ OTP

1. ตรวจ DB จริงแบบไม่เผย PII: จำนวนบัญชีไม่มีอีเมล, email ผิด/ซ้ำ, account types และ schema จริง
2. Deploy schema/service/UI ในโหมด enroll; เพิ่ม email verification เป็นกระบวนการที่แสดงความพร้อมก่อน cutover
3. เจ้าหน้าที่เดิม: ผู้ดูแลตรวจและกำหนดอีเมลที่เชื่อถือได้ แล้วทยอยส่งยืนยันภายในโควตา ไม่ mark verified จากการมีค่า email อยู่แล้ว
4. ผู้รับบริการเดิมที่ active: ยัง login ได้ตามเดิม แสดงคำเชิญเพิ่มอีเมลหลัง reauthentication; verification พิสูจน์เฉพาะการรับเมล และต้องมีการตรวจตัวตนที่เหมาะสมหากบัญชียังไม่เคยผ่านการตรวจเจ้าของประวัติ
5. ผู้ลืม username/password และไม่มี verified email: ติดต่อผู้ดูแล ตรวจตัวตนผ่านช่องทางหน่วยงานที่เชื่อถือได้ แล้วผูกอีเมลที่อนุมัติ ส่ง OTP ยืนยันการรับ จากนั้นกู้บัญชี ไม่ใช้เลขบัตรเพียงอย่างเดียวอนุมัติอีเมลใหม่
6. เมื่อเจ้าหน้าที่พร้อม รวม Super Admin และผู้ดูแลสำรอง ทดสอบ staging แล้วตั้ง required; JWT ก่อน cutover ต้องไม่เข้า staff API ได้
7. หาก Resend ขัดข้องให้แสดงสถานะและคงการบังคับ OTP; rollback เฉพาะรุ่นที่ยังบังคับ OTP ได้ หรือ maintenance หากจำเป็น ไม่ rollback กลับ password-only อัตโนมัติ

## 8. กู้ username/password (ระยะต่อยอด)

เพื่อรองรับโจทย์เดิม วาง recovery ที่ใช้ verified email ใน DB โดยผูก account_type ให้ชัด:

- request: identifier ที่ระบบนั้นมีจริง เช่น username หรือเลขบัตรหากตรวจพบ schema รองรับ; response กลางไม่เปิดเผยว่ามีบัญชีหรืออีเมลใด
- ผู้ที่ไม่มี verified email ได้ช่องทางติดต่อผู้ดูแลเหมือนกัน ไม่เปิดช่องกรอกอีเมลใหม่แล้วใช้ OTP ยึดบัญชี
- verify recovery OTP: ออก recovery grant อายุ 5 นาทีใช้ครั้งเดียว จำกัดเฉพาะอ่าน username ของตนและตั้ง password ใหม่
- reset: เก็บ password ด้วย bcrypt ตามนโยบายบัญชีนั้น เพิ่ม auth_version/token_version ยกเลิก sessions/challenges เดิม แล้วให้ login ใหม่ตามปกติ
- แสดง username เดิมหลังผ่าน verification แทนเปลี่ยน username โดยไม่จำเป็น; recovery OTP ใช้แทน staff login OTP ไม่ได้
- ผู้ดูแลต้องมีสิทธิ์ตามระบบ authorization ล่าสุดและมี audit เมื่อช่วยกู้บัญชี

## 9. ลำดับพัฒนาและไฟล์หลัก

| ระยะ | ผลส่งมอบ                                             | ไฟล์หลัก                                                                                    |
| ---- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1    | สำรวจข้อมูล, migration, config, บริการส่ง/OTP/budget | migration ใหม่, `server/config/env.js`, `server/.env.example`, services ใหม่                |
| 2    | staff enrollment และบัญชีเดิม                        | `server/routes/userRoutes.js`, `AddAdminModal.jsx`, หน้าจัดการเจ้าหน้าที่ตาม routing ล่าสุด |
| 3    | staff password + OTP และ session enforcement         | `authRoutes.js`, `authMiddleware.js`, `PatientLogin.jsx`, `api.js`                          |
| 4    | email registration verification                      | `PatientRegister.jsx`, `patientAuthRoutes.js`, `patientAuth.js`, `patientAuthMiddleware.js` |
| 5    | UX ไทย/อังกฤษ, tests, คู่มือและ cutover              | locales, server tests, app e2e, deployment docs                                             |
| 6    | self-service recovery                                | recovery routes/services และหน้าลืมข้อมูลบัญชี                                              |

ทุกระยะต้องรักษาการแยก staff/patient และ authorization/agency ปัจจุบัน ไม่เขียนทับงานที่อยู่ใน working tree

## 10. เกณฑ์ทดสอบและรับงาน

- [ ] รหัสผ่านถูกแต่ไม่มี OTP เข้า staff API ไม่ได้; patient/challenge/recovery token ใช้เข้า staff API ไม่ได้
- [ ] OTP ถูกใช้ได้ครั้งเดียว รวมการ verify พร้อมกัน; หมดอายุ/ผิด/รุ่นเก่าใช้ไม่ได้
- [ ] resend และสร้าง challenge พร้อมกันไม่หลุด cooldown, account attempt limit หรือ shared budget
- [ ] บัญชีถูกปิด, password/email เปลี่ยน หรือ auth_version เปลี่ยนระหว่างรอ OTP ต้องปฏิเสธ
- [ ] restart/multiple instances ไม่ทำให้ attempts/cooldown หาย; API timeout ไม่ทำให้ส่งอีเมลซ้ำเกินงบ
- [ ] Resend error, bounce, quota หมด ไม่มี full token และไม่มี fallback ข้าม OTP
- [ ] registration email validation ทำทั้ง client/server; pending ไม่เข้าประวัติ; กลับมายืนยัน/แก้อีเมลผิดได้โดยตรวจ credentials
- [ ] email verification ไม่ทำให้ผู้ที่รู้เลขบัตรเชื่อมประวัติผู้อื่นโดยอัตโนมัติ
- [ ] บัญชีเดิมไม่ได้กลายเป็น email verified จาก migration; เปลี่ยน email ต้องยืนยันใหม่
- [ ] JWT ก่อน required ถูกเพิกถอน; routing/permissions ของ admin, Super Admin, agency และ patient ยังถูกต้อง
- [ ] TH/EN, mobile, paste OTP, returnTo, error states และ session expiry ผ่าน e2e
- [ ] ไม่มี key, OTP, เลขบัตรหรือข้อมูลผู้ป่วยใน log/อีเมล; email payload เปิดเผยเท่าที่จำเป็น
- [ ] CI ใช้ fake email transport ไม่ส่งอีเมลจริง; staging ทดสอบส่งจริงเฉพาะบัญชีทดสอบที่กำหนด
- [ ] backup/schema rehearsal และ cutover/rollback ที่คง OTP ได้ผ่านก่อน production

## 11. สิ่งที่ต้องพร้อมก่อนเปิดใช้จริง

- บัญชี Resend Free, ผู้ดูแล DNS, sender domain และ API key ใน secret environment
- จำนวน login/สมัครจริงต่อวันรวมทุก flow ต้องอยู่ในโควตา พร้อมผู้รับผิดชอบตรวจ budget
- รายชื่อเจ้าหน้าที่และอีเมลที่ผ่านการตรวจตัวตน ผู้ดูแลสำรอง และขั้นตอนช่วยผู้ไม่มีอีเมล
- DB migration, tests และการยืนยันอีเมลเจ้าหน้าที่ก่อนเปลี่ยนเป็น required

## การส่งมอบใน workspace

- เพิ่ม Resend SDK, `emailService`, OTP challenge แบบ hash/HMAC, resend cooldown และตัวนับโควตารายวัน/เดือนใน MySQL
- เพิ่ม migration ที่รันซ้ำได้: `pnpm --filter suthiecare-api migrate:email-otp`
- staff login รองรับโหมด `enroll` และ `required`, หน้ากรอกรหัส OTP, การส่งใหม่ และ email enrollment ผ่าน password + OTP
- เพิ่ม email และ email OTP verification ในการสมัครผู้รับบริการ; บัญชีจะเป็น pending จนยืนยันสำเร็จ
- แสดงสถานะยืนยันอีเมลในตารางเจ้าหน้าที่ และเพิกถอน staff session เมื่อ password หรือ email ถูกเปลี่ยน
- ผ่าน server tests และ production frontend build; ยังต้องทดสอบส่งจริงกับ API key ที่องค์กรกำหนดใน staging ก่อน production

## แหล่งอ้างอิง

- [Resend Pricing — ตรวจ 8 กันยายน 2026](https://resend.com/pricing)
- [Resend: Verified Domains](https://resend.com/docs/dashboard/domains/introduction)
- [Resend: Idempotency Keys](https://resend.com/docs/dashboard/emails/idempotency-keys) — retry payload เดิมด้วย key เดิม; ผู้ให้บริการเก็บ key 24 ชั่วโมง

Resend ส่งข้อความ; application เป็นผู้สร้าง/ตรวจ OTP และตัดสินสิทธิ์บัญชี การรับ OTP ที่อีเมลใหม่ได้ยืนยันเพียงการควบคุมกล่องอีเมลนั้น

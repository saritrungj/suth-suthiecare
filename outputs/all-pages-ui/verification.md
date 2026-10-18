# ตรวจ UI ทุกหน้า — 15 ตุลาคม 2569

ใช้สีหลัก #F47932 คู่สีขาวทั่วระบบ พร้อมสีส้มเข้มสำหรับตัวอักษรและปุ่มที่ต้องอ่านชัดเจน

## ผลตรวจ

- ตรวจครบ 42 เส้นทางบนเดสก์ท็อปและมือถือ รวมรูปแบบโรงพยาบาลและโรงเรียน
- ตรวจ responsive ที่ 320, 900 และ 1440px รวมฟอร์มแนวนอนและจอกว้าง 2560px: ผ่าน 7 รายการ; ข้าม 2 รายการที่ซ้ำกับโครงการแท็บเล็ตตามเงื่อนไขเดิม
- ตรวจทุกหน้าด้วย axe WCAG A/AA และ JavaScript runtime: มือถือผ่านครบ; เดสก์ท็อปพบปัญหารอบแรก แล้วตรวจยืนยัน 12 เส้นทางที่แก้ไขผ่าน (42.6 วินาที)
- ตรวจเมนูมือถือ: กักโฟกัส, ปิดด้วย Escape, คืนโฟกัส, ค้นหาหน่วยงาน และทำพื้นหลัง inert ผ่าน
- ตรวจแบบประเมินที่มีข้อมูล: ช่องกรอก, BMI, ตัวเลือก, checkbox, ตาราง, ข้อความยาว, validation และล้างคำตอบ ผ่านทั้งมือถือและเดสก์ท็อป
- ชุดใช้งานจริงผ่าน 31 รายการจากรอบแรก; การตรวจพื้นที่กดเดสก์ท็อปที่ตั้งเงื่อนไขชื่อ project ผิดแก้เป็นตรวจชนิดอุปกรณ์ และตรวจยืนยันผ่านอีก 2 รายการ
- ตรวจรูปสำรองคลินิกหลังแก้ไข: ผ่านทั้งมือถือและเดสก์ท็อป
- Production build ผ่าน; ยังมีคำแนะนำเดิมเรื่อง bundle ขนาดใหญ่

การทดสอบใช้ API fixtures และข้อมูลสาธิต ไม่ใช่ข้อมูลผู้ป่วยจริง และยังไม่ได้รับรอง backend จริงหรืออุปกรณ์จริงทุกชนิด

## สิ่งที่แก้ไข

- หน้าแรก รายการคลินิก ศูนย์ช่วยเหลือ รายละเอียดคลินิก และส่วนท้าย ใช้ธีมส้ม–ขาว พร้อมแก้ชื่อยาวและรูปที่โหลดไม่สำเร็จ
- หน้าบัญชี สมัครสมาชิก ยืนยันอีเมล และเปลี่ยนรหัสผ่าน ปรับสี ฟอร์ม ปุ่ม และ responsive
- หน้าประวัติ ผลประเมิน และรายละเอียดสุขภาพ แก้ contrast กราฟ ข้อมูลว่าง ค่า 0 และปุ่มดูประวัติ
- ทุกหน้าแอดมิน โรงเรียน และระบบหลัก ปรับสีของ action ตาราง ฟอร์ม และ modal ให้ใช้ token เดียวกัน
- ตัวแก้ไขฟอร์มมีชื่อปุ่มไอคอน สีธีม ปุ่มลาก และลิงก์การ์ดที่รองรับคีย์บอร์ด
- แบบประเมินมี label ที่อ่านได้ด้วยโปรแกรมอ่านหน้าจอ ข้อผิดพลาดที่เชื่อมกับช่องกรอก และ checkbox ที่ใช้งานด้วยคีย์บอร์ดได้

## หน้าที่ตรวจและภาพตัวอย่าง

| เส้นทาง                         | เดสก์ท็อป                                             | มือถือ                                           |
| ------------------------------- | ----------------------------------------------------- | ------------------------------------------------ |
| `/`                             | [ผ่านรอบยืนยัน](--desktop.png)                        | [ผ่าน](--mobile.png)                             |
| `/login`                        | [ผ่านรอบยืนยัน](-login-desktop.png)                   | [ผ่าน](-login-mobile.png)                        |
| `/account/login`                | [ผ่านรอบยืนยัน](-account-login-desktop.png)           | [ผ่าน](-account-login-mobile.png)                |
| `/account/register`             | [ผ่านรอบยืนยัน](-account-register-desktop.png)        | [ผ่าน](-account-register-mobile.png)             |
| `/account/verify-email`         | [ผ่าน](-account-verify-email-desktop.png)             | [ผ่าน](-account-verify-email-mobile.png)         |
| `/account/change-password`      | [ผ่านรอบยืนยัน](-account-change-password-desktop.png) | [ผ่าน](-account-change-password-mobile.png)      |
| `/help-center`                  | [ผ่าน](-help-center-desktop.png)                      | [ผ่าน](-help-center-mobile.png)                  |
| `/help-center/clinic/1`         | [ผ่านรอบยืนยัน](-help-center-clinic-1-desktop.png)    | [ผ่าน](-help-center-clinic-1-mobile.png)         |
| `/terms`                        | [ผ่าน](-terms-desktop.png)                            | [ผ่าน](-terms-mobile.png)                        |
| `/privacy-policy`               | [ผ่าน](-privacy-policy-desktop.png)                   | [ผ่าน](-privacy-policy-mobile.png)               |
| `/assessment/101`               | [ผ่านรอบยืนยัน](-assessment-101-desktop.png)          | [ผ่าน](-assessment-101-mobile.png)               |
| `/assessment-result`            | [ผ่านรอบยืนยัน](-assessment-result-desktop.png)       | [ผ่าน](-assessment-result-mobile.png)            |
| `/history`                      | [ผ่านรอบยืนยัน](-history-desktop.png)                 | [ผ่าน](-history-mobile.png)                      |
| `/history/result`               | [ผ่านรอบยืนยัน](-history-result-desktop.png)          | [ผ่าน](-history-result-mobile.png)               |
| `/clinic-detail`                | [ผ่าน](-clinic-detail-desktop.png)                    | [ผ่าน](-clinic-detail-mobile.png)                |
| `/403`                          | [ผ่าน](-403-desktop.png)                              | [ผ่าน](-403-mobile.png)                          |
| `/404`                          | [ผ่าน](-404-desktop.png)                              | [ผ่าน](-404-mobile.png)                          |
| `/500`                          | [ผ่าน](-500-desktop.png)                              | [ผ่าน](-500-mobile.png)                          |
| `/admin/dashboard`              | [ผ่าน](-admin-dashboard-desktop.png)                  | [ผ่าน](-admin-dashboard-mobile.png)              |
| `/admin/forms`                  | [ผ่าน](-admin-forms-desktop.png)                      | [ผ่าน](-admin-forms-mobile.png)                  |
| `/admin/forms/create`           | [ผ่านรอบยืนยัน](-admin-forms-create-desktop.png)      | [ผ่าน](-admin-forms-create-mobile.png)           |
| `/admin/forms/edit/101`         | [ผ่านรอบยืนยัน](-admin-forms-edit-101-desktop.png)    | [ผ่าน](-admin-forms-edit-101-mobile.png)         |
| `/admin/schedule`               | [ผ่าน](-admin-schedule-desktop.png)                   | [ผ่าน](-admin-schedule-mobile.png)               |
| `/admin/referrals`              | [ผ่าน](-admin-referrals-desktop.png)                  | [ผ่าน](-admin-referrals-mobile.png)              |
| `/admin/cases`                  | [ผ่าน](-admin-cases-desktop.png)                      | [ผ่าน](-admin-cases-mobile.png)                  |
| `/admin/roles`                  | [ผ่าน](-admin-roles-desktop.png)                      | [ผ่าน](-admin-roles-mobile.png)                  |
| `/admin/users`                  | [ผ่าน](-admin-users-desktop.png)                      | [ผ่าน](-admin-users-mobile.png)                  |
| `/admin/members`                | [ผ่าน](-admin-members-desktop.png)                    | [ผ่าน](-admin-members-mobile.png)                |
| `/admin/risk-cases`             | [ผ่าน](-admin-risk-cases-desktop.png)                 | [ผ่าน](-admin-risk-cases-mobile.png)             |
| `/admin/banner`                 | [ผ่าน](-admin-banner-desktop.png)                     | [ผ่าน](-admin-banner-mobile.png)                 |
| `/admin/clinics`                | [ผ่าน](-admin-clinics-desktop.png)                    | [ผ่าน](-admin-clinics-mobile.png)                |
| `/admin/help-center`            | [ผ่าน](-admin-help-center-desktop.png)                | [ผ่าน](-admin-help-center-mobile.png)            |
| `/admin/organizations`          | [ผ่าน](-admin-organizations-desktop.png)              | [ผ่าน](-admin-organizations-mobile.png)          |
| `/admin/school`                 | [ผ่าน](-admin-school-desktop.png)                     | [ผ่าน](-admin-school-mobile.png)                 |
| `/admin/school/students`        | [ผ่าน](-admin-school-students-desktop.png)            | [ผ่าน](-admin-school-students-mobile.png)        |
| `/admin/school/students/import` | [ผ่าน](-admin-school-students-import-desktop.png)     | [ผ่าน](-admin-school-students-import-mobile.png) |
| `/admin/school/teachers`        | [ผ่าน](-admin-school-teachers-desktop.png)            | [ผ่าน](-admin-school-teachers-mobile.png)        |
| `/admin/school/types`           | [ผ่าน](-admin-school-types-desktop.png)               | [ผ่าน](-admin-school-types-mobile.png)           |
| `/admin/master-data`            | [ผ่าน](-admin-master-data-desktop.png)                | [ผ่าน](-admin-master-data-mobile.png)            |
| `/admin/school/roles`           | [ผ่าน](-admin-school-roles-desktop.png)               | [ผ่าน](-admin-school-roles-mobile.png)           |
| `/admin/school/workflows`       | [ผ่าน](-admin-school-workflows-desktop.png)           | [ผ่าน](-admin-school-workflows-mobile.png)       |
| `/admin/profile`                | [ผ่าน](-admin-profile-desktop.png)                    | [ผ่าน](-admin-profile-mobile.png)                |

## หลักฐาน

ไฟล์ `audit-desktop.json` เก็บ findings รอบแรกเพื่อไม่ลบหลักฐานปัญหาเดิม; ผลตรวจแก้ไข 12 เส้นทางอ้างอิงจากรอบยืนยันที่ผ่านหลังแก้ (42.6 วินาที) ส่วน `audit-*-confirmation.json` เก็บการตรวจรูปสำรองคลินิกล่าสุด
ไฟล์ `audit-mobile.json`, `school-*.json`, `questions-*.json` เก็บผลตรวจที่ผ่านของแต่ละกลุ่ม; `../responsive-unification/after-*.json` เก็บผล responsive ทุกหน้า

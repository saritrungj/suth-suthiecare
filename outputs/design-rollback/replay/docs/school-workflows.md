# School screening and follow-up

Implementation plan: [school-implementation-plan.md](school-implementation-plan.md).

## Access

| Stable school role | Student scope | Allowed health data |
|---|---|---|
| `admin` | Assigned school | General roster and minimal mental-risk summary; no clinical details |
| `mental_admin` | Assigned school | Mental and physical records, family insights, guidance and case/referral work; school administration |
| `physical_admin` | Assigned school | Physical records/assessments only; no mental-risk summary, family insights, guidance or generic case/history bypass |
| `counselor` | Assigned school | Mental and physical records, family insights, guidance and case/referral work |
| `homeroom` | Assigned homeroom/co-homeroom classrooms | Mental and physical records for those students |
| `other` | Assigned classrooms | Minimal risk summary and school-configured care advice |
| `dorm_staff` | Boarders in assigned school | Minimal risk summary and school-configured care advice |

Classroom assignments and stable roles are both needed for homeroom insight access. A teacher type label does not grant access. Role revocation applies on the next request. Physical-only exports reuse the same domain checks as normal reads. No legacy account is automatically assigned a new clinical role.

## School workflow page

`/admin/school/workflows`, menu **คัดกรองและติดตามโรงเรียน**:

- **ภาพรวมความเสี่ยง:** student code, classroom, boarding status, latest mental risk/date and school-approved general care advice. No names, scores, answer IDs, individual assessment advice or family details.
- **รอบประเมิน:** academic year/semester, domain, existing form, start/end dates and open/closed state. Progress counts actual submissions inside the configured date window and organization, then restricts the students to the caller's scope. The existing School case list also filters by round/date.
- **คัดกรองซ้ำ:** source assessment, target mental form, eligible responsible staff and due date; pending/overdue/completed/cancelled states. Completion must link a different response to the target form from that student, submitted after the task was created. Current classroom/role access is checked again.
- **หอพักและเลื่อนชั้น:** independent boarding metadata, actual graduation date, classroom history and explicit source/destination room mapping into the following academic year. Preview counts before moving an entire classroom cohort. Source populations are snapshotted before updates to avoid double promotion through chained mappings.
- **นำเข้าครู:** Excel/CSV template, dry run, apply and one-time credentials download. Homeroom rows include grade, room and academic year; role and classroom assignment are written together.
- **เกณฑ์รายข้อ:** approved exact question/answer triggers. Grid questions also require an exact row. Backend submission handling evaluates actual answers, ignores client-supplied overrides and preserves the original questionnaire scores. A triggered high-risk marker is stored and returned to the student's result screen. No clinical default is seeded; changing a rule affects future submissions.
- **คำแนะนำและการเก็บข้อมูล:** school-configured advice by risk and retention duration counted from graduation. Preview excludes legal holds. Explicit archive closes School access; it does not delete shared patient accounts, person records or hospital medical records.

Physical fitness can be recorded alongside the existing physical examination and is encrypted in the measurement payload. Boarding metadata is separate from confidential `living_with` family information; verify the roster when setting the new boarding field.

## Onboarding

Student templates add `email`, optional `initial_password` and `is_boarder`. Initial passwords must meet the existing policy; blank values use a generated password. New accounts must change the password on first login, then can verify their imported email by OTP. Email recovery is available only after verification. The account menu also links to verification. Existing linked accounts retain their password and email.

Teacher templates include username, name, email, optional initial password, employee code, stable role and optional grade/room/year. Imports can create `other`, `homeroom`, `counselor` and `dorm_staff`; admin roles use the separate role page. Existing usernames are linked only when they are active members of the selected organization. Imported users receive a dedicated base role with no global rights; new email addresses remain unverified and use the existing staff email-verification flow. Existing account passwords remain unchanged.

Both import screens support up to 3,000 rows and submit in batches of 100; APIs accept at most 200 per request. Student and teacher credentials already returned by successful batches remain downloadable if a later batch fails. General reporting exports omit password values.

## Migration and verification

Apply `node scripts/migrateSchoolModule.js --apply` from `server/`. The runner includes `20261014_school_workflows.sql` after the existing School migrations. The new migration is rerunnable and was applied twice to local MySQL 8.4.8.

Tests include domain/API/export boundaries, boarder scope, exact grid-row risk triggers, server submission overrides, import parsing/validation, screening counts, promotion validation, legal-hold/graduation retention, desktop/mobile accessibility and browser batching for an 800-row synthetic roster. Local MySQL fixtures exercise real screening, teacher/account/classroom, history and retention SQL inside an outer transaction that is rolled back.

Production still requires migration/API/UI deployment, real rosters and teacher assignments, approved screening forms/risk triggers/care advice, and actual graduation dates. Archive is implemented; irreversible deletion and automatic execution of a shared medical-record retention policy are not enabled by this change.

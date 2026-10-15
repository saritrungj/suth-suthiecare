# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Staff of a working sub-unit organization (หน่วยงานย่อย), in Thai. Hospital
  type: clinic staff of the university hospital who follow up people screened
  by online assessments (most are university students, grouped by สำนักวิชา).
  School type: teachers and school staff who see students' mental and
  physical health, a teacher only for the classrooms assigned to them.
  _(Roles inferred from the code and CONTEXT.md; device use confirmed.)_
- Staff use the case pages on a phone about as often as on a computer, so
  every case task must work fully on a phone, not only reading.
- System admins manage organizations, members, roles, and forms.

## Product Purpose

Suthie Care collects health assessments online (public links, accounts, or
national ID with PDPA consent), scores them, and turns the results into
cases that staff triage, contact, follow up, and close. Success: nobody at
high risk is missed or left uncontacted, and follow-up is recorded.

## Positioning

One person file (แฟ้มบุคคล) joins every assessment and case of the same
person across clinics, matched by account or consented national ID hash,
never by name or phone. The same platform serves hospital clinics and
school organizations, switching menus and the case view by organization
type.

## Operating Context

- Case work is two equally important jobs: triage and follow-up (see who is
  at high risk or not yet contacted, open the case, record contact and
  status, move on) and review/reporting (answers per form, chosen columns,
  Excel and PDF export).
- Hospital case list is per form and date range, with a person view
  (ภาพรวมเคสผู้ป่วย) and an answer view (คำตอบแบบฟอร์ม). School case list is
  one row per student with latest mental and physical results.
- Case statuses are fixed: รอติดต่อ (รอดำเนินการ), นัดหมายสำเร็จ,
  ติดต่อไม่ได้ / ไม่รับสาย, ขอเลื่อนนัด, อยู่ระหว่างติดตามต่อเนื่อง,
  ปฏิเสธบริการ, ส่งต่อผู้เชี่ยวชาญ, ปิดเคสเรียบร้อย.

## Capabilities and Constraints

- React 19 + Vite front end (`app/`), Express + MySQL API (`server/`).
  UI work does not change API contracts or the database schema.
- Personal data is encrypted; names, phone numbers, and national IDs are
  masked in the UI (PDPA). Masking must stay.
- Thai is the primary UI language; dates are shown in the Buddhist era.

## Brand Commitments

- Keep the existing app look: brand orange (#f47932) with the darker action
  orange for solid buttons, Sarabun, grey canvas with white cards. Shared
  tokens live in `app/src/styles/tokens.css`.
- Keep the eight case status labels word for word.

## Evidence on Hand

- No real patient data may appear in designs or screenshots; use synthetic,
  labeled demonstration data.

## Product Principles

1. Risk first: the person who needs contact now is the easiest thing to find.
2. Same task on any device: a phone gets the whole workflow, not a summary.
3. Privacy by default: show the least personal data that does the job.
4. One person, one story: a case reads as the person's history, not a pile
   of form rows.

## Accessibility & Inclusion

- WCAG 2.1 AA. Risk is never shown by color alone: every risk color pairs
  with a word or a shape.

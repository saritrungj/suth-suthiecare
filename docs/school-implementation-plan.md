# School delivery plan — 14 October 2026

Implement the meeting requirements in the current checkout, preserving existing work.

## Delivery order and acceptance

1. **Access boundaries:** add mental-health admin, physical-health admin and dormitory staff. Keep the existing general admin. Physical-only staff cannot read mental assessments, counselling, referrals, or their exports. Homeroom staff retain classroom limits. General teachers and dorm staff get a separate minimal risk view with school-configured care advice.
2. **Enrollment:** store boarding status separately from confidential family insights, filter boarders, record graduation date and classroom history, bulk-promote a cohort using an explicit destination classroom mapping. Changing classroom assignments takes effect immediately.
3. **Onboarding:** add email and optional initial password to student Excel imports, preserve existing accounts, support teacher Excel imports with transactional preview/apply and active organization membership. Never mark imported email verified without the owner's verification. Existing email OTP verification/recovery is reused.
4. **Screening rounds:** configure academic year, semester, health domain, form and date window. Report eligible, submitted and outstanding students from actual responses. Add date/round filters to School results.
5. **Risk rules:** configure exact question/answer triggers against the saved form, evaluate on the server during submission, preserve original questionnaire scores and record the triggered rule separately. No clinical cutoff is invented or enabled by default.
6. **Re-screening:** create follow-up tasks linked to an original response, target form, responsible staff and due date. Link an actual subsequent response when completing a task, show pending/overdue/completed status.
7. **Physical fitness:** store optional fitness measurements with encrypted physical records.
8. **Retention:** configure a school policy counted from graduation, preview eligible records excluding legal holds, archive access to eligible enrollments after explicit execution. Preservation/deletion of shared hospital records requires the organization's approved data policy; never delete shared person/account/clinical records through enrollment cleanup.
9. **Verification:** meaningful role/API bypass, domain/export, import validation, round/date, follow-up and enrollment tests; full server/frontend suites and production build; desktop/mobile browser checks for the new workflow.

## Implementation choices

- Existing school `admin` remains a general management role; no legacy user is silently given mental access.
- Dorm staff see boarders in their assigned school; general teachers see assigned classrooms. School admins manage boarding status without gaining family/mental insight privileges.
- An email imported from a roster is unverified. School first-login onboarding asks the student to verify it before email recovery becomes available.
- Screening dates and clinical risk triggers are configurable, not fixed to a demonstration semester.
- Retention archives school access; it does not falsely claim that shared medical records have been erased. The approved deletion policy remains an operational dependency.
- This task implements and tests code. Production migration/deployment and receipt of school rosters are tracked separately.

## Deployment

Apply `node scripts/migrateSchoolModule.js --apply` to the intended environment before deploying API and frontend together. Assign the new roles, boarding statuses and rooms; test representative accounts; configure approved risk rules, screening rounds and retention policy; import the real roster and reconcile totals.

## Delivery status

Items 1–7 are implemented in API/UI. Item 8 implements approved graduation-based retention preview and explicit School archiving; irreversible deletion of shared clinical records and automatic execution remain outside the implemented archive workflow. The production deployment and real school data/configuration have not been performed.

Verification on 14 October 2026:

- Backend suite: 162 passed, 4 opt-in integration tests skipped in the ordinary run.
- Frontend unit suite: 50 passed.
- Opt-in local MySQL verification: 2 passed with synthetic writes rolled back.
- New School workflow Playwright suite: 10 passed across desktop/mobile, including accessibility checks and an 800-row synthetic CSV import through 100-row batches. This verifies browser batching, not production load capacity.
- Existing School management/master/export checks: 25 passed and 7 existing device/project skips; six initially failing desktop checks were corrected and all six passed on recheck.
- Production frontend build passed; pre-existing large-chunk warnings remain.
- School migration applied and replayed successfully on local MySQL 8.4.8. No production migration/deployment occurred.

Implementation and usage notes: [school-workflows.md](school-workflows.md).

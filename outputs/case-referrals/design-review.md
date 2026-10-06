# Case referrals — design review

Disposition: **ship**. This is an ordinary extension of the existing admin case surface. The finish review reports no material fixes; all four referral captures are valid and fidelity is recorded as matches or responsive adaptation. The detector ran once and returned `[]`.

## Evidence checked

- Product and incumbent direction: `app/PRODUCT.md`, `app/.impeccable/surfaces/app-src-pages-admin-casedata-jsx.md`.
- Shared system: `app/src/styles/tokens.css`, sampled page, button and drawer rules in `app/src/styles/case-workspace.css`, and the shared `CaseDrawer.jsx`.
- Extension: `app/src/pages/admin/CaseReferrals.jsx`, `CaseReferrals.css`, `app/src/components/case/CaseReferralPanel.jsx`, and `referralDisplay.js`.
- Rendered evidence: `.impeccable/review/referrals/desktop-chromium-list.png`, `desktop-chromium-detail.png`, `mobile-chromium-list.png`, and `mobile-chromium-detail.png`, compared with `.impeccable/review/case/desktop-hospital-drawer.png`.
- Implementation scope and verification record: `outputs/case-referrals/implementation.md`, plus the completed checks supplied by the implementing agent: 81 server tests passed with one database-gated skip; the real MySQL check passed separately; four desktop/mobile end-to-end checks and the production build passed. This documentation pass did not rerun those checks.

## Extension consistency

The first viewport presents incoming/outgoing direction, a status filter and a compact queue. Each row keeps masked identity, reference form, partner organization, written status and update time together. The desktop detail uses the existing 560px right drawer; the phone uses the same full-screen drawer and reorganizes queue rows without losing information. The form direction inherits the incumbent queue/drawer composition and seed `ff72cf95`; no new visual direction was introduced.

The workflow reads as send with a reason → accept → progress → complete with a summary → both organizations review the same history. The detail deliberately shows referral facts and shared summaries. The sending panel explains what the partner sees, and shared-note help text appears beside the field. Completion and rejection require a summary. Referral labels remain separate from the eight incumbent case statuses.

Five-line system summary:

1. Palette: grey canvas `#f5f7fa`, white surfaces, dark action orange `#c2410c`, and existing semantic status tokens.
2. Type: shared Sarabun stack; page title 1.5rem (1.3rem on phone), drawer title 1.35rem, section title 1.1rem, supporting text .85–.9rem; prose line-height 1.6–1.7.
3. Queue rule: white rows use 1px shared dividers and readable status words; no decorative card shadow is added.
4. Drawer rule: reuse the shared right drawer, overlay and motion; below the incumbent phone breakpoint it fills the viewport.
5. Control rule: reuse 44px controls, 10px control corners, 14px queue corners, action/secondary button variants and visible token-based focus rings.

These are observed extension-consistency notes, not new global design-system prescriptions. Thai copy, Bangkok/Buddhist-era date formatting, masked names and deliberate summary sharing follow the product constraints.

## Existing drift and boundary

The orange gradient sidebar and teal active-navigation treatment visible in the incumbent capture remain part of the existing app shell. They are outside this referral extension and are not promoted into new system rules or repaired here. No additional drift requiring a referral-specific material fix was found in the sampled evidence.

Only this review document was created. Incumbent brand and design files were preserved; no `DESIGN.md`, `.impeccable/design.json`, tokens or application code were created or changed by this pass.

# Design restored before 10:00

Reference: local Git tree `5240990c98674e4bc339656286eea3a3eab50e7e`, captured on 2026-10-15 at 09:57:32 Asia/Bangkok. Recovered 68 source and design files, including the shared palette, page CSS, public landing page, login/register, assessment result presentation, charts, and admin appearance. Later admin theme overrides are no longer imported.

Functional changes were retained: server and authorization work, organization routing, academic-year and guardian controls, searchable options, history detail navigation, empty-data handling, and the dashboard list correction. The supporting styles for new school/guardian controls remain. A pre-existing dialog-role error on the evaluation chart was not reintroduced.

Validation:

- Production build passed.
- Unit tests: 70 passed.
- Desktop admin browser tests: 6 passed.
- Mobile admin/public browser tests: 14 passed, including the targeted navbar recheck after aligning the assertion with the requested transparent navbar.
- Reviewed desktop and mobile screenshots of the restored admin page.
- Git whitespace check passed.

Recovery copies for all modified source/design files are in `before/`. The previous public-flow test is in `public-flows.before.js`. No Git reset, commit, or database mutation was performed.

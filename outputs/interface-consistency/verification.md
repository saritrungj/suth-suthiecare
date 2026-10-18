# Interface consistency verification

## Final implementation

Page CSS is scoped so visiting FAQ, risk cases or the dashboard cannot restyle another page. Shared primitives own appearance, layout roles own available space, and the interaction sheet owns focus/active/disabled treatment. Confirmations use action/danger/cancel tokens; explicit clinical and authored assessment colors retain their meanings.

All custom modal families use DialogFrame, or Dialog composed from it. The existing case drawer uses the same focus hook. Body portals, inert background, nested Escape handling, focus return, native button semantics, labels and error associations are shared. Search menus reposition without closing when a modal scrolls; active options scroll only inside their list. The editor header does not consume the canvas on narrow screens, option controls wrap below readable inputs, and the mobile toolbar scrolls locally with 44px targets.

## Checks

| Check                                                          | Result                                                                            | Evidence                                        |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------- |
| New interaction scenarios at 320, 900 and 1440px               | 24 passed                                                                         | `browser-verified.txt`                          |
| Editor controls after the final wrapping/target adjustments    | 3 passed                                                                          | `toolbar-confirm.txt`                           |
| Landscape editor/dialog and wide dashboard confirmation        | 1 passed                                                                          | `landscape-confirm.txt`                         |
| Route matrix: 42 routes × 3 viewports                          | No page overflow, clipped workspace, runtime error or unexpected redirect         | `route-matrix-summary.json`, `routes-final.txt` |
| Route scenarios including import/feedback and landscape        | 7 passed; 2 intentional duplicate-project skips                                   | `routes-final.txt`                              |
| Existing case, graph, school, component, auth and public flows | 67 distinct scenarios passed across the main run and recheck; 3 intentional skips | `regression.txt`, `regression-recheck.txt`      |
| Affected graph/search/navigation regression recheck            | 16 passed                                                                         | `regression-recheck.txt`                        |
| Existing unit suite                                            | 70 passed                                                                         | `unit.txt`                                      |
| Production build and SearchableSelect source check             | Passed                                                                            | `build-final.txt`                               |
| Mechanical scan of shared component/interaction surfaces       | No findings                                                                       | `design-scan-final.json`                        |
| Diff whitespace check on edited source                         | Passed                                                                            | Terminal check                                  |

The initial main regression run had two navigation timeouts while waiting for unrelated page assets. Those checks now wait for DOM readiness and verify the visible UI; both passed in the 16-case recheck. Vite ignores generated browser traces to avoid a Windows file-watch lock while tests write them.

The component suite also repeated WCAG 2 A/AA axe checks across 14 management routes on desktop/mobile with no violations; reports are in `../component-unification/`. Graph editor and evaluation-list accessibility checks passed in the original workflows. This is bounded automated evidence, not a claim of exhaustive accessibility coverage.

Rendered review covered staff/FAQ/banner dialogs, the cropped banner preview, and the narrow editor with actual options. All records and images are synthetic. Browser coverage is Chromium emulation; physical keyboard/safe-area behavior on real mobile devices remains separate device QA. Vite still reports its existing large-chunk advisory.

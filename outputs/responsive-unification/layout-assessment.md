# Mechanical layout assessment

Scope: `app/src`. No application source edited. Impeccable command `detect --json --scope layout app/src` completed successfully; raw result in `layout-scan.json` is `[]`. This is a source assessment; visual verification belongs to the independent rendered pass.

## Priority findings

1. **Admin shell sizing and global mobile inset.** `components/AdminLayout.jsx:22,36` specifies two inline `height:100vh` scroll roots with overflow hidden. `components/Sidebar.css:470-474` applies `body { padding-top:65px!important }` on every route <=1024px. The body inset is globally imported when an admin route loads; route transitions can retain a 65px gap on public pages. Admin children such as `.bm-wrapper` (`pages/admin/BannerManagement.css:7`), `.hc-admin-page` (`HelpCenterManager.css:6`), `.cm-admin-page` (`clinics/ClinicManager.css:6`) independently claim 100vh. Use a shell-owned height/inset contract and `min-height:0; flex:1` descendants. Verify admin at 820x1180 and landscape 1024x768, and public routes after navigating away from admin.
2. **Conflicting overlay layers.** Mobile `.sidebar` (`Sidebar.css:531`) uses z-index 100000 and drawer overlay 99999 (`:707`), while `.suth-dialog-overlay` (`styles/component-system.css:88`) uses 20000. Form authoring theme sidebar is 10000 (`FormBuilder.css:979`), result/history overlays 9999. A shared named layer scale should put navigation below dialogs; preserve intended menu/popover ordering rather than assigning ever higher numbers.
3. **Public history login is oversized by construction.** `.history-page` (`HistorySearch.css:309`) sets min-height150vh. `.history-container` (:322) reserves viewport minus72px and mobile (:558) adds margin-top230px. `.history-card-premium` (:564-573) uses 100vw with negative viewport margins and another viewport-based minimum height. This makes a short login task scroll far past the fold and hides it behind decorative imagery on short screens. Use content-sized layout, bounded image/intro region, ordinary width100% card, responsive page padding and viewport minimum only at the outer page.
4. **Form builder intermediate viewport.** `.sfb-builder-header`, `.sfb-header-left`, `.sfb-header-actions` (`FormBuilder.css:20-65`) have unwrapped flex groups, gaps15/25px; stacked header starts only <=768px (:1476). At 769-1024 the canvas already switches to mobile layout and fixed bottom toolbar, but header retains desktop density. Allow wrapping/shrinking earlier and keep save action visible with long form/clinic labels.
5. **Form builder bottom safe area.** `.sfb-floating-toolbar` (`FormBuilder.css:1444-1457`) is fixed bottom0, padding12px10px, no safe-area compensation. `.sfb-form-content` adds100px but canvas already also adds100px (:101), leading to excess blank room while home indicator can overlap bottom buttons. Use shared toolbar-height + safe-area inset and one content reserve; keep touch targets >=44px. Tiny row buttons (`:1590, :1603`) are only32px high.
6. **Sticky history filters assume obsolete header height.** `.hr-timeline-filter` (`HistoryResult.css:2037-2039`) sticky top70px changes to60px <=600px (:2088). Shared `.Navbar` is72px desktop,64px <=900px (`Navbar.css:5,128`). Use shared header-block-size role to avoid a 6px floating gap or overlap. Form editor has separate fixed top65px; that should derive from its own admin shell role.
7. **Global result modal overrides leak to other pages.** `pages/result/AssessmentResult.css:656-714` targets unscoped `.swal2-html-container label`, `.swal2-textarea`, `.swal2-popup`, `.swal2-actions`, `.swal2-styled` at <=480px. After result CSS loads, other route dialogs inherit this layout. Scope the feedback dialog using a dedicated SweetAlert customClass. `AssessmentResult.jsx:243` also has malformed inline `overflow:auto overflow-x:hidden` declaration.

## Justified fixed dimensions (do not mechanically remove)

- Icon, avatar, spinner and status-dot dimensions provide stable recognition; expand the containing hit target where needed.
- Shared controls have minimum height44px through `--suth-control-h`, and shared fields `min-width:0;max-width:100%` already provide a useful contract.
- `.hr-table` min-width400px (`HistoryResult.css:2086`) is inside `.hr-table-container{overflow-x:auto}`; preserve readable tabular comparison, verify local scrolling rather than forcing tiny cells.
- Form builder canvas max-width680px, result max-width800px, history max-width900px and normal dialog max-width560/920px are content measures, not responsive defects.
- Intentional horizontally scrolling clinic cards/carousels and chart inner minimum widths are justified if scroll remains local and affordances are visible. Their 480/420/380px image-card heights are an art-direction choice; ensure user task controls do not inherit them.
- Offcanvas sidebar width280px is reasonable on ordinary phones, but cap max-width to viewport minus visible dismissal affordance on narrow/zoomed screens.

## Reusable contracts suggested

- Content gutter:16px phone,24px tablet,32px desktop, shared bounded content width.
- Section rhythm:8/12px tight field groups,16px related controls,24px sections,32px major regions.
- Shared page header wraps actions without pushing title; toolbar wraps controls by container width, minimum field width capped by container.
- Admin root owns viewport and scrolling; each page root fills available space, one actual content scroll surface per region.
- Public task pages share content/intro/form/success layout roles while respecting author-defined assessment themes.

---
name: Suthie Care
description: Thai health-screening follow-up workspace for hospital clinics and schools; risk first, same task on any device, privacy by default.
colors:
  action: "#ff8a3d"
  action-hover: "#f47932"
  action-ink: "#b4470c"
  accent: "#ff8a3d"
  on-action: "#ffffff"
  ink: "#1f2f3f"
  ink-2: "#344a5f"
  muted: "#526578"
  canvas: "#f5f7fa"
  surface: "#ffffff"
  surface-2: "#f3f6f8"
  surface-hover: "#fffaf6"
  tint: "#fff4ec"
  tint-strong: "#ffeadc"
  tint-line: "#f5c3a3"
  line: "#d8e0e7"
  line-soft: "#e8edf1"
  control-line: "#afbdc7"
  danger: "#b42318"
  danger-tint: "#fef2f2"
  danger-line: "#f2c6c3"
  warning: "#9a4a07"
  warning-tint: "#fff3e0"
  warning-line: "#fed7aa"
  success: "#17663a"
  success-tint: "#e4f6eb"
  neutral-tint: "#eef2f6"
  info: "#1d5c8c"
  info-tint: "#e7f2fb"
  risk-dot-high: "#d92d20"
  risk-dot-medium: "#f79009"
  risk-dot-low: "#12b76a"
  info-line: "#bad5e8"
  success-line: "#bfe5cd"
  care: "#2f7d7a"
  care-ink: "#1d5a4c"
  care-deep: "#142738"
  care-tint: "#e3f1ef"
  care-line: "#c5d8d5"
  care-surface: "#f5f8f8"
typography:
  headline:
    fontFamily: "Anuphan, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Anuphan, system-ui, sans-serif"
    fontSize: "1.35rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  section:
    fontFamily: "Anuphan, system-ui, sans-serif"
    fontSize: "1.15rem"
    fontWeight: 800
    lineHeight: 1.4
  md:
    fontFamily: "Anuphan, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Anuphan, system-ui, sans-serif"
    fontSize: "0.94rem"
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "Anuphan, system-ui, sans-serif"
    fontSize: "0.88rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Anuphan, system-ui, sans-serif"
    fontSize: "0.82rem"
    fontWeight: 700
    lineHeight: 1.45
  caption:
    fontFamily: "Anuphan, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.4
  numeric:
    fontFamily: "Anuphan, system-ui, sans-serif"
    fontSize: "0.82rem"
    fontWeight: 400
    fontFeature: '"tnum" 1'
  display:
    fontFamily: "Anuphan, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 800
    lineHeight: 1.15
  display-lg:
    fontFamily: "Anuphan, system-ui, sans-serif"
    fontSize: "clamp(2rem, 4.4vw, 3rem)"
    fontWeight: 800
    lineHeight: 1.1
  code:
    fontFamily: "ui-monospace, Cascadia Mono, Consolas, monospace"
    fontSize: "0.82rem"
    fontWeight: 400
rounded:
  xs: "6px"
  sm: "8px"
  inner: "12px"
  control: "12px"
  icon: "14px"
  panel: "16px"
  card: "22px"
  hero: "28px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  gutter: "20px"
  page: "clamp(1rem, 3vw, 2.5rem)"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.on-action}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
    textColor: "{colors.on-action}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.action-ink}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
    height: "44px"
  button-ghost-hover:
    backgroundColor: "{colors.surface-2}"
  button-icon:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.control}"
    size: "40px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
    height: "44px"
  status-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
    height: "40px"
  status-chip-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-action}"
  risk-pill-high:
    backgroundColor: "{colors.danger-tint}"
    textColor: "{colors.danger}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "3px 10px 3px 8px"
  risk-pill-medium:
    backgroundColor: "{colors.warning-tint}"
    textColor: "{colors.warning}"
    rounded: "{rounded.pill}"
    padding: "3px 10px 3px 8px"
  risk-pill-low:
    backgroundColor: "{colors.success-tint}"
    textColor: "{colors.success}"
    rounded: "{rounded.pill}"
    padding: "3px 10px 3px 8px"
  risk-pill-none:
    backgroundColor: "{colors.neutral-tint}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "3px 10px 3px 8px"
  status-pill-active:
    backgroundColor: "{colors.info-tint}"
    textColor: "{colors.info}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "3px 10px 3px 8px"
  work-surface:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "clamp(0.875rem, 2vw, 1.25rem)"
  case-drawer:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    width: "560px"
  tab:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    padding: "8px 12px"
    height: "44px"
  tab-selected:
    textColor: "{colors.action-ink}"
---

# Design System: Suthie Care

## Overview

**Creative North Star: "The Follow-Up Ledger"**

Suthie Care is a working ledger for people who have to call someone back today. The page is a grey canvas carrying white work surfaces; inside them, information is ruled by 1px lines rather than boxed into tinted panels, numbers sit in tabular columns, and the only loud thing on screen is risk. The brand orange survives from the original app, and since 16 October 2026 it is one lighter, brighter orange (#ff8a3d) used for fills, selection and progress; text on it is white by the owner's choice (about 2.3:1, below WCAG AA).

Density is calm and operational, not dashboard-busy. A queue row shows a name, a case code, a risk pill and a status pill, and nothing else competes with them. Detail opens beside the list as a right-hand drawer, so staff never lose their place, and the drawer walks the follow-up as numbered steps. Phones get the same workflow, not a summary: rows become cards, the drawer goes full-screen, and every control grows to a 44px target.

Privacy is visual policy. Names, phone numbers and national IDs appear masked by default; dates appear in the Buddhist era. Neither is a styling choice to revisit per screen.

**Key Characteristics:**

- Grey canvas, white cards, 1px dividers; tint is for state, not for grouping.
- One bright orange (#ff8a3d) for fills and decoration; white text (--suth-on-action) on every orange fill. Orange text on white uses the deeper action-ink (#b4470c).
- Risk is always icon shape + word + color; status is always dot + verbatim word + color.
- Tabular numerals on every ID, count and date; Buddhist-era dates.
- Right-hand 560px case drawer with prev/next, a step rail, roving tabs and a sticky save.
- 44px controls on phones (at or below 760px); full-screen drawer and card queue.

## Colors

A cool slate-and-white working palette with one warm orange family and a restrained set of clinical status hues.

### Primary

- **Bright Orange** (action / accent, #ff8a3d): every solid button, the current step ring, checkbox accents, the sidebar surface. Text on it is white (on-action, owner decision; about 2.3:1, below AA). Hover deepens to **Ember** (action-hover, #f47932), which also marks the name of the open row.
- **Orange Ink** (action-ink, #b4470c): orange text on white or on tint (link-styled actions, selected tab label, secondary-button hover). Holds 5.4:1.

### Secondary

- **Clinical Blue** (info / info-tint): the "in progress" status family (นัดหมายสำเร็จ, ขอเลื่อนนัด, อยู่ระหว่างติดตามต่อเนื่อง, ส่งต่อผู้เชี่ยวชาญ). The only cool hue in the status set.

- **Care Teal** (care, care-ink, care-deep, care-tint, care-line, care-surface): the public assessment register only (the live-results panel beside a form, the sign-in prompt on a form, result cards). It never appears on admin pages and never marks an action.

### Tertiary

- **Alarm Red / Amber / Field Green** (danger, warning, success with their tints and lines): risk high/medium/low, attention statuses, error boxes, completed steps. Text colors are the dark members; tints are the pill backgrounds.
- **Risk dots** (risk-dot-high, risk-dot-medium, risk-dot-low): the saturated 8px dots in the status strip's risk chips. Shape-only markers beside a word, never text colors.

### Neutral

- **Harbor Ink** (ink): headings, names, values.
- **Slate Ink** (ink-2): body text in tables, secondary-button labels.
- **Fog Slate** (muted): sub-lines, meta, placeholders; holds 4.5:1 on white, canvas, line-soft and tint.
- **Clinic Grey** (canvas): the page ground behind every work surface.
- **Paper** (surface) and **Mist** (surface-2): cards and drawers; Mist is for structural bands (table header, step rail, mode-switch track, count badges, hover).
- **Warm Paper** (surface-hover), **Apricot Tint** (tint), **Apricot Strong** (tint-strong), **Apricot Line** (tint-line): the row hover, the open row, the current-step halo, chip hover border.
- **Rule** (line), **Soft Rule** (line-soft), **Control Stroke** (control-line): structural dividers, in-table row rules, and the stroke on inputs and secondary buttons respectively.

### Named Rules

**The Bright Orange Rule.** Every orange fill carries --suth-on-action (white). Orange text on a light surface uses action-ink (#b4470c).

**The Never Color Alone Rule.** Risk pairs color with an icon (triangle high, circle-alert medium, check low, minus none) and a word; status pairs color with a dot and its verbatim label. A grayscale screenshot must still say who is at high risk.

**The Tint Means State Rule.** Apricot tint marks the open or hovered thing. Grouping is done with 1px rules and whitespace, not tinted panels.

## Typography

**Display Font:** Anuphan (with system-ui)
**Body Font:** Anuphan (with system-ui)

**Character:** One Thai humanist sans for everything, carried by weight (400 to 800) rather than by size jumps. Headings are tightened slightly; labels and pills go heavy (700 to 800) at small sizes so Thai glyphs stay legible.

### Hierarchy

The scale is a fixed set of tokens in `tokens.css` (`--suth-fs-*`); CSS and inline styles use the token, never a literal size.

- **Hero** (`--suth-fs-hero`, 800, 1.5rem, 1.25, -0.02em; `--suth-fs-title` 1.35rem on phones): page title, balanced wrap, with a pill tag beside it for clinic or scope. One per page, in `PageHero`.
- **Title** (`--suth-fs-title`, 700, 1.35rem): the person's name at the top of the case drawer; modal titles.
- **Section** (`--suth-fs-section`, 800, 1.15rem): section titles inside a work surface.
- **Md** (`--suth-fs-md`, 1rem): lead text and public form inputs (16px stops iOS zoom).
- **Body** (`--suth-fs-body`, 400, 0.94rem, 1.5): table cells, inputs, buttons (700). Header descriptions cap at 68ch, empty-state copy at 52ch.
- **Body Small** (`--suth-fs-sm`, 0.88rem): secondary body, toolbars, result lines, pagination.
- **Label** (`--suth-fs-label`, 700, 0.82rem, 1.45): field labels, table headers (800), pills, chip counts, card meta.
- **Caption** (`--suth-fs-caption`, 700, 0.75rem): counts in badges, micro meta. Never body copy.
- **Display** (`--suth-fs-display`, `--suth-fs-display-lg`, 800): KPI numbers, public heroes and result scores only.
- **Numeric** (tabular figures): IDs, counts, dates, pagination, step numbers.
- **Code** (`ui-monospace, Cascadia Mono, Consolas, monospace`, 0.82rem): codes and slugs in tables (school codes, import keys).

### Named Rules

**The Tabular Ledger Rule.** Every number a person compares (case codes, counts, dates, page positions) uses tabular figures; date columns align right.

**The Weight Not Size Rule.** Hierarchy inside a surface comes from weight and ink color; the ramp tops out at 1.5rem.

## Layout

Pages are a full-height scrolling canvas with fluid padding (clamp(1rem, 3vw, 2.5rem)) and content capped at 1500px. The header is a wrapping flex row: title block left (flex basis 420px), actions right (mode switch, Export, primary action). Below it sits one white work surface holding, in order, the status strip (wrapping counted chips), the filter row (search, form, Buddhist-era date range always visible; the rest in a menu), the queue, and pagination.

The queue is a table on desktop inside a 12px-rounded scroll frame with a sticky header; in the answer view the person column is sticky left. At 760px and below it becomes a list of cards (8px gap), the mode switch and header actions go full-width, search and the filter menu share one row, the work surface drops its shadow and tightens to 12px padding, and every control reaches 44px.

Spacing runs on small steps: 4, 6, 8, 10, 12, 16, 20px. 20px is the drawer gutter (14px on phones); 12px separates blocks inside a surface; 1.25rem separates surfaces and the header.

## Elevation & Depth

Mostly flat with tonal layering: grey canvas, white surface, Mist bands. Shadows are few and soft, cool-tinted with the ink hue, and each has one job. On phones the work surface and drawer drop their shadows entirely.

### Shadow Vocabulary

- **Card rest** (`box-shadow: 0 6px 16px rgba(21, 40, 61, 0.08)`): white work surfaces and school cards on the canvas.
- **Pressed segment** (`box-shadow: 0 1px 3px rgba(21, 40, 61, 0.14)`): the selected button in the mode switch.
- **Menu** (`box-shadow: 0 12px 32px rgba(15, 23, 42, 0.16)`): dropdown menus in the drawer toolbar.
- **Drawer** (`box-shadow: -18px 0 48px rgba(15, 23, 42, 0.18)`): the case drawer over a 32% slate scrim.

### Stacking

Layers come from the `--z-*` tokens in `tokens.css` (sticky, raised, fab, sidebar, dropdown, popover, mobile top bar, drawer, modal, nested modal, mobile nav, toast, alert, portal menu). The drawer sits below modals because every dialog a drawer opens must land above it; a drawer opened from a drawer stacks by open order on the same layer. Plain values 1 to 10 are allowed only for ordering siblings inside one component (a badge over a card image, a drag handle over a card); anything that must clear another component uses a token.

### Named Rules

**The Flat Inside Rule.** Nothing inside a work surface or drawer casts a shadow except an open menu; inner structure is drawn with 1px rules.

## Shapes

Rounded and friendly (since 17 October 2026, the user's "modern, cute, เป็นกันเอง" brief for the dashboards, then every admin page). Every text button, tab, segmented switch, search box, date field and state label is a full pill; fields and textareas use 12px; frames inside a surface (table frame, menus, inner tiles) use 16px; cards, modals, drawers and work surfaces use 22px with the soft lifted shadow (`--suth-shadow-soft`); page header bands use 22px (compact) or 28px (dashboard). Icon-only and close buttons are 14px rounded squares (`--suth-radius-icon`). Two small steps sit under the field radius: 8px (`--suth-radius-sm`) for badges, thumbnails and inline chips, and 6px (`--suth-radius-xs`) for checkboxes and tiny markers inside a control. The 22px and 28px radii are deliberate (the owner's "modern, cute" brief); they are the scale, not drift. Borders are 1px; the only thicker strokes are the 2px step ring and the 3px focus outline. Empty states use a dashed 1px control-line border. The shared layer lives in `styles/kit-system.css` and `components/dashboard/DashboardKit.{jsx,css}` (`PageHero`, `KpiTile`, `DzSection`, `DateRangePills`); dates use `components/ThaiDatePicker.jsx`.

## Components

### Buttons

Solid, square-shouldered, quietly confident.

- **Shape:** gently rounded (10px), 44px minimum height, 10px 16px padding, 0.95rem weight 700, icon + label with an 8px gap.
- **Primary:** Bright orange fill and border, white text; one per header or footer.
- **Hover / Focus:** fill deepens to Ember over 160ms ease-out; focus is a 3px action-orange outline offset 2px. Disabled is 50% opacity.
- **Secondary:** white with a Control Stroke border and Slate Ink text; hover turns the border action orange and the text Orange Ink.
- **Ghost:** borderless; hover lays a Mist fill. A danger variant uses danger text on danger-tint hover.
- **Icon button:** 40px square (44px on phones), Rule border, same hover as secondary; always carries an aria-label.

### Button contracts

All admin buttons follow one of four contracts (styles/button-system.css, modal-system.css): **primary** (bright orange fill, white text), **secondary** (white, Control Stroke border, Slate Ink; hover turns border and label orange), **danger** (danger red fill, white text; only for confirm-delete) and **row action** (icon-sized, Control Stroke border; hover tint for edit, danger tint for delete). Height is 44px, radius 10px, focus is the 3px focus outline. Text greys come only from ink, ink-2 and muted; do not introduce new greys or a second accent hue.

### Chips

- **Style:** the status strip. Full-pill, white, 1px Rule border, 0.9rem weight 600, with a tabular count in a Mist pill. Risk chips add an 8px colored dot.
- **State:** pressed fills Harbor Ink with white text and a translucent count; hover warms the border to Apricot Line. Each chip filters the queue.

### Risk and Status Pills

The system's signature.

- **Risk pill:** full pill, 0.82rem weight 800, a 14px icon before the word; high red, medium amber, low green, none neutral.
- **Status pill:** same shape at weight 700 with a 7px dot before the verbatim status label. Five tones: new (Apricot tint, Orange Ink), waiting (amber), attention (red: ติดต่อไม่ได้ / ไม่รับสาย, ปฏิเสธบริการ), active (Clinical Blue), closed (neutral).

### Cards / Containers

- **Corner Style:** 14px for work surfaces, 12px for phone queue cards.
- **Background:** Paper on Clinic Grey.
- **Shadow Strategy:** Card rest on desktop, none on phones (see Elevation).
- **Border:** none on surfaces; 1px Rule on phone cards. The open card takes an accent border and Apricot tint.
- **Internal Padding:** clamp(0.875rem, 2vw, 1.25rem); phone cards 8px 14px 12px.

### Inputs / Fields

- **Style:** 44px tall, 1px Control Stroke, 10px radius, white, 0.95rem ink text; labels sit above in 0.82rem weight 700.
- **Focus:** wrapped controls (search, date range) take an action-orange border plus a 3px action-orange ring; selects take a 3px outline.
- **Dates:** the visible text is the Buddhist-era date in tabular figures; the native picker sits invisibly on top.

### Navigation

- **Mode switch:** a segmented control on a Mist track (12px radius, 3px inset); the pressed segment turns white with the pressed-segment shadow. Full-width with equal segments on phones.
- **Drawer tabs:** a roving tablist; muted labels, selected label in Orange Ink with a 3px bright-orange underline, counts in Mist pills. Equal-width on phones.
- **Queue rows:** the person's name is a weight-800 button; hover underlines it 2px in Orange Ink; the open row is tinted Apricot.

### Case Drawer

A 560px right-hand dialog over a 32% slate scrim, sliding in 32px over 260ms (cubic-bezier(0.16, 1, 0.3, 1)); full-screen on phones; no animation under reduced motion. Header: prev/next with a tabular "n / N" position, tool menus, close; then the name (Title), meta line, and risk + status pills. Below it, a four-step rail on a Mist band (ติดต่อ, บันทึกติดตาม, นัด/ส่งต่อ, ปิดเคส): numbered 24px rings, a green filled ring when done, a red ring with a small reason when attempted, an action-orange ring with an Apricot halo when current. Then tabs, a scrolling body (16px gap), and a sticky white save bar with a top rule. Every drawer, for every organization type (hospital case, school student file, referral), opens its body on the same ruled record line: latest activity (caption, bold title, tabular time, no tinted box) with Export Excel at its end. Body sections share one 1rem/700 heading, a soft rule between sections, and the same label-over-value fact grid; header pills (risk, status, enrolment, referral status) all use the full-pill shape. Focus is trapped inside, Escape closes the top dialog only, and focus returns to the opener.

### Empty and Loading

Empty states are centered in a dashed 12px frame: icon, a bold one-line title, at most 52ch of muted help. Loading is a stack of 52px Soft Rule bars pulsing to 45% opacity.

## Do's and Don'ts

### Do:

- **Do** pair every orange fill with --suth-on-action (white).
- **Do** render risk with the shared risk pill (icon + word + color) and status with the status pill (dot + verbatim label); keep the eight status labels exactly as written.
- **Do** give every control a 44px minimum at 760px and below, including icon buttons, chips, tabs, steps and date cells.
- **Do** set IDs, counts and dates in tabular figures and show dates in the Buddhist era.
- **Do** open case detail in the right-hand drawer beside the list, with prev/next, and keep the save action sticky at the drawer foot.
- **Do** show focus as a 3px action-orange outline with a 2px offset.
- **Do** separate content inside a surface with 1px Rule or Soft Rule lines.

### Don't:

- **Note:** white on #ff8a3d is about 2.3:1 and fails WCAG AA; the owner accepted this on 16 Oct 2026.
- **Don't** convey risk or status by color alone, and don't paraphrase or abbreviate a status label.
- **Don't** wrap sections inside a surface in tinted boxes; Apricot tint means open, hovered or current.
- **Don't** unmask names, phone numbers or national IDs in list or card views, or use real personal data in screenshots.
- **Don't** introduce a second accent hue for headings or primary actions; the clinical blue belongs to the in-progress status family only.
- **Don't** add shadows inside work surfaces or drawers other than an open menu.

# UI Modernization (CSS-only Visual Refresh) — Design

Date: 2026-10-08
Status: Approved by user (scope: CSS-only; style: Linear/Vercel dark; density: compact-refined)
Approach: A — in-place rewrite of `www/css/style.css`, all existing selectors preserved

## Goal

Modernize the look of the web UI with **zero HTML structure changes and zero JS
behavior changes**. Only `www/css/style.css` is rewritten. Every existing
selector, state class and responsive rule survives; layout rules
(grid/flex/size/position) are kept as-is; only "skin" properties change
(colors, typography, radius, shadows, borders, transitions).

## Non-Goals

- No layout restructuring, no component relocation, no new panels
- No light theme (dark only; tokens make a future theme possible)
- No new dependencies, no external fonts, no build changes
- Timeline / bitrate **canvas-internal** I/P/B colors stay unchanged (they are
  hard-coded in app.js draw code; CSS only skins the container + legend text
  that must not contradict canvas colors)

## Design Tokens (`:root`)

| Token | Value |
|-------|-------|
| Surfaces (3 layers) | page `#0b0d12` → panel `#10131a` → elevated `#161a23`; field `#0d1017` |
| Borders | `rgba(255,255,255,.07)` and strong `.12` |
| Text | `#e7eaf0` / dim `#8b93a5` / faint `#5d6474` |
| Accent | indigo `#6e7ff2`; hover `#8593ff`; soft `rgba(110,127,242,.13)`; glow `rgba(110,127,242,.35)` |
| Semantic | danger `#f0616d`, warn `#e8b45a`, ok `#57c785` (warnings table, legend text) |
| Radius | 6px controls / 10px panels / 14px modals / 999px pills |
| Type | `ui-sans-serif` stack + `ui-monospace`; base font 12px → **13px** |
| Motion | 0.12s fast / 0.18s medium; disabled under `prefers-reduced-motion` |

WCAG: text pairs must reach AA (≥4.5:1 normal, ≥3:1 large/bold) — verified
programmatically at acceptance.

## Component Treatment (selector-preserving)

- **Chrome (topbar/statusbar)**: solid elevated surfaces with fine borders
  (panels scroll internally — nothing moves beneath, so backdrop blur there
  would be a no-op; blur is applied where it is real: sticky `thead`,
  modal overlay, timeline tooltip)
- **panel-title**: 11px uppercase, letter-spacing .08em (Linear-style section head)
- **splitter**: near-invisible track, accent grip on hover/dragging
  (`.splitter.dragging` kept)
- **Buttons**: primary = indigo gradient + hover glow; secondary = translucent
  surface + brighten; global `:focus-visible` 2px ring
- **Tabs**: boxy → underline style (transparent bg, active = accent text +
  2px glowing bottom bar); `.tab.active` kept
- **Dropzone**: 16px radius, gradient halo on hover/dragover; extension chips
- **Stats bar**: each `.stat` becomes a pill chip
- **NAL rows**: height stays **22px** (app.js `ROW_HEIGHT = 22` drives virtual
  scrolling — CSS height must match); hover `rgba(255,255,255,.04)`; selected =
  accent-soft + 2px inset accent bar; zebra: none
- **Syntax tree**: dotted guides → 1px solid `rgba(255,255,255,.06)`; group
  color harmonized with accent
- **Tables (warnings/SEI)**: sticky translucent thead, row hover, wrapped in
  rounded corners
- **Inputs/selects**: dark field bg + accent focus ring
- **Scrollbars**: global slim overlay style (WebKit 10px thumb, Firefox
  `scrollbar-width: thin` + `scrollbar-color`); dark translucent thumb
- **Modals**: overlay `blur(8px)`, 14px card, layered soft shadow, 0.15s
  scale-in; `.timeline-tip` → dark pill
- **Codec/version badges, chips**: pill + soft glow
- **Mobile (≤768px)**: all existing `@media` rules and
  `body[data-mobile-view=…]` mechanisms preserved, inherit new tokens

## Constraints

- JS-coupled classes kept verbatim: `.hidden` (`!important`),
  `.dragging`, `.dragover`, `.active`, `.selected`, `.fit`,
  `data-mobile-view`
- Canvas containers keep equivalent padding — app.js reads
  `clientWidth/clientHeight` to size canvases
- No `!important` added anywhere (except keeping `.hidden`'s)
- No property that JS overwrites inline (element.style) is relied upon

## Acceptance

1. **Selector parity** (scripted): selector set of new CSS ⊇ selector set of
   old CSS (missing selector = FAIL)
2. **CSS syntax** (scripted): balanced braces/parens, no empty rules, valid
   at-rule nesting
3. **WCAG contrast** (scripted): token text pairs ≥ AA
4. **Visual review** (headless Chrome screenshots, reviewed as images):
   - Dropzone: desktop 1440x900 + mobile 375x700
   - Loaded H.264 file: NAL list + timeline + tabs (each tab captured)
   - Loaded raw YUV 320x240 I420: YUV settings bar + preview canvas + stats
   - Help modal open
   - Test harness drives the app via DOM events only (temporary files in
     `dist/`, never committed)
5. All screenshots reviewed and approved before commit (per user instruction:
   commit only after acceptance passes)

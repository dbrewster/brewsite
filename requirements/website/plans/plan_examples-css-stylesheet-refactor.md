---
title: "Examples App CSS Stylesheet Refactor"
doc_type: plan
owner: Toolkit Product
status: draft
last_updated: 2026-03-20
change_history:
  - date: 2026-03-20
    author: Toolkit Product
    summary: "Initial plan. Defines stylesheet architecture, token files per theme family, component classes, and per-page migration instructions."
---

# Examples App CSS Stylesheet Refactor

## Goal

Replace all inline styles in `apps/examples/src/` with CSS stylesheets that respond to theme family and polarity changes. Every example page must render correctly for all 6 theme families × 2 polarities (12 combinations) with zero inline `style={{}}` blocks for colors, fonts, backgrounds, or borders.

## Principles

1. **No inline styles for themeable properties.** Colors, backgrounds, borders, fonts, and opacity values must come from CSS variables. Layout properties (flex, grid, position, inset, z-index, width, height) may remain inline where they are page-specific and not theme-dependent.
2. **One token file per theme family.** Dark and light polarities live in the same file.
3. **Class names are invariant.** Theme switching changes CSS variable values via data attributes — never class names.
4. **No published package changes.** This is entirely within `apps/examples/`.

## Architecture

### File Structure

```
apps/examples/src/
  styles/
    tokens/
      _base.css              ← default fallback values + shared non-theme tokens
      darkGlass.css           ← [data-family="darkGlass"] dark + light variables
      enterprise.css          ← [data-family="enterprise"] dark + light variables
      midnight.css            ← [data-family="midnight"] dark + light variables
      neonCyber.css           ← [data-family="neonCyber"] dark + light variables
      lightCanvas.css         ← [data-family="lightCanvas"] dark + light variables
      lightMinimal.css        ← [data-family="lightMinimal"] dark + light variables
    components.css            ← all component classes (header, card, badge, button, sidebar, overlay, etc.)
    layout.css                ← page containers, flex/grid utilities, z-index layers
    index.css                 ← imports all the above in order
  hooks/
    useThemeCss.ts            ← sets data-family + data-polarity on <html>
```

### Import Chain

`main.tsx` imports `./styles/index.css` once at the top level. That file imports everything:

```css
/* apps/examples/src/styles/index.css */
@import './tokens/_base.css';
@import './tokens/darkGlass.css';
@import './tokens/enterprise.css';
@import './tokens/midnight.css';
@import './tokens/neonCyber.css';
@import './tokens/lightCanvas.css';
@import './tokens/lightMinimal.css';
@import './layout.css';
@import './components.css';
```

### Data Attribute Contract

The `<html>` element carries two data attributes:

```html
<html data-family="darkGlass" data-polarity="dark">
```

CSS selectors use the compound form:

```css
[data-family="darkGlass"][data-polarity="dark"] {
  --ex-bg: #070504;
  --ex-text: #ffe8d7;
  /* ... */
}

[data-family="darkGlass"][data-polarity="light"] {
  --ex-bg: #F8F3EF;
  --ex-text: #2a1810;
  /* ... */
}
```

---

## CSS Variable Token Set

### Token Names

Every token file defines the same set of variables. The `--ex-` prefix scopes these to the examples app.

| Variable | Purpose | Example (darkGlass/dark) |
|---|---|---|
| `--ex-bg` | Page background color (solid) | `#070504` |
| `--ex-bg-gradient` | Page background gradient (overrides bg if set) | `linear-gradient(180deg, #070504, #130B08)` |
| `--ex-text` | Primary text color | `#ffe8d7` |
| `--ex-text-muted` | Secondary/muted text | `rgba(255,232,215,0.5)` |
| `--ex-text-code` | Monospace/code text | `rgba(190,215,255,0.72)` |
| `--ex-surface` | Elevated surface (cards, panels) | `rgba(255,255,255,0.03)` |
| `--ex-surface-hover` | Surface on hover | `rgba(255,255,255,0.06)` |
| `--ex-border` | Default border color | `rgba(255,255,255,0.08)` |
| `--ex-border-hover` | Border on hover | `rgba(255,255,255,0.15)` |
| `--ex-accent` | Accent/brand color | `#E36A2E` |
| `--ex-accent-text` | Text on accent backgrounds OR accent-tinted text | `#E36A2E` |
| `--ex-accent-surface` | Accent-tinted surface (active cards, selected items) | `rgba(227,106,46,0.1)` |
| `--ex-accent-border` | Accent-tinted border | `rgba(227,106,46,0.3)` |
| `--ex-active` | Active/success indicator color | `#4ade80` |
| `--ex-active-surface` | Active indicator background | `rgba(0,255,100,0.1)` |
| `--ex-active-border` | Active indicator border | `rgba(0,255,100,0.25)` |
| `--ex-danger` | Danger/error color | `#F87171` |
| `--ex-danger-surface` | Error background | `rgba(200,40,40,0.8)` |
| `--ex-overlay-bg` | Modal/overlay backdrop | `rgba(0,0,0,0.7)` |
| `--ex-overlay-surface` | Elevated overlay panel (dropdown menu) | `rgba(16,16,28,0.97)` |
| `--ex-chrome-gradient-top` | Top chrome gradient | `linear-gradient(rgba(3,5,12,0.55), transparent)` |
| `--ex-chrome-gradient-bottom` | Bottom chrome gradient | `linear-gradient(transparent, rgba(2,4,12,0.75))` |
| `--ex-font` | UI font family | `system-ui, -apple-system, sans-serif` |
| `--ex-font-mono` | Monospace font family | `ui-monospace, "SF Mono", Menlo, monospace` |
| `--ex-radius` | Default border radius | `6px` |
| `--ex-radius-sm` | Small border radius (badges) | `3px` |
| `--ex-radius-lg` | Large border radius (dropdowns, modals) | `10px` |
| `--ex-shadow` | Dropdown/elevated shadow | `0 16px 48px rgba(0,0,0,0.5)` |
| `--ex-backdrop-blur` | Default backdrop blur value | `blur(12px)` |

### Non-Themeable Shared Tokens (in `_base.css`)

These do not change per theme:

```css
:root {
  /* Z-index scale */
  --ex-z-canvas: 0;
  --ex-z-canvas-scene: 1;
  --ex-z-controls: 10;
  --ex-z-timeline: 20;
  --ex-z-chrome: 100;
  --ex-z-close-btn: 110;
  --ex-z-header: 200;
  --ex-z-dropdown: 1000;

  /* Transition timing */
  --ex-transition-fast: 0.15s ease;
  --ex-transition-normal: 0.3s ease;

  /* Header height */
  --ex-header-height: 48px;

  /* Fallback values (dark neutral) — overridden by family tokens */
  --ex-bg: #0a0a1a;
  --ex-bg-gradient: none;
  --ex-text: #e0e0e8;
  --ex-text-muted: rgba(255,255,255,0.5);
  --ex-text-code: rgba(190,215,255,0.72);
  --ex-surface: rgba(255,255,255,0.03);
  --ex-surface-hover: rgba(255,255,255,0.06);
  --ex-border: rgba(255,255,255,0.08);
  --ex-border-hover: rgba(255,255,255,0.15);
  --ex-accent: #a5b4fc;
  --ex-accent-text: #a5b4fc;
  --ex-accent-surface: rgba(99,102,241,0.08);
  --ex-accent-border: rgba(99,102,241,0.25);
  --ex-active: #4ade80;
  --ex-active-surface: rgba(0,255,100,0.1);
  --ex-active-border: rgba(0,255,100,0.25);
  --ex-danger: #F87171;
  --ex-danger-surface: rgba(200,40,40,0.8);
  --ex-overlay-bg: rgba(0,0,0,0.7);
  --ex-overlay-surface: rgba(16,16,28,0.97);
  --ex-chrome-gradient-top: linear-gradient(rgba(3,5,12,0.55), transparent);
  --ex-chrome-gradient-bottom: linear-gradient(transparent, rgba(2,4,12,0.75));
  --ex-font: system-ui, -apple-system, sans-serif;
  --ex-font-mono: ui-monospace, "SF Mono", Menlo, monospace;
  --ex-radius: 6px;
  --ex-radius-sm: 3px;
  --ex-radius-lg: 10px;
  --ex-shadow: 0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04);
  --ex-backdrop-blur: blur(12px);
}
```

---

## Token File Template

Each theme family file follows this structure. Values are hand-authored to match the aesthetic of the corresponding `SceneTheme` while being appropriate for HTML page chrome (not identical — page chrome may need different opacities or surface treatments than 3D content).

### Example: `tokens/darkGlass.css`

```css
/* darkGlass — obsidian/burgundy control-room with ember accents */

[data-family="darkGlass"][data-polarity="dark"] {
  --ex-bg: #070504;
  --ex-bg-gradient: linear-gradient(180deg, #070504 0%, #130B08 100%);
  --ex-text: #f0ddd0;
  --ex-text-muted: rgba(240,221,208,0.5);
  --ex-text-code: rgba(224,168,120,0.75);
  --ex-surface: rgba(255,200,160,0.04);
  --ex-surface-hover: rgba(255,200,160,0.08);
  --ex-border: rgba(107,67,56,0.3);
  --ex-border-hover: rgba(107,67,56,0.5);
  --ex-accent: #E36A2E;
  --ex-accent-text: #E8834E;
  --ex-accent-surface: rgba(227,106,46,0.1);
  --ex-accent-border: rgba(227,106,46,0.3);
  --ex-overlay-bg: rgba(7,5,4,0.85);
  --ex-overlay-surface: rgba(19,11,8,0.97);
  --ex-chrome-gradient-top: linear-gradient(rgba(19,11,8,0.65), transparent);
  --ex-chrome-gradient-bottom: linear-gradient(transparent, rgba(7,5,4,0.75));
  --ex-shadow: 0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(107,67,56,0.15);
}

[data-family="darkGlass"][data-polarity="light"] {
  --ex-bg: #F8F3EF;
  --ex-bg-gradient: linear-gradient(180deg, #F8F3EF 0%, #EFE6DE 100%);
  --ex-text: #2a1810;
  --ex-text-muted: rgba(42,24,16,0.5);
  --ex-text-code: rgba(120,60,30,0.75);
  --ex-surface: rgba(0,0,0,0.04);
  --ex-surface-hover: rgba(0,0,0,0.07);
  --ex-border: rgba(0,0,0,0.1);
  --ex-border-hover: rgba(0,0,0,0.18);
  --ex-accent: #B85520;
  --ex-accent-text: #9A4518;
  --ex-accent-surface: rgba(184,85,32,0.08);
  --ex-accent-border: rgba(184,85,32,0.2);
  --ex-active: #16a34a;
  --ex-active-surface: rgba(22,163,74,0.1);
  --ex-active-border: rgba(22,163,74,0.25);
  --ex-danger: #dc2626;
  --ex-danger-surface: rgba(220,38,38,0.15);
  --ex-overlay-bg: rgba(248,243,239,0.85);
  --ex-overlay-surface: rgba(239,230,222,0.97);
  --ex-chrome-gradient-top: linear-gradient(rgba(248,243,239,0.65), transparent);
  --ex-chrome-gradient-bottom: linear-gradient(transparent, rgba(239,230,222,0.75));
  --ex-shadow: 0 16px 48px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06);
}
```

### Files to Create

Repeat the pattern for all 6 families. Color values should be derived by eye from the corresponding scene theme presets in `packages/themes/src/presets/scene/`:

| Token file | SceneTheme source | Accent color (dark) | Aesthetic |
|---|---|---|---|
| `darkGlass.css` | `presets/scene/darkGlass.ts` | `#E36A2E` (ember) | Obsidian/burgundy control room |
| `enterprise.css` | `presets/scene/enterprise.ts` | `#3B82F6` (blue) | Clean corporate |
| `midnight.css` | `presets/scene/midnight.ts` | `#818CF8` (indigo) | Deep navy/purple |
| `neonCyber.css` | `presets/scene/neonCyber.ts` | `#00E7FF` (cyan) | Electric neon |
| `lightCanvas.css` | `presets/scene/lightCanvas.ts` | `#059669` (emerald) | Warm canvas |
| `lightMinimal.css` | `presets/scene/lightMinimal.ts` | `#6366F1` (indigo) | Clean minimal |

For light-first families (`lightCanvas`, `lightMinimal`), the dark polarity variant should still look good — derive appropriate dark-mode values that carry the family's character.

---

## Component Classes

### `layout.css` — Structural Patterns

```css
/* Page container — used by every page */
.ex-page {
  position: relative;
  display: flex;
  flex-flow: column;
  height: 100vh;
  overflow: hidden;
  background: var(--ex-bg-gradient, var(--ex-bg));
  color: var(--ex-text);
  font-family: var(--ex-font);
}

/* Canvas positioning (not theme-dependent, but standardized) */
.ex-canvas-layer {
  position: absolute;
  inset: 0;
}

/* Full-bleed content area below header */
.ex-content {
  flex: 1;
  overflow: hidden;
  display: flex;
}

/* Flex column that fills remaining space */
.ex-fill-column {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  overflow: hidden;
}

/* Sidebar — responsive width */
.ex-sidebar {
  width: clamp(220px, 28vw, 360px);
  flex-shrink: 0;
  padding: 1.5rem 2rem;
  overflow-y: auto;
  border-right: 1px solid var(--ex-border);
}

/* Sidebar in mobile layout */
@media (max-width: 700px) {
  .ex-sidebar {
    width: 100%;
    max-height: 38vh;
    padding: 1rem 1.5rem;
    border-right: none;
    border-bottom: 1px solid var(--ex-border);
  }
}

/* Content scroll area */
.ex-scroll-content {
  flex: 1;
  overflow-y: auto;
  padding: 2rem 2.5rem;
}

/* Grid for example cards on landing page */
.ex-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
  max-width: 960px;
}

/* Three-column info grid (canvas-region layout techniques) */
.ex-info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin: 20px 0;
}
```

### `components.css` — Themed Components

```css
/* ─── Header ─────────────────────────────────────────────────────── */

.ex-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: var(--ex-header-height);
  flex-shrink: 0;
  border-bottom: 1px solid var(--ex-border);
  background: var(--ex-surface);
  font-family: var(--ex-font);
  color: var(--ex-text);
  position: relative;
  z-index: var(--ex-z-header);
}

/* Header menu trigger button */
.ex-header__menu-trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  background: transparent;
  border: none;
  border-radius: var(--ex-radius);
  padding: 6px 12px 6px 8px;
  margin: -6px -12px -6px -8px;
  cursor: pointer;
  color: inherit;
  font-size: 14px;
  font-family: inherit;
  transition: background var(--ex-transition-fast);
}

.ex-header__menu-trigger:hover {
  background: var(--ex-surface-hover);
}

.ex-header__menu-trigger[aria-expanded="true"] {
  background: var(--ex-surface-hover);
}

.ex-header__title {
  font-weight: 600;
  letter-spacing: 0.02em;
}

.ex-header__chevron {
  opacity: 0.4;
  transition: transform 0.2s ease;
}

.ex-header__chevron--open {
  transform: rotate(180deg);
}

.ex-header__right {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ─── Dropdown Menu ──────────────────────────────────────────────── */

.ex-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: -8px;
  width: 360px;
  max-height: calc(100vh - 80px);
  overflow-y: auto;
  background: var(--ex-overlay-surface);
  backdrop-filter: var(--ex-backdrop-blur);
  border: 1px solid var(--ex-border-hover);
  border-radius: var(--ex-radius-lg);
  box-shadow: var(--ex-shadow);
  padding: 6px;
  z-index: var(--ex-z-dropdown);
}

.ex-dropdown__header {
  padding: 10px 12px 8px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--ex-accent-text);
  opacity: 0.6;
}

.ex-dropdown__item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 100%;
  padding: 10px 12px;
  background: transparent;
  border: none;
  border-radius: var(--ex-radius);
  cursor: pointer;
  text-align: left;
  color: inherit;
  font-family: inherit;
  transition: background 0.1s ease;
}

.ex-dropdown__item:hover {
  background: var(--ex-surface-hover);
}

.ex-dropdown__item--active {
  background: var(--ex-accent-surface);
}

.ex-dropdown__item-label {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ex-dropdown__item-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--ex-border-hover);
  flex-shrink: 0;
}

.ex-dropdown__item--active .ex-dropdown__item-dot {
  background: var(--ex-accent);
}

.ex-dropdown__item-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--ex-text-muted);
}

.ex-dropdown__item--active .ex-dropdown__item-name {
  font-weight: 600;
  color: var(--ex-text);
}

.ex-dropdown__item-desc {
  font-size: 11px;
  line-height: 1.4;
  color: var(--ex-text-muted);
  opacity: 0.5;
  padding-left: 12px;
}

/* ─── Cards ──────────────────────────────────────────────────────── */

.ex-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px 18px;
  border-radius: var(--ex-radius);
  background: var(--ex-surface);
  border: 1px solid var(--ex-border);
  text-decoration: none;
  color: inherit;
  transition: background var(--ex-transition-fast), border-color var(--ex-transition-fast);
}

.ex-card:hover {
  background: var(--ex-accent-surface);
  border-color: var(--ex-accent-border);
}

.ex-card__title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ex-card__name {
  font-size: 14px;
  font-weight: 600;
}

.ex-card__desc {
  font-size: 12px;
  color: var(--ex-text-muted);
  line-height: 1.4;
}

/* ─── Badge ──────────────────────────────────────────────────────── */

.ex-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: var(--ex-radius-sm);
  background: var(--ex-accent-surface);
  color: var(--ex-accent-text);
  font-family: var(--ex-font-mono);
  font-weight: 500;
  white-space: nowrap;
}

/* ─── Buttons ────────────────────────────────────────────────────── */

/* Ghost button (stats toggle, toolbar controls) */
.ex-btn-ghost {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  background: transparent;
  border: 1px solid var(--ex-border);
  border-radius: var(--ex-radius);
  cursor: pointer;
  color: var(--ex-text-muted);
  font-size: 11px;
  font-family: var(--ex-font-mono);
  font-weight: 500;
  transition: all var(--ex-transition-fast);
}

.ex-btn-ghost:hover {
  border-color: var(--ex-border-hover);
  color: var(--ex-text);
}

.ex-btn-ghost--active {
  background: var(--ex-active-surface);
  border-color: var(--ex-active-border);
  color: var(--ex-active);
}

/* Primary button (capture, action) */
.ex-btn-primary {
  padding: 12px 20px;
  background: var(--ex-accent);
  color: #fff;
  border: 1px solid var(--ex-accent-border);
  border-radius: var(--ex-radius);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font-family: var(--ex-font);
  backdrop-filter: blur(8px);
  transition: background var(--ex-transition-fast);
}

.ex-btn-primary:hover {
  filter: brightness(1.1);
}

/* Muted button (stop capture, secondary actions) */
.ex-btn-muted {
  padding: 12px 20px;
  background: var(--ex-surface-hover);
  color: var(--ex-text);
  border: 1px solid var(--ex-border-hover);
  border-radius: var(--ex-radius);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font-family: var(--ex-font);
  backdrop-filter: blur(8px);
  transition: background var(--ex-transition-fast);
}

/* Close button (circular X) */
.ex-close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: var(--ex-z-close-btn);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--ex-overlay-bg);
  border: 1px solid var(--ex-border-hover);
  color: var(--ex-text);
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(8px);
  transition: background 0.2s;
}

.ex-close-btn:hover {
  background: var(--ex-danger-surface);
}

/* ─── Select / Form Controls ────────────────────────────────────── */

.ex-select {
  background: var(--ex-surface-hover);
  border: 1px solid var(--ex-border);
  border-radius: var(--ex-radius);
  padding: 4px 6px;
  color: var(--ex-text);
  font-size: 11px;
  font-family: var(--ex-font-mono);
  cursor: pointer;
  outline: none;
}

/* Theme family selector (wider, in header) */
.ex-select--theme {
  border-radius: 8px;
  padding: 5px 8px;
  font-size: 13px;
  font-family: var(--ex-font);
}

/* Polarity toggle button */
.ex-polarity-toggle {
  background: var(--ex-surface-hover);
  border: 1px solid var(--ex-border);
  border-radius: 8px;
  cursor: pointer;
  padding: 6px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ex-text);
  font-size: 18px;
  line-height: 1;
  transition: background var(--ex-transition-fast);
}

.ex-polarity-toggle:hover {
  background: var(--ex-surface);
  border-color: var(--ex-border-hover);
}

/* ─── Overlay / Modal ────────────────────────────────────────────── */

.ex-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--ex-z-chrome);
  background: var(--ex-overlay-bg);
  backdrop-filter: blur(8px);
  display: flex;
  flex-direction: column;
}

/* ─── Chrome Bars (Core Showcase) ────────────────────────────────── */

.ex-chrome-top {
  position: fixed;
  top: var(--ex-header-height);
  left: 0;
  right: 0;
  padding: 20px 32px;
  pointer-events: none;
  z-index: var(--ex-z-chrome);
  background: var(--ex-chrome-gradient-top);
}

.ex-chrome-top__section {
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--ex-accent-text);
  opacity: 0.75;
  font-family: var(--ex-font-mono);
}

.ex-chrome-bottom {
  position: fixed;
  bottom: 100px;
  left: 0;
  right: 0;
  max-height: min(42vh, 260px);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 20px 32px 24px;
  pointer-events: none;
  z-index: var(--ex-z-chrome);
  background: var(--ex-chrome-gradient-bottom);
}

.ex-chrome-bottom__code {
  font-family: var(--ex-font-mono);
  font-size: 11px;
  color: var(--ex-text-code);
  line-height: 1.6;
  white-space: pre-wrap;
  margin: 0;
  overflow-y: auto;
  overflow-x: hidden;
  max-height: calc(min(42vh, 260px) - 44px);
}

/* ─── Expandable Panel (Canvas Region) ───────────────────────────── */

.ex-expand-panel {
  flex-shrink: 0;
  padding: 14px 24px;
  cursor: pointer;
  border-bottom: 1px solid var(--ex-border);
  background: var(--ex-surface);
  transition: all var(--ex-transition-normal);
  user-select: none;
}

.ex-expand-panel--open {
  padding: 24px 28px 28px;
  background: var(--ex-accent-surface);
}

.ex-expand-panel__trigger {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ex-expand-panel__hint {
  font-size: 11px;
  color: var(--ex-text-muted);
  opacity: 0.4;
  margin-left: 4px;
}

/* ─── Code Block ─────────────────────────────────────────────────── */

.ex-code-block {
  font-size: 12px;
  line-height: 1.6;
  padding: 14px 16px;
  border-radius: var(--ex-radius);
  background: var(--ex-overlay-bg);
  border: 1px solid var(--ex-border);
  margin: 0 0 16px;
  overflow-x: auto;
  color: var(--ex-accent-text);
  font-family: var(--ex-font-mono);
}

/* ─── Hint Panel ─────────────────────────────────────────────────── */

.ex-hint {
  font-size: 0.8rem;
  line-height: 1.5;
  padding: 0.75rem 1rem;
  border-radius: var(--ex-radius);
  background: var(--ex-surface);
  border: 1px solid var(--ex-border);
  margin-top: 1.5rem;
}

/* ─── Info Card (layout technique cards) ─────────────────────────── */

.ex-info-card {
  padding: 12px 14px;
  border-radius: var(--ex-radius);
  background: var(--ex-surface);
  border: 1px solid var(--ex-border);
}

.ex-info-card--active {
  background: var(--ex-accent-surface);
  border-color: var(--ex-accent-border);
}

.ex-info-card__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--ex-text);
}

.ex-info-card--active .ex-info-card__title {
  color: var(--ex-accent-text);
}

.ex-info-card__desc {
  font-size: 11px;
  color: var(--ex-text-muted);
  margin-top: 4px;
}

/* ─── Error Banner ───────────────────────────────────────────────── */

.ex-error {
  padding: 6px 12px;
  background: var(--ex-danger-surface);
  color: var(--ex-text);
  border-radius: var(--ex-radius);
  font-size: 11px;
  max-width: 260px;
  font-family: var(--ex-font);
}

/* ─── Title Overlay (MediaScreen) ────────────────────────────────── */

.ex-title-overlay {
  position: absolute;
  top: 68px;
  left: 16px;
  right: 16px;
  text-align: center;
  z-index: var(--ex-z-controls);
  pointer-events: none;
}

.ex-title-overlay__heading {
  font-size: clamp(14px, 2vw, 20px);
  font-weight: 600;
  color: var(--ex-text);
  font-family: var(--ex-font);
  margin: 0;
  letter-spacing: 0.04em;
  opacity: 0.85;
}

.ex-title-overlay__subtitle {
  font-size: clamp(10px, 1.2vw, 13px);
  color: var(--ex-text-muted);
  font-family: var(--ex-font-mono);
  margin: 4px 0 0;
}

/* ─── Toolbar (Slides demo) ──────────────────────────────────────── */

.ex-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 0.4rem 1rem;
  background: var(--ex-overlay-surface);
  backdrop-filter: var(--ex-backdrop-blur);
  border-bottom: 1px solid var(--ex-border);
  z-index: var(--ex-z-chrome);
  flex-shrink: 0;
  font-family: var(--ex-font);
  font-size: 0.8rem;
  color: var(--ex-text);
}

.ex-toolbar__muted {
  color: var(--ex-text-muted);
}

.ex-toolbar__hint {
  font-size: 0.7rem;
  color: var(--ex-text-muted);
}

/* ─── Loading state ──────────────────────────────────────────────── */

.ex-loading {
  padding: 2rem;
  color: var(--ex-text);
  font-family: var(--ex-font);
}

/* ─── Theme Gallery ──────────────────────────────────────────────── */

.ex-gallery {
  display: flex;
  flex-direction: column;
  font-family: var(--ex-font);
  background: var(--ex-bg);
  min-height: 100vh;
  color: var(--ex-text);
}

.ex-gallery__content {
  padding: 2rem;
  overflow-y: auto;
  flex: 1;
}

.ex-gallery__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  max-width: 520px;
}

@media (max-width: 540px) {
  .ex-gallery__grid {
    grid-template-columns: 1fr;
    max-width: 100%;
  }
}
```

---

## Hook: `useThemeCss.ts`

```typescript
// apps/examples/src/hooks/useThemeCss.ts

import { useEffect } from 'react';
import type { ThemeFamily, ThemePolarity } from '@brewsite/core';

/**
 * Sets `data-family` and `data-polarity` attributes on `<html>`,
 * which drives all CSS variable resolution in the examples app.
 */
export function useThemeCss(family: ThemeFamily, polarity: ThemePolarity): void {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-family', family);
    root.setAttribute('data-polarity', polarity);
    return () => {
      root.removeAttribute('data-family');
      root.removeAttribute('data-polarity');
    };
  }, [family, polarity]);
}
```

---

## Page Migration Guide

### Pattern: Standard Full-Page (most pages)

**Before:**
```tsx
<div style={{
  position: 'relative', display: 'flex', flexFlow: 'column',
  height: '100vh', overflow: 'hidden',
  background: polarity === 'light'
    ? 'radial-gradient(...)'
    : 'radial-gradient(...)',
}}>
```

**After:**
```tsx
<div className="ex-page">
```

The `polarity === 'light' ? ... : ...` ternary for background is eliminated — the CSS variable `--ex-bg-gradient` handles it automatically via the `[data-polarity]` selector.

### Pattern: Theme Integration

**Before (each page independently):**
```tsx
const [family, setFamily] = useState<ThemeFamily>('darkGlass');
const [polarity, setPolarity] = useState<ThemePolarity>('dark');
```

**After (each page still owns its own state, but also calls the hook):**
```tsx
const [family, setFamily] = useState<ThemeFamily>('darkGlass');
const [polarity, setPolarity] = useState<ThemePolarity>('dark');
useThemeCss(family, polarity);
```

The hook sets the data attributes. The CSS takes over. No other changes needed.

### Pattern: Hover States

**Before (JS event handlers):**
```tsx
onMouseEnter={(e) => {
  e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)';
  e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.25)';
}}
onMouseLeave={(e) => {
  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.07)';
}}
```

**After (CSS `:hover`):**
```tsx
<Link className="ex-card" to={ex.path}>
```

All hover logic moves to CSS. Remove all `onMouseEnter`/`onMouseLeave` handlers that only change colors/backgrounds.

---

## Per-File Migration Instructions

### Phase 1: Infrastructure (do first)

#### 1.1 Create all style files

Create every file listed in the Architecture section above:
- `styles/index.css` — import chain
- `styles/tokens/_base.css` — defaults + z-index + transitions
- `styles/tokens/darkGlass.css` — dark + light tokens
- `styles/tokens/enterprise.css` — dark + light tokens
- `styles/tokens/midnight.css` — dark + light tokens
- `styles/tokens/neonCyber.css` — dark + light tokens
- `styles/tokens/lightCanvas.css` — dark + light tokens
- `styles/tokens/lightMinimal.css` — dark + light tokens
- `styles/layout.css` — page/sidebar/grid structures
- `styles/components.css` — all component classes

#### 1.2 Create `hooks/useThemeCss.ts`

As specified above.

#### 1.3 Import stylesheet in `main.tsx`

Add `import './styles/index.css';` at the top of the app's entry point.

### Phase 2: Shared Components (do second)

#### 2.1 `ExampleHeader.tsx`

This is the most complex single file. Migrate systematically:

1. Replace the `<header style={{...}}>` with `<header className="ex-header">`.
2. Replace the menu trigger button's inline styles with `className="ex-header__menu-trigger"`. Use `aria-expanded={menuOpen}` for the open state instead of conditional style objects.
3. Replace the dropdown div with `className="ex-dropdown"`.
4. Replace each menu item button with `className={`ex-dropdown__item ${isActive ? 'ex-dropdown__item--active' : ''}`}`.
5. Replace the stats toggle button with `className={`ex-btn-ghost ${showStats ? 'ex-btn-ghost--active' : ''}`}`.
6. Replace the FPS select with `className="ex-select"`.
7. Remove ALL `onMouseEnter`/`onMouseLeave` handlers — CSS `:hover` handles it.
8. The SVG icons retain their inline `width`/`height`/`viewBox`/`stroke` attributes — those are not theme-dependent.

**Layout properties that can remain inline:** None — everything in ExampleHeader maps to component classes.

#### 2.2 `ThemeToggle.tsx`

1. Replace the wrapper div's positioning styles with `className="ex-header__right"` (when rendered inline in header) or leave the `style` prop passthrough for positioning.
2. Replace the family `<select>` styles with `className="ex-select ex-select--theme"`.
3. Replace the polarity `<button>` styles with `className="ex-polarity-toggle"`.
4. Remove the `isDark ? ... : ...` ternary inline styles — CSS variables handle polarity automatically.

#### 2.3 `carousel-selection/overlays/FullScreenCloseButton.tsx`

1. Replace the button's inline styles with `className="ex-close-btn"`.
2. Remove `onMouseEnter`/`onMouseLeave` handlers — `.ex-close-btn:hover` handles it.

#### 2.4 `StatsOverlay.tsx`

No inline color/theme styles — only layout positioning. Leave the `style={{ top: 56, right: 8 }}` as-is (position values, not theme-dependent). No changes needed.

### Phase 3: Page Components (do in any order)

For each page below, the migration follows the same pattern:

1. Add `useThemeCss(family, polarity);` after the state declarations.
2. Replace the outer `<div style={{...}}>` with `<div className="ex-page">`.
3. Replace any remaining inline themed styles with the appropriate class.
4. Keep layout-only inline styles (flex-grow, position for canvas containers, etc.) where they are page-specific and non-themeable.

#### 3.1 `App.tsx` — Landing Page

- Replace outer div: `className="ex-page"`
- Replace scroll area: `className="ex-scroll-content"`
- Replace h1/p: add standard heading/text classes or leave as semantic elements styled by `.ex-page` inheritance
- Replace card grid: `className="ex-card-grid"`
- Replace each `<Link>`: `className="ex-card"` — remove `onMouseEnter`/`onMouseLeave`
- Replace badge `<span>`: `className="ex-badge"`
- Replace description `<span>`: `className="ex-card__desc"`
- Replace loading div: `className="ex-loading"`
- Add `useThemeCss` — the landing page needs to pick up theme from localStorage. Read the persisted family/polarity values and call `useThemeCss()`. Since this page has no `ThemeToggle`, read directly from localStorage:
  ```tsx
  const family = (localStorage.getItem('themeFamily') as ThemeFamily) ?? 'darkGlass';
  const polarity = (localStorage.getItem('themePolarity') as ThemePolarity) ?? 'dark';
  useThemeCss(family, polarity);
  ```

#### 3.2 `CoreShowcasePage.tsx`

- Add `useThemeCss(family, polarity);`
- Replace outer div: `className="ex-page"`
- The `background: '#030510'` is eliminated — `--ex-bg-gradient` handles it.
- `BackgroundLayer`, `SceneCanvas` style props (`position: absolute, inset: 0, zIndex`) are not theme-dependent — keep them or migrate to `className="ex-canvas-layer"` with `style={{ zIndex: 0 }}` / `style={{ zIndex: 1 }}`.

#### 3.3 `core-showcase/overlays.tsx`

- Replace TopChrome outer div: `className="ex-chrome-top"`
- Replace section text: `className="ex-chrome-top__section"`
- Replace BottomChrome outer div: `className="ex-chrome-bottom"`
- Replace pre: `className="ex-chrome-bottom__code"`
- Remove all hardcoded font families, colors, and gradient backgrounds.

#### 3.4 `ChartDemoPage.tsx`

- Add `useThemeCss(family, polarity);`
- Replace outer div: `className="ex-page"`
- The `polarity === 'light' ? gradient : gradient` ternary is eliminated.

#### 3.5 `InputShowcasePage.tsx`

- Add `useThemeCss(family, polarity);`
- Replace outer div: `className="ex-page"`
- The polarity ternary for background is eliminated.

#### 3.6 `ViewDemoPage.tsx`

- Add `useThemeCss(family, polarity);`
- Replace outer div: `className="ex-page"`
- The polarity ternary for background is eliminated.

#### 3.7 `ModelShowcasePage.tsx`

- Add `useThemeCss(family, polarity);`
- Replace outer div: `className="ex-page"`

#### 3.8 `CanvasRegionPage.tsx`

This is the most complex page layout (sidebar + expandable panel + canvas). Migrate carefully:

- Add `useThemeCss(family, polarity);`
- Replace outer div: `className="ex-page"`
- Replace sidebar `<aside>`: `className="ex-sidebar"`. The mobile layout (`isMobile` state) uses the `@media` query in `layout.css` instead of JS-driven conditional styles. Remove the `useIsMobile` hook — CSS handles responsive layout.
- Replace h1: keep semantic, inherit color from `.ex-page`
- Replace paragraphs: inherit from page, only `line-height` and `opacity` which are fine to leave inline or add a `.ex-paragraph` utility.
- Replace hint panel: `className="ex-hint"`
- Replace expandable panel: `className={`ex-expand-panel ${expanded ? 'ex-expand-panel--open' : ''}`}`
- Replace layout technique cards: `.ex-info-card` / `.ex-info-card--active`
- Replace code snippet: `className="ex-code-block"`

**Note on `isMobile` hook removal:** The `useIsMobile` hook is used for two things:
1. Flex direction (row vs column) — replace with CSS `@media` on `.ex-content`.
2. Sidebar styling (width, max-height, border direction) — replace with CSS `@media` on `.ex-sidebar`.

Add to `layout.css`:
```css
@media (max-width: 700px) {
  .ex-content {
    flex-direction: column;
  }
}
```

#### 3.9 `MediaScreenDemoPage.tsx`

- Add `useThemeCss(family, polarity);`
- Replace outer div: `className="ex-page"`
- Replace TitleOverlay: use `.ex-title-overlay`, `.ex-title-overlay__heading`, `.ex-title-overlay__subtitle`
- Replace capture buttons: `.ex-btn-primary` / `.ex-btn-muted`
- Replace error div: `.ex-error`
- The capture controls positioning (`position: absolute, bottom: 32, right: 32`) is layout-specific — keep inline.

#### 3.10 `SlidesDemoPage.tsx`

- Add `useThemeCss(family, polarity);`
- Replace outer div: `className="ex-page"`. The `background: theme.background.color` is replaced by `--ex-bg`.
- Replace toolbar: `className="ex-toolbar"`.
- **Special case:** This page reads from `DeckTheme` (from `@brewsite/slides`) for some values like `theme.colors.body`, `theme.colors.surface`, `theme.fonts.heading`. These are slide-deck-specific tokens. Replace with the CSS variables where possible, but note the toolbar select may need the specific deck theme color — evaluate at implementation time. The CSS variables should be sufficient since the toolbar is page chrome, not slide content.

#### 3.11 `CarouselSelectionPage.tsx`

- Outer div: `className="ex-page"`. No theme toggle on this page — it uses fixed `darkGlass/dark`.
- Add `useThemeCss('darkGlass', 'dark');`
- The hardcoded gradient background is eliminated.

#### 3.12 `carousel-selection/overlays/ExplorerOverlay.tsx`

- Replace outer div: `className="ex-overlay"`
- The inner positioning div (`flex: 1, position: relative`) can stay inline — it's layout-specific.

#### 3.13 `ThemeGalleryPage.tsx`

- Replace outer div: `className="ex-gallery"`
- Replace content area: `className="ex-gallery__content"`
- Replace grid: `className="ex-gallery__grid"`
- Remove the inline `<style>` tag — the grid responsive behavior moves to `components.css`.
- Replace heading/paragraph inline styles with inherited colors from `.ex-gallery`.
- Add `useThemeCss` — read from localStorage or default to `'darkGlass'/'dark'`.

### Phase 4: Cleanup

1. **Delete all `onMouseEnter`/`onMouseLeave` handlers** that only change background/borderColor/color. CSS `:hover` handles all of these.
2. **Verify no hardcoded color hex values remain** in any `.tsx` file except:
   - SVG `stroke`/`fill` attributes on small inline icons (these are OK — they're UI chrome, not themed content)
   - `BackgroundLayer`/`SceneCanvas`/`EngineOverlayHost` style props (these are engine layout, not themed)
3. **Remove the `PAGE_STYLES` object** from `CanvasRegionPage.tsx` — it's replaced by CSS classes.
4. **Remove the `useIsMobile` hook** from `CanvasRegionPage.tsx` — CSS media queries replace it.
5. **Verify light mode** for every page × every theme family. The most common bug will be text-on-light-background contrast issues. Test all 12 combinations.

---

## Testing

### Manual Test Matrix

Test every page at these combinations (minimum):

| Page | darkGlass/dark | darkGlass/light | enterprise/dark | enterprise/light | neonCyber/dark | lightCanvas/light |
|---|---|---|---|---|---|---|
| Landing | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Core Showcase | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Charts | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Input | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Views | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Model | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Canvas Region | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Media Screen | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Slides | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Carousel Selection | ✓ | - | - | - | - | - |
| Theme Gallery | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

### Verification Checklist

- [ ] `pnpm dev` runs without CSS import errors
- [ ] No inline `style={{` blocks contain color, background, border-color, font-family, or font-size values (search with grep)
- [ ] Theme toggle switches polarity and all page chrome updates instantly
- [ ] Theme family selector switches family and all page chrome updates instantly
- [ ] Header dropdown menu is readable in all 12 theme combinations
- [ ] Cards on landing page show hover states in all themes
- [ ] Stats toggle shows active/inactive states correctly in all themes
- [ ] Light-mode text is readable against light backgrounds (contrast check)
- [ ] Dark-mode text is readable against dark backgrounds (contrast check)
- [ ] Canvas Region sidebar + expandable panel respond to theme changes
- [ ] MediaScreen capture buttons are visible in all themes
- [ ] Core Showcase top/bottom chrome gradients are appropriate per theme
- [ ] No JS `onMouseEnter`/`onMouseLeave` handlers remain for color/bg changes
- [ ] `pnpm build` succeeds (Vite processes the CSS imports correctly)

---

## Implementation Order

1. **Create infrastructure** (styles directory, all CSS files, hook) — Phase 1
2. **Migrate `ExampleHeader.tsx`** — Phase 2.1 (most impactful, used by every page)
3. **Migrate `ThemeToggle.tsx`** — Phase 2.2
4. **Migrate `FullScreenCloseButton.tsx`** — Phase 2.3
5. **Migrate page components** — Phase 3 (any order, but start with a simple page like `ModelShowcasePage` to validate the pattern before tackling `CanvasRegionPage`)
6. **Cleanup + verify** — Phase 4

Estimated total: ~2-3 focused implementation sessions.

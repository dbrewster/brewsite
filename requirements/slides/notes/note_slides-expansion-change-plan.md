---
title: "Slides Expansion — Change Plan"
doc_type: note
owner: Toolkit Product
status: draft
updated: 2026-03-20
change_history:
  - date: 2026-03-20
    author: Toolkit Product
    summary: "Initial change plan drafted with backward-compat constraints."
  - date: 2026-03-20
    author: Toolkit Product
    summary: "Revised for breaking-changes-allowed posture. Eliminated Phase 0C (OverlayTheme uplift) — DeckTheme is deleted and rebuilt from SceneTheme. Collapsed DeckTheme's duplicate color/font/spacing tokens into SceneTheme. Removed compat shims throughout."
  - date: 2026-03-20
    author: Toolkit Product
    summary: "Introduced two-layer slide customization: SlideTheme (presentation feel — timing, density, typography scale, component sizing) + SlideTemplate (corporate chrome — logos, footers, watermarks). Both inject --slide-* CSS vars. Orthogonal to each other and to SceneTheme."
  - date: 2026-03-20
    author: Toolkit Product
    summary: "Addressed PM review findings: fixed 3 blockers (plugin.ts/SlidesPluginOptions, SlideMetaWidget, CSS var migration mapping), 14 should-fixes (test plans, SlidePlayer rewrite detail, heading/body color mapping, timing value consumption model, ComparisonTable cell types, useStaggeredReveal return shape, additional gotchas, explicit non-goals). Added deferred features section, ImageSlide consolidation, deck-authoring-patterns doc."
---

# Slides Expansion — Change Plan

This note defines the concrete changes required across the monorepo to support the `@brewsite/slides` expansion from a basic five-layout presentation system to a comprehensive corporate slide toolkit.

**Breaking changes in `@brewsite/slides` are permitted.** The package is super-alpha. This simplifies the plan significantly: no backward-compat shims, no type aliases, no migration layers. We redesign the theme and layout systems cleanly.

Changes are sequenced by dependency order: upstream prerequisites first, then slides-internal work.

---

## Key Simplification: Kill DeckTheme, Unify on SceneTheme

The current `DeckTheme` duplicates tokens that belong in `SceneTheme`:

| Token | In DeckTheme today | Should live in SceneTheme |
|-------|--------------------|--------------------------|
| `fonts.heading` / `fonts.body` | Yes | Yes — `SceneTheme.font.htmlFamily` already covers this partially |
| `colorMode` | Yes | Already there |
| `accentColor` | Yes | Adding in Phase 0A |
| `colors.heading` / `colors.body` / `colors.muted` | Yes | Derivable from `colorMode` + new CSS vars |
| `colors.surface` | Yes | Adding as `--brewsite-surface-base` |
| `spacing.slide` / `spacing.stack` | Yes | Adding spacing scale |
| `background.color` / `background.gradient` | Yes | Already in `SceneTheme.background.fill` |
| `border.radius` | Yes | Adding radius scale |

Once `SceneTheme` gains the new tokens (Phase 0A), `DeckTheme` becomes redundant as a parallel token set. The slides package should **delete `DeckTheme`** and consume `SceneTheme` directly via core's `ThemeContext` — the same way `@brewsite/diagram` and `@brewsite/charts` already work.

What slides still needs on top of `SceneTheme` falls into two orthogonal categories:

### SlideTheme — "How slides feel"
Presentation-specific behavioral and density tokens. A designer sets these. They vary by aesthetic, not by company.
- **Animation timing** — transition speed, entrance duration, stagger delay, count-up speed
- **Content density** — region padding, content gap, title bar height, gutter size
- **Typography scale** — presentation headings are bigger than generic overlay headings
- **Graphical component sizing** — stat card borders, timeline dot size, progress ring diameter

### SlideTemplate — "Whose slides these are"
Corporate chrome. A brand manager sets these. They vary by company, not by aesthetic.
- **Brand assets** (logo, wordmark, icon)
- **Master slide config** (footer, page numbers, watermark, logo placement)
- **Behavioral defaults** (default transition, progress indicator style)

These two are **orthogonal**. You pair any theme with any template. The McKinsey deck has tight spacing and fast reveals (theme) plus the McKinsey logo and confidentiality footer (template). Acme Corp wants the same tight feel but their own branding? Swap the template, keep the theme.

Both inject `--slide-*` CSS custom properties, scoped to presentation-specific concerns that don't belong in core's `--brewsite-*` namespace.

**This eliminates Phase 0C entirely** and removes the `ThemeBundle.deck` slot question. Slides just uses the same `SceneTheme` everyone else uses for colors, fonts, and spacing. No new type in core. No new registry. No dependency direction problem.

---

## Phase 0: Upstream Prerequisites

### 0A. `@brewsite/core` — Expand SceneTheme + EngineOverlayHost CSS Variable Surface

**Package:** `@brewsite/core`
**Semver:** Minor (additive, zero breaking changes to core)
**Files:**

| File | Change |
|------|--------|
| `packages/core/src/theme/types.ts` | Add optional `accentColor`, `spacing`, and `semanticColors` token groups to `SceneTheme` |
| `packages/core/src/player/EngineOverlayHost.tsx` | Expand `themeStyles` to derive and inject ~20 new CSS custom properties |

**New `SceneTheme` fields:**

```typescript
type SceneTheme = {
  // ... existing fields unchanged ...

  /** Primary brand/accent color. Defaults to '#2563eb' (blue-600). */
  readonly accentColor?: string;

  /** Semantic status colors derived from highlightPalette or explicit overrides. */
  readonly semanticColors?: {
    readonly success?: string;   // default: '#22c55e'
    readonly warning?: string;   // default: '#f59e0b'
    readonly error?: string;     // default: '#ef4444'
    readonly info?: string;      // default: '#3b82f6'
  };

  /** Spacing scale for HTML overlay content. Values are CSS length strings. */
  readonly spacing?: {
    readonly xs?: string;   // default: '4px'
    readonly sm?: string;   // default: '8px'
    readonly md?: string;   // default: '16px'
    readonly lg?: string;   // default: '24px'
    readonly xl?: string;   // default: '40px'
  };
};
```

**New CSS variables injected by EngineOverlayHost:**

```css
/* Accent */
--brewsite-accent-color           /* from accentColor or '#2563eb' */
--brewsite-accent-color-muted     /* accentColor at 15% opacity */

/* Text */
--brewsite-text-muted             /* white/black at 0.4 opacity based on colorMode */
--brewsite-text-inverse           /* opposite of text-primary */

/* Surfaces */
--brewsite-surface-base           /* white 0.03 / black 0.02 based on colorMode */
--brewsite-surface-hover          /* white 0.10 / black 0.07 based on colorMode */

/* Semantic status */
--brewsite-color-success          /* from semanticColors.success or highlightPalette.success.color */
--brewsite-color-warning          /* from semanticColors.warning or highlightPalette.warning.color */
--brewsite-color-error            /* from semanticColors.error or highlightPalette.error.color */
--brewsite-color-info             /* from semanticColors.info or highlightPalette.info.color */

/* Spacing scale */
--brewsite-spacing-xs             /* from spacing.xs or '4px' */
--brewsite-spacing-sm             /* from spacing.sm or '8px' */
--brewsite-spacing-md             /* from spacing.md or '16px' */
--brewsite-spacing-lg             /* from spacing.lg or '24px' */
--brewsite-spacing-xl             /* from spacing.xl or '40px' */

/* Elevation / shadows */
--brewsite-shadow-sm              /* derived from colorMode */
--brewsite-shadow-md              /* derived from colorMode */
--brewsite-shadow-lg              /* derived from colorMode */

/* Border radius scale */
--brewsite-radius-sm              /* '4px' */
--brewsite-radius-md              /* '8px' (replaces --brewsite-radius-base) */
--brewsite-radius-lg              /* '12px' */
--brewsite-radius-xl              /* '20px' */
```

**Backward compatibility:** All new `SceneTheme` fields are optional with sensible defaults. Existing themes produce the same visual output. `--brewsite-radius-base` remains unchanged (aliased to `--brewsite-radius-md` internally). No existing CSS variable changes value.

**Derivation rules for shadows:**
```
dark mode:
  --brewsite-shadow-sm: 0 1px 2px rgba(0,0,0,0.5)
  --brewsite-shadow-md: 0 4px 12px rgba(0,0,0,0.5)
  --brewsite-shadow-lg: 0 8px 24px rgba(0,0,0,0.6)

light mode:
  --brewsite-shadow-sm: 0 1px 2px rgba(0,0,0,0.08)
  --brewsite-shadow-md: 0 4px 12px rgba(0,0,0,0.10)
  --brewsite-shadow-lg: 0 8px 24px rgba(0,0,0,0.14)
```

**Derivation rules for accent-muted:**
```
dark mode:  accentColor + '26' (hex alpha ~15%)
light mode: accentColor + '1a' (hex alpha ~10%)
```

**Test plan:**
- Unit test: `themeStyles` computation produces correct CSS vars for dark/light/custom themes
- Unit test: missing optional fields fall back to defaults
- Unit test: `highlightPalette` color extraction works when `semanticColors` is not set
- Visual: existing example scenes render identically (no regression)

---

### 0B. `@brewsite/themes` — Add `accentColor` to All Scene Theme Presets

**Package:** `@brewsite/themes`
**Semver:** Minor (additive)
**Prerequisite:** Phase 0A
**Files:**

| File | Change |
|------|--------|
| `packages/themes/src/presets/scene/*.ts` | Add `accentColor` and optionally `semanticColors` to each preset |

**Per-family values:**

| Family | `accentColor` | Notes |
|--------|--------------|-------|
| enterprise | `'#2563eb'` (blue-600) | Professional blue |
| darkGlass | `'#c2185b'` (burgundy) | Warm glass aesthetic |
| midnight | `'#d4af37'` (gold) | Elegant gold accent |
| neonCyber | `'#a855f7'` (purple-500) | Vibrant energy |
| lightCanvas | `'#3b82f6'` (blue-500) | Soft blue |
| lightMinimal | `'#6366f1'` (indigo-500) | Clean indigo |

This is purely additive. Existing presets gain new optional fields. No `ThemeBundle` type change needed — slides consumes `SceneTheme` directly via the existing `bundle.scene` slot.

---

## Phase 1: Slides Rewrite — Theme, Layouts, Graphics

### 1A. Replace DeckTheme with SlideTheme + SceneTheme (BREAKING)

**Package:** `@brewsite/slides`
**Files:**

| File | Change |
|------|--------|
| `packages/slides/src/theme.ts` | **Rewrite** — delete `DeckTheme`, `defaultDeckTheme`, `darkDeckTheme`, `createDeckTheme()`. Replace with `SlideTheme`, `defaultSlideTheme`, `createSlideTheme()`, and named presets |
| `packages/slides/src/themeFamily.ts` | **Delete entirely** — `DECK_THEME_PAIRS`, `getDeckThemeForFamily()` removed |
| `packages/slides/src/types.ts` | Remove `DeckTheme`, `ResolvedDeckTheme`, `DeckSpec.theme`. Add `SlideTheme`, `SlideTemplate`. Preserve `SlideSpec.restProgress` unchanged |
| `packages/slides/src/compiler/themeCompiler.ts` | **Rewrite** — resolves `SlideTheme` + `SlideTemplate` → `--slide-*` CSS variables (no longer resolves DeckTheme → ResolvedDeckTheme) |
| `packages/slides/src/plugin.ts` | **Rewrite** — `SlidesPluginOptions` drops the `theme: ResolvedDeckTheme` field. `slidesPlugin()` becomes zero-arg (visual tokens come from `SceneTheme` via core's `ThemeContext`, timing tokens come from `SlideTheme` via SlidePlayer's container CSS vars). The plugin still registers `SlideMetaWidget` and `SlideNavWidget` |
| `packages/slides/src/player/SlidePlayer.tsx` | **Major rewrite** — see SlidePlayer integration points below |
| `packages/slides/src/widget/SlideMetaWidget.ts` | **Update** — remove `ResolvedDeckTheme` from state. Widget reads `sceneProgress` and publishes to VariableStore unchanged. If new per-slide `SlideTheme` timing fields need publishing (e.g., `entranceDuration` for hooks), add them to the published metadata |
| `packages/slides/src/widget/SlideNavWidget.ts` | **No change needed** — registry anchor only, does not reference DeckTheme |
| `packages/slides/src/compiler/deckCompiler.tsx` | **Rewrite** — remove DeckTheme dependency. Update all CSS variable references per migration mapping below |
| `packages/slides/src/dsl.tsx` | **Rewrite** — remove DeckTheme-related props. Update `Heading`, `Body`, `BulletList`, `NumberedList` CSS variable references per migration mapping below |
| `packages/slides/src/player/PresenterView.tsx` | **Update** — remove any `ResolvedDeckTheme` / `DeckTheme` references. Restyle using `--brewsite-*` variables |
| `packages/slides/src/player/SlidePrintLayout.tsx` | **Update** — remove any `ResolvedDeckTheme` / `DeckTheme` references. Restyle using `--brewsite-*` variables |
| `packages/slides/src/index.ts` | Remove all DeckTheme exports, add SlideTheme + SlideTemplate exports |

**SlidePlayer.tsx integration points (5 areas that change):**

The current `SlidePlayer.tsx` is 612 lines with five DeckTheme integration points. Each must be addressed:

1. **Theme compilation** (currently line ~413): `compileDeckTheme(theme)` → **Delete.** No DeckTheme to resolve. `SlideTheme` is resolved by `themeCompiler.ts` into `--slide-*` CSS vars.
2. **SceneEngine sceneTheme prop** (currently line ~540): `<SceneEngine sceneTheme={resolvedTheme.sceneTheme}>` → **Delete.** SceneTheme is now passed by the consumer on `<SceneEngine theme={...}>` outside `SlidePlayer`. SlidePlayer does not set sceneTheme.
3. **Plugin creation** (currently line ~468): `slidesPlugin({ theme: resolvedTheme, navigation })` → **Change to** `slidesPlugin()` (zero-arg) or `slidesPlugin({ navigation })` if navigation config is still needed.
4. **CSS var injection** (currently line ~493-496): Injects `--slide-*` vars from `resolvedTheme.cssVars` and manually injects `--brewsite-accent-color` → **Replace.** Inject `--slide-*` vars from resolved `SlideTheme` + `SlideTemplate`. Remove manual `--brewsite-accent-color` injection (now handled by `EngineOverlayHost` after Phase 0A).
5. **Background color** (currently line ~503): Uses `resolvedTheme.background.color` for fullscreen background → **Delete.** Background comes from `SceneTheme.background` via `<BackgroundLayer>` or `EngineOverlayHost`'s `--brewsite-background-color`.

**CSS variable migration mapping:**

Every `var(--slide-*)` reference in `deckCompiler.tsx` and `dsl.tsx` that uses the old DeckTheme color/font tokens must be updated:

| Old reference | New reference | Source |
|---------------|---------------|--------|
| `var(--slide-color-heading)` | `var(--brewsite-text-primary)` | EngineOverlayHost (core) |
| `var(--slide-color-body)` | `var(--brewsite-text-secondary)` | EngineOverlayHost (core) |
| `var(--slide-color-surface)` | `var(--brewsite-surface-elevated)` | EngineOverlayHost (core) |
| `var(--slide-color-muted)` | `var(--brewsite-text-muted)` | EngineOverlayHost (core, new in Phase 0A) |
| `var(--slide-padding, 8%)` | `var(--slide-content-padding)` | SlideTheme (slides) |
| `var(--slide-gap, 1.5rem)` | `var(--slide-content-gap)` | SlideTheme (slides) |
| `var(--slide-border-radius)` | `var(--brewsite-radius-md)` | EngineOverlayHost (core, new in Phase 0A) |
| `var(--slide-bg-gradient)` | Removed — gradient from `SceneTheme.background.fill` via `BackgroundLayer` | Core |
| `var(--slide-font-body)` | `var(--brewsite-font-family)` | EngineOverlayHost (core, already exists) |
| `var(--brewsite-accent-color)` (manual injection in SlidePlayer) | `var(--brewsite-accent-color)` (unchanged, but injection moves to EngineOverlayHost) | EngineOverlayHost (core, new in Phase 0A) |

**Color mapping note:** `--brewsite-text-primary` maps to headings (full-strength text: white in dark mode, #111 in light mode). `--brewsite-text-secondary` maps to body text (60% opacity). Graphics components use `--brewsite-text-primary` for prominent values/headings and `--brewsite-text-secondary` for labels/descriptions. This matches the semantic intent even though the variable names say "primary/secondary" not "heading/body."

**CSS variable consumption model note:** `SlideTheme` timing tokens (`entranceDuration`, `staggerDelay`, `countUpDuration`) are **progress fractions (0-1), not time durations**. They are consumed by JavaScript hooks (`useEntrance`, `useStaggeredReveal`, `useCountUp`) via `useSceneProgress()`, NOT by CSS `transition-duration` or `animation-duration`. They are injected as CSS custom properties for two reasons: (1) so `createSlideTheme()` overrides propagate without prop drilling, and (2) so component CSS can read them via `getComputedStyle()` if needed. Only `--slide-transition-duration` has a CSS time unit (`300ms`) because it IS consumed by CSS `transition-duration` on `SlideTransitionWrapper`.

**Spacing consumption model note:** `--brewsite-spacing-*` tokens (from core Phase 0A) are consumed by graphics components for **internal spacing** — gaps between a stat card's value and label, padding inside a callout box, spacing between timeline items. `--slide-content-padding` (from SlideTheme) is consumed by the layout compiler for **region-level padding** — the outer padding inside each slide region. These are different concerns at different scales.

**Test impact for Phase 1A:**

| Test file | Disposition |
|-----------|-------------|
| `__tests__/themeFamily.test.ts` | **Delete** — themeFamily.ts is deleted |
| `__tests__/themeCompiler.test.ts` | **Rewrite** — test new `SlideTheme` → CSS var resolution |
| `__tests__/deckCompiler.test.ts` | **Rewrite** — remove DeckTheme args, test with SceneTheme + SlideTheme |
| `__tests__/types.test.ts` | **Update** — remove DeckTheme type tests, add SlideTheme + SlideTemplate |
| `__tests__/dsl.test.tsx` | **Update** — verify text primitives use `--brewsite-*` variables |
| `player/__tests__/SlidePlayer.test.tsx` | **Rewrite** — new props, new theme plumbing |
| `player/__tests__/SlidePrintLayout.test.tsx` | **Update** — verify no DeckTheme references |
| `player/__tests__/SlideProgressIndicator.test.tsx` | **No change** — not theme-dependent |
| `player/__tests__/SlideTransitionWrapper.test.tsx` | **Update** in Phase 1E |
| `__tests__/layoutCompiler.test.ts` | **Update** in Phase 1B — new layouts |
| `__tests__/computeSlideStartProgress.test.ts` | **No change** — pure math, not theme-dependent |

**Three-layer theme architecture:**

```
SceneTheme (from core)              → --brewsite-*   "What color, what font, what spacing"
  └─ Colors, fonts, spacing, shadows, radii
  └─ Injected by EngineOverlayHost
  └─ Same mechanism as diagram, charts, model

SlideTheme (from slides)            → --slide-*      "How slides feel"
  └─ Animation timing, content density, typography scale, component sizing
  └─ Injected by SlidePlayer on its container
  └─ Presentation-specific — not useful outside slides

SlideTemplate (from slides)         → --slide-*      "Whose slides these are"
  └─ Brand assets, master slide chrome, behavioral defaults
  └─ Injected by SlidePlayer alongside SlideTheme
  └─ Corporate-specific — logos, footers, watermarks
```

**SlideTheme type:**

```typescript
interface SlideTheme {
  /** Animation and transition timing */
  timing: {
    /** Slide-to-slide transition duration. Default: '300ms' */
    transitionDuration: string;
    /** Default entrance animation progress window. Default: 0.3 */
    entranceDuration: number;
    /** Default fly-in / slide-up distance. Default: '24px' */
    entranceDistance: string;
    /** Default stagger delay between items. Default: 0.08 */
    staggerDelay: number;
    /** Stat card count-up progress window. Default: 0.6 */
    countUpDuration: number;
  };

  /** Content density and spacing */
  density: {
    /** Padding inside slide regions. CSS length string. Default: '48px' */
    contentPadding: string;
    /** Vertical gap between elements in a region. CSS length string. Default: '16px' */
    contentGap: string;
    /** Title bar height as NVS fraction [0-1] — 0.18 means 18% of viewport. Default: 0.18 */
    titleHeight: number;
    /** Inter-region gutter as NVS fraction [0-1] — 0.02 means 2% of viewport. Default: 0.02 */
    gutter: number;
  };

  /** Typography scale overrides (multiplied against --brewsite-font-size-*) */
  typography: {
    /** Heading scale. Default: 1.2 (20% bigger than core heading) */
    headingScale: number;
    /** Body text scale. Default: 1.1 */
    bodyScale: number;
    /** Caption/label scale. Default: 1.0 */
    captionScale: number;
  };

  /** Graphical component sizing */
  components: {
    /** Stat card / callout box border width. Default: '1px' */
    cardBorderWidth: string;
    /** Timeline connector line thickness. Default: '2px' */
    timelineConnectorWidth: string;
    /** Timeline milestone dot diameter. Default: '12px' */
    timelineDotSize: string;
    /** Progress ring default diameter. Default: '64px' */
    progressRingSize: string;
    /** Progress ring stroke width. Default: '4px' */
    progressRingThickness: string;
  };
}
```

**`--slide-*` CSS variables injected by SlidePlayer:**

```css
/* Timing */
--slide-transition-duration         /* '300ms' */
--slide-entrance-duration           /* 0.3 */
--slide-entrance-distance           /* '24px' */
--slide-stagger-delay               /* 0.08 */
--slide-count-up-duration           /* 0.6 */

/* Density */
--slide-content-padding             /* '48px' */
--slide-content-gap                 /* '16px' */
--slide-title-height                /* 0.18 */
--slide-gutter                      /* 0.02 */

/* Typography scale (multipliers against --brewsite-font-size-*) */
--slide-heading-scale               /* 1.2 */
--slide-body-scale                  /* 1.1 */
--slide-caption-scale               /* 1.0 */

/* Component sizing */
--slide-card-border-width           /* '1px' */
--slide-timeline-connector-width    /* '2px' */
--slide-timeline-dot-size           /* '12px' */
--slide-progress-ring-size          /* '64px' */
--slide-progress-ring-thickness     /* '4px' */

/* Template chrome (from SlideTemplate.master) */
--slide-footer-height               /* '32px' or '0px' if no footer */
--slide-logo-size                   /* '40px' or '0px' if no logo */
--slide-watermark-opacity           /* 0.05 or 0 if no watermark */
```

**Named SlideTheme presets:**

| Preset | Feel | Key Characteristics |
|--------|------|---------------------|
| `defaultSlideTheme` | Balanced | Standard timing, medium density. Good general-purpose starting point. |
| `compactSlideTheme` | Tight, fast | Short transitions (`200ms`), small padding (`32px`), fast reveals. McKinsey / data-heavy decks. |
| `cinematicSlideTheme` | Spacious, slow | Long transitions (`500ms`), generous padding (`64px`), slow entrance (`0.5`). Apple keynote feel. |
| `minimalSlideTheme` | Clean, snappy | Fast transitions (`250ms`), medium padding, no stagger (`0`), scale 1.0. Clean & direct. |

**createSlideTheme() factory:**

```typescript
function createSlideTheme(overrides: DeepPartial<SlideTheme>): SlideTheme
```

Deep-merges overrides into `defaultSlideTheme`.

**Usage:**

```tsx
<SceneEngine theme={themes.enterprise.dark} plugins={[corePlugin(), slidesPlugin()]}>
  <SlidePlayer slideTheme={cinematicSlideTheme} template={acmeCorpTemplate}>
    <Slide key="intro">
      <TitleSlide title="Q1 Results" subtitle="March 2026" />
    </Slide>
  </SlidePlayer>
</SceneEngine>
```

Swap `cinematicSlideTheme` → `compactSlideTheme` to change the feel. Swap `acmeCorpTemplate` → `betaCorpTemplate` to change the branding. Swap `themes.enterprise.dark` → `themes.midnight.dark` to change the colors. All three axes are independent.

---

### 1B. Redesigned Layout System (BREAKING)

**Package:** `@brewsite/slides`
**Files:**

| File | Change |
|------|--------|
| `packages/slides/src/dsl.tsx` | Rewrite — new layout components replace old ones |
| `packages/slides/src/types.ts` | Rewrite `SlideLayout` union with full archetype set |
| `packages/slides/src/compiler/layoutCompiler.ts` | Rewrite — region computation for all 19 layouts |
| `packages/slides/src/index.ts` | Updated exports |

**Full layout set (19 layouts — 5 existing redesigned + 14 new):**

| Layout | Component | Regions | Description |
|--------|-----------|---------|-------------|
| `title` | `<TitleSlide>` | 1 centered | Full-viewport title with optional subtitle and tagline |
| `section` | `<SectionSlide>` | 1 centered | Large text section divider for chapter breaks |
| `content` | `<ContentSlide>` | Title + body | Title bar + single-column content (replaces `TitleBodyLayout`) |
| `two-column` | `<TwoColumnSlide>` | Title + 2 columns | Optional title + two equal columns (replaces `TwoColumnLayout`) |
| `image` | `<ImageSlide>` | Image + text | Image on one side (50-60%), text on the other. `imagePosition` prop: `'left'` (default) or `'right'` |
| `full-bleed` | `<FullBleedSlide>` | 1 overlay | Canvas fully visible, optional text overlay |
| `blank` | `<BlankSlide>` | None | Author-defined via raw children |
| `big-number` | `<BigNumberSlide>` | 1-4 stat slots | Hero stat with optional supporting context |
| `metric-grid` | `<MetricGridSlide>` | 3-4 cells | Row of KPI cards with labels |
| `comparison` | `<ComparisonSlide>` | 2 columns + header labels | Side-by-side with labeled column headers |
| `timeline` | `<TimelineSlide>` | Title + timeline body | Title bar + horizontal milestone timeline |
| `process` | `<ProcessSlide>` | Title + steps | Title bar + sequential process steps |
| `quote` | `<QuoteSlide>` | Quote + attribution | Large blockquote with source |
| `agenda` | `<AgendaSlide>` | Title + list | Title bar + numbered/icon topic list |
| `team` | `<TeamSlide>` | Title + grid | Title bar + photo/name grid |
| `closing` | `<ClosingSlide>` | Centered CTA | Contact info, next steps, call to action |
| `bento` | `<BentoSlide>` | 4-6 card cells | Modular asymmetric card grid |
| `dashboard` | `<DashboardSlide>` | Title + 2-4 widget slots | Multi-chart/multi-stat data layout |
| `matrix` | `<MatrixSlide>` | 4 quadrants + axis labels | 2x2 categorization grid |

**Naming change:** Old names (`TitleLayout`, `TitleBodyLayout`, etc.) are replaced with `*Slide` suffix for clarity — these are slide types, not generic layout primitives. This is a breaking rename.

**Each layout component:**
1. Returns `null` (compiled, not rendered) — same DSL pattern as today
2. Has a typed props interface with `entrance` animation support baked in
3. Compiles to `SlideRegion[]` via pure function in `layoutCompiler.ts`
4. Regions are NVS-normalized (0-1 coordinates) with consistent gutters

**Entrance support on all layouts:**

```tsx
<ContentSlide
  title="Key Metrics"
  entrance={{ title: 'fadeIn', body: 'slideUp', stagger: 0.15 }}
>
  <MetricRow items={[...]} />
</ContentSlide>
```

```typescript
interface SlideRegionEntrance {
  title?: EntranceType;
  body?: EntranceType;
  left?: EntranceType;
  right?: EntranceType;
  stagger?: number;         // progress delay between regions, default 0
}

type EntranceType = 'fadeIn' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight' | 'grow' | 'none';
```

---

### 1C. Themed React Graphical Components

**Package:** `@brewsite/slides`
**Files:**

| File | Contents |
|------|----------|
| `packages/slides/src/graphics/StatCard.tsx` | Big number with label, trend, icon |
| `packages/slides/src/graphics/Timeline.tsx` | Horizontal/vertical milestone timeline |
| `packages/slides/src/graphics/ProcessSteps.tsx` | Sequential numbered steps with icons |
| `packages/slides/src/graphics/IconGrid.tsx` | Grid of icons with labels |
| `packages/slides/src/graphics/ComparisonTable.tsx` | Feature matrix with check/cross/values |
| `packages/slides/src/graphics/ProgressRing.tsx` | Circular progress indicator |
| `packages/slides/src/graphics/ProgressBar.tsx` | Linear progress indicator |
| `packages/slides/src/graphics/CalloutBox.tsx` | Highlighted text container |
| `packages/slides/src/graphics/QuoteBlock.tsx` | Styled blockquote with attribution |
| `packages/slides/src/graphics/MetricRow.tsx` | Row of stat values with labels |
| `packages/slides/src/graphics/Badge.tsx` | Status indicator tag |
| `packages/slides/src/graphics/Divider.tsx` | Styled section divider |
| `packages/slides/src/graphics/index.ts` | Barrel export |

**Design principles:**
- Standard React components (NOT DSL stubs — these render real HTML)
- Visual styling (colors, fonts, shadows) via `--brewsite-*` CSS variables from core
- Behavioral styling (sizing, timing, density) via `--slide-*` CSS variables from SlideTheme
- Props accept structured data: `<StatCard value={42} label="Users" trend="+12%" />`
- All components accept `className` and `style` for escape hatches
- Animation-aware: components accept optional `progress` prop (0-1) to drive entrance animations via `useSceneProgress()`; default timing from `--slide-entrance-duration` and `--slide-stagger-delay`
- Icons are passed as `ReactNode` (e.g., `icon={<HeroIcon />}`) — no dependency on `@brewsite/diagram`'s icon registry. Consumers bring their own icon library

**Test plan for graphics components:**
- Unit test per component: renders correct HTML structure with required props
- Unit test: CSS variable references use correct `var(--brewsite-*)` and `var(--slide-*)` names in computed styles
- Unit test: `progress` prop at 0, 0.5, and 1 produces correct entrance animation styles (opacity, transform)
- Unit test: `progress` undefined renders component fully visible (no animation)
- Unit test: `className` and `style` escape hatches merge correctly with internal styles

**Component API examples:**

```typescript
interface StatCardProps {
  value: string | number;
  label: string;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  icon?: ReactNode;
  progress?: number;
  className?: string;
  style?: CSSProperties;
}

interface TimelineProps {
  items: Array<{
    label: string;
    description?: string;
    date?: string;
    icon?: ReactNode;
    active?: boolean;
  }>;
  orientation?: 'horizontal' | 'vertical';
  progress?: number;
  className?: string;
  style?: CSSProperties;
}

interface ProcessStepsProps {
  steps: Array<{
    title: string;
    description?: string;
    icon?: ReactNode;
  }>;
  activeStep?: number;
  progress?: number;
  className?: string;
  style?: CSSProperties;
}

interface ComparisonTableProps {
  headers: string[];
  rows: Array<{
    feature: string;
    values: ComparisonCellValue[];
  }>;
  highlightColumn?: number;
  progress?: number;
  className?: string;
  style?: CSSProperties;
}

/** Discriminated cell type — avoids ambiguity in rendering boolean vs string vs number. */
type ComparisonCellValue =
  | { kind: 'check'; value: boolean }    // renders checkmark or cross
  | { kind: 'text'; value: string }      // renders as text
  | { kind: 'number'; value: number };   // renders as formatted number
```

---

### 1D. Animation Utility Hooks

**Package:** `@brewsite/slides`
**Files:**

| File | Contents |
|------|----------|
| `packages/slides/src/animation/useCountUp.ts` | Animated number counting |
| `packages/slides/src/animation/useStaggeredReveal.ts` | Staggered item visibility |
| `packages/slides/src/animation/useProgressWindow.ts` | Sub-window progress mapping |
| `packages/slides/src/animation/useEntrance.ts` | CSS entrance animation props |
| `packages/slides/src/animation/easings.ts` | Re-export core easings + slide-specific curves |
| `packages/slides/src/animation/index.ts` | Barrel export |

**Hook signatures:**

```typescript
/** Animated number that counts from start to target over a progress window. */
function useCountUp(
  target: number,
  options?: {
    start?: number;           // default: 0
    delay?: number;           // progress offset before counting starts (0-1), default: 0
    duration?: number;        // progress window width (0-1), default: 0.6
    easing?: (t: number) => number;
    decimals?: number;        // default: 0
  }
): number;

/** Visibility and opacity for a staggered list item. */
function useStaggeredReveal(
  index: number,
  total: number,
  options?: {
    staggerDelay?: number;    // progress gap between items (0-1), default: auto
    fadeInDuration?: number;  // per-item fade duration (0-1), default: 0.15
    startAfter?: number;      // progress offset before first item appears, default: 0
  }
): { visible: boolean; style: CSSProperties };

/** Progress [0,1] clamped and eased within a sub-window of scene progress. */
function useProgressWindow(
  start: number,
  end: number,
  options?: { easing?: (t: number) => number }
): number;

/** CSS properties for entrance animation driven by scene progress. */
function useEntrance(
  type: EntranceType,
  options?: {
    delay?: number;           // progress offset, default: 0
    duration?: number;        // progress window, default: 0.3
    distance?: string;        // translate distance, default: '24px'
    easing?: (t: number) => number;
  }
): CSSProperties;
```

All hooks internally call `useSceneProgress()` from `@brewsite/core`.

**Test plan for animation hooks:**
- `useCountUp`: verify value at progress=0 returns `start`, progress=1 returns `target`, intermediate progress returns correctly eased value. Test with `decimals: 2`. Test with `delay: 0.5` (value stays at `start` until progress > 0.5).
- `useStaggeredReveal`: verify `visible: false` when progress < item's threshold. Verify correct opacity ramp. Test edge cases: 0 items, 1 item, progress=0, progress=1. Test `startAfter` offset.
- `useProgressWindow`: verify output is 0 when progress < start, 1 when progress > end, correctly eased between. Test with custom easing function.
- `useEntrance`: verify returned CSSProperties contain correct `opacity` and `transform` for each `EntranceType`. Test `'none'` returns empty object.

---

### 1E. Expanded Slide Transitions (BREAKING)

**Package:** `@brewsite/slides`
**Files:**

| File | Change |
|------|--------|
| `packages/slides/src/player/SlideTransitionWrapper.tsx` | Rewrite for CSS-based push/slide/zoom |
| `packages/slides/src/types.ts` | Replace `SlideTransition` union |

**New type (replaces old):**

```typescript
type SlideTransition =
  | 'dissolve'       // opacity crossfade
  | 'cut'            // instant switch, no animation
  | 'fade'           // alias for dissolve (more intuitive name)
  | 'push-left'      // outgoing slides left, incoming from right
  | 'push-right'     // outgoing slides right, incoming from left
  | 'push-up'        // outgoing slides up, incoming from bottom
  | 'push-down'      // outgoing slides down, incoming from top
  | 'zoom-in'        // outgoing scales down + fades, incoming from center
  | 'zoom-out';      // outgoing scales up + fades, incoming from large
```

Implemented as CSS transitions/animations on `SlideTransitionWrapper`. No core engine changes.

`SlideTransitionWrapper` reads `--slide-transition-duration` from CSS (this is the one timing token with a CSS time unit — `300ms`) and applies it to `transition-duration` and `animation-duration` on the wrapper div. Push/zoom transitions use CSS `transform` and `opacity` keyframe animations.

---

## Phase 2: Corporate Template System

### 2A. SlideTemplate Type + Brand Assets

**Package:** `@brewsite/slides`
**Files:**

| File | Change |
|------|--------|
| `packages/slides/src/template/types.ts` | New — template type definitions |
| `packages/slides/src/template/resolveTemplate.ts` | New — template resolution logic |
| `packages/slides/src/template/index.ts` | New — barrel exports |
| `packages/slides/src/player/SlidePlayer.tsx` | Accept `template` prop |
| `packages/slides/src/compiler/deckCompiler.tsx` | Apply template defaults during compilation |
| `packages/slides/src/index.ts` | Export template types |

**Type definition:**

```typescript
interface SlideTemplate {
  /** Display name for the template. */
  name: string;

  /** Brand assets — logo, wordmark, icon for placement. */
  brand?: {
    logo?: BrandAsset;
    wordmark?: BrandAsset;
    icon?: BrandAsset;
  };

  /** Master slide configuration — elements appearing on every slide. */
  master?: {
    /** Logo placement on every slide. */
    logo?: {
      asset: 'logo' | 'wordmark' | 'icon';
      position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
      size?: string;
      opacity?: number;
      excludeLayouts?: SlideLayout[];
    };
    /** Footer text on every slide. */
    footer?: {
      text?: string;
      showPageNumbers?: boolean;
      showDate?: boolean;
      position?: 'bottom-left' | 'bottom-center' | 'bottom-right';
      excludeLayouts?: SlideLayout[];
    };
    /** Watermark applied to all slides. */
    watermark?: {
      text?: string;
      image?: string;
      opacity?: number;
    };
  };

  /** Default transition for all slides (overridable per-slide). */
  defaultTransition?: SlideTransition;

  /** Default progress indicator style. */
  defaultProgressIndicator?: ProgressStyle;
}

interface BrandAsset {
  src: string;
  alt?: string;
  aspectRatio?: string;
}
```

**Key design decision:** `SlideTemplate` is corporate chrome — orthogonal to both `SceneTheme` (visual) and `SlideTheme` (feel). Three independent axes:
- Swap `SceneTheme` to change colors/fonts
- Swap `SlideTheme` to change feel/density/timing
- Swap `SlideTemplate` to change corporate branding

Templates are lightweight objects — no color/font/spacing tokens.

**SlideTemplate also injects `--slide-*` chrome variables:**
- `--slide-footer-height` — from `master.footer` config (or `0px` if no footer)
- `--slide-logo-size` — from `master.logo` config (or `0px` if no logo)
- `--slide-watermark-opacity` — from `master.watermark` config (or `0` if no watermark)

These flow into the layout compiler so region computation accounts for footer/logo reserved space.

**Usage:**

```tsx
<SceneEngine theme={themes.enterprise.dark} plugins={[corePlugin(), slidesPlugin()]}>
  <SlidePlayer slideTheme={compactSlideTheme} template={acmeCorpTemplate}>
    <Slide key="intro">
      <TitleSlide title="Q1 Results" subtitle="March 2026" />
    </Slide>
  </SlidePlayer>
</SceneEngine>
```

---

## Phase 3: Claude-Author Documentation (`@brewsite/claude-author`)

The `packages/claude-author/docs/` directory has no `slides/` subdirectory. The entire slides authoring surface is undocumented for AI-assisted scene authoring. Per the README rules, every `##` section must be self-contained, code-first, use exact API names, and contain real TypeScript — no pseudocode, no placeholders, no tutorials.

### 3A. New `slides/` Documentation Directory

**Package:** `@brewsite/claude-author`
**Files:**

| File | Purpose | Key `##` Sections |
|------|---------|-------------------|
| `docs/slides/overview.md` | Package overview, installation, plugin registration, exports catalog | What @brewsite/slides Provides; Installation and Plugin Registration; Package Exports; When to Use SlidePlayer vs Raw Scene Authoring |
| `docs/slides/slide-layouts.md` | All 20 layout archetypes — props, regions, when to use each | One `##` per layout (e.g., "ContentSlide Layout", "BigNumberSlide Layout", "BentoSlide Layout"); When to Use ContentSlide vs TwoColumnSlide; When to Use BigNumberSlide vs MetricGridSlide |
| `docs/slides/graphics.md` | All 13 graphical React components — props, data format, examples | One `##` per component (e.g., "StatCard Component", "Timeline Component", "ComparisonTable Component"); When to Use StatCard vs MetricRow |
| `docs/slides/animation.md` | Animation hooks — useCountUp, useStaggeredReveal, useProgressWindow, useEntrance | One `##` per hook with full signature + example; How Slide Progress Drives Animations; Combining Multiple Animation Hooks |
| `docs/slides/themes.md` | SlideTheme system — presets, customization, CSS variable reference | SlideTheme Props; Named SlideTheme Presets; Creating a Custom SlideTheme; SlideTheme CSS Variable Reference |
| `docs/slides/templates.md` | SlideTemplate system — brand assets, master slides, footers, watermarks | SlideTemplate Props; Configuring Brand Assets; Master Slide Logo Placement; Master Slide Footer; Creating a Corporate Template |
| `docs/slides/transitions.md` | Slide-to-slide transitions — types, per-slide overrides | Available Slide Transitions; Choosing a Transition Type; Per-Slide Transition Overrides |
| `docs/slides/navigation.md` | Navigation config — keyboard, touch, pointer, progress indicators | Navigation Modes; Configuring Keyboard Navigation; Progress Indicator Styles; Programmatic Navigation via useSlideNavigation |
| `docs/slides/3d-content.md` | Embedding 3D content in slides via sceneDsl — diagrams, charts, models | Adding a 3D Diagram to a Slide; Adding a 3D Chart to a Slide; Camera and Lighting in Slides; When to Use sceneDsl vs Graphics Components |
| `docs/slides/speaker-notes.md` | Speaker notes and presenter view | Adding Speaker Notes; PresenterView Component; useSlideNotes Hook |
| `docs/slides/print-export.md` | Print layout and slide snapshot capture | Capturing Slide Snapshots; SlidePrintLayout Component; Print Layout with Notes |
| `docs/slides/deck-patterns.md` | Common corporate deck patterns composed from layouts + graphics | Pitch Deck Pattern (Sequoia format); Quarterly Business Review Pattern; All-Hands / Town Hall Pattern; When to Use Which Deck Pattern |

### 3B. Section Content Outlines

Below are the key `##` sections with content guidance. Each section follows the claude-author rules: code-first, self-contained, exact API names, real TypeScript.

#### `overview.md`

**## What @brewsite/slides Provides**
- One paragraph: slide deck presentations built on @brewsite/core
- Three-axis customization model: SceneTheme (visual) + SlideTheme (feel) + SlideTemplate (branding)
- Bullet list of capabilities: 19 layouts, 13 graphics components, 4 animation hooks, CSS transitions, templates, speaker notes, 3D content integration

**## Installation and Plugin Registration**
```tsx
import { useMemo } from 'react';
import { corePlugin, SceneEngine, SceneCanvas, EngineOverlayHost } from '@brewsite/core';
import { slidesPlugin, SlidePlayer, Slide, TitleSlide, ContentSlide, Heading, BulletList } from '@brewsite/slides';

export default function MyDeckPage() {
  const plugins = useMemo(() => [corePlugin(), slidesPlugin()], []);
  return (
    <SceneEngine theme={themes.enterprise.dark} plugins={plugins}>
      <SlidePlayer slideTheme={defaultSlideTheme}>
        <Slide key="intro">
          <TitleSlide title="Hello World" subtitle="A BrewSite Presentation" />
        </Slide>
        <Slide key="content">
          <ContentSlide title="Key Points">
            <BulletList items={['Point one', 'Point two', 'Point three']} animateEntrance />
          </ContentSlide>
        </Slide>
      </SlidePlayer>
    </SceneEngine>
  );
}
```
- Explain: `slidesPlugin()` takes no arguments, creates SlideMetaWidget + SlideNavWidget
- `<SlidePlayer>` accepts `slideTheme` and `template` — both optional, sensible defaults

**## DSL and Layout Component Exports**
- Table of: `Slide`, all 19 layout components, text primitives (`Heading`, `Body`, `BulletList`, `NumberedList`)
- Follow the exact format used in `charts/overview.md`

**## Graphics Component and Animation Exports**
- Table of: all 13 graphics components, 4 animation hooks, easing re-exports
- Split from DSL exports so each table is a self-contained retrieval chunk under ~800 tokens

**## Player, Theme, and Template Exports**
- Table of: `SlidePlayer`, `slidesPlugin`, navigation hooks, `SlideTheme` presets/factory, `SlideTemplate` type, progress indicator types

**## When to Use SlidePlayer vs Raw Scene Authoring**
- Use SlidePlayer when building a linear slide deck with navigation, progress indicators, and corporate chrome
- Use raw `<Scene>` authoring when building scroll-driven marketing pages, interactive experiences, or non-linear presentations
- SlidePlayer is a convenience layer — it compiles `<Slide>` children into `<Scene>` elements with automatic transitions, navigation, and overlay content management

#### `slide-layouts.md`

**One `##` section per layout.** Each section follows this template:

```markdown
## ContentSlide Layout

Use `<ContentSlide>` for a standard title-bar-plus-body arrangement. The title
occupies the top 18% of the viewport; the body fills the remainder. This is the
most common layout for text-heavy slides with bullet points, paragraphs, or
graphical components.

| Prop | Type | Default | Description |
|---|---|---|---|
| `title` | `string` | required | Title bar text |
| `entrance` | `SlideRegionEntrance` | `undefined` | Per-region entrance animations |

Regions: `title` (top 18%), `body` (remaining 80%, 2% gutter).

‎```tsx
<Slide key="metrics">
  <ContentSlide title="Q1 Performance" entrance={{ title: 'fadeIn', body: 'slideUp', stagger: 0.15 }}>
    <MetricRow items={[
      { value: '42K', label: 'Users' },
      { value: '$1.2M', label: 'Revenue' },
      { value: '98%', label: 'Uptime' },
    ]} />
  </ContentSlide>
</Slide>
‎```
```

**Must include "When to Use" decision sections:**
- `## When to Use ContentSlide vs TwoColumnSlide` — single flow of content vs side-by-side comparison
- `## When to Use BigNumberSlide vs MetricGridSlide` — 1-2 hero stats vs 3-4 KPI cards
- `## When to Use TimelineSlide vs ProcessSlide` — chronological events vs sequential steps
- `## When to Use BentoSlide vs DashboardSlide` — mixed content cards vs data-focused widgets
- `## When to Use FullBleedSlide vs ImageSlide` — 3D canvas showcase vs image+text split

#### `graphics.md`

**One `##` section per component.** Each section: code example first, then props table, then data format.

```markdown
## StatCard Component

Displays a large metric value with a label, optional trend indicator, and icon.
Consumes `--brewsite-accent-color` for trend-up styling and `--brewsite-color-error`
for trend-down. Sizes from `--slide-card-border-width`.

‎```tsx
import { StatCard } from '@brewsite/slides';

<StatCard value="42K" label="Active Users" trend="+12%" trendDirection="up" />
‎```

| Prop | Type | Default | Description |
|---|---|---|---|
| `value` | `string \| number` | required | The metric value to display |
| `label` | `string` | required | Descriptive label beneath the value |
| `trend` | `string` | `undefined` | Trend text (e.g., "+12%", "-3%") |
| `trendDirection` | `'up' \| 'down' \| 'neutral'` | `'neutral'` | Colors the trend indicator |
| `icon` | `ReactNode` | `undefined` | Optional icon beside the value |
| `progress` | `number` | `undefined` | 0-1 progress for entrance animation. When set, value counts up from 0. |
```

#### `animation.md`

**One `##` section per hook.** Code-first, full signature, real example.

```markdown
## useCountUp Hook

Animates a number from a start value to a target, driven by slide progress.
Returns the current display value. Reads `--slide-count-up-duration` for default timing.

‎```tsx
import { useCountUp } from '@brewsite/slides';

function RevenueCard() {
  const value = useCountUp(1_200_000, { decimals: 0, delay: 0.1, duration: 0.5 });
  return <StatCard value={`$${value.toLocaleString()}`} label="Revenue" />;
}
‎```

| Option | Type | Default | Description |
|---|---|---|---|
| `start` | `number` | `0` | Starting value |
| `delay` | `number` | `0` | Progress offset [0-1] before counting starts |
| `duration` | `number` | from `--slide-count-up-duration` | Progress window [0-1] for the count |
| `easing` | `(t: number) => number` | `easeOutCubic` | Easing function |
| `decimals` | `number` | `0` | Decimal places in returned value |
```

#### `themes.md`

Must include:
- `## SlideTheme Props` — full type with descriptions
- `## Named SlideTheme Presets` — table: default, compact, cinematic, minimal with key differences
- `## Creating a Custom SlideTheme` — `createSlideTheme()` with real override example
- `## SlideTheme CSS Variable Reference` — complete table of `--slide-*` vars, their defaults, and what consumes them
- `## Three-Axis Customization: SceneTheme vs SlideTheme vs SlideTemplate` — the key decision guide

#### `graphics.md` — additional "when to use" sections

- `## When to Use StatCard vs Inline HTML` — StatCard consumes theme tokens, handles count-up animation, adapts to SlideTheme density. Building it yourself means reimplementing all of that. Use StatCard for themed, animated metric display. Use inline HTML only when StatCard's structure doesn't fit.
- `## When to Use progress Prop vs Animation Hooks` — Use the component's `progress` prop for simple entrance effects on individual components. Use hooks (`useEntrance`, `useStaggeredReveal`) when composing custom animations across multiple components or building custom graphics not covered by the library.

#### `templates.md`

Must include:
- `## SlideTemplate Props` — full type
- `## Configuring Brand Assets` — logo/wordmark/icon with real URLs
- `## Master Slide Logo Placement` — positions, excludeLayouts
- `## Master Slide Footer` — text, page numbers, date, positions
- `## Creating a Corporate Template` — complete real example with brand + master + defaults
- `## Template Does Not Contain Colors or Fonts` — explicit "when to use" decision: template is branding, SceneTheme is visual, SlideTheme is feel

#### `deck-patterns.md`

Maps common corporate deck structures to recommended layout sequences. High-value for retrieval — queries like "create a pitch deck" or "make a quarterly review" land here.

**## Pitch Deck Pattern (Sequoia Format)**
- 10-12 slides: TitleSlide → ContentSlide (mission) → ContentSlide (problem) → ContentSlide (solution) → ContentSlide (why now) → BigNumberSlide (market size) → ComparisonSlide (competition) → ImageSlide (product) → ContentSlide (business model) → TeamSlide → MetricGridSlide (financials) → ClosingSlide (ask)
- Code example showing the full deck structure with real layout components

**## Quarterly Business Review Pattern**
- 20-30 slides: TitleSlide → AgendaSlide → SectionSlide (per section) → MetricGridSlide (KPIs) → DashboardSlide (charts via sceneDsl) → TimelineSlide (roadmap) → ProcessSlide (action items) → ClosingSlide
- Emphasize `sceneDsl` for embedding `@brewsite/charts` 3D bar/line charts

**## All-Hands / Town Hall Pattern**
- 15-20 slides: TitleSlide → AgendaSlide → BigNumberSlide (key metrics) → ContentSlide (team highlights) → TimelineSlide (product roadmap) → QuoteSlide (customer quote) → ClosingSlide (Q&A)

**## When to Use Which Deck Pattern**
- Decision guide: pitch deck = external fundraising, QBR = internal stakeholder review, all-hands = company-wide communication. Each has different density/pacing (compact for QBR, cinematic for all-hands).

### 3C. Updates to Existing Guides

| File | Change |
|------|--------|
| `docs/guides/common-gotchas.md` | Add slide-specific gotchas (see below) |
| `docs/guides/overview.md` | Add slides to the package list |
| `docs/guides/embedding-modes.md` | Add SlidePlayer as an embedding mode alongside ScrollStage and direct mode |

**New gotcha entries for `common-gotchas.md`:**

**## Slide Layout Children Are Not React Renders**
- **Symptom:** Content passed as children to a layout component (e.g., `<ContentSlide>`) doesn't appear, or appears unstyled outside the slide region.
- **Cause:** Layout components (`<ContentSlide>`, `<TitleSlide>`, etc.) return `null` — they are compiled by the deck compiler, not rendered as React components. Children are extracted during compilation and placed into the computed NVS regions.
- **Rule:** Layout components are DSL stubs. Place text primitives (`<Heading>`, `<BulletList>`, `<Body>`) or graphics components (`<StatCard>`, `<Timeline>`) as children. Do not wrap them in custom `<div>` containers with positioning — the layout compiler handles positioning.

**## SceneTheme vs SlideTheme Confusion**
- **Symptom:** Changing `slideTheme` doesn't affect colors or fonts. Changing `SceneTheme` doesn't affect animation timing or content density.
- **Cause:** Mixing up the three customization axes.
- **Rule:** `SceneTheme` (on `<SceneEngine>`) controls colors, fonts, spacing. `SlideTheme` (on `<SlidePlayer>`) controls timing, density, typography scale. `SlideTemplate` (on `<SlidePlayer>`) controls corporate branding. They are independent — each controls a different concern.
- **Wrong:** Setting `slideTheme` expecting color changes.
- **Correct:** Set `theme` on `<SceneEngine>` for colors, `slideTheme` on `<SlidePlayer>` for feel.

**## Using sceneDsl Without Camera or Lighting**
- **Symptom:** 3D content (diagrams, charts, models) inside a slide via `sceneDsl` appears black, unlit, or positioned incorrectly.
- **Cause:** The `sceneDsl` prop injects 3D elements into the scene, but SlidePlayer does not provide default Camera or Lighting. Without them, the 3D content has no viewpoint and no illumination.
- **Rule:** Always include `<Camera>` and `<Lighting>` inside `sceneDsl` when adding 3D content to a slide.
- **Wrong:** `<Slide sceneDsl={<Diagram id="arch"><DiagramNode .../></Diagram>} />`
- **Correct:** `<Slide sceneDsl={<><Camera mode="world" position={[0,1.5,5]} /><Lighting><Ambient intensity={0.8} /></Lighting><Diagram id="arch"><DiagramNode .../></Diagram></>} />`

**## Graphics Components Must Be Inside Layout Children**
- **Symptom:** A `<StatCard>` or `<Timeline>` placed directly inside `<Slide>` (not inside a layout component) doesn't appear, or renders as raw overlay content outside slide regions.
- **Cause:** Graphics components are real React components, but they must be placed as children of a layout component (`<ContentSlide>`, `<BigNumberSlide>`, etc.) so the deck compiler places them into the correct NVS region. Placing them directly inside `<Slide>` bypasses region placement.
- **Rule:** Always wrap graphics components in a layout. Use `<BlankSlide>` if you want full manual control — but even then, graphics components will render as overlay content at their default position without the layout compiler's region management.

**## SlideTheme Timing Values Are Progress Fractions, Not Milliseconds**
- **Symptom:** Setting `entranceDuration: 300` on a `SlideTheme` causes elements to never appear (the animation window extends from 0% to 30,000% of progress — effectively infinite).
- **Cause:** `SlideTheme.timing.entranceDuration`, `.staggerDelay`, and `.countUpDuration` are progress fractions [0-1], not milliseconds. `0.3` means "30% of the slide's progress window."
- **Rule:** Use values between 0 and 1 for all `SlideTheme.timing` fields except `transitionDuration` (which IS a CSS time string like `'300ms'`).
- **Wrong:** `createSlideTheme({ timing: { entranceDuration: 300 } })` — 300 is not a valid progress fraction.
- **Correct:** `createSlideTheme({ timing: { entranceDuration: 0.3 } })` — entrance completes at 30% progress.

**## Entrance Animation Without scrollUnits**
- **Symptom:** Entrance animations (`entrance` prop on layouts, `animateEntrance` on `<BulletList>`) fire instantly instead of revealing progressively as the user navigates.
- **Cause:** The slide has no scroll budget — `sceneProgress` jumps from 0 to 1 on entry.
- **Rule:** Entrance animations are driven by `sceneProgress`. For them to be visible, the slide needs a scroll budget via `<ProgressManager scrollUnits={...}>` inside `sceneDsl`, or the default slide `scrollUnits` must be > 0.

### 3D. Documentation Sequence

Slides docs should be written **after Phase 1 implementation lands** — per the README, docs must be written from source code (`types.ts`, `dsl.tsx`), not from PRDs. However, the section outlines above serve as the spec for what docs must cover.

The docs writer reads the implemented types and produces content that matches the actual API. If any prop names, component names, or type signatures differ from this plan after implementation, the docs follow the code — not this plan.

---

## Explicit Non-Goals / Deferred Features

The following items were identified in the research note but are intentionally out of scope for this plan. They are candidates for a future phase.

**Deferred layouts:**

| Layout | Why Deferred |
|--------|-------------|
| Funnel | Tapering stages require custom geometry (not a simple NVS region grid). Better implemented as a graphical component inside a `ContentSlide` or `FullBleedSlide`. |
| Roadmap / Swimlane | Multi-track timeline with parallel streams is complex — requires a dedicated data model for lanes + time axis. Better treated as a Phase 2+ graphical component. |

**Deferred graphical components:**

| Component | Why Deferred |
|-----------|-------------|
| Gauge / Meter | Semicircular SVG with needle animation — moderate complexity. Candidate for Phase 2. |
| Cycle Diagram | Circular arrows with labeled stages — requires SVG path generation. Candidate for Phase 2. |
| Funnel Diagram | Tapering SVG stages — pairs with the funnel layout decision above. Candidate for Phase 2. |
| Bubble / Circle Size Chart | Relative-size circles — overlaps with `@brewsite/charts` scatter plot. Evaluate whether this belongs in slides or charts. |

**Deferred transitions:**

| Transition | Why Deferred |
|------------|-------------|
| Morph / Magic Move | Requires shared-key object interpolation between slides — matching objects by ID and smoothly animating position, size, rotation, and opacity. Architecturally complex (PowerPoint's implementation took years). The CSS-based transition approach in this plan cannot support morph. Candidate for a future plan with core engine changes. |

---

## Deleted Items (vs. Previous Plan Versions)

| Item | Why Deleted |
|------|-------------|
| Phase 0C: OverlayTheme type uplift to core | Unnecessary — slides consumes SceneTheme for visual tokens directly |
| Phase 0B original: ThemeBundle `deck` slot | Unnecessary — no parallel deck theme type to bundle |
| `DeckTheme` / `ResolvedDeckTheme` types | Replaced by `SceneTheme` (visual) + `SlideTheme` (feel) |
| `themeFamily.ts` / `DECK_THEME_PAIRS` | Slides uses the same SceneTheme families as everyone else |
| `createDeckTheme()` / `defaultDeckTheme` / `darkDeckTheme` | Replaced by `createSlideTheme()` / `defaultSlideTheme` / named presets |

## What Changed (vs. Previous Plan Versions)

| Item | Was | Now |
|------|-----|-----|
| `--slide-*` CSS namespace | Deleted entirely | **Retained** — but scoped to presentation-specific behavioral tokens (timing, density, component sizing, chrome). No longer contains colors, fonts, or spacing that duplicate core. |
| `themeCompiler.ts` | Deleted | **Rewritten** — resolves `SlideTheme` + `SlideTemplate` → `--slide-*` CSS variables |
| Slide customization model | SceneTheme only | **Three independent axes:** SceneTheme (visual), SlideTheme (feel), SlideTemplate (branding) |

---

## Implementation Sequence

```
0A  Core: SceneTheme + EngineOverlayHost CSS vars ──┐
0B  Themes: accentColor in scene presets ────────────┤
                                                     │
                                                     ├─→ 1A  Slides: SlideTheme + SceneTheme integration
                                                     │    1B  Slides: Redesigned layout system (19 layouts)
                                                     │    1C  Slides: Graphics components (13 components)
                                                     │    1D  Slides: Animation hooks
                                                     │    1E  Slides: Expanded transitions
                                                     │
                                                     ├─→ 2A  Slides: SlideTemplate + brand assets
                                                     │
                                                     └─→ 3A  Claude-author: slides/ docs directory (12 files)
                                                          3B  Claude-author: gotchas + guide updates
```

Phase 0 items (0A, 0B) are independent and can be implemented in parallel.
Phase 1 items: 1A should land first (establishes theme plumbing + `--slide-*` vars + CSS migration). 1B and 1D-1E can then be implemented in parallel. 1C (graphics components) should begin after 1A's `SlideTheme` type and CSS variable names are finalized — the component CSS needs stable variable names to reference, even if the injection code isn't fully wired yet.
Phase 2 depends on Phase 1B (templates reference layouts).
Phase 3 depends on Phases 1 and 2 being implemented — docs are written from source code, not PRDs.

**Total upstream work:** One core change (SceneTheme + CSS vars), one themes change (preset values). Everything else is slides-internal + docs.

---

## Summary: Three-Axis Customization Model

```
┌─────────────────────────────────────────────────────────────────────┐
│  SceneTheme (core)                                                  │
│  "What color, what font, what spacing"                              │
│  --brewsite-accent-color, --brewsite-text-primary, etc.             │
│  Set via: <SceneEngine theme={themes.enterprise.dark}>              │
│  Shared with: diagram, charts, model, slides                       │
├─────────────────────────────────────────────────────────────────────┤
│  SlideTheme (slides)                                                │
│  "How slides feel"                                                  │
│  --slide-transition-duration, --slide-content-padding, etc.         │
│  Set via: <SlidePlayer slideTheme={compactSlideTheme}>              │
│  Presets: default, compact, cinematic, minimal                      │
├─────────────────────────────────────────────────────────────────────┤
│  SlideTemplate (slides)                                             │
│  "Whose slides these are"                                           │
│  --slide-footer-height, --slide-logo-size, etc.                     │
│  Set via: <SlidePlayer template={acmeCorpTemplate}>                 │
│  Contains: brand assets, master slide chrome, behavioral defaults   │
└─────────────────────────────────────────────────────────────────────┘

All three axes are independent. Swap any without affecting the others.
```

---
title: "Cross-Package Gap Analysis for Slides Expansion"
doc_type: note
owner: Toolkit Product
status: final
updated: 2026-03-20
---

# Cross-Package Gap Analysis: What Needs to Change Outside `@brewsite/slides`

This note traces every planned capability from the slides expansion research back through the dependency chain to identify required changes in `@brewsite/core`, `@brewsite/themes`, and other packages. The goal: know exactly what upstream work must land before or alongside the slides expansion.

---

## Executive Summary

The slides expansion is **mostly self-contained** within `@brewsite/slides`. The current architecture — NVS region compilation, `useSceneProgress()`/`useVariable()` for animation, `EngineOverlayHost` for HTML rendering — handles the majority of planned features without upstream changes.

**Four areas require upstream work:**

| # | Package | Gap | Severity | Blocking? |
|---|---------|-----|----------|-----------|
| 1 | `@brewsite/core` | EngineOverlayHost CSS variable surface too narrow | **High** | Yes — blocks themed React component library |
| 2 | `@brewsite/themes` | ThemeBundle has no `deck` slot | **Medium** | Yes — blocks unified corporate template system |
| 3 | `@brewsite/core` | Transition system limited to dissolve/crossfade | **Low** | No — nice-to-have, not critical path |
| 4 | `@brewsite/core` | No shared animation utility hooks | **Low** | No — can live in slides package initially |

---

## Gap 1: EngineOverlayHost CSS Variable Surface (HIGH — BLOCKING)

### The Problem

The planned graphical elements library (stat cards, timelines, process steps, icon grids, comparison tables, progress indicators, callout boxes) will be **themed React components** rendered inside `EngineOverlayHost`. They need to consume semantic design tokens via CSS variables.

Today, `EngineOverlayHost` injects only **11 CSS variables**:

```
--brewsite-font-family           (font)
--brewsite-font-size-heading     (scale)
--brewsite-font-size-body        (scale)
--brewsite-font-size-label       (scale)
--brewsite-font-size-caption     (scale)
--brewsite-font-size-annotation  (scale)
--brewsite-color-mode            ('dark' | 'light')
--brewsite-text-primary          (#fff or #111)
--brewsite-text-secondary        (rgba white/black 0.6)
--brewsite-background-color      (from theme or fallback)
--brewsite-surface-elevated      (rgba white/black 0.06/0.04)
--brewsite-border-subtle         (rgba white/black 0.12/0.10)
--brewsite-radius-base           ('6px')
```

### What's Missing

A themed component library needs these additional semantic tokens:

**Color tokens (derived from SceneTheme + DeckTheme):**
- `--brewsite-accent-color` — Primary brand/accent color (exists in DeckTheme but NOT in SceneTheme or CSS vars)
- `--brewsite-accent-color-muted` — Softened accent for backgrounds/fills
- `--brewsite-text-muted` — Tertiary text color (lower contrast than secondary)
- `--brewsite-text-inverse` — Inverse polarity text (for accent-colored backgrounds)
- `--brewsite-surface-base` — Base surface color (cards, containers)
- `--brewsite-surface-hover` — Hover state surface
- `--brewsite-color-success` — Semantic success (green)
- `--brewsite-color-warning` — Semantic warning (amber)
- `--brewsite-color-error` — Semantic error (red)
- `--brewsite-color-info` — Semantic info (blue)

**Note:** SceneTheme already has `highlightPalette` with `primary`, `secondary`, `success`, `warning`, `error`, `info` variants — but these are 3D highlight configs (beam height, smoke, etc.), not CSS color values. The color values inside them (`color` field) could be surfaced as CSS variables.

**Spacing tokens:**
- `--brewsite-spacing-xs` through `--brewsite-spacing-xl` — Consistent spacing scale
- `--brewsite-spacing-slide` — Slide-level padding (currently only in DeckTheme, not CSS vars)

**Effect tokens:**
- `--brewsite-shadow-sm`, `--brewsite-shadow-md`, `--brewsite-shadow-lg` — Elevation shadows
- `--brewsite-border-radius-sm`, `--brewsite-border-radius-md`, `--brewsite-border-radius-lg` — Radius scale (currently only `--brewsite-radius-base`)

### Recommendation

**Expand EngineOverlayHost's CSS variable injection** to derive ~15-20 additional semantic tokens from the existing `SceneTheme`. The variables should be computed from what's already available:

- Accent color: requires adding an `accentColor?: string` field to `SceneTheme` (or reading from `highlightPalette.primary.color`)
- Semantic colors: extract from `highlightPalette` entries (`.color` field)
- Spacing scale: derive from a new `SceneTheme.spacing` token set (or hardcode a sensible default scale)
- Shadows: derive from `colorMode` (dark themes get lighter shadows, light themes get darker)

**Alternative approach:** The slides package could inject its own CSS variables from `DeckTheme` (which already has `accentColor`, `colors.muted`, `spacing.slide`, `spacing.stack`). This is what happens today — `SlidePlayer` injects `--slide-*` variables. The question is: should these tokens live at the **core** level (benefiting all packages) or the **slides** level (slides-specific)?

**My recommendation: Core level.** These tokens are useful for any overlay content in any BrewSite scene, not just slides. Diagram overlays, chart tooltips, model labels — they all benefit from a richer CSS variable surface. The cost is ~20 lines of CSS variable computation in `EngineOverlayHost`.

### Impact

- **File:** `packages/core/src/player/EngineOverlayHost.tsx` — expand `themeStyles` object
- **File:** `packages/core/src/theme/types.ts` — add optional `accentColor` and `spacing` to `SceneTheme`
- **Semver:** Minor bump (additive, backward-compatible)
- **Effort:** Small (1-2 hours)

---

## Gap 2: ThemeBundle Missing `deck` Slot (MEDIUM — BLOCKING)

### The Problem

`ThemeBundle` in `@brewsite/themes` currently bundles three theme types:

```typescript
interface ThemeBundle {
  readonly family: ThemeFamily;
  readonly scene:   { dark: SceneTheme;   light: SceneTheme };
  readonly diagram: { dark: DiagramTheme; light: DiagramTheme };
  readonly chart:   { dark: ChartTheme;   light: ChartTheme };
}
```

There is no `deck` slot. The slides package maintains its own parallel theme system (`DeckTheme`, `darkDeckTheme`, `DECK_THEME_PAIRS`, `getDeckThemeForFamily()`). This means:

1. A corporate template cannot be expressed as a single `ThemeBundle` — the deck theme is separate
2. `themesPlugin()` registers scene/diagram/chart themes but not deck themes
3. There's no coordinated dark/light polarity switching for deck themes via the same mechanism

### What's Needed

Add `deck` as an optional slot in `ThemeBundle`:

```typescript
interface ThemeBundle {
  readonly family: ThemeFamily;
  readonly scene:   { dark: SceneTheme;   light: SceneTheme };
  readonly diagram: { dark: DiagramTheme; light: DiagramTheme };
  readonly chart:   { dark: ChartTheme;   light: ChartTheme };
  readonly deck?:   { dark: DeckTheme;    light: DeckTheme };   // NEW
}
```

`optional` because not every theme family needs a deck variant, and existing bundles don't break.

### What This Enables

```typescript
// Corporate template = just a ThemeBundle with a deck slot
const acmeCorp = mergeThemeBundle(bundles.enterprise, {
  deck: {
    dark: {
      fonts: { heading: 'Acme Sans', body: 'Acme Serif' },
      colors: { heading: '#003366', body: '#f0f0f0', surface: '#1a1a2e', muted: '#666' },
      accentColor: '#ff6600',
      // logo, footer, etc. — new DeckTheme fields from slides expansion
    },
    light: { /* ... */ },
  },
});
```

### Impact

- **File:** `packages/themes/src/types.ts` — add optional `deck` field
- **File:** `packages/themes/src/plugin.ts` — register deck themes when present
- **File:** `packages/themes/src/merge.ts` — handle deck merging
- **File:** `packages/themes/src/bundles/*.ts` — add deck presets per family
- **New dependency:** `@brewsite/themes` gains optional peer dep on `@brewsite/slides` (or imports `DeckTheme` type only)
- **Semver:** Minor bump (additive)
- **Effort:** Small-medium (half day)

### Design Consideration: Dependency Direction

`@brewsite/themes` currently imports types from `core`, `diagram`, and `charts`. Adding a `DeckTheme` import from `@brewsite/slides` creates a new dependency edge. Two options:

**Option A: Move `DeckTheme` type to `@brewsite/core`** — Since `DeckTheme` is structurally simple (colors, fonts, spacing), it could live in core alongside `SceneTheme`. This avoids the themes→slides dependency but puts a slides-specific type in core.

**Option B: Keep `DeckTheme` in slides, add optional peer dep** — `@brewsite/themes` adds `@brewsite/slides` as an optional peer dep and uses conditional typing. This preserves package boundaries but adds complexity.

**Recommendation: Option A.** `DeckTheme` is fundamentally a CSS-level theme token set — colors, fonts, spacing. It's not slides-specific; it describes how HTML overlay content should look. Renaming it to something like `OverlayTheme` and placing it in core would be architecturally clean and useful beyond slides.

---

## Gap 3: Transition System (LOW — NOT BLOCKING)

### Current State

Two named transition types: `dissolve` and `crossfade`. No `cut`, `push`, `slide`, `morph`, or `zoom`.

### What's Needed for Slides

For corporate presentations, the practical need is limited:
- **Cut** — Most professional (McKinsey default). Needed, currently missing.
- **Dissolve** — Already implemented. Covers most cases.
- **Push/Slide** — Nice-to-have for modern feel.
- **Morph** — High-impact but complex (PowerPoint's best feature). Deferred.

### Why It's Not Blocking

The slides package already uses `SlideTransitionWrapper` for CSS-based visual transitions independent of the core engine transition system. Slide-to-slide visual effects (push, slide, zoom) can be implemented as CSS animations on the overlay content wrapper without any core engine changes.

The core transition system handles **3D scene state interpolation** (camera, lighting, diagram positions). For slides, the 3D content is secondary to the overlay HTML content. CSS transitions on the overlay layer are sufficient and arguably better (GPU-accelerated, simpler, more control).

### If We Do Want Core Changes Later

- Add `'cut'` to `TransitionName` — requires zero-tick block architecture (non-trivial)
- Add `'push'` — apply camera/group translation during transition block
- Add `'morph'` — match objects by key between scenes, interpolate properties (substantial engineering)

### Recommendation

Defer core transition changes. Use CSS-based slide transitions in `@brewsite/slides`. This is what Slidev, reveal.js, and every other web presentation tool does — and it works well.

---

## Gap 4: Animation Utility Hooks (LOW — NOT BLOCKING)

### The Problem

The planned graphical elements need progress-driven animations:
- **Number counting** (stat cards counting up from 0 to final value)
- **Staggered reveal** (items appearing one-by-one)
- **Progress fill** (bars/rings filling to target)
- **Region entrance** (fade/fly per layout region)

The primitive `useSceneProgress()` and `useVariable('scene', 'progress')` hooks exist in core and provide the raw 0→1 progress value. But every component would need to reimplement the same animation math: easing, stagger offsets, threshold gating, etc.

### What Would Be Useful

A small set of animation utility hooks:

```typescript
// Animate a numeric value from 0 to target over a progress window
useCountUp(target: number, options?: { start?: number; delay?: number; duration?: number; easing?: EasingFn })

// Returns visibility boolean + opacity for staggered list items
useStaggeredReveal(index: number, total: number, options?: { delay?: number; overlap?: number })

// Returns progress [0,1] clamped to a sub-window of scene progress
useProgressWindow(start: number, end: number, options?: { easing?: EasingFn })

// Returns entrance animation CSS properties (opacity, transform)
useEntranceAnimation(type: 'fade' | 'slideUp' | 'slideDown' | 'grow', options?: { delay?: number; duration?: number })
```

### Where Should These Live?

**Option A: `@brewsite/core`** — Available to all overlay content in any scene.
**Option B: `@brewsite/slides`** — Slides-specific, tighter scope.

**Recommendation: Start in `@brewsite/slides`, promote to core if demand appears.** These hooks are presentation-specific. Scene overlays in non-slide contexts (marketing pages, docs) have their own animation patterns (scroll-driven, not slide-progress-driven). Keeping them in slides avoids premature abstraction.

### Not Blocking Because

Authors can implement the same logic inline today:

```typescript
const progress = useSceneProgress();
const count = Math.round(progress * targetValue);
const visible = progress > itemIndex / totalItems;
```

The hooks are a DX improvement, not a capability gap.

---

## Packages That Do NOT Need Changes

### `@brewsite/charts` — No Changes

Charts are 3D-rendered via Three.js. The slides expansion's graphical elements (stat cards, timelines, etc.) are 2D React components. Different rendering layer entirely.

The existing `sceneDsl` prop on `<Slide>` already allows embedding `<BarChart>`, `<PieChart>`, etc. in slides for 3D data visualization. No additional integration is needed.

### `@brewsite/diagram` — No Changes

Same reasoning as charts. Diagram elements are 3D. Slide graphical elements are HTML. The `sceneDsl` bridge already works.

### `@brewsite/model` — No Changes

GLTF models embed via `sceneDsl`. No slide-specific model features are planned.

### `@brewsite/screens` — No Changes

Screen elements embed via `sceneDsl`. No changes needed.

### `@brewsite/textures` — No Changes

PBR textures are 3D-only. Not relevant to HTML overlay components.

---

## Dependency Graph for Implementation Sequencing

```
┌──────────────────────────────────────────────────────┐
│  Phase 0: Upstream Prerequisites                     │
│                                                      │
│  @brewsite/core                                      │
│    ├─ Expand EngineOverlayHost CSS variables (Gap 1) │
│    └─ Add accentColor + spacing to SceneTheme        │
│                                                      │
│  @brewsite/themes                                    │
│    └─ Add optional deck slot to ThemeBundle (Gap 2)  │
└──────────────────────┬───────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────┐
│  Phase 1: Slides Layout + Graphics Library           │
│                                                      │
│  @brewsite/slides                                    │
│    ├─ New layout archetypes (15+)                    │
│    ├─ Themed React graphical components              │
│    │    (stat cards, timelines, process steps, etc.) │
│    └─ Animation utility hooks                        │
└──────────────────────┬───────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────┐
│  Phase 2: Corporate Template System                  │
│                                                      │
│  @brewsite/slides                                    │
│    ├─ CorporateTemplate type + API                   │
│    ├─ Brand asset system (logo, watermark, footer)   │
│    └─ Master slide concept (per-layout globals)      │
│                                                      │
│  @brewsite/themes                                    │
│    └─ Deck theme presets per family                  │
└──────────────────────┬───────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────┐
│  Phase 3: Enhanced Animations (slides-only)          │
│                                                      │
│  @brewsite/slides                                    │
│    ├─ Region-level entrance animations               │
│    ├─ CSS-based slide transitions (push, zoom)       │
│    └─ Staggered reveal for any list/grid             │
└──────────────────────────────────────────────────────┘
```

---

## Summary

The slides expansion is architecturally well-positioned. The core engine already provides the key primitives: NVS region compilation, per-frame progress publishing via VariableStore, overlay HTML rendering via EngineOverlayHost, and theme CSS variable injection.

The two blocking upstream changes are **small and additive**: expanding the CSS variable surface in `EngineOverlayHost` (~20 new variables derived from existing theme data) and adding an optional `deck` slot to `ThemeBundle`. Both are minor semver bumps with zero breaking changes.

Everything else — layouts, graphical components, animation hooks, template system, CSS transitions — lives cleanly in `@brewsite/slides`.

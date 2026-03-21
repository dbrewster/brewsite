---
title: "Slides Expansion — Implementation Plan"
doc_type: plan
owner: Architecture
status: complete
updated: 2026-03-20
---

# Slides Expansion — Implementation Plan

This plan implements the slides expansion change plan from `requirements/slides/notes/note_slides-expansion-change-plan.md`. It is organized into parallelizable work streams with explicit file ownership, sequencing dependencies, and complete type definitions.

**Breaking changes in `@brewsite/slides` are permitted.** The package is super-alpha.

---

## Table of Contents

1. [Work Stream Overview & Dependency Graph](#1-work-stream-overview--dependency-graph)
2. [Stream A — Core: SceneTheme Expansion + EngineOverlayHost CSS Vars (Phase 0A)](#2-stream-a)
3. [Stream B — Themes: Preset Enrichment (Phase 0B)](#3-stream-b)
4. [Stream C — Slides: Theme System Rewrite + SlidePlayer Architecture (Phase 1A + 1E)](#4-stream-c)
5. [Stream D — Slides: Layout System Rewrite (Phase 1B)](#5-stream-d)
6. [Stream E — Slides: Graphics Components + Animation Hooks (Phase 1C + 1D)](#6-stream-e)
7. [Phase 2 — Corporate Template System (Phase 2A)](#7-phase-2)
8. [Phase 3 — Claude-Author Documentation (Phase 3A-3D)](#8-phase-3)
9. [File Ownership Matrix](#9-file-ownership-matrix)
10. [Testing Strategy](#10-testing-strategy)

---

## 1. Work Stream Overview & Dependency Graph

```
Stream A (Phase 0A)  ───────────────────────────────────────────┐
  @brewsite/core: SceneTheme types + EngineOverlayHost          │
  Files: 2 modified, 1 new test file                             │
                                                                 │
Stream B (Phase 0B)  ───────────────────────────────────────────┤
  @brewsite/themes: preset enrichment                            │  A and B run in PARALLEL
  Files: 6 modified                                              │
                                                                 │
                          ┌──────────────────────────────────────┘
                          │  GATE: Streams A+B must complete before C/D/E start
                          │
Stream C (Phase 1A+1E) ──┤  Slides: Theme system + SlidePlayer + Transitions
  Files: 12 modified/new  │
                          │
Stream D (Phase 1B) ──────┤  Slides: Layout system rewrite
  D Steps D1+D3 parallel  │  D1 (layoutCompiler) + D3 (tests) run PARALLEL with C
  with C. D2 after C.     │  D2 (deckCompiler layout branches) runs AFTER C lands
                          │
Stream E (Phase 1C+1D) ───┤  Slides: Graphics + Animation hooks
  Files: 15 new           │  E depends on C landing --slide-* CSS var names
                          │
                          │  GATE: Streams C+D+E complete
                          │
Phase 2 (2A) ─────────────┤  Slides: SlideTemplate system
  Files: 4 new, 3 modified│
                          │
Phase 3 (3A-3D) ──────────┘  Claude-author docs (after all implementation)
  Files: 15 new, 3 modified
```

### Parallel Safety Rules

1. **Streams A and B** touch different packages — fully parallel.
2. **Streams C and D** both touch `@brewsite/slides` with a carefully sequenced overlap:
   - Stream C owns: `types.ts`, `theme.ts`, `themeFamily.ts` (delete), `plugin.ts`, `compiler/themeCompiler.ts`, `compiler/deckCompiler.tsx`, `dsl.tsx`, `player/SlidePlayer.tsx`, `player/SlideTransitionWrapper.tsx`, `player/PresenterView.tsx`, `player/SlidePrintLayout.tsx`, `widget/SlideMetaWidget.ts`
   - Stream D owns: `compiler/layoutCompiler.ts`
   - **Stream D is split into two phases:**
     - **D-parallel** (Steps D1 + D3): `layoutCompiler.ts` rewrite + tests. Runs in parallel with C — no shared files.
     - **D-sequential** (Step D2): `deckCompiler.tsx` layout branches for `extractLayoutInfo()` and `buildSceneElements()`. Runs AFTER Stream C completes its rewrite of `deckCompiler.tsx`. This is not a true parallel stream — it's a fast follow-up that adds layout cases to C's already-landed code.
   - **Shared file**: `index.ts` — Stream C updates first (removes DeckTheme exports, adds SlideTheme/SlideTemplate exports). Stream D updates second (adds new layout component exports). Stream E updates third (adds graphics + animation exports).
3. **Stream E** depends on Stream C's `--slide-*` CSS variable names being finalized. It touches only NEW files (no overlap with C or D). It updates `index.ts` after C and D.

---

## 2. Stream A — Core: SceneTheme Expansion + EngineOverlayHost CSS Vars (Phase 0A)

**Package:** `@brewsite/core`
**Semver:** Minor (additive, zero breaking changes)

### Step A1: Expand `SceneTheme` type in `packages/core/src/theme/types.ts`

Add the following optional fields to `SceneTheme`. All existing fields remain unchanged. The `font` field type is widened to include `htmlHeadingFamily`.

**Exact changes to `SceneTheme` type (line ~366):**

```typescript
export type SceneTheme = {
  // ... ALL existing fields unchanged ...

  /** Primary brand/accent color. Default: '#2563eb' (blue-600). */
  readonly accentColor?: string;

  /**
   * Per-family text and surface color overrides. When present, take precedence
   * over colorMode-derived defaults in EngineOverlayHost. When absent,
   * EngineOverlayHost falls back to existing derivation rules.
   */
  readonly textColors?: {
    /** Overrides --brewsite-text-primary */
    readonly primary?: string;
    /** Overrides --brewsite-text-secondary */
    readonly secondary?: string;
    /** Overrides --brewsite-text-muted (new variable) */
    readonly muted?: string;
    /** Overrides --brewsite-surface-elevated */
    readonly surface?: string;
  };

  /** Semantic status colors. Falls back to highlightPalette colors or hardcoded defaults. */
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

  readonly font: SceneThemeFontTokens & {
    /**
     * Optional CSS font-family string for headings. EngineOverlayHost injects
     * --brewsite-font-heading. Falls back to font.htmlFamily when absent.
     */
    readonly htmlHeadingFamily?: string;
  };
};
```

**IMPORTANT:** The `font` field changes from `readonly font: SceneThemeFontTokens` to `readonly font: SceneThemeFontTokens & { readonly htmlHeadingFamily?: string }`. This is additive — existing `SceneTheme` values remain valid because `htmlHeadingFamily` is optional.

### Step A2: Update `EngineOverlayHost.tsx` CSS variable injection

**File:** `packages/core/src/player/EngineOverlayHost.tsx`

Replace the `themeStyles` computation (lines 89–112) with expanded CSS variable injection. The new computation:

```typescript
const themeStyles = theme ? ({
  // ── Font (existing + new heading family) ──
  '--brewsite-font-family':          theme.font.htmlFamily,
  '--brewsite-font-heading':         theme.font.htmlHeadingFamily ?? theme.font.htmlFamily,
  fontFamily:                        'var(--brewsite-font-family)',

  // ── Font sizes (existing, unchanged) ──
  '--brewsite-font-size-heading':    `calc(1rem * ${theme.fontSize.heading})`,
  '--brewsite-font-size-body':       `calc(1rem * ${theme.fontSize.body})`,
  '--brewsite-font-size-label':      `calc(1rem * ${theme.fontSize.label})`,
  '--brewsite-font-size-caption':    `calc(1rem * ${theme.fontSize.caption})`,
  '--brewsite-font-size-annotation': `calc(1rem * ${theme.fontSize.annotation})`,

  // ── Color mode (existing, unchanged) ──
  '--brewsite-color-mode':           theme.colorMode,

  // ── Accent (new) ──
  '--brewsite-accent-color':         theme.accentColor ?? '#2563eb',
  '--brewsite-accent-color-muted':   (theme.accentColor ?? '#2563eb') +
    (theme.colorMode === 'dark' ? '26' : '1a'),

  // ── Text colors (textColors override > colorMode-derived) ──
  '--brewsite-text-primary':
    theme.textColors?.primary ??
    (theme.colorMode === 'dark' ? '#ffffff' : '#111111'),
  '--brewsite-text-secondary':
    theme.textColors?.secondary ??
    (theme.colorMode === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'),
  '--brewsite-text-muted':
    theme.textColors?.muted ??
    (theme.colorMode === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'),
  '--brewsite-text-inverse':
    theme.colorMode === 'dark' ? '#111111' : '#ffffff',

  // ── Surfaces (textColors.surface override > colorMode-derived) ──
  '--brewsite-surface-base':
    theme.colorMode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
  '--brewsite-surface-elevated':
    theme.textColors?.surface ??
    (theme.colorMode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
  '--brewsite-surface-hover':
    theme.colorMode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)',

  // ── Background (existing, unchanged) ──
  '--brewsite-background-color':
    theme.background?.fill?.kind === 'color'
      ? theme.background.fill.value
      : (theme.colorMode === 'dark' ? '#0a0a14' : '#f5f5f7'),

  // ── Semantic status colors ──
  '--brewsite-color-success':
    theme.semanticColors?.success ??
    theme.highlightPalette?.success?.color ?? '#22c55e',
  '--brewsite-color-warning':
    theme.semanticColors?.warning ??
    theme.highlightPalette?.warning?.color ?? '#f59e0b',
  '--brewsite-color-error':
    theme.semanticColors?.error ??
    theme.highlightPalette?.error?.color ?? '#ef4444',
  '--brewsite-color-info':
    theme.semanticColors?.info ??
    theme.highlightPalette?.info?.color ?? '#3b82f6',

  // ── Spacing scale ──
  '--brewsite-spacing-xs':           theme.spacing?.xs ?? '4px',
  '--brewsite-spacing-sm':           theme.spacing?.sm ?? '8px',
  '--brewsite-spacing-md':           theme.spacing?.md ?? '16px',
  '--brewsite-spacing-lg':           theme.spacing?.lg ?? '24px',
  '--brewsite-spacing-xl':           theme.spacing?.xl ?? '40px',

  // ── Shadows (colorMode-derived) ──
  '--brewsite-shadow-sm':
    theme.colorMode === 'dark'
      ? '0 1px 2px rgba(0,0,0,0.5)'
      : '0 1px 2px rgba(0,0,0,0.08)',
  '--brewsite-shadow-md':
    theme.colorMode === 'dark'
      ? '0 4px 12px rgba(0,0,0,0.5)'
      : '0 4px 12px rgba(0,0,0,0.10)',
  '--brewsite-shadow-lg':
    theme.colorMode === 'dark'
      ? '0 8px 24px rgba(0,0,0,0.6)'
      : '0 8px 24px rgba(0,0,0,0.14)',

  // ── Border radius scale ──
  '--brewsite-radius-sm':            '4px',
  '--brewsite-radius-base':          '6px',  // preserved for backward compat
  '--brewsite-radius-md':            '8px',
  '--brewsite-radius-lg':            '12px',
  '--brewsite-radius-xl':            '20px',

  // ── Existing variables preserved exactly ──
  '--brewsite-border-subtle':
    theme.colorMode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
} as CSSProperties) : {};
```

**Key backward compatibility notes:**
- `--brewsite-radius-base` remains at `'6px'` (unchanged). `--brewsite-radius-md` is `'8px'`.
- `--brewsite-text-primary` and `--brewsite-text-secondary` retain existing default derivation when `textColors` is absent.
- `--brewsite-surface-elevated` retains existing default when `textColors.surface` is absent.
- `--brewsite-border-subtle` is unchanged.
- No existing CSS variable changes value for themes that don't set the new optional fields.

### Step A3: Tests for Stream A

**New file:** `packages/core/src/player/__tests__/EngineOverlayHost.test.tsx`

Test file verifying CSS variable injection. Since EngineOverlayHost is a React component that requires SceneEngine context, tests use a minimal test harness.

**Test cases:**

1. `themeStyles: dark mode defaults` — verify all CSS vars with a minimal dark theme (no optional fields). Assert `--brewsite-text-primary` is `'#ffffff'`, `--brewsite-accent-color` is `'#2563eb'`, etc.
2. `themeStyles: light mode defaults` — verify all CSS vars with a minimal light theme.
3. `themeStyles: textColors overrides take precedence` — set `textColors.primary: '#E5EEFA'`, verify `--brewsite-text-primary` is `'#E5EEFA'` not `'#ffffff'`.
4. `themeStyles: textColors.surface overrides --brewsite-surface-elevated` — set `textColors.surface: '#1E324F'`, verify output.
5. `themeStyles: font.htmlHeadingFamily emits --brewsite-font-heading` — set `htmlHeadingFamily: '"Sora"'`, verify `--brewsite-font-heading` is `'"Sora"'`.
6. `themeStyles: htmlHeadingFamily absent falls back to htmlFamily` — omit `htmlHeadingFamily`, verify `--brewsite-font-heading` equals `font.htmlFamily`.
7. `themeStyles: semanticColors direct overrides` — set `semanticColors.success: '#00ff00'`, verify `--brewsite-color-success` is `'#00ff00'`.
8. `themeStyles: semanticColors falls back to highlightPalette` — omit `semanticColors`, set `highlightPalette.success.color: '#3AAA7A'`, verify `--brewsite-color-success` is `'#3AAA7A'`.
9. `themeStyles: accent-muted appends hex alpha` — dark mode: `accentColor + '26'`, light mode: `accentColor + '1a'`.
10. `themeStyles: spacing scale defaults` — omit `spacing`, verify `--brewsite-spacing-md` is `'16px'`.
11. `themeStyles: spacing scale overrides` — set `spacing.md: '20px'`, verify.
12. `themeStyles: shadow derivation for dark/light` — verify shadow strings.
13. `themeStyles: radius scale` — verify `--brewsite-radius-base` is `'6px'` (backward compat), `--brewsite-radius-md` is `'8px'`.

**Test approach:** Extract the `themeStyles` computation into a pure exported function `computeThemeStyles(theme: SceneTheme): Record<string, string>` to enable unit testing without React rendering. EngineOverlayHost calls this function internally.

**New file:** `packages/core/src/player/computeThemeStyles.ts`

```typescript
// Pure function: SceneTheme → CSS custom property map.
// Extracted from EngineOverlayHost for testability.

import type { SceneTheme } from '../theme/types';

export function computeThemeStyles(theme: SceneTheme): Record<string, string> {
  // ... the themeStyles computation from Step A2, returning Record<string,string>
}
```

EngineOverlayHost imports and calls `computeThemeStyles(theme)`, then spreads the result into the style object with a `CSSProperties` cast.

**Test file:** `packages/core/src/player/__tests__/computeThemeStyles.test.ts`

Tests are pure function input/output — no React, no DOM.

### Step A4: Typecheck verification

After Steps A1–A3, run:
```bash
pnpm --filter @brewsite/core typecheck
pnpm --filter @brewsite/core test
```

Verify all existing tests pass. The changes are purely additive.

---

## 3. Stream B — Themes: Preset Enrichment (Phase 0B)

**Package:** `@brewsite/themes`
**Semver:** Minor (additive)
**Prerequisite:** Stream A types must be merged first (for `SceneTheme` to accept the new fields). In practice, Stream B can begin implementation immediately if the developer imports the new `SceneTheme` type definition from Stream A's branch. Alternatively, wait for Stream A to land.

### Step B1: Add `accentColor`, `textColors`, `semanticColors` to each scene theme preset

**Files to modify (6 files):**

| File | Family | Polarity |
|------|--------|----------|
| `packages/themes/src/presets/scene/enterprise.ts` | enterprise | dark + light |
| `packages/themes/src/presets/scene/darkGlass.ts` | darkGlass | dark + light |
| `packages/themes/src/presets/scene/midnight.ts` | midnight | dark + light |
| `packages/themes/src/presets/scene/neonCyber.ts` | neonCyber | dark + light |
| `packages/themes/src/presets/scene/lightCanvas.ts` | lightCanvas | dark + light |
| `packages/themes/src/presets/scene/lightMinimal.ts` | lightMinimal | dark + light |

For each preset, add three new fields to the `SceneTheme` object:

**Per-family values (from `themeFamily.ts` migration data):**

| Family | Polarity | `accentColor` | `textColors.primary` | `textColors.secondary` | `textColors.muted` | `textColors.surface` |
|--------|----------|--------------|---------------------|----------------------|-------------------|---------------------|
| enterprise | dark | `'#4F76B8'` | `'#E5EEFA'` | `'#A8B8CF'` | `'#5A6D86'` | `'#1E324F'` |
| enterprise | light | `'#5E7EA9'` | `'#1F334E'` | `'#5A6D86'` | `'#A8B8CF'` | `'#FFFFFF'` |
| darkGlass | dark | `'#B33A2B'` | `'#F2E6DE'` | `'#B79B8F'` | `'#6E5750'` | `'#1E1412'` |
| darkGlass | light | `'#E36A2E'` | `'#2B1F1A'` | `'#6E5750'` | `'#B79B8F'` | `'#FFF9F5'` |
| midnight | dark | `'#E2A33A'` | `'#F2E7D4'` | `'#BCA180'` | `'#7B664C'` | `'#261A13'` |
| midnight | light | `'#A7793A'` | `'#3A2A1B'` | `'#7B664C'` | `'#BCA180'` | `'#FFF9EE'` |
| neonCyber | dark | `'#8A3DFF'` | `'#D8CCFF'` | `'#9688D6'` | `'#516498'` | `'#0C183A'` |
| neonCyber | light | `'#11C9E8'` | `'#1E2F5A'` | `'#516498'` | `'#9688D6'` | `'#F8FBFF'` |
| lightCanvas | dark | `'#3D63D9'` | `'#E8EEF7'` | `'#A8B4C4'` | `'#5F7088'` | `'#232F40'` |
| lightCanvas | light | `'#4768C9'` | `'#1D2A3D'` | `'#5F7088'` | `'#A8B4C4'` | `'#FFFFFF'` |
| lightMinimal | dark | `'#7FAEEA'` | `'#E8EDF5'` | `'#A8B2C2'` | `'#6E7D92'` | `'#252C35'` |
| lightMinimal | light | `'#6A94CD'` | `'#223248'` | `'#6E7D92'` | `'#A8B2C2'` | `'#F3F6FB'` |

**Example edit for `enterprise.ts` dark preset (line ~128):**

Add after the existing `highlightPalette` field:

```typescript
export const enterpriseSceneTheme: SceneTheme = {
  // ... existing fields unchanged ...
  highlightPalette: enterpriseDarkHighlights,
  // NEW — Phase 0B additions:
  accentColor: '#4F76B8',
  textColors: {
    primary: '#E5EEFA',
    secondary: '#A8B8CF',
    muted: '#5A6D86',
    surface: '#1E324F',
  },
};
```

Also add `htmlHeadingFamily` to presets where the theme family uses a distinct heading font. Currently all families use the same font for heading and body, so `htmlHeadingFamily` is omitted (falls back to `htmlFamily`). This is a no-op but the type supports it for future use.

### Step B2: Typecheck verification

```bash
pnpm --filter @brewsite/themes typecheck
```

No tests needed — the presets are value objects consumed by other packages' tests.

---

## 4. Stream C — Slides: Theme System Rewrite + SlidePlayer Architecture (Phase 1A + 1E)

**Package:** `@brewsite/slides`
**Prerequisite:** Streams A+B complete (SceneTheme has new fields, presets have values)

This is the largest and most complex stream. It touches 12 files.

### Step C1: Rewrite `packages/slides/src/types.ts`

**Delete:**
- `DeckTheme` type
- `ResolvedDeckTheme` type
- `DeckSpec.theme` field

**Add:**
- `SlideTheme` type
- `SlideTemplate` type (forward declaration for Phase 2)
- `ResolvedSlideConfig` type
- Updated `SlideTransition` union (**Breaking rename:** `'none'` → `'cut'`. Grep all slides source for `'none'` in transition contexts and update. The `'none'` literal remains valid in `EntranceType` — only `SlideTransition` references change.)
- `EntranceType` type
- `SlideRegionEntrance` type
- `ComparisonCellValue` type

**Complete new type definitions:**

```typescript
// ─── Slide Transitions (expanded) ────────────────────────────────────────────

export type SlideTransition =
  | 'dissolve'
  | 'cut'
  | 'fade'
  | 'push-left'
  | 'push-right'
  | 'push-up'
  | 'push-down'
  | 'zoom-in'
  | 'zoom-out';

// ─── Entrance Animations ──────────────────────────────────────────────────────

export type EntranceType =
  | 'fadeIn'
  | 'slideUp'
  | 'slideDown'
  | 'slideLeft'
  | 'slideRight'
  | 'grow'
  | 'none';

export type SlideRegionEntrance = {
  title?: EntranceType;
  body?: EntranceType;
  left?: EntranceType;
  right?: EntranceType;
  stagger?: number;  // progress delay between regions, default 0
};

// ─── SlideTheme ──────────────────────────────────────────────────────────────

/**
 * Presentation-specific behavioral and density tokens.
 * "How slides feel" — timing, density, typography scale, component sizing.
 * Orthogonal to SceneTheme (visual) and SlideTemplate (branding).
 */
export type SlideTheme = {
  /** Animation and transition timing. */
  readonly timing: {
    /** Slide-to-slide CSS transition duration. Default: '300ms'. */
    readonly transitionDuration: string;
    /** Default entrance animation progress window [0-1]. Default: 0.3. */
    readonly entranceDuration: number;
    /** Default fly-in / slide-up distance. Default: '24px'. */
    readonly entranceDistance: string;
    /** Default stagger delay between items [0-1]. Default: 0.08. */
    readonly staggerDelay: number;
    /** Stat card count-up progress window [0-1]. Default: 0.6. */
    readonly countUpDuration: number;
  };

  /** Content density and spacing. */
  readonly density: {
    /** Padding inside slide regions. CSS length string. Default: '48px'. */
    readonly contentPadding: string;
    /** Vertical gap between elements in a region. CSS length string. Default: '16px'. */
    readonly contentGap: string;
    /** Title bar height as NVS fraction [0-1]. Default: 0.18. */
    readonly titleHeight: number;
    /** Inter-region gutter as NVS fraction [0-1]. Default: 0.02. */
    readonly gutter: number;
  };

  /** Typography scale overrides (multiplied against --brewsite-font-size-*). */
  readonly typography: {
    /** Heading scale multiplier. Default: 1.2. */
    readonly headingScale: number;
    /** Body text scale multiplier. Default: 1.1. */
    readonly bodyScale: number;
    /** Caption/label scale multiplier. Default: 1.0. */
    readonly captionScale: number;
  };

  /** Graphical component sizing. */
  readonly components: {
    /** Stat card / callout box border width. Default: '1px'. */
    readonly cardBorderWidth: string;
    /** Timeline connector line thickness. Default: '2px'. */
    readonly timelineConnectorWidth: string;
    /** Timeline milestone dot diameter. Default: '12px'. */
    readonly timelineDotSize: string;
    /** Progress ring default diameter. Default: '64px'. */
    readonly progressRingSize: string;
    /** Progress ring stroke width. Default: '4px'. */
    readonly progressRingThickness: string;
  };
};

// ─── SlideTemplate (forward declaration for Phase 2) ─────────────────────────

/**
 * Brand asset for template placement.
 */
export type BrandAsset = {
  readonly src: string;
  readonly alt?: string;
  readonly aspectRatio?: string;
};

/**
 * Corporate chrome template. "Whose slides these are."
 * Orthogonal to SceneTheme (visual) and SlideTheme (feel).
 */
export type SlideTemplate = {
  /** Display name for the template. */
  readonly name: string;

  /** Brand assets — logo, wordmark, icon for placement. */
  readonly brand?: {
    readonly logo?: BrandAsset;
    readonly wordmark?: BrandAsset;
    readonly icon?: BrandAsset;
  };

  /** Master slide configuration — elements appearing on every slide. */
  readonly master?: {
    readonly logo?: {
      readonly asset: 'logo' | 'wordmark' | 'icon';
      readonly position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
      readonly size?: string;
      readonly opacity?: number;
      readonly excludeLayouts?: SlideLayout[];
    };
    readonly footer?: {
      readonly text?: string;
      readonly showPageNumbers?: boolean;
      readonly showDate?: boolean;
      readonly position?: 'bottom-left' | 'bottom-center' | 'bottom-right';
      readonly excludeLayouts?: SlideLayout[];
    };
    readonly watermark?: {
      readonly text?: string;
      readonly image?: string;
      readonly opacity?: number;
    };
  };

  /** Default transition for all slides (overridable per-slide). */
  readonly defaultTransition?: SlideTransition;

  /** Default progress indicator style. */
  readonly defaultProgressIndicator?: ProgressStyle;
};

// ─── Resolved Config ──────────────────────────────────────────────────────────

/**
 * Resolved slide configuration after merging SlideTheme with defaults.
 * All required fields are filled. Produced by themeCompiler.ts.
 */
export type ResolvedSlideConfig = {
  /** Fully resolved SlideTheme (all fields present). */
  readonly slideTheme: Required<SlideTheme>;
  /** CSS custom property map for --slide-* namespace. */
  readonly cssVars: Record<string, string>;
};

// ─── Updated DeckSpec (theme field removed) ──────────────────────────────────

export type DeckSpec = {
  slides: SlideSpec[];
  transition: SlideTransition;
};

// ─── Graphics component types ──────────────────────────────────────────────

/** Discriminated cell type for ComparisonTable. */
export type ComparisonCellValue =
  | { readonly kind: 'check'; readonly value: boolean }
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'number'; readonly value: number };
```

**Preserved types** (unchanged):
- `SlideRegion`
- `SlideSpec` (unchanged — `restProgress` preserved)
- `SlidePlayerHandle`
- `PrintOptions`
- `ProgressStyle`
- `SlideNavigationConfig`

**Updated `SlideLayout` union (expanded for Phase 1B — placed in types.ts by Stream C, populated by Stream D):**

```typescript
export type SlideLayout =
  // Phase 1B Core (12 layouts)
  | 'title'
  | 'section'
  | 'content'
  | 'two-column'
  | 'image'
  | 'full-bleed'
  | 'blank'
  | 'big-number'
  | 'metric-grid'
  | 'comparison'
  | 'quote'
  | 'agenda'
  // Phase 1B+ Fast-Follow (7 layouts)
  | 'timeline'
  | 'process'
  | 'team'
  | 'closing'
  | 'bento'
  | 'dashboard'
  | 'matrix';
```

### Step C2: Rewrite `packages/slides/src/theme.ts`

**Delete all existing content.** Replace with:

```typescript
// SlideTheme defaults, named presets, and factory function.

import type { SlideTheme } from './types';

/** Utility type for deep-partial overrides. */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// ─── Default SlideTheme ──────────────────────────────────────────────────────

export const defaultSlideTheme: SlideTheme = {
  timing: {
    transitionDuration: '300ms',
    entranceDuration: 0.3,
    entranceDistance: '24px',
    staggerDelay: 0.08,
    countUpDuration: 0.6,
  },
  density: {
    contentPadding: '48px',
    contentGap: '16px',
    titleHeight: 0.18,
    gutter: 0.02,
  },
  typography: {
    headingScale: 1.2,
    bodyScale: 1.1,
    captionScale: 1.0,
  },
  components: {
    cardBorderWidth: '1px',
    timelineConnectorWidth: '2px',
    timelineDotSize: '12px',
    progressRingSize: '64px',
    progressRingThickness: '4px',
  },
};

// ─── Named Presets ───────────────────────────────────────────────────────────

/** Tight, fast. McKinsey / data-heavy decks. */
export const compactSlideTheme: SlideTheme = {
  timing: {
    transitionDuration: '200ms',
    entranceDuration: 0.2,
    entranceDistance: '16px',
    staggerDelay: 0.05,
    countUpDuration: 0.4,
  },
  density: {
    contentPadding: '32px',
    contentGap: '12px',
    titleHeight: 0.14,
    gutter: 0.015,
  },
  typography: {
    headingScale: 1.0,
    bodyScale: 1.0,
    captionScale: 0.9,
  },
  components: {
    cardBorderWidth: '1px',
    timelineConnectorWidth: '1.5px',
    timelineDotSize: '10px',
    progressRingSize: '56px',
    progressRingThickness: '3px',
  },
};

/** Spacious, slow. Apple keynote feel. */
export const cinematicSlideTheme: SlideTheme = {
  timing: {
    transitionDuration: '500ms',
    entranceDuration: 0.5,
    entranceDistance: '32px',
    staggerDelay: 0.12,
    countUpDuration: 0.8,
  },
  density: {
    contentPadding: '64px',
    contentGap: '24px',
    titleHeight: 0.22,
    gutter: 0.03,
  },
  typography: {
    headingScale: 1.4,
    bodyScale: 1.15,
    captionScale: 1.0,
  },
  components: {
    cardBorderWidth: '1px',
    timelineConnectorWidth: '2px',
    timelineDotSize: '14px',
    progressRingSize: '72px',
    progressRingThickness: '5px',
  },
};

/** Clean, snappy. No stagger, fast transitions. */
export const minimalSlideTheme: SlideTheme = {
  timing: {
    transitionDuration: '250ms',
    entranceDuration: 0.25,
    entranceDistance: '20px',
    staggerDelay: 0,
    countUpDuration: 0.5,
  },
  density: {
    contentPadding: '40px',
    contentGap: '14px',
    titleHeight: 0.16,
    gutter: 0.02,
  },
  typography: {
    headingScale: 1.1,
    bodyScale: 1.0,
    captionScale: 1.0,
  },
  components: {
    cardBorderWidth: '1px',
    timelineConnectorWidth: '2px',
    timelineDotSize: '12px',
    progressRingSize: '64px',
    progressRingThickness: '4px',
  },
};

// ─── Factory ─────────────────────────────────────────────────────────────────

/** Creates a SlideTheme by deep-merging overrides into defaultSlideTheme. */
export function createSlideTheme(overrides: DeepPartial<SlideTheme>): SlideTheme {
  return {
    timing: { ...defaultSlideTheme.timing, ...overrides.timing },
    density: { ...defaultSlideTheme.density, ...overrides.density },
    typography: { ...defaultSlideTheme.typography, ...overrides.typography },
    components: { ...defaultSlideTheme.components, ...overrides.components },
  };
}
```

### Step C3: Delete `packages/slides/src/themeFamily.ts`

Delete the entire file. All its data has been migrated to `@brewsite/themes` presets in Stream B.

### Step C4: Rewrite `packages/slides/src/compiler/themeCompiler.ts`

**Delete all existing content.** Replace with:

```typescript
// Pure function: SlideTheme → ResolvedSlideConfig. No React, no Three.js.

import type { SlideTheme, ResolvedSlideConfig } from '../types';
import { defaultSlideTheme } from '../theme';

/**
 * Resolves a SlideTheme (with potential missing fields) into a
 * ResolvedSlideConfig with all fields filled and CSS variables computed.
 *
 * Pure function — same inputs always produce the same output.
 */
export function resolveSlideConfig(
  slideTheme?: Partial<SlideTheme>,
): ResolvedSlideConfig {
  const resolved: Required<SlideTheme> = {
    timing: { ...defaultSlideTheme.timing, ...slideTheme?.timing },
    density: { ...defaultSlideTheme.density, ...slideTheme?.density },
    typography: { ...defaultSlideTheme.typography, ...slideTheme?.typography },
    components: { ...defaultSlideTheme.components, ...slideTheme?.components },
  };

  const cssVars: Record<string, string> = {
    // Timing
    '--slide-transition-duration':       resolved.timing.transitionDuration,
    '--slide-entrance-duration':         String(resolved.timing.entranceDuration),
    '--slide-entrance-distance':         resolved.timing.entranceDistance,
    '--slide-stagger-delay':             String(resolved.timing.staggerDelay),
    '--slide-count-up-duration':         String(resolved.timing.countUpDuration),
    // Density
    '--slide-content-padding':           resolved.density.contentPadding,
    '--slide-content-gap':               resolved.density.contentGap,
    '--slide-title-height':              String(resolved.density.titleHeight),
    '--slide-gutter':                    String(resolved.density.gutter),
    // Typography scale
    '--slide-heading-scale':             String(resolved.typography.headingScale),
    '--slide-body-scale':                String(resolved.typography.bodyScale),
    '--slide-caption-scale':             String(resolved.typography.captionScale),
    // Component sizing
    '--slide-card-border-width':         resolved.components.cardBorderWidth,
    '--slide-timeline-connector-width':  resolved.components.timelineConnectorWidth,
    '--slide-timeline-dot-size':         resolved.components.timelineDotSize,
    '--slide-progress-ring-size':        resolved.components.progressRingSize,
    '--slide-progress-ring-thickness':   resolved.components.progressRingThickness,
  };

  return { slideTheme: resolved, cssVars };
}
```

### Step C5: Rewrite `packages/slides/src/plugin.ts`

**Key change:** `SlidesPluginOptions` drops the `theme` field. `slidesPlugin()` becomes zero-arg.

```typescript
// slidesPlugin() — registers slide widgets and DSL handlers.

import { registerNode } from '@brewsite/core';
import type { WidgetPlugin } from '@brewsite/core';
import { SlideMetaWidget } from './widget/SlideMetaWidget';
import { SlideNavWidget } from './widget/SlideNavWidget';

// ─── SlideMetaDsl (internal marker component) ────────────────────────────────

export type SlideMetaDslProps = {
  id: string;
  slideKey: string;
  logicalIndex: number;
  totalSlides: number;
  notes?: string;
  title?: string;
  hasAnimatedList: boolean;
  totalBullets: number;
};

export const SlideMetaDsl = (_props: SlideMetaDslProps): null => null;
SlideMetaDsl.displayName = 'SlideMetaDsl';

/**
 * WidgetPlugin factory for @brewsite/slides.
 * Registers SlideMetaWidget and SlideNavWidget.
 *
 * Takes no arguments — visual tokens come from SceneTheme via core's ThemeContext.
 * Behavioral tokens come from SlideTheme via SlidePlayer's container CSS vars.
 */
export function slidesPlugin(): WidgetPlugin {
  const metaWidget = new SlideMetaWidget();

  return {
    createWidgets: () => [metaWidget, new SlideNavWidget()],

    registerHandlers: () => {
      registerNode(SlideMetaDsl, (node, api) => {
        const props = node.props as SlideMetaDslProps;
        api.setWidgetState(metaWidget.widgetId, {
          slideKey: props.slideKey,
          logicalIndex: props.logicalIndex,
          totalSlides: props.totalSlides,
          notes: props.notes,
          title: props.title,
          hasAnimatedList: props.hasAnimatedList,
          totalBullets: props.totalBullets,
        } satisfies import('./widget/SlideMetaWidget').SlideMetaState);
      }, { category: 'ambient' });
    },

    configureRegistry: (_registry) => {
      // No registry configuration needed.
    },
  };
}
```

**Removed:** `SlidesPluginOptions` type, `theme` parameter, `navigation` parameter.

### Step C6: Major rewrite of `packages/slides/src/player/SlidePlayer.tsx`

**6 integration points change (from the feature note):**

**New `SlidePlayerProps`:**

```typescript
export type SlidePlayerProps = {
  /** <Slide> elements authored with the slides DSL. */
  children: ReactNode;
  /** Presentation behavioral theme. Default: defaultSlideTheme. */
  slideTheme?: SlideTheme;
  /** Corporate chrome template (Phase 2). */
  template?: SlideTemplate;
  /** Default slide transition. Default: 'dissolve'. */
  transition?: SlideTransition;
  /** Progress indicator style. Default: 'dots'. */
  progressIndicator?: ProgressStyle;
  /** Canvas aspect ratio. Default: 16/9. */
  aspectRatio?: number;
  /** Navigation configuration. */
  navigation?: SlideNavigationConfig;
  /** Force fullscreen mode (controlled). */
  fullscreen?: boolean;
  /** Uncontrolled default fullscreen state. */
  defaultFullscreen?: boolean;
  /** Called when fullscreen state changes. */
  onFullscreenChange?: (isFullscreen: boolean) => void;
  /** Called when the active slide changes. */
  onSlideChange?: (index: number, slideKey: string) => void;
  className?: string;
  style?: CSSProperties;
};
```

**Removed props:** `id`, `plugins`, `theme` (DeckTheme).
**Added props:** `slideTheme` (SlideTheme), `template` (SlideTemplate).

**Architecture change — render tree:**

The outer `<SceneEngine>` wrapper is removed. SlidePlayer now renders:

```tsx
<div ref={containerRef} className={className} style={containerStyle}>
  {/* Scene elements injected directly — SceneEngine context comes from parent */}
  {sceneElements}

  <EngineARContainer aspectRatio={aspectRatio} scaleMode="contain">
    <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
    <SceneCanvas ref={canvasRef} style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
    <EngineOverlayHost
      passthroughPointerEvents
      overlayTransition={
        transition === 'cut'
          ? { enabled: false }
          : { enabled: true, durationMs: 200 }
      }
    />
    <SlidePlayerInner
      spec={spec}
      canvasRef={canvasRef}
      imperativeRef={imperativeRef}
      navRef={navRef}
      navigation={navigation}
    />
  </EngineARContainer>

  {/* Navigation UI outside EngineARContainer */}
  {navigation?.pointer !== false && (
    <div ... onClick={handlePointerNext} onContextMenu={handlePointerPrev} />
  )}
  <SlideProgressIndicator ... />
</div>
```

**onSlideChange wiring change:**

Replace the `corePlugin({ onSceneChange })` pattern with VariableStore-based detection:

```typescript
// Inside SlidePlayerInner (which is inside SceneEngine context):
const currentLogicalIndex = useVariable(SLIDE_META_NAMESPACE, 'currentLogicalIndex');
const currentSlideKey = useVariable(SLIDE_META_NAMESPACE, 'currentSlideKey');

// Fire onSlideChange when the variable changes
useEffect(() => {
  if (typeof currentLogicalIndex !== 'number') return;
  if (typeof currentSlideKey !== 'string') return;
  onSlideChangeRef.current?.(currentLogicalIndex, currentSlideKey);
  setCurrentSlideIndex(currentLogicalIndex);
}, [currentLogicalIndex, currentSlideKey]);
```

**Remove:** `allPlugins` memo, `corePlugin()` call, `SceneEngine` JSX wrapper, `id` prop handling, `onError` handling.

**CSS var injection change:**

```typescript
const resolvedConfig = useMemo(
  () => resolveSlideConfig(slideTheme),
  [slideTheme],
);

// Inject --slide-* CSS variables on the container
const cssVarStyle = resolvedConfig.cssVars as CSSProperties;

const containerStyle: CSSProperties = effectiveFullscreen
  ? { position: 'fixed', inset: 0, zIndex: 9999, ...cssVarStyle }
  : { position: 'relative', width: '100%', height: '100%', ...cssVarStyle, ...style };
```

**Remove:** `--brewsite-accent-color` manual injection (now in EngineOverlayHost), `resolvedTheme.background.color` reference, `compileDeckTheme()` call.

**`compileDeck()` call change:**

```typescript
const spec = useMemo(
  () => compileDeck(slideElements, transition),
  [slideElements, transition],
);
```

No theme arg — `compileDeck` no longer needs DeckTheme.

### Step C7: Update `packages/slides/src/compiler/deckCompiler.tsx`

**Key changes:**
1. Remove `ResolvedDeckTheme` parameter from `compileDeck()` and `buildSceneElements()`.
2. Remove `spec.theme` references.
3. Update all CSS variable references per migration mapping.
4. Background color comes from SceneTheme via `<Background theme />` (use theme-driven background).

**Density tokens and `compileLayout` — design decision:**

`compileLayout()` accepts `titleHeight` and `gutter` parameters (Step D1), but `compileDeck()` no longer receives a theme. The decision: **`compileLayout` uses hardcoded NVS defaults (0.18, 0.02)**. These NVS coordinates define the structural layout grid — they determine where TextBox regions sit in normalized viewport space. The actual visual spacing within regions is controlled by CSS variables (`--slide-content-padding`, `--slide-content-gap`) at render time.

If a `SlideTheme` uses `density.titleHeight: 0.14`, the NVS region grid does NOT change — the title TextBox still occupies 18% of the viewport. The visual density change happens through tighter padding (`--slide-content-padding: '32px'` vs `'48px'`). This matches how the existing layout system works: NVS regions are fixed structural slots, content density is a CSS concern.

**Updated function signatures:**

```typescript
export function compileDeck(
  slides: ReactElement<Record<string, unknown>>[],
  deckTransition: SlideTransition,
): DeckSpec {
  const compiled = slides.map((s) => compileSlide(s, deckTransition));
  return { slides: compiled, transition: deckTransition };
}

export function buildSceneElements(
  slides: ReactElement<Record<string, unknown>>[],
  spec: DeckSpec,
  wrapBodyContent?: (slideKey: string, totalBullets: number, content: React.ReactNode) => React.ReactNode,
): ReactElement[] {
  // ... same structure but:
  // - Remove theme from parameters
  // - Replace Background({ color: spec.theme.background.color }) with Background({}) (no color prop).
  //   BackgroundLayer DOM element handles SceneTheme-driven backgrounds via ThemeContext.
  //   The Background DSL node with no explicit color/gradient is a no-op in the compile
  //   pipeline — the visual background is rendered by BackgroundLayer reading from ThemeContext.
  // - Update CSS variable references in inline styles
}
```

**CSS variable migration in inline styles:**

| Old | New |
|-----|-----|
| `var(--slide-color-heading)` | `var(--brewsite-text-primary)` |
| `var(--slide-color-body)` | `var(--brewsite-text-secondary)` |
| `var(--slide-padding, 8%)` | `var(--slide-content-padding)` |
| `var(--slide-gap, 1.5rem)` | `var(--slide-content-gap)` |
| `var(--brewsite-font-family)` for headings | `var(--brewsite-font-heading)` |

### Step C8: Update `packages/slides/src/dsl.tsx`

**CSS variable migration in component styles:**

- `Heading`: `color` default → `var(--brewsite-text-primary)`, `fontFamily` → `var(--brewsite-font-heading)`
- `Body`: `color` → `var(--brewsite-text-secondary)`, `fontFamily` → `var(--brewsite-font-family)`
- `BulletList`: `color` → `var(--brewsite-text-secondary)`, bullet color → `var(--brewsite-accent-color)`, gap → `var(--slide-content-gap, 0.75rem)`
- `NumberedList`: same pattern as BulletList

**Add new layout DSL stub components** (compiled, return null):

```typescript
// New Phase 1B layout stubs
export const TitleSlide = (_props: TitleSlideProps): null => null;
TitleSlide.displayName = 'TitleSlide';

export const SectionSlide = (_props: SectionSlideProps): null => null;
SectionSlide.displayName = 'SectionSlide';

export const ContentSlide = (_props: ContentSlideProps): null => null;
ContentSlide.displayName = 'ContentSlide';

// ... (all 12 core layouts)
```

**Prop type interfaces for each new layout component:**

```typescript
export type TitleSlideProps = {
  title: string;
  subtitle?: string;
  tagline?: string;
  alignment?: 'center' | 'left';
  entrance?: SlideRegionEntrance;
};

export type SectionSlideProps = {
  title: string;
  subtitle?: string;
  entrance?: SlideRegionEntrance;
};

export type ContentSlideProps = {
  title: string;
  children?: ReactNode;
  entrance?: SlideRegionEntrance;
};

export type TwoColumnSlideProps = {
  title?: string;
  left: ReactNode;
  right: ReactNode;
  entrance?: SlideRegionEntrance;
};

export type ImageSlideProps = {
  title?: string;
  children?: ReactNode;
  imageUrl: string;
  imageAlt?: string;
  imagePosition?: 'left' | 'right';
  imageFit?: 'cover' | 'contain';
  entrance?: SlideRegionEntrance;
};

export type FullBleedSlideProps = {
  children?: ReactNode;
  overlayPosition?: 'top-left' | 'bottom-left' | 'top-right' | 'bottom-right' | 'center';
  entrance?: SlideRegionEntrance;
};

export type BlankSlideProps = {
  children?: ReactNode;
};

export type BigNumberSlideProps = {
  stats: Array<{
    value: string | number;
    label: string;
    trend?: string;
    trendDirection?: 'up' | 'down' | 'neutral';
  }>;
  title?: string;
  entrance?: SlideRegionEntrance;
};

export type MetricGridSlideProps = {
  metrics: Array<{
    value: string | number;
    label: string;
    icon?: ReactNode;
  }>;
  title?: string;
  columns?: 3 | 4;
  entrance?: SlideRegionEntrance;
};

export type ComparisonSlideProps = {
  headers: string[];
  rows: Array<{
    feature: string;
    values: import('./types').ComparisonCellValue[];
  }>;
  highlightColumn?: number;
  title?: string;
  entrance?: SlideRegionEntrance;
};

export type QuoteSlideProps = {
  quote: string;
  attribution: string;
  role?: string;
  entrance?: SlideRegionEntrance;
};

export type AgendaSlideProps = {
  title: string;
  items: Array<{
    label: string;
    description?: string;
    icon?: ReactNode;
  }>;
  entrance?: SlideRegionEntrance;
};
```

**Keep old layout components** as deprecated aliases pointing to new names for the transition period? **No** — breaking changes are permitted. Delete `TitleLayout`, `TitleBodyLayout`, `TwoColumnLayout`, `FullBleedLayout`, `BlankLayout`, `SlideContent`. Replace with new `*Slide` components.

### Step C9: Rewrite `packages/slides/src/player/SlideTransitionWrapper.tsx`

**Expand `resolveTransitionClass` for all new transition types:**

```typescript
export function resolveTransitionClass(transition: SlideTransition, active: boolean): string {
  if (transition === 'cut') return '';
  // 'fade' is an alias for 'dissolve'
  const effectiveTransition = transition === 'fade' ? 'dissolve' : transition;
  const base = `slide-transition--${effectiveTransition}`;
  return active ? `${base} ${base}--active` : base;
}
```

**Add CSS keyframe injection** for push and zoom transitions (injected once via the same pattern as EngineOverlayHost):

```typescript
let _transitionKeyframesInjected = false;
function injectTransitionKeyframes(): void {
  if (_transitionKeyframesInjected || typeof document === 'undefined') return;
  _transitionKeyframesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    .slide-transition--dissolve { opacity: 0; transition: opacity var(--slide-transition-duration, 300ms) ease; }
    .slide-transition--dissolve--active { opacity: 1; }

    .slide-transition--push-left { transform: translateX(100%); transition: transform var(--slide-transition-duration, 300ms) ease; }
    .slide-transition--push-left--active { transform: translateX(0); }

    .slide-transition--push-right { transform: translateX(-100%); transition: transform var(--slide-transition-duration, 300ms) ease; }
    .slide-transition--push-right--active { transform: translateX(0); }

    .slide-transition--push-up { transform: translateY(100%); transition: transform var(--slide-transition-duration, 300ms) ease; }
    .slide-transition--push-up--active { transform: translateY(0); }

    .slide-transition--push-down { transform: translateY(-100%); transition: transform var(--slide-transition-duration, 300ms) ease; }
    .slide-transition--push-down--active { transform: translateY(0); }

    .slide-transition--zoom-in { transform: scale(0.8); opacity: 0; transition: transform var(--slide-transition-duration, 300ms) ease, opacity var(--slide-transition-duration, 300ms) ease; }
    .slide-transition--zoom-in--active { transform: scale(1); opacity: 1; }

    .slide-transition--zoom-out { transform: scale(1.2); opacity: 0; transition: transform var(--slide-transition-duration, 300ms) ease, opacity var(--slide-transition-duration, 300ms) ease; }
    .slide-transition--zoom-out--active { transform: scale(1); opacity: 1; }
  `;
  document.head.appendChild(style);
}
```

### Step C10: Update `packages/slides/src/player/PresenterView.tsx`

Remove any DeckTheme/ResolvedDeckTheme references. Restyle using `--brewsite-*` variables:

- `background` → `var(--brewsite-surface-base)` or keep `rgba(0,0,0,0.85)`
- `color` → `var(--brewsite-text-primary)`
- `fontFamily` → `var(--brewsite-font-family)`

### Step C11: Update `packages/slides/src/player/SlidePrintLayout.tsx`

- Remove `DeckSpec.theme` reference.
- `SlidePrintLayoutProps.deck` type is `DeckSpec` (which no longer has `theme`).
- Background color for empty-slide placeholder: use `var(--brewsite-surface-base)` or a neutral `#eee`.

### Step C12: Update `packages/slides/src/player/SlideProgressIndicator.tsx`

- Replace `var(--slide-color-muted, rgba(128,128,128,0.7))` with `var(--brewsite-text-muted)`.
- `var(--brewsite-accent-color, #2563eb)` is unchanged (now injected by EngineOverlayHost).

### Step C13: Update `packages/slides/src/widget/SlideMetaWidget.ts`

- Remove `ResolvedDeckTheme` import (if any).
- `SlideMetaState` type is unchanged.
- `apply()` method is unchanged.
- No functional changes needed.

### Step C14: Tests for Stream C

**Delete test files:**
- `packages/slides/src/__tests__/themeFamily.test.ts` — themeFamily.ts is deleted

**Rewrite test files:**

**`packages/slides/src/compiler/__tests__/themeCompiler.test.ts`:**
- Test `resolveSlideConfig()` with no args → defaults.
- Test `resolveSlideConfig()` with partial overrides → correct merge.
- Test CSS var output: `--slide-transition-duration`, `--slide-content-padding`, etc.
- Test all 4 named presets resolve correctly.

**`packages/slides/src/compiler/__tests__/deckCompiler.test.ts`:**
- Test `compileDeck()` without theme arg.
- Test `buildSceneElements()` produces correct Scene/TextBox structure.
- Test CSS variable references in produced JSX use `--brewsite-*` and `--slide-*` (not old `--slide-color-*`).

**`packages/slides/src/__tests__/types.test.ts`:**
- Type-level tests: SlideTheme satisfies constraints, SlideTemplate type check, SlideTransition union covers all values.

**`packages/slides/src/__tests__/dsl.test.tsx`:**
- Verify `Heading` renders with `var(--brewsite-text-primary)` color.
- Verify `Body` renders with `var(--brewsite-text-secondary)` color.
- Verify `BulletList` bullet color uses `var(--brewsite-accent-color)`.

**`packages/slides/src/__tests__/SlideTransitionWrapper.test.tsx`:**
- Test `resolveTransitionClass` for all 9 transition types.
- Test `'fade'` maps to `'dissolve'` class.
- Test `'cut'` returns empty string.

**`packages/slides/src/player/__tests__/SlidePlayer.test.tsx`:**
- Test SlidePlayer renders without creating SceneEngine (requires parent SceneEngine context).
- Test `slideTheme` prop injects `--slide-*` CSS vars on container.
- Test `onSlideChange` fires via VariableStore mechanism.

### Step C15: Update `packages/slides/src/index.ts`

**Remove exports:**
- `DeckTheme`, `ResolvedDeckTheme`
- `defaultDeckTheme`, `darkDeckTheme`, `createDeckTheme`
- `DECK_THEME_PAIRS`, `getDeckThemeForFamily`, `createDeckThemeForFamily`
- `SlidesPluginOptions` (no longer a type — plugin is zero-arg)

**Add exports:**
```typescript
// Theme
export {
  defaultSlideTheme,
  compactSlideTheme,
  cinematicSlideTheme,
  minimalSlideTheme,
  createSlideTheme,
} from './theme';
export type { DeepPartial } from './theme';

// Types
export type {
  SlideTheme,
  SlideTemplate,
  BrandAsset,
  ResolvedSlideConfig,
  EntranceType,
  SlideRegionEntrance,
  ComparisonCellValue,
} from './types';

// New layout DSL components
export {
  TitleSlide,
  SectionSlide,
  ContentSlide,
  TwoColumnSlide,
  ImageSlide,
  FullBleedSlide,
  BlankSlide,
  BigNumberSlide,
  MetricGridSlide,
  ComparisonSlide,
  QuoteSlide,
  AgendaSlide,
} from './dsl';
export type {
  TitleSlideProps,
  SectionSlideProps,
  ContentSlideProps,
  TwoColumnSlideProps,
  ImageSlideProps,
  FullBleedSlideProps,
  BlankSlideProps,
  BigNumberSlideProps,
  MetricGridSlideProps,
  ComparisonSlideProps,
  QuoteSlideProps,
  AgendaSlideProps,
} from './dsl';
```

**Remove old layout DSL exports:** `TitleLayout`, `TitleBodyLayout`, `TwoColumnLayout`, `FullBleedLayout`, `BlankLayout`, `SlideContent` and their prop types.

---

## 5. Stream D — Slides: Layout System Rewrite (Phase 1B)

**Package:** `@brewsite/slides`
**Prerequisite:** Stream C Step C1 must land first (for the expanded `SlideLayout` union and `SlideRegionEntrance` type). Stream D can begin implementation once C1 types are available.

### Step D1: Rewrite `packages/slides/src/compiler/layoutCompiler.ts`

**Delete all existing content.** Replace with layout computation for all 12 core layouts.

The layout compiler is a pure function: `SlideLayout` + config → `SlideRegion[]`. It now reads density tokens from `SlideTheme` density values (passed as parameters, not CSS vars — the compiler is pure, no DOM access).

**Updated type:**

```typescript
type LayoutInput = {
  layout: SlideLayout;
  hasTitle: boolean;
  overlayPosition?: 'top-left' | 'bottom-left' | 'top-right' | 'bottom-right' | 'center';
  /** Number of stats for big-number layout. Default: 1. */
  statCount?: number;
  /** Number of metric columns for metric-grid layout. Default: 3. */
  metricColumns?: number;
  /** Image position for image layout. Default: 'left'. */
  imagePosition?: 'left' | 'right';
  /** Number of comparison columns. */
  comparisonColumns?: number;
};

// NVS structural constants — fixed grid, not theme-configurable.
// Visual density (padding, gap) is controlled by --slide-* CSS vars at render time.
const TITLE_H = 0.18;
const GUTTER = 0.02;
```

**Function signature:**

```typescript
export function compileLayout(input: LayoutInput): SlideRegion[] {
  const titleH = TITLE_H;
  const gutter = GUTTER;

  switch (input.layout) {
    case 'title': { /* full viewport centered */ }
    case 'section': { /* full viewport centered, same as title */ }
    case 'content': { /* title bar + body */ }
    case 'two-column': { /* optional title + two equal columns */ }
    case 'image': { /* image region 55% + text region 45%, split by imagePosition */ }
    case 'full-bleed': { /* overlay region in corner */ }
    case 'blank': { /* full viewport body */ }
    case 'big-number': { /* 1-4 stat slots in a centered row */ }
    case 'metric-grid': { /* title bar + 3-4 equal columns */ }
    case 'comparison': { /* title bar + full-width body */ }
    case 'quote': { /* centered quote region + attribution region */ }
    case 'agenda': { /* title bar + body */ }
    // Phase 1B+ layouts default to blank
    default: return [{ id: 'body', x: 0, y: 0, w: 1, h: 1, layer: 0 }];
  }
}
```

**Detailed region computations for each layout:**

```typescript
case 'title': {
  return [{ id: 'title', x: 0, y: 0, w: 1, h: 1, layer: 1 }];
}

case 'section': {
  return [{ id: 'title', x: 0, y: 0, w: 1, h: 1, layer: 1 }];
}

case 'content': {
  const bodyY = titleH + gutter;
  const bodyH = 1 - bodyY - gutter;
  return [
    { id: 'title', x: 0, y: gutter, w: 1, h: titleH - gutter, layer: 1 },
    { id: 'body',  x: 0, y: bodyY,  w: 1, h: bodyH,           layer: 0 },
  ];
}

case 'two-column': {
  const colGap = gutter * 2;  // wider gap between columns
  const colW = (1 - colGap) / 2;
  const bodyY = input.hasTitle ? titleH + gutter : gutter;
  const bodyH = 1 - bodyY - gutter;
  const regions: SlideRegion[] = [
    { id: 'left',  x: 0,              y: bodyY, w: colW, h: bodyH, layer: 0 },
    { id: 'right', x: colW + colGap,  y: bodyY, w: colW, h: bodyH, layer: 0 },
  ];
  if (input.hasTitle) {
    regions.unshift({ id: 'title', x: 0, y: gutter, w: 1, h: titleH - gutter, layer: 1 });
  }
  return regions;
}

case 'image': {
  const imgW = 0.55;
  const textW = 1 - imgW - gutter;
  const isLeft = (input.imagePosition ?? 'left') === 'left';
  return [
    {
      id: 'image',
      x: isLeft ? 0 : textW + gutter,
      y: 0, w: imgW, h: 1,
      layer: 0,
    },
    {
      id: 'body',
      x: isLeft ? imgW + gutter : 0,
      y: gutter, w: textW, h: 1 - gutter * 2,
      layer: 0,
    },
  ];
}

case 'full-bleed': {
  const OVERLAY_W = 0.4;
  const OVERLAY_H = 0.3;
  const PAD = 0.04;
  const pos = input.overlayPosition ?? 'bottom-left';
  let x = 0, y = 0;
  if (pos === 'top-left')     { x = PAD; y = PAD; }
  if (pos === 'top-right')    { x = 1 - OVERLAY_W - PAD; y = PAD; }
  if (pos === 'bottom-left')  { x = PAD; y = 1 - OVERLAY_H - PAD; }
  if (pos === 'bottom-right') { x = 1 - OVERLAY_W - PAD; y = 1 - OVERLAY_H - PAD; }
  if (pos === 'center')       { x = (1 - OVERLAY_W) / 2; y = (1 - OVERLAY_H) / 2; }
  return [{ id: 'overlay', x, y, w: OVERLAY_W, h: OVERLAY_H, layer: 1 }];
}

case 'blank': {
  return [{ id: 'body', x: 0, y: 0, w: 1, h: 1, layer: 0 }];
}

case 'big-number': {
  const count = Math.max(1, Math.min(4, input.statCount ?? 1));
  const statGap = gutter;
  const statW = (1 - statGap * (count - 1)) / count;
  const statH = 0.5;
  const statY = (1 - statH) / 2;  // vertically centered
  const regions: SlideRegion[] = [];
  for (let i = 0; i < count; i++) {
    regions.push({
      id: `stat-${i}`,
      x: i * (statW + statGap),
      y: statY,
      w: statW,
      h: statH,
      layer: 0,
    });
  }
  if (input.hasTitle) {
    regions.unshift({ id: 'title', x: 0, y: gutter, w: 1, h: titleH * 0.7, layer: 1 });
  }
  return regions;
}

case 'metric-grid': {
  const cols = input.metricColumns ?? 3;
  const colGap = gutter;
  const colW = (1 - colGap * (cols - 1)) / cols;
  const bodyY = input.hasTitle ? titleH + gutter : gutter;
  const bodyH = 1 - bodyY - gutter;
  const regions: SlideRegion[] = [];
  if (input.hasTitle) {
    regions.push({ id: 'title', x: 0, y: gutter, w: 1, h: titleH - gutter, layer: 1 });
  }
  for (let i = 0; i < cols; i++) {
    regions.push({
      id: `metric-${i}`,
      x: i * (colW + colGap),
      y: bodyY,
      w: colW,
      h: bodyH,
      layer: 0,
    });
  }
  return regions;
}

case 'comparison': {
  const bodyY = titleH + gutter;
  const bodyH = 1 - bodyY - gutter;
  return [
    { id: 'title', x: 0, y: gutter, w: 1, h: titleH - gutter, layer: 1 },
    { id: 'body',  x: 0, y: bodyY,  w: 1, h: bodyH,           layer: 0 },
  ];
}

case 'quote': {
  const quoteH = 0.6;
  const quoteY = (1 - quoteH - 0.1) / 2;
  return [
    { id: 'quote',       x: 0.1, y: quoteY,            w: 0.8, h: quoteH, layer: 1 },
    { id: 'attribution', x: 0.1, y: quoteY + quoteH + gutter, w: 0.8, h: 0.1,   layer: 0 },
  ];
}

case 'agenda': {
  const bodyY = titleH + gutter;
  const bodyH = 1 - bodyY - gutter;
  return [
    { id: 'title', x: 0, y: gutter, w: 1, h: titleH - gutter, layer: 1 },
    { id: 'body',  x: 0, y: bodyY,  w: 1, h: bodyH,           layer: 0 },
  ];
}
```

### Step D2: Update `packages/slides/src/compiler/deckCompiler.tsx` — Layout Branches

**SEQUENCING:** This step runs AFTER Stream C's rewrite of `deckCompiler.tsx` lands. Stream C's rewrite leaves `extractLayoutInfo()` with a default fallback for unknown layouts and `buildSceneElements()` with a default content renderer. Step D2 adds the layout-specific branches.

#### D2a: `extractLayoutInfo()` branches

Each new layout component gets an `if` branch mapping DSL props to the `LayoutContentChildren` union:

```typescript
if (type === TitleSlide) {
  const title = props['title'] as string;
  const subtitle = props['subtitle'] as string | undefined;
  const tagline = props['tagline'] as string | undefined;
  const alignment = (props['alignment'] as string | undefined) ?? 'center';
  return {
    layout: 'title', title, hasTitle: true,
    contentChildren: { title, subtitle, tagline, alignment },
  };
}

if (type === SectionSlide) {
  const title = props['title'] as string;
  const subtitle = props['subtitle'] as string | undefined;
  return { layout: 'section', title, hasTitle: true, contentChildren: { title, subtitle } };
}

if (type === ContentSlide) {
  const title = props['title'] as string;
  return { layout: 'content', title, hasTitle: true, contentChildren: props['children'] as ReactNode };
}

if (type === TwoColumnSlide) {
  const title = props['title'] as string | undefined;
  return {
    layout: 'two-column', title, hasTitle: !!title,
    contentChildren: { left: props['left'] as ReactNode, right: props['right'] as ReactNode },
  };
}

if (type === ImageSlide) {
  const title = props['title'] as string | undefined;
  return {
    layout: 'image', title, hasTitle: !!title,
    contentChildren: props['children'] as ReactNode,
    imageUrl: props['imageUrl'] as string,
    imageFit: (props['imageFit'] as string | undefined) ?? 'cover',
    imagePosition: (props['imagePosition'] as 'left' | 'right' | undefined) ?? 'left',
  };
}

if (type === FullBleedSlide) {
  return {
    layout: 'full-bleed', title: undefined, hasTitle: false,
    contentChildren: props['children'] as ReactNode,
    overlayPosition: props['overlayPosition'] as string | undefined,
  };
}

if (type === BlankSlide) {
  return { layout: 'blank', title: undefined, hasTitle: false, contentChildren: props['children'] as ReactNode };
}

if (type === BigNumberSlide) {
  const title = props['title'] as string | undefined;
  return {
    layout: 'big-number', title, hasTitle: !!title,
    contentChildren: { stats: props['stats'] as BigNumberSlideProps['stats'] },
    statCount: (props['stats'] as unknown[])?.length ?? 1,
  };
}

if (type === MetricGridSlide) {
  const title = props['title'] as string | undefined;
  return {
    layout: 'metric-grid', title, hasTitle: !!title,
    contentChildren: { metrics: props['metrics'] as MetricGridSlideProps['metrics'] },
    metricColumns: (props['columns'] as number | undefined) ?? 3,
  };
}

if (type === ComparisonSlide) {
  const title = props['title'] as string | undefined;
  return {
    layout: 'comparison', title, hasTitle: !!title,
    contentChildren: {
      headers: props['headers'] as string[],
      rows: props['rows'] as ComparisonSlideProps['rows'],
      highlightColumn: props['highlightColumn'] as number | undefined,
    },
  };
}

if (type === QuoteSlide) {
  return {
    layout: 'quote', title: undefined, hasTitle: false,
    contentChildren: {
      quote: props['quote'] as string,
      attribution: props['attribution'] as string,
      role: props['role'] as string | undefined,
    },
  };
}

if (type === AgendaSlide) {
  const title = props['title'] as string;
  return {
    layout: 'agenda', title, hasTitle: true,
    contentChildren: { items: props['items'] as AgendaSlideProps['items'] },
  };
}
```

**Note:** `extractLayoutInfo` return type must be extended to carry `imageUrl`, `imageFit`, `imagePosition`, `statCount`, `metricColumns` for the layout-specific data. These are passed through to `compileLayout()` and `buildSceneElements()`.

#### D2b: `buildSceneElements()` content rendering for each layout

This is the critical specification: what React content goes into each TextBox region for data-driven layouts. All data-driven layouts render **inline styled elements** — they do NOT depend on graphics components from Stream E. This eliminates the dependency and keeps D2 independent of E.

**Rationale:** Graphics components (`StatCard`, `ComparisonTable`, etc.) are designed as standalone React components for use by authors inside layout children. The compiler-generated content for data-driven layouts should be self-contained inline HTML, styled with `--brewsite-*` and `--slide-*` CSS variables. Authors who want richer rendering can use `<ContentSlide>` with graphics components as children instead.

**Per-layout content rendering:**

**`title` layout — single `title` region:**
```tsx
regionContent = (
  <div style={{
    display: 'flex', flexDirection: 'column',
    alignItems: data.alignment === 'center' ? 'center' : 'flex-start',
    justifyContent: 'center', height: '100%',
    padding: 'var(--slide-content-padding)',
    textAlign: data.alignment === 'center' ? 'center' : 'left',
  }}>
    <h1 style={{ fontFamily: 'var(--brewsite-font-heading)', fontSize: 'clamp(2rem, 5vw, 4rem)', fontWeight: 700, color: 'var(--brewsite-text-primary)', margin: 0 }}>{data.title}</h1>
    {data.subtitle && <p style={{ fontFamily: 'var(--brewsite-font-family)', fontSize: 'clamp(1rem, 2.5vw, 2rem)', color: 'var(--brewsite-text-secondary)', margin: '0.75em 0 0' }}>{data.subtitle}</p>}
    {data.tagline && <p style={{ fontFamily: 'var(--brewsite-font-family)', fontSize: 'clamp(0.875rem, 1.5vw, 1.25rem)', color: 'var(--brewsite-text-muted)', margin: '0.5em 0 0' }}>{data.tagline}</p>}
  </div>
);
```

**`section` layout — single `title` region:**
```tsx
regionContent = (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '100%',
    padding: 'var(--slide-content-padding)', textAlign: 'center',
  }}>
    <h2 style={{ fontFamily: 'var(--brewsite-font-heading)', fontSize: 'clamp(1.75rem, 4vw, 3.5rem)', fontWeight: 700, color: 'var(--brewsite-text-primary)', margin: 0 }}>{data.title}</h2>
    {data.subtitle && <p style={{ fontFamily: 'var(--brewsite-font-family)', fontSize: 'clamp(1rem, 2vw, 1.5rem)', color: 'var(--brewsite-text-secondary)', margin: '0.75em 0 0' }}>{data.subtitle}</p>}
  </div>
);
```

**`content` layout — `title` + `body` regions:**
- `title` region: `<h2>` styled heading (same pattern as current `title-body`).
- `body` region: Author's `children` ReactNode wrapped in a flex container. Wrapped by `SlideContentWithProgress` when animated lists are present.

**`two-column` layout — `title` + `left` + `right` regions:**
- Same as current implementation but with updated CSS variable references.

**`image` layout — `image` + `body` regions:**
- `image` region: `<img src={imageUrl} alt={imageAlt} style={{ width: '100%', height: '100%', objectFit: imageFit }} />`.
- `body` region: Author's `children` ReactNode wrapped in flex container with padding.

**`full-bleed` layout — single `overlay` region:**
- Author's `children` in a padded flex container.

**`blank` layout — single `body` region:**
- Author's `children` directly.

**`big-number` layout — `stat-0` through `stat-N` regions (+ optional `title`):**
Each stat region renders an inline stat card:
```tsx
const stat = data.stats[statIndex];
regionContent = (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '100%', textAlign: 'center',
    padding: 'var(--brewsite-spacing-md)',
  }}>
    <span style={{ fontFamily: 'var(--brewsite-font-heading)', fontSize: 'clamp(2rem, 6vw, 4.5rem)', fontWeight: 700, color: 'var(--brewsite-text-primary)', lineHeight: 1.1 }}>{stat.value}</span>
    <span style={{ fontFamily: 'var(--brewsite-font-family)', fontSize: 'var(--brewsite-font-size-body)', color: 'var(--brewsite-text-secondary)', marginTop: 'var(--brewsite-spacing-sm)' }}>{stat.label}</span>
    {stat.trend && (
      <span style={{
        fontFamily: 'var(--brewsite-font-family)', fontSize: 'var(--brewsite-font-size-caption)',
        color: stat.trendDirection === 'up' ? 'var(--brewsite-color-success)'
             : stat.trendDirection === 'down' ? 'var(--brewsite-color-error)'
             : 'var(--brewsite-text-muted)',
        marginTop: 'var(--brewsite-spacing-xs)',
      }}>{stat.trend}</span>
    )}
  </div>
);
```

**`metric-grid` layout — `metric-0` through `metric-N` regions (+ optional `title`):**
Each metric region renders an inline metric card:
```tsx
const metric = data.metrics[metricIndex];
regionContent = (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '100%', textAlign: 'center',
    padding: 'var(--brewsite-spacing-md)',
    background: 'var(--brewsite-surface-elevated)',
    borderRadius: 'var(--brewsite-radius-md)',
    border: '1px solid var(--brewsite-border-subtle)',
  }}>
    {metric.icon && <div style={{ marginBottom: 'var(--brewsite-spacing-sm)', fontSize: '1.5rem' }}>{metric.icon}</div>}
    <span style={{ fontFamily: 'var(--brewsite-font-heading)', fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', fontWeight: 700, color: 'var(--brewsite-text-primary)' }}>{metric.value}</span>
    <span style={{ fontFamily: 'var(--brewsite-font-family)', fontSize: 'var(--brewsite-font-size-caption)', color: 'var(--brewsite-text-secondary)', marginTop: 'var(--brewsite-spacing-xs)' }}>{metric.label}</span>
  </div>
);
```

**`comparison` layout — `title` + `body` regions:**
The `body` region renders a full HTML table:
```tsx
regionContent = (
  <div style={{ height: '100%', padding: 'var(--slide-content-padding)', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--brewsite-font-family)' }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left', padding: 'var(--brewsite-spacing-sm) var(--brewsite-spacing-md)', color: 'var(--brewsite-text-muted)', fontSize: 'var(--brewsite-font-size-caption)', borderBottom: '1px solid var(--brewsite-border-subtle)' }}></th>
          {data.headers.map((h, i) => (
            <th key={i} style={{
              textAlign: 'center', padding: 'var(--brewsite-spacing-sm) var(--brewsite-spacing-md)',
              color: i === data.highlightColumn ? 'var(--brewsite-accent-color)' : 'var(--brewsite-text-primary)',
              fontSize: 'var(--brewsite-font-size-body)', fontWeight: 600,
              borderBottom: '1px solid var(--brewsite-border-subtle)',
            }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.rows.map((row, ri) => (
          <tr key={ri}>
            <td style={{ padding: 'var(--brewsite-spacing-sm) var(--brewsite-spacing-md)', color: 'var(--brewsite-text-primary)', fontSize: 'var(--brewsite-font-size-body)' }}>{row.feature}</td>
            {row.values.map((cell, ci) => (
              <td key={ci} style={{
                textAlign: 'center', padding: 'var(--brewsite-spacing-sm) var(--brewsite-spacing-md)',
                color: ci === data.highlightColumn ? 'var(--brewsite-accent-color)' : 'var(--brewsite-text-secondary)',
              }}>
                {cell.kind === 'check' ? (cell.value ? '✓' : '✗') : String(cell.value)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
```

**`quote` layout — `quote` + `attribution` regions:**
```tsx
// quote region:
regionContent = (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100%', padding: 'var(--slide-content-padding)', textAlign: 'center',
  }}>
    <blockquote style={{
      fontFamily: 'var(--brewsite-font-heading)', fontSize: 'clamp(1.25rem, 2.5vw, 2rem)',
      fontWeight: 400, fontStyle: 'italic', color: 'var(--brewsite-text-primary)',
      margin: 0, lineHeight: 1.5, position: 'relative',
      paddingLeft: '1.5em', borderLeft: '3px solid var(--brewsite-accent-color)',
    }}>
      {data.quote}
    </blockquote>
  </div>
);

// attribution region:
regionContent = (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', height: '100%' }}>
    <span style={{ fontFamily: 'var(--brewsite-font-family)', fontSize: 'var(--brewsite-font-size-body)', color: 'var(--brewsite-text-secondary)' }}>
      — {data.attribution}{data.role ? `, ${data.role}` : ''}
    </span>
  </div>
);
```

**`agenda` layout — `title` + `body` regions:**
```tsx
// body region:
regionContent = (
  <div style={{
    height: '100%', padding: 'var(--slide-content-padding)', overflow: 'hidden',
    display: 'flex', flexDirection: 'column', justifyContent: 'center',
    gap: 'var(--slide-content-gap)',
  }}>
    {data.items.map((item, i) => (
      <div key={i} style={{ display: 'flex', gap: 'var(--brewsite-spacing-md)', alignItems: 'flex-start' }}>
        <span style={{ fontFamily: 'var(--brewsite-font-heading)', fontSize: 'var(--brewsite-font-size-body)', fontWeight: 600, color: 'var(--brewsite-accent-color)', minWidth: '2rem' }}>{i + 1}.</span>
        <div>
          <span style={{ fontFamily: 'var(--brewsite-font-family)', fontSize: 'var(--brewsite-font-size-body)', color: 'var(--brewsite-text-primary)', fontWeight: 500 }}>{item.label}</span>
          {item.description && <p style={{ fontFamily: 'var(--brewsite-font-family)', fontSize: 'var(--brewsite-font-size-caption)', color: 'var(--brewsite-text-secondary)', margin: '0.25em 0 0' }}>{item.description}</p>}
        </div>
      </div>
    ))}
  </div>
);
```

**Key design decision:** Data-driven layouts render **inline styled HTML**, not graphics components. This means:
- Stream D has NO dependency on Stream E.
- Graphics components (`StatCard`, `ComparisonTable`, etc.) remain available for authors to use inside `<ContentSlide>` or `<BlankSlide>` children for richer, animated rendering.
- Compiler-generated content is self-contained and theme-aware via CSS variables.

### Step D3: Tests for Stream D

**`packages/slides/src/compiler/__tests__/layoutCompiler.test.ts`:**

- Test each of the 12 core layouts returns correct region count and coordinates.
- Test `title` layout returns 1 full-viewport region.
- Test `content` layout returns title + body regions with correct NVS coordinates.
- Test `two-column` with and without title.
- Test `image` with `imagePosition: 'left'` and `'right'`.
- Test `big-number` with 1, 2, 3, 4 stats.
- Test `metric-grid` with 3 and 4 columns.
- Test `quote` returns quote + attribution regions.
- Test custom `titleHeight` and `gutter` override defaults.
- Test unknown layout returns fallback blank region.

---

## 6. Stream E — Slides: Graphics Components + Animation Hooks (Phase 1C + 1D)

**Package:** `@brewsite/slides`
**Prerequisite:** Stream C Step C4 must land first (`--slide-*` CSS variable names finalized).

All files in this stream are **NEW** — no overlap with Streams C or D.

### Step E1: Animation hooks — `packages/slides/src/animation/`

**New files:**

**`packages/slides/src/animation/useProgressWindow.ts`:**

```typescript
import { useSceneProgress } from '@brewsite/core';

/**
 * Returns progress [0,1] clamped and eased within a sub-window of scene progress.
 */
export function useProgressWindow(
  start: number,
  end: number,
  options?: { easing?: (t: number) => number },
): number {
  const progress = useSceneProgress();
  if (progress <= start) return 0;
  if (progress >= end) return 1;
  const raw = (progress - start) / (end - start);
  return options?.easing ? options.easing(raw) : raw;
}
```

**`packages/slides/src/animation/useCountUp.ts`:**

```typescript
import { useSceneProgress } from '@brewsite/core';
import { easeOutCubic } from './easings';

export function useCountUp(
  target: number,
  options?: {
    start?: number;
    delay?: number;
    duration?: number;
    easing?: (t: number) => number;
    decimals?: number;
  },
): number {
  const progress = useSceneProgress();
  const start = options?.start ?? 0;
  const delay = options?.delay ?? 0;
  const duration = options?.duration ?? 0.6;
  const decimals = options?.decimals ?? 0;
  const easing = options?.easing ?? easeOutCubic;

  if (progress <= delay) return round(start, decimals);
  if (progress >= delay + duration) return round(target, decimals);

  const t = (progress - delay) / duration;
  const eased = easing(t);
  const value = start + (target - start) * eased;
  return round(value, decimals);
}

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
```

**`packages/slides/src/animation/useStaggeredReveal.ts`:**

```typescript
import { type CSSProperties } from 'react';
import { useSceneProgress } from '@brewsite/core';

export function useStaggeredReveal(
  index: number,
  total: number,
  options?: {
    staggerDelay?: number;
    fadeInDuration?: number;
    startAfter?: number;
  },
): { visible: boolean; style: CSSProperties } {
  const progress = useSceneProgress();
  const stagger = options?.staggerDelay ?? (total > 1 ? 0.6 / total : 0);
  const fade = options?.fadeInDuration ?? 0.15;
  const startAfter = options?.startAfter ?? 0;

  const itemStart = startAfter + index * stagger;
  const itemEnd = itemStart + fade;

  if (progress < itemStart) {
    return { visible: false, style: { opacity: 0, transform: 'translateY(8px)' } };
  }
  if (progress >= itemEnd) {
    return { visible: true, style: { opacity: 1, transform: 'translateY(0)' } };
  }

  const t = (progress - itemStart) / fade;
  return {
    visible: true,
    style: {
      opacity: t,
      transform: `translateY(${(1 - t) * 8}px)`,
      transition: 'none',
    },
  };
}
```

**`packages/slides/src/animation/useEntrance.ts`:**

```typescript
import { type CSSProperties } from 'react';
import { useSceneProgress } from '@brewsite/core';
import { easeOutCubic } from './easings';
import type { EntranceType } from '../types';

export function useEntrance(
  type: EntranceType,
  options?: {
    delay?: number;
    duration?: number;
    distance?: string;
    easing?: (t: number) => number;
  },
): CSSProperties {
  const progress = useSceneProgress();
  if (type === 'none') return {};

  const delay = options?.delay ?? 0;
  const duration = options?.duration ?? 0.3;
  const distance = options?.distance ?? '24px';
  const easing = options?.easing ?? easeOutCubic;

  if (progress <= delay) return entranceStart(type, distance);
  if (progress >= delay + duration) return {};

  const t = easing((progress - delay) / duration);
  return entranceInterpolate(type, distance, t);
}

function entranceStart(type: EntranceType, distance: string): CSSProperties {
  switch (type) {
    case 'fadeIn': return { opacity: 0 };
    case 'slideUp': return { opacity: 0, transform: `translateY(${distance})` };
    case 'slideDown': return { opacity: 0, transform: `translateY(-${distance})` };
    case 'slideLeft': return { opacity: 0, transform: `translateX(${distance})` };
    case 'slideRight': return { opacity: 0, transform: `translateX(-${distance})` };
    case 'grow': return { opacity: 0, transform: 'scale(0.8)' };
    default: return {};
  }
}

function entranceInterpolate(type: EntranceType, distance: string, t: number): CSSProperties {
  const opacity = t;
  const px = parseFloat(distance) * (1 - t);
  switch (type) {
    case 'fadeIn': return { opacity };
    case 'slideUp': return { opacity, transform: `translateY(${px}px)` };
    case 'slideDown': return { opacity, transform: `translateY(-${px}px)` };
    case 'slideLeft': return { opacity, transform: `translateX(${px}px)` };
    case 'slideRight': return { opacity, transform: `translateX(-${px}px)` };
    case 'grow': return { opacity, transform: `scale(${0.8 + 0.2 * t})` };
    default: return {};
  }
}
```

**`packages/slides/src/animation/easings.ts`:**

```typescript
// Easing functions for slide animations. Re-exports core easings + slide-specific.

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

export function linear(t: number): number {
  return t;
}
```

**`packages/slides/src/animation/index.ts`:**

```typescript
export { useCountUp } from './useCountUp';
export { useStaggeredReveal } from './useStaggeredReveal';
export { useProgressWindow } from './useProgressWindow';
export { useEntrance } from './useEntrance';
export { easeOutCubic, easeInOutCubic, easeOutQuart, linear } from './easings';
```

### Step E2: Graphics components — `packages/slides/src/graphics/`

All 12 components are standard React components (render real HTML, not DSL stubs). Each accepts `className` and `style` escape hatches. Visual styling via `--brewsite-*` CSS vars, behavioral styling via `--slide-*` CSS vars.

**File list:**

| File | Component | Lines (est.) |
|------|-----------|-------------|
| `graphics/StatCard.tsx` | `StatCard` | ~80 |
| `graphics/Timeline.tsx` | `Timeline` | ~100 |
| `graphics/ProcessSteps.tsx` | `ProcessSteps` | ~80 |
| `graphics/IconGrid.tsx` | `IconGrid` | ~60 |
| `graphics/ComparisonTable.tsx` | `ComparisonTable` | ~100 |
| `graphics/ProgressRing.tsx` | `ProgressRing` | ~80 |
| `graphics/ProgressBar.tsx` | `ProgressBar` | ~50 |
| `graphics/CalloutBox.tsx` | `CalloutBox` | ~50 |
| `graphics/QuoteBlock.tsx` | `QuoteBlock` | ~50 |
| `graphics/MetricRow.tsx` | `MetricRow` | ~60 |
| `graphics/Badge.tsx` | `Badge` | ~40 |
| `graphics/Divider.tsx` | `Divider` | ~30 |
| `graphics/index.ts` | Barrel | ~15 |

**Component prop interfaces (complete):**

```typescript
// StatCard.tsx
export type StatCardProps = {
  value: string | number;
  label: string;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  icon?: ReactNode;
  progress?: number;
  className?: string;
  style?: CSSProperties;
};

// Timeline.tsx
export type TimelineProps = {
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
};

// ProcessSteps.tsx
export type ProcessStepsProps = {
  steps: Array<{
    title: string;
    description?: string;
    icon?: ReactNode;
  }>;
  activeStep?: number;
  progress?: number;
  className?: string;
  style?: CSSProperties;
};

// IconGrid.tsx
export type IconGridProps = {
  items: Array<{
    icon: ReactNode;
    label: string;
    description?: string;
  }>;
  columns?: 2 | 3 | 4;
  progress?: number;
  className?: string;
  style?: CSSProperties;
};

// ComparisonTable.tsx
export type ComparisonTableProps = {
  headers: string[];
  rows: Array<{
    feature: string;
    values: import('../types').ComparisonCellValue[];
  }>;
  highlightColumn?: number;
  progress?: number;
  className?: string;
  style?: CSSProperties;
};

// ProgressRing.tsx
export type ProgressRingProps = {
  value: number;       // 0-100
  label?: string;
  size?: string;       // default: var(--slide-progress-ring-size)
  thickness?: string;  // default: var(--slide-progress-ring-thickness)
  color?: string;      // default: var(--brewsite-accent-color)
  progress?: number;
  className?: string;
  style?: CSSProperties;
};

// ProgressBar.tsx
export type ProgressBarProps = {
  value: number;       // 0-100
  label?: string;
  color?: string;
  height?: string;
  progress?: number;
  className?: string;
  style?: CSSProperties;
};

// CalloutBox.tsx
export type CalloutBoxProps = {
  variant?: 'info' | 'warning' | 'success' | 'error' | 'neutral';
  icon?: ReactNode;
  title?: string;
  children: ReactNode;
  progress?: number;
  className?: string;
  style?: CSSProperties;
};

// QuoteBlock.tsx
export type QuoteBlockProps = {
  quote: string;
  attribution: string;
  role?: string;
  progress?: number;
  className?: string;
  style?: CSSProperties;
};

// MetricRow.tsx
export type MetricRowProps = {
  items: Array<{
    value: string | number;
    label: string;
    icon?: ReactNode;
  }>;
  progress?: number;
  className?: string;
  style?: CSSProperties;
};

// Badge.tsx
export type BadgeProps = {
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  className?: string;
  style?: CSSProperties;
};

// Divider.tsx
export type DividerProps = {
  variant?: 'solid' | 'dashed' | 'gradient';
  className?: string;
  style?: CSSProperties;
};
```

**CSS variable usage pattern for all graphics components:**

```typescript
// Colors from core (--brewsite-*)
color: 'var(--brewsite-text-primary)'          // headings, values
color: 'var(--brewsite-text-secondary)'        // labels, descriptions
background: 'var(--brewsite-surface-elevated)' // card backgrounds
borderColor: 'var(--brewsite-border-subtle)'   // card borders
accentColor: 'var(--brewsite-accent-color)'    // active states, trends

// Sizing from slides (--slide-*)
borderWidth: 'var(--slide-card-border-width)'
gap: 'var(--slide-content-gap)'
padding: 'var(--brewsite-spacing-md)'          // internal component padding from core

// Semantic colors from core
color: 'var(--brewsite-color-success)'         // trend up
color: 'var(--brewsite-color-error)'           // trend down

// Shadows from core
boxShadow: 'var(--brewsite-shadow-sm)'
```

### Step E3: Tests for Stream E

**Animation hook tests — `packages/slides/src/animation/__tests__/`:**

> **Test convention justification:** Animation hooks are pure math functions driven by a single input (`progress: number`). They consume `useSceneProgress()` from `@brewsite/core`, which is a React hook that reads engine state via context. In a unit test environment there is no SceneEngine, no RuntimeDriver, and no React tree — constructing these would be integration-level setup that obscures the math being tested. Mocking `useSceneProgress` via `vi.mock()` isolates the pure math contract (input: progress → output: CSS styles / numbers) from the rendering context. This is the correct test boundary: the hook's contract is "given a progress value, return the right output," not "given a running engine, return the right output." This is consistent with how `@brewsite/core` tests its own hooks (e.g., `useEngineState` tests mock the context provider, not the engine).

**`useCountUp.test.ts`:**
- Mock `useSceneProgress` to return controlled values. Add a comment at the top of the test file: `// vi.mock is appropriate here: these hooks are pure math (progress → output). No engine fixture needed. Do not cargo-cult this pattern into tests where a real engine fixture would be better.`
- Test: progress=0 returns `start` (default 0).
- Test: progress=1 returns `target`.
- Test: progress=0.5 returns intermediate eased value.
- Test: `delay: 0.5` — progress=0.3 returns `start`.
- Test: `decimals: 2` — value is rounded correctly.

**`useStaggeredReveal.test.ts`:**
- Test: progress=0 → `visible: false`, `opacity: 0`.
- Test: progress=1 → `visible: true`, `opacity: 1`.
- Test: 0 items edge case.
- Test: `startAfter: 0.2` delays first item.

**`useProgressWindow.test.ts`:**
- Test: progress < start → returns 0.
- Test: progress > end → returns 1.
- Test: progress midway → returns correctly interpolated value.
- Test: custom easing function.

**`useEntrance.test.ts`:**
- Test: `'none'` → empty object.
- Test: `'fadeIn'` at progress=0 → `opacity: 0`.
- Test: `'fadeIn'` at progress=1 → empty (fully visible).
- Test: `'slideUp'` at progress=0 → `translateY(24px)`, `opacity: 0`.

**Graphics component tests — `packages/slides/src/graphics/__tests__/`:**

For each component, test:
1. Renders correct HTML structure with required props.
2. `className` and `style` escape hatches are applied.
3. `progress=0` applies entrance animation styles when applicable.
4. `progress=undefined` renders fully visible.

### Step E4: Update `packages/slides/src/index.ts` (after Streams C and D)

Add:
```typescript
// Animation hooks
export { useCountUp, useStaggeredReveal, useProgressWindow, useEntrance } from './animation';
export { easeOutCubic, easeInOutCubic, easeOutQuart, linear } from './animation';

// Graphics components
export {
  StatCard, Timeline, ProcessSteps, IconGrid, ComparisonTable,
  ProgressRing, ProgressBar, CalloutBox, QuoteBlock, MetricRow,
  Badge, Divider,
} from './graphics';
export type {
  StatCardProps, TimelineProps, ProcessStepsProps, IconGridProps,
  ComparisonTableProps, ProgressRingProps, ProgressBarProps,
  CalloutBoxProps, QuoteBlockProps, MetricRowProps, BadgeProps, DividerProps,
} from './graphics';
```

---

## 7. Phase 2 — Corporate Template System (Phase 2A)

**Package:** `@brewsite/slides`
**Prerequisite:** Streams C+D complete.

### Step P2-1: Create `packages/slides/src/template/` directory

**New files:**

**`packages/slides/src/template/types.ts`:**
Already defined in `types.ts` (Stream C Step C1). This file re-exports for internal use.

**`packages/slides/src/template/resolveTemplate.ts`:**

```typescript
// Pure function: SlideTemplate → resolved template with CSS vars + master elements.

import type { SlideTemplate } from '../types';

export type ResolvedTemplate = {
  readonly template: SlideTemplate;
  readonly cssVars: Record<string, string>;
};

export function resolveTemplate(template?: SlideTemplate): ResolvedTemplate | undefined {
  if (!template) return undefined;

  const cssVars: Record<string, string> = {};

  // Footer height
  if (template.master?.footer) {
    cssVars['--slide-footer-height'] = '32px';
  } else {
    cssVars['--slide-footer-height'] = '0px';
  }

  // Logo size
  if (template.master?.logo) {
    cssVars['--slide-logo-size'] = template.master.logo.size ?? '40px';
  } else {
    cssVars['--slide-logo-size'] = '0px';
  }

  // Watermark opacity
  if (template.master?.watermark) {
    cssVars['--slide-watermark-opacity'] = String(template.master.watermark.opacity ?? 0.05);
  } else {
    cssVars['--slide-watermark-opacity'] = '0';
  }

  return { template, cssVars };
}
```

**`packages/slides/src/template/index.ts`:**

```typescript
export { resolveTemplate } from './resolveTemplate';
export type { ResolvedTemplate } from './resolveTemplate';
```

### Step P2-2: Update `SlidePlayer.tsx` to accept `template` prop

SlidePlayer merges template CSS vars with slide theme CSS vars on the container:

```typescript
const resolvedTemplate = useMemo(
  () => resolveTemplate(template),
  [template],
);

const cssVarStyle = {
  ...resolvedConfig.cssVars,
  ...(resolvedTemplate?.cssVars ?? {}),
} as CSSProperties;
```

### Step P2-3: Render master slide chrome in SlidePlayer

Inside `EngineARContainer`, after `EngineOverlayHost`, render master chrome elements:

```typescript
{resolvedTemplate?.template.master?.logo && (
  <SlideChromeLogo
    template={resolvedTemplate.template}
    currentLayout={currentSlideLayout}
  />
)}
{resolvedTemplate?.template.master?.footer && (
  <SlideChromeFooter
    template={resolvedTemplate.template}
    currentIndex={currentSlideIndex}
    totalSlides={spec.slides.length}
  />
)}
{resolvedTemplate?.template.master?.watermark && (
  <SlideChromeWatermark template={resolvedTemplate.template} />
)}
```

**New files for chrome components:**
- `packages/slides/src/player/SlideChromeLogo.tsx`
- `packages/slides/src/player/SlideChromeFooter.tsx`
- `packages/slides/src/player/SlideChromeWatermark.tsx`

These are simple React components rendering absolutely-positioned elements using `--brewsite-*` CSS variables.

### Step P2-4: Tests for Phase 2

**`packages/slides/src/template/__tests__/resolveTemplate.test.ts`:**
- Test undefined input returns undefined.
- Test template with footer produces `--slide-footer-height: '32px'`.
- Test template with logo produces correct `--slide-logo-size`.
- Test template with no master produces all-zero CSS vars.

---

## 8. Phase 3 — Claude-Author Documentation (Phase 3A-3D)

**Package:** `@brewsite/claude-author`
**Prerequisite:** All implementation phases complete.

### Step P3-1: Create `packages/claude-author/docs/slides/` directory

**New files (12):**

| File | Content Source |
|------|--------------|
| `docs/slides/overview.md` | Package overview, installation, plugin registration |
| `docs/slides/slide-layouts.md` | All layout components — one ## per layout |
| `docs/slides/graphics.md` | All graphics components — one ## per component |
| `docs/slides/animation.md` | All animation hooks — one ## per hook |
| `docs/slides/themes.md` | SlideTheme system |
| `docs/slides/templates.md` | SlideTemplate system |
| `docs/slides/transitions.md` | Slide transitions |
| `docs/slides/navigation.md` | Navigation config |
| `docs/slides/3d-content.md` | sceneDsl integration |
| `docs/slides/speaker-notes.md` | Speaker notes + PresenterView |
| `docs/slides/print-export.md` | Print layout + snapshot capture |
| `docs/slides/deck-patterns.md` | Corporate deck patterns |

### Step P3-2: Update existing guides

| File | Change |
|------|--------|
| `docs/guides/common-gotchas.md` | Add 6 slide-specific gotcha entries |
| `docs/guides/overview.md` | Add @brewsite/slides to package list |
| `docs/guides/embedding-modes.md` | Add SlidePlayer as embedding mode |

**Content for each doc file follows the spec in the feature note Section 3B. Docs are written from implemented source code, not from this plan.**

---

## 9. File Ownership Matrix

This matrix ensures no two concurrent streams modify the same file.

| File | Stream A | Stream B | Stream C | Stream D | Stream E | Phase 2 | Phase 3 |
|------|----------|----------|----------|----------|----------|---------|---------|
| `core/src/theme/types.ts` | **MODIFY** | | | | | | |
| `core/src/player/EngineOverlayHost.tsx` | **MODIFY** | | | | | | |
| `core/src/player/computeThemeStyles.ts` | **CREATE** | | | | | | |
| `core/src/player/__tests__/computeThemeStyles.test.ts` | **CREATE** | | | | | | |
| `themes/src/presets/scene/enterprise.ts` | | **MODIFY** | | | | | |
| `themes/src/presets/scene/darkGlass.ts` | | **MODIFY** | | | | | |
| `themes/src/presets/scene/midnight.ts` | | **MODIFY** | | | | | |
| `themes/src/presets/scene/neonCyber.ts` | | **MODIFY** | | | | | |
| `themes/src/presets/scene/lightCanvas.ts` | | **MODIFY** | | | | | |
| `themes/src/presets/scene/lightMinimal.ts` | | **MODIFY** | | | | | |
| `slides/src/types.ts` | | | **REWRITE** | | | | |
| `slides/src/theme.ts` | | | **REWRITE** | | | | |
| `slides/src/themeFamily.ts` | | | **DELETE** | | | | |
| `slides/src/plugin.ts` | | | **REWRITE** | | | | |
| `slides/src/dsl.tsx` | | | **REWRITE** | | | | |
| `slides/src/compiler/themeCompiler.ts` | | | **REWRITE** | | | | |
| `slides/src/compiler/deckCompiler.tsx` | | | **REWRITE** | *merge* | | | |
| `slides/src/player/SlidePlayer.tsx` | | | **REWRITE** | | | **UPDATE** | |
| `slides/src/player/SlideTransitionWrapper.tsx` | | | **REWRITE** | | | | |
| `slides/src/player/PresenterView.tsx` | | | **UPDATE** | | | | |
| `slides/src/player/SlidePrintLayout.tsx` | | | **UPDATE** | | | | |
| `slides/src/player/SlideProgressIndicator.tsx` | | | **UPDATE** | | | | |
| `slides/src/widget/SlideMetaWidget.ts` | | | **UPDATE** | | | | |
| `slides/src/compiler/layoutCompiler.ts` | | | | **REWRITE** | | | |
| `slides/src/animation/*.ts` | | | | | **CREATE** | | |
| `slides/src/graphics/*.tsx` | | | | | **CREATE** | | |
| `slides/src/template/*.ts` | | | | | | **CREATE** | |
| `slides/src/player/SlideChrome*.tsx` | | | | | | **CREATE** | |
| `slides/src/index.ts` | | | **UPDATE¹** | **UPDATE²** | **UPDATE³** | **UPDATE⁴** | |
| `claude-author/docs/slides/*.md` | | | | | | | **CREATE** |
| `claude-author/docs/guides/*.md` | | | | | | | **UPDATE** |

¹ Stream C first: remove DeckTheme exports, add SlideTheme exports.
² Stream D second: add new layout DSL exports.
³ Stream E third: add animation + graphics exports.
⁴ Phase 2 fourth: add template exports.

---

## 10. Testing Strategy

### Test Infrastructure

All tests use Vitest with Node environment. No real DOM, no real `requestAnimationFrame`.

### Pure function tests (no mocks needed)

| Module | Test approach |
|--------|-------------|
| `computeThemeStyles` | Real `SceneTheme` input → assert CSS var output |
| `resolveSlideConfig` | Real `SlideTheme` input → assert `ResolvedSlideConfig` output |
| `compileLayout` | Real `LayoutInput` → assert `SlideRegion[]` output |
| `compileDeck` | Real `<Slide>` elements → assert `DeckSpec` output |
| `resolveTemplate` | Real `SlideTemplate` → assert CSS var output |
| `resolveTransitionClass` | String inputs → assert class name output |
| Easings | Number input → assert number output |

### Hook tests (mock `useSceneProgress`)

Animation hooks (`useCountUp`, `useStaggeredReveal`, `useProgressWindow`, `useEntrance`) internally call `useSceneProgress()`. Tests mock this single hook to return controlled progress values.

```typescript
vi.mock('@brewsite/core', async () => {
  const actual = await vi.importActual('@brewsite/core');
  return { ...actual, useSceneProgress: vi.fn(() => mockProgress) };
});
```

Use `renderHook` from `@testing-library/react` to test each hook.

### React component tests

Graphics components render real HTML. Test with `renderToStaticMarkup` or `@testing-library/react`:
- Assert correct CSS variable references in style attributes.
- Assert `className` and `style` props are forwarded.
- Assert `progress` prop produces correct entrance styles.

### Integration tests (SlidePlayer)

SlidePlayer tests require a parent `SceneEngine` context. Use the existing test utilities from `packages/core/src/runtime/mocks/` to provide a mock engine context.

### Coverage targets

```
packages/slides/src/compiler/**/*.ts       — 90%+
packages/slides/src/animation/**/*.ts      — 95%+
packages/slides/src/graphics/**/*.tsx       — 80%+
packages/slides/src/template/**/*.ts        — 90%+
packages/core/src/player/computeThemeStyles.ts — 95%+
```

### Typecheck verification

After each stream completes:
```bash
pnpm --filter @brewsite/core typecheck
pnpm --filter @brewsite/themes typecheck
pnpm --filter @brewsite/slides typecheck
pnpm --filter @brewsite/slides test
```

---

## Implementation Sequence Summary

```
Week 1:
  [PARALLEL] Stream A (core types + CSS vars)     — 1 developer, ~1 day
  [PARALLEL] Stream B (theme presets)              — 1 developer, ~0.5 day

  GATE: A+B merge

Week 1-2:
  [PARALLEL] Stream C (theme rewrite + SlidePlayer) — 1 developer, ~3 days
  [PARALLEL] Stream D (layout system)               — 1 developer, ~1.5 days
  [PARALLEL] Stream E (graphics + hooks)             — 1-2 developers, ~2 days

  GATE: C+D+E merge

Week 2:
  Phase 2 (templates)                               — 1 developer, ~1 day

Week 3:
  Phase 3 (claude-author docs)                      — 1 developer, ~2 days
```

Total: 5 developers can work in parallel during weeks 1-2. No file conflicts when following the ownership matrix.

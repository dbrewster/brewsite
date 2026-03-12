---
title: "Theming Overhaul — Light/Dark Pairs, ThemeFamily Registry, CSS Class Injection, Examples Toggle"
doc_type: plan
owner: brewsite-architect
status: complete
updated: 2026-03-11
---

# Theming Overhaul — Implementation Plan

## 1. Overview & Goals

This plan implements the theming overhaul described in `requirements/core/notes/note_theming-overhaul.md`. It delivers five coordinated capabilities across three packages and the examples app:

1. **`ThemeFamily` type** exported from `@brewsite/core` — the single canonical union of the six theme names, shared by all packages.
2. **`SCENE_THEME_PAIRS` / `DIAGRAM_THEME_PAIRS` / `CHART_THEME_PAIRS` registries** — keyed by `ThemeFamily` and `ThemePolarity`, each entry pre-wired with its cross-package `sceneTheme`.
3. **Light/dark variant presets** for all six theme families (6 new presets per package = 18 new preset constants total, all placeholder-quality in v1 with `@internal` JSDoc).
4. **CSS class injection** on `EngineOverlayHost` — `.bw-theme-{family}` and `.bw-dark`/`.bw-light` classes, plus four new CSS custom properties.
5. **Examples polarity toggle** — `ChartDemoPage` replaces the module-level `theme` constant with React state, adds a sun/moon toggle button, and remounts `SceneEngine` on polarity change via `clearSceneTrackCache()` + key increment.

**Semver impact:** minor on all three packages (`@brewsite/core`, `@brewsite/diagram`, `@brewsite/charts`). All changes are additive. No existing exported symbol changes shape.

---

## 2. Key Design Decisions (carried verbatim from the feature note)

1. **CSS variables own the HTML overlay layer; TypeScript objects own the Three.js layer.** CSS custom properties injected by `EngineOverlayHost` apply exclusively to DOM content. Three.js material colors (node colors, series palette, metalness) are WebGL-only and are exclusively controlled by `DiagramTheme` / `ChartTheme` TypeScript objects baked at compile time. These are parallel mechanisms, not primary/fallback.

2. **`ThemeFamily` lives in `@brewsite/core`.** `DiagramThemeName` and `ChartThemeName` become type aliases for `ThemeFamily`. No new package is introduced. No existing union type changes members.

3. **Full player remount + `clearSceneTrackCache()` on polarity toggle (v1).** The `SceneTrack` is compiled once per scene set and bakes Three.js material tokens at compile time. Changing polarity requires recompilation, which is triggered by calling `clearSceneTrackCache()` and incrementing a React `key` prop on `SceneEngine`. Expected toggle latency: ~100–300ms. This is acceptable for a demo toggle button.

4. **v1 ships infrastructure + placeholder aesthetics.** The 6 new light/dark variant presets are structurally correct (`colorMode` is correct, types are correct) but use sibling theme constants as placeholders. Each carries a JSDoc `@internal` marker. Aesthetic authoring of all 12 variant presets is a tracked follow-on story.

5. **No breaking changes to the `theme` prop string union or `DiagramThemeName` DSL string.** The `theme="darkGlass"` prop on `<Diagram>` and chart elements continues to work exactly as today. `DIAGRAM_THEME_PAIRS` and `CHART_THEME_PAIRS` are programmatic registries only — they are not accessible via DSL string.

---

## 3. CSS Variable System Design

### 3.1 Naming Convention

All CSS custom properties injected by `EngineOverlayHost` use the `--brewsite-` prefix.

**Existing variables (unchanged):**
| Variable | Source | Value derivation |
|---|---|---|
| `--brewsite-font-family` | `theme.font.htmlFamily` | Direct string |
| `--brewsite-font-size-heading` | `theme.fontSize.heading` | `calc(1rem * {value})` |
| `--brewsite-font-size-body` | `theme.fontSize.body` | `calc(1rem * {value})` |
| `--brewsite-font-size-label` | `theme.fontSize.label` | `calc(1rem * {value})` |
| `--brewsite-font-size-caption` | `theme.fontSize.caption` | `calc(1rem * {value})` |
| `--brewsite-font-size-annotation` | `theme.fontSize.annotation` | `calc(1rem * {value})` |
| `--brewsite-color-mode` | `theme.colorMode` | `'dark'` or `'light'` |
| `--brewsite-text-primary` | `theme.colorMode` | `'#ffffff'` (dark) or `'#111111'` (light) |
| `--brewsite-text-secondary` | `theme.colorMode` | `'rgba(255,255,255,0.6)'` (dark) or `'rgba(0,0,0,0.6)'` (light) |

**New variables added in this plan:**
| Variable | Source | Value derivation |
|---|---|---|
| `--brewsite-background-color` | `theme.background.fill` | If `fill.kind === 'color'`: `fill.value`. Else: `'#0a0a14'` (dark) or `'#f5f5f7'` (light) |
| `--brewsite-surface-elevated` | `theme.colorMode` | `'rgba(255,255,255,0.06)'` (dark) or `'rgba(0,0,0,0.04)'` (light) |
| `--brewsite-border-subtle` | `theme.colorMode` | `'rgba(255,255,255,0.12)'` (dark) or `'rgba(0,0,0,0.10)'` (light) |
| `--brewsite-radius-base` | Fixed | `'6px'` for all themes |

**Not in scope for v1:** `--brewsite-accent-1` through `--brewsite-accent-8` (open question 5.6 in note, deferred).

### 3.2 CSS Class Injection

`EngineOverlayHost` injects two additional CSS classes on its root `<div>` when a `SceneTheme` from `SCENE_THEME_PAIRS` is active:

- `.bw-theme-{family}` — e.g., `.bw-theme-darkGlass` — for theme-scoped CSS overrides
- `.bw-dark` or `.bw-light` — for polarity-scoped CSS overrides

**Family name derivation:** `EngineOverlayHost` resolves the family by reference-equality lookup through `SCENE_THEME_PAIRS`. No new props on `EngineOverlayHost` or fields on `SceneTheme` are required. Custom themes (not from `SCENE_THEME_PAIRS`) will not receive a `bw-theme-*` class; they still receive `.bw-dark`/`.bw-light` from `colorMode`.

```css
/* Consumer override pattern — no code change required */
.bw-theme-darkGlass {
  --brewsite-text-primary: #e0e8ff; /* override */
}
.bw-theme-darkGlass.bw-dark {
  --brewsite-background-color: #070b18;
}
.bw-theme-darkGlass.bw-light {
  --brewsite-background-color: #f5f7ff;
}
```

### 3.3 BackgroundLayer Note (No v1 Change)

`BackgroundLayer` reads its background color from the compiled `SceneTheme.background.fill` via inline style. It does NOT read `--brewsite-background-color`. Setting `--brewsite-background-color` via a CSS class override changes the CSS variable value available to overlay HTML descendants but does NOT change what `BackgroundLayer` renders. This is by design in v1 — refactoring `BackgroundLayer` to use the CSS variable is deferred. Document this in `EngineOverlayHost.tsx` JSDoc.

---

## 4. TypeScript API Changes

### 4.1 New Types in `packages/core/src/theme/types.ts`

Add these types to the END of the existing file. Do not modify any existing type.

```typescript
/**
 * Canonical theme family names. All six names have matching presets in
 * @brewsite/diagram (DiagramThemeName) and @brewsite/charts (ChartThemeName).
 *
 * ThemeFamily is the single source of truth for the cross-package theme name
 * vocabulary. DiagramThemeName and ChartThemeName are type aliases for this type.
 */
export type ThemeFamily =
  | 'darkGlass'
  | 'midnight'
  | 'neonCyber'
  | 'enterprise'
  | 'lightCanvas'
  | 'lightMinimal';

/**
 * Light or dark background polarity for a theme family.
 * 'dark'  = dark background, light text defaults.
 * 'light' = light background, dark text defaults.
 */
export type ThemePolarity = 'dark' | 'light';

/**
 * A light+dark pair of SceneTheme presets for a single ThemeFamily.
 * Used as the value type in SCENE_THEME_PAIRS.
 */
export type SceneThemePair = {
  readonly dark: SceneTheme;
  readonly light: SceneTheme;
};
```

### 4.2 New Exports in `packages/core/src/theme/presets.ts`

Add six new `SceneTheme` preset constants (placeholder quality) and `SCENE_THEME_PAIRS`:

```typescript
// ─── Light variants of dark themes (PLACEHOLDER — @internal) ─────────────────

/**
 * Light-background variant of the darkGlass theme family.
 * @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.
 */
export const darkGlassLightSceneTheme: SceneTheme = {
  colorMode: 'light',
  font: { htmlFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
  background: { fill: { kind: 'color', value: '#f5f7ff' } },  // blue-tinted white
};

/**
 * Light-background variant of the midnight theme family.
 * @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.
 */
export const midnightLightSceneTheme: SceneTheme = {
  colorMode: 'light',
  font: { htmlFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
  background: { fill: { kind: 'color', value: '#faf8f5' } },  // warm cream
};

/**
 * Light-background variant of the neonCyber theme family.
 * @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.
 */
export const neonCyberLightSceneTheme: SceneTheme = {
  colorMode: 'light',
  font: { htmlFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
  background: { fill: { kind: 'color', value: '#f0f0ff' } },  // pale violet-white
};

/**
 * Light-background variant of the enterprise theme family.
 * @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.
 */
export const enterpriseLightSceneTheme: SceneTheme = {
  colorMode: 'light',
  font: { htmlFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
  background: { fill: { kind: 'color', value: '#f0f4fa' } },  // cool slate-white
};

// ─── Dark variants of light themes (PLACEHOLDER — @internal) ─────────────────

/**
 * Dark-background variant of the lightCanvas theme family.
 * @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.
 */
export const lightCanvasDarkSceneTheme: SceneTheme = {
  colorMode: 'dark',
  font: { htmlFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
  background: { fill: { kind: 'color', value: '#121820' } },  // cool dark
};

/**
 * Dark-background variant of the lightMinimal theme family.
 * @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.
 */
export const lightMinimalDarkSceneTheme: SceneTheme = {
  colorMode: 'dark',
  font: { htmlFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
  background: { fill: { kind: 'color', value: '#0f0f0f' } },  // near-black
};

// ─── SCENE_THEME_PAIRS registry ───────────────────────────────────────────────

import type { ThemeFamily, SceneThemePair } from './types';

/**
 * Registry of SceneTheme presets keyed by ThemeFamily and ThemePolarity.
 * Each entry's dark and light values have their `colorMode` set correctly.
 *
 * Usage:
 * ```ts
 * const sceneTheme = SCENE_THEME_PAIRS['darkGlass']['dark']; // SceneTheme
 * ```
 *
 * Light variants of the four dark themes and dark variants of the two light themes
 * are aesthetic placeholders in v1 (marked @internal on their preset constants).
 */
export const SCENE_THEME_PAIRS: Record<ThemeFamily, SceneThemePair> = {
  darkGlass:    { dark: darkGlassSceneTheme,    light: darkGlassLightSceneTheme },
  midnight:     { dark: midnightSceneTheme,     light: midnightLightSceneTheme },
  neonCyber:    { dark: neonCyberSceneTheme,    light: neonCyberLightSceneTheme },
  enterprise:   { dark: enterpriseSceneTheme,   light: enterpriseLightSceneTheme },
  lightCanvas:  { dark: lightCanvasDarkSceneTheme, light: lightCanvasSceneTheme },
  lightMinimal: { dark: lightMinimalDarkSceneTheme, light: lightMinimalSceneTheme },
} as const;
```

**Important:** The `SCENE_THEME_PAIRS` import of `ThemeFamily` and `SceneThemePair` from `./types` must be placed at the top of `presets.ts`, after the existing `import type { SceneTheme } from './types'` import.

### 4.3 `SceneTheme` — No Changes

`SceneTheme` in `types.ts` gains NO new fields. The family name is derived at runtime by reference lookup, not stored on the type. This keeps `SceneTheme` as a pure token bag.

### 4.4 `EngineOverlayHost` — Class Injection Logic

No new props on `EngineOverlayHost`. The `.bw-theme-{family}` class is derived internally:

```typescript
// In EngineOverlayHost.tsx (implementation detail, not exported)
import { SCENE_THEME_PAIRS } from '../theme';
import type { ThemeFamily } from '../theme';

function resolveThemeFamily(theme: SceneTheme): ThemeFamily | undefined {
  for (const [family, pair] of Object.entries(SCENE_THEME_PAIRS) as Array<[ThemeFamily, { dark: SceneTheme; light: SceneTheme }]>) {
    if (pair.dark === theme || pair.light === theme) return family as ThemeFamily;
  }
  return undefined;
}
```

Works by object reference equality. Theme objects from `SCENE_THEME_PAIRS` resolve correctly. Custom spread themes (`{ ...darkGlassSceneTheme, ... }`) will not resolve — they get `.bw-dark`/`.bw-light` but no `.bw-theme-*` class. This is expected behavior.

### 4.5 `DiagramThemeName` — Becomes a Type Alias

In `packages/diagram/src/elements/diagram/types.ts`:

```typescript
// Before:
export type DiagramThemeName =
  | 'darkGlass'
  | 'midnight'
  | 'neonCyber'
  | 'enterprise'
  | 'lightCanvas'
  | 'lightMinimal';

// After:
import type { ThemeFamily } from '@brewsite/core';

/**
 * Canonical diagram theme preset names.
 * This is a type alias for ThemeFamily from @brewsite/core.
 * Maintained as a named export for backward compatibility.
 * All six names have matching presets in @brewsite/charts (ChartThemeName).
 */
export type DiagramThemeName = ThemeFamily;
```

### 4.6 `ChartThemeName` — Becomes a Type Alias

In `packages/charts/src/themes/types.ts`:

```typescript
// Before:
export type ChartThemeName =
  | 'darkGlass'
  | 'midnight'
  | 'neonCyber'
  | 'enterprise'
  | 'lightCanvas'
  | 'lightMinimal';

// After:
import type { ThemeFamily } from '@brewsite/core';

/**
 * Supported chart theme preset names.
 * This is a type alias for ThemeFamily from @brewsite/core.
 * Maintained as a named export for backward compatibility.
 */
export type ChartThemeName = ThemeFamily;
```

### 4.7 `DIAGRAM_THEME_PAIRS` — New Registry in `@brewsite/diagram`

Added to `packages/diagram/src/elements/diagram/themes/index.ts`:

```typescript
import type { ThemeFamily } from '@brewsite/core';
import { SCENE_THEME_PAIRS } from '@brewsite/core';
import type { DiagramTheme } from '../types';

export type DiagramThemePair = {
  readonly dark: DiagramTheme;
  readonly light: DiagramTheme;
};

// Internal: build pre-wired pair entries
const _darkGlassDark: DiagramTheme  = { ...darkGlassTheme,    sceneTheme: SCENE_THEME_PAIRS.darkGlass.dark };
const _darkGlassLight: DiagramTheme = { ...darkGlassLightTheme, sceneTheme: SCENE_THEME_PAIRS.darkGlass.light };
// ... (one pair per family — see Stream C spec below)

export const DIAGRAM_THEME_PAIRS: Record<ThemeFamily, DiagramThemePair> = {
  darkGlass:    { dark: _darkGlassDark,    light: _darkGlassLight },
  midnight:     { dark: _midnightDark,     light: _midnightLight },
  neonCyber:    { dark: _neonCyberDark,    light: _neonCyberLight },
  enterprise:   { dark: _enterpriseDark,   light: _enterpriseLight },
  lightCanvas:  { dark: _lightCanvasDark,  light: _lightCanvasLight },
  lightMinimal: { dark: _lightMinimalDark, light: _lightMinimalLight },
} as const;
```

Each `_xxx` intermediate uses a spread of the preset constant (not `mergeTheme` — `mergeTheme` is for deep override merging; spread is appropriate for adding a single top-level field). The `sceneTheme` field is injected from `SCENE_THEME_PAIRS` so consumers do not need to wire it manually.

### 4.8 `CHART_THEME_PAIRS` — New Registry in `@brewsite/charts`

Analogous to `DIAGRAM_THEME_PAIRS`. Added to `packages/charts/src/themes/index.ts`.

---

## 5. Work Streams

**Dependency order:**
- Stream A must complete before B, C, D can start.
- Streams B, C, D are fully independent of each other and can run in parallel.
- Stream E must wait for A, B, C, and D to all be complete before starting.

```
A ──→ B ─┐
   └──→ C ─┼──→ E
   └──→ D ─┘
```

---

### Stream A — Dev-A: Core theme types + ThemeFamily registry

**Owner:** Dev-A
**Touches exactly these files (no other stream touches these):**
- `packages/core/src/theme/types.ts` — **MODIFY**
- `packages/core/src/theme/presets.ts` — **MODIFY**
- `packages/core/src/theme/index.ts` — **MODIFY**
- `packages/core/src/index.ts` — **MODIFY**
- `packages/core/src/theme/__tests__/presets.test.ts` — **MODIFY**

**Step-by-step implementation:**

**Step A.1 — `packages/core/src/theme/types.ts`**

Add the three new types from Section 4.1 to the END of the file, after the existing `SceneTheme` type. Do not modify any existing type declaration.

Required addition at end of file:

```typescript
/**
 * Canonical theme family names. All six names have matching presets in
 * @brewsite/diagram (DiagramThemeName) and @brewsite/charts (ChartThemeName).
 * This type is the single source of truth for the cross-package theme name vocabulary.
 */
export type ThemeFamily =
  | 'darkGlass'
  | 'midnight'
  | 'neonCyber'
  | 'enterprise'
  | 'lightCanvas'
  | 'lightMinimal';

/** Light or dark background polarity for a theme variant. */
export type ThemePolarity = 'dark' | 'light';

/**
 * A light+dark pair of SceneTheme presets for a single ThemeFamily.
 * The entry type for SCENE_THEME_PAIRS.
 */
export type SceneThemePair = {
  readonly dark: SceneTheme;
  readonly light: SceneTheme;
};
```

**Step A.2 — `packages/core/src/theme/presets.ts`**

1. Add the import for the new types at the top of the file (after the existing `import type { SceneTheme } from './types';`):
   ```typescript
   import type { ThemeFamily, SceneThemePair } from './types';
   ```

2. Add the six placeholder preset constants at the END of the file, after the existing six named presets. Use exactly the values from Section 4.2. Each must carry the `@internal` JSDoc.

3. Add `SCENE_THEME_PAIRS` at the END of the file, after the placeholder presets. Use exactly the definition from Section 4.2.

**Step A.3 — `packages/core/src/theme/index.ts`**

Add the new exports. The final file must export everything listed here (existing exports remain, new ones added):

```typescript
// Public exports for the theme module.
export type {
  SceneTheme,
  SceneColorMode,
  SceneThemeFontTokens,
  SceneThemeFontSizeScale,
  SceneThemeBackgroundFill,
  SceneThemeBackgroundEffects,
  SceneThemeBackground,
  // NEW:
  ThemeFamily,
  ThemePolarity,
  SceneThemePair,
} from './types';
export { ThemeContext, useTheme } from './ThemeContext';
export {
  darkSceneTheme,
  lightSceneTheme,
  darkGlassSceneTheme,
  midnightSceneTheme,
  neonCyberSceneTheme,
  enterpriseSceneTheme,
  lightCanvasSceneTheme,
  lightMinimalSceneTheme,
  // NEW placeholder variants:
  darkGlassLightSceneTheme,
  midnightLightSceneTheme,
  neonCyberLightSceneTheme,
  enterpriseLightSceneTheme,
  lightCanvasDarkSceneTheme,
  lightMinimalDarkSceneTheme,
  // NEW registry:
  SCENE_THEME_PAIRS,
} from './presets';
```

**Step A.4 — `packages/core/src/index.ts`**

The `packages/core/src/index.ts` already has `export * from './theme'`. Since `theme/index.ts` now exports `ThemeFamily`, `ThemePolarity`, `SceneThemePair`, and `SCENE_THEME_PAIRS`, they are automatically re-exported from `@brewsite/core`. **No change required to `packages/core/src/index.ts`.**

Verify by running `pnpm --filter @brewsite/core typecheck` after completing Steps A.1–A.3. It must pass with zero errors.

**Step A.5 — `packages/core/src/theme/__tests__/presets.test.ts`**

Open the existing test file and add the following test cases. Read the existing file first to understand its structure and add tests in the same style.

Required test cases:

```typescript
import { SCENE_THEME_PAIRS, darkGlassSceneTheme, lightCanvasSceneTheme,
  darkGlassLightSceneTheme, lightCanvasDarkSceneTheme } from '../presets';
import type { ThemeFamily } from '../types';

describe('SCENE_THEME_PAIRS', () => {
  const EXPECTED_FAMILIES: ThemeFamily[] = [
    'darkGlass', 'midnight', 'neonCyber', 'enterprise', 'lightCanvas', 'lightMinimal',
  ];

  it('contains all six theme families', () => {
    for (const family of EXPECTED_FAMILIES) {
      expect(SCENE_THEME_PAIRS[family]).toBeDefined();
    }
  });

  it('each pair has a dark entry with colorMode === "dark"', () => {
    for (const family of EXPECTED_FAMILIES) {
      expect(SCENE_THEME_PAIRS[family].dark.colorMode).toBe('dark');
    }
  });

  it('each pair has a light entry with colorMode === "light"', () => {
    for (const family of EXPECTED_FAMILIES) {
      expect(SCENE_THEME_PAIRS[family].light.colorMode).toBe('light');
    }
  });

  it('dark entry for darkGlass is the existing darkGlassSceneTheme by reference', () => {
    expect(SCENE_THEME_PAIRS['darkGlass'].dark).toBe(darkGlassSceneTheme);
  });

  it('light entry for lightCanvas is the existing lightCanvasSceneTheme by reference', () => {
    expect(SCENE_THEME_PAIRS['lightCanvas'].light).toBe(lightCanvasSceneTheme);
  });

  it('light entry for darkGlass is the new darkGlassLightSceneTheme by reference', () => {
    expect(SCENE_THEME_PAIRS['darkGlass'].light).toBe(darkGlassLightSceneTheme);
  });

  it('dark entry for lightCanvas is the new lightCanvasDarkSceneTheme by reference', () => {
    expect(SCENE_THEME_PAIRS['lightCanvas'].dark).toBe(lightCanvasDarkSceneTheme);
  });

  it('no entry in the registry is undefined or null', () => {
    for (const family of EXPECTED_FAMILIES) {
      expect(SCENE_THEME_PAIRS[family].dark).not.toBeNull();
      expect(SCENE_THEME_PAIRS[family].light).not.toBeNull();
    }
  });
});
```

Run `pnpm --filter @brewsite/core test` to verify all tests pass.

---

### Stream B — Dev-B: CSS injection system + EngineOverlayHost

**Owner:** Dev-B
**Prerequisite:** Stream A must be complete before starting this stream.
**Touches exactly these files (no other stream touches these):**
- `packages/core/src/player/EngineOverlayHost.tsx` — **MODIFY**
- `packages/core/src/player/__tests__/EngineOverlayHost.test.tsx` — **MODIFY** (file already exists; add new test cases)

**Step-by-step implementation:**

**Step B.1 — Read the existing `EngineOverlayHost.tsx`**

Read the full file before making any changes. The current implementation at `packages/core/src/player/EngineOverlayHost.tsx` injects CSS variables via inline `style` on the root `<div>`. The current injection uses `themeStyles` as a `CSSProperties` object cast. Your changes extend this pattern.

**Step B.2 — Add `resolveThemeFamily` utility function**

Add this function inside `EngineOverlayHost.tsx`, ABOVE the `EngineOverlayHost` component function. It must not be exported (it is an implementation detail):

```typescript
import { SCENE_THEME_PAIRS } from '../theme';
import type { ThemeFamily } from '../theme';

/**
 * Resolves the ThemeFamily name for a SceneTheme by reference equality lookup
 * through SCENE_THEME_PAIRS. Returns undefined for custom (non-registry) themes.
 * O(12) lookup — 6 families × 2 polarities.
 */
function resolveThemeFamily(theme: SceneTheme): ThemeFamily | undefined {
  for (const [family, pair] of Object.entries(SCENE_THEME_PAIRS) as Array<[string, { dark: SceneTheme; light: SceneTheme }]>) {
    if (pair.dark === theme || pair.light === theme) {
      return family as ThemeFamily;
    }
  }
  return undefined;
}
```

**Step B.3 — Expand `themeStyles` in `EngineOverlayHost`**

Locate the existing `themeStyles` object inside `EngineOverlayHost`. Replace it with the following expanded version that includes the four new CSS variables:

```typescript
const themeStyles = theme ? ({
  '--brewsite-font-family':          theme.font.htmlFamily,
  fontFamily:                        'var(--brewsite-font-family)',
  '--brewsite-font-size-heading':    `calc(1rem * ${theme.fontSize.heading})`,
  '--brewsite-font-size-body':       `calc(1rem * ${theme.fontSize.body})`,
  '--brewsite-font-size-label':      `calc(1rem * ${theme.fontSize.label})`,
  '--brewsite-font-size-caption':    `calc(1rem * ${theme.fontSize.caption})`,
  '--brewsite-font-size-annotation': `calc(1rem * ${theme.fontSize.annotation})`,
  '--brewsite-color-mode':           theme.colorMode,
  '--brewsite-text-primary':
    theme.colorMode === 'dark' ? '#ffffff' : '#111111',
  '--brewsite-text-secondary':
    theme.colorMode === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
  // NEW in theming-overhaul:
  '--brewsite-background-color':
    theme.background?.fill?.kind === 'color'
      ? theme.background.fill.value
      : (theme.colorMode === 'dark' ? '#0a0a14' : '#f5f5f7'),
  '--brewsite-surface-elevated':
    theme.colorMode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  '--brewsite-border-subtle':
    theme.colorMode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
  '--brewsite-radius-base': '6px',
} as CSSProperties) : {};
```

**Step B.4 — Add CSS class injection to the root div**

In the JSX returned by `EngineOverlayHost`, the root `<div>` currently uses the `className` prop directly. Replace this with a computed class string:

Add this computation inside `EngineOverlayHost`, AFTER deriving `theme` from `useTheme()` and BEFORE the return statement:

```typescript
// Compute theme class names for CSS-based overlay overrides.
// .bw-theme-{family} enables family-scoped CSS overrides.
// .bw-dark / .bw-light enables polarity-scoped CSS overrides.
const themeFamily = theme ? resolveThemeFamily(theme) : undefined;
const computedClassName = [
  themeFamily ? `bw-theme-${themeFamily}` : undefined,
  theme ? (theme.colorMode === 'dark' ? 'bw-dark' : 'bw-light') : undefined,
  className,
].filter(Boolean).join(' ') || undefined;
```

In the root `<div>`, replace `className={className}` with `className={computedClassName}`.

**Pre-condition check:** Verify that `EngineOverlayHostProps` includes a `className?: string` prop. The current codebase already declares it. If for any reason it is absent, add `className?: string` among the existing optional layout props before proceeding.

**Step B.5 — Add JSDoc comment to `EngineOverlayHostProps`**

Add the following JSDoc to `EngineOverlayHostProps` interface, documenting the new CSS classes and variables:

```typescript
/**
 * Host element for scene overlay content rendered above the Three.js canvas.
 *
 * When a SceneTheme is active via ThemeContext (from EngineProvider.sceneTheme),
 * this component:
 * - Injects CSS custom properties: --brewsite-font-family, --brewsite-font-size-*,
 *   --brewsite-color-mode, --brewsite-text-primary, --brewsite-text-secondary,
 *   --brewsite-background-color, --brewsite-surface-elevated, --brewsite-border-subtle,
 *   --brewsite-radius-base
 * - Adds CSS classes: bw-theme-{family} (when theme is from SCENE_THEME_PAIRS),
 *   bw-dark or bw-light (from colorMode)
 *
 * NOTE: --brewsite-background-color is for HTML overlay content only.
 * BackgroundLayer reads SceneTheme.background.fill directly and does NOT consume
 * this variable. Overriding --brewsite-background-color via CSS changes overlay
 * child styling but not the Three.js scene background.
 *
 * Consumers may override CSS variables by targeting the injected classes:
 *   .bw-theme-darkGlass { --brewsite-text-primary: #e0e8ff; }
 */
```

**Step B.6 — Modify `packages/core/src/player/__tests__/EngineOverlayHost.test.tsx`**

**This file already exists.** Read it in full before making any changes. It uses `@testing-library/react`, the `EngineContext.Provider` wrapper pattern (not `vi.mock`), and a `makeEngine()` + `renderHost()` helper pair. Add the new test cases to this existing file in the same style.

**Do NOT add any `vi.mock` calls.** The existing pattern provides the engine context via `<EngineContext.Provider value={engine}>`. This is the project's interface-conforming test double pattern — a plain object that satisfies the fields `EngineOverlayHost` reads (`frameState.sceneId` and `sceneOverlays`), cast via `as unknown as UseSceneEngineResult`. Do not change the existing `makeEngine()` helper.

The existing `renderHost()` helper accepts an optional `theme` parameter and wraps appropriately with `ThemeContext.Provider`. Extend `renderHost` to also accept an optional `className` prop so tests can verify class-name composition:

```typescript
// Extend renderHost options type to include className:
const renderHost = (options: {
  engine?: UseSceneEngineResult;
  transition?: React.ComponentProps<typeof EngineOverlayHost>['overlayTransition'];
  theme?: SceneTheme | null;
  passthroughPointerEvents?: boolean;
  className?: string;  // ADD THIS
} = {}) => {
  const {
    engine = makeEngine('scene-a'),
    transition,
    theme,
    passthroughPointerEvents,
    className,  // ADD THIS
  } = options;

  const inner = (
    <EngineContext.Provider value={engine}>
      <EngineOverlayHost
        overlayTransition={transition}
        passthroughPointerEvents={passthroughPointerEvents}
        className={className}  // ADD THIS
      />
    </EngineContext.Provider>
  );

  return render(
    theme !== undefined
      ? <ThemeContext.Provider value={theme}>{inner}</ThemeContext.Provider>
      : inner,
  );
};
```

Add the following imports at the top of the existing file (alongside existing imports):

```typescript
import { darkGlassSceneTheme, lightCanvasSceneTheme, SCENE_THEME_PAIRS } from '../../theme/presets';
```

Add two new `describe` blocks at the END of the existing test file, after the closing `});` of the existing `describe('EngineOverlayHost', ...)` block:

```typescript
describe('EngineOverlayHost — new CSS variables (theming-overhaul)', () => {
  afterEach(() => { cleanup(); });

  it('injects --brewsite-background-color from theme.background.fill.value for color fills', () => {
    // darkGlassSceneTheme has background.fill = { kind: 'color', value: '#070b18' }
    const view = renderHost({ theme: darkGlassSceneTheme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.getPropertyValue('--brewsite-background-color')).toBe('#070b18');
  });

  it('injects --brewsite-background-color colorMode fallback when theme has no background fill', () => {
    const theme: SceneTheme = makeTestTheme({ colorMode: 'dark', background: undefined });
    const view = renderHost({ theme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.getPropertyValue('--brewsite-background-color')).toBe('#0a0a14');
  });

  it('injects --brewsite-background-color light fallback when colorMode is light and no fill', () => {
    const theme: SceneTheme = makeTestTheme({ colorMode: 'light', background: undefined });
    const view = renderHost({ theme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.getPropertyValue('--brewsite-background-color')).toBe('#f5f5f7');
  });

  it('injects --brewsite-radius-base as 6px for any theme', () => {
    const view = renderHost({ theme: darkGlassSceneTheme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.getPropertyValue('--brewsite-radius-base')).toBe('6px');
  });

  it('injects --brewsite-surface-elevated with dark rgba value for dark colorMode', () => {
    const view = renderHost({ theme: darkGlassSceneTheme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.getPropertyValue('--brewsite-surface-elevated')).toBe('rgba(255,255,255,0.06)');
  });

  it('injects --brewsite-surface-elevated with light rgba value for light colorMode', () => {
    const view = renderHost({ theme: lightCanvasSceneTheme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.getPropertyValue('--brewsite-surface-elevated')).toBe('rgba(0,0,0,0.04)');
  });

  it('injects --brewsite-border-subtle with dark rgba value for dark colorMode', () => {
    const view = renderHost({ theme: darkGlassSceneTheme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.getPropertyValue('--brewsite-border-subtle')).toBe('rgba(255,255,255,0.12)');
  });

  it('does NOT inject new variables when theme is null', () => {
    const view = renderHost({ theme: null });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.getPropertyValue('--brewsite-background-color')).toBe('');
    expect(overlay.style.getPropertyValue('--brewsite-radius-base')).toBe('');
  });
});

describe('EngineOverlayHost — CSS class injection (theming-overhaul)', () => {
  afterEach(() => { cleanup(); });

  it('adds bw-theme-darkGlass class when darkGlassSceneTheme is active (registry match)', () => {
    const view = renderHost({ theme: darkGlassSceneTheme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.classList.contains('bw-theme-darkGlass')).toBe(true);
  });

  it('adds bw-dark class for dark colorMode', () => {
    const view = renderHost({ theme: darkGlassSceneTheme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.classList.contains('bw-dark')).toBe(true);
  });

  it('adds bw-light class for light colorMode', () => {
    const view = renderHost({ theme: lightCanvasSceneTheme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.classList.contains('bw-light')).toBe(true);
  });

  it('adds bw-theme-lightCanvas class for lightCanvasSceneTheme (registry match)', () => {
    const view = renderHost({ theme: lightCanvasSceneTheme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.classList.contains('bw-theme-lightCanvas')).toBe(true);
  });

  it('does NOT add bw-theme-* class for a custom spread theme not in registry', () => {
    // Object spread creates a new reference — resolveThemeFamily returns undefined.
    const customTheme: SceneTheme = { ...darkGlassSceneTheme };
    const view = renderHost({ theme: customTheme });
    const overlay = view.container.firstChild as HTMLDivElement;
    const hasThemeClass = [...overlay.classList].some(c => c.startsWith('bw-theme-'));
    expect(hasThemeClass).toBe(false);
  });

  it('custom spread theme still gets bw-dark from colorMode', () => {
    const customTheme: SceneTheme = { ...darkGlassSceneTheme };
    const view = renderHost({ theme: customTheme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.classList.contains('bw-dark')).toBe(true);
  });

  it('preserves consumer-provided className alongside injected theme classes', () => {
    const view = renderHost({ theme: darkGlassSceneTheme, className: 'my-overlay' });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.classList.contains('my-overlay')).toBe(true);
    expect(overlay.classList.contains('bw-theme-darkGlass')).toBe(true);
    expect(overlay.classList.contains('bw-dark')).toBe(true);
  });

  it('adds no bw-* classes when theme is null', () => {
    const view = renderHost({ theme: null });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect([...overlay.classList].some(c => c.startsWith('bw-'))).toBe(false);
  });

  it('the light polarity entry for darkGlass family also resolves to bw-theme-darkGlass', () => {
    // SCENE_THEME_PAIRS.darkGlass.light is in the registry by reference.
    const view = renderHost({ theme: SCENE_THEME_PAIRS.darkGlass.light });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.classList.contains('bw-theme-darkGlass')).toBe(true);
    expect(overlay.classList.contains('bw-light')).toBe(true);
  });
});
```

Run `pnpm --filter @brewsite/core test` after completing this stream.

---

### Stream C — Dev-C: Diagram theme pairs + light variant presets

**Owner:** Dev-C
**Prerequisite:** Stream A must be complete before starting this stream.
**Touches exactly these files (no other stream touches these):**
- `packages/diagram/src/elements/diagram/themes/darkGlassLight.ts` — **CREATE**
- `packages/diagram/src/elements/diagram/themes/midnightLight.ts` — **CREATE**
- `packages/diagram/src/elements/diagram/themes/neonCyberLight.ts` — **CREATE**
- `packages/diagram/src/elements/diagram/themes/enterpriseLight.ts` — **CREATE**
- `packages/diagram/src/elements/diagram/themes/lightCanvasDark.ts` — **CREATE**
- `packages/diagram/src/elements/diagram/themes/lightMinimalDark.ts` — **CREATE**
- `packages/diagram/src/elements/diagram/themes/index.ts` — **MODIFY**
- `packages/diagram/src/elements/diagram/types.ts` — **MODIFY**
- `packages/diagram/src/elements/diagram/themes/__tests__/index.test.ts` — **MODIFY**

**Step-by-step implementation:**

**Step C.1 — Read existing files first**

Before writing any code, read these files in full:
- `packages/diagram/src/elements/diagram/themes/darkGlass.ts`
- `packages/diagram/src/elements/diagram/themes/lightCanvas.ts`
- `packages/diagram/src/elements/diagram/themes/index.ts`
- `packages/diagram/src/elements/diagram/types.ts` (first 80 lines, focus on `DiagramThemeName`)

**Step C.2 — Create six placeholder light/dark variant theme files**

Each new file follows this exact pattern. All six files use `lightCanvasTheme` as the placeholder body for dark-theme light variants, and `darkGlassTheme` as the placeholder body for light-theme dark variants. The `sceneTheme` field is NOT set on these preset constants — it is set at registry construction time in `index.ts`.

**`packages/diagram/src/elements/diagram/themes/darkGlassLight.ts`:**
```typescript
// Dark Glass theme — light-background variant (PLACEHOLDER).
// @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.

// SHARED ACCENT PALETTE — must match packages/charts/src/themes/darkGlassLight.ts
// Placeholder uses lightCanvas palette: '#3355cc', '#1a9966', '#cc3355', '#cc8800', '#6644bb'

import type { DiagramTheme } from '../types';
import { lightCanvasTheme } from './lightCanvas';

/**
 * Light-background placeholder variant of the darkGlass theme family.
 * @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.
 * Uses lightCanvasTheme as structural stand-in; aesthetics are incorrect for darkGlass family.
 */
export const darkGlassLightTheme: DiagramTheme = {
  ...lightCanvasTheme,
} as const;
```

**`packages/diagram/src/elements/diagram/themes/midnightLight.ts`:**
```typescript
// Midnight theme — light-background variant (PLACEHOLDER).
// @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.

// SHARED ACCENT PALETTE — must match packages/charts/src/themes/midnightLight.ts
// Placeholder uses lightCanvas palette: '#3355cc', '#1a9966', '#cc3355', '#cc8800', '#6644bb'

import type { DiagramTheme } from '../types';
import { lightCanvasTheme } from './lightCanvas';

/**
 * Light-background placeholder variant of the midnight theme family.
 * @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.
 */
export const midnightLightTheme: DiagramTheme = {
  ...lightCanvasTheme,
} as const;
```

**`packages/diagram/src/elements/diagram/themes/neonCyberLight.ts`:**
```typescript
// NeonCyber theme — light-background variant (PLACEHOLDER).
// @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.

import type { DiagramTheme } from '../types';
import { lightCanvasTheme } from './lightCanvas';

/**
 * Light-background placeholder variant of the neonCyber theme family.
 * @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.
 */
export const neonCyberLightTheme: DiagramTheme = {
  ...lightCanvasTheme,
} as const;
```

**`packages/diagram/src/elements/diagram/themes/enterpriseLight.ts`:**
```typescript
// Enterprise theme — light-background variant (PLACEHOLDER).
// @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.

import type { DiagramTheme } from '../types';
import { lightCanvasTheme } from './lightCanvas';

/**
 * Light-background placeholder variant of the enterprise theme family.
 * @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.
 */
export const enterpriseLightTheme: DiagramTheme = {
  ...lightCanvasTheme,
} as const;
```

**`packages/diagram/src/elements/diagram/themes/lightCanvasDark.ts`:**
```typescript
// Light Canvas theme — dark-background variant (PLACEHOLDER).
// @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.

// SHARED ACCENT PALETTE — must match packages/charts/src/themes/lightCanvasDark.ts
// Placeholder uses darkGlass palette: '#4455aa', '#2266bb', '#7744cc', '#1188aa', '#335588'

import type { DiagramTheme } from '../types';
import { darkGlassTheme } from './darkGlass';

/**
 * Dark-background placeholder variant of the lightCanvas theme family.
 * @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.
 */
export const lightCanvasDarkTheme: DiagramTheme = {
  ...darkGlassTheme,
} as const;
```

**`packages/diagram/src/elements/diagram/themes/lightMinimalDark.ts`:**
```typescript
// Light Minimal theme — dark-background variant (PLACEHOLDER).
// @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.

import type { DiagramTheme } from '../types';
import { darkGlassTheme } from './darkGlass';

/**
 * Dark-background placeholder variant of the lightMinimal theme family.
 * @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.
 */
export const lightMinimalDarkTheme: DiagramTheme = {
  ...darkGlassTheme,
} as const;
```

**Step C.3 — Update `packages/diagram/src/elements/diagram/types.ts`**

Locate the `DiagramThemeName` type declaration. Replace it with the type alias:

```typescript
// BEFORE (lines to find and replace):
export type DiagramThemeName =
  | 'darkGlass'
  | 'midnight'
  | 'neonCyber'
  | 'enterprise'
  | 'lightCanvas'
  | 'lightMinimal';

// AFTER:
import type { ThemeFamily } from '@brewsite/core';

/**
 * Canonical diagram theme preset names.
 * Type alias for ThemeFamily from @brewsite/core. Maintained for backward compatibility.
 * All six names have matching presets in @brewsite/charts (ChartThemeName).
 */
export type DiagramThemeName = ThemeFamily;
```

Important: the `import type { ThemeFamily }` line must be added near the top of `types.ts` with the other imports, not inline with the type alias. Check the existing imports in `types.ts` and add it alongside other `@brewsite/core` imports (line 4 currently has `import type { InputActionSpec, SceneTheme, NVSRect } from '@brewsite/core'`). Update that import line to include `ThemeFamily`:

```typescript
import type { InputActionSpec, SceneTheme, NVSRect, ThemeFamily } from '@brewsite/core';
```

Then remove the explicit union body from `DiagramThemeName` and replace with `export type DiagramThemeName = ThemeFamily;`.

**Step C.4 — Update `packages/diagram/src/elements/diagram/themes/index.ts`**

This is the main registry file. Add all new exports and `DIAGRAM_THEME_PAIRS`. The final file must be:

```typescript
// Barrel re-export for all built-in DiagramTheme presets and theme utilities.

export { darkGlassTheme }      from './darkGlass';
export { midnightTheme }       from './midnight';
export { neonCyberTheme }      from './neonCyber';
export { enterpriseTheme }     from './enterprise';
export { lightCanvasTheme }    from './lightCanvas';
export { lightMinimalTheme }   from './lightMinimal';
// NEW placeholder variant presets:
export { darkGlassLightTheme }   from './darkGlassLight';
export { midnightLightTheme }    from './midnightLight';
export { neonCyberLightTheme }   from './neonCyberLight';
export { enterpriseLightTheme }  from './enterpriseLight';
export { lightCanvasDarkTheme }  from './lightCanvasDark';
export { lightMinimalDarkTheme } from './lightMinimalDark';
export { mergeTheme, withColorMode } from './mergeTheme';

import { darkGlassTheme }      from './darkGlass';
import { midnightTheme }       from './midnight';
import { neonCyberTheme }      from './neonCyber';
import { enterpriseTheme }     from './enterprise';
import { lightCanvasTheme }    from './lightCanvas';
import { lightMinimalTheme }   from './lightMinimal';
import { darkGlassLightTheme }   from './darkGlassLight';
import { midnightLightTheme }    from './midnightLight';
import { neonCyberLightTheme }   from './neonCyberLight';
import { enterpriseLightTheme }  from './enterpriseLight';
import { lightCanvasDarkTheme }  from './lightCanvasDark';
import { lightMinimalDarkTheme } from './lightMinimalDark';

import type { DiagramThemeName, DiagramTheme } from '../types';
import type { ThemeFamily } from '@brewsite/core';
import { SCENE_THEME_PAIRS } from '@brewsite/core';

/** All built-in diagram theme presets, keyed by name. Unchanged from pre-overhaul. */
export const DIAGRAM_THEMES: Record<DiagramThemeName, DiagramTheme> = {
  darkGlass:    darkGlassTheme,
  midnight:     midnightTheme,
  neonCyber:    neonCyberTheme,
  enterprise:   enterpriseTheme,
  lightCanvas:  lightCanvasTheme,
  lightMinimal: lightMinimalTheme,
} as const;

/** Pair type for DIAGRAM_THEME_PAIRS entries. */
export type DiagramThemePair = {
  readonly dark: DiagramTheme;
  readonly light: DiagramTheme;
};

// Internal pair entries — spread preset + inject pre-wired sceneTheme from SCENE_THEME_PAIRS.
// Using spread (not mergeTheme) because sceneTheme is a top-level DiagramTheme field.
const _darkGlassDark: DiagramTheme    = { ...darkGlassTheme,    sceneTheme: SCENE_THEME_PAIRS.darkGlass.dark };
const _darkGlassLight: DiagramTheme   = { ...darkGlassLightTheme, sceneTheme: SCENE_THEME_PAIRS.darkGlass.light };
const _midnightDark: DiagramTheme     = { ...midnightTheme,     sceneTheme: SCENE_THEME_PAIRS.midnight.dark };
const _midnightLight: DiagramTheme    = { ...midnightLightTheme, sceneTheme: SCENE_THEME_PAIRS.midnight.light };
const _neonCyberDark: DiagramTheme    = { ...neonCyberTheme,    sceneTheme: SCENE_THEME_PAIRS.neonCyber.dark };
const _neonCyberLight: DiagramTheme   = { ...neonCyberLightTheme, sceneTheme: SCENE_THEME_PAIRS.neonCyber.light };
const _enterpriseDark: DiagramTheme   = { ...enterpriseTheme,   sceneTheme: SCENE_THEME_PAIRS.enterprise.dark };
const _enterpriseLight: DiagramTheme  = { ...enterpriseLightTheme, sceneTheme: SCENE_THEME_PAIRS.enterprise.light };
const _lightCanvasDark: DiagramTheme  = { ...lightCanvasDarkTheme, sceneTheme: SCENE_THEME_PAIRS.lightCanvas.dark };
const _lightCanvasLight: DiagramTheme = { ...lightCanvasTheme,  sceneTheme: SCENE_THEME_PAIRS.lightCanvas.light };
const _lightMinimalDark: DiagramTheme = { ...lightMinimalDarkTheme, sceneTheme: SCENE_THEME_PAIRS.lightMinimal.dark };
const _lightMinimalLight: DiagramTheme= { ...lightMinimalTheme, sceneTheme: SCENE_THEME_PAIRS.lightMinimal.light };

/**
 * Registry of DiagramTheme presets keyed by ThemeFamily and ThemePolarity.
 * Each entry has `sceneTheme` pre-wired from SCENE_THEME_PAIRS — no manual wiring needed.
 *
 * Usage:
 * ```ts
 * const diagramTheme = DIAGRAM_THEME_PAIRS['darkGlass']['dark']; // DiagramTheme with sceneTheme set
 * ```
 */
export const DIAGRAM_THEME_PAIRS: Record<ThemeFamily, DiagramThemePair> = {
  darkGlass:    { dark: _darkGlassDark,    light: _darkGlassLight },
  midnight:     { dark: _midnightDark,     light: _midnightLight },
  neonCyber:    { dark: _neonCyberDark,    light: _neonCyberLight },
  enterprise:   { dark: _enterpriseDark,   light: _enterpriseLight },
  lightCanvas:  { dark: _lightCanvasDark,  light: _lightCanvasLight },
  lightMinimal: { dark: _lightMinimalDark, light: _lightMinimalLight },
} as const;
```

**Step C.5 — Update `packages/diagram/src/elements/diagram/themes/__tests__/index.test.ts`**

Read the existing test file first. Add the following test suite for `DIAGRAM_THEME_PAIRS` using the same style as existing tests:

```typescript
import { DIAGRAM_THEME_PAIRS, DIAGRAM_THEMES } from '../index';
import { SCENE_THEME_PAIRS } from '@brewsite/core';
import type { ThemeFamily } from '@brewsite/core';

const FAMILIES: ThemeFamily[] = [
  'darkGlass', 'midnight', 'neonCyber', 'enterprise', 'lightCanvas', 'lightMinimal',
];

describe('DIAGRAM_THEME_PAIRS', () => {
  it('contains all six theme families', () => {
    for (const family of FAMILIES) {
      expect(DIAGRAM_THEME_PAIRS[family]).toBeDefined();
    }
  });

  it('each dark entry has sceneTheme.colorMode === "dark"', () => {
    for (const family of FAMILIES) {
      expect(DIAGRAM_THEME_PAIRS[family].dark.sceneTheme?.colorMode).toBe('dark');
    }
  });

  it('each light entry has sceneTheme.colorMode === "light"', () => {
    for (const family of FAMILIES) {
      expect(DIAGRAM_THEME_PAIRS[family].light.sceneTheme?.colorMode).toBe('light');
    }
  });

  it('dark entry sceneTheme is the same object as SCENE_THEME_PAIRS[family].dark', () => {
    for (const family of FAMILIES) {
      expect(DIAGRAM_THEME_PAIRS[family].dark.sceneTheme).toBe(SCENE_THEME_PAIRS[family].dark);
    }
  });

  it('light entry sceneTheme is the same object as SCENE_THEME_PAIRS[family].light', () => {
    for (const family of FAMILIES) {
      expect(DIAGRAM_THEME_PAIRS[family].light.sceneTheme).toBe(SCENE_THEME_PAIRS[family].light);
    }
  });

  it('DIAGRAM_THEMES is unchanged — existing flat registry still works', () => {
    for (const family of FAMILIES) {
      expect(DIAGRAM_THEMES[family]).toBeDefined();
    }
  });
});
```

Run `pnpm --filter @brewsite/diagram typecheck` and `pnpm --filter @brewsite/diagram test` after completing this stream.

---

### Stream D — Dev-D: Chart theme pairs + light variant presets

**Owner:** Dev-D
**Prerequisite:** Stream A must be complete before starting this stream.
**Touches exactly these files (no other stream touches these):**
- `packages/charts/src/themes/darkGlassLight.ts` — **CREATE**
- `packages/charts/src/themes/midnightLight.ts` — **CREATE**
- `packages/charts/src/themes/neonCyberLight.ts` — **CREATE**
- `packages/charts/src/themes/enterpriseLight.ts` — **CREATE**
- `packages/charts/src/themes/lightCanvasDark.ts` — **CREATE**
- `packages/charts/src/themes/lightMinimalDark.ts` — **CREATE**
- `packages/charts/src/themes/index.ts` — **MODIFY**
- `packages/charts/src/themes/types.ts` — **MODIFY**
- `packages/charts/src/themes/__tests__/chartThemePairs.test.ts` — **CREATE**

**Step-by-step implementation:**

**Step D.1 — Read existing files first**

Before writing any code, read:
- `packages/charts/src/themes/types.ts` (full)
- `packages/charts/src/themes/darkGlass.ts` (full)
- `packages/charts/src/themes/lightCanvas.ts` (full)
- `packages/charts/src/themes/index.ts` (full)

**Step D.2 — Update `packages/charts/src/themes/types.ts`**

Locate the `ChartThemeName` type. Replace it with the type alias. Add `ThemeFamily` to the existing `@brewsite/core` import at the top of the file:

```typescript
// BEFORE top import:
import type { SceneTheme } from '@brewsite/core';

// AFTER:
import type { SceneTheme, ThemeFamily } from '@brewsite/core';
```

Then replace the `ChartThemeName` union with the alias:

```typescript
// BEFORE:
export type ChartThemeName =
  | 'darkGlass'
  | 'midnight'
  | 'neonCyber'
  | 'enterprise'
  | 'lightCanvas'
  | 'lightMinimal';

// AFTER:
/**
 * Supported chart theme preset names.
 * Type alias for ThemeFamily from @brewsite/core. Maintained for backward compatibility.
 */
export type ChartThemeName = ThemeFamily;
```

**Step D.3 — Create six placeholder chart theme variant files**

The pattern is identical to the diagram variant files: light variants of dark themes use `lightCanvasChartTheme` as the placeholder body; dark variants of light themes use `darkGlassChartTheme`.

Each file follows this template. Write all six files:

**`packages/charts/src/themes/darkGlassLight.ts`:**
```typescript
// Dark Glass chart theme — light-background variant (PLACEHOLDER).
// @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.

// SHARED ACCENT PALETTE — must match packages/diagram/src/elements/diagram/themes/darkGlassLight.ts
// Placeholder uses lightCanvas palette: '#3355cc', '#1a9966', '#cc3355', '#cc8800', '#6644bb'

import type { ChartTheme } from './types';
import { lightCanvasChartTheme } from './lightCanvas';

/**
 * Light-background placeholder variant of the darkGlass chart theme family.
 * @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.
 */
export const darkGlassLightChartTheme: ChartTheme = {
  ...lightCanvasChartTheme,
  name: 'darkGlass-light',
};
```

**`packages/charts/src/themes/midnightLight.ts`:**
```typescript
// Midnight chart theme — light-background variant (PLACEHOLDER).
// @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.

import type { ChartTheme } from './types';
import { lightCanvasChartTheme } from './lightCanvas';

/**
 * Light-background placeholder variant of the midnight chart theme family.
 * @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.
 */
export const midnightLightChartTheme: ChartTheme = {
  ...lightCanvasChartTheme,
  name: 'midnight-light',
};
```

**`packages/charts/src/themes/neonCyberLight.ts`:**
```typescript
// NeonCyber chart theme — light-background variant (PLACEHOLDER).
// @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.

import type { ChartTheme } from './types';
import { lightCanvasChartTheme } from './lightCanvas';

/**
 * Light-background placeholder variant of the neonCyber chart theme family.
 * @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.
 */
export const neonCyberLightChartTheme: ChartTheme = {
  ...lightCanvasChartTheme,
  name: 'neonCyber-light',
};
```

**`packages/charts/src/themes/enterpriseLight.ts`:**
```typescript
// Enterprise chart theme — light-background variant (PLACEHOLDER).
// @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.

import type { ChartTheme } from './types';
import { lightCanvasChartTheme } from './lightCanvas';

/**
 * Light-background placeholder variant of the enterprise chart theme family.
 * @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.
 */
export const enterpriseLightChartTheme: ChartTheme = {
  ...lightCanvasChartTheme,
  name: 'enterprise-light',
};
```

**`packages/charts/src/themes/lightCanvasDark.ts`:**
```typescript
// Light Canvas chart theme — dark-background variant (PLACEHOLDER).
// @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.

// SHARED ACCENT PALETTE — must match packages/diagram/src/elements/diagram/themes/lightCanvasDark.ts
// Placeholder uses darkGlass palette: '#4455aa', '#2266bb', '#7744cc', '#1188aa', '#335588'

import type { ChartTheme } from './types';
import { darkGlassChartTheme } from './darkGlass';

/**
 * Dark-background placeholder variant of the lightCanvas chart theme family.
 * @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.
 */
export const lightCanvasDarkChartTheme: ChartTheme = {
  ...darkGlassChartTheme,
  name: 'lightCanvas-dark',
};
```

**`packages/charts/src/themes/lightMinimalDark.ts`:**
```typescript
// Light Minimal chart theme — dark-background variant (PLACEHOLDER).
// @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.

import type { ChartTheme } from './types';
import { darkGlassChartTheme } from './darkGlass';

/**
 * Dark-background placeholder variant of the lightMinimal chart theme family.
 * @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.
 */
export const lightMinimalDarkChartTheme: ChartTheme = {
  ...darkGlassChartTheme,
  name: 'lightMinimal-dark',
};
```

**Step D.4 — Update `packages/charts/src/themes/index.ts`**

The final file must be:

```typescript
// Chart theme presets — re-exports only.
export { darkGlassChartTheme }    from './darkGlass';
export { midnightChartTheme }     from './midnight';
export { neonCyberChartTheme }    from './neonCyber';
export { enterpriseChartTheme }   from './enterprise';
export { lightCanvasChartTheme }  from './lightCanvas';
export { lightMinimalChartTheme } from './lightMinimal';
// NEW placeholder variants:
export { darkGlassLightChartTheme }    from './darkGlassLight';
export { midnightLightChartTheme }     from './midnightLight';
export { neonCyberLightChartTheme }    from './neonCyberLight';
export { enterpriseLightChartTheme }   from './enterpriseLight';
export { lightCanvasDarkChartTheme }   from './lightCanvasDark';
export { lightMinimalDarkChartTheme }  from './lightMinimalDark';
export { createChartTheme }       from './createChartTheme';
export type { ChartThemeOverrides } from './createChartTheme';
export type {
  ChartTheme,
  ChartThemeName,
  ChartSeriesMaterialTokens,
  ChartAxisTokens,
  ChartBackgroundTokens,
  ChartLegendTokens,
  ChartPieTokens,
  ChartInteractionTokens,
} from './types';

import { darkGlassChartTheme }    from './darkGlass';
import { midnightChartTheme }     from './midnight';
import { neonCyberChartTheme }    from './neonCyber';
import { enterpriseChartTheme }   from './enterprise';
import { lightCanvasChartTheme }  from './lightCanvas';
import { lightMinimalChartTheme } from './lightMinimal';
import { darkGlassLightChartTheme }    from './darkGlassLight';
import { midnightLightChartTheme }     from './midnightLight';
import { neonCyberLightChartTheme }    from './neonCyberLight';
import { enterpriseLightChartTheme }   from './enterpriseLight';
import { lightCanvasDarkChartTheme }   from './lightCanvasDark';
import { lightMinimalDarkChartTheme }  from './lightMinimalDark';

import type { ChartThemeName, ChartTheme } from './types';
import type { ThemeFamily } from '@brewsite/core';
import { SCENE_THEME_PAIRS } from '@brewsite/core';

/** All built-in preset themes, keyed by name. Unchanged from pre-overhaul. */
export const CHART_THEMES: Record<ChartThemeName, ChartTheme> = {
  darkGlass:    darkGlassChartTheme,
  midnight:     midnightChartTheme,
  neonCyber:    neonCyberChartTheme,
  enterprise:   enterpriseChartTheme,
  lightCanvas:  lightCanvasChartTheme,
  lightMinimal: lightMinimalChartTheme,
} as const;

/** Pair type for CHART_THEME_PAIRS entries. */
export type ChartThemePair = {
  readonly dark: ChartTheme;
  readonly light: ChartTheme;
};

// Internal pair entries — spread preset + inject pre-wired sceneTheme.
const _darkGlassDark: ChartTheme    = { ...darkGlassChartTheme,    sceneTheme: SCENE_THEME_PAIRS.darkGlass.dark };
const _darkGlassLight: ChartTheme   = { ...darkGlassLightChartTheme, sceneTheme: SCENE_THEME_PAIRS.darkGlass.light };
const _midnightDark: ChartTheme     = { ...midnightChartTheme,     sceneTheme: SCENE_THEME_PAIRS.midnight.dark };
const _midnightLight: ChartTheme    = { ...midnightLightChartTheme, sceneTheme: SCENE_THEME_PAIRS.midnight.light };
const _neonCyberDark: ChartTheme    = { ...neonCyberChartTheme,    sceneTheme: SCENE_THEME_PAIRS.neonCyber.dark };
const _neonCyberLight: ChartTheme   = { ...neonCyberLightChartTheme, sceneTheme: SCENE_THEME_PAIRS.neonCyber.light };
const _enterpriseDark: ChartTheme   = { ...enterpriseChartTheme,   sceneTheme: SCENE_THEME_PAIRS.enterprise.dark };
const _enterpriseLight: ChartTheme  = { ...enterpriseLightChartTheme, sceneTheme: SCENE_THEME_PAIRS.enterprise.light };
const _lightCanvasDark: ChartTheme  = { ...lightCanvasDarkChartTheme, sceneTheme: SCENE_THEME_PAIRS.lightCanvas.dark };
const _lightCanvasLight: ChartTheme = { ...lightCanvasChartTheme,  sceneTheme: SCENE_THEME_PAIRS.lightCanvas.light };
const _lightMinimalDark: ChartTheme = { ...lightMinimalDarkChartTheme, sceneTheme: SCENE_THEME_PAIRS.lightMinimal.dark };
const _lightMinimalLight: ChartTheme= { ...lightMinimalChartTheme, sceneTheme: SCENE_THEME_PAIRS.lightMinimal.light };

/**
 * Registry of ChartTheme presets keyed by ThemeFamily and ThemePolarity.
 * Each entry has `sceneTheme` pre-wired from SCENE_THEME_PAIRS — no manual wiring needed.
 *
 * Usage:
 * ```ts
 * const chartTheme = CHART_THEME_PAIRS['lightCanvas']['dark']; // ChartTheme with sceneTheme set
 * ```
 */
export const CHART_THEME_PAIRS: Record<ThemeFamily, ChartThemePair> = {
  darkGlass:    { dark: _darkGlassDark,    light: _darkGlassLight },
  midnight:     { dark: _midnightDark,     light: _midnightLight },
  neonCyber:    { dark: _neonCyberDark,    light: _neonCyberLight },
  enterprise:   { dark: _enterpriseDark,   light: _enterpriseLight },
  lightCanvas:  { dark: _lightCanvasDark,  light: _lightCanvasLight },
  lightMinimal: { dark: _lightMinimalDark, light: _lightMinimalLight },
} as const;
```

**Step D.5 — Create `packages/charts/src/themes/__tests__/chartThemePairs.test.ts`**

```typescript
import { CHART_THEME_PAIRS, CHART_THEMES } from '../index';
import { SCENE_THEME_PAIRS } from '@brewsite/core';
import type { ThemeFamily } from '@brewsite/core';

const FAMILIES: ThemeFamily[] = [
  'darkGlass', 'midnight', 'neonCyber', 'enterprise', 'lightCanvas', 'lightMinimal',
];

describe('CHART_THEME_PAIRS', () => {
  it('contains all six theme families', () => {
    for (const family of FAMILIES) {
      expect(CHART_THEME_PAIRS[family]).toBeDefined();
    }
  });

  it('each dark entry has sceneTheme.colorMode === "dark"', () => {
    for (const family of FAMILIES) {
      expect(CHART_THEME_PAIRS[family].dark.sceneTheme?.colorMode).toBe('dark');
    }
  });

  it('each light entry has sceneTheme.colorMode === "light"', () => {
    for (const family of FAMILIES) {
      expect(CHART_THEME_PAIRS[family].light.sceneTheme?.colorMode).toBe('light');
    }
  });

  it('dark entry sceneTheme is the same object as SCENE_THEME_PAIRS[family].dark', () => {
    for (const family of FAMILIES) {
      expect(CHART_THEME_PAIRS[family].dark.sceneTheme).toBe(SCENE_THEME_PAIRS[family].dark);
    }
  });

  it('light entry sceneTheme is the same object as SCENE_THEME_PAIRS[family].light', () => {
    for (const family of FAMILIES) {
      expect(CHART_THEME_PAIRS[family].light.sceneTheme).toBe(SCENE_THEME_PAIRS[family].light);
    }
  });

  it('each dark entry has a valid series array with at least 1 entry', () => {
    for (const family of FAMILIES) {
      expect(CHART_THEME_PAIRS[family].dark.series.length).toBeGreaterThan(0);
    }
  });

  it('CHART_THEMES unchanged — flat registry still has 6 entries', () => {
    expect(Object.keys(CHART_THEMES)).toHaveLength(6);
  });
});
```

Run `pnpm --filter @brewsite/charts typecheck` and `pnpm --filter @brewsite/charts test` after completing this stream.

---

### Stream E — Dev-E: Examples polarity toggle

**Owner:** Dev-E
**Prerequisite:** Streams A, B, C, and D must ALL be complete before starting this stream.
**Touches exactly these files (no other stream touches these):**
- `apps/examples/src/chart/ChartDemoPage.tsx` — **MODIFY**
- `apps/examples/src/chart/scenes/sceneShared.tsx` — **MODIFY**
- `apps/examples/src/chart/scenes/chartDemo.tsx` — **MODIFY**
- `apps/examples/src/chart/scenes/scene1-bar-morph.tsx` — **MODIFY**
- `apps/examples/src/chart/scenes/scene2-stacked-bar.tsx` — **MODIFY**
- `apps/examples/src/chart/scenes/scene3-multiline.tsx` — **MODIFY**
- `apps/examples/src/chart/scenes/scene4-stacked-area.tsx` — **MODIFY**
- `apps/examples/src/chart/scenes/scene5-bubble.tsx` — **MODIFY**
- `apps/examples/src/chart/scenes/scene6-pie-donut.tsx` — **MODIFY**
- `apps/examples/src/chart/scenes/scene7-heatmap.tsx` — **MODIFY**
- `apps/examples/src/chart/scenes/scene8-async.tsx` — **MODIFY**
- `apps/examples/src/chart/scenes/scene9-switcher.tsx` — **MODIFY**
- `apps/examples/src/chart/scenes/scene10-linked-brush.tsx` — **MODIFY**

**Step-by-step implementation:**

**Step E.1 — Read all affected files before writing**

Read all 13 files listed above before making any changes. Pay attention to:
- The current `export const theme` pattern in `ChartDemoPage.tsx`
- What `sceneShared.tsx` currently exports (shared camera constants, `SceneLighting`, `SceneTitleBox`)
- How each scene file currently imports and uses `theme`

**Step E.2 — Modify `apps/examples/src/chart/scenes/sceneShared.tsx`**

Add a React context at the TOP of the file (after the existing imports but before any exported constants). Do NOT remove any existing exports — only add:

```typescript
// ─── Chart demo theme context ─────────────────────────────────────────────────
import { createContext, useContext, type ReactNode } from 'react';
import { CHART_THEME_PAIRS } from '@brewsite/charts';
import type { ChartTheme } from '@brewsite/charts';

const ChartDemoThemeContext = createContext<ChartTheme | null>(null);

/** Provides the current ChartTheme to all chart demo scenes. */
export const ChartDemoThemeProvider = ({ value, children }: { value: ChartTheme; children: ReactNode }) => (
  <ChartDemoThemeContext.Provider value={value}>{children}</ChartDemoThemeContext.Provider>
);

/**
 * Returns the current ChartTheme from ChartDemoThemeContext.
 * Falls back to CHART_THEME_PAIRS['lightCanvas']['light'] when no provider is present
 * (e.g., in tests that render scene components in isolation). The fallback is a full
 * ChartTheme object with sceneTheme pre-wired — same structural shape as the production
 * code path, ensuring test fidelity.
 */
export function useDemoChartTheme(): ChartTheme {
  return useContext(ChartDemoThemeContext) ?? CHART_THEME_PAIRS['lightCanvas']['light'];
}
```

Additionally, update the `SceneTitleBox` component within `sceneShared.tsx` (if it exists — read the file first) to use `var(--brewsite-text-primary)` and `var(--brewsite-text-secondary)` instead of hardcoded hex colors. Replace any hardcoded `color: '#f6fbff'` or equivalent dark/light text colors in `SceneTitleBox` inline styles with `color: 'var(--brewsite-text-primary)'`. Replace any secondary/muted label colors with `color: 'var(--brewsite-text-secondary)'`. This enables the title box to respond to the polarity class injected by `EngineOverlayHost` without any per-component logic.

**Step E.3 — Modify `apps/examples/src/chart/ChartDemoPage.tsx`**

This is the core of Stream E. Apply these changes to `ChartDemoPage.tsx`:

1. **Remove** `export const theme: 'lightCanvas' | 'darkGlass' = 'lightCanvas'` entirely.

2. **Add** these imports at the top of the file:
   ```typescript
   import { useState, useMemo, useCallback, useRef } from 'react';
   import { SCENE_THEME_PAIRS, clearSceneTrackCache, type ThemeFamily, type ThemePolarity } from '@brewsite/core';
   import { CHART_THEME_PAIRS } from '@brewsite/charts';
   import { ChartDemoThemeProvider } from './scenes/sceneShared';
   ```
   Note: `SCENE_THEME_PAIRS` and `clearSceneTrackCache` are already imported from `@brewsite/core` (or `clearSceneTrackCache` is). Add the missing ones to the existing import.

3. **Add** polarity state and engine remount key inside `ChartDemoPage`:
   ```typescript
   const CHART_FAMILY: ThemeFamily = 'lightCanvas';
   const [polarity, setPolarity] = useState<ThemePolarity>('light');
   const [engineKey, setEngineKey] = useState(0);
   ```

4. **Add** theme resolution via pairs:
   ```typescript
   const sceneTheme = SCENE_THEME_PAIRS[CHART_FAMILY][polarity];
   const chartTheme = useMemo(
     () => CHART_THEME_PAIRS[CHART_FAMILY][polarity],
     [polarity]
   );
   ```

5. **Add** the polarity toggle handler:
   ```typescript
   const handlePolarityToggle = useCallback((): void => {
     clearSceneTrackCache();
     setPolarity(prev => prev === 'dark' ? 'light' : 'dark');
     setEngineKey(prev => prev + 1);
   }, []);
   ```

6. **Add** a polarity toggle button in the page wrapper div (as an absolutely-positioned element in the top-right corner of the flex container, outside `SceneEngine`). The button must be positioned before the `<SceneEngine>` element in the JSX:
   ```tsx
   {/* Polarity toggle button — top-right corner */}
   <button
     onClick={handlePolarityToggle}
     aria-label={polarity === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
     style={{
       position: 'absolute',
       top: 12,
       right: 16,
       zIndex: 100,
       background: polarity === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
       border: polarity === 'dark' ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.15)',
       borderRadius: 8,
       cursor: 'pointer',
       padding: '6px 8px',
       display: 'flex',
       alignItems: 'center',
       justifyContent: 'center',
       color: polarity === 'dark' ? '#ffffff' : '#111111',
       fontSize: 18,
       lineHeight: 1,
       transition: 'background 0.15s ease',
     }}
   >
     {polarity === 'dark' ? (
       /* Sun icon — switch to light */
       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
         <circle cx="12" cy="12" r="5"/>
         <line x1="12" y1="1" x2="12" y2="3"/>
         <line x1="12" y1="21" x2="12" y2="23"/>
         <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
         <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
         <line x1="1" y1="12" x2="3" y2="12"/>
         <line x1="21" y1="12" x2="23" y2="12"/>
         <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
         <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
       </svg>
     ) : (
       /* Moon icon — switch to dark */
       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
         <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
       </svg>
     )}
   </button>
   ```
   The outer `<div>` (the page wrapper) already has `style={{ position: 'relative' }}` implied by `overflow: 'hidden'` — add `position: 'relative'` explicitly to the outer div if it is not already present.

7. **Update** `<SceneEngine>` to use the remount key and resolved sceneTheme:
   ```tsx
   <SceneEngine key={engineKey} plugins={plugins} sceneTheme={sceneTheme}>
   ```

8. **Wrap** the scene components with `ChartDemoThemeProvider`. The provider wraps all scene children inside `SceneEngine`:
   ```tsx
   <SceneEngine key={engineKey} plugins={plugins} sceneTheme={sceneTheme}>
     <ChartDemoThemeProvider value={chartTheme}>
       <ChartProvider data={chartData}>
         {/* Scene components here — unchanged */}
       </ChartProvider>
     </ChartDemoThemeProvider>
     {/* ScrollStage, KeyboardInput, etc. remain outside provider */}
   ```

9. **Update** `ChartProgressIndicator` (the `TimelineWidget` wrapper) to derive its theme prop from `sceneTheme.colorMode` instead of the module-level `theme` constant:
   ```tsx
   <TimelineWidget
     engine={engine}
     theme={/* read from parent via prop */}
     ...
   ```
   Pass `colorMode` as a prop down from `ChartDemoPage` to `ChartProgressIndicator`:
   ```typescript
   type ChartProgressIndicatorProps = {
     scrollStageRef: RefObject<ScrollStageHandle | null>;
     colorMode: 'dark' | 'light';  // NEW
   };
   // In ChartDemoPage:
   <ChartProgressIndicator scrollStageRef={scrollStageRef} colorMode={sceneTheme.colorMode} />
   // In the component:
   theme={colorMode === 'light' ? 'light' : 'dark'}
   ```

10. **Update** the page wrapper background gradient to respond to polarity:
    ```typescript
    background: polarity === 'light'
      ? 'radial-gradient(circle at 50% 0%, #f2f4fd 0%, #d1cada 42%, #c2c8c2 72%, #d6d3d6 100%)'
      : 'radial-gradient(circle at 50% 0%, #12345d 0%, #061326 42%, #020812 72%, #01040a 100%)',
    ```

**Step E.4 — Update all scene files (11 files)**

For EACH of the following files, apply the same two-step change:

Files: `chartDemo.tsx`, `scene1-bar-morph.tsx`, `scene2-stacked-bar.tsx`, `scene3-multiline.tsx`, `scene4-stacked-area.tsx`, `scene5-bubble.tsx`, `scene6-pie-donut.tsx`, `scene7-heatmap.tsx`, `scene8-async.tsx`, `scene9-switcher.tsx`, `scene10-linked-brush.tsx`

**Change 1 — Replace the theme import:**
```typescript
// REMOVE this line (wherever it appears):
import { theme } from '../ChartDemoPage';

// ADD this line instead:
import { useDemoChartTheme } from './sceneShared';
```

**Change 2 — Read theme from hook inside component:**

For EACH scene component function that uses `theme`, add the hook call as the first line of the component body:
```typescript
const chartTheme = useDemoChartTheme();
```

Then replace all `theme={theme}` occurrences within that component with `theme={chartTheme}`.

Example before/after for `scene1-bar-morph.tsx`:
```tsx
// BEFORE:
export const Scene1a = (): JSX.Element => (
  <Scene id="chart-s1a">
    ...
    <BarChart theme={theme} ... />
  </Scene>
);

// AFTER:
export const Scene1a = (): JSX.Element => {
  const chartTheme = useDemoChartTheme();
  return (
    <Scene id="chart-s1a">
      ...
      <BarChart theme={chartTheme} ... />
    </Scene>
  );
};
```

Note: Components that were arrow function expressions returning JSX directly must be converted to arrow functions with block bodies to accommodate the hook call. This is a one-line conversion per component.

For `chartDemo.tsx`: This file has arrow function scene exports with `theme={theme}`. Apply the same pattern. If any scene in `chartDemo.tsx` has hardcoded dark overlay text colors (`color: '#f6fbff'`, `color: 'rgba(196,222,255,0.55)'`, etc.), replace them with `var(--brewsite-text-primary)` and `var(--brewsite-text-secondary)` respectively, consistent with the `SceneTitleBox` changes in `sceneShared.tsx`.

**Step E.5 — Verify**

After all 13 files are updated:
1. Run `pnpm typecheck` from the repo root to verify zero TypeScript errors across all packages.
2. Run `pnpm dev` and navigate to the chart demo page.
3. Click the sun/moon toggle button. Verify:
   - The page background gradient switches.
   - The Three.js scene re-renders (~100–300ms pause expected).
   - The overlay text colors switch between dark and light.
   - The `TimelineWidget` theme follows the polarity.
4. Verify the toggle works both dark→light and light→dark.

There are no automated test files for the examples app. The verification is manual.

---

## 6. Test Strategy

### Stream A — `packages/core/src/theme/__tests__/presets.test.ts`

| Test case | Assertion |
|---|---|
| `SCENE_THEME_PAIRS` has all 6 families | `SCENE_THEME_PAIRS[family]` is defined for each family |
| Dark entries have `colorMode === 'dark'` | True for all 6 families |
| Light entries have `colorMode === 'light'` | True for all 6 families |
| Existing presets are referenced by identity | `SCENE_THEME_PAIRS['darkGlass'].dark === darkGlassSceneTheme` |
| No null/undefined entries | All 12 entries non-null |

### Stream B — `packages/core/src/player/__tests__/EngineOverlayHost.test.tsx`

**Pattern:** Two new `describe` blocks added to the existing file. No `vi.mock`. Engine context provided via `<EngineContext.Provider value={engine}>` using the existing `makeEngine()` helper. Theme provided via `<ThemeContext.Provider value={theme}>` using the existing `renderHost()` helper (extended with `className` option).

| Test case | Assertion |
|---|---|
| `--brewsite-background-color` from `fill.value` | `'#070b18'` for darkGlassSceneTheme |
| `--brewsite-background-color` dark fallback (no fill) | `'#0a0a14'` |
| `--brewsite-background-color` light fallback (no fill) | `'#f5f5f7'` |
| `--brewsite-radius-base` | `'6px'` |
| `--brewsite-surface-elevated` dark value | `'rgba(255,255,255,0.06)'` |
| `--brewsite-surface-elevated` light value | `'rgba(0,0,0,0.04)'` |
| `--brewsite-border-subtle` dark value | `'rgba(255,255,255,0.12)'` |
| No new vars without theme | Empty string |
| `.bw-theme-darkGlass` for registry dark entry | `classList.contains('bw-theme-darkGlass')` |
| `.bw-dark` class for dark colorMode | `classList.contains('bw-dark')` |
| `.bw-light` class for light colorMode | `classList.contains('bw-light')` |
| `.bw-theme-lightCanvas` for registry light entry | `classList.contains('bw-theme-lightCanvas')` |
| No `.bw-theme-*` for custom spread theme | No class starting with `bw-theme-` |
| Custom spread theme still gets `.bw-dark` | `classList.contains('bw-dark')` |
| Consumer `className` preserved alongside theme classes | Both classes present |
| No `bw-*` classes without theme | No class starting with `bw-` |
| Light polarity entry for darkGlass family resolves to `.bw-theme-darkGlass` | `classList.contains('bw-theme-darkGlass')` and `.bw-light` |

### Stream C — `packages/diagram/src/elements/diagram/themes/__tests__/index.test.ts`

| Test case | Assertion |
|---|---|
| `DIAGRAM_THEME_PAIRS` has all 6 families | Non-undefined for all |
| Dark entries have `sceneTheme.colorMode === 'dark'` | True for all 6 |
| Light entries have `sceneTheme.colorMode === 'light'` | True for all 6 |
| Dark `sceneTheme` by reference from `SCENE_THEME_PAIRS` | `===` equality |
| Light `sceneTheme` by reference from `SCENE_THEME_PAIRS` | `===` equality |
| `DIAGRAM_THEMES` flat registry unchanged | 6 entries still present |

### Stream D — `packages/charts/src/themes/__tests__/chartThemePairs.test.ts`

| Test case | Assertion |
|---|---|
| `CHART_THEME_PAIRS` has all 6 families | Non-undefined for all |
| Dark entries have `sceneTheme.colorMode === 'dark'` | True for all 6 |
| Light entries have `sceneTheme.colorMode === 'light'` | True for all 6 |
| Dark `sceneTheme` by reference from `SCENE_THEME_PAIRS` | `===` equality |
| Light `sceneTheme` by reference from `SCENE_THEME_PAIRS` | `===` equality |
| Dark entries have valid series array | `series.length > 0` for all 6 |
| `CHART_THEMES` unchanged | 6 entries |

### Stream E — Manual verification only

No automated tests for `apps/examples`. Manual verification checklist in Step E.5.

---

## 7. Migration Guide

### For existing consumers of `@brewsite/core`

No action required. All changes are additive:
- `ThemeFamily`, `ThemePolarity`, `SceneThemePair`, `SCENE_THEME_PAIRS` are new exports.
- Existing `SceneTheme` type is unchanged.
- All six named `SceneTheme` presets are unchanged by value and reference.
- `EngineOverlayHost` adds new CSS classes and variables. Existing consumers who do not reference `.bw-theme-*`, `.bw-dark`, `.bw-light`, `--brewsite-background-color`, `--brewsite-surface-elevated`, `--brewsite-border-subtle`, or `--brewsite-radius-base` are completely unaffected.

### For existing consumers of `@brewsite/diagram`

No action required. `DiagramThemeName` is now a type alias for `ThemeFamily` — all six members are identical. TypeScript strict-mode consumers will see no errors. `DIAGRAM_THEMES` flat registry is unchanged. `DIAGRAM_THEME_PAIRS` is a new export.

### For existing consumers of `@brewsite/charts`

No action required. `ChartThemeName` is now a type alias for `ThemeFamily` — all six members are identical. `CHART_THEMES` flat registry is unchanged. `CHART_THEME_PAIRS` is a new export.

### For consumers wanting to use the new polarity API

The canonical consumer pattern (from the feature note):

```typescript
import { SCENE_THEME_PAIRS, type ThemeFamily, type ThemePolarity } from '@brewsite/core';
import { DIAGRAM_THEME_PAIRS } from '@brewsite/diagram';
import { CHART_THEME_PAIRS } from '@brewsite/charts';

const family: ThemeFamily = 'darkGlass';
const polarity: ThemePolarity = 'dark';  // or 'light'

const sceneTheme   = SCENE_THEME_PAIRS[family][polarity];    // SceneTheme
const diagramTheme = DIAGRAM_THEME_PAIRS[family][polarity];  // DiagramTheme (sceneTheme pre-wired)
const chartTheme   = CHART_THEME_PAIRS[family][polarity];    // ChartTheme (sceneTheme pre-wired)
```

Note: `diagramTheme.sceneTheme` and `chartTheme.sceneTheme` are pre-wired. Consumers no longer need to manually set `sceneTheme` on `DiagramCanvas` or `<Chart>` when using a pair registry entry.

---

## 8. Non-Goals / Deferred

- **`prefers-color-scheme` auto-detection.** Remains a Non-Goal per the existing core theming PRD. No `matchMedia` listeners. Polarity is manual UI only.
- **Animated transitions between polarities.** CSS `transition` on overlay variables may happen naturally; no explicit animation is built.
- **`BrewSiteThemeProvider` DOM wrapper.** Deferred to follow-on if page-level CSS cascade scope is needed.
- **Production-quality aesthetics for the 6 new variant presets.** v1 ships infrastructure with clearly labeled `@internal` placeholders. Aesthetic authoring is a tracked follow-on story before any production release of the feature.
- **`--brewsite-accent-1` through `--brewsite-accent-8` CSS variables.** Open question 5.6 from the feature note; deferred to follow-on.
- **`@brewsite/model` troika-three-text polarity awareness.** Open question 5.9 from the feature note; no change to `@brewsite/model` in this plan.
- **Reactive CSS variable updates without remount.** Option B from note section 4.4 (re-running `style.setProperty()` calls in `EngineOverlayHost` when `sceneTheme` changes within a React re-render, without full remount). This is a valid standalone improvement but is not in scope for v1.
- **`BackgroundLayer` refactor to use `var(--brewsite-background-color)`.** Deferred to follow-on. In v1, `BackgroundLayer` reads compiled `SceneTheme.background.fill` directly via inline style; it does not consume the CSS variable.
- **Polarity toggle for non-chart demo pages (`SlidesDemoPage`, any future `DiagramDemoPage`).** Explicitly deferred. The feature note Goal 5 mentions "DiagramDemoPage, SimpleDemoPage, etc." as aspirational scope, but neither `DiagramDemoPage.tsx` nor `SimpleDemoPage.tsx` exist in the current codebase (`apps/examples/src/`). The only existing demo pages are `ChartDemoPage.tsx` and `SlidesDemoPage.tsx`. Stream E covers `ChartDemoPage` fully. Wiring the polarity toggle into any future diagram demo page is left to the follow-on story where production-quality diagram theme variants are authored — `DIAGRAM_THEME_PAIRS` and `SCENE_THEME_PAIRS` will be fully available as the API by then.
- **Adding new chart types or diagram elements.** Out of scope.

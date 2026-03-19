---
title: "Theme Redesign — Implementation Plan"
doc_type: plan
owner: architect
status: complete
updated: 2026-03-11
---

# Theme Redesign — Implementation Plan

## 1. Overview

This plan implements the BrewSite theme redesign as specified in `requirements/diagram/notes/note_theme-redesign.md`. The work establishes six canonical theme names that work coherently across `@brewsite/diagram` and `@brewsite/charts`, introduces a string-name API for `<Diagram theme="...">` to match the existing chart API ergonomics, expands the `SceneTheme` preset library with per-theme named presets, and removes the unimplemented `SceneTheme.accentColor` field.

The six canonical names are: `darkGlass` (redesigned), `midnight` (new), `neonCyber` (redesigned), `enterprise` (polished), `lightCanvas` (new), and `lightMinimal` (minor fix). Each theme name maps to a coherent 8-color accent palette shared identically between the diagram node `palette[]` array and the chart `series[0..7].color` array. This palette alignment is enforced by design discipline via cross-package comment blocks in every theme file, not by shared code between packages.

No shared type or registry crosses the `@brewsite/core ← @brewsite/diagram/charts` boundary. `DiagramThemeName` lives exclusively in `@brewsite/diagram`; `ChartThemeName` lives exclusively in `@brewsite/charts`. Both unions happen to contain the same six names as a coordinated product decision — valid per-package divergence (one package adding a theme before the other) is expected and not a bug.

---

## 2. Prerequisites

### Group Label Rendering Bug (Ship in Separate PR First)

**Status in current codebase:** A code audit conducted during planning reveals that this bug has already been substantially addressed. The current code at `packages/diagram/src/elements/diagram/compiler/defaultsCompiler.ts:133` correctly reads `labelColor: theme.group.defaultLabelColor` in `buildGroupDefaults()`. The current code at `packages/diagram/src/elements/diagram/compiler/groupCompiler.ts:255` correctly propagates `labelColor: dsl.labelColor ?? gd.labelColor`. The current code at `packages/diagram/src/elements/diagram/rendering/GroupRenderer.ts:252` correctly passes `state.labelColor` to `ensureText()`.

**Verification required:** Before this implementation begins, run the test suite and manually verify that a `lightMinimal` diagram with groups renders group labels in `#1a2240` (dark navy, readable on white). If the fix is already in place, no separate PR is needed — document this in the CHANGELOG as already resolved.

**If fix is NOT already in:** The change scope is:
- `packages/diagram/src/elements/diagram/rendering/GroupRenderer.ts`: ensure the `ensureText()` call for group titles reads `state.labelColor` (not a hardcoded `'#ffffff'` constant)
- `packages/diagram/src/elements/diagram/compiler/defaultsCompiler.ts`: ensure `buildGroupDefaults()` reads `theme.group.defaultLabelColor`
- No palette files change

**`withColorMode()` status:** The current `mergeTheme.ts` at line 92–94 already includes `group: { ...base.group, defaultLabelColor: isDark ? '#e8eeff' : '#1a1a2e' }`. The `withColorMode()` extension described in the feature note is **already implemented**. No change required.

---

## 3. Architecture Decisions

### 3.1 Type Ownership

- `DiagramThemeName` lives in `packages/diagram/src/elements/diagram/types.ts`. This is the type's authoritative source in `@brewsite/diagram`.
- `ChartThemeName` lives in `packages/charts/src/themes/types.ts`. This is the type's authoritative source in `@brewsite/charts`.
- No `BrewSiteThemeName` type exists in `@brewsite/core`. Core encodes architectural contracts; theme names are product content. Adding a shared union in core would force a core version bump every time any downstream package adds a new theme.
- Exact file: `ChartThemeName` is currently defined at `packages/charts/src/themes/types.ts:7`.

### 3.2 String API for `<Diagram>`

The `theme?` prop on `DiagramProps` changes from `DiagramTheme | undefined` to `DiagramThemeName | DiagramTheme | undefined`. This is a **union widening** — a non-breaking TypeScript change. Existing call sites that pass a `DiagramTheme` object continue to compile identically without modification.

Compile-time resolution path: `compile.ts` checks `typeof dsl.theme === 'string'` and indexes `DIAGRAM_THEMES` (a keyed constant in `themes/index.ts`). If the string is not a known name, `compile.ts` falls back to `darkGlassTheme` and emits `console.warn(...)`. This matches the behavior of `CHART_THEMES` resolution.

### 3.3 `DIAGRAM_THEMES` Registry

`DIAGRAM_THEMES` is a `Record<DiagramThemeName, DiagramTheme>` constant defined in `packages/diagram/src/elements/diagram/themes/index.ts`, directly parallel to `CHART_THEMES` in `packages/charts/src/themes/index.ts`. It is exported from `packages/diagram/src/elements/diagram/index.ts` so consumers can do dynamic theme switching.

### 3.4 Cross-Package Palette Coherence

Every diagram and chart theme file contains the following comment block at the top, after the file-purpose comment:

```ts
// SHARED ACCENT PALETTE — must match packages/[counterpart-package]/src/themes/[themeName].ts
// Index 0–4: diagram node palette[0..4]; indices 0–7: chart series[0..7].color
// '#xxxxxx', '#xxxxxx', '#xxxxxx', '#xxxxxx', '#xxxxxx', '#xxxxxx', '#xxxxxx', '#xxxxxx'
```

The hex values in the comment must exactly match the actual values in the file. This makes palette divergence detectable by code reviewers — no runtime mechanism enforces this.

### 3.5 `SceneTheme.accentColor` Removal

**Important discovery:** The feature note states `accentColor` is "not consumed by any package", but code inspection reveals two active consumers:

1. `packages/core/src/player/EngineOverlayHost.tsx:73` — injects `--brewsite-accent-color` as a CSS custom property when `accentColor` is set.
2. `packages/slides/src/compiler/themeCompiler.ts:21` — maps `DeckTheme.accentColor` to `sceneTheme.accentColor` (the slides package, not listed in CLAUDE.md workspace scope).

**This plan's handling:**
- Remove `accentColor?` from `SceneTheme` in `packages/core/src/theme/types.ts`.
- Remove the corresponding CSS injection from `packages/core/src/player/EngineOverlayHost.tsx`.
- Update the test in `packages/core/src/player/__tests__/EngineOverlayHost.test.tsx`.
- **`packages/slides` is out of scope for this plan** but will break at TypeScript compile time. The implementing developer must flag this to the team lead. Either: (a) fix `packages/slides` in the same PR (assign a slides developer), or (b) update the plan to defer `accentColor` removal and scope it to a separate follow-up.

### 3.6 New `SceneTheme` Presets in `@brewsite/core`

Six named `SceneTheme` presets are added to `packages/core/src/theme/presets.ts`. The existing `darkSceneTheme` and `lightSceneTheme` are **unchanged** — they are generic polarity presets. The new presets are theme-family-specific and drive the DOM background color appropriate for each visual family. All new presets use `system-ui` as `htmlFamily` (matching the existing presets). `webglFontUrl` is absent from all — consumers override as needed.

### 3.7 `DiagramTheme.background` Out of Scope

`DiagramTheme.background` remains deferred per the feature note and the diagram theming PRD. No `background` field is added to `DiagramTheme` in this work.

### 3.8 Version Strategy

- `@brewsite/core`: minor version bump (remove `accentColor?` is technically breaking for `packages/slides` but is a minor change per semver product policy)
- `@brewsite/diagram`: minor version bump (adds `DiagramThemeName`, `DIAGRAM_THEMES`, string API, 2 new theme presets; palette changes to existing presets are documented as non-contractual aesthetic updates)
- `@brewsite/charts`: minor version bump (adds 2 new theme presets, palette changes to existing)
- `@brewsite/model`: **no change required** — model has no theme types

---

## 4. Work Streams

Work streams are designed for up to 5 parallel developers with zero shared-file conflicts between any pair of concurrently running streams. Dependencies are stated explicitly.

---

### Stream A — Core Package Changes

**Developer count:** 1
**Can start:** Immediately (no dependencies)
**Estimated scope:** Small — 6 files changed, ~90 lines net

#### Files to CREATE
None.

#### Files to MODIFY

**`packages/core/src/theme/types.ts`**
- Delete the `accentColor?` field and its JSDoc comment (lines 150–156 in current file).
- No other changes.

**`packages/core/src/player/EngineOverlayHost.tsx`**
- Remove lines 69–73 (the `accentColor` CSS injection block: the comment and the spread expression `...(theme.accentColor ? { '--brewsite-accent-color': theme.accentColor } : {})`).
- No other changes.

**`packages/slides/src/compiler/themeCompiler.ts`**
- Remove `accentColor,` from the `sceneTheme` object literal at line 42. The resulting `sceneTheme` block becomes:
  ```ts
  const sceneTheme: SceneTheme = {
    font: { htmlFamily: fonts.heading },
    fontSize: { heading: 2.4, body: 1.0, label: 0.875, caption: 0.75, annotation: 0.7 },
    colorMode,
  };
  ```
- The `accentColor` variable at line 21 (`const accentColor = theme?.accentColor ?? ...`) is **preserved** — it is still computed, still returned in `ResolvedDeckTheme` at line 59, and is part of `DeckTheme`'s own internal model. Only its forwarding to `SceneTheme` is removed.
- No other changes to this file.

**`packages/core/src/theme/presets.ts`**
- Add 6 new named `SceneTheme` constants after the existing `lightSceneTheme` export.
- See Section 6.1 for exact values.
- New exports: `darkGlassSceneTheme`, `midnightSceneTheme`, `neonCyberSceneTheme`, `enterpriseSceneTheme`, `lightCanvasSceneTheme`, `lightMinimalSceneTheme`.

**`packages/core/src/theme/index.ts`**
- Add export lines for the 6 new preset names. Current exports: `darkSceneTheme`, `lightSceneTheme`. After: add `darkGlassSceneTheme`, `midnightSceneTheme`, `neonCyberSceneTheme`, `enterpriseSceneTheme`, `lightCanvasSceneTheme`, `lightMinimalSceneTheme`.

#### Files this stream MUST NOT touch
Everything outside `packages/core/src/theme/`, `packages/core/src/player/EngineOverlayHost.tsx`, and `packages/slides/src/compiler/`.

#### Test files to modify

**`packages/core/src/theme/__tests__/presets.test.ts`**
- Add 6 new test cases (one per new preset) verifying:
  - `colorMode` is the expected polarity (`'dark'` for the 4 dark themes, `'light'` for the 2 light themes)
  - `background.fill.kind === 'color'`
  - `background.fill.value` matches the expected hex
  - All required `fontSize` scale keys are present
- See Section 9 for exact test case descriptions.

**`packages/core/src/player/__tests__/EngineOverlayHost.test.tsx`**
- Remove or update the two test cases: `'does NOT set --brewsite-accent-color when accentColor is undefined'` and `'sets --brewsite-accent-color when accentColor is defined'`.
- After removal of `accentColor`, neither CSS injection path exists. Both tests should be deleted.

**`packages/slides/src/compiler/__tests__/themeCompiler.test.ts`**
- Delete the test case at lines 37–40: `'maps accentColor to sceneTheme.accentColor'`.
  ```ts
  // DELETE THIS TEST:
  it('maps accentColor to sceneTheme.accentColor', () => {
    const result = compileDeckTheme({ accentColor: '#ff0000' });
    expect(result.sceneTheme.accentColor).toBe('#ff0000');
  });
  ```
- After deletion, `result.sceneTheme` no longer has an `accentColor` field. The `accentColor` field is still tested implicitly via `result.accentColor` (which is part of `ResolvedDeckTheme`, not `SceneTheme`) — that path is not broken and needs no new test.
- No other changes to this test file.

---

### Stream B — Diagram Infrastructure (Types + DSL API)

**Developer count:** 1
**Can start:** Immediately (no dependencies on other streams)
**Estimated scope:** Small — 2 files changed, ~15 lines net

#### Files to CREATE
None.

#### Files to MODIFY

**`packages/diagram/src/elements/diagram/types.ts`**
- Add `DiagramThemeName` type union before the `DiagramThemeNodeConfig` interface (around line 7, after existing imports). Exact TypeScript — see Section 5.1.
- No other changes to this file.

**`packages/diagram/src/elements/diagram/dsl.tsx`**
- Change `DiagramProps.theme` from `theme?: DiagramTheme` to `theme?: DiagramThemeName | DiagramTheme`.
- Add `DiagramThemeName` to the import from `'./types'`.
- No other changes to this file.

#### Files this stream MUST NOT touch
`compile.ts`, `themes/index.ts`, `themes/darkGlass.ts`, `themes/neonCyber.ts`, `themes/enterprise.ts`, `themes/lightMinimal.ts`, anything in `packages/core` or `packages/charts`.

#### Test files to modify
None required. The type change is validated by TypeScript's type checker. A `typecheck` run on `@brewsite/diagram` verifying no new type errors is the acceptance criterion.

---

### Stream C — Diagram Dark Theme Content

**Developer count:** 1
**Can start:** Immediately (no dependencies on other streams)
**Estimated scope:** Medium — 3 files modified, 1 file created, ~300 lines net

#### Files to CREATE

**`packages/diagram/src/elements/diagram/themes/midnight.ts`**
Full `DiagramTheme` object for the `midnight` theme. See Section 6 for exact values.

#### Files to MODIFY

**`packages/diagram/src/elements/diagram/themes/darkGlass.ts`**
Replace palette, node colors, edge colors, group colors, environment values per Section 6 color spec. The shared accent palette comment block must be added.

**`packages/diagram/src/elements/diagram/themes/neonCyber.ts`**
Replace palette, node colors, edge colors, group colors, environment values per Section 6 color spec. Update label colors. The shared accent palette comment block must be added.

**`packages/diagram/src/elements/diagram/themes/enterprise.ts`**
Replace node colors, edge colors, group colors, environment values per Section 6 color spec. Add `palette` array. The shared accent palette comment block must be added. Set `edge.defaultFlowSpeed: 0.0` to effectively disable flow animation in this theme. Note: `defaultFlowSpeed: 0.0` sets the theme-default flow speed to zero, suppressing default flow animation in the enterprise theme. Per-edge `<DiagramEdge flow="forward">` overrides remain functional — authors who explicitly enable flow on specific edges will still see animation. This is by design; no `defaultFlowEnabled` flag or separate suppression mechanism is needed.

#### Files this stream MUST NOT touch
`themes/index.ts`, `themes/lightMinimal.ts`, `compile.ts`, `types.ts`, `dsl.tsx`, `themes/lightCanvas.ts` (Stream D), anything in `packages/core` or `packages/charts`.

#### Test files to modify
None — palette values are product content, not testable contracts. Visual changes are reviewed manually against the verification checklist.

---

### Stream D — Diagram Light Theme Content

**Developer count:** 1
**Can start:** Immediately (no dependencies on other streams)
**Estimated scope:** Small — 1 file modified, 1 file created, ~150 lines net

#### Files to CREATE

**`packages/diagram/src/elements/diagram/themes/lightCanvas.ts`**
Full `DiagramTheme` object for the `lightCanvas` theme. See Section 6 for exact values.

#### Files to MODIFY

**`packages/diagram/src/elements/diagram/themes/lightMinimal.ts`**
Add the shared accent palette comment block only. No color values change. No structural changes.

#### Files this stream MUST NOT touch
`themes/index.ts`, `themes/darkGlass.ts`, `themes/midnight.ts`, `themes/neonCyber.ts`, `themes/enterprise.ts` (Stream C files), `compile.ts`, `types.ts`, `dsl.tsx`, anything in `packages/core` or `packages/charts`.

#### Test files to modify
None.

---

### Stream E — Charts Infrastructure + Theme Content

**Developer count:** 1
**Can start:** Immediately (no dependencies on other streams)
**Estimated scope:** Large — 5 files modified, 2 files created, ~400 lines net

#### Files to CREATE

**`packages/charts/src/themes/midnight.ts`**
Full `ChartTheme` object for the `midnight` chart theme. See Section 6 for exact values.

**`packages/charts/src/themes/lightCanvas.ts`**
Full `ChartTheme` object for the `lightCanvas` chart theme. See Section 6 for exact values.

#### Files to MODIFY

**`packages/charts/src/themes/types.ts`**
Update `ChartThemeName` from `'darkGlass' | 'neonCyber' | 'enterprise' | 'lightMinimal'` to the full 6-name union. See Section 5.2 for exact type.

**`packages/charts/src/themes/darkGlass.ts`**
Replace all 8 series colors + material tokens. Add shared accent palette comment block. Other structural tokens (axis, background, legend, etc.) updated per Section 6.

**`packages/charts/src/themes/neonCyber.ts`**
Replace all 8 series colors + stepped emissive intensities. Add shared accent palette comment block. Update axis/legend colors.

**`packages/charts/src/themes/enterprise.ts`**
Replace all 8 series colors. Add shared accent palette comment block. Update axis/legend colors. Set uniform `emissiveIntensity: 0.04`.

**`packages/charts/src/themes/lightMinimal.ts`**
Add shared accent palette comment block. Change `depth` on all 8 series from `0.2` to `0.16`. No color changes to series palette or axis/legend.

**`packages/charts/src/themes/index.ts`**
Add imports for `midnightChartTheme` and `lightCanvasChartTheme`. Add both to the `CHART_THEMES` constant. Export both theme objects. Export updated `ChartThemeName` type.

**`packages/charts/src/themes/createChartTheme.ts`**
Add two import lines at the top of the file (after the existing 4 theme imports):
```ts
import { midnightChartTheme }   from './midnight';
import { lightCanvasChartTheme } from './lightCanvas';
```

Update `PRESET_MAP` at line 22 from 4 entries to 6:
```ts
const PRESET_MAP: Record<ChartThemeName, ChartTheme> = {
  darkGlass:    darkGlassChartTheme,
  midnight:     midnightChartTheme,       // ← add
  neonCyber:    neonCyberChartTheme,
  enterprise:   enterpriseChartTheme,
  lightCanvas:  lightCanvasChartTheme,    // ← add
  lightMinimal: lightMinimalChartTheme,
};
```

Note the naming convention difference: diagram theme exports use `midnightTheme` / `lightCanvasTheme`; chart theme exports use `midnightChartTheme` / `lightCanvasChartTheme`. Do not confuse the two.

#### Files this stream MUST NOT touch
Anything in `packages/core`, `packages/diagram`, `packages/model`, `apps/`.

#### Test files to modify

**`packages/charts/src/themes/__tests__/createChartTheme.test.ts`**
Add test cases for `createChartTheme('midnight', {})` and `createChartTheme('lightCanvas', {})`, `CHART_THEMES` registry completeness, and `neonCyber` stepped emissive verification. See Section 9 for exact test descriptions.

---

### Stream F — Diagram Integration (Index + Compile)

**Developer count:** 1
**Blocking dependency:** Must wait for Stream B **AND** Stream C **AND** Stream D to complete
**Estimated scope:** Small — 2 files changed, ~30 lines net

#### Files to CREATE
None.

#### Files to MODIFY

**`packages/diagram/src/elements/diagram/themes/index.ts`**
- Add `export { midnightTheme } from './midnight';`
- Add `export { lightCanvasTheme } from './lightCanvas';`
- Add `export { DIAGRAM_THEMES } from './registry';` OR define `DIAGRAM_THEMES` inline in this file.

**Option chosen (inline, no new file):** Define `DIAGRAM_THEMES` directly in `themes/index.ts` after all 6 theme imports. This avoids introducing an extra barrel indirection. The full definition:

```ts
import { darkGlassTheme }   from './darkGlass';
import { midnightTheme }    from './midnight';
import { neonCyberTheme }   from './neonCyber';
import { enterpriseTheme }  from './enterprise';
import { lightCanvasTheme } from './lightCanvas';
import { lightMinimalTheme } from './lightMinimal';
import type { DiagramThemeName } from '../types';
import type { DiagramTheme } from '../types';

/** All built-in diagram theme presets, keyed by name. */
export const DIAGRAM_THEMES: Record<DiagramThemeName, DiagramTheme> = {
  darkGlass:   darkGlassTheme,
  midnight:    midnightTheme,
  neonCyber:   neonCyberTheme,
  enterprise:  enterpriseTheme,
  lightCanvas: lightCanvasTheme,
  lightMinimal: lightMinimalTheme,
} as const;
```

**`packages/diagram/src/elements/diagram/compile.ts`**
- Add import: `import { DIAGRAM_THEMES } from './themes/index';`
  (Import path: the file is at `elements/diagram/compile.ts`; the themes are at `elements/diagram/themes/index.ts`, so the relative import is `'./themes/index'`.)
- Change the `theme` resolution near line 86 from:
  ```ts
  const theme: DiagramTheme = dsl.theme ?? fallbackTheme;
  ```
  to:
  ```ts
  const resolvedTheme: DiagramTheme =
    typeof dsl.theme === 'string'
      ? (DIAGRAM_THEMES[dsl.theme] ?? (() => {
          console.warn(`[Diagram] Unknown theme name "${dsl.theme}" — falling back to darkGlass.`);
          return fallbackTheme;
        })())
      : (dsl.theme ?? fallbackTheme);
  const theme: DiagramTheme = resolvedTheme;
  ```

  The inline IIFE for the fallback keeps the type-narrowed single expression. Alternative (cleaner for readability):
  ```ts
  function resolveTheme(raw: DiagramThemeName | DiagramTheme | undefined): DiagramTheme {
    if (raw === undefined) return fallbackTheme;
    if (typeof raw === 'string') {
      const named = DIAGRAM_THEMES[raw];
      if (!named) {
        console.warn(`[Diagram] Unknown theme name "${raw}" — falling back to darkGlass.`);
        return fallbackTheme;
      }
      return named;
    }
    return raw;
  }
  const theme: DiagramTheme = resolveTheme(dsl.theme);
  ```
  **Use the function form.** It is easier to test and read. Place `resolveTheme` as a module-private function near the top of `compile.ts`.

Also update the `DiagramTheme` import in `compile.ts` to also import `DiagramThemeName`:
```ts
import type { ..., DiagramThemeName } from './types';
```
(Only needed if TypeScript infers the parameter type cannot be narrowed without it — verify at compile time. If the union comes through from `DiagramProps` correctly, no import change is needed.)

**`packages/diagram/src/elements/diagram/index.ts`** (public package exports)
- Add `export { DIAGRAM_THEMES } from './themes/index';` so downstream consumers can do dynamic switching.
- Add `export { midnightTheme } from './themes/midnight';`
- Add `export { lightCanvasTheme } from './themes/lightCanvas';`
- Verify `DiagramThemeName` is exported from `types.ts` via the existing export chain.

#### Files this stream MUST NOT touch
`themes/darkGlass.ts`, `themes/midnight.ts`, `themes/neonCyber.ts`, `themes/enterprise.ts`, `themes/lightCanvas.ts`, `themes/lightMinimal.ts` (all theme content files), `types.ts`, `dsl.tsx`, anything in `packages/core` or `packages/charts`.

#### Test files to modify

**`packages/diagram/src/elements/diagram/__tests__/compile.test.ts`**
Add test cases:
- `'resolves string theme name "darkGlass" to darkGlassTheme object'`
- `'resolves string theme name "midnight" to midnightTheme object'`
- `'resolves string theme name "lightCanvas" to lightCanvasTheme object'`
- `'falls back to darkGlassTheme and warns when unknown string name passed'`
- `'still accepts DiagramTheme object directly (regression guard)'`
See Section 9 for full test specifications.

---

### Stream G — Apps/Examples Update (Optional, Non-Blocking)

**Developer count:** 1 (or part of another stream's cleanup)
**Blocking dependency:** All of A, B, C, D, E, F complete
**Estimated scope:** Small — cosmetic updates to example scenes

#### Files to MODIFY
Any scene files in `apps/examples/src/` that import and use `darkGlassTheme`, `neonCyberTheme`, `enterpriseTheme`, `lightMinimalTheme` by object reference. These continue to work without change (the object API is unchanged). Updates are optional ergonomic improvements:
- Replace `<Diagram theme={darkGlassTheme}>` with `<Diagram theme="darkGlass">` in at least one example to demonstrate the string API
- Add one example using `theme="midnight"` and one using `theme="lightCanvas"` to demonstrate new themes

#### Files this stream MUST NOT touch
Package source files. This stream is apps only.

---

## 5. Complete Type Definitions

### 5.1 `DiagramThemeName`

Location: `packages/diagram/src/elements/diagram/types.ts`
Add as the first exported type in the file, before `EdgeRoutingAlgorithm`:

```ts
/**
 * Canonical diagram theme preset names.
 * All six names have matching presets in @brewsite/charts (ChartThemeName).
 * Both unions are maintained independently per package — valid divergence is expected.
 */
export type DiagramThemeName =
  | 'darkGlass'
  | 'midnight'
  | 'neonCyber'
  | 'enterprise'
  | 'lightCanvas'
  | 'lightMinimal';
```

### 5.2 `ChartThemeName`

Location: `packages/charts/src/themes/types.ts:7`
Replace the current 4-name union:

```ts
/** Supported chart theme preset names. */
export type ChartThemeName =
  | 'darkGlass'
  | 'midnight'
  | 'neonCyber'
  | 'enterprise'
  | 'lightCanvas'
  | 'lightMinimal';
```

### 5.3 `DiagramTheme` interface changes

No new fields are added. No required fields are removed. Only values inside existing preset objects change. The `DiagramTheme` interface in `types.ts` is **not modified** by this plan.

Exception: verify that `DiagramThemeEdgeConfig` has an optional `defaultFlowColor?: string` field. Based on code inspection, `darkGlass.ts` uses `defaultFlowColor` but `enterprise.ts` does not — confirming it is optional. The `enterprise` redesign sets `defaultFlowSpeed: 0.0` (required field) to disable flow animation visually. No type change is needed.

### 5.4 `ChartTheme` interface changes

No structural changes to `ChartTheme`. The `name` field accepts any `string` (custom themes); `ChartThemeName` is used only for the `CHART_THEMES` key type and `createChartTheme()` base parameter. No interface modification is required.

### 5.5 `SceneTheme` changes

Location: `packages/core/src/theme/types.ts`
Remove `accentColor?` field (lines 150–156):

```ts
// DELETE THIS:
/**
 * Primary accent color. Drives diagram node palette defaults and chart series[0].
 * Each package may interpret this differently. CSS hex string.
 * @example '#6b48ff'
 */
readonly accentColor?: string;
```

### 5.6 Updated `DiagramProps.theme` type

Location: `packages/diagram/src/elements/diagram/dsl.tsx`, `DiagramProps` interface
Change line `theme?: DiagramTheme;` to:

```ts
/**
 * Theme for the diagram.
 * Pass a preset name string ('darkGlass', 'midnight', etc.) for built-in presets,
 * or a full DiagramTheme object for custom themes.
 * Defaults to darkGlassTheme when absent.
 */
theme?: DiagramThemeName | DiagramTheme;
```

### 5.7 `DIAGRAM_THEMES` constant type

Location: `packages/diagram/src/elements/diagram/themes/index.ts`

```ts
export const DIAGRAM_THEMES: Record<DiagramThemeName, DiagramTheme> = {
  darkGlass:    darkGlassTheme,
  midnight:     midnightTheme,
  neonCyber:    neonCyberTheme,
  enterprise:   enterpriseTheme,
  lightCanvas:  lightCanvasTheme,
  lightMinimal: lightMinimalTheme,
} as const;
```

### 5.8 Updated `CHART_THEMES` constant type

Location: `packages/charts/src/themes/index.ts`
Currently 4 keys; extend to 6:

```ts
export const CHART_THEMES: Record<ChartThemeName, ChartTheme> = {
  darkGlass:    darkGlassChartTheme,
  midnight:     midnightChartTheme,
  neonCyber:    neonCyberChartTheme,
  enterprise:   enterpriseChartTheme,
  lightCanvas:  lightCanvasChartTheme,
  lightMinimal: lightMinimalChartTheme,
} as const;
```

### 5.9 New `SceneTheme` presets (type shapes)

All 6 presets conform to the existing `SceneTheme` type with no new fields.

---

## 6. Complete Color Specifications

### 6.1 `darkGlass`

#### SceneTheme preset (`packages/core/src/theme/presets.ts`)

```ts
export const darkGlassSceneTheme: SceneTheme = {
  colorMode: 'dark',
  font: {
    htmlFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
  background: {
    fill: { kind: 'color', value: '#070b18' },
  },
};
```

#### Diagram theme (`packages/diagram/src/elements/diagram/themes/darkGlass.ts`)

Full replacement for the existing file:

```ts
// Dark Glass theme — deep navy with polished metallic surfaces, coherent blue-violet story.
// This is the package default theme. High visual impact for tech/architecture diagrams.

// SHARED ACCENT PALETTE — must match packages/charts/src/themes/darkGlass.ts
// Index 0–4: diagram node palette[0..4]; indices 0–7: chart series[0..7].color
// '#4455aa', '#2266bb', '#7744cc', '#1188aa', '#335588', '#3dbccc', '#9966ff', '#44aadd'

import type { DiagramTheme } from '../types';

export const darkGlassTheme: DiagramTheme = {
  node: {
    defaultColor:             '#111a35',
    defaultBoxColor:          '#1e2d52',
    defaultMetalness:          0.70,
    defaultRoughness:          0.30,
    defaultEmissiveIntensity:  0.08,
    defaultThickness:          0.58,
    cornerRadius:              0.06,
    glowIntensity:             0.12,
    defaultLabelColor:         '#dce8ff',
    defaultSublabelColor:      '#8898cc',
    labelSizeFactor:           1.0,
    sublabelSizeFactor:        1.0,
    defaultIconStyle:          'extruded',
    defaultSize:               [4, 2] as const,
    defaultIconScale:          0.6,
    defaultIconDepthFactor:    0.5,
    defaultIconDepth:          0.15,
    glowSpread:                2.2,
    sideColorDarkenFactor:     -0.15,
    borderColorLightenFactor:  0.25,
    labelFontSizeBase:         0.28,
    sublabelFontSizeBase:      0.18,
  },
  edge: {
    defaultColor:               '#5040b0',
    defaultFlowColor:           '#00c8f0',
    defaultFlowSpeed:            0.3,
    defaultFlowWidth:            0.20,
    defaultThickness:            0.065,
    defaultMetalness:            0.50,
    defaultRoughness:            0.30,
    routing:                    'flow',
    landing:                    'nearest-face',
    smoothness:                  1.6,
    use3DArrows:                 true,
    tubeRadialSegments:          16,
    organicVariation:            1.6,
    flowTurnRadius:              0.035,
    flowFaceStub:                0.05,
    flowBundleStrength:          0.9,
    flowObstaclePadding:         0.025,
    flowTargetApproachBias:      1.35,
    flowUnderpassDepth:          0.08,
    flowUnderpassClearance:      0.03,
    flowTurnPenalty:             0.45,
    flowPunchthroughPenalty:     500,
    flowUnderpassPenalty:        60,
    flowPulseIntensity:          0.9,
  },
  group: {
    defaultColor:         '#151c38',
    defaultBorderColor:   '#2e3d6e',
    defaultBorderWidth:    0.25,
    defaultBorderHeight:   0.7,
    defaultFillOpacity:    0.10,
    defaultBorderOpacity:  0.85,
    defaultLabelColor:    '#dce8ff',
    borderMetalness:       0.35,
    borderRoughness:       0.45,
    borderSideDarken:      0.40,
    borderEdgeDarken:      0.45,
  },
  environment: {
    envMapUrl:       '/assets/envmaps/diagram-default.hdr',
    envMapIntensity:  0.9,
    skyColor:        '#0a1530',
    horizonColor:    '#182648',
  },
  layout: {
    defaultKind: 'grid',
    grid: {
      columns: 'auto',
      spacing: [1, 1],
      margin: 0,
      groupPadding: 1.5,
      titleGap: 1,
      alignment: 'left',
      disconnected: 'next-to',
    },
    hierarchical: {
      direction: 'top-down',
      spacing: [1.5, 1.5],
      margin: 0,
      groupPadding: 1.5,
      titleGap: 1,
      alignment: 'center',
      disconnected: 'next-to',
    },
    manual: {
      groupPadding: 1.5,
      titleGap: 1,
    },
  },
  palette: ['#4455aa', '#2266bb', '#7744cc', '#1188aa', '#335588'],
} as const;
```

#### Chart theme (`packages/charts/src/themes/darkGlass.ts`)

```ts
// Dark Glass chart theme — deep navy, coherent blue-violet story, glass transmission.

// SHARED ACCENT PALETTE — must match packages/diagram/src/elements/diagram/themes/darkGlass.ts
// Index 0–4: diagram node palette[0..4]; indices 0–7: chart series[0..7].color
// '#4455aa', '#2266bb', '#7744cc', '#1188aa', '#335588', '#3dbccc', '#9966ff', '#44aadd'

import type { ChartTheme } from './types';

export const darkGlassChartTheme: ChartTheme = {
  name: 'darkGlass',
  series: [
    { color: '#4455aa', metalness: 0.2, roughness: 0.18, transmission: 0.28, emissiveIntensity: 0.40, depth: 0.30 },
    { color: '#2266bb', metalness: 0.2, roughness: 0.18, transmission: 0.28, emissiveIntensity: 0.36, depth: 0.30 },
    { color: '#7744cc', metalness: 0.2, roughness: 0.18, transmission: 0.28, emissiveIntensity: 0.32, depth: 0.30 },
    { color: '#1188aa', metalness: 0.2, roughness: 0.18, transmission: 0.28, emissiveIntensity: 0.28, depth: 0.30 },
    { color: '#335588', metalness: 0.2, roughness: 0.18, transmission: 0.28, emissiveIntensity: 0.26, depth: 0.30 },
    { color: '#3dbccc', metalness: 0.2, roughness: 0.18, transmission: 0.28, emissiveIntensity: 0.24, depth: 0.30 },
    { color: '#9966ff', metalness: 0.2, roughness: 0.18, transmission: 0.28, emissiveIntensity: 0.22, depth: 0.30 },
    { color: '#44aadd', metalness: 0.2, roughness: 0.18, transmission: 0.28, emissiveIntensity: 0.20, depth: 0.30 },
  ],
  axis: {
    lineColor:     '#5577bb',
    lineOpacity:    0.90,
    tickOpacity:    0.85,
    labelColor:    '#dce8ff',
    labelOpacity:   0.96,
    fontSize:       0.05,
    tickLength:     0.08,
    gap:            0.18,
    titleFontSize:  0.065,
  },
  background: {
    planeColor:   '#070b18',
    planeOpacity:  0.08,
    gridColor:    '#1a2545',
  },
  legend: {
    textColor:   '#dce8ff',
    fontSize:     0.09,
    swatchSize:   0.08,
    spacing:      0.14,
    gap:          0.28,
    textOpacity:  1.0,
  },
  line: {
    shape:        'circle',
    smoothness:    0.88,
    subdivisions:  10,
  },
  pie: { tilt: -0.35 },
  interaction: {
    hoverColor:             '#ffffff',
    hoverEmissiveIntensity:  0.6,
    selectedColor:          '#ffdd00',
  },
  bar:          { padding: 0.2 },
  area:         { fillOpacity: 0.7 },
  gridlines:    { color: '#2a3a60', opacity: 0.18, visible: false },
  dataLabels:   { fontSize: 0.05, color: '#dce8ff' },
  referenceLines: { defaultColor: '#7744cc', lineWidth: 0.005, lineOpacity: 0.85 },
};
```

---

### 6.2 `midnight`

#### SceneTheme preset

```ts
export const midnightSceneTheme: SceneTheme = {
  colorMode: 'dark',
  font: {
    htmlFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
  background: {
    fill: { kind: 'color', value: '#0d0a07' },
  },
};
```

#### Diagram theme (`packages/diagram/src/elements/diagram/themes/midnight.ts`) — NEW FILE

```ts
// Midnight theme — near-black warm background, amber-gold accent, matte-metal surfaces.
// Warm authority: the only warm dark theme in the toolkit.

// SHARED ACCENT PALETTE — must match packages/charts/src/themes/midnight.ts
// Index 0–4: diagram node palette[0..4]; indices 0–7: chart series[0..7].color
// '#d08c20', '#c24840', '#d4ac30', '#2e8870', '#c05578', '#8a6028', '#6a8430', '#b84530'

import type { DiagramTheme } from '../types';

export const midnightTheme: DiagramTheme = {
  node: {
    defaultColor:             '#18140a',
    defaultBoxColor:          '#252010',
    defaultMetalness:          0.32,
    defaultRoughness:          0.46,
    defaultEmissiveIntensity:  0.06,
    defaultThickness:          0.38,
    cornerRadius:              0.06,
    glowIntensity:             0.0,
    defaultLabelColor:         '#f0e8d8',
    defaultSublabelColor:      '#b0986a',
    labelSizeFactor:           1.0,
    sublabelSizeFactor:        1.0,
    defaultIconStyle:          'extruded',
    defaultSize:               [4, 2] as const,
    defaultIconScale:          0.6,
    defaultIconDepthFactor:    0.5,
    defaultIconDepth:          0.15,
    glowSpread:                2.2,
    sideColorDarkenFactor:     -0.15,
    borderColorLightenFactor:  0.20,
    labelFontSizeBase:         0.28,
    sublabelFontSizeBase:      0.18,
  },
  edge: {
    defaultColor:               '#c8851a',
    defaultFlowColor:           '#f0b030',
    defaultFlowSpeed:            0.28,
    defaultFlowWidth:            0.18,
    defaultThickness:            0.060,
    defaultMetalness:            0.35,
    defaultRoughness:            0.50,
    routing:                    'flow',
    landing:                    'nearest-face',
    smoothness:                  1.4,
    use3DArrows:                 true,
    tubeRadialSegments:          12,
    organicVariation:            1.4,
    flowTurnRadius:              0.035,
    flowFaceStub:                0.05,
    flowBundleStrength:          0.9,
    flowObstaclePadding:         0.025,
    flowTargetApproachBias:      1.35,
    flowUnderpassDepth:          0.08,
    flowUnderpassClearance:      0.03,
    flowTurnPenalty:             0.45,
    flowPunchthroughPenalty:     500,
    flowUnderpassPenalty:        60,
    flowPulseIntensity:          0.85,
  },
  group: {
    defaultColor:         '#120f08',
    defaultBorderColor:   '#2a2010',
    defaultBorderWidth:    0.25,
    defaultBorderHeight:   0.7,
    defaultFillOpacity:    0.12,
    defaultBorderOpacity:  0.80,
    defaultLabelColor:    '#f0e8d8',
    borderMetalness:       0.28,
    borderRoughness:       0.52,
    borderSideDarken:      0.45,
    borderEdgeDarken:      0.50,
  },
  environment: {
    envMapUrl:       '/assets/envmaps/diagram-default.hdr',
    envMapIntensity:  0.5,
    skyColor:        '#1a1208',
    horizonColor:    '#2a2010',
  },
  layout: {
    defaultKind: 'grid',
    grid: {
      columns: 'auto',
      spacing: [1.5, 1.5],
      margin: 0,
      groupPadding: 1.5,
      titleGap: 1,
      alignment: 'left',
      disconnected: 'next-to',
    },
    hierarchical: {
      direction: 'top-down',
      spacing: [1.5, 1.5],
      margin: 0,
      groupPadding: 1.5,
      titleGap: 1,
      alignment: 'center',
      disconnected: 'next-to',
    },
    manual: {
      groupPadding: 1.5,
      titleGap: 1,
    },
  },
  palette: ['#d08c20', '#c24840', '#d4ac30', '#2e8870', '#c05578'],
} as const;
```

#### Chart theme (`packages/charts/src/themes/midnight.ts`) — NEW FILE

```ts
// Midnight chart theme — warm dark, amber-gold accent, matte geometry, low emissive.

// SHARED ACCENT PALETTE — must match packages/diagram/src/elements/diagram/themes/midnight.ts
// Index 0–4: diagram node palette[0..4]; indices 0–7: chart series[0..7].color
// '#d08c20', '#c24840', '#d4ac30', '#2e8870', '#c05578', '#8a6028', '#6a8430', '#b84530'

import type { ChartTheme } from './types';

export const midnightChartTheme: ChartTheme = {
  name: 'midnight',
  series: [
    { color: '#d08c20', metalness: 0.08, roughness: 0.48, transmission: 0.0, emissiveIntensity: 0.28, depth: 0.22 },
    { color: '#c24840', metalness: 0.08, roughness: 0.48, transmission: 0.0, emissiveIntensity: 0.24, depth: 0.22 },
    { color: '#d4ac30', metalness: 0.08, roughness: 0.48, transmission: 0.0, emissiveIntensity: 0.22, depth: 0.22 },
    { color: '#2e8870', metalness: 0.08, roughness: 0.48, transmission: 0.0, emissiveIntensity: 0.20, depth: 0.22 },
    { color: '#c05578', metalness: 0.08, roughness: 0.48, transmission: 0.0, emissiveIntensity: 0.18, depth: 0.22 },
    { color: '#8a6028', metalness: 0.08, roughness: 0.48, transmission: 0.0, emissiveIntensity: 0.16, depth: 0.22 },
    { color: '#6a8430', metalness: 0.08, roughness: 0.48, transmission: 0.0, emissiveIntensity: 0.14, depth: 0.22 },
    { color: '#b84530', metalness: 0.08, roughness: 0.48, transmission: 0.0, emissiveIntensity: 0.12, depth: 0.22 },
  ],
  axis: {
    lineColor:     '#6a5030',
    lineOpacity:    0.88,
    tickOpacity:    0.82,
    labelColor:    '#f0e8d8',
    labelOpacity:   0.94,
    fontSize:       0.05,
    tickLength:     0.08,
    gap:            0.18,
    titleFontSize:  0.065,
  },
  background: {
    planeColor:   '#0d0a07',
    planeOpacity:  0.0,
    gridColor:    '#1e1808',
  },
  legend: {
    textColor:   '#f0e8d8',
    fontSize:     0.09,
    swatchSize:   0.08,
    spacing:      0.14,
    gap:          0.28,
    textOpacity:  0.95,
  },
  line: {
    shape:        'circle',
    smoothness:    0.7,
    subdivisions:  8,
  },
  pie: { tilt: -0.35 },
  interaction: {
    hoverColor:             '#f0e8d8',
    hoverEmissiveIntensity:  0.5,
    selectedColor:          '#f0b030',
  },
  bar:          { padding: 0.22 },
  area:         { fillOpacity: 0.65 },
  gridlines:    { color: '#3a2c18', opacity: 0.20, visible: false },
  dataLabels:   { fontSize: 0.05, color: '#f0e8d8' },
  referenceLines: { defaultColor: '#f0b030', lineWidth: 0.005, lineOpacity: 0.85 },
};
```

---

### 6.3 `neonCyber`

#### SceneTheme preset

```ts
export const neonCyberSceneTheme: SceneTheme = {
  colorMode: 'dark',
  font: {
    htmlFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
  background: {
    fill: { kind: 'color', value: '#030610' },
  },
};
```

#### Diagram theme (`packages/diagram/src/elements/diagram/themes/neonCyber.ts`)

Full replacement for the existing file:

```ts
// Neon Cyber theme — electric violet + laser cyan, high emissive, structured circuit look.

// SHARED ACCENT PALETTE — must match packages/charts/src/themes/neonCyber.ts
// Index 0–4: diagram node palette[0..4]; indices 0–7: chart series[0..7].color
// '#7b2dff', '#00eeff', '#b855ff', '#00ccdd', '#5020cc', '#44ddee', '#9944ff', '#00aacc'

import type { DiagramTheme } from '../types';

export const neonCyberTheme: DiagramTheme = {
  node: {
    defaultColor:             '#060b1a',
    defaultBoxColor:          '#0e1530',
    defaultMetalness:          0.65,
    defaultRoughness:          0.14,
    defaultEmissiveIntensity:  0.28,
    defaultThickness:          0.22,
    cornerRadius:              0.04,
    glowIntensity:             0.60,
    defaultLabelColor:         '#b090ff',
    defaultSublabelColor:      '#8068cc',
    labelSizeFactor:           1.0,
    sublabelSizeFactor:        1.0,
    defaultIconStyle:          'extruded',
    defaultSize:               [4, 2] as const,
    defaultIconScale:          0.6,
    defaultIconDepthFactor:    0.5,
    defaultIconDepth:          0.15,
    glowSpread:                2.8,
    sideColorDarkenFactor:     -0.15,
    borderColorLightenFactor:  0.25,
    labelFontSizeBase:         0.28,
    sublabelFontSizeBase:      0.18,
  },
  edge: {
    defaultColor:               '#7b2dff',
    defaultFlowColor:           '#00eeff',
    defaultFlowSpeed:            0.8,
    defaultFlowWidth:            0.16,
    defaultThickness:            0.055,
    defaultMetalness:            0.70,
    defaultRoughness:            0.12,
    routing:                    'flow',
    landing:                    'nearest-face',
    smoothness:                  1.0,
    use3DArrows:                 true,
    tubeRadialSegments:          12,
    organicVariation:            2.0,
    flowTurnRadius:              0.035,
    flowFaceStub:                0.05,
    flowBundleStrength:          1.0,
    flowObstaclePadding:         0.025,
    flowTargetApproachBias:      1.35,
    flowUnderpassDepth:          0.08,
    flowUnderpassClearance:      0.03,
    flowTurnPenalty:             0.45,
    flowPunchthroughPenalty:     500,
    flowUnderpassPenalty:        60,
    flowPulseIntensity:          0.95,
  },
  group: {
    defaultColor:         '#050810',
    defaultBorderColor:   '#7b2dff',
    defaultBorderWidth:    1.75,
    defaultBorderHeight:   1.0,
    defaultFillOpacity:    0.07,
    defaultBorderOpacity:  0.80,
    defaultLabelColor:    '#b090ff',
    borderMetalness:       0.60,
    borderRoughness:       0.18,
    borderSideDarken:      0.35,
    borderEdgeDarken:      0.40,
  },
  environment: {
    envMapUrl:       '/assets/envmaps/diagram-default.hdr',
    envMapIntensity:  0.6,
    skyColor:        '#010310',
    horizonColor:    '#06102a',
  },
  layout: {
    defaultKind: 'grid',
    grid: {
      columns: 'auto',
      spacing: [2, 2],
      margin: 0,
      groupPadding: 1.5,
      titleGap: 0.75,
      alignment: 'left',
      disconnected: 'next-to',
    },
    hierarchical: {
      direction: 'top-down',
      spacing: [1.5, 1.5],
      margin: 0,
      groupPadding: 1.5,
      titleGap: 0.75,
      alignment: 'center',
      disconnected: 'next-to',
    },
    manual: {
      groupPadding: 1.5,
      titleGap: 0.75,
    },
  },
  palette: ['#7b2dff', '#00eeff', '#b855ff', '#00ccdd', '#5020cc'],
} as const;
```

#### Chart theme (`packages/charts/src/themes/neonCyber.ts`)

```ts
// Neon Cyber chart theme — electric violet primary, laser cyan secondary, stepped emissive.

// SHARED ACCENT PALETTE — must match packages/diagram/src/elements/diagram/themes/neonCyber.ts
// Index 0–4: diagram node palette[0..4]; indices 0–7: chart series[0..7].color
// '#7b2dff', '#00eeff', '#b855ff', '#00ccdd', '#5020cc', '#44ddee', '#9944ff', '#00aacc'

import type { ChartTheme } from './types';

export const neonCyberChartTheme: ChartTheme = {
  name: 'neonCyber',
  series: [
    { color: '#7b2dff', metalness: 0.12, roughness: 0.08, transmission: 0.0, emissiveIntensity: 0.90, depth: 0.22 },
    { color: '#00eeff', metalness: 0.12, roughness: 0.08, transmission: 0.0, emissiveIntensity: 0.85, depth: 0.22 },
    { color: '#b855ff', metalness: 0.12, roughness: 0.08, transmission: 0.0, emissiveIntensity: 0.82, depth: 0.22 },
    { color: '#00ccdd', metalness: 0.12, roughness: 0.08, transmission: 0.0, emissiveIntensity: 0.78, depth: 0.22 },
    { color: '#5020cc', metalness: 0.12, roughness: 0.08, transmission: 0.0, emissiveIntensity: 0.74, depth: 0.22 },
    { color: '#44ddee', metalness: 0.12, roughness: 0.08, transmission: 0.0, emissiveIntensity: 0.70, depth: 0.22 },
    { color: '#9944ff', metalness: 0.12, roughness: 0.08, transmission: 0.0, emissiveIntensity: 0.66, depth: 0.22 },
    { color: '#00aacc', metalness: 0.12, roughness: 0.08, transmission: 0.0, emissiveIntensity: 0.62, depth: 0.22 },
  ],
  axis: {
    lineColor:     '#7b2dff',
    lineOpacity:    0.90,
    tickOpacity:    0.88,
    labelColor:    '#b090ff',
    labelOpacity:   1.0,
    fontSize:       0.05,
    tickLength:     0.08,
    gap:            0.18,
    titleFontSize:  0.06,
  },
  background: {
    planeColor:   '#030610',
    planeOpacity:  1.0,
    gridColor:    '#0a0a1e',
  },
  legend: {
    textColor:   '#b090ff',
    fontSize:     0.09,
    swatchSize:   0.08,
    spacing:      0.14,
    gap:          0.28,
    textOpacity:  1.0,
  },
  line: {
    shape:        'hexagon',
    smoothness:    0.82,
    subdivisions:  7,
  },
  pie: { tilt: -0.35 },
  interaction: {
    hoverColor:             '#ffffff',
    hoverEmissiveIntensity:  1.2,
    selectedColor:          '#00eeff',
  },
  bar:          { padding: 0.15 },
  area:         { fillOpacity: 0.65 },
  gridlines:    { color: '#7b2dff', opacity: 0.12, visible: false, dashSize: 0.03, gapSize: 0.02 },
  dataLabels:   { fontSize: 0.048, color: '#b090ff' },
  referenceLines: { defaultColor: '#00eeff', lineWidth: 0.005, lineOpacity: 0.9 },
};
```

---

### 6.4 `enterprise`

#### SceneTheme preset

```ts
export const enterpriseSceneTheme: SceneTheme = {
  colorMode: 'dark',
  font: {
    htmlFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
  background: {
    fill: { kind: 'color', value: '#0a1525' },
  },
};
```

#### Diagram theme (`packages/diagram/src/elements/diagram/themes/enterprise.ts`)

Full replacement for the existing file:

```ts
// Enterprise theme — polished slate-blue, professional matte, no glow, no flow.
// Board-ready: data matters, not presentation effects.

// SHARED ACCENT PALETTE — must match packages/charts/src/themes/enterprise.ts
// Index 0–4: diagram node palette[0..4]; indices 0–7: chart series[0..7].color
// '#3a5fa0', '#38766a', '#c87830', '#5a4e7a', '#2e7280', '#7a5c38', '#456040', '#7a3840'

import type { DiagramTheme } from '../types';

export const enterpriseTheme: DiagramTheme = {
  node: {
    defaultColor:             '#182844',
    defaultBoxColor:          '#243d60',
    defaultMetalness:          0.16,
    defaultRoughness:          0.53,
    defaultEmissiveIntensity:  0.04,
    defaultThickness:          0.32,
    cornerRadius:              0.05,
    glowIntensity:             0.0,
    defaultLabelColor:         '#e8f0ff',
    defaultSublabelColor:      '#8898c0',
    labelSizeFactor:           1.0,
    sublabelSizeFactor:        1.0,
    defaultIconStyle:          'flat',
    defaultSize:               [4, 2] as const,
    defaultIconScale:          0.6,
    defaultIconDepthFactor:    0.5,
    defaultIconDepth:          0.15,
    glowSpread:                2.2,
    sideColorDarkenFactor:     -0.15,
    borderColorLightenFactor:  0.25,
    labelFontSizeBase:         0.28,
    sublabelFontSizeBase:      0.18,
  },
  edge: {
    defaultColor:               '#3a6aaa',
    defaultFlowSpeed:            0.0,
    defaultFlowWidth:            0.18,
    defaultThickness:            0.070,
    defaultMetalness:            0.12,
    defaultRoughness:            0.55,
    routing:                    'flow',
    landing:                    'nearest-face',
    smoothness:                  1.0,
    use3DArrows:                 false,
    tubeRadialSegments:          8,
    organicVariation:            0.8,
    flowTurnRadius:              0.035,
    flowFaceStub:                0.05,
    flowBundleStrength:          1.0,
    flowObstaclePadding:         0.025,
    flowTargetApproachBias:      1.35,
    flowUnderpassDepth:          0.08,
    flowUnderpassClearance:      0.03,
    flowTurnPenalty:             0.45,
    flowPunchthroughPenalty:     500,
    flowUnderpassPenalty:        60,
    flowPulseIntensity:          0.9,
  },
  group: {
    defaultColor:         '#0f1e38',
    defaultBorderColor:   '#243d60',
    defaultBorderWidth:    1.25,
    defaultBorderHeight:   1.0,
    defaultFillOpacity:    0.09,
    defaultBorderOpacity:  0.55,
    defaultLabelColor:    '#e8f0ff',
    borderMetalness:       0.12,
    borderRoughness:       0.58,
    borderSideDarken:      0.50,
    borderEdgeDarken:      0.55,
  },
  environment: {
    envMapUrl:       '/assets/envmaps/diagram-default.hdr',
    envMapIntensity:  0.75,
    skyColor:        '#0a1828',
    horizonColor:    '#182840',
  },
  layout: {
    defaultKind: 'grid',
    grid: {
      columns: 'auto',
      spacing: [2, 2],
      margin: 0,
      groupPadding: 1.5,
      titleGap: 0.75,
      alignment: 'left',
      disconnected: 'next-to',
    },
    hierarchical: {
      direction: 'top-down',
      spacing: [1.5, 1.5],
      margin: 0,
      groupPadding: 1.5,
      titleGap: 0.75,
      alignment: 'center',
      disconnected: 'next-to',
    },
    manual: {
      groupPadding: 1.5,
      titleGap: 0.75,
    },
  },
  palette: ['#3a5fa0', '#38766a', '#c87830', '#5a4e7a', '#2e7280'],
} as const;
```

#### Chart theme (`packages/charts/src/themes/enterprise.ts`)

```ts
// Enterprise chart theme — professional slate-blue palette, near-zero emissive, matte finish.

// SHARED ACCENT PALETTE — must match packages/diagram/src/elements/diagram/themes/enterprise.ts
// Index 0–4: diagram node palette[0..4]; indices 0–7: chart series[0..7].color
// '#3a5fa0', '#38766a', '#c87830', '#5a4e7a', '#2e7280', '#7a5c38', '#456040', '#7a3840'

import type { ChartTheme } from './types';

export const enterpriseChartTheme: ChartTheme = {
  name: 'enterprise',
  series: [
    { color: '#3a5fa0', metalness: 0.04, roughness: 0.62, transmission: 0.0, emissiveIntensity: 0.04, depth: 0.26 },
    { color: '#38766a', metalness: 0.04, roughness: 0.62, transmission: 0.0, emissiveIntensity: 0.04, depth: 0.26 },
    { color: '#c87830', metalness: 0.04, roughness: 0.62, transmission: 0.0, emissiveIntensity: 0.04, depth: 0.26 },
    { color: '#5a4e7a', metalness: 0.04, roughness: 0.62, transmission: 0.0, emissiveIntensity: 0.04, depth: 0.26 },
    { color: '#2e7280', metalness: 0.04, roughness: 0.62, transmission: 0.0, emissiveIntensity: 0.04, depth: 0.26 },
    { color: '#7a5c38', metalness: 0.04, roughness: 0.62, transmission: 0.0, emissiveIntensity: 0.04, depth: 0.26 },
    { color: '#456040', metalness: 0.04, roughness: 0.62, transmission: 0.0, emissiveIntensity: 0.04, depth: 0.26 },
    { color: '#7a3840', metalness: 0.04, roughness: 0.62, transmission: 0.0, emissiveIntensity: 0.04, depth: 0.26 },
  ],
  axis: {
    lineColor:     '#3a6aaa',
    lineOpacity:    0.90,
    tickOpacity:    0.85,
    labelColor:    '#e8f0ff',
    labelOpacity:   0.94,
    fontSize:       0.05,
    tickLength:     0.08,
    gap:            0.18,
    titleFontSize:  0.055,
  },
  background: {
    planeColor:   '#0f1e38',
    planeOpacity:  0.10,
    gridColor:    '#243d60',
  },
  legend: {
    textColor:   '#e8f0ff',
    fontSize:     0.09,
    swatchSize:   0.08,
    spacing:      0.14,
    gap:          0.28,
    textOpacity:  0.90,
  },
  line: {
    shape:        'line',
    smoothness:    0.0,
    subdivisions:  3,
  },
  pie: { tilt: -0.35 },
  interaction: {
    hoverColor:             '#6688cc',
    hoverEmissiveIntensity:  0.25,
    selectedColor:          '#c87830',
  },
  bar:          { padding: 0.25 },
  area:         { fillOpacity: 0.60 },
  gridlines:    { color: '#2a3d5a', opacity: 0.20, visible: false },
  dataLabels:   { fontSize: 0.045, color: '#e8f0ff' },
  referenceLines: { defaultColor: '#c87830', lineWidth: 0.004, lineOpacity: 0.80 },
};
```

---

### 6.5 `lightCanvas`

#### SceneTheme preset

```ts
export const lightCanvasSceneTheme: SceneTheme = {
  colorMode: 'light',
  font: {
    htmlFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
  background: {
    fill: { kind: 'color', value: '#f0f2f4' },
  },
};
```

#### Diagram theme (`packages/diagram/src/elements/diagram/themes/lightCanvas.ts`) — NEW FILE

```ts
// Light Canvas theme — white ceramic nodes, warm neutral background, jewel-tone accents.
// Premium light theme: physical depth and visual richness without IBL reflections.

// SHARED ACCENT PALETTE — must match packages/charts/src/themes/lightCanvas.ts
// Index 0–4: diagram node palette[0..4]; indices 0–7: chart series[0..7].color
// '#3355cc', '#1a9966', '#cc3355', '#cc8800', '#6644bb', '#0088aa', '#996622', '#448822'

import type { DiagramTheme } from '../types';

export const lightCanvasTheme: DiagramTheme = {
  node: {
    defaultColor:             '#ffffff',
    defaultBoxColor:          '#f0f4fa',
    defaultMetalness:          0.04,
    defaultRoughness:          0.58,
    defaultEmissiveIntensity:  0.0,
    defaultThickness:          0.20,
    cornerRadius:              0.09,
    glowIntensity:             0.0,
    defaultLabelColor:         '#18202c',
    defaultSublabelColor:      '#4a5a80',
    labelSizeFactor:           1.0,
    sublabelSizeFactor:        1.0,
    defaultIconStyle:          'flat',
    defaultSize:               [4, 2] as const,
    defaultIconScale:          0.6,
    defaultIconDepthFactor:    0.5,
    defaultIconDepth:          0.10,
    glowSpread:                2.2,
    sideColorDarkenFactor:     -0.08,
    borderColorLightenFactor:  0.15,
    labelFontSizeBase:         0.28,
    sublabelFontSizeBase:      0.18,
  },
  edge: {
    defaultColor:               '#3a5fa8',
    defaultFlowColor:           '#1a5fd8',
    defaultFlowSpeed:            0.6,
    defaultFlowWidth:            0.16,
    defaultThickness:            0.055,
    defaultMetalness:            0.06,
    defaultRoughness:            0.62,
    routing:                    'flow',
    landing:                    'nearest-face',
    smoothness:                  1.2,
    use3DArrows:                 false,
    tubeRadialSegments:          8,
    organicVariation:            1.0,
    flowTurnRadius:              0.035,
    flowFaceStub:                0.05,
    flowBundleStrength:          1.0,
    flowObstaclePadding:         0.025,
    flowTargetApproachBias:      1.35,
    flowUnderpassDepth:          0.08,
    flowUnderpassClearance:      0.03,
    flowTurnPenalty:             0.45,
    flowPunchthroughPenalty:     500,
    flowUnderpassPenalty:        60,
    flowPulseIntensity:          0.85,
  },
  group: {
    defaultColor:         '#e8edf6',
    defaultBorderColor:   '#b8c5dc',
    defaultBorderWidth:    1.25,
    defaultBorderHeight:   1.0,
    defaultFillOpacity:    0.40,
    defaultBorderOpacity:  0.65,
    defaultLabelColor:    '#18202c',
    borderMetalness:       0.04,
    borderRoughness:       0.65,
    borderSideDarken:      0.55,
    borderEdgeDarken:      0.60,
  },
  environment: {
    envMapUrl:       'none',
    envMapIntensity:  0,
    skyColor:        '#ffffff',
    horizonColor:    '#e0e8f8',
  },
  layout: {
    defaultKind: 'grid',
    grid: {
      columns: 'auto',
      spacing: [2, 2],
      margin: 0,
      groupPadding: 1.5,
      titleGap: 0.75,
      alignment: 'left',
      disconnected: 'next-to',
    },
    hierarchical: {
      direction: 'top-down',
      spacing: [1.5, 1.5],
      margin: 0,
      groupPadding: 1.5,
      titleGap: 0.75,
      alignment: 'center',
      disconnected: 'next-to',
    },
    manual: {
      groupPadding: 1.5,
      titleGap: 0.75,
    },
  },
  palette: ['#3355cc', '#1a9966', '#cc3355', '#cc8800', '#6644bb'],
} as const;
```

#### Chart theme (`packages/charts/src/themes/lightCanvas.ts`) — NEW FILE

```ts
// Light Canvas chart theme — warm neutral background, jewel-tone series, zero emissive.

// SHARED ACCENT PALETTE — must match packages/diagram/src/elements/diagram/themes/lightCanvas.ts
// Index 0–4: diagram node palette[0..4]; indices 0–7: chart series[0..7].color
// '#3355cc', '#1a9966', '#cc3355', '#cc8800', '#6644bb', '#0088aa', '#996622', '#448822'

import type { ChartTheme } from './types';

export const lightCanvasChartTheme: ChartTheme = {
  name: 'lightCanvas',
  series: [
    { color: '#3355cc', metalness: 0.02, roughness: 0.72, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.18 },
    { color: '#1a9966', metalness: 0.02, roughness: 0.72, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.18 },
    { color: '#cc3355', metalness: 0.02, roughness: 0.72, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.18 },
    { color: '#cc8800', metalness: 0.02, roughness: 0.72, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.18 },
    { color: '#6644bb', metalness: 0.02, roughness: 0.72, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.18 },
    { color: '#0088aa', metalness: 0.02, roughness: 0.72, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.18 },
    { color: '#996622', metalness: 0.02, roughness: 0.72, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.18 },
    { color: '#448822', metalness: 0.02, roughness: 0.72, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.18 },
  ],
  axis: {
    lineColor:     '#8090a0',
    lineOpacity:    0.85,
    tickOpacity:    0.80,
    labelColor:    '#18202c',
    labelOpacity:   0.94,
    fontSize:       0.05,
    tickLength:     0.08,
    gap:            0.18,
    titleFontSize:  0.055,
  },
  background: {
    planeColor:   '#f0f2f4',
    planeOpacity:  1.0,
    gridColor:    '#d8dce4',
  },
  legend: {
    textColor:   '#18202c',
    fontSize:     0.09,
    swatchSize:   0.08,
    spacing:      0.14,
    gap:          0.28,
    textOpacity:  1.0,
  },
  line: {
    shape:        'circle',
    smoothness:    0.5,
    subdivisions:  6,
  },
  pie: { tilt: -0.35 },
  interaction: {
    hoverColor:             '#1a3a99',
    hoverEmissiveIntensity:  0.15,
    selectedColor:          '#cc8800',
  },
  bar:          { padding: 0.22 },
  area:         { fillOpacity: 0.70 },
  gridlines:    { color: '#c0c8d4', opacity: 0.28, visible: false },
  dataLabels:   { fontSize: 0.044, color: '#18202c' },
  referenceLines: { defaultColor: '#cc3355', lineWidth: 0.004, lineOpacity: 0.80 },
};
```

---

### 6.6 `lightMinimal`

#### SceneTheme preset

```ts
export const lightMinimalSceneTheme: SceneTheme = {
  colorMode: 'light',
  font: {
    htmlFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
  background: {
    fill: { kind: 'color', value: '#ffffff' },
  },
};
```

#### Diagram theme (`packages/diagram/src/elements/diagram/themes/lightMinimal.ts`)

Only change: add the shared accent palette comment block at the top of the file. No values change.

```ts
// Light Minimal theme — white/light backgrounds, high contrast, no IBL.
// Suited for documentation, diagrams in white-background contexts.

// SHARED ACCENT PALETTE — must match packages/charts/src/themes/lightMinimal.ts
// Index 0–4: diagram node palette[0..4]; indices 0–7: chart series[0..7].color
// (lightMinimal does not define a node palette[] array; these are the chart series colors only)
// '#93c5fd', '#c4b5fd', '#86efac', '#fca5a5', '#fde68a', '#67e8f9', '#d9f99d', '#fed7aa'

// ... rest of file unchanged
```

**Note:** `lightMinimalTheme` has no `palette` array. The comment block is informational only — it documents the chart series colors so a code reviewer can verify cross-package coordination. The diagram uses its default node colors without cycling.

#### Chart theme (`packages/charts/src/themes/lightMinimal.ts`)

Two changes:
1. Add the shared accent palette comment block.
2. Change all 8 series `depth` values from `0.2` to `0.16`.

The existing series colors (`#93c5fd`, `#c4b5fd`, `#86efac`, `#fca5a5`, `#fde68a`, `#67e8f9`, `#d9f99d`, `#fed7aa`) are **preserved unchanged** — per the feature note, this palette is the most carefully assembled in the codebase.

---

## 7. Migration and Semver

### Version bumps

| Package | Change | Semver |
|---|---|---|
| `@brewsite/core` | Remove `accentColor?` from `SceneTheme`; add 6 new presets | Minor (addition) + technical breaking (removal of optional field). Treat as minor per product policy: removing an undocumented optional field with no tested consumers in the published packages is a documentation change, not a breaking API change. However, `packages/slides` is a known breakage — coordinate with slides team before publishing. |
| `@brewsite/diagram` | Add `DiagramThemeName`, `DIAGRAM_THEMES`, string `theme` prop, 2 new themes, palette redesigns | Minor |
| `@brewsite/charts` | Add 2 new theme presets, update `ChartThemeName`, palette redesigns | Minor |
| `@brewsite/model` | No changes | No bump |

### CHANGELOG entry (all packages, identical framing)

Write the following entry under each package's CHANGELOG section for this release:

**`@brewsite/diagram` CHANGELOG:**
```
## [minor] Theme Redesign — Six Canonical Themes + String Name API

### Added
- `DiagramThemeName` union type: 'darkGlass' | 'midnight' | 'neonCyber' | 'enterprise' | 'lightCanvas' | 'lightMinimal'
- `DIAGRAM_THEMES: Record<DiagramThemeName, DiagramTheme>` — keyed preset registry
- `<Diagram theme="darkGlass">` string name API — union widening of the `theme` prop (non-breaking)
- `midnightTheme` — new warm dark theme with amber-gold accent palette
- `lightCanvasTheme` — new premium light theme with jewel-tone accent palette

### Changed (Visual, Non-Breaking)
- `darkGlassTheme` palette redesigned: monochromatic cool blue family, no warm accents
- `neonCyberTheme` palette redesigned: electric violet + laser cyan with semantic color roles
- `enterpriseTheme` palette redesigned: curated professional palette replacing Tailwind defaults
- All redesigned presets include cross-package palette comment blocks for coherence documentation
- Flow animation disabled by default in `enterpriseTheme` (defaultFlowSpeed: 0.0)
```

**`@brewsite/charts` CHANGELOG:**
```
## [minor] Theme Redesign — Six Canonical Themes

### Added
- `ChartThemeName` extended: adds 'midnight' and 'lightCanvas'
- `midnightChartTheme` — new warm dark theme, stepped emissive [0.28..0.12]
- `lightCanvasChartTheme` — new premium light theme, zero emissive, jewel-tone palette

### Changed (Visual, Non-Breaking)
- `darkGlassChartTheme` series redesigned: monochromatic cool blue palette, stepped emissive [0.40..0.20]
- `neonCyberChartTheme` series redesigned: violet/cyan two-color story, stepped emissive [0.90..0.62]
- `enterpriseChartTheme` series redesigned: curated professional palette, uniform emissive 0.04
- `lightMinimalChartTheme`: series depth reduced 0.20→0.16 (minimal 3D effect); palette unchanged
```

**`@brewsite/core` CHANGELOG:**
```
## [minor] SceneTheme presets + accentColor removal

### Added
- `darkGlassSceneTheme`, `midnightSceneTheme`, `neonCyberSceneTheme`, `enterpriseSceneTheme`,
  `lightCanvasSceneTheme`, `lightMinimalSceneTheme` — per-theme-family SceneTheme presets

### Removed
- `SceneTheme.accentColor` optional field — was documented as driving diagram/chart defaults
  but was not implemented in any diagram or chart renderer. Removed to prevent confusion.
  The `--brewsite-accent-color` CSS custom property is no longer injected.
  Migration: if you used `accentColor` to drive custom CSS via `--brewsite-accent-color`,
  inject the CSS variable directly in your own stylesheet instead.
```

---

## 8. Implementation Sequence

```
Phase 1 — Parallel start (all streams launch simultaneously):
  Stream A  packages/core theme changes
  Stream B  packages/diagram types + DSL
  Stream C  packages/diagram dark theme content
  Stream D  packages/diagram light theme content
  Stream E  packages/charts theme content + infrastructure

Phase 2 — After B, C, D all merge:
  Stream F  packages/diagram themes/index.ts + compile.ts integration

Phase 3 — After A, B, C, D, E, F all merge:
  Stream G  apps/examples optional ergonomic updates (can be skipped for shipping)

Phase 4 — Architect verification:
  Task #6 verification checklist review (see Section 10)
```

**Sequencing rationale:**
- A is independent of all diagram/chart work (different package).
- B, C, D, E share no files with each other — all can start Day 1.
- F requires B (for `DiagramThemeName` type in types.ts), C (for midnight.ts), and D (for lightCanvas.ts) because `DIAGRAM_THEMES` references all 6 themes and TypeScript will fail to compile if any theme file is absent.
- G is aesthetic only; blocking is acceptable.

**Merge order within a PR:** Each stream should be its own PR. PR merges can happen in any order for A, B, C, D, E. PR F cannot be created until B, C, D PRs are merged (it requires their files to compile).

---

## 9. Test Strategy

### Stream A tests

**File: `packages/core/src/theme/__tests__/presets.test.ts`**

Add the following test cases (use `describe('new named presets', () => {` block):

```
'darkGlassSceneTheme has colorMode dark'
  → expect(darkGlassSceneTheme.colorMode).toBe('dark')

'darkGlassSceneTheme background fill is #070b18'
  → expect(darkGlassSceneTheme.background?.fill).toEqual({ kind: 'color', value: '#070b18' })

'midnightSceneTheme has colorMode dark'
  → expect(midnightSceneTheme.colorMode).toBe('dark')

'midnightSceneTheme background fill is #0d0a07'
  → expect(midnightSceneTheme.background?.fill).toEqual({ kind: 'color', value: '#0d0a07' })

'neonCyberSceneTheme has colorMode dark and background #030610'
  → both assertions in one test

'enterpriseSceneTheme has colorMode dark and background #0a1525'

'lightCanvasSceneTheme has colorMode light'
  → expect(lightCanvasSceneTheme.colorMode).toBe('light')

'lightCanvasSceneTheme background fill is #f0f2f4'

'lightMinimalSceneTheme has colorMode light and background #ffffff'

'all 6 new presets have all required fontSize scale keys'
  → verify heading, body, label, caption, annotation all present and numeric for each preset

'all 6 new presets have font.htmlFamily set'
```

**File: `packages/core/src/player/__tests__/EngineOverlayHost.test.tsx`**

- Delete the two `accentColor`-related test cases (they test behavior that no longer exists).
- Verify the test suite still passes at 100% for EngineOverlayHost.

### Stream E tests

**File: `packages/charts/src/themes/__tests__/createChartTheme.test.ts`**

Add a `describe('new theme names midnight and lightCanvas', () => {` block containing:

```
'createChartTheme("midnight", {}) returns theme with name "midnight"'
  → expect(result.name).toBe('midnight')

'createChartTheme("midnight", {}) has 8 series'
  → expect(result.series).toHaveLength(8)

'createChartTheme("midnight", {}) series[0].color is #d08c20'
  → expect(result.series[0]?.color).toBe('#d08c20')

'createChartTheme("lightCanvas", {}) returns theme with name "lightCanvas"'

'createChartTheme("lightCanvas", {}) series[0].color is #3355cc'

'createChartTheme("lightCanvas", {}) series[0].emissiveIntensity is 0.0'
  → verify zero emissive for the light theme

'createChartTheme("midnight", { series: [{ color: "#ff0000" }] }) overrides series[0] color'
  → verify override still works for new theme names
```

Add a `describe('CHART_THEMES registry completeness', () => {` block:

```
'CHART_THEMES contains exactly 6 keys'
  → import { CHART_THEMES } from '../index'
  → expect(Object.keys(CHART_THEMES)).toHaveLength(6)

'CHART_THEMES.midnight resolves to midnightChartTheme'
  → expect(CHART_THEMES.midnight).toBeDefined()
  → expect(CHART_THEMES.midnight.name).toBe('midnight')

'CHART_THEMES.lightCanvas resolves to lightCanvasChartTheme'
  → expect(CHART_THEMES.lightCanvas).toBeDefined()
  → expect(CHART_THEMES.lightCanvas.name).toBe('lightCanvas')

'CHART_THEMES contains all 6 canonical keys'
  → expect(CHART_THEMES).toHaveProperty('darkGlass')
  → expect(CHART_THEMES).toHaveProperty('midnight')
  → expect(CHART_THEMES).toHaveProperty('neonCyber')
  → expect(CHART_THEMES).toHaveProperty('enterprise')
  → expect(CHART_THEMES).toHaveProperty('lightCanvas')
  → expect(CHART_THEMES).toHaveProperty('lightMinimal')
```

Add a `describe('neonCyber stepped emissive intensities', () => {` block:

```
'neonCyber chart theme series emissive intensities are stepped (not uniform)'
  → const theme = CHART_THEMES.neonCyber
  → expect(theme.series[0]!.emissiveIntensity).toBeGreaterThan(theme.series[7]!.emissiveIntensity)

'neonCyber series[0] emissiveIntensity is exactly 0.90'
  → expect(CHART_THEMES.neonCyber.series[0]!.emissiveIntensity).toBe(0.90)

'neonCyber series[7] emissiveIntensity is exactly 0.62'
  → expect(CHART_THEMES.neonCyber.series[7]!.emissiveIntensity).toBe(0.62)
```

This last group explicitly encodes the requirement from the feature note that uniform emissive across all 8 neonCyber series is a verified defect. A developer who accidentally copies uniform values will fail these tests.

### Stream F tests

**File: `packages/diagram/src/elements/diagram/__tests__/compile.test.ts`**

Add a `describe('string theme name resolution', () => {` block:

```
'compile resolves string "darkGlass" to darkGlassTheme node defaultColor #111a35'
  → call compileDiagram with theme: "darkGlass", check output themeConfig matches darkGlassTheme

'compile resolves string "midnight" to midnightTheme node defaultColor #18140a'
  → same pattern for midnight

'compile resolves string "lightCanvas" to lightCanvasTheme node defaultColor #ffffff'

'compile falls back to darkGlassTheme when unknown theme name passed'
  → call with theme: "unknownTheme" as any, expect output matches darkGlass defaults
  → expect console.warn to have been called with a message containing the unknown name

'compile still accepts full DiagramTheme object (regression)'
  → pass darkGlassTheme object directly, expect output is identical to passing "darkGlass" string

'compile uses darkGlass default when no theme is passed (regression)'
  → pass undefined theme, expect darkGlass defaults
```

**Test implementation note for Stream F:** Use `vi.spyOn(console, 'warn')` in the `console.warn` test case to capture the warning without printing it to the test output. Restore the spy in `afterEach`.

Also add a `describe('DIAGRAM_THEMES registry completeness', () => {` block — place this in `compile.test.ts` or in a new co-located `themes/index.test.ts` file. The latter is preferred since it tests the registry directly rather than through `compile.ts`:

```
'DIAGRAM_THEMES contains exactly 6 keys'
  → import { DIAGRAM_THEMES } from '../themes/index'
  → expect(Object.keys(DIAGRAM_THEMES)).toHaveLength(6)

'DIAGRAM_THEMES contains all canonical theme names'
  → expect(DIAGRAM_THEMES).toHaveProperty('darkGlass')
  → expect(DIAGRAM_THEMES).toHaveProperty('midnight')
  → expect(DIAGRAM_THEMES).toHaveProperty('neonCyber')
  → expect(DIAGRAM_THEMES).toHaveProperty('enterprise')
  → expect(DIAGRAM_THEMES).toHaveProperty('lightCanvas')
  → expect(DIAGRAM_THEMES).toHaveProperty('lightMinimal')

'DIAGRAM_THEMES.midnight is a valid DiagramTheme with expected node defaultColor'
  → expect(DIAGRAM_THEMES.midnight.node.defaultColor).toBe('#18140a')

'DIAGRAM_THEMES.lightCanvas is a valid DiagramTheme with expected node defaultColor'
  → expect(DIAGRAM_THEMES.lightCanvas.node.defaultColor).toBe('#ffffff')
```

If placed in a new file, create it at: `packages/diagram/src/elements/diagram/themes/__tests__/index.test.ts`

**Rationale:** Without this test, a developer who accidentally omits `lightMinimal` from `DIAGRAM_THEMES` in `themes/index.ts` would produce a runtime silent fallback in production. The 6-key assertion is a hard guard against that class of omission.

**Test helper note:** Stream F tests must import the fully-typed `DiagramThemeName` — the test file should not use `as any` except for the explicit "unknown name" test case.

---

## 10. Verification Checklist

The architect performs this verification in Task #6 after all PRs merge.

### Type System
- [ ] `DiagramThemeName` is exported from `@brewsite/diagram` public surface
- [ ] `DIAGRAM_THEMES` is exported from `@brewsite/diagram` public surface
- [ ] `ChartThemeName` has exactly 6 members: darkGlass, midnight, neonCyber, enterprise, lightCanvas, lightMinimal
- [ ] `DiagramThemeName` has exactly 6 members (same set)
- [ ] `SceneTheme.accentColor` field does not exist in `packages/core/src/theme/types.ts`
- [ ] `DiagramProps.theme` accepts string literals `'darkGlass'`, `'midnight'`, etc. without type error
- [ ] `DiagramProps.theme` still accepts a `DiagramTheme` object without type error
- [ ] `pnpm typecheck` passes on all packages with zero errors

### Runtime Behavior
- [ ] `<Diagram theme="darkGlass">` compiles without error (no runtime exception)
- [ ] `<Diagram theme="midnight">` compiles and renders warm dark output
- [ ] `<Diagram theme="lightCanvas">` compiles and renders on a warm gray background
- [ ] `<Diagram theme="unknownName">` falls back gracefully, warns in console, renders darkGlass
- [ ] `<Diagram theme={darkGlassTheme}>` object form still works identically (regression)
- [ ] `createChartTheme('midnight', {})` returns a valid ChartTheme
- [ ] `createChartTheme('lightCanvas', {})` returns a valid ChartTheme
- [ ] `CHART_THEMES.midnight` and `CHART_THEMES.lightCanvas` are accessible

### Palette Coherence
- [ ] `darkGlass` diagram `palette[0]` matches `darkGlass` chart `series[0].color` — both `#4455aa`
- [ ] `midnight` diagram `palette[0]` matches `midnight` chart `series[0].color` — both `#d08c20`
- [ ] `neonCyber` diagram `palette[0]` matches `neonCyber` chart `series[0].color` — both `#7b2dff`
- [ ] `enterprise` diagram `palette[0]` matches `enterprise` chart `series[0].color` — both `#3a5fa0`
- [ ] `lightCanvas` diagram `palette[0]` matches `lightCanvas` chart `series[0].color` — both `#3355cc`
- [ ] `lightMinimal` comment block values match `lightMinimal` chart series colors (unchanged)
- [ ] Every dark diagram theme file contains the SHARED ACCENT PALETTE comment block
- [ ] Every dark chart theme file contains the SHARED ACCENT PALETTE comment block

### Visual Quality (Manual Review)
- [ ] `darkGlass` renders monochromatic cool blue — no warm accents present
- [ ] `midnight` renders as a warm dark theme — amber accent is the dominant accent
- [ ] `neonCyber` renders violet as structure, cyan as motion — no green or disconnected colors
- [ ] `enterprise` renders with no glow effects and no flow animation
- [ ] `lightCanvas` renders on warm neutral gray, nodes are white/ceramic, jewel-tone series visible
- [ ] `lightMinimal` group labels are readable on white background (dark `#1a2240` label color)

### Regression
- [ ] All existing diagram example scenes render without error
- [ ] All existing chart example scenes render without error
- [ ] `pnpm test` passes on all packages with zero test failures

### Documentation
- [ ] CHANGELOG updated in `@brewsite/core`, `@brewsite/diagram`, `@brewsite/charts`
- [ ] `packages/slides/src/compiler/themeCompiler.ts` compiles without TypeScript errors after `accentColor` removal from `SceneTheme`
- [ ] `packages/slides` test suite passes (the `accentColor→sceneTheme` test case deleted, all others green)

---

## Appendix: File Change Summary

| File | Stream | Change Type |
|---|---|---|
| `packages/core/src/theme/types.ts` | A | Modify (remove accentColor) |
| `packages/core/src/theme/presets.ts` | A | Modify (add 6 presets) |
| `packages/core/src/theme/index.ts` | A | Modify (export 6 new presets) |
| `packages/core/src/player/EngineOverlayHost.tsx` | A | Modify (remove accentColor injection) |
| `packages/core/src/player/__tests__/EngineOverlayHost.test.tsx` | A | Modify (remove accentColor tests) |
| `packages/core/src/theme/__tests__/presets.test.ts` | A | Modify (add 6 new test cases) |
| `packages/slides/src/compiler/themeCompiler.ts` | A | Modify (remove accentColor from sceneTheme object) |
| `packages/slides/src/compiler/__tests__/themeCompiler.test.ts` | A | Modify (delete accentColor→sceneTheme test case) |
| `packages/diagram/src/elements/diagram/types.ts` | B | Modify (add DiagramThemeName) |
| `packages/diagram/src/elements/diagram/dsl.tsx` | B | Modify (update theme prop type) |
| `packages/diagram/src/elements/diagram/themes/darkGlass.ts` | C | Modify (palette redesign) |
| `packages/diagram/src/elements/diagram/themes/midnight.ts` | C | **CREATE** |
| `packages/diagram/src/elements/diagram/themes/neonCyber.ts` | C | Modify (palette redesign) |
| `packages/diagram/src/elements/diagram/themes/enterprise.ts` | C | Modify (palette redesign) |
| `packages/diagram/src/elements/diagram/themes/lightCanvas.ts` | D | **CREATE** |
| `packages/diagram/src/elements/diagram/themes/lightMinimal.ts` | D | Modify (add comment block only) |
| `packages/charts/src/themes/types.ts` | E | Modify (extend ChartThemeName) |
| `packages/charts/src/themes/darkGlass.ts` | E | Modify (palette redesign) |
| `packages/charts/src/themes/neonCyber.ts` | E | Modify (palette redesign) |
| `packages/charts/src/themes/enterprise.ts` | E | Modify (palette redesign) |
| `packages/charts/src/themes/lightMinimal.ts` | E | Modify (add comment block, reduce depth) |
| `packages/charts/src/themes/midnight.ts` | E | **CREATE** |
| `packages/charts/src/themes/lightCanvas.ts` | E | **CREATE** |
| `packages/charts/src/themes/index.ts` | E | Modify (add new themes to CHART_THEMES) |
| `packages/charts/src/themes/createChartTheme.ts` | E | Modify (update PRESET_MAP) |
| `packages/charts/src/themes/__tests__/createChartTheme.test.ts` | E | Modify (add new theme tests) |
| `packages/diagram/src/elements/diagram/themes/index.ts` | F | Modify (add DIAGRAM_THEMES, new exports) |
| `packages/diagram/src/elements/diagram/compile.ts` | F | Modify (add resolveTheme function) |
| `packages/diagram/src/elements/diagram/index.ts` | F | Modify (export DIAGRAM_THEMES, new themes) |
| `packages/diagram/src/elements/diagram/__tests__/compile.test.ts` | F | Modify (add string resolution tests) |
| `packages/diagram/src/elements/diagram/themes/__tests__/index.test.ts` | F | **CREATE** (DIAGRAM_THEMES completeness tests) |

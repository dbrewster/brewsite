---
title: "Theming Overhaul — Light/Dark Variants, Single Theme Name, CSS-Class Overrides"
doc_type: note
owner: brewsite-product-manager
status: complete
updated: 2026-03-11
---

# Theming Overhaul — Light/Dark Variants, Single Theme Name, CSS-Class Overrides

## Overview

This note explores a theming overhaul with five coordinated goals: (1) light and dark variants for every theme name, (2) a single theme name that activates across all packages, (3) CSS variables as the override mechanism for HTML overlay content, (4) TypeScript theme objects as the override mechanism for Three.js material values, and (5) example app updates including a light/dark toggle. The note is grounded in the current implementation across `@brewsite/core`, `@brewsite/diagram`, and `@brewsite/charts` and surfaces the architectural constraints and decisions required before implementation begins.

---

## 1. Problem Statement

### 1.1 No Light/Dark Pairs Per Theme Family

Today the six canonical theme names (`darkGlass`, `midnight`, `neonCyber`, `enterprise`, `lightCanvas`, `lightMinimal`) each represent a single fixed polarity. The four dark themes have no light-mode counterpart; the two light themes have no dark-mode counterpart. A developer who wants to offer a dark/light toggle must select an entirely different theme family, which changes the color vocabulary, typography feel, and PBR material settings — not just the background polarity. There is no "darkGlass on a light background" option.

### 1.2 No Single Theme Entry Point

The current API requires a developer to wire the theme in three independent places:

```ts
// 1. CSS variables for HTML overlay content
<SceneEngine sceneTheme={lightCanvasSceneTheme} ...>

// 2. Three.js diagram rendering
<DiagramCanvas theme={{ ...lightCanvasTheme, sceneTheme: lightCanvasSceneTheme }} />

// 3. Three.js chart rendering — every chart element independently
<BarChart theme={theme} />  // `theme` is a string name imported from ChartDemoPage
```

None of these inform each other automatically. The `SceneTheme` on `EngineProvider` does not configure `DiagramTheme` or `ChartTheme`. The chart string name (`theme="lightCanvas"`) does not pick up the `sceneTheme` font URL. The developer must construct and thread three separate objects that happen to share a name convention but share no runtime coordination.

### 1.3 No CSS Override Mechanism for HTML Overlay Theming

The current `EngineOverlayHost` injects CSS variables for font and text color, but the set is narrow and there is no CSS class on the element that encodes the active theme family or polarity. A developer who wants to override overlay text colors, fonts, or background fill for their brand must do so either by targeting internal CSS variable names directly (fragile) or by constructing a custom `SceneTheme` in code. There is no `.bw-theme-darkGlass` class they can target in their stylesheet.

For Three.js material values — node colors, series palette, metalness, roughness — there is no CSS mechanism and none is planned. TypeScript theme objects are the only mechanism for those values. This is a constraint of WebGL rendering, not a design gap.

### 1.4 No Light/Dark Toggle in Examples

The `ChartDemoPage.tsx` has a module-level constant:

```ts
export const theme: 'lightCanvas' | 'darkGlass' = 'lightCanvas'
```

This requires a code change and browser reload to switch polarity. There is no runtime toggle, no `prefers-color-scheme` response, and no toggle button in any demo page UI. This makes the light/dark capability invisible to developers evaluating the toolkit.

---

## 2. Current State — What Exists and What Doesn't

### 2.1 `@brewsite/core` — SceneTheme

**What exists:**
- `SceneTheme` type: `colorMode`, `font` (htmlFamily + webglFontUrl), `fontSize` scale, optional `background` fill/effects.
- `ThemeContext`: React context populated by `SceneEngine.sceneTheme`. Consumed by `EngineOverlayHost` to inject CSS custom properties: `--brewsite-font-family`, `--brewsite-font-size-*`, `--brewsite-color-mode`, `--brewsite-text-primary`, `--brewsite-text-secondary`.
- Six named presets: `darkGlassSceneTheme`, `midnightSceneTheme`, `neonCyberSceneTheme`, `enterpriseSceneTheme`, `lightCanvasSceneTheme`, `lightMinimalSceneTheme`.
- `ThemeContext` is **static per player lifetime** — it does not update per scene and does not re-inject CSS variables when the user switches between dark and light.

**What does not exist:**
- Any mechanism to switch `SceneTheme` at runtime without remounting the player.
- Any CSS class-based theming layer.
- Light/dark variant pairs per theme name (e.g., `darkGlass` + `darkGlass-light`).
- A type or constant that maps a theme name string to both a light and dark `SceneTheme` pair.
- Any connection from `SceneTheme` to Three.js material values. `SceneTheme` is CSS-only; it does not drive diagram node colors, chart series colors, or any WebGL rendering.

### 2.2 `@brewsite/diagram` — DiagramTheme

**What exists:**
- `DiagramTheme`: deep per-element configs (node, edge, group, environment, layout, palette, optional sceneTheme).
- Six preset objects compiled at startup: `darkGlassTheme`, `midnightTheme`, `neonCyberTheme`, `enterpriseTheme`, `lightCanvasTheme`, `lightMinimalTheme`.
- `DIAGRAM_THEMES: Record<DiagramThemeName, DiagramTheme>` — keyed lookup.
- String name API: `<Diagram theme="darkGlass">` resolves via `DIAGRAM_THEMES` at compile time.
- `buildThemeRenderConfig(theme)` flattens `DiagramTheme` to `DiagramThemeRenderConfig` at compile time. Renderers read only `DiagramThemeRenderConfig`.

**Critical architectural constraint:** `DiagramThemeRenderConfig` is produced at **compile time** and stored in the `SceneTrack`. This means all Three.js material colors, metalness, roughness, edge routing params, and glow intensities are **baked into the compiled SceneTrack**. Changing the theme at runtime requires recompilation — there is no per-frame theme lookup from `DiagramThemeRenderConfig` fields. This is by design and is the source of O(1) sampling performance.

**What does not exist:**
- Any light/dark pair for any diagram theme.
- Any runtime mechanism to switch between a dark and light version of `darkGlass` without recompiling the scene.
- CSS variable consumption at the Three.js rendering layer (impossible by design — Three.js materials don't read CSS).

### 2.3 `@brewsite/charts` — ChartTheme

**What exists:**
- `ChartTheme`: series material tokens, axis, background, legend, line, pie, interaction, plus V2.1 optional groups (bar, area, gridlines, dataLabels, referenceLines).
- Six preset constants and `CHART_THEMES: Record<ChartThemeName, ChartTheme>`.
- `createChartTheme(base, overrides)` factory.
- String name API: `<BarChart theme="darkGlass">`.
- `sceneTheme?: SceneTheme` on both `ChartTheme` and `ChartDSL` — for font URL and colorMode fallbacks only.

**Critical constraint:** Same as diagram. `ChartState` (stored in `SceneTrack`) includes the resolved `ChartTheme` tokens. Series material colors, axis label colors, and background tokens are resolved at compile time. Runtime switching requires recompilation.

**What does not exist:**
- Light/dark variant pairs.
- CSS variable consumption for material colors.

### 2.4 Theme Name Alignment — Current State

All six canonical names exist across all packages:

| Name | Core Preset | Diagram Preset | Chart Preset | Polarity |
|---|---|---|---|---|
| `darkGlass` | `darkGlassSceneTheme` | `darkGlassTheme` | `darkGlassChartTheme` | dark |
| `midnight` | `midnightSceneTheme` | `midnightTheme` | `midnightChartTheme` | dark |
| `neonCyber` | `neonCyberSceneTheme` | `neonCyberTheme` | `neonCyberChartTheme` | dark |
| `enterprise` | `enterpriseSceneTheme` | `enterpriseTheme` | `enterpriseChartTheme` | dark |
| `lightCanvas` | `lightCanvasSceneTheme` | `lightCanvasTheme` | `lightCanvasChartTheme` | light |
| `lightMinimal` | `lightMinimalSceneTheme` | `lightMinimalTheme` | `lightMinimalChartTheme` | light |

Names align across packages. Palettes are coordinated via comment blocks in each file. There are no dark variants for `lightCanvas`/`lightMinimal` and no light variants for the four dark themes.

---

## 3. Proposed Solution — High-Level Design for Each Goal

### Goal 1: Light + Dark Variants Per Theme

**Proposed approach:** For each of the six canonical theme names, define both a dark and a light variant. The variant pair is expressed at the `SceneTheme` level in `@brewsite/core` and mirrored as paired `DiagramTheme` and `ChartTheme` presets.

The simplest naming convention that doesn't break existing consumers: encode variant polarity in the preset constant names, not in the theme name string.

```ts
// @brewsite/core — polarity variants per name
export const darkGlassSceneTheme:       SceneTheme;  // existing (dark)
export const darkGlassLightSceneTheme:  SceneTheme;  // new (light variant of darkGlass)
export const lightCanvasSceneTheme:     SceneTheme;  // existing (light)
export const lightCanvasDarkSceneTheme: SceneTheme;  // new (dark variant of lightCanvas)
// ... same pattern for all six names
```

At the diagram and chart level, each theme name maps to a pair of presets:

```ts
// @brewsite/diagram
export const darkGlassTheme:       DiagramTheme;  // existing (dark)
export const darkGlassLightTheme:  DiagramTheme;  // new (light variant)
```

The 6-entry `DIAGRAM_THEMES` and `CHART_THEMES` registries are joined by new `*_THEME_PAIRS` registries using a nested structure keyed by `ThemeFamily` and polarity. The existing flat registries remain for backward compatibility:

```ts
// NEW nested polarity registry:
export const DIAGRAM_THEME_PAIRS: Record<ThemeFamily, { readonly dark: DiagramTheme; readonly light: DiagramTheme }>;

// EXISTING flat registry — unchanged, still valid:
export const DIAGRAM_THEMES: Record<DiagramThemeName, DiagramTheme>;
```

Polarity variants are never added to the `theme` prop string union on `<Diagram>` or `<Chart>`. The DSL prop continues to accept only base family names. Polarity selection is always via the `*_THEME_PAIRS` registry at the consumer call site.

**The variant definition problem:** Light variants of dark themes (e.g., `darkGlass-light`) are not simply the existing light themes. `darkGlass-light` would be `darkGlass`'s color vocabulary — navy, blue-violet palette, metallic nodes — rendered on a light background. This is a new aesthetic requiring new per-element token values. Similarly, `lightCanvas-dark` uses `lightCanvas`'s jewel-tone palette on a dark background. All 12 variants must be authored as distinct aesthetic objects — they cannot be auto-derived from each other.

**What changes polarity in the light variant:** Background color, node surface color, label colors, group fill colors, and chart axis/legend text colors. PBR metalness, roughness, edge routing, and layout config can often be shared across polarities of the same theme family.

### Goal 2: Single Theme Name Activating Across All Packages

**The architectural constraint:** `@brewsite/core` cannot import from `@brewsite/diagram` or `@brewsite/charts`. There is no shared runtime that can say "set darkGlass on all packages." The packages are independently published and tree-shaken. There is no single function that returns a `DiagramTheme` and a `ChartTheme` simultaneously — that would require a package that imports both, which violates the dependency rule.

**The single-entry-point API** lives in the consumer's host application. The toolkit provides per-package `*_THEME_PAIRS` registries keyed by `ThemeFamily`, all importing `ThemeFamily` from `@brewsite/core`. The consumer assembles once.

**Exported types and registries (canonical API):**

```ts
// @brewsite/core
export type ThemeFamily =
  | 'darkGlass'
  | 'midnight'
  | 'neonCyber'
  | 'enterprise'
  | 'lightCanvas'
  | 'lightMinimal';

export const SCENE_THEME_PAIRS: Record<ThemeFamily, {
  readonly dark: SceneTheme;
  readonly light: SceneTheme;
}>;

// @brewsite/diagram
export const DIAGRAM_THEME_PAIRS: Record<ThemeFamily, {
  readonly dark: DiagramTheme;
  readonly light: DiagramTheme;
}>;

// @brewsite/charts
export const CHART_THEME_PAIRS: Record<ThemeFamily, {
  readonly dark: ChartTheme;
  readonly light: ChartTheme;
}>;
```

**Canonical consumer call site** — this is what a developer writes to activate one theme name across all packages:

```ts
import { SCENE_THEME_PAIRS, type ThemeFamily } from '@brewsite/core';
import { DIAGRAM_THEME_PAIRS } from '@brewsite/diagram';
import { CHART_THEME_PAIRS } from '@brewsite/charts';

const family: ThemeFamily = 'darkGlass';
const polarity: 'dark' | 'light' = isDarkMode ? 'dark' : 'light';

const sceneTheme   = SCENE_THEME_PAIRS[family][polarity];    // SceneTheme
const diagramTheme = DIAGRAM_THEME_PAIRS[family][polarity];  // DiagramTheme (pre-wired sceneTheme)
const chartTheme   = CHART_THEME_PAIRS[family][polarity];    // ChartTheme (pre-wired sceneTheme)
```

This is three lines of code instead of today's three independent object constructions with no shared vocabulary. A single `family` and `polarity` variable controls all packages. No `resolveThemePack()` unified helper is needed or provided — that would require a package bridging the dependency boundary, which does not exist.

**sceneTheme pre-wiring:** Each entry in `DIAGRAM_THEME_PAIRS` and `CHART_THEME_PAIRS` is pre-wired with its corresponding `sceneTheme` from `SCENE_THEME_PAIRS`. The consumer does not need to manually pass `sceneTheme` to `DiagramCanvas` or `<Chart>` — it is embedded in the returned theme object. Consumers who construct custom themes continue to wire `sceneTheme` manually as today.

### Goal 3: CSS Variables for the HTML Overlay Layer; TypeScript Objects for the Three.js Layer

These are **parallel mechanisms serving separate rendering targets**, not primary and secondary in a priority hierarchy. CSS custom properties and TypeScript theme objects do not overlap — each owns its layer entirely.

**What CSS variables own:**

HTML overlay content (rendered inside `EngineOverlayHost`) is CSS territory. The current CSS variable set (`--brewsite-font-family`, `--brewsite-text-primary`, etc.) can be extended with additional design tokens. Developers override overlay appearance by targeting the CSS class injected on the `EngineOverlayHost` element — no code change required.

```css
/* Overlay brand override — no code change required */
.bw-theme-darkGlass {
  --brewsite-text-primary: #e0e8ff;
  --brewsite-font-family: 'Söhne', system-ui, sans-serif;
}

/* Polarity class added by EngineOverlayHost based on SceneTheme.colorMode */
.bw-theme-darkGlass.bw-dark {
  --brewsite-background-color: #070b18;
}
.bw-theme-darkGlass.bw-light {
  --brewsite-background-color: #f5f7ff;
}
```

**What TypeScript theme objects own:**

Three.js material colors (`DiagramTheme.node.defaultColor`, `ChartTheme.series[0].color`, metalness, roughness, emissive intensity, edge routing config, etc.) are WebGL parameters. Three.js does not read from the DOM CSS cascade. A `MeshPhysicalMaterial.color` baked at compile time cannot be changed by a CSS variable at runtime. All Three.js rendering is controlled exclusively by the `DiagramTheme` and `ChartTheme` TypeScript objects.

**Expanded CSS variable set:** The following variables are candidates for addition to the injected set. All are HTML-only — they do not drive Three.js materials.

| Variable | Maps to |
|---|---|
| `--brewsite-background-color` | Scene background DOM element fill color |
| `--brewsite-surface-elevated` | Elevated surface tone (overlay cards, modals) |
| `--brewsite-border-subtle` | Subtle border color for overlay UI |
| `--brewsite-radius-base` | Base corner radius token for overlay components |

Whether to include `--brewsite-accent-1` through `--brewsite-accent-8` is an open question (see Section 5.6).

**Theme CSS class injection:** `EngineOverlayHost` injects two classes on its root element: `.bw-theme-{family}` (e.g., `.bw-theme-darkGlass`) and a polarity class (`.bw-dark` or `.bw-light`). This enables developers to write both theme-scoped and polarity-scoped CSS overrides for overlay content.

### Goal 4: Code Overrides as Escape Hatch

The existing spread-and-override patterns for both `DiagramTheme` and `ChartTheme` remain fully valid and unchanged. They remain the correct mechanism for overriding Three.js material values:

```ts
// Code override — for Three.js colors that CSS cannot reach
const brandDiagramTheme = mergeTheme(darkGlassTheme, {
  node: { defaultColor: '#1a0038' },
  palette: ['#8833ff', '#44aaff', ...],
});
```

The `createChartTheme(base, overrides)` factory continues as the override mechanism for chart material values. `mergeTheme(base, overrides)` continues as the override mechanism for diagram themes. These are the correct tools when the target is Three.js rendering, not DOM styling.

### Goal 5: Examples Updated with Light/Dark Toggle

The `ChartDemoPage.tsx` currently has a module-level constant that requires a code change to switch polarity. The new pattern:

1. Replace the module-level constant with React state:
   ```ts
   const [polarity, setPolarity] = useState<'dark' | 'light'>('light');
   ```

2. Resolve themes from polarity state using the new registries:
   ```ts
   const family: ThemeFamily = 'lightCanvas';
   const sceneTheme   = SCENE_THEME_PAIRS[family][polarity];
   const diagramTheme = DIAGRAM_THEME_PAIRS[family][polarity];
   const chartTheme   = CHART_THEME_PAIRS[family][polarity];
   ```

3. Add a toggle button to the demo page header — an icon button cycling through `system` → `dark` → `light` modes, similar to the pattern used in documentation sites (shadcn, Radix, etc.).

4. Extend the pattern to all demo pages (`DiagramDemoPage`, `SimpleDemoPage`, etc.).

**The React state → Three.js recompilation problem:** `SceneTrack` is compiled once per scene. When `polarity` state changes, the `SceneTrack` must be recompiled for any scene that references `DiagramTheme` or `ChartTheme` tokens. This is handled by the `clearSceneTrackCache()` call already present in `ChartDemoPage.tsx` for HMR. For runtime toggling, the same cache bust + player re-render pattern applies. The `sceneTheme` prop on `SceneEngine` alone does NOT recompile Three.js material colors when changed — only the CSS variable injection updates. Recompilation of Three.js content requires the cache bust + React re-render cycle.

---

## 4. Key Design Decisions to Resolve

### 4.1 `ThemeFamily` Type Lives in `@brewsite/core`

**Decision:** `ThemeFamily` is exported from `@brewsite/core`. `@brewsite/diagram` and `@brewsite/charts` import the type from core and use it to type their respective `DIAGRAM_THEME_PAIRS` and `CHART_THEME_PAIRS` registries.

Rationale: `@brewsite/core` already exports `SceneTheme` — the cross-package theme vocabulary for the HTML layer. `ThemeFamily` is the natural companion type. Both `@brewsite/diagram` and `@brewsite/charts` already depend on `@brewsite/core`, so importing `ThemeFamily` from core adds zero new dependency edges. Adding a new theme name is a minor bump to core, which cascades to a minor bump in diagram and charts as consumers of the type — this is predictable and manageable.

A dedicated `@brewsite/theme` package is premature at current scale and adds a new package to maintain, publish, and version separately. `DiagramThemeName` in diagram and `ChartThemeName` in charts become type aliases for `ThemeFamily`:

```ts
// @brewsite/diagram
import type { ThemeFamily } from '@brewsite/core';
export type DiagramThemeName = ThemeFamily;  // maintained for backward compat
```

The existing `DiagramThemeName` and `ChartThemeName` exports remain for backward compatibility; they are type aliases, not separate union definitions. This change is non-breaking.

### 4.2 Light Variant Aesthetic Spec — Infrastructure-First Scope

**Decision:** v1 ships infrastructure only. The `*_THEME_PAIRS` registries are fully functional, but the 6 new variant presets are **explicit aesthetic placeholders** — not production-quality designs. Aesthetic authoring of the 6 new variants is tracked as a required follow-on story before production release of the feature.

**Placeholder assignment for v1:**
- Light variants of the 4 dark themes (`darkGlass-light`, `midnight-light`, `neonCyber-light`, `enterprise-light`): use `lightCanvasTheme` / `lightCanvasChartTheme` / `lightCanvasSceneTheme` as placeholders. These are structurally correct (correct polarity, correct type) but have `darkGlass`/`midnight`/etc. palette — visually wrong until properly authored.
- Dark variants of the 2 light themes (`lightCanvas-dark`, `lightMinimal-dark`): use `darkGlassTheme` / `darkGlassChartTheme` / `darkGlassSceneTheme` as placeholders.

The placeholders carry a JSDoc comment: `@internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.`

**Why infrastructure-first:** The 6 new variant aesthetics require explicit product design work — color palettes, PBR parameters, label colors, environment config — per the constraints in Section 6.1 (they cannot be auto-derived). Authoring all 12 variants before shipping the API would block the structural work by weeks. Shipping infrastructure with clearly labeled placeholders allows the API to be validated while aesthetic work proceeds in parallel.

**The API shape does not change when aesthetics are filled in.** Replacing a placeholder with a production-quality preset is a patch-level release (no API contract change).

### 4.3 CSS Variable Injection Point — Stay on `EngineOverlayHost` for v1

**Decision:** v1 injects CSS variables and the `.bw-theme-{family}` / `.bw-dark` / `.bw-light` classes on the existing `EngineOverlayHost` element. No new wrapper element (`BrewSiteThemeProvider`) is introduced in this iteration.

Rationale: introducing a new DOM wrapper element changes the element structure that existing consumers may target with CSS selectors or JavaScript DOM queries. That is a potentially breaking layout change. The v1 goal is overlay text overrides, not page-level CSS cascade — the overlay host is the correct scope for that. `prefers-color-scheme` auto-detection is out of scope (see Section 4.4), so the class does not need to be on `<body>` or `<html>`.

A `BrewSiteThemeProvider` wrapper (or `SceneEngine` root class injection) is deferred to a follow-on iteration if the need for broader CSS cascade scope is demonstrated by consumer use cases.

### 4.4 SceneTheme Reactivity — Remount on Polarity Toggle for v1

**Decision on `prefers-color-scheme`:** It remains a Non-Goal. The existing core theming PRD lists it explicitly as out of scope. No new argument overrides that decision. The polarity toggle is manual UI only — a button, not a media query listener.

**Decision on reactivity model:** v1 uses Option A — full player remount on polarity change. The demo page manages `polarity` as React state. When polarity changes:
1. `clearSceneTrackCache()` is called.
2. The `SceneEngine` component unmounts and remounts with the new `sceneTheme`, `diagramTheme`, and `chartTheme` values.
3. Three.js content recompiles from scratch on next mount.

Acknowledged latency: ~100–300ms on toggle. This is acceptable for a demo page toggle button. It is not a production real-time switch — it is a demonstration capability.

Option B (reactive CSS variables without remount) is a valid standalone improvement to `EngineOverlayHost`: instead of reading `useTheme()` once at render, `EngineOverlayHost` re-runs `style.setProperty()` calls whenever `sceneTheme` changes within a React re-render. This handles the overlay CSS layer without triggering a full remount. However, it does not address Three.js material changes — which always require recompilation. Option B can be implemented as an independent improvement in the same iteration without affecting the v1 toggle behavior specification.

### 4.5 CSS Variable Coverage for Three.js-Adjacent Values

Background DOM color (`--brewsite-background-color`) is a special case: it's a CSS property (the DOM background element uses it), but it's also a value encoded in `SceneTheme.background.fill`. If a developer overrides `--brewsite-background-color` via CSS class, the DOM background will change but the Three.js scene background (if `BackgroundWidget` uses a WebGL plane rather than a DOM element) will not. This creates a split-brain risk. The architect must decide whether `BackgroundWidget` reads from the CSS variable or from the compiled `SceneTheme.background.fill` value.

### 4.6 How sceneTheme Propagates Automatically to Diagram and Chart

The current manual wiring:
```ts
// Manual: developer must wire sceneTheme to each package
<DiagramCanvas theme={{ ...darkGlassTheme, sceneTheme: mySceneTheme }} />
<BarChart theme="darkGlass" sceneTheme={mySceneTheme} />
```

For "single theme name activates across all packages," each entry in `DIAGRAM_THEME_PAIRS` and `CHART_THEME_PAIRS` is pre-wired with its `sceneTheme` at registry construction time — no public resolver function is needed or exported:

```ts
// At registry construction time (inside the package, not exported):
const darkGlassDark: DiagramTheme = {
  ...darkGlassTheme,
  sceneTheme: SCENE_THEME_PAIRS['darkGlass']['dark'],
};

export const DIAGRAM_THEME_PAIRS: Record<ThemeFamily, { readonly dark: DiagramTheme; readonly light: DiagramTheme }> = {
  darkGlass: { dark: darkGlassDark, light: darkGlassLight },
  // ...
};
```

The consumer gets a fully configured `DiagramTheme` (with `sceneTheme` embedded) by reading `DIAGRAM_THEME_PAIRS[family][polarity]` directly. No additional helper function is needed. Consumers who build custom themes continue to wire `sceneTheme` manually as today.

---

## 5. Open Questions

**5.6 `--brewsite-accent-1` through `--brewsite-accent-8` CSS variables.** Should the 8-slot accent palette be exposed as CSS variables? These are useful for overlay HTML components wanting to match diagram/chart palette colors. They are HTML-only — they do not drive Three.js materials. Risk: locking in a fixed 8-slot palette as a named CSS API surface; renaming any slot is a breaking change. Decision not needed before implementation begins; can be added in the same iteration or deferred.

**5.9 `@brewsite/model` WebGL text.** Label HTML content inside `EngineOverlayHost` inherits CSS variables via DOM cascade with no changes required. Confirm whether `@brewsite/model` label rendering includes any troika-three-text WebGL labels that would need `ThemeFamily` / polarity awareness (font URL updates on polarity switch).

## 5a. Breaking Change Decisions

**5a.1 `ThemeFamily` in core — semver impact: minor.** Adding `ThemeFamily` as a new export from `@brewsite/core` is additive. No existing exported symbol changes.

**5a.2 `SCENE_THEME_PAIRS`, `DIAGRAM_THEME_PAIRS`, `CHART_THEME_PAIRS` — semver impact: minor.** New registry exports in each package. Additive. No existing exported symbol changes.

**5a.3 `DiagramThemeName` and `ChartThemeName` exhaustiveness — no change, no concern.** Polarity variants are NOT added to the `theme` prop string union on `<Diagram>` or `<Chart>`. The `theme` prop continues to accept only base `ThemeFamily` names (`'darkGlass'`, `'midnight'`, etc.). Polarity is accessed via `DIAGRAM_THEME_PAIRS[family][polarity]` — a programmatic registry lookup, not a JSX string prop. `DiagramThemeName` becomes a type alias for `ThemeFamily` (same 6 values, same union). Existing switch-case consumers have no exhaustiveness breakage. Adding a new `ThemeFamily` member in the future is a minor semver bump that does require consumers with exhaustive switches to add a `default` branch — that is the correct and documented behavior for minor semver additions to union types in SDKs.

**5a.4 CSS class injection on `EngineOverlayHost` — semver impact: minor.** Adding `.bw-theme-{family}` and `.bw-dark`/`.bw-light` classes to the overlay host element is additive. Consumer CSS that does not reference these classes is unaffected.

**5a.5 `BackgroundLayer` CSS variable priority model.** `BackgroundLayer` reads `SceneTheme.background.fill` from the compiled `SceneTheme` to set the DOM background. If a developer also sets `--brewsite-background-color` via CSS class override, the CSS variable must take precedence (CSS cascade wins over JS inline style if the variable is referenced in a stylesheet rule, not set via `style.setProperty()`). Decision: `BackgroundLayer` sets `background-color` via inline style from `SceneTheme.background.fill`. CSS class overrides on `--brewsite-background-color` work only if `BackgroundLayer` is refactored to use `var(--brewsite-background-color, <fallback>)` in its inline style or a stylesheet. The architect must specify whether `BackgroundLayer` is refactored in v1 to use the CSS variable pattern. This affects whether `--brewsite-background-color` is a useful override in practice.

---

## 6. Constraints Discovered During Research

### 6.1 Three.js Cannot Read CSS Variables

This is the dominant architectural constraint of this entire feature. CSS custom properties live in the browser's style cascade. Three.js WebGL rendering is entirely independent of the DOM style cascade. A `MeshPhysicalMaterial` does not query CSS. There is no `CSS.supports()` equivalent in Three.js. Any material color, metalness value, roughness, or emissive intensity set from a theme object at compile time cannot be changed by a CSS variable at runtime.

**Consequence:** CSS class-based theming applies **exclusively** to HTML overlay content (`EngineOverlayHost` children, `BackgroundLayer` DOM element, any HUD overlay content). It does not and cannot apply to diagram node colors, chart series materials, edge colors, group fills, or any other Three.js-rendered content. The feature note must be very clear that CSS-class theming is a "half-pie" — it covers the CSS half but leaves the WebGL half entirely in code-land.

### 6.2 `SceneTrack` Is Compiled Once Per Scene Set

`DiagramThemeRenderConfig` and `ChartState` (including theme tokens) are produced by the compiler and stored in `SceneTrack`. These are baked at the time JSX is first evaluated. A runtime polarity switch that needs to change Three.js material colors must trigger a recompile. This means: on polarity toggle, `clearSceneTrackCache()` must be called, and the JSX that produces the `SceneTrack` must be re-evaluated. In the current `ChartDemoPage` pattern, this is handled by a React state change that re-mounts the `SceneEngine`. A polarity toggle is therefore a full re-initialization of the scene system, not a lightweight CSS variable update.

### 6.3 `ThemeContext` Is Static Per Player Lifetime

By design, `ThemeContext` does not change per scene. CSS variable injection from `ThemeContext` happens once at player mount and does not update on scene transitions. This is documented in the core theming PRD as an intentional performance decision. A light/dark polarity toggle that changes `ThemeContext` (for CSS variables) without a remount is possible only if `EngineOverlayHost` is updated to re-run the `style.setProperty()` calls when `sceneTheme` changes. The current implementation reads `useTheme()` once at render time; it does not subscribe to changes beyond normal React re-renders. Adding polarity switching without a full remount requires `ThemeContext` to become reactive within the `SceneEngine` re-render path.

### 6.4 Package Dependency Direction Is Hard

`@brewsite/core` must never import from `@brewsite/diagram` or `@brewsite/charts`. A "single theme name activates across all packages" feature cannot be implemented as a shared runtime hub in core that configures diagram and chart internals. The coordination is necessarily at the consumer level, using resolver helpers that each package provides independently.

### 6.5 Cross-Package Palette Comment Blocks Must Stay in Sync

The eight-color accent palettes in diagram and chart theme files are kept in sync via comment blocks:

```ts
// SHARED ACCENT PALETTE — must match packages/charts/src/themes/darkGlass.ts
// Index 0–4: diagram node palette[0..4]; indices 0–7: chart series[0..7].color
// '#4455aa', '#2266bb', '#7744cc', '#1188aa', '#335588', '#3dbccc', '#9966ff', '#44aadd'
```

When 6 new light-variant presets are added, each must carry a paired comment block pointing to its chart counterpart. The same discipline applies to any new `ThemeFamily` entries added in the future.

### 6.6 The `BackgroundLayer` DOM Element Is CSS-Driven

The `BackgroundLayer` component (`packages/core/src/player/`) renders the scene background as a DOM element, not as a Three.js plane. Its fill, gradient, and filter values are derived from `SceneTheme.background`. This is CSS territory — CSS variable overrides for background color are viable. However, if `BackgroundLayer` reads its fill from compiled `SceneTheme.background.fill` (baked at compile time), an external CSS variable override on `--brewsite-background-color` would create a conflict: the compiled fill value and the CSS variable override would both attempt to set the background color. The priority model must be defined.

### 6.7 Existing Examples Use the Theme Constant Pattern

`ChartDemoPage.tsx` exports a `theme` constant that scene files import:

```ts
// ChartDemoPage.tsx
export const theme: 'lightCanvas' | 'darkGlass' = 'lightCanvas'

// scene1-bar-morph.tsx
import { theme } from "../ChartDemoPage";
<BarChart theme={theme} ...>
```

This compile-time constant pattern means scene files cannot independently react to a runtime polarity change. All scene files must import a reactive value (React state or context) rather than a compile-time export. Migrating this pattern across all 10+ scene files in the chart demo is a non-trivial refactor that must be part of the example update scope.

---

## 7. What Is Explicitly Not in Scope

- `prefers-color-scheme` auto-detection (remains a Non-Goal per the existing core theming PRD)
- Animated transitions between theme polarities (CSS transitions on overlay content may happen naturally; no explicit animation is built)
- Per-scene CSS variable switching (ThemeContext remains player-scoped, not scene-scoped)
- Font file bundling — consumers continue to host their own MSDF fonts
- Server-side rendering or static export with theme variants
- A `@brewsite/theme` standalone package (premature at current scale)
- Production-quality aesthetic specs for the 6 new variant presets (v1 ships placeholders; aesthetic authoring is a tracked follow-on)
- Adding new chart types or diagram elements as part of this work

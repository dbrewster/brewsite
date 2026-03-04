---
title: "BrewSite Charts — Theming System"
doc_type: prd
status: active
owner: brewsite-product-manager
last_updated: 2026-03-04
change_history:
  - date: 2026-03-04
    author: "Toolkit Product"
    summary: "Initial PRD created. Documents the ChartTheme system as implemented: ChartTheme type, four preset themes, sceneTheme integration for cross-package font and color-mode defaults, and ChartDSL.sceneTheme element-level override."
---

# BrewSite Charts — Theming System

## 1. Overview

The theming system in `@brewsite/charts` provides the complete design language for 3D chart visualization. A `ChartTheme` is a plain TypeScript object that configures series material tokens, axis styling, background plane tokens, legend styling, and interaction feedback colors for all elements within a chart. Four preset themes ship with the package, matching the names of the `@brewsite/diagram` presets for visual coherence. The `ChartTheme` accepts an optional `sceneTheme?: SceneTheme` field from `@brewsite/core` that provides cross-package font URL and color-mode defaults. This is the first mechanism for custom font rendering in the charts package.

Affects: `@brewsite/charts`.

---

## 2. Problem Statement

Chart rendering via troika-three-text used the troika built-in default font unconditionally — there was no mechanism to specify a custom MSDF font. Additionally, axis label and legend text colors were only configurable via explicit `ChartTheme` fields, with no connection to a scene-level color mode. Scene authors combining charts with diagrams and overlay content had to manage font and color settings in three separate systems with no shared vocabulary.

---

## 3. Goals & Success Metrics

**Primary goals:**
- A consumer can pass a `sceneTheme` to a chart and have axis labels and legend text render using the same font as diagram labels and overlay content.
- Four preset themes (`darkGlass`, `neonCyber`, `enterprise`, `lightMinimal`) produce visually coherent chart output without additional configuration.
- The `sceneTheme` integration is fully additive — existing charts that never set `sceneTheme` behave identically to before.

**Success metrics:**
- All four preset `ChartTheme` constants pass TypeScript strict-mode type check.
- When `ChartTheme.sceneTheme.font.webglFontUrl` is set, troika-rendered axis and legend text uses that font file.
- Switching between preset themes requires only a `theme` prop change on `<Chart>`.

**Guardrail metrics:**
- No new required fields added to `ChartTheme` or its sub-types without a deprecation window.
- `sceneTheme` always optional; existing chart consumers have zero migration burden.

---

## 4. Non-Goals

- Runtime theme switching with animated transitions
- Per-series or per-axis font overrides (font is chart-wide via `sceneTheme.font.webglFontUrl`)
- CSS font-family control for chart text (chart text is WebGL-rendered; CSS font-family strings are not applicable)
- Chart-level background gradient (chart `background` tokens are Three.js plane-based; CSS gradients don't apply to WebGL output)
- Automatic dark/light mode detection from `prefers-color-scheme`

---

## 5. Consumer Stories

- As a toolkit consumer, I want to pass a single preset theme string (e.g. `theme="darkGlass"`) to `<Chart>` so that all my chart elements adopt a consistent visual style without configuration.
- As a toolkit consumer, I want to set `sceneTheme.font.webglFontUrl` on my `ChartTheme` so that chart axis labels use my branded MSDF font matching my diagram labels.
- As a toolkit consumer, I want `<Chart theme="darkGlass" sceneTheme={mySceneTheme} />` so that I can add a custom font URL to a named preset without constructing a full `ChartTheme` object.
- As a toolkit consumer, I want the four preset chart themes to be individually importable so that my bundle only includes the preset I use.

---

## 6. Functional Requirements

1. The `ChartTheme` type shall be a plain TypeScript object type with no runtime dependencies.
2. Four preset themes — `darkGlassChartTheme`, `neonCyberChartTheme`, `enterpriseChartTheme`, `lightMinimalChartTheme` — shall be exported as named constants from `@brewsite/charts`.
3. `ChartTheme` shall accept an optional `sceneTheme?: SceneTheme` field (imported from `@brewsite/core`).
4. When `sceneTheme.font.webglFontUrl` is set, the chart render context shall pass it to troika-three-text for all axis tick labels, axis title labels, and legend labels.
5. When `sceneTheme.colorMode` is `'dark'` and no explicit `ChartAxisTokens.labelColor` override is set, the chart renderer shall use a light-appropriate label color as a fallback default. Explicit theme values take precedence.
6. When `sceneTheme.colorMode` is `'light'` and no explicit label color is set, the chart renderer shall use a dark-appropriate label color as a fallback default.
7. `ChartDSL.sceneTheme?: SceneTheme` shall be available as a prop on `<Chart>`, taking precedence over `ChartTheme.sceneTheme` when set. This allows passing a named theme (e.g. `theme="darkGlass"`) with a custom sceneTheme without constructing a full `ChartTheme` object.
8. `fontUrl` shall be threaded through `ChartRenderContext → AxesRenderer → LegendRenderer` and all six chart renderers (`BarRenderer`, `LineRenderer`, `AreaRenderer`, `PieRenderer`, `ScatterRenderer`, `HeatmapRenderer`).

---

## 7. API Design

### 7.1 ChartTheme Type (`packages/charts/src/themes/types.ts`)

```typescript
export type ChartTheme = {
  readonly name: string;
  readonly series: readonly ChartSeriesMaterialTokens[];
  readonly axis: ChartAxisTokens;
  readonly background: ChartBackgroundTokens;
  readonly legend: ChartLegendTokens;
  readonly interaction: ChartInteractionTokens;
  /**
   * Optional cross-package scene theme context.
   *
   * When present, ChartRenderer derives:
   * - WebGL font URL from sceneTheme.font.webglFontUrl (first-ever font customization for charts)
   * - Axis/legend label color fallback from sceneTheme.colorMode when not set by the chart theme
   *
   * Priority: explicit ChartTheme axis.labelColor and legend.textColor take precedence.
   * sceneTheme provides DEFAULT fallbacks only.
   *
   * Note: All four built-in chart theme presets have explicit labelColor/textColor values.
   * sceneTheme.colorMode has no effect when using them without a custom override.
   */
  readonly sceneTheme?: SceneTheme;
};
```

### 7.2 Sub-Config Types

```typescript
export type ChartSeriesMaterialTokens = {
  readonly color: string;              // CSS hex
  readonly metalness: number;          // 0–1
  readonly roughness: number;          // 0–1
  readonly transmission: number;       // 0–1 (glass)
  readonly emissiveIntensity: number;
  readonly depth: number;              // depth for extruded bar/area geometry
};

export type ChartAxisTokens = {
  readonly lineColor: string;
  readonly labelColor: string;         // tick label text color
  readonly fontSize: number;           // world units
  readonly tickLength: number;         // world units
};

export type ChartBackgroundTokens = {
  readonly planeColor: string | null;  // null = no background plane
  readonly planeOpacity: number;
  readonly gridColor: string | null;   // null = no grid lines
};

export type ChartLegendTokens = {
  readonly textColor: string;
  readonly fontSize: number;           // world units
  readonly swatchSize: number;         // world units
  readonly spacing: number;            // world units
};

export type ChartInteractionTokens = {
  readonly hoverColor: string;
  readonly hoverEmissiveIntensity: number;
  readonly selectedColor: string;
};
```

### 7.3 ChartDSL `sceneTheme` Prop

```typescript
export type ChartDSL = {
  readonly id: string;
  readonly type: ChartType;
  readonly theme?: ChartThemeName | ChartTheme;
  /**
   * Optional scene theme override for this chart element.
   * When set, overrides ChartTheme.sceneTheme.
   * Enables using a named theme with a custom sceneTheme without constructing
   * a full ChartTheme object.
   *
   * @example
   * <Chart theme="darkGlass" sceneTheme={mySceneTheme} />
   */
  readonly sceneTheme?: SceneTheme;
  // ... other props
};
```

### 7.4 Font Resolution Priority

```
ChartDSL.sceneTheme.font.webglFontUrl  (element-level override — highest priority)
  → ChartTheme.sceneTheme.font.webglFontUrl  (theme-level fallback)
  → undefined  (use troika built-in default font)
```

### 7.5 ColorMode Label Color Resolution Priority

```
Explicit ChartTheme.axis.labelColor    (always wins — highest priority)
  → sceneTheme.colorMode-derived fallback  (only if explicit value is absent)
  → troika default color  (lowest priority)
```

**Known limitation:** All four built-in `ChartTheme` presets have explicit `axis.labelColor` and `legend.textColor` values. `sceneTheme.colorMode` therefore has **no effect** on text colors when using any built-in preset without a custom override.

### 7.6 Usage Patterns

**Named preset with custom font:**
```tsx
import { darkSceneTheme } from '@brewsite/core';

<Chart
  id="sales-chart"
  type="bar"
  theme="darkGlass"
  sceneTheme={{
    ...darkSceneTheme,
    font: { ...darkSceneTheme.font, webglFontUrl: '/fonts/inter-msdf.ttf' },
  }}
/>
```

**Full custom theme with sceneTheme:**
```typescript
import type { ChartTheme } from '@brewsite/charts';
import { darkGlassChartTheme } from '@brewsite/charts';
import { darkSceneTheme } from '@brewsite/core';

const brandChartTheme: ChartTheme = {
  ...darkGlassChartTheme,
  sceneTheme: {
    ...darkSceneTheme,
    font: { htmlFamily: 'Inter, sans-serif', webglFontUrl: '/fonts/inter-msdf.ttf' },
  },
};
```

**Matching diagram font — single sceneTheme shared:**
```typescript
// One sceneTheme drives fonts in both diagram and chart renderers:
const mySceneTheme = { ...darkSceneTheme, font: { ...darkSceneTheme.font, webglFontUrl: '/fonts/inter-msdf.ttf' } };

<DiagramCanvas theme={{ ...darkGlassTheme, sceneTheme: mySceneTheme }} />
<Chart theme="darkGlass" sceneTheme={mySceneTheme} />
```

---

## 8. Technical Considerations

### FontUrl propagation path

`fontUrl` is resolved from `ChartState.sceneTheme` (element-level) or `ChartTheme.sceneTheme` (theme-level) and stored in `ChartRenderContext`. From there it flows to:
- `AxesRenderer` → troika-three-text `font` property on all axis tick labels and title labels
- `LegendRenderer` → troika-three-text `font` property on all legend labels
- All six chart renderers (`BarRenderer`, `LineRenderer`, `AreaRenderer`, `PieRenderer`, `ScatterRenderer`, `HeatmapRenderer`) receive it via `ChartRenderContext` for any text they render internally

### Color-mode fallbacks

The chart render context derives axis/legend label color fallbacks from `sceneTheme.colorMode`:
- `'dark'` → `'rgba(255,255,255,0.8)'` for axis labels, `'rgba(255,255,255,0.7)'` for legend text
- `'light'` → `'rgba(0,0,0,0.8)'` for axis labels, `'rgba(0,0,0,0.7)'` for legend text

These fallbacks are only used when the resolved `ChartTheme` has no explicit `axis.labelColor` or `legend.textColor`. Since all four built-in presets define these explicitly, colorMode fallbacks are only active in fully custom themes.

### No font URL in ChartState compiled output

`ChartState` (the compiled tick state) stores `sceneTheme?: SceneTheme` as the resolved value. The full `SceneTheme` object is stored rather than just `fontUrl` because the render layer may need other fields (colorMode for fallback resolution). This is compile-time data — the `SceneTheme` is a plain readonly object with no function references, safe for serialization.

---

## 9. Known Limitations

1. **`sceneTheme.colorMode` has no effect on built-in preset label colors.** All four built-in chart theme presets have explicit `axis.labelColor` and `legend.textColor` values. The colorMode-derived fallback only applies when these fields are not set. Custom themes that omit explicit label colors will receive colorMode defaults.

2. **WebGL font URL must be MSDF-encoded.** Standard web font URLs will not render correctly in troika-three-text. The file must be MSDF-pre-processed. Self-host for production.

3. **Font is chart-wide, not per-axis.** A single `webglFontUrl` applies to all troika-rendered text in the chart (both axes, legend, any internally rendered text). Per-axis font customization is not supported in v1.

---

## 10. Breaking Change Assessment

**Semver impact: minor.** `ChartTheme.sceneTheme` and `ChartDSL.sceneTheme` are optional additions. All four preset themes remain valid without modification. No existing `ChartTheme` fields are changed.

---

## 11. Dependencies

- `@brewsite/core` — `SceneTheme` type import
- `troika-three-text` — WebGL text rendering (peer dependency via Three.js ecosystem)
- No new external npm packages

---

## 12. Risks & Mitigations

**MSDF font loading errors:** If `webglFontUrl` points to a non-MSDF or unavailable file, troika silently falls back to its built-in font with a console warning. Mitigation: document the MSDF requirement clearly in JSDoc and PRD. A development-mode warning could be added in a future iteration.

**Chart-level vs. player-level font discrepancy:** A consumer might set a font on `EngineProvider.sceneTheme` for overlay content but forget to wire the same font URL to `ChartDSL.sceneTheme`. The two font systems (CSS and WebGL) are independent. Mitigation: document the separation clearly. The recommended pattern is to define one `SceneTheme` constant and share it across `EngineProvider`, `DiagramTheme.sceneTheme`, and `ChartDSL.sceneTheme`.

---

## 13. Launch Criteria

- `ChartTheme.sceneTheme` optional field present and typed correctly in `packages/charts/src/themes/types.ts`.
- `ChartDSL.sceneTheme` optional field present and typed correctly in `packages/charts/src/elements/chart/types.ts`.
- `fontUrl` threaded through `ChartRenderContext` to `AxesRenderer`, `LegendRenderer`, and all six chart renderers.
- Compile test: `ChartState.sceneTheme` is populated from `ChartDSL.sceneTheme` and from `ChartTheme.sceneTheme` with correct override priority.
- `pnpm test` passes for `@brewsite/charts`.
- TypeScript strict-mode typecheck passes on `packages/charts/src/`.

---
title: "BrewSite Charts — Theming System"
doc_type: prd
status: active
owner: brewsite-product-manager
last_updated: 2026-03-11
change_history:
  - date: 2026-03-04
    author: "Toolkit Product"
    summary: "Initial PRD created. Documents the ChartTheme system as implemented: ChartTheme type, four preset themes, sceneTheme integration for cross-package font and color-mode defaults, and ChartDSL.sceneTheme element-level override."
  - date: 2026-03-09
    author: "Toolkit Product"
    summary: "NVS Universal Coordinate System: ChartState.bounds.width and bounds.height changed from world-units to NVS fractions [0..1] — breaking change. DEFAULT_CHART_STATE.bounds is now { width: 1.0, height: 1.0, depth: 0.4 }. ChartWidget.apply() now uses context.coords.toWorldSize() to convert NVS bounds to world-space at render time. Breaking change table in Section 10 updated. See packages/charts/MIGRATION.md."
  - date: 2026-03-11
    author: "Toolkit Product"
    summary: "V2.1.0 theme coverage additions: five new optional token groups on ChartTheme (ChartBarTokens, ChartAreaTokens, ChartGridlinesTokens, ChartDataLabelsTokens, ChartReferenceLineTokens) and two extensions to existing types (ChartAxisTokens.titleFontSize, ChartLegendTokens.textOpacity). All new fields are optional — no breaking change to existing createChartTheme() callers. Four built-in themes updated with explicit values. ChartBackgroundTokens.gridColor deprecated in favor of ChartGridlinesTokens. lineWidth for reference lines uses world-space BoxGeometry (not LineBasicMaterial.linewidth, which is WebGL1-capped at 1px). Dashed gridlines use LineDashedMaterial (acceptable for decorative lines at 1px width)."
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
- **V2.1:** As a toolkit consumer, I want `createChartTheme(darkGlassChartTheme, { bar: { padding: 0.3 } })` so that I can set the default bar padding once at the theme level instead of repeating it on every `<BarChart>` in every scene.
- **V2.1:** As a toolkit consumer, I want `createChartTheme(base, { gridlines: { color: '#888', opacity: 0.2, visible: true } })` so that gridlines are on by default for my theme without setting `gridlines` on every `<ChartAxis>`.
- **V2.1:** As a toolkit consumer, I want `theme.axis.titleFontSize` to be independent of `theme.axis.fontSize` so that axis titles can be slightly larger than tick labels to establish visual hierarchy.
- **V2.1:** As a toolkit consumer, I want `theme.legend.textOpacity` so that I can fade legend labels independently of their color, without constructing a new color value.

---

## 6. Functional Requirements

1. The `ChartTheme` type shall be a plain TypeScript object type with no runtime dependencies.
2. Four preset themes — `darkGlassChartTheme`, `neonCyberChartTheme`, `enterpriseChartTheme`, `lightMinimalChartTheme` — shall be exported as named constants from `@brewsite/charts`.
3. `ChartTheme` shall accept an optional `sceneTheme?: SceneTheme` field (imported from `@brewsite/core`).
4. When `sceneTheme.font.webglFontUrl` is set, the chart render context shall pass it to troika-three-text for all axis tick labels, axis title labels, and legend labels.
5. When `sceneTheme.colorMode` is `'dark'` and no explicit `ChartAxisTokens.labelColor` override is set, the chart renderer shall use a light-appropriate label color as a fallback default. Explicit theme values take precedence.
6. When `sceneTheme.colorMode` is `'light'` and no explicit label color is set, the chart renderer shall use a dark-appropriate label color as a fallback default.
7. `ChartDSL.sceneTheme?: SceneTheme` shall be available as a prop on `<Chart>`, taking precedence over `ChartTheme.sceneTheme` when set.
8. `fontUrl` shall be threaded through `ChartRenderContext → AxesRenderer → LegendRenderer` and all six chart renderers.
9. **V2.1:** `ChartTheme` shall accept five new optional token groups: `bar?: ChartBarTokens`, `area?: ChartAreaTokens`, `gridlines?: ChartGridlinesTokens`, `dataLabels?: ChartDataLabelsTokens`, `referenceLines?: ChartReferenceLineTokens`. All groups are optional. When absent, renderers use documented fallback defaults.
10. **V2.1:** `ChartAxisTokens` shall accept an optional `titleFontSize?: number` field. When absent, `AxesRenderer` defaults to `theme.axis.fontSize * 1.1`.
11. **V2.1:** `ChartLegendTokens` shall accept an optional `textOpacity?: number` field. When absent, `LegendRenderer` defaults to `1.0`.
12. **V2.1:** When `ChartGridlinesTokens` is present, it takes precedence over `ChartBackgroundTokens.gridColor`. The fallback chain in `AxesRenderer` is: `theme.gridlines?.color ?? theme.background.gridColor ?? '#4a6080'`.
13. **V2.1:** `ChartGridlinesTokens.dashSize` and `gapSize` enable dashed gridlines via `LineDashedMaterial`. When absent, gridlines use `LineBasicMaterial` (solid). WebGL1 linewidth cap (1px) applies to both — dashed gridlines are decorative.
14. **V2.1:** `ChartReferenceLineTokens.lineWidth` is a world-space width applied to a thin `BoxGeometry` plane, not a `Three.js linewidth` property. This avoids the WebGL1 1px linewidth cap for reference lines.
15. **V2.1:** `createChartTheme(base, overrides)` shall support deep-merging all new optional token groups via `ChartThemeOverrides`. Partial overrides of nested groups are supported (e.g., overriding only `bar.padding`).
16. **V2.1:** All four built-in preset themes shall include explicit values for all new optional token groups. New `ChartThemeOverrides` callers that don't specify new groups inherit the preset's explicit values.

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
  readonly line: ChartLineTokens;
  readonly pie: ChartPieTokens;
  readonly interaction: ChartInteractionTokens;
  /**
   * Optional cross-package scene theme context.
   *
   * When present, ChartRenderer derives:
   * - WebGL font URL from sceneTheme.font.webglFontUrl
   * - Axis/legend label color fallback from sceneTheme.colorMode when not set by the chart theme
   *
   * Priority: explicit ChartTheme axis.labelColor and legend.textColor take precedence.
   * sceneTheme provides DEFAULT fallbacks only.
   */
  readonly sceneTheme?: SceneTheme;
  // V2.1 additions — all optional; renderers have documented fallback defaults:
  readonly bar?: ChartBarTokens;
  readonly area?: ChartAreaTokens;
  readonly gridlines?: ChartGridlinesTokens;
  readonly dataLabels?: ChartDataLabelsTokens;
  readonly referenceLines?: ChartReferenceLineTokens;
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
  /** V2.1: Font size for axis title labels, independent of tick label fontSize. Default: fontSize * 1.1. */
  readonly titleFontSize?: number;
};

export type ChartBackgroundTokens = {
  readonly planeColor: string | null;  // null = no background plane
  readonly planeOpacity: number;
  /** @deprecated V2.1: use ChartGridlinesTokens.color. Kept for backward compat — ChartGridlinesTokens takes precedence when present. */
  readonly gridColor: string | null;
};

export type ChartLegendTokens = {
  readonly textColor: string;
  readonly fontSize: number;           // world units
  readonly swatchSize: number;         // world units
  readonly spacing: number;            // world units
  /** V2.1: Opacity for legend label text [0..1]. Default: 1.0. */
  readonly textOpacity?: number;
};

export type ChartInteractionTokens = {
  readonly hoverColor: string;
  readonly hoverEmissiveIntensity: number;
  readonly selectedColor: string;
};

// V2.1 new optional token group types:

/** V2.1: Bar chart theme defaults. Used when DSL barPadding is not specified. */
export type ChartBarTokens = {
  /** Padding ratio between bar groups [0..1]. Renderer default when absent: 0.2. */
  readonly padding: number;
};

/** V2.1: Area chart theme defaults. Used when DSL fillOpacity is not specified. */
export type ChartAreaTokens = {
  /** Area fill opacity [0..1]. Renderer default when absent: 0.7. */
  readonly fillOpacity: number;
};

/**
 * V2.1: Gridline visual tokens.
 * When present, takes precedence over ChartBackgroundTokens.gridColor (which is deprecated).
 * When absent, ChartBackgroundTokens.gridColor is used for backward compatibility.
 * AxesRenderer fallback chain: theme.gridlines?.color ?? theme.background.gridColor ?? '#4a6080'
 */
export type ChartGridlinesTokens = {
  readonly color: string;
  /** Gridline opacity [0..1]. Renderer default when absent: 0.15. */
  readonly opacity: number;
  /**
   * Whether gridlines are visible by default for this theme.
   * Per-axis DSL gridlines prop overrides this. Renderer default when absent: false.
   */
  readonly visible: boolean;
  /**
   * Dash segment length in world units. Absent = solid line (LineBasicMaterial).
   * When set, requires LineDashedMaterial + line.computeLineDistances().
   * Note: linewidth is WebGL1-capped at 1px — dashed gridlines are decorative.
   */
  readonly dashSize?: number;
  /** Gap between dash segments in world units. Only meaningful when dashSize is set. */
  readonly gapSize?: number;
};

/** V2.1: Data label theme tokens. Applied when <ChartDataLabels> is present in the DSL. */
export type ChartDataLabelsTokens = {
  /** Font size in world units. Renderer default when token group absent: 0.05. */
  readonly fontSize: number;
  /** Label text color (CSS hex). Renderer default when absent: '#ffffff'. */
  readonly color: string;
  /** Optional pill background color (CSS hex). Absent = no background. */
  readonly background?: string;
};

/**
 * V2.1: Reference line theme tokens.
 * Applied when ReferenceLine.color or lineWidth is not specified in the DSL.
 *
 * Implementation note: lineWidth is world-space width of a thin BoxGeometry plane,
 * NOT a Three.js linewidth property. BoxGeometry is portable; LineBasicMaterial.linewidth
 * is WebGL1-capped at 1px. AxesRenderer (gridlines) uses LineDashedMaterial; reference
 * lines use BoxGeometry.
 */
export type ChartReferenceLineTokens = {
  /** Default line color (CSS hex) when not specified on <ReferenceLine>. Renderer default: '#ff8844'. */
  readonly defaultColor: string;
  /** World-space width of the reference line BoxGeometry geometry. Renderer default: 0.005. */
  readonly lineWidth: number;
  /** Line opacity [0..1]. Renderer default: 0.85. */
  readonly lineOpacity: number;
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

### NVS Sub-Region Support

`Chart` elements participate in the Normalized Viewport Space (NVS) system. `ChartWidget` implements `INVSBounded` (from `@brewsite/core`). When a chart is placed in a sub-region of the AR-locked container, its camera projection and tooltip DOM projection are both restricted to that region.

**Chart DSL NVS props (all optional, default: fullscreen):**

```typescript
export type ChartDSL = {
  readonly id: string;
  readonly type: ChartType;
  readonly theme?: ChartThemeName | ChartTheme;
  readonly sceneTheme?: SceneTheme;

  // NVS sub-region props — new in NVS system
  readonly x?: number;  // NVS left edge [0, 1]. Default: 0
  readonly y?: number;  // NVS top edge [0, 1]. Default: 0
  readonly w?: number;  // NVS width [0, 1]. Default: 1
  readonly h?: number;  // NVS height [0, 1]. Default: 1

  // ... other props
};
```

`x`, `y`, `w`, `h` are compiled into `ChartState.nvsBounds` and reflected by `ChartWidget.nvsBounds`. This controls camera framing and tooltip projection.

**`ChartTooltipOverlay` — Breaking change:**

The `camera` and `domElement` props on `ChartTooltipOverlay` have been **removed**. The `nvsBounds: NVSRect` prop is now **required**. `ChartTooltipOverlay` derives viewport offset from the NVS bounds against the `EngineARContainer` dimensions, rather than performing its own DOM element coordinate query.

```typescript
// REMOVED props:
// camera: THREE.Camera
// domElement: HTMLElement

// REQUIRED prop added:
// nvsBounds: NVSRect

// Current ChartTooltipOverlay props:
export type ChartTooltipOverlayProps = {
  nvsBounds: NVSRect;        // required — replaces camera + domElement
  className?: string;
};
```

**Migration:** Remove `camera` and `domElement` props from `ChartTooltipOverlay` usages. Add `nvsBounds` — pass the value from `ChartWidget.nvsBounds` or construct a fullscreen rect `{ x: 0, y: 0, w: 1, h: 1 }` for charts that fill the viewport.

```tsx
// Before (removed):
<ChartTooltipOverlay camera={engine.camera} domElement={canvas} />

// After (current):
<ChartTooltipOverlay nvsBounds={chartWidget.nvsBounds} />
```

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

**Theme system (this PRD's original scope): Semver impact: minor.** `ChartTheme.sceneTheme` and `ChartDSL.sceneTheme` are optional additions. All four preset themes remain valid without modification. No existing `ChartTheme` fields are changed.

**NVS Universal Coordinate System (breaking change — major semver impact on `@brewsite/charts`):**

`ChartState.bounds` — coordinate system change:

| Symbol | Before | After |
|---|---|---|
| `ChartState.bounds.width` | World-units (absolute Three.js scale) | **NVS fraction [0..1]** (fraction of viewport width) |
| `ChartState.bounds.height` | World-units | **NVS fraction [0..1]** (fraction of viewport height) |
| `ChartState.bounds.depth` | World-units | World-units (unchanged — depth is always world-space) |
| `DEFAULT_CHART_STATE.bounds` | `{ width: 6.0, height: 4.0, depth: 0.4 }` | **`{ width: 1.0, height: 1.0, depth: 0.4 }`** |

`ChartWidget.apply()` converts NVS bounds to world-space using `context.coords.toWorldSize()` at render time. Any consumer that authors explicit `width`/`height` values in `<Chart>` DSL (or overrides `DEFAULT_CHART_STATE.bounds`) must scale their values from world-units to NVS fractions. A fullscreen chart at default scale is now `width: 1, height: 1`. See `packages/charts/MIGRATION.md` for the migration guide.

`ChartTooltipOverlay` breaking change:

| Symbol | Change |
|---|---|
| `ChartTooltipOverlayProps.camera` | **Removed.** Was `THREE.Camera`. |
| `ChartTooltipOverlayProps.domElement` | **Removed.** Was `HTMLElement`. |
| `ChartTooltipOverlayProps.nvsBounds` | **Added, required.** Type: `NVSRect` from `@brewsite/core`. |

Any consumer code that passes `camera` or `domElement` to `ChartTooltipOverlay` will receive a TypeScript error. Migration: remove those props and add `nvsBounds`. If the chart fills the full viewport, pass `{ x: 0, y: 0, w: 1, h: 1 }`.

`ChartDSL.x`, `y`, `w`, `h` props and `ChartState.nvsBounds` are additive (minor) and require no migration.

---

## 11. Dependencies

- `@brewsite/core` — `SceneTheme`, `NVSRect`, `INVSBounded` type imports
- `troika-three-text` — WebGL text rendering (peer dependency via Three.js ecosystem)
- No new external npm packages

---

## 12. Risks & Mitigations

**MSDF font loading errors:** If `webglFontUrl` points to a non-MSDF or unavailable file, troika silently falls back to its built-in font with a console warning. Mitigation: document the MSDF requirement clearly in JSDoc and PRD. A development-mode warning could be added in a future iteration.

**Chart-level vs. player-level font discrepancy:** A consumer might set a font on `EngineProvider.sceneTheme` for overlay content but forget to wire the same font URL to `ChartDSL.sceneTheme`. The two font systems (CSS and WebGL) are independent. Mitigation: document the separation clearly. The recommended pattern is to define one `SceneTheme` constant and share it across `EngineProvider`, `DiagramTheme.sceneTheme`, and `ChartDSL.sceneTheme`.

---

## 13. Launch Criteria

**Shipped (original theming system):**
- [x] `ChartTheme.sceneTheme` optional field present and typed correctly.
- [x] `ChartDSL.sceneTheme` optional field present and typed correctly.
- [x] `fontUrl` threaded through `ChartRenderContext` to `AxesRenderer`, `LegendRenderer`, and all six chart renderers.
- [x] `pnpm test` passes for `@brewsite/charts`.

**V2.1 (pending implementation):**
- [ ] Five new optional token group types exported from `@brewsite/charts`: `ChartBarTokens`, `ChartAreaTokens`, `ChartGridlinesTokens`, `ChartDataLabelsTokens`, `ChartReferenceLineTokens`.
- [ ] `ChartAxisTokens.titleFontSize` and `ChartLegendTokens.textOpacity` optional fields present and typed.
- [ ] All four built-in themes include explicit values for all new token groups.
- [ ] `createChartTheme()` `ChartThemeOverrides` accepts and deep-merges all new token groups.
- [ ] `AxesRenderer` uses `titleFontSize ?? fontSize * 1.1` for axis title rendering.
- [ ] `LegendRenderer` applies `textOpacity ?? 1.0` to legend label material/text opacity.
- [ ] `AxesRenderer` gridline rendering uses the three-level fallback chain for color, plus `LineDashedMaterial` branch when `dashSize` is set.
- [ ] `BarRenderer` reads `barPadding` from `theme.bar?.padding ?? 0.2` when DSL `barPadding` is absent.
- [ ] `AreaRenderer` reads `fillOpacity` from `theme.area?.fillOpacity ?? 0.7` when DSL `fillOpacity` is absent.
- [ ] `DataLabelRenderer` reads `fontSize` and `color` from `theme.dataLabels` with documented fallbacks.
- [ ] Reference line rendering uses `theme.referenceLines.lineWidth` as world-space `BoxGeometry` width.
- [ ] `pnpm --filter @brewsite/charts typecheck` passes with zero errors after V2.1 theme changes.

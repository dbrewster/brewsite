---
title: "BrewSite Charts — Theming System"
doc_type: prd
status: active
owner: brewsite-product-manager
last_updated: 2026-03-15
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
  - date: 2026-03-11
    author: "Toolkit Product"
    summary: "Theme redesign: expanded canonical theme set from four to six names. Added midnightChartTheme (warm dark, amber-gold) and lightCanvasChartTheme (premium light, jewel-tone series). Redesigned darkGlass, neonCyber, and enterprise palettes for cross-package coherence with @brewsite/diagram. ChartThemeName union updated to include midnight and lightCanvas. CHART_THEMES registry updated with all six entries. All six themes carry 8-color series palettes coordinated with paired diagram theme files via comment blocks. Version bump: minor."
  - date: 2026-03-11
    author: "Toolkit Product"
    summary: "Theming overhaul — polarity pairs and examples toggle: ChartThemeName is now a type alias for ThemeFamily (imported from @brewsite/core). Added CHART_THEME_PAIRS registry (Record<ThemeFamily, ChartThemePair>) — each entry pre-wired with the corresponding SceneTheme from SCENE_THEME_PAIRS. Six polarity-variant ChartTheme files added as @internal placeholders; production aesthetic authoring deferred. Examples app: ChartDemoPage now exports ChartDemoThemeContext and useDemoChartTheme() hook consumed by all 11 chart scenes; added sun/moon polarity toggle button; polarity toggle uses clearSceneTrackCache() + engineKey increment for full player remount. Version bump: minor."
  - date: 2026-03-11
    author: "Toolkit Product"
    summary: "Tooltip + Y-axis projection system: Added ChartTooltipTokens and ChartProjectionTokens optional token groups to ChartTheme. All 12 preset themes include explicit tooltip and projection token objects. Added <ChartTooltip> DSL child, ChartTooltipState compiled type, ChartTooltipStore global bridge, <ChartTooltipHost /> overlay component, useChartTooltip() and useChartTooltipConfig() hooks. ChartHitInfo enriched with typed ChartHitMeta discriminated union and projectionTarget field. ChartProjectionRenderer added for 3D beam + landing dot. ChartTooltipOverlay marked @deprecated — replaced by <ChartTooltip> + <ChartTooltipHost />. All new types exported from @brewsite/charts."
  - date: 2026-03-12
    author: "Toolkit Product"
    summary: "Theme family art direction: all six polarity-variant ChartTheme presets promoted from @internal placeholders to production-ready public exports. Each polarity variant carries a fully designed series material profile (metalness, roughness, transmission, emissiveIntensity), axis/legend label colors, and tooltip/projection tokens coordinated with the family's neutral palette and accent identity. Tooltip and projection token values for all 12 presets are now spec-authoritative. CHART_THEME_PAIRS exports all 12 variants. Added per-family series material profiles and opposite-polarity completeness requirements."
  - date: 2026-03-13
    author: "Toolkit Product"
    summary: "Codebase audit sync. Corrected ChartAxisTokens, ChartLegendTokens, and ChartInteractionTokens API Design entries to include all fields present in the implementation (lineOpacity, tickOpacity, labelOpacity, gap for axis; swatchSize, spacing, gap for legend; selectedColor for interaction). Updated Section 7.6 usage pattern to use <BarChart> instead of deprecated <Chart type='bar'>. Marked all V2.1 token group launch criteria as complete — ChartBarTokens, ChartAreaTokens, ChartGridlinesTokens, ChartDataLabelsTokens, ChartReferenceLineTokens are shipped and exported."
  - date: 2026-03-15
    author: "Toolkit Product"
    summary: "Codebase alignment audit. Fixed CHART_THEMES type: actual is Partial<Record<ChartThemeName, ChartTheme>> with only 'enterprise' entry (not all six). Removed CHART_THEME_PAIRS from public API — it is not exported from the barrel. Named preset exports limited to enterpriseChartTheme, defaultChartTheme, enterpriseLightChartTheme, defaultLightChartTheme. Other family presets (darkGlass, midnight, neonCyber, lightCanvas, lightMinimal) are registered at runtime by @brewsite/themes via registerChartThemePair(), not exported from @brewsite/charts. Fixed createChartTheme() ChartThemeOverrides: does NOT include tooltip or projection as override-able fields. Updated functional requirements, API design, and launch criteria to match the actual registry-based architecture."
---

# BrewSite Charts — Theming System

## 1. Overview

The theming system in `@brewsite/charts` provides the complete design language for 3D chart visualization. A `ChartTheme` is a plain TypeScript object that configures series material tokens, axis styling, background plane tokens, legend styling, and interaction feedback colors for all elements within a chart. The `@brewsite/charts` barrel exports two built-in preset themes (`enterpriseChartTheme` / `defaultChartTheme` for dark polarity, `enterpriseLightChartTheme` / `defaultLightChartTheme` for light polarity). Additional named family presets (`darkGlass`, `midnight`, `neonCyber`, `lightCanvas`, `lightMinimal`) are registered at runtime by `@brewsite/themes` via the `registerChartThemePair()` API and resolved through `resolveChartTheme(family, polarity)`. The `ChartThemeName` type is an alias for `ThemeFamily` from `@brewsite/core`. Each preset carries an 8-color series palette coordinated with its `@brewsite/diagram` counterpart. The `ChartTheme` accepts an optional `sceneTheme?: SceneTheme` field from `@brewsite/core` that provides cross-package font URL and color-mode defaults.

Affects: `@brewsite/charts`.

---

## 2. Problem Statement

Chart rendering via troika-three-text used the troika built-in default font unconditionally — there was no mechanism to specify a custom MSDF font. Additionally, axis label and legend text colors were only configurable via explicit `ChartTheme` fields, with no connection to a scene-level color mode. Scene authors combining charts with diagrams and overlay content had to manage font and color settings in three separate systems with no shared vocabulary.

---

## 3. Goals & Success Metrics

**Primary goals:**
- A consumer can pass a `sceneTheme` to a chart and have axis labels and legend text render using the same font as diagram labels and overlay content.
- Six preset themes (`darkGlass`, `midnight`, `neonCyber`, `enterprise`, `lightCanvas`, `lightMinimal`) produce visually coherent chart output without additional configuration, with palettes coordinated with their paired `@brewsite/diagram` presets.
- The `sceneTheme` integration is fully additive — existing charts that never set `sceneTheme` behave identically to before.

**Success metrics:**
- All six preset `ChartTheme` constants pass TypeScript strict-mode type check.
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
- As a toolkit consumer, I want the six preset chart themes to be individually importable so that my bundle only includes the preset I use.
- **V2.1:** As a toolkit consumer, I want `createChartTheme(darkGlassChartTheme, { bar: { padding: 0.3 } })` so that I can set the default bar padding once at the theme level instead of repeating it on every `<BarChart>` in every scene.
- **V2.1:** As a toolkit consumer, I want `createChartTheme(base, { gridlines: { color: '#888', opacity: 0.2, visible: true } })` so that gridlines are on by default for my theme without setting `gridlines` on every `<ChartAxis>`.
- **V2.1:** As a toolkit consumer, I want `theme.axis.titleFontSize` to be independent of `theme.axis.fontSize` so that axis titles can be slightly larger than tick labels to establish visual hierarchy.
- **V2.1:** As a toolkit consumer, I want `theme.legend.textOpacity` so that I can fade legend labels independently of their color, without constructing a new color value.
- As a toolkit consumer, I want to add `<ChartTooltip />` as a child of my chart DSL so that hover tooltips appear automatically with no external component or widget reference required.
- As a toolkit consumer, I want to place `<ChartTooltipHost />` once inside `EngineOverlayHost` and have it handle all chart tooltips in the engine so I don't need one overlay component per chart.
- As a toolkit consumer, I want `<ChartTooltip projection />` so that a glowing 3D beam animates from the hovered data point to the Y-axis, giving hover interaction a signature visual moment.
- As a toolkit consumer, I want `theme.tooltip` and `theme.projection` token groups so that tooltip and projection visuals are fully theme-native without custom CSS.
- As a toolkit consumer, I want `useChartTooltipConfig('myChartId', { renderContent })` so that I can render custom React content in the tooltip without replacing the built-in layout for other charts.

---

## 6. Functional Requirements

1. The `ChartTheme` type shall be a plain TypeScript object type with no runtime dependencies.
2. Two preset theme pairs shall be exported as named constants from the `@brewsite/charts` barrel: `enterpriseChartTheme` / `defaultChartTheme` (dark polarity) and `enterpriseLightChartTheme` / `defaultLightChartTheme` (light polarity). The `ChartThemeName` union type shall be a type alias for `ThemeFamily` from `@brewsite/core`, maintaining backward compatibility while tying it to the cross-package canonical union. The `CHART_THEMES: Partial<Record<ChartThemeName, ChartTheme>>` registry shall include the `enterprise` entry. Additional family presets (`darkGlass`, `midnight`, `neonCyber`, `lightCanvas`, `lightMinimal`) are internal files not on the public barrel — they are registered at runtime by `@brewsite/themes` via `registerChartThemePair()`.
2a. A `ChartThemePairEntry` type (`{ dark: ChartTheme; light: ChartTheme }`) shall be exported from `@brewsite/charts`. A deprecated `ChartThemePair` type (`{ readonly dark: ChartTheme; readonly light: ChartTheme }`) shall also be exported for backward compatibility. The `registerChartThemePair(family, pair)` function and `resolveChartTheme(family, polarity)` function shall be exported from `@brewsite/charts` to enable external packages (e.g., `@brewsite/themes`) to register and resolve theme pairs at runtime. The registry is pre-loaded with `'default'` and `'enterprise'` entries at module initialization.
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
15. **V2.1:** `createChartTheme(base, overrides)` shall support deep-merging optional token groups via `ChartThemeOverrides`. The override-able fields are: `name`, `series`, `axis`, `background`, `legend`, `line`, `pie`, `interaction`, `bar`, `area`, `gridlines`, `dataLabels`, `referenceLines`. Note: `tooltip` and `projection` are NOT included in `ChartThemeOverrides` — consumers who need custom tooltip or projection tokens must construct a full `ChartTheme` object or spread onto the result of `createChartTheme()`. Partial overrides of nested groups are supported (e.g., overriding only `bar.padding`).
16. **V2.1:** All six built-in preset themes shall include explicit values for all new optional token groups. New `ChartThemeOverrides` callers that don't specify new groups inherit the preset's explicit values.
17. `ChartTheme` shall accept two new optional token groups: `tooltip?: ChartTooltipTokens` and `projection?: ChartProjectionTokens`. All 12 built-in preset themes (6 base + 6 polarity variants) include explicit values for both groups.
18. `<ChartTooltip>` shall be a valid DSL child of all chart types (`BarChart`, `LineChart`, `AreaChart`, `ScatterChart`, `PieChart`, `HeatmapChart`). It shall compile to `ChartState.tooltip: ChartTooltipState | null`.
19. `ChartHitInfo` shall include a `meta?: ChartHitMeta` discriminated union field with chart-type-specific data (series label, stack total, percentage, size, intensity, etc.) populated by each renderer's `resolveHoverInfo()`.
20. Bar, line, area, and scatter renderers shall populate `ChartHitInfo.projectionTarget` — the world-space terminus on the Y-axis face at the same Y and Z height as the hit point. Pie and heatmap renderers shall not populate `projectionTarget`.
21. `<ChartTooltipHost />` (zero props) shall be a valid child of `EngineOverlayHost`. It subscribes to `ChartTooltipStore` and renders the active tooltip for whichever chart is hovered. When no chart is hovered, it renders nothing.
22. `useChartTooltipConfig(chartId: string, config: ChartTooltipRuntimeConfig): void` shall register a custom `renderContent` function outside the SceneTrack. The hook deregisters on component unmount or `chartId` change.
23. The Y-axis projection beam shall be drawn by `ChartProjectionRenderer` when `ChartHitInfo.projectionTarget` is non-null. Entrance animation is 220ms ease-out-expo (`beam.scale.x` from 0 to 1). Exit animation fades beam and dot to zero opacity over 160ms. Hover-change snaps to the new position and restarts the entrance animation.
24. `ChartTooltipOverlay` is deprecated. Consumers must migrate to `<ChartTooltip>` + `<ChartTooltipHost />`. `ChartTooltipOverlay` will be removed in the next minor version.
25. When `theme.tooltip` or `theme.projection` is absent (consumer custom theme without these optional groups), `ChartTooltipHost` and `ChartProjectionRenderer` use `darkGlass` token values as compile-time fallback constants.
26. Each built-in `ChartTheme` preset shall define a family-specific series material profile in `theme.series[]` — covering `metalness`, `roughness`, `transmission`, and `emissiveIntensity` — that reflects the rendering character of that family and polarity. Dark-polarity variants use elevated emissive intensity and higher metalness relative to light-polarity variants of the same family. Light-polarity variants use near-matte materials with minimal emission to avoid visual noise on pale scene backgrounds.
27. For every `ThemeFamily` registered via `registerChartThemePair()`, both the dark and light polarity `ChartTheme` entries shall carry fully designed values across all token groups: series materials, axis/legend colors, interaction tokens, tooltip tokens, and projection tokens. Neither polarity may reuse the other polarity's token values as a substitute for intentional design.

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
  /**
   * Tooltip HTML overlay visual tokens.
   * When absent, ChartTooltipHost uses darkGlass token values as built-in fallback.
   * All 12 built-in preset themes include explicit values.
   */
  readonly tooltip?: ChartTooltipTokens;
  /**
   * Y-axis projection beam visual tokens.
   * Beam is drawn when ChartHitInfo.projectionTarget is non-null (bar, line, area, scatter).
   * When absent, ChartProjectionRenderer uses darkGlass token values as built-in fallback.
   * All 12 built-in preset themes include explicit values.
   */
  readonly projection?: ChartProjectionTokens;
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
  /** Axis line color. */
  readonly lineColor: string;
  /** Axis line opacity multiplier. */
  readonly lineOpacity: number;
  /** Tick mark opacity multiplier. */
  readonly tickOpacity: number;
  /** Tick label text color. */
  readonly labelColor: string;
  /** Tick and title label opacity multiplier. */
  readonly labelOpacity: number;
  /** Font size for tick labels (world units). */
  readonly fontSize: number;
  /** Tick line length (world units). */
  readonly tickLength: number;
  /** Gap between the axis line and the axis label/title block (world units). */
  readonly gap: number;
  /** V2.1: Font size for axis title labels, independent of tick label fontSize. Default: fontSize * 1.1. */
  readonly titleFontSize?: number;
};

export type ChartBackgroundTokens = {
  /** Background plane color (null = no background plane). */
  readonly planeColor: string | null;
  /** Background plane opacity. */
  readonly planeOpacity: number;
  /**
   * @deprecated V2.1: use ChartGridlinesTokens.color.
   * Kept for backward compat — ChartGridlinesTokens takes precedence when present.
   */
  readonly gridColor: string | null;
};

export type ChartLegendTokens = {
  /** Label text color. */
  readonly textColor: string;
  /** Font size for legend labels (world units). */
  readonly fontSize: number;
  /** Side length of each color swatch (world units). */
  readonly swatchSize: number;
  /** Vertical spacing between legend entries (world units). */
  readonly spacing: number;
  /** Gap between the plot area and the legend block (world units). */
  readonly gap: number;
  /** V2.1: Opacity for legend label text [0..1]. Default: 1.0. */
  readonly textOpacity?: number;
};

export type ChartInteractionTokens = {
  /** Color applied to a hovered element (hex). */
  readonly hoverColor: string;
  /** Emissive intensity multiplier for hovered elements. */
  readonly hoverEmissiveIntensity: number;
  /** Color applied to a selected element (hex). */
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

### 7.2b ChartTooltipTokens and ChartProjectionTokens

```typescript
/**
 * Tooltip HTML overlay visual tokens.
 * When absent on a custom theme, ChartTooltipHost uses darkGlass values as fallback.
 */
export type ChartTooltipTokens = {
  readonly background: string;
  /**
   * Argument to `backdrop-filter: blur(...)`. Empty string '' = no backdrop-filter.
   * Requires a non-opaque background to be visible.
   */
  readonly blur: string;
  readonly borderColor: string;
  readonly borderRadius: string;
  /** Primary value text color (Y value hero line). */
  readonly valueColor: string;
  /** Secondary label/key text color. */
  readonly labelColor: string;
  /** Font size in px (HTML units). */
  readonly fontSize: number;
  /** CSS font-family. Defaults to scene theme HTML font when absent. */
  readonly fontFamily?: string;
  readonly shadow: string;
  /** Inner padding, CSS shorthand (e.g. '8px 12px'). */
  readonly padding: string;
  /** Maximum tooltip width in px. Default: 220. */
  readonly maxWidth: number;
  /** X offset from anchor point in px. Default: 12. */
  readonly offsetX: number;
  /** Y offset from anchor point in px. Default: -12 (above). */
  readonly offsetY: number;
};

/**
 * Y-axis projection beam visual tokens.
 * Beam is drawn when ChartHitInfo.projectionTarget is non-null.
 * When absent on a custom theme, ChartProjectionRenderer uses darkGlass values as fallback.
 */
export type ChartProjectionTokens = {
  readonly color: string;
  readonly emissiveIntensity: number;
  /** Beam height in world units. */
  readonly beamWidth: number;
  readonly opacity: number;
  /** Landing dot radius in world units. */
  readonly dotRadius: number;
  readonly dotEmissiveIntensity: number;
  /** Entrance animation duration in ms. Default: 220. */
  readonly animationDurationMs: number;
};
```

**Built-in theme values for `tooltip` and `projection` token groups:**

All 12 built-in preset themes include spec-authoritative `tooltip` and `projection` token values. Tooltip background colors are derived from each family's neutral palette and carry the family's characteristic translucency level. Border colors are derived from the family's primary accent. Projection beam and dot colors match the family's primary accent, with dark-polarity variants using the warmer/brighter accent value and light-polarity variants using the darker/cooler complement.

| Theme | Tooltip bg | Tooltip border | Projection color | Beam width |
|-------|-----------|----------------|-----------------|------------|
| darkGlass | `rgba(28,16,10,0.92)` | `rgba(227,106,46,0.3)` | `#E36A2E` | 0.004 |
| darkGlassLight | `rgba(252,246,240,0.95)` | `rgba(179,58,43,0.25)` | `#B33A2B` | 0.004 |
| neonCyber | `rgba(8,0,28,0.94)` | `rgba(0,231,255,0.4)` | `#00E7FF` | 0.005 |
| neonCyberLight | `rgba(240,248,255,0.95)` | `rgba(138,61,255,0.3)` | `#8A3DFF` | 0.005 |
| enterprise | `rgba(255,255,255,0.96)` | `rgba(79,118,184,0.25)` | `#4F76B8` | 0.003 |
| enterpriseLight | `rgba(255,255,255,0.97)` | `rgba(63,127,115,0.25)` | `#3F7F73` | 0.003 |
| midnight | `rgba(6,8,24,0.94)` | `rgba(107,155,255,0.3)` | `#6B9BFF` | 0.005 |
| midnightLight | `rgba(242,244,255,0.96)` | `rgba(79,100,200,0.25)` | `#4F64C8` | 0.004 |
| lightCanvas | `rgba(255,255,255,0.96)` | `rgba(90,138,106,0.25)` | `#5A8A6A` | 0.003 |
| lightCanvasDark | `rgba(18,26,20,0.93)` | `rgba(90,138,106,0.3)` | `#5A8A6A` | 0.003 |
| lightMinimal | `rgba(255,255,255,0.97)` | `rgba(180,180,180,0.3)` | `#888888` | 0.003 |
| lightMinimalDark | `rgba(16,16,18,0.94)` | `rgba(150,150,150,0.25)` | `#999999` | 0.003 |

### 7.2c ChartTooltip DSL and Hover Metadata

```typescript
// DSL child component props (packages/charts/src/elements/chart/dsl.tsx)
export type ChartTooltipProps = {
  /**
   * Enable the 3D Y-axis projection beam on hover. Default: false.
   * Applies to bar, line, area, and scatter chart types only.
   */
  readonly projection?: boolean;
  /**
   * d3-format string for numeric Y values.
   * @default '.3~s'
   */
  readonly format?: string;
};

// Compiled tooltip state — SceneTrack-safe, no functions
export type ChartTooltipState = {
  readonly projection: boolean;
  readonly format?: string;
};

// Typed hit metadata discriminated union (packages/charts/src/renderers/shared/IChartRenderer.ts)
export type ChartHitMeta =
  | { readonly kind: 'bar';
      readonly seriesLabel: string;
      readonly stackGroup?: string;
      readonly segmentValue: number;
      readonly stackTotal?: number }
  | { readonly kind: 'line';
      readonly seriesLabel: string }
  | { readonly kind: 'area';
      readonly seriesLabel: string;
      readonly stackValue?: number }
  | { readonly kind: 'scatter';
      readonly xValue: number;
      readonly sizeValue?: number;
      readonly colorValue?: number | string }
  | { readonly kind: 'pie';
      readonly sliceName: string;
      readonly percentage: number;
      readonly total: number }
  | { readonly kind: 'heatmap';
      readonly intensity: number;
      readonly rowLabel: string;
      readonly columnLabel: string };

export type ChartHitInfo = {
  readonly seriesIndex: number;
  readonly datumIndex: number;
  readonly row: Record<string, unknown>;
  readonly point: readonly [number, number, number];
  /** Typed per-chart-kind metadata for tooltip rendering. */
  readonly meta?: ChartHitMeta;
  /**
   * World-space terminus for the Y-axis projection beam (Y-axis face at same Y+Z as hit).
   * Non-null for bar, line, area, scatter. Absent for pie and heatmap.
   */
  readonly projectionTarget?: readonly [number, number, number];
};
```

**DSL authoring example:**

```tsx
// Minimum — zero config:
<BarChart id="revenue" interactive>
  <ChartData source="revenueData" />
  <ChartAxis axis="x" field="month" />
  <ChartAxis axis="y" field="revenue" />
  <ChartTooltip />
</BarChart>

// With projection beam and custom format:
<BarChart id="revenue" interactive>
  <ChartData source="revenueData" />
  <ChartAxis axis="x" field="month" />
  <ChartAxis axis="y" field="revenue" />
  <ChartTooltip projection format=".2s" />
</BarChart>
```

**Global overlay host (placed once, handles all charts):**

```tsx
<EngineOverlayHost>
  <ChartTooltipHost />
  {/* other overlay content */}
</EngineOverlayHost>
```

**Custom render content:**

```tsx
useChartTooltipConfig('revenue', {
  renderContent: (info) => <MyCustomTooltip info={info} />,
});
```

### 7.2a ChartThemeName, Theme Registry, and CHART_THEMES

```typescript
// packages/charts/src/themes/types.ts

/**
 * Type alias for ThemeFamily from @brewsite/core.
 * Maintained for backward compatibility — existing code referencing ChartThemeName compiles identically.
 */
import type { ThemeFamily } from '@brewsite/core';
export type ChartThemeName = ThemeFamily;
```

```typescript
// packages/charts/src/themes/chartThemeRegistry.ts

/** A light+dark pair of ChartTheme presets for a single theme family. */
export type ChartThemePairEntry = { dark: ChartTheme; light: ChartTheme };

/**
 * Registers a ChartTheme pair under the given family name.
 * Called by @brewsite/themes at app startup to populate the registry
 * beyond the built-in 'default' pair.
 */
export function registerChartThemePair(family: string, pair: ChartThemePairEntry): void;

/**
 * Resolves the ChartTheme for the given family and polarity.
 * Falls back to the 'default' pair if the requested family is not registered.
 */
export function resolveChartTheme(family: string, polarity: 'dark' | 'light'): ChartTheme;
```

```typescript
// packages/charts/src/themes/index.ts

/**
 * Built-in preset themes keyed by canonical name.
 * Only 'enterprise' is available in @brewsite/charts.
 * Named families (darkGlass, midnight, etc.) are registered via @brewsite/themes
 * at app startup using registerChartThemePair().
 */
export const CHART_THEMES: Partial<Record<ChartThemeName, ChartTheme>> = {
  enterprise: enterpriseChartTheme,
} as const;

/** @deprecated Use registerChartThemePair / resolveChartTheme instead. */
export type ChartThemePair = {
  readonly dark: ChartTheme;
  readonly light: ChartTheme;
};
```

**Usage pattern for cross-package theme coordination:**

```typescript
import { resolveChartTheme, registerChartThemePair } from '@brewsite/charts';

// At app startup, @brewsite/themes registers all family presets:
// registerChartThemePair('darkGlass', { dark: darkGlassChartTheme, light: darkGlassLightChartTheme });

// At render time, resolve the theme for the active family and polarity:
const family = 'darkGlass';
const polarity = isDarkMode ? 'dark' : 'light';
const chartTheme = resolveChartTheme(family, polarity);
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

**Known limitation:** All six built-in `ChartTheme` presets have explicit `axis.labelColor` and `legend.textColor` values. `sceneTheme.colorMode` therefore has **no effect** on text colors when using any built-in preset without a custom override.

### 7.6 Usage Patterns

**Named preset with custom font:**
```tsx
import { darkSceneTheme } from '@brewsite/core';

<BarChart
  id="sales-chart"
  theme="darkGlass"
  sceneTheme={{
    ...darkSceneTheme,
    font: { ...darkSceneTheme.font, webglFontUrl: '/fonts/inter-msdf.ttf' },
  }}
>
  <ChartAxis axis="x" field="month" />
  <ChartAxis axis="y" field="revenue" />
</BarChart>
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
<BarChart id="sales-chart" theme="darkGlass" sceneTheme={mySceneTheme}>
  {/* axes and series */}
</BarChart>
```

---

## 8. Technical Considerations

### Per-Family Series Material Profiles

Each `ThemeFamily` defines a distinct series material profile that governs the rendering character of data geometry (bars, lines, area fills, scatter points) for that family and polarity. The profile is expressed in `ChartTheme.series[]` via `ChartSeriesMaterialTokens`: `metalness`, `roughness`, `transmission`, and `emissiveIntensity`.

Material profiles vary by family intent and polarity:

- **Dark families** (darkGlass, midnight, neonCyber): elevated `emissiveIntensity` per series to create luminous data geometry that reads against dark scene backgrounds. `metalness` is moderate-to-high, giving series a three-dimensional gloss character. `transmission` above zero produces a glass depth effect on appropriate families (darkGlass).
- **Light families** (lightCanvas, lightMinimal): near-zero `emissiveIntensity`; low `metalness`; low `transmission` — producing diffuse matte or ceramic series geometry that reads cleanly on pale scene backgrounds without hazing.
- **Opposite-polarity variants**: the light-polarity variant of a dark family drops `emissiveIntensity` and `metalness` toward the light-family range. The dark-polarity variant of a light family raises `emissiveIntensity` to maintain series legibility against a dark scene background.

Series colors (`ChartSeriesMaterialTokens.color`) are shared across polarities within a family — the same eight accent hex values are used for both dark and light entries. Only the material rendering parameters (`metalness`, `roughness`, `transmission`, `emissiveIntensity`) differ by polarity.

Cross-package coordination: the series color palette is specified to match the 8-color accent palette used in the paired `DiagramTheme` (accessible via the cross-package comment block present in each preset theme file). When diagram and chart theme pairs for the same family are resolved from their respective registries and used together, the series colors and diagram node/edge accent colors form a coherent palette in side-by-side scenes.

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

**`ChartTooltipOverlay` — Deprecated:**

`ChartTooltipOverlay` is **deprecated** and will be removed in the next minor version. The replacement is `<ChartTooltip>` (DSL child) + `<ChartTooltipHost />` (once in `EngineOverlayHost`). This eliminates the widget reference requirement and the duplicated `nvsBounds` prop.

```tsx
// Before — deprecated pattern:
<ChartTooltipOverlay nvsBounds={chartWidget.nvsBounds} />

// After — current pattern:
// In chart DSL:
<BarChart id="revenue" interactive>
  ...
  <ChartTooltip />
</BarChart>

// In EngineOverlayHost (once, for all charts):
<EngineOverlayHost>
  <ChartTooltipHost />
</EngineOverlayHost>
```

`ChartTooltipOverlay` carries a `@deprecated` JSDoc tag referencing the version it was deprecated in and the version it will be removed in. The file is retained for this release cycle only.

### FontUrl propagation path

`fontUrl` is resolved from `ChartState.sceneTheme` (element-level) or `ChartTheme.sceneTheme` (theme-level) and stored in `ChartRenderContext`. From there it flows to:
- `AxesRenderer` → troika-three-text `font` property on all axis tick labels and title labels
- `LegendRenderer` → troika-three-text `font` property on all legend labels
- All six chart renderers (`BarRenderer`, `LineRenderer`, `AreaRenderer`, `PieRenderer`, `ScatterRenderer`, `HeatmapRenderer`) receive it via `ChartRenderContext` for any text they render internally

### Color-mode fallbacks

The chart render context derives axis/legend label color fallbacks from `sceneTheme.colorMode`:
- `'dark'` → `'rgba(255,255,255,0.8)'` for axis labels, `'rgba(255,255,255,0.7)'` for legend text
- `'light'` → `'rgba(0,0,0,0.8)'` for axis labels, `'rgba(0,0,0,0.7)'` for legend text

These fallbacks are only used when the resolved `ChartTheme` has no explicit `axis.labelColor` or `legend.textColor`. Since all six built-in presets define these explicitly, colorMode fallbacks are only active in fully custom themes.

### No font URL in ChartState compiled output

`ChartState` (the compiled tick state) stores `sceneTheme?: SceneTheme` as the resolved value. The full `SceneTheme` object is stored rather than just `fontUrl` because the render layer may need other fields (colorMode for fallback resolution). This is compile-time data — the `SceneTheme` is a plain readonly object with no function references, safe for serialization.

---

## 9. Known Limitations

1. **`sceneTheme.colorMode` has no effect on built-in preset label colors.** All six built-in chart theme presets have explicit `axis.labelColor` and `legend.textColor` values. The colorMode-derived fallback only applies when these fields are not set. Custom themes that omit explicit label colors will receive colorMode defaults.

2. **WebGL font URL must be MSDF-encoded.** Standard web font URLs will not render correctly in troika-three-text. The file must be MSDF-pre-processed. Self-host for production.

3. **Font is chart-wide, not per-axis.** A single `webglFontUrl` applies to all troika-rendered text in the chart (both axes, legend, any internally rendered text). Per-axis font customization is not supported in v1.

4. **`sceneTheme.colorMode` has no effect on series material parameters.** `sceneTheme.colorMode` influences axis/legend label color fallbacks (when explicit values are absent) but does not adjust series `metalness`, `roughness`, or `emissiveIntensity`. For a fully correct polarity-switched chart, use `resolveChartTheme(family, polarity)` to get the correct polarity variant rather than attempting to construct one via `sceneTheme` alone — the registered pair carries the intentionally designed material profile for that polarity.

5. **Polarity toggle in the examples app requires full player remount.** `ChartDemoPage` implements the polarity toggle via `clearSceneTrackCache()` + `engineKey` increment, causing `SceneEngine` to unmount and remount. This produces ~100–300ms latency. This is acceptable for a demo button. A lightweight CSS-variables-only update path (without remount) is possible for overlay content changes but does not address Three.js material color changes, which always require recompilation.

6. **Hover interaction is mouse-only.** `ChartWidget` attaches `mousemove`, `mouseleave`, and `click` listeners. Touch events are not supported. Touch support is a separate future feature.

7. **`interactive: true` is required for tooltips.** All hover behavior gates on `ChartState.interactive`. Charts that don't set `interactive` do not fire hover events and do not show tooltips, regardless of whether `<ChartTooltip>` is present.

8. **`<ChartTooltipHost />` must be mounted for tooltips to display.** In development mode, a `console.warn` is emitted once per chart ID if `ChartWidget` writes to `ChartTooltipStore` and no `<ChartTooltipHost />` subscriber is registered within one frame. Silent failure in production.

9. **Custom themes without `tooltip`/`projection` token groups fall back to `darkGlass` tokens.** Consumers defining fully custom `ChartTheme` objects that omit `tooltip` and `projection` will receive the `darkGlass` visual defaults. Specify these token groups explicitly to match your theme.

---

## 10. Breaking Change Assessment

**Theme system (original scope): Semver impact: minor.** `ChartTheme.sceneTheme` and `ChartDSL.sceneTheme` are optional additions. All four original preset themes remain valid. No existing `ChartTheme` fields are changed.

**Theme redesign (this release): Semver impact: minor.** Two new presets added (`midnight`, `lightCanvas`). Existing preset palette values redesigned for cross-package coherence. `ChartThemeName` union expanded from 4 to 6 values. Palette value changes are product content, not API contracts — no migration required.

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

**Tooltip + Y-Axis Projection system: Semver impact: minor.** All new additions are additive:
- `ChartTheme.tooltip` and `ChartTheme.projection` are optional fields — no existing `ChartTheme` callers break.
- `ChartHitInfo.meta` and `ChartHitInfo.projectionTarget` are optional fields — no existing `resolveHoverInfo()` callers break.
- `<ChartTooltip>`, `ChartTooltipHost`, `useChartTooltip`, `useChartTooltipConfig` are net-new exports.
- `ChartTooltipOverlay` is marked `@deprecated` but still exported — no TypeScript errors for existing consumers until removal.

**`ChartTooltipOverlay` deprecation: Semver impact: minor (deprecation). Removal: next minor.** Existing `ChartTooltipOverlay` consumers receive a TypeScript deprecation warning. No runtime breakage. Migration path documented in Section 8.

---

## 11. Dependencies

- `@brewsite/core` — `SceneTheme`, `NVSRect`, `INVSBounded` type imports
- `troika-three-text` — WebGL text rendering (peer dependency via Three.js ecosystem)
- `three` — `BoxGeometry`, `MeshBasicMaterial`, `AdditiveBlending` for projection beam (existing peer dependency)
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

**Shipped (theme redesign):**
- [x] `enterpriseChartTheme`, `defaultChartTheme`, `enterpriseLightChartTheme`, `defaultLightChartTheme` exported from `@brewsite/charts` barrel.
- [x] Additional family presets (darkGlass, midnight, neonCyber, lightCanvas, lightMinimal) exist as internal files and are registered at runtime by `@brewsite/themes` via `registerChartThemePair()`.
- [x] `ChartThemeName` union includes all families via `ThemeFamily` alias.
- [x] `CHART_THEMES` registry includes `enterprise` entry. Other families are runtime-registered.
- [x] Each preset theme file contains the cross-package palette comment block matching the paired `@brewsite/diagram` theme file.

**Shipped (theming overhaul — registry and examples toggle):**
- [x] `ChartThemeName` is a type alias for `ThemeFamily` from `@brewsite/core`. Backward compat: all existing `ChartThemeName` usages compile without change.
- [x] `ChartThemePairEntry` type, `registerChartThemePair()`, and `resolveChartTheme()` exported from `@brewsite/charts`.
- [x] `'default'` and `'enterprise'` entries pre-loaded in the registry at module init.
- [x] `ChartDemoThemeContext` and `useDemoChartTheme()` hook implemented in `apps/examples/src/chart/scenes/sceneShared.tsx`.
- [x] `ChartDemoPage` adds sun/moon polarity toggle button; all 11 chart scenes consume `useDemoChartTheme()`.
- [x] Polarity toggle calls `clearSceneTrackCache()` and increments `engineKey` for player remount.
- [x] TypeScript strict-mode typecheck passes for all new theme files.

**Shipped (tooltip + Y-axis projection):**
- [x] `ChartTooltipTokens` and `ChartProjectionTokens` types exported from `@brewsite/charts`.
- [x] `ChartTheme.tooltip` and `ChartTheme.projection` optional fields present and typed.
- [x] All 12 built-in preset themes include explicit `tooltip` and `projection` token objects.
- [x] `<ChartTooltip>` DSL child compiles to `ChartState.tooltip: ChartTooltipState | null`.
- [x] `ChartHitMeta` discriminated union type exported; all 6 renderers populate `meta` in `resolveHoverInfo()`.
- [x] Bar, line, area, scatter renderers populate `projectionTarget`; pie and heatmap do not.
- [x] `ChartProjectionRenderer` renders beam + landing dot; entrance 220ms ease-out-expo, exit 160ms fade.
- [x] Hover-change snaps beam to new position and restarts entrance animation.
- [x] `ChartTooltipStore` + `<ChartTooltipHost />` render type-aware tooltip for all 6 chart types.
- [x] Tooltip anchored to projected 3D hit point; edge-flip at 16px canvas boundary.
- [x] `useChartTooltipConfig(chartId, config)` hook exported; deregisters on unmount.
- [x] `useChartTooltip()` hook exported.
- [x] `ChartTooltipOverlay` carries `@deprecated` JSDoc with version numbers and migration link.
- [x] New types and hooks exported from `packages/charts/src/index.ts`.
- [x] `ChartTooltipProjectionRenderer` tests use `getNow` injection for deterministic timing.
- [x] `apps/examples/src/chart/` demonstrates tooltip + projection on ≥2 chart types (bar, line).
- [x] TypeScript strict mode passes across `packages/charts/`.

**Shipped (theme family art direction — polarity variants and series materials):**
- [x] All six polarity-variant `ChartTheme` presets carry production-quality aesthetic values; no placeholder or sibling-theme reuse remains.
- [x] All 12 `ChartTheme` variants (6 canonical + 6 opposite-polarity) available via `resolveChartTheme()` after `@brewsite/themes` registration. Enterprise presets directly exported from the barrel.
- [x] Each polarity variant carries a fully designed series material profile (metalness, roughness, transmission, emissiveIntensity) distinct from its family sibling.
- [x] Tooltip and projection token values for all 12 presets are spec-authoritative, coordinated with family neutral palette and accent identity.

**Follow-on (not yet shipped — tracked separately):**
- [ ] DiagramDemoPage and SimpleDemoPage polarity toggles (no pages exist yet).
- [ ] README documents `resolveChartTheme()` / `registerChartThemePair()` usage pattern with cross-package consumer example.
- [ ] `ChartTooltipOverlay` removed (scheduled for next minor version after deprecation cycle).

**V2.1 (shipped):**
- [x] Five new optional token group types exported from `@brewsite/charts`: `ChartBarTokens`, `ChartAreaTokens`, `ChartGridlinesTokens`, `ChartDataLabelsTokens`, `ChartReferenceLineTokens`.
- [x] `ChartAxisTokens.titleFontSize` and `ChartLegendTokens.textOpacity` optional fields present and typed.
- [x] All six built-in themes include explicit values for all new token groups.
- [x] `createChartTheme()` `ChartThemeOverrides` accepts and deep-merges token groups: `name`, `series`, `axis`, `background`, `legend`, `line`, `pie`, `interaction`, `bar`, `area`, `gridlines`, `dataLabels`, `referenceLines`. Note: `tooltip` and `projection` are not part of `ChartThemeOverrides`.
- [x] `AxesRenderer` uses `titleFontSize ?? fontSize * 1.1` for axis title rendering.
- [x] `LegendRenderer` applies `textOpacity ?? 1.0` to legend label material/text opacity.
- [x] `AxesRenderer` gridline rendering uses the three-level fallback chain for color, plus `LineDashedMaterial` branch when `dashSize` is set.
- [x] `BarRenderer` reads `barPadding` from `theme.bar?.padding ?? 0.2` when DSL `barPadding` is absent.
- [x] `AreaRenderer` reads `fillOpacity` from `theme.area?.fillOpacity ?? 0.7` when DSL `fillOpacity` is absent.
- [x] `DataLabelRenderer` reads `fontSize` and `color` from `theme.dataLabels` with documented fallbacks.
- [x] Reference line rendering uses `theme.referenceLines.lineWidth` as world-space `BoxGeometry` width.
- [x] `pnpm --filter @brewsite/charts typecheck` passes with zero errors after V2.1 theme changes.

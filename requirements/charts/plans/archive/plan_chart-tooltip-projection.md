---
title: "Implementation Plan: Chart Value Tooltip + Y-Axis Projection"
doc_type: plan
owner: architecture
status: complete
updated: 2026-03-11
revision: 3 — 9 issues resolved after PM-2 review (8 bugs + chartTooltipStore removed from public API); ready for implementation
---

# Implementation Plan: Chart Value Tooltip + Y-Axis Projection

## 1. Overview

This plan implements the chart tooltip and Y-axis projection beam feature as specified in `requirements/charts/notes/note_chart-tooltip-projection.md`. It resolves all three open architect questions, specifies every new file and type, and partitions work into 5 strictly independent developer streams.

**Deliverables:**
- `<ChartTooltip>` DSL child component that compiles to `ChartState.tooltip`
- `ChartTooltipStore` module-level store + `useChartTooltip()` hook for `<ChartTooltipHost />`
- `useChartTooltipConfig(chartId, config)` hook for custom `renderContent` registration
- `<ChartTooltipHost />` — zero-prop global overlay component, placed once in `EngineOverlayHost`
- `ChartProjectionRenderer` — Three.js beam + landing dot with entrance/exit animation
- All 6 renderers enriched with typed `ChartHitMeta` + `projectionTarget`
- All 12 preset themes receive explicit `tooltip` + `projection` token objects
- `ChartTooltipOverlay` marked `@deprecated`

---

## 2. Architect Decisions — Three Open Questions Resolved

### 2.1 `tickProjection()` call site

**Decision:** `ChartWidget.onTick()` calls `this.chartRenderer.tickProjection(effectiveTheme)` every frame.

**Rationale:**
- `ChartWidget` already implements `IAnimationController` and its `onTick()` runs every RAF frame
- `ChartProjectionRenderer` is a Three.js rendering helper — it must not independently participate in the RAF loop, hold its own animation frame, or implement `IAnimationController`
- Delta time is computed **inside** `ChartProjectionRenderer.tick()` via `this.getNow()` injection — the method reads `performance.now()` itself to compute elapsed milliseconds
- Testing is deterministic: inject a `getNow: () => number` closure into `ChartProjectionRenderer`'s constructor

**Call chain:**
```
RAF → RuntimeLoop → ChartWidget.onTick(ctx)
  → this.chartRenderer.tickProjection(effectiveTheme)
    → this.projectionRenderer.tick(tokens)
      → const now = this.getNow()
      → deltaMs = now - this.lastTickTime
```

`tickProjection()` is also added to `ChartRendererLike` (the test seam interface).

---

### 2.2 `useChartTooltipConfig()` signature

```typescript
/**
 * Registers a custom renderContent function for the named chart's tooltip.
 * Deregisters automatically on component unmount or when chartId changes.
 *
 * @param chartId   Matches the `id` prop on the chart DSL component.
 * @param config    Runtime tooltip config. Stabilize with useMemo or useCallback.
 */
export function useChartTooltipConfig(
  chartId: string,
  config: ChartTooltipRuntimeConfig,
): void
```

**Return type:** `void`. React's `useEffect` cleanup manages registration lifecycle.

**Lifecycle semantics:**
1. Always-update effect (no deps): `chartTooltipStore.setRuntimeConfig(chartId, config)` — runs on every render to keep the most recent `renderContent` closure registered
2. Cleanup effect (deps: `[chartId]`): `return () => chartTooltipStore.clearRuntimeConfig(chartId)` — deregisters on unmount or chartId change

**Export:** From `packages/charts/src/index.ts` as a named export.

---

### 2.3 `ChartTooltipRuntimeConfig` disposal

**Decision:** Config is cleared **on React component unmount only** — NOT on scene changes.

**Rationale:**
- The config registration is tied to the React component lifecycle, not the SceneTrack lifecycle
- Scenes change; the `<ChartTooltipHost />` and any component calling `useChartTooltipConfig` do not unmount on scene change — they persist for the lifetime of the engine
- If `ChartWidget` reads `ChartTooltipStore.getRuntimeConfig(widgetId)` and it is absent (cleared on unmount), `apply()` falls back to the built-in type-aware renderer — this is the correct behavior

**What does NOT trigger cleanup:**
- Scene transitions (SceneTrack block changes)
- Chart type changes (`type: 'bar'` → `type: 'line'`)

**What DOES trigger cleanup:**
- React component calling `useChartTooltipConfig` unmounts
- `chartId` prop passed to `useChartTooltipConfig` changes value

---

## 3. Module Graph and File Index

### New files (by stream)

| Stream | File | Purpose |
|--------|------|---------|
| A | `packages/charts/src/themes/resolveTheme.ts` | `resolveChartTheme()` utility |
| A | `packages/charts/src/elements/chart/tooltip/types.ts` | `ChartTooltipState`, `ChartTooltipRuntimeConfig` |
| B | `packages/charts/src/elements/chart/tooltip/ChartTooltipStore.ts` | Module-level store + `useChartTooltip()` |
| B | `packages/charts/src/elements/chart/tooltip/useChartTooltipConfig.ts` | Config hook |
| B | `packages/charts/src/elements/chart/tooltip/ChartTooltipHost.tsx` | React overlay component |
| B | `packages/charts/src/elements/chart/tooltip/__tests__/ChartTooltipStore.test.ts` | Store unit tests |
| B | `packages/charts/src/elements/chart/tooltip/__tests__/ChartTooltipHost.test.tsx` | Host component tests |
| C | `packages/charts/src/elements/chart/projection/ChartProjectionRenderer.ts` | Three.js beam renderer |
| C | `packages/charts/src/elements/chart/projection/__tests__/ChartProjectionRenderer.test.ts` | Renderer unit tests |

### Modified files (by stream)

| Stream | File | Change summary |
|--------|------|----------------|
| A | `packages/charts/src/themes/types.ts` | Add `ChartTooltipTokens`, `ChartProjectionTokens`; add optional fields to `ChartTheme` |
| A | All 12 `packages/charts/src/themes/*.ts` | Add `tooltip` + `projection` token objects |
| A | `packages/charts/src/renderers/shared/IChartRenderer.ts` | Add `ChartHitMeta`, enrich `ChartHitInfo`, add `plotFrameOffset` to `ChartRenderContext` |
| D | `packages/charts/src/renderers/bar/BarRenderer.ts` | Cache plot frame; populate `meta` + `projectionTarget` in `resolveHoverInfo()` |
| D | `packages/charts/src/renderers/line/LineRenderer.ts` | Same as BarRenderer |
| D | `packages/charts/src/renderers/area/AreaRenderer.ts` | Same as BarRenderer |
| D | `packages/charts/src/renderers/scatter/ScatterRenderer.ts` | Same as BarRenderer (Y-axis projection only) |
| D | `packages/charts/src/renderers/pie/PieRenderer.ts` | Add `meta` only; no `projectionTarget` |
| D | `packages/charts/src/renderers/heatmap/HeatmapRenderer.ts` | Add `meta` only; no `projectionTarget` |
| D | All 6 renderer `__tests__/*.test.ts` | Extend tests to assert `meta` and `projectionTarget` |
| E | `packages/charts/src/elements/chart/types.ts` | Add `ChartTooltipDSL` type, add `tooltip` field to `ChartState`/`DEFAULT_CHART_STATE` |
| E | `packages/charts/src/elements/chart/dsl.tsx` | Add `ChartTooltipProps` type |
| E | `packages/charts/src/elements/chart/stubs.ts` | Add `ChartTooltip` stub function |
| E | `packages/charts/src/elements/chart/compile.ts` | Add `compileTooltipDsl()`; update `compileChart()` signature |
| E | `packages/charts/src/elements/chart/render.ts` | Add `projectionGroup`; add `updateProjection()`, `tickProjection()`; update `ChartRendererLike` |
| E | `packages/charts/src/elements/chart/ChartWidget.ts` | Add `lastEffectiveTheme`, tooltip store dispatch, projection calls, `onTick` changes |
| E | `packages/charts/src/player/chartPlugin.ts` | Add `ChartTooltip` to `extractChartChildren()` |
| E | `packages/charts/src/player/ChartTooltipOverlay.tsx` | Add `@deprecated` JSDoc |
| E | `packages/charts/src/index.ts` | Export new types, hooks, and components |
| E | `packages/charts/src/elements/chart/__tests__/compile.test.ts` | Add `<ChartTooltip>` DSL compile tests |
| E | `apps/examples/src/chart/scenes/scene1-bar-morph.tsx` | Add `<ChartTooltip projection />` to bar chart |
| E | `apps/examples/src/chart/scenes/scene3-multiline.tsx` | Add `<ChartTooltip />` to line chart |
| E | `apps/examples/src/chart/ChartDemoPage.tsx` | Add `<ChartTooltipHost />` to `EngineOverlayHost` |

### Dependency graph

```
Stream A (types + theme tokens)
  ↓
  ├── Stream B (tooltip store + host)     [independent of C and D]
  ├── Stream C (projection renderer)      [independent of B and D]
  └── Stream D (renderer enrichment)      [independent of B and C]
         ↓
Stream E (integration: compile + render + widget + index)
         requires B + C + D all complete
```

**No two streams touch the same file simultaneously.** Streams B, C, D are fully parallel once A is merged.

---

## 4. Stream A: Foundation Types + Theme Tokens

**Prerequisite:** None. Stream A must land first.

**Owner:** 1 developer.

---

### 4.1 New File: `packages/charts/src/themes/resolveTheme.ts`

```typescript
// Utility for resolving ChartThemeName | ChartTheme → concrete ChartTheme.

import { darkGlassChartTheme }      from './darkGlass';
import { darkGlassLightChartTheme } from './darkGlassLight';
import { midnightChartTheme }       from './midnight';
import { midnightLightChartTheme }  from './midnightLight';
import { neonCyberChartTheme }      from './neonCyber';
import { neonCyberLightChartTheme } from './neonCyberLight';
import { enterpriseChartTheme }     from './enterprise';
import { enterpriseLightChartTheme }from './enterpriseLight';
import { lightCanvasChartTheme }    from './lightCanvas';
import { lightCanvasDarkChartTheme }from './lightCanvasDark';
import { lightMinimalChartTheme }   from './lightMinimal';
import { lightMinimalDarkChartTheme}from './lightMinimalDark';
import type { ChartTheme, ChartThemeName } from './types';

/** Complete map of all 12 built-in theme presets — used by resolveChartTheme(). */
const FULL_THEME_MAP: Record<ChartThemeName, ChartTheme> = {
  darkGlass:         darkGlassChartTheme,
  darkGlassLight:    darkGlassLightChartTheme,
  midnight:          midnightChartTheme,
  midnightLight:     midnightLightChartTheme,
  neonCyber:         neonCyberChartTheme,
  neonCyberLight:    neonCyberLightChartTheme,
  enterprise:        enterpriseChartTheme,
  enterpriseLight:   enterpriseLightChartTheme,
  lightCanvas:       lightCanvasChartTheme,
  lightCanvasDark:   lightCanvasDarkChartTheme,
  lightMinimal:      lightMinimalChartTheme,
  lightMinimalDark:  lightMinimalDarkChartTheme,
};

/**
 * Resolves a ChartThemeName string or ChartTheme object to a concrete ChartTheme.
 * Falls back to darkGlassChartTheme for unknown string names.
 */
export function resolveChartTheme(theme: ChartThemeName | ChartTheme): ChartTheme {
  if (typeof theme === 'object') return theme;
  return FULL_THEME_MAP[theme] ?? darkGlassChartTheme;
}
```

---

### 4.2 New File: `packages/charts/src/elements/chart/tooltip/types.ts`

```typescript
// Tooltip type contracts — no Three.js, no React, no runtime imports.

import type React from 'react';
import type { ChartHitInfo } from '../../../renderers/shared/IChartRenderer';

/**
 * Compiled tooltip state. Lives in ChartState.tooltip — SceneTrack-safe.
 * No functions. Custom renderContent is registered separately via useChartTooltipConfig().
 */
export type ChartTooltipState = {
  /** Whether the Y-axis projection beam is rendered on hover. Default: false. */
  readonly projection: boolean;
  /**
   * d3-format string for numeric Y values displayed in the tooltip.
   * @default '.3~s'
   */
  readonly format?: string;
};

/**
 * Runtime-only tooltip configuration. NOT compiled into SceneTrack.
 * Registered via useChartTooltipConfig() and read by ChartWidget in apply().
 * Custom function — intentionally excluded from SceneTrack serialization.
 */
export type ChartTooltipRuntimeConfig = {
  /**
   * Custom React content for the tooltip.
   * When absent, the built-in type-aware DefaultTooltipContent is used.
   */
  readonly renderContent?: (info: ChartHitInfo) => React.ReactNode;
};
```

---

### 4.3 Modify: `packages/charts/src/themes/types.ts`

Add the following types and optional fields. Insert after `ChartReferenceLineTokens` and before `ChartTheme`.

```typescript
/**
 * HTML overlay tooltip visual tokens.
 * When absent from ChartTheme, ChartTooltipHost uses darkGlass fallback constants.
 * The tooltip has no caret — the Y-axis projection beam provides the visual connection.
 */
export type ChartTooltipTokens = {
  /** CSS background (rgba recommended for opacity + blur). */
  readonly background: string;
  /**
   * Value for `backdrop-filter: blur(...)`, e.g. '8px'.
   * Empty string '' = no backdrop-filter applied.
   */
  readonly blur: string;
  /** CSS border color. */
  readonly borderColor: string;
  /** CSS border-radius, e.g. '6px'. */
  readonly borderRadius: string;
  /** Primary value text color (hero Y-value line). */
  readonly valueColor: string;
  /** Secondary label/key text color. */
  readonly labelColor: string;
  /** Font size in HTML pixels. */
  readonly fontSize: number;
  /** CSS font-family. Falls back to system sans-serif when absent. */
  readonly fontFamily?: string;
  /** CSS box-shadow value. */
  readonly shadow: string;
  /** CSS padding shorthand, e.g. '8px 12px'. */
  readonly padding: string;
  /** Maximum tooltip width in px. */
  readonly maxWidth: number;
  /** X offset from anchor point in px (right of anchor). */
  readonly offsetX: number;
  /** Y offset from anchor point in px (negative = above anchor). */
  readonly offsetY: number;
};

/**
 * Y-axis projection beam visual tokens.
 * Beam is drawn IFF ChartHitInfo.projectionTarget is non-null — beam visibility
 * is controlled by the renderer, not by theme tokens.
 * When absent from ChartTheme, ChartProjectionRenderer uses darkGlass fallback constants.
 */
export type ChartProjectionTokens = {
  /** Beam color as CSS hex string. */
  readonly color: string;
  /** Emissive intensity multiplier for the beam material. */
  readonly emissiveIntensity: number;
  /** Beam height in world units (BoxGeometry Y dimension). */
  readonly beamWidth: number;
  /** Beam opacity [0..1]. */
  readonly opacity: number;
  /** Landing dot radius in world units. */
  readonly dotRadius: number;
  /** Emissive intensity for the landing dot. */
  readonly dotEmissiveIntensity: number;
  /** Entrance animation duration in ms. */
  readonly animationDurationMs: number;
};
```

Add to `ChartTheme` (after `referenceLines?`):
```typescript
  /**
   * HTML tooltip overlay tokens.
   * @default undefined — ChartTooltipHost falls back to darkGlass defaults
   */
  readonly tooltip?: ChartTooltipTokens;
  /**
   * Y-axis projection beam tokens.
   * @default undefined — ChartProjectionRenderer falls back to darkGlass defaults
   */
  readonly projection?: ChartProjectionTokens;
```

---

### 4.4 Modify: All 12 Theme Preset Files

Add `tooltip` and `projection` objects to each theme. The values below are complete — developers copy them verbatim.

#### `darkGlass.ts` — add to `darkGlassChartTheme`:
```typescript
  tooltip: {
    background: 'rgba(28,16,10,0.92)',
    blur: '8px',
    borderColor: 'rgba(227,106,46,0.3)',
    borderRadius: '6px',
    valueColor: '#F0E4DA',
    labelColor: 'rgba(240,228,218,0.65)',
    fontSize: 12,
    shadow: '0 4px 16px rgba(0,0,0,0.5)',
    padding: '8px 12px',
    maxWidth: 220,
    offsetX: 12,
    offsetY: -12,
  },
  projection: {
    color: '#E36A2E',
    emissiveIntensity: 0.8,
    beamWidth: 0.004,
    opacity: 0.85,
    dotRadius: 0.022,
    dotEmissiveIntensity: 1.1,
    animationDurationMs: 220,
  },
```

#### `darkGlassLight.ts` — add to `darkGlassLightChartTheme`:
```typescript
  tooltip: {
    background: 'rgba(252,246,240,0.95)',
    blur: '6px',
    borderColor: 'rgba(179,58,43,0.25)',
    borderRadius: '6px',
    valueColor: '#3A1A10',
    labelColor: 'rgba(58,26,16,0.6)',
    fontSize: 12,
    shadow: '0 2px 10px rgba(0,0,0,0.12)',
    padding: '8px 12px',
    maxWidth: 220,
    offsetX: 12,
    offsetY: -12,
  },
  projection: {
    color: '#B33A2B',
    emissiveIntensity: 0.6,
    beamWidth: 0.004,
    opacity: 0.75,
    dotRadius: 0.022,
    dotEmissiveIntensity: 0.9,
    animationDurationMs: 220,
  },
```

#### `neonCyber.ts` — add to `neonCyberChartTheme`:
```typescript
  tooltip: {
    background: 'rgba(8,0,28,0.94)',
    blur: '10px',
    borderColor: 'rgba(0,231,255,0.4)',
    borderRadius: '4px',
    valueColor: '#00E7FF',
    labelColor: 'rgba(216,204,255,0.65)',
    fontSize: 12,
    shadow: '0 0 16px rgba(0,231,255,0.2)',
    padding: '8px 12px',
    maxWidth: 220,
    offsetX: 12,
    offsetY: -12,
  },
  projection: {
    color: '#00E7FF',
    emissiveIntensity: 1.2,
    beamWidth: 0.005,
    opacity: 0.9,
    dotRadius: 0.024,
    dotEmissiveIntensity: 1.4,
    animationDurationMs: 220,
  },
```

#### `neonCyberLight.ts` — add to `neonCyberLightChartTheme`:
```typescript
  tooltip: {
    background: 'rgba(240,248,255,0.95)',
    blur: '6px',
    borderColor: 'rgba(138,61,255,0.3)',
    borderRadius: '4px',
    valueColor: '#3A0090',
    labelColor: 'rgba(58,0,144,0.55)',
    fontSize: 12,
    shadow: '0 2px 10px rgba(138,61,255,0.15)',
    padding: '8px 12px',
    maxWidth: 220,
    offsetX: 12,
    offsetY: -12,
  },
  projection: {
    color: '#8A3DFF',
    emissiveIntensity: 0.7,
    beamWidth: 0.005,
    opacity: 0.8,
    dotRadius: 0.024,
    dotEmissiveIntensity: 1.0,
    animationDurationMs: 220,
  },
```

#### `enterprise.ts` — add to `enterpriseChartTheme`:
```typescript
  tooltip: {
    background: 'rgba(255,255,255,0.96)',
    blur: '4px',
    borderColor: 'rgba(79,118,184,0.25)',
    borderRadius: '6px',
    valueColor: '#1A2A4A',
    labelColor: 'rgba(26,42,74,0.55)',
    fontSize: 12,
    shadow: '0 2px 8px rgba(0,0,0,0.1)',
    padding: '8px 12px',
    maxWidth: 220,
    offsetX: 12,
    offsetY: -12,
  },
  projection: {
    color: '#4F76B8',
    emissiveIntensity: 0.5,
    beamWidth: 0.003,
    opacity: 0.7,
    dotRadius: 0.018,
    dotEmissiveIntensity: 0.8,
    animationDurationMs: 220,
  },
```

#### `enterpriseLight.ts` — add to `enterpriseLightChartTheme`:
```typescript
  tooltip: {
    background: 'rgba(255,255,255,0.97)',
    blur: '4px',
    borderColor: 'rgba(63,127,115,0.25)',
    borderRadius: '6px',
    valueColor: '#0F3A34',
    labelColor: 'rgba(15,58,52,0.55)',
    fontSize: 12,
    shadow: '0 2px 8px rgba(0,0,0,0.08)',
    padding: '8px 12px',
    maxWidth: 220,
    offsetX: 12,
    offsetY: -12,
  },
  projection: {
    color: '#3F7F73',
    emissiveIntensity: 0.5,
    beamWidth: 0.003,
    opacity: 0.7,
    dotRadius: 0.018,
    dotEmissiveIntensity: 0.8,
    animationDurationMs: 220,
  },
```

#### `midnight.ts` — add to `midnightChartTheme`:
```typescript
  tooltip: {
    background: 'rgba(6,8,24,0.94)',
    blur: '10px',
    borderColor: 'rgba(107,155,255,0.3)',
    borderRadius: '6px',
    valueColor: '#C8D8FF',
    labelColor: 'rgba(200,216,255,0.6)',
    fontSize: 12,
    shadow: '0 4px 20px rgba(0,0,0,0.6)',
    padding: '8px 12px',
    maxWidth: 220,
    offsetX: 12,
    offsetY: -12,
  },
  projection: {
    color: '#6B9BFF',
    emissiveIntensity: 1.0,
    beamWidth: 0.005,
    opacity: 0.88,
    dotRadius: 0.024,
    dotEmissiveIntensity: 1.2,
    animationDurationMs: 220,
  },
```

#### `midnightLight.ts` — add to `midnightLightChartTheme`:
```typescript
  tooltip: {
    background: 'rgba(242,244,255,0.96)',
    blur: '6px',
    borderColor: 'rgba(79,100,200,0.25)',
    borderRadius: '6px',
    valueColor: '#1A2060',
    labelColor: 'rgba(26,32,96,0.55)',
    fontSize: 12,
    shadow: '0 2px 10px rgba(79,100,200,0.12)',
    padding: '8px 12px',
    maxWidth: 220,
    offsetX: 12,
    offsetY: -12,
  },
  projection: {
    color: '#4F64C8',
    emissiveIntensity: 0.55,
    beamWidth: 0.004,
    opacity: 0.75,
    dotRadius: 0.022,
    dotEmissiveIntensity: 0.9,
    animationDurationMs: 220,
  },
```

#### `lightCanvas.ts` — add to `lightCanvasChartTheme`:
```typescript
  tooltip: {
    background: 'rgba(255,255,255,0.96)',
    blur: '4px',
    borderColor: 'rgba(90,138,106,0.25)',
    borderRadius: '6px',
    valueColor: '#1A3A28',
    labelColor: 'rgba(26,58,40,0.55)',
    fontSize: 12,
    shadow: '0 2px 8px rgba(0,0,0,0.08)',
    padding: '8px 12px',
    maxWidth: 220,
    offsetX: 12,
    offsetY: -12,
  },
  projection: {
    color: '#5A8A6A',
    emissiveIntensity: 0.5,
    beamWidth: 0.003,
    opacity: 0.7,
    dotRadius: 0.018,
    dotEmissiveIntensity: 0.8,
    animationDurationMs: 220,
  },
```

#### `lightCanvasDark.ts` — add to `lightCanvasDarkChartTheme`:
```typescript
  tooltip: {
    background: 'rgba(18,26,20,0.93)',
    blur: '8px',
    borderColor: 'rgba(90,138,106,0.3)',
    borderRadius: '6px',
    valueColor: '#D4EAD8',
    labelColor: 'rgba(212,234,216,0.6)',
    fontSize: 12,
    shadow: '0 4px 16px rgba(0,0,0,0.4)',
    padding: '8px 12px',
    maxWidth: 220,
    offsetX: 12,
    offsetY: -12,
  },
  projection: {
    color: '#5A8A6A',
    emissiveIntensity: 0.75,
    beamWidth: 0.003,
    opacity: 0.8,
    dotRadius: 0.018,
    dotEmissiveIntensity: 1.0,
    animationDurationMs: 220,
  },
```

#### `lightMinimal.ts` — add to `lightMinimalChartTheme`:
```typescript
  tooltip: {
    background: 'rgba(255,255,255,0.97)',
    blur: '',
    borderColor: 'rgba(180,180,180,0.3)',
    borderRadius: '4px',
    valueColor: '#111111',
    labelColor: 'rgba(17,17,17,0.5)',
    fontSize: 12,
    shadow: '0 1px 6px rgba(0,0,0,0.08)',
    padding: '8px 12px',
    maxWidth: 220,
    offsetX: 12,
    offsetY: -12,
  },
  projection: {
    color: '#888888',
    emissiveIntensity: 0.3,
    beamWidth: 0.003,
    opacity: 0.6,
    dotRadius: 0.016,
    dotEmissiveIntensity: 0.5,
    animationDurationMs: 220,
  },
```

#### `lightMinimalDark.ts` — add to `lightMinimalDarkChartTheme`:
```typescript
  tooltip: {
    background: 'rgba(16,16,18,0.94)',
    blur: '6px',
    borderColor: 'rgba(150,150,150,0.25)',
    borderRadius: '4px',
    valueColor: '#EEEEEE',
    labelColor: 'rgba(238,238,238,0.55)',
    fontSize: 12,
    shadow: '0 4px 16px rgba(0,0,0,0.4)',
    padding: '8px 12px',
    maxWidth: 220,
    offsetX: 12,
    offsetY: -12,
  },
  projection: {
    color: '#999999',
    emissiveIntensity: 0.45,
    beamWidth: 0.003,
    opacity: 0.65,
    dotRadius: 0.016,
    dotEmissiveIntensity: 0.7,
    animationDurationMs: 220,
  },
```

---

### 4.5 Modify: `packages/charts/src/renderers/shared/IChartRenderer.ts`

**New types to add** (after the existing `ChartHitInfo` type definition, replacing it):

```typescript
/**
 * Typed per-chart-kind hover metadata.
 * Discriminated on `kind` — matches ChartType.
 * Populated by each renderer's resolveHoverInfo().
 */
export type ChartHitMeta =
  | {
      readonly kind: 'bar';
      /** Label of the hovered series (from ChartSeriesState.label or field). */
      readonly seriesLabel: string;
      /** Stack group key when stackMode='stacked'. */
      readonly stackGroup?: string;
      /** The hovered segment's own value (not the cumulative stack top). */
      readonly segmentValue: number;
      /** Sum of all series values for this datum. Absent for grouped bars. */
      readonly stackTotal?: number;
    }
  | {
      readonly kind: 'line';
      readonly seriesLabel: string;
      /** The Y-axis value at the hit point — from row[yAxis.field]. */
      readonly yValue: number;
    }
  | {
      readonly kind: 'area';
      readonly seriesLabel: string;
      /** The Y-axis value at the hit point — from row[yAxis.field]. */
      readonly yValue: number;
      /** Cumulative stack value at this point, when stackMode='stacked'. */
      readonly stackValue?: number;
    }
  | {
      readonly kind: 'scatter';
      /** The X-axis numeric value at the hit point. */
      readonly xValue: number;
      /** Size encoding value (from sizeField). */
      readonly sizeValue?: number;
      /** Color encoding value (from colorField). */
      readonly colorValue?: number | string;
    }
  | {
      readonly kind: 'pie';
      /** The category label for the hovered slice. */
      readonly sliceName: string;
      /** Percentage of total this slice represents [0..100]. */
      readonly percentage: number;
      /** Sum of all slice values. */
      readonly total: number;
    }
  | {
      readonly kind: 'heatmap';
      /** Normalized intensity value [0..1] at the hit cell. */
      readonly intensity: number;
      /** Row label (Y-axis category). */
      readonly rowLabel: string;
      /** Column label (X-axis category). */
      readonly columnLabel: string;
    };

/** Hit information returned by hover/click raycasting. */
export type ChartHitInfo = {
  readonly seriesIndex: number;
  readonly datumIndex: number;
  readonly row: Record<string, unknown>;
  /** World-space hit point [x, y, z]. */
  readonly point: readonly [number, number, number];
  /**
   * Typed per-chart-kind metadata for rich tooltip rendering.
   * Populated by each renderer's resolveHoverInfo().
   */
  readonly meta?: ChartHitMeta;
  /**
   * World-space terminus for the Y-axis projection beam.
   * The point on the Y-axis face at the same Y and Z height as the hit point.
   * Formula: [chartGroup.position.x + plotFrame.x, point[1], point[2]]
   * Present for bar, line, area, scatter. Absent for pie, heatmap.
   * Beam is drawn IFF this field is non-null.
   */
  readonly projectionTarget?: readonly [number, number, number];
};
```

**Add to `ChartRenderContext`** (after `fittedMargins`):

```typescript
  /**
   * Offset of the plot frame within chartGroup local space.
   * plotFrameOffset.x is the X position of the Y-axis face in chartGroup coordinates.
   * World-space Y-axis X = chartPosition[0] + plotFrameOffset.x
   * Required by renderers to compute projectionTarget.
   * @default undefined — renderers that don't need it ignore this field
   */
  readonly plotFrameOffset?: { readonly x: number; readonly y: number };
```

**Renderer interface — no change.** `resolveHoverInfo` signature remains:
```typescript
resolveHoverInfo(intersection: THREE.Intersection, data: ResolvedDataFrame): ChartHitInfo | null;
```

---

### 4.6 Stream A Tests

**File:** `packages/charts/src/themes/__tests__/createChartTheme.test.ts` — extend.

Add a test group:
```typescript
describe('All 12 preset themes: tooltip + projection tokens', () => {
  const allThemes = [
    darkGlassChartTheme, darkGlassLightChartTheme,
    midnightChartTheme, midnightLightChartTheme,
    neonCyberChartTheme, neonCyberLightChartTheme,
    enterpriseChartTheme, enterpriseLightChartTheme,
    lightCanvasChartTheme, lightCanvasDarkChartTheme,
    lightMinimalChartTheme, lightMinimalDarkChartTheme,
  ];

  for (const theme of allThemes) {
    it(`${theme.name}: tooltip tokens present and valid`, () => {
      expect(theme.tooltip).toBeDefined();
      expect(typeof theme.tooltip!.background).toBe('string');
      expect(typeof theme.tooltip!.maxWidth).toBe('number');
      expect(theme.tooltip!.offsetX).toBeGreaterThan(0);
    });

    it(`${theme.name}: projection tokens present and valid`, () => {
      expect(theme.projection).toBeDefined();
      expect(typeof theme.projection!.color).toBe('string');
      expect(theme.projection!.animationDurationMs).toBe(220);
      expect(theme.projection!.beamWidth).toBeGreaterThan(0);
    });
  }
});
```

---

## 5. Stream B: Tooltip Store + Host

**Prerequisite:** Stream A merged.
**Owner:** 1 developer.

---

### 5.1 New File: `packages/charts/src/elements/chart/tooltip/ChartTooltipStore.ts`

```typescript
// Module-level ChartTooltipStore — bridges ChartWidget hover events to ChartTooltipHost.

import { useSyncExternalStore } from 'react';
import type { ChartHitInfo } from '../../../renderers/shared/IChartRenderer';
import type { ChartTooltipTokens } from '../../../themes/types';
import type { ChartTooltipRuntimeConfig } from './types';

/** State written to the store on each hover event. */
export type ChartTooltipEntry = {
  /** Widget ID (= chart's `id` prop). */
  readonly widgetId: string;
  /** Projected pixel X within the EngineOverlayHost container. */
  readonly x: number;
  /** Projected pixel Y within the EngineOverlayHost container. */
  readonly y: number;
  /** Raw hover info from the raycaster. */
  readonly info: ChartHitInfo;
  /**
   * Resolved tooltip theme tokens from the active chart theme.
   * Null when the widget has not yet resolved a theme.
   */
  readonly tooltipTokens: ChartTooltipTokens | null;
  /**
   * d3-format string from ChartState.tooltip.format.
   * Passed through so ChartTooltipHost can format values without accessing ChartState.
   * Absent when no format was specified in the DSL.
   */
  readonly format?: string;
};

type Subscriber = () => void;

class ChartTooltipStoreImpl {
  private state: ChartTooltipEntry | null = null;
  private readonly subscribers = new Set<Subscriber>();
  private readonly runtimeConfigs = new Map<string, ChartTooltipRuntimeConfig>();
  private hostCount = 0;
  private readonly warnedIds = new Set<string>();

  // ── useSyncExternalStore API ────────────────────────────────────────────

  subscribe(listener: Subscriber): () => void {
    this.subscribers.add(listener);
    return () => { this.subscribers.delete(listener); };
  }

  getSnapshot(): ChartTooltipEntry | null {
    return this.state;
  }

  // ── Write API (called by ChartWidget) ───────────────────────────────────

  publish(
    widgetId: string,
    x: number,
    y: number,
    info: ChartHitInfo,
    tooltipTokens: ChartTooltipTokens | null,
    format?: string,
  ): void {
    this.state = { widgetId, x, y, info, tooltipTokens, format };
    this.notify();

    if (process.env.NODE_ENV !== 'production' && !this.warnedIds.has(widgetId)) {
      // Defer warning by one microtask to give host a chance to register
      Promise.resolve().then(() => {
        if (this.hostCount === 0) {
          this.warnedIds.add(widgetId);
          console.warn(
            `[ChartTooltipStore] Chart "${widgetId}" has tooltip enabled but no ` +
            `<ChartTooltipHost /> is mounted. Add <ChartTooltipHost /> inside EngineOverlayHost.`,
          );
        }
      });
    }
  }

  clear(widgetId: string): void {
    if (this.state?.widgetId === widgetId) {
      this.state = null;
      this.notify();
    }
  }

  // ── Runtime config API (called by useChartTooltipConfig) ───────────────

  setRuntimeConfig(chartId: string, config: ChartTooltipRuntimeConfig): void {
    this.runtimeConfigs.set(chartId, config);
  }

  clearRuntimeConfig(chartId: string): void {
    this.runtimeConfigs.delete(chartId);
  }

  getRuntimeConfig(chartId: string): ChartTooltipRuntimeConfig | undefined {
    return this.runtimeConfigs.get(chartId);
  }

  // ── Host tracking API (called by ChartTooltipHost) ──────────────────────

  /** Register a mounted ChartTooltipHost. Returns cleanup function. */
  registerHost(): () => void {
    this.hostCount++;
    return () => { this.hostCount--; };
  }

  private notify(): void {
    for (const sub of this.subscribers) sub();
  }
}

/** Module-level singleton store. Shared across all chart widgets in the engine. */
export const chartTooltipStore = new ChartTooltipStoreImpl();

/**
 * React hook for reading ChartTooltipStore state.
 * Uses useSyncExternalStore for React 18+ concurrent-safe subscriptions.
 */
export function useChartTooltip(): ChartTooltipEntry | null {
  return useSyncExternalStore(
    chartTooltipStore.subscribe.bind(chartTooltipStore),
    chartTooltipStore.getSnapshot.bind(chartTooltipStore),
  );
}
```

---

### 5.2 New File: `packages/charts/src/elements/chart/tooltip/useChartTooltipConfig.ts`

```typescript
// useChartTooltipConfig — registers custom tooltip renderContent for a specific chart.

import { useEffect } from 'react';
import { chartTooltipStore } from './ChartTooltipStore';
import type { ChartTooltipRuntimeConfig } from './types';

/**
 * Registers a custom renderContent function for the named chart's tooltip.
 * Deregisters automatically on component unmount or when chartId changes.
 *
 * @param chartId   Matches the `id` prop on the chart DSL component.
 * @param config    Runtime tooltip config. Stabilize renderContent with useCallback.
 */
export function useChartTooltipConfig(
  chartId: string,
  config: ChartTooltipRuntimeConfig,
): void {
  // Always-update: keep current config reference in the store without re-running cleanup
  useEffect(() => {
    chartTooltipStore.setRuntimeConfig(chartId, config);
  });

  // Cleanup on unmount or chartId change
  useEffect(() => {
    return () => {
      chartTooltipStore.clearRuntimeConfig(chartId);
    };
  }, [chartId]);
}
```

---

### 5.3 New File: `packages/charts/src/elements/chart/tooltip/ChartTooltipHost.tsx`

```typescript
// ChartTooltipHost — zero-prop global overlay component for chart tooltips.

import React, { useEffect, useRef } from 'react';
import { format as d3format } from 'd3-format';
import { useChartTooltip, chartTooltipStore } from './ChartTooltipStore';
import type { ChartTooltipEntry } from './ChartTooltipStore';
import type { ChartTooltipTokens } from '../../../themes/types';
import type { ChartHitInfo, ChartHitMeta } from '../../../renderers/shared/IChartRenderer';

/** Hardcoded darkGlass fallback constants — used when theme.tooltip is absent. */
const DEFAULT_TOOLTIP_TOKENS: ChartTooltipTokens = {
  background:   'rgba(28,16,10,0.92)',
  blur:         '8px',
  borderColor:  'rgba(227,106,46,0.3)',
  borderRadius: '6px',
  valueColor:   '#F0E4DA',
  labelColor:   'rgba(240,228,218,0.65)',
  fontSize:     12,
  shadow:       '0 4px 16px rgba(0,0,0,0.5)',
  padding:      '8px 12px',
  maxWidth:     220,
  offsetX:      12,
  offsetY:      -12,
};

/** Edge detection margin in px — tooltip flips when anchor is within this distance from edge. */
const EDGE_MARGIN_PX = 16;

/** Estimated tooltip height for bottom-edge flip calculation. */
const ESTIMATED_TOOLTIP_HEIGHT_PX = 110;

function formatValue(v: unknown, formatStr?: string): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number' && formatStr) {
    try {
      return d3format(formatStr)(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

function DefaultTooltipContent({
  info,
  tokens,
  format,
}: {
  info: ChartHitInfo;
  tokens: ChartTooltipTokens;
  /** d3-format string from ChartTooltipEntry.format. */
  format?: string;
}): React.ReactElement {
  const { meta, row } = info;
  const labelStyle: React.CSSProperties = { color: tokens.labelColor, fontSize: tokens.fontSize * 0.9 };
  const valueStyle: React.CSSProperties = { color: tokens.valueColor, fontWeight: 700, fontSize: tokens.fontSize * 1.2 };
  const secondaryStyle: React.CSSProperties = { color: tokens.labelColor, fontSize: tokens.fontSize * 0.85, marginTop: 2 };

  if (!meta) {
    // Fallback: raw row display (same as deprecated ChartTooltipOverlay)
    return (
      <div>
        {Object.entries(row).slice(0, 4).map(([k, v]) => (
          <div key={k}>
            <span style={labelStyle}>{k}: </span>
            <span style={valueStyle}>{String(v)}</span>
          </div>
        ))}
      </div>
    );
  }

  return renderMetaContent(meta, row, labelStyle, valueStyle, secondaryStyle, format);
}

function renderMetaContent(
  meta: ChartHitMeta,
  _row: Record<string, unknown>,
  labelStyle: React.CSSProperties,
  valueStyle: React.CSSProperties,
  secondaryStyle: React.CSSProperties,
  format?: string,
): React.ReactElement {
  switch (meta.kind) {
    case 'bar':
      return (
        <div>
          <div style={labelStyle}>{meta.seriesLabel}</div>
          <div style={valueStyle}>{formatValue(meta.segmentValue, format)}</div>
          {meta.stackTotal !== undefined && (
            <div style={secondaryStyle}>Stack total: {formatValue(meta.stackTotal, format)}</div>
          )}
        </div>
      );
    case 'line':
      return (
        <div>
          <div style={labelStyle}>{meta.seriesLabel}</div>
          <div style={valueStyle}>{formatValue(meta.yValue, format)}</div>
        </div>
      );
    case 'area':
      return (
        <div>
          <div style={labelStyle}>{meta.seriesLabel}</div>
          <div style={valueStyle}>{formatValue(meta.stackValue ?? meta.yValue, format)}</div>
        </div>
      );
    case 'scatter':
      return (
        <div>
          <div style={labelStyle}>X: <span style={valueStyle}>{formatValue(meta.xValue, format)}</span></div>
          {meta.sizeValue !== undefined && <div style={secondaryStyle}>Size: {formatValue(meta.sizeValue, format)}</div>}
          {meta.colorValue !== undefined && <div style={secondaryStyle}>Color: {formatValue(meta.colorValue)}</div>}
        </div>
      );
    case 'pie':
      return (
        <div>
          <div style={labelStyle}>{meta.sliceName}</div>
          <div style={valueStyle}>{meta.percentage.toFixed(1)}%</div>
          <div style={secondaryStyle}>Total: {formatValue(meta.total, format)}</div>
        </div>
      );
    case 'heatmap':
      return (
        <div>
          <div style={labelStyle}>{meta.columnLabel} / {meta.rowLabel}</div>
          <div style={valueStyle}>{(meta.intensity * 100).toFixed(0)}%</div>
        </div>
      );
  }
}

function TooltipCard({
  entry,
  containerW,
  containerH,
}: {
  entry: ChartTooltipEntry;
  containerW: number;
  containerH: number;
}): React.ReactElement {
  const tokens = entry.tooltipTokens ?? DEFAULT_TOOLTIP_TOKENS;
  const runtimeConfig = chartTooltipStore.getRuntimeConfig(entry.widgetId);
  const content = runtimeConfig?.renderContent
    ? runtimeConfig.renderContent(entry.info)
    : <DefaultTooltipContent info={entry.info} tokens={tokens} format={entry.format} />;

  // Edge-flip logic
  const flipX = entry.x + tokens.maxWidth + tokens.offsetX > containerW - EDGE_MARGIN_PX;
  const flipY = entry.y - tokens.offsetY + ESTIMATED_TOOLTIP_HEIGHT_PX > containerH - EDGE_MARGIN_PX;

  const left = flipX
    ? entry.x - tokens.maxWidth - tokens.offsetX
    : entry.x + tokens.offsetX;
  const top = flipY
    ? entry.y - ESTIMATED_TOOLTIP_HEIGHT_PX + tokens.offsetY
    : entry.y + tokens.offsetY;

  const backdropFilter = tokens.blur ? `blur(${tokens.blur})` : undefined;

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        maxWidth: tokens.maxWidth,
        background: tokens.background,
        border: `1px solid ${tokens.borderColor}`,
        borderRadius: tokens.borderRadius,
        boxShadow: tokens.shadow,
        backdropFilter,
        WebkitBackdropFilter: backdropFilter,
        padding: tokens.padding,
        fontFamily: tokens.fontFamily ?? 'inherit',
        fontSize: tokens.fontSize,
        pointerEvents: 'none',
        zIndex: 9999,
        // Fade-in animation — CSS transition on opacity
        opacity: 1,
        animation: 'chartTooltipFadeIn 120ms ease-out',
      }}
    >
      {content}
    </div>
  );
}

/**
 * Global tooltip overlay component for all charts in the engine.
 * Place once inside EngineOverlayHost.
 *
 * The container div is always mounted so containerRef.current is populated
 * before any TooltipCard needs edge-flip dimensions (Issue 3 fix).
 *
 * @param _store  Test-only injection. Do not pass in production.
 *
 * @example
 * <EngineOverlayHost>
 *   <ChartTooltipHost />
 * </EngineOverlayHost>
 */
export function ChartTooltipHost({ _store = chartTooltipStore }: { _store?: ChartTooltipStoreImpl } = {}): React.ReactElement {
  const entry = useChartTooltip();
  const containerRef = useRef<HTMLDivElement>(null);

  // Register presence with the store for dev-mode warning tracking
  useEffect(() => {
    return _store.registerHost();
  }, [_store]);

  // Inject fade-in keyframe once on mount — not on every render
  useEffect(() => {
    const KEYFRAME_ID = 'chart-tooltip-keyframes';
    if (!document.getElementById(KEYFRAME_ID)) {
      const style = document.createElement('style');
      style.id = KEYFRAME_ID;
      style.textContent = [
        '@keyframes chartTooltipFadeIn {',
        '  from { opacity: 0; transform: translateY(4px); }',
        '  to   { opacity: 1; transform: translateY(0); }',
        '}',
      ].join(' ');
      document.head.appendChild(style);
      return () => { style.remove(); };
    }
    return undefined;
  }, []);

  // Container is ALWAYS mounted — containerRef.current is valid before first tooltip render
  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}
    >
      {entry && (
        <TooltipCard
          entry={entry}
          containerW={containerRef.current?.offsetWidth ?? 0}
          containerH={containerRef.current?.offsetHeight ?? 0}
        />
      )}
    </div>
  );
}
```

---

### 5.4 Tests: `.../__tests__/ChartTooltipStore.test.ts`

```typescript
// ChartTooltipStore unit tests — subscribe/publish/clear, multi-chart isolation,
// runtime config lifecycle, host registration.

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Note: Import from the source file directly, not the module singleton,
// so each test has a fresh instance. For isolation, the store class must be
// exported as both the singleton AND the class.
// Export `ChartTooltipStoreImpl` from ChartTooltipStore.ts for testing.
import { ChartTooltipStoreImpl } from '../ChartTooltipStore';
import type { ChartHitInfo } from '../../../../renderers/shared/IChartRenderer';

function makeHitInfo(overrides: Partial<ChartHitInfo> = {}): ChartHitInfo {
  return {
    seriesIndex: 0,
    datumIndex: 0,
    row: { month: 'Jan', value: 100 },
    point: [0, 0.5, 0],
    ...overrides,
  };
}

describe('ChartTooltipStore', () => {
  let store: ChartTooltipStoreImpl;

  beforeEach(() => {
    store = new ChartTooltipStoreImpl();
  });

  it('getSnapshot() returns null initially', () => {
    expect(store.getSnapshot()).toBeNull();
  });

  it('publish() updates snapshot and notifies subscribers', () => {
    const listener = vi.fn();
    store.subscribe(listener);

    const info = makeHitInfo();
    store.publish('chart-a', 100, 200, info, null);

    expect(store.getSnapshot()).toMatchObject({
      widgetId: 'chart-a',
      x: 100,
      y: 200,
      info,
    });
    expect(listener).toHaveBeenCalledOnce();
  });

  it('clear() removes state for matching widgetId', () => {
    const listener = vi.fn();
    store.subscribe(listener);

    store.publish('chart-a', 50, 60, makeHitInfo(), null);
    store.clear('chart-a');

    expect(store.getSnapshot()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2); // once for publish, once for clear
  });

  it('clear() is a no-op when widgetId does not match active entry', () => {
    const listener = vi.fn();
    store.subscribe(listener);

    store.publish('chart-a', 50, 60, makeHitInfo(), null);
    listener.mockClear();

    store.clear('chart-b'); // different chart
    expect(store.getSnapshot()?.widgetId).toBe('chart-a');
    expect(listener).not.toHaveBeenCalled();
  });

  it('subscribe() returns an unsubscribe function that stops notifications', () => {
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.publish('chart-a', 10, 20, makeHitInfo(), null);
    expect(listener).toHaveBeenCalledOnce();

    unsubscribe();
    store.publish('chart-a', 30, 40, makeHitInfo(), null);
    expect(listener).toHaveBeenCalledOnce(); // not called again
  });

  it('most-recent publish wins (only one active tooltip at a time)', () => {
    store.publish('chart-a', 10, 20, makeHitInfo(), null);
    store.publish('chart-b', 30, 40, makeHitInfo(), null);

    expect(store.getSnapshot()?.widgetId).toBe('chart-b');
  });

  it('setRuntimeConfig / getRuntimeConfig / clearRuntimeConfig lifecycle', () => {
    const renderContent = vi.fn();
    store.setRuntimeConfig('chart-a', { renderContent });

    expect(store.getRuntimeConfig('chart-a')?.renderContent).toBe(renderContent);

    store.clearRuntimeConfig('chart-a');
    expect(store.getRuntimeConfig('chart-a')).toBeUndefined();
  });

  it('multiple charts have independent runtime configs', () => {
    const rcA = vi.fn();
    const rcB = vi.fn();
    store.setRuntimeConfig('a', { renderContent: rcA });
    store.setRuntimeConfig('b', { renderContent: rcB });

    expect(store.getRuntimeConfig('a')?.renderContent).toBe(rcA);
    expect(store.getRuntimeConfig('b')?.renderContent).toBe(rcB);

    store.clearRuntimeConfig('a');
    expect(store.getRuntimeConfig('a')).toBeUndefined();
    expect(store.getRuntimeConfig('b')?.renderContent).toBe(rcB);
  });

  it('registerHost() returns cleanup and tracks host count for warning suppression', () => {
    // Access hostCount via package-internal (cast to any for testing)
    const cleanup = store.registerHost();
    expect((store as unknown as { hostCount: number }).hostCount).toBe(1);
    cleanup();
    expect((store as unknown as { hostCount: number }).hostCount).toBe(0);
  });
});
```

**Note:** `ChartTooltipStoreImpl` must be exported from `ChartTooltipStore.ts` in addition to the `chartTooltipStore` singleton.

---

### 5.5 Tests: `.../__tests__/ChartTooltipHost.test.tsx`

```typescript
// ChartTooltipHost unit tests — renders tooltip, edge-flip, null state.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import React from 'react';
import { ChartTooltipHost } from '../ChartTooltipHost';
import { ChartTooltipStoreImpl } from '../ChartTooltipStore';
import type { ChartHitInfo } from '../../../../renderers/shared/IChartRenderer';

// Override the module singleton with a test instance via vi.mock — see implementation note.
// The test file must mock '../ChartTooltipStore' to return a controllable store instance.
// Alternatively, ChartTooltipHost can accept a store prop for testing — specify this pattern.
//
// IMPLEMENTATION NOTE FOR DEVELOPER:
// Add an optional internal prop `_store` to ChartTooltipHost for testing only:
//   function ChartTooltipHost({ _store = chartTooltipStore }: { _store?: ChartTooltipStoreImpl } = {}): ...
// This avoids vi.mock complexity and keeps tests deterministic.

function makeHitInfo(): ChartHitInfo {
  return {
    seriesIndex: 0,
    datumIndex: 0,
    row: { month: 'Jan', value: 100 },
    point: [0, 0.5, 0],
    meta: { kind: 'bar', seriesLabel: 'Revenue', segmentValue: 100 },
  };
}

describe('ChartTooltipHost', () => {
  let testStore: ChartTooltipStoreImpl;

  beforeEach(() => {
    testStore = new ChartTooltipStoreImpl();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing when store state is null', () => {
    const { container } = render(<ChartTooltipHost _store={testStore} />);
    expect(container.querySelector('[data-testid="chart-tooltip"]')).toBeNull();
  });

  it('renders tooltip card when store has active entry', () => {
    act(() => {
      testStore.publish('chart-a', 100, 200, makeHitInfo(), null);
    });
    render(<ChartTooltipHost _store={testStore} />);
    // With bar meta: seriesLabel should appear
    expect(screen.getByText('Revenue')).toBeDefined();
  });

  it('renders custom renderContent when registered', () => {
    testStore.setRuntimeConfig('chart-a', {
      renderContent: () => <div>Custom Content</div>,
    });
    act(() => {
      testStore.publish('chart-a', 100, 200, makeHitInfo(), null);
    });
    render(<ChartTooltipHost _store={testStore} />);
    expect(screen.getByText('Custom Content')).toBeDefined();
  });

  it('host registers and deregisters with store on mount/unmount', () => {
    const { unmount } = render(<ChartTooltipHost _store={testStore} />);
    expect((testStore as unknown as { hostCount: number }).hostCount).toBe(1);
    unmount();
    expect((testStore as unknown as { hostCount: number }).hostCount).toBe(0);
  });
});
```

---

## 6. Stream C: ChartProjectionRenderer

**Prerequisite:** Stream A merged.
**Owner:** 1 developer.

---

### 6.1 New File: `packages/charts/src/elements/chart/projection/ChartProjectionRenderer.ts`

```typescript
// ChartProjectionRenderer — Three.js beam + landing dot for Y-axis projection.
// Owned by ChartRenderer as a child of chartGroup. Ticked by ChartWidget.onTick().

import * as THREE from 'three';
import type { ChartHitInfo } from '../../../renderers/shared/IChartRenderer';
import type { ChartProjectionTokens } from '../../../themes/types';

/** Hardcoded darkGlass fallback — used when theme.projection is absent. */
export const DEFAULT_PROJECTION_TOKENS: ChartProjectionTokens = {
  color:                '#E36A2E',
  emissiveIntensity:    0.8,
  beamWidth:            0.004,
  opacity:              0.85,
  dotRadius:            0.022,
  dotEmissiveIntensity: 1.1,
  animationDurationMs:  220,
};

/** Exit animation duration in ms — fixed, not theme-configurable. */
const EXIT_DURATION_MS = 160;

type ProjectionState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'entering'; readonly startTime: number }
  | { readonly kind: 'holding' }
  | { readonly kind: 'exiting'; readonly startTime: number };

/** ease-out-expo: fast start, exponential deceleration to final value. */
function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/**
 * Manages the Y-axis projection beam and landing dot in the Three.js scene.
 * Lives as a child of ChartRenderer's chartGroup.
 * Lifecycle: updateProjection() on hover events → tick() every RAF frame.
 */
export class ChartProjectionRenderer {
  private readonly projectionGroup: THREE.Group;
  private beamMesh: THREE.Mesh | null = null;
  private dotMesh: THREE.Mesh | null = null;
  private animState: ProjectionState = { kind: 'idle' };
  private currentInfo: ChartHitInfo | null = null;
  private readonly getNow: () => number;

  /**
   * @param chartGroup  The chartGroup from ChartRenderer — projectionGroup is added as child.
   * @param getNow      Optional time provider for deterministic testing. Default: performance.now.
   */
  constructor(
    private readonly chartGroup: THREE.Group,
    getNow: () => number = () => performance.now(),
  ) {
    this.projectionGroup = new THREE.Group();
    chartGroup.add(this.projectionGroup);
    this.getNow = getNow;
  }

  /**
   * Called by ChartRenderer.updateProjection() when hover state changes.
   * Non-null info: start (or restart) entrance animation.
   * Null info: start exit animation.
   */
  updateProjection(info: ChartHitInfo | null, tokens: ChartProjectionTokens): void {
    if (info === null) {
      if (this.animState.kind !== 'idle') {
        this.animState = { kind: 'exiting', startTime: this.getNow() };
      }
      this.currentInfo = null;
      return;
    }

    if (!info.projectionTarget) {
      // Renderer does not provide projection (pie, heatmap) — stay idle
      this.currentInfo = null;
      this.animState = { kind: 'idle' };
      this.hideGeometry();
      return;
    }

    this.currentInfo = info;

    // Snap to new position and restart entrance (re-trigger behavior)
    this.rebuildGeometry(info, tokens);
    this.animState = { kind: 'entering', startTime: this.getNow() };
  }

  /**
   * Called every RAF frame by ChartWidget.onTick() via ChartRenderer.tickProjection().
   * Advances entrance / holding / exit animations.
   */
  tick(tokens: ChartProjectionTokens): void {
    if (this.animState.kind === 'idle') return;

    const now = this.getNow();

    switch (this.animState.kind) {
      case 'entering': {
        const elapsed = now - this.animState.startTime;
        const progress = Math.min(elapsed / tokens.animationDurationMs, 1.0);
        const eased = easeOutExpo(progress);

        if (this.beamMesh) this.beamMesh.scale.x = eased;
        if (this.beamMesh) (this.beamMesh.material as THREE.MeshBasicMaterial).opacity = tokens.opacity * eased;
        if (this.dotMesh)  (this.dotMesh.material  as THREE.MeshBasicMaterial).opacity = tokens.opacity * eased;

        if (progress >= 1.0) {
          if (this.beamMesh) this.beamMesh.scale.x = 1.0;
          this.animState = { kind: 'holding' };
        }
        break;
      }

      case 'holding': {
        // Landing dot pulse: sin(time * 0.004) maps ms → ~4 rad/s pulse
        const pulse = Math.sin(now * 0.004) * 0.15 + 1.0;
        if (this.dotMesh) this.dotMesh.scale.set(pulse, pulse, 1);
        break;
      }

      case 'exiting': {
        const elapsed = now - this.animState.startTime;
        const progress = Math.min(elapsed / EXIT_DURATION_MS, 1.0);
        const opacity = tokens.opacity * (1.0 - progress);

        if (this.beamMesh) (this.beamMesh.material as THREE.MeshBasicMaterial).opacity = opacity;
        if (this.dotMesh)  (this.dotMesh.material  as THREE.MeshBasicMaterial).opacity = opacity;

        if (progress >= 1.0) {
          this.hideGeometry();
          this.animState = { kind: 'idle' };
        }
        break;
      }
    }
  }

  /** Release Three.js resources. Called by ChartRenderer.dispose(). */
  dispose(): void {
    this.clearGeometry();
    this.chartGroup.remove(this.projectionGroup);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  /**
   * Creates or replaces beam + dot geometry for the given hit info.
   * Beam geometry: BoxGeometry, pivot at data-point end, extends toward Y-axis.
   * Beam position in projectionGroup (= chartGroup local) space.
   */
  private rebuildGeometry(info: ChartHitInfo, tokens: ChartProjectionTokens): void {
    this.clearGeometry();

    const hitX  = info.point[0] - this.chartGroup.position.x;
    const hitY  = info.point[1] - this.chartGroup.position.y;
    const hitZ  = info.point[2] - this.chartGroup.position.z;

    const targetX = info.projectionTarget![0] - this.chartGroup.position.x;

    const beamLength = Math.abs(hitX - targetX);
    if (beamLength < 1e-5) return; // degenerate — skip

    // Beam: BoxGeometry with width = beamLength, height = beamWidth, depth = 0.001 (flat)
    // Translate geometry so x=0 is at the data-point end (pivot for scale.x animation)
    const direction = targetX < hitX ? -1 : 1;
    const beamGeo = new THREE.BoxGeometry(beamLength, tokens.beamWidth, 0.001);
    beamGeo.translate(direction * beamLength / 2, 0, 0);

    const beamMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(tokens.color),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.beamMesh = new THREE.Mesh(beamGeo, beamMat);
    this.beamMesh.position.set(hitX, hitY, hitZ);
    this.beamMesh.scale.x = 0; // entrance animation starts at 0

    // Landing dot: PlaneGeometry at projectionTarget, same orientation as beam
    const dotDiameter = tokens.dotRadius * 2;
    const dotGeo = new THREE.PlaneGeometry(dotDiameter, dotDiameter);
    const dotMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(tokens.color),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.dotMesh = new THREE.Mesh(dotGeo, dotMat);
    this.dotMesh.position.set(targetX, hitY, hitZ);

    this.projectionGroup.add(this.beamMesh, this.dotMesh);
  }

  private hideGeometry(): void {
    if (this.beamMesh) this.beamMesh.visible = false;
    if (this.dotMesh)  this.dotMesh.visible  = false;
  }

  private clearGeometry(): void {
    if (this.beamMesh) {
      this.projectionGroup.remove(this.beamMesh);
      this.beamMesh.geometry.dispose();
      (this.beamMesh.material as THREE.Material).dispose();
      this.beamMesh = null;
    }
    if (this.dotMesh) {
      this.projectionGroup.remove(this.dotMesh);
      this.dotMesh.geometry.dispose();
      (this.dotMesh.material as THREE.Material).dispose();
      this.dotMesh = null;
    }
  }
}
```

---

### 6.2 Tests: `.../__tests__/ChartProjectionRenderer.test.ts`

The test file mocks Three.js (same pattern as `BarRenderer.test.ts`). It uses `getNow` injection for deterministic timing.

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('three', () => {
  // ... same Three.js mock as BarRenderer.test.ts ...
  // Ensure MeshBasicMaterial is included with: opacity=0, color={set: vi.fn()},
  // transparent=false, blending=0, depthWrite=true, dispose=vi.fn()
});

import * as THREE from 'three';
import { ChartProjectionRenderer, DEFAULT_PROJECTION_TOKENS } from '../ChartProjectionRenderer';
import type { ChartHitInfo } from '../../../../renderers/shared/IChartRenderer';
import type { ChartProjectionTokens } from '../../../../themes/types';

function makeChartGroup(): THREE.Group {
  const g = new THREE.Group();
  g.position.set(0, 0, 0);
  return g;
}

function makeHitInfo(overrides: Partial<ChartHitInfo> = {}): ChartHitInfo {
  return {
    seriesIndex: 0,
    datumIndex: 0,
    row: {},
    point: [2.0, 1.0, -0.1],
    projectionTarget: [0.0, 1.0, -0.1], // Y-axis face at x=0
    ...overrides,
  };
}

describe('ChartProjectionRenderer', () => {
  let renderer: ChartProjectionRenderer;
  let chartGroup: THREE.Group;
  let mockNow: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockNow = vi.fn(() => 0);
    chartGroup = makeChartGroup();
    renderer = new ChartProjectionRenderer(chartGroup, mockNow);
  });

  it('constructor adds projectionGroup as child of chartGroup', () => {
    expect(chartGroup.children).toHaveLength(1);
  });

  it('updateProjection(null) on idle: no state change', () => {
    renderer.updateProjection(null, DEFAULT_PROJECTION_TOKENS);
    // tick should be a no-op
    renderer.tick(DEFAULT_PROJECTION_TOKENS);
    // projectionGroup still has no children
    const projGroup = chartGroup.children[0] as THREE.Group;
    expect(projGroup.children).toHaveLength(0);
  });

  it('updateProjection(info): beam + dot added to projectionGroup', () => {
    renderer.updateProjection(makeHitInfo(), DEFAULT_PROJECTION_TOKENS);
    const projGroup = chartGroup.children[0] as THREE.Group;
    expect(projGroup.children).toHaveLength(2); // beam + dot
  });

  it('beam starts at scale.x = 0', () => {
    renderer.updateProjection(makeHitInfo(), DEFAULT_PROJECTION_TOKENS);
    const projGroup = chartGroup.children[0] as THREE.Group;
    const beam = projGroup.children[0] as THREE.Mesh;
    expect((beam.scale as { x: number }).x).toBe(0);
  });

  it('tick() during entrance: scale.x follows easeOutExpo', () => {
    renderer.updateProjection(makeHitInfo(), DEFAULT_PROJECTION_TOKENS);
    // At 110ms (halfway through 220ms animation)
    mockNow.mockReturnValue(110);
    renderer.tick(DEFAULT_PROJECTION_TOKENS);

    const projGroup = chartGroup.children[0] as THREE.Group;
    const beam = projGroup.children[0] as THREE.Mesh;
    const scaleX = (beam.scale as { x: number }).x;
    // easeOutExpo(0.5) = 1 - 2^(-5) = 1 - 0.03125 = 0.96875
    expect(scaleX).toBeCloseTo(0.96875, 2);
  });

  it('tick() at end of entrance: transitions to holding state', () => {
    renderer.updateProjection(makeHitInfo(), DEFAULT_PROJECTION_TOKENS);
    mockNow.mockReturnValue(220); // full duration
    renderer.tick(DEFAULT_PROJECTION_TOKENS);
    // scale.x should be 1.0 now
    const projGroup = chartGroup.children[0] as THREE.Group;
    const beam = projGroup.children[0] as THREE.Mesh;
    expect((beam.scale as { x: number }).x).toBeCloseTo(1.0, 5);
  });

  it('re-trigger: new updateProjection() snaps to new position and restarts entrance', () => {
    renderer.updateProjection(makeHitInfo({ point: [2.0, 1.0, 0] }), DEFAULT_PROJECTION_TOKENS);
    mockNow.mockReturnValue(100);
    renderer.tick(DEFAULT_PROJECTION_TOKENS);

    // Retrigger on a new hit point
    renderer.updateProjection(makeHitInfo({ point: [3.0, 0.5, 0] }), DEFAULT_PROJECTION_TOKENS);
    const projGroup = chartGroup.children[0] as THREE.Group;
    const beam = projGroup.children[0] as THREE.Mesh;
    // scale.x should be 0 again (snapped, restart)
    expect((beam.scale as { x: number }).x).toBe(0);
  });

  it('updateProjection(null) while entering: transitions to exiting', () => {
    renderer.updateProjection(makeHitInfo(), DEFAULT_PROJECTION_TOKENS);
    mockNow.mockReturnValue(50); // halfway through entrance
    renderer.tick(DEFAULT_PROJECTION_TOKENS);

    renderer.updateProjection(null, DEFAULT_PROJECTION_TOKENS);
    // Further ticks should reduce opacity toward 0
    mockNow.mockReturnValue(50 + 160); // full exit duration
    renderer.tick(DEFAULT_PROJECTION_TOKENS);
    // After full exit, geometry should be hidden (visible = false)
    const projGroup = chartGroup.children[0] as THREE.Group;
    for (const child of projGroup.children) {
      expect((child as THREE.Mesh).visible).toBe(false);
    }
  });

  it('info without projectionTarget: stays idle', () => {
    const info: ChartHitInfo = { ...makeHitInfo(), projectionTarget: undefined };
    renderer.updateProjection(info, DEFAULT_PROJECTION_TOKENS);
    renderer.tick(DEFAULT_PROJECTION_TOKENS);
    const projGroup = chartGroup.children[0] as THREE.Group;
    expect(projGroup.children).toHaveLength(0);
  });

  it('dispose(): removes projectionGroup from chartGroup', () => {
    renderer.dispose();
    expect(chartGroup.children).toHaveLength(0);
  });

  it('dispose(): disposes geometry and material of beam + dot', () => {
    renderer.updateProjection(makeHitInfo(), DEFAULT_PROJECTION_TOKENS);
    const projGroup = chartGroup.children[0] as THREE.Group;
    const beam = projGroup.children[0] as THREE.Mesh;
    const dot  = projGroup.children[1] as THREE.Mesh;
    const beamGeoDispose = vi.spyOn(beam.geometry, 'dispose');
    const dotGeoDispose  = vi.spyOn(dot.geometry, 'dispose');

    renderer.dispose();
    expect(beamGeoDispose).toHaveBeenCalled();
    expect(dotGeoDispose).toHaveBeenCalled();
  });
});
```

---

## 7. Stream D: Renderer Enrichment

**Prerequisite:** Stream A merged.
**Owner:** 1 developer.

All 6 renderers must be updated to:
1. Cache `plotFrameOffset` and `chartPosition` from `update()` calls
2. Populate `meta` in `resolveHoverInfo()`
3. Populate `projectionTarget` where applicable (bar, line, area, scatter; NOT pie, heatmap)

### 7.1 All Renderers: Shared Pattern

Add these private fields to every renderer class:

```typescript
/** Cached chart world-space X from the last update() call. */
private cachedChartPositionX = 0;
/** Cached plot frame X offset (chartGroup local) from the last update() call. */
private cachedPlotFrameOffsetX = 0;
```

Cache them in `update(ctx)`:
```typescript
this.cachedChartPositionX    = ctx.chartPosition?.[0] ?? 0;
this.cachedPlotFrameOffsetX  = ctx.plotFrameOffset?.x ?? 0;
```

Compute `projectionTarget` in `resolveHoverInfo()` for bar/line/area/scatter:
```typescript
const yAxisWorldX = this.cachedChartPositionX + this.cachedPlotFrameOffsetX;
const projectionTarget: readonly [number, number, number] = [yAxisWorldX, p.y, p.z];
```

---

### 7.2 `BarRenderer.ts` — full specification

**Fields to add:**
```typescript
private cachedChartPositionX = 0;
private cachedPlotFrameOffsetX = 0;
```

**In `update()`, after extracting `barOptions`:**
```typescript
this.cachedChartPositionX   = ctx.chartPosition?.[0] ?? 0;
this.cachedPlotFrameOffsetX = ctx.plotFrameOffset?.x ?? 0;
```

**Also cache per-mesh data for meta:** The `hitMap` already stores `{ seriesIndex, datumIndex, row }`. Extend `BarHitEntry` to include:
```typescript
type BarHitEntry = {
  seriesIndex: number;
  datumIndex: number;
  row: Record<string, unknown>;
  /** For stacked bars: cumulative top value for this mesh. */
  stackTop?: number;
  /** Stack mode at render time. */
  stackMode?: 'grouped' | 'stacked';
};
```

In `buildStackedBars()`, store `stackTop: datum[1]` in the hitMap entry.
In `buildGroupedBars()`, store `stackMode: 'grouped'` (no stackTop needed).

**`resolveHoverInfo()` — full replacement:**
```typescript
resolveHoverInfo(intersection: THREE.Intersection, data: ResolvedDataFrame): ChartHitInfo | null {
  const mesh = intersection.object as THREE.Mesh;
  const entry = this.hitMap.get(mesh);
  if (!entry) return null;

  const p = intersection.point;
  const yAxisWorldX = this.cachedChartPositionX + this.cachedPlotFrameOffsetX;
  const projectionTarget: readonly [number, number, number] = [yAxisWorldX, p.y, p.z];

  // Determine series label from series array (stored at render time via ctx.series)
  // series array is not stored — use seriesIndex to look up from data context
  // NOTE: renderer must cache ctx.series in update() to resolve label here.
  // Add: private cachedSeries: Array<{ field: string; label?: string }> = [];
  // In update(): this.cachedSeries = effectiveSeries;
  const seriesLabel = this.cachedSeries[entry.seriesIndex]?.label
    ?? this.cachedSeries[entry.seriesIndex]?.field
    ?? `Series ${entry.seriesIndex}`;

  const meta: ChartHitMeta = entry.stackMode === 'stacked' && entry.stackTop !== undefined
    ? {
        kind: 'bar',
        seriesLabel,
        segmentValue: Number(entry.row[this.cachedSeries[entry.seriesIndex]?.field ?? '']) || 0,
        stackTotal: this.computeStackTotal(entry.row),
      }
    : {
        kind: 'bar',
        seriesLabel,
        segmentValue: Number(entry.row[this.cachedSeries[entry.seriesIndex]?.field ?? '']) || 0,
      };

  return {
    seriesIndex: entry.seriesIndex,
    datumIndex:  entry.datumIndex,
    row:         entry.row,
    point:       [p.x, p.y, p.z],
    meta,
    projectionTarget,
  };
}

private computeStackTotal(row: Record<string, unknown>): number {
  return this.cachedSeries.reduce((sum, s) => sum + (Number(row[s.field]) || 0), 0);
}
```

**Additional field to cache in `BarRenderer`:**
```typescript
private cachedSeries: Array<{ field: string; label?: string }> = [];
// In update(): this.cachedSeries = effectiveSeries;
```

---

### 7.3 `LineRenderer.ts`

- Cache `cachedChartPositionX`, `cachedPlotFrameOffsetX`, `cachedSeries`, `cachedYField`
- Cache per-point data in hitMap: `type LineHitEntry = { seriesIndex: number; datumIndex: number; row: Record<string, unknown>; }`
- In `update()`: `this.cachedYField = ctx.yAxis?.field ?? '';`
- `resolveHoverInfo()`:
  ```typescript
  const p = intersection.point;
  const yAxisWorldX = this.cachedChartPositionX + this.cachedPlotFrameOffsetX;
  const yValue = Number(entry.row[this.cachedYField]) || 0;
  const meta: ChartHitMeta = {
    kind: 'line',
    seriesLabel: this.cachedSeries[entry.seriesIndex]?.label
      ?? this.cachedSeries[entry.seriesIndex]?.field
      ?? `Series ${entry.seriesIndex}`,
    yValue,
  };
  return {
    seriesIndex: entry.seriesIndex,
    datumIndex:  entry.datumIndex,
    row:         entry.row,
    point:       [p.x, p.y, p.z],
    meta,
    projectionTarget: [yAxisWorldX, p.y, p.z],
  };
  ```

---

### 7.4 `AreaRenderer.ts`

Same as LineRenderer. Cache `cachedYField` from `ctx.yAxis?.field`. Extend `AreaHitEntry`:
```typescript
type AreaHitEntry = {
  seriesIndex: number; datumIndex: number; row: Record<string, unknown>;
  /** Cumulative stacked value for stacked mode. Absent for non-stacked. */
  stackValue?: number;
};
```

In `resolveHoverInfo()`:
```typescript
const yValue = Number(entry.row[this.cachedYField]) || 0;
const meta: ChartHitMeta = {
  kind: 'area',
  seriesLabel: this.cachedSeries[entry.seriesIndex]?.label
    ?? this.cachedSeries[entry.seriesIndex]?.field
    ?? `Series ${entry.seriesIndex}`,
  yValue,
  stackValue: entry.stackValue,
};
```
The renderer must store `stackValue` (the cumulative top value at this data point) in its hitMap during `update()` for stacked mode.

---

### 7.5 `ScatterRenderer.ts`

```typescript
const meta: ChartHitMeta = {
  kind: 'scatter',
  xValue:     Number(entry.row[this.cachedXField ?? '']) || 0,
  sizeValue:  this.cachedSizeField ? (Number(entry.row[this.cachedSizeField]) || undefined) : undefined,
  colorValue: this.cachedColorField ? entry.row[this.cachedColorField] as number | string | undefined : undefined,
};
return {
  ...,
  meta,
  projectionTarget: [yAxisWorldX, p.y, p.z], // Y-axis projection only
};
```

Cache `cachedXField`, `cachedSizeField`, `cachedColorField` from `ctx.xAxis?.field`, `ctx.typeOptions.options.sizeField`, `ctx.typeOptions.options.colorField`.

---

### 7.6 `PieRenderer.ts`

```typescript
// Cache per-slice data in hitMap:
type PieHitEntry = {
  seriesIndex: number; datumIndex: number; row: Record<string, unknown>;
  sliceName: string; percentage: number; total: number;
};
// Compute at build time: total = sum of all slice values; percentage = value/total * 100

const meta: ChartHitMeta = {
  kind: 'pie',
  sliceName:  entry.sliceName,
  percentage: entry.percentage,
  total:      entry.total,
};
return {
  seriesIndex: entry.seriesIndex,
  datumIndex:  entry.datumIndex,
  row:         entry.row,
  point:       [p.x, p.y, p.z],
  meta,
  // No projectionTarget for pie — undefined
};
```

---

### 7.7 `HeatmapRenderer.ts`

```typescript
// Cache per-cell data in hitMap:
type HeatmapHitEntry = {
  seriesIndex: number; datumIndex: number; row: Record<string, unknown>;
  intensity: number; rowLabel: string; columnLabel: string;
};

const meta: ChartHitMeta = {
  kind: 'heatmap',
  intensity:   entry.intensity,
  rowLabel:    entry.rowLabel,
  columnLabel: entry.columnLabel,
};
return {
  seriesIndex: entry.seriesIndex,
  datumIndex:  entry.datumIndex,
  row:         entry.row,
  point:       [p.x, p.y, p.z],
  meta,
  // No projectionTarget for heatmap — undefined
};
```

---

### 7.8 Stream D Tests

Each renderer test file gets a new describe group `'resolveHoverInfo: meta + projectionTarget'`. Below is the **complete reference implementation for BarRenderer** — apply the same pattern to the other 5 renderers with appropriate meta fields.

```typescript
// Add inside BarRenderer.test.ts — uses the existing THREE mock and makeCtx() helpers

describe('resolveHoverInfo: meta + projectionTarget', () => {
  /**
   * Helper: call update() with known chartPosition + plotFrameOffset, then call
   * resolveHoverInfo() with a synthetic THREE.Intersection against the first bar mesh.
   *
   * chartPosition = [1.0, 0, 0], plotFrameOffset.x = 0.5
   * → Y-axis world X = 1.0 + 0.5 = 1.5
   */
  function renderAndResolve(
    data: ResolvedDataFrame,
    overrides: Partial<ChartRenderContext> = {},
  ): import('../../../renderers/shared/IChartRenderer').ChartHitInfo | null {
    const renderer = new BarRenderer();
    const groups = {
      seriesGroup: new THREE.Group(),
      axesGroup: new THREE.Group(),
      legendGroup: new THREE.Group(),
    };
    renderer.update({
      ...makeCtx(data, groups),
      chartPosition: [1.0, 0, 0],
      plotFrameOffset: { x: 0.5, y: 0 },
      ...overrides,
    });
    const meshes = renderer.getInteractiveObjects() as THREE.Mesh[];
    if (meshes.length === 0) return null;

    // Construct a minimal THREE.Intersection for the first mesh
    const hitPoint = new THREE.Vector3(2.0, 0.8, -0.12);
    const intersection: THREE.Intersection = {
      object: meshes[0]!,
      point: hitPoint,
      distance: 5,
    } as THREE.Intersection;

    return renderer.resolveHoverInfo(intersection, data);
  }

  it('grouped bar: meta.kind = "bar"', () => {
    const result = renderAndResolve(twoRowData);
    expect(result?.meta?.kind).toBe('bar');
  });

  it('grouped bar: meta.seriesLabel = series[0].label', () => {
    const result = renderAndResolve(twoRowData);
    // Default series label from makeCtx: 'Revenue'
    if (result?.meta?.kind !== 'bar') throw new Error('expected bar meta');
    expect(result.meta.seriesLabel).toBe('Revenue');
  });

  it('grouped bar: meta.segmentValue = numeric value for that series + datum', () => {
    const data: ResolvedDataFrame = {
      rows: [{ month: 'Jan', revenue: 120, costs: 80 }],
      fields: ['month', 'revenue', 'costs'],
    };
    const result = renderAndResolve(data);
    if (result?.meta?.kind !== 'bar') throw new Error('expected bar meta');
    expect(result.meta.segmentValue).toBe(120);
  });

  it('grouped bar: meta.stackTotal is undefined', () => {
    const result = renderAndResolve(twoRowData);
    if (result?.meta?.kind !== 'bar') throw new Error('expected bar meta');
    expect(result.meta.stackTotal).toBeUndefined();
  });

  it('stacked bar: meta.stackTotal = sum of all series for that datum', () => {
    const data: ResolvedDataFrame = {
      rows: [{ month: 'Jan', revenue: 120, costs: 80 }],
      fields: ['month', 'revenue', 'costs'],
    };
    const result = renderAndResolve(data, {
      typeOptions: { kind: 'bar', options: { stackMode: 'stacked' } },
    });
    if (result?.meta?.kind !== 'bar') throw new Error('expected bar meta');
    // stackTotal = 120 + 80 = 200
    expect(result.meta.stackTotal).toBe(200);
  });

  it('projectionTarget[0] = chartPositionX + plotFrameOffsetX = 1.5', () => {
    const result = renderAndResolve(twoRowData);
    expect(result?.projectionTarget?.[0]).toBeCloseTo(1.5, 5);
  });

  it('projectionTarget[1] = hit point Y', () => {
    const result = renderAndResolve(twoRowData);
    // hit point Y = 0.8 (from hitPoint in renderAndResolve)
    expect(result?.projectionTarget?.[1]).toBeCloseTo(0.8, 5);
  });

  it('projectionTarget[2] = hit point Z', () => {
    const result = renderAndResolve(twoRowData);
    expect(result?.projectionTarget?.[2]).toBeCloseTo(-0.12, 5);
  });
});
```

**Pattern for other renderers:**
- `LineRenderer`: same setup; assert `meta.kind === 'line'`, `meta.seriesLabel`, `meta.yValue`. `projectionTarget` present.
- `AreaRenderer`: assert `meta.kind === 'area'`, `meta.yValue`. `projectionTarget` present. For stacked mode, assert `meta.stackValue`.
- `ScatterRenderer`: assert `meta.kind === 'scatter'`, `meta.xValue`. `projectionTarget` present.
- `PieRenderer`: assert `meta.kind === 'pie'`, `meta.sliceName`, `meta.percentage`, `meta.total`. `projectionTarget` is **undefined**.
- `HeatmapRenderer`: assert `meta.kind === 'heatmap'`, `meta.intensity`, `meta.rowLabel`, `meta.columnLabel`. `projectionTarget` is **undefined**.

**Key setup note for all renderers:** `plotFrameOffset` must be passed to the `update()` call in the test setup, or `resolveHoverInfo()` will compute `projectionTarget[0]` as `0 + 0 = 0`. Always use an explicit non-zero `chartPosition` and `plotFrameOffset` in projection tests to verify the computation.

---

## 8. Stream E: Integration

**Prerequisite:** Streams B, C, and D all merged.
**Owner:** 1 developer.

This stream wires all the new modules together into the final product.

---

### 8.1 Modify: `packages/charts/src/elements/chart/types.ts`

**Add `ChartTooltipDSL` type** (at the bottom of the DSL prop types section):
```typescript
/** DSL props for <ChartTooltip> child component. */
export type ChartTooltipDSL = {
  /** Enable Y-axis projection beam. Default: false. */
  readonly projection?: boolean;
  /**
   * d3-format string for Y values in the tooltip.
   * @default '.3~s'
   */
  readonly format?: string;
};
```

**Modify `ChartState`:** Add `tooltip` field (after `animationDuration`):
```typescript
  /**
   * Compiled tooltip configuration. Non-null when <ChartTooltip> is a DSL child.
   * Null when no <ChartTooltip> child is present.
   */
  readonly tooltip: import('./tooltip/types').ChartTooltipState | null;
```

**Modify `DEFAULT_CHART_STATE`:**
```typescript
  tooltip: null,
```

---

### 8.2 Modify: `packages/charts/src/elements/chart/dsl.tsx`

Add `ChartTooltipProps`:
```typescript
/** Props for the <ChartTooltip> DSL child component. */
export type ChartTooltipProps = {
  /** Enable Y-axis projection beam. Default: false. */
  readonly projection?: boolean;
  /** d3-format string for Y values. Default: '.3~s'. */
  readonly format?: string;
};
```

---

### 8.3 Modify: `packages/charts/src/elements/chart/stubs.ts`

Import `ChartTooltipProps` from `./dsl` and add:
```typescript
import type { ..., ChartTooltipProps } from './dsl';

/** DSL stub for tooltip configuration within a chart element. */
export function ChartTooltip(_props: ChartTooltipProps): null { return null; }
ChartTooltip.displayName = 'ChartTooltip';
```

---

### 8.4 Modify: `packages/charts/src/elements/chart/compile.ts`

**Add `compileTooltipDsl()`:**
```typescript
import type { ChartTooltipState } from './tooltip/types';
import type { ChartTooltipDSL } from './types';

/**
 * Compiles ChartTooltipDSL to ChartTooltipState.
 * Returns null when dsl is null (no <ChartTooltip> child present).
 */
export function compileTooltipDsl(dsl: ChartTooltipDSL | null): ChartTooltipState | null {
  if (!dsl) return null;
  return {
    projection: dsl.projection ?? false,
    format: dsl.format,
  };
}
```

**Update `compileChart()` signature:**
```typescript
export function compileChart(
  dsl: BaseChartDSL,
  kind: ChartType,
  typeOptions: ChartTypeOptions,
  dataDsl: ChartDataDSL | null,
  axisDsls: readonly ChartAxisDSL[],
  seriesDsls: readonly ChartSeriesDSL[],
  legendDsl: ChartLegendDSL | null,
  dataLabelsDsl: ChartDataLabelsDSL | null,
  referenceLineDsls: readonly ReferenceLineDSL[],
  tooltipDsl: ChartTooltipDSL | null,  // NEW parameter — last to preserve backward compat
): ChartState
```

In the return value, add:
```typescript
    tooltip: compileTooltipDsl(tooltipDsl),
```

---

### 8.5 Modify: `packages/charts/src/elements/chart/render.ts`

**1. Import `ChartProjectionRenderer`:**
```typescript
import { ChartProjectionRenderer, DEFAULT_PROJECTION_TOKENS } from './projection/ChartProjectionRenderer';
```

**2. Import `resolveChartTheme`:**
```typescript
import { resolveChartTheme } from '../../themes/resolveTheme';
```

**3. Replace `THEME_MAP` with `resolveChartTheme()`.** Remove the inline `THEME_MAP` constant. In `update()`, replace:
```typescript
const effectiveTheme: ChartTheme =
  typeof state.theme === 'string'
    ? (THEME_MAP[state.theme as ChartThemeName] ?? darkGlassChartTheme)
    : state.theme;
```
with:
```typescript
const effectiveTheme = resolveChartTheme(state.theme);
```
Remove the six individual theme imports that were used only by `THEME_MAP`. Keep `darkGlassChartTheme` import for the `updateHeatmapSlice()` fallback.

**4. Add `projectionRenderer` field:**
```typescript
private readonly projectionRenderer: ChartProjectionRenderer;
```

**5. Update constructor:**
```typescript
constructor(private readonly store: ChartDataStore) {
  this.chartGroup.add(this.seriesGroup, this.axesGroup, this.legendGroup);
  this.projectionRenderer = new ChartProjectionRenderer(this.chartGroup);
}
```

**6. Add `updateProjection()` method:**
```typescript
/**
 * Updates the Y-axis projection beam for a hover event.
 * Called by ChartWidget immediately on hover change.
 * Null info starts the exit animation.
 */
updateProjection(info: ChartHitInfo | null, theme: ChartTheme): void {
  const tokens = theme.projection ?? DEFAULT_PROJECTION_TOKENS;
  this.projectionRenderer.updateProjection(info, tokens);
}
```

**7. Add `tickProjection()` method:**
```typescript
/**
 * Advances projection beam animation. Called every frame by ChartWidget.onTick().
 */
tickProjection(theme: ChartTheme): void {
  const tokens = theme.projection ?? DEFAULT_PROJECTION_TOKENS;
  this.projectionRenderer.tick(tokens);
}
```

**8. Pass `plotFrameOffset` to renderer in `update()`:**
After `this.lastLayout = layout;`, add to the `this.activeRenderer.update({ ... })` call:
```typescript
      plotFrameOffset: { x: layout.plotFrame.x, y: layout.plotFrame.y },
```

**9. Update `dispose()`:**
```typescript
dispose(scene: THREE.Scene): void {
  this.activeRenderer?.dispose();
  this.activeRenderer = null;
  this.projectionRenderer.dispose();  // NEW
  this.clearGroups();
  scene.remove(this.chartGroup);
}
```

**10. Update `ChartRendererLike` type** (in `ChartWidget.ts`):
```typescript
type ChartRendererLike = Pick<
  ChartRenderer,
  'mount' | 'update' | 'dispose' | 'updateHeatmapSlice' |
  'getInteractiveObjects' | 'resolveHoverInfo' |
  'updateProjection' | 'tickProjection'  // NEW
>;
```

---

### 8.6 Modify: `packages/charts/src/elements/chart/ChartWidget.ts`

**1. Import new modules:**
```typescript
import { chartTooltipStore } from './tooltip/ChartTooltipStore';
import { resolveChartTheme } from '../../themes/resolveTheme';
import { darkGlassChartTheme } from '../../themes/darkGlass';
import { projectNdcToNvsPixels } from './tooltip/projectUtils';
import * as THREE from 'three'; // already imported
```

**2. Add private fields:**
```typescript
/** Cached resolved ChartTheme from last apply() — used by hover handlers and onTick(). */
private lastEffectiveTheme: ChartTheme | null = null;
/** Cached tooltip state from last apply() — controls projection opt-in. */
private lastTooltipState: ChartTooltipState | null = null;
```

**3. In `apply()`**, after `this.lastState = state;`:
```typescript
this.lastEffectiveTheme = resolveChartTheme(state.theme);
this.lastTooltipState   = state.tooltip ?? null;
```

**4. Update `handleMouseMove()`:**

Note: `chartTooltipStore.publish()` is gated on `this.lastTooltipState` — this prevents the dev-mode warning from firing for any chart using `interactive=true` without `<ChartTooltip>`.

```typescript
private handleMouseMove(e: MouseEvent, dom: HTMLElement): void {
  const info = this.raycast(e, dom);
  const theme = this.lastEffectiveTheme ?? darkGlassChartTheme;

  if (info) {
    // Only publish to tooltip store when <ChartTooltip> is present in DSL
    if (this.lastTooltipState) {
      const { x, y } = this.projectHitPoint(info.point, dom);
      chartTooltipStore.publish(
        this.widgetId, x, y, info, theme.tooltip ?? null, this.lastTooltipState.format,
      );
    }
    // Update projection beam if explicitly enabled
    if (this.lastTooltipState?.projection) {
      this.chartRenderer.updateProjection(info, theme);
    }
  } else {
    // Clear tooltip store only if we were publishing to it
    if (this.lastTooltipState) {
      chartTooltipStore.clear(this.widgetId);
    }
    if (this.lastTooltipState?.projection) {
      this.chartRenderer.updateProjection(null, theme);
    }
  }

  // Backward-compat: still call onHover callback
  this.onHover?.(info);
}
```

**5. Update `mouseleaveListener` in `attachDomListeners()`:**
```typescript
this.mouseleaveListener = () => {
  // Guard on lastTooltipState — same rule as handleMouseMove
  if (this.lastTooltipState) {
    chartTooltipStore.clear(this.widgetId);
  }
  if (this.lastTooltipState?.projection) {
    this.chartRenderer.updateProjection(null, this.lastEffectiveTheme ?? darkGlassChartTheme);
  }
  this.onHover?.(null);
};
```

**6. Add `projectHitPoint()` private helper:**
```typescript
private projectHitPoint(
  point: readonly [number, number, number],
  dom: HTMLElement,
): { x: number; y: number } {
  const camera = this.camera;
  if (!camera) return { x: 0, y: 0 };

  const worldPoint = new THREE.Vector3(point[0], point[1], point[2]);
  worldPoint.project(camera);

  return projectNdcToNvsPixels(
    worldPoint.x,
    worldPoint.y,
    dom.offsetWidth,
    dom.offsetHeight,
    this.nvsBounds,
  );
}
```

**7. Update `onTick()`** — add projection tick after existing logic:
```typescript
onTick(ctx: AnimationTickContext): void {
  if (!this.lastState) return;
  const state = this.lastState;

  // ... existing entry animation + heatmap logic unchanged ...

  // NEW: tick projection beam animation every frame
  if (this.lastEffectiveTheme) {
    this.chartRenderer.tickProjection(this.lastEffectiveTheme);
  }
}
```

**8. Update `dispose()`** — clear tooltip store on dispose:
```typescript
dispose(): void {
  chartTooltipStore.clear(this.widgetId);  // NEW — clean up tooltip entry
  this.unsubscribeDeregister();
  this.detachDomListeners();
  if (this.scene) {
    this.chartRenderer.dispose(this.scene);
    this.scene = null;
  }
  this.camera = null;
  this.lastCoords = null;
  this.lastInlineRowsRef = null;
  this.lastEffectiveTheme = null;
  this.lastTooltipState = null;
}
```

**9. Add `ChartTooltip` to `childDslComponents`:**
```typescript
import { ChartTooltip } from './stubs';

// In readonly childDslComponents array, add:
{ component: ChartTooltip as React.ComponentType<unknown>, displayName: 'ChartTooltip' },
```

---

### 8.7 New File: `packages/charts/src/elements/chart/tooltip/projectUtils.ts`

Extract `projectNdcToNvsPixels` from `ChartTooltipOverlay.tsx` to avoid duplication:

```typescript
// projectUtils — 3D world → 2D screen coordinate projection utilities.

import type { NVSRect } from '@brewsite/core';

/**
 * Projects NDC coordinates to pixel offsets within the NVS sub-region of
 * the AR-locked container.
 * Extracted from ChartTooltipOverlay.tsx — shared with ChartWidget.
 */
export function projectNdcToNvsPixels(
  ndcX: number,
  ndcY: number,
  containerW: number,
  containerH: number,
  nvsBounds: NVSRect,
): { x: number; y: number } {
  const regionX = nvsBounds.x * containerW;
  const regionY = nvsBounds.y * containerH;
  const regionW = nvsBounds.w * containerW;
  const regionH = nvsBounds.h * containerH;

  return {
    x: regionX + ((ndcX + 1) / 2) * regionW,
    y: regionY + ((-ndcY + 1) / 2) * regionH,
  };
}
```

Update `ChartTooltipOverlay.tsx` to import `projectNdcToNvsPixels` from `../elements/chart/tooltip/projectUtils` and remove the duplicate local definition. Keep the existing JSDoc on the deprecated component.

---

### 8.8 Modify: `packages/charts/src/player/chartPlugin.ts`

**1. Import new stubs and types:**
```typescript
import { ..., ChartTooltip } from '../elements/chart/stubs';
import type { ..., ChartTooltipDSL } from '../elements/chart/types';
import { ..., compileTooltipDsl } from '../elements/chart/compile';
```

**2. Update `extractChartChildren()` return type and logic:**
```typescript
function extractChartChildren(children: unknown[]): {
  dataDsl: ChartDataDSL | null;
  axisDsls: ChartAxisDSL[];
  seriesDsls: ChartSeriesDSL[];
  legendDsl: ChartLegendDSL | null;
  dataLabelsDsl: ChartDataLabelsDSL | null;
  referenceLineDsls: ReferenceLineDSL[];
  tooltipDsl: ChartTooltipDSL | null;   // NEW
} {
  // ... existing init ...
  let tooltipDsl: ChartTooltipDSL | null = null;

  for (const child of children) {
    // ... existing cases ...
    else if (el.type === ChartTooltip) tooltipDsl = el.props as ChartTooltipDSL;
  }

  return { ..., tooltipDsl };
}
```

**3. Update all 6 NodeHandler registrations** to destructure `tooltipDsl` and pass it to `compileChart()`:
```typescript
const { dataDsl, axisDsls, seriesDsls, legendDsl, dataLabelsDsl, referenceLineDsls, tooltipDsl } =
  extractChartChildren(children);

const state = compileChart(
  props, 'bar', typeOptions, dataDsl, axisDsls, seriesDsls,
  legendDsl, dataLabelsDsl, referenceLineDsls,
  tooltipDsl,  // NEW — last argument
);
```

---

### 8.9 Modify: `packages/charts/src/player/ChartTooltipOverlay.tsx`

Add deprecation JSDoc to the `ChartTooltipOverlay` function and types:

```typescript
/**
 * @deprecated Since v2.2. Use `<ChartTooltip>` inside the chart DSL and
 * `<ChartTooltipHost>` inside EngineOverlayHost instead.
 * This component will be **removed in the next minor version**.
 *
 * Migration:
 * ```tsx
 * // Before:
 * <ChartTooltipOverlay widget={someWidget} nvsBounds={{ x: 0, y: 0, w: 1, h: 1 }} />
 * // After:
 * // In DSL:  <BarChart id="revenue" interactive><ChartTooltip /></BarChart>
 * // In overlay: <EngineOverlayHost><ChartTooltipHost /></EngineOverlayHost>
 * ```
 */
export function ChartTooltipOverlay(...
```

Also update `ChartTooltipOverlayProps`:
```typescript
/**
 * @deprecated Since v2.2. See ChartTooltipOverlay deprecation notice.
 */
export type ChartTooltipOverlayProps = { ... };
```

Update `projectNdcToNvsPixels` to import from `projectUtils`:
```typescript
export { projectNdcToNvsPixels } from '../elements/chart/tooltip/projectUtils';
```

---

### 8.10 Modify: `packages/charts/src/index.ts`

**Add exports:**
```typescript
// ─── Tooltip system (new in v2.2) ─────────────────────────────────────────────

// DSL component
export { ChartTooltip } from './elements/chart/stubs';
export type { ChartTooltipProps } from './elements/chart/dsl';

// Types
export type { ChartTooltipState, ChartTooltipRuntimeConfig } from './elements/chart/tooltip/types';

// Store hook (read-only consumer surface — chartTooltipStore singleton is NOT exported)
export { useChartTooltip } from './elements/chart/tooltip/ChartTooltipStore';
export type { ChartTooltipEntry } from './elements/chart/tooltip/ChartTooltipStore';
export { useChartTooltipConfig } from './elements/chart/tooltip/useChartTooltipConfig';

// Host component
export { ChartTooltipHost } from './elements/chart/tooltip/ChartTooltipHost';

// Theme token types (add to existing theme types export block)
export type {
  ...,  // existing
  ChartTooltipTokens,
  ChartProjectionTokens,
} from './themes/types';

// Projection (internal utility — NOT exported; ChartProjectionRenderer is private to render layer)
// resolveChartTheme IS exported for consumers who build custom themes:
export { resolveChartTheme } from './themes/resolveTheme';
```

**Update `ChartHitInfo` re-export to include `ChartHitMeta`:**
```typescript
// In ─── Renderer shared types section, add:
export type { FittedMargins, ChartAccessorFunctions, ChartHitInfo, ChartHitMeta } from './renderers/shared/IChartRenderer';
```

---

### 8.11 Example App Updates (launch criterion)

**Assigned to Stream E developer as final step after integration wiring.**

**File: `apps/examples/src/chart/scenes/scene1-bar-morph.tsx`**
Add `<ChartTooltip projection />` as a child of the existing `<BarChart>`:
```tsx
<BarChart id="revenue" interactive>
  {/* ... existing children ... */}
  <ChartTooltip projection />
</BarChart>
```

**File: `apps/examples/src/chart/scenes/scene3-multiline.tsx`**
Add `<ChartTooltip />` (no projection — line chart):
```tsx
<LineChart id="trends" interactive>
  {/* ... existing children ... */}
  <ChartTooltip />
</LineChart>
```

**File: `apps/examples/src/chart/ChartDemoPage.tsx`**
Add `<ChartTooltipHost />` inside the existing `EngineOverlayHost`:
```tsx
import { ChartTooltipHost } from '@brewsite/charts';
// ...
<EngineOverlayHost>
  <ChartTooltipHost />
  {/* any existing overlay children */}
</EngineOverlayHost>
```

Import `ChartTooltip` from `@brewsite/charts` in the scene files.

---

### 8.13 Tests: `compile.test.ts` — extend

Add a new describe group:
```typescript
describe('compileTooltipDsl', () => {
  it('null input → null output', () => {
    expect(compileTooltipDsl(null)).toBeNull();
  });

  it('empty object → projection=false, format=undefined', () => {
    expect(compileTooltipDsl({})).toEqual({ projection: false, format: undefined });
  });

  it('projection=true, format=".2f" → compiles verbatim', () => {
    expect(compileTooltipDsl({ projection: true, format: '.2f' })).toEqual({
      projection: true,
      format: '.2f',
    });
  });
});

describe('compileChart: tooltip field', () => {
  it('no tooltip child → state.tooltip is null', () => {
    const state = compileChart(
      baseDsl({ id: 'test' }), 'bar', barTypeOptions,
      null, [], [], null, null, [],
      null, // tooltipDsl
    );
    expect(state.tooltip).toBeNull();
  });

  it('<ChartTooltip projection> → state.tooltip.projection is true', () => {
    const state = compileChart(
      baseDsl({ id: 'test' }), 'bar', barTypeOptions,
      null, [], [], null, null, [],
      { projection: true }, // tooltipDsl
    );
    expect(state.tooltip?.projection).toBe(true);
  });
});
```

---

## 9. Dependency Graph (Final Validation)

```
Stream A: types + theme tokens
  Files touched: tooltip/types.ts (NEW), themes/resolveTheme.ts (NEW),
                 themes/types.ts, 12 theme files, IChartRenderer.ts
  Output: all type contracts + theme tokens locked
  ↓ unblocks B, C, D (parallel)

Stream B: tooltip store + host             (depends: A)
  Files touched: tooltip/ChartTooltipStore.ts (NEW),
                 tooltip/useChartTooltipConfig.ts (NEW),
                 tooltip/ChartTooltipHost.tsx (NEW),
                 tooltip/__tests__/*.ts (NEW)
  No overlap with C or D.

Stream C: projection renderer              (depends: A)
  Files touched: projection/ChartProjectionRenderer.ts (NEW),
                 projection/__tests__/*.ts (NEW)
  No overlap with B or D.

Stream D: renderer enrichment              (depends: A)
  Files touched: 6 renderer *.ts files, 6 renderer test files
  No overlap with B or C.

Stream E: integration                      (depends: B + C + D)
  Files touched: elements/chart/types.ts, dsl.tsx, stubs.ts,
                 compile.ts, render.ts, ChartWidget.ts,
                 tooltip/projectUtils.ts (NEW),
                 player/chartPlugin.ts,
                 player/ChartTooltipOverlay.tsx,
                 index.ts,
                 compile.test.ts (extend),
                 apps/examples/src/chart/scenes/scene1-bar-morph.tsx,
                 apps/examples/src/chart/scenes/scene3-multiline.tsx,
                 apps/examples/src/chart/ChartDemoPage.tsx
```

**Critical path:** A → (B|C|D in parallel) → E

Minimum calendar time with 5 developers: 2 sequential steps (A first, then E after B+C+D merge).

---

## 10. TypeScript Strict Mode Compliance

All new code must pass `pnpm --filter @brewsite/charts typecheck` with `strict: true`. Specific requirements:

- No `any` in any new file. `unknown` may appear only in `ChartTooltipRuntimeConfig.renderContent` return and `ChartHitMeta` meta values, with justification comments.
- All exported function signatures have explicit return types.
- All exported interfaces/types have JSDoc comments explaining the contract.
- The `ChartHitMeta` discriminated union must be exhaustive — `resolveHoverInfo()` must handle every case or return `undefined` meta for unrecognized states.
- `process.env.NODE_ENV` guards around dev-only warnings (`console.warn`).

---

## 11. Launch Criteria Mapping

| Criterion | Stream |
|-----------|--------|
| `<ChartTooltip>` DSL child compiles to `ChartState.tooltip` | E |
| `ChartTooltipRuntimeConfig` type exported; `useChartTooltipConfig()` hook exported | E |
| All 6 renderers return `ChartHitInfo` with `meta` populated | D |
| Bar/line/area/scatter populate `projectionTarget`; pie/heatmap do not | D |
| `ChartProjectionRenderer` renders beam + landing dot | C |
| Entrance (220ms ease-out-expo) and exit (160ms fade) animations correct | C |
| Hover-change snaps to new position and restarts entrance animation | C |
| `<ChartTooltipHost />` renders type-aware rich tooltip for all 6 chart types | B |
| Tooltip anchored to 3D hit point; edge-flip at 16px canvas boundary | B + E |
| All 12 preset themes have explicit `tooltip` and `projection` tokens | A |
| `ChartTooltipOverlay` carries `@deprecated` JSDoc | E |
| All new types exported from `packages/charts/src/index.ts` | E |
| `ChartProjectionRenderer` tests use `getNow` injection | C |
| TypeScript strict mode passes | All |
| Updated example in `apps/examples/src/chart/` demonstrates tooltip + projection on ≥2 chart types | E (§8.11) |

---

## 12. Example Usage (Consumer Reference)

```tsx
// Minimum viable — tooltip with projection enabled:
<BarChart id="revenue" interactive>
  <ChartData source="revenueData" />
  <ChartAxis axis="x" field="month" />
  <ChartAxis axis="y" field="revenue" />
  <ChartTooltip projection />
</BarChart>

// In EngineOverlayHost (once per engine, not per chart):
<EngineOverlayHost>
  <ChartTooltipHost />
</EngineOverlayHost>

// Custom tooltip content:
const renderRevenue = useCallback(
  (info: ChartHitInfo) => <MyTooltip info={info} />,
  [],
);
useChartTooltipConfig('revenue', { renderContent: renderRevenue });
```

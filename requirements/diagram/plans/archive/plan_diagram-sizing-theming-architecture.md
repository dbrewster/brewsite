---
title: "Diagram Element: Sizing, Theming, and Architecture Implementation Plan"
doc_type: plan
owner: engineering
status: complete
updated: 2026-03-08
---

# Diagram Element: Sizing, Theming, and Architecture

## Overview

Implements all action items from `requirements/diagram/notes/note_diagram-sizing-theming-architecture.md`. Three problem areas: sizing/spacing constant correctness, theme completeness, and architectural cleanup. **No backward compatibility** — replaced APIs are deleted outright. No `@deprecated` markers, no aliases, no migration stubs.

---

## Dependency Graph

```
PR1: Stream A (constants) + Stream B (edge routing) + Stream X (dead code: geometry, groupConstants)
     — no type changes, fully self-contained

PR2: Stream C (types.ts expansion + package root index fixes) + Stream D (theme presets)
     — must land together: new required fields on interfaces break presets until both are updated

PR3: Stream E (compiler layer: themeResolver, nodeCompiler, groupCompiler)
     — needs PR2 types

PR4: Stream F (renderer layer: NodeRenderer, EdgeRenderer, GroupRenderer)
     — needs PR3 compiler output

PR5: Stream H (DiagramRenderer constructor architecture, TextRenderer removal)
     — needs PR4 (EdgeRenderer constructor signature changes)
```

No stream within a PR may conflict with another stream in the same PR. File-level conflicts are flagged per stream.

---

## Stream A — Shared Constants Centralization

**Addresses**: Note §4.1, action items 3, 6, 12.

### New file: `elements/diagram/compiler/diagramLayoutConstants.ts`

```typescript
// Canonical source for diagram layout constants shared across compiler modules.
// Import from here — never redefine locally.

/** Default node size in diagram units. Used by auto-layout algorithms and nodeCompiler. */
export const DEFAULT_NODE_SIZE: readonly [number, number] = [4, 2];

/**
 * Default group padding for auto-layout in diagram units [top, right, bottom, left].
 * After normalizeToViewport() this becomes ~7.5–15% NVS per side depending on layout span.
 */
export const DEFAULT_GROUP_PADDING: readonly [number, number, number, number] = [1.5, 1.5, 1.5, 1.5];

/** Default title gap for auto-layout in diagram units. */
export const DEFAULT_TITLE_GAP: number = 1;

/** Default group padding for ManualLayout in [0..1] NVS fractions [top, right, bottom, left]. */
export const DEFAULT_MANUAL_GROUP_PADDING: readonly [number, number, number, number] = [0.025, 0.025, 0.025, 0.025];

/** Default title gap for ManualLayout in [0..1] NVS fractions. */
export const DEFAULT_MANUAL_TITLE_GAP: number = 0.025;
```

### New file: `elements/diagram/compiler/diagramRenderConstants.ts`

```typescript
// Constants that must be identical across the compile layer and the render layer.
// The compiler uses these to compute edge routing positions around groups;
// the renderer uses them to lay out group geometry. Both must always use the same values.

/** Converts "border width in display units" (theme value) to canvas-world border width. */
export const GROUP_BORDER_PX_TO_UNITS: number = 0.4;

/** Z-coordinate at which group planes are positioned in canvas-local space. */
export const GROUP_RENDER_Z: number = -0.6;
```

### Modified: `elements/diagram/compiler/layoutAlgorithms.ts`

Add import at top:
```typescript
import { DEFAULT_NODE_SIZE } from './diagramLayoutConstants';
```

Remove the function-local declaration inside `resolveFlowLayout()`:
```typescript
// DELETE this line (currently line 27, inside resolveFlowLayout):
const DEFAULT_NODE_SIZE: readonly [number, number] = [4, 2];
```

### Modified: `elements/diagram/compiler/layoutResolver.ts`

Add import at top:
```typescript
import {
  DEFAULT_GROUP_PADDING,
  DEFAULT_TITLE_GAP,
  DEFAULT_MANUAL_GROUP_PADDING,
  DEFAULT_MANUAL_TITLE_GAP,
} from './diagramLayoutConstants';
```

Remove four local constant declarations (lines 84, 87, 88, 90):
- `DEFAULT_GROUP_PADDING_NORMALIZED` → replaced by `DEFAULT_GROUP_PADDING`
- `DEFAULT_MANUAL_GROUP_PADDING` → same name, imported
- `DEFAULT_TITLE_GAP` → same name, imported
- `DEFAULT_MANUAL_TITLE_GAP` → same name, imported

Update all usages of `DEFAULT_GROUP_PADDING_NORMALIZED` → `DEFAULT_GROUP_PADDING` (same value).

`DEFAULT_GRID_SPACING`, `DEFAULT_HIERARCHICAL_SPACING`, `DEFAULT_MARGIN` remain local — not referenced externally.

### Modified: `elements/diagram/compiler/groupCompiler.ts`

Add imports:
```typescript
import { GROUP_BORDER_PX_TO_UNITS } from './diagramRenderConstants';
import { DEFAULT_GROUP_PADDING, DEFAULT_TITLE_GAP } from './diagramLayoutConstants';
```

Remove: `const GROUP_BORDER_PX_TO_UNITS = 0.4;` (line 48).

Fix the three fallback paths that silently use `titleGap: 0.75` instead of `DEFAULT_TITLE_GAP`:

```typescript
// Line 162 — cycle-detection fallback. Change:
{ x: 0, y: 0, w: 0, h: 0, padding: [1.5, 1.5, 1.5, 1.5] as const, titleGap: 0.75 }
// To:
{ x: 0, y: 0, w: 0, h: 0, padding: DEFAULT_GROUP_PADDING, titleGap: DEFAULT_TITLE_GAP }

// Line 167 — group-not-found fallback. Change:
{ x: 0, y: 0, w: 0, h: 0, padding: [1.5, 1.5, 1.5, 1.5], titleGap: 0.75 }
// To:
{ x: 0, y: 0, w: 0, h: 0, padding: DEFAULT_GROUP_PADDING, titleGap: DEFAULT_TITLE_GAP }

// Line 193 — layout fallback. Change:
const titleGap = gl?.titleGap ?? 0.75;
// To:
const titleGap = gl?.titleGap ?? DEFAULT_TITLE_GAP;
```

### Modified: `elements/diagram/compile.ts`

Add import:
```typescript
import { GROUP_BORDER_PX_TO_UNITS, GROUP_RENDER_Z } from './compiler/diagramRenderConstants';
```

Remove lines 32–34 (local declarations of `GROUP_BORDER_PX_TO_UNITS` and `GROUP_RENDER_Z`).

Fix line 301 literal:
```typescript
// Change:
normalizedPositions.set(groupId, [..., -0.6]);
// To:
normalizedPositions.set(groupId, [normBounds.x + normBounds.w / 2, normBounds.y + normBounds.h / 2, GROUP_RENDER_Z]);
```

### Modified: `elements/diagram/rendering/GroupRenderer.ts`

Add import:
```typescript
import { GROUP_BORDER_PX_TO_UNITS, GROUP_RENDER_Z } from '../compiler/diagramRenderConstants';
```

Remove: `private static readonly BORDER_PX_TO_UNITS = 0.4;` (line 10).

Replace all `GroupRenderer.BORDER_PX_TO_UNITS` → `GROUP_BORDER_PX_TO_UNITS`.

Fix line 148 literal:
```typescript
// Change:
entry.group.position.set(centerX, centerY, -0.6);
// To:
entry.group.position.set(centerX, centerY, GROUP_RENDER_Z);
```

### Deleted: `elements/diagram/compiler/groupConstants.ts`

Delete the file. Its sole export `DEFAULT_GROUP_PADDING = 1.5` has no active importers; the value is now canonical in `diagramLayoutConstants.ts`.

---

## Stream B — Edge Routing Constant Recalibration

**Addresses**: Note §2.3, action item 1. High priority — correctness fix.

**File**: `elements/diagram/compiler/edgeRouter.ts` only.

### Top-level constants (lines 26–31)

```typescript
// Before:
const EDGE_EPSILON = 0.06;
const MIN_PORT_PITCH = 0.35;
const OBSTACLE_PADDING = 0.2;

// After:
const EDGE_EPSILON = 0.012;    // was 0.06 — 6% NVS was too large for dense layouts
const MIN_PORT_PITCH = 0.05;   // was 0.35 — 35% NVS port pitch made multi-port faces impossible
const OBSTACLE_PADDING = 0.03; // was 0.20 — 20% NVS expanded every node obstacle by its full width
```

### `routeEdgeCurvedProfile()` — call to `routeCurvedWithEndpointNormals`

```typescript
// Before (lines 317–331):
return routeCurvedWithEndpointNormals(srcCenter, dstCenter, srcNormal, dstNormal, {
  epsilon: EDGE_EPSILON,
  handleMin: 0.35,
  handleMax: 4,
  handleFactor: 0.28,
  allowDirectSegment: !srcIsSide && !dstIsSide,
  directDistanceThreshold: 0.6,
  directAlignmentThreshold: 0.97,
  startPreferSide: renderProfile && srcIsSide,
  endPreferSide: renderProfile && dstIsSide,
  sideVerticalRatioThreshold: 0.3,
  sideVerticalBase: 0.45,
  sideVerticalFactor: 0.18,
  sideVerticalMax: 3.2,
  minSideHandle: renderProfile ? 0.95 : 0,
});

// After:
return routeCurvedWithEndpointNormals(srcCenter, dstCenter, srcNormal, dstNormal, {
  epsilon: EDGE_EPSILON,
  handleMin: 0.06,              // was 0.35 — removed oversized minimum Bézier handle
  handleMax: 1.5,               // was 4 — unreachable in [0..1] NVS; clarified upper bound
  handleFactor: 0.28,           // unchanged — scale-relative fraction of inter-node distance
  allowDirectSegment: !srcIsSide && !dstIsSide,
  directDistanceThreshold: 0.6,
  directAlignmentThreshold: 0.97,
  startPreferSide: renderProfile && srcIsSide,
  endPreferSide: renderProfile && dstIsSide,
  sideVerticalRatioThreshold: 0.3,
  sideVerticalBase: 0.45,
  sideVerticalFactor: 0.18,
  sideVerticalMax: 3.2,
  minSideHandle: renderProfile ? 0.12 : 0,  // was 0.95 — was forcing handles to 95% of NVS range
                                              // for all left/right face edges, regardless of node proximity
});
```

### `routeEdgeOrthogonal()` — `stub` local constant (line 392)

```typescript
// Before:
const stub = 0.8;
// After:
const stub = 0.12;  // was 0.8 — was extending stubs 80% of NVS range past adjacent nodes
```

**Validation requirement**: These values are the starting calibration derived from coordinate system analysis. After implementing, the developer must render 4-node, 10-node, and 20-node auto-layout diagrams with both curved and orthogonal routing and visually verify edges do not over-extend or collapse. Fine-tuning within ±40% of these values does not require a plan update.

---

## Stream X — Dead Code Deletion (PR1)

**Addresses**: Note §4.8, action items 4, 5, 6.

### `elements/diagram/shapes/geometryFactory.ts`

Delete `createRoundedBorderGeometry` (lines 146–160) and its export statement. `createShapeOutlineGeometry` is used everywhere; no callers of `createRoundedBorderGeometry` exist in the package.

Verify with: `grep -r "createRoundedBorderGeometry" packages/diagram/src/` before deleting — must return zero results outside `geometryFactory.ts` itself.

### `elements/diagram/compiler/groupConstants.ts`

Delete the file (already covered in Stream A).

---

## Stream C — Type System Expansion

**Addresses**: Note §3.1–3.6, action items 2, 7–11.
**Must land in same PR as Stream D** — all four theme objects become TypeScript errors until they supply the new required fields.

### File: `elements/diagram/types.ts`

#### `DiagramThemeNodeConfig` — remove `fontUrl`, add six new required fields

```typescript
export interface DiagramThemeNodeConfig {
  readonly defaultColor: string;
  readonly defaultMetalness: number;
  readonly defaultRoughness: number;
  readonly defaultEmissiveIntensity: number;
  readonly defaultThickness: number;
  readonly cornerRadius: number;
  readonly glowIntensity: number;
  readonly defaultLabelColor: string;
  readonly defaultSublabelColor: string;
  readonly labelSizeFactor: number;
  readonly sublabelSizeFactor: number;
  readonly defaultIconStyle: DiagramIconVariant;
  // fontUrl is REMOVED from here — use DiagramTheme.fontUrl instead.
  /** Default 3D icon extrusion depth in canvas world units. Per-node iconDepth overrides this. */
  readonly defaultIconDepth: number;
  /** Glow sprite spread multiplier relative to node width and height. Larger = wider halo. */
  readonly glowSpread: number;
  /**
   * Addend passed to deriveColor() when computing the auto-derived side-face color from the
   * front-face color. Negative values darken. Range: typically -0.3 to 0.
   */
  readonly sideColorDarkenFactor: number;
  /**
   * Addend passed to deriveColor() when computing the auto-derived border color from the
   * front-face color. Positive values lighten. Range: typically 0 to 0.5.
   */
  readonly borderColorLightenFactor: number;
  /**
   * Base coefficient for node label font size.
   * Final size = contentH × labelFontSizeBase × labelSizeFactor × sceneTheme.fontSize.label.
   */
  readonly labelFontSizeBase: number;
  /**
   * Base coefficient for node sublabel font size.
   * Final size = contentH × sublabelFontSizeBase × sublabelSizeFactor × sceneTheme.fontSize.caption.
   */
  readonly sublabelFontSizeBase: number;
}
```

#### `DiagramThemeEdgeConfig` — add `flowPulseIntensity`

```typescript
export interface DiagramThemeEdgeConfig {
  readonly defaultColor: string;
  readonly defaultFlowColor?: string;
  readonly defaultFlowSpeed: number;
  readonly defaultFlowWidth: number;
  readonly defaultThickness: number;
  readonly defaultMetalness: number;
  readonly defaultRoughness: number;
  readonly routing: EdgeRoutingAlgorithm;
  readonly landing: EdgeLandingAlgorithm;
  readonly smoothness: number;
  readonly use3DArrows: boolean;
  /** Peak brightness multiplier applied to the flow pulse shader. Range: 0–2. Default: 0.9. */
  readonly flowPulseIntensity: number;
}
```

#### `DiagramThemeGroupConfig` — add five new required fields

```typescript
export interface DiagramThemeGroupConfig {
  readonly defaultColor: string;
  readonly defaultBorderColor: string;
  readonly defaultBorderWidth: number;
  readonly defaultBorderHeight: number;
  readonly defaultFillOpacity: number;
  readonly defaultBorderOpacity: number;
  readonly defaultBorderEmissiveColor?: string;
  readonly defaultBorderEmissiveIntensity?: number;
  /** Default color for group title label text. Propagated into DiagramGroupState.labelColor. */
  readonly defaultLabelColor: string;
  /** PBR metalness for group border frame meshes [0–1]. */
  readonly borderMetalness: number;
  /** PBR roughness for group border frame meshes [0–1]. */
  readonly borderRoughness: number;
  /**
   * Multiplier applied to borderColor when computing the side-face shade of the border
   * frame extrusion. Values below 1.0 darken. Typical range: 0.3–0.6.
   */
  readonly borderSideDarken: number;
  /**
   * Multiplier applied to borderColor when computing the edge-wire (LineSegments) color
   * on the border frame. Typical range: 0.3–0.6.
   */
  readonly borderEdgeDarken: number;
}
```

#### `DiagramTheme` — add root-level `fontUrl`

```typescript
export interface DiagramTheme {
  readonly node: DiagramThemeNodeConfig;
  readonly edge: DiagramThemeEdgeConfig;
  readonly group: DiagramThemeGroupConfig;
  readonly environment: DiagramThemeEnvironmentConfig;
  readonly layout?: DiagramThemeLayoutConfig;
  readonly palette?: readonly string[];
  readonly sceneTheme?: SceneTheme;
  /**
   * Custom troika font URL for all diagram text (nodes and groups).
   * Overrides sceneTheme.font.webglFontUrl when present.
   * Moved from DiagramThemeNodeConfig.fontUrl (which is deleted).
   */
  readonly fontUrl?: string;
}
```

#### `DiagramThemeRenderConfig` — add eight new fields

```typescript
export interface DiagramThemeRenderConfig {
  // ... all existing fields preserved ...
  /** Glow sprite spread multiplier. From theme.node.glowSpread. */
  readonly nodeGlowSpread: number;
  /** Peak brightness of the flow pulse animation. From theme.edge.flowPulseIntensity. */
  readonly edgeFlowPulseIntensity: number;
  /** Base font-size coefficient for node labels. From theme.node.labelFontSizeBase. */
  readonly nodeLabelFontSizeBase: number;
  /** Base font-size coefficient for node sublabels. From theme.node.sublabelFontSizeBase. */
  readonly nodeSublabelFontSizeBase: number;
  /** PBR metalness for group border frame. From theme.group.borderMetalness. */
  readonly groupBorderMetalness: number;
  /** PBR roughness for group border frame. From theme.group.borderRoughness. */
  readonly groupBorderRoughness: number;
  /** Side-face color darkening multiplier for group border extrusion. From theme.group.borderSideDarken. */
  readonly groupBorderSideDarken: number;
  /** Edge-wire color darkening multiplier for group border. From theme.group.borderEdgeDarken. */
  readonly groupBorderEdgeDarken: number;
}
```

Note: `groupDefaultLabelColor` is **not** added to `DiagramThemeRenderConfig`. It flows through `DiagramGroupState.labelColor` (see below). Renderers read it from per-group state.

#### `DiagramGroupState` — add `labelColor`

```typescript
export interface DiagramGroupState {
  // ... existing fields ...
  /**
   * Compiled group title label color.
   * From DiagramGroupDSL.labelColor ?? theme.group.defaultLabelColor.
   */
  readonly labelColor: string;
}
```

#### `DiagramGroupDSL` — add optional `labelColor` override

```typescript
export interface DiagramGroupDSL {
  // ... existing fields ...
  /** Per-group override for the title label text color. Falls back to theme.group.defaultLabelColor. */
  readonly labelColor?: string;
}
```

### File: `elements/diagram/dsl.tsx`

`DiagramGroupProps` is a separate interface from `DiagramGroupDSL`. Scene authors write JSX against `DiagramGroupProps`; without `labelColor` here, passing it to `<DiagramGroup>` is a TypeScript error.

Add to `DiagramGroupProps` after the `edgeLights` field (currently the last prop field before the children comment):

```typescript
export interface DiagramGroupProps {
  // ... all existing fields unchanged ...
  /** Optional point lights distributed clockwise around the group border. */
  edgeLights?: DiagramGroupEdgeLightsDSL;
  /** Per-group override for title label text color. Falls back to theme.group.defaultLabelColor. */
  labelColor?: string;
  // children...
}
```

No other changes to `dsl.tsx`.

### File: `packages/diagram/src/compiler/handlers.ts`

`collectGroup()` constructs each `DiagramGroupDSL` by explicitly extracting props. Without this change, `labelColor` is `undefined` at runtime regardless of what the scene author passed — silent data loss, no TypeScript error.

In `collectGroup()`, add `labelColor` extraction after `edgeLights` (currently line 146):

```typescript
groups.push({
  // ... all existing fields ...
  edgeLights:   elProps.edgeLights as DiagramGroupDSL['edgeLights'],
  labelColor:   elProps.labelColor as string | undefined,    // ADD THIS
  nodeIds,
  childGroupIds: childGroupIds.length > 0 ? childGroupIds : undefined,
  // ...
});
```

No other changes to `handlers.ts`.

#### Delete `DiagramPivot` type

Remove the type definition (lines 327–336). Remove its export from `elements/diagram/index.ts` (line 18) and from `src/index.ts` (line 20). No callers exist anywhere in the package — verified with `grep`.

### File: `elements/diagram/index.ts`

- Remove `DiagramPivot` from export list.
- No other changes needed; `DiagramGroupEdgeLightColorResolver`, `DiagramGroupEdgeLightState`, `DiagramGroupEdgeLightsState`, `DiagramGroupEdgeLightsDSL` are already exported from this file.

### File: `src/index.ts`

- Remove `DiagramPivot` from the export list.
- Add the five missing group edge light types that are already in `elements/diagram/index.ts` but absent from the package root:

```typescript
export type {
  DiagramGroupSide,
  DiagramGroupEdgeLightColorResolver,
  DiagramGroupEdgeLightState,
  DiagramGroupEdgeLightsState,
  DiagramGroupEdgeLightsDSL,
} from './elements/diagram/types';
```

---

## Stream D — Theme Preset Updates + mergeTheme Extension

**Must land in same PR as Stream C.**

### New field values per preset

| Field | darkGlass | enterprise | neonCyber | lightMinimal |
|---|---|---|---|---|
| `node.defaultIconDepth` | `0.15` | `0.15` | `0.15` | `0.10` |
| `node.glowSpread` | `2.2` | `2.2` | `2.2` | `2.2` |
| `node.sideColorDarkenFactor` | `-0.15` | `-0.15` | `-0.15` | `-0.10` |
| `node.borderColorLightenFactor` | `0.25` | `0.25` | `0.25` | `0.20` |
| `node.labelFontSizeBase` | `0.28` | `0.28` | `0.28` | `0.28` |
| `node.sublabelFontSizeBase` | `0.18` | `0.18` | `0.18` | `0.18` |
| `edge.flowPulseIntensity` | `0.9` | `0.9` | `0.9` | `0.9` |
| `group.defaultLabelColor` | `'#ffffff'` | `'#ffffff'` | `'#00ffcc'` | `'#1a2240'` |
| `group.borderMetalness` | `0.35` | `0.35` | `0.35` | `0.10` |
| `group.borderRoughness` | `0.45` | `0.45` | `0.45` | `0.60` |
| `group.borderSideDarken` | `0.40` | `0.40` | `0.40` | `0.40` |
| `group.borderEdgeDarken` | `0.45` | `0.45` | `0.45` | `0.45` |

No `fontUrl` on any preset — all omit it (troika built-in font default).

`node.fontUrl` is removed from `DiagramThemeNodeConfig` in Stream C. No existing preset had this field set, so no removal is needed in the preset files.

### Rationale for `group.defaultLabelColor` values

- **darkGlass**, **enterprise**: `'#ffffff'` — matches current hardcoded renderer behavior; white on dark backgrounds.
- **neonCyber**: `'#00ffcc'` — matches the theme's neon label palette; white would be jarring against the neon aesthetic.
- **lightMinimal**: `'#1a2240'` — dark text on light backgrounds; current hardcoded white causes invisible labels against the light group fill. This is a visible correctness fix.

### File: `elements/diagram/themes/mergeTheme.ts`

Extend `withColorMode()` to also apply to group label color:

```typescript
export function withColorMode(base: DiagramTheme, colorMode: SceneColorMode): DiagramTheme {
  const isDark = colorMode === 'dark';
  return {
    ...base,
    node: {
      ...base.node,
      defaultLabelColor:    isDark ? '#e8eeff' : '#1a1a2e',
      defaultSublabelColor: isDark ? '#b8c0e0' : '#4a4a6e',
    },
    group: {
      ...base.group,
      defaultLabelColor: isDark ? '#e8eeff' : '#1a1a2e',
    },
  };
}
```

### File: `elements/diagram/themes/index.ts`

Add `mergeTheme` to the barrel (currently only `withColorMode` is exported):

```typescript
export { darkGlassTheme }    from './darkGlass';
export { neonCyberTheme }    from './neonCyber';
export { enterpriseTheme }   from './enterprise';
export { lightMinimalTheme } from './lightMinimal';
export { mergeTheme, withColorMode } from './mergeTheme';
```

---

## Stream E — Compiler Layer Updates

**Depends on**: PR2 (Streams C + D).

### File: `elements/diagram/compiler/themeResolver.ts`

Full replacement of `buildThemeRenderConfig()`:

```typescript
export function buildThemeRenderConfig(theme: DiagramTheme): DiagramThemeRenderConfig {
  const labelScale   = theme.sceneTheme?.fontSize.label   ?? 1.0;
  const captionScale = theme.sceneTheme?.fontSize.caption ?? 1.0;

  return {
    envMapUrl:                   theme.environment.envMapUrl,
    envMapIntensity:             theme.environment.envMapIntensity,
    skyColor:                    theme.environment.skyColor,
    horizonColor:                theme.environment.horizonColor,
    nodeGlowIntensity:           theme.node.glowIntensity,
    nodeGlowSpread:              theme.node.glowSpread,                 // new
    nodeCornerRadius:            theme.node.cornerRadius,
    nodeLabelFontSizeBase:       theme.node.labelFontSizeBase,          // new
    nodeSublabelFontSizeBase:    theme.node.sublabelFontSizeBase,       // new
    use3DArrows:                 theme.edge.use3DArrows,
    edgeSmoothness:              theme.edge.smoothness,
    edgeMetalness:               theme.edge.defaultMetalness,
    edgeRoughness:               theme.edge.defaultRoughness,
    edgeFlowSpeed:               theme.edge.defaultFlowSpeed,
    edgeFlowWidth:               theme.edge.defaultFlowWidth,
    edgeFlowPulseIntensity:      theme.edge.flowPulseIntensity,         // new
    groupBorderMetalness:        theme.group.borderMetalness,           // new
    groupBorderRoughness:        theme.group.borderRoughness,           // new
    groupBorderSideDarken:       theme.group.borderSideDarken,          // new
    groupBorderEdgeDarken:       theme.group.borderEdgeDarken,          // new
    // Font URL: theme.fontUrl takes precedence over sceneTheme fallback.
    // Source changed from theme.node.fontUrl (deleted) to theme.fontUrl.
    fontUrl:                     theme.fontUrl ?? theme.sceneTheme?.font.webglFontUrl,
    effectiveLabelSizeFactor:    theme.node.labelSizeFactor * labelScale,
    effectiveSublabelSizeFactor: theme.node.sublabelSizeFactor * captionScale,
  };
}
```

### File: `elements/diagram/compiler/nodeCompiler.ts`

Add import (PR3 depends on PR1, so `diagramLayoutConstants.ts` already exists):
```typescript
import { DEFAULT_NODE_SIZE } from './diagramLayoutConstants';
```
Remove the existing function-local `const DEFAULT_NODE_SIZE` declaration if present; replace with the import.

#### `buildNodeDefaults()` — add new fields, remove hardcoded constants

```typescript
export const buildNodeDefaults = (theme: DiagramTheme) => ({
  shape:                    DEFAULT_NODE_SHAPE,
  size:                     DEFAULT_NODE_SIZE as [number, number],
  thickness:                theme.node.defaultThickness,
  color:                    theme.node.defaultColor,
  metalness:                theme.node.defaultMetalness,
  roughness:                theme.node.defaultRoughness,
  emissiveIntensity:        theme.node.defaultEmissiveIntensity,
  cornerRadius:             theme.node.cornerRadius,
  labelColor:               theme.node.defaultLabelColor,
  sublabelColor:            theme.node.defaultSublabelColor,
  opacity:                  1,
  clickable:                false,
  enabled:                  true,
  iconScale:                0.6,
  iconStyle:                theme.node.defaultIconStyle,
  iconDepth:                theme.node.defaultIconDepth,           // was hardcoded 0.15
  sideColorDarkenFactor:    theme.node.sideColorDarkenFactor,      // new — consumed in compileNode
  borderColorLightenFactor: theme.node.borderColorLightenFactor,   // new — consumed in compileNode
});
```

#### `compileNode()` — use theme-driven derive factors

```typescript
export function compileNode(
  dsl: DiagramNodeDSL,
  position: readonly [number, number, number],
  groupId: string | undefined,
  theme: DiagramTheme,
  positionInherited = false,
): DiagramNodeState {
  const nd = buildNodeDefaults(theme);
  const shape = dsl.shape ?? nd.shape;
  const color = dsl.color ?? nd.color;
  const sideColor = dsl.sideColor ?? deriveColor(color, nd.sideColorDarkenFactor);        // was -0.15 literal
  const borderColor = dsl.borderColor ?? deriveColor(color, nd.borderColorLightenFactor); // was 0.25 literal
  // ... rest of function unchanged ...
}
```

### File: `elements/diagram/compiler/groupCompiler.ts`

Also applies Stream A changes (constants import, titleGap fix) — those edits are in PR1. In PR3, add `labelColor` propagation:

#### `buildGroupDefaults()` — add `labelColor`

```typescript
export const buildGroupDefaults = (theme: DiagramTheme) => ({
  // ... all existing fields unchanged ...
  labelColor: theme.group.defaultLabelColor,    // new
});
```

#### `compileGroup()` — propagate `labelColor` to returned state

```typescript
export function compileGroup(
  dsl: DiagramGroupDSL,
  bounds: GroupBounds,
  theme: DiagramTheme,
): DiagramGroupState {
  const gd = buildGroupDefaults(theme);
  // ... existing logic ...
  return {
    // ... all existing return fields ...
    labelColor: dsl.labelColor ?? gd.labelColor,   // new — was always '#ffffff' hardcoded in GroupRenderer
  };
}
```

---

## Stream F — Renderer Layer Updates

**Depends on**: PR3 (Stream E).

### File: `elements/diagram/rendering/NodeRenderer.ts`

#### Replace hardcoded `2.2` glow spread

Two call sites in `createEntry()` and two in `updateEntry()`:

```typescript
// createEntry(), line ~202:
// Before:
glow = createGlow(state.color, state.size[0], state.size[1], 2.2, themeConfig.nodeGlowIntensity * state.opacity);
// After:
glow = createGlow(state.color, state.size[0], state.size[1], themeConfig.nodeGlowSpread, themeConfig.nodeGlowIntensity * state.opacity);

// updateEntry(), line ~368:
// Before:
entry.glow = createGlow(state.color, state.size[0], state.size[1], 2.2, themeConfig.nodeGlowIntensity * state.opacity);
// After:
entry.glow = createGlow(state.color, state.size[0], state.size[1], themeConfig.nodeGlowSpread, themeConfig.nodeGlowIntensity * state.opacity);

// updateEntry(), line ~378:
// Before:
const [glowW, glowH] = computeGlowScale(state.size[0], state.size[1], 2.2);
// After:
const [glowW, glowH] = computeGlowScale(state.size[0], state.size[1], themeConfig.nodeGlowSpread);
```

#### Replace hardcoded font size base coefficients

In `updateEntry()`, lines ~393–394:

```typescript
// Before:
const labelFontSize = contentH * 0.28 * (themeConfig.effectiveLabelSizeFactor ?? 1.0);
const sublabelFontSize = contentH * 0.18 * (themeConfig.effectiveSublabelSizeFactor ?? 1.0);

// After:
const labelFontSize = contentH * themeConfig.nodeLabelFontSizeBase * (themeConfig.effectiveLabelSizeFactor ?? 1.0);
const sublabelFontSize = contentH * themeConfig.nodeSublabelFontSizeBase * (themeConfig.effectiveSublabelSizeFactor ?? 1.0);
```

### File: `elements/diagram/rendering/EdgeRenderer.ts`

#### Add `flowPulseIntensity` constructor parameter

```typescript
constructor(
  private readonly materialFactory: IEdgeMaterialFactory,
  private readonly use3DArrows: boolean = false,
  private readonly edgeSmoothness: number = 0.5,
  private readonly edgeMetalness: number = 0.3,
  private readonly edgeRoughness: number = 0.7,
  private readonly flowSpeed: number = 0.7,
  private readonly flowWidth: number = 0.18,
  private readonly flowPulseIntensity: number = 0.9,  // new
) {}
```

#### Replace hardcoded `0.9` in `updatePulseMaterial()`

```typescript
// Line ~352. Before:
uniforms.uPulseIntensity.value = wantsPulse ? 0.9 : 0;
// After:
uniforms.uPulseIntensity.value = wantsPulse ? this.flowPulseIntensity : 0;
```

### File: `elements/diagram/rendering/GroupRenderer.ts`

#### Remove static PBR constants (after Stream A removed `BORDER_PX_TO_UNITS`)

Remove these three class-level static fields:
```typescript
private static readonly BORDER_SIDE_DARKEN = 0.4;   // line 11
private static readonly BORDER_METALNESS = 0.35;     // line 12
private static readonly BORDER_ROUGHNESS = 0.45;     // line 13
```

#### Make `themeConfig` required on `getOrCreate()`

```typescript
// Before:
getOrCreate(state: DiagramGroupState, diagramId: string, parent: THREE.Object3D, themeConfig?: DiagramThemeRenderConfig): GroupRenderEntry

// After:
getOrCreate(state: DiagramGroupState, diagramId: string, parent: THREE.Object3D, themeConfig: DiagramThemeRenderConfig): GroupRenderEntry
```

Update the caller in `render.ts` — `themeConfig` is already always passed there; just remove the `?`.

#### Thread `themeConfig` into `createGroup()` and `createBorder()`

```typescript
// Before:
private createGroup(state: DiagramGroupState, diagramId: string): GroupRenderEntry
private createBorder(state: DiagramGroupState): THREE.Group | undefined

// After:
private createGroup(state: DiagramGroupState, diagramId: string, themeConfig: DiagramThemeRenderConfig): GroupRenderEntry
private createBorder(state: DiagramGroupState, themeConfig: DiagramThemeRenderConfig): THREE.Group | undefined
```

Update all call sites of `createGroup()` and `createBorder()` within `GroupRenderer` to pass `themeConfig`.

#### Use theme PBR values in `createBorder()`

```typescript
private createBorder(state: DiagramGroupState, themeConfig: DiagramThemeRenderConfig): THREE.Group | undefined {
  // ...
  const faceMat = new THREE.MeshStandardMaterial({
    color: state.borderColor,
    opacity: state.borderOpacity,
    transparent: true,
    metalness: themeConfig.groupBorderMetalness,   // was GroupRenderer.BORDER_METALNESS (0.35)
    roughness: themeConfig.groupBorderRoughness,   // was GroupRenderer.BORDER_ROUGHNESS (0.45)
    emissive: new THREE.Color(state.borderEmissiveColor),
    emissiveIntensity: state.borderEmissiveIntensity,
  });
  const sideMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(state.borderColor).multiplyScalar(themeConfig.groupBorderSideDarken),  // was BORDER_SIDE_DARKEN (0.4)
    opacity: state.borderOpacity,
    transparent: true,
    metalness: themeConfig.groupBorderMetalness,
    roughness: themeConfig.groupBorderRoughness,
    emissive: new THREE.Color(state.borderEmissiveColor),
    emissiveIntensity: state.borderEmissiveIntensity,
  });
  // Edge wire material:
  const edgeLineMat = new THREE.LineBasicMaterial({
    color: new THREE.Color(state.borderColor).multiplyScalar(themeConfig.groupBorderEdgeDarken),  // was literal 0.45
    opacity: Math.min(1, state.borderOpacity + 0.1),
    transparent: true,
  });
  // ... rest unchanged ...
}
```

#### Use theme values in `updateGroup()` traversal

In the `entry.border.traverse()` callback (lines ~191–218):

```typescript
// Side material color update. Before:
mats[1].color.set(new THREE.Color(state.borderColor).multiplyScalar(GroupRenderer.BORDER_SIDE_DARKEN));
// After:
mats[1].color.set(new THREE.Color(state.borderColor).multiplyScalar(themeConfig.groupBorderSideDarken));

// Edge wire color update. Before:
edgeMat.color.set(new THREE.Color(state.borderColor).multiplyScalar(0.45));
// After:
edgeMat.color.set(new THREE.Color(state.borderColor).multiplyScalar(themeConfig.groupBorderEdgeDarken));
```

#### Replace hardcoded white group label color

In `updateGroup()`, line ~245:
```typescript
// Before:
ensureText(entry.label, state.label, '#ffffff', labelFontSize, ...);
// After:
ensureText(entry.label, state.label, state.labelColor, labelFontSize, ...);
```

### File: `elements/diagram/rendering/TextRenderer.ts`

**Delete this file.** It is a two-line re-export with no logic:
```typescript
export { ensureText } from '@brewsite/core';
export type { TextWithLayout } from '@brewsite/core';
```

Update `NodeRenderer.ts` and `GroupRenderer.ts` to import directly:
```typescript
// Before (in both files):
import { ensureText } from './TextRenderer';
import type { TextWithLayout } from './types'; // (TextWithLayout may already be from types.ts)

// After:
import { ensureText } from '@brewsite/core';
import type { TextWithLayout } from '@brewsite/core';
```

Check whether `TextWithLayout` is re-exported from `rendering/types.ts` and update accordingly.

---

## Stream H — DiagramRenderer Constructor Architecture

**Addresses**: Note §4.3, action item 13. Low priority — structural cleanup.
**Depends on**: PR4 (EdgeRenderer has new `flowPulseIntensity` constructor param).

**File**: `elements/diagram/render.ts`

### Problem

`nodeRenderer`, `edgeRenderer`, `groupRenderer` are `Type | null`, initialized lazily on first `update()`. Consequences:
1. Null-checked on every frame tick — unnecessary overhead.
2. EdgeRenderer construction params (which affect all edge geometry and animation) cannot be updated when the theme changes between scenes.

### Solution

`DiagramRenderer` requires `DiagramThemeRenderConfig` at construction time. All three sub-renderers are initialized in the constructor. `update()` detects edge-config changes and recreates `EdgeRenderer` only when needed.

### Exact changes to `render.ts`

Add a helper function outside the class:

```typescript
function edgeThemeKey(tc: DiagramThemeRenderConfig): string {
  return [
    tc.use3DArrows,
    tc.edgeSmoothness,
    tc.edgeMetalness,
    tc.edgeRoughness,
    tc.edgeFlowSpeed,
    tc.edgeFlowWidth,
    tc.edgeFlowPulseIntensity,
  ].join('|');
}
```

Change class fields and constructor:

```typescript
export class DiagramRenderer {
  private diagramGroups = new Map<string, THREE.Group>();
  private lastState = new Map<string, DiagramState>();
  private readonly envMapManager = new EnvMapManager();

  readonly interactionRegistry = new InteractionRegistry();
  readonly groupInteractionRegistry = new GroupInteractionRegistry();

  // Changed from `Type | null` — fully initialized in constructor:
  private readonly nodeRenderer: NodeRenderer;
  private edgeRenderer: EdgeRenderer;                // NOT readonly — may be recreated on theme change
  private readonly groupRenderer: GroupRenderer;

  private lastEdgeThemeKey: string;                  // used to detect edge theme config changes
  private _canvasAspect: number = 16 / 9;

  constructor(initialThemeConfig: DiagramThemeRenderConfig) {
    this.nodeRenderer = new NodeRenderer(sharedIconLoader, this.interactionRegistry);
    this.edgeRenderer = new EdgeRenderer(
      new EdgeMaterialFactory(),
      initialThemeConfig.use3DArrows,
      initialThemeConfig.edgeSmoothness,
      initialThemeConfig.edgeMetalness,
      initialThemeConfig.edgeRoughness,
      initialThemeConfig.edgeFlowSpeed,
      initialThemeConfig.edgeFlowWidth,
      initialThemeConfig.edgeFlowPulseIntensity,
    );
    this.groupRenderer = new GroupRenderer(this.groupInteractionRegistry);
    this.lastEdgeThemeKey = edgeThemeKey(initialThemeConfig);
  }

  setCanvasAspect(aspect: number): void {
    this._canvasAspect = aspect;
  }

  update(state: DiagramState, parent: THREE.Object3D): void {
    const tc = state.themeConfig;

    // Recreate EdgeRenderer if any construction-time edge params changed.
    const newKey = edgeThemeKey(tc);
    if (newKey !== this.lastEdgeThemeKey) {
      const root = this.diagramGroups.get(state.id);
      if (root) this.edgeRenderer.disposeAll(root);
      this.edgeRenderer = new EdgeRenderer(
        new EdgeMaterialFactory(),
        tc.use3DArrows,
        tc.edgeSmoothness,
        tc.edgeMetalness,
        tc.edgeRoughness,
        tc.edgeFlowSpeed,
        tc.edgeFlowWidth,
        tc.edgeFlowPulseIntensity,
      );
      this.lastEdgeThemeKey = newKey;
    }

    // Remove the old lazy-init guard block (lines 77–89 — the null-check and first-frame init).
    // The rest of update() is unchanged.
    // ...
  }
}
```

### Callers of `DiagramRenderer` constructor

`DiagramRenderer` is instantiated by `DiagramWidget` as a class field initializer in `elements/diagram/widget.ts` (current line 80):

```typescript
// Before:
private renderer = new DiagramRenderer();

// After (Option A — construct once with darkGlassTheme initial config):
private renderer = new DiagramRenderer(buildThemeRenderConfig(darkGlassTheme));
```

Add the import at the top of `widget.ts`:
```typescript
import { buildThemeRenderConfig } from './compiler/themeResolver';
import { darkGlassTheme } from './themes';
```

**Why Option A (field initializer, not `compileExtra`)**: `compileExtra()` is called on every scene compile. `DiagramRenderer` holds stateful Three.js objects (`diagramGroups`, `interactionRegistry`, `lastState`). Reconstructing it in `compileExtra()` would destroy all render state on every transition. The field initializer runs once at widget construction. The `edgeThemeKey` detection inside `DiagramRenderer.update()` handles all subsequent theme changes by recreating only the `EdgeRenderer` — the lightweight inner object — when edge params change, not the full renderer.

`DiagramRenderer` is a public export in `src/index.ts`. This constructor change is a breaking API change. Update all instantiation sites in `apps/examples/` to pass the required `DiagramThemeRenderConfig`. Verify with `grep -r "new DiagramRenderer"` across the monorepo.

---

## Testing Strategy

### Stream A — Constants Centralization

Existing tests must pass unchanged — behavior is identical, only import sources change.

New test: `compiler/__tests__/diagramLayoutConstants.test.ts`

```typescript
import { resolveGroupBoundsMap } from '../groupCompiler';
import { DEFAULT_TITLE_GAP } from '../diagramLayoutConstants';

it('uses DEFAULT_TITLE_GAP (not 0.75) in cycle-detection fallback', () => {
  // Group that references itself as a child triggers the cycle-detection path
  const groups = [{ id: 'g1', nodeIds: [], childGroupIds: ['g1'] }];
  const result = resolveGroupBoundsMap(groups, new Map(), new Map(), new Map());
  const bounds = result.get('g1');
  expect(bounds?.titleGap).toBe(DEFAULT_TITLE_GAP);   // must be 1, not 0.75
});

it('uses DEFAULT_TITLE_GAP in group-not-found fallback', () => {
  // Group that references a non-existent child triggers group-not-found path
  const groups = [{ id: 'g1', nodeIds: [], childGroupIds: ['nonexistent'] }];
  const result = resolveGroupBoundsMap(groups, new Map(), new Map(), new Map());
  const bounds = result.get('g1');
  expect(bounds?.titleGap).toBeGreaterThanOrEqual(DEFAULT_TITLE_GAP);
});
```

### Stream B — Edge Routing

Extend `compiler/__tests__/edgeRouter.test.ts`:

```typescript
import { routeEdgeCurved, routeEdgeOrthogonal } from '../edgeRouter';
import type { Vec3, NodeDimensions } from '../edgeRouter';

it('curved edge between adjacent nodes stays within a sensible NVS range', () => {
  const srcPos: Vec3 = [0.2, 0.5, 0];
  const srcSize: NodeDimensions = [0.12, 0.07, 0.2];
  const dstPos: Vec3 = [0.4, 0.5, 0];
  const dstSize: NodeDimensions = [0.12, 0.07, 0.2];
  const pts = routeEdgeCurved(srcPos, srcSize, 'right', dstPos, dstSize, 'left');
  // No control point should extend more than 0.25 NVS beyond the node bounding box
  for (const pt of pts) {
    expect(pt[0]).toBeGreaterThan(0.2 - 0.25);
    expect(pt[0]).toBeLessThan(0.4 + 0.25);
  }
});

it('orthogonal stub does not extend more than 0.2 NVS from source face', () => {
  const srcPos: Vec3 = [0.2, 0.5, 0];
  const srcSize: NodeDimensions = [0.12, 0.07, 0.2];
  const dstPos: Vec3 = [0.5, 0.5, 0];
  const dstSize: NodeDimensions = [0.12, 0.07, 0.2];
  const pts = routeEdgeOrthogonal(srcPos, srcSize, 'right', dstPos, dstSize, 'left');
  // The second point (stub) should be within 0.2 NVS of the source face center
  const faceX = srcPos[0] + srcSize[0] / 2;  // right face X
  expect(pts[1]![0]).toBeLessThan(faceX + 0.2);
});
```

### Stream C+D — Types + Presets

Primary validation is TypeScript compilation: `pnpm --filter @brewsite/diagram typecheck`.

Extend `compiler/__tests__/themeResolver.test.ts`:

```typescript
import { buildThemeRenderConfig } from '../themeResolver';
import { darkGlassTheme, lightMinimalTheme } from '../../themes';
import { mergeTheme } from '../../themes/mergeTheme';

it('emits all new DiagramThemeRenderConfig fields from darkGlassTheme', () => {
  const config = buildThemeRenderConfig(darkGlassTheme);
  expect(config.nodeGlowSpread).toBe(2.2);
  expect(config.nodeLabelFontSizeBase).toBe(0.28);
  expect(config.nodeSublabelFontSizeBase).toBe(0.18);
  expect(config.edgeFlowPulseIntensity).toBe(0.9);
  expect(config.groupBorderMetalness).toBe(0.35);
  expect(config.groupBorderRoughness).toBe(0.45);
  expect(config.groupBorderSideDarken).toBe(0.40);
  expect(config.groupBorderEdgeDarken).toBe(0.45);
});

it('fontUrl falls back to sceneTheme.font.webglFontUrl when theme.fontUrl absent', () => {
  const theme = mergeTheme(darkGlassTheme, {
    sceneTheme: { font: { webglFontUrl: '/my-font.ttf' }, fontSize: { label: 1, caption: 1 }, colorMode: 'dark', accentColor: '#fff' },
  });
  const config = buildThemeRenderConfig(theme);
  expect(config.fontUrl).toBe('/my-font.ttf');
});

it('theme.fontUrl overrides sceneTheme.font.webglFontUrl', () => {
  const theme = mergeTheme(darkGlassTheme, {
    fontUrl: '/override.ttf',
    sceneTheme: { font: { webglFontUrl: '/fallback.ttf' }, fontSize: { label: 1, caption: 1 }, colorMode: 'dark', accentColor: '#fff' },
  });
  const config = buildThemeRenderConfig(theme);
  expect(config.fontUrl).toBe('/override.ttf');
});
```

Extend `themes/__tests__/mergeTheme.test.ts`:

```typescript
it('withColorMode sets group.defaultLabelColor for dark mode', () => {
  const theme = withColorMode(lightMinimalTheme, 'dark');
  expect(theme.group.defaultLabelColor).toBe('#e8eeff');
});

it('withColorMode sets group.defaultLabelColor for light mode', () => {
  const theme = withColorMode(darkGlassTheme, 'light');
  expect(theme.group.defaultLabelColor).toBe('#1a1a2e');
});
```

### Stream E — Compiler

Extend `__tests__/compile.test.ts`:

```typescript
it('compileGroup propagates labelColor from theme default', () => {
  const dsl = makeDiagramDsl({ groups: [{ id: 'g1', nodeIds: [] }] });
  const state = compileDiagram(dsl, lightMinimalTheme);
  expect(state.groups[0]?.labelColor).toBe('#1a2240');
});

it('compileGroup respects per-group labelColor override', () => {
  const dsl = makeDiagramDsl({ groups: [{ id: 'g1', nodeIds: [], labelColor: '#abcdef' }] });
  const state = compileDiagram(dsl, darkGlassTheme);
  expect(state.groups[0]?.labelColor).toBe('#abcdef');
});

it('compileNode uses theme sideColorDarkenFactor', () => {
  const theme = mergeTheme(darkGlassTheme, { node: { sideColorDarkenFactor: 0 } });
  const dsl = makeDiagramDsl({ nodes: [{ id: 'n1', color: '#ff0000' }] });
  const state = compileDiagram(dsl, theme);
  // sideColorDarkenFactor = 0 → deriveColor(color, 0) → sideColor equals color
  expect(state.nodes[0]?.sideColor).toBe(state.nodes[0]?.color);
});

it('compileNode iconDepth comes from theme.node.defaultIconDepth', () => {
  const theme = mergeTheme(darkGlassTheme, { node: { defaultIconDepth: 0.33 } });
  const dsl = makeDiagramDsl({ nodes: [{ id: 'n1' }] });
  const state = compileDiagram(dsl, theme);
  expect(state.nodes[0]?.iconDepth).toBe(0.33);
});
```

### Stream F — Renderers

Extend `rendering/__tests__/GroupRenderer.test.ts`:

```typescript
it('renders group title label with state.labelColor, not hardcoded white', () => {
  const registry = makeGroupInteractionRegistry();
  const renderer = new GroupRenderer(registry);
  const themeConfig = makeThemeConfig({
    groupBorderMetalness: 0.35,
    groupBorderRoughness: 0.45,
    groupBorderSideDarken: 0.4,
    groupBorderEdgeDarken: 0.45,
  });
  const groupState = makeGroupState({ label: 'My Group', labelColor: '#00ff00' });
  const parent = new THREE.Group();
  renderer.getOrCreate(groupState, 'diag1', parent, themeConfig);
  // The text call captured by the test spy should receive '#00ff00', not '#ffffff'
  expect(capturedLabelColor()).toBe('#00ff00');
});
```

Note: The existing `GroupRenderer.test.ts` uses test doubles and captures. Follow its existing patterns to set up `capturedLabelColor()`.

### Stream H — DiagramRenderer Architecture

Extend `__tests__/diagramRenderer.test.ts`:

```typescript
import { buildThemeRenderConfig } from '../compiler/themeResolver';
import { darkGlassTheme } from '../themes';
import { mergeTheme } from '../themes/mergeTheme';

it('initializes without calling update() first', () => {
  const config = buildThemeRenderConfig(darkGlassTheme);
  expect(() => new DiagramRenderer(config)).not.toThrow();
});

it('update() works on first call without prior init', () => {
  const config = buildThemeRenderConfig(darkGlassTheme);
  const renderer = new DiagramRenderer(config);
  const parent = new THREE.Group();
  const state = makeMinimalDiagramState({ themeConfig: config });
  expect(() => renderer.update(state, parent)).not.toThrow();
});

it('recreates EdgeRenderer when edge smoothness changes between updates', () => {
  const config1 = buildThemeRenderConfig(darkGlassTheme);
  const config2 = buildThemeRenderConfig(mergeTheme(darkGlassTheme, { edge: { smoothness: 2.5 } }));
  const renderer = new DiagramRenderer(config1);
  const parent = new THREE.Group();
  const state1 = makeMinimalDiagramState({ themeConfig: config1 });
  const state2 = makeMinimalDiagramState({ themeConfig: config2, id: state1.id });
  renderer.update(state1, parent);
  renderer.update(state2, parent);
  // No crash. Edge rendering applied config2 params.
  // (EdgeRenderer recreation is observable via the parent group's edge children being replaced.)
  expect(parent.children.length).toBeGreaterThan(0);
});
```

---

## PR Sequence Summary

| PR | Contents | TypeScript risk | Test command |
|---|---|---|---|
| **PR1** | Stream A (constants) + Stream B (edge routing) + Stream X (dead code) | Low — additive changes + value swaps | `pnpm --filter @brewsite/diagram test` |
| **PR2** | Stream C (types) + Stream D (presets + mergeTheme) + package root index fixes | Medium — required interface fields; themes must supply all new fields | `pnpm --filter @brewsite/diagram typecheck && pnpm --filter @brewsite/diagram test` |
| **PR3** | Stream E (compiler: themeResolver, nodeCompiler, groupCompiler) | Low — consumes types from PR2 | `pnpm --filter @brewsite/diagram test` |
| **PR4** | Stream F (renderers: NodeRenderer, EdgeRenderer, GroupRenderer, TextRenderer deletion) | Low — consumes compiler output from PR3 | `pnpm --filter @brewsite/diagram test` |
| **PR5** | Stream H (DiagramRenderer constructor + callers) | Medium — breaking public API change; update all `new DiagramRenderer()` sites | `pnpm typecheck && pnpm test` |

Each PR must pass both `typecheck` and `test` in CI before merge.

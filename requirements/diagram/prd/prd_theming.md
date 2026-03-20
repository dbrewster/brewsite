---
title: "BrewSite Diagram — Theming System"
doc_type: prd
status: active
owner: brewsite-product-manager
last_updated: 2026-03-19
change_history:
  - date: 2026-03-02
    author: "Toolkit Product"
    summary: "Initial PRD created. Comprehensive documentation of the @brewsite/diagram theming system as implemented."
  - date: 2026-03-02
    author: "Toolkit Product"
    summary: "Breaking: renamed DiagramThemeNodeConfig.defaultDepth to defaultThickness to align with DiagramNodeProps.thickness rename. No other theme API changes."
  - date: 2026-03-03
    author: "Toolkit Product"
    summary: "Added theme-level default input handler support: DiagramTheme.input? field, DiagramCanvasInputConfig type, IGNORED_INPUT_CONFIG compiler warning, and defaultDiagramCanvasInputActions convenience export."
  - date: 2026-03-04
    author: "Toolkit Product"
    summary: "Cross-package theming integration: added DiagramTheme.sceneTheme optional field; documented themeResolver fallback chain for fontUrl and effectiveLabelSizeFactor/effectiveSublabelSizeFactor on DiagramThemeRenderConfig; added withColorMode() utility; documented known limitation that sceneTheme.colorMode has no effect on built-in preset label colors without withColorMode(); updated buildThemeRenderConfig signature."
  - date: 2026-03-08
    author: "Toolkit Product"
    summary: "Model/diagram overhaul: added required fields to DiagramThemeNodeConfig (defaultSize, defaultIconScale, defaultIconDepth, glowSpread); added required fields to DiagramThemeEdgeConfig (tubeRadialSegments, organicVariation); added required fields to DiagramThemeGroupConfig (borderMetalness, borderRoughness, borderSideDarken, borderEdgeDarken); added corresponding render-time fields to DiagramThemeRenderConfig (nodeGlowSpread, edgeTubeRadialSegments, groupBorderMetalness, groupBorderRoughness, groupBorderSideDarken, groupBorderEdgeDarken); fontUrl promoted from DiagramThemeNodeConfig to DiagramTheme root level; all four preset themes updated with explicit values for every new required field; resolved both open questions; updated Breaking Change Assessment to major semver impact; removed Known Limitation #2."
  - date: 2026-03-11
    author: "Toolkit Product"
    summary: "Theme redesign: expanded canonical theme set from four to six names, adding midnight (warm dark) and lightCanvas (premium light). All four existing presets redesigned with coherent palettes; two new presets added. Introduced DiagramThemeName union type and DIAGRAM_THEMES keyed registry. Added string name API for <Diagram theme='...'> (non-breaking union widening). All six presets carry an 8-color accent palette coordinated with @brewsite/charts via cross-package comment blocks. Version bump: minor."
  - date: 2026-03-11
    author: "Toolkit Product"
    summary: "Theming overhaul — polarity pairs: DiagramThemeName is now a type alias for ThemeFamily (imported from @brewsite/core), maintaining backward compatibility while tying the type to the canonical cross-package union. Added DIAGRAM_THEME_PAIRS registry (Record<ThemeFamily, DiagramThemePair>) — each entry pre-wired with the corresponding SceneTheme from SCENE_THEME_PAIRS. Six polarity-variant DiagramTheme files added as @internal placeholders (darkGlassLight, enterpriseLight, midnightLight, neonCyberLight, lightCanvasDark, lightMinimalDark); production aesthetic authoring deferred to a follow-on story. DIAGRAM_THEMES flat registry unchanged; no breaking changes. Version bump: minor."
  - date: 2026-03-12
    author: "Toolkit Product"
    summary: "Theme family art direction: all six polarity-variant DiagramTheme presets promoted from @internal placeholders to production-ready public exports. Each polarity variant carries fully designed node/edge PBR material profiles, label colors, palette, and motion/interaction parameters distinct to its family and polarity — no sibling-theme reuse. DIAGRAM_THEME_PAIRS and DIAGRAM_THEMES both export all 12 variants. Added Technical Considerations section covering per-family node and edge material profiles and per-family motion and interaction profile ranges."
  - date: 2026-03-13
    author: "Toolkit Product"
    summary: "Audit corrections: DiagramThemeNodeConfig gains nodeEnvMapIntensity (optional, default 0.15), defaultBoxColor (optional), defaultLabelPadding (required). DiagramThemeEdgeConfig gains many flow routing fields: flowTurnRadius, flowFaceStub, flowBundleStrength, flowObstaclePadding, flowTargetApproachBias, flowUnderpassDepth, flowUnderpassClearance, flowTurnPenalty, flowPunchthroughPenalty, flowUnderpassPenalty. DiagramThemeRenderConfig gains nodeEnvMapIntensity, nodeSdfGlyphSize, nodeLabelPadding. DiagramTheme gains sdfGlyphSize (optional). Corrected custom theme example — routing: 'orthogonal' is not valid; corrected to routing: 'flow'. Input defaults section corrected — input is now forwarded to DiagramWidget/diagramPlugin, not DiagramCanvasWidget."
  - date: 2026-03-17
    author: "Toolkit Product"
    summary: "Major rewrite: theming architecture corrected from flat DIAGRAM_THEMES/DIAGRAM_THEME_PAIRS constants to actual registration-based model (registerDiagramThemePair/resolveDiagramTheme in themeRegistry.ts). DiagramThemeName is NOT exported from package root index.ts. Only four theme exports from barrel: enterpriseTheme, enterpriseLightTheme, defaultDiagramTheme, defaultLightDiagramTheme. Additional themes (darkGlass, midnight, neonCyber, lightCanvas, lightMinimal and their polarity variants) live in the themes/ directory but are registered at runtime by @brewsite/themes, not exported from the @brewsite/diagram barrel. Removed DIAGRAM_THEMES and DIAGRAM_THEME_PAIRS constant references. Removed claim that six preset themes are exported directly. Updated functional requirements, API design, tree-shaking, and launch criteria sections."
  - date: 2026-03-18
    author: "Toolkit Product"
    summary: "SceneTheme bridge: documented automatic bridging of SceneTheme from SceneSnapshotContext into DiagramTheme by the diagram compile handler. New optional sceneTheme field on CompileSceneTrackOptions and SceneSnapshotContext in @brewsite/core propagates engine-level font and fontSize tokens into diagram compilation without manual theme wiring. Updated SceneTheme Integration section with automatic bridge documentation. Semver impact: minor (new optional fields only, fully backward-compatible)."
  - date: 2026-03-19
    author: "Toolkit Product"
    summary: "NVS sizing migration: all theme layout defaults are now NVS fractions. defaultSize changed from [4, 2] (content units) to [0.15, 0.08] (NVS fractions) across all themes. Grid/hierarchical spacing, groupPadding, titleGap all in NVS. The dual content-unit / NVS default system for manual vs auto layout is eliminated — one set of NVS-fraction defaults for all layout modes. Updated preset theme descriptions, layout defaults section, and DiagramThemeNodeConfig.defaultSize JSDoc. Semver impact: major (theme default values changed)."
  - date: 2026-03-19
    author: "Toolkit Product"
    summary: "NVS thickness migration completed: node defaultThickness, edge defaultThickness, group defaultBorderWidth, group defaultBorderHeight, and node cornerRadius are now NVS fractions of diagram viewport width. All six theme presets updated with migrated values. thicknessNormFactor and GROUP_BORDER_PX_TO_UNITS eliminated from the pipeline. cornerRadius is now converted to world units in render.ts alongside size and thickness. Updated sub-config JSDoc, preset theme descriptions, and layout defaults table."
---

## Overview

The theming system in `@brewsite/diagram` provides the complete design language for diagram visualization. A `DiagramTheme` is a plain TypeScript object — no React, no Three.js — that configures default colors, PBR material properties, layout behavior, edge routing algorithms, environment map, and optional cross-package scene theme integration for all elements within a diagram. The package ships with two default theme presets: `enterpriseTheme` (dark) and `enterpriseLightTheme` (light), which are also aliased as `defaultDiagramTheme` and `defaultLightDiagramTheme`. Additional preset themes (darkGlass, midnight, neonCyber, lightCanvas, lightMinimal and their polarity variants) are defined in `@brewsite/diagram`'s `themes/` directory and registered at runtime by `@brewsite/themes` via the `registerDiagramThemePair()` API. The `resolveDiagramTheme(family, polarity)` function resolves a theme by family name and polarity. Custom themes are authored by spreading a preset and overriding specific sub-configs. The `withColorMode()` utility creates a theme variant with colorMode-derived label colors. The system affects `@brewsite/diagram`.

## Problem Statement

Diagram elements expose dozens of configurable properties across nodes, edges, and groups. Without a centralized theme contract, consumers must specify material values, colors, and routing preferences on every individual element — an authoring burden that also makes global style changes (e.g., switching from dark to light presentation context) require edits across every scene file. The theme system resolves this by making the preset the default for all unspecified fields, with a clear and documented override hierarchy.

## Goals and Success Metrics

**Primary goals:**
- A consumer can change the visual character of a complete diagram by passing a single theme object, with no per-node or per-edge edits required
- All six preset themes produce visually coherent output without additional configuration
- The theme type is fully statically typed so TypeScript catches partial or malformed custom themes at authoring time
- The theme object is pure data: no runtime cost when the diagram is not rendered

**Success metrics:**
- All six presets pass a visual smoke test (screenshot comparison) in the CI pipeline
- TypeScript strict-mode type check passes on all theme exports
- Switching between any two preset themes in a demo scene requires only a prop or `resolveDiagramTheme()` call change

**Guardrail metrics:**
- Adding a new optional field to any sub-config is a minor version bump; removing or renaming a field is a major version bump
- Any new required field must be added to all six preset themes simultaneously with a major version bump

## Non-Goals

- Runtime theme switching with animated transitions between theme values
- CSS-in-JS or design token integration — themes are TypeScript objects only
- Per-scene theme diffing or partial merge semantics at the `DiagramCanvas` level (the canvas `theme` prop is a full fallback, not a partial merge)
- Dark/light mode detection or media query integration — consumers select themes explicitly

## Consumer Stories

- As a toolkit consumer, I want to resolve a theme by family name and polarity via `resolveDiagramTheme('darkGlass', 'dark')` so that all my nodes, edges, and groups adopt a consistent visual style without manually constructing a theme object.
- As a toolkit consumer, I want to spread a preset and override specific fields so that I can create a brand-aligned custom theme with minimal boilerplate.
- As a toolkit consumer, I want to specify a custom HDR URL in a theme so that my diagram uses my own lighting environment without forking the theme.
- As a toolkit consumer, I want themes to be individually importable so that my bundle only includes the preset I use.

## Functional Requirements

1. The `DiagramTheme` type shall be a plain TypeScript interface with no runtime dependencies.
2. The `@brewsite/diagram` package barrel exports four theme constants: `enterpriseTheme`, `enterpriseLightTheme`, `defaultDiagramTheme`, and `defaultLightDiagramTheme`. Additional preset theme files (darkGlass, midnight, neonCyber, lightCanvas, lightMinimal and their polarity variants) exist in the `themes/` directory and are registered at runtime by `@brewsite/themes` via `registerDiagramThemePair()`.
3. Each preset shall be declared `as const` so that TypeScript infers narrow literal types.
4a. `DiagramThemeName` is a type alias for `ThemeFamily` defined in `types.ts`. It is NOT exported from the `@brewsite/diagram` package root `index.ts`. It is available only to internal consumers who import directly from the types module.
4b. Theme lookup is registration-based via `registerDiagramThemePair(family, pair)` and `resolveDiagramTheme(family, polarity)` in `themeRegistry.ts`. The registry pre-loads `'default'` and `'enterprise'` families at module init. Other families (darkGlass, midnight, neonCyber, lightCanvas, lightMinimal) are registered by `@brewsite/themes` at app startup.
4c. The `theme?` prop on `DiagramDSL` (in `types.ts`) accepts `DiagramTheme`. Note: the `theme` prop is on the internal `DiagramDSL` type, not on `DiagramProps` in `dsl.tsx`. The compiler handler extracts the theme from the DSL during `extractDiagramDSL()`.
4. The `DiagramThemeRenderConfig` struct shall be derived from `DiagramTheme` at compile time by `buildThemeRenderConfig()` in `compiler/themeResolver.ts`.
5. `render.ts` and `EdgeRenderer` shall read only `DiagramThemeRenderConfig` — never the full `DiagramTheme`.
6. Theme resolution shall run once per diagram compile call, not per frame.
7. The canvas-level `theme` prop on `<DiagramCanvas>` shall serve as the fallback when a `<Diagram>` has no `theme` prop.
8. Per-node and per-edge props shall always override the resolved theme default for their specific property.
9. Environment map caching shall key on `envMapUrl` string so that multiple diagrams sharing the same HDR URL never load it twice.
10. When `envMapUrl` is `'none'`, no environment map shall be applied and no HDR fetch shall be initiated.

## API Design

### DiagramThemeName (internal type)

```typescript
// packages/diagram/src/elements/diagram/types.ts

/**
 * Type alias for ThemeFamily from @brewsite/core.
 * NOT exported from the package root index.ts — internal only.
 */
import type { ThemeFamily } from '@brewsite/core';
export type DiagramThemeName = ThemeFamily;
```

### Theme Registry: registerDiagramThemePair / resolveDiagramTheme

```typescript
// packages/diagram/src/elements/diagram/themeRegistry.ts

/** A pair of DiagramTheme presets for dark and light polarities. */
export type DiagramThemePair = { dark: DiagramTheme; light: DiagramTheme };

/**
 * Registers a DiagramTheme pair under the given family name.
 * Call this during app startup (before any scene compilation) to make
 * a theme family available to all diagram elements.
 */
export function registerDiagramThemePair(family: string, pair: DiagramThemePair): void;

/**
 * Resolves the DiagramTheme for the given family and polarity.
 * Falls back to 'default' if the family is not registered.
 */
export function resolveDiagramTheme(family: string, polarity: 'dark' | 'light'): DiagramTheme;

/**
 * Resets the registry to its initial state. For use in tests only.
 * @internal
 */
export function _resetDiagramThemeRegistryForTesting(): void;
```

The registry pre-loads `'default'` and `'enterprise'` families at module init from the enterprise preset. Additional families (darkGlass, midnight, neonCyber, lightCanvas, lightMinimal) are registered by `@brewsite/themes` at app startup via `registerDiagramThemePair()`.

### Package barrel theme exports

```typescript
// packages/diagram/src/index.ts — theme section

// Default presets (enterprise aesthetic)
export { enterpriseTheme, enterpriseLightTheme, defaultDiagramTheme, defaultLightDiagramTheme } from './elements/diagram/themes';
// Theme registry
export { registerDiagramThemePair, resolveDiagramTheme, _resetDiagramThemeRegistryForTesting } from './elements/diagram/themes';
export type { DiagramThemePair } from './elements/diagram/themes';
// Theme composition helpers
export { mergeTheme, withColorMode } from './elements/diagram/themes/mergeTheme';
// Convenience hooks
export { useDiagramTheme } from './hooks/useDiagramTheme';
```

The `theme` prop is on `DiagramDSL` (in `types.ts`), not on `DiagramProps` (in `dsl.tsx`). The compiler handler passes the theme through internally.

### DiagramTheme

```typescript
// packages/diagram/src/elements/diagram/types.ts

export interface DiagramTheme {
  readonly node: DiagramThemeNodeConfig;
  readonly edge: DiagramThemeEdgeConfig;
  readonly group: DiagramThemeGroupConfig;
  readonly environment: DiagramThemeEnvironmentConfig;
  readonly layout?: DiagramThemeLayoutConfig;
  readonly palette?: readonly string[];
  /**
   * Diagram-wide font URL for troika-three-text.
   * Applies to all diagram text: node labels, node sublabels, and group title labels.
   * Fallback chain: theme.fontUrl ?? theme.sceneTheme?.font.webglFontUrl.
   * Must be an MSDF-encoded font — standard web font URLs will not render correctly.
   */
  readonly fontUrl?: string;
  /**
   * Optional default input handler configuration for DiagramCanvas.
   * Only effective when applied to a <DiagramCanvas theme={...}>.
   * Ignored (with a compile-time warning) when placed on a child <Diagram>.
   */
  readonly input?: DiagramCanvasInputConfig;
  /**
   * Optional cross-package scene theme for font URL and colorMode defaults.
   *
   * When present, themeResolver.ts derives:
   * - fontUrl: theme.fontUrl ?? sceneTheme.font.webglFontUrl
   * - effectiveLabelSizeFactor: theme.node.labelSizeFactor * sceneTheme.fontSize.label
   * - effectiveSublabelSizeFactor: theme.node.sublabelSizeFactor * sceneTheme.fontSize.caption
   *
   * colorMode label color derivation: only fires when defaultLabelColor is absent.
   * All six built-in presets have explicit defaultLabelColor values, so
   * sceneTheme.colorMode has NO effect on label colors when using a preset directly.
   * Use withColorMode(preset, colorMode) to create a preset with colorMode-derived
   * label colors.
   */
  readonly sceneTheme?: SceneTheme;
  /**
   * SDF glyph size for troika-three-text atlas tiles (pixels per glyph).
   * Controls how many unique glyphs fit in the shared troika SDF atlas.
   * When absent, themeResolver defaults to 32, which gives ~4096 glyph slots.
   * Set to 64 only when maximum per-glyph sharpness is required at large font sizes.
   */
  readonly sdfGlyphSize?: number;
}
```

### DiagramCanvasInputConfig

```typescript
/**
 * Input handler configuration for a DiagramCanvas, defined in the theme.
 * Allows a single authoring location for per-canvas input defaults instead of
 * repeating <InputController> blocks in every scene.
 *
 * canvasId is intentionally absent from each action spec: the compiler
 * auto-injects it from the parent <DiagramCanvas id="..."> at compile time.
 */
export interface DiagramCanvasInputConfig {
  /**
   * Default input actions for the canvas. Omit canvasId on each action —
   * the compiler injects it automatically from the <DiagramCanvas id="...">.
   */
  readonly defaultActions: ReadonlyArray<Omit<InputActionSpec, 'canvasId'>>;
}
```

The `defaultDiagramCanvasInputActions` constant exported from `@brewsite/diagram` provides the canonical reference action set (pointer-based pan/rotate, reset, and focus) ready for use as `theme.input.defaultActions`.

### Sub-config types

```typescript
export interface DiagramThemeNodeConfig {
  readonly defaultColor: string;
  /**
   * Optional default side/box color (CSS hex) for node side faces.
   * When absent, compile.ts derives it from defaultColor via sideColorDarkenFactor.
   */
  readonly defaultBoxColor?: string;
  readonly defaultMetalness: number;
  readonly defaultRoughness: number;
  /**
   * Per-node environment map reflection intensity [0–1].
   * Applied to each node's MeshStandardMaterial.envMapIntensity.
   * Optional — defaults to 0.15 when absent.
   */
  readonly nodeEnvMapIntensity?: number;
  readonly defaultEmissiveIntensity: number;
  /**
   * Default physical thickness (Z-depth) of node prism boxes as an NVS fraction
   * of the diagram viewport width. Converted to world units by render.ts (× uniformWorldW).
   * 0.033 = card-like (neonCyber), 0.075 = standard block (enterprise), 0.210 = deep block (midnight).
   */
  readonly defaultThickness: number;
  /**
   * Default node size as NVS fractions [width, height].
   * Applies to all layout modes (Grid, Hierarchical, Flow, Manual).
   * Default: [0.15, 0.08] — 15% wide, 8% tall, 2:1 aspect ratio.
   */
  readonly defaultSize: readonly [number, number];
  /**
   * Corner radius as an NVS fraction of the diagram viewport width.
   * Converted to world units in render.ts alongside size and thickness.
   * 0 = sharp BoxGeometry; > 0 = rounded box geometry.
   * Ignored for non-rect shapes (cylinder, oval, hexagon, etc.).
   */
  readonly cornerRadius: number;
  readonly glowIntensity: number;
  /** Glow sprite size multiplier relative to node bounding box dimensions. Controls halo radius. */
  readonly glowSpread: number;
  readonly defaultLabelColor: string;
  readonly defaultSublabelColor: string;
  readonly labelSizeFactor: number;
  readonly sublabelSizeFactor: number;
  readonly defaultIconStyle: SvgIcon3DStyle;
  /** Default icon scale as a fraction of the node face [0..1]. */
  readonly defaultIconScale: number;
  /**
   * Default icon extrusion depth as a fraction of node thickness [0..1].
   * Only applies when iconStyle !== 'flat'.
   */
  readonly defaultIconDepth: number;
  /**
   * Addend applied to derive side-face color from front-face color.
   * Negative values darken. Typical range: -0.3 to 0.
   */
  readonly sideColorDarkenFactor: number;
  /**
   * Addend applied to derive border color from front-face color.
   * Positive values lighten. Typical range: 0 to 0.5.
   */
  readonly borderColorLightenFactor: number;
  /** Base coefficient for label font size. Final size = contentH × labelFontSizeBase × labelSizeFactor × sceneTheme.fontSize.label. */
  readonly labelFontSizeBase: number;
  /** Base coefficient for sublabel font size. Final size = contentH × sublabelFontSizeBase × sublabelSizeFactor × sceneTheme.fontSize.caption. */
  readonly sublabelFontSizeBase: number;
  /**
   * Default label padding as a fraction of the node's content height [0–1].
   * Positive values shift labels downward; negative values shift upward.
   * 0 = no offset (default position). darkGlass default: 0.
   */
  readonly defaultLabelPadding: number;
}

export interface DiagramThemeEdgeConfig {
  readonly defaultColor: string;
  readonly defaultFlowColor?: string;
  readonly defaultFlowSpeed: number;
  readonly defaultFlowWidth: number;
  /** Default tube radius as an NVS fraction of the diagram viewport width. */
  readonly defaultThickness: number;
  readonly defaultMetalness: number;
  readonly defaultRoughness: number;
  readonly routing: EdgeRoutingAlgorithm;
  readonly landing: EdgeLandingAlgorithm;
  readonly smoothness: number;
  readonly use3DArrows: boolean;
  /** Number of sides in tube cross-section polygon. Higher values produce smoother tube silhouettes. */
  readonly tubeRadialSegments: number;
  /** Perpendicular offset magnitude for 'organic' routing variation. 0 = no variation, 3 = extreme. */
  readonly organicVariation: number;
  /** Peak brightness multiplier applied to the flow pulse shader. Range: 0–2. Default: 0.9. */
  readonly flowPulseIntensity: number;
  /** Default turn radius for canonical flow routing in diagram units. */
  readonly flowTurnRadius: number;
  /** Default outward face-normal stub distance for flow routing. */
  readonly flowFaceStub: number;
  /** Controls how long compatible sibling flow edges share a common trunk before splitting. */
  readonly flowBundleStrength: number;
  /** Default obstacle padding used by flow routing. */
  readonly flowObstaclePadding: number;
  /** Bias toward direct target ingress after splitting from a flow trunk. */
  readonly flowTargetApproachBias: number;
  /** Default depth below the authored diagram plane for underpass routing. */
  readonly flowUnderpassDepth: number;
  /** Default vertical clearance used when entering and leaving an underpass. */
  readonly flowUnderpassClearance: number;
  /** Cost penalty multiplier for turns in the flow visibility search. */
  readonly flowTurnPenalty: number;
  /** Cost penalty applied when the flow router must puncture an obstacle. */
  readonly flowPunchthroughPenalty: number;
  /** Cost penalty applied when the flow router uses a Z underpass. */
  readonly flowUnderpassPenalty: number;
}

export interface DiagramThemeGroupConfig {
  readonly defaultColor: string;
  readonly defaultBorderColor: string;
  /** Default border width as an NVS fraction of the diagram viewport width. */
  readonly defaultBorderWidth: number;
  /** Default border height (Z-depth) as an NVS fraction of the diagram viewport width. */
  readonly defaultBorderHeight: number;
  readonly defaultFillOpacity: number;
  readonly defaultBorderOpacity: number;
  readonly defaultBorderEmissiveColor?: string;
  readonly defaultBorderEmissiveIntensity?: number;
  /** Default color for group title label text. Propagated into DiagramGroupState.labelColor. */
  readonly defaultLabelColor: string;
  /** PBR metalness for group border frame faces [0..1]. */
  readonly borderMetalness: number;
  /** PBR roughness for group border frame faces [0..1]. */
  readonly borderRoughness: number;
  /** Multiplier [0..1] applied to border face color for side faces. */
  readonly borderSideDarken: number;
  /** Multiplier applied to borderColor when computing edge-wire (LineSegments) color. */
  readonly borderEdgeDarken: number;
}

export interface DiagramThemeEnvironmentConfig {
  readonly envMapUrl: string | null | 'none';
  readonly envMapIntensity: number;
  readonly skyColor: string;
  readonly horizonColor: string;
}

export interface DiagramThemeLayoutConfig {
  readonly defaultKind?: 'grid' | 'hierarchical' | 'manual' | 'flow';
  readonly grid?: {
    readonly columns?: number | 'auto';
    readonly spacing?: readonly [number, number];
    readonly margin?: number | readonly [number, number];
    readonly groupPadding?: LayoutPadding;
    readonly titleGap?: number;
    readonly alignment?: LayoutAlignment;
    readonly disconnected?: LayoutDisconnected;
  };
  readonly hierarchical?: {
    readonly direction?: 'top-down' | 'left-right';
    readonly spacing?: readonly [number, number];
    readonly margin?: number | readonly [number, number];
    readonly groupPadding?: LayoutPadding;
    readonly titleGap?: number;
    readonly alignment?: LayoutAlignment;
    readonly disconnected?: LayoutDisconnected;
  };
  readonly manual?: {
    readonly groupPadding?: LayoutPadding;
    readonly titleGap?: number;
  };
  readonly flow?: {
    readonly direction?: 'top-down' | 'left-right';
    readonly gap?: number;
    readonly groupPadding?: LayoutPadding;
    readonly titleGap?: number;
  };
}
```

### Compile-time render config (render.ts boundary)

```typescript
export interface DiagramThemeRenderConfig {
  readonly envMapUrl: string | null | 'none';
  readonly envMapIntensity: number;
  readonly skyColor: string;
  readonly horizonColor: string;
  /**
   * Per-node environment map reflection intensity [0–1].
   * Applied to each node's MeshStandardMaterial.envMapIntensity.
   * Source: theme.node.nodeEnvMapIntensity ?? 0.15.
   */
  readonly nodeEnvMapIntensity: number;
  readonly nodeGlowIntensity: number;
  /** Resolved from DiagramThemeNodeConfig.glowSpread. Controls glow sprite radius multiplier. */
  readonly nodeGlowSpread: number;
  /** Corner radius as NVS fraction. render.ts converts to world units (× uniformWorldW). 0 = BoxGeometry. */
  readonly nodeCornerRadius: number;
  readonly use3DArrows: boolean;
  readonly edgeSmoothness: number;
  readonly edgeMetalness: number;
  readonly edgeRoughness: number;
  readonly edgeFlowSpeed: number;
  readonly edgeFlowWidth: number;
  /** Resolved from DiagramThemeEdgeConfig.tubeRadialSegments. */
  readonly edgeTubeRadialSegments: number;
  /** Resolved from DiagramThemeGroupConfig.borderMetalness. */
  readonly groupBorderMetalness: number;
  /** Resolved from DiagramThemeGroupConfig.borderRoughness. */
  readonly groupBorderRoughness: number;
  /** Resolved from DiagramThemeGroupConfig.borderSideDarken. */
  readonly groupBorderSideDarken: number;
  /** Resolved from DiagramThemeGroupConfig.borderEdgeDarken. */
  readonly groupBorderEdgeDarken: number;
  /** Peak brightness of flow pulse animation. Source: theme.edge.flowPulseIntensity. */
  readonly edgeFlowPulseIntensity: number;
  /** Base font-size coefficient for node labels. Source: theme.node.labelFontSizeBase. */
  readonly nodeLabelFontSizeBase: number;
  /** Base font-size coefficient for node sublabels. Source: theme.node.sublabelFontSizeBase. */
  readonly nodeSublabelFontSizeBase: number;
  /**
   * Resolved font URL for troika-three-text. Applies to all diagram text:
   * node labels, node sublabels, and group title labels.
   * Fallback chain: theme.fontUrl ?? theme.sceneTheme?.font.webglFontUrl.
   */
  readonly fontUrl: string | undefined;
  /**
   * Effective label size factor = theme.node.labelSizeFactor x (sceneTheme?.fontSize.label ?? 1.0).
   * Passed to NodeRenderer and GroupRenderer for troika text sizing.
   */
  readonly effectiveLabelSizeFactor?: number;
  /**
   * Effective sublabel size factor = theme.node.sublabelSizeFactor x (sceneTheme?.fontSize.caption ?? 1.0).
   */
  readonly effectiveSublabelSizeFactor?: number;
  /**
   * SDF glyph size for troika-three-text atlas tiles.
   * Source: theme.sdfGlyphSize ?? 32.
   * 32 gives ~4096 glyph slots; 64 gives ~1024 with maximum per-glyph sharpness.
   */
  readonly nodeSdfGlyphSize: number;
  /**
   * Default label padding as a fraction of content height [0–1].
   * Source: theme.node.defaultLabelPadding.
   * Applied as a vertical Y offset to all node label positions.
   */
  readonly nodeLabelPadding: number;
}
```

### Theme builder (compiler/themeResolver.ts)

```typescript
export function buildThemeRenderConfig(theme: DiagramTheme): DiagramThemeRenderConfig;
export function compileExitConfig(dsl: DiagramExitDSL | undefined): DiagramExitConfig | null;
export function compileEnterConfig(dsl: DiagramEnterDSL | undefined): DiagramEnterConfig | null;
```

### SceneTheme integration utilities

```typescript
// packages/diagram/src/elements/diagram/themes/mergeTheme.ts

/**
 * Creates a DiagramTheme by spreading overrides onto a base theme.
 * Use for deep partial overrides without constructing the full theme object.
 */
export function mergeTheme(base: DiagramTheme, overrides: DeepPartial<DiagramTheme>): DiagramTheme;

/**
 * Creates a DiagramTheme with colorMode-derived label colors applied.
 *
 * All six built-in presets have explicit defaultLabelColor values, so
 * DiagramTheme.sceneTheme.colorMode has NO effect on label colors when
 * using a preset directly. This utility creates a new theme where
 * node.defaultLabelColor and node.defaultSublabelColor are set to
 * colorMode-appropriate defaults:
 *   'dark'  → '#e8eeff' (light label on dark background)
 *   'light' → '#1a1a2e' (dark label on light background)
 *
 * @example
 * const myTheme = withColorMode(darkGlassTheme, 'dark');
 * // myTheme.node.defaultLabelColor === '#e8eeff'
 *
 * // To also inherit font URL:
 * const myTheme2 = { ...withColorMode(darkGlassTheme, mySceneTheme.colorMode), sceneTheme: mySceneTheme };
 */
export function withColorMode(base: DiagramTheme, colorMode: SceneColorMode): DiagramTheme;
```

`withColorMode()` is exported from `@brewsite/diagram`.

### Custom theme authoring pattern

```typescript
import type { DiagramTheme } from '@brewsite/diagram';
import { darkGlassTheme } from '@brewsite/diagram';

const brandTheme: DiagramTheme = {
  ...darkGlassTheme,
  node: {
    ...darkGlassTheme.node,
    defaultColor: '#1a0a2e',
    defaultMetalness: 0.55,
    defaultEmissiveIntensity: 0.18,
  },
  edge: {
    ...darkGlassTheme.edge,
    defaultColor: '#ff6b35',
    routing: 'flow',
  },
  environment: {
    ...darkGlassTheme.environment,
    envMapUrl: '/assets/envmaps/brand.hdr',
  },
};
```

### Six preset themes

**`darkGlassTheme`** — Polished deep-navy intelligence. Node default color `#111a35`, metalness 0.65–0.75, roughness 0.25–0.35, `glowSpread: 2.2`. Edge color `#5040b0` (deep indigo-violet), flow color `#00c8f0` (electric cyan). Monochromatic cool-blue palette; `flowPulseIntensity: 0.9`. Group `defaultLabelColor: '#dce8ff'`. Environment HDR at `/assets/envmaps/diagram-default.hdr`, IBL intensity 0.9. Default icon style `extruded`. Palette: `['#4455aa', '#2266bb', '#7744cc', '#1188aa', '#335588', '#3dbccc', '#9966ff', '#44aadd']`.

**`midnightTheme`** — Warm authority; near-black with amber-gold accents. Node default color `#18140a`, metalness 0.28–0.38, roughness 0.40–0.52. Edge color `#c8851a` (amber), flow color `#f0b030` (gold). Matte-metal feel. Group `defaultLabelColor: '#f0e8d8'`. Environment HDR shared with darkGlass at reduced intensity. Default icon style `extruded`. Palette: `['#d08c20', '#c24840', '#d4ac30', '#2e8870', '#c05578', '#8a6028', '#6a8430', '#b84530']`.

**`neonCyberTheme`** — Electric violet + laser cyan with high emissive. Node default color `#060b1a`, metalness 0.60–0.70, roughness 0.10–0.18, emissive intensity 0.22, `glowSpread: 2.4`. Edge color `#7b2dff` (electric violet), flow color `#00eeff` (laser cyan). Two-color story: violet = structure, cyan = motion. Group `defaultLabelColor: '#b090ff'`. Same HDR as darkGlass at 0.6 intensity. `flowPulseIntensity: 0.95`. Palette: `['#7b2dff', '#00eeff', '#b855ff', '#00ccdd', '#5020cc', '#44ddee', '#9944ff', '#00aacc']`.

**`enterpriseTheme`** — Board-ready professional slate-blue. Node default color `#182844`, metalness 0.12–0.22, roughness 0.48–0.58, no glow. Edge color `#3a6aaa` (muted steel-blue), no flow animation by default. Flat arrows (`use3DArrows: false`). Group `defaultLabelColor: '#e8f0ff'`, `borderMetalness: 0.15`, `borderRoughness: 0.65`. Default icon style `flat`. HDR at 0.75 intensity. Palette: `['#3a5fa0', '#38766a', '#c87830', '#5a4e7a', '#2e7280', '#7a5c38', '#456040', '#7a3840']`.

**`lightCanvasTheme`** — Premium light; white ceramic nodes on warm-neutral gray background. Node default color `#ffffff`, metalness 0.03–0.06, roughness 0.52–0.66, `cornerRadius: 0.09`. Edge color `#3a5fa8` (slate-blue), flow color `#1a5fd8` (cobalt). No IBL (`envMapUrl: 'none'`). Group `defaultLabelColor: '#18202c'`. Jewel-tone palette: `['#3355cc', '#1a9966', '#cc3355', '#cc8800', '#6644bb', '#0088aa', '#996622', '#448822']`.

**`lightMinimalTheme`** — Flat documentation-grade light. Node default color `#eef2fc`, metalness 0.08, roughness 0.60, no emissive, no glow. `sideColorDarkenFactor: 0.10`, `borderColorLightenFactor: 0.15`. Edge color `#3060b0`, orthogonal routing, flat arrows. Group `defaultLabelColor: '#1a1a2e'`. `envMapUrl: 'none'`. Pastel light-mode palette preserved from v1.

### Palette system

When a node has no explicit `color` prop, `compile.ts` assigns a color from `DiagramTheme.palette` by round-robin based on the node's index in the DSL declaration order. If `palette` is undefined or empty, `DiagramThemeNodeConfig.defaultColor` is used for all uncolored nodes.

## Technical Considerations

### Compile-time boundary

`DiagramTheme` is consumed entirely within the compiler pipeline. `compile.ts` calls `buildThemeRenderConfig(theme)` to produce `DiagramThemeRenderConfig`, which is stored on `DiagramState.themeConfig`. From that point, `render.ts` and all renderer classes read only `DiagramThemeRenderConfig`. This keeps the full theme object — including layout defaults and palette — out of the rendering layer entirely.

### Color derivation for nodes

When `sideColor` or `borderColor` are not specified in `DiagramNodeDSL`, `compile.ts` derives them from the resolved node `color` using theme-configured factors:
- `sideColor`: `color * (1 - theme.node.sideColorDarkenFactor)` — defaults to 0.15 darken factor
- `borderColor`: `color * (1 + theme.node.borderColorLightenFactor)`, clamped — defaults to 0.25 lighten factor

These derivation functions are pure (no Three.js) and run at compile time. Explicit `sideColor` / `borderColor` props always override derivation.

### Environment map system

`EnvMapManager` in `rendering/EnvMapManager.ts` loads Radiance HDR files via `HDRLoader`. It maintains a module-level cache keyed on URL string. When `DiagramState.themeConfig.envMapUrl` changes between renders (e.g., a different diagram is shown), `EnvMapManager` loads the new HDR and applies it to `scene.environment`. The existing texture is released before the new one is applied. When `envMapUrl` is `null`, a procedural two-tone gradient sky is derived from `skyColor` and `horizonColor`. When `envMapUrl` is `'none'`, `scene.environment` is set to `null`.

### Tree-shaking

Each preset theme is in its own file under the `themes/` directory (e.g., `themes/darkGlass.ts`, `themes/enterprise.ts`, `themes/enterpriseLight.ts`, plus polarity variants like `themes/darkGlassLight.ts`). The barrel `themes/index.ts` re-exports only the enterprise presets (`enterpriseTheme`, `enterpriseLightTheme`, `defaultDiagramTheme`, `defaultLightDiagramTheme`), the theme registry functions, and composition helpers. Non-enterprise theme files (darkGlass, midnight, neonCyber, lightCanvas, lightMinimal and their polarity variants) exist in the directory but are not re-exported from the barrel — they are registered at runtime by `@brewsite/themes` via `registerDiagramThemePair()`. Each preset is a `const` object with no side effects. Each preset file contains a cross-package palette comment block listing the 8 shared accent colors, enabling code review to detect diagram/chart palette divergence.

### Per-Family Node and Edge Material Profiles

Each `ThemeFamily` defines a distinct PBR material profile for nodes and edges that expresses that family's visual character. Material profiles specify metalness, roughness, emissive intensity, and glow parameters for nodes; and metalness, roughness, and flow speed for edges.

The material profiles vary meaningfully across families:

- **Dark families** (darkGlass, midnight, neonCyber): higher emissive intensity on nodes to create depth contrast against dark backgrounds. `glowIntensity` is non-zero; `glowSpread` is sized to the family's characteristic halo radius.
- **Light families** (lightCanvas, lightMinimal): near-zero emissive intensity; no glow; higher roughness to produce diffuse ceramic/paper surface character.
- **Opposite-polarity variants**: when a dark-primary family (e.g. darkGlass) is rendered in its light polarity, its material profile shifts toward lower metalness and near-matte roughness — matching the inversion of the scene's ambient lighting character. When a light-primary family (e.g. lightCanvas) is rendered in its dark polarity, emissive intensity increases to maintain visual weight against a dark scene background.

Each polarity variant of a family is required to have a distinct, intentionally designed material profile. A light-polarity variant that copies the dark variant's PBR values does not meet the production-ready quality bar.

### Per-Family Motion and Interaction Profile Ranges

Each `ThemeFamily` defines characteristic motion and interaction parameter ranges for animated diagram elements. These ranges express the family's animation identity and ensure visual consistency when diagram scenes are composed with `@brewsite/charts` elements using the same family.

**Flow animation:** `edge.defaultFlowSpeed` and `edge.flowPulseIntensity` define the velocity and brightness of edge flow animations. Families with a high-energy character (neonCyber) use elevated flow speeds; families with deliberate, authoritative character (midnight, enterprise) use lower flow speeds. Light-polarity variants of dark families reduce flow speed and pulse intensity relative to their dark counterparts.

**Glow behavior:** `node.glowIntensity` and `node.glowSpread` define the soft-light halo rendered behind node geometry. Dark families with high-gloss aesthetics (darkGlass, neonCyber) use non-zero glow; documentary families (enterprise, lightMinimal) set `glowIntensity: 0` to suppress halo rendering entirely. The polarity variant must maintain consistent glow intent — a dark-glass-light polarity suppresses glow because glow halos are visually disruptive on pale backgrounds.

**Interaction hover:** `DiagramThemeNodeConfig`'s interaction-related fields (emissive boost on hover) and `DiagramThemeEdgeConfig.flowPulseIntensity` combine to define how "reactive" a diagram family feels on user interaction. High-energy families amplify interaction feedback; understated families keep hover states subtle.

All six families' preset `DiagramTheme` values for motion parameters are defined in the family art direction spec (`requirements/core/notes/note_theme-family-art-direction.md`). Polarity variants must conform to those per-polarity targets.

### Layout defaults in theme

`DiagramThemeLayoutConfig` provides fallback values for grid, hierarchical, manual, and flow layout when the `<Diagram>` DSL does not specify a layout child. All dimensional values in the theme — layout spacing, node size, thickness, cornerRadius, borderWidth, borderHeight — are NVS fractions of the diagram viewport width. The compile pipeline multiplies by `scaleFactor` (1.0 unless the layout exceeds [0..1]); the render pipeline multiplies by `uniformWorldW` to produce Three.js world units. `layoutResolver.ts` merges theme layout defaults with DSL-declared layout props, with DSL values taking precedence. This allows the theme to establish sensible spacing and padding defaults without requiring every diagram DSL to be verbose.

Default NVS layout values across themes:

| Theme | Grid spacing | Hier spacing | groupPadding | titleGap |
|---|---|---|---|---|
| Enterprise | `[0.06, 0.06]` | `[0.045, 0.045]` | `0.035` | `0.025` |
| DarkGlass | `[0.04, 0.04]` | `[0.045, 0.045]` | `0.035` | `0.03` |
| NeonCyber | `[0.06, 0.06]` | `[0.045, 0.045]` | `0.035` | `0.025` |
| Midnight | `[0.05, 0.05]` | `[0.045, 0.045]` | `0.035` | `0.03` |
| LightMinimal | `[0.06, 0.06]` | `[0.045, 0.045]` | `0.035` | `0.025` |
| LightCanvas | `[0.06, 0.06]` | `[0.045, 0.045]` | `0.035` | `0.025` |

All themes share: `defaultSize: [0.15, 0.08]`, `margin: 0`, `flow.gap: 0.06`.

### Input defaults in theme

`DiagramTheme.input` is reserved for future canvas-level default input configuration. As of the current implementation, a standalone `<Diagram>` that declares `theme.input` will receive an `IGNORED_INPUT_CONFIG` compiler warning. The field exists in the type for forward-compatibility but is not consumed by `DiagramWidget` or the current compiler handler. Scene authors should use `<InputController>` with `<Action type="diagram-canvas.*">` for canvas interaction instead.

The `IGNORED_INPUT_CONFIG` warning is surfaced via `SceneTrack.warnings` and forwarded to any `onCompileWarning` handler registered on `ScenePlayer`.

## SceneTheme Integration

### Automatic SceneTheme Bridge (Compile Pipeline)

The diagram compile handler in `compiler/handlers.ts` automatically bridges `SceneSnapshotContext.sceneTheme` into the resolved `DiagramTheme` at compile time. When the engine provides a `SceneTheme` via `CompileSceneTrackOptions.sceneTheme` (an optional field on `@brewsite/core`'s compile options), the value propagates through:

1. `CompileSceneTrackOptions.sceneTheme` → `SceneSnapshotContext.sceneTheme` (populated during scene frame compilation)
2. The diagram handler reads `api.context.sceneTheme` and merges it: `{ ...resolvedTheme, sceneTheme: api.context.sceneTheme }`
3. The merged theme is passed to `compileDiagram()`, which calls `buildThemeRenderConfig()` to derive font URL and effective font size factors

This means consumers who configure `SceneTheme` at the engine level (via `useSceneEngine({ sceneTheme })` or `ScenePlayer sceneTheme` prop) get automatic font and sizing integration in all diagrams — no manual `DiagramTheme.sceneTheme` wiring required. Manual `sceneTheme` on `DiagramTheme` still works as before and takes precedence if both are present.

The cache key for `SceneTrack` includes `sceneTheme.font.webglFontUrl`, `sceneTheme.fontSize.label`, and `sceneTheme.fontSize.caption` — the three fields that affect diagram compilation output. Changing these values at runtime triggers recompilation.

### fontUrl fallback chain

`buildThemeRenderConfig(theme)` resolves font URL as:
```
theme.fontUrl ?? theme.sceneTheme?.font.webglFontUrl → undefined
```

`theme.fontUrl` (on the `DiagramTheme` root) takes precedence — the `sceneTheme` field provides a fallback, not an override. The resolved `fontUrl` applies to all troika-rendered text in the diagram: node labels, node sublabels, and group title labels.

### Font size scale composition

When `theme.sceneTheme` is set, `buildThemeRenderConfig` computes:
- `effectiveLabelSizeFactor = theme.node.labelSizeFactor × (sceneTheme.fontSize.label ?? 1.0)`
- `effectiveSublabelSizeFactor = theme.node.sublabelSizeFactor × (sceneTheme.fontSize.caption ?? 1.0)`

`NodeRenderer` and `GroupRenderer` use these effective values instead of the raw `labelSizeFactor` fields when they are present.

### colorMode and label colors — the `withColorMode()` escape hatch

`sceneTheme.colorMode` drives label color defaults **only** when `DiagramThemeNodeConfig.defaultLabelColor` is absent. All six built-in presets have explicit values, so colorMode has no effect on them directly.

To create a preset-derived theme with colorMode-driven label colors, use `withColorMode()`:

```typescript
import { darkGlassTheme, withColorMode } from '@brewsite/diagram';
import { darkSceneTheme } from '@brewsite/core';

// colorMode-derived label colors + font URL from sceneTheme:
const myTheme = {
  ...withColorMode(darkGlassTheme, 'dark'),
  sceneTheme: darkSceneTheme,
};
```

### DiagramTheme.background — deferred to v2

`DiagramTheme` does not have a `background` field in v1. A `DiagramTheme` cannot drive the scene's DOM `<Background>` element in this release. Pair `<Background>` and `<DiagramCanvas>` manually:

```tsx
<Scene key="diagram-scene">
  <Background theme={darkSceneTheme} />
  <DiagramCanvas theme={{ ...darkGlassTheme, sceneTheme: darkSceneTheme }} />
</Scene>
```

## Known Limitations

1. **`sceneTheme.colorMode` has no effect on built-in preset label colors without `withColorMode()`.** All six built-in DiagramTheme presets have explicit `defaultLabelColor` and `defaultSublabelColor` values. Use `withColorMode(preset, colorMode)` to create a preset with colorMode-derived label colors.

2. **WebGL font URL must be MSDF-encoded.** Standard web font URLs will not render correctly in troika-three-text.

3. **`DiagramTheme.background` field is deferred to v2.** The scene background must be configured separately via `<Background>`.

4. **`withColorMode()` produces colorMode-appropriate label colors only.** Node PBR material values (metalness, roughness, emissive intensity, glow) are not adjusted by `withColorMode()` — it only updates `defaultLabelColor` and `defaultSublabelColor`. For a fully correct polarity-switched theme, use `resolveDiagramTheme(family, polarity)` rather than `withColorMode()` on a preset, as the resolved pair entry carries a fully designed material profile for the opposite polarity.

## Breaking Change Assessment

**Semver impact: major.** The 2026-03-08 changes constitute breaking API changes to `DiagramThemeNodeConfig`, `DiagramThemeEdgeConfig`, `DiagramThemeGroupConfig`, `DiagramTheme`, and `DiagramThemeRenderConfig`:

- `fontUrl` removed from `DiagramThemeNodeConfig` and added to `DiagramTheme` root — any custom theme with `node: { ...preset.node, fontUrl: '...' }` must change to `{ ...preset, fontUrl: '...' }`.
- New **required** fields on `DiagramThemeNodeConfig`: `defaultSize`, `defaultIconScale`, `defaultIconDepth`, `glowSpread` — any custom theme that constructs `node` from scratch rather than spreading a preset will fail TypeScript strict mode.
- New **required** fields on `DiagramThemeEdgeConfig`: `tubeRadialSegments`, `organicVariation`.
- New **required** fields on `DiagramThemeGroupConfig`: `borderMetalness`, `borderRoughness`, `borderSideDarken`, `borderEdgeDarken`.
- `DiagramThemeRenderConfig` gains `nodeGlowSpread`, `edgeTubeRadialSegments`, `groupBorderMetalness`, `groupBorderRoughness`, `groupBorderSideDarken`, `groupBorderEdgeDarken` — consumers who construct `DiagramThemeRenderConfig` directly will fail TypeScript; the only supported path is via `buildThemeRenderConfig(theme)`.

**All six preset themes (`darkGlassTheme`, `midnightTheme`, `neonCyberTheme`, `enterpriseTheme`, `lightCanvasTheme`, `lightMinimalTheme`) include explicit values for every required field.** Custom themes that spread from any preset and override only specific sub-configs compile correctly without modification (spread semantics preserve all required fields).

**Post-2026-03-08 additions (additional required and optional fields):**
- New required field on `DiagramThemeNodeConfig`: `defaultLabelPadding` — any custom theme constructed from scratch (not spread from a preset) must add this field.
- New optional fields on `DiagramThemeNodeConfig`: `nodeEnvMapIntensity`, `defaultBoxColor` — spread-based themes inherit defaults; no migration required.
- New required fields on `DiagramThemeEdgeConfig`: `flowTurnRadius`, `flowFaceStub`, `flowBundleStrength`, `flowObstaclePadding`, `flowTargetApproachBias`, `flowUnderpassDepth`, `flowUnderpassClearance`, `flowTurnPenalty`, `flowPunchthroughPenalty`, `flowUnderpassPenalty` — custom themes constructed from scratch must add these fields.
- New optional field on `DiagramTheme`: `sdfGlyphSize` — no migration required.
- New fields on `DiagramThemeRenderConfig`: `nodeEnvMapIntensity`, `nodeSdfGlyphSize`, `nodeLabelPadding` — consumers constructing `DiagramThemeRenderConfig` directly (which is not a supported pattern) must add these; use `buildThemeRenderConfig(theme)` instead.

**Theme registry migration:** The flat `DIAGRAM_THEMES` and `DIAGRAM_THEME_PAIRS` constants have been replaced by the registration-based `registerDiagramThemePair()` / `resolveDiagramTheme()` API. Non-enterprise themes are no longer directly exported from the `@brewsite/diagram` barrel — they are registered at runtime by `@brewsite/themes`.

**Visual breaking change:** The palette values for `darkGlass`, `neonCyber`, and `enterprise` themes have changed. Scenes tuned to the previous preset colors will see different visual output after upgrade. `DiagramTheme` preset palette values are product content, not API contracts; visual changes are documented in the CHANGELOG but do not require code migration.

For future changes:
- Adding an optional field: **minor** bump
- Adding a required field: **major** bump (breaks all non-spread custom theme constructions)
- Renaming or removing a field: **major** bump

## Dependencies

- `compiler/themeResolver.ts` — pure derivation of `DiagramThemeRenderConfig` from `DiagramTheme`
- `rendering/EnvMapManager.ts` — HDR loading and scene environment application (Three.js)
- `rendering/HDRLoader.ts` — Radiance HDR parser (wraps Three.js `RGBELoader`)
- No new external npm packages

## Risks and Mitigations

**API regret — required fields:** Every field in the four sub-configs is required. This means adding a new required field to any sub-config breaks every custom theme that spreads from a preset. Mitigation: always introduce new theme fields as optional. Document this rule in the contributing guide.

**HDR loading latency:** The default HDR file at `/assets/envmaps/diagram-default.hdr` is shared across all four themes that use it. If the file is large, it adds perceived loading time. Mitigation: the environment map cache prevents duplicate loads; consumers can substitute a lower-resolution HDR or set `envMapUrl: null` for procedural sky at lower visual fidelity.

**Bundle size from unused presets:** All six preset files are small (< 2 KB each). The risk is minimal. Tree-shaking by bundler should remove unused presets automatically given the side-effect-free `const` exports.

## Open Questions

- Should `DiagramThemeLayoutConfig` be promoted to a required field on `DiagramTheme` (with sensible defaults) rather than optional? Making it required would simplify `layoutResolver.ts` by removing the undefined checks, but breaks any custom theme authored before the field existed. No decision made yet; field remains optional.

## Launch Criteria

**Shipped (original theming system and redesign):**
- [x] Enterprise preset themes (`enterpriseTheme`, `enterpriseLightTheme`, `defaultDiagramTheme`, `defaultLightDiagramTheme`) exported from `@brewsite/diagram` package `index.ts`.
- [x] Registration-based theme API (`registerDiagramThemePair`, `resolveDiagramTheme`, `DiagramThemePair` type) exported from `@brewsite/diagram`.
- [x] `DiagramTheme`, `DiagramThemeNodeConfig`, `DiagramThemeEdgeConfig`, `DiagramThemeGroupConfig`, `DiagramThemeEnvironmentConfig`, `DiagramThemeLayoutConfig`, `DiagramThemeRenderConfig` all exported from `@brewsite/diagram`.
- [x] `buildThemeRenderConfig` unit tested in `compiler/__tests__/themeResolver.test.ts`.
- [x] At least one example scene in `apps/examples/` demonstrates switching between two presets.
- [x] TypeScript strict-mode typecheck passes on the themes package directory.

**Shipped (theming overhaul — polarity pairs):**
- [x] `DiagramThemeName` is a type alias for `ThemeFamily` from `@brewsite/core` (internal to types.ts, not exported from package root).
- [x] `DiagramThemePair` type, `registerDiagramThemePair`, and `resolveDiagramTheme` exported from `@brewsite/diagram`.
- [x] 'default' and 'enterprise' theme families pre-loaded in the registry at module init.
- [x] TypeScript strict-mode typecheck passes for all theme files.

**Shipped (theme family art direction — polarity variants):**
- [x] All six polarity-variant `DiagramTheme` preset files carry production-quality aesthetic values; no placeholder or sibling-theme reuse remains.
- [x] All 12 `DiagramTheme` variants (6 canonical + 6 opposite-polarity) exist as files in the themes/ directory.
- [x] Non-enterprise themes are registered at runtime by `@brewsite/themes` via `registerDiagramThemePair()`.
- [x] Each polarity variant carries a fully designed node/edge PBR material profile and palette distinct from its family sibling.
- [x] Per-family motion and interaction parameter targets (flow speed, pulse intensity, glow) are reflected in preset values.

---
title: "BrewSite Diagram — Theming System"
doc_type: prd
status: active
owner: brewsite-product-manager
last_updated: 2026-03-12
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
    summary: "Model/diagram overhaul: added required fields to DiagramThemeNodeConfig (defaultSize, defaultIconScale, defaultIconDepthFactor, glowSpread); added required fields to DiagramThemeEdgeConfig (tubeRadialSegments, organicVariation); added required fields to DiagramThemeGroupConfig (borderMetalness, borderRoughness, borderSideDarken, borderEdgeDarken); added corresponding render-time fields to DiagramThemeRenderConfig (nodeGlowSpread, edgeTubeRadialSegments, groupBorderMetalness, groupBorderRoughness, groupBorderSideDarken, groupBorderEdgeDarken); fontUrl promoted from DiagramThemeNodeConfig to DiagramTheme root level; all four preset themes updated with explicit values for every new required field; resolved both open questions; updated Breaking Change Assessment to major semver impact; removed Known Limitation #2."
  - date: 2026-03-11
    author: "Toolkit Product"
    summary: "Theme redesign: expanded canonical theme set from four to six names, adding midnight (warm dark) and lightCanvas (premium light). All four existing presets redesigned with coherent palettes; two new presets added. Introduced DiagramThemeName union type and DIAGRAM_THEMES keyed registry. Added string name API for <Diagram theme='...'> (non-breaking union widening). All six presets carry an 8-color accent palette coordinated with @brewsite/charts via cross-package comment blocks. Version bump: minor."
  - date: 2026-03-11
    author: "Toolkit Product"
    summary: "Theming overhaul — polarity pairs: DiagramThemeName is now a type alias for ThemeFamily (imported from @brewsite/core), maintaining backward compatibility while tying the type to the canonical cross-package union. Added DIAGRAM_THEME_PAIRS registry (Record<ThemeFamily, DiagramThemePair>) — each entry pre-wired with the corresponding SceneTheme from SCENE_THEME_PAIRS. Six polarity-variant DiagramTheme files added as @internal placeholders (darkGlassLight, enterpriseLight, midnightLight, neonCyberLight, lightCanvasDark, lightMinimalDark); production aesthetic authoring deferred to a follow-on story. DIAGRAM_THEMES flat registry unchanged; no breaking changes. Version bump: minor."
  - date: 2026-03-12
    author: "Toolkit Product"
    summary: "Theme family art direction: all six polarity-variant DiagramTheme presets promoted from @internal placeholders to production-ready public exports. Each polarity variant carries fully designed node/edge PBR material profiles, label colors, palette, and motion/interaction parameters distinct to its family and polarity — no sibling-theme reuse. DIAGRAM_THEME_PAIRS and DIAGRAM_THEMES both export all 12 variants. Added Technical Considerations section covering per-family node and edge material profiles and per-family motion and interaction profile ranges."
---

## Overview

The theming system in `@brewsite/diagram` provides the complete design language for diagram visualization. A `DiagramTheme` is a plain TypeScript object — no React, no Three.js — that configures default colors, PBR material properties, layout behavior, edge routing algorithms, environment map, and optional cross-package scene theme integration for all elements within a diagram. Six preset themes ship with the package, corresponding to the six canonical `DiagramThemeName` values: `darkGlass`, `midnight`, `neonCyber`, `enterprise`, `lightCanvas`, and `lightMinimal`. Consumers can reference presets by string name (`<Diagram theme="darkGlass">`) or by importing the full theme object. Custom themes are authored by spreading a preset and overriding specific sub-configs. The `withColorMode()` utility creates a theme variant with colorMode-derived label colors. The system affects `@brewsite/diagram`.

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
- Switching between any two preset themes in a demo scene requires only a prop change to `<Diagram theme="...">` (string name) or `<Diagram theme={themeObject}>`

**Guardrail metrics:**
- Adding a new optional field to any sub-config is a minor version bump; removing or renaming a field is a major version bump
- Any new required field must be added to all six preset themes simultaneously with a major version bump

## Non-Goals

- Runtime theme switching with animated transitions between theme values
- CSS-in-JS or design token integration — themes are TypeScript objects only
- Per-scene theme diffing or partial merge semantics at the `DiagramCanvas` level (the canvas `theme` prop is a full fallback, not a partial merge)
- Dark/light mode detection or media query integration — consumers select themes explicitly

## Consumer Stories

- As a toolkit consumer, I want to pass a theme name string to `<Diagram theme="darkGlass">` so that all my nodes, edges, and groups adopt a consistent visual style without importing or constructing a theme object.
- As a toolkit consumer, I want to spread a preset and override specific fields so that I can create a brand-aligned custom theme with minimal boilerplate.
- As a toolkit consumer, I want to specify a custom HDR URL in a theme so that my diagram uses my own lighting environment without forking the theme.
- As a toolkit consumer, I want themes to be individually importable so that my bundle only includes the preset I use.

## Functional Requirements

1. The `DiagramTheme` type shall be a plain TypeScript interface with no runtime dependencies.
2. The six preset themes (`darkGlassTheme`, `midnightTheme`, `neonCyberTheme`, `enterpriseTheme`, `lightCanvasTheme`, `lightMinimalTheme`) shall be exported as named constants from `@brewsite/diagram`.
3. Each preset shall be declared `as const` so that TypeScript infers narrow literal types.
4a. A `DiagramThemeName` union type (`'darkGlass' | 'midnight' | 'neonCyber' | 'enterprise' | 'lightCanvas' | 'lightMinimal'`) shall be exported from `@brewsite/diagram`.
4b. A `DIAGRAM_THEMES: Record<DiagramThemeName, DiagramTheme>` keyed registry shall be exported from `@brewsite/diagram`, enabling compile-time and runtime lookup by name.
4c. The `theme?` prop on `DiagramProps` (the `<Diagram>` DSL element) shall accept `DiagramThemeName | DiagramTheme`. String name inputs are resolved to the full `DiagramTheme` object via `DIAGRAM_THEMES` at compile time. Existing call sites that pass a `DiagramTheme` object are unaffected.
4. The `DiagramThemeRenderConfig` struct shall be derived from `DiagramTheme` at compile time by `buildThemeRenderConfig()` in `compiler/themeResolver.ts`.
5. `render.ts` and `EdgeRenderer` shall read only `DiagramThemeRenderConfig` — never the full `DiagramTheme`.
6. Theme resolution shall run once per diagram compile call, not per frame.
7. The canvas-level `theme` prop on `<DiagramCanvas>` shall serve as the fallback when a `<Diagram>` has no `theme` prop.
8. Per-node and per-edge props shall always override the resolved theme default for their specific property.
9. Environment map caching shall key on `envMapUrl` string so that multiple diagrams sharing the same HDR URL never load it twice.
10. When `envMapUrl` is `'none'`, no environment map shall be applied and no HDR fetch shall be initiated.

## API Design

### DiagramThemeName, DIAGRAM_THEMES, and DIAGRAM_THEME_PAIRS

```typescript
// packages/diagram/src/elements/diagram/types.ts

/**
 * Type alias for ThemeFamily from @brewsite/core.
 * Maintained for backward compatibility — existing code referencing DiagramThemeName compiles identically.
 * The union values and their string literals are unchanged.
 */
import type { ThemeFamily } from '@brewsite/core';
export type DiagramThemeName = ThemeFamily;
```

```typescript
// packages/diagram/src/elements/diagram/themes/index.ts

export const DIAGRAM_THEMES: Record<DiagramThemeName, DiagramTheme>;

/**
 * Dark/light pair type for a DiagramTheme family.
 * Each entry is a complete DiagramTheme pre-wired with its corresponding SceneTheme
 * from SCENE_THEME_PAIRS — consumers need not manually attach sceneTheme.
 */
export type DiagramThemePair = {
  readonly dark: DiagramTheme;
  readonly light: DiagramTheme;
};

/**
 * Registry of DiagramTheme pairs for all six ThemeFamily values.
 * Each entry's dark/light DiagramThemes are pre-wired with the matching SceneTheme
 * from @brewsite/core's SCENE_THEME_PAIRS.
 *
 * All twelve entries carry production-quality aesthetic values. Both polarities for every
 * ThemeFamily are publicly exported and production-ready for use in shipped scenes.
 * Each polarity variant has a fully designed node/edge material profile and palette;
 * no entry reuses a sibling-theme's values as a placeholder.
 *
 * @example
 * import { DIAGRAM_THEME_PAIRS } from '@brewsite/diagram';
 * const theme = DIAGRAM_THEME_PAIRS['darkGlass']['light'];
 * // theme.sceneTheme is pre-wired — no manual attachment needed
 */
export const DIAGRAM_THEME_PAIRS: Record<ThemeFamily, DiagramThemePair>;
```

The `<Diagram>` DSL `theme` prop accepts either form:

```tsx
// String name (resolved via DIAGRAM_THEMES at compile time):
<Diagram theme="darkGlass">...</Diagram>

// Full object (existing pattern — still valid):
import { darkGlassTheme } from '@brewsite/diagram';
<Diagram theme={darkGlassTheme}>...</Diagram>
```

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
  readonly defaultMetalness: number;
  readonly defaultRoughness: number;
  readonly defaultEmissiveIntensity: number;
  readonly defaultThickness: number;
  /** Default node width and height in diagram units for AutoLayout. ManualLayout always requires explicit size. */
  readonly defaultSize: readonly [number, number];
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
   * Only applies when iconStyle !== 'flat'. Coordinate-system-invariant.
   */
  readonly defaultIconDepthFactor: number;
  /** Default 3D icon extrusion depth in canvas world units. Per-node iconDepth overrides this. */
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
}

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
  /** Number of sides in tube cross-section polygon. Higher values produce smoother tube silhouettes. */
  readonly tubeRadialSegments: number;
  /** Perpendicular offset magnitude for 'organic' routing variation. 0 = no variation, 3 = extreme. */
  readonly organicVariation: number;
  /** Peak brightness multiplier applied to the flow pulse shader. Range: 0–2. Default: 0.9. */
  readonly flowPulseIntensity: number;
}

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
  readonly nodeGlowIntensity: number;
  /** Resolved from DiagramThemeNodeConfig.glowSpread. Controls glow sprite radius multiplier. */
  readonly nodeGlowSpread: number;
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
    routing: 'orthogonal',
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

Each preset theme is in its own file (`themes/darkGlass.ts`, `themes/midnight.ts`, `themes/neonCyber.ts`, `themes/enterprise.ts`, `themes/lightCanvas.ts`, `themes/lightMinimal.ts`). The barrel `themes/index.ts` re-exports all six alongside the `DIAGRAM_THEMES` registry. Consumers importing a single preset directly from their source path allow bundlers to tree-shake unused presets. Each preset is a `const` object with no side effects. Each preset file contains a cross-package palette comment block listing the 8 shared accent colors, enabling code review to detect diagram/chart palette divergence.

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

`DiagramThemeLayoutConfig` provides fallback values for grid, hierarchical, and manual layout when the `<Diagram>` DSL does not specify a layout child. `layoutResolver.ts` merges theme layout defaults with DSL-declared layout props, with DSL values taking precedence. This allows the theme to establish sensible spacing and padding defaults without requiring every diagram DSL to be verbose.

### Input defaults in theme

`DiagramTheme.input` carries default input action configuration for a `<DiagramCanvas>`. At compile time, the `DiagramCanvas` compiler handler reads `theme.input.defaultActions`, injects `canvasId` (from the `<DiagramCanvas id="...">` prop) into each action spec, and stores the result as `DiagramCanvasState.defaultInputActions`. This compiled value is consumed at runtime by `DiagramCanvasWidget`, which implements `IInputDefaultProvider` from `@brewsite/core`. The player layer reads all `IInputDefaultProvider` widgets each frame via `WidgetRegistry.getInputDefaultProviders()` and applies their actions when no explicit `<InputController>` is present in the current scene.

**Scope constraint:** `input` is only effective on a `<DiagramCanvas theme={...}>` — not on a child `<Diagram>` or a standalone `<Diagram>`. The compiler emits a `IGNORED_INPUT_CONFIG` warning in both invalid cases:

- `<Diagram id="...">` nested inside a `<DiagramCanvas>` has `theme.input` — the diagram-level input is ignored; move it to the `<DiagramCanvas theme={...}>`.
- A standalone `<Diagram>` (not wrapped in `<DiagramCanvas>`) has `theme.input` — ignored; only a canvas can dispatch default input actions.

The `IGNORED_INPUT_CONFIG` warning is surfaced via `SceneTrack.warnings` and forwarded to any `onCompileWarning` handler registered on `ScenePlayer`.

## SceneTheme Integration

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

4. **`withColorMode()` produces colorMode-appropriate label colors only.** Node PBR material values (metalness, roughness, emissive intensity, glow) are not adjusted by `withColorMode()` — it only updates `defaultLabelColor` and `defaultSublabelColor`. For a fully correct polarity-switched theme, use a `DIAGRAM_THEME_PAIRS` entry rather than `withColorMode()` on a preset, as the pair entry carries a fully designed material profile for the opposite polarity.

## Breaking Change Assessment

**Semver impact: major.** The 2026-03-08 changes constitute breaking API changes to `DiagramThemeNodeConfig`, `DiagramThemeEdgeConfig`, `DiagramThemeGroupConfig`, `DiagramTheme`, and `DiagramThemeRenderConfig`:

- `fontUrl` removed from `DiagramThemeNodeConfig` and added to `DiagramTheme` root — any custom theme with `node: { ...preset.node, fontUrl: '...' }` must change to `{ ...preset, fontUrl: '...' }`.
- New **required** fields on `DiagramThemeNodeConfig`: `defaultSize`, `defaultIconScale`, `defaultIconDepthFactor`, `glowSpread` — any custom theme that constructs `node` from scratch rather than spreading a preset will fail TypeScript strict mode.
- New **required** fields on `DiagramThemeEdgeConfig`: `tubeRadialSegments`, `organicVariation`.
- New **required** fields on `DiagramThemeGroupConfig`: `borderMetalness`, `borderRoughness`, `borderSideDarken`, `borderEdgeDarken`.
- `DiagramThemeRenderConfig` gains `nodeGlowSpread`, `edgeTubeRadialSegments`, `groupBorderMetalness`, `groupBorderRoughness`, `groupBorderSideDarken`, `groupBorderEdgeDarken` — consumers who construct `DiagramThemeRenderConfig` directly will fail TypeScript; the only supported path is via `buildThemeRenderConfig(theme)`.

**All six preset themes (`darkGlassTheme`, `midnightTheme`, `neonCyberTheme`, `enterpriseTheme`, `lightCanvasTheme`, `lightMinimalTheme`) include explicit values for every required field.** Custom themes that spread from any preset and override only specific sub-configs compile correctly without modification (spread semantics preserve all required fields).

**String name API addition (non-breaking):** The `theme?` prop on `DiagramProps` changed from `DiagramTheme | undefined` to `DiagramThemeName | DiagramTheme | undefined`. This is a union widening — existing call sites that pass a `DiagramTheme` object compile identically. TypeScript discriminates the union cleanly: string literals satisfy `DiagramThemeName`; objects satisfy `DiagramTheme`.

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
- [x] All six preset themes exported from `@brewsite/diagram` package `index.ts`; `DiagramThemeName` and `DIAGRAM_THEMES` also exported.
- [x] `DiagramTheme`, `DiagramThemeNodeConfig`, `DiagramThemeEdgeConfig`, `DiagramThemeGroupConfig`, `DiagramThemeEnvironmentConfig`, `DiagramThemeLayoutConfig`, `DiagramThemeRenderConfig` all exported from `@brewsite/diagram`.
- [x] `buildThemeRenderConfig` unit tested in `compiler/__tests__/themeResolver.test.ts`.
- [x] At least one example scene in `apps/examples/` demonstrates switching between two presets.
- [x] TypeScript strict-mode typecheck passes on the themes package directory.

**Shipped (theming overhaul — polarity pairs):**
- [x] `DiagramThemeName` is a type alias for `ThemeFamily` from `@brewsite/core`. Backward compat: all existing `DiagramThemeName` usages compile without change.
- [x] `DiagramThemePair` type and `DIAGRAM_THEME_PAIRS` registry exported from `@brewsite/diagram`.
- [x] All six `DIAGRAM_THEME_PAIRS` entries are pre-wired with corresponding `SceneTheme` from `SCENE_THEME_PAIRS`.
- [x] TypeScript strict-mode typecheck passes for all new theme files.

**Shipped (theme family art direction — polarity variants):**
- [x] All six polarity-variant `DiagramTheme` presets carry production-quality aesthetic values; no placeholder or sibling-theme reuse remains.
- [x] All 12 `DiagramTheme` variants (6 canonical + 6 opposite-polarity) publicly exported from `@brewsite/diagram`.
- [x] Each polarity variant carries a fully designed node/edge PBR material profile and palette distinct from its family sibling.
- [x] Per-family motion and interaction parameter targets (flow speed, pulse intensity, glow) are reflected in preset values.

**Follow-on (not yet shipped — tracked separately):**
- [ ] README documents `DIAGRAM_THEME_PAIRS` usage pattern with cross-package consumer example.

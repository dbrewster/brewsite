---
title: "BrewSite Diagram — Theming System"
doc_type: prd
status: active
owner: brewsite-product-manager
last_updated: 2026-03-03
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
---

## Overview

The theming system in `@brewsite/diagram` provides the complete design language for diagram visualization. A `DiagramTheme` is a plain TypeScript object — no React, no Three.js — that configures default colors, PBR material properties, layout behavior, edge routing algorithms, and environment map for all elements within a diagram. Four preset themes ship with the package. Consumers create custom themes by composing the full `DiagramTheme` struct, typically by spreading an existing preset and overriding specific sub-configs. The system affects `@brewsite/diagram` exclusively.

## Problem Statement

Diagram elements expose dozens of configurable properties across nodes, edges, and groups. Without a centralized theme contract, consumers must specify material values, colors, and routing preferences on every individual element — an authoring burden that also makes global style changes (e.g., switching from dark to light presentation context) require edits across every scene file. The theme system resolves this by making the preset the default for all unspecified fields, with a clear and documented override hierarchy.

## Goals and Success Metrics

**Primary goals:**
- A consumer can change the visual character of a complete diagram by passing a single theme object, with no per-node or per-edge edits required
- All four preset themes produce visually coherent output without additional configuration
- The theme type is fully statically typed so TypeScript catches partial or malformed custom themes at authoring time
- The theme object is pure data: no runtime cost when the diagram is not rendered

**Success metrics:**
- All four presets pass a visual smoke test (screenshot comparison) in the CI pipeline
- TypeScript strict-mode type check passes on all theme exports
- Switching between any two preset themes in a demo scene requires only a prop change to `<Diagram theme={...}>`

**Guardrail metrics:**
- No new required fields added to `DiagramTheme` or its sub-configs without a deprecation window
- Adding a new optional field to any sub-config is a minor version bump; removing or renaming a field is a major version bump

## Non-Goals

- Runtime theme switching with animated transitions between theme values
- CSS-in-JS or design token integration — themes are TypeScript objects only
- Per-scene theme diffing or partial merge semantics at the `DiagramCanvas` level (the canvas `theme` prop is a full fallback, not a partial merge)
- Dark/light mode detection or media query integration — consumers select themes explicitly

## Consumer Stories

- As a toolkit consumer, I want to pass a single preset theme to `<Diagram>` so that all my nodes, edges, and groups adopt a consistent visual style without per-element configuration.
- As a toolkit consumer, I want to spread a preset and override specific fields so that I can create a brand-aligned custom theme with minimal boilerplate.
- As a toolkit consumer, I want to specify a custom HDR URL in a theme so that my diagram uses my own lighting environment without forking the theme.
- As a toolkit consumer, I want themes to be individually importable so that my bundle only includes the preset I use.

## Functional Requirements

1. The `DiagramTheme` type shall be a plain TypeScript interface with no runtime dependencies.
2. The four preset themes (`darkGlassTheme`, `neonCyberTheme`, `enterpriseTheme`, `lightMinimalTheme`) shall be exported as named constants from `@brewsite/diagram`.
3. Each preset shall be declared `as const` so that TypeScript infers narrow literal types.
4. The `DiagramThemeRenderConfig` struct shall be derived from `DiagramTheme` at compile time by `buildThemeRenderConfig()` in `compiler/themeResolver.ts`.
5. `render.ts` and `EdgeRenderer` shall read only `DiagramThemeRenderConfig` — never the full `DiagramTheme`.
6. Theme resolution shall run once per diagram compile call, not per frame.
7. The canvas-level `theme` prop on `<DiagramCanvas>` shall serve as the fallback when a `<Diagram>` has no `theme` prop.
8. Per-node and per-edge props shall always override the resolved theme default for their specific property.
9. Environment map caching shall key on `envMapUrl` string so that multiple diagrams sharing the same HDR URL never load it twice.
10. When `envMapUrl` is `'none'`, no environment map shall be applied and no HDR fetch shall be initiated.

## API Design

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
   * Optional default input handler configuration for DiagramCanvas.
   * Only effective when applied to a <DiagramCanvas theme={...}>.
   * Ignored (with a compile-time warning) when placed on a child <Diagram>.
   */
  readonly input?: DiagramCanvasInputConfig;
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
  readonly cornerRadius: number;
  readonly glowIntensity: number;
  readonly defaultLabelColor: string;
  readonly defaultSublabelColor: string;
  readonly fontUrl?: string;
  readonly labelSizeFactor: number;
  readonly sublabelSizeFactor: number;
  readonly defaultIconStyle: SvgIcon3DStyle;
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
}

export interface DiagramThemeEnvironmentConfig {
  readonly envMapUrl: string | null | 'none';
  readonly envMapIntensity: number;
  readonly skyColor: string;
  readonly horizonColor: string;
}

export interface DiagramThemeLayoutConfig {
  readonly defaultKind?: 'grid' | 'hierarchical' | 'manual';
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
  readonly nodeCornerRadius: number;
  readonly use3DArrows: boolean;
  readonly edgeSmoothness: number;
  readonly edgeMetalness: number;
  readonly edgeRoughness: number;
  readonly edgeFlowSpeed: number;
  readonly edgeFlowWidth: number;
  readonly fontUrl: string | undefined;
}
```

### Theme builder (compiler/themeResolver.ts)

```typescript
export function buildThemeRenderConfig(theme: DiagramTheme): DiagramThemeRenderConfig;
export function compileExitConfig(dsl: DiagramExitDSL | undefined): DiagramExitConfig | null;
export function compileEnterConfig(dsl: DiagramEnterDSL | undefined): DiagramEnterConfig | null;
```

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

### Four preset themes

**`darkGlassTheme`** — Default theme. Deep navy nodes (`#1a2240`), metalness 0.40, roughness 0.30, emissive intensity 0.10. Edge color purple (`#702dc6`), flow color green (`#53ec68`), curved routing, nearest-face landing, 3D arrows enabled. Environment HDR at `/assets/envmaps/diagram-default.hdr`, IBL intensity 0.9. Default icon style `extruded`. Palette: `['#2a4fa0', '#1e7a5a', '#8a2a70', '#a06a20', '#2a8090']`.

**`neonCyberTheme`** — Near-black nodes (`#0a0e1a`), metalness 0.55, roughness 0.20, emissive intensity 0.22, strong glow (0.55). Edge color cyan (`#00ccff`), orthogonal routing, 3D arrows enabled. Neon label colors (`#00ffcc`). Same HDR as darkGlass at 0.6 intensity. Palette: neon spectrum.

**`enterpriseTheme`** — Professional blue nodes (`#1e3a6e`), metalness 0.25, roughness 0.45, no glow (0.0). Edge color `#4a7abf`, curved routing, flat arrows (`use3DArrows: false`). Default icon style `flat`. HDR at 0.75 intensity. No `palette` defined.

**`lightMinimalTheme`** — Light background nodes (`#eef2fc`), metalness 0.08, roughness 0.60, no emissive, no glow. Edge color `#3060b0`, orthogonal routing, flat arrows. Environment map disabled (`envMapUrl: 'none'`). Default icon style `flat`. Suited for documentation and light-mode presentation contexts.

### Palette system

When a node has no explicit `color` prop, `compile.ts` assigns a color from `DiagramTheme.palette` by round-robin based on the node's index in the DSL declaration order. If `palette` is undefined or empty, `DiagramThemeNodeConfig.defaultColor` is used for all uncolored nodes.

## Technical Considerations

### Compile-time boundary

`DiagramTheme` is consumed entirely within the compiler pipeline. `compile.ts` calls `buildThemeRenderConfig(theme)` to produce `DiagramThemeRenderConfig`, which is stored on `DiagramState.themeConfig`. From that point, `render.ts` and all renderer classes read only `DiagramThemeRenderConfig`. This keeps the full theme object — including layout defaults and palette — out of the rendering layer entirely.

### Color derivation for nodes

When `sideColor` or `borderColor` are not specified in `DiagramNodeDSL`, `compile.ts` derives them from the resolved node `color`:
- `sideColor`: darkened via luminance factor ~0.7
- `borderColor`: lightened via luminance factor ~1.3 (clamped)

These derivation functions are pure (no Three.js) and run at compile time. Explicit `sideColor` / `borderColor` props always override derivation.

### Environment map system

`EnvMapManager` in `rendering/EnvMapManager.ts` loads Radiance HDR files via `HDRLoader`. It maintains a module-level cache keyed on URL string. When `DiagramState.themeConfig.envMapUrl` changes between renders (e.g., a different diagram is shown), `EnvMapManager` loads the new HDR and applies it to `scene.environment`. The existing texture is released before the new one is applied. When `envMapUrl` is `null`, a procedural two-tone gradient sky is derived from `skyColor` and `horizonColor`. When `envMapUrl` is `'none'`, `scene.environment` is set to `null`.

### Tree-shaking

Each preset theme is in its own file (`themes/darkGlass.ts`, `themes/neonCyber.ts`, `themes/enterprise.ts`, `themes/lightMinimal.ts`). The barrel `themes/index.ts` re-exports all four. Consumers importing a single preset directly from their source path (or via the named export in the package `index.ts`) allow bundlers to tree-shake unused presets. Each preset is a `const` object with no side effects.

### Layout defaults in theme

`DiagramThemeLayoutConfig` provides fallback values for grid, hierarchical, and manual layout when the `<Diagram>` DSL does not specify a layout child. `layoutResolver.ts` merges theme layout defaults with DSL-declared layout props, with DSL values taking precedence. This allows the theme to establish sensible spacing and padding defaults without requiring every diagram DSL to be verbose.

### Input defaults in theme

`DiagramTheme.input` carries default input action configuration for a `<DiagramCanvas>`. At compile time, the `DiagramCanvas` compiler handler reads `theme.input.defaultActions`, injects `canvasId` (from the `<DiagramCanvas id="...">` prop) into each action spec, and stores the result as `DiagramCanvasState.defaultInputActions`. This compiled value is consumed at runtime by `DiagramCanvasWidget`, which implements `IInputDefaultProvider` from `@brewsite/core`. The player layer reads all `IInputDefaultProvider` widgets each frame via `WidgetRegistry.getInputDefaultProviders()` and applies their actions when no explicit `<InputController>` is present in the current scene.

**Scope constraint:** `input` is only effective on a `<DiagramCanvas theme={...}>` — not on a child `<Diagram>` or a standalone `<Diagram>`. The compiler emits a `IGNORED_INPUT_CONFIG` warning in both invalid cases:

- `<Diagram id="...">` nested inside a `<DiagramCanvas>` has `theme.input` — the diagram-level input is ignored; move it to the `<DiagramCanvas theme={...}>`.
- A standalone `<Diagram>` (not wrapped in `<DiagramCanvas>`) has `theme.input` — ignored; only a canvas can dispatch default input actions.

The `IGNORED_INPUT_CONFIG` warning is surfaced via `SceneTrack.warnings` and forwarded to any `onCompileWarning` handler registered on `ScenePlayer`.

## Breaking Change Assessment

**Semver impact: none (initial documentation of stable API).** All four sub-configs use `readonly` fields. Any future change to the theme contract:

- Adding an optional field to any sub-config: **minor** bump
- Adding a required field to any sub-config: **major** bump (breaks all custom themes that spread from presets without the new field)
- Renaming or removing a field: **major** bump
- Changing a field's type: **major** bump

The safest extension pattern is adding optional fields with defaults applied in `buildThemeRenderConfig`. This is how `fontUrl`, `defaultBorderEmissiveColor`, and `defaultBorderEmissiveIntensity` were introduced without breaking existing themes.

## Dependencies

- `compiler/themeResolver.ts` — pure derivation of `DiagramThemeRenderConfig` from `DiagramTheme`
- `rendering/EnvMapManager.ts` — HDR loading and scene environment application (Three.js)
- `rendering/HDRLoader.ts` — Radiance HDR parser (wraps Three.js `RGBELoader`)
- No new external npm packages

## Risks and Mitigations

**API regret — required fields:** Every field in the four sub-configs is required. This means adding a new required field to any sub-config breaks every custom theme that spreads from a preset. Mitigation: always introduce new theme fields as optional. Document this rule in the contributing guide.

**HDR loading latency:** The default HDR file at `/assets/envmaps/diagram-default.hdr` is shared across all four themes that use it. If the file is large, it adds perceived loading time. Mitigation: the environment map cache prevents duplicate loads; consumers can substitute a lower-resolution HDR or set `envMapUrl: null` for procedural sky at lower visual fidelity.

**Bundle size from unused presets:** All four preset files are small (< 2 KB each). The risk is minimal. Tree-shaking by bundler should remove unused presets automatically given the side-effect-free `const` exports.

## Open Questions

- Should the theme provide a `nodeDefaultSize: readonly [number, number]` field to give a fallback when `DiagramNodeDSL.size` is absent? Currently the default is hardcoded in `nodeCompiler.ts`. Moving it to the theme would make it configurable without a breaking API change, but it increases theme verbosity.
- Should `DiagramThemeLayoutConfig` be promoted to a required field on `DiagramTheme` (with sensible defaults) rather than optional? Making it required would simplify `layoutResolver.ts` by removing the undefined checks, but breaks any custom theme authored before the field existed.

## Launch Criteria

- All four preset themes exported from `@brewsite/diagram` package `index.ts`
- `DiagramTheme`, `DiagramThemeNodeConfig`, `DiagramThemeEdgeConfig`, `DiagramThemeGroupConfig`, `DiagramThemeEnvironmentConfig`, `DiagramThemeLayoutConfig`, `DiagramThemeRenderConfig` all exported from `@brewsite/diagram`
- `buildThemeRenderConfig` unit tested in `compiler/__tests__/themeResolver.test.ts`
- README documents the four presets with import paths and brief descriptions
- At least one example scene in `apps/examples/` demonstrates switching between two presets
- TypeScript strict-mode typecheck passes on the themes package directory

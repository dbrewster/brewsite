---
title: "BrewSite Core — Cross-Package Theming System"
doc_type: prd
status: active
owner: brewsite-product-manager
last_updated: 2026-03-18
change_history:
  - date: 2026-03-18
    author: "Toolkit Product"
    summary: "Core over-engineering audit confirmation: ThemeKeyContext.ts file deleted from codebase (was already removed from PRD documentation in prior v1 readiness audit). Module listing verified — ThemeKeyContext.ts is no longer present in packages/core/src/theme/."
  - date: 2026-03-18
    author: "Toolkit Product"
    summary: "Carousel highlight DSL refactor: added SceneThemeHighlightDefaults type to Section 7.1. Added highlightDefaults field to SceneTheme type. Marked all highlight* fields on SceneThemeCarouselTray as @deprecated (migrated to <Highlight> DSL component). Updated FR #1 to include SceneThemeHighlightDefaults in public exports. Added highlightDefaults to SceneTheme code listing."
  - date: 2026-03-17
    author: "Toolkit Product"
    summary: "v1 release readiness audit: removed ThemeKeyContext, useThemeKey, and ThemeKey — superseded by ActiveTheme. ThemeFamily type is used in the registry. ThemePolarity is used in ActiveTheme. Removed Section 7.2a (ThemeKeyContext) and all references to the deprecated context. Removed ThemeKeyContext.ts from module listing and dependencies."
  - date: 2026-03-17
    author: "Toolkit Product"
    summary: "Codebase alignment: added SceneThemeCarouselTray type with all fields (color, opacity, material, highlight, etc.). Added SceneThemeHighlightPalette, SceneThemeHighlightVariant, HighlightVariantName types. Added darkHighlightPalette and lightHighlightPalette exports. Added surfaceMaterial and materialApplication fields to SceneThemeFloor. Fixed SceneThemePair to reflect it is an internal type (not publicly exported). Fixed resolveSceneThemeFamilyByRef to reflect it is internal (not publicly exported). Added highlightPalettes.ts to module listing."
  - date: 2026-03-04
    author: "Toolkit Product"
    summary: "Initial PRD created. Documents the complete SceneTheme cross-package theming system as implemented: types module, ThemeContext, CSS variable injection in EngineOverlayHost, sceneTheme prop on EngineProvider, darkSceneTheme/lightSceneTheme presets, and per-package integration surface."
  - date: 2026-03-11
    author: "Toolkit Product"
    summary: "Theme redesign: removed SceneTheme.accentColor (field was never consumed by any package; migration: inject --brewsite-accent-color directly in your stylesheet if needed). Expanded preset library from 2 to 6 named presets: darkGlassSceneTheme, midnightSceneTheme, neonCyberSceneTheme, enterpriseSceneTheme, lightCanvasSceneTheme, lightMinimalSceneTheme. Removed --brewsite-accent-color from CSS variable injection. Version bump: minor."
  - date: 2026-03-11
    author: "Toolkit Product"
    summary: "Theming overhaul — polarity pairs and CSS class injection: added ThemeFamily union type, ThemePolarity type ('dark' | 'light'), SceneThemePair type ({ readonly dark: SceneTheme; readonly light: SceneTheme }), and SCENE_THEME_PAIRS registry (Record<ThemeFamily, SceneThemePair>) with all six families. Added resolveThemeFamily() reverse-lookup by reference equality. EngineOverlayHost now injects .bw-theme-{family} and .bw-dark/.bw-light CSS classes on the player root div alongside existing CSS variable injection. Added four new CSS custom properties: --brewsite-background-color, --brewsite-surface-elevated, --brewsite-border-subtle, --brewsite-radius-base. Six polarity-variant SceneTheme presets added as @internal placeholders; production aesthetic authoring deferred. Version bump: minor."
  - date: 2026-03-12
    author: "Toolkit Product"
    summary: "Theme family art direction: all six opposite-polarity SceneTheme presets promoted to public named exports with production-quality aesthetic values — no placeholder or sibling-theme reuse remains. Each named SceneTheme preset now encodes a family-specific font.htmlFamily value (typography differentiation per family). Added FR #20 (family typography differentiation) and FR #21 (opposite-polarity completeness quality bar). Removed from Non-Goals: the deferred polarity-variant aesthetic authoring item. Launch criteria updated."
  - date: 2026-03-13
    author: "Toolkit Product"
    summary: "PRD audit: added SceneThemeFloor and SceneThemeFloorGrid types to Section 7.1 (floor grid visual tokens for <Floor variant='grid'> integration). Added SceneTheme.floor optional field. Added ThemeKeyContext documentation. Updated SceneTheme type definition to include floor field. Updated named preset exports to include polarity-variant names (darkGlassLightSceneTheme, midnightLightSceneTheme, etc.). Updated last_updated."
  - date: 2026-03-15
    author: "Toolkit Product"
    summary: "Codebase alignment: ThemeFamily now includes 'default' (7 members). SCENE_THEME_PAIRS replaced by mutable Map registry with registerSceneThemePair() and resolveSceneTheme(). resolveThemeFamily() replaced by resolveSceneThemeFamilyByRef(). Named preset exports reduced to defaultSceneTheme, defaultLightSceneTheme, plus internal enterpriseSceneTheme/enterpriseLightSceneTheme aliases. Other family presets live in @brewsite/themes. ActiveTheme type documented as primary theming prop on SceneEngine. ThemeKeyContext and useThemeKey documented as deprecated. useTheme() marked as public export. SceneEngine.sceneTheme deprecated in favor of theme prop."
---

# BrewSite Core — Cross-Package Theming System

## 1. Overview

The cross-package theming system introduces `SceneTheme` — a unified token object in `@brewsite/core` that serves as the single source of truth for visual styling across `@brewsite/core`, `@brewsite/diagram`, `@brewsite/charts`, and `@brewsite/model`. Scene authors pass an `ActiveTheme` (or deprecated `SceneTheme`) to `SceneEngine` once; the engine resolves a `SceneTheme` from the registry and injects CSS custom properties into `EngineOverlayHost`, making the token available for opt-in consumption by diagram and chart elements. The result: changing a scene family from dark presentation to light documentation requires changing a single prop.

Affects: `@brewsite/core` (types, ThemeContext, SceneEngine, EngineOverlayHost, Background element). Integration surfaces in `@brewsite/diagram`, `@brewsite/charts`, and `@brewsite/model` are documented in their respective package PRDs.

---

## 2. Problem Statement

Before this system, scene authors who used all four packages managed four completely separate, unconnected styling systems. A dark-to-light style change required touching DiagramTheme, ChartTheme, every overlay `<div>` inline style, and every `<Background>` element. There was no shared font token, no shared color-mode concept, and no authoring location for "this scene family uses this visual style."

Additionally, the Background element supported only solid color and image fills — no gradient fills, no CSS filter effects (blur, brightness), and no overlay gradient layer. Background effects required consumer workarounds outside the toolkit.

---

## 3. Goals & Success Metrics

**Primary goals:**
- A consumer can establish the visual character of an entire scene family by passing one `ActiveTheme` (or `SceneTheme`) to `SceneEngine`.
- CSS variables for font family, font size scale, color mode, and text colors are available to all overlay content without per-element style props.
- Diagram and chart elements can inherit font URL and color mode defaults from `SceneTheme` without requiring full theme replacement.
- The system is fully additive — existing scenes with no `SceneTheme` behave identically to before.

**Success metrics:**
- Zero TypeScript errors in strict mode for any code that constructs a `SceneTheme` or uses the named `SceneTheme` presets.
- CSS variables injected by `EngineOverlayHost` are measurable in browser DevTools on the overlay container element when `sceneTheme` is provided.
- Switching a demo scene from dark to light requires ≤ 2 code edits (sceneTheme prop change + DiagramTheme/ChartTheme adjustment if applicable).

**Guardrail metrics:**
- No change to behavior for scenes that do not pass `sceneTheme`. All props are optional; no new required fields.
- Bundle size increase for `@brewsite/core` from the new `theme/` module: < 2 KB gzipped.

---

## 4. Non-Goals

- Animated theme transitions (cross-fading between light and dark modes)
- CSS-in-JS, Style Dictionary, or design token format integration
- `prefers-color-scheme` media query auto-detection
- Font file bundling — consumers must host their own MSDF-encoded font files
- Per-scene CSS variable switching — `ThemeContext` is static for the player lifetime
- ~~A `useSceneTheme()` hook~~ -- Resolved: `useTheme()` is exported from `@brewsite/core` and returns the current `SceneTheme | null` from `ThemeContext`
- Animated theme transitions between polarity variants (CSS transitions on overlay content may occur naturally; no explicit animation is built)
- `prefers-color-scheme` auto-detection (remains a Non-Goal — polarity toggle is manual UI only)
- Per-scene CSS variable switching (ThemeContext remains player-scoped, not scene-scoped)
- A `BrewSiteThemeProvider` DOM wrapper for broader CSS cascade scope (deferred until consumer use cases demonstrate need)
- `DiagramTheme` gaining a `background` field that drives the scene DOM background (deferred to v2)
- Promoting `DiagramThemeNodeConfig.fontUrl` to `DiagramTheme` root level (deferred to v2)

---

## 5. Consumer Stories

- As a toolkit consumer, I want to pass a single `ActiveTheme` to `SceneEngine` so that all HTML overlay content in my scenes adopts a consistent font family and color system without inline style management.
- As a toolkit consumer, I want `--brewsite-font-family` and `--brewsite-font-size-*` CSS variables available inside my overlay JSX so that I can write CSS-variable-driven overlay styles that update with a prop change.
- As a toolkit consumer, I want to specify a WebGL font URL once in `SceneTheme` and have it flow into my `DiagramTheme` and `ChartTheme` automatically so that I don't repeat the font URL in multiple theme objects.
- As a toolkit consumer, I want `defaultSceneTheme` and `defaultLightSceneTheme` presets ready to use so that I can adopt the system without authoring a full `SceneTheme` object.
- As a toolkit consumer, I want per-scene `<Background>` elements to support gradient fills, CSS filters, and overlay gradients so that I can create rich background effects without leaving the DSL.

---

## 6. Functional Requirements

1. The `SceneTheme` type and all its sub-types (`SceneColorMode`, `SceneThemeFontTokens`, `SceneThemeFontSizeScale`, `SceneThemeBackgroundFill`, `SceneThemeBackgroundEffects`, `SceneThemeBackground`, `SceneThemeFloor`, `SceneThemeFloorGrid`, `SceneThemeCarouselTray`, `SceneThemeHighlightPalette`, `SceneThemeHighlightVariant`, `SceneThemeHighlightDefaults`, `HighlightVariantName`) shall be exported from `@brewsite/core/src/index.ts`. `SceneTheme` does not include an `accentColor` field.
2. `SceneEngine` shall accept an optional `theme?: ActiveTheme` prop (preferred) or deprecated `sceneTheme?: SceneTheme` prop. The resolved `SceneTheme` is provided via `ThemeContext`.
3. `EngineOverlayHost` shall read from `ThemeContext` and, when a theme is present, inject CSS custom properties on its root `<div>` element.
4. CSS variable injection shall cover: `--brewsite-font-family`, `--brewsite-font-size-heading`, `--brewsite-font-size-body`, `--brewsite-font-size-label`, `--brewsite-font-size-caption`, `--brewsite-font-size-annotation`, `--brewsite-color-mode`, `--brewsite-text-primary`, `--brewsite-text-secondary`. `--brewsite-accent-color` is not injected by the engine; consumers who need this variable must set it directly in their own stylesheet.
5. CSS font size variables shall use `calc(1rem * <scale>)` values — they do not depend on a `--brewsite-base-font-size` variable.
6. `ThemeContext` shall hold a single static value for the player lifetime; it shall not change per scene.
7. `fontFamily: 'var(--brewsite-font-family)'` shall be set as an inline style on the `EngineOverlayHost` container so that CSS inheritance propagates to all overlay children and label DOM elements without requiring each child to opt in.
8. Two named `SceneTheme` preset constants shall be exported from `@brewsite/core`: `defaultSceneTheme` (dark polarity) and `defaultLightSceneTheme` (light polarity). `enterpriseSceneTheme` and `enterpriseLightSceneTheme` are `@internal` aliases for these. Family-specific presets (darkGlass, midnight, neonCyber, lightCanvas, lightMinimal) are provided by `@brewsite/themes` and registered via `registerSceneThemePair()` at app startup.
9. All `SceneTheme` fields shall be `readonly`. The type shall have no runtime dependencies — it is pure TypeScript data.
10. `ThemeContext` shall export a `useTheme(): SceneTheme | null` hook. It is exported from `@brewsite/core` via `theme/index.ts` and is available to consumers who need direct access to the resolved `SceneTheme`. Primary internal consumer is `EngineOverlayHost`.
11. When no `theme` or `sceneTheme` is provided to `SceneEngine`, it defaults to `{ family: 'default', polarity: 'dark' }` and resolves the default enterprise `SceneTheme` via `resolveSceneTheme('default', 'dark')`. CSS variables are always injected when any theme is resolved.
12. A `ThemeFamily` union type (`'default' | 'enterprise' | 'darkGlass' | 'midnight' | 'neonCyber' | 'lightCanvas' | 'lightMinimal'`) shall be exported from `@brewsite/core`. The `'default'` member maps to the enterprise aesthetic and is always pre-registered in the scene theme registry. This is the canonical shared union used by `@brewsite/diagram` and `@brewsite/charts` as a type alias for their respective theme name types.
13. A `ThemePolarity` union type (`'dark' | 'light'`) shall be exported from `@brewsite/core`.
14. A `SceneThemePair` type (`{ dark: SceneTheme; light: SceneTheme }`) is used internally by `sceneThemeRegistry.ts`. It is not exported from `theme/index.ts` as a public type — consumers interact with the registry via `registerSceneThemePair()` and `resolveSceneTheme()` functions.
15. A mutable runtime registry shall store `SceneThemePair` entries keyed by family name. The `'default'` and `'enterprise'` families are pre-loaded at module init with the enterprise aesthetic. Other families are registered at app startup via `registerSceneThemePair(family, pair)`. The `SCENE_THEME_PAIRS` constant does not exist as a static export — the registry is populated dynamically by `@brewsite/themes`.
16. A `resolveSceneTheme(family: string, polarity: 'dark' | 'light'): SceneTheme` utility shall be exported from `@brewsite/core`. It looks up the requested family in the registry, falling back to the `'default'` pair if the family is not registered, and returns the theme for the given polarity. The `resolveSceneThemeFamilyByRef` function exists in `sceneThemeRegistry.ts` as an internal utility but is not re-exported from `theme/index.ts` — it is not part of the public API.
17. When `sceneTheme` is provided to `SceneEngine`, `EngineOverlayHost` shall inject `.bw-theme-{family}` and `.bw-dark` or `.bw-light` classes on its root `<div>`. The family class is derived via `resolveSceneThemeFamilyByRef(sceneTheme)`. When the function returns `undefined` (custom theme), no `.bw-theme-*` class is injected; the polarity class (`.bw-dark` or `.bw-light`) is still injected based on `sceneTheme.colorMode`.
18. `EngineOverlayHost` shall inject four additional CSS custom properties when `sceneTheme` is present: `--brewsite-background-color`, `--brewsite-surface-elevated`, `--brewsite-border-subtle`, and `--brewsite-radius-base`. Values are derived from `SceneTheme.background` where applicable and from per-family constants otherwise.
19. All registered `SceneThemePair` entries in the scene theme registry shall carry production-quality aesthetic values for both dark and light polarities. The `'default'` and `'enterprise'` families are pre-loaded in `@brewsite/core`; other families are registered by `@brewsite/themes`.
20. Each named `SceneTheme` preset shall specify a family-specific `font.htmlFamily` value that expresses the typographic personality of that theme family. A generic system-font-only stack (`system-ui, sans-serif`) is not acceptable for a named preset; each family differentiates its overlay typography through a distinct, curated font stack.
21. For every registered theme family, both the dark and light `SceneTheme` entries shall satisfy the global quality bar: fully designed neutral palette, gradient scene background, overlay color tokens, and a primary text color that maintains >= 4.5:1 contrast against the family's scene background color. Neither polarity may be a structural placeholder.

---

## 7. API Design

### 7.1 Core Types (`packages/core/src/theme/types.ts`)

```typescript
/** Background polarity. 'dark' = dark scene (light text defaults). 'light' = light scene (dark text defaults). */
export type SceneColorMode = 'dark' | 'light';

export type SceneThemeFontTokens = {
  /** CSS font-family string for HTML overlay content. e.g. 'Inter, system-ui, sans-serif' */
  readonly htmlFamily: string;
  /**
   * URL to an MSDF-encoded .ttf or .woff font file for troika-three-text (diagram/chart labels).
   * Must be MSDF-encoded — standard web font URLs will not render correctly.
   * If absent, each package falls back to the troika built-in default font.
   */
  readonly webglFontUrl?: string;
};

export type SceneThemeFontSizeScale = {
  readonly heading: number;    // e.g. 1.5
  readonly body: number;       // e.g. 1.0 (reference scale)
  readonly label: number;      // e.g. 0.85 — node labels, axis labels
  readonly caption: number;    // e.g. 0.7 — sublabels, small text
  readonly annotation: number; // e.g. 0.6 — tick labels, tiny callouts
};

export type SceneThemeBackgroundFill =
  | { readonly kind: 'color';    readonly value: string }
  | { readonly kind: 'image';    readonly url: string; readonly size?: string; readonly position?: string }
  | { readonly kind: 'gradient'; readonly value: string };

export type SceneThemeBackgroundEffects = {
  /** CSS filter on the background DOM element. e.g. 'blur(4px) brightness(0.8)' */
  readonly cssFilter?: string;
  /** Overlay gradient drawn above background, below scene content. */
  readonly overlayGradient?: string;
  /** CSS backdrop-filter on the overlay element. Limited browser support on older Android WebViews. */
  readonly backdropFilter?: string;
  /** Overall background opacity [0–1]. Default: 1 */
  readonly opacity?: number;
};

export type SceneThemeBackground = {
  readonly fill?: SceneThemeBackgroundFill;
  readonly effects?: SceneThemeBackgroundEffects;
};

export type SceneThemeFloorGrid = {
  readonly spacing?: number;           // minor grid spacing in world units
  readonly lineColor?: string;         // minor line color
  readonly majorLineColor?: string;    // major line color
  readonly fillColor?: string;         // base fill color under grid lines
  readonly lineOpacity?: number;       // line opacity [0-1]
  readonly fillOpacity?: number;       // fill opacity [0-1]
  readonly majorEvery?: number;        // minor cells per major grid line
};

export type SceneThemeFloor = {
  readonly grid?: SceneThemeFloorGrid;
  readonly negativeZExtent?: number;           // world-space reach in negative Z
  readonly negativeZEdge?: 'hard' | 'fade';    // back-edge behavior
  readonly negativeZFadeDistance?: number;      // fade distance when edge='fade'
  readonly surfaceMaterial?: string;            // named material preset
  readonly materialApplication?: MaterialApplication; // application controls
};

export type SceneThemeCarouselTray = {
  readonly color?: string;
  readonly opacity?: number;
  readonly accentColor?: string;
  readonly depth?: number;
  readonly gap?: number;
  readonly metalness?: number;
  readonly roughness?: number;
  readonly edgeStyle?: 'smooth' | 'knurled' | 'ridged' | 'matte';
  readonly surfacePattern?: 'brushed' | 'radial' | 'crosshatch' | 'grain' | 'none';
  readonly surfaceIntensity?: number;
  readonly surfaceMapUrl?: string;
  readonly surfaceMaterial?: string;
  readonly materialApplication?: MaterialApplication;
  readonly outerMargin?: number;
  /** @deprecated Use `<Highlight>` as a sibling child of `<ViewLayout>` instead. Removal planned for next major version. */
  readonly highlightActive?: ViewHighlightMode;
  /** @deprecated Use `<Highlight>` as a sibling child of `<ViewLayout>` instead. Removal planned for next major version. */
  readonly highlightColor?: string;
  /** @deprecated Use `<Highlight>` as a sibling child of `<ViewLayout>` instead. Removal planned for next major version. */
  readonly highlightIntensity?: number;
  /** @deprecated Use `<Highlight>` as a sibling child of `<ViewLayout>` instead. Removal planned for next major version. */
  readonly highlightBeamHeight?: number;
  /** @deprecated Use `<Highlight>` as a sibling child of `<ViewLayout>` instead. Removal planned for next major version. */
  readonly highlightSmoke?: boolean;
  /** @deprecated Use `<Highlight>` as a sibling child of `<ViewLayout>` instead. Removal planned for next major version. */
  readonly highlightZOffset?: number;
  /** @deprecated Use `<Highlight>` as a sibling child of `<ViewLayout>` instead. Removal planned for next major version. */
  readonly highlightBackdropColor?: string;
  /** @deprecated Use `<Highlight>` as a sibling child of `<ViewLayout>` instead. Removal planned for next major version. */
  readonly highlightViewId?: string;
};

export type HighlightVariantName =
  | 'primary' | 'secondary' | 'tertiary'
  | 'error' | 'warning' | 'success' | 'info';

export type SceneThemeHighlightVariant = {
  readonly color: string;
  readonly mode?: ViewHighlightMode;
  readonly intensity?: number;
  readonly blendMode?: 'additive' | 'normal';
  readonly backdropOpacity?: number;
  readonly backdropColor?: string;
  readonly beamHeight?: number;
  readonly smoke?: boolean;
  readonly dust?: boolean;
};

export type SceneThemeHighlightPalette = {
  readonly [K in HighlightVariantName]?: SceneThemeHighlightVariant;
};

/**
 * Default highlight configuration when no variant is specified.
 * Lives at the `SceneTheme` level alongside `highlightPalette`.
 */
export type SceneThemeHighlightDefaults = {
  /** Default mode when no variant or explicit mode is set. Default: 'glow'. */
  readonly mode?: ViewHighlightMode;
  /** Default backdrop opacity [0-1]. */
  readonly backdropOpacity?: number;
  /** Default backdrop color. Auto-resolved from polarity when not set. */
  readonly backdropColor?: string;
  /** Default beam height [world units]. */
  readonly beamHeight?: number;
};

export type SceneTheme = {
  readonly colorMode: SceneColorMode;
  readonly font: SceneThemeFontTokens;
  readonly fontSize: SceneThemeFontSizeScale;
  readonly background?: SceneThemeBackground;
  readonly floor?: SceneThemeFloor;
  readonly carouselTray?: SceneThemeCarouselTray;
  /** Semantic highlight palette — named highlight variants. */
  readonly highlightPalette?: SceneThemeHighlightPalette;
  /** Default highlight configuration when no variant is specified. */
  readonly highlightDefaults?: SceneThemeHighlightDefaults;
};
```

### 7.1a ThemeFamily, ThemePolarity, ActiveTheme, Scene Theme Registry (`packages/core/src/theme/types.ts` and `packages/core/src/theme/sceneThemeRegistry.ts`)

```typescript
/**
 * Canonical union of the seven theme family names shared across all BrewSite packages.
 * 'default' maps to the enterprise aesthetic and is always pre-registered.
 */
export type ThemeFamily =
  | 'default'
  | 'enterprise'
  | 'darkGlass'
  | 'midnight'
  | 'neonCyber'
  | 'lightCanvas'
  | 'lightMinimal';

/** Light or dark background polarity for a theme variant. */
export type ThemePolarity = 'dark' | 'light';

/**
 * The active theme selection for a SceneEngine instance.
 * Passed via `<SceneEngine theme={...}>` to select a theme family and polarity.
 * Replaces the older `sceneTheme` / `themeFamily` / `themePolarity` props.
 */
export interface ActiveTheme {
  readonly family: ThemeFamily;
  readonly polarity: 'dark' | 'light';
}
```

**Scene Theme Registry** (`packages/core/src/theme/sceneThemeRegistry.ts`):

The registry is a mutable `Map<string, SceneThemePair>` populated at runtime. It is NOT a static `Record<ThemeFamily, SceneThemePair>` constant. The `'default'` and `'enterprise'` pairs are pre-loaded at module init with the enterprise aesthetic.

```typescript
/** A dark/light pair of SceneTheme presets for a single theme family. */
type SceneThemePair = { dark: SceneTheme; light: SceneTheme };

/**
 * Register a SceneTheme pair for a given theme family name.
 * Called by @brewsite/themes at app startup to populate the registry
 * beyond the built-in 'default' pair.
 */
export function registerSceneThemePair(family: string, pair: SceneThemePair): void;

/**
 * Resolve a SceneTheme for the given family and polarity.
 * Falls back to the 'default' pair if the requested family is not registered.
 */
export function resolveSceneTheme(family: string, polarity: 'dark' | 'light'): SceneTheme;

// resolveSceneThemeFamilyByRef() exists internally but is NOT exported.
// It performs reverse-lookup by reference equality and is used by EngineOverlayHost
// for CSS class injection. Not part of the public API.
```

### 7.2 ThemeContext (`packages/core/src/theme/ThemeContext.ts`)

```typescript
export const ThemeContext = React.createContext<SceneTheme | null>(null);
export const useTheme = (): SceneTheme | null => useContext(ThemeContext);
```

`ThemeContext` is populated by `SceneEngine`. `useTheme()` is exported from `@brewsite/core` via `theme/index.ts` and IS part of the public API. It is consumed internally by `EngineOverlayHost` for CSS variable injection, and can be used by consumers who need direct access to the resolved `SceneTheme` for custom overlay logic.

### 7.3 SceneEngine Theme Props

```typescript
export interface SceneEngineProps {
  // ... existing props ...

  /**
   * Active theme for this engine. Provides the ActiveTheme object (family + polarity)
   * to all widgets and overlays. SceneEngine resolves this to a SceneTheme via
   * resolveSceneTheme(family, polarity) for ThemeContext injection.
   */
  theme?: ActiveTheme;

  /**
   * @deprecated Use `theme` prop instead.
   * Optional scene theme token set for cross-package visual styling.
   * When provided, overrides the theme-resolved SceneTheme in ThemeContext.
   */
  sceneTheme?: SceneTheme;

  /**
   * @deprecated Use `theme` prop instead.
   * Theme family key.
   */
  themeFamily?: ThemeFamily;

  /**
   * @deprecated Use `theme` prop instead.
   * Theme polarity ('dark' | 'light'). Defaults to 'dark' when themeFamily is set.
   */
  themePolarity?: ThemePolarity;
}
```

**Theme resolution precedence in SceneEngine:**
1. If `theme` prop is set, use it as the `ActiveTheme`.
2. Else if `themeFamily` is set, construct `{ family: themeFamily, polarity: themePolarity ?? 'dark' }`.
3. Else default to `{ family: 'default', polarity: 'dark' }`.

The resolved `ActiveTheme` is passed to compilation via `useSceneEngine({ activeTheme })`. The `SceneTheme` for `ThemeContext` is resolved via `resolveSceneTheme(family, polarity)`, unless `sceneTheme` prop is explicitly set (which overrides the registry lookup).

### 7.4 CSS Variables Injected by EngineOverlayHost

When `ThemeContext` contains a `SceneTheme`, `EngineOverlayHost` injects these custom properties on its root `<div>`:

| CSS Variable | Value |
|---|---|
| `--brewsite-font-family` | `theme.font.htmlFamily` |
| `--brewsite-font-size-heading` | `calc(1rem * theme.fontSize.heading)` |
| `--brewsite-font-size-body` | `calc(1rem * theme.fontSize.body)` |
| `--brewsite-font-size-label` | `calc(1rem * theme.fontSize.label)` |
| `--brewsite-font-size-caption` | `calc(1rem * theme.fontSize.caption)` |
| `--brewsite-font-size-annotation` | `calc(1rem * theme.fontSize.annotation)` |
| `--brewsite-color-mode` | `'dark'` or `'light'` |
| `--brewsite-text-primary` | `'#ffffff'` (dark) or `'#111111'` (light) |
| `--brewsite-text-secondary` | `'rgba(255,255,255,0.6)'` (dark) or `'rgba(0,0,0,0.6)'` (light) |
| `--brewsite-background-color` | Per-family/polarity background fill color (HTML overlay territory only; does not affect Three.js BackgroundWidget plane) |
| `--brewsite-surface-elevated` | Per-family/polarity elevated surface tone (overlay cards, modals) |
| `--brewsite-border-subtle` | Per-family/polarity subtle border color for overlay UI |
| `--brewsite-radius-base` | Per-family base corner radius token for overlay components |

Additionally, `fontFamily: 'var(--brewsite-font-family)'` is set as an inline style on the overlay container so CSS inheritance propagates automatically to all children.

### 7.4a CSS Class Injection

When `sceneTheme` is provided, `EngineOverlayHost` adds the following classes to its root `<div>`:

- `.bw-theme-{family}` — e.g. `.bw-theme-darkGlass`, `.bw-theme-lightCanvas`. Derived via `resolveSceneThemeFamilyByRef(sceneTheme)`. Not injected when the function returns `undefined` (custom theme object not in the registry).
- `.bw-dark` or `.bw-light` — derived from `sceneTheme.colorMode`. Always injected when a `sceneTheme` is present.

These classes enable theme-scoped and polarity-scoped CSS override targeting for HTML overlay content without any code change:

```css
/* Theme-scoped overlay override */
.bw-theme-darkGlass {
  --brewsite-text-primary: #e0e8ff;
}

/* Polarity-scoped override */
.bw-theme-darkGlass.bw-light {
  --brewsite-background-color: #f5f7ff;
}

/* Generic polarity override (applies to all theme families) */
.bw-dark {
  color-scheme: dark;
}
```

**Scope:** CSS class overrides apply to `EngineOverlayHost` children (HTML overlay content) only. Three.js-rendered content (diagram nodes, chart series, edges, groups) cannot be targeted by CSS and is not affected by these classes.

**Note on `--brewsite-accent-color`:** This variable is not injected by the engine. Consumers who require a scene-scoped accent color variable must declare `--brewsite-accent-color` directly in their own stylesheet or on a wrapper element. This allows fallback expressions like `var(--brewsite-accent-color, #6b48ff)` to work without engine involvement.

### 7.5 Preset Themes (`packages/core/src/theme/presets.ts`)

`@brewsite/core` exports only the default (enterprise) presets. Named family presets (darkGlass, midnight, neonCyber, lightCanvas, lightMinimal) live in the `@brewsite/themes` package and are registered at app startup via `registerSceneThemePair()`.

```typescript
// packages/core/src/theme/presets.ts

/** Default scene theme — enterprise aesthetic, dark polarity. */
export const defaultSceneTheme: SceneTheme;

/** Default scene theme — enterprise aesthetic, light polarity. */
export const defaultLightSceneTheme: SceneTheme;

/** @internal Enterprise-named aliases for the default presets. */
export const enterpriseSceneTheme: SceneTheme;       // === defaultSceneTheme
export const enterpriseLightSceneTheme: SceneTheme;   // === defaultLightSceneTheme
```

The default presets use `'"IBM Plex Sans", "Inter", sans-serif'` for `font.htmlFamily` and a standard font size scale (`heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6`). The background is a gradient (`linear-gradient(180deg, #0A1424 0%, #15253A 100%)` for dark, `linear-gradient(180deg, #F3F6FA 0%, #E7EDF5 100%)` for light). Both include floor grid theme tokens.

**Consuming family-specific presets from `@brewsite/themes`:**

```typescript
import { registerSceneThemePair, resolveSceneTheme } from '@brewsite/core';
import { darkGlassPair } from '@brewsite/themes';

// At app startup:
registerSceneThemePair('darkGlass', darkGlassPair);

// At usage:
const theme = resolveSceneTheme('darkGlass', 'dark');
```

**Custom theme override:**

```typescript
import { defaultSceneTheme } from '@brewsite/core';

const brandTheme: SceneTheme = {
  ...defaultSceneTheme,
  font: {
    htmlFamily: 'Inter, system-ui, sans-serif',
    webglFontUrl: 'https://cdn.example.com/fonts/inter-msdf.ttf',
  },
};
```

### 7.6 Usage Pattern

```tsx
import { SceneEngine, EngineOverlayHost, SceneCanvas, EngineGate, corePlugin } from '@brewsite/core';

// Using ActiveTheme prop (preferred):
<SceneEngine theme={{ family: 'enterprise', polarity: 'dark' }} plugins={[corePlugin()]}>
  <Scene key="hero">
    <Camera descriptor={{ mode: 'world', position: [0, 1, 5], target: [0, 0, 0] }} />
  </Scene>
  <EngineGate>
    <SceneCanvas />
    <EngineOverlayHost />  {/* injects CSS variables from resolved SceneTheme */}
  </EngineGate>
</SceneEngine>

// Using deprecated sceneTheme prop (backward-compatible):
import { defaultSceneTheme } from '@brewsite/core';

<SceneEngine sceneTheme={defaultSceneTheme} plugins={[corePlugin()]}>
  ...
</SceneEngine>
```

---

## 8. Technical Considerations

### ThemeContext is static per player lifetime

`ThemeContext` holds the `SceneTheme` resolved by `SceneEngine` for the entire player lifetime. It does not update between scenes. This is intentional: updating CSS variables per scene would trigger a React re-render cascade from every consumer of the context on every scene transition — a performance anti-pattern on a hot render path.

Per-scene background visual changes (gradient fill, CSS filter, overlay gradient) are handled by `BackgroundWidget` DOM manipulation — the widget applies CSS values to the background DOM element on each frame tick when the compiled `SceneBackground` state changes. This is the correct pattern: CSS variables control layout-level constants (font, color mode); DOM widget state controls scene-level animation values.

### WebGL font URL is not auto-plumbed

`sceneTheme.font.webglFontUrl` on `SceneEngine` does NOT automatically configure diagram or chart WebGL renderers. The font URL must be provided to `DiagramTheme.sceneTheme` or `ChartTheme.sceneTheme` (or `ChartDSL.sceneTheme`) for it to affect WebGL-rendered text. This is by design: `SceneEngine` knows nothing about diagram or chart elements; plumbing the font URL through the engine would couple core to its dependents, violating the package dependency rule.

### Module location

`packages/core/src/theme/` contains:
- `types.ts` — all type contracts: `SceneTheme`, `ThemeFamily`, `ThemePolarity`, `ActiveTheme`, `SceneThemeCarouselTray`, `SceneThemeHighlightPalette`, `SceneThemeHighlightVariant`, `HighlightVariantName`, and all sub-types (no runtime, no React, no Three.js)
- `ThemeContext.ts` — React context + `useTheme` hook
- `presets.ts` — `defaultSceneTheme`, `defaultLightSceneTheme`, and enterprise aliases
- `highlightPalettes.ts` — `darkHighlightPalette` and `lightHighlightPalette` default highlight palette constants for dark and light polarities
- `sceneThemeRegistry.ts` — mutable runtime registry with `registerSceneThemePair()`, `resolveSceneTheme()`, internal `resolveSceneThemeFamilyByRef()`
- `index.ts` — public re-exports

All public types, presets, and registry functions are re-exported from `packages/core/src/index.ts` via `theme/index.ts`.

---

## 9. Known Limitations

1. **`sceneTheme.colorMode` has no effect on built-in DiagramTheme preset label colors without `withColorMode()`.** All four built-in DiagramTheme presets (`darkGlass`, `enterprise`, `neonCyber`, `lightMinimal`) have explicit `defaultLabelColor` values. The `themeResolver.ts` colorMode fallback only fires when `defaultLabelColor` is absent. Use `withColorMode(preset, colorMode)` from `@brewsite/diagram` to create a preset with colorMode-derived label colors. See the diagram theming PRD for details.

2. **`ThemeContext` is static — not reactive per scene.** If different scenes require different font families or color modes, use per-scene `<Background>` elements for visual changes. CSS variables from `ThemeContext` do not change mid-session.

3. **WebGL font URL must be MSDF-encoded.** A standard Google Fonts or CDN web font URL will not render correctly in troika-three-text. The font file must be pre-processed for MSDF (Multi-channel Signed Distance Field) encoding. For production deployments, self-host the MSDF font file; troika's built-in default font may load from CDN in some build configurations.

4. **`backdropFilter` browser support.** The `SceneThemeBackgroundEffects.backdropFilter` field generates a CSS `backdrop-filter` rule on the overlay DOM element. This property is not supported on older Android WebViews (< Chrome 76). Use `@supports (backdrop-filter: blur(1px))` guards in consumer CSS if targeting older mobile browsers.

5. **`DiagramTheme.background` connection to `<Background>` element is deferred.** There is no mechanism in v1 to have a `DiagramTheme` automatically drive the scene's DOM `<Background>` element. Authors must pair `<Background>` and `<DiagramCanvas>` manually in each scene.

---

## 10. Breaking Change Assessment

**Semver impact: minor.** The six new named `SceneTheme` presets are additive exports. The `darkSceneTheme` and `lightSceneTheme` constants remain unchanged.

**`SceneTheme.accentColor` removal:** The `accentColor` field is removed from the `SceneTheme` type. This is a **breaking change** for any consumer who set this field on a custom `SceneTheme`. Because `accentColor` was documented as optional and was never consumed by any package in the toolkit (no renderer read it; no CSS variable was derived from it), the practical impact is limited to TypeScript type errors at the call site. Migration: remove `accentColor` from any `SceneTheme` literal. If a `--brewsite-accent-color` CSS variable is needed, declare it directly in the application stylesheet or on a wrapper element.

---

## 11. Dependencies

- `packages/core/src/theme/types.ts` — type contracts (SceneTheme, ThemeFamily, ActiveTheme, etc.)
- `packages/core/src/theme/ThemeContext.ts` — React context + `useTheme` hook
- `packages/core/src/theme/presets.ts` — default enterprise presets
- `packages/core/src/theme/sceneThemeRegistry.ts` — mutable runtime registry
- `packages/core/src/theme/index.ts` — public re-exports
- `packages/core/src/player/SceneEngine.tsx` — `theme`, `sceneTheme`, `themeFamily`, `themePolarity` props; `ThemeContext.Provider` wrapping
- `packages/core/src/player/EngineOverlayHost.tsx` — reads `ThemeContext`, injects CSS variables and classes
- No new external npm dependencies

---

## 12. Risks & Mitigations

**API regret on CSS variable names:** The variable names (`--brewsite-font-family`, `--brewsite-text-primary`, etc.) are now injected into consumer DOM. Renaming them is a breaking change for consumer CSS. Mitigation: names are prefixed with `--brewsite-` to signal toolkit ownership; they follow a stable, predictable naming convention.

**Missing `EngineOverlayHost` in consumer layout:** Consumers who compose `SceneEngine` + `SceneCanvas` manually without `EngineOverlayHost` will not receive CSS variable injection. This is expected — `EngineOverlayHost` is the injection point. If a consumer uses a custom overlay host, they can read `ThemeContext` via `useTheme()` and inject variables themselves.

---

## 13. Launch Criteria

**Shipped (original theming system):**
- [x] `SceneTheme`, `SceneColorMode`, `SceneThemeFontTokens`, `SceneThemeFontSizeScale`, `SceneThemeBackgroundFill`, `SceneThemeBackgroundEffects`, `SceneThemeBackground`, `ThemeFamily`, `ThemePolarity`, `ActiveTheme`, `defaultSceneTheme`, `defaultLightSceneTheme`, `registerSceneThemePair`, `resolveSceneTheme`, `useTheme` exported from `packages/core/src/index.ts`.
- [x] `SceneEngine` `theme` prop (ActiveTheme) typed and documented in JSDoc. Deprecated `sceneTheme`, `themeFamily`, `themePolarity` props retained with `@deprecated` annotation.
- [x] `EngineOverlayHost` tests cover: CSS variables present when theme provided; no CSS variables when theme absent.
- [x] TypeScript strict-mode typecheck passes on `packages/core/src/theme/`.
- [x] At least one example in `apps/examples/` demonstrates `theme` on `SceneEngine` with CSS variable usage in overlay content.
- [x] `pnpm test` passes for `@brewsite/core` with coverage on `src/theme/`.

**Shipped (theming overhaul — polarity pairs and CSS class injection):**
- [x] `registerSceneThemePair`, `resolveSceneTheme` exported from `packages/core/src/index.ts`. `darkHighlightPalette`, `lightHighlightPalette` exported from `packages/core/src/index.ts`.
- [x] `EngineOverlayHost` injects `.bw-theme-{family}` and `.bw-dark`/`.bw-light` classes on its root div.
- [x] `EngineOverlayHost` injects `--brewsite-background-color`, `--brewsite-surface-elevated`, `--brewsite-border-subtle`, `--brewsite-radius-base` CSS custom properties.
- [x] `EngineOverlayHost` tests updated to cover class injection for known theme families and custom themes.
- [x] `pnpm test` passes for `@brewsite/core` with updated theme coverage.

**Shipped (theme family art direction — polarity variants and typography):**
- [x] Default enterprise presets (defaultSceneTheme, defaultLightSceneTheme) carry production-quality aesthetic values. Registry supports runtime registration of additional families.
- [x] Each named `SceneTheme` preset encodes a family-specific `font.htmlFamily` font stack differentiating overlay typography across families.
- [x] Theme gallery example page (`apps/examples/src/theme-gallery/`) demonstrates all 12 presets.

**Follow-on (not yet shipped — tracked separately):**
- [ ] `prefers-color-scheme` reactive polarity updates without player remount (v2 scope).
- [ ] `--brewsite-accent-1` through `--brewsite-accent-8` palette CSS variables (pending scope decision).

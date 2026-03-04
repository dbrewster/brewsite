---
title: "Cross-Package Theming — Implementation Plan"
doc_type: plan
owner: architect
status: complete
updated: 2026-03-04
---

# Cross-Package Theming — Implementation Plan

## 1. Resolved Design Decisions

### OQ 8 (Critical) — colorMode-driven label colors with built-in DiagramTheme presets

**Decision: Approach (a) — add `withColorMode()` utility to `mergeTheme.ts`.**

All four built-in DiagramTheme presets (`darkGlass`, `enterprise`, `neonCyber`, `lightMinimal`) define explicit `defaultLabelColor` and `defaultSublabelColor` values on `DiagramTheme.node`. The `themeResolver.ts` fallback from `sceneTheme.colorMode` only fires when these fields are **absent**. In practice, `sceneTheme.colorMode` alone has **zero effect** on diagram label colors when using any built-in preset.

The escape hatch: a new export `withColorMode(base: DiagramTheme, colorMode: SceneColorMode): DiagramTheme` in `packages/diagram/src/elements/diagram/themes/mergeTheme.ts`. This function creates a new `DiagramTheme` by overriding `node.defaultLabelColor` and `node.defaultSublabelColor` with colorMode-appropriate defaults. It does NOT set `sceneTheme` — consumers who also need webglFontUrl inheritance must set `theme.sceneTheme` separately. Consumers who want colorMode-driven labels call it explicitly:

```typescript
import { darkGlassTheme, withColorMode } from '@brewsite/diagram';
import { darkSceneTheme } from '@brewsite/core';

// Create theme with colorMode-driven label colors:
const myTheme = withColorMode(darkGlassTheme, 'dark');
// myTheme.node.defaultLabelColor is now '#e8eeff' (light on dark)

// Or passing a full SceneTheme for font URL too:
const myTheme2 = withColorMode(darkGlassTheme, mySceneTheme.colorMode);
```

**Rationale:** Approach (b) (`inheritColorModeForLabels: boolean`) adds runtime state to the compile pipeline and requires a new DSL prop on `DiagramCanvas`, which is harder to compose with existing theme objects. Approach (c) (known limitation only) creates poor developer experience since there is no obvious escape hatch. Approach (a) is explicit, composable, and requires no change to the compilation pipeline — theme authors construct the correct `DiagramTheme` upfront.

**Documented behavior:** Comments on `withColorMode()` and on all four preset theme constants must state clearly: "If you use a built-in preset directly, `sceneTheme.colorMode` does not affect label colors. Use `withColorMode(preset, colorMode)` to create a preset with colorMode-derived label colors."

---

### OQ 6 (Blocking) — Does ThemeContext update per scene?

**Decision: (a) ThemeContext holds a static player-level value only.**

`ThemeContext` is populated once by `EngineProvider` from its `sceneTheme` prop. It does not change between scenes. Per-scene background visual changes (gradient, filter, overlay) are handled by `BackgroundWidget` DOM manipulation — the widget applies new CSS values to the background DOM element on each frame tick when the compiled `SceneBackground` state changes.

**Rationale:**
- Updating ThemeContext per-scene would trigger a React re-render cascade for every component consuming it on every scene transition. This is a performance anti-pattern for a hot render path.
- The CSS variables injected by `EngineOverlayHost` (font family, font size scale, color mode) are layout-level constants that should not change per scene. If a scene needs different font sizing, that is a per-overlay-element concern, not a global CSS variable concern.
- Per-scene background effects (gradient, blur, overlay) are Three.js-adjacent DOM state, not CSS theming state. They are already managed correctly by the existing `BackgroundWidget` apply() → `applyBackground()` pipeline.

**Consequence:** The `theme` prop on `<Background>` DSL is resolved at compile time (during scene compilation, not at runtime). If a scene author wants different visual effects per scene, they declare them per `<Scene>`:

```tsx
<Scene id="hero">
  <Background theme={darkGlassBackground} />
</Scene>
<Scene id="docs">
  <Background theme={lightDocBackground} />
</Scene>
```

---

### OQ 9 — Should `DiagramThemeNodeConfig.fontUrl` be promoted to `DiagramTheme` root?

**Decision: Defer promotion to v2. Document the misleading placement clearly.**

In this work:
- `DiagramTheme.node.fontUrl` remains in its current location.
- `themeResolver.ts` resolves font URL with fallback chain: `theme.node.fontUrl ?? theme.sceneTheme?.font.webglFontUrl`.
- JSDoc on `DiagramThemeNodeConfig.fontUrl` is updated to state: "This field is diagram-wide despite its placement on the `node` sub-config. `themeResolver.ts` extracts it to `DiagramThemeRenderConfig.fontUrl` and applies it to all troika text (both node labels and group title labels). Promotion to `DiagramTheme` root level is planned for v2."

**Rationale:** Promotion requires a breaking change in the `DiagramTheme` type shape (moving field location). The existing `mergeTheme()` utility already handles the current shape. Doing the promotion in v1 doesn't serve the primary theming feature and adds reviewer scope. The `sceneTheme?.font.webglFontUrl` fallback in `themeResolver.ts` already solves the real problem (diagram inherits font from sceneTheme).

---

### OQ 5 — Should `DiagramTheme` gain a `background` field?

**Decision: Out of scope for v1.**

`DiagramCanvas` renders a Three.js scene inside its own `WebGLRenderer`. CSS filters and gradient overlays do not apply to WebGL canvas output — they apply to the surrounding DOM. The `SceneThemeBackground` type is designed for the DOM-rendered `<Background>` element.

Connecting `DiagramTheme.background` to the scene DOM `<Background>` would cross an architectural boundary (diagram theme driving core element state) and adds complex dependency between packages. It is deferred to v2 as a convenience utility, not a type system change.

**v1 guidance for consumers:** Pair a `DiagramTheme` with a `<Background>` element that has matching visual intent:
```tsx
<Scene id="diagram-scene">
  <Background theme={darkSceneTheme} />
  <DiagramCanvas theme={darkGlassTheme} />
</Scene>
```

---

## 2. Work Stream Overview

```
Stream A — packages/core/src/theme/  (BLOCKING — all other streams depend on this)
  └─ types.ts, ThemeContext.ts, presets.ts, index.ts + tests

Stream B — Background element extension  (after A, alone; no conflicts with C/D/E)
  └─ background/types.ts, dsl.tsx, compile.ts, render.ts, BackgroundWidget.ts + tests

Stream C — Player/EngineProvider/EngineOverlayHost  (after A, parallel with B/D/E)
  └─ player/EngineProvider.tsx, player/EngineOverlayHost.tsx + test

Stream D — Diagram integration  (after A, parallel with B/C/E)
  └─ diagram/types.ts, themeResolver.ts, mergeTheme.ts + tests

Stream E — Charts + Model integration  (after A, parallel with B/C/D)
  └─ charts (types/compile/render/renderers), model labels/types + tests
```

Note: Stream E also requires `packages/core/src/text/TextRenderer.ts` and `text/types.ts` changes. These files are not touched by B, C, or D, so no conflict.

---

## 3. Stream A — New `packages/core/src/theme/` Module

**Run alone first. All other streams depend on the types exported here.**

### 3.1 `packages/core/src/theme/types.ts` — NEW FILE

Responsibility: All `SceneTheme` type contracts. No runtime code, no React, no Three.js.

```typescript
// Single source of truth for SceneTheme token types.
// Imported by all packages that participate in cross-package theming.

/**
 * Background polarity for the scene. Follows CSS prefers-color-scheme naming convention.
 * 'dark'  = dark-background scene (drives light text/surface defaults downstream).
 * 'light' = light-background scene (drives dark text/surface defaults downstream).
 *
 * This token drives DEFAULTS only. Explicit color values in DiagramTheme/ChartTheme
 * take precedence over colorMode-derived defaults.
 */
export type SceneColorMode = 'dark' | 'light';

/**
 * Font family tokens for HTML and WebGL rendering targets.
 * These are separate tokens because HTML CSS and troika-three-text use incompatible
 * font formats — a CSS font-family string cannot be used as a troika fontUrl.
 */
export type SceneThemeFontTokens = {
  /**
   * CSS font-family string for HTML overlay content rendered inside EngineOverlayHost.
   * Injected as --brewsite-font-family CSS custom property and as fontFamily inline style
   * for CSS cascade to labels and overlay children.
   * @example 'Inter, system-ui, sans-serif'
   */
  readonly htmlFamily: string;
  /**
   * URL to an MSDF-encoded .ttf or .woff font file for Three.js text via troika-three-text.
   * Applies to: diagram node labels, group title labels, chart axis tick labels,
   * chart axis title labels, chart legend labels.
   *
   * If absent, each package falls back to the troika built-in default font.
   * IMPORTANT: The file must be MSDF-encoded. A standard web font URL will not render
   * correctly. For production, self-host the font file.
   *
   * @example 'https://my-cdn.com/fonts/inter-msdf.ttf'
   */
  readonly webglFontUrl?: string;
};

/**
 * Semantic font size scale — multipliers applied relative to each package's
 * internal base size.
 *
 * For HTML overlays: multiply against 1rem (browser default, 16px).
 *   --brewsite-font-size-heading = calc(1rem * heading)
 *
 * For WebGL text (troika): multiply against each package's internal world-unit base.
 *   Diagram: node height × 0.28 × label, group title × labelSizeFactor × label
 *   Charts: ChartAxisTokens.fontSize × annotation, ChartLegendTokens.fontSize × label
 *
 * These are proportional relationships, not absolute equivalences across rendering
 * targets. A scale of 0.8 makes text proportionally smaller in both HTML and WebGL,
 * but the rendered pixel sizes will differ because HTML px and Three.js world units
 * have no shared coordinate system.
 */
export type SceneThemeFontSizeScale = {
  /** e.g. 1.5 — large titles and section headings */
  readonly heading: number;
  /** e.g. 1.0 — standard reading text; the reference scale */
  readonly body: number;
  /** e.g. 0.85 — node labels, axis labels, legend text */
  readonly label: number;
  /** e.g. 0.7 — sublabels, small explanatory text */
  readonly caption: number;
  /** e.g. 0.6 — tiny callouts, axis tick labels */
  readonly annotation: number;
};

/**
 * Background fill — what the background IS. Mutually exclusive kinds.
 * 'color'    — solid CSS color string
 * 'image'    — image URL with optional CSS background-size and background-position
 * 'gradient' — CSS gradient string (e.g. 'linear-gradient(180deg, #0a0a14, #1a1a3e)')
 */
export type SceneThemeBackgroundFill =
  | { readonly kind: 'color'; readonly value: string }
  | { readonly kind: 'image'; readonly url: string; readonly size?: string; readonly position?: string }
  | { readonly kind: 'gradient'; readonly value: string };

/**
 * CSS filter and overlay effects applied on top of the background fill layer.
 * These are separate from the fill so an author can blur an image background
 * independently of changing the image itself.
 *
 * CSS filter is applied to the background element (may blur edge artifacts).
 * Overlay gradient and backdrop-filter apply to a second DOM element above the
 * background element, below the scene content.
 */
export type SceneThemeBackgroundEffects = {
  /**
   * CSS filter applied to the background DOM element.
   * @example 'blur(4px) brightness(0.8)'
   */
  readonly cssFilter?: string;
  /**
   * CSS gradient string for an overlay layer above the background, below scene content.
   * Requires BackgroundWidget to manage a second overlay DOM element.
   * @example 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 50%)'
   */
  readonly overlayGradient?: string;
  /**
   * CSS backdrop-filter applied to the overlay layer.
   * BROWSER SUPPORT: Not universally supported on older Android WebViews.
   * Use @supports guards or document the limitation for your target audience.
   * @example 'blur(12px)'
   */
  readonly backdropFilter?: string;
  /** Overall background opacity [0–1]. Applied to the background element. Default: 1 */
  readonly opacity?: number;
};

/**
 * Background configuration bundled into SceneTheme.
 * Defines the visual appearance of the scene background when used via
 * `<Background theme={sceneTheme} />`.
 */
export type SceneThemeBackground = {
  /** The background fill (color, image, or gradient). */
  readonly fill?: SceneThemeBackgroundFill;
  /** CSS filter and overlay effects layered on top of the fill. */
  readonly effects?: SceneThemeBackgroundEffects;
};

/**
 * Unified scene theme token set.
 *
 * Defined in @brewsite/core; imported and consumed by all packages.
 * Always optional — existing scenes that never pass a SceneTheme behave
 * identically to today.
 *
 * Injection points:
 * - Player level: `<EngineProvider sceneTheme={theme}>` → CSS variables via ThemeContext
 * - Per-scene background: `<Background theme={theme} />` → DOM fill and effects
 * - Per-diagram: `DiagramTheme.sceneTheme` → font URL and label color polarity fallbacks
 * - Per-chart: `ChartTheme.sceneTheme` or `ChartDSL.sceneTheme` → font URL and color defaults
 */
export type SceneTheme = {
  /**
   * Background polarity. 'dark' = dark scene (drives light text defaults).
   * 'light' = light scene (drives dark text defaults).
   */
  readonly colorMode: SceneColorMode;
  /** Font tokens for HTML and WebGL rendering. */
  readonly font: SceneThemeFontTokens;
  /** Semantic font size scale. Use 1.0 for the identity scale (no change). */
  readonly fontSize: SceneThemeFontSizeScale;
  /** Optional background fill and effects configuration. */
  readonly background?: SceneThemeBackground;
  /**
   * Primary accent color. Drives diagram node palette defaults and chart series[0].
   * Each package may interpret this differently. CSS hex string.
   * @example '#6b48ff'
   */
  readonly accentColor?: string;
};
```

### 3.2 `packages/core/src/theme/ThemeContext.ts` — NEW FILE

Responsibility: React context that carries `SceneTheme | null` from `EngineProvider` to `EngineOverlayHost`. No other logic.

```typescript
// React context for SceneTheme — populated by EngineProvider, consumed by EngineOverlayHost.
// ThemeContext holds a static player-level value. It does not update per scene.

import { createContext, useContext } from 'react';
import type { SceneTheme } from './types';

/**
 * React context carrying the player-level SceneTheme.
 * Default value is null (no theme). ThemeContext is opt-in.
 */
export const ThemeContext = createContext<SceneTheme | null>(null);

/**
 * Returns the current SceneTheme from context, or null if none is provided.
 * Does NOT throw — ThemeContext is purely opt-in.
 * Use this in EngineOverlayHost to read theme tokens for CSS variable injection.
 */
export const useTheme = (): SceneTheme | null => useContext(ThemeContext);
```

### 3.3 `packages/core/src/theme/presets.ts` — NEW FILE

Responsibility: Two named `SceneTheme` presets. These encode sensible defaults for dark and light scenes.

```typescript
// Named SceneTheme presets for common scene polarities.
// Consumers who need exact visual control should create a custom SceneTheme.

import type { SceneTheme } from './types';

/**
 * Dark-background scene preset.
 * Appropriate for tech/architectural presentations on dark backgrounds.
 * Label/overlay text defaults to light colors.
 */
export const darkSceneTheme: SceneTheme = {
  colorMode: 'dark',
  font: {
    htmlFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    // webglFontUrl is intentionally absent — falls back to troika built-in.
    // Override with a self-hosted MSDF font URL for production use.
  },
  fontSize: {
    heading:    1.5,
    body:       1.0,
    label:      0.85,
    caption:    0.7,
    annotation: 0.6,
  },
  background: {
    fill: { kind: 'color', value: '#0a0a14' },
  },
};

/**
 * Light-background scene preset.
 * Appropriate for documentation, product tours, and light UI contexts.
 * Label/overlay text defaults to dark colors.
 */
export const lightSceneTheme: SceneTheme = {
  colorMode: 'light',
  font: {
    htmlFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  fontSize: {
    heading:    1.5,
    body:       1.0,
    label:      0.85,
    caption:    0.7,
    annotation: 0.6,
  },
  background: {
    fill: { kind: 'color', value: '#f5f5f7' },
  },
};
```

### 3.4 `packages/core/src/theme/index.ts` — NEW FILE

```typescript
// Public exports for the theme module.
export type {
  SceneTheme,
  SceneColorMode,
  SceneThemeFontTokens,
  SceneThemeFontSizeScale,
  SceneThemeBackgroundFill,
  SceneThemeBackgroundEffects,
  SceneThemeBackground,
} from './types';
export { ThemeContext, useTheme } from './ThemeContext';
export { darkSceneTheme, lightSceneTheme } from './presets';
```

### 3.5 `packages/core/src/index.ts` — MODIFY

Add one line:
```typescript
export * from './theme';
```

Insert it after the `export * from './player';` line. All theme types and presets are now part of the `@brewsite/core` public API.

### 3.6 `packages/core/src/theme/__tests__/presets.test.ts` — NEW FILE

```typescript
// Interface-based stateful tests for SceneTheme presets.
// Tests the type shape and default value contracts — not implementation internals.

import { describe, it, expect } from 'vitest';
import { darkSceneTheme, lightSceneTheme } from '../presets';

describe('darkSceneTheme', () => {
  it('has colorMode "dark"', () => {
    expect(darkSceneTheme.colorMode).toBe('dark');
  });
  it('has all 5 fontSize scale levels', () => {
    expect(darkSceneTheme.fontSize.heading).toBeGreaterThan(1);
    expect(darkSceneTheme.fontSize.body).toBe(1.0);
    expect(darkSceneTheme.fontSize.label).toBeLessThan(1);
    expect(darkSceneTheme.fontSize.caption).toBeLessThan(darkSceneTheme.fontSize.label);
    expect(darkSceneTheme.fontSize.annotation).toBeLessThan(darkSceneTheme.fontSize.caption);
  });
  it('has a non-empty htmlFamily', () => {
    expect(darkSceneTheme.font.htmlFamily.length).toBeGreaterThan(0);
  });
  it('has no webglFontUrl by default', () => {
    expect(darkSceneTheme.font.webglFontUrl).toBeUndefined();
  });
  it('has a background fill', () => {
    expect(darkSceneTheme.background?.fill?.kind).toBe('color');
  });
});

describe('lightSceneTheme', () => {
  it('has colorMode "light"', () => {
    expect(lightSceneTheme.colorMode).toBe('light');
  });
  it('has all 5 fontSize scale levels ordered', () => {
    expect(lightSceneTheme.fontSize.heading).toBeGreaterThan(lightSceneTheme.fontSize.body);
    expect(lightSceneTheme.fontSize.label).toBeLessThan(lightSceneTheme.fontSize.body);
  });
});
```

---

## 4. Stream B — Background Element Extension

**Run after Stream A. No file conflicts with Streams C, D, or E.**

### 4.1 `packages/core/src/elements/background/types.ts` — MODIFY

Add the new compiled-state fields. Import nothing new (types only).

```typescript
// Background element types.
import type { SceneTheme } from '../../theme/types';  // add this import

export type Vec3 = [number, number, number];

export type SceneBackground = {
  imageUrl?: string;
  opacity: number;
  color?: string;        // solid CSS color
  /** CSS gradient string — takes precedence over color/imageUrl when set */
  gradient?: string;
  position?: Vec3;
  cssPosition?: string;
  cssSize?: string;
  cssRepeat?: string;
  /** CSS filter applied to the background DOM element. e.g. 'blur(4px) brightness(0.8)' */
  cssFilter?: string;
  /**
   * CSS gradient string for an overlay element above the background, below scene content.
   * Requires BackgroundWidget to manage an overlayElement (second DOM element).
   */
  overlayGradient?: string;
  /** CSS backdrop-filter applied to the overlay element. e.g. 'blur(12px)' */
  backdropFilter?: string;
};

// NOTE: SceneTheme is NOT stored in SceneBackground.
// The BackgroundWidget CUSTOM_NODE_HANDLER resolves SceneTheme at compile time
// into the above concrete fields.
```

### 4.2 `packages/core/src/elements/background/dsl.tsx` — MODIFY

Add new DSL props. Import `SceneTheme`.

```typescript
// Background element DSL components.

import type * as React from 'react';
import type { Vec3 } from './types';
import type { SceneTheme } from '../../theme/types';

/**
 * Background configuration for CSS DOM rendering.
 *
 * Fill hierarchy (first non-undefined wins):
 *   1. gradient prop (explicit gradient string)
 *   2. imageUrl prop (image URL)
 *   3. color prop (solid color)
 *   4. theme.background.fill (derived from SceneTheme)
 *
 * Effects hierarchy (explicit prop wins over theme-derived):
 *   cssFilter, overlayGradient, backdropFilter (explicit > theme.background.effects)
 */
export type BackgroundProps = {
  imageUrl?: string;
  opacity?: number;
  color?: string;
  /** CSS gradient string. Mutually exclusive with color/imageUrl (gradient takes precedence). */
  gradient?: string;
  /** World-space offset for the background plane. */
  position?: Vec3;
  cssPosition?: React.CSSProperties['backgroundPosition'];
  cssSize?: React.CSSProperties['backgroundSize'];
  cssRepeat?: React.CSSProperties['backgroundRepeat'];
  /** CSS filter applied to the background element. e.g. 'blur(4px) brightness(0.8)' */
  cssFilter?: string;
  /**
   * CSS gradient string for an overlay element above the background, below scene content.
   * @example 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 50%)'
   */
  overlayGradient?: string;
  /** CSS backdrop-filter on the overlay element. e.g. 'blur(12px)' */
  backdropFilter?: string;
  /**
   * Optional SceneTheme to derive background fill and effects from.
   * Per-element explicit props (color, gradient, cssFilter, etc.) override
   * theme-derived values. NOT stored in compiled SceneBackground — resolved
   * at compile time by BackgroundWidget's CUSTOM_NODE_HANDLER.
   */
  theme?: SceneTheme;
};

/** Scene background element. Renders as a DOM element behind the canvas. */
export const Background = (_props: BackgroundProps) => null;
Background.displayName = 'Background';
```

### 4.3 `packages/core/src/elements/background/compile.ts` — MODIFY

Extend `DEFAULT_BACKGROUND` and both transition specs to include the new fields.

```typescript
// Background element compilation.

import type { SceneBackground } from './types';
import type { ElementTransitionSpec, FunctionalTransitionSpec } from '../../compiler/transitions/transitionTypes';
import { blendOpacity, blendVec3, transitionT } from '../../compiler/transitions/transitionTypes';

const crossFadeOpacity = (from: SceneBackground, to: SceneBackground, t: number) => {
  // unchanged
};

const selectImageUrl = (from: string | undefined, to: string | undefined, t: number) =>
  from === to ? to : t < 0.5 ? from : to;

// New helper: select string properties discretely at midpoint
const selectStr = (from: string | undefined, to: string | undefined, t: number): string | undefined =>
  t < 0.5 ? from : to;

export const DEFAULT_BACKGROUND: SceneBackground = {
  imageUrl: undefined,
  opacity: 1,
  color: undefined,
  gradient: undefined,
  position: undefined,
  cssPosition: undefined,
  cssSize: undefined,
  cssRepeat: undefined,
  cssFilter: undefined,
  overlayGradient: undefined,
  backdropFilter: undefined,
};

// ElementTransitionSpec — extend interpolate to carry new fields discretely
export const backgroundTransitionSpec: ElementTransitionSpec<SceneBackground> = {
  exit: (frames, widgetId, fromState) => {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = {
        ...fromState,
        opacity: blendOpacity(fromState.opacity, 0, t),
      };
    }
  },
  enter: (frames, widgetId, toState) => {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = {
        ...toState,
        opacity: blendOpacity(0, toState.opacity, t),
      };
    }
  },
  interpolate: (frames, widgetId, fromState, toState) => {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = {
        imageUrl:       selectImageUrl(fromState.imageUrl, toState.imageUrl, t),
        opacity:        crossFadeOpacity(fromState, toState, t),
        color:          selectStr(fromState.color, toState.color, t),
        gradient:       selectStr(fromState.gradient, toState.gradient, t),
        position:       blendVec3(fromState.position, toState.position, t),
        cssPosition:    selectStr(fromState.cssPosition, toState.cssPosition, t),
        cssSize:        selectStr(fromState.cssSize, toState.cssSize, t),
        cssRepeat:      selectStr(fromState.cssRepeat, toState.cssRepeat, t),
        cssFilter:      selectStr(fromState.cssFilter, toState.cssFilter, t),
        overlayGradient: selectStr(fromState.overlayGradient, toState.overlayGradient, t),
        backdropFilter: selectStr(fromState.backdropFilter, toState.backdropFilter, t),
      };
    }
  },
};

// FunctionalTransitionSpec — same extension
export const functionalBackgroundTransitionSpec: FunctionalTransitionSpec<SceneBackground> = {
  exitFn: (from) => (ctx) => ({
    ...from,
    opacity: blendOpacity(from.opacity, 0, ctx.t) ?? 0,
  }),
  enterFn: (to) => (ctx) => ({
    ...to,
    opacity: blendOpacity(0, to.opacity, ctx.t) ?? to.opacity ?? 0,
  }),
  interpolateFn: (from, to) => (ctx) => ({
    imageUrl:       selectImageUrl(from.imageUrl, to.imageUrl, ctx.t),
    opacity:        crossFadeOpacity(from, to, ctx.t),
    color:          selectStr(from.color, to.color, ctx.t),
    gradient:       selectStr(from.gradient, to.gradient, ctx.t),
    position:       blendVec3(from.position, to.position, ctx.t),
    cssPosition:    selectStr(from.cssPosition, to.cssPosition, ctx.t),
    cssSize:        selectStr(from.cssSize, to.cssSize, ctx.t),
    cssRepeat:      selectStr(from.cssRepeat, to.cssRepeat, ctx.t),
    cssFilter:      selectStr(from.cssFilter, to.cssFilter, ctx.t),
    overlayGradient: selectStr(from.overlayGradient, to.overlayGradient, ctx.t),
    backdropFilter: selectStr(from.backdropFilter, to.backdropFilter, ctx.t),
  }),
};
```

### 4.4 `packages/core/src/elements/background/render.ts` — MODIFY

Extend `BackgroundDomRefs` and `applyBackground` to handle gradient fill, CSS filter, and overlay element.

**DOM structure:** The background element and overlay element are siblings in their parent container. The background element gets `filter:` (which must not affect siblings). The overlay element has `position: absolute; inset: 0; pointer-events: none; z-index` that places it above the background element but below the scene canvas.

```typescript
// Background element DOM renderer. Excluded from test coverage.

import type { SceneBackground } from './types';

export type BackgroundDomRefs = {
  element: HTMLElement;
  /**
   * Second DOM element positioned above the background, below scene content.
   * Managed by BackgroundWidget — created when setDomElement() is called,
   * removed on dispose(). Used for overlayGradient and backdropFilter.
   * null when BackgroundWidget has not yet been attached to a DOM element.
   */
  overlayElement: HTMLElement | null;
};

/**
 * Apply background state to DOM elements.
 *
 * Fill resolution order (first non-undefined wins):
 *   gradient → imageUrl → color → clear all
 *
 * When switching between fill kinds, the unused properties are cleared to prevent
 * leftover styles from the previous fill kind bleeding through.
 *
 * The CSS filter is applied to `element` (the background element).
 * The overlayGradient and backdropFilter are applied to `refs.overlayElement`.
 */
export function applyBackground(state: SceneBackground, refs: BackgroundDomRefs): void {
  const element = refs.element;

  // Fill: gradient takes absolute precedence over color and imageUrl
  if (state.gradient) {
    element.style.background = state.gradient;
    element.style.backgroundColor = '';
    element.style.backgroundImage = '';
  } else if (state.imageUrl) {
    element.style.background = '';
    element.style.backgroundColor = '';
    element.style.backgroundImage = `url('${state.imageUrl}')`;
  } else if (state.color) {
    element.style.background = '';
    element.style.backgroundColor = state.color;
    element.style.backgroundImage = '';
  } else {
    element.style.background = '';
    element.style.backgroundColor = '';
    element.style.backgroundImage = '';
  }

  // CSS filter on the background element
  element.style.filter = state.cssFilter ?? '';

  // Opacity and layout
  element.style.opacity = String(state.opacity ?? 1);
  if (state.cssPosition) { element.style.backgroundPosition = state.cssPosition; }
  if (state.cssSize)     { element.style.backgroundSize = state.cssSize; }
  if (state.cssRepeat)   { element.style.backgroundRepeat = state.cssRepeat; }
  if (state.position) {
    const [x, y, z] = state.position;
    element.style.transform = `translate3d(${x}px, ${y}px, ${z}px)`;
  } else {
    element.style.transform = '';
  }

  // Overlay element: overlayGradient + backdropFilter
  const overlay = refs.overlayElement;
  if (overlay) {
    if (state.overlayGradient || state.backdropFilter) {
      overlay.style.display = '';
      overlay.style.background = state.overlayGradient ?? '';
      overlay.style.backdropFilter = state.backdropFilter ?? '';
      // webkit prefix for Safari
      (overlay.style as Record<string, string>)['webkitBackdropFilter'] = state.backdropFilter ?? '';
    } else {
      overlay.style.display = 'none';
    }
  }
}
```

### 4.5 `packages/core/src/elements/background/BackgroundWidget.ts` — MODIFY

Add `CUSTOM_NODE_HANDLER` for theme-aware compilation, and overlay element lifecycle.

**Imports to add:** `CUSTOM_NODE_HANDLER`, `IHasCustomDslHandler` from `'../../widget/WidgetRegistry'`; `ReactElement`, `CompileApi`, `CompileHelpers` from compiler types; `SceneTheme`, `SceneThemeBackgroundFill` from theme types.

**Important:** The `CUSTOM_NODE_HANDLER` runs at **compile time** (inside the scene DSL compiler). It must remain a pure function that only reads props and writes to `api`. No DOM access, no Three.js. The overlay element lifecycle happens in `initialize`, `setDomElement`, and `dispose` — at runtime.

```typescript
// BackgroundWidget — ISceneElement + IRenderable + IHasCustomDslHandler.
// Implements CUSTOM_NODE_HANDLER for theme-aware DSL prop resolution.
// Manages a second overlay DOM element for overlayGradient/backdropFilter effects.

import type { ReactElement } from 'react';
import type {
  ISceneElement, IRenderable,
  WidgetInitContext, WidgetRenderContext,
} from '../../widget/types';
import type { NodeHandler } from '../../compiler/sceneDslTypes';
import { CUSTOM_NODE_HANDLER, type IHasCustomDslHandler } from '../../widget/WidgetRegistry';
import type { SceneBackground } from './types';
import type { BackgroundProps } from './dsl';
import { DEFAULT_BACKGROUND, functionalBackgroundTransitionSpec } from './compile';
import { Background } from './dsl';
import { applyBackground } from './render';

export class BackgroundWidget
  implements ISceneElement<SceneBackground>, IRenderable<SceneBackground>, IHasCustomDslHandler
{
  readonly widgetId = 'background';
  readonly defaultState: SceneBackground = DEFAULT_BACKGROUND;
  readonly transitionSpec = functionalBackgroundTransitionSpec;
  readonly DslComponent = Background;
  readonly useDefaultStateWhenAbsent = false;

  private domElement: HTMLElement | null = null;
  private overlayElement: HTMLElement | null = null;

  /**
   * Custom DSL node handler that resolves SceneTheme and explicit BackgroundProps
   * into a concrete SceneBackground state.
   *
   * Priority (highest wins):
   *   1. Explicit DSL props (color, gradient, imageUrl, cssFilter, etc.)
   *   2. theme.background.fill / theme.background.effects derived values
   *   3. DEFAULT_BACKGROUND defaults
   *
   * The 'theme' prop itself is NOT stored in SceneBackground — it is consumed
   * here at compile time only.
   */
  readonly [CUSTOM_NODE_HANDLER]: NodeHandler = (node: ReactElement, api, _helpers): void => {
    const props = node.props as BackgroundProps;
    const theme = props.theme;

    // Start from defaults
    const state: SceneBackground = { ...DEFAULT_BACKGROUND };

    // Step 1: Apply theme-derived values as base (lower priority)
    if (theme?.background?.fill) {
      const fill = theme.background.fill;
      switch (fill.kind) {
        case 'color':
          state.color = fill.value;
          break;
        case 'gradient':
          state.gradient = fill.value;
          break;
        case 'image':
          state.imageUrl = fill.url;
          if (fill.size)     state.cssSize = fill.size;
          if (fill.position) state.cssPosition = fill.position;
          break;
      }
    }
    if (theme?.background?.effects) {
      const fx = theme.background.effects;
      if (fx.cssFilter)       state.cssFilter = fx.cssFilter;
      if (fx.overlayGradient) state.overlayGradient = fx.overlayGradient;
      if (fx.backdropFilter)  state.backdropFilter = fx.backdropFilter;
      if (fx.opacity !== undefined) state.opacity = fx.opacity;
    }

    // Step 2: Apply explicit props as overrides (higher priority)
    // When gradient is set explicitly, clear color (they're mutually exclusive in the fill slot)
    if (props.gradient !== undefined) {
      state.gradient = props.gradient;
      state.color = undefined;
    }
    if (props.color !== undefined && props.gradient === undefined) {
      state.color = props.color;
      state.gradient = undefined;
    }
    if (props.imageUrl !== undefined)       state.imageUrl = props.imageUrl;
    if (props.opacity !== undefined)        state.opacity = props.opacity;
    if (props.position !== undefined)       state.position = props.position;
    if (props.cssPosition !== undefined)    state.cssPosition = props.cssPosition;
    if (props.cssSize !== undefined)        state.cssSize = props.cssSize;
    if (props.cssRepeat !== undefined)      state.cssRepeat = props.cssRepeat;
    if (props.cssFilter !== undefined)      state.cssFilter = props.cssFilter;
    if (props.overlayGradient !== undefined) state.overlayGradient = props.overlayGradient;
    if (props.backdropFilter !== undefined) state.backdropFilter = props.backdropFilter;

    api.setWidgetState(this.widgetId, state);
  };

  mergeSnapshot(
    prev: SceneBackground | undefined,
    next: SceneBackground | undefined,
  ): SceneBackground | undefined {
    if (!prev && !next) return undefined;
    if (!next) return prev;
    return { ...prev, ...next } as SceneBackground;
  }

  initialize(_ctx: WidgetInitContext): void {
    // domElement and overlayElement are attached via setDomElement() by the engine layer.
  }

  /**
   * Attach the background DOM element.
   * Creates the overlay element as a sibling of `element` in the parent container,
   * positioned to cover the same area. The overlay element is inserted immediately
   * after `element` in the DOM.
   */
  setDomElement(element: HTMLElement | null): void {
    // Clean up previous overlay if present
    if (this.overlayElement && this.overlayElement.parentElement) {
      this.overlayElement.parentElement.removeChild(this.overlayElement);
    }
    this.overlayElement = null;
    this.domElement = element;

    if (element && element.parentElement) {
      const overlay = document.createElement('div');
      overlay.style.cssText =
        'position:absolute;inset:0;pointer-events:none;display:none;z-index:1;';
      // Insert immediately after the background element
      element.insertAdjacentElement('afterend', overlay);
      this.overlayElement = overlay;
    }
  }

  apply(state: SceneBackground, _ctx: WidgetRenderContext): void {
    if (!this.domElement) return;
    applyBackground(state, { element: this.domElement, overlayElement: this.overlayElement });
  }

  dispose(): void {
    if (this.overlayElement && this.overlayElement.parentElement) {
      this.overlayElement.parentElement.removeChild(this.overlayElement);
    }
    this.overlayElement = null;
    this.domElement = null;
  }
}
```

### 4.6 Test file updates

**`packages/core/src/elements/background/__tests__/BackgroundCompile.test.ts` — MODIFY**

Add tests for new fields in both transition specs:
- `functionalBackgroundTransitionSpec` interpolate preserves `gradient` and `cssFilter` at both endpoints (t=0 and t=1)
- `backgroundTransitionSpec.interpolate` switches `cssFilter` at midpoint (t=0.5 → from side)
- `applyBackground` sets `element.style.background` when `gradient` is set
- `applyBackground` clears `element.style.backgroundColor` and `element.style.backgroundImage` when `gradient` is set
- `applyBackground` sets `element.style.filter` when `cssFilter` is set
- `applyBackground` sets `overlay.style.background` when `overlayGradient` is set
- `applyBackground` sets `overlay.style.display = 'none'` when neither `overlayGradient` nor `backdropFilter` is set
- `applyBackground` handles null overlayElement gracefully (no error when overlayElement is null)

**`packages/core/src/elements/background/__tests__/BackgroundWidget.test.ts` — MODIFY**

Add tests for the `CUSTOM_NODE_HANDLER`:
- **Regression: Handler with existing legacy props (color, imageUrl, opacity, position, cssPosition, cssSize, cssRepeat) and NO theme prop produces the same `SceneBackground` state as before.** This is the backward-compatibility guard for all existing scenes that use `<Background>` without any `SceneTheme`. A passing result means the CUSTOM_NODE_HANDLER correctly handles the no-theme path identically to the previous standard handler.
- Handler with no props and no theme produces `DEFAULT_BACKGROUND`
- Handler with `color` prop sets `state.color`
- Handler with `gradient` prop sets `state.gradient` and clears `state.color`
- Handler with `theme.background.fill.kind = 'gradient'` sets `state.gradient`
- Handler with `theme.background.fill.kind = 'color'` and explicit `color` prop → explicit prop wins
- Handler with `theme.background.effects.cssFilter` and no explicit `cssFilter` prop → theme-derived value used
- Handler with both `theme.background.effects.cssFilter` and explicit `cssFilter` prop → explicit prop wins
- `apply()` with `cssFilter` state sets `element.style.filter`
- `apply()` with `overlayGradient` state sets `overlayElement.style.background`

Test helper for CUSTOM_NODE_HANDLER: create a minimal fake `ReactElement` with `props`, a mock `CompileApi` with a `setWidgetState` spy, and pass them to `widget[CUSTOM_NODE_HANDLER](node, api, helpers)`. Assert the value passed to `setWidgetState`. This tests the pure compile logic without any DOM.

---

## 5. Stream C — Player Integration (EngineProvider + EngineOverlayHost)

**Run after Stream A. No file conflicts with Streams B, D, or E.**

### 5.1 `packages/core/src/player/EngineProvider.tsx` — MODIFY

**Import changes:**
```typescript
import { ThemeContext } from '../theme/ThemeContext';
import type { SceneTheme } from '../theme/types';
```

**Prop addition to `EngineProviderProps`:**
```typescript
export type EngineProviderProps = {
  // ... all existing props unchanged ...
  /**
   * Optional scene theme token set for cross-package visual styling.
   *
   * When provided:
   * - CSS variables (font family, font sizes, color mode) are injected by
   *   EngineOverlayHost via ThemeContext. This affects all HTML overlay content.
   * - CSS variable values are static for the player lifetime — they do not
   *   change per scene. For per-scene background changes, use <Background theme={...}/>.
   *
   * WebGL font URL (sceneTheme.font.webglFontUrl) must be passed explicitly to
   * DiagramTheme.sceneTheme or ChartTheme.sceneTheme (or ChartDSL.sceneTheme) —
   * it is not automatically plumbed from EngineProvider to WebGL renderers.
   */
  sceneTheme?: SceneTheme;
  children: ReactNode;
};
```

**ThemeContext.Provider wrapping:** Wrap the entire return in `ThemeContext.Provider`:

```typescript
return (
  <ThemeContext.Provider value={props.sceneTheme ?? null}>
    <SceneRegistrationContext.Provider value={registrationContextValue}>
      <VariableStoreContext.Provider value={engine.variableStore}>
        {innerContent}
      </VariableStoreContext.Provider>
    </SceneRegistrationContext.Provider>
  </ThemeContext.Provider>
);
```

### 5.2 `packages/core/src/player/EngineOverlayHost.tsx` — MODIFY

**Import changes:**
```typescript
import { useTheme } from '../theme/ThemeContext';
```

**Inside the component:**
```typescript
export const EngineOverlayHost = ({ ... }: EngineOverlayHostProps): ReactElement | null => {
  const { sceneId } = useEngineState();
  const engine = useSceneEngineContext();
  const theme = useTheme();  // NEW — null when no sceneTheme on EngineProvider

  // ... existing logic ...

  if (!overlayContent) return null;

  // Build CSS variable injection object when theme is present
  // CSSProperties doesn't include custom properties; cast is required.
  const themeStyles = theme ? ({
    '--brewsite-font-family':          theme.font.htmlFamily,
    fontFamily:                        'var(--brewsite-font-family)',
    '--brewsite-font-size-heading':    `calc(1rem * ${theme.fontSize.heading})`,
    '--brewsite-font-size-body':       `calc(1rem * ${theme.fontSize.body})`,
    '--brewsite-font-size-label':      `calc(1rem * ${theme.fontSize.label})`,
    '--brewsite-font-size-caption':    `calc(1rem * ${theme.fontSize.caption})`,
    '--brewsite-font-size-annotation': `calc(1rem * ${theme.fontSize.annotation})`,
    '--brewsite-color-mode':           theme.colorMode,
    '--brewsite-text-primary':
      theme.colorMode === 'dark' ? '#ffffff' : '#111111',
    '--brewsite-text-secondary':
      theme.colorMode === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
    // accentColor is only injected when set. Setting '--brewsite-accent-color' to ''
    // (empty string) would cause var(--brewsite-accent-color, fallback) to return ''
    // instead of the fallback — CSS treats empty value as "set but invalid". Skip
    // injection entirely when accentColor is absent so consumer fallbacks work correctly.
    ...(theme.accentColor ? { '--brewsite-accent-color': theme.accentColor } : {}),
  } as React.CSSProperties) : {};

  return (
    <div
      key={sceneId}
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 10,
        pointerEvents: passthroughPointerEvents ? 'none' : 'auto',
        ...(transitionEnabled
          ? { animation: `brewsite-overlay-enter ${transitionDurationMs}ms ${transitionEasing}` }
          : {}),
        ...themeStyles,   // NEW — CSS variable injection
      }}
    >
      {overlayContent}
    </div>
  );
};
```

**CSS variable reference table:**

| Variable | Value formula | Purpose |
|---|---|---|
| `--brewsite-font-family` | `theme.font.htmlFamily` | Font family for all overlay text |
| `fontFamily` (inline style) | `'var(--brewsite-font-family)'` | Ensures CSS cascade to labels |
| `--brewsite-font-size-heading` | `calc(1rem * ${theme.fontSize.heading})` | Title/section text |
| `--brewsite-font-size-body` | `calc(1rem * ${theme.fontSize.body})` | Standard reading text |
| `--brewsite-font-size-label` | `calc(1rem * ${theme.fontSize.label})` | Node/axis labels |
| `--brewsite-font-size-caption` | `calc(1rem * ${theme.fontSize.caption})` | Sublabels, secondary text |
| `--brewsite-font-size-annotation` | `calc(1rem * ${theme.fontSize.annotation})` | Tick labels, callouts |
| `--brewsite-color-mode` | `theme.colorMode` | String 'dark' or 'light' for JS reads |
| `--brewsite-text-primary` | `colorMode='dark' ? '#ffffff' : '#111111'` | Primary text color |
| `--brewsite-text-secondary` | `colorMode='dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'` | Secondary text color |
| `--brewsite-accent-color` | `theme.accentColor` (omitted when undefined) | Accent/highlight color; only injected when accentColor is set so `var(--brewsite-accent-color, fallback)` works correctly |

### 5.3 `packages/core/src/player/__tests__/EngineOverlayHost.test.tsx` — MODIFY

Add tests:
- When `ThemeContext` has no value (null), no CSS custom properties are added to the overlay div.
- When `ThemeContext` has a theme with `colorMode: 'dark'`, the overlay div's `fontFamily` style is `'var(--brewsite-font-family)'`.
- When `ThemeContext` has a theme, `--brewsite-font-family` is set as an inline style.
- When `ThemeContext` has a theme with `colorMode: 'light'`, `--brewsite-text-primary` is `'#111111'`.
- When `ThemeContext` has a theme with `colorMode: 'dark'`, `--brewsite-text-primary` is `'#ffffff'`.

Test setup: wrap `<EngineOverlayHost>` in a `ThemeContext.Provider value={testTheme}` and check the rendered div's style attribute. Use the existing test infrastructure (mock `useEngineState` and `useSceneEngineContext` as used in the existing test file).

---

## 6. Stream D — Diagram Integration

**Run after Stream A. No file conflicts with Streams B, C, or E.**

### 6.1 `packages/diagram/src/elements/diagram/types.ts` — MODIFY

Add `sceneTheme?: SceneTheme` to the `DiagramTheme` interface. This field is used by `themeResolver.ts` to derive font URL and label color polarity fallbacks.

**Import to add (at the top of the types file):**
```typescript
import type { SceneTheme } from '@brewsite/core';
```

**Addition to `DiagramTheme` interface** (add as the last field before the closing brace):
```typescript
export interface DiagramTheme {
  readonly node: DiagramThemeNodeConfig;
  readonly edge: DiagramThemeEdgeConfig;
  readonly group: DiagramThemeGroupConfig;
  readonly environment: DiagramThemeEnvironmentConfig;
  readonly layout?: DiagramThemeLayoutConfig;
  readonly palette?: readonly string[];
  /**
   * Optional cross-package scene theme context.
   *
   * When present, `themeResolver.ts` derives:
   * - `fontUrl`: `theme.node.fontUrl ?? sceneTheme.font.webglFontUrl` (node.fontUrl wins)
   * - `effectiveLabelSizeFactor`: `theme.node.labelSizeFactor * sceneTheme.fontSize.label`
   *
   * For label color polarity (colorMode → label colors): built-in presets all have
   * explicit `defaultLabelColor` values, so `sceneTheme.colorMode` has NO effect on
   * label colors when using a preset directly. Use `withColorMode(preset, colorMode)`
   * from the themes package to create a preset with colorMode-derived label colors.
   */
  readonly sceneTheme?: SceneTheme;
}
```

### 6.2 `packages/diagram/src/elements/diagram/compiler/themeResolver.ts` — MODIFY

Extend `buildThemeRenderConfig` to apply `sceneTheme` fallbacks. Also extend `DiagramThemeRenderConfig` to include `effectiveLabelSizeFactor` (needed downstream by `nodeCompiler.ts` when the scene theme's `fontSize.label` scale is set).

**Check if `DiagramThemeRenderConfig` is defined in `types.ts` or here** — it is defined in `types.ts`. The plan must specify changes to BOTH files.

**Changes to `DiagramThemeRenderConfig` in `types.ts`:**
Add `effectiveLabelSizeFactor?: number` and `effectiveSublabelSizeFactor?: number` as **optional** fields. Making them optional avoids breaking `NodeRenderer.test.ts` and any other test that constructs `DiagramThemeRenderConfig` directly as a fixture — that test file is a public-type fixture and adding non-optional fields would cause a TypeScript compile failure. When these fields are absent (legacy consumers), downstream code defaults to `1.0` via `?? 1.0`.

```typescript
export interface DiagramThemeRenderConfig {
  // ... existing fields ...
  fontUrl?: string;
  /**
   * Effective label size factor after applying SceneTheme fontSize.label scale.
   * = theme.node.labelSizeFactor * (theme.sceneTheme?.fontSize.label ?? 1.0)
   * Optional — defaults to 1.0 when absent (identity, no size change).
   */
  effectiveLabelSizeFactor?: number;
  effectiveSublabelSizeFactor?: number;
}
```

**Changes to `buildThemeRenderConfig` in `themeResolver.ts`:**

```typescript
export function buildThemeRenderConfig(theme: DiagramTheme): DiagramThemeRenderConfig {
  const labelScale = theme.sceneTheme?.fontSize.label ?? 1.0;
  const captionScale = theme.sceneTheme?.fontSize.caption ?? 1.0;  // sublabels are caption-level

  return {
    envMapUrl:         theme.environment.envMapUrl,
    envMapIntensity:   theme.environment.envMapIntensity,
    skyColor:          theme.environment.skyColor,
    horizonColor:      theme.environment.horizonColor,
    nodeGlowIntensity:  theme.node.glowIntensity,
    nodeCornerRadius:   theme.node.cornerRadius,
    use3DArrows:        theme.edge.use3DArrows,
    edgeSmoothness:     theme.edge.smoothness,
    edgeMetalness:      theme.edge.defaultMetalness,
    edgeRoughness:      theme.edge.defaultRoughness,
    edgeFlowSpeed:      theme.edge.defaultFlowSpeed,
    edgeFlowWidth:      theme.edge.defaultFlowWidth,
    // Font URL: explicit node.fontUrl takes precedence over sceneTheme fallback.
    // sceneTheme.font.webglFontUrl is only used when node.fontUrl is absent.
    fontUrl:            theme.node.fontUrl ?? theme.sceneTheme?.font.webglFontUrl,
    // Size factors composed with SceneTheme font size scale:
    effectiveLabelSizeFactor:    theme.node.labelSizeFactor * labelScale,
    effectiveSublabelSizeFactor: theme.node.sublabelSizeFactor * captionScale,
  };
}
```

**Important:** After this change, `NodeRenderer` and `GroupRenderer` must be updated to:
1. Pass `renderConfig.fontUrl` to their `ensureText()` calls (requires Stream E's `ensureText` fontUrl parameter — see sequencing note below).
2. Apply `renderConfig.effectiveLabelSizeFactor ?? 1.0` to their label font size computation.

These files are assigned to Stream D (see file ownership table). They are render-layer files that import Three.js but are not `render.ts` barrel exports, so they must be explicitly updated.

**IMPORTANT — current NodeRenderer behavior (code-verified):** NodeRenderer currently computes label font size as `const labelFontSize = contentH * 0.28` with NO theme factor applied. `labelSizeFactor` is defined in `DiagramThemeNodeConfig` and set to 1.0 in all four presets, but is currently **dead code in the rendering pipeline** — it is never read by NodeRenderer or GroupRenderer. This work activates `labelSizeFactor` for the first time by wiring it through `DiagramThemeRenderConfig.effectiveLabelSizeFactor`. Since all presets use `labelSizeFactor: 1.0`, the default visual output is unchanged. The developer implementing Stream D should understand they are NOT refactoring existing behavior — they are activating a feature that was never wired up.

The label font size change in `NodeRenderer.ts`:
```typescript
// BEFORE (current):
const labelFontSize = contentH * 0.28;

// AFTER (Stream D):
const labelFontSize = contentH * 0.28 * (themeConfig.effectiveLabelSizeFactor ?? 1.0);
```

The `ensureText()` fontUrl parameter addition in `NodeRenderer.ts` and `GroupRenderer.ts`:
```typescript
// BEFORE (current — ensureText has no fontUrl param):
ensureText(labelText, value, color, labelFontSize, opacity, maxWidth, shrinkToFit, { anchorX, anchorY, ... });

// AFTER (Stream D + Stream E dependency):
ensureText(labelText, value, color, labelFontSize, opacity, maxWidth, shrinkToFit, { anchorX, anchorY, ..., fontUrl: themeConfig.fontUrl });
```

**Sequencing note:** Stream D's `ensureText` fontUrl call site changes depend on Stream E's addition of `fontUrl` to `TextLayoutOptions`. Stream D should add the `fontUrl` argument and accept that TypeScript may not enforce it until Stream E lands. In CI, all streams must be merged before typecheck passes cleanly; merge Stream A first, then B/C/D/E as a group.

### 6.2a `packages/diagram/src/elements/diagram/rendering/NodeRenderer.ts` — MODIFY (Stream D)

This file is part of Stream D. It does not have a corresponding `.test.ts` in `rendering/__tests__/` for the label size factor change (render layer; excluded from coverage). Only the fontUrl and labelSizeFactor call sites need updating per the description in 6.2 above.

### 6.2b `packages/diagram/src/elements/diagram/rendering/GroupRenderer.ts` — MODIFY (Stream D)

Same as NodeRenderer: update `ensureText` call sites to pass `fontUrl: themeConfig.fontUrl` in layout options. Group title labels also use the diagram-wide fontUrl. Apply `effectiveLabelSizeFactor ?? 1.0` to group title font size computation if applicable.

### 6.3 `packages/diagram/src/elements/diagram/themes/mergeTheme.ts` — MODIFY

Add `withColorMode()` utility. Import `SceneColorMode` from `@brewsite/core`.

```typescript
// Add this import:
import type { SceneColorMode } from '@brewsite/core';

/**
 * Creates a new DiagramTheme by overriding `node.defaultLabelColor` and
 * `node.defaultSublabelColor` with colorMode-appropriate defaults.
 *
 * Use this when you want `sceneTheme.colorMode` to drive diagram label colors
 * while using a built-in preset. All four built-in presets (darkGlass, enterprise,
 * neonCyber, lightMinimal) have explicit label colors, so sceneTheme.colorMode
 * alone has no effect on label colors when using a preset directly.
 *
 * @param base - The base DiagramTheme (typically a preset).
 * @param colorMode - The scene color mode that should drive label colors.
 * @returns A new DiagramTheme with colorMode-derived label colors.
 *
 * @example
 * const myTheme = withColorMode(darkGlassTheme, 'dark');
 * // myTheme.node.defaultLabelColor === '#e8eeff' (light on dark)
 *
 * @example
 * const myTheme = withColorMode(lightMinimalTheme, 'light');
 * // myTheme.node.defaultLabelColor === '#111111' (dark on light)
 */
export function withColorMode(base: DiagramTheme, colorMode: SceneColorMode): DiagramTheme {
  const isDark = colorMode === 'dark';
  return {
    ...base,
    node: {
      ...base.node,
      defaultLabelColor:    isDark ? '#e8eeff' : '#111111',
      defaultSublabelColor: isDark ? '#8ba4d4' : '#4a5568',
    },
  };
}
```

Also update `packages/diagram/src/elements/diagram/themes/index.ts` to export `withColorMode`.

### 6.4 Test files for diagram

**`packages/diagram/src/elements/diagram/compiler/__tests__/themeResolver.test.ts` — NEW FILE**

```typescript
import { describe, it, expect } from 'vitest';
import { buildThemeRenderConfig } from '../themeResolver';
import { darkGlassTheme } from '../../themes/darkGlass';
import type { DiagramTheme } from '../../types';

describe('buildThemeRenderConfig', () => {
  it('extracts fontUrl from node.fontUrl when present', () => {
    const theme: DiagramTheme = {
      ...darkGlassTheme,
      node: { ...darkGlassTheme.node, fontUrl: 'https://cdn.example.com/font.ttf' },
    };
    const config = buildThemeRenderConfig(theme);
    expect(config.fontUrl).toBe('https://cdn.example.com/font.ttf');
  });

  it('falls back to sceneTheme.font.webglFontUrl when node.fontUrl is absent', () => {
    const theme: DiagramTheme = {
      ...darkGlassTheme,
      node: { ...darkGlassTheme.node, fontUrl: undefined },
      sceneTheme: {
        colorMode: 'dark',
        font: { htmlFamily: 'sans-serif', webglFontUrl: 'https://cdn.example.com/fallback.ttf' },
        fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
      },
    };
    const config = buildThemeRenderConfig(theme);
    expect(config.fontUrl).toBe('https://cdn.example.com/fallback.ttf');
  });

  it('node.fontUrl takes precedence over sceneTheme.font.webglFontUrl', () => {
    const theme: DiagramTheme = {
      ...darkGlassTheme,
      node: { ...darkGlassTheme.node, fontUrl: 'node-specific.ttf' },
      sceneTheme: {
        colorMode: 'dark',
        font: { htmlFamily: 'sans-serif', webglFontUrl: 'fallback.ttf' },
        fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
      },
    };
    const config = buildThemeRenderConfig(theme);
    expect(config.fontUrl).toBe('node-specific.ttf');
  });

  it('effectiveLabelSizeFactor applies sceneTheme.fontSize.label multiplier', () => {
    const theme: DiagramTheme = {
      ...darkGlassTheme,
      node: { ...darkGlassTheme.node, labelSizeFactor: 1.0 },
      sceneTheme: {
        colorMode: 'dark',
        font: { htmlFamily: 'sans-serif' },
        fontSize: { heading: 1.5, body: 1.0, label: 0.8, caption: 0.7, annotation: 0.6 },
      },
    };
    const config = buildThemeRenderConfig(theme);
    expect(config.effectiveLabelSizeFactor).toBeCloseTo(0.8);
  });

  it('effectiveLabelSizeFactor is 1.0 × labelSizeFactor when no sceneTheme', () => {
    const theme: DiagramTheme = {
      ...darkGlassTheme,
      node: { ...darkGlassTheme.node, labelSizeFactor: 1.2 },
    };
    const config = buildThemeRenderConfig(theme);
    expect(config.effectiveLabelSizeFactor).toBeCloseTo(1.2);
  });

  it('fontUrl is undefined when neither node.fontUrl nor sceneTheme.font.webglFontUrl is set', () => {
    const config = buildThemeRenderConfig(darkGlassTheme);
    expect(config.fontUrl).toBeUndefined();
  });
});
```

**`packages/diagram/src/elements/diagram/themes/__tests__/mergeTheme.test.ts` — MODIFY**

Add tests:
- `withColorMode(darkGlassTheme, 'dark')` → `node.defaultLabelColor` is a light hex
- `withColorMode(darkGlassTheme, 'light')` → `node.defaultLabelColor` is a dark hex
- `withColorMode` does not mutate the original theme
- Other theme fields (edge, group, environment) are unchanged by `withColorMode`

---

## 7. Stream E — Charts and Model Integration

**Run after Stream A. Also requires `packages/core/src/text/` changes (not touched by B, C, or D).**

### 7.1 `packages/core/src/text/types.ts` — MODIFY

Add `font?: string` to `TextWithLayout` to allow `ensureText` to set the troika font URL.

```typescript
export type TextWithLayout = {
  text: string;
  color: string | number;
  fontSize: number;
  /**
   * URL to an MSDF-encoded font file for troika-three-text.
   * When set, troika uses this font instead of its built-in default.
   * Corresponds to troika Text object's .font property.
   */
  font?: string;
  anchorX?: string | number;
  anchorY?: string | number;
  textAlign?: string;
  overflowWrap?: string;
  whiteSpace?: string;
  lineHeight?: number;
  maxWidth?: number;
  fillOpacity?: number;
  visible: boolean;
  sync(): void;
  userData: Record<string, unknown>;
  textRenderInfo?: unknown;
};
```

### 7.2 `packages/core/src/text/TextRenderer.ts` — MODIFY

Add `fontUrl?: string` to `TextLayoutOptions`. Include it in the `layoutChanged` check and set `text.font = fontUrl` when changed.

```typescript
type TextLayoutOptions = {
  anchorX?: 'left' | 'center' | 'right';
  anchorY?: 'top' | 'middle' | 'bottom';
  textAlign?: 'left' | 'center' | 'right';
  overflowWrap?: 'normal' | 'break-word';
  whiteSpace?: 'normal' | 'nowrap' | 'pre' | 'pre-line' | 'pre-wrap';
  lineHeight?: number;
  /**
   * URL to an MSDF-encoded font for troika-three-text.
   * When changed, triggers a layout re-sync. When absent or undefined,
   * troika retains its current font (built-in default on first use).
   */
  fontUrl?: string;
};

export function ensureText(
  text: TextWithLayout,
  value: string,
  color: string,
  baseFontSize: number,
  opacity: number,
  maxWidth?: number,
  shrinkToFit: boolean = false,
  layout: TextLayoutOptions = {},
): void {
  // ... existing setup code ...

  const layoutChanged =
    text.text !== value ||
    text.color !== color ||
    text.anchorX !== nextAnchorX ||
    text.anchorY !== nextAnchorY ||
    text.textAlign !== nextAlign ||
    text.overflowWrap !== nextOverflow ||
    text.whiteSpace !== nextWhiteSpace ||
    text.lineHeight !== nextLineHeight ||
    baseChanged ||
    userData.maxWidth !== maxWidth ||
    userData.shrinkToFit !== shrinkToFit ||
    text.font !== (layout.fontUrl ?? text.font);  // NEW: font change triggers re-sync

  if (layoutChanged) {
    // Set font URL before sync — must happen before text.sync() call
    if (layout.fontUrl !== undefined && text.font !== layout.fontUrl) {
      text.font = layout.fontUrl;
    }
    // ... rest of existing layout assignments and sync() call ...
  }

  // ... rest of ensureText unchanged ...
}
```

### 7.3 `packages/charts/src/themes/types.ts` — MODIFY

Add `sceneTheme?: SceneTheme` to `ChartTheme`:

```typescript
import type { SceneTheme } from '@brewsite/core';  // NEW import

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
   * - Axis/legend label color override from sceneTheme.colorMode when not set by the chart theme
   *
   * Priority: explicit ChartTheme axis.labelColor and legend.textColor take precedence.
   * sceneTheme provides DEFAULT fallbacks only.
   *
   * Note: four built-in chart themes have explicit labelColor/textColor values.
   * sceneTheme.colorMode has no effect when using them without a custom override.
   */
  readonly sceneTheme?: SceneTheme;
};
```

### 7.4 `packages/charts/src/elements/chart/types.ts` — MODIFY

Add `sceneTheme?: SceneTheme` to both `ChartDSL` and `ChartState`:

```typescript
import type { SceneTheme } from '@brewsite/core';  // NEW import

export type ChartDSL = {
  // ... existing fields ...
  /**
   * Optional scene theme for cross-package theming.
   * When set, overrides ChartTheme.sceneTheme for this element.
   * Enables using a named theme (e.g. 'darkGlass') with a custom sceneTheme
   * without constructing a full ChartTheme object.
   *
   * @example
   * <Chart theme="darkGlass" sceneTheme={mySceneTheme} />
   */
  readonly sceneTheme?: SceneTheme;
};

export type ChartState = {
  // ... existing fields ...
  /**
   * Scene theme for cross-package theming.
   * Resolved at compile time from the DSL sceneTheme prop.
   * Takes precedence over ChartTheme.sceneTheme when set.
   */
  readonly sceneTheme?: SceneTheme;
};

export const DEFAULT_CHART_STATE: ChartState = {
  // ... existing fields ...
  sceneTheme: undefined,
};
```

### 7.5 `packages/charts/src/elements/chart/compile.ts` — MODIFY

Pass `sceneTheme` through in `compileChart`:

```typescript
export function compileChart(
  dsl: Partial<ChartDSL>,
  dataDsl: ChartDataDSL | null,
  axisDsls: readonly ChartAxisDSL[],
  seriesDsls: readonly ChartSeriesDSL[],
  legendDsl: ChartLegendDSL | null,
): ChartState {
  return {
    // ... existing fields ...
    sceneTheme: dsl.sceneTheme,  // NEW — pass through from DSL
  };
}
```

Also extend `functionalChartTransitionSpec` to carry `sceneTheme` in the interpolated state:
```typescript
interpolateFn: (from: ChartState, to: ChartState) => (ctx): ChartState => ({
  ...to,
  // ... existing blended fields ...
  sceneTheme: ctx.t < 0.5 ? from.sceneTheme : to.sceneTheme,  // discrete switch at midpoint
}),
```

### 7.6 `packages/charts/src/renderers/shared/IChartRenderer.ts` — MODIFY

Add `fontUrl?: string` to `ChartRenderContext`:

```typescript
export type ChartRenderContext = {
  readonly seriesGroup: THREE.Group;
  readonly axesGroup: THREE.Group;
  readonly legendGroup: THREE.Group;
  readonly data: ResolvedDataFrame;
  readonly xAxis: ChartAxisState | null;
  readonly yAxis: ChartAxisState | null;
  readonly series: readonly ChartSeriesState[];
  readonly bounds: { readonly width: number; readonly height: number; readonly depth: number };
  readonly theme: ChartTheme;
  readonly opacity: number;
  readonly innerRadius: number;
  /**
   * Optional MSDF font URL for troika-three-text label rendering.
   * Derived by ChartRenderer from state.sceneTheme.font.webglFontUrl
   * and theme.sceneTheme.font.webglFontUrl (state sceneTheme takes precedence).
   * When absent, each renderer falls back to the troika built-in font.
   */
  readonly fontUrl?: string;
};
```

### 7.7 `packages/charts/src/elements/chart/render.ts` — MODIFY

Derive `fontUrl` and pass it to `IChartRenderer.update()`. No structural changes to `ChartRenderer` class — only add resolution logic in `update()`.

```typescript
// In ChartRenderer.update():
update(state: ChartState, widgetId: string): void {
  // ... existing position/rotation/type-switch logic ...

  const theme: ChartTheme =
    typeof state.theme === 'string'
      ? (THEME_MAP[state.theme as ChartThemeName] ?? darkGlassChartTheme)
      : state.theme;

  // Resolve sceneTheme: state.sceneTheme (DSL prop) takes precedence over theme.sceneTheme
  const resolvedSceneTheme = state.sceneTheme ?? theme.sceneTheme;

  // Derive font URL from sceneTheme
  const fontUrl = resolvedSceneTheme?.font.webglFontUrl;

  this.activeRenderer.update({
    seriesGroup: this.seriesGroup,
    axesGroup: this.axesGroup,
    legendGroup: this.legendGroup,
    data,
    xAxis: state.xAxis,
    yAxis: state.yAxis,
    series: state.series,
    bounds: state.bounds,
    theme,
    opacity: state.opacity,
    innerRadius: state.innerRadius ?? 0,
    fontUrl,   // NEW
  });

  // ... rest unchanged ...
}
```

### 7.8 `packages/charts/src/renderers/shared/AxesRenderer.ts` — MODIFY

Add `fontUrl?: string` to `AxisRenderState` and thread it through `ensureText` calls.

```typescript
type AxisRenderState = {
  xTicks: TickEntry[];
  yTicks: TickEntry[];
  bounds: { width: number; height: number };
  theme: ChartTheme;
  opacity: number;
  xAxis: ChartAxisState | null;
  yAxis: ChartAxisState | null;
  fontUrl?: string;  // NEW
};
```

In `updateTicks()`, all `ensureText()` calls gain `fontUrl: state.fontUrl` in their layout options:

```typescript
ensureText(
  label,
  String(tick.value),
  labelColor,
  fontSize,
  opacity,
  undefined,
  false,
  { anchorX: 'center', anchorY: 'top', fontUrl: state.fontUrl },  // NEW
);
```

Each renderer implementation (BarRenderer, LineRenderer, etc.) constructs `AxisRenderState` by spreading their `ChartRenderContext`, so they need to pass `fontUrl: ctx.fontUrl` when constructing the state for `axesRenderer.update()`. This pattern is consistent — developers implementing stream E must trace every `axesRenderer.update()` call site in each renderer file.

**Affected renderer files:** All renderers that call `axesRenderer.update()` and `legendRenderer.update()`:
- `packages/charts/src/renderers/bar/BarRenderer.ts`
- `packages/charts/src/renderers/line/LineRenderer.ts`
- `packages/charts/src/renderers/area/AreaRenderer.ts`
- `packages/charts/src/renderers/scatter/ScatterRenderer.ts`
- `packages/charts/src/renderers/heatmap/HeatmapRenderer.ts`
(PieRenderer likely does not use AxesRenderer/LegendRenderer — verify; update if it does.)

### 7.9 `packages/charts/src/renderers/shared/LegendRenderer.ts` — MODIFY

Add `fontUrl?: string` parameter to `update()` and thread through `ensureText`:

```typescript
update(
  series: readonly ChartSeriesState[],
  theme: ChartTheme,
  opacity: number,
  fontUrl?: string,  // NEW
): void {
  // ... existing logic ...
  ensureText(
    entry.label,
    s.label ?? s.field,
    theme.axis.labelColor,
    theme.axis.fontSize,
    opacity,
    undefined,
    false,
    { anchorX: 'left', anchorY: 'middle', fontUrl },  // NEW
  );
}
```

Each renderer that calls `legendRenderer.update()` must pass `fontUrl: ctx.fontUrl` as the fourth argument.

### 7.10 `packages/model/src/labels/types.ts` — MODIFY

Add `fontFamily?: string` to `LabelStyle`:

```typescript
export type LabelStyle = {
  color?: LabelColor;
  lineColor?: LabelColor;
  fontSize?: number | string;
  lineOpacity?: number;
  labelOpacity?: number;
  lineThickness?: number;
  /**
   * CSS font-family override for this label.
   * When absent, the label inherits font-family from its DOM ancestor.
   * If EngineOverlayHost injects --brewsite-font-family via SceneTheme,
   * labels will inherit it automatically via CSS cascade (fontFamily is
   * a CSS inherited property) without needing this field.
   *
   * Use this field for per-label font overrides only.
   */
  fontFamily?: string;
};
```

### 7.11 `packages/model/src/labels/LabelItem.tsx` — MODIFY

Add `fontFamily` to the label style object. CSS cascade from `EngineOverlayHost` already handles the common case; this field provides per-label override.

```typescript
const style = useMemo<CSSProperties>(() => ({
  position: 'absolute',
  top: 0,
  left: 0,
  pointerEvents: 'none',
  color: `var(--label-color, ${resolvedLabelColor})`,
  fontSize: label.style?.fontSize ?? 12,
  opacity: label.style?.labelOpacity ?? 1,
  // fontFamily: per-label override. When absent, CSS cascade from EngineOverlayHost applies.
  ...(label.style?.fontFamily ? { fontFamily: label.style.fontFamily } : {}),
}), [label.style, resolvedLabelColor]);
```

### 7.12 Test files for Charts and Model

**`packages/charts/src/elements/chart/__tests__/compile.test.ts` — MODIFY**

Add tests:
- `compileChart({ sceneTheme: mockSceneTheme }, ...)` → `state.sceneTheme` equals `mockSceneTheme`
- `compileChart({}, ...)` → `state.sceneTheme` is `undefined`
- `functionalChartTransitionSpec.interpolateFn(from, to)(ctx at t=0).sceneTheme` equals `from.sceneTheme`
- `functionalChartTransitionSpec.interpolateFn(from, to)(ctx at t=1).sceneTheme` equals `to.sceneTheme`

**`packages/charts/src/elements/chart/__tests__/ChartWidget.test.ts` — MODIFY**

(This test uses a fake scene and a fake store. Adding sceneTheme requires passing it in ChartState and verifying it reaches ChartRenderer. Given ChartRenderer is render.ts which is excluded from coverage, focus test on the compile path and that `ChartState` carries `sceneTheme`.)

Add test: `ChartWidget.defaultState.sceneTheme` is `undefined`.

**`packages/model/src/labels/__tests__/LabelItem.test.tsx` — MODIFY**

Add tests:
- Renders without `fontFamily` style when `label.style.fontFamily` is undefined
- Renders with `fontFamily` style when `label.style.fontFamily` is `'Inter, sans-serif'`

---

## 8. Parallelization Schedule

```
┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 1 (Serial — blocks all other phases):                             │
│  Developer 1: Stream A — packages/core/src/theme/                      │
│    Creates: types.ts, ThemeContext.ts, presets.ts, index.ts + tests     │
│    Updates: packages/core/src/index.ts                                  │
│  Estimated output: 5 new files, 1 modified file                        │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ Stream A complete → notify D2, D3, D4, D5
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 2 (Parallel — all 4 streams run simultaneously):                  │
│                                                                         │
│  Developer 1: Stream B — Background element                             │
│    Modifies: background/types.ts, dsl.tsx, compile.ts, render.ts        │
│    Modifies: background/BackgroundWidget.ts + 2 test files              │
│                                                                         │
│  Developer 2: Stream C — Player integration                             │
│    Modifies: player/EngineProvider.tsx, EngineOverlayHost.tsx + test    │
│                                                                         │
│  Developer 3: Stream D — Diagram integration                            │
│    Modifies: diagram/types.ts, themeResolver.ts, themes/mergeTheme.ts  │
│    Modifies: rendering/NodeRenderer.ts, rendering/GroupRenderer.ts     │
│    Creates: themeResolver.test.ts, extends mergeTheme.test.ts           │
│                                                                         │
│  Developer 4+5: Stream E — Charts + Model + Core text                   │
│    Modifies: core/text/types.ts, core/text/TextRenderer.ts              │
│    Modifies: charts themes/types.ts, chart/types.ts, chart/compile.ts   │
│    Modifies: chart/render.ts, IChartRenderer.ts                         │
│    Modifies: AxesRenderer.ts, LegendRenderer.ts                         │
│    Modifies: Bar/Line/Area/Scatter/HeatmapRenderer.ts (call site only)  │
│    Modifies: model labels/types.ts, labels/LabelItem.tsx                │
│    Extends: chart compile.test.ts, ChartWidget.test.ts, LabelItem.test  │
└─────────────────────────────────────────────────────────────────────────┘
```

**File ownership per stream — zero conflicts:**

| File | Stream |
|---|---|
| `core/src/theme/**` | A |
| `core/src/index.ts` | A |
| `core/src/elements/background/**` | B |
| `core/src/text/**` | E |
| `core/src/player/EngineProvider.tsx` | C |
| `core/src/player/EngineOverlayHost.tsx` | C |
| `core/src/player/__tests__/EngineOverlayHost.test.tsx` | C |
| `diagram/src/elements/diagram/types.ts` | D |
| `diagram/src/elements/diagram/compiler/themeResolver.ts` | D |
| `diagram/src/elements/diagram/themes/mergeTheme.ts` | D |
| `diagram/src/elements/diagram/themes/index.ts` | D |
| `diagram/src/elements/diagram/rendering/NodeRenderer.ts` | D |
| `diagram/src/elements/diagram/rendering/GroupRenderer.ts` | D |
| `diagram/src/elements/diagram/themes/__tests__/mergeTheme.test.ts` | D |
| `diagram/src/elements/diagram/compiler/__tests__/themeResolver.test.ts` | D (new) |
| `charts/src/themes/types.ts` | E |
| `charts/src/elements/chart/types.ts` | E |
| `charts/src/elements/chart/compile.ts` | E |
| `charts/src/elements/chart/render.ts` | E |
| `charts/src/renderers/shared/IChartRenderer.ts` | E |
| `charts/src/renderers/shared/AxesRenderer.ts` | E |
| `charts/src/renderers/shared/LegendRenderer.ts` | E |
| `charts/src/renderers/bar/BarRenderer.ts` | E |
| `charts/src/renderers/line/LineRenderer.ts` | E |
| `charts/src/renderers/area/AreaRenderer.ts` | E |
| `charts/src/renderers/scatter/ScatterRenderer.ts` | E |
| `charts/src/renderers/heatmap/HeatmapRenderer.ts` | E |
| `model/src/labels/types.ts` | E |
| `model/src/labels/LabelItem.tsx` | E |

**Sequencing dependency note:** Stream E modifies `core/src/text/TextRenderer.ts` and `types.ts`. Stream D's NodeRenderer and GroupRenderer changes (passing `fontUrl` to `ensureText`) depend on Stream E's `ensureText` having the `fontUrl` parameter. Since NodeRenderer and GroupRenderer are in `render.ts` files (excluded from coverage), and their call sites are within Stream D's scope, Stream D should treat the `fontUrl` parameter as forward-declared (add the argument, accept that TypeScript may not enforce it until Stream E lands). In CI, all streams must be merged before the typecheck passes. Stream A must be merged first; B/C/D/E can be merged in any order after A.

---

## 9. Test Strategy Summary

All tests follow the interface-based stateful pattern: real inputs → real output assertions. No mocking of module internals. `render.ts` files are excluded from coverage.

| Stream | Test file | Key assertions |
|---|---|---|
| A | `core/src/theme/__tests__/presets.test.ts` | colorMode polarity, fontSize ordering, htmlFamily non-empty, background fill kind |
| B | `background/__tests__/BackgroundCompile.test.ts` | gradient field carried through transition specs; cssFilter carried; overlay element cleared when fields absent |
| B | `background/__tests__/BackgroundWidget.test.ts` | CUSTOM_NODE_HANDLER resolves theme → state; explicit props override theme; applyBackground with overlay element |
| C | `player/__tests__/EngineOverlayHost.test.tsx` | No CSS vars injected when ThemeContext=null; CSS vars present when theme provided; colorMode drives text-primary |
| D | `diagram/compiler/__tests__/themeResolver.test.ts` | fontUrl fallback chain; effectiveLabelSizeFactor composition; no sceneTheme → identity |
| D | `diagram/themes/__tests__/mergeTheme.test.ts` | withColorMode dark/light polarity; does not mutate base |
| E | `charts/elements/chart/__tests__/compile.test.ts` | sceneTheme passed through compileChart; interpolation discrete switch at t=0.5 |
| E | `model/labels/__tests__/LabelItem.test.tsx` | fontFamily in style when set; no fontFamily style when absent |

---

## 10. Error Handling and Edge Cases

1. **`BackgroundWidget.setDomElement()` called when element has no parentElement:** Skip overlay element creation and log `console.warn('[BackgroundWidget] Cannot create overlay element — background DOM element has no parent.')`.

2. **`backdropFilter` browser support:** Do not add runtime support detection. Document in JSDoc on `SceneThemeBackgroundEffects.backdropFilter`: "Not universally supported. Use `@supports (backdrop-filter: blur(1px))` in CSS or check `CSS.supports('backdrop-filter', 'blur(1px)')` before relying on this feature." No runtime guard in the implementation.

3. **`ThemeContext` outside `EngineProvider`:** `useTheme()` returns `null` (the context default). `EngineOverlayHost` handles `null` gracefully by injecting no CSS vars. No error thrown.

4. **`sceneTheme.font.webglFontUrl` pointing to non-MSDF font:** Troika will render incorrectly but not crash. Log `console.warn('[BrewSite] sceneTheme.font.webglFontUrl must point to an MSDF-encoded .ttf or .woff font. Standard web fonts will not render correctly with troika-three-text.')` — emit this warning in `themeResolver.ts` and `ChartRenderer` when a `webglFontUrl` is detected (one-time warning, not per-frame).

5. **`gradient` and `color` both set on `BackgroundProps`:** `gradient` takes precedence (per fill resolution order documented on `BackgroundProps`). No error.

6. **`functionalChartTransitionSpec` carrying `sceneTheme`:** The `interpolateFn` switches `sceneTheme` at the midpoint (t < 0.5 → from, t >= 0.5 → to). This means WebGL font transitions discretely mid-cross-fade. This is acceptable: font changes mid-animation would be visually jarring regardless of timing.

---

## 11. Public API Surface Changes

### `@brewsite/core` — new exports
- `SceneTheme`, `SceneColorMode`, `SceneThemeFontTokens`, `SceneThemeFontSizeScale`, `SceneThemeBackgroundFill`, `SceneThemeBackgroundEffects`, `SceneThemeBackground` — all types
- `ThemeContext` — React context (export type + value)
- `useTheme` — React hook
- `darkSceneTheme`, `lightSceneTheme` — preset constants
- `SceneBackground` — extended with `gradient?`, `cssFilter?`, `overlayGradient?`, `backdropFilter?`
- `BackgroundProps` — extended with `gradient?`, `cssFilter?`, `overlayGradient?`, `backdropFilter?`, `theme?`
- `EngineProviderProps` — extended with `sceneTheme?`
- `EngineOverlayHostProps` — unchanged
- `TextWithLayout` — extended with `font?`
- `ensureText` — `TextLayoutOptions` extended with `fontUrl?`
- `BackgroundDomRefs` — extended with `overlayElement: HTMLElement | null`

### `@brewsite/diagram` — new exports
- `withColorMode` from `themes/mergeTheme.ts`
- `DiagramTheme.sceneTheme` — new optional field (non-breaking; additive)
- `DiagramThemeRenderConfig` — extended with `effectiveLabelSizeFactor?: number`, `effectiveSublabelSizeFactor?: number` (optional; non-breaking for existing test fixtures that construct this type)

### `@brewsite/charts` — changes
- `ChartTheme.sceneTheme` — new optional field (non-breaking)
- `ChartDSL.sceneTheme` — new optional DSL prop (non-breaking)
- `ChartState.sceneTheme` — new optional compiled state field (non-breaking)
- `ChartRenderContext.fontUrl` — new optional field (non-breaking for existing `IChartRenderer` implementors)
- `LegendRenderer.update()` — `fontUrl` 4th parameter added as optional (non-breaking)

### `@brewsite/model` — changes
- `LabelStyle.fontFamily` — new optional field (non-breaking)

**All changes are strictly additive. Existing scenes with no `SceneTheme` behave identically to today.**

---

## 12. Out of Scope for v1

- Animated theme transitions (cross-fading between light/dark)
- Automatic dark/light switching from `prefers-color-scheme`
- Promoting `DiagramThemeNodeConfig.fontUrl` to `DiagramTheme` root level
- `DiagramTheme.background` field driving scene background
- `SceneTheme` presets for `neonCyber` / `enterprise` specific pairings
- Chart-level background gradient (chart background is WebGL plane-based)
- A `useSceneTheme()` hook (CSS variables are sufficient for v1)
- Shared color palette in `SceneTheme` (deferred to v2)
- Font file bundling in core (consumers host their own fonts)
- Background effects for Three.js environments or DiagramCanvas WebGL scene

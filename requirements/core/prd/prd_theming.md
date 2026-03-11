---
title: "BrewSite Core — Cross-Package Theming System"
doc_type: prd
status: active
owner: brewsite-product-manager
last_updated: 2026-03-11
change_history:
  - date: 2026-03-04
    author: "Toolkit Product"
    summary: "Initial PRD created. Documents the complete SceneTheme cross-package theming system as implemented: types module, ThemeContext, CSS variable injection in EngineOverlayHost, sceneTheme prop on EngineProvider, darkSceneTheme/lightSceneTheme presets, and per-package integration surface."
  - date: 2026-03-11
    author: "Toolkit Product"
    summary: "Theme redesign: removed SceneTheme.accentColor (field was never consumed by any package; migration: inject --brewsite-accent-color directly in your stylesheet if needed). Expanded preset library from 2 to 6 named presets: darkGlassSceneTheme, midnightSceneTheme, neonCyberSceneTheme, enterpriseSceneTheme, lightCanvasSceneTheme, lightMinimalSceneTheme. Removed --brewsite-accent-color from CSS variable injection. Version bump: minor."
---

# BrewSite Core — Cross-Package Theming System

## 1. Overview

The cross-package theming system introduces `SceneTheme` — a unified token object in `@brewsite/core` that serves as the single source of truth for visual styling across `@brewsite/core`, `@brewsite/diagram`, `@brewsite/charts`, and `@brewsite/model`. Scene authors pass a `SceneTheme` to `EngineProvider` once; the engine injects CSS custom properties into `EngineOverlayHost` and makes the token available for opt-in consumption by diagram and chart elements. The result: changing a scene family from dark presentation to light documentation requires changing a single prop.

Affects: `@brewsite/core` (types, ThemeContext, EngineProvider, EngineOverlayHost, Background element). Integration surfaces in `@brewsite/diagram`, `@brewsite/charts`, and `@brewsite/model` are documented in their respective package PRDs.

---

## 2. Problem Statement

Before this system, scene authors who used all four packages managed four completely separate, unconnected styling systems. A dark-to-light style change required touching DiagramTheme, ChartTheme, every overlay `<div>` inline style, and every `<Background>` element. There was no shared font token, no shared color-mode concept, and no authoring location for "this scene family uses this visual style."

Additionally, the Background element supported only solid color and image fills — no gradient fills, no CSS filter effects (blur, brightness), and no overlay gradient layer. Background effects required consumer workarounds outside the toolkit.

---

## 3. Goals & Success Metrics

**Primary goals:**
- A consumer can establish the visual character of an entire scene family by passing one `SceneTheme` to `EngineProvider`.
- CSS variables for font family, font size scale, color mode, and text colors are available to all overlay content without per-element style props.
- Diagram and chart elements can inherit font URL and color mode defaults from `SceneTheme` without requiring full theme replacement.
- The system is fully additive — existing scenes with no `SceneTheme` behave identically to before.

**Success metrics:**
- Zero TypeScript errors in strict mode for any code that constructs a `SceneTheme` or uses any of the six named `SceneTheme` presets.
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
- A `useSceneTheme()` hook (CSS variables are sufficient for overlay authors in v1)
- Shared color palette across packages (deferred to v2)
- `DiagramTheme` gaining a `background` field that drives the scene DOM background (deferred to v2)
- Promoting `DiagramThemeNodeConfig.fontUrl` to `DiagramTheme` root level (deferred to v2)

---

## 5. Consumer Stories

- As a toolkit consumer, I want to pass a single `SceneTheme` to `EngineProvider` so that all HTML overlay content in my scenes adopts a consistent font family and color system without inline style management.
- As a toolkit consumer, I want `--brewsite-font-family` and `--brewsite-font-size-*` CSS variables available inside my overlay JSX so that I can write CSS-variable-driven overlay styles that update with a prop change.
- As a toolkit consumer, I want to specify a WebGL font URL once in `SceneTheme` and have it flow into my `DiagramTheme` and `ChartTheme` automatically so that I don't repeat the font URL in multiple theme objects.
- As a toolkit consumer, I want `darkSceneTheme` and `lightSceneTheme` presets ready to use so that I can adopt the system without authoring a full `SceneTheme` object.
- As a toolkit consumer, I want per-scene `<Background>` elements to support gradient fills, CSS filters, and overlay gradients so that I can create rich background effects without leaving the DSL.

---

## 6. Functional Requirements

1. The `SceneTheme` type and all its sub-types (`SceneColorMode`, `SceneThemeFontTokens`, `SceneThemeFontSizeScale`, `SceneThemeBackgroundFill`, `SceneThemeBackgroundEffects`, `SceneThemeBackground`) shall be exported from `@brewsite/core/src/index.ts`. `SceneTheme` does not include an `accentColor` field.
2. `EngineProvider` shall accept an optional `sceneTheme?: SceneTheme` prop and provide it via `ThemeContext`.
3. `EngineOverlayHost` shall read from `ThemeContext` and, when a theme is present, inject CSS custom properties on its root `<div>` element.
4. CSS variable injection shall cover: `--brewsite-font-family`, `--brewsite-font-size-heading`, `--brewsite-font-size-body`, `--brewsite-font-size-label`, `--brewsite-font-size-caption`, `--brewsite-font-size-annotation`, `--brewsite-color-mode`, `--brewsite-text-primary`, `--brewsite-text-secondary`. `--brewsite-accent-color` is not injected by the engine; consumers who need this variable must set it directly in their own stylesheet.
5. CSS font size variables shall use `calc(1rem * <scale>)` values — they do not depend on a `--brewsite-base-font-size` variable.
6. `ThemeContext` shall hold a single static value for the player lifetime; it shall not change per scene.
7. `fontFamily: 'var(--brewsite-font-family)'` shall be set as an inline style on the `EngineOverlayHost` container so that CSS inheritance propagates to all overlay children and label DOM elements without requiring each child to opt in.
8. Six named `SceneTheme` preset constants shall be exported from `@brewsite/core`: `darkGlassSceneTheme`, `midnightSceneTheme`, `neonCyberSceneTheme`, `enterpriseSceneTheme`, `lightCanvasSceneTheme`, `lightMinimalSceneTheme`. The generic `darkSceneTheme` and `lightSceneTheme` constants remain exported for backward compatibility.
9. All `SceneTheme` fields shall be `readonly`. The type shall have no runtime dependencies — it is pure TypeScript data.
10. `ThemeContext` shall export a `useTheme(): SceneTheme | null` hook consumed internally by `EngineOverlayHost`.
11. When `sceneTheme` is absent from `EngineProvider`, `EngineOverlayHost` shall inject no CSS variables and apply no theme styles — overlay behavior is unchanged from pre-theming behavior.

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

export type SceneTheme = {
  readonly colorMode: SceneColorMode;
  readonly font: SceneThemeFontTokens;
  readonly fontSize: SceneThemeFontSizeScale;
  readonly background?: SceneThemeBackground;
};
```

### 7.2 ThemeContext (`packages/core/src/theme/ThemeContext.ts`)

```typescript
export const ThemeContext = React.createContext<SceneTheme | null>(null);
export function useTheme(): SceneTheme | null;
```

`ThemeContext` is populated by `EngineProvider`. It is not part of the public consumer API — consumers never call `useTheme()` directly. It is consumed internally by `EngineOverlayHost`.

### 7.3 EngineProvider `sceneTheme` prop

```typescript
export type EngineProviderProps = {
  // ... existing props ...
  /**
   * Optional scene theme token set for cross-package visual styling.
   *
   * When provided: CSS variables (font family, font sizes, color mode, text colors) are
   * injected by EngineOverlayHost via ThemeContext. Affects all HTML overlay content.
   *
   * CSS variables are static for the player lifetime — they do not change per scene.
   * For per-scene background changes, use <Background theme={...} />.
   *
   * WebGL font URL (sceneTheme.font.webglFontUrl) is NOT automatically plumbed to
   * WebGL renderers. Pass sceneTheme explicitly to DiagramTheme.sceneTheme or
   * ChartTheme.sceneTheme (or ChartDSL.sceneTheme).
   */
  sceneTheme?: SceneTheme;
};
```

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

Additionally, `fontFamily: 'var(--brewsite-font-family)'` is set as an inline style on the overlay container so CSS inheritance propagates automatically to all children.

**Note on `--brewsite-accent-color`:** This variable is not injected by the engine. Consumers who require a scene-scoped accent color variable must declare `--brewsite-accent-color` directly in their own stylesheet or on a wrapper element. This allows fallback expressions like `var(--brewsite-accent-color, #6b48ff)` to work without engine involvement.

### 7.5 Preset Themes (`packages/core/src/theme/presets.ts`)

Six named presets correspond to the six canonical theme names across `@brewsite/diagram` and `@brewsite/charts`. Each preset captures the `colorMode`, default system font, and standard font size scale appropriate for that theme family:

```typescript
// Generic dark/light presets (backward-compatible):
export const darkSceneTheme: SceneTheme;
export const lightSceneTheme: SceneTheme;

// Six canonical named presets — one per theme family:
export const darkGlassSceneTheme: SceneTheme;    // dark, deep navy
export const midnightSceneTheme: SceneTheme;     // dark, warm amber
export const neonCyberSceneTheme: SceneTheme;    // dark, electric violet/cyan
export const enterpriseSceneTheme: SceneTheme;   // dark, professional slate-blue
export const lightCanvasSceneTheme: SceneTheme;  // light, premium product docs
export const lightMinimalSceneTheme: SceneTheme; // light, flat documentation
```

Named presets carry the correct `colorMode` for their family (all dark themes → `'dark'`; `lightCanvas` and `lightMinimal` → `'light'`). All presets use `system-ui, -apple-system, sans-serif` as the default `htmlFamily` and the standard `fontSize` scale — consumers override these as needed:

```typescript
import { darkGlassSceneTheme } from '@brewsite/core';

const brandTheme: SceneTheme = {
  ...darkGlassSceneTheme,
  font: {
    htmlFamily: 'Inter, system-ui, sans-serif',
    webglFontUrl: 'https://cdn.example.com/fonts/inter-msdf.ttf',
  },
};
```

### 7.6 Usage Pattern

```tsx
import { EngineProvider, EngineOverlayHost, darkSceneTheme } from '@brewsite/core';

// Global theme on the player:
<EngineProvider sceneTheme={darkSceneTheme} manifestUrl="/manifest.json" plugins={[...]}>
  <SceneCanvas />
  <EngineOverlayHost />  {/* injects CSS variables */}
  <Scene key="hero">
    <Background theme={darkSceneTheme} />
    {/* Overlay content can use CSS variables: */}
    <div style={{ fontFamily: 'var(--brewsite-font-family)', color: 'var(--brewsite-text-primary)' }}>
      Hero headline
    </div>
  </Scene>
</EngineProvider>
```

---

## 8. Technical Considerations

### ThemeContext is static per player lifetime

`ThemeContext` holds the value provided to `EngineProvider.sceneTheme` for the entire player lifetime. It does not update between scenes. This is intentional: updating CSS variables per scene would trigger a React re-render cascade from every consumer of the context on every scene transition — a performance anti-pattern on a hot render path.

Per-scene background visual changes (gradient fill, CSS filter, overlay gradient) are handled by `BackgroundWidget` DOM manipulation — the widget applies CSS values to the background DOM element on each frame tick when the compiled `SceneBackground` state changes. This is the correct pattern: CSS variables control layout-level constants (font, color mode); DOM widget state controls scene-level animation values.

### WebGL font URL is not auto-plumbed

`sceneTheme.font.webglFontUrl` on `EngineProvider` does NOT automatically configure diagram or chart WebGL renderers. The font URL must be provided to `DiagramTheme.sceneTheme` or `ChartTheme.sceneTheme` (or `ChartDSL.sceneTheme`) for it to affect WebGL-rendered text. This is by design: `EngineProvider` knows nothing about diagram or chart elements; plumbing the font URL through the engine would couple core to its dependents, violating the package dependency rule.

### Module location

`packages/core/src/theme/` is a new directory containing:
- `types.ts` — all `SceneTheme` type contracts (no runtime, no React, no Three.js)
- `ThemeContext.ts` — React context + `useTheme` hook
- `presets.ts` — `darkSceneTheme`, `lightSceneTheme` constants
- `index.ts` — re-exports for use within the core package

All public types and presets are re-exported from `packages/core/src/index.ts`.

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

- `packages/core/src/theme/types.ts` — new module
- `packages/core/src/theme/ThemeContext.ts` — new module
- `packages/core/src/theme/presets.ts` — new module
- `packages/core/src/player/EngineProvider.tsx` — modified: new `sceneTheme` prop, `ThemeContext.Provider` wrapping
- `packages/core/src/player/EngineOverlayHost.tsx` — modified: reads `ThemeContext`, injects CSS variables
- No new external npm dependencies

---

## 12. Risks & Mitigations

**API regret on CSS variable names:** The variable names (`--brewsite-font-family`, `--brewsite-text-primary`, etc.) are now injected into consumer DOM. Renaming them is a breaking change for consumer CSS. Mitigation: names are prefixed with `--brewsite-` to signal toolkit ownership; they follow a stable, predictable naming convention.

**Missing `EngineOverlayHost` in consumer layout:** Consumers who compose `EngineProvider` + `SceneCanvas` manually without `EngineOverlayHost` will not receive CSS variable injection. This is expected — `EngineOverlayHost` is the injection point. If a consumer uses a custom overlay host, they can read `ThemeContext` via `useTheme()` and inject variables themselves.

---

## 13. Launch Criteria

- `SceneTheme`, `SceneColorMode`, `SceneThemeFontTokens`, `SceneThemeFontSizeScale`, `SceneThemeBackgroundFill`, `SceneThemeBackgroundEffects`, `SceneThemeBackground`, `darkSceneTheme`, `lightSceneTheme`, `darkGlassSceneTheme`, `midnightSceneTheme`, `neonCyberSceneTheme`, `enterpriseSceneTheme`, `lightCanvasSceneTheme`, `lightMinimalSceneTheme` exported from `packages/core/src/index.ts`.
- `EngineProvider` `sceneTheme` prop typed and documented in JSDoc.
- `EngineOverlayHost` tests cover: CSS variables present when theme provided; no CSS variables when theme absent.
- TypeScript strict-mode typecheck passes on `packages/core/src/theme/`.
- At least one example in `apps/examples/` demonstrates `sceneTheme` on `EngineProvider` with CSS variable usage in overlay content.
- `pnpm test` passes for `@brewsite/core` with coverage on `src/theme/`.

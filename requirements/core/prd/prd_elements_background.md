---
title: "BrewSite Core — Background Element"
doc_type: prd
status: active
owner: brewsite-product-manager
last_updated: 2026-03-13
change_history:
  - date: 2026-03-04
    author: "Toolkit Product"
    summary: "Initial PRD created. Documents the extended Background element as implemented: gradient fill support, CSS filter, overlay gradient layer (second DOM element), backdropFilter, and SceneTheme integration via CUSTOM_NODE_HANDLER."
  - date: 2026-03-13
    author: "Toolkit Product"
    summary: "PRD audit: added BackgroundLayer component documentation — the React component that renders the background DOM element in the composable player layout. BackgroundLayer is mounted by the consumer as a child of ScrollStage (or equivalent layout container) alongside SceneCanvas and EngineOverlayHost. Updated last_updated."
---

# BrewSite Core — Background Element

## 1. Overview

The `<Background>` DSL element controls the visual background layer of a scene. It renders as a DOM element positioned behind the Three.js canvas and above the page body, enabling CSS-powered background fills and effects that would not be possible on a Three.js plane. The element supports solid colors, image URLs, CSS gradient strings, CSS filter effects (blur, brightness, contrast), overlay gradient layers, and `backdrop-filter` — all controllable per-scene via DSL props, or derived from a `SceneTheme` token object. The element is part of `@brewsite/core`.

---

## 2. Problem Statement

Before this implementation, the Background element supported only solid color fills and image URLs with basic CSS positioning properties. Scene authors who needed dark vignette overlays, blurred backgrounds, or gradient fills had to implement workarounds outside the DSL — either by injecting their own positioned DOM elements or by using CSS on parent containers. This fragmented the scene authoring model and left a significant visual toolset unavailable to consumers.

---

## 3. Goals & Success Metrics

**Primary goals:**
- Scene authors can declare any CSS-representable background fill (color, image, gradient) in DSL.
- Scene authors can apply CSS filter effects and overlay gradient layers to background elements without leaving the DSL.
- `<Background theme={sceneTheme} />` derives all fill and effect values from the theme's `background` token — no per-prop redundancy.

**Success metrics:**
- Gradient fills, CSS filters, and overlay gradients render correctly in all four major browsers.
- Switching a scene background from solid color to a gradient requires only a single DSL prop change.
- All new props are optional; existing scenes using only `color` or `imageUrl` behave identically to before.

---

## 4. Non-Goals

- Three.js scene background color (the WebGL scene clear color — a separate concern from the DOM background element)
- Background effects for Three.js WebGL canvas output (CSS `filter` cannot be applied to WebGL canvas content without GPU compositing)
- Background animation or easing (transitions are handled per-scene via the existing `opacity` field and scene transition system)
- Background video (a consumer can use `imageUrl` workarounds or a custom widget for video backgrounds)

---

## 5. Consumer Stories

- As a toolkit consumer, I want to declare `gradient="linear-gradient(135deg, #0a0a14 0%, #1a0a3e 100%)"` on `<Background>` so that my dark tech scene uses a branded gradient without custom DOM elements.
- As a toolkit consumer, I want to use `cssFilter="blur(8px) brightness(0.7)"` on `<Background>` so that I can blur an image background for a frosted-glass effect.
- As a toolkit consumer, I want `overlayGradient="linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 50%)"` so that I can darken the top of a background image to improve overlay text legibility.
- As a toolkit consumer, I want `<Background theme={darkSceneTheme} />` to automatically configure fill and effects from the theme so that background authoring stays in sync with the scene theme without prop duplication.

---

## 6. Functional Requirements

1. The `<Background>` DSL component shall accept `gradient?: string` — a CSS gradient string (e.g. `'linear-gradient(135deg, #0a0a14, #1a0a3e)'`) that takes precedence over `color` and `imageUrl` in the fill hierarchy.
2. The `<Background>` DSL component shall accept `cssFilter?: string` — a CSS filter string applied to the background DOM element.
3. The `<Background>` DSL component shall accept `overlayGradient?: string` — a CSS gradient string rendered on a second DOM element above the background, below scene content.
4. The `<Background>` DSL component shall accept `backdropFilter?: string` — a CSS `backdrop-filter` value applied to the overlay DOM element.
5. The `<Background>` DSL component shall accept `theme?: SceneTheme` — when set, `BackgroundWidget`'s `CUSTOM_NODE_HANDLER` resolves theme background fill and effects into the concrete `SceneBackground` fields at compile time.
6. The fill precedence hierarchy shall be: `gradient` prop → `imageUrl` prop → `color` prop → `theme.background.fill`.
7. The effects precedence hierarchy shall be: explicit prop (`cssFilter`, `overlayGradient`, `backdropFilter`) → `theme.background.effects` equivalent.
8. `BackgroundWidget` shall manage a second overlay DOM element (`overlayElement`) for `overlayGradient` and `backdropFilter`. The `overlayElement` shall be created on first use and removed when both `overlayGradient` and `backdropFilter` are unset.
9. When `fill.kind === 'gradient'` is applied, the render layer shall set `element.style.background` (the CSS shorthand) and explicitly clear `element.style.backgroundColor` and `element.style.backgroundImage` to prevent stale values from prior states.
10. `BackgroundWidget` shall implement `IHasCustomDslHandler` (via `CUSTOM_NODE_HANDLER`) so that theme resolution happens at compile time, not render time. The `SceneBackground` compiled state shall never contain a `SceneTheme` reference — only the resolved concrete field values.

---

## 7. API Design

### 7.1 DSL Props (`packages/core/src/elements/background/dsl.tsx`)

```typescript
export type BackgroundProps = {
  imageUrl?: string;
  opacity?: number;
  color?: string;
  /** CSS gradient string. Takes precedence over color/imageUrl. */
  gradient?: string;
  position?: Vec3;
  cssPosition?: React.CSSProperties['backgroundPosition'];
  cssSize?: React.CSSProperties['backgroundSize'];
  cssRepeat?: React.CSSProperties['backgroundRepeat'];
  /** CSS filter applied to the background DOM element. e.g. 'blur(4px) brightness(0.8)' */
  cssFilter?: string;
  /**
   * CSS gradient string for an overlay element above background, below scene content.
   * e.g. 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 50%)'
   */
  overlayGradient?: string;
  /** CSS backdrop-filter on the overlay element. e.g. 'blur(12px)' */
  backdropFilter?: string;
  /**
   * Optional SceneTheme — deriving background fill and effects from a theme token.
   * Explicit per-element props override theme-derived values.
   * Resolved at compile time by BackgroundWidget's CUSTOM_NODE_HANDLER.
   * NOT stored in compiled SceneBackground.
   */
  theme?: SceneTheme;
};
```

### 7.2 Compiled State (`packages/core/src/elements/background/types.ts`)

```typescript
export type SceneBackground = {
  imageUrl?: string;
  opacity: number;
  color?: string;
  /** CSS gradient string — takes precedence over color/imageUrl when set */
  gradient?: string;
  position?: Vec3;
  cssPosition?: string;
  cssSize?: string;
  cssRepeat?: string;
  cssFilter?: string;
  overlayGradient?: string;
  backdropFilter?: string;
};
```

The `SceneTheme` reference is not stored in `SceneBackground`. Theme resolution happens at compile time in `BackgroundWidget.CUSTOM_NODE_HANDLER` — the resulting `SceneBackground` contains only concrete field values.

### 7.3 Fill Precedence (resolved at compile time)

```
gradient prop           (explicit CSS gradient string)
  → imageUrl prop       (image URL)
  → color prop          (solid CSS color)
  → theme.background.fill  (SceneTheme-derived fill)
```

When `theme.background.fill.kind === 'gradient'`, the `gradient` field in `SceneBackground` is populated. When `kind === 'color'`, `color` is populated. When `kind === 'image'`, `imageUrl` is populated.

### 7.4 Effects Precedence (resolved at compile time)

```
cssFilter prop         → theme.background.effects?.cssFilter
overlayGradient prop   → theme.background.effects?.overlayGradient
backdropFilter prop    → theme.background.effects?.backdropFilter
opacity prop           → theme.background.effects?.opacity
```

### 7.5 Render Behavior (`packages/core/src/elements/background/render.ts`)

`applyBackground()` in `render.ts` applies the compiled `SceneBackground` to the DOM element:

- `gradient` set → `element.style.background = gradient`, clears `backgroundColor` and `backgroundImage`
- `imageUrl` set (no gradient) → `element.style.backgroundImage = ...`, clears `background`, `backgroundColor`
- `color` set (no gradient, no image) → `element.style.backgroundColor = color`, clears `background`, `backgroundImage`
- `cssFilter` set → `element.style.filter = cssFilter`; clear on unset
- `overlayGradient` set → `overlayElement.style.background = overlayGradient` (creates `overlayElement` if absent)
- `backdropFilter` set → `overlayElement.style.backdropFilter = backdropFilter` (creates `overlayElement` if absent)
- Both `overlayGradient` and `backdropFilter` unset → remove `overlayElement` from DOM if it exists

### 7.6 Usage Patterns

**Direct gradient fill:**
```tsx
<Background gradient="linear-gradient(135deg, #0a0a14 0%, #1a0a3e 100%)" />
```

**Image background with blur and dark overlay:**
```tsx
<Background
  imageUrl="/images/hero-bg.webp"
  cssFilter="brightness(0.7)"
  overlayGradient="linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 60%)"
/>
```

**Theme-derived background:**
```tsx
const brandTheme: SceneTheme = {
  ...darkSceneTheme,
  background: {
    fill: { kind: 'gradient', value: 'linear-gradient(135deg, #0a0a14, #1a0a3e)' },
    effects: { cssFilter: 'brightness(0.9)' },
  },
};

<Background theme={brandTheme} />
```

**Per-scene per-element override:**
```tsx
<Scene key="hero">
  <Background theme={darkSceneTheme} cssFilter="blur(2px)" /> {/* filter overrides theme */}
</Scene>
```

---

### 7.7 BackgroundLayer Component (`player/BackgroundLayer.tsx`)

`BackgroundLayer` is the React component that renders the background DOM element in the composable player layout. It provides the DOM elements that `BackgroundWidget` manipulates each tick.

```tsx
import { BackgroundLayer, SceneCanvas, EngineOverlayHost } from '@brewsite/core';

<ScrollStage ...>
  <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
  <SceneCanvas />
  <EngineOverlayHost />
</ScrollStage>
```

`BackgroundLayer` registers its DOM element with the engine context so that `BackgroundWidget.apply()` can set CSS properties on it each tick. The component accepts standard `div` props (`className`, `style`) for positioning within the consumer's layout.

---

## 8. Technical Considerations

### Overlay element lifecycle

`BackgroundWidget` manages two DOM elements:
- `element` — the background layer; always present
- `overlayElement` — created lazily on first use of `overlayGradient` or `backdropFilter`; removed from DOM when both are cleared

The `BackgroundDomRefs` type is `{ element: HTMLElement; overlayElement: HTMLElement | null }`.

The overlay element is positioned with `position: absolute; inset: 0; pointer-events: none; z-index: 1` above the background element and below the scene canvas.

### CSS filter z-order

`filter: blur(...)` applied to the background element (`element`) blurs only the background layer — not scene content. This is correct because the background element is separate from `EngineOverlayHost`. The filter does not "escape" to the canvas or overlays.

### Gradient property clearing

Switching from a solid color background to a gradient (or vice versa) requires explicitly clearing the unused CSS property. The render layer always clears `background`, `backgroundColor`, and `backgroundImage` in the correct order to prevent stale values from persisting across state transitions.

### BackgroundWidget and CUSTOM_NODE_HANDLER

`BackgroundWidget` uses `CUSTOM_NODE_HANDLER` (the `IHasCustomDslHandler` pattern) to participate in DSL compilation with custom logic. This allows the widget to read the `theme` prop during compile time and resolve fill + effects before the tick bake. The resulting `SceneBackground` stored in the compiled `SceneTrack` contains only plain data — no React components, no `SceneTheme` objects, no function references.

---

## 9. Breaking Change Assessment

**Semver impact: minor.** All new fields on `BackgroundProps` and `SceneBackground` are optional. Existing scenes using `color`, `imageUrl`, `opacity`, `cssPosition`, `cssSize`, `cssRepeat` or `position` are unaffected. No existing fields are removed or renamed.

---

## 10. Dependencies

- `packages/core/src/theme/types.ts` — `SceneTheme` type for `theme` prop
- `packages/core/src/widget/` — `CUSTOM_NODE_HANDLER` symbol, `IHasCustomDslHandler` interface
- No new external npm packages

---

## 11. Risks & Mitigations

**`backdropFilter` browser support:** Not universally supported on older Android WebViews. Mitigation: documented in this PRD and in the type JSDoc. Consumers targeting older Android should use `@supports (backdrop-filter: blur(1px))` guards or avoid the property.

**Overlay element not cleaned up on widget destroy:** If `BackgroundWidget` is destroyed before the `overlayElement` is removed from DOM, the overlay may linger. Mitigation: `BackgroundWidget.dispose()` removes both `element` and `overlayElement` from their parent containers.

---

## 12. Launch Criteria

- All new `BackgroundProps` fields exported and typed correctly in `dsl.tsx`.
- `SceneBackground` updated with new fields in `types.ts`.
- `compile.ts` resolves `theme` prop into concrete fields via `BackgroundWidget.CUSTOM_NODE_HANDLER`.
- `render.ts` applies `gradient`, `cssFilter`, `overlayGradient`, `backdropFilter` correctly, with proper clearing of stale CSS properties on state transitions.
- `BackgroundWidget.test.ts` covers: gradient fill → solid fill property clearing; overlay element creation/removal lifecycle; theme-derived fill and effects; explicit prop override of theme.
- TypeScript strict-mode typecheck passes.
- `pnpm test` passes for `@brewsite/core` with coverage on `src/elements/background/`.

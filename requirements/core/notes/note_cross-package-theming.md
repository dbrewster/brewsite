---
title: "Cross-Package Theming — Background, CSS Effects, Font, and Shade Tokens"
doc_type: note
owner: pm-1
status: complete
updated: 2026-03-04
change_history:
  - date: 2026-03-04
    author: PM-1
    summary: "Initial research note. Covers current state across all four packages, proposed unified SceneTheme token design, key design decisions, constraints, open questions, and v1 scope boundaries."
  - date: 2026-03-04
    author: PM-2
    summary: "Rigorous code-verified challenge pass. Corrected the WebGL font URL claim (fontUrl is optional; troika has a built-in default). Renamed FontShade to SceneColorMode with corrected polarity conventions. Flagged that shade-derived label color is a no-op for all existing DiagramTheme presets (all have explicit defaultLabelColor). Added constraint that fontUrl lives on DiagramThemeNodeConfig but is diagram-wide (affects NodeRenderer and GroupRenderer via themeResolver). Noted that charts have zero fontUrl mechanism today. Added ThemeContext as a required new artifact. Extended BackgroundDomRefs gap for overlay gradient. Closed Open Question 2 (base font size = 1rem). Added two new open questions that MUST be resolved before architecture plan."
---

# Cross-Package Theming — Background, CSS Effects, Font, and Shade Tokens

## Problem Statement

Today there is no unified theming surface across `@brewsite/core`, `@brewsite/diagram`, `@brewsite/charts`, and `@brewsite/model`. A scene author who uses all four packages must manage four completely separate, unconnected styling systems:

1. **Diagram** — A `DiagramTheme` object controls node colors, PBR material params, edge routing, and the HDR environment. It has `defaultLabelColor` / `defaultSublabelColor` and an optional `fontUrl` on `DiagramThemeNodeConfig` for troika-three-text. The theme covers only the WebGL-rendered diagram canvas — not overlays.

2. **Charts** — A `ChartTheme` object (separate type, separate presets, separate factory function) controls series colors, axis label colors, legend text colors, and a background plane color for the 3D chart. Font size is expressed in Three.js world units, not CSS. Axis labels and legend labels use troika-three-text internally. There is no fontUrl mechanism in `ChartAxisTokens` or `ChartLegendTokens` — charts use the troika built-in default font unconditionally.

3. **Model labels** — The `LabelItem` React component uses hardcoded defaults (`color ?? '#ffffff'`, `fontSize ?? 12`). The only font-family in use is whatever the document inherits — no font-family control is exposed at all. `LabelItem` references `--label-color` and `--label-line-color` CSS variables (set imperatively by `LabelPositioner` for target-color mode), but has no `fontFamily` style property of any kind.

4. **HTML overlays** — Scene overlay content is raw React `<div>` children of `<Scene>`. Every example scene has fully hardcoded inline styles: `fontFamily: 'JetBrains Mono, monospace'`, `color: 'rgba(130, 100, 255, 0.8)'`, `fontSize: 'clamp(18px, 2.6vw, 24px)'`. There is no theming hook in `EngineOverlayHost` or `ScenePlayer`.

5. **Background** — The `<Background>` element supports `color`, `imageUrl`, and basic CSS `background-*` properties. There is no gradient support, no CSS filter effects (blur, brightness, contrast), no overlay gradient, and no backdrop-filter. The background element renders as a DOM element, not a Three.js plane.

The result: changing a scene from a dark tech presentation to a light documentation style requires touching dozens of inline style values across every scene file, every element theme object, and every overlay `<div>`. There is no single authoring location for "this scene family uses this visual style."

Additionally, three of the four theme systems don't know about each other. A scene that combines a `DiagramCanvas`, a `Chart`, model labels, and a text overlay cannot establish a coherent typographic scale — the diagram theme uses Three.js world-unit font factors, the chart theme uses Three.js world-unit pixel sizes, model labels use raw px, and overlay text uses CSS px or `clamp()`. None of these speak the same language.

---

## Current State Inventory

### `@brewsite/core` — Background element

`SceneBackground` type in `packages/core/src/elements/background/types.ts`:
```typescript
export type SceneBackground = {
  imageUrl?: string;
  opacity: number;
  color?: string;        // CSS hex or color string
  position?: Vec3;       // world-space 3D offset
  cssPosition?: string;
  cssSize?: string;
  cssRepeat?: string;
};
```

The `BackgroundWidget` applies these via DOM style assignments (`backgroundColor`, `backgroundImage`, etc.) through `applyBackground()` in `render.ts`. **No gradient support. No CSS filter support. No overlay/blend-layer support.** The `BackgroundDomRefs` type holds a single `element: HTMLElement` — a second overlay DOM element does not exist today and must be created to support overlay gradients.

### `@brewsite/diagram` — DiagramTheme

The `DiagramThemeNodeConfig` sub-type in `types.ts` has:
```typescript
readonly defaultLabelColor: string;       // label text color (Three.js material)
readonly defaultSublabelColor: string;    // sublabel text color
readonly labelSizeFactor: number;         // multiplier on base font size
readonly sublabelSizeFactor: number;      // multiplier on base font size
readonly fontUrl?: string;               // OPTIONAL — URL to MSDF-encoded .ttf/.woff for troika-three-text
```

**`fontUrl` is optional.** When absent, troika-three-text uses its built-in default font. Despite the field living on `DiagramThemeNodeConfig` (the `node` section), `themeResolver.ts` (`buildThemeRenderConfig`) extracts it into `DiagramThemeRenderConfig.fontUrl` for diagram-wide use. Both `NodeRenderer` and `GroupRenderer` consume this field — it is a diagram-global text font setting, not a node-only setting. The naming is historical; the behavior is global.

All four existing DiagramTheme presets (`darkGlassTheme`, `enterpriseTheme`, `neonCyberTheme`, `lightMinimalTheme`) have explicit `defaultLabelColor` values. There is no preset that leaves `defaultLabelColor` unset.

The theme controls 3D canvas rendering only. HTML overlays above the canvas use raw inline styles — no font tokens are provided.

### `@brewsite/charts` — ChartTheme

`ChartAxisTokens` and `ChartLegendTokens` have:
```typescript
readonly labelColor: string;   // troika-three-text color (hex)
readonly fontSize: number;     // Three.js world units
readonly textColor: string;    // legend text color
```

**No `fontUrl` field exists anywhere in `ChartTheme`.** The chart label system (`AxesRenderer` and `LegendRenderer`) uses troika-three-text for axis tick labels and legend labels, but there is no mechanism to specify a custom font. The troika default font is used unconditionally. Adding `webglFontUrl` support in charts would be a **first-ever** font customization feature for the charts package, not wiring an existing mechanism.

### `@brewsite/model` — LabelItem (DOM rendered)

`LabelItem.tsx` renders as HTML with:
```typescript
color: `var(--label-color, ${resolvedLabelColor})`,  // falls back to '#ffffff'
fontSize: label.style?.fontSize ?? 12,
```

The CSS custom property `--label-color` is set imperatively by `LabelPositioner` for `target-color` mode, but is never set by any global theming system. There is **no `fontFamily` CSS property** on `LabelItem` at all — labels inherit font-family from their DOM ancestor. This means injecting `--brewsite-font-family` at the `EngineOverlayHost` level would propagate to labels IF and only if `LabelItem` renders inside the overlay host's DOM subtree.

### HTML Overlays — EngineOverlayHost

`EngineOverlayHost` exists at `packages/core/src/player/EngineOverlayHost.tsx`. It renders scene children (React nodes passed as children of `<Scene>`) into a positioned `<div>` overlay. It accepts `className`, `passthroughPointerEvents`, and `overlayTransition` props. There is no CSS variable injection, no theme context, and no font-token system.

**EngineProvider does not render EngineOverlayHost.** The component is placed manually by the consumer in their layout tree. Passing theme information from `EngineProvider` to `EngineOverlayHost` requires a new `ThemeContext` React context that EngineProvider populates and EngineOverlayHost reads. No such context exists today.

---

## Proposed Solution

Introduce a `SceneTheme` token object in `@brewsite/core` that serves as the single source of truth for cross-package visual style. The key insight: different rendering targets need different representations of "font" and "color" — a `SceneTheme` bridges them by defining high-level semantic tokens that each package's adapter translates into its own technical representation.

### SceneTheme Token Vocabulary

```typescript
// packages/core/src/theme/types.ts (new file)

/**
 * Color mode for the scene — names the BACKGROUND polarity, not the text polarity.
 * 'dark'  = dark-background scene; downstream defaults use light-colored text and surfaces.
 * 'light' = light-background scene; downstream defaults use dark-colored text and surfaces.
 *
 * Matches CSS prefers-color-scheme conventions. Note: diagram/chart presets have their
 * own full color palettes; this token only drives DEFAULTS for elements that lack
 * explicit color overrides.
 */
export type SceneColorMode = 'dark' | 'light';

/**
 * Font family tokens. Diagram and chart labels (troika-three-text) require
 * a font file URL pointing to an MSDF-encoded .ttf or .woff file. HTML overlay
 * text uses a CSS font-family string. These are separate tokens because the
 * rendering targets are fundamentally different.
 */
export type SceneThemeFontTokens = {
  /** CSS font-family string for HTML overlay content (EngineOverlayHost). */
  readonly htmlFamily: string;
  /**
   * URL to an MSDF-encoded .ttf or .woff font file for Three.js text rendering via
   * troika-three-text (diagram labels, chart axis labels, chart legend).
   * If omitted, each package falls back to the troika built-in default font.
   * Note: the troika built-in font loads from CDN in some configurations;
   * for production use, providing a self-hosted font URL is strongly recommended.
   */
  readonly webglFontUrl?: string;
};

/**
 * Font size scale: a multiplier (default 1.0) applied per semantic level.
 * Each package interprets these against its own internal base sizes.
 * For HTML overlays, these multiply against --brewsite-base-font-size (default: 1rem).
 * For WebGL text (troika), these multiply against each package's internal world-unit
 * base size (e.g., DiagramThemeNodeConfig.labelSizeFactor × scale for diagram labels;
 * ChartAxisTokens.fontSize × scale for chart tick labels).
 *
 * These multipliers express PROPORTIONAL relationships, not absolute equivalence
 * across rendering targets. A scale of 0.7 on HTML and 0.7 on WebGL will produce
 * text that looks proportionally smaller in each context, but the two rendered
 * sizes will not be visually identical because HTML px and Three.js world units
 * have no shared coordinate system.
 */
export type SceneThemeFontSizeScale = {
  readonly heading: number;    // e.g., 1.5 — large titles
  readonly body: number;       // e.g., 1.0 — standard reading text
  readonly label: number;      // e.g., 0.85 — node labels, axis labels
  readonly caption: number;    // e.g., 0.7 — sublabels, small explanatory text
  readonly annotation: number; // e.g., 0.6 — tiny callouts, tick labels
};

/** Background fill — solid color, image, or gradient. Mutually exclusive. */
export type SceneThemeBackgroundFill =
  | { readonly kind: 'color';    readonly value: string }
  | { readonly kind: 'image';    readonly url: string; readonly size?: string; readonly position?: string }
  | { readonly kind: 'gradient'; readonly value: string }; // CSS gradient string

/** CSS filter and overlay effects applied on top of the background fill. */
export type SceneThemeBackgroundEffects = {
  /** CSS filter string, e.g. 'blur(4px) brightness(0.8)'. Applied to the background layer. */
  readonly cssFilter?: string;
  /**
   * Overlay gradient drawn above the background, below scene content.
   * CSS gradient string, e.g. 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 50%)'.
   * Requires BackgroundWidget to manage a second DOM element (overlayElement).
   */
  readonly overlayGradient?: string;
  /** CSS backdrop-filter applied to the overlay layer. e.g. 'blur(12px)'. */
  readonly backdropFilter?: string;
  /** Overall background opacity [0–1]. */
  readonly opacity?: number;
};

export type SceneThemeBackground = {
  readonly fill?: SceneThemeBackgroundFill;
  readonly effects?: SceneThemeBackgroundEffects;
};

/**
 * Unified scene theme token set.
 * Defined in @brewsite/core/src/theme/types.ts; exported from @brewsite/core index.
 * Consumed by all packages as an optional input.
 */
export type SceneTheme = {
  /**
   * Background color mode. 'dark' = dark scene background (drives light text defaults).
   * 'light' = light scene background (drives dark text defaults).
   */
  readonly colorMode: SceneColorMode;
  readonly font: SceneThemeFontTokens;
  readonly fontSize: SceneThemeFontSizeScale;
  readonly background?: SceneThemeBackground;
  /**
   * Primary accent color — used by diagram node palette defaults, chart series[0] color,
   * overlay highlight text. Each package may interpret this differently.
   */
  readonly accentColor?: string;
};
```

### How Tokens Propagate Per Package

**@brewsite/core — Background element:**
The `<Background>` DSL gains a `theme?: SceneTheme` prop. When set, the Background element derives its fill and effects from the theme. Per-element props (`color`, `imageUrl`, `cssFilter`, etc.) still override the theme. The `BackgroundWidget` renders:
- `fill.kind === 'gradient'` → sets `background: <value>` on the DOM element (switching from `backgroundColor` to the `background` shorthand; the implementation must clear the unused property on each update)
- `effects.cssFilter` → sets `filter: <value>`
- `effects.overlayGradient` → renders via a second DOM element (`overlayElement`) managed by `BackgroundWidget`. `BackgroundDomRefs` must be extended to `{ element: HTMLElement; overlayElement: HTMLElement | null }`.
- `effects.backdropFilter` → sets `backdrop-filter: <value>` on the overlay element

**@brewsite/core — CSS variables via ThemeContext:**
A new `ThemeContext` React context is introduced in `@brewsite/core/src/theme/ThemeContext.ts`. `EngineProvider` accepts an optional `sceneTheme?: SceneTheme` prop and provides it via `ThemeContext`. `EngineOverlayHost` reads from `ThemeContext` and — when a theme is present — injects CSS custom properties as inline styles on its root `<div>`:
```
--brewsite-font-family: <theme.font.htmlFamily>
--brewsite-base-font-size: 1rem          /* default; consumer can override via className */
--brewsite-font-size-heading: calc(1rem * <theme.fontSize.heading>)
--brewsite-font-size-body: calc(1rem * <theme.fontSize.body>)
--brewsite-font-size-label: calc(1rem * <theme.fontSize.label>)
--brewsite-font-size-caption: calc(1rem * <theme.fontSize.caption>)
--brewsite-font-size-annotation: calc(1rem * <theme.fontSize.annotation>)
--brewsite-text-primary: <colorMode === 'dark' ? '#ffffff' : '#111111'>
--brewsite-text-secondary: <colorMode === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'>
--brewsite-accent-color: <theme.accentColor ?? ''>
```
Scene overlay authors can then use these variables in their overlay JSX instead of hardcoded values. `ScenePlayer` also reads from `ThemeContext` (it renders an `EngineProvider` internally) via a `sceneTheme` prop threaded through.

**@brewsite/diagram — DiagramTheme:**
The `DiagramTheme` gains an optional `sceneTheme?: SceneTheme` field. When present, `themeResolver.ts` (`buildThemeRenderConfig`) derives:
- `fontUrl` from `sceneTheme.font.webglFontUrl` if `theme.node.fontUrl` is not explicitly set (undefined)
- Label color polarity from `sceneTheme.colorMode`: `'dark'` → light labels; `'light'` → dark labels

**Critical constraint:** All four existing DiagramTheme presets (`darkGlass`, `enterprise`, `neonCyber`, `lightMinimal`) have explicit `defaultLabelColor` values. The fallback from `sceneTheme.colorMode` only applies when `defaultLabelColor` is **not set** (undefined). In practice, `sceneTheme.colorMode` has NO effect on label colors when using any of the four built-in presets unless the consumer creates a custom theme or theme override that drops the explicit label color. This is not a bug; it is expected behavior given the precedence model. Consumers who want shade-driven label colors with the built-in presets should use `mergeTheme` to remove the explicit label color override.

The existing `DiagramTheme.node.fontUrl` field takes precedence — `sceneTheme` provides a fallback, not an override.
- `labelSizeFactor` multiplied by `sceneTheme.fontSize.label`

**@brewsite/charts — ChartTheme:**
The `ChartTheme` gains an optional `sceneTheme?: SceneTheme` field. When present, `ChartWidget` derives:
- `axis.labelColor` from `sceneTheme.colorMode`
- `legend.textColor` from `sceneTheme.colorMode`
- A WebGL font URL for troika from `sceneTheme.font.webglFontUrl` (the first time any chart renderer will have custom font support)

The existing explicit `ChartTheme.axis.labelColor` field takes precedence.

**@brewsite/model — Label system:**
The `LabelStyle` type gains an optional `fontFamily?: string` field. The `ThemeContext` CSS variable `--brewsite-font-family` propagates to `LabelItem` automatically via CSS inheritance — no additional wiring is needed — as long as the `LabelItem` DOM elements are rendered inside the `EngineOverlayHost` subtree (which is the current behavior; labels are rendered via `LabelPositioner` into a DOM layer managed within the overlay structure).

### Theme Injection Point

The `SceneTheme` is provided at the player level (global scope), with optional per-scene and per-element override capability:

```typescript
// Global: prop on ScenePlayer or EngineProvider
<ScenePlayer sceneTheme={darkGlassSceneTheme} scenes={scenes} />

// Per-scene: Background element uses theme
<Scene id="hero">
  <Background theme={lightDocSceneTheme} />
</Scene>

// Per-element override: explicit props still win
<Background color="#0a0a14" />  // overrides theme fill
```

The `DiagramCanvas` and `Chart` elements gain optional `sceneTheme` props that override the global player-level theme for their element specifically.

---

## Key Design Decisions

### 1. Where does the SceneTheme type live?

**Decision: `packages/core/src/theme/types.ts` (new directory).**

A `theme/` directory in `packages/core/src/` follows the existing module pattern (each concern gets its own directory). The `ThemeContext.ts` and any preset exports (`darkSceneTheme`, `lightSceneTheme`) also live in `packages/core/src/theme/`. All exports from this directory are re-exported from `packages/core/src/index.ts`. This fits the dependency rule: diagram/charts/model may import core; core must not import them. A separate `@brewsite/tokens` package would add monorepo overhead without meaningful benefit at current scale.

### 2. SceneTheme as an opt-in layer vs. a required replacement

The existing `DiagramTheme` and `ChartTheme` are mature, functional APIs. The `SceneTheme` must be **additive and opt-in** — existing scenes that never pass a `SceneTheme` must behave identically to today. This means:

- `sceneTheme` is always optional on `DiagramTheme` and `ChartTheme`
- CSS variables in `EngineOverlayHost` are only injected when a `sceneTheme` is present in `ThemeContext`
- The existing per-field defaults in `DiagramTheme` and `ChartTheme` are unchanged

**Consequence:** A scene author can adopt `SceneTheme` incrementally — start with font tokens, then add background effects.

### 3. Font tokens: one system for two rendering targets

CSS font-family strings and troika-three-text font URL strings are fundamentally incompatible. The design expresses them as two separate tokens (`htmlFamily` / `webglFontUrl`) rather than pretending they're the same thing. This is the correct trade-off: it's slightly more verbose but avoids a runtime mapping layer that would need to maintain a registry of font-name-to-URL associations.

### 4. Font size scale: multipliers, not px values

Using scale multipliers (relative to each package's internal base) rather than absolute px values allows the scene theme to express typographic relationships (heading is 1.5x body) without needing to know each package's internal unit system. Diagram world-unit sizes and HTML CSS px sizes cannot share an absolute value — but they can share a proportional scale.

The HTML base font size is `1rem` (the browser default, 16px). `EngineOverlayHost` injects `--brewsite-base-font-size: 1rem` as the default; consumers can override this value by setting the CSS variable on their own wrapper element or by passing a custom `className` to `EngineOverlayHost` that overrides `--brewsite-base-font-size`. The CSS variables use `calc(1rem * scale)` directly, not a reference to `--brewsite-base-font-size`, to avoid a dependency on the variable being set in a specific location.

Multiplier-based approach is appropriate here: the font size scale expresses proportional relationships. Consumers who need exact pixel control at the WebGL or HTML level can always set explicit sizes on individual elements.

### 5. Background fill and effects as separate buckets

Separating `fill` (what the background IS) from `effects` (what CSS does to the background layer) allows independent authoring. An author can apply a blur effect to an image background without changing the image URL. This also maps cleanly to the DOM rendering model: `filter` is applied to the background element; `backdrop-filter` is applied to the overlay element above it.

### 6. Color mode token

`SceneColorMode = 'dark' | 'light'` names the **background** polarity, not the text polarity. This aligns with CSS `prefers-color-scheme` convention and is less confusing than naming it by text color. `'dark'` = dark-background scene (light text/surfaces); `'light'` = light-background scene (dark text/surfaces).

The token drives downstream DEFAULTS only. It does not override explicit color values set in `DiagramTheme` or `ChartTheme` presets. All four existing diagram theme presets have explicit `defaultLabelColor` values, so `colorMode` has no effect on their label color unless the consumer creates a custom theme. This precedence model is correct but must be clearly documented for consumers.

### 7. CSS variable injection scope

CSS variables are injected at the `EngineOverlayHost` container level, not at the `document` root. Theme is delivered via `ThemeContext` from `EngineProvider` to `EngineOverlayHost`. This means themes are scoped to the player — multiple players on the same page can have different themes without global CSS contamination.

---

## Constraints Discovered

1. **Three.js text cannot use CSS font-family strings, and troika requires an MSDF-encoded font.** `troika-three-text` uses its built-in default font when no `fontUrl` is provided. However, the built-in font may load from CDN in some build configurations. For production use in a self-hosted environment, providing a self-hosted `webglFontUrl` is strongly recommended, but it is not technically required for functionality. Any font specified via `webglFontUrl` must be MSDF-encoded (.ttf or .woff with MSDF pre-processing) — a standard web font URL will not produce correct rendering.

2. **CSS gradient on `<Background>` requires a DOM rendering change.** The current `applyBackground()` function in `render.ts` sets `element.style.backgroundColor` for solid color. Adding gradient support requires detecting `fill.kind === 'gradient'` and setting `element.style.background` (the shorthand property) instead. When switching between fill kinds, the renderer must explicitly clear the unused property (e.g., `element.style.backgroundColor = ''` when switching to gradient mode).

3. **Overlay gradient requires a second DOM element in BackgroundWidget.** Applying `effects.overlayGradient` requires rendering a positioned `<div>` above the background layer. The `BackgroundDomRefs` type currently holds a single `element: HTMLElement`. It must be extended to `{ element: HTMLElement; overlayElement: HTMLElement | null }`. The BackgroundWidget must create and manage this second element's lifecycle.

4. **CSS filter on the background has a z-order implication.** Applying `filter: blur(4px)` to a background element will blur all children of that element, not just the background itself. The `BackgroundWidget` must ensure the filter is applied to a dedicated background-only container, not the same element that hosts the overlay content. This is already true in the current implementation — the background element is separate from `EngineOverlayHost`.

5. **`backdrop-filter` requires browser support check.** `backdrop-filter` is not universally supported (especially on older Android WebViews). Any implementation should use `@supports (backdrop-filter: blur(1px))` guards or document the limitation.

6. **Package dependency rule prevents charts/diagram from sharing types without core as intermediary.** `@brewsite/diagram` and `@brewsite/charts` cannot import from each other. Any shared token type must live in `@brewsite/core` so both can import it. This has already been accounted for in the design (see Decision #1 above).

7. **Label positioning in `@brewsite/model` uses absolute positioning with CSS transform.** The `LabelItem` component uses `position: absolute`, which means font-family CSS variables injected at the `EngineOverlayHost` level will propagate correctly to label items as long as `LabelItem` is rendered inside the overlay host. This is the current behavior — labels are rendered via `LabelPositioner` into a DOM layer managed within the overlay structure. CSS variable inheritance will work as expected.

8. **`labelSizeFactor` in `DiagramThemeNodeConfig` is a multiplier, not a pixel value.** The existing diagram theme uses size factors relative to an internal troika base size. The `SceneTheme.fontSize` scale multipliers compose with `labelSizeFactor` by multiplying: `effectiveLabelSizeFactor = theme.node.labelSizeFactor * sceneTheme.fontSize.label`. This requires care in `themeResolver.ts` to avoid double-applying when both are set.

9. **`fontUrl` on `DiagramThemeNodeConfig` is a diagram-wide setting despite its location.** The `fontUrl` field lives on the `node` sub-config of `DiagramTheme`, but `themeResolver.ts` extracts it into `DiagramThemeRenderConfig.fontUrl` which is consumed by both `NodeRenderer` and `GroupRenderer`. The naming is historical; the behavior is diagram-global. Any font applied via this field (or via `sceneTheme.font.webglFontUrl`) applies to all troika text rendered in the diagram, including group title labels. The architect should document this behavior clearly and decide whether `fontUrl` should eventually be promoted to the `DiagramTheme` root level (minor API improvement, non-breaking since `node.fontUrl` stays).

10. **EngineProvider and ScenePlayer are separate entry points.** Some consumers use `<ScenePlayer>` (full integrated player); others compose `<EngineProvider>` + `<SceneCanvas>` + `<EngineOverlayHost>` manually. The `sceneTheme` prop and CSS variable injection must be available in both paths. This is achieved via the new `ThemeContext`: both `ScenePlayer` and `EngineProvider` accept a `sceneTheme` prop and provide it through `ThemeContext`. `EngineOverlayHost` reads from `ThemeContext` and injects CSS variables when a theme is present.

---

## Open Questions

1. **Should SceneTheme be a React context or a compiled value?** The design uses a React context (`ThemeContext`) for the HTML/CSS injection path. This is correct for overlay content and `LabelItem`. WebGL theme values (fontUrl, label color polarity) are derived at compile time in the respective package resolvers and do not need React context — they're passed as props/config. The split is: React context for CSS/HTML concerns; prop-drilling for WebGL concerns.

2. ~~**What is the base font size for HTML overlays?**~~ **Resolved.** The CSS font size variables use `calc(1rem * scale)` directly. `1rem` is the HTML default (typically 16px). Consumers who need a different base can set `--brewsite-base-font-size` on their container, but the BrewSite-injected variables do not depend on it — they use `1rem` directly so they work without any custom variable setup.

3. **Should `SceneTheme` include a color palette?** The diagram theme already has a `palette: string[]` for node color cycling. Should `SceneTheme` define a shared palette that diagram, charts, and overlay text can all use? Or is per-package palette control sufficient? Shared palette would enable a "brand colors" scenario but adds complexity. Deferred to v2.

4. **What is the migration path for existing diagram/chart themes?** Existing scenes use `darkGlassTheme` without any `SceneTheme`. If `sceneTheme` is added as an optional field to `DiagramTheme`, there is no migration required. But the four preset diagram themes and four preset chart themes should ideally be accompanied by corresponding `SceneTheme` presets that capture the same visual intent — should these be shipped as named exports from core?

5. **Should `DiagramTheme` gain a `background?: SceneThemeBackground` field to let the diagram canvas theme drive the scene background?** This would allow a scene author to do `<DiagramCanvas theme={darkGlassTheme}>` and have the background automatically set to the dark navy that the diagram expects. Or should the scene background always be set independently via `<Background>`?

6. **How does per-scene theming interact with the global player-level theme?** If `<ScenePlayer sceneTheme={...}>` sets global tokens, and a specific `<Scene>` declares `<Background theme={differentTheme} />`, do the CSS variables update mid-scene? The CSS variable injection mechanism needs to know whether theme tokens can change between scenes or are fixed for the whole session.

7. **What font file should ship as the default `webglFontUrl`?** The existing diagram package uses troika's built-in default. Should `@brewsite/core` bundle a default font file, or document that consumers must host their own? Bundling a font adds significant bundle weight.

8. **How should consumers use `colorMode` with built-in DiagramTheme presets if they want shade-driven label colors?** Since all four built-in presets have explicit `defaultLabelColor`, setting `sceneTheme.colorMode` has no effect on diagram label colors in practice. The architect must decide: (a) document that `mergeTheme` is the escape hatch to remove the explicit label color; (b) add a `DiagramCanvas` prop like `inheritColorModeForLabels: boolean` that forces shade-derived colors as an override; or (c) accept the current behavior and leave it for consumers to work around. **This must be resolved before the architecture plan is written.**

9. **Should `fontUrl` on `DiagramThemeNodeConfig` eventually be promoted to `DiagramTheme` root?** Since `fontUrl` is diagram-wide (not node-specific), its placement on the `node` sub-config is misleading. Promoting it to `DiagramTheme.fontUrl` would be a minor breaking change (field location changes). A deprecation shim on `node.fontUrl` → `fontUrl` could bridge the gap. The architect should take a position on whether to do this as part of this work or defer it.

---

## Scope Boundaries

### In scope for v1

- `SceneTheme` type definition in `@brewsite/core/src/theme/` with: `colorMode`, `font` (htmlFamily + webglFontUrl), `fontSize` scale (5 semantic levels), `background` (fill + effects), optional `accentColor`
- `ThemeContext` React context in `@brewsite/core/src/theme/ThemeContext.ts`; populated by `EngineProvider` and `ScenePlayer`; consumed by `EngineOverlayHost`
- CSS variable injection in `EngineOverlayHost` when `SceneTheme` is provided via `ThemeContext`
- Background element: gradient fill support, CSS filter support, overlay gradient support (with extended `BackgroundDomRefs`)
- `DiagramTheme.sceneTheme?: SceneTheme` optional field — diagram theme resolver derives font URL and label color polarity from it when present (as fallback; explicit theme values take precedence)
- `ChartTheme.sceneTheme?: SceneTheme` optional field — chart widget derives axis/legend font from it when present
- Two `SceneTheme` presets in `@brewsite/core`: `darkSceneTheme`, `lightSceneTheme` with sensible defaults
- TypeScript: full static typing, no `any`, all token fields `readonly`
- All types exported from `packages/core/src/index.ts`

### Out of scope for v1

- Animated theme transitions (cross-fading between light and dark)
- CSS-in-JS, design token formats (Style Dictionary, etc.)
- Automatic dark/light mode switching from `prefers-color-scheme`
- Per-node or per-edge font overrides in diagram (existing `fontUrl` on `DiagramThemeNodeConfig` is sufficient)
- Font file bundling in core (consumers host their own fonts)
- `SceneTheme` presets for neonCyber / enterprise (can be authored by consumers using the two base presets)
- Chart-level background gradient (chart `background` tokens are WebGL plane-based; CSS gradient doesn't apply)
- Theming of the 3D scene background (the Three.js scene renderer background color — separate from the DOM `<Background>` element)
- Background effects for Three.js environments (DiagramCanvas uses its own Three.js scene with a separate background — CSS filters don't apply to WebGL output)
- A `useSceneTheme()` hook (CSS variables are sufficient for v1 overlay authors; a hook can be added as a minor enhancement in v2)
- Promoting `DiagramThemeNodeConfig.fontUrl` to `DiagramTheme` root level (deferred; not breaking enough to block v1)

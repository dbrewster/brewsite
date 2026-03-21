---
title: "@brewsite/slides — Slide Deck Package"
doc_type: prd
owner: brewsite-product-manager
status: current
updated: 2026-03-20
change_history:
  - date: 2026-03-05
    author: "brewsite-product-manager"
    summary: "Initial PRD created for v0.1.0 release. Documents the full feature set, public API surface, composition architecture, v1.0 vs v1.1 scope boundary, version history, and known limitations for the @brewsite/slides package."
  - date: 2026-03-17
    author: "Toolkit Product"
    summary: "Codebase alignment audit. Fixed useSlideNotes signature: takes (slideKey: string) parameter, not zero args. PresenterView and SlidePrintLayout are now implemented as internal components but NOT exported from the package barrel. Added theme family system exports: DECK_THEME_PAIRS, getDeckThemeForFamily, createDeckThemeForFamily (from themeFamily.ts). Added SlideTransitionWrapper and SlideProgressIndicator as internal player components. Fixed compileDeckTheme function reference: actual function is compileDeckTheme() in compiler/themeCompiler.ts. Updated v1.0/v1.1 scope to reflect current implementation state."
  - date: 2026-03-20
    author: "Toolkit Product"
    summary: "Slides expansion rewrite. Replaced DeckTheme with three-axis customization: SceneTheme (visual, from core) + SlideTheme (feel) + SlideTemplate (branding). 19 layout archetypes (12 core + 7 fast-follow). 12 graphics components + 4 animation hooks. SlidePlayer no longer creates SceneEngine — it renders inside a parent SceneEngine context. slidesPlugin() is zero-arg. 9 slide transitions. Deleted DeckTheme, ResolvedDeckTheme, themeFamily.ts, DECK_THEME_PAIRS, getDeckThemeForFamily, createDeckThemeForFamily, defaultDeckTheme, darkDeckTheme, createDeckTheme, SlidesPluginOptions."
---

# @brewsite/slides — Slide Deck Package

## 1. Overview

`@brewsite/slides` is a BrewSite published package that provides an opinionated, batteries-included authoring surface for slide deck experiences built on Three.js. It exposes a clean DSL (`<Slide>`, `<TitleSlide>`, `<ContentSlide>`, `<BigNumberSlide>`, etc.) and a library of graphics components (`<StatCard>`, `<Timeline>`, `<ProgressRing>`, etc.) for authoring corporate presentation decks.

`<SlidePlayer>` renders inside a parent `<SceneEngine>` context — it does not create its own engine. Visual tokens come from `SceneTheme` via the engine. Presentation-specific behavioral tokens come from `SlideTheme`. Corporate branding comes from `SlideTemplate`. These three axes are orthogonal and independently composable.

The package targets developers who want to produce high-quality, 3D-capable presentation decks using BrewSite primitives — without the platform-level plumbing that those primitives otherwise require.

Affects: `@brewsite/slides`, `@brewsite/core` (additive `SceneTheme` fields), `@brewsite/themes` (preset enrichment).

---

## 2. Package Identity

| Field | Value |
|---|---|
| Package name | `@brewsite/slides` |
| Build | `tsc` only (no Vite) |
| Entry | `dist/index.js` + `dist/index.d.ts` |
| Side effects | none (`"sideEffects": false`) |

**Required peer dependencies:**
- `@brewsite/core` (workspace peer — required)
- `react` `^18 || ^19`
- `react-dom` `^18 || ^19`
- `three` `^0.183.1`

**Optional peer dependencies:**
- `@brewsite/diagram` — required when slides embed `<DiagramCanvas>` elements
- `@brewsite/model` — required when slides embed GLTF model elements
- `@brewsite/charts` — required when slides embed chart elements

---

## 3. Three-Axis Customization Model

| Axis | Type | Set On | Controls |
|---|---|---|---|
| **SceneTheme** | `SceneTheme` | `<SceneEngine theme={...}>` or `sceneTheme` prop | Colors, fonts, spacing, accent color, text colors, surfaces, semantic colors, shadows, border radii. All `--brewsite-*` CSS variables. |
| **SlideTheme** | `SlideTheme` | `<SlidePlayer slideTheme={...}>` | Animation timing, content density, typography scale, graphical component sizing. All `--slide-*` CSS variables. |
| **SlideTemplate** | `SlideTemplate` | `<SlidePlayer template={...}>` | Corporate chrome: logos, footers, watermarks, default transition, default progress indicator. |

The three axes are orthogonal. Any `SlideTheme` pairs with any `SlideTemplate` and any `SceneTheme`. A McKinsey deck has tight spacing and fast reveals (SlideTheme) plus the McKinsey logo and confidentiality footer (SlideTemplate) using the enterprise color scheme (SceneTheme). Acme Corp swaps the template, keeps the theme and colors.

---

## 4. Public API Surface

### 4.1 Primary Component

| Export | Description |
|---|---|
| `SlidePlayer` | Root slide deck component. Renders inside a `<SceneEngine>` context. Accepts `<Slide>` children. |
| `SlidePlayerProps` | TypeScript props type for `SlidePlayer`. |

### 4.2 Layout DSL Components

All layout components return `null` — they are compiled, not rendered. **12 core layouts:**

| Export | Layout | Description |
|---|---|---|
| `TitleSlide` | `'title'` | Full-viewport title with optional subtitle and tagline. |
| `SectionSlide` | `'section'` | Section divider slide. |
| `ContentSlide` | `'content'` | Title bar at top, content region below. |
| `TwoColumnSlide` | `'two-column'` | Optional title, two equal-width columns. |
| `ImageSlide` | `'image'` | Image + content split with configurable position. |
| `FullBleedSlide` | `'full-bleed'` | Full canvas with optional text overlay at anchor position. |
| `BlankSlide` | `'blank'` | No predefined structure. |
| `BigNumberSlide` | `'big-number'` | Stats highlight slide with value, label, trend. |
| `MetricGridSlide` | `'metric-grid'` | Grid of KPI cards with optional icons. |
| `ComparisonSlide` | `'comparison'` | Feature comparison table with column highlighting. |
| `QuoteSlide` | `'quote'` | Quote/testimonial with attribution. |
| `AgendaSlide` | `'agenda'` | Agenda/table of contents with items. |

**7 fast-follow layouts** are defined in the `SlideLayout` type but do not yet have dedicated DSL components: `'timeline'`, `'process'`, `'team'`, `'closing'`, `'bento'`, `'dashboard'`, `'matrix'`. Use `ContentSlide` + graphics components to achieve these patterns.

**Legacy layout components** (kept for backward compatibility): `TitleLayout`, `TitleBodyLayout`, `TwoColumnLayout`, `FullBleedLayout`, `BlankLayout`, `SlideContent`.

### 4.3 Slide DSL

| Export | Description |
|---|---|
| `Slide` | Primary authoring unit. One `<Slide>` = one `<Scene>`. The `key` prop is the stable slide identifier. |
| `SlideProps` | Props: `children`, `notes`, `title`, `scrollUnits`, `transition`, `sceneDsl`. |

### 4.4 Text Content Primitives

React components rendered inside layout regions. They consume CSS variables.

| Export | Description |
|---|---|
| `Heading` | Semantic heading (`h1`–`h3`). Props: `level`, `children`, `color`. |
| `Body` | Paragraph text. Props: `children`. |
| `BulletList` | Bullet list with optional sequential reveal. Props: `items`, `animateEntrance`, `bulletStyle`. |
| `NumberedList` | Numbered list. Props: `items`, `animateEntrance`. |

### 4.5 Graphics Components

12 React components for rich slide content. All accept `progress?`, `className?`, `style?` props.

| Export | Description |
|---|---|
| `StatCard` | Metric value with label and optional trend indicator. |
| `Timeline` | Sequence of labeled milestones. Horizontal or vertical orientation. |
| `ProcessSteps` | Ordered process steps with active state. |
| `IconGrid` | Grid of icon + label items. |
| `ComparisonTable` | Feature comparison table with discriminated cell values. |
| `ProgressRing` | Circular progress indicator (SVG). |
| `ProgressBar` | Horizontal progress bar. |
| `CalloutBox` | Styled callout with variant-colored border. |
| `QuoteBlock` | Styled blockquote with attribution. |
| `MetricRow` | Horizontal row of metric items. |
| `Badge` | Pill-shaped badge with variant styling. |
| `Divider` | Horizontal divider (solid, dashed, or gradient). |

### 4.6 Animation Hooks

| Export | Description |
|---|---|
| `useCountUp` | Animated number counting driven by scene progress. |
| `useStaggeredReveal` | Staggered item visibility. Returns `{ visible, style }`. |
| `useProgressWindow` | Progress [0,1] clamped within a sub-window of scene progress. |
| `useEntrance` | CSS entrance animation properties driven by scene progress. |
| `easeOutCubic` | Easing function: `(t: number) => number`. |
| `easeInOutCubic` | Easing function. |
| `easeOutQuart` | Easing function. |
| `linear` | Easing function (identity). |

### 4.7 Types

| Export | Description |
|---|---|
| `SlideLayout` | Union of 19 layout identifiers (`'title'` through `'matrix'`). |
| `SlideTransition` | Union of 9 transition types. |
| `EntranceType` | `'fadeIn' \| 'slideUp' \| 'slideDown' \| 'slideLeft' \| 'slideRight' \| 'grow' \| 'none'`. |
| `SlideRegionEntrance` | Per-region entrance animation config. |
| `SlideTheme` | Presentation behavioral/density token type. |
| `SlideTemplate` | Corporate chrome template type. |
| `BrandAsset` | Brand asset (logo/wordmark/icon). |
| `ComparisonCellValue` | Discriminated union for comparison table cells (`check` / `text` / `number`). |
| `ResolvedSlideConfig` | Resolved theme config with CSS variable map. |
| `SlideRegion` | NVS-positioned content region within a compiled slide. |
| `SlideSpec` | Compiled single-slide representation. |
| `DeckSpec` | Compiled full-deck representation. |
| `SlidePlayerHandle` | Imperative handle: `goTo`, `next`, `prev`, `captureSlideSnapshots`. |
| `PrintOptions` | Print layout options (forward declaration). |
| `ProgressStyle` | `'dots' \| 'bar' \| 'numbers' \| 'none'`. |
| `SlideNavigationConfig` | Navigation channel configuration. |

### 4.8 Theme Utilities

| Export | Description |
|---|---|
| `defaultSlideTheme` | Balanced general-purpose presentation theme. |
| `compactSlideTheme` | Tight, fast. Data-heavy decks. |
| `cinematicSlideTheme` | Spacious, slow. Apple keynote feel. |
| `minimalSlideTheme` | Clean, snappy. No stagger, fast transitions. |
| `createSlideTheme` | Factory: deep-merges `DeepPartial<SlideTheme>` with `defaultSlideTheme`. |
| `DeepPartial` | Utility type for nested partial overrides. |

### 4.9 Template Utilities

| Export | Description |
|---|---|
| `resolveTemplate` | `(template?: SlideTemplate) => ResolvedTemplate \| undefined`. Resolves template to CSS variables. |
| `ResolvedTemplate` | `{ template: SlideTemplate; cssVars: Record<string, string> }`. |

### 4.10 Plugin

| Export | Description |
|---|---|
| `slidesPlugin` | Zero-arg `WidgetPlugin` factory. Registers `SlideMetaWidget` and `SlideNavWidget`. |

### 4.11 Player Hooks

| Export | Description |
|---|---|
| `useSlideNavigation` | Hook for reading and controlling the current slide. Returns `SlideNavigationState`. |
| `useSlideNotes` | Hook for reading speaker notes. Takes `(slideKey: string)`. Returns `string \| undefined`. |
| `computeSlideStartProgress` | Pure utility computing global engine progress for slide `i` given `scrollUnits`. |
| `SlideNavigationState` | Return type of `useSlideNavigation`. |

---

## 5. Feature Set

### 5.1 Slide Deck Authoring DSL

Authors write `<Slide>` children inside `<SlidePlayer>`, which itself renders inside a `<SceneEngine>`. No `EngineProvider`, `InputController`, or widget registry configuration is required.

```tsx
import { SceneEngine, corePlugin } from '@brewsite/core';
import { SlidePlayer, Slide, TitleSlide, ContentSlide, Body, BulletList, slidesPlugin, compactSlideTheme } from '@brewsite/slides';

export function TechDeck() {
  return (
    <SceneEngine plugins={[corePlugin(), slidesPlugin()]}>
      <SlidePlayer slideTheme={compactSlideTheme}>
        <Slide key="title">
          <TitleSlide title="BrewSite Architecture" subtitle="How it works" />
        </Slide>
        <Slide key="principles" notes="Emphasize the compiler purity point.">
          <ContentSlide title="Core Principles">
            <BulletList
              items={['Pure declarative scenes', 'Pre-baked SceneTrack', 'Widget-first extension']}
              animateEntrance
            />
          </ContentSlide>
        </Slide>
      </SlidePlayer>
    </SceneEngine>
  );
}
```

### 5.2 SlidePlayer Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | required | `<Slide>` elements |
| `slideTheme` | `SlideTheme` | `defaultSlideTheme` | Presentation behavioral theme |
| `template` | `SlideTemplate` | — | Corporate chrome template |
| `transition` | `SlideTransition` | `'dissolve'` | Default slide transition |
| `progressIndicator` | `ProgressStyle` | `'dots'` | Progress indicator style |
| `aspectRatio` | `number` | `16/9` | Canvas aspect ratio |
| `navigation` | `SlideNavigationConfig` | all enabled | Navigation configuration |
| `fullscreen` | `boolean` | — | Controlled fullscreen state |
| `defaultFullscreen` | `boolean` | `false` | Uncontrolled default fullscreen |
| `onFullscreenChange` | `(isFullscreen: boolean) => void` | — | Fullscreen state callback |
| `onSlideChange` | `(index: number, slideKey: string) => void` | — | Slide change callback |
| `className` | `string` | — | CSS class for outer container |
| `style` | `CSSProperties` | — | Inline style for outer container |

### 5.3 Layout Variants

19 layout archetypes. 12 have dedicated DSL components. 7 fast-follow layouts use `ContentSlide` + graphics components.

Each layout component accepts an `entrance?: SlideRegionEntrance` prop for per-region entrance animations. `SlideRegionEntrance` allows specifying `EntranceType` for `title`, `body`, `left`, `right` regions independently with an optional `stagger` delay.

### 5.4 Slide Transitions

9 transition types implemented as CSS transitions/animations on `SlideTransitionWrapper`:

| Transition | Description |
|---|---|
| `'dissolve'` | Opacity crossfade |
| `'cut'` | Instant switch, no animation |
| `'fade'` | Alias for dissolve |
| `'push-left'` | Outgoing slides left, incoming from right |
| `'push-right'` | Outgoing slides right, incoming from left |
| `'push-up'` | Outgoing slides up, incoming from bottom |
| `'push-down'` | Outgoing slides down, incoming from top |
| `'zoom-in'` | Outgoing scales down + fades, incoming from center |
| `'zoom-out'` | Outgoing scales up + fades, incoming from large |

Transition duration is controlled by `SlideTheme.timing.transitionDuration` via the `--slide-transition-duration` CSS variable.

### 5.5 Input and Navigation

`SlidePlayer` pre-wires all standard presentation navigation. No `<InputController>` DSL is required.

**Keyboard** (window-scoped by default):

| Key(s) | Action |
|---|---|
| `ArrowRight`, `ArrowDown`, `Space`, `Enter`, `PageDown` | Next slide |
| `ArrowLeft`, `ArrowUp`, `PageUp` | Previous slide |
| `Home` | First slide |
| `End` | Last slide |
| `f` / `F` | Toggle fullscreen |

**Pointer**: Click → next slide. Right-click → previous slide.

**Touch**: Swipe left → next; swipe right → prev. Minimum swipe threshold: 40px.

**Mouse wheel**: Disabled by default. Enable via `navigation={{ wheel: true }}`.

All navigation channels are individually configurable via `SlideNavigationConfig`:

```typescript
type SlideNavigationConfig = {
  keyboard?: boolean;  // default: true
  pointer?: boolean;   // default: true
  touch?: boolean;     // default: true
  wheel?: boolean;     // default: false
  scope?: 'window' | 'canvas'; // default: 'window'
};
```

### 5.6 Graphics Components

12 React components for rich slide content. All are real React components (not DSL stubs) that render inside TextBox children. They consume `--brewsite-*` CSS variables from SceneTheme and `--slide-*` variables from SlideTheme.

Many accept a `progress?: number` prop for entrance animation integration — when provided, it controls the component's opacity.

### 5.7 Animation Hooks

4 hooks for progress-driven animations, all consuming `useSceneProgress()` from `@brewsite/core` internally:

- `useCountUp(target, options?)` — animated number counting
- `useStaggeredReveal(index, total, options?)` — staggered visibility with CSS style
- `useProgressWindow(start, end, options?)` — sub-window progress mapping
- `useEntrance(type, options?)` — CSS entrance animation properties

4 easing functions: `easeOutCubic`, `easeInOutCubic`, `easeOutQuart`, `linear`.

### 5.8 Speaker Notes

Notes are authored as a prop on `<Slide notes="...">`. Stored in VariableStore by `SlideMetaWidget` under `slide-meta:{slideKey}.notes`. Read via `useSlideNotes(slideKey)`.

### 5.9 Print / PDF: `captureSlideSnapshots()`

`SlidePlayerHandle` exposes `captureSlideSnapshots()` for WebGL canvas capture. Sequentially seeks each slide, waits for render, captures as PNG data URL. Returns `Map<slideKey, dataURL>`.

### 5.10 3D Content Embedding

Slides embed 3D content via the `sceneDsl` prop on `<Slide>`. Any core/diagram/model/chart DSL can be injected. Camera and Lighting must be included explicitly — SlidePlayer does not provide 3D defaults.

Required plugins must be registered on the parent `<SceneEngine>`:
```tsx
<SceneEngine plugins={[corePlugin(), slidesPlugin(), diagramPlugin()]}>
```

---

## 6. Composition Architecture

### 6.1 Engine Stack

`SlidePlayer` renders inside a parent `<SceneEngine>` context. It does not create its own engine.

```
SceneEngine (parent — owns plugins, theme, engine lifecycle)
└── SlidePlayer (child of SceneEngine)
    ├── <Scene> elements (compiled from <Slide> children)
    ├── EngineARContainer (aspectRatio=16/9 by default)
    │   ├── BackgroundLayer
    │   ├── SceneCanvas (ref for captureSlideSnapshots)
    │   ├── EngineOverlayHost (overlayTransition per deck transition setting)
    │   ├── SlidePlayerInner (hooks: navigation, imperative handle)
    │   ├── SlideChromeLogo (if template.master.logo)
    │   ├── SlideChromeFooter (if template.master.footer)
    │   └── SlideChromeWatermark (if template.master.watermark)
    ├── Pointer overlay (click/right-click navigation)
    └── SlideProgressIndicator
```

### 6.2 Plugin System

`slidesPlugin()` is a zero-arg `WidgetPlugin` factory. It registers `SlideMetaWidget` (publishes per-slide metadata to VariableStore) and `SlideNavWidget`.

Visual tokens come from `SceneTheme` via the parent engine's `ThemeContext`. Behavioral tokens come from `SlideTheme` via `--slide-*` CSS variables injected on the SlidePlayer container. No token passing through plugin options.

### 6.3 Compile Path

For each `<Slide>`, the deck compiler (`compiler/deckCompiler.ts`) produces a `SlideSpec` with layout regions (NVS coordinates), transition setting, scrollUnits, speaker notes, and animation metadata. The compiled `Scene` elements are rendered as children of the parent `SceneEngine`.

### 6.4 CSS Variable Architecture

Two namespaces:
- `--brewsite-*` — injected by `EngineOverlayHost` from `SceneTheme`. Controls colors, fonts, spacing, surfaces, shadows, radii.
- `--slide-*` — injected by `SlidePlayer` from `SlideTheme` + `SlideTemplate`. Controls timing, density, typography scale, component sizing, template chrome.

---

## 7. Known Limitations

**L1 — 7 fast-follow layouts have no dedicated DSL components.** `'timeline'`, `'process'`, `'team'`, `'closing'`, `'bento'`, `'dashboard'`, `'matrix'` are defined in `SlideLayout` but require `ContentSlide` + graphics components.

**L2 — Keyboard scope falls back to window.** `SlideNavigationConfig.scope: 'canvas'` is declared but not fully implemented. All keyboard events attach to `window`.

**L3 — `PresenterView` implemented but not exported.** Use `useSlideNotes(slideKey)` and `useSlideNavigation` for custom presenter interfaces.

**L4 — `SlidePrintLayout` implemented but not exported.** Use `captureSlideSnapshots()` for custom print flows.

**L5 — Empty manifest workaround.** When no GLTF assets are used, `SlidePlayer` passes a data-URL sentinel for `manifestUrl`. This is an internal detail reflecting a DX gap in `@brewsite/core`.

---

## 8. Reference

- Architecture plan: `requirements/slides/plans/archive/plan_slides-expansion.md`
- Feature note: `requirements/slides/notes/note_slides-expansion-change-plan.md`
- Core compiler PRD: `requirements/core/prd/prd_compiler.md`
- Core player/runtime PRD: `requirements/core/prd/prd_player_runtime.md`
- Core widget SDK PRD: `requirements/core/prd/prd_widget_sdk.md`

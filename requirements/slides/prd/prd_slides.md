---
title: "@brewsite/slides — Slide Deck Package"
doc_type: prd
owner: brewsite-product-manager
status: current
updated: 2026-03-17
change_history:
  - date: 2026-03-05
    author: "brewsite-product-manager"
    summary: "Initial PRD created for v0.1.0 release. Documents the full feature set, public API surface, composition architecture, v1.0 vs v1.1 scope boundary, version history, and known limitations for the @brewsite/slides package."
  - date: 2026-03-17
    author: "Toolkit Product"
    summary: "Codebase alignment audit. Fixed useSlideNotes signature: takes (slideKey: string) parameter, not zero args. PresenterView and SlidePrintLayout are now implemented as internal components but NOT exported from the package barrel. Added theme family system exports: DECK_THEME_PAIRS, getDeckThemeForFamily, createDeckThemeForFamily (from themeFamily.ts). Added SlideTransitionWrapper and SlideProgressIndicator as internal player components. Fixed compileDeckTheme function reference: actual function is compileDeckTheme() in compiler/themeCompiler.ts. Updated v1.0/v1.1 scope to reflect current implementation state."
---

# @brewsite/slides — Slide Deck Package

## 1. Overview

`@brewsite/slides` is a BrewSite published package that provides an opinionated, batteries-included authoring surface for slide deck experiences built on Three.js. It wraps the full `@brewsite/core` engine stack behind a single `<SlidePlayer>` component and exposes a clean DSL (`<Slide>`, `<TitleLayout>`, `<BulletList>`, etc.) for authoring slide decks without needing to configure `EngineProvider`, `WidgetRegistry`, cameras, lighting, or navigation controllers directly.

The package targets developers who want to produce high-quality, 3D-capable presentation decks using BrewSite primitives — without the platform-level plumbing that those primitives otherwise require. It is a consumer of `@brewsite/core`, not an extension to it: the package adds no new engine capabilities and contributes no new core interfaces.

Affects: `@brewsite/slides` (new package, v0.1.0). Non-breaking addition to `@brewsite/core` (`sceneProgress?: number` on `SceneTrackTick`).

---

## 2. Package Identity

| Field | Value |
|---|---|
| Package name | `@brewsite/slides` |
| Version | `0.1.0` |
| Build | `tsc` only (no Vite) |
| Entry | `dist/index.js` + `dist/index.d.ts` |
| Side effects | none (`"sideEffects": false`) |

**Required peer dependencies:**
- `@brewsite/core` (workspace peer — required)
- `react` `^18 || ^19`
- `react-dom` `^18 || ^19`
- `three` `^0.183.1`

**Optional peer dependencies:**
- `@brewsite/diagram` `^0.5.0` — required only when slides embed `<DiagramCanvas>` elements
- `@brewsite/model` `^0.5.0` — required only when slides embed GLTF model elements
- `@brewsite/charts` `^0.5.0` — required only when slides embed chart elements

The three optional peers are flagged `peerDependenciesMeta.optional: true` in `package.json`. A deck that contains no 3D sub-elements needs only the required peers.

---

## 3. Public API Surface

### 3.1 Primary Component

| Export | Description |
|---|---|
| `SlidePlayer` | Root component. Owns `EngineProvider` + full canvas/overlay stack. Accepts `<Slide>` children. |
| `SlidePlayerProps` | TypeScript props type for `SlidePlayer`. |

### 3.2 DSL Components

All DSL components return `null` — they are compiled, not rendered.

| Export | Description |
|---|---|
| `Slide` | Primary authoring unit. One `<Slide>` compiles to one `<Scene>`. The `key` prop is the stable scene id. |
| `TitleLayout` | Full-viewport centered title + optional subtitle. |
| `TitleBodyLayout` | Title bar at top (20% height), content region below (80% height). |
| `TwoColumnLayout` | Optional title at top; equal-width left/right content columns below. |
| `FullBleedLayout` | Full-bleed canvas with optional text overlay anchored to a corner or center. |
| `BlankLayout` | No predefined structure. Authors compose `<TextBox>` elements via `<SlideContent>`. |
| `SlideContent` | Escape hatch for fully custom slide content via raw `<TextBox>` DSL. |
| `Heading` | Semantic heading (`h1`–`h3`). Consumes DeckTheme heading font CSS variables. |
| `Body` | Paragraph text. Consumes DeckTheme body font CSS variables. |
| `BulletList` | Bullet list. Supports `animateEntrance` for sequential reveal via `sceneProgress`. |
| `NumberedList` | Numbered list. Same `animateEntrance` semantics as `BulletList`. |

### 3.3 DSL Prop Types

| Export | Description |
|---|---|
| `SlideProps` | Props for `<Slide>`. |
| `TitleLayoutProps` | Props for `<TitleLayout>`. |
| `TitleBodyLayoutProps` | Props for `<TitleBodyLayout>`. |
| `TwoColumnLayoutProps` | Props for `<TwoColumnLayout>`. |
| `FullBleedLayoutProps` | Props for `<FullBleedLayout>`. |
| `HeadingProps` | Props for `<Heading>`. |
| `BodyProps` | Props for `<Body>`. |
| `BulletListProps` | Props for `<BulletList>`. |
| `NumberedListProps` | Props for `<NumberedList>`. |

### 3.4 Compiler Functions

These are internal infrastructure functions. They are not exported from `@brewsite/slides/index.ts` and are not part of the public API surface.

### 3.5 Widget / Plugin

| Export | Description |
|---|---|
| `slidesPlugin` | `WidgetPlugin` factory. Registers `SlideMetaWidget` and `SlideNavWidget` into the engine's widget registry. |
| `SlidesPluginOptions` | Options type for `slidesPlugin()`. |

### 3.6 Player Components and Hooks

| Export | Description |
|---|---|
| `useSlideNavigation` | Hook for reading and controlling the current slide. Returns `SlideNavigationState`. |
| `useSlideNotes` | Hook for reading speaker notes for a given slide key from VariableStore. Takes `(slideKey: string)` parameter. Returns `string | undefined`. |
| `computeSlideStartProgress` | Pure utility function. Computes the global engine progress for the start of slide index `i` given the `scrollUnits` array. |
| `SlideNavigationState` | Return type of `useSlideNavigation`. |

### 3.7 Types

| Export | Description |
|---|---|
| `SlideLayout` | Union type: `'title' \| 'title-body' \| 'two-column' \| 'full-bleed' \| 'blank'`. |
| `SlideTransition` | Union type: `'dissolve' \| 'none'`. |
| `DeckTheme` | Authored deck-level theme type. Superset of `@brewsite/core`'s `SceneTheme`. |
| `ResolvedDeckTheme` | All optional `DeckTheme` fields filled; includes derived `sceneTheme` and `cssVars`. Produced by `compileDeckTheme()`. |
| `SlideRegion` | NVS-positioned content region within a compiled slide. |
| `SlideSpec` | Compiled representation of a single slide (internal; exported for type completeness). |
| `DeckSpec` | Compiled representation of a full deck (internal; exported for type completeness). |
| `SlidePlayerHandle` | Imperative handle exposed via `React.forwardRef`. Provides `goTo`, `next`, `prev`, `captureSlideSnapshots`. |
| `PrintOptions` | Options for the v1.1 `SlidePrintLayout` component. Defined now to lock the type contract. |
| `ProgressStyle` | Union type: `'dots' \| 'bar' \| 'numbers' \| 'none'`. |
| `SlideNavigationConfig` | Navigation configuration: `keyboard`, `pointer`, `touch`, `wheel`, `scope`. |

### 3.8 Theme Utilities

| Export | Description |
|---|---|
| `defaultDeckTheme` | Built-in light-mode deck theme. |
| `darkDeckTheme` | Built-in dark-mode deck theme. |
| `createDeckTheme` | Factory for merging partial `DeckTheme` values with `defaultDeckTheme`. |

### 3.9 Theme Family System

| Export | Description |
|---|---|
| `DECK_THEME_PAIRS` | `Record<ThemeFamily, DeckThemePair>` — dark/light pairs for all 7 theme families (`default`, `enterprise`, `darkGlass`, `midnight`, `neonCyber`, `lightCanvas`, `lightMinimal`). |
| `getDeckThemeForFamily` | `(family: ThemeFamily, polarity: ThemePolarity) => DeckTheme` — resolves the deck theme for a family and polarity. |
| `createDeckThemeForFamily` | `(family: ThemeFamily, polarity: ThemePolarity) => DeckTheme` — returns a shallow-cloned DeckTheme for mutation-safe use. |

---

## 4. Feature Set

### 4.1 Slide Deck Authoring DSL

Authors write `<Slide>` children inside `<SlidePlayer>`. There is no `EngineProvider`, `InputController`, or widget registry configuration required. The full example:

```tsx
import { SlidePlayer, Slide, TitleLayout, TitleBodyLayout, BulletList, darkDeckTheme } from '@brewsite/slides';

export function TechDeck() {
  return (
    <SlidePlayer theme={darkDeckTheme}>
      <Slide key="title">
        <TitleLayout title="BrewSite Architecture" subtitle="How it works" />
      </Slide>
      <Slide key="principles" notes="Emphasize the compiler purity point.">
        <TitleBodyLayout title="Core Principles">
          <BulletList
            items={['Pure declarative scenes', 'Pre-baked SceneTrack', 'Widget-first extension']}
            animateEntrance
          />
        </TitleBodyLayout>
      </Slide>
    </SlidePlayer>
  );
}
```

`SlidePlayer` accepts these props:

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | required | `<Slide>` elements |
| `theme` | `Partial<DeckTheme>` | `defaultDeckTheme` | Deck-level theme |
| `transition` | `'dissolve' \| 'none'` | `'dissolve'` | Default slide transition |
| `progressIndicator` | `ProgressStyle` | `'dots'` | Progress indicator style |
| `id` | `string` | — | Stable engine ID for `useSceneEngineState(id)` |
| `plugins` | `WidgetPlugin[]` | `[]` | Additional plugins (diagram, model, charts) |
| `aspectRatio` | `number` | `16/9` | Canvas aspect ratio |
| `navigation` | `SlideNavigationConfig` | all enabled | Navigation configuration |
| `fullscreen` | `boolean` | — | Controlled fullscreen state |
| `defaultFullscreen` | `boolean` | `false` | Uncontrolled default fullscreen |
| `onFullscreenChange` | `(isFullscreen: boolean) => void` | — | Fullscreen state callback |
| `onSlideChange` | `(index: number, slideKey: string) => void` | — | Slide change callback |
| `className` | `string` | — | CSS class for outer container |
| `style` | `CSSProperties` | — | Inline style for outer container |

### 4.2 Layout Variants

Six layout variants are available. Each compiles to one or more NVS-positioned `<TextBox>` DSL elements.

| Layout | DSL Component | Structure |
|---|---|---|
| Title | `<TitleLayout>` | Full-viewport centered title + optional subtitle |
| Title + Body | `<TitleBodyLayout>` | Title (top 20%) + content region (bottom 80%) |
| Two Column | `<TwoColumnLayout>` | Optional title (top 20%) + equal-width columns (bottom 80%) |
| Full Bleed | `<FullBleedLayout>` | Full canvas with optional text overlay at an anchor position |
| Blank | `<BlankLayout>` | No predefined structure |
| Custom | `<SlideContent>` | Escape hatch for raw `<TextBox>` DSL composition |

The layout compiler (`compiler/layoutCompiler.ts`) resolves each variant to `SlideRegion[]` — explicit NVS coordinates for each content region.

### 4.3 Text Primitives

Text primitives are React components rendered as children of TextBox DSL elements. They are not DSL nodes. They consume DeckTheme values via CSS custom properties injected by `EngineOverlayHost`.

| Component | Description |
|---|---|
| `<Heading level={1\|2\|3}>` | Semantic heading. Default level: 2. |
| `<Body>` | Paragraph text. Accepts `string` or `ReactNode` children. |
| `<BulletList items={string[]} animateEntrance? bulletStyle?>` | Bullet list with optional sequential reveal. |
| `<NumberedList items={string[]} animateEntrance?>` | Numbered list with same `animateEntrance` semantics as `BulletList`. |

**Animated entrance**: When `animateEntrance={true}`, `SlideMetaWidget` writes `sceneProgress` to the VariableStore each tick. `SlideContentWithProgress` reads it reactively via `useVariable` and computes `visibleCount = Math.ceil(sceneProgress × totalBullets)`. The `<BulletList>` renders only the first `visibleCount` items. This works without inflating the scene count — the single slide maps to a single `<Scene>` in the engine, and `sceneProgress` (added to `SceneTrackTick` in `@brewsite/core`) supplies the within-scene progress coordinate.

### 4.4 Slide Transitions

| Transition | Description |
|---|---|
| `'dissolve'` | Cross-fade. HTML overlay layer uses a CSS opacity transition (`durationMs: 200`). Three.js content uses the core compiled transition pipeline. |
| `'none'` | Instant cut. No CSS animation; `overlayTransition.enabled: false`. |

Transitions are declared at deck level on `SlidePlayer.transition` or overridden per slide via `<Slide transition="none">`. Additional transition types (`'slide-left'`, `'slide-right'`, `'zoom-in'`, `'zoom-out'`) are deferred to v1.1.

### 4.5 Input and Navigation

`SlidePlayer` pre-wires all standard presentation navigation. No `<InputController>` DSL is required.

**Keyboard** (window-scoped by default):

| Key(s) | Action |
|---|---|
| `ArrowRight`, `ArrowDown`, `Space`, `Enter`, `PageDown` | Next slide |
| `ArrowLeft`, `ArrowUp`, `PageUp` | Previous slide |
| `Home` | First slide |
| `End` | Last slide |
| `f` / `F` | Toggle fullscreen |

**Pointer**: Click → next slide. Right-click → previous slide. Implemented as a transparent overlay div (`z-index: 1`) above the canvas.

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

Note: `scope: 'canvas'` is declared but falls back to `'window'` in v1.0. Full canvas-scoped keyboard handling is a v1.1 enhancement.

Navigation is implemented at the React layer inside `SlidePlayerInner` (not via `<InputController>` DSL), because slide navigation is a pure React concern — it calls `engine.scrollToProgress()`, not a Three.js camera action.

### 4.6 Progress Indicator

`SlideProgressIndicator` renders as an absolute-positioned overlay above the canvas.

| Style | Description |
|---|---|
| `'dots'` | One clickable dot per slide (default) |
| `'bar'` | Thin progress bar at top |
| `'numbers'` | "N / total" text counter |
| `'none'` | No indicator |

Configured via `SlidePlayer.progressIndicator`.

### 4.7 Speaker Notes

Notes are authored as a prop on `<Slide notes="...">`. They are stored in the VariableStore by `SlideMetaWidget` under the key `slide-meta:{slideKey}.notes`. The `useSlideNotes` hook reads and returns the active slide's notes.

```typescript
// Read speaker notes for a specific slide
const notes = useSlideNotes('my-slide-key'); // string | undefined
```

Notes are surfaced in the v1.1 `<PresenterView>` component. In v1.0, they are accessible via `useSlideNotes` for custom presenter integrations.

### 4.8 Fullscreen

`SlidePlayer` manages fullscreen via the Fullscreen API (`element.requestFullscreen()` / `document.exitFullscreen()`). The `F` key toggles fullscreen when keyboard navigation is enabled. The `fullscreen` prop allows controlled fullscreen state; `defaultFullscreen` is the uncontrolled default.

When fullscreen is active, the container style switches to `position: fixed; inset: 0; z-index: 9999`.

### 4.9 DeckTheme System

`DeckTheme` is the authoring type for deck-level visual configuration. It is a superset of `@brewsite/core`'s `SceneTheme`.

```typescript
type DeckTheme = {
  fonts: { heading: string; body?: string; mono?: string };
  colorMode: 'dark' | 'light';
  accentColor?: string;
  background: { color: string; gradient?: string };
  colors: { heading: string; body: string; surface: string; muted: string };
  spacing: { slide: string; stack: string };
  border?: { radius: string };
};
```

`compileDeckTheme(theme?: Partial<DeckTheme>)` (in `compiler/themeCompiler.ts`) merges the provided partial with `defaultDeckTheme` and derives:
1. A `SceneTheme` for injection into `EngineProvider.sceneTheme` (maps `fonts.heading` → `SceneTheme.font.htmlFamily`, `colorMode`, `accentColor`).
2. A `cssVars` map of `--slide-*` CSS custom properties injected into `EngineOverlayHost` by `SlideMetaWidget`.

The `--slide-*` prefix avoids collisions with `--brewsite-*` variables owned by the core engine.

Two built-in themes are exported: `defaultDeckTheme` (light mode) and `darkDeckTheme` (dark mode). `createDeckTheme(partial)` merges with `defaultDeckTheme`.

### 4.10 Print / PDF: `captureSlideSnapshots()`

`SlidePlayer` accepts a `ref` prop and exposes a `SlidePlayerHandle` imperative API:

```typescript
interface SlidePlayerHandle {
  goTo(index: number): void;
  next(): void;
  prev(): void;
  captureSlideSnapshots(): Promise<Map<string, string>>;
}
```

`captureSlideSnapshots()` sequentially seeks to each slide, waits two animation frames for Three.js to render, captures the WebGL canvas as a PNG data URL, then restores the original slide. Returns `Map<slideKey, dataURL>`.

```typescript
const ref = useRef<SlidePlayerHandle>(null);
// ...
<SlidePlayer ref={ref}>{/* slides */}</SlidePlayer>

// Before printing:
const snapshots = await ref.current.captureSlideSnapshots();
// Use snapshots in a print layout, then window.print()
```

The `SlidePrintLayout` React component (v1.1) will consume `captureSlideSnapshots()` to render a CSS `@page` print view. In v1.0, authors build their own print layouts using this API.

### 4.11 3D Content Embedding

Slides can embed 3D content from `@brewsite/diagram`, `@brewsite/model`, and `@brewsite/charts` by placing their DSL elements directly inside `<Slide>` children alongside the layout components. This is the v1.0 escape hatch for mixed 3D+text slides.

For example, a half-text/half-diagram split:

```tsx
<Slide key="architecture">
  <SlideContent>
    <TextBox x={0} y={0} w={0.48} h={1}>
      <TitleLayout title="Architecture" />
    </TextBox>
    <DiagramCanvas x={0.52} y={0} w={0.48} h={1}>
      {/* diagram DSL */}
    </DiagramCanvas>
  </SlideContent>
</Slide>
```

The consuming app must add the appropriate plugin to `SlidePlayer.plugins`:

```tsx
<SlidePlayer plugins={[diagramPlugin()]}>
```

A dedicated `<MediaLayout>` component with first-class NVS partitioning for 3D sub-regions is deferred to v1.1.

---

## 5. Composition Architecture

`@brewsite/slides` layers entirely on top of `@brewsite/core`. It adds no new engine capabilities and patches no core internals beyond the one non-breaking `sceneProgress` field addition to `SceneTrackTick`.

### 5.1 Engine Stack

`SlidePlayer` owns and assembles the full engine stack internally:

```
SlidePlayer
└── EngineProvider (inputModePolicy="prefer-direct", pixelsPerScene=600)
    ├── <Scene> elements (compiled from <Slide> children)
    ├── EngineARContainer (aspectRatio=16/9 by default)
    │   └── EngineInputRegion
    │       ├── SceneCanvas (ref forwarded for captureSlideSnapshots)
    │       ├── EngineOverlayHost (overlayTransition per deck transition setting)
    │       └── SlidePlayerInner (hooks: navigation, imperative handle)
```

### 5.2 Plugin System

`SlidePlayer` uses the `WidgetPlugin` pattern:

```typescript
const plugins = [
  corePlugin({ onSceneChange: ... }),
  slidesPlugin({ theme: resolvedTheme, navigation }),
  ...userPlugins,
];
```

`slidesPlugin()` registers `SlideMetaWidget` and `SlideNavWidget`. No `widgetRegistry` prop is exposed — users extend via the `plugins` prop.

`SlideMetaWidget` publishes per-slide metadata to `VariableStore` on each tick using the `SLIDE_META_NAMESPACE` key prefix. It also writes `sceneProgress` (from `SceneTrackTick.sceneProgress`) to the store to drive animated bullet reveals.

### 5.3 Compile Path

For each `<Slide>`, the deck compiler (`compiler/deckCompiler.ts`) produces:
1. A `SlideSpec` with layout regions (NVS coordinates), transition setting, `scrollUnits`, speaker notes, and bullet animation metadata.
2. A `<Scene>` element (from `@brewsite/core`) with the appropriate `<TextBox>` children, a `<ProgressManager scrollUnits={...} />`, and a `<SlideMetaDsl>` marker node for `SlideMetaWidget`.

The compiled `Scene` elements are rendered as children of `EngineProvider`, which passes them to the core compiler pipeline. No new compiler node types are introduced at the slides layer — `<Slide>` is a compile-time transformation, not a new widget.

### 5.4 sceneProgress Field

The single non-trivial change to `@brewsite/core` made for this package is the addition of `sceneProgress?: number` to `SceneTrackTick` (in `packages/core/src/compiler/sceneTrackTypes.ts`). This field provides a normalized [0, 1] within-scene progress coordinate with correct terminal-tick semantics (= 1, not 0), enabling `SlideMetaWidget` to compute `visibleBullets` without inflating scene count. The field is optional and defaults to `blockProgress` when absent, making the change fully non-breaking for existing consumers.

### 5.5 Manifest Handling

`EngineProvider` requires a `manifestUrl` prop. When the deck contains no GLTF assets, `SlidePlayer` passes an internal `EMPTY_MANIFEST_URL` data URL (`data:application/json,...{models:[],animations:[]}`) to avoid a runtime fetch failure on an empty string.

---

## 6. v1.0 vs v1.1 Scope Boundary

### v1.0 (current release)

- `SlidePlayer` component + full plugin stack
- `<Slide>` → `<Scene>` compile-time transformation
- All 5 layout variants + `<SlideContent>` escape hatch
- Text primitives: `<Heading>`, `<Body>`, `<BulletList>`, `<NumberedList>`
- Animated entrance via `sceneProgress`
- Transitions: `'dissolve'` and `'none'`
- Input: keyboard (window-scoped), pointer (click/right-click), touch swipe
- Progress indicator: dots, bar, numbers, none
- DeckTheme: CSS variables + SceneTheme integration
- Speaker notes: authored on `<Slide>`, accessible via `useSlideNotes`
- Fullscreen: `requestFullscreen` API, `F` key toggle
- Imperative handle: `captureSlideSnapshots()`, `goTo()`, `next()`, `prev()`
- `useSlideNavigation`, `useSlideNotes`, `computeSlideStartProgress`
- 3D content embedding via `<SlideContent>` escape hatch with raw DSL

### v1.1 (partially implemented)

**Implemented but NOT exported from the package barrel:**
- `PresenterView` (`player/PresenterView.tsx`) — same-tab collapsible sidebar. Reads engine state via `useSceneEngineState(id)`. Multi-window presenter view is not in scope. Implemented as an internal component; not yet part of the public API.
- `SlidePrintLayout` (`player/SlidePrintLayout.tsx`) — CSS `@page` print component consuming `captureSlideSnapshots()`. Implemented as an internal component; not yet part of the public API.

**Internal player components (not exported):**
- `SlideTransitionWrapper` (`player/SlideTransitionWrapper.tsx`) — manages slide transition animations.
- `SlideProgressIndicator` (`player/SlideProgressIndicator.tsx`) — renders the configurable progress indicator overlay.

**Remaining v1.1 scope (not yet implemented):**
- `<MediaLayout>` — first-class NVS partitioning for text + 3D sub-regions. Requires stable dual-constraint NVS solution.
- `<SlideOverview>` — thumbnail grid panel.
- Additional text primitives: `<Code>`, `<Callout>`, `<Caption>`.
- Additional slide transitions: `'slide-left'`, `'slide-right'`, `'zoom-in'`, `'zoom-out'`.
- `scope: 'canvas'` for keyboard navigation (full implementation; v1.0 falls back to window).
- `autoAdvance` prop on `<Slide>` for timer-driven auto-advance.
- Model and chart first-class NVS sub-region support (requires changes in `@brewsite/model` and `@brewsite/charts`).

### Not in Scope (any version)

- Multi-window presenter view (second browser window, `window.open` + `BroadcastChannel`)
- Server-side / headless PDF generation (Puppeteer, Playwright)
- Slide comments, annotation, or collaborative features
- Slide export to PPTX or standard format
- Video export / recording

---

## 7. Version History

### v0.1.0 — 2026-03-05

Initial release. Implements the full v1.0 scope as described in this PRD. Companion core change: `sceneProgress?: number` added to `SceneTrackTick` in `@brewsite/core`.

---

## 8. Known Limitations

The following limitations are known at v0.1.0. They are documented here to set correct expectations and to guide v1.1 priorities.

**L1 — No `<MediaLayout>`.**
Side-by-side text + 3D layouts require the `<SlideContent>` escape hatch with raw `<TextBox>` + `<DiagramCanvas>` DSL. The `<MediaLayout>` component will provide a first-class API in v1.1.

**L2 — Two slide transitions only.**
Only `'dissolve'` and `'none'` are supported. Directional and zoom transitions are v1.1.

**L3 — Keyboard scope falls back to window.**
`SlideNavigationConfig.scope: 'canvas'` is declared but not fully implemented. All keyboard events are attached to `window` in v1.0. Full canvas-scoped keyboard handling requires forwarding a `containerRef` into `SlidePlayerInner` and is deferred to v1.1.

**L4 — `PresenterView` implemented but not exported.**
`PresenterView` is implemented in `player/PresenterView.tsx` but is not yet exported from the package barrel. Authors can use `useSlideNotes(slideKey)` and `useSlideNavigation` to build custom presenter interfaces. `PresenterView` will be promoted to the public API in a future release.

**L5 — `SlidePrintLayout` implemented but not exported.**
`SlidePrintLayout` is implemented in `player/SlidePrintLayout.tsx` but is not yet exported from the package barrel. `captureSlideSnapshots()` is available for custom print flows. `SlidePrintLayout` will be promoted to the public API in a future release. No server-side/headless PDF path is planned.

**L6 — Empty manifest workaround.**
`EngineProvider.manifestUrl` is required. When no GLTF assets are used, `SlidePlayer` passes a data-URL sentinel (`EMPTY_MANIFEST_URL`). This is an internal detail but reflects a DX gap in `@brewsite/core` (manifestUrl should be optional when no assets are needed). Flagged for core team review.

**L7 — `sceneProgress` optional in SceneTrack.**
`SceneTrackTick.sceneProgress` is `?: number` (optional). Tracks compiled before this field was added will have `undefined` here. `SlideMetaWidget` defaults to `blockProgress` when the field is absent, but animated bullet lists in such tracks will not animate correctly. This is a non-issue for freshly compiled tracks and is a forward-compat guard only.

**L8 — `autoAdvance` not supported on `<Slide>`.**
`ProgressManagerSpec.autoAdvance` exists in `@brewsite/core` but `<Slide>` does not expose it in v1.0. Deferred to v1.1.

---

## 9. Reference

- Architecture plan: `requirements/slides/plans/plan_slides-package.md`
- Feature note: `requirements/slides/notes/note_slides-package.md`
- Core compiler PRD: `requirements/core/prd/prd_compiler.md`
- Core player/runtime PRD: `requirements/core/prd/prd_player_runtime.md`
- Core widget SDK PRD: `requirements/core/prd/prd_widget_sdk.md`
- Demo app: `apps/examples/src/slides-demo/`

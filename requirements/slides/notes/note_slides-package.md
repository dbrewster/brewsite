---
title: "Feature Note: @brewsite/slides Package"
doc_type: note
owner: brewsite-product-manager
status: draft
updated: 2026-03-23
change_history:
  - date: 2026-03-04
    author: brewsite-product-manager (PM-1)
    summary: "Initial note created. Defined full feature set, composition strategy, 7 design decisions, 5 open questions, and constraints based on deep codebase research."
  - date: 2026-03-05
    author: brewsite-product-manager (PM-1, incorporating PM-2 review)
    summary: "Major revision after PM-2 code review. Adopted FunctionalTransitionSpec as definitive bullet animation approach (Q3 resolved). Corrected EngineOverlayHost mechanics — text routes through TextBox widget infrastructure, not a new registration surface. Added explicit empty-manifest handling for SlidePlayer. Resolved MediaLayout NVS partitioning to use DiagramCanvas wrapper for v1, with model/chart deferred to v1.1. Corrected PresenterView to same-tab only; moved multi-window to Not in Scope. Aligned DeckTheme with existing SceneTheme to avoid parallel CSS variable systems. Added explicit v1.0 vs v1.1 scope tiers. Updated Not in Scope list. Removed multi-scene expansion sketch from appendix. Added §3.13 Print/PDF Export, SlidePlayerHandle API (v1.0), SlidePrintLayout (v1.1), and server-side headless PDF to Not in Scope. Added three print-specific open questions to §7. Corrected bullet animation analysis: FunctionalTransitionSpec is runtime-evaluated and bound to inter-scene transition blocks — it cannot model within-scene bullet reveals. WidgetRenderContext has no sceneProgress field. Revised Q3 to the correct two options (Option A: multi-scene with logical index layer; Option C: minor core change adding sceneProgress to SceneTrackTick). Softened Decision 1 scene-count invariant. Revised Decision 6 to remove incorrect FunctionalTransitionSpec claim."
---

# Feature Note: @brewsite/slides Package

## 1. Problem Statement

BrewSite today is an excellent engine for marketing scenes and interactive 3D narratives. Its authoring model — pure JSX snapshots, automatic transitions, scroll-driven or keyboard-navigated progression — is powerful but deliberately low-level. Every scene author must wire together `SceneEngine`, `ScrollStage`, `SceneCanvas`, `EngineOverlayHost`, a plugin array, a camera element, lighting, background, `InputController`, and `ProgressManager` just to show the first slide. There is no opinionated authoring surface for the most common narrative artifact in the developer-facing world: a slide deck.

The concrete pains this causes today:

**1. No presentation-oriented authoring mental model.** Scene authors working in BrewSite think in scenes, cameras, and timelines — not in slides, bullet points, and layouts. Converting this mental model into BrewSite primitives requires deep platform knowledge. A developer producing a three-slide deck for a demo currently writes the same boilerplate as one producing a 40-scene cinematic.

**2. No built-in slide layout system.** Every project re-invents title cards, bullet lists, image+text splits, and two-column layouts using raw `<TextBox>` DSL and manual CSS/positioning. These layouts are not shareable, not themeable, and not tested.

**3. Navigation conventions are not pre-wired.** There is no `next slide` on spacebar or click, no `last slide` on End, no concept of escape-to-overview. Every project manually configures `<InputController>` with `<Action type="scene.next">` + `<KeyMap>` blocks — a 15-line DSL ritual for what every presentation tool gives for free.

**4. No presenter experience.** BrewSite has no speaker notes, no presenter timer, no slide overview panel, and no presenter view (current + next + notes on presenter display). These are table-stakes features for professional slide decks.

**5. No deck-level theming.** Fonts, brand colors, and spacing must be manually applied per-scene and per-element. There is no theme propagation mechanism.

**6. No first-class fullscreen mode.** Entering and exiting fullscreen requires app-level code, not a slide player feature.

A dedicated `@brewsite/slides` package solves all of these pains while remaining fully composable with the existing BrewSite primitive stack.

---

## 2. Proposed Solution

`@brewsite/slides` is a new BrewSite published package that provides an opinionated, batteries-included authoring surface for slide deck experiences. It exports:

- **`<SlidePlayer>`** — The top-level React component. Drop-in replacement for a custom `SceneEngine` + layout stack. Handles fullscreen, keyboard navigation, and progress display. Accepts an optional `id` prop for external state access.
- **`<Slide>`** — The primary authoring unit. Compiles to a `<Scene>` with sensible defaults (camera, lighting, background, navigation, progress weighting).
- **Built-in layout components** — `<TitleLayout>`, `<TitleBodyLayout>`, `<TwoColumnLayout>`, `<FullBleedLayout>`, `<BlankLayout>` — each rendering their content as React content registered through the existing `TextBox` widget infrastructure.
- **Text content primitives** — `<Heading>`, `<Body>`, `<BulletList>`, `<NumberedList>` — typed, styleable, animation-aware React components rendered as TextBox children.
- **Speaker notes** — Authored as props on `<Slide>`, stored in VariableStore, surfaced in presenter view.
- **`slidesPlugin()`** — Plugin factory that registers all slides widgets into a `WidgetRegistry`.
- **`defaultDeckTheme`** and the `DeckTheme` type — Superset of core's `SceneTheme`, maps to `SceneTheme` for injection into `SceneEngine`.

**Authoring mental model:**

```tsx
// A complete slide deck — no SceneEngine plumbing required
import { SlidePlayer, Slide, TitleLayout, TitleBodyLayout, BulletList } from '@brewsite/slides';

export default function TechDeckPage() {
  return (
    <SlidePlayer theme={brandTheme}>
      <Slide key="title">
        <TitleLayout title="BrewSite Architecture" subtitle="How it works" />
      </Slide>

      <Slide key="principles">
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

Under the hood, `<SlidePlayer>` transforms each `<Slide>` into a `<Scene>`, registers slide-specific widgets via the plugin system, configures default navigation, and mounts the full SceneEngine + canvas + overlay stack.

### 2.1 MVP Scope (v1.0 vs v1.1)

**v1.0 — ships together:**
- `SlidePlayer` component + `slidesPlugin()` + types scaffold
- `<Slide>` → `<Scene>` compile-time transformation with default Camera, Lighting, Background
- `<TitleLayout>`, `<TitleBodyLayout>`, `<TwoColumnLayout>`, `<FullBleedLayout>`, `<BlankLayout>`
- Text primitives: `<Heading>`, `<Body>`, `<BulletList>` (with FunctionalTransitionSpec animation), `<NumberedList>`
- Pre-wired navigation (keyboard + pointer, PowerPoint conventions)
- Progress indicator (dots, bar, numbers)
- DeckTheme (CSS variables, mapped to existing SceneTheme)
- Speaker notes (authored on `<Slide>`, stored in VariableStore)
- Fullscreen mode

**v1.1 — defined but deferred:**
- `<MediaLayout>` (requires NVS dual-constraint solution to be stable across deck layouts)
- `<PresenterView>` (same-tab sidebar; reads engine state via `useSceneEngineState` + `getSceneRuntimeState`)
- `<SlideOverview>` (thumbnail grid panel)
- `<SlidePrintLayout>` (print/PDF export component; see §3.13)
- `<Code>`, `<Callout>`, `<Caption>` text primitives
- `autoAdvance` prop on `<Slide>`
- Slide transition types beyond `'dissolve'` and `'none'`
- Model and chart NVS sub-region support (requires changes in `@brewsite/model` and `@brewsite/charts`)

---

## 3. Feature Set

### 3.1 Slide Deck Authoring DSL

**`<SlidePlayer>`** — Root component. Props:
- `plugins?: WidgetPlugin[]` — Additional plugins (e.g., `diagramPlugin()`, `modelPlugin()`)
- `theme?: DeckTheme` — Typography, colors, spacing; defaults to `defaultDeckTheme`
- `manifestUrl?: string` — Optional. Asset manifest for GLTF model/animation assets. When omitted, `SlidePlayer` passes an empty manifest to `SceneEngine` via `modelPlugin()`. Only required when the deck uses `@brewsite/model` elements. Manifest loading is now handled by plugins.
- `id?: string` — Optional stable engine ID. Required if `<PresenterView>` (v1.1) reads state from this deck via `useSceneEngineState(id)`.
- `fullscreen?: boolean` — Force fullscreen mode
- `aspectRatio?: number` — Canvas aspect ratio (default: 16/9)
- `scaleMode?: ScaleMode` — `'fit-width' | 'fit-height' | 'fit-both' | 'fill'`
- `progressIndicator?: 'dots' | 'numbers' | 'bar' | 'none'` — Default: `'dots'`
- `ref?: React.Ref<SlidePlayerHandle>` — Optional imperative handle for snapshot capture (v1.0, used by print path)
- `children` — `<Slide>` elements

**`SlidePlayerHandle`** — Ref interface exposed by `SlidePlayer` via `React.forwardRef`. Enables capture of WebGL canvas snapshots before printing:
```typescript
interface SlidePlayerHandle {
  /**
   * Navigates to each slide, captures the WebGL canvas as a PNG dataURL,
   * and returns the full map. Caller must await before invoking window.print().
   * Restores the active slide after capture.
   */
  captureSlideSnapshots(): Promise<Map<string, string>>; // slideKey → dataURL
}
```
This API is v1.0 because v1.0 must not foreclose the v1.1 `<SlidePrintLayout>` feature. An `id` prop on `SlidePlayer` is already required for external engine access; `SlidePlayerHandle` provides the imperative snapshot path for the print workflow.

**`<Slide>`** — Primary scene wrapper. Props:
- `key` (required) — Stable unique identifier; becomes Scene `key` and `id`
- `notes?: string` — Speaker notes (plain text or Markdown). Stored in VariableStore via `SlideMetaWidget`. Surfaced in `<PresenterView>` (v1.1).
- `title?: string` — Slide title for accessibility and overview thumbnail (v1.1)
- `scrollUnits?: number` — Override ProgressManager budget (default: 400 for most layouts, 100 for title-only)
- `background?: SlideBackground` — Override deck-level background
- `transition?: 'dissolve' | 'none'` — Override transition style (v1.0 supports dissolve and none only; additional transitions deferred to v1.1)
- `children` — One layout component

**`<SlideContent>`** — Escape hatch for fully custom slide content via raw `<TextBox>` DSL.

### 3.2 Built-in Slide Layouts (v1.0)

Each layout compiles to one or more `<TextBox>` DSL elements positioned in the slide's normalized viewport space (NVS). The layout React components (`<Heading>`, `<BulletList>`, etc.) are rendered as `children` of these TextBox elements — the existing `TextBoxChildrenContext` and `EngineOverlayHost` mechanism delivers them to screen. No new overlay registration surface is introduced.

**`<TitleLayout>`** — Large centered title + optional subtitle. Props:
- `title: string`
- `subtitle?: string`
- `alignment?: 'center' | 'left'`

Compiles to: one full-viewport `<TextBox>` with centered flex content.

**`<TitleBodyLayout>`** — Title bar at top, content region below. Props:
- `title: string`
- `children` — Content primitives (`<BulletList>`, `<Body>`, etc.)

Compiles to: one `<TextBox>` spanning top 20% for the title, one `<TextBox>` spanning the remaining 80% for content.

**`<TwoColumnLayout>`** — Equal-width two-column layout. Props:
- `title?: string`
- `left: React.ReactNode` — Left column content
- `right: React.ReactNode` — Right column content

Compiles to: one optional title `<TextBox>`, one left `<TextBox>` [0, 0.2, 0.48, 0.8], one right `<TextBox>` [0.52, 0.2, 0.48, 0.8].

**`<FullBleedLayout>`** — Full-slide layout with optional text overlay in a corner or center. Props:
- `children` — Text overlay content
- `overlayPosition?: 'top-left' | 'bottom-left' | 'top-right' | 'bottom-right' | 'center'`

Compiles to: one `<TextBox>` sized to a region determined by `overlayPosition`. The Three.js canvas is visible behind the overlay.

**`<BlankLayout>`** — No predefined structure. Authors compose `<TextBox>` elements manually via `<SlideContent>`.

**`<MediaLayout>` — deferred to v1.1.** See §2.1.

### 3.3 Text Content Primitives (v1.0)

Text primitives are React components rendered as children of TextBox DSL elements. They observe the deck `DeckTheme` via CSS custom properties injected by `EngineOverlayHost`. They are NOT new DSL nodes — they are React components used in JSX passed as `children` to layout components.

**`<Heading>`** — Section or sub-section heading. Props:
- `level?: 1 | 2 | 3` (default: 2)
- `children: string`

Renders as `<h1>`/`<h2>`/`<h3>` consuming `--brewsite-font-size-heading` and deck theme font variables.

**`<Body>`** — Paragraph text. Props:
- `children: string | React.ReactNode`

**`<BulletList>`** — Animated bullet list. Props:
- `items: string[]`
- `animateEntrance?: boolean` — Items reveal one-by-one as `sceneProgress` advances (default: `false`)
- `bulletStyle?: 'disc' | 'arrow' | 'checkmark' | 'none'`

When `animateEntrance` is true, `SlidePlayer` transforms the single `<Slide>` into N+1 micro-scenes (one per cumulative reveal state). Each micro-scene has a `visibleBullets` prop that increments. `SlideMetaWidget` maps all micro-scenes to the same logical slide number in VariableStore so the progress indicator shows the correct slide count. The React component renders only the first `visibleBullets` items. See Decision 6 and Q3 for the full implementation analysis, including an alternative approach (Option C) that avoids scene inflation via a minor `@brewsite/core` change.

**`<NumberedList>`** — Numbered list. Same `animateEntrance` semantics as `<BulletList>`.

**`<Code>`, `<Callout>`, `<Caption>` — deferred to v1.1.** See §2.1.

### 3.4 Media Content (v1.0 diagram only; model/chart in v1.1)

In v1.0, `<MediaLayout>` is deferred. Authors who need a side-by-side 3D diagram layout must use the escape hatch: a `<Slide>` with a `<DiagramCanvas x={0.5} y={0} w={0.5} h={1}>` directly inside, plus a `<TextBox x={0} y={0} w={0.48} h={1}>` for the text side. The `DiagramCanvasDSL` already supports `x`, `y`, `w`, `h` NVS props.

When `<MediaLayout>` ships in v1.1, it will:
- Wrap diagram content in a `<DiagramCanvas>` with computed NVS bounds matching the media side (e.g., right half = `x={0.52} y={0} w={0.48} h={1}`)
- Compile the text side to `<TextBox>` NVS bounds matching the text side (e.g., left half = `x={0} y={0} w={0.48} h={1}`)
- The layout compiler must coordinate both NVS rects simultaneously so they are consistent and leave a gutter between them

Model (`@brewsite/model`) and chart (`@brewsite/charts`) NVS viewport partitioning requires changes in those packages (they have no `x/y/w/h` NVS props today). This is explicitly deferred to v1.1.

**Image content:** Authors can use an HTML `<img>` tag inside a `<TextBox>` region for raster images. This requires no `diagramPlugin()` and is sufficient for most use cases. `@brewsite/diagram`'s `ImagePanel` 3D element is not used in v1.0.

### 3.5 Speaker Notes

Authored as `notes` prop on `<Slide>`:
```tsx
<Slide key="principles" notes="Talk point: emphasize pre-baking removes runtime math">
  <TitleBodyLayout title="Core Principles">
    <BulletList items={['Pre-baked SceneTrack', 'O(1) sampling']} />
  </TitleBodyLayout>
</Slide>
```

Notes are stored in VariableStore by `SlideMetaWidget` (namespace `'slide:meta'`, key `'{slideKey}.notes'`). In v1.1, `<PresenterView>` reads notes via `getSceneRuntimeState(engineId).variables` — not via `useSceneEngineState`, which only exposes `sceneId/sceneIndex/sceneProgress/progress`. A `useSlideNotes(engineId, slideKey)` hook will wrap this access.

Notes support plain text. Markdown parsing is author-side (not provided by the package).

### 3.6 Slide Transitions (v1.0 subset)

v1.0 supports two transition types. Additional types ship in v1.1.

- **`'dissolve'`** (default) — Cross-fade of the overlay layer. The `EngineOverlayHost` already applies a CSS `animation: brewsite-overlay-enter` on key change (scene change). The dissolve transition hooks into this existing mechanism.
- **`'none'`** — Instant cut. Suppress the overlay enter animation.

Transitions operate exclusively on the HTML overlay layer (CSS opacity/transform). Three.js content between slides uses the standard compiled transition spec mechanism (e.g., Background color interpolation, Camera interpolation) — independent of the slide transition setting.

**v1.1 transitions:** `'slide-left'`, `'slide-right'`, `'slide-up'`, `'slide-down'`, `'zoom-in'`, `'zoom-out'`. These require CSS transform animations on the overlay `<div>`, which means coordinating exit and enter animations on `key` change. The `EngineOverlayHost` currently only has an enter animation (no exit). Either a core change or a wrapper component around `EngineOverlayHost` is needed.

### 3.7 Input Controls

`@brewsite/slides` pre-wires all PowerPoint/Google Slides navigation conventions. Authors do not need to author any `<InputController>` DSL blocks unless they want to override.

**Keyboard (window-scoped):**

| Key | Action |
|-----|--------|
| `ArrowRight` | Next slide |
| `ArrowDown` | Next slide |
| `ArrowLeft` | Previous slide |
| `ArrowUp` | Previous slide |
| `Space` | Next slide |
| `Enter` | Next slide |
| `Home` | First slide |
| `End` | Last slide |
| `Escape` | Close overview panel (v1.1) |
| `F` | Toggle fullscreen |
| `O` or `G` | Toggle overview panel (v1.1) |

**Pointer (canvas-scoped):**
- Click on slide canvas → next slide
- Right-click on slide canvas → previous slide
- Swipe left (touch) → next slide
- Swipe right (touch) → previous slide

**Wheel:** Disabled by default (prevents accidental scroll advancement on embedded decks). Opt-in via `<SlidePlayer wheelNavigation>`.

**Override:** Any default can be suppressed via `<SlidePlayer navigation={{ wheel: false, keyboard: false }}>`.

Implementation: `SlidePlayer` injects these as `<InputController scope="window">` DSL blocks into every `<Slide>` → `<Scene>` expansion. Author-provided `<InputController>` blocks in their `<Slide>` content take priority (lower-numbered priority wins in `ActionInputController`).

### 3.8 Progress Indicator

A slide progress indicator mounts automatically inside `SlidePlayer`. `<SlidePlayer progressIndicator="dots" | "numbers" | "bar" | "none">`.

**`'dots'`** (default) — Row of dots, current logical slide highlighted. Clicking a dot jumps to that slide. Uses `useCurrentScene` to determine active logical slide from engine state.

**`'numbers'`** — "Slide 3 of 12" text, positioned bottom-right.

**`'bar'`** — Thin progress bar at top or bottom edge.

**`'none'`** — No indicator.

The progress indicator uses `useCurrentScene()` to read the current scene. Because slides are scenes (one `<Slide>` = one `<Scene>`), `sceneIndex` and logical slide index are 1:1. If `<BulletList animateEntrance>` ever required multi-scene expansion, this relationship would break. The adoption of FunctionalTransitionSpec (see §5, Decision 6) preserves this 1:1 mapping.

### 3.9 Slide Overview Panel (v1.1)

Deferred. See §2.1.

### 3.10 Presenter View (v1.1)

Deferred. See §2.1.

**Architecture notes for v1.1 implementation:**

`<PresenterView>` mounts as a React component in the **same browser tab** (e.g., a sidebar `<div>` or a React portal). It reads engine state via two mechanisms:
1. `useSceneEngineState(engineId)` — Returns `SceneEngineSnapshot` with `sceneId`, `sceneIndex`, `sceneProgress`, `progress`. Requires `<SlidePlayer id="deck-id">`.
2. `getSceneRuntimeState(engineId).variables` — `VariableStoreReader` for reading speaker notes from `'slide:meta'` namespace. A `useSlideNotes(engineId, slideKey)` hook will abstract this.

Multi-window presenter mode (separate `window.open()`) is permanently out of scope. `ScenePlayerRegistry` uses module-level `Map` instances that are not shared across JavaScript module contexts (browser windows). Bridging across windows would require BroadcastChannel or SharedWorker infrastructure that is not in scope.

### 3.11 Fullscreen Mode

`<SlidePlayer>` handles fullscreen via the Fullscreen API:
- `fullscreen?: boolean` — Controlled fullscreen state
- `onFullscreenChange?: (isFullscreen: boolean) => void`
- `defaultFullscreen?: boolean` — Uncontrolled default

Keyboard toggle: `F`. The slide canvas and overlay host both scale into the fullscreen viewport via the standard `EngineARContainer` scale modes.

### 3.12 Deck-Level Theming

`DeckTheme` is a superset of `@brewsite/core`'s existing `SceneTheme`. `SlidePlayer` maps `DeckTheme` to `SceneTheme` and passes it as the `sceneTheme` prop on the internal `SceneEngine`. `EngineOverlayHost` injects the resulting CSS variables (`--brewsite-font-family`, `--brewsite-font-size-heading`, `--brewsite-color-mode`, `--brewsite-accent-color`, etc.) that all TextBox children consume.

`DeckTheme` extends `SceneTheme` with slide-specific concerns not covered by `SceneTheme` (spacing, background gradient, border-radius) which are injected as additional CSS custom properties by the `SlideLayoutWidget`.

```typescript
// SceneTheme (existing, from @brewsite/core):
type SceneTheme = {
  font: { htmlFamily: string; webglFontUrl?: string };
  fontSize: { heading: number; body: number; label: number; caption: number; annotation: number };
  colorMode: 'dark' | 'light';
  accentColor?: string;
};

// DeckTheme (new, from @brewsite/slides):
type DeckTheme = {
  // ── SceneTheme fields (mapped 1:1 to SceneEngine.sceneTheme) ──
  fonts: {
    heading: string;     // → SceneTheme.font.htmlFamily
    body?: string;       // fallback to heading
    mono?: string;       // fallback to system monospace
  };
  colorMode: 'dark' | 'light';  // → SceneTheme.colorMode
  accentColor?: string;         // → SceneTheme.accentColor

  // ── Slide-specific extensions (CSS custom properties via SlideLayoutWidget) ──
  background: {
    color: string;       // → <Background> DSL element + --slide-bg-color
    gradient?: string;   // CSS gradient string injected as --slide-bg-gradient
  };
  colors: {
    heading: string;     // --slide-color-heading
    body: string;        // --slide-color-body
    surface: string;     // --slide-color-surface  (card/callout bg)
    muted: string;       // --slide-color-muted    (caption, secondary)
  };
  spacing: {
    slide: string;       // --slide-padding         (default: '8%')
    stack: string;       // --slide-gap             (default: '1.5rem')
  };
  border?: {
    radius: string;      // --slide-border-radius   (default: '0.5rem')
  };
};
```

`DeckTheme` does **not** control Three.js element themes (`DiagramTheme`, `ChartTheme`). Those remain governed by their respective theme systems. Authors building branded decks with matching diagram visuals must set `DiagramTheme` properties manually. A unified `SlideTheme` type bridging CSS and Three.js themes is explicitly deferred — it would couple `@brewsite/slides` to `@brewsite/diagram`/`@brewsite/charts` at the type level, which is inappropriate for v1.0.

**Built-in themes:**
- `defaultDeckTheme` — Clean light theme (white background, dark text, brand blue accent)
- `darkDeckTheme` — Dark background, light text
- `createDeckTheme(overrides: Partial<DeckTheme>)` — Merges partial overrides with a base theme

### 3.13 Print / PDF Export (v1.0 hook; v1.1 full feature)

Slide decks must support print-to-PDF. The primary delivery path is in-browser (`window.print()` with `@media print` CSS). Server-side headless rendering (Puppeteer, Playwright) is permanently out of scope.

**The core problem:** Three.js renders to a `<canvas>` element. Canvas elements print as blank in most browsers. All 3D content (DiagramCanvas, future Model/Chart media) needs a print fallback.

**v1.0 obligation:** `SlidePlayer` exposes `SlidePlayerHandle.captureSlideSnapshots()` (see §3.1) so that the v1.1 print component can request canvas snapshots imperatively. The `id` prop on `SlidePlayer` (already specified) satisfies the external engine access requirement. No other print-specific code ships in v1.0.

**v1.1 full feature — `<SlidePrintLayout>`:** A standalone React component that accepts the same `<Slide>` children as `SlidePlayer` and renders them as a flat, paginated print document. It does not need a live engine — it reads `<Slide>` props statically and renders HTML.

```tsx
// v1.1 usage
const playerRef = useRef<SlidePlayerHandle>(null);

const handlePrint = async () => {
  const snapshots = await playerRef.current!.captureSlideSnapshots();
  // Mount SlidePrintLayout in a hidden container, then call window.print()
  renderPrintLayout(snapshots);
  window.print();
};

<SlidePlayer ref={playerRef} id="deck">
  {slides}
</SlidePlayer>

// Rendered in a hidden @media print container:
<SlidePrintLayout snapshots={snapshots} printNotes pageSize="16x9">
  {slides}
</SlidePrintLayout>
```

**`<SlidePrintLayout>` props:**
- `children` — Same `<Slide>` children as `SlidePlayer`; consumed statically (no engine needed)
- `snapshots?: Map<string, string>` — WebGL canvas captures keyed by `slideKey`. When provided, each slide's 3D canvas region is replaced with the snapshot `<img>`. When absent, 3D regions are hidden (overlay-only fallback).
- `printNotes?: boolean` — When true, renders speaker notes below each slide on the same page (PowerPoint "Notes Pages" layout). Default: `false`.
- `pageSize?: 'letter' | 'a4' | '16x9'` — Sets `@page { size: ... }`. Default: `'16x9'` (16in × 9in landscape).

**Print layout semantics:**

The print layout is architecturally distinct from the interactive `SlidePlayer` layout:
- All slides are visible simultaneously (one full page per slide)
- Each slide is a block-level element with `break-after: page`
- Text content is regular HTML flow, not NVS-positioned absolutes
- `@media print` CSS restructures the layout; the interactive `SlidePlayer` DOM is hidden via `display: none`

Because NVS absolute positioning (`position: absolute; left: x%; top: y%`) does not translate to print flow, `<SlidePrintLayout>` renders layout content independently using standard CSS flexbox/grid — it does not reuse `EngineOverlayHost` or `TextBoxChildrenContext`. The text content props from each `<Slide>`'s layout component (title, items, etc.) are re-rendered in a print-friendly structure.

**Canvas snapshot capture strategy:** The preferred strategy is on-demand capture immediately before printing (triggered by `beforeprint` event listener or the author's explicit `captureSlideSnapshots()` call). Eager capture at deck-load is too expensive for large decks. Per-slide lazy capture on first visit is viable for decks where the author controls scroll flow. See Open Question Q4.

**`@media print` CSS restructuring as an alternative:** For text-only decks with no 3D media, a pure `@media print` stylesheet that hides `SceneCanvas`, expands the `EngineOverlayHost` to flow layout, and adds page breaks per `[data-slide-id]` may be sufficient without `<SlidePrintLayout>`. This lighter path is documented in the README as an opt-in for simple cases. `<SlidePrintLayout>` is the supported path for decks with 3D content.

---

## 4. Composition Strategy

### 4.1 Which `@brewsite/core` Primitives Are Reused Directly

**Reused directly (no wrapping):**
- `SceneEngine` — Created internally inside `SlidePlayer`; receives `sceneTheme` derived from `DeckTheme`
- `EngineARContainer` — Used as-is for aspect ratio management (16:9 default)
- `EngineInputRegion` — Used as-is for input capture
- `SceneCanvas` — Used as-is for Three.js rendering
- `EngineOverlayHost` — Used as-is; all slide text content is delivered via the existing TextBox widget infrastructure (see §4.1 note below)
- `Scene` — Each `<Slide>` compiles to a `<Scene>`
- `ProgressManager` — Each `<Slide>` emits a `<ProgressManager>` with slide-specific defaults
- `Background` — Deck theme's `background.color` mapped to `<Background>` DSL element
- `Camera` — Each slide gets a standard fixed orthographic camera at a consistent distance
- `Lighting` — Default ambient + directional rig (sufficient for overlay-only slides; 3D media slides may override)
- `InputController` + `Action` + `KeyMap` + `PointerMap` — Navigation defaults injected into every `<Slide>` → `<Scene>` expansion
- `TextBox` — The delivery mechanism for all slide text content in the overlay. Slide layout components compile to TextBox DSL elements; layout React components (`<Heading>`, `<BulletList>`, etc.) are `children: ReactNode` of those TextBoxes
- `TextBoxChildrenContext` — The bridge between compiled TextBox widget state and React rendering in `EngineOverlayHost`
- `IWidget`, `ISceneElement`, `IRenderable` — Slide widgets implement these interfaces
- `WidgetRegistry`, `registerNode` — Used by `slidesPlugin()` to register slide element types
- `VariableStore` — `SlideMetaWidget` publishes notes/title/slideIndex per slide
- `useSceneEngineState` — Used by `<PresenterView>` (v1.1) to read progress state from outside the SceneEngine tree
- `getSceneRuntimeState` — Used by `<PresenterView>` (v1.1) to read VariableStore (speaker notes) from outside the SceneEngine tree
- `useCurrentScene`, `useSceneProgress` — Used by the progress indicator
- `useEngineInput` — Used by overview panel (v1.1) to navigate to a specific slide

**Note on EngineOverlayHost:** The overlay host does not accept arbitrary React component trees as direct children. It has one rendering path: it reads TextBox widget IDs from the `TEXTBOX_NAMESPACE` in VariableStore, then renders each as a positioned `<div>` whose `children` are sourced from `TextBoxChildrenContext` (a `Map<string, ReactNode>` written by `TextBoxWidget.apply()`). The `ReactNode` stored in this map can be any React content — including `<Heading>`, `<BulletList>`, etc. The slide layout system uses this path: layout components compile to TextBox DSL elements, and the layout content lives in those TextBoxes' `children` props. No new overlay registration mechanism is introduced.

**Abstracted behind slides API:**
- `compileSceneTrack` — Triggered by `SceneEngine` internally
- `SceneTrack`, `SceneTrackTick` — Infrastructure detail
- `RuntimeDriverImpl` — Hidden inside `SceneEngine`

### 4.2 Does It Build Its Own Variant?

`<SlidePlayer>` is a composing component that assembles:

```
SlidePlayer
└── SceneEngine (id, slidesPlugin + user plugins, sceneTheme, empty manifest fallback)
    ├── Slide children → Scene DSL (compile-time transformation via React.Children.map)
    ├── EngineARContainer (16:9 default, fullscreen-aware)
    │   └── EngineInputRegion
    │       ├── SceneCanvas
    │       └── EngineOverlayHost
    │           └── Slide layout overlays (TextBox-delivered React content)
    ├── SlideProgressIndicator (reads useCurrentScene + logical slide count)
    └── FullscreenWrapper
```

`SlidePlayer` is the "opinionated wrapper" pattern. Advanced users who need full control use `SceneEngine` + `slidesPlugin()` + individual `<Slide>` elements directly.

### 4.3 Integration with `@brewsite/diagram`

In v1.0, diagram content integrates via the escape hatch pattern: authors place a `<DiagramCanvas x={...} y={...} w={...} h={...}>` directly inside their `<Slide>` alongside `<TextBox>` elements for text. No `<MediaLayout>` wrapper is available in v1.0.

In v1.1, `<MediaLayout>` wraps diagram content in a `<DiagramCanvas>` with computed NVS bounds, and compiles the text side to `<TextBox>` bounds — both computed from the same layout geometry so they are consistent.

Requires `diagramPlugin()` in `SlidePlayer.plugins`.

Integration with `@brewsite/model` and `@brewsite/charts` follows the same escape hatch pattern in v1.0. Structured `<MediaLayout>` support for model and chart elements requires NVS sub-region props to be added to those packages, which is v1.1 scope.

### 4.4 Package Dependency Structure

```
@brewsite/slides
├── (peer) @brewsite/core     ^x.x.x   # required
├── (peer) react              ^18 || ^19
├── (peer) three              ^0.x
├── (optional peer) @brewsite/diagram   ^x.x.x
├── (optional peer) @brewsite/model     ^x.x.x
└── (optional peer) @brewsite/charts    ^x.x.x
```

`@brewsite/core` is a required peer. Diagram, model, and charts are optional — only needed when their elements appear in the deck. This mirrors the pattern used by all four existing packages.

---

## 5. Key Design Decisions

### Decision 1: Slides Are Scenes (No New Runtime Concept)

**Decision:** Each `<Slide>` compiles directly to a `<Scene>`. There is no "slide runtime" or "slide engine". The existing `Scene` → `SceneTrack` → `RuntimeDriverImpl` pipeline handles everything.

**Rationale:** The BrewSite compiler pipeline already handles exactly what slides need: sequential state snapshots, interpolated transitions, ProgressManager for timing, and input-driven advancement. Introducing a parallel "slide engine" would duplicate runtime complexity, break widget compatibility, and make it impossible to mix raw BrewSite scene authoring with slide authoring.

**Implication:** `<Slide>` is a **compile-time macro** that expands into `<Scene>` + layout DSL. It does not produce any new runtime type or interface. `slidesPlugin()` registers slide-specific widgets (`SlideMetaWidget`, `SlideLayoutWidget`) — but progression, transitions, and navigation all use existing core infrastructure.

**On scene count and logical slide identity:** A simple slide deck (no animated bullets) has a strict 1:1 mapping between logical slides and scenes. When `<BulletList animateEntrance>` is used, scene count inflates — a 3-bullet slide produces 4 scenes. This is acceptable provided a logical index layer is implemented: `SlideMetaWidget` publishes a `slide:logicalIndex` mapping in VariableStore that maps each micro-scene back to its parent logical slide number. The progress indicator, `useCurrentScene`-based displays, and "advance to next slide" navigation must all use the logical index, not raw `sceneIndex`. See Decision 6 and Q3 for the full analysis.

### Decision 2: Text Content Routes Through Existing TextBox Widget Infrastructure

**Decision:** All slide text content — headings, bullet lists, body copy — is delivered through the existing `TextBox` DSL element and `TextBoxChildrenContext` mechanism. Slide layout components compile to `<TextBox>` DSL elements positioned in NVS space. The React components (`<Heading>`, `<BulletList>`, etc.) are rendered as `children: ReactNode` of those TextBoxes. No new overlay registration surface is introduced in `EngineOverlayHost`.

**Rationale:** `EngineOverlayHost` renders content through exactly one path: it reads TextBox widget IDs from VariableStore and renders each as a positioned `<div>` with `children` from `TextBoxChildrenContext`. This is the correct, tested, and stable mechanism for HTML overlay content. Creating a parallel registration path would add complexity to the overlay host (a core component) and risk destabilizing the existing TextBox rendering for all consumers.

**Implication:** The `SlideLayoutWidget` node handler must:
1. Emit `TextBoxState` entries for each layout region (position, opacity, NVS coordinates)
2. Register the layout React content as `children: ReactNode` in `TextBoxChildrenContext` (same mechanism `TextBoxWidget` uses)

Since `TextBoxState.children: React.ReactNode` is arbitrary React content (not stored in the SceneTrack — carried by reference per `types.ts` line 69), the full richness of React components (`<Heading>`, `<BulletList>` with hooks, etc.) is available inside each layout region.

**Tradeoff:** `SlideLayoutWidget` is responsible for producing correct TextBox states at compile time, including NVS coordinate math for each layout variant. This logic must be unit-tested as a pure compile function with real inputs.

### Decision 3: SlidePlayer Is the "Batteries Included" API; SceneEngine Is the Escape Hatch

**Decision:** `SlidePlayer` is an opaque wrapper that handles all engine plumbing. Advanced users use `SceneEngine` + `slidesPlugin()` + `<Slide>` DSL directly.

**Rationale:** The core BrewSite API has a high learning curve for developers who just want to show a deck. `SlidePlayer` makes the 80% case trivially easy while keeping the 20% case accessible via escape hatch.

**Implication:** `SlidePlayer` transforms `<Slide>` children into `<Scene>` elements via `React.Children.map()` in its render body, then passes the resulting `<Scene>` elements as children to `SceneEngine`. This is Option A from the original open questions — chosen because it keeps `<Slide>` as a pure data container and avoids the NodeHandler expansion complexity of Option B.

**Tradeoff:** `SlidePlayer.render()` must understand the full `<Slide>` prop surface to construct `<Scene>` JSX. This is acceptable — all props are typed, and the transform is a pure function of `<Slide>` props to `<Scene>` children. The transform must be tested in isolation.

### Decision 4: Navigation Defaults Match PowerPoint/Google Slides Exactly

**Decision:** `SlidePlayer` pre-wires navigation to match PowerPoint/Google Slides conventions verbatim: Arrow keys advance/retreat, Space/Enter advance, Home/End jump. No configuration needed for standard navigation.

**Rationale:** Slide deck consumers have deep muscle memory from PowerPoint and Google Slides. Matching the conventions exactly means the deck "just works" for anyone familiar with slide tools.

**Implication:** `SlidePlayer` injects `<InputController scope="window">` DSL blocks into every `<Slide>` → `<Scene>` expansion. The injected controller has lower priority than any user-provided `<InputController>` in their `<Slide>` content, so author customizations win.

**Tradeoff:** Window-scoped keyboard listeners could conflict with page content outside the deck. Authors embedding a `SlidePlayer` in a page with other interactive elements may use `<SlidePlayer navigation={{ scope: 'canvas' }}>`.

### Decision 5: Presenter View Is Same-Tab Only (v1.1)

**Decision:** `<PresenterView>` mounts as a React component in the same browser tab. Multi-window presenter mode is not supported in v1.x.

**Rationale:** `ScenePlayerRegistry` uses module-level `Map` instances (`engineSnapshots`, `states`, `listeners`). These maps are per-JavaScript-module-instance and are not shared across browser window boundaries. A `window.open()` call creates a new JS module context; the registry maps in the audience window are invisible to the presenter window. Supporting multi-window would require BroadcastChannel or SharedWorker infrastructure that is out of scope and would meaningfully increase package complexity.

`<PresenterView>` reads engine state via two distinct registry paths (both in the same module context):
- `useSceneEngineState(engineId)` — For `sceneId`, `sceneIndex`, `sceneProgress`, `progress`
- `getSceneRuntimeState(engineId).variables` — For speaker notes from VariableStore

A `useSlideNotes(engineId, slideKey)` hook will abstract the second path for consumers.

**Tradeoff:** Presenter view cannot span dual monitors without workarounds (e.g., window.open with manual BroadcastChannel outside the package). For v1.1 it works well as a sidebar panel or pinned browser tab.

### Decision 6: Bullet Entrance Animation Uses Multi-Scene Expansion With a Logical Index Layer

**Decision:** `<BulletList animateEntrance>` on a slide with N items compiles to N+1 micro-scenes (one for each cumulative bullet reveal state: 0 visible → 1 visible → … → N visible). A `SlideMetaWidget` VariableStore entry maps every micro-scene back to its logical slide number so that the progress indicator, presenter view, and "advance to next slide" navigation remain correct.

**Rationale:** `FunctionalTransitionSpec` closures are runtime-evaluated and operate exclusively on **transition blocks between adjacent scenes** (`blockProgress` ∈ [0,1] across the inter-scene transition block). They cannot model within-scene bullet reveals driven by `sceneProgress`. `WidgetRenderContext` does not expose `sceneProgress` — it has only `globalProgress` and `tick.blockProgress`. Multi-scene expansion is the only approach that requires zero new core infrastructure.

**Implication:**

A slide with `<BulletList items={['A', 'B', 'C']} animateEntrance>` produces four scenes:

```
slide-{key}-s0  → visibleBullets=0  (initial state, scrollUnits split evenly)
slide-{key}-s1  → visibleBullets=1
slide-{key}-s2  → visibleBullets=2
slide-{key}-s3  → visibleBullets=3
```

`SlideMetaWidget` publishes to VariableStore:
```
slide:logicalIndex[slide-{key}-s0] = 1   ← logical slide 1
slide:logicalIndex[slide-{key}-s1] = 1
slide:logicalIndex[slide-{key}-s2] = 1
slide:logicalIndex[slide-{key}-s3] = 1
slide:totalLogicalSlides             = 5  ← deck has 5 logical slides
```

The progress indicator reads `VariableStore['slide:logicalIndex'][currentSceneId]` and `slide:totalLogicalSlides` — never raw `sceneIndex`.

"Advance to next slide" requires a `scene.slide-next` action distinct from `scene.next`. `SlideNavWidget` implements this: on action, it reads `currentSceneId` from engine state, looks up its logical index in VariableStore, finds the first micro-scene of the next logical slide, and fires `engine.goToScene(nextSlideFirstSceneId)`. This widget ships as part of `slidesPlugin()`.

**Tradeoff:** Scene count inflates proportionally to the number of animated bullet items. A 20-slide deck with 4 animated bullets each produces 100 micro-scenes. The `SceneTrack` is still pre-baked and O(1) to sample — the inflation affects compile time and track size, not runtime performance. The logical index abstraction must be complete and consistent; if any consumer uses raw `sceneIndex` instead of the logical index, it will display wrong slide numbers.

### Decision 7: DeckTheme Is a Superset of SceneTheme; No Parallel CSS Variable System

**Decision:** `DeckTheme` maps its core fields to `@brewsite/core`'s existing `SceneTheme` type. `SlidePlayer` derives a `SceneTheme` from `DeckTheme` and passes it as `sceneTheme` to `SceneEngine`. Extended slide-specific CSS variables are injected by `SlideLayoutWidget` into the overlay container — they do not overlap with the `--brewsite-*` variables already defined by `SceneTheme`.

**Rationale:** `EngineOverlayHost` already injects `--brewsite-font-family`, `--brewsite-font-size-heading`, `--brewsite-color-mode`, and `--brewsite-accent-color` via the existing `SceneTheme` + `ThemeContext` mechanism. Creating a parallel set of font/color CSS variables would produce two competing definitions of the same property, causing unpredictable inheritance. `DeckTheme` must feed into the existing mechanism, not around it.

**Implication:** `DeckTheme.fonts.heading` maps to `SceneTheme.font.htmlFamily`. `DeckTheme.colorMode` maps to `SceneTheme.colorMode`. `DeckTheme.accentColor` maps to `SceneTheme.accentColor`. The slide-specific extensions (`--slide-padding`, `--slide-gap`, `--slide-color-surface`, etc.) use a `--slide-` prefix that does not collide with the `--brewsite-` prefix owned by core.

**Tradeoff:** Authors cannot yet set a single `DeckTheme` that governs both overlay CSS and Three.js element colors (diagram node fills, chart bar colors). A unified `SlideTheme` type bridging CSS and Three.js is deferred — it would couple `@brewsite/slides` to `@brewsite/diagram`/`@brewsite/charts` at the type level, which is inappropriate for v1.0.

---

## 6. What Is NOT in Scope

The following are explicitly out of scope for `@brewsite/slides` v1.x:

1. **Multi-window presenter mode.** `window.open()` + BroadcastChannel/SharedWorker cross-window communication is not supported. `ScenePlayerRegistry` maps are per-module-instance and not shareable across windows. Presenter view is same-tab only.

2. **Real-time collaborative editing.** No multi-user deck editing, comment threads, or suggestion modes.

3. **Export to PDF/PowerPoint/Google Slides.** No file format export. The package produces web experiences.

4. **Slide authoring UI (visual WYSIWYG editor).** Authoring is code-only (JSX DSL).

5. **Three.js text (flying 3D text, text particles).** All text is React HTML overlay via TextBox infrastructure. Three-dimensional text belongs in custom widgets.

6. **Non-linear slide navigation (branching decks).** Slides are a linear sequence. BrewSite has no branching scene model.

7. **Embedded video or audio content.** No `<video>` or `<audio>` slots. Authors who need video must implement custom widget overlays.

8. **Live data slides.** All data is authored statically in the DSL.

9. **Unified SlideTheme (CSS + Three.js).** DeckTheme controls CSS overlay styling only. Diagram/chart Three.js theming is managed by their own theme systems.

10. **Slide transitions affecting Three.js content.** CSS transitions operate on the overlay layer. Three.js content transitions use standard compiled transition specs.

11. **Animated diagrams inside slides.** Diagrams in media slots are static snapshots. Complex animated sequences require multiple slides.

12. **NVS sub-region support for `@brewsite/model` and `@brewsite/charts`.** These packages have no `x/y/w/h` NVS props today. This is deferred to v1.1 and requires changes in those packages.

13. **`@brewsite/diagram`'s `ImagePanel` as a 3D image element.** Images in slides use HTML `<img>` inside a TextBox overlay. No 3D image panel in v1.0.

14. **Accessibility compliance (WCAG 2.1 AA).** Overlay HTML will be semantically reasonable but full keyboard trap management and live region announcements are deferred to v1.1.

15. **Server-side headless PDF generation.** Puppeteer, Playwright, or any server-side rendering path is out of scope. Print support is in-browser `window.print()` only. Three.js WebGL rendering requires a browser GPU context; it cannot run headlessly without specialized tooling (Electron, headless Chrome with GPU flags) that is outside the package's responsibility.

---

## 7. Open Questions

**Q1: How should `SlidePlayer` resolve `React.Children.map()` transformation of `<Slide>` children?**

`SlidePlayer` uses `React.Children.map()` to transform `<Slide>` elements into `<Scene>` elements. The complication: `<Scene>` receives its children as the layout DSL (TextBox elements, Camera, Background, etc.), but the `<Slide>` layout component (`<TitleBodyLayout>`) is a React component, not a DSL node. `SlidePlayer` must extract the `<Slide>` props (key, scrollUnits, background, etc.) and construct the full `<Scene>` children imperatively.

The architect must specify the exact transformation:
- What `<Scene>` children does `SlidePlayer` inject for a `<TitleLayout>` slide? (Background, Camera, Lighting, TextBox nodes derived from layout props)
- How does `SlidePlayer` convert `<TitleBodyLayout title="X">` into one or more `<TextBox>` elements?
- Does `SlidePlayer` perform this transformation, or does it happen inside `SlideLayoutWidget`'s node handler?

The key constraint: the transform must produce valid `<Scene>` children (DSL nodes, not React components) that the BrewSite compiler can walk.

**Q2: How does `SlideLayoutWidget` register React content into `TextBoxChildrenContext`?**

`TextBoxChildrenContext` is a `Map<string, ReactNode>` written by `TextBoxWidget.apply()` during the render cycle. The `SlideLayoutWidget` needs to write its layout React content into the same map. Two options:

- *Option A:* `SlideLayoutWidget` implements the same `apply()` pattern as `TextBoxWidget`, writing its layout content (derived from compiled `SlideLayoutState`) into the shared `TextBoxChildrenContext` map. This requires `SlideLayoutWidget` to be aware of `TextBoxChildrenContext` and write into it during `apply()`.

- *Option B:* `SlideLayoutWidget` does not directly manage TextBox content. Instead, `SlidePlayer` transforms `<TitleBodyLayout>` into literal `<TextBox>` DSL nodes at the React children level (during the `React.Children.map()` step in Q1). The `SlideLayoutWidget` then only handles `SlideMetaWidget`-level concerns (speaker notes, slide index). TextBox instances are standard `TextBoxWidget` instances, not slide-specific.

Option B is architecturally simpler — it reuses `TextBoxWidget` as-is. Option A requires `SlideLayoutWidget` to replicate `TextBoxWidget`'s registration behavior. The architect must decide which is cleaner to implement and test.

**Q3: Multi-scene bullet expansion (Option A) vs. adding `sceneProgress` to core (Option C) — which path for v1.0?**

The note adopts Option A (multi-scene with logical index layer) as the design decision. The architect must confirm this is viable and specify the exact implementation.

**Option A (multi-scene, zero new core infrastructure):**
- `SlidePlayer.render()` transforms a `<Slide>` with an N-bullet animated list into N+1 `<Scene>` elements
- Each micro-scene has `visibleBullets={k}` prop on the `<SlideLayout>` node
- `SlideMetaWidget` writes logical index mappings to VariableStore for all micro-scenes
- `SlideNavWidget` implements a `scene.slide-next` / `scene.slide-prev` action that navigates by logical index
- Progress indicator reads from VariableStore logical index, not `sceneIndex`
- **Risk:** Any consumer that reads raw `sceneIndex` will show wrong results (100 scenes for a 20-slide deck). All slides-package consumers must use the VariableStore logical index abstraction.

**Option C (add `sceneProgress` to `SceneTrackTick`, one field to core):**
- Add `sceneProgress: number` to `SceneTrackTick` (computed during `compileSceneTrack`, derived from `SceneWindow` bounds: `(tick.progress - window.start) / (window.end - window.start)`)
- `WidgetRenderContext.tick?.sceneProgress` becomes available in `IRenderable.apply()`
- `SlideLayoutWidget.apply()` computes `visibleCount = Math.floor(context.tick.sceneProgress * totalBullets)` per-frame — no scene inflation, no logical index layer, no `SlideNavWidget`
- **Risk:** This is a minor (non-breaking) change to `@brewsite/core`'s `SceneTrackTick` type and the compiler's baking pass. The change is small in scope but requires a core PR and version bump in `@brewsite/core` before `@brewsite/slides` can ship.
- **Benefit:** Architecturally cleaner — slide deck scene count exactly matches logical slide count; no abstraction layer needed anywhere.

The architect must decide which option to implement. The note recommends Option C if the core team approves the `SceneTrackTick` addition; Option A if core changes are off the table for the slides v1.0 timeline.

**Q4: When should WebGL canvas snapshots be captured for print?**

Three strategies exist for timing `captureSlideSnapshots()`:

- *Eager (at deck load):* Capture all slides immediately after the engine is ready. Cost: must navigate to each slide programmatically, capture, then return to the starting slide. For a 20-slide deck this is ~20 engine transitions at startup — visible to the user and potentially slow. Not recommended as the default.
- *On-demand before print:* Capture triggered by `beforeprint` event or explicit author call to `playerRef.current.captureSlideSnapshots()`. Async — the author must await before calling `window.print()`. This is the preferred approach. The `SlidePlayerHandle` API supports this path.
- *Lazy per-slide:* Capture each slide's snapshot the first time the user visits it (or on exit). Accumulates snapshots in a Map as the user navigates. Works for linear presentations but misses slides the user skips. Not reliable as the sole approach.

The architect must specify the default behavior for `captureSlideSnapshots()` and whether `SlidePlayer` maintains an internal snapshot cache or delegates capture timing entirely to the author.

**Q5: Should `<SlidePrintLayout>` be part of `@brewsite/slides` or a separate `@brewsite/slides-print` package?**

Arguments for keeping it in `@brewsite/slides`:
- Avoids a second package version to maintain and publish
- `<SlidePrintLayout>` reads `<Slide>` children directly — tightly coupled to `@brewsite/slides` types
- Print is a core feature expectation, not an edge-case add-on

Arguments for a separate `@brewsite/slides-print` package:
- Print layout code has zero overlap with the Three.js + engine rendering path; it is pure React/HTML
- Consumers who never print should not pay the bundle size cost (though `<SlidePrintLayout>` is likely small)
- Follows the precedent of separating concerns across packages (diagram, model, charts are separate)

The architect must decide. The note's current position is that `<SlidePrintLayout>` belongs in `@brewsite/slides` unless the bundle impact is measurably significant (>5 KB gzipped).

**Q6: Is `@media print` CSS restructuring sufficient for text-only decks, or does every deck require `<SlidePrintLayout>`?**

`EngineOverlayHost` renders text as `position: absolute` elements inside an `inset: 0` container (NVS positioning). This layout collapses in print flow. Two approaches:

- *Require `<SlidePrintLayout>` for all decks:* Consistent, predictable, explicit. No "magic" CSS surprises.
- *Ship a minimal `@media print` stylesheet in `SlidePlayer`:* Hides `SceneCanvas`, resets `EngineOverlayHost` to `position: static; display: block`, adds `break-after: page` per slide. For text-only decks, this may produce acceptable output with zero extra code from the author.

The `@media print` approach fights the absolute positioning model and may produce inconsistent results across browsers. The architect should prototype both and determine if the CSS-only path produces reliable results for the text-only case. If yes, ship it as the baseline with `<SlidePrintLayout>` as the upgrade for 3D content.

---

## 8. Constraints

**Package dependency rule:** `@brewsite/slides` may import from `@brewsite/core`. It may import from `@brewsite/diagram`, `@brewsite/model`, and `@brewsite/charts` only for optional peer integration (type imports and conditional node handler registration). It must never cause `@brewsite/core` to import from `@brewsite/slides`.

**TypeScript strict mode:** All source files must pass with `strict: true`. No `any` casts except at known system boundaries (e.g., `React.Children` traversal).

**No new peer dependencies:** React, Three.js, and react-dom are already peers. The slides package must not introduce new peer dependencies. CSS animations for slide transitions must use standard CSS `transition` and `animation` properties only.

**pnpm workspace only:** No `npm` or `yarn` usage anywhere in the monorepo.

**Element module pattern mandatory:** All new element modules must follow the `types.ts → dsl.tsx → compile.ts → render.ts → {Name}Widget.ts → index.ts` pattern. The compiler must remain pure (no React, no Three.js, no async). Three.js is confined to `render.ts` files.

**Compiler purity:** All `<Slide>` → `<Scene>` transformation must happen synchronously in `SlidePlayer.render()`. No I/O, no async. The `compileSceneTrack` call triggered by `SceneEngine` must receive fully-resolved `<Scene>` elements.

**Interface-based stateful tests:** Tests must use real inputs and real output assertions. Compile functions are tested as pure functions with real DSL inputs and real state outputs. Runtime tests use the existing mock doubles from `packages/core/src/runtime/mocks/`.

**No Vite build:** Following the pattern of `@brewsite/diagram`, `@brewsite/model`, and `@brewsite/charts`, the slides package builds with `tsc` only.

**Tree-shaking required:** All exports must be named exports. No side-effectful barrel imports. `slidesPlugin()` is the only side-effectful entry point.

**Semver:** Starts at `0.1.0`. Breaking changes in `@brewsite/core` that require slides changes trigger a minor or major bump in `@brewsite/slides`.

**React 18 and 19 support:** Must maintain the same compatibility range as `@brewsite/core`.

**Examples app requirement:** At least one complete slide deck demo must be added to `apps/examples/src/` before the package ships. The demo must exercise all v1.0 built-in layouts and animated bullet lists.

---

## Appendix: Current BrewSite Navigation Key Bindings (Pre-Slides)

For reference, the default engine key bindings. `@brewsite/slides` augments these:

| Key | Existing Binding | Slides Override |
|-----|-----------------|-----------------|
| `ArrowRight` | `scene.next` | Same |
| `ArrowDown` | `scene.next` | Same |
| `ArrowLeft` | `scene.prev` | Same |
| `ArrowUp` | `scene.prev` | Same |
| `.` (Period) | `frame.next` | Suppressed (not useful in slides) |
| `,` (Comma) | `frame.prev` | Suppressed |
| `Home` | `scene.home` | Same |
| `End` | `scene.end` | Same |
| `Space` | *(not bound)* | `scene.next` (added by slides) |
| `Enter` | *(not bound)* | `scene.next` (added by slides) |
| `Escape` | *(not bound)* | Close overview (added by slides, v1.1) |
| `F` | *(not bound)* | Toggle fullscreen (added by slides) |

---

## Appendix: Compile-Time Transformation Sketch (Revised)

This illustrates the `<Slide>` → `<Scene>` expansion that `SlidePlayer` performs via `React.Children.map()`:

**Author writes:**
```tsx
<Slide key="principles" notes="Emphasize pre-baking" scrollUnits={600}>
  <TitleBodyLayout title="Core Principles">
    <BulletList items={['Pure snapshots', 'Pre-baked track', 'Widget SDK']} animateEntrance />
  </TitleBodyLayout>
</Slide>
```

**SlidePlayer transforms to (one Scene, not multiple):**
```tsx
<Scene key="principles" id="principles">
  <ProgressManager scrollUnits={600} />
  <SlideLayout
    id="slide-principles"
    layoutType="title-body"
    title="Core Principles"
    bullets={['Pure snapshots', 'Pre-baked track', 'Widget SDK']}
    animateEntrance
    titleRegion={{ x: 0, y: 0, w: 1, h: 0.2 }}
    bodyRegion={{ x: 0, y: 0.22, w: 1, h: 0.75 }}
  />
  <Background id="bg" color={theme.background.color} />
  <Camera id="cam" position={[0, 0, 5]} fov={50} orthographic />
  <Lighting id="lights">
    <Ambient intensity={0.9} />
    <Directional intensity={0.4} />
  </Lighting>
</Scene>
```

**SlidePlayer expands `animateEntrance` to N+1 micro-scenes (Option A):**
```tsx
// 3 bullets → 4 scenes
<Scene key="principles-s0" id="principles-s0">
  <ProgressManager scrollUnits={150} />
  <SlideLayout id="slide-principles" ... visibleBullets={0} totalBullets={3} />
  ...
</Scene>
<Scene key="principles-s1" id="principles-s1">
  <ProgressManager scrollUnits={150} />
  <SlideLayout id="slide-principles" ... visibleBullets={1} totalBullets={3} />
  ...
</Scene>
{/* ... s2 and s3 ... */}
```

**SlideMetaWidget publishes logical index mappings to VariableStore:**
```
slide:logicalIndex['principles-s0'] = 1   // all micro-scenes → same logical slide
slide:logicalIndex['principles-s1'] = 1
slide:logicalIndex['principles-s2'] = 1
slide:logicalIndex['principles-s3'] = 1
slide:totalLogicalSlides             = 5
slide:meta['principles.notes']       = 'Emphasize pre-baking'
slide:meta['principles.title']       = 'Core Principles'
```

The progress indicator reads `slide:logicalIndex[currentSceneId]` and `slide:totalLogicalSlides`. "Next slide" navigation uses `SlideNavWidget` which resolves the next logical slide's first micro-scene and fires `engine.goToScene()`.

**Alternatively (Option C):** If `sceneProgress` is added to `SceneTrackTick` in `@brewsite/core`, a single scene with `SlideLayoutWidget.apply()` computing `visibleBullets = Math.floor(context.tick.sceneProgress * totalBullets)` per-frame eliminates all scene inflation and the logical index layer entirely. See Q3.

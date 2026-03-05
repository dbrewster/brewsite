---
title: "Normalized Viewport Layout System"
doc_type: note
owner: Toolkit Product
status: active
last_updated: 2026-03-04
---

# Normalized Viewport Layout System

A foundational spatial contract for the BrewSite toolkit that unifies how all visual elements — 3D content, DOM overlays, text, diagrams, charts, and models — are positioned and scaled across screen sizes and devices. This change spans all four published packages: `@brewsite/core`, `@brewsite/diagram`, `@brewsite/charts`, and `@brewsite/model`.

---

## Backward Compatibility Policy

This is a breaking change with no backward-compatible shims. There are no `@deprecated` wrappers, no opt-in flags, and no migration adapters. Any existing consumer code that uses the old positioning patterns will break and must be rewritten. This is intentional: the old patterns are fundamentally incompatible with the new spatial contract, and shimming them would undermine the guarantees NVS is designed to provide.

---

## The Problem

The toolkit currently has three independent coordinate systems with no unifying contract:

1. **3D world space** — Three.js, unbounded, camera-dependent, arbitrary units
2. **DOM overlay** — raw CSS `position: absolute` authored by hand with no spatial model
3. **Label projection** — NDC → viewport pixel via Three.js camera (the only bridged system)

This means bots and authors have no spatial awareness when placing overlay content, content breaks unpredictably at different screen sizes, and 3D and DOM elements have no shared frame of reference.

---

## Core Decisions

### Fixed Aspect Ratio

The AR-locked container maintains a fixed aspect ratio. Both the Three.js canvas and the DOM overlay layer live inside this container and scale together as a single unit. There is no responsive reflow of 3D content. Content designed for a given AR maintains that geometry at all viewport sizes — it scales uniformly, not distorts.

Default AR: `16/9`. Authors override explicitly via the `aspectRatio` prop on `EngineARContainer`.

The `referenceWidth` prop defines the pixel width at which content scale = 1.0. Default: `1920`. This is the width at which TextBox content is authored (e.g., `font-size: 32px` at referenceWidth looks correct and scales proportionally at all other sizes).

### Scale Modes

The `scaleMode` prop on `EngineARContainer` controls how the fixed-AR container fits inside the available viewport space:

| Mode | Behavior |
|---|---|
| `fit-width` | Width fills the available container width; height is derived from AR. Default for embedded scroll experiences. |
| `fit-height` | Height fills the available container height; width is derived from AR. Default for portrait-first designs. |
| `contain` | Both dimensions fit inside the available space; the shorter axis letterboxes. Use for iframe embeds and fixed-height containers. |
| `cover` | Both dimensions fill the available space; content that exceeds viewport bounds is clipped. Use for full-screen immersive scenes. |

Default: `fit-width`.

### No Responsive Reflow in the Toolkit

The toolkit does not handle dramatically different device orientations (e.g., portrait phone vs. landscape desktop) as a single adaptive scene. A scene designed for one AR cannot meaningfully reflow for another. Device targeting is an application-level concern. The toolkit makes it straightforward to conditionally render different scene sets per breakpoint; it does not attempt to automatically adapt a single scene.

---

## Normalized Viewport Space (NVS)

All overlay content is positioned in NVS: a normalized 2D coordinate system defined over the interior of the AR-locked container.

- **Origin**: top-left corner of the AR-locked container = `(0, 0)`
- **X axis**: `0` = left edge, `1` = right edge
- **Y axis**: `0` = top edge, `1` = bottom edge
- **Units**: dimensionless ratios, map directly to CSS percentages

NVS has no continuous Z axis for DOM elements. Stacking order is expressed as a discrete integer `layer` prop, which maps to `z-index`. The value `-1 to 0` Z range that Three.js uses for depth has no DOM equivalent and is not surfaced in NVS.

The core types live in `@brewsite/core` and are imported by `@brewsite/diagram`, `@brewsite/charts`, and `@brewsite/model`:

```typescript
// core/src/layout/types.ts

export interface NVSRect {
  x: number;   // [0, 1] from left edge
  y: number;   // [0, 1] from top edge
  w: number;   // [0, 1] width
  h: number;   // [0, 1] height
}

export interface NVSPosition {
  x: number;
  y: number;
}

export interface INVSBounded {
  readonly nvsBounds: NVSRect;
}
```

---

## The Two Positioning Contexts

Scene content exists in one of two positioning contexts. These are distinct and must not be conflated.

### 1. Scene Space (NVS)

Content positioned relative to the AR-locked container. Uses NVS coordinates. Scales uniformly with the container as the viewport resizes. This is where 3D content (models, diagrams, charts) and their associated DOM annotations (TextBox with `anchor="scene"`) live.

### 2. Viewport Space

Content positioned relative to the full browser viewport, independent of the AR container. Does not scale with the AR-locked container. This is where navigation menus, footers, persistent UI overlays, and any element that must always hug a screen edge live.

Viewport-space elements are either:
- **Outside `EngineARContainer` entirely** in the DOM (the default and simplest approach) — a normal React header and footer above/below the AR container
- **Inside `EngineARContainer`** using `TextBox` with `anchor="viewport"`, for elements that need access to engine context (scene state, `useCurrentScene`, etc.) but must be viewport-anchored

The letterbox space created by `contain` or `fit-height` modes is styled by the application, not the toolkit. It is the natural gap between the AR container edge and the viewport edge — and in portrait-first designs it is intentionally used as breathing room.

---

## TextBox Element

`TextBox` is the first-class DSL element in `@brewsite/core` for placing DOM content (text, HTML, React components) at a defined position on screen. It is the only supported path for overlay content inside `<Scene>`. Raw non-DSL JSX children of `<Scene>` that were previously collected by `compileChildrenSeparated()` and stored as `api.state.sceneOverlay` are no longer a supported pattern. The `sceneOverlays` map on the engine continues to exist and is populated exclusively by `TextBox`-compiled content going forward. Existing scene authors using raw overlay children must migrate those to `<TextBox>` elements.

`TextBox` is a **compiled DSL element** — its layout and visibility properties (`x`, `y`, `w`, `h`, `opacity`) are compiled into the `SceneTrack` and can be animated between scenes exactly like any other element. The React content inside the box is not compiled; it is authored as JSX and rendered at runtime.

`TextBox` follows the standard element module pattern:
```
core/src/elements/text-box/types.ts
core/src/elements/text-box/dsl.tsx
core/src/elements/text-box/compile.ts
core/src/elements/text-box/TextBoxWidget.ts
core/src/elements/text-box/index.ts
```

### Anchor Modes

**`anchor="scene"` (default)** — positioned in NVS space relative to the AR-locked container:

```tsx
<TextBox x={0.05} y={0.1} w={0.4} h={0.8}>
  <h2>Feature title</h2>
  <p>Description text</p>
</TextBox>
```

Renders as `position: absolute; left: 5%; top: 10%; width: 40%; height: 80%` inside the engine overlay.

**`anchor="viewport"`** — positioned relative to the full browser viewport using `edge` + `inset`:

```tsx
<TextBox anchor="viewport" edge="top" inset={0.02}>
  <nav>Navigation</nav>
</TextBox>

<TextBox anchor="viewport" edge="bottom" inset={0.02}>
  <footer>Footer content</footer>
</TextBox>
```

`edge` values: `top | bottom | left | right`. `inset` is a fraction of the viewport dimension (not NVS). Viewport-anchored TextBoxes always span the full width or height of the viewport on the perpendicular axis.

### Content Scaling

`TextBox` establishes a scale context for its children. Content inside scales uniformly as the AR-locked container scales. The mechanism is a CSS `transform: scale(var(--scene-scale))` applied to an inner div sized at reference-resolution pixel dimensions.

`--scene-scale` is a CSS custom property injected by `EngineARContainer` on every resize event:

```
--scene-scale = currentContainerPixelWidth / referenceWidth
```

At `referenceWidth` (1920px by default), `--scene-scale = 1.0`. At half that size, `--scene-scale = 0.5`. Authors write content in reference-resolution pixels with no special CSS. The scale factor handles the rest.

### Clipping

`TextBox` clips its content by default (`overflow: hidden`). Content that exceeds the box's NVS bounds is not visible. This is intentional — silent overflow is almost always an authoring error.

Explicit opt-out: `<TextBox overflow="visible">` for cases where content intentionally extends beyond the box (e.g., a tooltip or dropdown that appears outside its parent region).

### Positioning of Nested Content

`TextBox` renders as `position: absolute` inside the `EngineOverlayHost`. All content nested inside a `TextBox` is `position: relative` or normal flow. Children lay out within the box using standard CSS. Authors do not use `position: absolute` inside a `TextBox` — they use the `TextBox`'s own NVS positioning to place it, and let content flow naturally inside.

---

## INVSBounded Interface

A Widget SDK interface exported from `@brewsite/core` that widgets optionally implement to declare their NVS bounds to the engine:

```typescript
// core/src/layout/types.ts

export interface INVSBounded {
  readonly nvsBounds: NVSRect;
}
```

This enables the engine to:
- Auto-frame Three.js cameras to fill a declared NVS region for 3D elements
- Allow authoring tools and bots to query what occupies a given screen region
- Detect and warn on NVS bound conflicts at development time

`DiagramCanvasWidget`, `ChartWidget`, and `ModelWidget` all implement this interface as part of this change.

---

## Portrait-First Cross-Device Pattern

For experiences that must look good on both desktop and mobile portrait, the recommended approach is:

1. Design at `aspectRatio={9/16}` (portrait phone proportions)
2. Use `scaleMode="fit-height"` — height always fills the available space, width gets blank space on wider screens
3. Anchor navigation and footer with `anchor="viewport"` so they span full viewport width regardless of the AR container
4. The 3D content and NVS TextBoxes live in the portrait AR container, horizontally centered
5. Desktop gets intentional pillarboxing. The application styles the surrounding area (branded background, gradient, etc.)
6. No scene redesign is needed for desktop — the scene scales up, the surrounding space is decorated by the app

The pillarbox space is not a failure mode. It is the designed breathing room that makes portrait-first content look considered on wide screens rather than stretched.

---

## @brewsite/core Changes

### New File: `core/src/layout/types.ts`

This file does not currently exist. It must be created. It contains the foundational NVS types and the `INVSBounded` widget interface:

```typescript
export interface NVSRect { x: number; y: number; w: number; h: number; }
export interface NVSPosition { x: number; y: number; }
export interface INVSBounded { readonly nvsBounds: NVSRect; }
```

`INVSBounded` is also re-exported from `core/src/widget/` so widget implementors in downstream packages can import it from the widget SDK surface without knowing about `layout/`.

### New Component: `core/src/player/EngineARContainer.tsx`

`EngineProvider` currently renders **no DOM output** — it returns only context providers wrapping `props.children`. Consumers today control 100% of the DOM layout: they independently place `SceneCanvas` and `EngineOverlayHost` as siblings inside their own wrapping div. Adding DOM output directly to `EngineProvider` would break this composability pattern because consumers currently embed arbitrary DOM siblings and layout wrappers as `EngineProvider` children and rely on it having no structural DOM output.

The AR container responsibility therefore belongs to a **new composable component** named `EngineARContainer`, not to `EngineProvider`. `EngineProvider` remains a pure context provider with no DOM output.

`EngineARContainer` is a standalone exported component that consumers place inside `EngineProvider` where they previously placed their own wrapping div around `SceneCanvas` + `EngineOverlayHost`. It owns and renders the AR-locked `<div>`, computes the scale factor, and injects `--scene-scale`.

```typescript
// core/src/player/EngineARContainer.tsx

export type EngineARContainerProps = {
  /**
   * Fixed aspect ratio for the engine container.
   * All 3D content and NVS-positioned elements are authored for this AR.
   * Default: 16/9
   */
  aspectRatio?: number;

  /**
   * The pixel width at which --scene-scale = 1.0.
   * TextBox content authored in reference-resolution pixels scales proportionally
   * from this baseline. Default: 1920
   */
  referenceWidth?: number;

  /**
   * How the fixed-AR container fits inside the available viewport space.
   * Default: 'fit-width'
   */
  scaleMode?: 'fit-width' | 'fit-height' | 'contain' | 'cover';

  /** className applied to the AR-locked container div. */
  className?: string;

  /** All children — SceneCanvas, EngineOverlayHost, EngineInputRegion. */
  children: ReactNode;
};

export const EngineARContainer = (props: EngineARContainerProps): ReactElement => {
  // ...
};
```

`EngineARContainer` mounts a `ResizeObserver` on its container ref. On each resize it computes `--scene-scale = containerPixelWidth / referenceWidth` and injects it as a CSS custom property on the AR-locked div. It sizes the div according to `scaleMode`. This is the only place `--scene-scale` is set.

`EngineProvider` gains **no new props**. All AR layout configuration lives on `EngineARContainer`.

The updated usage pattern is:

```tsx
<EngineProvider manifestUrl={MANIFEST_URL} plugins={plugins}>
  <EngineARContainer aspectRatio={16/9} scaleMode="fit-width">
    <EngineInputRegion>
      <SceneCanvas />
      <EngineOverlayHost />
    </EngineInputRegion>
  </EngineARContainer>
</EngineProvider>
```

The old pattern — consumers assembling their own wrapping div and positioning `SceneCanvas` + `EngineOverlayHost` as siblings — is **removed** as the documented pattern. The new `EngineARContainer` replaces the consumer's layout div.

### Modified File: `core/src/player/EngineOverlayHost.tsx`

`EngineOverlayHost` currently positions absolutely with `position: absolute; inset: 0` and assumes its parent is `position: relative`. After this change, it assumes its parent is the `EngineARContainer` div, which is `position: relative` by construction. No API surface changes are required on `EngineOverlayHostProps` — the container relationship changes structurally, not via props.

The `sceneOverlays` map that `EngineOverlayHost` reads from (via `engine.sceneOverlays`) continues to be populated from the compiled `api.state.sceneOverlay` produced by `sceneRootHandler`. Going forward, `sceneOverlay` is only populated by `TextBox`-compiled content. The `compileChildrenSeparated()` helper that collects raw non-DSL overlay children remains in the compiler for internal use by the `TextBox` DSL handler (TextBox children are arbitrary JSX that must pass through); however, the `<Scene>` root handler (`sceneRootHandler`) will no longer call `compileChildrenSeparated()` to collect stray children as overlay content. Any non-DSL, non-TextBox JSX children of `<Scene>` are silently ignored — they do not render. This is the concrete removal of the raw-child overlay pattern.

### New Element Module: `core/src/elements/text-box/`

Five files, following the mandatory element module pattern:

- **`types.ts`** — `TextBoxState`, `TextBoxAnchorMode`, `TextBoxEdge` types. No React, no Three.js.
- **`dsl.tsx`** — `TextBox` DSL component. Props: `x`, `y`, `w`, `h`, `opacity`, `layer`, `anchor`, `edge`, `inset`, `overflow`, `children`. The component returns `null` (compiled, never rendered directly).
- **`compile.ts`** — Pure `compileTextBox()` function. Transforms `TextBox` DSL props into `TextBoxState`. No React, no Three.js.
- **`TextBoxWidget.ts`** — Implements `ISceneElement<TextBoxState>` and `IRenderable<TextBoxState>`. The `apply()` method updates the DOM element's CSS position/opacity. The widget does not use Three.js.
- **`index.ts`** — Re-exports `TextBox`, `TextBoxState`, and `TextBoxProps`.

### HUD Module: `core/src/hud/`

The old `HudOverlay` and `HudItem` compiled DSL pipeline has already been removed — `core/src/hud/index.ts` confirms this. The `animejs/` transition presets (`Fade`, `MidFade`, `SlideUp`, `SlideDown`, `ScrollOn`, `ScrollOff`) remain available and are not changed by this feature. They apply to content inside `TextBox` elements.

No further changes are required in `core/src/hud/`. The transition presets use `position: relative` on their wrapper `divs`, which is correct inside a `TextBox`.

---

## @brewsite/diagram Changes

### Modified File: `diagram/src/elements/diagram/canvas/types.ts`

`DiagramCanvasState` gains an `nvsBounds` field:

```typescript
// Before:
export interface DiagramCanvasState {
  readonly id: string;
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
  readonly scale: number;
  readonly focusCenter?: ...;
  readonly diagrams: ReadonlyArray<DiagramState>;
  readonly pipes: ReadonlyArray<DiagramPipeState>;
  readonly defaultInputActions?: ReadonlyArray<InputActionSpec>;
}

// After:
import type { NVSRect } from '@brewsite/core';

export interface DiagramCanvasState {
  readonly id: string;
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
  readonly scale: number;
  readonly focusCenter?: ...;
  readonly diagrams: ReadonlyArray<DiagramState>;
  readonly pipes: ReadonlyArray<DiagramPipeState>;
  readonly defaultInputActions?: ReadonlyArray<InputActionSpec>;
  /** NVS bounds declaring what region of the AR-locked container this canvas occupies. */
  readonly nvsBounds: NVSRect;
}
```

`nvsBounds` is required on `DiagramCanvasState`. The compile step always produces it; fullscreen is expressed as `{ x: 0, y: 0, w: 1, h: 1 }` — an explicit choice, not an implicit default. The old implicit "fill the full container" behavior is removed.

### Modified File: `diagram/src/elements/diagram/canvas/dsl.tsx`

`DiagramCanvasProps` gains four new optional NVS props that map directly to `NVSRect`. When absent, they default to fullscreen (`x: 0`, `y: 0`, `w: 1`, `h: 1`):

```typescript
// After:
export interface DiagramCanvasProps {
  id: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  theme?: DiagramTheme;
  pipeRouting?: PipeRoutingAlgorithm;
  pipeLanding?: PipeLandingAlgorithm;
  focusCenter?: [number, number] | [number, number, number];
  children?: React.ReactNode;
  /** NVS x-coordinate of the canvas left edge [0, 1]. Default: 0 */
  x?: number;
  /** NVS y-coordinate of the canvas top edge [0, 1]. Default: 0 */
  y?: number;
  /** NVS width of the canvas [0, 1]. Default: 1 */
  w?: number;
  /** NVS height of the canvas [0, 1]. Default: 1 */
  h?: number;
}
```

`DiagramCanvasDSL` in `canvas/types.ts` gains the same four optional props.

### Modified File: `diagram/src/elements/diagram/canvas/compile.ts`

`compileDiagramCanvas()` must map the new `x`, `y`, `w`, `h` DSL props into `nvsBounds` on `DiagramCanvasState`. When any of the four props are absent, their defaults (`x: 0`, `y: 0`, `w: 1`, `h: 1`) are applied.

### Modified File: `diagram/src/elements/diagram/canvas/widget.ts` (`DiagramCanvasWidget`)

`DiagramCanvasWidget` must implement `INVSBounded`:

```typescript
import type { INVSBounded, NVSRect } from '@brewsite/core';

export class DiagramCanvasWidget
  implements
    ISceneElement<DiagramCanvasState>,
    IRenderable<DiagramCanvasState>,
    IAnimationController,
    IInputDefaultProvider,
    INVSBounded
{
  get nvsBounds(): NVSRect {
    return this.lastState?.nvsBounds ?? this.defaultState.nvsBounds;
  }
  // ... rest unchanged
}
```

The camera auto-framing logic in `onTick()` currently computes world-space bounds over child diagrams and positions the Three.js perspective camera to frame them. After this change, the engine uses `nvsBounds` to determine what viewport region the canvas occupies, and the Three.js camera viewport (via `camera.setViewOffset()` or equivalent) is constrained to that NVS region. The camera auto-framing math inside `onTick()` remains, but the camera now fills only the declared NVS sub-region rather than the full canvas.

The existing `applyInputFocus()` method's NDC computations currently use `canvasElement.getBoundingClientRect()` to convert pointer coordinates to NDC. After the NVS change, these computations must be adjusted to account for the sub-region: the NDC must be computed relative to the NVS-bounded sub-rect of the AR container, not the full renderer bounds.

### Files: `diagram/src/elements/diagram/focusRegion.ts` and `useDiagramFocusRegion.ts`

These files manage focus-region state using a module-level singleton and a `CustomEvent` dispatch on `window`. They track `canvasId`, `diagramId`, and `groupId` — purely logical identifiers with no pixel coordinates.

**No NVS changes required.** `focusRegion.ts` expresses focus as logical entity identity (which diagram, which group), not as pixel or NVS coordinates. The hook `useDiagramFocusRegion.ts` returns this logical state to consumers who then make their own UI decisions. This abstraction is correct and remains unchanged.

---

## @brewsite/charts Changes

### Modified File: `charts/src/elements/chart/types.ts`

`ChartState` currently uses `position: readonly [number, number, number]`, `rotation`, and `bounds: { width, height, depth }` to place the chart in Three.js world space. It has no NVS concept.

After this change, `ChartState` gains `nvsBounds`:

```typescript
import type { NVSRect } from '@brewsite/core';

export type ChartState = {
  // ... all existing fields unchanged ...
  /** NVS bounds declaring what region of the AR-locked container this chart occupies. */
  readonly nvsBounds: NVSRect;
};
```

`nvsBounds` is required on `ChartState`. `DEFAULT_CHART_STATE` must include `nvsBounds: { x: 0, y: 0, w: 1, h: 1 }`. The old implicit "fill the full container" assumption in Three.js camera framing is removed. Charts now declare their NVS region and the engine frames their Three.js camera to that sub-region.

### Modified File: `charts/src/elements/chart/dsl.tsx`

`ChartDSL` and `ChartProps` gain four new optional NVS props. When absent, they default to fullscreen:

```typescript
export type ChartDSL = {
  readonly id: string;
  readonly type: ChartType;
  // ... all existing props unchanged ...
  /** NVS x-coordinate of the chart left edge [0, 1]. Default: 0 */
  readonly x?: number;
  /** NVS y-coordinate of the chart top edge [0, 1]. Default: 0 */
  readonly y?: number;
  /** NVS width of the chart [0, 1]. Default: 1 */
  readonly w?: number;
  /** NVS height of the chart [0, 1]. Default: 1 */
  readonly h?: number;
};
```

### Modified File: `charts/src/elements/chart/compile.ts`

`compileChart()` (or equivalent compile function) must map the new `x`, `y`, `w`, `h` DSL props into `nvsBounds` on `ChartState`. When absent, defaults to `{ x: 0, y: 0, w: 1, h: 1 }`.

### Modified File: `charts/src/elements/chart/ChartWidget.ts`

`ChartWidget` must implement `INVSBounded`:

```typescript
import type { INVSBounded, NVSRect } from '@brewsite/core';

export class ChartWidget
  implements
    ISceneElement<ChartState>,
    IRenderable<ChartState>,
    IAnimationController,
    IDslComposite,
    INVSBounded
{
  get nvsBounds(): NVSRect {
    return this.lastState?.nvsBounds ?? DEFAULT_CHART_STATE.nvsBounds;
  }
  // ... rest unchanged
}
```

The Three.js camera framing for chart rendering currently assumes it occupies the full renderer viewport. The existing `getNdc()` method uses `dom.getBoundingClientRect()` on the full renderer element to compute NDC coordinates. After this change, raycasting and camera viewport must be scoped to the NVS sub-region. `getNdc()` must be updated to compute NDC relative to the NVS sub-rect of the AR-locked container, not the full renderer bounds.

### Modified File: `charts/src/player/ChartTooltipOverlay.tsx`

Currently, `ChartTooltipOverlay` accepts `widget`, `camera`, and `domElement` as props and positions the tooltip with `position: fixed` using raw viewport pixel coordinates computed from `domElement.getBoundingClientRect()` and `point.project(camera)`.

After the NVS change, this approach breaks because `domElement` will be the Three.js renderer canvas inside the AR-locked container — its bounding rect is the AR container region, not the full viewport. Additionally, `position: fixed` with viewport-pixel coordinates is architecturally incompatible with the NVS overlay system.

The `camera` and `domElement` props are **removed**. `ChartWidget` already holds these internally (it captures `renderer.domElement` in `initialize()` and resolves the camera from `scene.userData`). The tooltip reads them from the widget directly rather than requiring the consumer to pass them.

The new `ChartTooltipOverlayProps` is:

```typescript
export type ChartTooltipOverlayProps = {
  /** The ChartWidget instance to subscribe to hover events on. */
  widget: ChartWidget;
  /**
   * NVS bounds of the chart within the AR-locked container.
   * Used to map the projected NDC point to absolute pixel offsets
   * within EngineOverlayHost. Must match the nvsBounds used in the Chart DSL.
   */
  nvsBounds: NVSRect;
  /** Custom render function for the tooltip content. */
  renderContent?: (info: ChartHoverInfo) => React.ReactNode;
  /** Extra CSS class name applied to the tooltip container. */
  className?: string;
};
```

The tooltip positions with `position: absolute` inside the `EngineOverlayHost` (which spans `inset: 0` over the full AR-locked container). The projection maps NDC to pixel offsets within the AR container sub-region defined by `nvsBounds`:

```typescript
const project = useCallback((info: ChartHoverInfo | null): void => {
  if (!info) { setTooltip(null); return; }
  const camera = widget.getCamera();         // internal getter exposed on ChartWidget
  const containerSize = widget.getContainerSize(); // internal getter: { width, height }
  if (!camera || !containerSize) { setTooltip(null); return; }

  const point = new THREE.Vector3(info.point[0], info.point[1], info.point[2]);
  point.project(camera);  // NDC

  const regionX = nvsBounds.x * containerSize.width;
  const regionY = nvsBounds.y * containerSize.height;
  const regionW = nvsBounds.w * containerSize.width;
  const regionH = nvsBounds.h * containerSize.height;

  const x = regionX + ((point.x + 1) / 2) * regionW;
  const y = regionY + ((-point.y + 1) / 2) * regionH;

  setTooltip({ info, x, y });
}, [widget, nvsBounds]);
```

`ChartWidget` must expose two new internal getters for the tooltip's use: `getCamera(): THREE.Camera | null` and `getContainerSize(): { width: number; height: number } | null`. These are not part of the `INVSBounded` interface — they are implementation methods on the concrete `ChartWidget` class, already effectively accessible via the `widget` prop reference.

The tooltip renders with `position: absolute; left: x + 12px; top: y - 12px` — unchanged visually, but correctly scoped to the AR container coordinate space.

---

## @brewsite/model Changes

### Modified File: `model/src/elements/model/types.ts`

`SceneModelInstanceState` gains `nvsBounds` as a **required field with a compiler-supplied default**. This matches the pattern used for `DiagramCanvasState` and `ChartState` — required on the state type, optional on the DSL prop, with the compile step always filling it in:

```typescript
import type { NVSRect } from '@brewsite/core';

export type SceneModelInstanceState = {
  model: SceneModel;
  playback: ScenePlayback;
  enabled?: boolean;
  labels?: import('../../labels/types').LabelResolved[];
  /** NVS bounds declaring what region of the AR-locked container this model occupies. */
  nvsBounds: NVSRect;
};
```

`nvsBounds` is required on `SceneModelInstanceState`. The compile step always supplies it; the DSL prop is optional with a fullscreen default. This is consistent with `DiagramCanvasState` and `ChartState`. The previous note had `nvsBounds` as optional on the state type — this was inconsistent with the other two packages and is corrected here.

### Modified File: `model/src/elements/model/dsl.tsx` (`ModelProps`)

`ModelProps` gains four optional NVS props:

```typescript
// New optional props on ModelProps:
/** NVS x-coordinate of the model's viewport region [0, 1]. Default: 0 */
x?: number;
/** NVS y-coordinate of the model's viewport region [0, 1]. Default: 0 */
y?: number;
/** NVS width of the model's viewport region [0, 1]. Default: 1 */
w?: number;
/** NVS height of the model's viewport region [0, 1]. Default: 1 */
h?: number;
```

The compile step maps these to `nvsBounds` on `SceneModelInstanceState`, defaulting to `{ x: 0, y: 0, w: 1, h: 1 }` when absent.

### Modified File: `model/src/elements/model/ModelWidget.ts`

`ModelWidget` must implement `INVSBounded`. The `nvsBounds` getter returns `this.lastState?.nvsBounds ?? { x: 0, y: 0, w: 1, h: 1 }`.

The Three.js camera and renderer viewport for the model must be constrained to the declared NVS region. The existing GLTF rendering path uses a single full-viewport camera. After this change, `ModelWidget` communicates its NVS bounds to the engine so the runtime can scope the camera viewport accordingly.

### Modified File: `model/src/player/LabelPositioner.ts`

This is the most mechanically impactful change in `@brewsite/model`.

Currently, `LabelPositioner` projects 3D world positions to screen pixels using:

```typescript
const projectToScreen = (worldPos, camera, width, height) => {
  const vec = new Vector3(...worldPos);
  vec.project(camera);             // NDC [-1, 1]
  const x = (vec.x * 0.5 + 0.5) * width;   // full container pixels
  const y = (-vec.y * 0.5 + 0.5) * height; // full container pixels
  return { x, y };
};
```

`width` and `height` here are the full AR-locked container pixel dimensions (set via `setContainerSize()`). This is correct when the model fills the full container. When the model occupies an NVS sub-region, the projection must map NDC into the sub-region's pixel footprint within the container.

`LabelPositioner` is **publicly exported** from `@brewsite/model` (`model/src/index.ts` line 59: `export { LabelPositioner }`). The `setContainerSize()` method is therefore a public API. This signature change is a confirmed public breaking change with no shim.

After this change, `setContainerSize` gains an `nvsBounds` parameter:

```typescript
setContainerSize(containerWidth: number, containerHeight: number, nvsBounds?: NVSRect): void;
```

When `nvsBounds` is absent, the behavior is equivalent to `{ x: 0, y: 0, w: 1, h: 1 }` — full container. This preserves correct behavior for models that occupy the full container without forcing callers to pass an explicit fullscreen rect.

The `projectToScreen` function must map NDC coordinates into the pixel sub-rect defined by `nvsBounds`:

```typescript
const regionX = nvsBounds.x * containerWidth;
const regionY = nvsBounds.y * containerHeight;
const regionW = nvsBounds.w * containerWidth;
const regionH = nvsBounds.h * containerHeight;

const x = regionX + (vec.x * 0.5 + 0.5) * regionW;
const y = regionY + (-vec.y * 0.5 + 0.5) * regionH;
```

The label DOM elements are still positioned with `position: absolute` inside the `EngineOverlayHost`, which spans `inset: 0` over the full AR-locked container. The pixel values from the updated `projectToScreen` are expressed relative to that container, so `transform: translate(xpx, ypx)` continues to work correctly.

### File: `model/src/labels/LabelItem.tsx`

`LabelItem` renders label DOM elements using `position: absolute; top: 0; left: 0` with CSS transform positioning managed by `LabelPositioner`. This approach does not need to change — the transform values are computed by `LabelPositioner` in NVS-aware pixel space and applied as `el.style.transform`. The component itself has no coordinate logic and requires no changes.

### File: `model/src/labels/dsl.tsx` (`Label`, `Labels`)

The `Label` DSL element attaches labels to model body parts by `targetPartId`. Positioning is entirely derived from the model's 3D bone world positions at runtime. There is no static NVS position concept for individual labels — they follow the 3D geometry.

**No NVS props needed on `<Label>`.** The label follows the bone, which is in 3D world space. The NVS positioning is handled at the `ModelWidget` level (what region the model occupies) and the `LabelPositioner` level (how that region maps to pixel offsets). `Label` DSL props are unchanged.

### File: `model/src/compiler/labelCompiler.ts`

`labelCompiler.ts` handles cross-scene interpolation of `LabelResolved` arrays. It operates on opacity, `labelOffset`, and style — all model-space or style-space values. It does not produce or consume NVS coordinates.

**No changes required.** The compiler pipeline is NVS-agnostic. NVS awareness lives in the runtime layer (`LabelPositioner`), not the compile layer.

---

## Cross-Package Type Dependency Order

All packages import NVS types from `@brewsite/core`. The implementation must proceed in this order:

1. **`@brewsite/core`** — `core/src/layout/types.ts` must be created first. `NVSRect`, `NVSPosition`, and `INVSBounded` must be exported from the core package public surface before any downstream package can implement them. All other core changes (TextBox element, `EngineARContainer`, `EngineOverlayHost` update, `sceneRootHandler` raw-child removal) can land in the same core release.

2. **`@brewsite/diagram`, `@brewsite/charts`, `@brewsite/model`** — These three packages can implement their NVS changes in parallel once the core types are published. Each depends only on `@brewsite/core` for the NVS types. They do not depend on each other for this feature.

3. **Consumer app scenes** — Scene DSL files that use `<TextBox>`, `<DiagramCanvas x={...}>`, `<Chart x={...}>`, or model NVS props can only be updated after the library work ships. Any app scene using the old raw-child overlay pattern or implicitly full-container diagrams/charts/models must be rewritten to use the new NVS-explicit API. Any page that uses `EngineProvider` must be updated to wrap `SceneCanvas` + `EngineOverlayHost` in `<EngineARContainer>` instead of a hand-rolled div.

---

## Package Ownership

| Concept | Package | File(s) | Status |
|---|---|---|---|
| `NVSRect`, `NVSPosition`, `INVSBounded` | `@brewsite/core` | `core/src/layout/types.ts` (new) | New file required |
| `--scene-scale` CSS variable injection | `@brewsite/core` | `core/src/player/EngineARContainer.tsx` (new) | New component required |
| AR-locked container + scaleMode | `@brewsite/core` | `core/src/player/EngineARContainer.tsx` (new) | New component required |
| `EngineProvider` DOM output | `@brewsite/core` | `core/src/player/EngineProvider.tsx` | Unchanged (no DOM output added) |
| `EngineOverlayHost` absolute positioning | `@brewsite/core` | `core/src/player/EngineOverlayHost.tsx` | Unchanged structurally |
| `sceneRootHandler` raw-child overlay removal | `@brewsite/core` | `core/src/compiler/sceneDslCompiler.ts` | Modified |
| `TextBox` DSL element + widget | `@brewsite/core` | `core/src/elements/text-box/` (new module) | New module required |
| AnimeJS transition presets | `@brewsite/core` | `core/src/hud/animejs/transitions.tsx` | Unchanged |
| `DiagramCanvas` NVS props + compile | `@brewsite/diagram` | `canvas/types.ts`, `canvas/dsl.tsx`, `canvas/compile.ts` | Modified |
| `DiagramCanvasWidget` INVSBounded | `@brewsite/diagram` | `canvas/widget.ts` | Modified |
| Diagram camera sub-region framing | `@brewsite/diagram` | `canvas/widget.ts` | Modified |
| `focusRegion.ts` + `useDiagramFocusRegion.ts` | `@brewsite/diagram` | `elements/diagram/focusRegion.ts`, `useDiagramFocusRegion.ts` | Unchanged |
| `ChartState` NVS bounds + compile | `@brewsite/charts` | `elements/chart/types.ts`, `elements/chart/compile.ts` | Modified |
| `Chart` DSL NVS props | `@brewsite/charts` | `elements/chart/dsl.tsx` | Modified |
| `ChartWidget` INVSBounded + internal getters | `@brewsite/charts` | `elements/chart/ChartWidget.ts` | Modified |
| `ChartTooltipOverlay` NVS-aware projection | `@brewsite/charts` | `player/ChartTooltipOverlay.tsx` | Modified (props changed) |
| `SceneModelInstanceState` NVS bounds | `@brewsite/model` | `elements/model/types.ts` | Modified |
| `Model` DSL NVS props | `@brewsite/model` | `elements/model/dsl.tsx` | Modified |
| `ModelWidget` INVSBounded | `@brewsite/model` | `elements/model/ModelWidget.ts` | Modified |
| `LabelPositioner` NVS-aware projection | `@brewsite/model` | `player/LabelPositioner.ts` | Modified (public API breaking change) |
| `LabelItem` DOM component | `@brewsite/model` | `labels/LabelItem.tsx` | Unchanged |
| `Label` DSL | `@brewsite/model` | `labels/dsl.tsx` | Unchanged |
| `labelCompiler.ts` | `@brewsite/model` | `compiler/labelCompiler.ts` | Unchanged |

---

## Resolved Decisions

The following five ambiguities identified after the initial note expansion have been resolved. Each decision is grounded in inspection of the actual source files.

### Decision 1: AR Container Rendering — New `EngineARContainer` Component

**Decision:** `EngineProvider` does not gain DOM output. A new composable component `EngineARContainer` is introduced and takes sole responsibility for the AR-locked div and `--scene-scale` injection.

**Justification:** Reading `EngineProvider.tsx` confirms it renders zero DOM — it returns only context providers wrapping `props.children`. The `ChartDemoPage.tsx` example shows consumers already embed `SceneCanvas` + `EngineOverlayHost` inside their own layout divs as children of `EngineProvider`. Adding DOM output directly to `EngineProvider` would silently restructure the DOM tree around consumers' children, potentially breaking layout, `position: relative` containers, and CSS selectors that consumers have authored. A separate `EngineARContainer` is composable: consumers opt into it explicitly, the migration is obvious (replace your hand-rolled wrapper div with `<EngineARContainer>`), and `EngineProvider` stays a pure context provider. The API surface addition is one new component and three optional props — a reasonable cost for not breaking the composability contract.

### Decision 2: Raw JSX Children of `<Scene>` — Pattern Exists, Is Removed

**Decision:** The raw-child overlay pattern is real and actively compiled today. It is removed. The `sceneRootHandler` in `sceneDslCompiler.ts` will stop calling `compileChildrenSeparated()` to collect stray non-DSL overlay children. Any non-DSL, non-`TextBox` JSX children of `<Scene>` are silently dropped. Scene authors must migrate to `<TextBox>` elements.

**Justification:** Reading `sceneDslCompiler.ts` lines 336-342 confirms `sceneRootHandler` calls `compileChildrenSeparated()` and stores the result as `api.state.sceneOverlay`, which `EngineOverlayHost` renders. This is a live, documented mechanism (the comment on `EngineOverlayHost.tsx` line 3 explicitly says "Scene overlay content comes from non-DSL React children of `<Scene>`"). The `sceneOverlays` map on the engine continues to exist and is populated by `TextBoxWidget` output going forward — its data contract does not change, only its source. Removing the raw-child collection path in `sceneRootHandler` is the minimal surgical change. The `compileChildrenSeparated()` helper itself remains in the compiler because it will be needed by the `TextBox` DSL handler to collect arbitrary JSX children of `<TextBox>` for runtime rendering.

### Decision 3: `ChartTooltipOverlay` API Change — Props Simplified, `nvsBounds` Added

**Decision:** The `camera` and `domElement` props are removed from `ChartTooltipOverlayProps`. An `nvsBounds: NVSRect` prop is added (required). `ChartWidget` exposes two new internal getters (`getCamera()` and `getContainerSize()`) that the tooltip reads via the existing `widget` prop reference. The tooltip positions with `position: absolute` scoped to the AR container, not `position: fixed` against the viewport.

**Justification:** Reading `ChartWidget.ts` confirms it already captures `renderer.domElement` in `initialize()` and resolves the camera from `scene.userData[SCENE_CAMERA_KEY]`. Requiring consumers to pass `camera` and `domElement` as props was always redundant duplication — the widget already has them. The NVS change makes this duplication actively harmful because the consumer-passed `domElement` bounding rect is no longer the correct projection space. Removing the props simplifies the API, eliminates the consumer error of passing the wrong `domElement`, and makes the tooltip self-contained. `nvsBounds` is required (not inferred from the widget) because the widget's `nvsBounds` is a runtime tick state that may lag the first render — consumers pass the same `nvsBounds` they declared in the DSL, which is statically known at authoring time. This is explicit, safe, and consistent with how `DiagramCanvasWidget.nvsBounds` is used.

### Decision 4: `LabelPositioner.setContainerSize()` — Confirmed Public Breaking Change, Optional `nvsBounds` Parameter

**Decision:** `setContainerSize` is a confirmed public method (`LabelPositioner` is exported from `model/src/index.ts` line 59). The new signature is `setContainerSize(containerWidth: number, containerHeight: number, nvsBounds?: NVSRect): void`. The `nvsBounds` parameter is optional — when absent, behavior defaults to full container (`{ x: 0, y: 0, w: 1, h: 1 }`). This is a public breaking change in that the type signature changes, but it is backward-compatible at runtime for callers that do not pass `nvsBounds`.

**Justification:** Unlike the `nvsBounds` optionality decision on DSL props (see Decision 5), `setContainerSize` is an imperative method on a class, not a compiled state field. Making `nvsBounds` optional here is correct because `ModelWidget.ts` calls `setContainerSize` on every resize — and models that genuinely occupy the full container should not be forced to pass an explicit fullscreen rect on every resize event. Optional with a fullscreen default is the right ergonomics for an imperative setter. This is distinct from the DSL/state pattern, where the required field + optional DSL prop pattern is used.

### Decision 5: `nvsBounds` Optionality — Required on State Types, Optional on DSL Props, Consistent Across All Three Packages

**Decision:** The pattern is uniform across `@brewsite/diagram`, `@brewsite/charts`, and `@brewsite/model`:
- **State types** (`DiagramCanvasState`, `ChartState`, `SceneModelInstanceState`): `nvsBounds` is **required**. The compile step always fills it in.
- **DSL props** (`DiagramCanvasProps`, `ChartDSL`/`ChartProps`, `ModelProps`): `nvsBounds` is expressed as four separate optional props (`x?`, `y?`, `w?`, `h?`) defaulting to fullscreen (`0, 0, 1, 1`).
- **`LabelPositioner.setContainerSize()`**: `nvsBounds` is optional with a fullscreen default (see Decision 4 above — imperative setter ergonomics differ from compiled state).

**Justification:** The previous note had `SceneModelInstanceState.nvsBounds` as optional while `DiagramCanvasState.nvsBounds` and `ChartState.nvsBounds` were required. This inconsistency was wrong — it would cause `ModelWidget.nvsBounds` to need a nullable return type while the other two widgets returned non-nullable values, defeating the `INVSBounded` interface contract. The interface declares `readonly nvsBounds: NVSRect` (non-optional), so all three implementing widgets must return a non-nullable `NVSRect`. Required on state types enforces this. Optional on DSL props is correct because "fullscreen" is the overwhelmingly common case and should not be boilerplate that every existing scene author must add. The compile step bridges this: DSL props are optional → compile always produces a required state field.

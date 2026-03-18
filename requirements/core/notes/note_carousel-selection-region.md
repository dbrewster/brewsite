---
title: "Carousel as Selection Region — Design Note"
doc_type: note
owner: Toolkit Product
status: implemented
updated: 2026-03-18
change_history:
  - date: 2026-03-18
    author: "Toolkit Product"
    summary: "Initial note. Explored three-layer composition pattern with carousel.select action type."
  - date: 2026-03-18
    author: "Toolkit Product"
    summary: "Revised to onClick DSL-first approach per feedback. Added rich event type, keyboard a11y, programmatic deselect, getSceneProgress helper, and naming cleanup (activeIndex → focusedIndex)."
  - date: 2026-03-18
    author: "Toolkit Product"
    summary: "Added full example specification: carousel-selection-demo with three views (chart full-screen, diagram full-screen, nested carousel via React overlay). Demonstrates all three response patterns plus programmatic deselect."
  - date: 2026-03-18
    author: "PM-1 (Review)"
    summary: "Validated all Current State claims against codebase. Corrected getSceneProgress implementation (uses SceneWindow.start, not progressMapper.sceneStartProgress which doesn't exist). Added review findings on VariableStore JsonPrimitive constraint for selectedIndex, Tab key conflict with browser behavior, and additional risks."
  - date: 2026-03-18
    author: "PM-1 + PM-2 (Debate Consensus)"
    summary: "Resolved 3 debate questions: (1) Replaced Tab-to-cycle with ARIA listbox pattern — Tab focuses carousel as unit, ArrowKeys navigate within, Enter/Space fires selection. (2) Replaced isKeyboard:boolean with source:'pointer'|'keyboard'|'programmatic' discriminated union. (3) Renamed onClick→onSelect, CarouselClickEvent→CarouselSelectEvent to match broader trigger semantics. (4) Added pure getSceneProgressFromTrack function alongside engine convenience method. Updated build list, examples, risks."
---

# Carousel as Selection Region

## The Idea

Use the existing `<ViewLayout kind="carousel">` as an interactive **selection region** — a browsable set of options where the user scrolls/swipes through items and clicks one to "go full screen." The full-screen response is intentionally polymorphic: it might transition to a different scene, display a React overlay, zoom-in within the current canvas, or any combination.

This is a **composition pattern** layered on top of existing carousel, input, and engine primitives. The key addition is an **`onSelect` callback** directly in the ViewLayout DSL — the most natural API for developers — plus a rich event type, keyboard selection support (Enter/Space following the ARIA listbox pattern), and a programmatic deselect path for reverse animations.

---

## Current State: What Already Exists

| Capability | Status | Location |
|---|---|---|
| Carousel layout + navigation (keyboard, swipe, wheel) | ✅ Shipped | `ViewLayout kind="carousel"`, `InputCoordinator`, `ActionInputController` |
| Carousel positioning (corner, full-width, loop/linear) | ✅ Shipped | `ViewLayout` x/y/w/h props + `resolveLayout()` |
| Carousel tray + highlight visuals | ✅ Shipped | `CarouselScrubberWidget` |
| Reactive carousel index | ✅ Shipped | `useCarouselState(layoutId)` via `VariableStore` |
| Programmatic scene transition | ✅ Shipped | `engine.beginTransition(toProgress, durationMs, easing)` |
| Widget state patching at runtime | ✅ Shipped | `engine.patchWidgetStates(patches)` |
| Click dispatch on canvas elements | ⚠️ Partial | `ActionInputController` dispatches click events, but only for action-mapped inputs — no carousel-item-specific click |
| `onSelect` callback in DSL | ❌ Missing | No callback mechanism on ViewLayout |
| Selection event type | ❌ Missing | No structured event for carousel item selection |
| Keyboard selection (Enter/Space) | ❌ Missing | No focus ring or Enter-to-select on carousel items |
| `getSceneProgress(sceneId)` | ❌ Missing | Consumer must manually compute from `compiledScenes` |

---

## Design: `onSelect` in the DSL

### The Developer Experience

The `onSelect` prop on `ViewLayout` is the primary API. If a scene author provides it, selection events on the carousel (pointer click, keyboard Enter/Space) are captured and the callback fires. If omitted (or if the handler doesn't call `event.preventDefault()`), the event falls through to the underlying input system (existing behavior, no regression).

```tsx
<Scene id="product-picker">
  <Camera ... />
  <Lighting ... />

  <ViewLayout
    kind="carousel"
    id="products"
    x={0.6} y={0} w={0.4} h={0.35}
    focusedIndex={0}
    loop
    onSelect={(event) => {
      // event.index — 0-based index of the selected item
      // event.viewId — stable View id ("product-alpha")
      // event.layoutId — "products"
      // event.position — { x, y } NVS coords (null for keyboard/programmatic)
      // event.source — 'pointer' | 'keyboard' | 'programmatic'
      // event.preventDefault() — stop event from falling through
      console.log(`Selected: ${event.viewId} at index ${event.index}`);
    }}
  >
    <View id="product-alpha"><Model src="alpha.glb" /></View>
    <View id="product-beta"><Model src="beta.glb" /></View>
    <View id="product-gamma"><Model src="gamma.glb" /></View>
  </ViewLayout>

  <InputController>
    <Action id="nav-carousel" type="carousel.next" layoutId="products">
      <KeyMap keyName="ArrowRight" />
    </Action>
    <Action id="nav-carousel-prev" type="carousel.prev" layoutId="products">
      <KeyMap keyName="ArrowLeft" />
    </Action>
  </InputController>
</Scene>
```

This feels like standard React. The developer doesn't need to learn a new event system — they write an `onSelect` and get a typed event.

### Full-width hero variant (same API, different position):

```tsx
<ViewLayout
  kind="carousel"
  id="hero-products"
  focusedIndex={0}
  loop
  zStep={2}
  onSelect={(event) => {
    engine.beginTransition(engine.getSceneProgress(`detail-${event.viewId}`), 600);
  }}
>
  {/* ... */}
</ViewLayout>
```

---

## The Event Type: `CarouselSelectEvent`

A single rich event type covers all use cases — pointer click, keyboard, and programmatic triggers:

```typescript
export type CarouselSelectEvent = {
  /** 0-based index of the selected item. */
  readonly index: number;
  /** Stable View id of the selected item. */
  readonly viewId: string;
  /** The ViewLayout id that owns this carousel. */
  readonly layoutId: string;
  /** NVS coordinates of the selection point. Non-null only when source is 'pointer'. */
  readonly position: { readonly x: number; readonly y: number } | null;
  /** How the selection was triggered. */
  readonly source: 'pointer' | 'keyboard' | 'programmatic';
  /** Total number of items in the carousel. */
  readonly childCount: number;
  /**
   * Call to prevent the event from falling through to the
   * underlying input system. If onSelect is provided but
   * preventDefault is never called, the event bubbles normally.
   */
  preventDefault(): void;
};
```

**Design rationale:**
- `index` + `viewId` — both included so the consumer can use whichever is natural. Index for array lookups, viewId for named routing.
- `position` — enables origin-point animations (expand from click point). Non-null only when `source === 'pointer'` to avoid fake coords.
- `source` — discriminated string union. Consumers can switch on source for exhaustive handling (e.g., skip spatial animation for keyboard, skip all animation for programmatic). Extensible via union widening (minor semver to add `'touch'` if needed later). Avoids the API regret of `isKeyboard: boolean` which cannot distinguish pointer from programmatic triggers.
- `preventDefault()` — opt-in capture. By default, events fall through, preserving backward compatibility.

---

## Naming Cleanup: `activeIndex` → `focusedIndex`

The current naming is ambiguous. `activeIndex` sounds like it could mean "the one the user selected" when it actually means "the front-most item in the carousel." With selection now in the picture, this ambiguity becomes a real bug magnet.

**Rename:**

| Old Name | New Name | Meaning |
|---|---|---|
| `activeIndex` (ViewLayout prop) | `focusedIndex` | The front-most item in the carousel (visual focus) |
| `activeIndex` (CarouselLayoutConfig) | `focusedIndex` | Same, in compiled state |
| `activeIndex` (VariableStore key) | `focusedIndex` | Same, in runtime state |
| *(new)* | `selectedIndex` | The item the user clicked/confirmed (null until interaction) |

**`focusedIndex`** communicates visual positioning without implying user intent. **`selectedIndex`** is unambiguous — the user made a choice.

**Breaking change:** Yes — `activeIndex` is a public prop on `ViewLayout` and a key in `useCarouselState`. This requires:
- Deprecation of `activeIndex` with a runtime warning (keep it working for 1 minor release)
- Migration docs: find-and-replace `activeIndex` → `focusedIndex`
- The hook return type changes from `[activeIndex, childCount]` to `{ focusedIndex, selectedIndex, childCount }`

**Semver impact:** Minor with deprecation. Major if we remove `activeIndex` immediately (not recommended).

---

## Keyboard Accessibility: ARIA Listbox Pattern

The carousel follows the **ARIA listbox / roving tabindex** pattern for keyboard interaction. This respects browser accessibility conventions: Tab moves between widgets, ArrowKeys navigate within a composite widget.

1. **Tab** focuses the carousel widget as a unit (the carousel container receives focus)
2. **ArrowLeft/ArrowRight** navigate `focusedIndex` (existing behavior via `carousel.next`/`carousel.prev` actions — no new code needed)
3. **Enter** or **Space** triggers `onSelect` with `source: 'keyboard'`
4. **Tab** again moves focus to the next focusable page element (standard browser behavior)

**Focus ring visual:** The tray highlight system (`CarouselScrubberWidget.setHighlight`) already supports visual effects on the focused item. When keyboard focus is active, a subtle focus ring highlight is applied automatically. This is a rendering concern, not a DSL concern.

**Implementation:** Enter/Space handling is added to `ActionInputController`'s keyboard dispatch. When the carousel layout has an `onSelect` handler registered:
- Enter/Space dispatches the `onSelect` callback with `source: 'keyboard'`

ArrowLeft/ArrowRight already dispatch `carousel.next`/`carousel.prev` — no changes needed. Tab is not intercepted at all; the browser's native focus management handles it.

**Why not Tab-to-cycle?** Tab cycling within the carousel would hijack the browser's native Tab behavior, breaking accessibility navigation to other page elements (overlay buttons, close buttons, form inputs). The ARIA pattern is the standard: Tab moves between widgets, ArrowKeys move within.

---

## Deselection: Consumer-Controlled with Programmatic API

There is no built-in deselect behavior. The consumer handles deselection through the same `onSelect` callback (selecting again) or their own UI (close button, Escape key handler, etc.).

For **programmatic deselect** (needed when the consumer wants to animate a reverse transition):

```typescript
export function clearCarouselSelection(layoutId: string, store: VariableStore): void {
  store.set('carousel', `${layoutId}.selectedIndex`, null);
}
```

Exposed as a hook for React consumers:

```typescript
export function useCarouselSelection(layoutId: string): {
  selectedIndex: number | null;
  focusedIndex: number;
  childCount: number;
  clearSelection(): void;
} {
  const store = useVariableStore();
  const selectedIndex = useVariable<number>('carousel', `${layoutId}.selectedIndex`) ?? null;
  const focusedIndex = useVariable<number>('carousel', `${layoutId}.focusedIndex`) ?? 0;
  const childCount = useVariable<number>('carousel', `${layoutId}.childCount`) ?? 0;

  const clearSelection = useCallback(() => {
    store.set('carousel', `${layoutId}.selectedIndex`, null);
  }, [store, layoutId]);

  return { selectedIndex, focusedIndex, childCount, clearSelection };
}
```

**Consumer usage for reverse animation:**

```typescript
const { selectedIndex, clearSelection } = useCarouselSelection('products');

const handleClose = () => {
  clearSelection();  // triggers reactive update → reverse animation plays
  engine.beginTransition(engine.getSceneProgress('product-picker'), 400);
};
```

---

## Engine Addition: `getSceneProgress(sceneId)`

Scene navigation by name requires mapping a scene id to an engine progress value. This is essential for the "select item → navigate to detail scene" pattern.

**Pure function** (in `compiler/sceneTrackHelpers.ts`):

```typescript
import type { SceneTrack } from './sceneTrackTypes';

export function getSceneProgressFromTrack(track: SceneTrack, sceneId: string): number {
  const window = track.sceneWindows.find(w => w.id === sceneId);
  if (!window) throw new Error(`Scene "${sceneId}" not found in compiled track.`);
  return window.start;
}
```

**Engine convenience method** (on `UseSceneEngineResult`, delegates to the pure function):

```typescript
getSceneProgress(sceneId: string): number;
```

Returns the engine progress value `[0..1]` corresponding to the start of the named scene. Throws if `sceneId` is not found in the compiled track (fail-fast over silent bugs).

The pure function is usable by widget implementations, non-React code (Node.js tooling, SSR, build scripts), and test code that needs to compute expected progress values without instantiating an engine.

**Implementation:** The data already exists — `sceneTrack.sceneWindows` is an array of `SceneWindow` objects, each with `{ id, index, start, end }` where `start` is the engine progress value at the beginning of that scene.

> **Note:** The earlier draft referenced `progressMapper.sceneStartProgress(entry.index)` — this method does not exist. `SceneProgressMapper` only has `remap()` and `inverse()`. The correct data source is `SceneWindow.start`, which is already in engine progress space.

---

## How `onSelect` Survives Compilation

The DSL compiles to `SceneFrame[]` → baked `SceneTrack`. Functions cannot be baked into the flat tick array. The `onSelect` callback requires a **side-channel** that persists from compilation to runtime.

**Approach: Interaction callback registry**

1. During compilation, when the `ViewLayout` handler encounters an `onSelect` prop:
   - The callback is extracted from the props
   - It is **not** included in the `ViewLayoutState` (which is pure data)
   - Instead, it is stored in a `Map<string, CarouselSelectHandler>` keyed by `layoutId`
   - This map lives on the compilation result alongside the `SceneTrack`

2. At runtime, `InputCoordinator` holds a reference to this registry. When a selection is triggered within a carousel layout's NVS bounds (pointer click, keyboard Enter/Space):
   - Look up the handler by `layoutId`
   - Build the `CarouselSelectEvent` (index from VariableStore, viewId from compiled state, position from pointer event or null for keyboard, source from trigger type)
   - Invoke the handler
   - If `preventDefault()` was not called, let the event fall through to the normal input dispatch waterfall

This follows the same separation pattern as `SceneInputControllerSpec` — configuration extracted during compilation, consumed at runtime, but not baked into the tick array.

**Alternative considered:** Store callbacks in VariableStore. Rejected — VariableStore holds `JsonPrimitive` values, not functions. It's the wrong abstraction.

---

## Consumer Response Patterns

The toolkit provides the `onSelect` signal and `useCarouselSelection` hook. What happens after is the consumer's business. Four natural patterns:

### Pattern A: Scene Navigation (most common)

```typescript
<ViewLayout
  kind="carousel"
  id="products"
  focusedIndex={0}
  loop
  onSelect={(event) => {
    event.preventDefault();
    const targetScene = `product-detail-${event.viewId}`;
    engine.beginTransition(engine.getSceneProgress(targetScene), 600);
  }}
>
```

### Pattern B: React Overlay

```typescript
const [detailItem, setDetailItem] = useState<string | null>(null);

<ViewLayout
  kind="carousel"
  id="products"
  focusedIndex={0}
  loop
  onSelect={(event) => {
    event.preventDefault();
    setDetailItem(event.viewId);
  }}
>
  {/* ... */}
</ViewLayout>

{detailItem && (
  <ProductDetailPanel
    productId={detailItem}
    onClose={() => setDetailItem(null)}
  />
)}
```

### Pattern C: In-Canvas Zoom

```typescript
onSelect={(event) => {
  event.preventDefault();
  const viewBounds = engine.resolveWidgetState(event.viewId)?.bounds;
  engine.setCameraOverride(computeFocusCamera(viewBounds));
}}
```

### Pattern D: Hybrid (navigate + overlay)

Both scene navigation and a React overlay, reacting to the same click.

---

## Carousel Placement (Already Supported — No Changes)

```tsx
{/* Upper-right corner — thumbnail picker */}
<ViewLayout kind="carousel" id="picker"
            x={0.6} y={0} w={0.4} h={0.3}
            focusedIndex={0} loop onSelect={handleSelect}>
  {/* ... */}
</ViewLayout>

{/* Full-width hero carousel */}
<ViewLayout kind="carousel" id="hero"
            focusedIndex={0} loop zStep={2}
            onSelect={handleSelect}>
  {/* ... */}
</ViewLayout>
```

---

## What the Toolkit Needs to Build

### New Additions

1. **`onSelect` prop on `ViewLayoutProps`** — `(event: CarouselSelectEvent) => void`
2. **`CarouselSelectEvent` type** — rich event with index, viewId, layoutId, position, source (`'pointer' | 'keyboard' | 'programmatic'`), childCount, preventDefault()
3. **Interaction callback registry** — side-channel from compilation to runtime for onSelect handlers (Map keyed by layoutId)
4. **Selection detection in `ActionInputController`** — spatial gating against carousel layout bounds for pointer clicks, invoke registered handler
5. **Keyboard selection dispatch** — Enter/Space on focused carousel item fires onSelect with `source: 'keyboard'`
6. **`useCarouselSelection(layoutId)` hook** — reactive read of `{ selectedIndex, focusedIndex, childCount, clearSelection() }`
7. **`clearCarouselSelection(layoutId)` function** — programmatic deselect for reverse animations
8. **`getSceneProgressFromTrack(track, sceneId)` pure function** — in `compiler/sceneTrackHelpers.ts`, zero dependencies, testable outside React
9. **`getSceneProgress(sceneId)` convenience method on engine** — delegates to `getSceneProgressFromTrack` using the compiled `sceneTrack`
10. **Focus ring highlight** — deferred to v2. Consumers can use `useCarouselSelection().focusedIndex` with the existing `<Highlight>` DSL or custom CSS for manual focus indicators

### Naming Migration

11. **Rename `activeIndex` → `focusedIndex`** across ViewLayout props, CarouselLayoutConfig, VariableStore keys, and useCarouselState
12. **Deprecation shim** — `activeIndex` prop still works for one minor release with a console warning

### Semver Impact

**Minor release** — all additions are backward compatible. The `activeIndex` rename ships as a deprecation (old name still works). Breaking removal of `activeIndex` deferred to the next major.

---

## Risks

1. **Callback registry lifecycle** — Callbacks must be cleaned up when scenes are recompiled or unmounted. The registry needs to be scoped to the current compilation result, not leaked across hot reloads.
2. **Spatial gating accuracy** — Click detection depends on accurate NVS bounds for the carousel layout. If bounds are stale (e.g., after a resize), clicks may misfire. The existing carousel spatial gating for `carousel.next`/`carousel.prev` already handles this — reuse the same bounds source.
3. **API regret on event shape** — `CarouselSelectEvent` is a new public type. Adding fields later is safe (minor), but removing fields is a break. Keep the surface lean in v1; add fields (like `velocity`, `timestamp`) in later minors if needed.
4. **`onSelect` on non-carousel ViewLayouts** — Should `onSelect` work on `kind="stack"` too? For now, scope to carousel only. Stack selection semantics are different (which item was selected?) and can be designed separately.
5. **VariableStore `JsonPrimitive` constraint for `selectedIndex`** — `VariableStore.set()` accepts `JsonPrimitive` (string | number | boolean | null). The note proposes storing `selectedIndex` as `number | null` via VariableStore. `null` is a valid `JsonPrimitive`, so this works. However, `clearCarouselSelection` sets `null` — VariableStore listeners fire on `===` equality, and `null === null` is true, so re-clearing an already-null `selectedIndex` is correctly a no-op. Confirmed safe.
6. **Keyboard focus management** — The ARIA listbox pattern (Tab focuses carousel as a unit, ArrowKeys navigate within) avoids the Tab hijacking problem identified during review. However, the implementation must ensure the carousel container is properly focusable (`tabindex="0"`) and that ARIA attributes (`role="listbox"`, `aria-activedescendant`) are set correctly for screen reader compatibility. This is a rendering/DOM concern that the architect must address.
7. **Existing click handlers on the canvas** — `ActionInputController` already handles `click` events on the canvas and has an overlay click-forwarding mechanism (`forwardClickToOverlayElement`). The carousel `onSelect` handler must integrate into this existing click dispatch waterfall — specifically, it should fire *before* `forwardClickToOverlayElement` but *after* the overlay hit-test. If the click lands on an overlay element (e.g., a close button), it should not trigger carousel selection.
8. **`preventDefault()` interaction with ActionInputController's existing event handling** — The note's `preventDefault()` on `CarouselSelectEvent` is a custom property, not the native `Event.preventDefault()`. The implementation must ensure that when `preventDefault()` is called, the event does not also trigger any `PointerMap` actions with `event: 'click'` that may be registered on the same canvas. The ActionInputController's `handleClick` method iterates all actions — the carousel selection check must short-circuit before that loop when `preventDefault()` is invoked.
9. **SSR safety** — `useCarouselSelection` and `clearCarouselSelection` depend on `VariableStore` which is a plain class with no browser APIs — SSR-safe. The callback registry is scoped to compilation results, which only exist client-side. No SSR concerns identified.

---

## Summary

The carousel-as-selection-region feature centers on a single, natural API: **`onSelect` on `ViewLayout`**. The developer writes a callback, gets a rich typed `CarouselSelectEvent` with a discriminated `source` field, and decides what "full screen" means for their application. The toolkit handles selection detection (pointer and keyboard via the ARIA listbox pattern), spatial gating, and event fall-through. Consumer response patterns (scene navigation, React overlays, camera zoom, hybrids) compose naturally on top of `onSelect` + `useCarouselSelection` + `getSceneProgress`.

The `activeIndex` → `focusedIndex` rename cleans up naming before selection makes it confusing, shipped as a non-breaking deprecation.

Total toolkit scope: ~10 additions, all backward compatible, minor semver.

---

## Example: `carousel-selection-demo`

A new example at `apps/examples/src/carousel-selection/` demonstrates the full carousel-as-selection-region pattern. It exercises all three response patterns (scene navigation, React overlay, nested scroll stage) and programmatic deselect.

### Example Overview

A **main picker scene** presents a 3-view carousel. Each view represents a different content type. Clicking a view triggers a different "full screen" response:

| View Index | View ID | Content in Carousel | Full-Screen Response |
|---|---|---|---|
| 0 | `chart-view` | Bar chart (revenue breakdown) | **Scene navigation** — transitions to a dedicated full-screen chart scene within the same engine |
| 1 | `diagram-view` | Architecture diagram (compact) | **Scene navigation** — transitions to a dedicated full-screen diagram scene within the same engine |
| 2 | `explorer-view` | Preview card (static text/graphic) | **React overlay** — mounts a separate `SceneEngine` + `ScrollStage` with its own inner carousel |

All three full-screen states include a **close/back button** that triggers programmatic deselect + reverse navigation.

### File Structure

```
apps/examples/src/carousel-selection/
├── CarouselSelectionPage.tsx          # Page component, route entry point
├── scenes/
│   ├── scenePicker.tsx                # Main picker scene (the 3-view carousel)
│   ├── sceneChartDetail.tsx           # Full-screen chart scene (view 0 target)
│   ├── sceneDiagramDetail.tsx         # Full-screen diagram scene (view 1 target)
│   └── sceneShared.tsx                # Shared camera, lighting, floor config
├── overlays/
│   ├── ExplorerOverlay.tsx            # React overlay for view 2 (nested scroll stage)
│   └── FullScreenCloseButton.tsx      # Reusable close/back button component
└── data/
    └── sampleData.ts                  # Chart data + diagram node definitions
```

### Scene 1: The Picker (`scenePicker.tsx`)

The main carousel scene. Three views arranged in a loop carousel with tray and highlights.

```tsx
import type { JSX } from 'react';
import {
  Action, Ambient, Camera, CarouselTray, Directional, Floor, Highlight,
  InputController, KeyMap, Lighting, PointerMap, ProgressManager,
  Scene, TextBox, View, ViewLayout,
  type CarouselSelectEvent,
} from '@brewsite/core';
import { BarChart, ChartAxis, ChartData, ChartSeries } from '@brewsite/charts';
import {
  Diagram, DiagramEdge, DiagramGroup, DiagramNode, FlowLayout,
} from '@brewsite/diagram';
import { revenueData } from '../data/sampleData';

const CAM_POS: [number, number, number] = [0, 1.2, 7];
const CAM_TGT: [number, number, number] = [0, 0, 0];

type PickerSceneProps = {
  onSelect: (event: CarouselSelectEvent) => void;
};

export const PickerScene = ({ onSelect }: PickerSceneProps): JSX.Element => (
  <Scene id="picker" primaryCarouselId="showcase">
    <ProgressManager scrollUnits={800} />
    <Camera mode="world" position={CAM_POS} target={CAM_TGT} fov={42} />
    <Lighting intensityScale={1.2}>
      <Ambient intensity={2.5} color="#d7e5ff" />
      <Directional intensity={1.2} color="#ffffff" position={[3, 5, 4]} />
    </Lighting>
    <Floor variant="grid" negativeZExtent={20} />

    <InputController scope="canvas">
      <Action id="carousel-next" type="carousel.next" layoutId="showcase" stepSlides={1}>
        <KeyMap keyName="ArrowRight" />
      </Action>
      <Action id="carousel-prev" type="carousel.prev" layoutId="showcase" stepSlides={1}>
        <KeyMap keyName="ArrowLeft" />
      </Action>
    </InputController>

    <ViewLayout
      id="showcase"
      kind="carousel"
      loop
      focusedIndex={0}
      zStep={12}
      fadeMin={0.2}
      spread={0.65}
      x={0.05} w={0.9}
      onSelect={onSelect}
    >
      {/* View 0: Chart preview */}
      <View id="chart-view" w={0.42} h={0.52}>
        <BarChart id="picker-chart" data={revenueData} x={0} y={0} w={1} h={1} depth={0.3}>
          <ChartData keyField="quarter" />
          <ChartAxis axis="x" field="quarter" label="Quarter" />
          <ChartAxis axis="y" field="revenue" label="Revenue ($k)" />
          <ChartSeries field="revenue" label="Revenue" />
          <ChartSeries field="costs" label="Costs" />
        </BarChart>
      </View>

      {/* View 1: Diagram preview */}
      <View id="diagram-view" w={0.42} h={0.52}>
        <Diagram id="picker-diagram" x={0} y={0} w={1} h={1} scale={1.2}>
          <FlowLayout direction="top-down" gap={1.0} />
          <DiagramNode id="api" label="API Gateway" sublabel="REST + gRPC" size={[6, 1.8]} />
          <DiagramGroup id="services" label="Services" variant="cluster">
            <FlowLayout direction="left-right" gap={0.8} />
            <DiagramNode id="auth" label="Auth" size={[3.5, 1.5]} />
            <DiagramNode id="billing" label="Billing" size={[3.5, 1.5]} />
            <DiagramNode id="notify" label="Notify" size={[3.5, 1.5]} />
          </DiagramGroup>
          <DiagramNode id="db" label="Database" sublabel="PostgreSQL" size={[6, 1.8]} />
          <DiagramEdge from="api" to="services" routing="flow" flow="forward" />
          <DiagramEdge from="services" to="db" routing="flow" flow="forward" />
        </Diagram>
      </View>

      {/* View 2: Explorer preview (static card — full content is in overlay) */}
      <View id="explorer-view" w={0.42} h={0.52}>
        <BarChart id="picker-explorer-preview" data={revenueData} x={0} y={0} w={1} h={1} depth={0.3}>
          <ChartData keyField="quarter" />
          <ChartAxis axis="x" field="quarter" label="Quarter" />
          <ChartAxis axis="y" field="revenue" label="Revenue ($k)" />
          <ChartSeries field="revenue" label="Revenue" />
        </BarChart>
      </View>

      <CarouselTray metalness={0.1} />
      <Highlight viewId="chart-view" variant="primary" mode="glow" intensity={0.6} />
      <Highlight viewId="diagram-view" variant="warning" mode="holographic" smoke beamHeight={3} />
      <Highlight viewId="explorer-view" variant="error" mode="glow" intensity={0.5} />
    </ViewLayout>

    {/* Title overlay */}
    <TextBox id="picker-title" x={0.02} y={0.04} w={0.35} h={0.10} layer={3}>
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '0 14px', background: 'rgba(4,12,28,0.85)', backdropFilter: 'blur(14px)',
        borderRadius: 8, border: '1px solid rgba(70,130,220,0.3)', boxSizing: 'border-box',
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#c8deff' }}>
          Selection Carousel
        </div>
        <div style={{ fontSize: 11, color: 'rgba(140,180,255,0.6)' }}>
          Click or press Enter to expand · Esc or ✕ to close
        </div>
      </div>
    </TextBox>
  </Scene>
);
```

### Scene 2: Chart Detail (`sceneChartDetail.tsx`)

Full-screen version of the chart. Navigated to when the user clicks `chart-view`. Same chart ID so the bars morph seamlessly from the thumbnail to the full-screen layout.

```tsx
import type { JSX } from 'react';
import {
  Camera, Floor, Lighting, Ambient, Directional, ProgressManager, Scene,
} from '@brewsite/core';
import {
  BarChart, ChartAxis, ChartData, ChartDataLabels, ChartLegend,
  ChartSeries, ChartTooltip,
} from '@brewsite/charts';
import { revenueData } from '../data/sampleData';

const CAM_POS: [number, number, number] = [0, 1.5, 6];
const CAM_TGT: [number, number, number] = [0, 0.3, 0];

export const ChartDetailScene = (): JSX.Element => (
  <Scene id="detail-chart-view">
    <ProgressManager scrollUnits={800} />
    <Camera mode="world" position={CAM_POS} target={CAM_TGT} fov={38} />
    <Lighting intensityScale={1.3}>
      <Ambient intensity={2.8} color="#d7e5ff" />
      <Directional intensity={1.5} color="#ffffff" position={[3, 5, 4]} />
    </Lighting>
    <Floor variant="grid" negativeZExtent={20} />

    <BarChart
      id="picker-chart"
      data={revenueData}
      x={0.08} y={0.05} w={0.84} h={0.85}
      depth={0.45}
      interactive
    >
      <ChartData keyField="quarter" />
      <ChartAxis axis="x" field="quarter" label="Quarter" />
      <ChartAxis axis="y" field="revenue" label="Revenue ($k)" />
      <ChartSeries field="revenue" label="Revenue" />
      <ChartSeries field="costs" label="Costs" />
      <ChartSeries field="profit" label="Profit" />
      <ChartLegend visible position="right" />
      <ChartDataLabels position="top" format=".0f" />
      <ChartTooltip projection />
    </BarChart>
  </Scene>
);
```

**Key detail:** The chart id `"picker-chart"` matches the one in the picker carousel view. When the engine transitions between scenes, the chart widget recognizes the same ID and performs datum-level bar morphing — the bars smoothly grow from the small carousel thumbnail into the full-screen layout. This is existing behavior, no new code needed.

### Scene 3: Diagram Detail (`sceneDiagramDetail.tsx`)

Full-screen version of the architecture diagram. Same diagram ID (`"picker-diagram"`) so nodes/edges animate from their compact carousel positions to the expanded full-screen layout.

```tsx
import type { JSX } from 'react';
import {
  Camera, Floor, Lighting, Ambient, Directional, ProgressManager, Scene,
} from '@brewsite/core';
import {
  Diagram, DiagramEdge, DiagramGroup, DiagramNode, FlowLayout, GridLayout,
} from '@brewsite/diagram';

const CAM_POS: [number, number, number] = [0, 1.5, 6];
const CAM_TGT: [number, number, number] = [0, 0.3, 0];

export const DiagramDetailScene = (): JSX.Element => (
  <Scene id="detail-diagram-view">
    <ProgressManager scrollUnits={800} />
    <Camera mode="world" position={CAM_POS} target={CAM_TGT} fov={38} />
    <Lighting intensityScale={1.3}>
      <Ambient intensity={2.8} color="#d7e5ff" />
      <Directional intensity={1.5} color="#ffffff" position={[3, 5, 4]} />
    </Lighting>
    <Floor variant="grid" negativeZExtent={20} />

    {/* Same diagram ID as picker — nodes morph from compact to expanded */}
    <Diagram id="picker-diagram" x={0.05} y={0.02} w={0.9} h={0.92} scale={1.0}>
      <FlowLayout direction="top-down" gap={1.2} />

      <DiagramNode id="api" label="API Gateway" sublabel="REST + gRPC · rate limiting · auth" size={[9, 2.2]}
        glow={{ intensity: 0.12 }} />

      <DiagramGroup id="services" label="Microservices" variant="container">
        <GridLayout columns={3} spacing={[1.5, 0.9]} />

        <DiagramNode id="auth" label="Auth Service"
          sublabel="OAuth 2.0 · JWT · MFA" size={[5.5, 2.0]} />
        <DiagramNode id="billing" label="Billing Service"
          sublabel="Stripe · invoices · usage" size={[5.5, 2.0]} />
        <DiagramNode id="notify" label="Notification Service"
          sublabel="email · SMS · push" size={[5.5, 2.0]} />
      </DiagramGroup>

      <DiagramNode id="db" label="Database Cluster"
        sublabel="PostgreSQL · read replicas · connection pooling" size={[9, 2.2]} />

      <DiagramEdge from="api" to="auth" routing="flow" flow="forward" />
      <DiagramEdge from="api" to="billing" routing="flow" flow="forward" />
      <DiagramEdge from="api" to="notify" routing="flow" flow="forward" />
      <DiagramEdge from="auth" to="db" routing="flow" flow="forward" />
      <DiagramEdge from="billing" to="db" routing="flow" flow="forward" />
      <DiagramEdge from="notify" to="db" routing="flow" flow="forward" />
    </Diagram>
  </Scene>
);
```

**Key detail:** The diagram ID `"picker-diagram"` and node IDs (`"api"`, `"auth"`, `"billing"`, etc.) match those in the picker carousel. Diagram nodes animate from compact layout positions to the expanded grid, and new sublabel text fades in. Existing diagram transition behavior — no new code.

### View 2 Response: Explorer Overlay (`ExplorerOverlay.tsx`)

When the user clicks `explorer-view`, a React overlay mounts on top of the main canvas. This overlay contains its own `SceneEngine` + `ScrollStage` with a small inner carousel — demonstrating that the full-screen response can be an entirely separate React experience.

```tsx
import type { JSX } from 'react';
import { useMemo } from 'react';
import {
  corePlugin, SceneEngine, SceneCanvas, ScrollStage, InputCoordinator,
  BackgroundLayer, EngineARContainer, EngineOverlayHost,
  Scene, Camera, Lighting, Ambient, Directional, Floor, ProgressManager,
  View, ViewLayout, CarouselTray, Action, InputController, KeyMap,
  type WidgetPlugin, type ActiveTheme,
} from '@brewsite/core';
import { chartPlugin, BarChart, ChartAxis, ChartData, ChartSeries, LineChart } from '@brewsite/charts';
import { themesPlugin } from '@brewsite/themes';
import { FullScreenCloseButton } from './FullScreenCloseButton';

const innerData1 = [
  { label: 'Mon', value: 42 }, { label: 'Tue', value: 58 },
  { label: 'Wed', value: 35 }, { label: 'Thu', value: 71 },
];
const innerData2 = [
  { label: 'Mon', value: 22 }, { label: 'Tue', value: 48 },
  { label: 'Wed', value: 65 }, { label: 'Thu', value: 31 },
];
const innerData3 = [
  { label: 'Mon', value: 55 }, { label: 'Tue', value: 33 },
  { label: 'Wed', value: 44 }, { label: 'Thu', value: 66 },
];

function createExplorerPlugins(): { plugins: WidgetPlugin[] } {
  return { plugins: [corePlugin(), chartPlugin(), themesPlugin()] };
}

const InnerPickerScene = (): JSX.Element => (
  <Scene id="inner-picker" primaryCarouselId="inner-carousel">
    <ProgressManager scrollUnits={600} />
    <Camera mode="world" position={[0, 1, 6]} target={[0, 0, 0]} fov={42} />
    <Lighting intensityScale={1.0}>
      <Ambient intensity={2.5} color="#ffe8d7" />
      <Directional intensity={1.0} color="#ffffff" position={[2, 4, 3]} />
    </Lighting>
    <Floor variant="grid" negativeZExtent={15} />

    <InputController scope="canvas">
      <Action id="inner-next" type="carousel.next" layoutId="inner-carousel" stepSlides={1}>
        <KeyMap keyName="ArrowRight" />
      </Action>
      <Action id="inner-prev" type="carousel.prev" layoutId="inner-carousel" stepSlides={1}>
        <KeyMap keyName="ArrowLeft" />
      </Action>
    </InputController>

    <ViewLayout id="inner-carousel" kind="carousel" loop focusedIndex={0} zStep={8} fadeMin={0.3}>
      <View id="inner-1" w={0.4} h={0.5}>
        <BarChart id="inner-bar" data={innerData1} x={0} y={0} w={1} h={1} depth={0.25}>
          <ChartData keyField="label" />
          <ChartAxis axis="x" field="label" label="Day" />
          <ChartAxis axis="y" field="value" label="Count" />
          <ChartSeries field="value" label="Daily" />
        </BarChart>
      </View>
      <View id="inner-2" w={0.4} h={0.5}>
        <LineChart id="inner-line" data={innerData2} x={0} y={0} w={1} h={1}
          lineShape="circle" lineSmoothness={0.5} showPoints depth={0.25}>
          <ChartData keyField="label" />
          <ChartAxis axis="x" field="label" label="Day" />
          <ChartAxis axis="y" field="value" label="Count" />
          <ChartSeries field="value" label="Weekly" />
        </LineChart>
      </View>
      <View id="inner-3" w={0.4} h={0.5}>
        <BarChart id="inner-bar-2" data={innerData3} x={0} y={0} w={1} h={1}
          orientation="horizontal" depth={0.25}>
          <ChartData keyField="label" />
          <ChartAxis axis="x" field="label" label="Day" />
          <ChartAxis axis="y" field="value" label="Amount" />
          <ChartSeries field="value" label="Monthly" />
        </BarChart>
      </View>
      <CarouselTray metalness={0.15} />
    </ViewLayout>
  </Scene>
);

type ExplorerOverlayProps = {
  onClose: () => void;
};

export const ExplorerOverlay = ({ onClose }: ExplorerOverlayProps): JSX.Element => {
  const { plugins } = useMemo(() => createExplorerPlugins(), []);
  const theme = useMemo((): ActiveTheme => ({ family: 'darkGlass', polarity: 'dark' }), []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column',
    }}>
      <FullScreenCloseButton onClick={onClose} />
      <div style={{ flex: 1, position: 'relative' }}>
        <SceneEngine plugins={plugins} theme={theme}>
          <InnerPickerScene />
          <ScrollStage scrollHeightMode="scene-count" pixelsPerScene={400}>
            <EngineARContainer aspectRatio={16 / 9} scaleMode="fit-width">
              <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
              <SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
              <EngineOverlayHost />
            </EngineARContainer>
            <InputCoordinator inertiaSensitivity={0.012} inertiaDecay={0.85} />
          </ScrollStage>
        </SceneEngine>
      </div>
    </div>
  );
};
```

### Close Button (`FullScreenCloseButton.tsx`)

Reusable close button used by chart/diagram detail scenes (as an overlay) and the explorer overlay.

```tsx
import type { JSX } from 'react';

type Props = { onClick: () => void };

export const FullScreenCloseButton = ({ onClick }: Props): JSX.Element => (
  <button
    onClick={onClick}
    style={{
      position: 'absolute', top: 16, right: 16, zIndex: 110,
      width: 40, height: 40, borderRadius: '50%',
      background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)',
      color: '#fff', fontSize: 18, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(8px)', transition: 'background 0.2s',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,60,60,0.7)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.6)'; }}
    aria-label="Close full-screen view"
  >
    ✕
  </button>
);
```

### Page Component (`CarouselSelectionPage.tsx`)

Wires everything together. Handles `onSelect` routing, scene navigation for views 0 and 1, and overlay mounting for view 2.

```tsx
import type { JSX } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  corePlugin, SceneEngine, SceneCanvas, ScrollStage, InputCoordinator,
  BackgroundLayer, EngineARContainer, EngineOverlayHost,
  useSceneEngine, type CarouselSelectEvent, type WidgetPlugin,
  type ScrollStageHandle, type ActiveTheme,
} from '@brewsite/core';
import { chartPlugin, ChartTooltipHost } from '@brewsite/charts';
import { diagramPlugin } from '@brewsite/diagram';
import { themesPlugin } from '@brewsite/themes';

import { PickerScene } from './scenes/scenePicker';
import { ChartDetailScene } from './scenes/sceneChartDetail';
import { DiagramDetailScene } from './scenes/sceneDiagramDetail';
import { ExplorerOverlay } from './overlays/ExplorerOverlay';
import { FullScreenCloseButton } from './overlays/FullScreenCloseButton';

function createPlugins(): { plugins: WidgetPlugin[] } {
  return {
    plugins: [corePlugin(), chartPlugin(), diagramPlugin(), themesPlugin()],
  };
}

/**
 * Inner component that has access to the scene engine via useSceneEngine().
 * Must be rendered inside <SceneEngine>.
 */
function SelectionHandler(): JSX.Element | null {
  const engine = useSceneEngine();
  const [showExplorer, setShowExplorer] = useState(false);
  const [isDetail, setIsDetail] = useState(false);

  const handleSelect = useCallback((event: CarouselSelectEvent) => {
    event.preventDefault();

    if (event.viewId === 'chart-view' || event.viewId === 'diagram-view') {
      // Pattern A: Scene navigation — transition to the matching detail scene
      const targetSceneId = `detail-${event.viewId}`;
      const targetProgress = engine.getSceneProgress(targetSceneId);
      engine.beginTransition(targetProgress, 600);
      setIsDetail(true);
    } else if (event.viewId === 'explorer-view') {
      // Pattern B: React overlay — mount a separate scroll stage
      setShowExplorer(true);
    }
  }, [engine]);

  const handleBack = useCallback(() => {
    const pickerProgress = engine.getSceneProgress('picker');
    engine.beginTransition(pickerProgress, 400);
    setIsDetail(false);
  }, [engine]);

  const handleCloseExplorer = useCallback(() => {
    setShowExplorer(false);
  }, []);

  return (
    <>
      {/* The picker scene receives onSelect as a prop */}
      <PickerScene onSelect={handleSelect} />
      <ChartDetailScene />
      <DiagramDetailScene />

      {/* Close button appears when viewing chart or diagram detail scenes */}
      {isDetail && <FullScreenCloseButton onClick={handleBack} />}

      {/* Explorer overlay mounts as a completely separate React experience */}
      {showExplorer && <ExplorerOverlay onClose={handleCloseExplorer} />}
    </>
  );
}

export default function CarouselSelectionPage(): JSX.Element {
  const { plugins } = useMemo(() => createPlugins(), []);
  const scrollStageRef = useRef<ScrollStageHandle | null>(null);
  const theme = useMemo((): ActiveTheme => ({
    family: 'darkGlass', polarity: 'dark',
  }), []);

  return (
    <div style={{
      position: 'relative', display: 'flex', flexFlow: 'column',
      height: '100vh', overflow: 'hidden',
      background: 'radial-gradient(circle at 50% 0%, #12345d 0%, #061326 42%, #020812 72%, #01040a 100%)',
    }}>
      <SceneEngine plugins={plugins} theme={theme}>
        <SelectionHandler />
        <ScrollStage ref={scrollStageRef} scrollHeightMode="scene-count" pixelsPerScene={500}>
          <EngineARContainer aspectRatio={9 / 9} scaleMode="fit-width">
            <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
            <SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
            <EngineOverlayHost passthroughPointerEvents>
              <ChartTooltipHost />
            </EngineOverlayHost>
          </EngineARContainer>
          <InputCoordinator inertiaSensitivity={0.012} inertiaDecay={0.85} />
        </ScrollStage>
      </SceneEngine>
    </div>
  );
}
```

### Sample Data (`data/sampleData.ts`)

```typescript
export const revenueData = [
  { quarter: 'Q1', revenue: 420, costs: 280, profit: 140 },
  { quarter: 'Q2', revenue: 580, costs: 310, profit: 270 },
  { quarter: 'Q3', revenue: 650, costs: 340, profit: 310 },
  { quarter: 'Q4', revenue: 720, costs: 360, profit: 360 },
];
```

### App.tsx Route Addition

Add to the existing `App.tsx`:

```tsx
const CarouselSelectionPage = lazy(() => import('./carousel-selection/CarouselSelectionPage'));

// In <Routes>:
<Route path="/carousel-selection" element={<CarouselSelectionPage />} />

// In the index link list:
<li><a href="/examples/carousel-selection">Carousel Selection — onSelect + Full Screen Patterns</a></li>
```

### What This Example Demonstrates

| Concept | Where |
|---|---|
| `onSelect` on `ViewLayout` | `scenePicker.tsx` — `onSelect` prop passed to `ViewLayout` |
| `CarouselSelectEvent` usage | `SelectionHandler` — reads `event.viewId`, calls `event.preventDefault()` |
| **Pattern A: Scene navigation** | Chart + Diagram views → `engine.getSceneProgress()` + `engine.beginTransition()` |
| **Pattern B: React overlay** | Explorer view → mounts `ExplorerOverlay` with its own `SceneEngine` |
| Programmatic deselect / back | `FullScreenCloseButton` → reverse `beginTransition()` back to picker scene |
| Same widget ID morphing | Chart ID `"picker-chart"` and diagram ID `"picker-diagram"` shared between picker and detail scenes — datum-level animation |
| Nested carousel in overlay | `ExplorerOverlay` has its own `ScrollStage` + `ViewLayout kind="carousel"` with 3 small chart views |
| Carousel navigation (existing) | Arrow keys, click, scroll — standard carousel input controller |
| Tray + highlight visuals | `CarouselTray` + `Highlight` on each view in the picker |

### Design Notes for the Example

1. **`SelectionHandler` is inside `SceneEngine`** — this is required because it calls `useSceneEngine()`. The scenes are siblings, not children, of the handler.

2. **The chart/diagram detail scenes use the same widget IDs** as the picker views. This is intentional — the engine's datum-level morphing makes the transition from carousel thumbnail to full-screen feel seamless. The bars grow, the diagram nodes rearrange, all animated automatically.

3. **The explorer overlay is a completely separate `SceneEngine`**. This proves that the "full screen" response can be anything — it doesn't have to stay in the same engine. The inner carousel in the overlay has its own input controller, its own scroll stage, its own carousel navigation.

4. **The close button is positioned as a fixed overlay** above the canvas. For chart/diagram detail, it lives in the `EngineOverlayHost` layer. For the explorer, it's part of the overlay's own DOM.

5. **No new toolkit code is needed for this example** beyond the `onSelect` prop, `CarouselSelectEvent` type, and `getSceneProgress()` helper described in the main design note. Everything else composes from existing primitives.

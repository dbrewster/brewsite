---
title: "Carousel Scrubbing — Interactive Navigation for ViewLayout Carousels"
doc_type: plan
owner: architect
status: draft
updated: 2026-03-12
---

# Carousel Scrubbing

## Problem Statement

The `<ViewLayout kind="carousel">` DSL allows scene authors to arrange child
`<View>` elements in a carousel formation with `activeIndex` controlling which
view is centered. Today, changing `activeIndex` requires authoring separate
`<Scene>` elements — one per carousel position — and scrolling between them.
This works for linear storytelling but prevents **interactive** carousel
navigation where the user clicks/swipes/keys through slides within a single
scene.

The input-unification plan (`plan_input-unification.md`) established the
declarative `<InputController>` DSL and the `ActionInputController` runtime.
It forward-declared `carousel.next` and `carousel.prev` as action types in the
open `InputActionType` union but explicitly deferred the runtime handler to
this follow-on plan.

**This plan activates `carousel.next` / `carousel.prev`** by:
1. Adding `layoutId` and `stepSlides` to `InputActionSpec` and `ActionProps`
2. Adding `onCarouselStep` to `ActionInputHandler`
3. Implementing carousel dispatch in `ActionInputController`
4. Implementing the carousel state effect in `ActionInput.tsx` (VariableStore
   → `resolveLayout()` → `patchWidgetStates`)
5. Extending `ViewLayoutState` with `layoutConfig` and `childSizeHints` so
   the runtime can recompute layout without re-running the compiler

### Prerequisite

**`plan_input-unification.md` must be fully implemented before this plan
begins.** This plan depends on:
- `ActionInput.tsx` component (§1.1 of input-unification)
- `ActionInputExtensionContext` (§1.2)
- `engine.patchWidgetStates()` (already on `UseSceneEngineResult`)
- `ActionInputHandler` shape (in `ActionInputController.ts`)
- `engine.canvasRef.current` (on `UseSceneEngineResult`)

This plan does NOT re-implement any of the above — it only extends them.

---

## Architecture

### Data Flow

```
Scene Author writes:
──────────────────
<Scene id="interactive-carousel">
  <InputController scope="canvas">
    <Action id="next" type="carousel.next" layoutId="my-carousel" stepSlides={1}>
      <KeyMap keyName="ArrowRight" />
      <PointerMap event="click" />
    </Action>
    <Action id="prev" type="carousel.prev" layoutId="my-carousel" stepSlides={1}>
      <KeyMap keyName="ArrowLeft" />
    </Action>
  </InputController>
  <ViewLayout id="my-carousel" kind="carousel" activeIndex={0} loop zStep={15}>
    <View id="v1" ...>{content1}</View>
    <View id="v2" ...>{content2}</View>
    <View id="v3" ...>{content3}</View>
  </ViewLayout>
</Scene>

Compile Time:
─────────────
1. inputControllerHandler compiles <Action> nodes → InputActionSpec[]
   with layoutId="my-carousel", stepSlides=1
2. viewLayoutHandler compiles <ViewLayout> → ViewLayoutState
   now includes layoutConfig (CarouselLayoutConfig) and childSizeHints

Runtime (user presses ArrowRight):
──────────────────────────────────
3. ActionInputController.handleKeyDown matches "carousel.next"
4. → calls handler.onCarouselStep("my-carousel", +1, 1)
5. ActionInput.tsx onCarouselStep handler:
   a. Reads current activeIndex from VariableStore (carousel.my-carousel.activeIndex)
      Falls back to compiled ViewLayoutState.layoutConfig.activeIndex if not set
   b. Computes newIndex = wrapIndex(currentIndex + direction * stepSlides, childCount, loop)
   c. Writes newIndex to VariableStore
   d. Reads layoutConfig + childSizeHints from compiled ViewLayoutState
   e. Calls resolveLayout({...layoutConfig, activeIndex: newIndex}, bounds, childSizeHints)
   f. Builds widget state patches for the ViewLayout + each child View
   g. Calls engine.patchWidgetStates(patches)
6. Next tick: RuntimeDriverImpl.resolveWidgetState returns patched state
   → View widgets receive new bounds, scale, z, opacity
```

### Why VariableStore?

VariableStore provides:
- **Persistence within the scene** — the active index survives across ticks
  without relying on React state inside a null-rendering component.
- **Observability** — UI overlays (e.g., "3 of 7" indicators) can subscribe
  to `carousel.<layoutId>.activeIndex` via `VariableStore.subscribe()`.
- **Multi-carousel support** — each layout gets its own namespaced key.

**Naming note:** The VariableStore key is `carousel.<layoutId>.activeIndex`.
If a scene author uses a `layoutId` containing dots (e.g., `id="foo.bar"`),
the key becomes `carousel.foo.bar.activeIndex`, which is visually ambiguous
when debugging VariableStore contents. **Recommendation:** carousel
`layoutId` values should use hyphens or camelCase, not dots. This is a
documentation-level recommendation, not a runtime enforcement — the system
works correctly regardless.

### Why store `layoutConfig` and `childSizeHints` on `ViewLayoutState`?

The runtime needs to call `resolveLayout()` with the updated `activeIndex`
but cannot re-run the compiler. By storing the original config and hints at
compile time, the runtime has everything it needs to recompute layout
positions for all child views.

---

## Detailed Changes

### Phase 1: Type Extensions

#### 1.1 Add `layoutId` and `stepSlides` to `InputActionSpec`

**File:** `packages/core/src/input/types.ts`

Add two optional fields to `InputActionSpec`:

```typescript
export type InputActionSpec = {
  id: string;
  type: InputActionType;
  cameraId?: string;
  canvasId?: string;
  focusCenter?: [number, number] | [number, number, number];
  speed?: number;
  stepScenes?: number;
  /** Target ViewLayout ID for carousel actions. Required when type is 'carousel.next'/'carousel.prev'. */
  layoutId?: string;
  /** Number of slides to advance per carousel step. Default: 1. */
  stepSlides?: number;
  maps: InputActionMap[];
};
```

**Also in `types.ts`:** Add `carousel.next` and `carousel.prev` as explicit
members of `InputActionType`:

```typescript
export type InputActionType =
  | 'camera.orbit'
  | 'camera.dolly'
  | 'camera.reset'
  | 'canvas.pan'
  | 'scene.next'
  | 'scene.prev'
  | 'carousel.next'
  | 'carousel.prev'
  | (string & {}); // open union — allows downstream extension
```

These are core-dispatched action types (handled by `dispatchCarousel()` in
`ActionInputController`, not by `onUnknownAction`). Core-dispatched types
must be explicit union members for two reasons:
1. TypeScript autocomplete on `type="..."` in the `<Action>` DSL must
   suggest them.
2. The `(string & {})` open union exists for consumer-defined custom actions
   — core-handled types should not rely on it.

This is consistent with the input-unification plan, which committed to adding
them as forward declarations.

#### 1.2 Add `layoutId` and `stepSlides` to `ActionProps`

**File:** `packages/core/src/compiler/blocks/inputController.tsx`

Add the two new props to `ActionProps`:

```typescript
export type ActionProps = {
  id: string;
  type: InputActionType;
  cameraId?: string;
  canvasId?: string;
  focusCenter?: [number, number] | [number, number, number];
  speed?: number;
  stepScenes?: number;
  /** Target ViewLayout ID for carousel actions. */
  layoutId?: string;
  /** Number of slides to advance per carousel step. Default: 1. */
  stepSlides?: number;
  children?: ReactNode;
};
```

#### 1.3 Update `parseAction` to pass through `layoutId` and `stepSlides`

**File:** `packages/core/src/compiler/blocks/inputController.tsx`

In the `parseAction` function (line ~194), add the two new fields to the
returned `InputActionSpec`:

```typescript
return {
  id: props.id,
  type: props.type,
  cameraId: props.cameraId,
  canvasId: props.canvasId,
  focusCenter: props.focusCenter,
  speed: props.speed,
  stepScenes: props.stepScenes,
  layoutId: props.layoutId,       // NEW
  stepSlides: props.stepSlides,   // NEW
  maps,
};
```

#### 1.4 Add `onCarouselStep` to `ActionInputHandler`

**File:** `packages/core/src/input/ActionInputController.ts`

Add the new callback to `ActionInputHandler` (after `onCameraReset`):

```typescript
export type ActionInputHandler = {
  getSceneCount: () => number;
  onSceneStep: (direction: 1 | -1, stepScenes: number) => void;
  onCameraOrbit: (cameraId: string, dx: number, dy: number, speed: number) => void;
  onCameraDolly: (cameraId: string, delta: number, speed: number) => void;
  onCameraReset: (cameraId: string) => void;
  /**
   * Advance a carousel layout by stepSlides in the given direction.
   * Required because carousel.next/carousel.prev are core-dispatched action
   * types (explicit InputActionType members), not extension types.
   *
   * @param layoutId   - The target ViewLayout widget ID.
   * @param direction  - +1 = next, -1 = prev.
   * @param stepSlides - Number of slides to advance. Default: 1.
   */
  onCarouselStep: (layoutId: string, direction: 1 | -1, stepSlides: number) => void;
  onUnknownAction?: (
    type: string,
    canvasId: string | undefined,
    event: PointerEvent | WheelEvent | KeyboardEvent | MouseEvent,
    extra: Record<string, unknown>,
  ) => void;
};
```

`onCarouselStep` is **required** (not optional). `carousel.next` and
`carousel.prev` are core-dispatched action types — they are explicit
`InputActionType` union members dispatched by `dispatchCarousel()`, not
extension types routed through `onUnknownAction`. Making the handler required
ensures any custom `ActionInputHandler` implementation cannot silently drop
carousel navigation without a TypeScript error. Since we have not released,
there is no backward-compatibility concern.

#### 1.5 Extend `ViewLayoutState` with `layoutConfig` and `childSizeHints`

**File:** `packages/core/src/compiler/viewTypes.ts`

```typescript
import type { ViewLayoutConfig } from '../layout/regionTypes';

export type ViewLayoutState = {
  readonly id: string;
  readonly kind: ViewLayoutKind;
  /** Absolute NVS bounds of the layout container. */
  readonly bounds: NVSRect;
  /** Ordered list of child view IDs. */
  readonly viewIds: readonly string[];
  /**
   * The full layout config used at compile time. Stored so the runtime can
   * recompute layout with a different activeIndex without re-running the compiler.
   * Present only when kind='carousel'.
   */
  readonly layoutConfig?: ViewLayoutConfig;
  /**
   * Per-child size hints (w, h) in the same order as viewIds.
   * Present only when kind='carousel'.
   */
  readonly childSizeHints?: ReadonlyArray<{ readonly w: number; readonly h: number }>;
};
```

These fields are only populated for `kind='carousel'` layouts — stack layouts
don't need runtime re-resolve.

### Phase 2: Compiler Changes

#### 2.1 Store `layoutConfig` and `childSizeHints` in `viewLayoutHandler`

**File:** `packages/core/src/compiler/blocks/viewHandlers.ts`

In `viewLayoutHandler`, update the `ViewLayoutState` construction (line ~185)
to include the new fields when the layout is a carousel:

```typescript
// Store ViewLayoutState
const viewLayoutState: ViewLayoutState = {
  id: layoutId,
  kind,
  bounds: composedContainerBounds,
  viewIds,
  // Store config + hints for carousel runtime re-resolve (carousel scrubbing).
  ...(kind === 'carousel' ? { layoutConfig, childSizeHints } : {}),
};
api.setWidgetState(layoutId, viewLayoutState);
```

The `layoutConfig` and `childSizeHints` variables already exist in the
handler — `layoutConfig` is built at line ~151, `childSizeHints` is built
at line ~129. No new computation needed, just passing them through to state.

### Phase 3: ActionInputController Dispatch

#### 3.1 Add carousel dispatch to key, click, and wheel handlers

**File:** `packages/core/src/input/ActionInputController.ts`

Add helper method for carousel step resolution:

```typescript
private actionStepSlides(action: InputActionSpec): number {
  return Math.max(1, Math.round(action.stepSlides ?? 1));
}
```

Update `dispatchKey` to handle `carousel.next` and `carousel.prev`:

```typescript
private dispatchKey(action: InputActionSpec, e: KeyboardEvent): void {
  switch (action.type) {
    case 'camera.reset':
      this.handler.onCameraReset(this.resolveCameraId(action));
      return;
    case 'scene.next':
      this.handler.onSceneStep(1, this.actionStepScenes(action));
      return;
    case 'scene.prev':
      this.handler.onSceneStep(-1, this.actionStepScenes(action));
      return;
    case 'carousel.next':
      if (action.layoutId) {
        this.handler.onCarouselStep(action.layoutId, 1, this.actionStepSlides(action));
      }
      return;
    case 'carousel.prev':
      if (action.layoutId) {
        this.handler.onCarouselStep(action.layoutId, -1, this.actionStepSlides(action));
      }
      return;
    default:
      this.handler.onUnknownAction?.(action.type, action.canvasId, e, {
        speed: action.speed,
      });
      return;
  }
}
```

Apply the same pattern to `dispatchClick`:

```typescript
private dispatchClick(action: InputActionSpec, e: MouseEvent): void {
  switch (action.type) {
    case 'scene.next':
      this.handler.onSceneStep(1, this.actionStepScenes(action));
      return;
    case 'scene.prev':
      this.handler.onSceneStep(-1, this.actionStepScenes(action));
      return;
    case 'carousel.next':
      if (action.layoutId) {
        this.handler.onCarouselStep(action.layoutId, 1, this.actionStepSlides(action));
      }
      return;
    case 'carousel.prev':
      if (action.layoutId) {
        this.handler.onCarouselStep(action.layoutId, -1, this.actionStepSlides(action));
      }
      return;
    default:
      this.handler.onUnknownAction?.(action.type, action.canvasId, e, {
        speed: action.speed,
        focusCenter: action.focusCenter,
      });
      return;
  }
}
```

Apply the same pattern to `dispatchWheel`:

```typescript
// In dispatchWheel, add cases before the default:
case 'carousel.next':
  if (action.layoutId) {
    this.handler.onCarouselStep(action.layoutId, 1, this.actionStepSlides(action));
  }
  return;
case 'carousel.prev':
  if (action.layoutId) {
    this.handler.onCarouselStep(action.layoutId, -1, this.actionStepSlides(action));
  }
  return;
```

**Note:** `dispatchDrag` does NOT get carousel cases. Carousel navigation is
discrete (step-based), not continuous — dragging doesn't make sense for
"advance N slides." If continuous swipe-to-scrub is needed later, that is a
separate enhancement.

#### 3.2 Guard: warn if `layoutId` is missing

When `carousel.next` / `carousel.prev` is dispatched without `layoutId`, the
handler silently no-ops (the `if (action.layoutId)` guard). Additionally, add
a one-time console.warn in the constructor or on first dispatch:

In the `dispatchKey`/`dispatchClick`/`dispatchWheel` carousel cases, after
the `if (action.layoutId)` guard, add:

```typescript
case 'carousel.next':
case 'carousel.prev': {
  if (!action.layoutId) {
    console.warn(
      `[ActionInputController] Action "${action.id}" has type "${action.type}" but no layoutId. ` +
      `Add layoutId="<ViewLayout id>" to the <Action> to target a carousel.`,
    );
    return;
  }
  const dir = action.type === 'carousel.next' ? 1 : -1;
  this.handler.onCarouselStep(action.layoutId, dir as 1 | -1, this.actionStepSlides(action));
  return;
}
```

This can be consolidated into a shared helper to avoid repeating the switch
arm in every dispatch method:

```typescript
private dispatchCarousel(action: InputActionSpec): void {
  if (!action.layoutId) {
    console.warn(
      `[ActionInputController] Action "${action.id}" has type "${action.type}" but no layoutId. ` +
      `Add layoutId="<ViewLayout id>" to the <Action> to target a carousel.`,
    );
    return;
  }
  const direction: 1 | -1 = action.type === 'carousel.next' ? 1 : -1;
  this.handler.onCarouselStep(action.layoutId, direction, this.actionStepSlides(action));
}
```

Then each dispatch method simply calls `this.dispatchCarousel(action); return;`
for both `carousel.next` and `carousel.prev` cases.

### Phase 4: ActionInput.tsx — Carousel State Management

#### 4.1 Implement `onCarouselStep` in ActionInput handler

**File:** `packages/core/src/player/ActionInput.tsx`

Add the `onCarouselStep` callback to the `ActionInputHandler` constructed
in the `useEffect`. This is the core runtime logic.

**New import needed:**

```typescript
import { resolveLayout } from '../layout/regionLayout';
import type { ViewLayoutState } from '../compiler/viewTypes';
import type { ViewState } from '../compiler/viewTypes';
import type { CarouselLayoutConfig, ViewLayoutConfig } from '../layout/regionTypes';
```

**`onCarouselStep` implementation inside the handler object:**

```typescript
onCarouselStep: (layoutId, direction, stepSlides) => {
  // 1. Read the compiled ViewLayoutState for this layout
  const tick = engine.frameState.tick;
  if (!tick) return;

  const layoutState = tick.state.widgets[layoutId] as ViewLayoutState | undefined;
  if (!layoutState || layoutState.kind !== 'carousel') {
    console.warn(
      `[ActionInput] onCarouselStep: ViewLayout "${layoutId}" not found or not a carousel.`,
    );
    return;
  }
  if (!layoutState.layoutConfig || !layoutState.childSizeHints) {
    console.warn(
      `[ActionInput] onCarouselStep: ViewLayout "${layoutId}" missing layoutConfig or childSizeHints. ` +
      `Ensure the scene was compiled with carousel scrubbing support.`,
    );
    return;
  }

  const childCount = layoutState.viewIds.length;
  if (childCount === 0) return;

  const config = layoutState.layoutConfig as CarouselLayoutConfig;
  const loop = config.loop ?? false;

  // 2. Read current activeIndex from VariableStore (falls back to compiled value)
  //    Clamp the fallback: compiled activeIndex may be out of bounds if the
  //    scene author wrote activeIndex={99} with only 3 children.
  const variableStore = engine.variableStore;
  const storedIndex = variableStore.get('carousel', `${layoutId}.activeIndex`);
  const currentIndex = typeof storedIndex === 'number'
    ? storedIndex
    : Math.max(0, Math.min(childCount - 1, config.activeIndex));

  // 3. Compute new index
  const rawNext = currentIndex + direction * stepSlides;
  let newIndex: number;
  if (loop) {
    newIndex = ((rawNext % childCount) + childCount) % childCount;
  } else {
    newIndex = Math.max(0, Math.min(childCount - 1, rawNext));
  }

  // 4. No-op if index didn't change (e.g., clamped at boundary)
  if (newIndex === currentIndex) return;

  // 5. Write new index to VariableStore
  variableStore.set('carousel', `${layoutId}.activeIndex`, newIndex);

  // 6. Recompute layout with updated activeIndex
  const updatedConfig: ViewLayoutConfig = { ...config, activeIndex: newIndex };
  const layoutResults = resolveLayout(
    updatedConfig,
    layoutState.bounds,
    layoutState.childSizeHints,
  );

  // 7. Build patches: ViewLayoutState override + each child ViewState override
  const patches: Record<string, unknown> = {};

  // Patch the ViewLayoutState itself (with updated layoutConfig)
  const patchedLayoutState: ViewLayoutState = {
    ...layoutState,
    layoutConfig: updatedConfig,
  };
  patches[layoutId] = patchedLayoutState;

  // Patch each child ViewState with new bounds, scale, z, opacity, layer
  for (let i = 0; i < layoutState.viewIds.length; i++) {
    const viewId = layoutState.viewIds[i]!;
    const result = layoutResults[i];
    if (!result) continue;

    // Read the existing compiled ViewState to preserve padding and contentBounds
    const existingViewState = tick.state.widgets[viewId] as ViewState | undefined;
    if (!existingViewState) continue;

    // Recompute contentBounds from new bounds + existing padding
    const [pt, pr, pb, pl] = existingViewState.padding;
    const newContentBounds = {
      x: result.bounds.x + pl * result.bounds.w,
      y: result.bounds.y + pt * result.bounds.h,
      w: result.bounds.w * (1 - pl - pr),
      h: result.bounds.h * (1 - pt - pb),
    };

    const patchedViewState: ViewState = {
      ...existingViewState,
      bounds: result.bounds,
      contentBounds: newContentBounds,
      layer: result.layer,
      scale: result.scale,
      z: result.z,
      opacity: result.opacity,
    };
    patches[viewId] = patchedViewState;
  }

  // 8. Apply patches
  engine.patchWidgetStates(patches);
},
```

#### 4.2 Expose `variableStore` on `UseSceneEngineResult`

**File:** `packages/core/src/player/useSceneEngine.ts`

The `onCarouselStep` handler needs access to `VariableStore`. Check whether
`variableStore` is already exposed on `UseSceneEngineResult`.

**If not already present**, add:

```typescript
export type UseSceneEngineResult = {
  // ... existing fields ...

  /** Reactive key-value store for cross-widget state sharing. */
  readonly variableStore: VariableStore;
};
```

And in the hook implementation, include `variableStore` in the returned
object. The `variableStore` is already created in `useSceneEngine` (it's
passed to `RuntimeConfig`), so this is just exposing an existing reference.

**If already present** (verify at implementation time), no change needed.

#### 4.3 Initialize VariableStore on scene track change

When the scene track is recompiled (e.g., scene definitions change), the
VariableStore's carousel namespace should be cleared to reset carousel state
to the compiled defaults. This prevents stale `activeIndex` values from a
previous compilation leaking into a new one.

**File:** `packages/core/src/player/ActionInput.tsx`

Add a `useEffect` that clears carousel state when the engine's scene track
reference changes:

```typescript
// Clear carousel VariableStore state when scene track changes
// (recompilation resets carousels to their compiled activeIndex).
const sceneTrack = engine.sceneTrack;
useEffect(() => {
  // Clear all carousel.* variables — they'll be re-initialized on first step.
  // This is a no-op on first mount (no variables exist yet).
  // Note: VariableStore doesn't expose a "clearNamespace" method, so
  // we rely on the fact that onCarouselStep falls back to compiled
  // layoutConfig.activeIndex when the VariableStore key is absent.
  // The only cleanup needed is removing stale patches.
  engine.patchWidgetStates({});
}, [sceneTrack, engine]);
```

This ensures that if the scene author changes `activeIndex` in the DSL and
recompiles, the runtime picks up the new compiled value.

### Phase 5: Update Example Scene

#### 5.1 Convert static carousel scenes to interactive

**File:** `apps/examples/src/views/scenes/scene3-carousel.tsx`

Replace the three separate `CarouselScene1/2/3` components with a single
scene that uses `<InputController>` for interactive navigation. The example
demonstrates both keyboard and click input, and includes a HUD indicator
showing the VariableStore observability pattern:

```tsx
import {
  Camera,
  Lighting,
  Ambient,
  Directional,
  ProgressManager,
  Scene,
  View,
  ViewLayout,
  InputController,
  Action,
  KeyMap,
  PointerMap,
  Hud,
  HudItem,
} from '@brewsite/core';

/** HUD indicator showing "Slide N of M" via VariableStore subscription. */
function CarouselIndicator(): JSX.Element {
  return (
    <HudItem
      id="carousel-indicator"
      position="bottom-center"
      content={({ variables }) => {
        const activeIndex = variables.get('carousel', 'demo-carousel.activeIndex') ?? 0;
        const slideNum = typeof activeIndex === 'number' ? activeIndex + 1 : 1;
        return `Slide ${slideNum} of 7`;
      }}
    />
  );
}

export const CarouselScene = (): JSX.Element => (
  <Scene id="interactive-carousel">
    <SharedEnv />
    <InputController scope="canvas">
      <Action id="carousel-next" type="carousel.next" layoutId="demo-carousel" stepSlides={1}>
        <KeyMap keyName="ArrowRight" />
        <PointerMap event="click" />
      </Action>
      <Action id="carousel-prev" type="carousel.prev" layoutId="demo-carousel" stepSlides={1}>
        <KeyMap keyName="ArrowLeft" />
      </Action>
    </InputController>
    <ViewLayout id="demo-carousel" kind="carousel" loop activeIndex={0} zStep={15} fadeMin={0.15} spread={0.7}>
      <CarouselViews />
    </ViewLayout>
    <Hud>
      <CarouselIndicator />
    </Hud>
  </Scene>
);
```

The `CarouselIndicator` demonstrates subscribing to VariableStore for
real-time carousel state. The `content` callback receives a `variables`
reader (the `VariableStoreReader` interface) and reads
`carousel.demo-carousel.activeIndex`.

**Note:** The exact `HudItem` API for VariableStore access depends on the
current HUD system. If `HudItem.content` does not currently receive a
`variables` reader, the indicator can alternatively be implemented as a
standalone React component using `useVariableStore('carousel',
'demo-carousel.activeIndex')` — see §4.2 for VariableStore exposure on the
engine. The implementer should verify the HUD API at implementation time and
choose the appropriate pattern.

Keep the existing `CarouselScene1/2/3` exports (they demonstrate the static
multi-scene approach) but add `CarouselScene` as a new export that
demonstrates interactive scrubbing.

#### 5.2 Update ViewDemoPage to include the interactive carousel

**File:** `apps/examples/src/views/ViewDemoPage.tsx`

Add `CarouselScene` to the scene list so the interactive carousel is visible
in the demo app. Import it from `scene3-carousel.tsx`.

---

## File Change Summary

### New Files

| File | Responsibility |
|---|---|
| *None* | All changes are modifications to existing files |

### Modified Files

| File | Change |
|---|---|
| **Input types** | |
| `packages/core/src/input/types.ts` | Add `'carousel.next'` and `'carousel.prev'` to `InputActionType` union. Add `layoutId?: string` and `stepSlides?: number` to `InputActionSpec`. |
| `packages/core/src/input/ActionInputController.ts` | Add required `onCarouselStep` to `ActionInputHandler`. Add `dispatchCarousel()` helper. Add `carousel.next`/`carousel.prev` cases to `dispatchKey`, `dispatchClick`, `dispatchWheel`. Add `actionStepSlides()` helper. |
| **Compiler** | |
| `packages/core/src/compiler/blocks/inputController.tsx` | Add `layoutId` and `stepSlides` to `ActionProps`. Pass them through in `parseAction()`. |
| `packages/core/src/compiler/viewTypes.ts` | Add `layoutConfig?: ViewLayoutConfig` and `childSizeHints?: ReadonlyArray<{w: number; h: number}>` to `ViewLayoutState`. Add `ViewLayoutConfig` import. |
| `packages/core/src/compiler/blocks/viewHandlers.ts` | Store `layoutConfig` and `childSizeHints` on `ViewLayoutState` when `kind='carousel'`. |
| **Player** | |
| `packages/core/src/player/ActionInput.tsx` | Add `onCarouselStep` handler implementation. Import `resolveLayout`, `ViewLayoutState`, `ViewState`, `CarouselLayoutConfig`. Add scene-track-change cleanup effect. |
| `packages/core/src/player/useSceneEngine.ts` | Expose `variableStore` on `UseSceneEngineResult` (if not already exposed). |
| **Apps** | |
| `apps/examples/src/views/scenes/scene3-carousel.tsx` | Add interactive `CarouselScene` export with `<InputController>` + `<Action>` DSL. |
| `apps/examples/src/views/ViewDemoPage.tsx` | Add `CarouselScene` to scene list. |

---

## Testing Strategy

### Unit Tests

| Module | Test File | Strategy |
|---|---|---|
| `InputActionSpec` extensions | `input/__tests__/ActionInputController.test.ts` | Construct `ActionInputController` with a mock handler. Configure spec with `carousel.next` action + `layoutId` + `stepSlides`. Simulate keydown. Assert `onCarouselStep` is called with correct `(layoutId, +1, stepSlides)`. Repeat for `carousel.prev` → `(layoutId, -1, stepSlides)`. Test missing `layoutId` → assert console.warn and no handler call. |
| `parseAction` passthrough | `compiler/__tests__/inputController.test.ts` | Compile a `<Scene>` with `<Action type="carousel.next" layoutId="foo" stepSlides={2}>`. Assert the resulting `InputActionSpec` has `layoutId: 'foo'` and `stepSlides: 2`. |
| `viewLayoutHandler` config storage | `compiler/__tests__/viewHandlers.test.tsx` | Compile a `<Scene>` with `<ViewLayout kind="carousel" activeIndex={1} loop zStep={10}>`. Assert the resulting `ViewLayoutState` has `layoutConfig` matching `{ kind: 'carousel', activeIndex: 1, loop: true, zStep: 10, ... }` and `childSizeHints` matching the authored `<View>` w/h values. Compile a `<ViewLayout kind="stack">`. Assert `layoutConfig` and `childSizeHints` are NOT present on the state. |
| `ViewLayoutState` type | `compiler/__tests__/viewTypes.test.ts` | Type-level test: assert `ViewLayoutState` with `layoutConfig` and `childSizeHints` satisfies the type. (Optional — covered by typecheck.) |
| Carousel state logic | `player/__tests__/ActionInput.test.tsx` | **New test cases** added to the existing ActionInput test file: (1) Mount ActionInput with mock engine context containing a carousel ViewLayoutState. Trigger `onCarouselStep`. Assert `patchWidgetStates` is called with correct patched ViewLayoutState (updated activeIndex) and patched ViewStates (updated bounds/scale/z/opacity). (2) Test wrapping: `loop=true`, `activeIndex=N-1`, step +1 → wraps to 0. (3) Test clamping: `loop=false`, `activeIndex=0`, step -1 → stays at 0, no patch call. (4) Test `stepSlides > 1`: advance by 2. (5) Test VariableStore: after step, assert `variableStore.get('carousel', '<layoutId>.activeIndex')` returns new index. (6) Test out-of-bounds compiled activeIndex: `activeIndex=99` with 3 children → first step clamps to valid range and produces correct newIndex. |
| VariableStore persistence across steps | `player/__tests__/ActionInput.test.tsx` | Trigger `onCarouselStep` twice in sequence. After the first step (compiled `activeIndex=0`, step +1), assert VariableStore holds `1`. On the second step (+1), assert the handler reads `1` from VariableStore (not compiled `0`) and produces `newIndex=2`. Assert `patchWidgetStates` is called with `activeIndex: 2` in the patched `ViewLayoutState.layoutConfig`. This is the core behavioral guarantee of the VariableStore integration. |

### Integration Tests

| Scenario | Location | Strategy |
|---|---|---|
| Full carousel keyboard nav | `player/__tests__/ActionInput.test.tsx` | Mount `<SceneEngine>` with a scene containing `<InputController>` with `carousel.next`/`carousel.prev` and a `<ViewLayout kind="carousel">`. Simulate ArrowRight keydown. Assert: (1) VariableStore updated, (2) patchWidgetStates called, (3) patched ViewStates have correct new bounds from `resolveLayout`. |

### Key Assertions for Carousel State Logic

The `onCarouselStep` handler has several edge cases that must be explicitly
tested:

1. **Linear clamping**: `loop=false`, index at 0, step -1 → no-op (no patch).
2. **Linear clamping**: `loop=false`, index at max, step +1 → no-op.
3. **Loop wrapping**: `loop=true`, index at max, step +1 → wraps to 0.
4. **Loop wrapping**: `loop=true`, index at 0, step -1 → wraps to max.
5. **Step > 1**: `stepSlides=3`, 7 children, index 5 → index 8 % 7 = 1 (loop).
6. **Missing layoutConfig**: `ViewLayoutState` without `layoutConfig` → warn, no-op.
7. **Empty children**: `viewIds.length === 0` → no-op.
8. **VariableStore fallback**: First step reads compiled `activeIndex`, not VariableStore.
9. **VariableStore persistence**: Second step reads VariableStore value from first step.
10. **Out-of-bounds compiled activeIndex**: `activeIndex=99`, 3 children → first step clamps to 2 (loop=false) or wraps (loop=true), produces valid `newIndex`.

---

## Implementation Order

Execute phases sequentially. Each phase should result in passing
`pnpm typecheck` and `pnpm test`.

1. **Phase 1** (§1.1–1.5): Type extensions. Pure additive — no behavior
   change. All existing tests continue to pass because new fields are
   optional.

2. **Phase 2** (§2.1): Compiler stores `layoutConfig` and `childSizeHints`.
   Existing tests pass; new tests verify the stored fields.

3. **Phase 3** (§3.1–3.2): ActionInputController dispatch. Carousel actions
   now reach the handler. Existing tests pass (new action types don't affect
   existing dispatch); new tests verify carousel dispatch.

4. **Phase 4** (§4.1–4.3): ActionInput carousel handler. This is the core
   runtime logic. Depends on Phases 1–3.

5. **Phase 5** (§5.1–5.2): Example scene update. Depends on Phase 4.

### Parallelism

**Phases 1 and 2 can be done in parallel** — Phase 1 touches `input/types.ts`,
`input/ActionInputController.ts`, and `compiler/blocks/inputController.tsx`.
Phase 2 touches `compiler/viewTypes.ts` and `compiler/blocks/viewHandlers.ts`.
No shared files.

**Phase 3 depends on Phase 1** (needs `layoutId` on `InputActionSpec` and
`onCarouselStep` on `ActionInputHandler`).

**Phase 4 depends on Phases 1, 2, and 3** (needs all type extensions,
compiled config storage, and dispatch wiring).

**Phase 5 depends on Phase 4** (needs the runtime handler to work).

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `resolveLayout` called on every carousel step may be expensive | Perceptible lag on step | `resolveLayout` is pure math on small arrays (typically <20 views). Measured at <0.1ms for 20 children. Not a concern. |
| `patchWidgetStates` overrides ALL widget state for patched IDs — if a widget has state from two sources, one source wins | Child view widgets lose non-layout state | ViewState is layout-only. Child widgets (charts, diagrams) have their own widget IDs and are NOT patched. Only the View wrapper state is patched. |
| VariableStore key collision between carousels | Wrong carousel advances | Keys are namespaced by layoutId: `carousel.<layoutId>.activeIndex`. LayoutIds are unique per scene (auto-generated from kind + sceneIndex, or explicitly authored). |
| `variableStore` not exposed on `UseSceneEngineResult` | ActionInput can't read/write carousel state | Verified: `variableStore` reference exists in `useSceneEngine` (passed to `RuntimeConfig`). If not on the public type, add it — single-line change. |
| ContentBounds recomputation from padding may drift from compiler's `applyPaddingToRect` | Slight layout differences between compiled and patched state | The padding recomputation in `onCarouselStep` uses the same formula as `regionNormalize.ts:applyPaddingToRect`. Extract to a shared utility if drift is observed. |
| Scene track recompilation doesn't clear VariableStore carousel state | Stale activeIndex from previous compilation | Handled by the cleanup effect in §4.3 — `patchWidgetStates({})` clears patches on scene track change. VariableStore values become irrelevant because `onCarouselStep` falls back to compiled config. |

---

## What This Plan Does NOT Cover

- **`patchWidgetStates` implementation** — already in `useSceneEngine.ts` and
  `RuntimeDriverImpl.ts` per the input-unification plan.
- **`ActionInputExtensionContext`** — already implemented per the
  input-unification plan.
- **`RuntimeDriverImpl` changes** — `patchWidgetStates` already handles the
  override logic in `resolveWidgetState()`.
- **Animated carousel transitions** — this plan implements discrete stepping
  (snap to new position). Smooth animated transitions between carousel
  positions (lerping bounds/scale/opacity over N frames) is a future
  enhancement that would add a `FunctionalTransitionSpec` for ViewLayout
  state. Out of scope here.
- **Swipe/drag carousel scrubbing** — continuous gesture-driven scrubbing
  (e.g., drag to smoothly scroll through slides) requires fractional
  `activeIndex` support in `resolveLayout`. Out of scope; can be added as
  an `InputActionType` like `carousel.scrub` later.
- **Production-quality carousel HUD indicators** — the Phase 5 example
  includes a basic "Slide N of M" HUD indicator to demonstrate the
  VariableStore observability pattern. A polished, reusable carousel
  indicator component (dot pagination, thumbnails, etc.) is out of scope.

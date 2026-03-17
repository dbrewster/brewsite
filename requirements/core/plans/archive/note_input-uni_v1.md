---
title: "Input System Unification"
doc_type: plan
owner: architect
status: reviewed
updated: 2026-03-12
---

# Input System Unification

## Problem Statement

The input architecture has two parallel, overlapping systems for the same
fundamental problem — mapping user gestures to engine progress and camera
control. Neither system alone covers all use cases, and scene authors cannot
tell which one to use.

**System A — React input components** (`ScrollInput`, `KeyboardInput`,
`PointerInput`, `TimeInput`, `ControlledInput`): Imperative React wrappers
that call `engine.setProgress()` directly. They work, but they cannot express
camera orbit, diagram canvas pan, carousel scrubbing, or any action richer
than "advance progress."

**System B — Declarative `<InputController>` DSL** + `ActionInputController`
class: A well-designed action-based system that compiles to per-scene
`SceneInputControllerSpec`. It supports camera control, extensible custom
actions, modifier-aware gesture matching, pinch, axis locking, etc. **But
there is no player-layer code that reads the compiled spec and instantiates
`ActionInputController` at runtime.** The DSL compiles silently to no effect.

Additionally:

- `SceneNavInputMap` (config object on `KeyboardInput`/`ScrollInput`) and
  `SceneInputControllerSpec` (compiled from `<InputController>` DSL) both
  define keyboard shortcuts and scene navigation — two APIs for the same thing.
- `PointerInput` (click-to-advance) duplicates `<Action type="scene.next"><PointerMap event="click">`.
- `InputController` (the class in `input/InputController.ts`, re-exported as
  `SceneNavInputController`) is a standalone DOM event processor that
  duplicates functionality already in `ActionInputController`.
- `ScrollInput` is the legacy predecessor to `ScrollStage`.

Since we have not released yet, there is no backward-compatibility constraint.

## Goals

1. **One declarative input system.** All input configuration lives in the
   `<InputController>` DSL inside `<Scene>` declarations. No parallel config
   objects on React components.
2. **Runtime wiring for action dispatch.** The player layer reads compiled
   `__input_controller` state and instantiates `ActionInputController`,
   closing the DSL-to-runtime gap.
3. **Remove all redundant systems.** Delete `SceneNavInputMap`,
   `InputController` class, `PointerInput`, `ScrollInput`, and all associated
   types. Keep only what is needed.
4. **Clean player composition.** The remaining React input components
   (`ScrollStage`, `KeyboardInput`, `TimeInput`, `ControlledInput`) become
   thin progress-source wrappers with no input-mapping logic of their own.
   `KeyboardInput` is simplified to focus management and pause-when-hidden only.

## Non-Goals

- View-scoped input (routing input events to specific `<View>` regions). This
  is a future enhancement that builds on the unified system but is not part of
  this plan.
- Chart brush/selection gestures. These are widget-level interactions that
  remain in `ChartWidget`.
- Diagram node click/hover raycasting. These remain in
  `InteractionRegistry` / `DiagramWidget`. Only canvas-level actions
  (`diagram-canvas.*`) route through `ActionInputController`.
- **Carousel scrubbing.** Interactive carousel navigation (`carousel.next` /
  `carousel.prev` actions, `patchWidgetStates`, `VariableStore`-driven layout
  re-resolve) is a follow-on plan (`plan_carousel-scrubbing.md`). This plan
  adds the action types to the `InputActionType` union as forward declarations
  but does not implement the runtime handler. Carousel builds on the unified
  input system but does not block it.
- **Accessibility / focus management.** This plan does not address ARIA roles,
  keyboard focus trapping, or screen reader behavior for the input system.
  `KeyboardInput` retains its current `<div tabIndex={-1}>` pattern.
  Comprehensive accessibility is deferred to a future plan.
- **Multi-engine conflict resolution.** When multiple `<SceneEngine>` instances
  are mounted simultaneously, each `ActionInput` with `scope: 'window'` will
  bind keyboard events to `document`. This can cause conflicting navigation.
  This plan does not add conflict resolution (e.g., focus-gating). Multi-engine
  pages should use `scope: 'canvas'` with explicit focus management.
  Documenting this limitation is sufficient for now.

---

## Architecture

### Before

```
Scene Author writes:                    Runtime reads:
─────────────────────                   ──────────────
<ScrollStage>                           ScrollStage → engine.setRawProgress()
  <ScrollInput source="window" />  →   InputController class → engine.setProgress()
  <KeyboardInput inputMap={...} /> →   InputController class → engine.setProgress()
</ScrollStage>
<PointerInput mode="click" />      →   Direct engine.advanceProgress()

<InputController> DSL              →   Compiles to __input_controller state
                                        ❌ Nothing reads it at runtime
```

### After

```
Scene Author writes:                    Runtime reads:
─────────────────────                   ──────────────
<ScrollStage>                           ScrollStage → engine.setRawProgress()
  <ActionInput />                  →   Reads __input_controller from tick state
                                        → ActionInputController class attached to canvas
                                        → Dispatches: scene step, camera, custom actions
  <TimeInput />   (optional)       →   Wall-clock auto-advance
  <ControlledInput /> (optional)   →   External control
</ScrollStage>

<InputController> DSL              →   Compiles to __input_controller state ✅ Read at runtime
```

`<ActionInput>` is a new React component that:
1. Reads `__input_controller` from the current tick's widget state
2. Manages an `ActionInputController` instance lifecycle (create on mount,
   attach/detach, destroy on unmount)
3. Provides the `ActionInputHandler` callbacks that dispatch to the engine
4. Reads `onUnknownAction` extensions from plugins via
   `ActionInputExtensionContext` (populated by `SceneEngine` from
   `WidgetPlugin.getActionInputExtension()`)

**Known behavior:** `ActionInput` silently drops all events until the first
engine tick fires and populates `__input_controller` state. This gap is
typically <16ms (one frame) and matches the current behavior where
`KeyboardInput` is inert until its effect runs. `ActionInputController`
already handles `getSpec() → null` by returning early from all event handlers.

---

## Detailed Changes

### Phase 1: Wire ActionInputController into the Player (core change)

#### 1.1 New file: `packages/core/src/player/ActionInput.tsx`

**Responsibility:** React component that bridges compiled `__input_controller`
spec to the `ActionInputController` runtime class.

```typescript
// ActionInput.tsx — Bridges compiled InputController DSL to runtime ActionInputController.

import { useContext, useEffect, useRef } from 'react';
import type { ReactElement } from 'react';
import { useSceneEngineContext } from './EngineContext';
import { ActionInputExtensionContext } from './ActionInputExtensionContext';
import { ActionInputController } from '../input/ActionInputController';
import type { ActionInputHandler } from '../input/ActionInputController';
import type { SceneInputControllerSpec } from '../input/types';

export interface ActionInputProps {
  /**
   * DOM element that receives pointer/wheel events.
   * When omitted, uses engine.canvasRef.current (the <canvas> managed by SceneCanvas).
   */
  target?: HTMLElement | null;

  /**
   * DOM element or document that receives keyboard events.
   * Defaults to `document`. Scene authors who need canvas-scoped keyboard
   * events should pass the canvas element explicitly.
   */
  keyboardTarget?: HTMLElement | Document | Window | null;
}

export function ActionInput(props: ActionInputProps): ReactElement | null {
  const engine = useSceneEngineContext();
  const pluginExtension = useContext(ActionInputExtensionContext);
  const controllerRef = useRef<ActionInputController | null>(null);

  // Stable closure that reads the current tick's input spec.
  // Called on every DOM event by ActionInputController — spec changes across
  // scenes take effect immediately without re-mounting.
  const getSpec = (): SceneInputControllerSpec | null => {
    const tick = engine.frameState.tick;
    if (!tick) return null;
    return (tick.state.widgets['__input_controller'] as SceneInputControllerSpec) ?? null;
  };

  useEffect(() => {
    // Resolve target: use provided target, fall back to engine's canvas ref.
    const targetEl = props.target ?? engine.canvasRef.current;
    if (!targetEl) return;

    const handler: ActionInputHandler = {
      getSceneCount: () => engine.sceneCount,

      onSceneStep: (direction, stepScenes) => {
        const count = engine.sceneCount;
        if (count <= 1) return;
        const delta = direction * (stepScenes / (count - 1));
        engine.advanceProgress(delta);
      },

      onCameraOrbit: (cameraId, dx, dy, speed) => {
        engine.applyCameraOrbit(cameraId, dx, dy, speed);
      },

      onCameraDolly: (cameraId, delta, speed) => {
        engine.applyCameraDolly(cameraId, delta, speed);
      },

      onCameraReset: (_cameraId) => {
        engine.setCameraOverride(null);
      },

      onUnknownAction: pluginExtension ?? undefined,
    };

    // Keyboard defaults to document for broadest compatibility.
    // Scene authors needing canvas-scoped keyboard events pass keyboardTarget explicitly.
    const keyboardTarget = props.keyboardTarget ?? document;

    const controller = new ActionInputController(
      targetEl,
      getSpec,
      handler,
      keyboardTarget,
      { idDefaults: { cameraId: engine.primaryCameraId, canvasId: engine.primaryCanvasActionTargetId } },
    );
    controller.attach();
    controllerRef.current = controller;

    return () => {
      controller.detach();
      controllerRef.current = null;
    };
  }, [props.target, props.keyboardTarget, engine, pluginExtension]);

  return null; // No DOM output — pure side-effect component.
}
```

**Key design decisions:**

- `ActionInput` is a **null-rendering React component** (same pattern as
  `TimeInput`, `ControlledInput`). It lives inside `<SceneEngine>` and
  reads context.
- `getSpec()` is a **closure, not a prop**. It reads the current tick's
  `__input_controller` state on every DOM event, so spec changes across scenes
  take effect immediately without re-mounting.
- `onUnknownAction` is the **single extension point** for downstream packages.
  `@brewsite/diagram` provides its `diagram-canvas.*` handler here.
- **Target resolution:** Pointer/wheel events attach to `engine.canvasRef.current`
  (from `UseSceneEngineResult`, defined in `player/engineTypes.ts:61`).
  Keyboard events attach to `document` by default for broadest compatibility.
- Camera orbit/dolly dispatch goes through `engine.applyCameraOrbit()` and
  `engine.applyCameraDolly()` — `ActionInput` does NOT contain Three.js math.
  See §1.3.

#### 1.2 New file: `packages/core/src/player/ActionInputExtensionContext.ts`

**Responsibility:** Dedicated React context for plugin action input extensions.
Internal module — NOT exported from the package barrel.

```typescript
// ActionInputExtensionContext.ts — React context for plugin onUnknownAction handlers.

import { createContext } from 'react';
import type { ActionInputHandler } from '../input/ActionInputController';

/** Merged onUnknownAction callback from all WidgetPlugin.getActionInputExtension() results. */
export type ActionInputExtension = NonNullable<ActionInputHandler['onUnknownAction']>;

export const ActionInputExtensionContext = createContext<ActionInputExtension | null>(null);
```

**In `SceneEngine.tsx`**, during plugin initialization (where the plugin array
is available), collect and merge extensions:

```typescript
// Collect action input extensions from plugins.
// WidgetPlugin.getActionInputExtension() already exists on the interface
// (packages/core/src/widget/WidgetPlugin.ts:85-87). This code IMPLEMENTS
// the collection — the interface does not need changes.
const mergedExtension = useMemo(() => {
  const handlers = plugins
    .map(p => p.getActionInputExtension?.(widgetRegistry))
    .filter(Boolean)
    .map(ext => ext!.onUnknownAction)
    .filter(Boolean) as ActionInputExtension[];
  if (handlers.length === 0) return null;
  return ((type, canvasId, event, extra) => {
    for (const handler of handlers) handler(type, canvasId, event, extra);
  }) as ActionInputExtension;
}, [plugins, widgetRegistry]);

// In the render tree, wrap children:
<ActionInputExtensionContext.Provider value={mergedExtension}>
  {children}
</ActionInputExtensionContext.Provider>
```

This approach:
- Keeps `_actionInputExtensions` OFF the public `UseSceneEngineResult` type
- Does not add plugin awareness to `WidgetRegistry` (preserves its single responsibility)
- Scopes extensions to the engine's React subtree (multi-engine pages get independent extensions)

#### 1.3 Camera orbit/dolly dispatch via engine methods

`ActionInput` is a React component — it does NOT have direct Three.js access
and must NOT contain orbit math. Instead, two new methods are added to
`UseSceneEngineResult`:

**File:** `packages/core/src/player/useSceneEngine.ts`

```typescript
export type UseSceneEngineResult = {
  // ... existing fields ...

  /** Widget ID of the primary camera. Used by ActionInput for orbit/dolly dispatch. */
  readonly primaryCameraId: string;

  /** Widget ID of the primary canvas action target. Used by ActionInput for unknown action dispatch. */
  readonly primaryCanvasActionTargetId: string;

  /**
   * Apply an orbital camera rotation delta. Delegates to CameraWidget.
   * No-op with console.warn if no camera target is set.
   */
  applyCameraOrbit(cameraId: string, dx: number, dy: number, speed: number): void;

  /**
   * Apply a camera dolly (zoom) delta. Delegates to CameraWidget.
   * No-op with console.warn if no camera target is set.
   */
  applyCameraDolly(cameraId: string, delta: number, speed: number): void;
};
```

**Implementation:** These methods look up the CameraWidget by `cameraId` in the
`WidgetRegistry` and call new methods on the widget:

```typescript
const applyCameraOrbit = useCallback((cameraId: string, dx: number, dy: number, speed: number) => {
  const widget = widgetRegistry.get(cameraId);
  if (!widget || !('applyCameraOrbit' in widget)) {
    console.warn(`[ActionInput] Camera widget "${cameraId}" not found or does not support orbit.`);
    return;
  }
  (widget as CameraWidget).applyCameraOrbit(dx, dy, speed);
}, [widgetRegistry]);
```

**File:** `packages/core/src/elements/camera/CameraWidget.ts`

Add two new methods to `CameraWidget`:

```typescript
/**
 * Applies an orbital rotation delta. Uses spherical coordinates relative to
 * the current camera target point. Mirrors camera-controls internal math.
 *
 * @param dx - Horizontal pixel delta (azimuth). Positive = rotate right.
 * @param dy - Vertical pixel delta (polar). Positive = rotate up.
 * @param speed - Multiplier applied to the delta.
 */
applyCameraOrbit(dx: number, dy: number, speed: number): void {
  // Read current target from camera.userData['__brewsite_camera_target']
  // Apply azimuth delta: theta += dx * speed * ORBIT_SENSITIVITY
  // Apply polar delta: phi += dy * speed * ORBIT_SENSITIVITY
  // Clamp phi to [MIN_POLAR, MAX_POLAR]
  // Convert spherical → cartesian → set camera override
  // Call this.setCameraOverride({ position, target })
}

/**
 * Applies a dolly (zoom) delta along the camera's forward axis.
 *
 * @param delta - Signed distance. Positive = zoom in.
 * @param speed - Multiplier applied to the delta.
 */
applyCameraDolly(delta: number, speed: number): void {
  // Move camera position along (target - position) direction by delta * speed * DOLLY_SENSITIVITY
  // Call this.setCameraOverride({ position, target })
}
```

**ORBIT_SENSITIVITY** and **DOLLY_SENSITIVITY** are constants (not
configurable) matching the existing camera-controls feel. The exact values
should be tuned during implementation and covered by golden-value tests.

The existing internal convention of storing the camera target in
`camera.userData['__brewsite_camera_target']` is preserved — no new interface
needed for reading the current target.

#### 1.4 Default keyboard bindings via `<InputController>` DSL

When no `<InputController>` is authored in any scene, sensible defaults are
injected so that keyboard navigation still works.

**Approach: Compile-time default injection.**

**File:** `packages/core/src/compiler/sceneTrackCompiler.ts`

**Insertion point:** After the InputController carry-forward loop (currently
at line ~407, after `prevInputController` is applied to all snapshots) and
before Step 1.6 (progressProfile build at line ~418).

```typescript
// If no scene declares an InputController, inject defaults for keyboard nav.
// Uses scope: 'window' so keyboard events are registered on document —
// matching the old InputController class behavior (InputController.ts:90).
const anyHasInput = snapshots.some(s => s.widgets['__input_controller'] != null);
if (!anyHasInput) {
  const DEFAULT_INPUT_SPEC: SceneInputControllerSpec = {
    id: '__default',
    scope: 'window',
    actions: [
      {
        id: '__scene_next',
        type: 'scene.next',
        maps: [
          { kind: 'key', key: 'ArrowRight' },
          { kind: 'key', key: 'ArrowDown' },
        ],
      },
      {
        id: '__scene_prev',
        type: 'scene.prev',
        maps: [
          { kind: 'key', key: 'ArrowLeft' },
          { kind: 'key', key: 'ArrowUp' },
        ],
      },
    ],
  };
  for (const snapshot of snapshots) {
    snapshot.widgets['__input_controller'] = DEFAULT_INPUT_SPEC;
  }
}
```

**Note:** The variable is `snapshots` (the `SceneFrame[]` array), NOT `scenes`
(the `SceneDefinition[]` array which has `getFrame()`, not `widgets`).

This replaces the hardcoded defaults in the old `InputController` class
(`ArrowRight → nextScene`, etc.). If any scene authors an `<InputController>`,
no defaults are injected (the carry-forward logic already ensures all scenes
get the authored spec).

### Phase 2: Remove redundant systems

#### 2.1 Delete `InputController` class and `SceneNavInputMap`

**Delete files:**
- `packages/core/src/input/InputController.ts`
- `packages/core/src/input/__tests__/InputController.test.ts` (if exists)

**Remove types from `packages/core/src/input/types.ts`:**
- `SceneNavInputMap`
- `WheelConfig`
- `DragConfig`
- `SwipeConfig`
- `ClickConfig`
- `SceneNavKeys`
- `InputNavigationHandler`

**Update `packages/core/src/input/index.ts`:**
- Remove `export { InputController as SceneNavInputController }` line
- Remove type exports for deleted types

#### 2.2 Delete `PointerInput`

**Delete files:**
- `packages/core/src/player/PointerInput.tsx`
- `packages/core/src/player/__tests__/PointerInput.test.tsx`

Its functionality is fully replaced by `<Action type="scene.next"><PointerMap event="click">`.

#### 2.3 Delete `ScrollInput`

**Delete files:**
- `packages/core/src/player/ScrollInput.tsx`
- `packages/core/src/player/__tests__/ScrollInput.test.tsx`

`ScrollStage` is the replacement. All existing consumers already use
`ScrollStage`.

**DO NOT delete `scrollInertia.ts` or `scrollSourceTypes.ts`.** Both are
shared with `ScrollStage`, `StageScrollSources`, `ScrollDriverContext`, and
`useNativeScrollSource`. Verified imports:
- `scrollInertia.ts` → imported by `StageScrollSources.tsx`, test file `scrollInertia.test.ts`
- `scrollSourceTypes.ts` → imported by `StageScrollSources.tsx`, `ScrollDriverContext.tsx`,
  `useNativeScrollSource.ts`, `ScrollStage.tsx`

#### 2.4 Simplify `KeyboardInput`

**File:** `packages/core/src/player/KeyboardInput.tsx`

**Before:** Accepts `inputMap?: SceneNavInputMap`, creates an `InputController`
instance, and handles keyboard events through the old system.

**After:** Becomes a thin wrapper that provides focus management and
pause-when-hidden behavior. **All keyboard mapping is handled by
`ActionInput`** via the compiled `__input_controller` spec.

`KeyboardInput` retains these responsibilities:
1. **Focus management**: Renders a focusable `<div tabIndex={-1}>` wrapper
   and manages focus capture so keyboard events reach the canvas.
2. **Pause-when-hidden**: Uses `usePauseWhenHidden` to pause input when
   the element is off-screen (using internal `isPausedRef` pattern).

It **no longer** creates an `InputController` instance, accepts
`inputMap`, or handles keyboard events directly.

```typescript
// Simplified KeyboardInput — focus management and pause-when-hidden only.

import { useCallback, useEffect, useRef } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { usePauseWhenHidden } from './usePauseWhenHidden';
import type { PauseWhenHiddenOptions } from './usePauseWhenHidden';

export interface KeyboardInputProps {
  /** Whether to render a focusable container div. Default: true. */
  manageFocus?: boolean;
  pauseWhenHidden?: PauseWhenHiddenOptions;
  children?: ReactNode;
}

export function KeyboardInput(props: KeyboardInputProps): ReactElement | null {
  const containerDivRef = useRef<HTMLDivElement | null>(null);
  const isPausedRef = useRef(false);
  const manageFocus = props.manageFocus ?? true;

  const onPauseChange = useCallback((paused: boolean) => {
    isPausedRef.current = paused;
    if (paused && containerDivRef.current) {
      containerDivRef.current.blur();
    }
  }, []);

  usePauseWhenHidden(containerDivRef, props.pauseWhenHidden, onPauseChange);

  if (manageFocus) {
    return (
      <div
        ref={containerDivRef}
        tabIndex={-1}
        onPointerDown={(e) => {
          const el = e.currentTarget;
          if (typeof el.focus === 'function') el.focus({ preventScroll: true });
        }}
        style={{
          position: 'absolute',
          inset: 0,
          outline: 'none',
          pointerEvents: 'auto',
        }}
      >
        {props.children}
      </div>
    );
  }

  return null;
}
```

**Update `packages/core/src/player/__tests__/KeyboardInput.test.tsx`:**
Rewrite to test focus management and pause-when-hidden only. Remove all tests
that verify key → scene-advance behavior (that's now tested via
`ActionInputController.test.ts` + `ActionInput.test.tsx`).

#### 2.5 Update `packages/core/src/player/index.ts`

Remove exports:
- `PointerInput`, `PointerInputProps`
- `ScrollInput`, `ScrollInputProps`

Add export:
- `ActionInput`, `ActionInputProps`

Remove re-exports of deleted types:
- `SceneNavInputMap`, `WheelConfig`, `DragConfig`, `SwipeConfig`,
  `ClickConfig`, `SceneNavKeys`, `InputNavigationHandler`,
  `SceneNavInputController`

#### 2.6 Update `packages/core/src/index.ts`

The line `export * from './input'` will automatically drop the removed types
since they're no longer in `input/index.ts`. No additional changes needed
unless there are explicit named re-exports.

### Phase 3: Implement `diagramPlugin.getActionInputExtension()`

#### 3.1 Implement the extension

**File:** `packages/diagram/src/player/diagramPlugin.ts`

`WidgetPlugin.getActionInputExtension()` already exists on the interface
(`packages/core/src/widget/WidgetPlugin.ts:85-87`). This is an
**implementation** task, not an interface design task.

Add to the plugin's return object:

```typescript
getActionInputExtension(registry) {
  return {
    onUnknownAction: (type, canvasId, event, extra) => {
      if (!canvasId) return;
      const widget = registry.get(canvasId);
      if (!widget || !('applyCanvasAction' in widget)) return;

      const dx = (extra.dx as number) ?? 0;
      const dy = (extra.dy as number) ?? 0;
      const speed = (extra.speed as number) ?? 1;

      switch (type) {
        case 'diagram-canvas.move':
          (widget as DiagramWidget).applyCanvasAction('move', dx, dy, speed);
          break;
        case 'diagram-canvas.rotate':
          (widget as DiagramWidget).applyCanvasAction('rotate', dx, dy, speed);
          break;
        case 'diagram-canvas.focus':
          (widget as DiagramWidget).applyCanvasAction('focus', 0, 0, 1, extra.focusCenter as [number, number] | undefined);
          break;
        case 'diagram-canvas.reset':
          (widget as DiagramWidget).applyCanvasAction('reset', 0, 0, 1);
          break;
      }
    },
  };
},
```

#### 3.2 Add `applyCanvasAction` to `DiagramWidget`

**File:** `packages/diagram/src/elements/diagram/widget.ts`

```typescript
applyCanvasAction(
  action: 'move' | 'rotate' | 'focus' | 'reset',
  dx: number,
  dy: number,
  speed: number,
  focusCenter?: [number, number],
): void {
  // Delegates to the DiagramRenderer's canvas controller.
  // 'move': translate viewportBounds by dx/dy scaled by speed
  // 'rotate': adjust tiltRotation by dx/dy scaled by speed
  // 'focus': publish focus region centered on focusCenter
  // 'reset': restore default viewport bounds, tilt, zoom
}
```

This method mutates the widget's internal state, which is then applied
on the next `IRenderable.apply()` tick.

### Phase 4: Update all consumers

#### 4.1 App pages

Every page that uses `<ScrollStage>` + `<KeyboardInput>` needs:
1. Add `<ActionInput />` as a child of `<SceneEngine>` (or `<ScrollStage>`).
2. Keep `<KeyboardInput>` for focus management (now simplified).
3. Remove any `inputMap` props from `KeyboardInput`.
4. Remove `<ScrollInput>` and `<PointerInput>` if used.

**Files to update:**
- `apps/examples/src/architecture/ArchitecturePage.tsx`
- `apps/examples/src/brewflow-comparison/ComparisonPage.tsx`
- `apps/examples/src/whiteboard-arch/WhiteboardArchPage.tsx`
- `apps/examples/src/views/ViewDemoPage.tsx`
- `apps/examples/src/brewflow-sidecar/SidecarNotePage.tsx`
- `apps/examples/src/brewflow-multiuser/MultiUserPage.tsx`
- `apps/examples/src/chart/ChartDemoPage.tsx`
- `apps/examples/src/brewflow-memory/MemorySubsystemPage.tsx`
- `apps/website/src/landing/LandingPage.tsx` (**verify path exists**)
- `apps/docs/src/components/ScenePanel.tsx` (**verify path exists**)
- `apps/docs/src/components/demo/InlineDemo.tsx` (**verify path exists**)
- `apps/docs/src/demos/shared/DemoScene.tsx` (**verify path exists**)

**Note:** `apps/website/` and `apps/docs/` paths must be verified before
attempting modifications — they may not exist in the current workspace.

**Pattern before:**
```tsx
<ScrollStage scrollHeightMode="scene-count" pixelsPerScene={1400}>
  {scenes}
  <ScrollInput source="window" />
  <KeyboardInput />
</ScrollStage>
```

**Pattern after:**
```tsx
<ScrollStage scrollHeightMode="scene-count" pixelsPerScene={1400}>
  {scenes}
  <ActionInput />
  <KeyboardInput />
</ScrollStage>
```

Note: `<KeyboardInput>` is retained for focus management. If no `<InputController>`
is authored in the scenes, the default keyboard bindings (arrow keys → scene step)
are injected by the compiler (§1.4).

For pages that use the `<InputController>` DSL in their scenes (all
brewflow-multiuser scenes), **no scene DSL changes are needed** — the compiled
spec now takes effect at runtime via `<ActionInput>`.

#### 4.2 SceneReel

`SceneReel` does not include input components — they're consumer-provided
children. No change needed. But update the JSDoc to recommend `<ActionInput>`.

#### 4.3 Documentation pages

Update any docs pages that reference removed APIs. In addition to import-level
changes, update rendered content that references deleted types:

- `apps/docs/src/layout/DocsLayout.tsx` — remove/update `SceneNavInputMap` content text
- `apps/docs/src/pages/core/Navigation.tsx` — remove/update `SceneNavInputMap` content text
- `apps/docs/src/pages/core/CameraElement.tsx`
- `apps/docs/src/pages/core/ScenePlayerRef.tsx`
- `docs/src/pages/core/Actions.tsx`
- `docs/src/demos/core/InputActionsDemo.demo.tsx`

**Note:** All `apps/docs/` paths must be verified before attempting modifications.

---

## File Change Summary

### New Files

| File | Responsibility |
|---|---|
| `packages/core/src/player/ActionInput.tsx` | React component bridging compiled InputController spec to ActionInputController runtime |
| `packages/core/src/player/ActionInputExtensionContext.ts` | Dedicated React context for plugin onUnknownAction extensions |
| `packages/core/src/player/__tests__/ActionInput.test.tsx` | Tests for ActionInput lifecycle, spec reading, dispatch |

### Deleted Files

| File | Reason |
|---|---|
| `packages/core/src/input/InputController.ts` | Replaced by ActionInputController via ActionInput |
| `packages/core/src/input/__tests__/InputController.test.ts` | Tests for deleted class |
| `packages/core/src/player/PointerInput.tsx` | Replaced by `<Action type="scene.next"><PointerMap event="click">` |
| `packages/core/src/player/__tests__/PointerInput.test.tsx` | Tests for deleted component |
| `packages/core/src/player/ScrollInput.tsx` | Replaced by ScrollStage |
| `packages/core/src/player/__tests__/ScrollInput.test.tsx` | Tests for deleted component |

**DO NOT delete:** `scrollSourceTypes.ts` and `scrollInertia.ts` are shared
with `ScrollStage`, `StageScrollSources`, `ScrollDriverContext`, and
`useNativeScrollSource`.

### Modified Files

| File | Change |
|---|---|
| **Input types** | |
| `packages/core/src/input/types.ts` | Remove `SceneNavInputMap`, `WheelConfig`, `DragConfig`, `SwipeConfig`, `ClickConfig`, `SceneNavKeys`, `InputNavigationHandler`. Add `carousel.next`, `carousel.prev` to `InputActionType` (forward declarations for follow-on plan). |
| `packages/core/src/input/index.ts` | Remove `SceneNavInputController` export and deleted type exports. |
| **Compiler** | |
| `packages/core/src/compiler/sceneTrackCompiler.ts` | Add default `__input_controller` injection (scope: 'window') when no scene authors one. Insertion point: after InputController carry-forward loop, before progressProfile build. |
| `packages/core/src/compiler/__tests__/sceneTrackCompiler.test.ts` | Add test for default injection. |
| **Player** | |
| `packages/core/src/player/SceneEngine.tsx` | Collect plugin action input extensions via `useMemo`. Wrap children in `ActionInputExtensionContext.Provider`. |
| `packages/core/src/player/useSceneEngine.ts` | Add `primaryCameraId`, `primaryCanvasActionTargetId`, `applyCameraOrbit()`, `applyCameraDolly()` to result. |
| `packages/core/src/player/KeyboardInput.tsx` | Remove `InputController` usage and `inputMap` prop. Simplify to focus management + pause-when-hidden only. Use internal `isPausedRef` pattern. |
| `packages/core/src/player/__tests__/KeyboardInput.test.tsx` | Rewrite to test focus management only. |
| `packages/core/src/player/index.ts` | Remove `PointerInput`, `ScrollInput`, `SceneNavInputController` exports. Add `ActionInput` export. Remove deleted type re-exports. |
| **Camera** | |
| `packages/core/src/elements/camera/CameraWidget.ts` | Add `applyCameraOrbit(dx, dy, speed)` and `applyCameraDolly(delta, speed)` methods. |
| **Package exports** | |
| `packages/core/src/index.ts` | Verify removed types are no longer exported (automatic via `export * from './input'`). |
| **Diagram** | |
| `packages/diagram/src/player/diagramPlugin.ts` | Implement `getActionInputExtension()` (interface already exists on `WidgetPlugin`). |
| `packages/diagram/src/elements/diagram/widget.ts` | Add `applyCanvasAction()` method. |
| **Apps** | |
| `apps/examples/src/architecture/ArchitecturePage.tsx` | Add `<ActionInput />`, remove `ScrollInput` if present. |
| `apps/examples/src/brewflow-comparison/ComparisonPage.tsx` | Add `<ActionInput />`. |
| `apps/examples/src/whiteboard-arch/WhiteboardArchPage.tsx` | Add `<ActionInput />`. |
| `apps/examples/src/views/ViewDemoPage.tsx` | Add `<ActionInput />`. |
| `apps/examples/src/brewflow-sidecar/SidecarNotePage.tsx` | Add `<ActionInput />`. |
| `apps/examples/src/brewflow-multiuser/MultiUserPage.tsx` | Add `<ActionInput />`. |
| `apps/examples/src/chart/ChartDemoPage.tsx` | Add `<ActionInput />`. |
| `apps/examples/src/brewflow-memory/MemorySubsystemPage.tsx` | Add `<ActionInput />`. |
| `apps/website/src/landing/LandingPage.tsx` | Remove `ScrollInput`, add `<ActionInput />`. (**Verify path exists.**) |
| `apps/docs/src/components/ScenePanel.tsx` | Add `<ActionInput />`. (**Verify path exists.**) |
| `apps/docs/src/components/demo/InlineDemo.tsx` | Add `<ActionInput />` if keyboard nav desired. (**Verify path exists.**) |
| `apps/docs/src/demos/shared/DemoScene.tsx` | Add `<ActionInput />` if keyboard nav desired. (**Verify path exists.**) |
| `apps/docs/src/layout/DocsLayout.tsx` | Update/remove `SceneNavInputMap` rendered content. (**Verify path exists.**) |
| `apps/docs/src/pages/core/Navigation.tsx` | Update/remove `SceneNavInputMap` rendered content. (**Verify path exists.**) |

---

## Testing Strategy

### Unit Tests

| Module | Test File | Strategy |
|---|---|---|
| `ActionInput` | `player/__tests__/ActionInput.test.tsx` | Mount inside mock `EngineContext` + `ActionInputExtensionContext`. Verify: (1) ActionInputController is created and attached on mount, detached on unmount. (2) getSpec() reads from mock tick state. (3) Handler callbacks call correct engine methods (`advanceProgress`, `applyCameraOrbit`, `applyCameraDolly`, `setCameraOverride`). (4) Plugin extensions from context are passed as `onUnknownAction`. Use real `ActionInputController` instance with a mock DOM target. |
| `sceneTrackCompiler` (default spec) | `compiler/__tests__/sceneTrackCompiler.test.ts` | Compile scenes with no `<InputController>`. Assert default `__input_controller` spec is injected with `scope: 'window'` and arrow-key scene navigation. Compile scenes WITH `<InputController>`. Assert no default injection. |
| `KeyboardInput` (simplified) | `player/__tests__/KeyboardInput.test.tsx` | Test focus management: auto-focus on mount, tabIndex=-1, pause-when-hidden. No keyboard event tests (moved to ActionInput). |
| `CameraWidget` (orbit/dolly) | `elements/camera/__tests__/CameraWidget.test.ts` | Call `applyCameraOrbit(dx, dy, speed)` and `applyCameraDolly(delta, speed)`. Assert camera override state is set with correct position/target values. Golden-value tests for orbit sensitivity. |
| `diagramPlugin` | `diagram/src/player/__tests__/diagramPlugin.test.ts` | Call `getActionInputExtension()`. Invoke `onUnknownAction` with `diagram-canvas.move`. Assert `DiagramWidget.applyCanvasAction()` is called with correct args. |

### Integration Tests

| Scenario | Location | Strategy |
|---|---|---|
| Full scroll + keyboard nav | `player/__tests__/ActionInput.test.tsx` | Mount `<SceneEngine>` with scenes, `<ScrollStage>`, `<ActionInput>`, `<KeyboardInput>`. Simulate ArrowRight keydown. Assert `engine.progress` advances by 1/(sceneCount-1). |
| Diagram canvas move | `diagram/src/player/__tests__/diagramPlugin.test.ts` | Mount with diagramPlugin. Simulate drag on canvas with `diagram-canvas.move` spec. Assert DiagramWidget viewport bounds change. |

---

## Implementation Order

Execute phases in this order. Each phase should result in passing `pnpm typecheck` and `pnpm test`.

1. **Phase 1** (§1.1–1.4): Create `ActionInput`, `ActionInputExtensionContext`, wire into `SceneEngine`, add `applyCameraOrbit`/`applyCameraDolly` to engine + CameraWidget, add default spec injection. This is the foundational change. All existing scenes continue to work (default keyboard nav replaces the old hardcoded defaults).

2. **Phase 2** (§2.1–2.6): Remove redundant systems. This is a breaking change to the player API surface. Update all consumers in the same commit.

3. **Phase 3** (§3.1–3.2): Wire diagram plugin. Can be done in parallel with Phase 2.

4. **Phase 4** (§4.1–4.3): Update all app consumers. Partially done in Phase 2; this covers remaining docs and examples.

**Phases 2 and 3 are safe to parallelize.** Phase 2 modifies `input/types.ts`, `input/index.ts`, `player/KeyboardInput.tsx`, `player/PointerInput.tsx`, `player/ScrollInput.tsx`, `player/index.ts`. Phase 3 modifies `diagram/src/player/diagramPlugin.ts` and `diagram/src/elements/diagram/widget.ts`. No shared files.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Camera orbit math is wrong in CameraWidget | Camera interaction broken | Port exact math from CameraWidget's existing CameraControlsDriver. Use same spherical coordinate system. Write golden-value tests. |
| `scrollInertia.ts` or `scrollSourceTypes.ts` shared with ScrollStage | Deletion breaks ScrollStage | Verified: both files ARE shared with ScrollStage/StageScrollSources. They are explicitly kept (not deleted). |
| Default keyboard spec conflicts with scene-authored spec | Duplicate key bindings | Default injection is gated on `!anyHasInput`. If any scene authors an `<InputController>`, no defaults are injected. |
| `getSpec()` returns null before first tick | Keyboard events silently dropped | Acceptable: <16ms gap. `ActionInputController` already handles null spec with early return. Matches current `KeyboardInput` behavior (inert until effect runs). |
| Multi-engine pages have conflicting keyboard handlers | Wrong engine receives keyboard events | Documented as non-goal. Workaround: use `scope: 'canvas'` with explicit focus management. |
| `apps/website/` and `apps/docs/` paths may not exist | Phase 4 file list is inaccurate | Implementer must verify paths before modification. |

---

## Follow-On Plans

- **`plan_carousel-scrubbing.md`** — Interactive carousel navigation
  (`carousel.next`/`carousel.prev` handler, `patchWidgetStates`,
  `VariableStore`-driven layout re-resolve, `ViewLayoutState` extensions).
  Requires this plan to be complete first. The `carousel.next`/`carousel.prev`
  action types in `InputActionType` are forward declarations added in this plan;
  the runtime handler is implemented in the follow-on.

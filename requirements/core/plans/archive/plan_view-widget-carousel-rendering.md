---
title: "View Widget — Three.js Group-Based Carousel Rendering"
doc_type: plan
owner: architect
status: completed
updated: 2026-03-13
amended: 2026-03-13 (Z delta fix)
---

# View Widget — Three.js Group-Based Carousel Rendering

## Problem Statement

Carousel input (ArrowRight/Click → `carousel.next`) dispatches correctly through
`ActionInputController` → `InputCoordinator.onCarouselStep`, which computes new
View bounds and calls `engine.patchWidgetStates(patches)`. The patches are stored
and applied by `RuntimeDriver._widgetStatePatches` each tick.

**But nothing renders the patched ViewState.** There is no `IRenderable` widget
for Views. Child widget positions (charts, etc.) were baked at compile time via
`composeBounds` and are not affected by ViewState patches. Overlays are baked
React elements with hardcoded CSS positions. The result: carousel patches have
zero visual effect.

## Design Approach

Introduce a **ViewWidget** — an `IRenderable<ViewState>` that owns a `THREE.Group`.
Child 3D widgets are re-parented under this Group after initialization. The Group
applies a **delta transform** from compile-time bounds to current (patched) bounds,
so children don't need to change how they compute their positions.

For HTML overlays, the `EngineOverlayHost` is extended to reactively read
patched ViewState and update overlay wrapper positioning each frame.

### Why delta transform (not local coordinates)

Children currently position themselves in **absolute NVS → world space** via
`composeBounds` at compile time. Changing this to relative coordinates would
require modifying every widget type that can live inside a View (charts, diagrams,
models, etc.). Instead:

1. The View Group starts at **identity** (position 0, scale 1).
2. Children render at their compile-time absolute positions **inside** the Group.
3. Since the Group is at origin, the children appear exactly where they should.
4. When the carousel advances, the Group's position/scale shifts by the **delta**
   between old and new View bounds. Children move automatically.

**Math:**
A child compiled at world position `C` inside a View with original NVS center
`P_old` should appear at `P_new + (C - P_old) * S` after a carousel step, where
`S` is the scale ratio and `P_new` is the new NVS center in world space.

With a Group at position `G` and scale `S`:
- Apparent child position = `G + C * S`
- Required: `G + C * S = P_new + (C - P_old) * S = P_new - P_old * S + C * S`
- Therefore: **`G = P_new - P_old * S`** (in world space)

At compile time (S=1, P_new = P_old): G = 0. ✓

### Module pattern deviation

ViewWidget is a **runtime-only** widget. Its compiled state (`ViewState`) is produced
by the compiler's built-in `viewHandler` in `viewHandlers.ts`, not by a dedicated
element DSL component. Therefore the standard element module pattern
(`types.ts → dsl.tsx → compile.ts → render.ts → Widget.ts → index.ts`) is intentionally
reduced to `types.ts → ViewWidget.ts → index.ts`. There is no `dsl.tsx` (no DSL
component — `<View>` is a compiler block, not a widget DSL), no `compile.ts` (compilation
happens in `viewHandler`), and no `render.ts` (the render logic is simple enough to live
in the Widget class). ViewWidget intentionally does **not** implement `ISceneElement` —
it has no `DslComponent`, no `defaultState`, and no `transitionSpec`.

### Implementation wave structure

The implementation is organized into three sequential waves to respect dependency order:

- **Wave 0** (prerequisite): Add `IGroupOwner` interface to `widget/types.ts`, add
  `isGroupOwner` duck-type guard to `widget/WidgetRegistry.ts`, and export both from
  `widget/index.ts`. This is a ~10-line change that unblocks all subsequent waves.

- **Wave 1** (three parallel streams after Wave 0):
  - **Stream A — Compiler changes**: `viewTypes.ts`, `childApi.ts`, `viewHandlers.ts`
  - **Stream B — ViewWidget new module**: `elements/view/*` (new files)
  - **Stream C — ChartWidget IGroupOwner**: `chart/render.ts`, `chart/ChartWidget.ts`

- **Wave 2** (after all Wave 1 streams complete): `plugins.ts` — add
  `reconcileCompiledTrack` to `corePlugin()`. This imports `ViewWidget` from Stream B
  and `isGroupOwner` from Wave 0, so it must wait for both.

---

## Phase 1: Compile-Time Child Tracking

### 1.1 Add `childWidgetIds` to ViewState

**File:** `packages/core/src/compiler/viewTypes.ts`

```typescript
export type ViewState = {
  readonly id: string;
  readonly bounds: NVSRect;
  readonly padding: NormalizedPadding;
  readonly contentBounds: NVSRect;
  readonly layer: number;
  readonly scale: number;
  readonly z: number;
  readonly opacity: number;
  readonly layoutId?: string;
  /** Widget IDs compiled within this View's scoped child context. */
  readonly childWidgetIds: readonly string[];
};
```

### 1.2 Track widget IDs during scoped compilation

**File:** `packages/core/src/compiler/childApi.ts`

Modify the existing `createChildApi` function to wrap the parent's `setWidgetState`
and record which widget IDs were set during the child scope. The function already
exists in this file — the change adds `childWidgetIds` tracking and widens the
return type. The re-export in `sceneDslCompiler.ts`
(`export { createChildApi } from './childApi'`) stays unchanged — TypeScript will
propagate the widened return type automatically.

```typescript
export function createChildApi(
  parentApi: CompileApi,
  parentContentBounds: NVSRect,
  zOffset: number = 0,
  opacityScale: number = 1,
): CompileApi & { /** IDs written by children */ readonly childWidgetIds: string[] } {
  const childWidgetIds: string[] = [];
  return {
    ...parentApi,
    composeBounds: (localRect: NVSRect): NVSRect => {
      const composed = composeBoundsIntoParent(localRect, parentContentBounds);
      return parentApi.composeBounds(composed);
    },
    composeZ: (localZ: number): number => parentApi.composeZ(localZ + zOffset),
    composeOpacity: (localOpacity: number): number =>
      parentApi.composeOpacity(localOpacity * opacityScale),
    setWidgetState: (widgetId: string, state: unknown): void => {
      childWidgetIds.push(widgetId);
      parentApi.setWidgetState(widgetId, state);
    },
    childWidgetIds,
  };
}
```

### 1.3 ViewHandler stores childWidgetIds

**File:** `packages/core/src/compiler/blocks/viewHandlers.ts`

In `viewHandler`, after `helpers.compileChildrenSeparated(node, childApi)`:

```typescript
const childApi = createChildApi(api, contentBounds, zOffset, viewOpacity);
const overlayNodes = helpers.compileChildrenSeparated(node, childApi);

const viewState: ViewState = {
  id,
  bounds,
  padding: normalizedPadding,
  contentBounds,
  layer,
  scale,
  z: zOffset,
  opacity: viewOpacity,
  layoutId,
  childWidgetIds: childApi.childWidgetIds,  // ← NEW
};
api.setWidgetState(id, viewState);
```

---

## Phase 2: ViewWidget — Three.js Group Owner

### 2.1 New file: `packages/core/src/elements/view/ViewWidget.ts`

```typescript
// ViewWidget — IRenderable<ViewState> that owns a THREE.Group for carousel repositioning.
// Runtime-only widget: state is produced by viewHandler, not by a dedicated DSL component.
// Does NOT implement ISceneElement — no DslComponent, no defaultState, no transitionSpec.

import * as THREE from 'three';
import type { IRenderable, WidgetInitContext, WidgetRenderContext } from '../../widget/types';
import type { ViewState } from '../../compiler/viewTypes';

export class ViewWidget implements IRenderable<ViewState> {
  readonly widgetId: string;
  private scene: THREE.Scene | null = null;
  private readonly group = new THREE.Group();

  /** Compile-time View center in NVS coords — captured on first apply(). */
  private originalNvsCenter: { x: number; y: number } | null = null;

  /** Compile-time scale — captured on first apply(). Not hardcoded because
   *  inactive carousel views can start with scale !== 1.0 (inactiveScale^distance). */
  private originalScale: number | null = null;

  /**
   * Compile-time Z offset — captured on first apply(). Used as the delta baseline
   * so that group.position.z = 0 at compile time for all views (including inactive
   * views with non-zero compile-time z). Children's compiled Z positions already
   * bake in this Z offset via composeZ(); using a delta prevents double-counting.
   */
  private originalZ: number | null = null;

  /** Last opacity value — used to short-circuit applyOpacity traversal. */
  private lastAppliedOpacity: number | null = null;

  /** Child widget IDs — populated on first apply() from ViewState. */
  private childWidgetIds: readonly string[] = [];
  private reparented = false;

  /**
   * Callback to look up a child widget's root THREE.Object3D.
   * Passed at construction time by corePlugin's reconcileCompiledTrack.
   */
  private readonly resolveChildRoot: (widgetId: string) => THREE.Object3D | null;

  constructor(
    viewId: string,
    resolveChildRoot: (widgetId: string) => THREE.Object3D | null,
  ) {
    this.widgetId = viewId;
    this.resolveChildRoot = resolveChildRoot;
    this.group.name = `view-group-${viewId}`;
  }

  initialize({ scene }: WidgetInitContext): void {
    this.scene = scene;
    scene.add(this.group);
  }

  apply(state: ViewState, ctx: WidgetRenderContext): void {
    // Lazy reparent: on first apply with childWidgetIds, move children into group.
    if (!this.reparented && state.childWidgetIds.length > 0) {
      this.childWidgetIds = state.childWidgetIds;
      this.reparentChildren();
    }

    // Capture original center, scale, and Z on first valid apply.
    if (!this.originalNvsCenter) {
      this.originalNvsCenter = {
        x: state.bounds.x + state.bounds.w / 2,
        y: state.bounds.y + state.bounds.h / 2,
      };
    }
    if (this.originalScale === null) {
      this.originalScale = state.scale;
    }
    if (this.originalZ === null) {
      this.originalZ = state.z;
    }

    const scaleRatio = state.scale / this.originalScale;

    // Current NVS center
    const newCenterNvs = {
      x: state.bounds.x + state.bounds.w / 2,
      y: state.bounds.y + state.bounds.h / 2,
    };

    // Convert NVS centers to world space
    const [newCx, newCy] = ctx.coords.toWorld(newCenterNvs.x, newCenterNvs.y, 0);
    const [oldCx, oldCy] = ctx.coords.toWorld(
      this.originalNvsCenter.x,
      this.originalNvsCenter.y,
      0,
    );

    // G = P_new - P_old * S  (XY)
    // G_z = state.z - originalZ  (Z delta — children's compiled Z already bakes in
    // originalZ via composeZ(), so setting G_z=0 at compile time keeps world Z correct.
    // After a carousel step, G_z = delta moves children to their new depth.)
    this.group.position.set(
      newCx - oldCx * scaleRatio,
      newCy - oldCy * scaleRatio,
      state.z - this.originalZ,
    );
    this.group.scale.set(scaleRatio, scaleRatio, 1);
    this.group.visible = state.opacity > 0;

    // Apply opacity to all mesh materials in the group.
    // Short-circuit when opacity hasn't changed to avoid per-frame traversal cost.
    if (state.opacity !== this.lastAppliedOpacity) {
      this.applyOpacity(state.opacity);
      this.lastAppliedOpacity = state.opacity;
    }
  }

  dispose(): void {
    // Do NOT reparent children back to the scene root. When the Group has a
    // non-identity transform (G≠0, S≠1), Three.js preserves children's local
    // positions on reparent, causing a world-transform jump. Since dispose() is
    // called during teardown, children are destroyed with the group — no
    // reparenting needed.
    this.scene?.remove(this.group);
    this.scene = null;
    this.reparented = false;
    this.originalNvsCenter = null;
    this.originalScale = null;
    this.originalZ = null;
    this.lastAppliedOpacity = null;
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private reparentChildren(): void {
    for (const childId of this.childWidgetIds) {
      const obj = this.resolveChildRoot(childId);
      if (obj && obj.parent !== this.group) {
        this.group.add(obj); // Three.js auto-removes from previous parent
      }
    }
    this.reparented = true;
  }

  private applyOpacity(opacity: number): void {
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.material) {
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of materials) {
          if ('opacity' in mat) {
            mat.opacity = opacity * (mat.userData._baseOpacity ?? 1);
            mat.transparent = mat.opacity < 1;
          }
        }
      }
    });
  }
}
```

### 2.2 Supporting types

**File:** `packages/core/src/elements/view/types.ts`

```typescript
// Type contracts for the View widget element. No Three.js, no React.

/** Re-export ViewState from viewTypes — the View widget's compiled state. */
export type { ViewState } from '../../compiler/viewTypes';
```

### 2.3 Barrel export

**File:** `packages/core/src/elements/view/index.ts`

```typescript
export { ViewWidget } from './ViewWidget';
export type { ViewState } from './types';
```

---

## Phase 3: Widget Root Object Discovery

ViewWidget needs to find child widgets' root `THREE.Object3D` to reparent them.
We add a minimal interface and implement it on ChartWidget.

### 3.1 New interface: `IGroupOwner`

**File:** `packages/core/src/widget/types.ts`

```typescript
/**
 * Widget that exposes its root Three.js Group for external parenting.
 * Implement this interface to allow ViewWidget to re-parent the widget's
 * 3D content into a View Group for carousel/layout transforms.
 */
export interface IGroupOwner extends IWidget {
  readonly rootGroup: Object3D;
}
```

### 3.2 Type guard

**File:** `packages/core/src/widget/WidgetRegistry.ts`

The type guard uses duck-typing (not `instanceof Object3D`) because `widget/types.ts`
uses `import type` for Three.js — a type-only import has no runtime value for
`instanceof`. This is consistent with all other type guards in `WidgetRegistry.ts`
(`isRenderable`, `isLoadable`, etc.) which also use property-based duck-typing.

The guard additionally requires `rootGroup != null`. A widget that declares
`rootGroup: Object3D` but has not yet initialised the group (returning null/undefined)
is not a valid `IGroupOwner` for reparenting purposes. The stricter check prevents
ViewWidget from silently receiving a null root and attempting to call `group.add(null)`.

```typescript
export function isGroupOwner(widget: IWidget): widget is IGroupOwner {
  return 'rootGroup' in widget && (widget as IGroupOwner).rootGroup != null;
}
```

### 3.2b Export `IGroupOwner` and `isGroupOwner`

**File:** `packages/core/src/widget/index.ts`

Add to the existing exports:

```typescript
export type { IGroupOwner } from './types';
export { isGroupOwner } from './WidgetRegistry';
```

The cascade `packages/core/src/index.ts` → `export * from './widget'` propagates
these automatically, so `import { IGroupOwner, isGroupOwner } from '@brewsite/core'`
resolves correctly for `@brewsite/charts`. No change to `player/index.ts` is needed.

**Note:** `ViewWidget` and `ViewState` are intentionally NOT exported from the public
API. `ViewWidget` is created internally by `corePlugin.reconcileCompiledTrack` — no
external consumer ever constructs one. `ViewState` is consumed only by `ViewWidget`
internally. Package public API surface should be minimal.

### 3.3 ChartRenderer exposes chartGroup

**File:** `packages/charts/src/elements/chart/render.ts`

Change `chartGroup` from private to a public getter. The internal field is renamed
from `chartGroup` to `_chartGroup`. This rename touches ~8 internal references
throughout the class (constructor, `mount()`, `update()`, `dispose()`,
`projectionRenderer` construction, group child additions). All internal references
must be updated to `this._chartGroup`.

```typescript
export class ChartRenderer {
  private readonly _chartGroup = new THREE.Group();
  // ...existing code with all references renamed to _chartGroup...

  /** Root Three.js Group for external parenting by ViewWidget. */
  get chartGroup(): THREE.Group { return this._chartGroup; }
}
```

### 3.4 ChartWidget implements IGroupOwner

**File:** `packages/charts/src/elements/chart/ChartWidget.ts`

```typescript
import type { IGroupOwner } from '@brewsite/core';

export class ChartWidget implements IRenderable<ChartState>, IAnimationController, IGroupOwner {
  // ...existing code...

  get rootGroup(): THREE.Group {
    return this.chartRenderer.chartGroup;
  }
}
```

---

## Phase 4: Registration & Wiring

### 4.1 corePlugin creates ViewWidgets lazily

ViewWidgets are created dynamically — one per View ID encountered in the compiled
scene. This follows the same pattern as ChartWidget in `chartPlugin.ts` line 407
(lazily registered during `reconcileCompiledTrack`).

**File:** `packages/core/src/player/plugins.ts`

**Add a new `reconcileCompiledTrack` method** to the object returned by `corePlugin()`.
The current `corePlugin()` returns an object with `createWidgets`, `registerHandlers`,
and `configureRegistry` — it has no `reconcileCompiledTrack` today. Add the new method
to the returned `WidgetPlugin` object:

```typescript
import { ViewWidget } from '../elements/view/ViewWidget';
import { isGroupOwner } from '../widget/WidgetRegistry';
import type { ViewState } from '../compiler/viewTypes';

// Inside the return object of corePlugin():
return {
  createWidgets() { /* ...existing... */ },
  registerHandlers() { /* ...existing... */ },
  configureRegistry(reg) { /* ...existing... */ },

  // NEW: Register ViewWidgets from compiled state.
  reconcileCompiledTrack: (registry: WidgetRegistry, track: SceneTrack) => {
    for (const tick of track.ticks) {
      for (const [widgetId, state] of Object.entries(tick.state.widgets)) {
        if (isViewStateLike(state) && !registry.get(widgetId)) {
          const resolveChildRoot = (childId: string): THREE.Object3D | null => {
            const child = registry.get(childId);
            if (child && isGroupOwner(child)) return child.rootGroup;
            return null;
          };
          const viewWidget = new ViewWidget(widgetId, resolveChildRoot);
          registry.register(viewWidget);
        }
      }
    }
  },
};
```

With a type guard:

```typescript
function isViewStateLike(state: unknown): state is ViewState {
  if (!state || typeof state !== 'object') return false;
  const s = state as Record<string, unknown>;
  return (
    typeof s['id'] === 'string' &&
    s['bounds'] !== undefined &&
    s['contentBounds'] !== undefined &&
    Array.isArray(s['childWidgetIds'])
  );
}
```

### 4.2 ViewWidget initialization order

ViewWidget must initialize **before** it can reparent children, but children must
also be initialized (so their `rootGroup` exists). The current `RuntimeDriver`
calls `initialize()` on all renderables in registration order. Since
`reconcileCompiledTrack` runs after compilation, ViewWidgets are registered after
chart widgets. But reparenting doesn't happen in `initialize()` — it happens
lazily in the first `apply()` call. By that time, all widgets have been
initialized and their rootGroups exist. ✓

### 4.3 Initialization timeline

```
1. corePlugin.createWidgets()           → core widgets (Camera, Lighting, etc.)
2. chartPlugin.createWidgets()          → (empty — charts are lazy)
3. Compile scene DSL                    → chart NodeHandlers create ChartWidgets
4. reconcileCompiledTrack()             → ViewWidgets created, registered
5. RuntimeDriver.initialize(scene)      → All IRenderable.initialize() called
   - ViewWidget.initialize()            → creates Group, adds to scene
   - ChartWidget.initialize()           → chartRenderer.mount(scene)
6. RuntimeDriver._loadAssets()          → ILoadable.load() — async
7. First tick → RuntimeDriver.tick()
   - ViewWidget.apply()                 → lazy reparent: moves chart groups into view group
   - ChartWidget.apply()                → positions chart at NVS coords (now inside view group)
```

---

## Phase 5: Overlay Reactivity

### Problem

View overlay wrappers are baked at compile time:
```tsx
React.createElement('div', {
  style: { left: '10%', top: '30%', width: '40%', height: '50%' },
}, ...overlayNodes);
```

When the carousel changes View bounds, these CSS positions don't update.

### Solution: Reactive overlay wrapper component

Instead of baking a `<div>` with hardcoded styles, the view handler emits a
**`ViewOverlayWrapper`** React component that reads current ViewState from the
engine tick each frame.

**File:** `packages/core/src/player/ViewOverlayWrapper.tsx`

```typescript
// Reactive overlay wrapper — reads patched ViewState to position view overlays.

import { type ReactElement, type ReactNode, useMemo } from 'react';
import { useSceneEngineContext } from './EngineContext';
import type { ViewState } from '../compiler/viewTypes';

export interface ViewOverlayWrapperProps {
  viewId: string;
  /** Fallback bounds from compile time (used if ViewState not found in tick). */
  fallbackBounds: { x: number; y: number; w: number; h: number };
  fallbackLayer: number;
  fallbackOpacity: number;
  children: ReactNode;
}

export function ViewOverlayWrapper({
  viewId,
  fallbackBounds,
  fallbackLayer,
  fallbackOpacity,
  children,
}: ViewOverlayWrapperProps): ReactElement {
  const engine = useSceneEngineContext();

  // Read current ViewState from the tick (includes patches from carousel).
  const tick = engine.frameState.tick;
  const viewState = tick?.state.widgets[viewId] as ViewState | undefined;

  // Use patched bounds if available, else fall back to compiled defaults.
  const bounds = viewState?.bounds ?? fallbackBounds;
  const layer = viewState?.layer ?? fallbackLayer;
  const opacity = viewState?.opacity ?? fallbackOpacity;

  const style = useMemo(() => ({
    position: 'absolute' as const,
    left: `${bounds.x * 100}%`,
    top: `${bounds.y * 100}%`,
    width: `${bounds.w * 100}%`,
    height: `${bounds.h * 100}%`,
    zIndex: layer,
    opacity,
    pointerEvents: 'none' as const,
    boxSizing: 'border-box' as const,
    transition: 'left 0.3s ease, top 0.3s ease, width 0.3s ease, height 0.3s ease, opacity 0.3s ease',
  }), [bounds.x, bounds.y, bounds.w, bounds.h, layer, opacity]);

  return <div style={style}>{children}</div>;
}
```

### 5.1 viewHandler emits ViewOverlayWrapper instead of static div

**File:** `packages/core/src/compiler/blocks/viewHandlers.ts`

Replace the static `React.createElement('div', ...)` with a `ViewOverlayWrapper`
component reference. Since the compiler must not import React runtime components
from the player layer, the overlay node stores a **descriptor** that
`EngineOverlayHost` resolves at render time.

**Option A (simpler):** Use a marker element with `data-view-id` that
`EngineOverlayHost` replaces with a reactive wrapper at render time.

```typescript
// In viewHandler, replace the static overlay wrapper:
if (overlayNodes.length > 0) {
  const viewOverlay = React.createElement(
    'div',
    {
      key: `view-overlay-${id}`,
      'data-brewsite-view-id': id,
      'data-brewsite-view-bounds': JSON.stringify(bounds),
      'data-brewsite-view-layer': layer,
      'data-brewsite-view-opacity': viewOpacity,
      style: {
        position: 'absolute' as const,
        left: `${bounds.x * 100}%`,
        top: `${bounds.y * 100}%`,
        width: `${bounds.w * 100}%`,
        height: `${bounds.h * 100}%`,
        zIndex: layer,
        opacity: viewOpacity,
        pointerEvents: 'none' as const,
        boxSizing: 'border-box' as const,
      },
    },
    ...overlayNodes,
  );
  api.pushOverlay(viewOverlay);
}
```

Then in `EngineOverlayHost`, a post-processing pass replaces these marker divs
with `ViewOverlayWrapper` components when ViewState patches are active. This
can be deferred to a follow-up phase — the carousel demo scenes use charts (3D),
not TextBox overlays inside Views.

**Note:** Overlay reactivity is a Phase 2 enhancement. The initial implementation
focuses on 3D content (charts) which is what the carousel scenes actually use.
The static overlay positioning continues to work for non-carousel Views.

---

## Phase 6: InputCoordinator Changes

The existing `onCarouselStep` in `InputCoordinator.tsx` already computes new
ViewState patches correctly. **No changes needed.** The ViewWidget's `apply()`
reads the patched ViewState and applies the delta transform.

One small addition: `onCarouselStep` should also emit a
**`CAROUSEL_INDEX_CHANGED`** event or equivalent so that future overlay
reactivity can re-render. For now, the VariableStore write at line 256
(`variableStore.set('carousel', ...)`) serves this purpose.

---

## Phase 7: Opacity Handling (Material baseOpacity)

The `applyOpacity` traversal in ViewWidget needs base opacity values to avoid
destroying material opacity set by the chart renderer. Two approaches:

**Approach A (recommended): Store baseOpacity in material.userData on first encounter.**

```typescript
private applyOpacity(opacity: number): void {
  this.group.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) || !obj.material) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of materials) {
      if (!('opacity' in mat)) continue;
      // Capture base opacity once.
      if (mat.userData._viewBaseOpacity === undefined) {
        mat.userData._viewBaseOpacity = mat.opacity;
      }
      mat.opacity = opacity * (mat.userData._viewBaseOpacity as number);
      mat.transparent = mat.opacity < 1;
    }
  });
}
```

**Approach B (alternative): Let charts handle opacity via their own state.**

If the InputCoordinator also patched each child chart's `opacity` field in the
chart state, the ChartWidget.apply() would set material opacity through its
normal code path. This avoids the traversal but requires the InputCoordinator
to know about child widget state shapes.

**Recommendation:** Use Approach A for initial implementation. It's self-contained
in ViewWidget and works for any widget type. Approach B can be added later as
an optimization if the traversal proves expensive.

---

## File Inventory

### New files

| File | Purpose |
|------|---------|
| `packages/core/src/elements/view/ViewWidget.ts` | IRenderable<ViewState> — Group owner |
| `packages/core/src/elements/view/types.ts` | Re-export ViewState |
| `packages/core/src/elements/view/index.ts` | Barrel |
| `packages/core/src/elements/view/__tests__/ViewWidget.test.ts` | Widget tests |

### Modified files

| File | Change |
|------|--------|
| `packages/core/src/compiler/viewTypes.ts` | Add `childWidgetIds` to ViewState |
| `packages/core/src/compiler/childApi.ts` | `createChildApi` tracks child widget IDs; widened return type |
| `packages/core/src/compiler/blocks/viewHandlers.ts` | Store `childWidgetIds` on ViewState |
| `packages/core/src/widget/types.ts` | Add `IGroupOwner` interface |
| `packages/core/src/widget/WidgetRegistry.ts` | Add `isGroupOwner` duck-type guard |
| `packages/core/src/widget/index.ts` | Export `IGroupOwner` (type) and `isGroupOwner` (value) |
| `packages/core/src/player/plugins.ts` | Add `reconcileCompiledTrack` to `corePlugin()` return object |
| `packages/charts/src/elements/chart/render.ts` | Rename `chartGroup` → `_chartGroup` (~8 refs); add public getter |
| `packages/charts/src/elements/chart/ChartWidget.ts` | Implement `IGroupOwner` |

### Test files

| File | Strategy |
|------|----------|
| `packages/core/src/elements/view/__tests__/ViewWidget.test.ts` | Construct ViewWidget with real `resolveChildRoot` callback. Call `apply()` with real ViewState at compile-time bounds (delta=0) and at shifted bounds (delta≠0). Assert `group.position` and `group.scale`. Assert reparenting via `resolveChildRoot`. Assert `dispose()` removes group from scene (no reparenting back). |
| `packages/core/src/compiler/__tests__/viewHandlers.test.tsx` | Extend existing tests to assert `childWidgetIds` is populated on ViewState. |
| `packages/core/src/compiler/__tests__/createChildApi.test.ts` | New test: verify `childWidgetIds` accumulates IDs from `setWidgetState` calls. |
| `packages/core/src/player/__tests__/corePlugin.test.ts` | New test: verify `reconcileCompiledTrack` registers exactly one ViewWidget per unique view ID in compiled track. Verify `resolveChildRoot` is correctly wired to `isGroupOwner`. |
| `packages/core/src/widget/__tests__/typeGuards.test.ts` | New tests: `isGroupOwner` duck-type guard (positive + negative cases); `isViewStateLike` type guard (positive + negative cases including objects missing `childWidgetIds`). |

---

## Test Strategy

### ViewWidget unit tests

1. **Identity transform at compile-time bounds:** Construct ViewWidget with a
   `resolveChildRoot` callback. Call `apply()` with ViewState matching original
   bounds (z: 0). Assert `group.position` is (0, 0, 0) and `group.scale` is (1, 1, 1).
   The Z delta `state.z - originalZ = 0 - 0 = 0` confirms the group starts at origin.

2. **Delta transform after carousel step:** Call `apply()` first with original
   bounds, then with shifted bounds (e.g., x moved by 0.3). Assert
   `group.position.x` equals the world-space delta.

3. **Scale change:** Call `apply()` with `scale: 0.75` (first call captures
   `originalScale`). Then call with `scale: 0.5`. Assert `group.scale` is
   `(0.5/0.75, 0.5/0.75, 1)` and position accounts for scale-around-center math.

3b. **Z delta — inactive view at compile time:** Construct a ViewState with `z: -0.5`
    (as an inactive carousel view would have). Call `apply()` once — this captures
    `originalZ = -0.5`. Assert `group.position.z === 0` (delta = -0.5 - (-0.5) = 0).
    Then call `apply()` again with `z: 0` (view promoted to active by carousel patch).
    Assert `group.position.z === 0.5` (delta = 0 - (-0.5) = +0.5).
    **Rationale:** children's compiled Z already bakes in originalZ via `composeZ()`.
    The group must start at Z=0 so compile-time world positions remain correct after
    reparenting, and move only by delta after carousel steps.

3c. **Z delta — active view at compile time:** Construct a ViewState with `z: 0`
    (active carousel view). Call `apply()` once — captures `originalZ = 0`. Assert
    `group.position.z === 0`. Call `apply()` again with `z: -0.5` (view moved back).
    Assert `group.position.z === -0.5` (delta = -0.5 - 0 = -0.5).

4. **Reparenting:** Provide a `resolveChildRoot` callback that returns mock
   Object3D instances. Assert they are added to the group on first `apply()`.
   Assert `dispose()` removes the group from the scene (children are destroyed
   with the group — no reparenting back).

5. **Opacity:** Call `apply()` with opacity 0.5. Traverse group, assert mesh
   materials have opacity set. Call again with same opacity — assert the
   traversal is short-circuited (no redundant work).

6. **No reparent when childWidgetIds is empty:** If ViewState has empty
   `childWidgetIds`, no reparenting occurs. Group stays empty.

### Compile-time tracking tests

7. **childWidgetIds populated:** Register a synthetic `ISceneElement` stub via
   `registerNode()` (NOT a real chart widget — `@brewsite/core` tests cannot
   import from `@brewsite/charts`). Compile a scene with
   `<ViewLayout><View id="v1"><FakeSpatial /></View></ViewLayout>`. Assert the
   ViewState for "v1" has `childWidgetIds` containing the synthetic widget's ID.

   ```typescript
   const FakeSpatial = () => null;
   FakeSpatial.displayName = 'FakeSpatial';
   registerNode(FakeSpatial, (node, api) => {
     api.setWidgetState('fake-1', { someState: true });
   });
   ```

8. **Nested Views:** Compile nested Views. Assert each View's `childWidgetIds` contains only its direct children's widget IDs, not grandchildren.

### Type guard tests

9. **`isGroupOwner` duck-type guard:** Test with an object that has a non-null
   `rootGroup` property (positive), an object without `rootGroup` (negative), and
   an object where `rootGroup` is null (negative — the guard requires
   `'rootGroup' in widget && rootGroup != null` to prevent ViewWidget from
   reparenting to an uninitialised group).

10. **`isViewStateLike` type guard:** Test with a valid ViewState-shaped object
    (positive), an object missing `childWidgetIds` (negative), an object missing
    `bounds` (negative), and a non-object value like `null` (negative).

### Registration integration tests

11. **`reconcileCompiledTrack` registers ViewWidgets:** Create a `WidgetRegistry`.
    Build a mock `SceneTrack` with ticks containing ViewState-shaped entries for
    view IDs "v1" and "v2". Call `corePlugin().reconcileCompiledTrack(registry, track)`.
    Assert the registry contains two ViewWidgets. Assert calling a second time
    with the same track does not create duplicates.

12. **`resolveChildRoot` wiring:** After `reconcileCompiledTrack`, register a mock
    widget that satisfies `isGroupOwner` (has a `rootGroup` property). Verify
    that the ViewWidget's internal `resolveChildRoot` correctly resolves the
    child's `rootGroup` through the registry.

### Integration test

13. **End-to-end carousel step:** Compile a carousel scene, create a mock engine
    with `patchWidgetStates`. Simulate ArrowRight → verify ViewWidget.apply()
    receives patched bounds → verify group position changed.

---

## Migration & Backward Compatibility

- **ViewState shape change:** Adding `childWidgetIds` is additive. Since all
  ViewState producers live in this codebase (`viewHandler` in `viewHandlers.ts`),
  the field is added as **required** (`readonly childWidgetIds: readonly string[]`)
  from day one. All producers are updated simultaneously in Wave 1 Stream A.

- **ChartWidget IGroupOwner:** Adding `rootGroup` getter is additive. No
  existing callers break.

- **ChartRenderer.chartGroup:** Renaming internal `chartGroup` to `_chartGroup`
  and adding a getter is internal to the class. No external consumers access the
  private field directly.

- **Standalone Views (no ViewLayout):** Views not inside a ViewLayout don't get
  a ViewWidget unless they appear in the compiled track with `childWidgetIds`.
  Since standalone Views have no carousel interaction, this is correct — no
  ViewWidget overhead for static Views.

- **Non-chart widgets inside Views:** Any widget that doesn't implement
  `IGroupOwner` simply won't be reparented. It will render at its compile-time
  position. This is a graceful degradation, not a failure. Future widgets can
  opt in by implementing `IGroupOwner`.

---

## Open Questions / Follow-up

1. **Overlay reactivity — `ViewOverlayWrapper.tsx` (deferred):** A reactive
   overlay wrapper component (`packages/core/src/player/ViewOverlayWrapper.tsx`)
   is sketched in Phase 5 above but **not part of this plan's deliverables**.
   The carousel demo scenes use charts (3D), not HTML overlays inside Views.
   The static overlay positioning continues to work for non-carousel Views.
   Implement `ViewOverlayWrapper` when a real use case requires reactive HTML
   overlay positioning inside carousel Views. The component should read current
   ViewState from the engine context (likely `useEngineState` or `EngineContext`)
   — note that `useSceneEngineContext` referenced in the Phase 5 sketch does
   not exist; the correct hook must be determined at implementation time.

2. **Smooth animation between carousel positions:** Currently the carousel
   snaps to the new index. Adding CSS `transition` on the overlay wrapper and
   lerping the Group transform over N frames would create smooth animation.
   This is a separate concern from getting the basic rendering working.

3. **Diagram widgets inside Views:** `@brewsite/diagram`'s `DiagramWidget`
   would need to implement `IGroupOwner` to participate in carousel Views.
   This is a follow-up once the pattern is proven with charts.

4. **VariableStore-driven re-render:** The overlay wrapper reads from the
   engine tick, which updates on `patchWidgetStates`. Need to verify that
   React re-renders the overlay when patches change. May need a subscription
   to VariableStore or a forced re-render signal.

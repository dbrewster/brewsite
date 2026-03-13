---
title: "Implementation Plan: Scene View Constraint (v1 Authoring Enforcement)"
doc_type: plan
owner: Toolkit Architecture
status: complete
updated: 2026-03-13
revision: "v2 — post-debate fixes (P0 skipElements, P0 HTML overlay, P1 stream separation, P2 test gaps)"
---

# Implementation Plan: Scene View Constraint (v1 Authoring Enforcement)

## Table of Contents

1. [Overview](#1-overview)
2. [Key Design Decisions](#2-key-design-decisions)
3. [Dependency Graph](#3-dependency-graph)
4. [Stream A — Registry Category Infrastructure](#4-stream-a--registry-category-infrastructure)
5. [Stream B — Extract createChildApi + Scene Root Handler Factory](#5-stream-b--extract-createchildapi--scene-root-handler-factory)
6. [Stream C — Ambient Category Declarations](#6-stream-c--ambient-category-declarations)
7. [Stream D — Scene Root Enforcement + Auto-Wrap](#7-stream-d--scene-root-enforcement--auto-wrap)
8. [Stream E — Tests](#8-stream-e--tests)
9. [Stream F — Examples Cleanup](#9-stream-f--examples-cleanup)
10. [PM Documentation Checklist](#10-pm-documentation-checklist)
11. [File Ownership Matrix](#11-file-ownership-matrix)

---

## 1. Overview

This plan implements a compile-time constraint on `<Scene>` children that enforces a single, unified compilation path for all spatial content through the `viewHandler`. The goal is to eliminate ambiguous coordinate-system behavior before v1 release.

**The two rules:**

1. **If no `<View>` or `<ViewLayout>` is a direct child of `<Scene>`:** at most one spatial element is allowed. The compiler auto-wraps it in an implicit full-screen `<View id="__scene_root__" x={0} y={0} w={1} h={1}>`. If there are zero spatial children (ambient + overlay only), no auto-wrap occurs.

2. **If any `<View>` or `<ViewLayout>` is a direct child of `<Scene>`:** all spatial elements must be inside Views. Any spatial element found as a direct Scene child alongside Views produces a `console.error` and is skipped.

**What "spatial" means:** any DSL component registered with `category: 'spatial'` (the default for all new registrations). Examples: `<BarChart>`, `<DiagramCanvas>`, `<Model>`, `<ImagePanel>`, `<Screen>`.

**What "ambient" means:** any DSL component registered with `category: 'ambient'`. These are always allowed as direct Scene children regardless of View presence. Examples: `<Camera>`, `<Lighting>`, `<Background>`, `<Environment>`, `<Floor>`, `<SpotlightRig>`, `<InputController>`, `<ProgressManager>`, `<Transition>`, `<SceneMeta>`, `<TextBox>`, `<View>`, `<ViewLayout>`.

**Why `TextBox` is ambient:** TextBox is a pure HTML overlay element with no 3D canvas presence. It has NVS coordinates but operates entirely in the overlay tier (EngineOverlayHost). A floating TextBox over a fullscreen diagram is the most common overlay pattern; requiring it to be inside a View adds ceremony with no value. When inside an explicit View it gains coordinate scoping — that is additive, not mandatory.

**Why auto-wrap rather than a hard error:** the single-spatial-child case is the most common scene pattern today. Auto-wrapping it silently to a full-screen View makes the constraint backward-compatible in behavior while unifying the internal code path. The author does not need to add any JSX.

**No backward compatibility concern:** the team has explicitly opted out of backward compat for this change. This plan makes no effort to preserve old behavior.

---

## 2. Key Design Decisions

### 2.1 Category Is Stored in the Registry, Not on IWidget

The `'spatial' | 'ambient'` classification belongs to the **NodeHandler registration**, not to the widget runtime interface. Widgets are runtime objects; NodeHandlers are compile-time objects. The category controls compiler behavior, not runtime behavior.

**Concrete implementation:** `registry.ts` grows a parallel `Map<unknown, NodeHandlerCategory>` alongside `nodeRegistry`. `registerNode` accepts an optional `options.category`. `getHandlerCategory` reads from the parallel map, returning `'spatial'` if not set.

**WidgetRegistry path:** When `WidgetRegistry.register(widget)` installs a node handler for `widget.DslComponent`, it duck-type-checks `widget.nodeHandlerCategory` (an optional string literal property, not a declared interface member). If present, that value is passed to `registerNode` as the category. This means ambient core widgets declare `readonly nodeHandlerCategory = 'ambient' as const` on their class — a one-line addition to each widget class body. No `IWidget` interface change is required.

### 2.2 Circular Dependency Must Be Broken Before the Enforcement Code Can Be Written

The enforcement logic in `sceneRootHandler` needs to call `viewHandler` for the auto-wrap. But:

- `viewHandlers.ts` imports `createChildApi` from `sceneDslCompiler.ts`
- If `sceneDslCompiler.ts` imports `viewHandler` from `viewHandlers.ts`, a circular module dependency is created

**Solution:** extract `createChildApi` to a new standalone file `compiler/childApi.ts`. After extraction:
- `viewHandlers.ts` imports `createChildApi` from `../childApi` (no cycle)
- `sceneDslCompiler.ts` can safely import `viewHandler` from `./blocks/viewHandlers`

Additionally, the `sceneRootHandler` is converted from a standalone exported constant to a factory function `createSceneRootHandler(deps)` that receives `viewHandler`, `View`, and `ViewLayout` as injected dependencies. `coreHandlers.ts` is the wiring point — it imports everything and calls `registerNode(Scene, createSceneRootHandler({ viewHandler, View, ViewLayout }))`. This keeps `sceneDslCompiler.ts` free of direct imports from the blocks layer, which is cleaner long-term.

### 2.3 Implicit View ID Is a Reserved Sentinel

The auto-wrap creates `<View id="__scene_root__" ...>`. The double-underscore prefix is the convention for internal sentinel IDs. `viewHandler` will emit a `console.warn` if an author uses an id that starts and ends with `__` — this prevents silent collision between user-authored and compiler-generated ids.

### 2.4 Errors Are Non-Fatal

Constraint violations call `console.error` and skip the offending children, but compilation continues. The ambient elements (Camera, Lighting, etc.) still compile, so the scene renders with its global configuration intact. A hard `throw` inside a scene compilation would crash the entire engine; a non-fatal error preserves the scene skeleton and is debuggable.

### 2.5 The `ViewLayout` Direct Scene Child Case

`<ViewLayout>` as a direct child of `<Scene>` (without a wrapping `<View>`) is valid and common. It triggers `hasExplicitViews = true` — the scene is in explicit-view mode. `<ViewLayout>` itself is in the "View element" bucket, not the spatial bucket. Its `<View>` children are inside it, not direct Scene children, so they are not double-counted.

### 2.6 Multiple Views Without ViewLayout

`<View id="a">...</View><View id="b">...</View>` as siblings directly inside `<Scene>`, without a parent `<ViewLayout>`, is valid. This is manually positioned content. The enforcement only checks whether spatial elements are outside Views when Views are present — it does not require ViewLayout to be the parent of Views.

---

## 3. Dependency Graph

```
Stream A (registry.ts category infrastructure)
    │
    ├── Stream B (childApi extraction + handler factory)  ← independent, parallel with A
    │
    ├──[A done]── Stream C (ambient category declarations on widgets + coreHandlers)
    │
    ├──[A + B + C done]── Stream D (enforcement logic + auto-wrap in scene root handler)
    │
    └──[D done]── Stream E (tests) — parallel with Stream F
                  Stream F (examples cleanup)
```

Streams A and B are fully independent and can be worked in parallel by two developers. Stream C requires A. Stream D requires A, B, and C. Streams E and F require D and can run in parallel.

---

## 4. Stream A — Registry Category Infrastructure

**Goal:** extend `registry.ts` to store and retrieve NodeHandler categories. No logic changes to any handler, widget, or compiler pass.

**Owner file:** `packages/core/src/compiler/registry.ts`

### 4.1 Type Addition

Add the following type to `packages/core/src/compiler/sceneDslTypes.ts` (alongside `NodeHandler`):

```typescript
/**
 * Classifies a DSL component for Scene-level child constraint enforcement.
 *
 * 'spatial' — element occupies an NVS region in the 3D canvas. Subject to the
 *   Scene view constraint: must be the sole direct child (auto-wrapped) or inside
 *   a <View>. This is the DEFAULT for all registered components.
 *
 * 'ambient' — element configures the scene globally and is not region-bound.
 *   Always allowed as a direct <Scene> child regardless of View presence.
 *   Examples: Camera, Lighting, Background, Environment, Floor, TextBox.
 */
export type NodeHandlerCategory = 'spatial' | 'ambient';

/**
 * Options bag for registerNode. Extensible for future registration metadata.
 */
export type RegisterNodeOptions = {
  /**
   * Category for Scene-level child constraint enforcement.
   * Defaults to 'spatial' if not provided — the safe default for new elements.
   */
  category?: NodeHandlerCategory;
};
```

### 4.2 registry.ts Changes

Replace the entire content of `packages/core/src/compiler/registry.ts`:

```typescript
// registry.ts — NodeHandler registration, lookup, and category storage.
// The category map enforces the Scene view constraint at compile time.

import type { NodeHandler, NodeHandlerCategory, RegisterNodeOptions } from './sceneDslTypes';

const nodeRegistry = new Map<unknown, NodeHandler>();
const nodeRegistryByName = new Map<string, NodeHandler>();

// Parallel map stores the category for each registered component.
// Components not present default to 'spatial' (the safe default).
const nodeCategoryRegistry = new Map<unknown, NodeHandlerCategory>();
const nodeCategoryRegistryByName = new Map<string, NodeHandlerCategory>();

export const registerNode = (
  component: unknown,
  handler: NodeHandler,
  options?: RegisterNodeOptions,
): void => {
  nodeRegistry.set(component, handler);
  if (options?.category) {
    nodeCategoryRegistry.set(component, options.category);
  }
  if (typeof component === 'function') {
    const name = (component as { displayName?: string; name?: string }).displayName
      ?? (component as { name?: string }).name;
    if (name) {
      nodeRegistryByName.set(name, handler);
      if (options?.category) {
        nodeCategoryRegistryByName.set(name, options.category);
      }
    }
  }
};

export const getNodeHandler = (component: unknown): NodeHandler | undefined => {
  if (nodeRegistry.has(component)) return nodeRegistry.get(component);
  if (typeof component === 'function') {
    const name = (component as { displayName?: string; name?: string }).displayName
      ?? (component as { name?: string }).name;
    if (name) return nodeRegistryByName.get(name);
  }
  return undefined;
};

/**
 * Returns the NodeHandlerCategory for a registered component.
 * Returns 'spatial' (the default) for any component that is registered but
 * has no explicit category set, or for any unregistered component.
 */
export const getHandlerCategory = (component: unknown): NodeHandlerCategory => {
  if (nodeCategoryRegistry.has(component)) {
    return nodeCategoryRegistry.get(component)!;
  }
  if (typeof component === 'function') {
    const name = (component as { displayName?: string; name?: string }).displayName
      ?? (component as { name?: string }).name;
    if (name && nodeCategoryRegistryByName.has(name)) {
      return nodeCategoryRegistryByName.get(name)!;
    }
  }
  return 'spatial';
};

export const isPrimitiveComponent = (component: unknown): boolean =>
  Boolean(getNodeHandler(component));

export const clearRegistry = (): void => {
  nodeRegistry.clear();
  nodeRegistryByName.clear();
  nodeCategoryRegistry.clear();
  nodeCategoryRegistryByName.clear();
};
```

### 4.3 Export from compiler index

`packages/core/src/compiler/index.ts` does NOT export `getHandlerCategory` or `NodeHandlerCategory`. These are internal compiler infrastructure. The compiler index exports only the DSL authoring surface.

### 4.4 Stream A Tests

File: `packages/core/src/compiler/__tests__/registry.test.ts`

Add the following test cases to the existing file:

```typescript
// NodeHandlerCategory storage and retrieval
describe('getHandlerCategory', () => {
  beforeEach(() => clearRegistry());

  it('returns spatial for a component registered without options', () => {
    const Comp = () => null;
    registerNode(Comp, () => {});
    expect(getHandlerCategory(Comp)).toBe('spatial');
  });

  it('returns spatial for an unregistered component', () => {
    const Comp = () => null;
    expect(getHandlerCategory(Comp)).toBe('spatial');
  });

  it('returns ambient for a component registered with category: ambient', () => {
    const Comp = () => null;
    registerNode(Comp, () => {}, { category: 'ambient' });
    expect(getHandlerCategory(Comp)).toBe('ambient');
  });

  it('returns spatial for a component registered with category: spatial', () => {
    const Comp = () => null;
    registerNode(Comp, () => {}, { category: 'spatial' });
    expect(getHandlerCategory(Comp)).toBe('spatial');
  });

  it('resolves category by display name when component reference differs', () => {
    // Simulates cross-module identity loss (same displayName, different reference)
    const Comp1 = () => null;
    Comp1.displayName = 'SharedComp';
    registerNode(Comp1, () => {}, { category: 'ambient' });

    const Comp2 = () => null;
    Comp2.displayName = 'SharedComp';
    expect(getHandlerCategory(Comp2)).toBe('ambient');
  });

  it('clearRegistry also clears category entries', () => {
    const Comp = () => null;
    registerNode(Comp, () => {}, { category: 'ambient' });
    clearRegistry();
    expect(getHandlerCategory(Comp)).toBe('spatial');
  });
});
```

---

## 5. Stream B — Extract createChildApi + Scene Root Handler Factory

**Goal:** break the potential circular dependency (`sceneDslCompiler.ts` ↔ `viewHandlers.ts`) before Stream D adds imports in that direction. Convert `sceneRootHandler` from a static export to a factory function that accepts injected dependencies.

**Owner files:**
- `packages/core/src/compiler/childApi.ts` ← new file
- `packages/core/src/compiler/sceneDslCompiler.ts` ← modified
- `packages/core/src/compiler/coreHandlers.ts` ← modified
- `packages/core/src/compiler/blocks/viewHandlers.ts` ← import path updated

### 5.1 New File: `packages/core/src/compiler/childApi.ts`

Extract `createChildApi` verbatim from `sceneDslCompiler.ts` into this new file.

```typescript
// childApi.ts — Factory for a scoped child CompileApi that inherits from a parent
// but overrides composeBounds, composeZ, and composeOpacity for nested view regions.

import type { CompileApi } from './sceneDslTypes';
import type { NVSRect } from '../layout/types';
import { composeBoundsIntoParent } from '../layout/regionNormalize';

/**
 * Creates a child CompileApi that delegates to the parent but overrides composeBounds
 * to compose local coordinates into the given parentContentBounds, composeZ to
 * accumulate Z offsets, and composeOpacity to multiply through opacity scales.
 *
 * Used by viewHandler to create scoped compilation contexts for view children.
 * The child api delegates pushOverlay to the parent so overlay nodes bubble up
 * to the scene root.
 */
export function createChildApi(
  parentApi: CompileApi,
  parentContentBounds: NVSRect,
  zOffset: number = 0,
  opacityScale: number = 1,
): CompileApi {
  return {
    ...parentApi,
    composeBounds: (localRect: NVSRect): NVSRect => {
      const composed = composeBoundsIntoParent(localRect, parentContentBounds);
      return parentApi.composeBounds(composed);
    },
    composeZ: (localZ: number): number => {
      return parentApi.composeZ(localZ + zOffset);
    },
    composeOpacity: (localOpacity: number): number => {
      return parentApi.composeOpacity(localOpacity * opacityScale);
    },
    pushOverlay: (node) => parentApi.pushOverlay(node),
  };
}
```

### 5.2 Update `viewHandlers.ts` Import

In `packages/core/src/compiler/blocks/viewHandlers.ts`, change:

```typescript
// Before:
import { createChildApi } from '../sceneDslCompiler';

// After:
import { createChildApi } from '../childApi';
```

No other changes to `viewHandlers.ts`.

### 5.3 Remove `createChildApi` from `sceneDslCompiler.ts`

Delete the `createChildApi` function body from `sceneDslCompiler.ts`. Keep the export name as a re-export from `childApi.ts` **only if it is used externally by tests or other files**. Check with `grep -r 'createChildApi' packages/` before removing — if tests import it from `sceneDslCompiler`, update those imports to `'../childApi'` or `'./childApi'` as appropriate.

### 5.4 Convert `sceneRootHandler` to a Factory in `sceneDslCompiler.ts`

The `sceneRootHandler` is currently a module-level constant. Replace it with a factory:

```typescript
// sceneDslCompiler.ts — replace the exported constant with a factory

import type { NodeHandler } from './sceneDslTypes';

/**
 * Dependencies injected at registration time by coreHandlers.ts.
 * This pattern avoids a circular import between sceneDslCompiler and viewHandlers.
 */
export type SceneRootHandlerDeps = {
  /** The viewHandler function — called for auto-wrapping a single spatial child. */
  viewHandler: NodeHandler;
  /** The View DSL component — used for type-checking direct Scene children and auto-wrap createElement. */
  View: React.ComponentType<ViewProps>;
  /** The ViewLayout DSL component — used for type-checking direct Scene children. */
  ViewLayout: React.ComponentType<unknown>;
};

/**
 * Factory that creates the sceneRootHandler NodeHandler with the given deps injected.
 * Called once by registerCoreHandlers() in coreHandlers.ts.
 */
export function createSceneRootHandler(deps: SceneRootHandlerDeps): NodeHandler {
  return (node, api, helpers) => {
    // ... all existing sceneRootHandler logic, unchanged ...
    // Stream D will add enforceSceneChildConstraint() call here.
  };
}
```

**Important:** Remove the `sceneRootHandler` export entirely — no legacy binding. All consumers must be updated in this stream:

1. `packages/core/src/compiler/coreHandlers.ts` (line 5, 32) — change to import `createSceneRootHandler` and call the factory. See §5.5.
2. `packages/core/src/compiler/__tests__/sceneDslCompiler.test.tsx` (lines 4, 135, 220) — change to import `createSceneRootHandler` and construct with a test deps stub:

```typescript
import { createSceneRootHandler, Scene } from '../sceneDslCompiler';
import { View } from '../blocks/viewDsl';
import { ViewLayout } from '../blocks/viewLayoutDsl';
import { viewHandler } from '../blocks/viewHandlers';
import type { SceneRootHandlerDeps } from '../sceneDslCompiler';

const testDeps: SceneRootHandlerDeps = { viewHandler, View, ViewLayout };
const sceneRootHandler = createSceneRootHandler(testDeps);
```

Verify no other import sites exist:
```bash
grep -r 'sceneRootHandler' packages/core/src
```

### 5.5 Update `coreHandlers.ts` (Stream B changes only)

Stream B's only change to `coreHandlers.ts` is wiring the factory pattern. The `{ category: 'ambient' }` options on all `registerNode` calls are **Stream C work** (requires `RegisterNodeOptions` from Stream A) and must not be applied here.

```typescript
// coreHandlers.ts — Stream B changes only (factory wiring)
import { Scene, createSceneRootHandler } from './sceneDslCompiler';
import { View } from './blocks/viewDsl';
import { ViewLayout } from './blocks/viewLayoutDsl';
import { viewHandler, viewLayoutHandler } from './blocks/viewHandlers';

export function registerCoreHandlers(): void {
  if (coreHandlersRegistered) return;
  coreHandlersRegistered = true;

  if (!getNodeHandler(Scene)) {
    // Factory pattern — inject viewHandler and DSL component refs into scene root handler.
    // This avoids a circular import between sceneDslCompiler.ts and viewHandlers.ts.
    // NOTE: Stream C will add { category: 'ambient' } to this and all other registerNode calls below.
    registerNode(Scene, createSceneRootHandler({ viewHandler, View, ViewLayout }));
  }
  ensureInputControllerRegistry();
  if (!getNodeHandler(ProgressManager)) {
    registerNode(ProgressManager, progressManagerHandler);
  }
  if (!getNodeHandler(Transition)) {
    registerNode(Transition, (_node, _api, _helpers) => {});
  }
  if (!getNodeHandler(View)) {
    registerNode(View, viewHandler);
  }
  if (!getNodeHandler(ViewLayout)) {
    registerNode(ViewLayout, viewLayoutHandler);
  }
}
```

Stream C will add `{ category: 'ambient' }` to every `registerNode` call above. See §6.1.

`InputController`, `Action`, `PointerMap`, `WheelMap`, `KeyMap`, `PinchMap` are registered in `ensureInputControllerRegistry()` in `compiler/blocks/inputController.tsx` — these also need `{ category: 'ambient' }`. See Stream C for those changes.

### 5.6 Stream B Typecheck Gate

After completing Stream B, run:
```bash
pnpm --filter @brewsite/core typecheck
pnpm --filter @brewsite/core test
```

Both must pass before Stream D begins.

---

## 6. Stream C — Ambient Category Declarations

**Goal:** mark all ambient DSL components with `{ category: 'ambient' }` so the enforcement logic in Stream D can correctly classify Scene children. Two registration paths exist: direct `registerNode` calls and the WidgetRegistry path.

**Depends on:** Stream A (for `RegisterNodeOptions` type)

### 6.1 Direct `registerNode` Calls — `coreHandlers.ts` and `inputController.tsx`

Stream C adds `{ category: 'ambient' }` to all `registerNode` calls in `coreHandlers.ts` (Stream B left these without category options — see §5.5). Add `{ category: 'ambient' }` to every `registerNode` call in `registerCoreHandlers()`.

**Note on View/ViewLayout category:** `View` and `ViewLayout` are registered as `{ category: 'ambient' }` here, but the constraint enforcement in Stream D matches them by type reference (`type === deps.View`), not by category. The 'ambient' category prevents them from being misclassified as spatial if any future code path checks `getHandlerCategory` outside the constraint function. Add a comment: `// Category is 'ambient' by convention; constraint enforcement matches View/ViewLayout by type reference, not category.`

In `packages/core/src/compiler/blocks/inputController.tsx`, update `ensureInputControllerRegistry()`:

```typescript
// All input controller sub-components are ambient — they configure input behavior,
// not spatial content.
if (!getNodeHandler(InputController)) registerNode(InputController, inputControllerHandler, { category: 'ambient' });
if (!getNodeHandler(Action))          registerNode(Action,          childOnlyHandler('Action'),          { category: 'ambient' });
if (!getNodeHandler(PointerMap))      registerNode(PointerMap,      childOnlyHandler('PointerMap'),      { category: 'ambient' });
if (!getNodeHandler(WheelMap))        registerNode(WheelMap,        childOnlyHandler('WheelMap'),        { category: 'ambient' });
if (!getNodeHandler(KeyMap))          registerNode(KeyMap,          childOnlyHandler('KeyMap'),          { category: 'ambient' });
if (!getNodeHandler(PinchMap))        registerNode(PinchMap,        childOnlyHandler('PinchMap'),        { category: 'ambient' });
```

### 6.2 WidgetRegistry Path — Duck-Type Category on Widget Classes

`WidgetRegistry.register(widget)` installs a NodeHandler for `widget.DslComponent`. Extend the installation to read `widget.nodeHandlerCategory` if present.

**Change in `packages/core/src/widget/WidgetRegistry.ts`** — in the `register()` method, at the `registerNode(widget.DslComponent, ...)` call site (around line 191):

```typescript
// Before (both registerNode call sites inside register()):
registerNode(widget.DslComponent, (node, api, helpers) => { ... });

// After — read optional category from widget duck-type property:
const widgetCategory: NodeHandlerCategory | undefined =
  'nodeHandlerCategory' in widget
    ? (widget as { nodeHandlerCategory: NodeHandlerCategory }).nodeHandlerCategory
    : undefined;

registerNode(widget.DslComponent, (node, api, helpers) => { ... }, widgetCategory ? { category: widgetCategory } : undefined);
```

Apply the same pattern to the `registerTypeFactory` call site.

**Import addition in `WidgetRegistry.ts`:**
```typescript
import type { NodeHandlerCategory } from '../compiler/sceneDslTypes';
```

### 6.3 Core Widget Class Additions

Add `readonly nodeHandlerCategory = 'ambient' as const;` to each of the following widget classes. These are the direct class bodies in each `{Name}Widget.ts` file:

| Widget Class | File |
|---|---|
| `CameraWidget` | `packages/core/src/elements/camera/CameraWidget.ts` |
| `LightingWidget` | `packages/core/src/elements/lighting/LightingWidget.ts` |
| `BackgroundWidget` | `packages/core/src/elements/background/BackgroundWidget.ts` |
| `EnvironmentWidget` | `packages/core/src/elements/environment/EnvironmentWidget.ts` |
| `FloorWidget` | `packages/core/src/elements/floor/FloorWidget.ts` |
| `SpotlightRigWidget` | `packages/core/src/elements/spotlight-rig/SpotlightRigWidget.ts` |
| `TextBoxWidget` | `packages/core/src/elements/text-box/TextBoxWidget.ts` |
| `SceneMetaWidget` | `packages/core/src/player/SceneMetaWidget.ts` |

**Example — CameraWidget.ts addition:**
```typescript
class CameraWidget implements ISceneElement<CameraState>, IAnimationController, ... {
  // Ambient: Camera configures the scene globally. Not an NVS-bounded canvas element.
  readonly nodeHandlerCategory = 'ambient' as const;

  // ... rest of class unchanged ...
}
```

No `IWidget` interface or `ISceneElement` interface modification is required. This is a duck-typed optional property.

### 6.4 Downstream Packages — No Action Required

`@brewsite/diagram` (`DiagramCanvas`/`Diagram`, `ImagePanel`, `Screen`) and `@brewsite/charts` (`ChartWidget`) are spatial by default (no category registered). They require no changes. The enforcement will correctly classify them as spatial.

`@brewsite/model` (`ModelWidget`) is spatial by default. No changes.

---

## 7. Stream D — Scene Root Enforcement + Auto-Wrap

**Goal:** implement the constraint enforcement inside `createSceneRootHandler`. This is the core of the feature.

**Depends on:** Streams A, B, C all complete and typechecking.

### 7.1 New Helper: `enforceSceneChildConstraint`

Create `packages/core/src/compiler/sceneViewConstraint.ts`:

> **Design decision (post-review v2):** This function uses `collectChildrenShallow`
> (Fragment-only expansion), NOT the deep `collectChildren` that also calls function
> components. The constraint operates on the **authored DSL structure** — Fragments are
> transparent (they're a grouping convenience), but function-component wrappers are
> opaque (the author explicitly structured the tree that way). Using deep expansion
> would create confusing behavior where a wrapper component's *output* is classified
> rather than the wrapper itself.
>
> **Design decision (post-review v2):** Children with string-typed `type` (HTML elements
> like `<div>`, `<h1>`) are skipped during classification. These are valid overlay
> content in the existing `compileChildrenSeparated` pipeline and must not be
> misclassified as spatial. `getHandlerCategory('div')` returns `'spatial'` (the
> default for unregistered components), which would cause false errors without this
> guard.
>
> **Design decision (post-review v2):** Instead of returning a `Set<ReactElement>` of
> handled children for a `skipElements` parameter (which breaks due to
> `React.Children.toArray` producing different object references on each call), this
> function returns a `remaining` array of children that the caller should compile.
> This eliminates the double-collection problem entirely — both classification and
> filtering happen on the same `Children.toArray` output.

```typescript
// sceneViewConstraint.ts — Enforces the Scene view constraint:
// at most one spatial direct child without Views; all spatial children
// must be inside Views when Views are present.
//
// Called by the sceneRootHandler before compilation of Scene children.

import React, { isValidElement, type ReactElement } from 'react';
import type { CompileApi, CompileHelpers, NodeHandler } from './sceneDslTypes';
import { getHandlerCategory } from './registry';
import type { ViewProps } from './blocks/viewDsl';

/** The reserved id used for the auto-generated implicit root View. */
export const IMPLICIT_SCENE_ROOT_VIEW_ID = '__scene_root__';

/**
 * Result of constraint enforcement. The caller compiles `remaining` children
 * (spatial children that were auto-wrapped or errored are already excluded).
 */
export type ConstraintResult = {
  /** Children that should be compiled by the caller (spatial children removed). */
  remaining: unknown[];
};

/**
 * Scans direct Scene children (shallow — Fragments expanded, function components
 * NOT expanded) and enforces the view constraint. Spatial children that are
 * auto-wrapped or errored are compiled/skipped here; the returned `remaining`
 * array contains only the children the caller should pass to compilation.
 *
 * Uses the same `collectChildrenShallow` output that `compileChildrenSeparated`
 * uses, ensuring reference equality between classified and compiled children.
 */
export function enforceSceneChildConstraint(
  allChildren: unknown[],
  sceneId: string | null,
  api: CompileApi,
  helpers: CompileHelpers,
  deps: {
    viewHandler: NodeHandler;
    View: React.ComponentType<ViewProps>;
    ViewLayout: React.ComponentType<unknown>;
  },
): ConstraintResult {
  const directChildren = allChildren.filter(isValidElement) as ReactElement[];

  const viewChildren: ReactElement[] = [];
  const spatialChildren: ReactElement[] = [];
  // Ambient and HTML overlay children are not collected — they compile normally.

  for (const child of directChildren) {
    const type = child.type;
    // HTML elements (<div>, <h1>, etc.) are overlay content — not spatial, not ambient.
    if (typeof type === 'string') continue;
    if (type === deps.View || type === deps.ViewLayout) {
      viewChildren.push(child);
    } else {
      const category = getHandlerCategory(type);
      if (category === 'spatial') {
        spatialChildren.push(child);
      }
      // 'ambient' — falls through to normal compilation in the caller
    }
  }

  const hasExplicitViews = viewChildren.length > 0;
  // Build a set of spatial child references for fast lookup during filtering.
  const spatialSet = new Set<unknown>(spatialChildren);

  // ─── Case 1: Mixed — spatial children alongside View/ViewLayout children ────
  if (hasExplicitViews && spatialChildren.length > 0) {
    const names = spatialChildren
      .map((c) => getComponentDisplayName(c.type))
      .join(', ');
    console.error(
      `[Scene '${sceneId ?? 'unknown'}'] Spatial elements (${names}) cannot be ` +
      `direct <Scene> children when <View> or <ViewLayout> children are present. ` +
      `Wrap each spatial element in a <View>.`,
    );
    // Remove spatial children from remaining — they are not compiled.
    return { remaining: allChildren.filter((c) => !spatialSet.has(c)) };
  }

  // ─── Case 2: Multiple spatial children without Views — hard error ────────────
  if (!hasExplicitViews && spatialChildren.length > 1) {
    const names = spatialChildren
      .map((c) => getComponentDisplayName(c.type))
      .join(', ');
    console.error(
      `[Scene '${sceneId ?? 'unknown'}'] Multiple spatial elements (${names}) require ` +
      `explicit <View> wrappers. Use a single spatial element (auto-wrapped to fullscreen) ` +
      `or wrap each in a <View> inside a <ViewLayout>.`,
    );
    // Remove all spatial children — skip all to avoid partial output.
    return { remaining: allChildren.filter((c) => !spatialSet.has(c)) };
  }

  // ─── Case 3: Single spatial child — auto-wrap in implicit full-screen View ──
  if (!hasExplicitViews && spatialChildren.length === 1) {
    const spatialChild = spatialChildren[0]!;
    const implicitView = React.createElement(
      deps.View,
      {
        id: IMPLICIT_SCENE_ROOT_VIEW_ID,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
      } as ViewProps,
      spatialChild,
    );
    deps.viewHandler(implicitView, api, helpers);
    // Remove the spatial child — it has been compiled through the viewHandler.
    return { remaining: allChildren.filter((c) => c !== spatialChild) };
  }

  // ─── Case 4: No spatial children — nothing to do ────────────────────────────
  // (Zero spatial, any number of ambient + TextBox + Views — always valid.)
  return { remaining: allChildren };
}

function getComponentDisplayName(type: ReactElement['type']): string {
  if (typeof type === 'string') return type;
  if (typeof type === 'function') {
    const fn = type as { displayName?: string; name?: string };
    return fn.displayName ?? fn.name ?? 'unknown';
  }
  return 'unknown';
}
```

### 7.2 Update `createSceneRootHandler` in `sceneDslCompiler.ts`

> **Design decision (post-review v2):** The original plan used a `skipElements: Set<ReactElement>`
> parameter on `compileChildrenSeparated`. This is broken: `React.Children.toArray` clones
> elements with augmented keys on every call, so the `Set` references from
> `enforceSceneChildConstraint` would never match the references in the compilation loop.
> The fix is to collect children once (via `collectChildrenShallow`) and pass the same
> array to both the constraint function and the compilation function.

Inside `createSceneRootHandler`, the scene root handler now:
1. Collects children once via `collectChildrenShallow(node)`.
2. Passes the full array to `enforceSceneChildConstraint`, which classifies, auto-wraps or errors spatial children, and returns the `remaining` array (spatial children removed).
3. Passes the `remaining` array to a new `compileChildrenFromArray` helper for compilation.

**New helper: `compileChildrenFromArray`**

Add to `CompileHelpers` in `sceneDslTypes.ts`:

```typescript
/**
 * Like compileChildrenSeparated, but operates on a pre-collected children array
 * rather than extracting children from a node. Used by the scene root handler
 * to compile the filtered children returned by enforceSceneChildConstraint.
 *
 * DSL children (with registered NodeHandlers) are compiled into api.state.
 * Non-DSL children (HTML elements, non-registered components) are collected
 * and returned as overlay content.
 */
compileChildrenFromArray(
  children: unknown[],
  api: CompileApi,
): ReactNode[];
```

Implement in `sceneDslCompiler.ts` by extracting the core loop from `compileChildrenSeparated` into a shared function that accepts a pre-collected array. `compileChildrenSeparated` becomes a thin wrapper that calls `collectChildrenShallow(node)` and delegates to the shared function.

**Updated `createSceneRootHandler` usage:**

```typescript
import { enforceSceneChildConstraint } from './sceneViewConstraint';
import { collectChildrenShallow } from './sceneDslCompiler'; // or inline the shallow collection

export function createSceneRootHandler(deps: SceneRootHandlerDeps): NodeHandler {
  return (node, api, helpers) => {
    // ... existing id resolution, meta, material multiplier, transition logic ...

    const sceneId = /* ... existing id resolution ... */;

    // Collect children once — shared between constraint and compilation.
    // Uses shallow collection (Fragments expanded, function components NOT expanded).
    const allChildren = collectChildrenShallow(node);

    // Enforce the view constraint. Spatial children are auto-wrapped or errored;
    // the remaining array excludes them.
    const { remaining } = enforceSceneChildConstraint(allChildren, sceneId, api, helpers, deps);

    // Compile remaining children (ambient, views, overlays).
    const overlayNodes = helpers.compileChildrenFromArray(remaining, api);

    // Merge in any overlay nodes pushed by nested View/ViewLayout handlers via pushOverlay().
    const pushedOverlays = (api as ReturnType<typeof createApi>)._overlayNodes;
    if (pushedOverlays.length > 0) {
      overlayNodes.push(...pushedOverlays);
    }

    // ... existing overlay wrapping logic ...
  };
}
```

**Important:** `collectChildrenShallow` must be exported from `sceneDslCompiler.ts` (it is currently a module-private function). Add `export` to its declaration.

### 7.3 Reserved ID Guard in `viewHandler`

In `packages/core/src/compiler/blocks/viewHandlers.ts`, after the existing `id` validation:

```typescript
import { IMPLICIT_SCENE_ROOT_VIEW_ID } from '../sceneViewConstraint';

// In viewHandler, after the existing id validation:
if (
  typeof id === 'string' &&
  id !== IMPLICIT_SCENE_ROOT_VIEW_ID && // allow the compiler's own sentinel
  id.startsWith('__') &&
  id.endsWith('__')
) {
  console.warn(
    `[View] ID "${id}" uses the reserved '__...__' naming pattern. ` +
    `This prefix is reserved for compiler-generated views. Choose a different id.`,
  );
}
```

Note: the import of `IMPLICIT_SCENE_ROOT_VIEW_ID` from `sceneViewConstraint.ts` does not create a circular dependency. `sceneViewConstraint.ts` imports from `registry.ts` and `sceneDslTypes.ts` — neither of which imports from `viewHandlers.ts`.

### 7.4 `CompileHelpers` Addition — `compileChildrenFromArray`

Add `compileChildrenFromArray` to `CompileHelpers` in `sceneDslTypes.ts` (signature shown in §7.2 above).

**No changes to `compileChildrenSeparated`'s existing signature.** The `skipElements` parameter proposed in the original plan is removed — it was broken due to `React.Children.toArray` reference identity issues. The new approach uses a pre-filtered array instead.

Implement `compileChildrenFromArray` in `sceneDslCompiler.ts` by extracting the core child-processing loop from `compileChildrenSeparated` into a shared internal function:

```typescript
// Internal shared implementation — processes a pre-collected children array.
function processChildrenForOverlay(
  children: unknown[],
  api: CompileApi,
  helpers: CompileHelpers,
  stack: DslBreadcrumb[],
): ReactNode[] {
  // ... the existing child loop from compileChildrenSeparated, unchanged ...
}

// compileChildrenSeparated now delegates:
compileChildrenSeparated: (node, api): ReactNode[] => {
  const crumb = buildBreadcrumb(node);
  stack.push(crumb);
  const children = collectChildrenShallow(node);
  const result = processChildrenForOverlay(children, api, helpers, stack);
  stack.pop();
  return result;
},

// New: compileChildrenFromArray — same loop, pre-collected input.
compileChildrenFromArray: (children, api): ReactNode[] => {
  return processChildrenForOverlay(children, api, helpers, stack);
},
```

---

## 8. Stream E — Tests

**Goal:** full test coverage of the new constraint behavior. All tests are interface-based and stateful — real DSL inputs, real SceneFrame output assertions.

**New file:** `packages/core/src/compiler/__tests__/sceneViewConstraint.test.tsx`

**Updates to existing files:**
- `packages/core/src/compiler/__tests__/viewHandlers.test.tsx` — add reserved ID guard test
- `packages/core/src/compiler/__tests__/registry.test.ts` — Stream A tests (documented in §4.4)

### 8.1 Test Setup Pattern

All tests in `sceneViewConstraint.test.tsx` use the standard pattern:

```typescript
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerCoreHandlers, resetCoreHandlerRegistrationForTesting } from '../../coreHandlers';
import { clearRegistry, registerNode } from '../registry';
import { resolveSceneFromDsl } from '../sceneDslCompiler';
import { Scene } from '../sceneDslCompiler';
import { View } from '../blocks/viewDsl';
import { ViewLayout } from '../blocks/viewLayoutDsl';
import { WidgetRegistry } from '../../widget/WidgetRegistry';

// A minimal spatial DSL component for testing
const SpatialWidget = () => null;
SpatialWidget.displayName = 'SpatialWidget';

// A second spatial component for multi-spatial tests
const SpatialWidget2 = () => null;
SpatialWidget2.displayName = 'SpatialWidget2';

// A minimal ambient DSL component for testing
const AmbientWidget = () => null;
AmbientWidget.displayName = 'AmbientWidget';

const CONTEXT = {
  sceneIndex: 0,
  numScenes: 1,
  assetsReady: true,
  variables: {},
  viewport: { width: 1920, height: 1080, aspectRatio: 16 / 9 },
};

// Use a real WidgetRegistry — the constraint enforcement doesn't use it at
// compile time, but resolveSceneFromDsl requires it as a parameter.
const registry = new WidgetRegistry();

beforeEach(() => {
  clearRegistry();
  resetCoreHandlerRegistrationForTesting();
  registerCoreHandlers();
  // Register test widgets — spatial is the default (no category)
  registerNode(SpatialWidget, (node, api) => {
    api.setWidgetState('spatial-test', { compiled: true });
  });
  registerNode(SpatialWidget2, (node, api) => {
    api.setWidgetState('spatial-test-2', { compiled: true });
  });
  // Register ambient test widget — writes state so we can verify it compiles on error paths
  registerNode(AmbientWidget, (node, api) => {
    api.setWidgetState('ambient-test', { compiled: true });
  }, { category: 'ambient' });
});

function compile(jsx: React.ReactElement) {
  return resolveSceneFromDsl(jsx, CONTEXT, registry);
}
```

### 8.2 Test Cases

#### Auto-wrap: single spatial child

```typescript
it('auto-wraps a single spatial child in a fullscreen implicit View', () => {
  const result = compile(
    <Scene id="s1">
      <SpatialWidget />
    </Scene>
  );
  // ViewState for the implicit view should be in the compiled output
  const viewState = result.frame.widgets['__scene_root__'];
  expect(viewState).toBeDefined();
  expect(viewState).toMatchObject({ id: '__scene_root__', bounds: { x: 0, y: 0, w: 1, h: 1 } });
  // The spatial widget's state should also be present (compiled through viewHandler)
  expect(result.frame.widgets['spatial-test']).toEqual({ compiled: true });
});
```

#### Auto-wrap: single spatial child + ambient children coexist

```typescript
it('auto-wraps the spatial child and compiles ambient children normally', () => {
  const warnings: unknown[] = [];
  const result = resolveSceneFromDsl(
    <Scene id="s1">
      <AmbientWidget />
      <SpatialWidget />
    </Scene>,
    CONTEXT,
    {} as any,
    (w) => warnings.push(w),
  );
  expect(result.frame.widgets['__scene_root__']).toBeDefined();
  expect(result.frame.widgets['spatial-test']).toEqual({ compiled: true });
  expect(warnings).toHaveLength(0);
});
```

#### No spatial children — no auto-wrap, no error

```typescript
it('compiles ambient-only scenes without creating an implicit View', () => {
  const result = compile(
    <Scene id="s1">
      <AmbientWidget />
    </Scene>
  );
  expect(result.frame.widgets['__scene_root__']).toBeUndefined();
  expect(result.frame.widgets).not.toMatchObject({ id: '__scene_root__' });
});
```

#### Multiple spatial children without Views — console.error, children skipped

```typescript
it('emits console.error and skips all spatial children when multiple are present without Views', () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const result = compile(
    <Scene id="s1">
      <SpatialWidget />
      <SpatialWidget />
    </Scene>
  );
  expect(errorSpy).toHaveBeenCalledOnce();
  expect(errorSpy.mock.calls[0]![0]).toContain('Multiple spatial elements');
  expect(result.frame.widgets['spatial-test']).toBeUndefined();
  errorSpy.mockRestore();
});
```

#### Mixed mode — spatial child alongside explicit View — console.error, spatial skipped

```typescript
it('emits console.error when a spatial child is alongside a View child', () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const result = compile(
    <Scene id="s1">
      <View id="v1"><SpatialWidget /></View>
      <SpatialWidget />
    </Scene>
  );
  expect(errorSpy).toHaveBeenCalledOnce();
  expect(errorSpy.mock.calls[0]![0]).toContain('cannot be direct <Scene> children');
  errorSpy.mockRestore();
});
```

#### Explicit single View — spatial child inside View compiles correctly

```typescript
it('compiles a spatial child inside an explicit View without errors', () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const result = compile(
    <Scene id="s1">
      <View id="main" x={0} y={0} w={1} h={1}>
        <SpatialWidget />
      </View>
    </Scene>
  );
  expect(errorSpy).not.toHaveBeenCalled();
  expect(result.frame.widgets['main']).toBeDefined();
  expect(result.frame.widgets['spatial-test']).toEqual({ compiled: true });
  errorSpy.mockRestore();
});
```

#### ViewLayout as direct Scene child is valid explicit-view mode

```typescript
it('accepts ViewLayout as a direct Scene child without error', () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  compile(
    <Scene id="s1">
      <ViewLayout kind="stack">
        <View id="a"><SpatialWidget /></View>
        <View id="b"><SpatialWidget /></View>
      </ViewLayout>
    </Scene>
  );
  expect(errorSpy).not.toHaveBeenCalled();
  errorSpy.mockRestore();
});
```

#### Multiple sibling Views without ViewLayout — valid

```typescript
it('accepts multiple sibling Views as direct Scene children', () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  compile(
    <Scene id="s1">
      <View id="left" x={0} y={0} w={0.5} h={1}><SpatialWidget /></View>
      <View id="right" x={0.5} y={0} w={0.5} h={1}><SpatialWidget /></View>
    </Scene>
  );
  expect(errorSpy).not.toHaveBeenCalled();
  errorSpy.mockRestore();
});
```

#### TextBox (ambient) alongside spatial child — valid, no error

```typescript
it('compiles a TextBox alongside a spatial child without error (TextBox is ambient)', () => {
  // TextBox is registered as ambient via its widget nodeHandlerCategory.
  // In this test we simulate this by registering a TextBox-like ambient component.
  const TextBoxLike = () => null;
  TextBoxLike.displayName = 'TextBoxLike';
  registerNode(TextBoxLike, () => {}, { category: 'ambient' });

  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const result = compile(
    <Scene id="s1">
      <SpatialWidget />
      <TextBoxLike />
    </Scene>
  );
  // Only one spatial child — auto-wrapped; TextBoxLike compiled as ambient
  expect(result.frame.widgets['__scene_root__']).toBeDefined();
  expect(errorSpy).not.toHaveBeenCalled();
  errorSpy.mockRestore();
});
```

#### Reserved ID guard in viewHandler

Add to `viewHandlers.test.tsx`:

```typescript
it('emits console.warn when a View uses a reserved __...__ id', () => {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  compile(<Scene id="s1"><View id="__my_reserved__"><SpatialWidget /></View></Scene>);
  expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('reserved'));
  warnSpy.mockRestore();
});

it('does not warn for the compiler-generated __scene_root__ sentinel id', () => {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  compile(<Scene id="s1"><SpatialWidget /></Scene>); // triggers auto-wrap with __scene_root__
  // Filter for the reserved-id warning specifically
  const reservedWarnings = warnSpy.mock.calls.filter(([msg]) =>
    typeof msg === 'string' && msg.includes('reserved')
  );
  expect(reservedWarnings).toHaveLength(0);
  warnSpy.mockRestore();
});
```

#### (Post-review v2) Empty Scene — no children

```typescript
it('compiles an empty Scene without errors or implicit View', () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const result = compile(<Scene id="s1" />);
  expect(errorSpy).not.toHaveBeenCalled();
  expect(result.frame.widgets['__scene_root__']).toBeUndefined();
  errorSpy.mockRestore();
});
```

#### (Post-review v2) HTML overlay as direct Scene child — not classified as spatial

```typescript
it('does not classify HTML elements as spatial children', () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const result = compile(
    <Scene id="s1">
      <SpatialWidget />
      <div key="overlay">Hello</div>
    </Scene>
  );
  // Single spatial child + HTML overlay → auto-wrap fires, no error
  expect(errorSpy).not.toHaveBeenCalled();
  expect(result.frame.widgets['__scene_root__']).toBeDefined();
  expect(result.frame.widgets['spatial-test']).toEqual({ compiled: true });
  errorSpy.mockRestore();
});
```

#### (Post-review v2) Fragment-wrapped spatial child — auto-wrapped correctly

```typescript
it('auto-wraps a spatial child inside a Fragment', () => {
  const result = compile(
    <Scene id="s1">
      <>{<SpatialWidget />}</>
    </Scene>
  );
  expect(result.frame.widgets['__scene_root__']).toBeDefined();
  expect(result.frame.widgets['spatial-test']).toEqual({ compiled: true });
});
```

#### (Post-review v2) Multiple spatial children inside Fragments — error emitted

```typescript
it('emits error for multiple spatial children across Fragments', () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  compile(
    <Scene id="s1">
      <><SpatialWidget /></>
      <><SpatialWidget2 /></>
    </Scene>
  );
  expect(errorSpy).toHaveBeenCalledOnce();
  expect(errorSpy.mock.calls[0]![0]).toContain('Multiple spatial elements');
  errorSpy.mockRestore();
});
```

#### (Post-review v2) Ambient children still compile when spatial children are errored

```typescript
it('preserves ambient widget state when spatial children are errored and skipped', () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const result = compile(
    <Scene id="s1">
      <AmbientWidget />
      <SpatialWidget />
      <SpatialWidget2 />
    </Scene>
  );
  // Multiple spatial children → error, spatial skipped
  expect(errorSpy).toHaveBeenCalledOnce();
  // But ambient widget state is preserved — the scene skeleton compiles
  expect(result.frame.widgets['ambient-test']).toEqual({ compiled: true });
  // Spatial widgets were not compiled
  expect(result.frame.widgets['spatial-test']).toBeUndefined();
  expect(result.frame.widgets['spatial-test-2']).toBeUndefined();
  errorSpy.mockRestore();
});
```

#### (Post-review v2) Function-component wrapper around spatial element — treated as opaque

```typescript
it('treats function-component wrappers as opaque (shallow collection)', () => {
  // The constraint uses collectChildrenShallow — it does NOT expand function components.
  // A wrapper is seen as a single non-registered child, not as its expanded spatial output.
  const Wrapper = () => <SpatialWidget />;
  Wrapper.displayName = 'Wrapper';

  // Wrapper is not registered → falls through to compileChildrenSeparated's expansion path.
  // Since it's the only child and it's not classified as spatial (it's unregistered but
  // also not a function component with a handler), the constraint doesn't fire.
  // This test documents the shallow-only behavior.
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const result = compile(<Scene id="s1"><Wrapper /></Scene>);
  // No error — the wrapper is expanded during normal compilation, not during constraint.
  expect(errorSpy).not.toHaveBeenCalled();
  errorSpy.mockRestore();
});
```

#### (Post-review v2) Unregistered component alongside explicit View — classified as spatial

```typescript
it('classifies unregistered function components as spatial by default', () => {
  const UnknownWidget = () => null;
  UnknownWidget.displayName = 'UnknownWidget';
  // NOT registered — getHandlerCategory returns 'spatial' (the default)

  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  compile(
    <Scene id="s1">
      <View id="v1"><SpatialWidget /></View>
      <UnknownWidget />
    </Scene>
  );
  // Mixed mode: View + unregistered spatial → error
  expect(errorSpy).toHaveBeenCalledOnce();
  expect(errorSpy.mock.calls[0]![0]).toContain('cannot be direct <Scene> children');
  errorSpy.mockRestore();
});
```

### 8.3 Typecheck and Run Gate

```bash
pnpm --filter @brewsite/core typecheck
pnpm --filter @brewsite/core test
```

Both must pass. Target: zero new TypeScript errors, all new tests green, all existing tests unbroken.

---

## 9. Stream F — Examples Cleanup

**Goal:** update `apps/examples/` scenes that have multiple spatial children as direct Scene children without Views. These will now produce `console.error` at runtime without being updated.

**Depends on:** Stream D complete.

### 9.1 Audit Command

Run the following to identify scenes that need updating:

```bash
# Find scenes with multiple direct DSL children (proxy for multiple spatial children)
# NOTE: This grep is a pre-scan hint and may miss chart variants (LineChart, ScatterChart, etc.)
# or future spatial elements. The authoritative audit is running `pnpm dev` and observing
# console.error output — the constraint enforcement will flag all affected scenes at runtime.
grep -rl 'DiagramCanvas\|BarChart\|LineChart\|ScatterChart\|AreaChart\|<Model\|ImagePanel\|Screen' apps/examples/src --include='*.tsx'
```

Manually audit each file. **Additionally, run `pnpm dev` and check the browser console for `console.error` messages from the constraint enforcement.** This is the authoritative audit method.

For each scene that has multiple spatial children as direct `<Scene>` children (not already inside `<View>`):

1. Wrap each spatial child in a `<View id="..." x={...} y={...} w={...} h={...}>`.
2. If they are side by side, wrap the whole group in `<ViewLayout kind="stack">`.
3. If the current scene has a single spatial child that works correctly today (auto-wrapped), **no change is required** — the auto-wrap is silent and produces identical compiled output.

### 9.2 Scenes Likely to Need Updates

Based on the current codebase, the input-showcase scenes using carousel layouts already use `<ViewLayout>` and `<View>` correctly and require no changes.

Scenes in `apps/examples/src/diagram/`, `apps/examples/src/complex/`, `apps/examples/src/simple/` that place `<Diagram>` alongside a second spatial element will need wrapping. Audit individually.

---

## 10. PM Documentation Checklist

The following PRDs and documentation files must be updated to reflect the new constraint. These updates are PM responsibility and should be done concurrently with or immediately after Stream D lands.

### 10.1 `requirements/core/prd/prd_scene_authoring.md`

**Section to update:** Scene content rules / DSL authoring surface.

**Changes required:**
- Add a new subsection "Scene Child Constraint" (or similar heading) documenting the two rules: single spatial = auto-wrapped, multiple spatial require Views, mixed = error.
- Define "spatial element" and "ambient element" for authors, with an explicit list of which built-in elements fall into each category.
- Document that `<TextBox>` is ambient and can always appear as a direct `<Scene>` child.
- Add a worked example showing: (a) single fullscreen diagram (no View needed), (b) two charts side by side (requires ViewLayout + Views), (c) diagram + floating TextBox (no Views needed).
- Document the implicit `__scene_root__` View: authors do not declare it, but its `ViewState` will appear in SceneInspector output. Clarify this is not a user-facing concept.
- Document the reserved `__...__` id naming convention and the `console.warn` it produces.

### 10.2 `requirements/core/prd/prd_compiler.md`

**Section to update:** Scene compilation pipeline / NodeHandler registration.

**Changes required:**
- Document the new `NodeHandlerCategory` type (`'spatial' | 'ambient'`).
- Document the new `RegisterNodeOptions` type and the optional `category` parameter on `registerNode`.
- Document `getHandlerCategory(component)` — when plugin authors would use it (they generally won't, but it should be mentioned as part of the registry API).
- Document the Scene root handler's enforcement behavior: classification of direct children, auto-wrap mechanics, error cases.
- Update the NodeHandler registration contract to state that all new `registerNode` calls should explicitly declare their category when the default (`'spatial'`) is not appropriate.

### 10.3 `requirements/core/prd/prd_widget_sdk.md`

**Section to update:** ISceneElement / widget registration.

**Changes required:**
- Document the optional duck-typed `nodeHandlerCategory` property on widget classes.
- Specify which `IWidget` sub-interfaces imply ambient classification (currently: none — it's a separate opt-in property, not derived from an interface).
- Add a table listing built-in core widgets and their categories (ambient: Camera, Lighting, Background, Environment, Floor, SpotlightRig, TextBox, SceneMeta; spatial: none in core — all in downstream packages).
- Note that downstream package widgets (`ChartWidget`, `DiagramWidget`, `ModelWidget`, `ImagePanelWidget`, `ScreenWidget`) are spatial by default and do not need to declare this property.

### 10.4 `requirements/core/prd/prd_vision_overview.md`

**Section to update:** §3.6 Normalized Viewport Space / §4.4 DSL Authoring Components.

**Changes required:**
- In §3.6: Add a paragraph describing the Scene child constraint as a first-class authoring model rule. The NVS model now has a clear: ambient elements at the Scene level configure the global environment; spatial elements inside Views define positioned 3D regions.
- In §4.4: Update the `<View>` and `<ViewLayout>` DSL reference entries to note the constraint rules. Consider adding a visual callout box or NOTE: block distinguishing ambient vs. spatial elements.

### 10.5 `apps/examples/` — Developer-Facing Comments

After Stream F cleans up the examples, add a comment block to at least one representative scene file (e.g., the diagram example) explaining the spatial/ambient distinction and why `<DiagramCanvas>` does not need an explicit `<View>` in the single-element case.

---

## 11. File Ownership Matrix

| File | Stream | Operation |
|---|---|---|
| `packages/core/src/compiler/sceneDslTypes.ts` | A | Add `NodeHandlerCategory`, `RegisterNodeOptions` |
| `packages/core/src/compiler/registry.ts` | A | Add `nodeCategoryRegistry`, `getHandlerCategory`, update `registerNode`, update `clearRegistry` |
| `packages/core/src/compiler/__tests__/registry.test.ts` | A | Add category tests |
| `packages/core/src/compiler/childApi.ts` | B | **New file** — extract `createChildApi` |
| `packages/core/src/compiler/sceneDslCompiler.ts` | B | Remove `createChildApi`, convert `sceneRootHandler` to `createSceneRootHandler(deps)`, export `collectChildrenShallow`, add `compileChildrenFromArray` to helpers |
| `packages/core/src/compiler/__tests__/sceneDslCompiler.test.tsx` | B | Update `sceneRootHandler` imports to `createSceneRootHandler` with test deps stub |
| `packages/core/src/compiler/blocks/viewHandlers.ts` | B | Update `createChildApi` import source |
| `packages/core/src/compiler/coreHandlers.ts` | B (factory wiring) + C (category annotations) | Wire `createSceneRootHandler(deps)` in B; add `{ category: 'ambient' }` to all registrations in C |
| `packages/core/src/compiler/blocks/inputController.tsx` | C | Add `{ category: 'ambient' }` to all sub-component registrations |
| `packages/core/src/widget/WidgetRegistry.ts` | C | Duck-type read `widget.nodeHandlerCategory`, pass to `registerNode` |
| `packages/core/src/elements/camera/CameraWidget.ts` | C | Add `readonly nodeHandlerCategory = 'ambient' as const` |
| `packages/core/src/elements/lighting/LightingWidget.ts` | C | Add `readonly nodeHandlerCategory = 'ambient' as const` |
| `packages/core/src/elements/background/BackgroundWidget.ts` | C | Add `readonly nodeHandlerCategory = 'ambient' as const` |
| `packages/core/src/elements/environment/EnvironmentWidget.ts` | C | Add `readonly nodeHandlerCategory = 'ambient' as const` |
| `packages/core/src/elements/floor/FloorWidget.ts` | C | Add `readonly nodeHandlerCategory = 'ambient' as const` |
| `packages/core/src/elements/spotlight-rig/SpotlightRigWidget.ts` | C | Add `readonly nodeHandlerCategory = 'ambient' as const` |
| `packages/core/src/elements/text-box/TextBoxWidget.ts` | C | Add `readonly nodeHandlerCategory = 'ambient' as const` |
| `packages/core/src/player/SceneMetaWidget.ts` | C | Add `readonly nodeHandlerCategory = 'ambient' as const` |
| `packages/core/src/compiler/sceneViewConstraint.ts` | D | **New file** — `enforceSceneChildConstraint`, `IMPLICIT_SCENE_ROOT_VIEW_ID`, `ConstraintResult` |
| `packages/core/src/compiler/sceneDslCompiler.ts` | D | Call `enforceSceneChildConstraint` inside `createSceneRootHandler`, use `compileChildrenFromArray` |
| `packages/core/src/compiler/blocks/viewHandlers.ts` | D | Add reserved-id guard using `IMPLICIT_SCENE_ROOT_VIEW_ID` |
| `packages/core/src/compiler/__tests__/sceneViewConstraint.test.tsx` | E | **New file** — all constraint enforcement tests |
| `packages/core/src/compiler/__tests__/viewHandlers.test.tsx` | E | Add reserved-id guard tests |
| `apps/examples/src/**/*.tsx` (affected scenes only) | F | Wrap multi-spatial scenes in Views |
| `requirements/core/prd/prd_scene_authoring.md` | PM | Scene child constraint documentation |
| `requirements/core/prd/prd_compiler.md` | PM | NodeHandlerCategory, enforceSceneChildConstraint docs |
| `requirements/core/prd/prd_widget_sdk.md` | PM | nodeHandlerCategory optional property docs |
| `requirements/core/prd/prd_vision_overview.md` | PM | NVS / DSL authoring surface updates |

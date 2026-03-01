---
title: "Core Modularization — @brewsite/model Package Extraction"
doc_type: plan
owner: brewsite-architect
status: complete
updated: 2026-03-01
---

# Core Modularization — @brewsite/model Package Extraction

## Table of Contents

1. [Background and Motivation](#1-background-and-motivation)
2. [Scope and Constraints](#2-scope-and-constraints)
3. [Current State: What Already Exists](#3-current-state-what-already-exists)
4. [Phase 1 — Formalize Core Widget Interfaces](#4-phase-1--formalize-core-widget-interfaces)
5. [Phase 2 — Runtime Cleanup](#5-phase-2--runtime-cleanup)
6. [Phase 3 — WidgetPlugin Contract and Explicit Registration](#6-phase-3--widgetplugin-contract-and-explicit-registration)
7. [Phase 4 — Extract @brewsite/model](#7-phase-4--extract-brewsitemodel)
8. [Open Questions for PM Decision](#8-open-questions-for-pm-decision)
9. [Implementation Sequence and Releasability](#9-implementation-sequence-and-releasability)
10. [Testing Strategy](#10-testing-strategy)

---

## 1. Background and Motivation

`@brewsite/core` currently contains model-specific concepts that have no place in a
generic animation engine. Three categories of problems compound each other:

**Duck-typed runtime interfaces.** `RuntimeDriverImpl` checks for
`anchorModel.getAnchorBoneName?.(key)`, `anchorModel.findBoneNode?.(name)`, and three
different spellings of an Object3D reference (`getObject3D?.()`, `.object3D`, `.group`).
These patterns are invisible to widget authors — they are discovered only by reading
`RuntimeDriver.ts` source. A widget that needs to serve as an anchor host has no
interface contract to conform to; it must know the internal duck-typing convention.

**Model-specific concepts baked into core infrastructure.** `SceneTrackTick.labelPrimitives`,
`SceneFrame.labels`, `CompileApi.pushLabel`, `CompileExtraContext.clipMeta`, and
`WidgetRegistry.getContainedModels()` all exist because `ModelWidget` needs them.
Nothing in core's generic runtime requires these fields. They impose a model dependency
on every consumer of these types, even those that use no models.

**Auto-registration prevents tree-shaking.** `compiler/blocks/inputController.tsx`
calls `ensureInputControllerRegistry()` at module scope. `compiler/primitives/progressManager.ts`
calls `registerNode(ProgressManager, handler)` at module scope. `compiler/sceneDslCompiler.ts`
calls `ensureInputControllerRegistry()` and `registerNode(Scene, sceneRootHandler)` at
module scope. Importing anything from `@brewsite/core` triggers all of these
registrations — the handler registry is never empty, and tree-shaking cannot remove
handlers for features the scene author does not use.

**What this plan achieves:**

- Formal TypeScript interfaces for all cross-widget attachment and render-contribution
  patterns, eliminating duck-typing.
- Removal of model-specific fields from `SceneTrackTick`, `SceneFrame`, `CompileApi`,
  and `CompileExtraContext`.
- A `WidgetPlugin` contract enabling composable, tree-shakeable widget registration.
- A new published npm package `@brewsite/model` that contains all model- and
  label-specific code, with `@brewsite/core` as a peer dependency.

---

## 2. Scope and Constraints

**In scope:**

- New interfaces in `packages/core/src/widget/types.ts` (Phase 1)
- `RuntimeDriverImpl` and `WidgetRegistry` updates (Phase 2)
- `WidgetPlugin` contract, `corePlugin()`, `EngineProvider.plugins` prop (Phase 3)
- New `packages/model/` workspace (Phase 4)

**Hard constraints that this plan must not violate:**

- `@brewsite/core` must never import from `@brewsite/diagram` (unchanged).
- `@brewsite/diagram` may import from `@brewsite/core` but not from `@brewsite/model`
  unless `@brewsite/model` is added as a peer dependency of `@brewsite/diagram`.
- The element module pattern (`types.ts → dsl.tsx → compile.ts → render.ts →
  {Name}Widget.ts → index.ts`) is mandatory in both the existing and new packages.
- All new interfaces live in `types.ts` files. No Three.js in `types.ts`.
- `IRenderable.dispose()` remains mandatory for every `IRenderable` implementor.

**Out of scope for this plan:**

- `@brewsite/diagram` DSL handler registration — diagram already uses its own
  `registerDiagramHandlers()` pattern, which becomes a `diagramPlugin()` in a
  subsequent plan.
- HUD, input, and timeline subsystems — no modularization changes for these.
- The annotation subsystem — no files exist under `packages/core/src/annotations/`
  and no action is required.

---

## 3. Current State: What Already Exists

This section records the exact current state of each file that Phase 1–4 will modify.
Implementing bots must read these files before making changes.

### 3.1 Duck-Typed Patterns in RuntimeDriver.ts

**File:** `packages/core/src/runtime/RuntimeDriver.ts`

`attachContainedModels()` (lines 112–148) resolves anchor hosts via:
```typescript
(anchorModel as { getAnchorBoneName?: (key: string) => string | undefined })
  .getAnchorBoneName?.(widget.anchorKey)
```
and resolves the child Object3D via:
```typescript
(widget as unknown as { getObject3D?: () => unknown; object3D?: unknown; group?: unknown })
  .getObject3D?.() ?? ... .object3D ?? ... .group
```

`getBoneWorldPositions()` (lines 223–237) duck-types:
```typescript
const provider = renderable as unknown as {
  getBoneWorldPositions?: () => Map<string, [number, number, number]>;
};
```

`getTargetColors()` (lines 239–252) has the same pattern for `getTargetColors?()`.

`this.containedModels` (line 42) is typed `Array<import('../widget/types').IContainedModel<unknown>>`.
It is populated from `this.widgetRegistry.getContainedModels()` in the constructor (line 73).

**File:** `packages/core/src/runtime/types.ts`

The `RuntimeDriver` interface (lines 60–93) exposes `getBoneWorldPositions()` and
`getTargetColors()` as named methods — these are model-specific concepts on a generic
interface.

### 3.2 Model-Specific Fields on Core Types

**File:** `packages/core/src/compiler/sceneTrackTypes.ts`

- `SceneTrackTick.labelPrimitives?: LabelResolved[]` (line 225) — model-specific.
- `SceneFrame.labels?: LabelResolved[]` (line 134) — model-specific.
- `SceneFrameDelta.labels?` (line 168) — model-specific.
- The file imports `LabelResolved` from `'../labels/types'` (line 5) and re-exports it
  (line 11) — a label-module dependency baked into core's type pipeline.

**File:** `packages/core/src/compiler/sceneDslTypes.ts`

- `CompileApi.pushLabel: (label: LabelResolved) => void` (line 11) — model-specific.
- Imports `LabelResolved` from `'../labels/types'` (line 5).

**File:** `packages/core/src/widget/types.ts`

- `CompileExtraContext.clipMeta: ClipMeta[]` (line 83) — only consumed by
  `ModelWidget.compileExtra()`.
- `IContainedModel<TState>` (lines 65–68) — model-specific subtype of `IRenderable`.
- Imports `ClipMeta` from `'../compiler/sceneTrackTypes'` (line 4).

**File:** `packages/core/src/widget/WidgetRegistry.ts`

- `getContainedModels()` (line 209) — returns `Array<IContainedModel<unknown>>`.
- `buildCacheKey()` (lines 212–230) duck-types `'clipMeta' in w` to read model clip
  metadata — bakes a model-specific cache-key strategy into the generic registry.
- Imports `IContainedModel` from `'./types'` (line 6).

### 3.3 Auto-Registration at Module Scope

**File:** `packages/core/src/compiler/sceneDslCompiler.ts` (lines 313–314):
```typescript
ensureInputControllerRegistry();
registerNode(Scene, sceneRootHandler);
```

**File:** `packages/core/src/compiler/blocks/inputController.tsx` (line 247):
```typescript
ensureInputControllerRegistry();
```

**File:** `packages/core/src/compiler/primitives/progressManager.ts` (line 64):
```typescript
registerNode(ProgressManager, progressManagerHandler);
```

**File:** `packages/core/src/labels/dsl.tsx` (lines 23–29):
```typescript
registerNode(Label, () => { throw new Error(...); });
registerNode(Labels, () => { throw new Error(...); });
```

### 3.4 ModelWidget Current Interface Implementation

`ModelWidget` (file: `packages/core/src/elements/model/ModelWidget.ts`) currently
implements:
```
ISceneElement<SceneModelInstanceState, CompiledAnimation>
IRenderable<SceneModelInstanceState>
ILoadable
IDslComposite
```

It also exposes (not via interface):
- `getAnchorBoneName(anchorKey: string): string | undefined`
- `findBoneNode(boneName: string): THREE.Object3D | undefined`
- `getBoneWorldPositions(): Map<string, [number, number, number]>`
- `getTargetColors(): Map<string, string>`

These four methods satisfy duck-typed checks in `RuntimeDriverImpl` but are invisible
at the widget contract level.

### 3.5 LabelPositioner React Context

`LabelPositionerContext` (file: `packages/core/src/player/LabelPositionerContext.ts`)
provides `LabelPositioner` via React context. `LabelItem` (file:
`packages/core/src/labels/LabelItem.tsx`) consumes it via `useLabelPositioner()`.

`LabelItem` cross-imports `useLabelPositioner` from `'../player/LabelPositionerContext'` —
a `labels/` → `player/` inward dependency. When labels move to `@brewsite/model`,
`LabelItem` must import from `@brewsite/model/player/LabelPositionerContext` (within
the same package) and the React context is provided by model plugin infrastructure,
not core's `EngineProvider`.

### 3.6 useSceneEngine Render Loop

In `packages/core/src/player/useSceneEngine.ts`, the render loop callback (lines 568–576):
```typescript
options.labelPositioner.update(
  tick.labelPrimitives ?? [],
  camera,
  driver.getBoneWorldPositions(),
  driver.getTargetColors(),
);
```
and the renderer cleanup (line 435):
```typescript
ModelRenderer.disposeKtx2Loader(renderer);
```
both contain model-specific calls in core's generic player hook.

---

## 4. Phase 1 — Formalize Core Widget Interfaces

**Goal:** Add new formal interfaces to core's widget SDK. All changes in this phase are
additive — no existing symbols are removed, no existing behavior changes. This phase
can be deployed independently without breaking any consumer.

### 4.1 `rootObject` Belongs on `IContainedRenderable`, Not `IRenderable`

`IRenderable<TState>` does **not** receive a `rootObject` property in Phase 1.

`rootObject` is already declared on `IContainedRenderable` (§4.4), which is the only
consumer that needs it: `attachContainedRenderables()` (§5.1) reads `widget.rootObject`
from a value typed as `IContainedRenderable`, not `IRenderable`. Adding `rootObject`
to `IRenderable` would be redundant (it duplicates `IContainedRenderable`'s declaration)
and would force every non-rendering widget — `CameraWidget`, `BackgroundWidget`,
`SceneMetaWidget`, etc. — to instantiate a placeholder `THREE.Object3D` that serves no
purpose. A required property that signals "I have no object" is a design smell.

Consequence: **Phase 1 is fully additive with zero breaking changes.** No existing
`IRenderable` implementor requires modification.

`IRenderable<TState>` in Phase 1:

```typescript
export interface IRenderable<TState> extends IWidget {
  initialize(context: WidgetInitContext): void;
  apply(state: TState, context: WidgetRenderContext): void;
  dispose(): void;
}
```

### 4.2 Add `IRendererLifecycle`

**File:** `packages/core/src/widget/types.ts`

```typescript
/**
 * Widget that participates in WebGLRenderer lifecycle events.
 * Implement to manage GPU resources (loaders, render targets) tied to
 * a specific renderer instance.
 *
 * Preferred over ad-hoc cleanup calls in useSceneEngine.ts. When a renderer
 * is disposed, WidgetRegistry.notifyRendererDisposing() broadcasts to all
 * IRendererLifecycle implementors automatically.
 */
export interface IRendererLifecycle extends IWidget {
  onRendererCreated(renderer: WebGLRenderer): void;
  onRendererDisposing(renderer: WebGLRenderer): void;
}
```

### 4.3 Add `IRenderContributor` and `RenderContribution`

**File:** `packages/core/src/widget/types.ts`

```typescript
/**
 * Named 3D world positions and per-target color overrides contributed by a widget
 * after each rendered frame. Consumed by LabelPositioner and any overlay system
 * that needs world positions.
 *
 * Key format is widget-defined. Convention for model bones:
 *   `'${widgetId}:${boneName}'`
 * Convention for model subparts/meshes:
 *   `'${widgetId}:${meshId}'`
 */
export type RenderContribution = {
  /**
   * Named 3D world positions contributed this frame.
   * ReadonlyMap for safety — callers must not mutate.
   */
  namedPositions?: ReadonlyMap<string, [number, number, number]>;
  /**
   * Per-target color overrides. Keys match namedPositions keys.
   */
  targetColors?: ReadonlyMap<string, string>;
};

/**
 * Widget that contributes data to the render loop after each Three.js frame.
 * Called once per frame by RuntimeDriverImpl.collectRenderContributions() after
 * renderer.render() completes. Hot path — keep implementors cheap.
 *
 * ModelWidget implements this to expose bone world positions for LabelPositioner.
 */
export interface IRenderContributor extends IWidget {
  contributeRenderData(): RenderContribution;
}
```

### 4.4 Add `IContainedRenderable`

**File:** `packages/core/src/widget/types.ts`

```typescript
/**
 * Widget whose rootObject should be parented to a named attachment point
 * on another registered widget's scene graph.
 *
 * RuntimeDriverImpl calls attachContainedRenderables() after all ILoadable
 * widgets have resolved. The host widget must implement IAttachmentHost.
 * After attachment, Three.js manages the resulting transform hierarchy
 * automatically each frame.
 *
 * This is the generic replacement for IContainedModel. IContainedModel
 * (model-specific, with anchorModelId) moves to @brewsite/model and extends
 * both IRenderable and IContainedRenderable.
 */
export interface IContainedRenderable extends IWidget {
  /** widgetId of the IAttachmentHost widget that will serve as parent. */
  readonly anchorWidgetId: string;
  /** Named attachment point key on the host widget. */
  readonly anchorKey: string;
  /** The Object3D to parent under the resolved attachment point. */
  readonly rootObject: Object3D;
}
```

### 4.5 Add `IAttachmentHost`

**File:** `packages/core/src/widget/types.ts`

```typescript
/**
 * Widget that exposes named Three.js Object3D attachment points.
 *
 * Other widgets implementing IContainedRenderable attach their rootObjects
 * to these points after initialize(). Three.js manages the resulting
 * world-transform hierarchy automatically each frame.
 *
 * ModelWidget implements this to expose bone nodes as attachment points
 * for contained models and body-part accessories.
 */
export interface IAttachmentHost extends IWidget {
  /**
   * Returns the Three.js Object3D for the named attachment point, or null
   * if the key is not found or the host is not yet initialized.
   *
   * Called once per IContainedRenderable after all ILoadable.load() promises
   * resolve, from RuntimeDriverImpl.attachContainedRenderables().
   */
  getAttachmentPoint(key: string): Object3D | null;
}
```

### 4.6 Add Type Guards to WidgetRegistry.ts

**File:** `packages/core/src/widget/WidgetRegistry.ts`

Add after the existing type guard block (after line 248):

```typescript
export const isRendererLifecycle = (w: IWidget): w is IRendererLifecycle =>
  'onRendererCreated' in w && 'onRendererDisposing' in w;

export const isRenderContributor = (w: IWidget): w is IRenderContributor =>
  'contributeRenderData' in w && typeof (w as IRenderContributor).contributeRenderData === 'function';

export const isContainedRenderable = (w: IWidget): w is IContainedRenderable =>
  'anchorWidgetId' in w && 'anchorKey' in w && 'rootObject' in w;

export const isAttachmentHost = (w: IWidget): w is IAttachmentHost =>
  'getAttachmentPoint' in w && typeof (w as IAttachmentHost).getAttachmentPoint === 'function';
```

Also add the following query methods to the `WidgetRegistry` class body:

```typescript
getContainedRenderables(): IContainedRenderable[] {
  return this.getAll().filter(isContainedRenderable);
}

getAttachmentHosts(): IAttachmentHost[] {
  return this.getAll().filter(isAttachmentHost);
}
```

### 4.7 Add Renderer Lifecycle Dispatch to WidgetRegistry

**File:** `packages/core/src/widget/WidgetRegistry.ts`

Add to the `WidgetRegistry` class body:

```typescript
/**
 * Broadcasts onRendererCreated to all IRendererLifecycle widgets.
 * Call from useSceneEngine.ts when the WebGLRenderer is constructed.
 */
notifyRendererCreated(renderer: WebGLRenderer): void {
  for (const widget of this.widgets.values()) {
    if (isRendererLifecycle(widget)) widget.onRendererCreated(renderer);
  }
}

/**
 * Broadcasts onRendererDisposing to all IRendererLifecycle widgets.
 * Call from useSceneEngine.ts cleanup effect, before renderer.dispose().
 */
notifyRendererDisposing(renderer: WebGLRenderer): void {
  for (const widget of this.widgets.values()) {
    if (isRendererLifecycle(widget)) widget.onRendererDisposing(renderer);
  }
}
```

Add `import type { WebGLRenderer } from 'three';` to the WidgetRegistry import block.
(The `IRendererLifecycle` type already references `WebGLRenderer` from `widget/types.ts`,
but WidgetRegistry needs the type directly for the method signatures.)

### 4.8 IContainedModel Disposition in Phase 1

`IContainedModel<TState>` is NOT removed in Phase 1. It remains in
`packages/core/src/widget/types.ts` to preserve backward compatibility.

In Phase 4, it is deleted from core and relocated to `packages/model/src/widget/types.ts`
where it extends both `IRenderable<TState>` and `IContainedRenderable`.

### 4.9 Phase 1 Complete Type File

The full `packages/core/src/widget/types.ts` after Phase 1 changes (showing additions
in context of existing lines):

```typescript
import type { Object3D, WebGLRenderer, Scene as ThreeScene } from 'three';
import type { VariableStoreReader, JsonPrimitive } from './VariableStore';
import type { ElementTransitionSpec, FunctionalTransitionSpec } from '../compiler/transitions/transitionTypes';
import type { ClipMeta, SceneTrack, SceneTrackTick } from '../compiler/sceneTrackTypes';

type AssetManifest = { version: number; models: unknown[]; animations: unknown[] };

export interface IWidget {
  readonly widgetId: string;
}

export interface ISceneElement<TState, TExtra = void> extends IWidget {
  readonly defaultState: TState;
  readonly transitionSpec: ElementTransitionSpec<TState> | FunctionalTransitionSpec<TState>;
  readonly DslComponent: React.ComponentType<any>;
  compileExtra?(state: TState, context: CompileExtraContext): TExtra;
  readonly requiresTypeProp?: boolean;
  mergeSnapshot?(prev: TState | undefined, next: TState | undefined): TState | undefined;
}

export interface IDslComposite extends IWidget {
  readonly childDslComponents: ReadonlyArray<{
    component: React.ComponentType<unknown>;
    displayName: string;
    topLevelError?: boolean;
  }>;
}

export interface ILoadable extends IWidget {
  load(manifest: AssetManifest | null): Promise<void>;
  readonly isLoaded: boolean;
}

export interface IRenderable<TState> extends IWidget {
  initialize(context: WidgetInitContext): void;
  apply(state: TState, context: WidgetRenderContext): void;
  dispose(): void;
}

// IContainedModel remains here in Phase 1 — removed in Phase 4.
export interface IContainedModel<TState> extends IRenderable<TState> {
  readonly anchorModelId: string;
  readonly anchorKey: string;
}

export interface IAnimationController extends IWidget {
  readonly tickPriority?: number;
  onTick(context: AnimationTickContext): void;
}

export interface IVariableProvider extends IWidget {
  readonly variableNamespace: string;
  readonly variableKeys: readonly string[];
}

// ─── New interfaces added in Phase 1 ────────────────────────────────────────

export interface IRendererLifecycle extends IWidget {
  onRendererCreated(renderer: WebGLRenderer): void;
  onRendererDisposing(renderer: WebGLRenderer): void;
}

export type RenderContribution = {
  namedPositions?: ReadonlyMap<string, [number, number, number]>;
  targetColors?: ReadonlyMap<string, string>;
};

export interface IRenderContributor extends IWidget {
  contributeRenderData(): RenderContribution;
}

export interface IContainedRenderable extends IWidget {
  readonly anchorWidgetId: string;
  readonly anchorKey: string;
  readonly rootObject: Object3D;
}

export interface IAttachmentHost extends IWidget {
  getAttachmentPoint(key: string): Object3D | null;
}

// ─── Context types ───────────────────────────────────────────────────────────

// NOTE: clipMeta remains in Phase 1, removed in Phase 4.
export type CompileExtraContext = {
  sceneProgress: number;
  globalProgress: number;
  clipMeta: ClipMeta[];
  prefersReducedMotion: boolean;
};

export type WidgetInitContext = {
  scene: ThreeScene;
  widgetId: string;
  renderer?: WebGLRenderer;
};

export type WidgetRenderContext = {
  deltaSeconds: number;
  globalProgress: number;
  wallTimeSeconds: number;
  variables: VariableStoreReader;
  extra: unknown;
  tick?: SceneTrackTick | null;
};

export type AnimationTickContext = {
  deltaSeconds: number;
  wallTimeSeconds: number;
  scene: ThreeScene;
  variables: VariableStore;
  tick: SceneTrackTick | null;
  track?: SceneTrack | null;
};

export type { VariableStoreReader, JsonPrimitive };
import type { VariableStore } from './VariableStore';
```

---

## 5. Phase 2 — Runtime Cleanup

**Goal:** Replace all duck-typed patterns in `RuntimeDriverImpl` and `RuntimeDriver`
interface with the formal interfaces from Phase 1. Also replace the model-specific
`ModelRenderer.disposeKtx2Loader()` call in `useSceneEngine.ts` with the formal
`IRendererLifecycle` dispatch.

This phase has a surface-level breaking change for consumers that use `RuntimeDriver`
directly: `getBoneWorldPositions()` and `getTargetColors()` are removed from the
interface and replaced by `collectRenderContributions()`. Standard consumers using
`@brewsite/core`'s public API (via `ScenePlayer`, `EngineProvider`) are not affected.

### 5.1 Replace attachContainedModels() with attachContainedRenderables()

**File:** `packages/core/src/runtime/RuntimeDriver.ts`

Delete the private `attachContainedModels()` method (lines 112–148) in its entirety.

Delete `private containedModels` field (line 42).

Delete `this.containedModels = this.widgetRegistry.getContainedModels();` from
constructor (line 73).

Add the new private method:

```typescript
private attachContainedRenderables(): void {
  for (const widget of this.widgetRegistry.getContainedRenderables()) {
    const host = this.widgetRegistry.get(widget.anchorWidgetId);
    if (!host || !isAttachmentHost(host)) {
      console.warn(
        `[RuntimeDriver] No IAttachmentHost "${widget.anchorWidgetId}" ` +
        `for contained renderable "${widget.widgetId}". ` +
        `Ensure the host widget implements IAttachmentHost and is registered.`,
      );
      continue;
    }
    const point = host.getAttachmentPoint(widget.anchorKey);
    if (!point) {
      console.warn(
        `[RuntimeDriver] Attachment point "${widget.anchorKey}" not found on ` +
        `host "${widget.anchorWidgetId}" for widget "${widget.widgetId}".`,
      );
      continue;
    }
    point.add(widget.rootObject);
  }
}
```

In `initialize()`, replace the call to `this.attachContainedModels()` (line 107)
with `this.attachContainedRenderables()`.

Add imports to `RuntimeDriver.ts`:
```typescript
import { isAttachmentHost } from '../widget/WidgetRegistry';
```

### 5.2 Replace getBoneWorldPositions() and getTargetColors() with collectRenderContributions()

**File:** `packages/core/src/runtime/RuntimeDriver.ts`

Delete `getBoneWorldPositions()` (lines 223–237) entirely.

Delete `getTargetColors()` (lines 239–252) entirely.

Add the replacement:

```typescript
/**
 * Collects named world positions and target colors from all IRenderContributor
 * widgets. Called once per frame from the render loop, after renderer.render().
 *
 * Merges contributions from all widgets — last-write-wins on key collision
 * (contributors are processed in registration order).
 */
collectRenderContributions(): RenderContribution {
  const namedPositions = new Map<string, [number, number, number]>();
  const targetColors = new Map<string, string>();
  for (const widget of this.widgetRegistry.getAll()) {
    if (!isRenderContributor(widget)) continue;
    const data = widget.contributeRenderData();
    data.namedPositions?.forEach((v, k) => namedPositions.set(k, v));
    data.targetColors?.forEach((v, k) => targetColors.set(k, v));
  }
  return {
    namedPositions: namedPositions.size > 0 ? namedPositions : undefined,
    targetColors: targetColors.size > 0 ? targetColors : undefined,
  };
}
```

Add imports:
```typescript
import { isRenderContributor } from '../widget/WidgetRegistry';
import type { RenderContribution } from '../widget/types';
```

### 5.3 Update RuntimeDriver Interface

**File:** `packages/core/src/runtime/types.ts`

Remove `getBoneWorldPositions()` and `getTargetColors()` from the `RuntimeDriver` interface.

Add `collectRenderContributions()`:

```typescript
export type RuntimeDriver = {
  assetsReady: boolean;
  setAssetsReady(ready: boolean): void;
  setSceneTrack(track: SceneTrack): void;
  tick(options: { deltaSeconds: number; globalProgress: number; wallTimeSeconds?: number }): void;

  /**
   * Collects named world positions and target colors from all IRenderContributor
   * widgets registered in this driver. Called once per render frame.
   */
  collectRenderContributions(): RenderContribution;

  getCurrentTick(): SceneTrackTick | null;
  getWallTimeSeconds(): number;
  dispose(): void;
};
```

Add import at top of `runtime/types.ts`:
```typescript
import type { RenderContribution } from '../widget/types';
```

### 5.4 Update useSceneEngine.ts — Renderer Disposal

**File:** `packages/core/src/player/useSceneEngine.ts`

In the renderer cleanup effect (the `return` callback of the `useEffect` on `canvas`,
line 432–442), replace:

```typescript
// REMOVE:
ModelRenderer.disposeKtx2Loader(renderer);
```

With:

```typescript
// REPLACE WITH:
options.widgetRegistry.notifyRendererDisposing(renderer);
```

Remove the import of `ModelRenderer` from this file (line 9):
```typescript
// REMOVE:
import { ModelRenderer } from '../elements/model/ModelRenderer';
```

### 5.5 Update useSceneEngine.ts — Render Loop

**File:** `packages/core/src/player/useSceneEngine.ts`

In the render loop callback (lines 565–576), replace:

```typescript
// REMOVE:
if (options.labelPositioner && tick) {
  options.labelPositioner.update(
    tick.labelPrimitives ?? [],
    camera,
    driver.getBoneWorldPositions(),
    driver.getTargetColors(),
  );
}
```

With:

```typescript
// REPLACE WITH:
if (options.labelPositioner && tick) {
  const contributions = driver.collectRenderContributions();
  options.labelPositioner.update(
    tick.labelPrimitives ?? [],
    camera,
    contributions.namedPositions ?? new Map(),
    contributions.targetColors,
  );
}
```

### 5.6 Update LabelPositioner.update() Signature

**File:** `packages/core/src/player/LabelPositioner.ts`

The parameter name `boneWorldPositions` (line 34) is renamed to `namedPositions` to
match the `RenderContribution` vocabulary. The type and behavior are unchanged.

```typescript
// CHANGE parameter name only — type and implementation unchanged:
update(
  labels: LabelResolved[],
  camera: Camera,
  namedPositions: Map<string, [number, number, number]>,  // was boneWorldPositions
  targetColors?: Map<string, string>,
): void {
  // Replace all internal references to `boneWorldPositions` with `namedPositions`.
  // The only reference is at line 47: `const bonePos = boneWorldPositions.get(targetId);`
  // becomes: `const bonePos = namedPositions.get(targetId);`
  // And the warn message at line 50: update parameter name in log text.
}
```

### 5.7 ModelWidget — Implement New Interfaces

**File:** `packages/core/src/elements/model/ModelWidget.ts`

In Phase 2, `ModelWidget` is updated to implement the new formal interfaces. This makes
it a conforming `IAttachmentHost` and `IRenderContributor` while the old duck-typed
methods remain for backward compatibility until Phase 4.

Add to the `implements` clause:
```typescript
export class ModelWidget
  implements
    ISceneElement<SceneModelInstanceState, CompiledAnimation>,
    IRenderable<SceneModelInstanceState>,
    ILoadable,
    IDslComposite,
    IAttachmentHost,       // NEW in Phase 2
    IRenderContributor {   // NEW in Phase 2
```

Add `getAttachmentPoint()` (replaces duck-typed `getAnchorBoneName` + `findBoneNode`):
```typescript
getAttachmentPoint(key: string): THREE.Object3D | null {
  const boneName = this.anchorTargets[key];
  if (!boneName) return null;
  return this.renderer?.findNodeByName(boneName) ?? null;
}
```

Add `contributeRenderData()` (replaces duck-typed `getBoneWorldPositions` +
`getTargetColors`):
```typescript
contributeRenderData(): RenderContribution {
  return {
    namedPositions: this.renderer?.getBoneWorldPositions() ?? new Map(),
    targetColors: this.renderer?.getTargetColors() ?? new Map(),
  };
}
```

The old `getAnchorBoneName()`, `findBoneNode()`, `getBoneWorldPositions()`, and
`getTargetColors()` methods remain on `ModelWidget` in Phase 2 to avoid breaking any
consumer that calls them directly. They are removed in Phase 4.

### 5.8 WidgetRegistry — Remove getContainedModels() in Phase 2

`WidgetRegistry.getContainedModels()` is removed in Phase 2 because `RuntimeDriverImpl`
no longer calls it. If any external consumer calls `getContainedModels()`, they will
receive a compile error that forces migration to `getContainedRenderables()`.

**File:** `packages/core/src/widget/WidgetRegistry.ts`

Delete (line 209):
```typescript
// REMOVE:
getContainedModels(): Array<IContainedModel<unknown>> { return this.getAll().filter(isContainedModel); }
```

Keep `isContainedModel` type guard for one more phase (used in diagram until diagram
adopts `IContainedRenderable` in a subsequent plan).

### 5.9 WidgetRegistry — buildCacheKey() Cleanup

**File:** `packages/core/src/widget/WidgetRegistry.ts`

`buildCacheKey()` currently duck-types `'clipMeta' in w`. In Phase 4, this moves to
the model package. In Phase 2, it can be left as-is. Add a `// DEBT:` comment:

```typescript
// DEBT: clipMeta duck-typing in buildCacheKey() is model-specific. Migrate to
// IRenderContributor.cacheKey() or model plugin cache contribution in Phase 4.
```

---

## 6. Phase 3 — WidgetPlugin Contract and Explicit Registration

**Goal:** Introduce `WidgetPlugin` as a composable unit of widget registration. Remove
all auto-registration at module scope. Add `plugins` prop to `EngineProvider` alongside
the existing `widgetSetup` (which is deprecated but preserved). This phase is additive
to `EngineProvider`'s API and backward compatible for existing consumers.

### 6.1 New File: WidgetPlugin.ts

**File:** `packages/core/src/widget/WidgetPlugin.ts` (new file)

```typescript
// Widget plugin contract — composable unit of widget and handler registration.

import type { ReactNode } from 'react';
import type { IWidget } from './types';
import type { WidgetRegistry } from './WidgetRegistry';
import type { AssetManifest } from '../elements/model/metadata';
import type * as THREE from 'three';

/**
 * Contract for a composable widget package.
 *
 * Passed to EngineProvider via the `plugins` prop. Each plugin is responsible
 * for registering its own widgets and DSL NodeHandlers. Plugins are initialized
 * in the order they appear in the plugins array.
 *
 * Design rules:
 * - createWidgets() is called once when EngineProvider mounts.
 * - registerHandlers() must be idempotent (safe to call multiple times).
 * - Plugins must not import from each other — use shared core interfaces only.
 *
 * @example
 * // In EngineProvider / ScenePlayer:
 * plugins={[corePlugin(), modelPlugin({ manifestUrl: '/assets/manifest.json' })]}
 */
export interface WidgetPlugin {
  /**
   * Returns widget instances to register into the runtime WidgetRegistry.
   * Called once before first compilation. Widgets are registered in the order
   * they are returned — duplicate widgetIds will warn (or throw in strict mode).
   */
  createWidgets(): IWidget[];

  /**
   * Registers DSL NodeHandlers for this plugin's components into the global
   * compiler registry. Must be idempotent — safe to call multiple times
   * (subsequent calls after the first are no-ops).
   * Called once before first scene compilation.
   */
  registerHandlers(): void;

  /**
   * Optional: performs plugin-specific WidgetRegistry configuration after all
   * widgets from this plugin have been registered. Use to install type factories,
   * set up inter-widget cross-references, or apply manifest-derived configuration.
   *
   * Called by EngineProvider immediately after this plugin's createWidgets() results
   * are registered. `manifest` is null when no manifest has been fetched yet.
   */
  configureRegistry?(registry: WidgetRegistry, manifest: AssetManifest | null): void;

  /**
   * Optional: wraps EngineProvider's rendered subtree with this plugin's React
   * context providers. Called by EngineProvider during render. The returned JSX
   * replaces `children` as the inner content.
   *
   * Use to install React context that plugin components (e.g. LabelItem) consume.
   * modelPlugin uses this to provide LabelPositionerContext without requiring
   * call sites to add a separate wrapper component.
   *
   * @example
   * wrapProvider: (children) => (
   *   <LabelPositionerContext.Provider value={labelPositioner}>
   *     {children}
   *   </LabelPositionerContext.Provider>
   * )
   */
  wrapProvider?(children: ReactNode): ReactNode;

  /**
   * Optional: called when a WebGLRenderer instance is created.
   * Use to set up GPU resources that depend on a specific renderer instance.
   */
  onRendererCreated?(renderer: THREE.WebGLRenderer): void;

  /**
   * Optional: called just before a WebGLRenderer is disposed.
   * Use to release GPU resources tied to this renderer.
   */
  onRendererDisposing?(renderer: THREE.WebGLRenderer): void;
}
```

### 6.2 New File: compiler/coreHandlers.ts

**File:** `packages/core/src/compiler/coreHandlers.ts` (new file)

This file centralizes all NodeHandler registrations that were previously at module scope
in `sceneDslCompiler.ts`, `blocks/inputController.tsx`, and
`primitives/progressManager.ts`.

```typescript
// Centralized registration of all built-in core DSL NodeHandlers.
// Called by corePlugin().registerHandlers() — not at module scope.

import { registerNode, getNodeHandler } from './registry';
import { Scene, sceneRootHandler } from './sceneDslCompiler';
import { ensureInputControllerRegistry } from './blocks/inputController';
import { ProgressManager, progressManagerHandler } from './primitives/progressManager';

let coreHandlersRegistered = false;

/**
 * Registers all built-in core DSL NodeHandlers.
 * Idempotent — safe to call multiple times.
 * Must be called before any scene compilation begins.
 */
export function registerCoreHandlers(): void {
  if (coreHandlersRegistered) return;
  coreHandlersRegistered = true;

  if (!getNodeHandler(Scene)) {
    registerNode(Scene, sceneRootHandler);
  }
  ensureInputControllerRegistry();
  if (!getNodeHandler(ProgressManager)) {
    registerNode(ProgressManager, progressManagerHandler);
  }
}

/**
 * For testing only — resets the registration guard so tests can call
 * registerCoreHandlers() in isolation.
 */
export function resetCoreHandlerRegistrationForTesting(): void {
  coreHandlersRegistered = false;
}
```

The `sceneRootHandler` in `sceneDslCompiler.ts` must be exported (it is currently
declared as a `const` without export). Add `export` to its declaration.

Similarly, `progressManagerHandler` in `primitives/progressManager.ts` must be exported.

### 6.3 Remove Auto-Registration from Module Scope

**File:** `packages/core/src/compiler/sceneDslCompiler.ts`

Delete lines 313–314:
```typescript
// REMOVE:
ensureInputControllerRegistry();
registerNode(Scene, sceneRootHandler);
```

Also delete the import of `ensureInputControllerRegistry` from line 18 if it is no
longer used in this file.

The `ensureSceneRegistry()` exported function (lines 306–311) becomes:
```typescript
// Keep for backward compat only — delegates to coreHandlers.
export const ensureSceneRegistry = (): void => {
  registerCoreHandlers();
};
```

**File:** `packages/core/src/compiler/blocks/inputController.tsx`

Delete line 247:
```typescript
// REMOVE:
ensureInputControllerRegistry();
```

`ensureInputControllerRegistry()` remains exported for use by `registerCoreHandlers()`.
It is idempotent so calling it from `registerCoreHandlers()` is safe.

**File:** `packages/core/src/compiler/primitives/progressManager.ts`

Delete line 64:
```typescript
// REMOVE:
registerNode(ProgressManager, progressManagerHandler);
```

Export `progressManagerHandler` (add `export` keyword):
```typescript
export const progressManagerHandler: NodeHandler = (node, api) => { ... };
```

**File:** `packages/core/src/labels/dsl.tsx`

Delete lines 23–29:
```typescript
// REMOVE:
registerNode(Label, () => { throw new Error(...); });
registerNode(Labels, () => { throw new Error(...); });
```

These protective handlers for `<Label>` and `<Labels>` at the top-level DSL are
model-specific guards. In Phase 3 they move to `registerModelHandlers()` in
`@brewsite/model`. In Phase 3 (before Phase 4), move them into `registerCoreHandlers()`
as a temporary measure:

```typescript
// In coreHandlers.ts, within registerCoreHandlers():
import { Label, Labels } from '../labels/dsl';
if (!getNodeHandler(Label)) {
  registerNode(Label, () => {
    throw new Error('<Label> must be nested under <BodyPart> or <Subpart>.');
  });
}
if (!getNodeHandler(Labels)) {
  registerNode(Labels, () => {
    throw new Error('<Labels> is not supported. Use <Label> under <BodyPart> or <Subpart>.');
  });
}
```

In Phase 4 these imports and registrations are removed from `coreHandlers.ts` and
the label DSL moves to `@brewsite/model`.

### 6.4 New File: player/plugins.ts

**File:** `packages/core/src/player/plugins.ts` (new file)

```typescript
// Factory for the built-in core WidgetPlugin.
// Provides all non-model core widgets and DSL handlers.

import type { WidgetPlugin } from '../widget/WidgetPlugin';
import { registerCoreHandlers } from '../compiler/coreHandlers';
import { LightingWidget } from '../elements/lighting/LightingWidget';
import { BackgroundWidget } from '../elements/background/BackgroundWidget';
import { EnvironmentWidget } from '../elements/environment/EnvironmentWidget';
import { FloorWidget } from '../elements/floor/FloorWidget';
import { CameraWidget } from '../elements/camera/CameraWidget';
import { SceneMetaWidget } from './SceneMetaWidget';

export interface CorePluginOptions {
  onSceneChange?: (sceneId: string, sceneIndex: number) => void;
}

/**
 * Built-in WidgetPlugin for @brewsite/core.
 *
 * Provides: LightingWidget, BackgroundWidget, EnvironmentWidget, FloorWidget,
 * CameraWidget, SceneMetaWidget, and all core DSL NodeHandlers (Scene,
 * InputController, Action, ProgressManager, and related child components).
 *
 * Does NOT include model or label widgets — use modelPlugin() from
 * @brewsite/model for those.
 *
 * @example
 * <EngineProvider
 *   plugins={[corePlugin(), modelPlugin({ manifestUrl: '/assets/manifest.json' })]}
 * />
 */
export function corePlugin(options?: CorePluginOptions): WidgetPlugin {
  return {
    createWidgets: () => [
      new LightingWidget(),
      new BackgroundWidget(),
      new EnvironmentWidget(),
      new FloorWidget(),
      new CameraWidget(),
      new SceneMetaWidget({ onSceneChange: options?.onSceneChange }),
    ],
    registerHandlers: () => {
      registerCoreHandlers();
    },
  };
}
```

### 6.5 EngineProvider API Change

**File:** `packages/core/src/player/EngineProvider.tsx` (read file before editing)

Add the `plugins` prop to `EngineProviderProps`:

```typescript
import type { WidgetPlugin } from '../widget/WidgetPlugin';

export interface EngineProviderProps {
  /**
   * Composable widget plugins. Each plugin contributes widgets and DSL handlers.
   * Evaluated in array order. Use corePlugin() from @brewsite/core for built-in
   * widgets, and modelPlugin() from @brewsite/model for model and label support.
   *
   * When provided, `widgetSetup` is ignored if both are specified (plugins wins).
   *
   * @example
   * plugins={[corePlugin(), modelPlugin({ manifestUrl: '/assets/manifest.json' })]}
   */
  plugins?: WidgetPlugin[];

  /**
   * @deprecated Use `plugins` instead. Will be removed in the next major version.
   * Provides backward compatibility for existing widgetSetup-based integrations.
   */
  widgetSetup?: (manifest: AssetManifest) => WidgetRegistry;

  // All existing props remain unchanged — manifestUrl, fpsCap, etc.
  manifestUrl?: string;
  // ...
}
```

In `EngineProvider`'s implementation, before compilation, resolve the active registry:

```typescript
// In EngineProvider's effect that builds the WidgetRegistry:
const registry = useMemo(() => {
  if (props.plugins && props.plugins.length > 0) {
    // New path: register handlers, create registry, register widgets.
    for (const plugin of props.plugins) {
      plugin.registerHandlers();
    }
    const reg = new WidgetRegistry({ strict: true });
    for (const plugin of props.plugins) {
      for (const widget of plugin.createWidgets()) {
        reg.register(widget);
      }
    }
    return reg;
  }
  // Legacy path: widgetSetup
  if (props.widgetSetup) {
    return props.widgetSetup(manifest ?? null);
  }
  return null;
}, [props.plugins, props.widgetSetup, manifest]);
```

The renderer lifecycle dispatch integrates with the plugin `onRendererCreated` /
`onRendererDisposing` callbacks in addition to `WidgetRegistry.notifyRenderer*()`:

```typescript
// In the useEffect for renderer creation and disposal:
// After renderer creation:
registry?.notifyRendererCreated(renderer);
props.plugins?.forEach(p => p.onRendererCreated?.(renderer));

// Before renderer disposal:
registry?.notifyRendererDisposing(renderer);
props.plugins?.forEach(p => p.onRendererDisposing?.(renderer));
renderer.dispose();
```

### 6.6 ScenePlayer Backward Compatibility

**File:** `packages/core/src/player/ScenePlayer.tsx` (read before editing)

`ScenePlayer` is the most common entry point. **Q1 Decision — Option A:** `ScenePlayer`
keeps its existing `manifestUrl` prop permanently. In Phase 4, `ScenePlayer` internally
wires `manifestUrl` to `modelPlugin({ manifestUrl })` so existing call sites require
no changes:

```typescript
// ScenePlayer internal default in Phase 4:
// manifestUrl is forwarded to modelPlugin; ScenePlayer composes the plugin array.
plugins={[corePlugin(), modelPlugin({ manifestUrl: props.manifestUrl })]}
```

Phase 3 leaves `ScenePlayer` using the existing `createDefaultWidgetRegistry` approach
internally. The `plugins` prop is available on `EngineProvider` for early adopters who
compose manually. `ScenePlayer`'s full internal migration to `plugins` is completed
in Phase 4.

### 6.7 Export WidgetPlugin from Core Public API

**File:** `packages/core/src/widget/index.ts` (read before editing)

Add exports:
```typescript
export type { WidgetPlugin } from './WidgetPlugin';
export { corePlugin } from '../player/plugins';
export type { CorePluginOptions } from '../player/plugins';
```

---

## 7. Phase 4 — Extract @brewsite/model

**Goal:** Create a new published npm package `@brewsite/model` containing all model
and label code. Remove model-specific code from `@brewsite/core`. This is the only
phase that is a major breaking change for `@brewsite/core` consumers using the model
subsystem.

### 7.1 New Package Structure

**Directory:** `packages/model/` (new workspace)

```
packages/model/
  src/
    elements/model/           ← moved from packages/core/src/elements/model/
      types.ts
      dsl.tsx
      compile.ts
      render.ts
      ModelWidget.ts
      ModelRenderer.ts
      animationTrackMapping.ts
      metadata.ts
      index.ts
      __tests__/
        AnimationTrackMapping.test.ts
        Metadata.test.ts
        ModelCompile.test.ts
        ModelDsl.test.ts
        ModelDslTypes.test.ts
        ModelIndex.test.ts
        ModelRenderer.test.ts
        ModelRenderHelpers.test.ts
        ModelWidget.test.ts
    labels/                   ← moved from packages/core/src/labels/
      types.ts
      dsl.tsx
      LabelItem.tsx
      render.ts
      index.ts
      __tests__/
        dsl.test.ts
        index.test.ts
    compiler/
      labelCompiler.ts        ← moved from packages/core/src/compiler/labelCompiler.ts
      __tests__/
        labelCompiler.test.ts
    player/
      LabelPositioner.ts      ← moved from packages/core/src/player/LabelPositioner.ts
      LabelPositionerContext.ts ← moved from packages/core/src/player/LabelPositionerContext.ts
      __tests__/
        LabelPositioner.test.ts
    widget/
      types.ts                ← IContainedModel (new — extends IRenderable + IContainedRenderable)
    handlers.ts               ← registerModelHandlers()
    plugin.ts                 ← modelPlugin() factory
    index.ts                  ← public API surface
  package.json
  tsconfig.json
  tsconfig.build.json
  vitest.config.ts
```

### 7.2 New package.json

**File:** `packages/model/package.json`

```json
{
  "name": "@brewsite/model",
  "version": "1.0.0",
  "private": false,
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    }
  },
  "files": ["dist", "LICENSE", "README.md"],
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "build:lib": "tsc -p tsconfig.build.json",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "coverage": "vitest run --coverage"
  },
  "peerDependencies": {
    "@brewsite/core": "workspace:*",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "three": "^0.183.1"
  },
  "devDependencies": {
    "@types/react": "^19.2.14",
    "@types/three": "^0.183.1",
    "@vitest/coverage-v8": "^2.1.9",
    "typescript": "^5.9.3",
    "vitest": "^2.1.9"
  }
}
```

### 7.3 IContainedModel in @brewsite/model

**File:** `packages/model/src/widget/types.ts` (new file)

```typescript
// Model-specific widget contracts for @brewsite/model.

import type { IRenderable, IContainedRenderable } from '@brewsite/core/widget/types';

/**
 * Widget whose rootObject is a model anchored to a bone on another ModelWidget.
 *
 * anchorWidgetId must be the widgetId of a registered ModelWidget that implements
 * IAttachmentHost. anchorKey is resolved via ModelWidget.getAttachmentPoint(key).
 *
 * This is the model-specific extension of IContainedRenderable. Use the generic
 * IContainedRenderable from @brewsite/core for non-model attachment cases.
 */
export interface IContainedModel<TState> extends IRenderable<TState>, IContainedRenderable {
  // anchorWidgetId is always a ModelWidget widgetId.
  // anchorKey is resolved by ModelWidget.getAttachmentPoint() via bone name lookup.
}
```

### 7.4 registerModelHandlers()

**File:** `packages/model/src/handlers.ts` (new file)

```typescript
// DSL NodeHandler registration for @brewsite/model DSL components.

import { registerNode, getNodeHandler } from '@brewsite/core/compiler/registry';
import { Label, Labels } from './labels/dsl';
// Model DSL components are handled via CUSTOM_NODE_HANDLER on ModelWidget instances.
// Label guard handlers are registered here to produce clear error messages.

let modelHandlersRegistered = false;

/**
 * Registers DSL NodeHandlers for all @brewsite/model DSL components.
 * Idempotent — safe to call multiple times.
 *
 * Must be called before any scene that uses <Model>, <Label>, or related
 * components is compiled. Call via modelPlugin().registerHandlers() or
 * explicitly from registerModelHandlers() before WidgetRegistry creation.
 */
export function registerModelHandlers(): void {
  if (modelHandlersRegistered) return;
  modelHandlersRegistered = true;

  // Protective top-level guards for label DSL components.
  // These throw if <Label> or <Labels> appears outside of a <BodyPart>/<Subpart>.
  if (!getNodeHandler(Label)) {
    registerNode(Label, () => {
      throw new Error('<Label> must be nested under <BodyPart> or <Subpart>.');
    });
  }
  if (!getNodeHandler(Labels)) {
    registerNode(Labels, () => {
      throw new Error('<Labels> is not supported. Use <Label> under <BodyPart> or <Subpart>.');
    });
  }
  // Model DSL routing (ModelRouter, BodyPart, BodyParts, etc.) is registered
  // via CUSTOM_NODE_HANDLER on each ModelWidget instance, not here. The
  // WidgetRegistry.registerTypeFactory() call in modelPlugin installs the
  // routing handler on first ModelRouter encounter.
}

export function resetModelHandlerRegistrationForTesting(): void {
  modelHandlersRegistered = false;
}
```

### 7.5 modelPlugin() Factory

**File:** `packages/model/src/plugin.ts` (new file)

```typescript
// modelPlugin factory — composable WidgetPlugin for @brewsite/model.

import type { WidgetPlugin } from '@brewsite/core/widget/WidgetPlugin';
import type { AssetManifest } from './elements/model/metadata';
import { clipMetaFromManifest, assertManifestValid } from './elements/model/metadata';
import { ModelRouter } from './elements/model/dsl';
import { ModelWidget } from './elements/model/ModelWidget';
import { ModelRenderer } from './elements/model/ModelRenderer';
import { WidgetRegistry } from '@brewsite/core/widget/WidgetRegistry';
import { registerModelHandlers } from './handlers';
import type { SceneModel } from './elements/model/types';

export interface ModelPluginOptions {
  /**
   * URL to fetch the asset manifest JSON from (e.g. '/assets/manifest.json').
   * Mutually exclusive with `manifest`. When provided, the plugin fetches the
   * manifest asynchronously during EngineProvider mount.
   */
  manifestUrl?: string;

  /**
   * Pre-loaded asset manifest. Use when you have already fetched and validated
   * the manifest. Mutually exclusive with `manifestUrl`.
   */
  manifest?: AssetManifest | null;

  /**
   * Per-model default state overrides. Key = widgetId used by <Model id="...">.
   * Applied to each ModelWidget created by the factory.
   */
  defaultModelStates?: Partial<Record<string, Partial<SceneModel>>>;
}

/**
 * WidgetPlugin for @brewsite/model.
 *
 * Provides: ModelWidget (via typeFactory — widgets created lazily on first DSL
 * encounter), Label and Labels DSL guard handlers.
 *
 * Must be combined with corePlugin() from @brewsite/core:
 * @example
 * plugins={[corePlugin(), modelPlugin({ manifestUrl: '/assets/manifest.json' })]}
 *
 * The manifest (models + animations) is owned by this plugin. It is fetched
 * asynchronously when manifestUrl is provided, or used directly when manifest
 * is provided. Asset loading begins when each ModelWidget's load() is called
 * by RuntimeDriverImpl after initialize().
 */
export function modelPlugin(options: ModelPluginOptions = {}): WidgetPlugin & {
  /**
   * Returns the resolved manifest after it has been fetched.
   * null before fetch completes or when no manifest was provided.
   */
  getManifest(): AssetManifest | null;
  /**
   * Fetches and validates the manifest from manifestUrl.
   * Called internally by EngineProvider on mount when manifestUrl is set.
   * No-op when manifest is provided directly.
   */
  fetchManifest(): Promise<AssetManifest | null>;
} {
  let resolvedManifest: AssetManifest | null = options.manifest ?? null;

  const fetchManifest = async (): Promise<AssetManifest | null> => {
    if (resolvedManifest !== null) return resolvedManifest;
    if (!options.manifestUrl) return null;
    const response = await fetch(options.manifestUrl);
    if (!response.ok) {
      throw new Error(`[modelPlugin] Failed to fetch manifest: ${response.status} ${options.manifestUrl}`);
    }
    const raw = await response.json();
    resolvedManifest = assertManifestValid(raw);
    return resolvedManifest;
  };

  return {
    getManifest: () => resolvedManifest,
    fetchManifest,

    createWidgets: () => {
      // ModelWidget instances are created lazily via typeFactory on first DSL encounter.
      // The plugin registers the factory on the WidgetRegistry, not pre-created instances.
      // createWidgets() returns [] — the factory is set up in registerHandlers().
      return [];
    },

    registerHandlers: () => {
      registerModelHandlers();
      // The typeFactory for ModelWidget is installed on the WidgetRegistry in
      // EngineProvider's plugin initialization loop, not here.
      // See EngineProvider plugin integration notes (§7.6).
    },

    onRendererDisposing: (renderer) => {
      ModelRenderer.disposeKtx2Loader(renderer);
    },

    wrapProvider: (children) => (
      <LabelPositionerContext.Provider value={labelPositionerRef.current}>
        {children}
      </LabelPositionerContext.Provider>
    ),
  };
}
// Note: `labelPositionerRef` is a React ref created inside modelPlugin() that holds
// the LabelPositioner instance created in onRendererCreated(). The implementing bot
// must read LabelPositionerContext.ts to confirm the context value type before writing
// the ref type annotation.
```

### 7.6 EngineProvider Plugin Integration for modelPlugin

The `modelPlugin` needs to register its `typeFactory` on the `WidgetRegistry`. This
is the model-specific pattern where widget instances are created lazily when the DSL
encounters `<Model type="..." id="...">`.

In `EngineProvider`'s registry construction (the `useMemo` from Phase 3 §6.5):

```typescript
// Extended plugin initialization in EngineProvider:
const registry = useMemo(() => {
  if (!props.plugins?.length) {
    // Legacy widgetSetup path
    return props.widgetSetup?.(manifest ?? null) ?? null;
  }

  for (const plugin of props.plugins) {
    plugin.registerHandlers();
  }

  const reg = new WidgetRegistry({ strict: true });

  for (const plugin of props.plugins) {
    for (const widget of plugin.createWidgets()) {
      reg.register(widget);
    }
    // Optional per-plugin registry configuration (type factories, manifest wiring, etc.)
    plugin.configureRegistry?.(reg, manifest ?? null);
  }

  return reg;
}, [props.plugins, props.widgetSetup, manifest]);
```

`configureRegistry` is declared as an optional method on `WidgetPlugin` (§6.1), so
EngineProvider calls it uniformly via optional chaining — no duck-typing required.

`modelPlugin` implements `configureRegistry` to install the `ModelWidget` type factory:

```typescript
// In packages/model/src/plugin.ts — add to the return object:
configureRegistry(reg: WidgetRegistry, manifest: AssetManifest | null): void {
  if (!manifest) return;
  const clipMeta = clipMetaFromManifest(manifest);
  reg.registerTypeFactory(ModelRouter, (props) => {
    const type = typeof props['type'] === 'string' ? props['type'] : null;
    const id = typeof props['id'] === 'string' ? props['id'] : null;
    if (!type || !id) {
      throw new Error('[modelPlugin] Model factory requires string type and id props.');
    }
    const modelMeta = manifest.models.find((m) => m.type === type);
    if (!modelMeta) {
      const available = manifest.models.map((m) => m.type).join(', ') || '(none)';
      throw new Error(`[modelPlugin] Unknown model type "${type}". Available: ${available}`);
    }
    return new ModelWidget(
      { modelMeta, clipMeta, widgetId: id },
      options.defaultModelStates?.[id],
    );
  });
},
```

`EngineProvider` also wires `wrapProvider` during render. Plugins are applied
innermost-first (last plugin in the array wraps outermost):

```typescript
// In EngineProvider render:
let inner: ReactNode = <EngineCanvas ... />;
for (const plugin of [...(props.plugins ?? [])].reverse()) {
  if (plugin.wrapProvider) {
    inner = plugin.wrapProvider(inner);
  }
}
return inner;
```

This means `LabelItem` components inside scenes read from `LabelPositionerContext`
provided by `modelPlugin`'s `wrapProvider` — no separate wrapper component required
at call sites.

### 7.7 ModelWidget Updates for Phase 4

**File:** `packages/model/src/elements/model/ModelWidget.ts`

After moving, `ModelWidget` imports change from `@brewsite/core` paths to relative
paths within the model package, and its interface implementation adds `IContainedModel`
from the model package's own `widget/types.ts`.

The old duck-typed methods (`getAnchorBoneName`, `findBoneNode`, `getBoneWorldPositions`,
`getTargetColors`) are removed — they are now replaced by the formal interface methods
`getAttachmentPoint()` and `contributeRenderData()` added in Phase 2.

The `CUSTOM_NODE_HANDLER` import changes from `@brewsite/core/widget/WidgetRegistry`
to the same export path (it remains in core).

### 7.8 labelPrimitives Removal Strategy

`SceneTrackTick.labelPrimitives` and `SceneFrame.labels` are removed from
`packages/core/src/compiler/sceneTrackTypes.ts` in Phase 4.

**Impact assessment:**

- `labelPrimitives` is currently written by `sceneTrackCompiler.ts` in Step 6:
  ```typescript
  if (snap.labels?.length) {
    frame.labelPrimitives = compileLabels(snap.labels, { sceneProgress: frame.blockProgress });
  }
  ```
  This code is deleted from core's `sceneTrackCompiler.ts` in Phase 4.

- `labelPrimitives` is currently read by `useSceneEngine.ts` in the render loop:
  ```typescript
  options.labelPositioner.update(tick.labelPrimitives ?? [], ...)
  ```
  In Phase 4, after the removal of `labelPrimitives`, label data flows through
  `IRenderContributor` instead. `ModelWidget.contributeRenderData()` returns
  `namedPositions` which the `LabelPositioner.update()` call already uses (from Phase 2).

  The `tick.labelPrimitives ?? []` reference is replaced with label data obtained from
  the model plugin's state. The concrete strategy:

  `ModelWidget.apply()` stores the current scene's resolved labels in a private field
  `this.currentLabels: LabelResolved[]`. `ModelWidget.contributeRenderData()` includes
  these labels in its `RenderContribution` via an extended type:

  ```typescript
  // In @brewsite/model — extends RenderContribution:
  export type ModelRenderContribution = RenderContribution & {
    labels?: readonly LabelResolved[];
  };
  ```

  The render loop in `useSceneEngine.ts` updates to:
  ```typescript
  const contributions = driver.collectRenderContributions();
  // LabelPositioner reads namedPositions for 3D positions,
  // labels come from the model plugin's render contribution.
  // The LabelPositioner is now owned by @brewsite/model, not core.
  ```

  The `labelPositioner` option on `UseSceneEngineOptions` is removed from core's
  public API. Label positioning becomes an internal concern of the model plugin.

  The concrete implementation (Q3 Decision — Option C): `modelPlugin.onRendererCreated()`
  creates a `LabelPositioner` instance and stores it in a React ref. `modelPlugin`
  implements `wrapProvider` (§6.1) to provide `LabelPositionerContext` around
  `EngineProvider`'s rendered children. `EngineProvider` calls `plugin.wrapProvider?.(inner)`
  for each plugin during render (§7.6). `LabelItem` components continue to call
  `useLabelPositioner()` exactly as today — no call-site changes, no separate wrapper
  component required by consumers.

- `SceneFrame.labels` is removed. The `pushLabel` method on `CompileApi` is removed
  from `packages/core/src/compiler/sceneDslTypes.ts`. Model widget's `CUSTOM_NODE_HANDLER`
  currently calls `api.pushLabel()` to register labels found in `<BodyPart><Label>`.
  In Phase 4, `ModelWidget`'s handler stores labels directly in the compiled
  `SceneModelInstanceState`:

  ```typescript
  // In SceneModelInstanceState (packages/model/src/elements/model/types.ts):
  export type SceneModelInstanceState = {
    model: SceneModel;
    playback: ScenePlayback;
    enabled?: boolean;
    labels?: LabelResolved[];  // NEW — moved from SceneFrame.labels
  };
  ```

  The `CUSTOM_NODE_HANDLER` on `ModelWidget` accumulates labels into
  `state.labels` rather than calling `api.pushLabel()`.

- `SceneFrameDelta.labels` is removed as a consequence of `SceneFrame.labels` removal.

- `CompileApi.pushLabel` is removed from `sceneDslTypes.ts`. The `createApi()` function
  in `sceneDslCompiler.ts` no longer includes `pushLabel` in the returned object.

### 7.9 CompileExtraContext.clipMeta Removal Strategy

**File:** `packages/core/src/widget/types.ts`

`clipMeta: ClipMeta[]` is removed from `CompileExtraContext` in Phase 4:

```typescript
// Phase 4 CompileExtraContext — model-agnostic:
export type CompileExtraContext = {
  sceneProgress: number;
  globalProgress: number;
  prefersReducedMotion: boolean;
  // clipMeta removed — @brewsite/model manages its own clip metadata.
};
```

`ModelWidget.compileExtra()` currently uses `_ctx.prefersReducedMotion` and
`this.config.clipMeta` (not `ctx.clipMeta`). Reading the actual implementation
(line 622–628 of `ModelWidget.ts`) confirms this:
```typescript
compileExtra(state: SceneModelInstanceState, _ctx: CompileExtraContext): CompiledAnimation {
  return compileAnimation(
    state.playback?.animation,
    this.config.clipMeta,   // uses this.config.clipMeta, NOT ctx.clipMeta
    _ctx.prefersReducedMotion,
  );
}
```

This means removing `ctx.clipMeta` from `CompileExtraContext` does not break
`ModelWidget.compileExtra()` — it already ignores the context's clipMeta field.
The removal is safe.

The `ClipMeta` type also moves to `@brewsite/model/src/compiler/labelCompiler.ts`
(it was only used in model context). The `ClipMeta` export from
`packages/core/src/compiler/sceneTrackTypes.ts` is deleted.

The `useSceneEngine.ts` call `compileSceneTrack({ ..., clipMeta: options.clipMeta })` is
updated — `clipMeta` is removed from `CompileSceneTrackOptions` in core. The model
plugin provides clip metadata to `ModelWidget` via constructor config, not the compiler.

### 7.10 createDefaultWidgetRegistry Disposition

**File:** `packages/core/src/player/defaultWidgets.ts`

`createDefaultWidgetRegistry` is deprecated but not removed in Phase 4. It is marked
with `@deprecated` JSDoc and an inline note:

```typescript
/**
 * @deprecated Use EngineProvider's `plugins` prop with corePlugin() and modelPlugin()
 * from @brewsite/model instead. This function will be removed in a future major version.
 *
 * Kept for backward compatibility with existing widgetSetup-based integrations.
 */
export const createDefaultWidgetRegistry = (
  manifest: AssetManifest | null,
  options?: DefaultWidgetRegistryOptions,
): WidgetRegistry => { ... }
```

A deprecation warning should be emitted at runtime when this function is called:
```typescript
if (process.env.NODE_ENV !== 'production') {
  console.warn(
    '[BrewSite] createDefaultWidgetRegistry() is deprecated. ' +
    'Migrate to EngineProvider plugins={[corePlugin(), modelPlugin(...)]} instead.',
  );
}
```

### 7.11 What is Removed from @brewsite/core in Phase 4

| Symbol / File | Action |
|---|---|
| `packages/core/src/compiler/labelCompiler.ts` | Deleted (moved to `@brewsite/model/src/compiler/`) |
| `packages/core/src/labels/` (entire directory) | Deleted (moved to `@brewsite/model/src/labels/`) |
| `packages/core/src/player/LabelPositioner.ts` | Deleted (moved to `@brewsite/model/src/player/`) |
| `packages/core/src/player/LabelPositionerContext.ts` | Deleted (moved to `@brewsite/model/src/player/`) |
| `packages/core/src/elements/model/` (entire directory) | Deleted (moved to `@brewsite/model/src/elements/model/`) |
| `IContainedModel` in `widget/types.ts` | Deleted (now in `@brewsite/model/src/widget/types.ts`) |
| `isContainedModel` in `WidgetRegistry.ts` | Deleted |
| `WidgetRegistry.getContainedModels()` | Already deleted in Phase 2 |
| `SceneFrame.labels` | Deleted from `sceneTrackTypes.ts` |
| `SceneTrackTick.labelPrimitives` | Deleted from `sceneTrackTypes.ts` |
| `SceneFrameDelta.labels` | Deleted from `sceneTrackTypes.ts` |
| `CompileApi.pushLabel` | Deleted from `sceneDslTypes.ts` |
| `CompileExtraContext.clipMeta` | Deleted from `widget/types.ts` |
| `ClipMeta` type | Deleted from `sceneTrackTypes.ts`; moves to `@brewsite/model` |
| `LabelResolved` import/re-export in `sceneTrackTypes.ts` | Deleted |
| `LabelResolved` in `sceneDslTypes.ts` | Deleted |
| `clipMeta` param on `CompileSceneTrackOptions` | Deleted |
| `clipMeta` param on `buildSceneTrackKey` | Deleted |
| `useSceneEngine` option `clipMeta` | Deleted |
| `useSceneEngine` option `labelPositioner` | Deleted (now owned by model plugin) |
| `LabelPositioner` export in `player/index.ts` | Deleted |
| `LabelPositionerContext` export in `player/index.ts` | Deleted |
| `useLabelPositioner` export in `player/index.ts` | Deleted |
| `WidgetRegistry.buildCacheKey()` clipMeta duck-typing | Updated — clipMeta branch removed |

### 7.12 @brewsite/model Public API (index.ts)

**File:** `packages/model/src/index.ts`

```typescript
// @brewsite/model public API surface.

// Plugin factory
export { modelPlugin } from './plugin';
export type { ModelPluginOptions } from './plugin';

// Model element public surface
export type {
  SceneModel,
  SceneModelInstanceState,
  SceneAnimation,
  ScenePlayback,
  BodyPartOverride,
  BodyPartOverrideMap,
  ModelPartSpec,
  ModelSubpartSpec,
  MotionCommand,
  MotionScene,
  CustomAnimation,
  Vec3,
} from './elements/model/types';
export { ModelWidget } from './elements/model/ModelWidget';
export type { ModelWidgetConfig } from './elements/model/ModelWidget';
export type { AssetManifest, ModelMeta, AnimationEntry } from './elements/model/metadata';
export { clipMetaFromManifest, assertManifestValid, findModelMeta } from './elements/model/metadata';

// Label public surface
export type { LabelDefinition, LabelResolved, LabelStyle } from './labels/types';
export { Label } from './labels/dsl';
export { LabelItem } from './labels/LabelItem';
export { LabelPositioner } from './player/LabelPositioner';
export { LabelPositionerContext, useLabelPositioner } from './player/LabelPositionerContext';

// Widget contract extensions
export type { IContainedModel } from './widget/types';

// Handler registration
export { registerModelHandlers } from './handlers';
```

---

## 8. PM Decisions

The following decisions were made during PM review of this plan. All decisions are
final and recorded here for implementing bots.

### Q1: manifestUrl Location After Phase 4

**Decision: Option A — Keep manifestUrl as ScenePlayer convenience prop.**

`ScenePlayer` retains its existing `manifestUrl` top-level prop permanently.
In Phase 4, `ScenePlayer` internally composes `modelPlugin({ manifestUrl })`.
Breaking this off into an explicit `plugins` array is wrong DX for the common case.

### Q2: Manifest Fetch Timing and assetsReady

**Decision: Option A — Plugin fetches on mount.**

`EngineProvider` calls `await plugin.fetchManifest()` before constructing the registry.
Option B (eager fetch at factory creation) is fragile — plugins often live in `useMemo`,
and a fetch that starts at construction time can fire before mount, fire multiple times
on hot reload, or fail silently in SSR.

### Q3: LabelPositionerContext Ownership

**Decision: Option C — `WidgetPlugin.wrapProvider`.**

`WidgetPlugin` gains the optional method `wrapProvider?: (children: ReactNode) => ReactNode`
(already specified in §6.1). `modelPlugin` implements `wrapProvider` to install
`LabelPositionerContext`. `EngineProvider` calls `plugin.wrapProvider?.(innerJSX)` for
each plugin during render (§7.6). No call-site changes, no generic context casting,
no new wrapper component required. This also resolves the label-update flow after
`labelPositioner` is removed from `useSceneEngine`.

### Q4: Version Strategy

**Decision: Major version bump for `@brewsite/core`. `@brewsite/model` starts at 1.0.0.
No re-export shims.**

The removals (`labels/`, `model/`, `IContainedModel`, `ClipMeta`, `LabelResolved`,
`pushLabel`, `clipMeta`) are too numerous for a minor version. `@brewsite/core` bumps
to its next major version. `@brewsite/model` starts at 1.0.0.

`createDefaultWidgetRegistry` lives one full major release cycle then is removed.
Migration guidance goes in the CHANGELOG, not in re-export shims. Re-export shims
(`export { LabelItem } from '@brewsite/model'`) are **not** provided — consumers must
update imports directly.

### Q5: Full-Stack Convenience Helper

**Decision: Option A — No convenience helper in any published package.**

Consumers compose `[corePlugin(), modelPlugin(...), diagramPlugin()]` explicitly.
Tree-shaking requires explicit imports. A `defaultPlugins()` helper belongs in
`apps/examples` as a local utility if needed there, not in any published package.

---

## 9. Implementation Sequence and Releasability

Phases must be executed strictly in order. Each phase is independently releasable.
Run `pnpm typecheck && pnpm test` between each numbered step within a phase.

### Phase 1 Steps

1. Add `IRendererLifecycle`, `IRenderContributor`, `RenderContribution`,
   `IContainedRenderable`, `IAttachmentHost` to
   `packages/core/src/widget/types.ts`.
2. Add type guards (`isRendererLifecycle`, `isRenderContributor`,
   `isContainedRenderable`, `isAttachmentHost`) to
   `packages/core/src/widget/WidgetRegistry.ts`.
3. Add `getContainedRenderables()`, `getAttachmentHosts()`,
   `notifyRendererCreated()`, `notifyRendererDisposing()` to `WidgetRegistry`.
4. `pnpm typecheck && pnpm test` — must pass.

**Releasable as `@brewsite/core` patch version. Fully additive — zero breaking changes.
No existing `IRenderable` implementor requires modification.**

### Phase 2 Steps

1. Add `IAttachmentHost` and `IRenderContributor` to `ModelWidget`'s `implements` clause.
2. Add `getAttachmentPoint()` and `contributeRenderData()` to `ModelWidget`.
3. Replace `attachContainedModels()` with `attachContainedRenderables()` in
   `packages/core/src/runtime/RuntimeDriver.ts`.
4. Remove `private containedModels` field and `getContainedModels()` call from
   `RuntimeDriverImpl`.
5. Replace `getBoneWorldPositions()` and `getTargetColors()` with
   `collectRenderContributions()` in `RuntimeDriverImpl`.
6. Update `RuntimeDriver` interface in `packages/core/src/runtime/types.ts`.
7. Replace `ModelRenderer.disposeKtx2Loader()` call with
   `options.widgetRegistry.notifyRendererDisposing(renderer)` in `useSceneEngine.ts`.
8. Update render loop to use `driver.collectRenderContributions()`.
9. Rename `boneWorldPositions` → `namedPositions` in `LabelPositioner.update()`.
10. Delete `WidgetRegistry.getContainedModels()`.
11. Add `// DEBT:` comment to `buildCacheKey()`.
12. `pnpm typecheck && pnpm test` — must pass.

**Releasable as `@brewsite/core` minor version.**
Breaking: `RuntimeDriver.getBoneWorldPositions()` and `getTargetColors()` removed
from the public interface. Consumers using `RuntimeDriver` type directly must migrate.
`WidgetRegistry.getContainedModels()` removed.

### Phase 3 Steps

1. Create `packages/core/src/widget/WidgetPlugin.ts`.
2. Create `packages/core/src/compiler/coreHandlers.ts` with `registerCoreHandlers()`.
3. Export `sceneRootHandler` from `sceneDslCompiler.ts`.
4. Export `progressManagerHandler` from `primitives/progressManager.ts`.
5. Remove auto-registration calls from `sceneDslCompiler.ts`, `inputController.tsx`,
   `progressManager.ts`.
6. Move label guard registrations from `labels/dsl.tsx` into `coreHandlers.ts` (temporarily).
7. Create `packages/core/src/player/plugins.ts` with `corePlugin()`.
8. Add `plugins?: WidgetPlugin[]` prop to `EngineProvider`.
9. Implement plugin resolution logic in `EngineProvider`.
10. Export `WidgetPlugin`, `corePlugin`, `CorePluginOptions` from core public API.
11. `pnpm typecheck && pnpm test` — must pass.
12. **Manually verify:** existing example scenes with `widgetSetup` continue to work
    (backward compat test).
13. **Manually verify:** a new scene using `plugins={[corePlugin()]}` compiles and
    renders correctly with no model.

**Releasable as `@brewsite/core` minor version (additive, fully backward compatible).**

### Phase 4 Steps

**Sequencing dependency:** Phase 4 touches `sceneTrackTypes.ts` (removing
`labelPrimitives`, `SceneFrame.labels`, `ClipMeta`) and `widget/types.ts` (removing
`CompileExtraContext.clipMeta`, `IContainedModel`). The progress-driven animation plan
also modifies both of these files. **Phase 4 must not start until the progress-driven
animation changes are merged.** Phases 1–3 of this plan can run in parallel with the
progress-driven animation work.

1. Create `packages/model/` workspace with `package.json`, `tsconfig.json`,
   `tsconfig.build.json`, `vitest.config.ts`.
2. Add `packages/model` to Turborepo workspace and root `pnpm-workspace.yaml`.
3. Copy (do not move yet) all model and label source files to `packages/model/src/`.
4. Update all import paths in copied files to use `@brewsite/core` package imports
   for core types.
5. Create `packages/model/src/widget/types.ts` with `IContainedModel`.
6. Create `packages/model/src/handlers.ts` with `registerModelHandlers()`.
7. Create `packages/model/src/plugin.ts` with `modelPlugin()`.
8. Create `packages/model/src/index.ts`.
9. `pnpm --filter @brewsite/model typecheck` — must pass before proceeding.
10. `pnpm --filter @brewsite/model test` — must pass before proceeding.
11. Remove model-specific fields from `packages/core/src/compiler/sceneTrackTypes.ts`
    (`labelPrimitives`, `SceneFrame.labels`, `SceneFrameDelta.labels`, `LabelResolved`
    re-export, `ClipMeta`).
12. Remove `CompileApi.pushLabel` from `sceneDslTypes.ts`.
13. Remove `CompileExtraContext.clipMeta` from `widget/types.ts`.
14. Remove `IContainedModel` from `widget/types.ts`.
15. Delete `packages/core/src/labels/`, `packages/core/src/compiler/labelCompiler.ts`,
    `packages/core/src/player/LabelPositioner.ts`,
    `packages/core/src/player/LabelPositionerContext.ts`,
    `packages/core/src/elements/model/`.
16. Remove model imports from `packages/core/src/player/defaultWidgets.ts` — add
    `@deprecated` notice (keep function body for backward compat, but it will now
    require `@brewsite/model` as a dep — evaluate whether to keep or stub).
17. Remove `clipMeta` from `CompileSceneTrackOptions` and `buildSceneTrackKey`.
18. Remove `labelPositioner` from `UseSceneEngineOptions` (or make it accept the
    generic `IRenderContributor` pattern instead).
19. Update `apps/examples` imports from `@brewsite/core` label/model paths to
    `@brewsite/model`.
20. Update `packages/diagram/src/` if it imports any moved symbols from core.
21. `pnpm typecheck && pnpm test` — must pass across all packages.
22. `pnpm --filter @brewsite/model build:lib` — must produce clean dist.
23. **Major version bump**: `@brewsite/core` → next major, `@brewsite/model` → 1.0.0.

---

## 10. Testing Strategy

All new code follows the project's interface-based stateful test philosophy: test the
contract a module promises, not its internal implementation. Refactoring internals must
not break tests.

### Phase 1 Tests

**File:** `packages/core/src/widget/__tests__/WidgetRegistry.test.ts`

Extend existing tests to cover new type guards and methods:

```typescript
// Test isContainedRenderable type guard
const widget: IWidget & IContainedRenderable = {
  widgetId: 'test',
  anchorWidgetId: 'host',
  anchorKey: 'head',
  rootObject: new THREE.Object3D(),
};
expect(isContainedRenderable(widget)).toBe(true);

// Test isAttachmentHost type guard
const host: IWidget & IAttachmentHost = {
  widgetId: 'host',
  getAttachmentPoint: (_key) => new THREE.Object3D(),
};
expect(isAttachmentHost(host)).toBe(true);

// Test getContainedRenderables()
const registry = new WidgetRegistry();
registry.register(widget as unknown as IWidget);
expect(registry.getContainedRenderables()).toHaveLength(1);
```

### Phase 2 Tests

**File:** `packages/core/src/runtime/__tests__/RuntimeDriver.test.ts`

Add tests for `attachContainedRenderables()`:

```typescript
it('attaches IContainedRenderable to IAttachmentHost attachment point', async () => {
  const attachmentPoint = new THREE.Object3D();
  const childObject = new THREE.Object3D();

  const host: IWidget & IAttachmentHost & IRenderable<unknown> = {
    widgetId: 'host',
    rootObject: new THREE.Object3D(),
    getAttachmentPoint: (key) => key === 'head' ? attachmentPoint : null,
    initialize: () => {},
    apply: () => {},
    dispose: () => {},
  };

  const child: IWidget & IContainedRenderable = {
    widgetId: 'child',
    anchorWidgetId: 'host',
    anchorKey: 'head',
    rootObject: childObject,
  };

  const registry = new WidgetRegistry();
  registry.register(host as unknown as IWidget);
  registry.register(child as unknown as IWidget);

  const driver = new RuntimeDriverImpl({ widgetRegistry: registry, ... });
  await driver.initialize(new THREE.Scene());

  // childObject should now be a child of attachmentPoint:
  expect(attachmentPoint.children).toContain(childObject);
});
```

Add tests for `collectRenderContributions()`:

```typescript
it('merges namedPositions from all IRenderContributor widgets', () => {
  const pos: [number, number, number] = [1, 2, 3];
  const contributor: IWidget & IRenderContributor = {
    widgetId: 'contributor',
    contributeRenderData: () => ({
      namedPositions: new Map([['test:Head', pos]]),
    }),
  };
  const registry = new WidgetRegistry();
  registry.register(contributor as unknown as IWidget);
  const driver = new RuntimeDriverImpl({ widgetRegistry: registry, ... });
  const result = driver.collectRenderContributions();
  expect(result.namedPositions?.get('test:Head')).toEqual(pos);
});
```

### Phase 3 Tests

**File:** `packages/core/src/compiler/__tests__/coreHandlers.test.ts` (new)

```typescript
import { registerCoreHandlers, resetCoreHandlerRegistrationForTesting } from '../coreHandlers';
import { getNodeHandler } from '../registry';
import { Scene } from '../sceneDslCompiler';
import { ProgressManager } from '../primitives/progressManager';
import { clearRegistry } from '../registry';

beforeEach(() => {
  clearRegistry();
  resetCoreHandlerRegistrationForTesting();
});

it('registerCoreHandlers() installs Scene handler', () => {
  expect(getNodeHandler(Scene)).toBeUndefined();
  registerCoreHandlers();
  expect(getNodeHandler(Scene)).toBeDefined();
});

it('registerCoreHandlers() is idempotent', () => {
  registerCoreHandlers();
  registerCoreHandlers(); // second call must not throw or duplicate
  expect(getNodeHandler(Scene)).toBeDefined();
});

it('ProgressManager handler is registered after registerCoreHandlers()', () => {
  registerCoreHandlers();
  expect(getNodeHandler(ProgressManager)).toBeDefined();
});
```

**File:** `packages/core/src/player/__tests__/plugins.test.ts` (new)

```typescript
import { corePlugin } from '../plugins';
import { LightingWidget } from '../../elements/lighting/LightingWidget';

it('corePlugin().createWidgets() returns expected widget types', () => {
  const plugin = corePlugin();
  const widgets = plugin.createWidgets();
  const ids = widgets.map(w => w.widgetId);
  expect(ids).toContain('lighting');
  expect(ids).toContain('background');
  expect(ids).toContain('camera');
});

it('corePlugin().registerHandlers() is idempotent', () => {
  const plugin = corePlugin();
  expect(() => {
    plugin.registerHandlers();
    plugin.registerHandlers();
  }).not.toThrow();
});
```

### Phase 4 Tests

**Location:** `packages/model/src/**/__tests__/`

All existing tests in `packages/core/src/elements/model/__tests__/` and
`packages/core/src/labels/__tests__/` move to the corresponding directories in
`packages/model/`. Import paths are updated. Test assertions do not change — the
contracts being tested are unchanged; only the package location changes.

New tests added in Phase 4:

**File:** `packages/model/src/__tests__/plugin.test.ts`

```typescript
import { modelPlugin } from '../plugin';

it('modelPlugin() has fetchManifest that returns null when no URL provided', async () => {
  const plugin = modelPlugin();
  const manifest = await plugin.fetchManifest();
  expect(manifest).toBeNull();
});

it('modelPlugin() createWidgets() returns empty array (factories registered separately)', () => {
  const plugin = modelPlugin();
  expect(plugin.createWidgets()).toHaveLength(0);
});

it('modelPlugin() registerHandlers() is idempotent', () => {
  const plugin = modelPlugin();
  expect(() => {
    plugin.registerHandlers();
    plugin.registerHandlers();
  }).not.toThrow();
});
```

**File:** `packages/model/src/__tests__/handlers.test.ts`

```typescript
import { registerModelHandlers, resetModelHandlerRegistrationForTesting } from '../handlers';
import { getNodeHandler } from '@brewsite/core/compiler/registry';
import { Label } from '../labels/dsl';
import { clearRegistry } from '@brewsite/core/compiler/registry';

beforeEach(() => {
  clearRegistry();
  resetModelHandlerRegistrationForTesting();
});

it('registerModelHandlers() installs Label guard handler', () => {
  registerModelHandlers();
  const handler = getNodeHandler(Label);
  expect(handler).toBeDefined();
  // Handler must throw when invoked at top level:
  expect(() => handler!({} as any, {} as any, {} as any)).toThrow('<Label>');
});
```

---

*End of plan. Total phases: 4. Phases 1–3 are non-breaking additions. Phase 4 is a
major breaking change requiring PM decisions from §8 before implementation.*

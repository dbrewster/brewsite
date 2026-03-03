---
title: "BrewSite Diagram — Interaction System"
doc_type: prd
status: active
owner: brewsite-product-manager
last_updated: 2026-03-02
change_history:
  - date: 2026-03-02
    author: "Toolkit Product"
    summary: "Initial PRD created. Comprehensive documentation of the @brewsite/diagram interaction system as implemented."
---

# BrewSite Diagram — Interaction System

## Overview

The interaction system in `@brewsite/diagram` enables real-time user interaction with diagram nodes and groups during scene playback. It provides hover enter/leave events on nodes and groups, click events on `clickable` nodes, hover-driven visual controls for ephemeral emissive overrides, and a cross-component focus region system based on custom DOM events. All interaction is opt-in — diagrams with no `onMouseEnter`/`onMouseLeave` callbacks and no `clickable` nodes have zero interaction overhead. This feature lives entirely in `@brewsite/diagram`; `@brewsite/core` has no knowledge of hover, click, or focus region concepts.

## Problem Statement

Diagram scenes in marketing and demo contexts benefit from real-time user interaction: hovering a group highlights it, clicking a node triggers navigation, and drilling into a group fires camera focus changes. Without a managed interaction system, consumers must implement their own raycasting pipeline, manage enter/leave state across frames, and build ad-hoc bridges from Three.js hit detection to React component state. This produces fragile, redundant code that is tightly coupled to rendering internals.

The interaction system solves this by providing:

1. A **raycasting pipeline** managed by `DiagramCanvasWidget` that fires typed enter/leave events only when the hover target changes.
2. **Hover controls** — a safe surface for making ephemeral visual state changes (emissive highlights, light toggles) from callback code without going through the compile/playback pipeline.
3. A **focus region system** — a pub/sub mechanism based on DOM custom events that bridges diagram widget events to React component state, enabling drill-down navigation patterns.

## Goals & Success Metrics

**Primary metrics:**
- A consumer can make a group highlight on hover with two callbacks (`onMouseEnter`, `onMouseLeave`) and zero knowledge of Three.js raycasting.
- A consumer can implement a drill-down navigation pattern — hover a group, fire a React state update, re-render the UI — using `useDiagramFocusRegion` without polling or ref bridging.
- `clickable` nodes fire click events with correct `diagramId` and `nodeId` through `DiagramCanvasWidget.onInteraction`.

**Guardrail metrics:**
- Raycasting runs only on pointer-move events, not on every animation frame.
- Nodes with `clickable: false` (the default) are not registered with `InteractionRegistry` — zero raycasting overhead for non-interactive nodes.
- Emissive overrides applied via `DiagramHoverControls` are cleared on the next `IRenderable.apply()` call so they do not persist into subsequent scene ticks.
- `useDiagramFocusRegion` cleans up its DOM event listener on component unmount.

## Non-Goals

- The interaction system does not implement tooltip rendering. Hover events deliver the data; consumers implement their own tooltip layer.
- Hover and click events are not recorded or replayed as part of the SceneTrack. They are runtime-only ephemeral events.
- The focus region system tracks at most one focused group per canvas at a time. Multi-selection is not supported.
- Group hover does not automatically trigger camera movement. The `DiagramCanvasWidget.applyInputFocus()` method moves the camera, but it is called separately (typically from a `Cmd+click` handler configured by the consumer's `ActionInputController` setup).
- The interaction system does not support touch events. Pointer events are mouse-only.

## Consumer Stories

- As a toolkit consumer, I want to add `onMouseEnter` and `onMouseLeave` callbacks to a `DiagramGroup` so that hovering the group visually highlights its nodes with an emissive glow.
- As a toolkit consumer, I want to add `onMouseEnter` and `onMouseLeave` callbacks to a `DiagramNode` so that hovering a specific node activates a visual indicator.
- As a toolkit consumer, I want `stopPropagation()` to prevent a child group hover event from also firing the parent group's handler, matching standard DOM event semantics.
- As a toolkit consumer, I want to mark a node as `clickable` so that clicking it fires a callback with the diagramId and nodeId, enabling scene navigation or UI state changes.
- As a toolkit consumer, I want to subscribe to diagram focus region changes in a React component so that my navigation bar updates when the user hovers a group.
- As a toolkit consumer, I want the focus region pub/sub to work outside React (from a plain event handler) so that I can integrate it with non-React parts of my application.

## Functional Requirements

1. `DiagramCanvasWidget` shall attach `mousemove`, `click`, and `mouseleave` event listeners to `renderer.domElement` in `initialize()` and remove them in `dispose()`.
2. On each `mousemove` event, `DiagramCanvasWidget` shall raycast against all registered node meshes (`InteractionRegistry`) and group meshes (`GroupInteractionRegistry`) and compute a `HoverTarget` describing the current hit.
3. Hover enter/leave callbacks (`onMouseEnter`, `onMouseLeave`) shall fire only when the `HoverTarget` changes between frames — not on every `mousemove` event.
4. Node hover callbacks shall receive a `DiagramNodeHoverEvent` with `type: 'node-mouse-enter'` or `'node-mouse-leave'`. Group hover callbacks shall receive a `DiagramGroupHoverEvent` with `type: 'group-mouse-enter'` or `'group-mouse-leave'`.
5. Group hover events shall be dispatched in parent-to-child order on enter and child-to-parent order on leave, traversing the group path from root to leaf.
6. Calling `event.stopPropagation()` on a group hover event shall prevent further parent or ancestor group callbacks from firing for that hover transition.
7. Emissive overrides applied via `DiagramHoverControls.setNodeEmissive()` or `setGroupNodesEmissive()` are ephemeral. They are cleared on the next `IRenderable.apply()` call when the renderer reapplies compiled state.
8. Nodes with `clickable: false` (the default) must not be registered with `InteractionRegistry`. The raycaster must not test against any mesh for a non-clickable, non-hoverable node.
9. Click detection fires on `click` DOM events (not pointer-down/up). The click handler raycasts against `InteractionRegistry` meshes and fires `onInteraction` with `type: 'node-click'` when a registered mesh is hit.
10. `publishDiagramFocusGroup(canvas, diagramId, groupId)` and `publishDiagramFocusCanvas(canvas)` shall update a module-level current focus state and dispatch a `CustomEvent` on `window` with event type `DIAGRAM_FOCUS_REGION_EVENT`.
11. `useDiagramFocusRegion(options?)` shall subscribe to `DIAGRAM_FOCUS_REGION_EVENT` on `window` and update React state when the event fires, filtered by `options.canvasId` when provided.
12. `useDiagramFocusRegion` shall initialize its React state synchronously from `getDiagramFocusRegion()` to capture any focus state that was published before the component mounted.
13. `clearDiagramFocusRegion(canvasId?)` shall set the current focus state to `null` and dispatch the event. If `canvasId` is provided, the clear is a no-op when `currentFocusRegion.canvasId !== canvasId`.
14. When the pointer leaves the canvas element (`mouseleave`), all active hover targets shall be cleared and appropriate leave events shall fire.

## API Design

### Interaction Event Types

```typescript
// packages/diagram/src/elements/diagram/types.ts

/**
 * Emitted when a clickable diagram node is clicked.
 * Dispatched to DiagramCanvasWidget.onInteraction callback.
 */
export interface DiagramInteractionEvent {
  readonly type: 'node-click';
  readonly diagramId: string;
  readonly nodeId: string;
  /** World-space position of the click ray intersection with the node mesh. */
  readonly intersectPoint: readonly [number, number, number];
}

export interface DiagramHoverEventBase {
  readonly diagramId: string;
  readonly intersectPoint: readonly [number, number, number];
  readonly controls: DiagramHoverControls;
  stopPropagation(): void;
  isPropagationStopped(): boolean;
}

export interface DiagramNodeHoverEvent extends DiagramHoverEventBase {
  readonly type: 'node-mouse-enter' | 'node-mouse-leave';
  readonly nodeId: string;
  /** Parent group id of the hovered node, if any. */
  readonly groupId?: string;
}

export interface DiagramGroupHoverEvent extends DiagramHoverEventBase {
  readonly type: 'group-mouse-enter' | 'group-mouse-leave';
  readonly groupId: string;
}

export type DiagramNodeMouseHandler = (event: DiagramNodeHoverEvent) => void;
export type DiagramGroupMouseHandler = (event: DiagramGroupHoverEvent) => void;
```

### Hover Controls

```typescript
// packages/diagram/src/elements/diagram/types.ts

export interface DiagramHoverControls {
  /**
   * Enables or disables a scene light by its id.
   * Delegates to setSceneLightEnabled from @brewsite/core.
   * Allows hover callbacks to toggle spotlight or ambient light effects.
   */
  setLightEnabled(lightId: string, enabled: boolean): void;

  /**
   * Enables or disables emissive rendering on a single node.
   * The override is applied immediately to the renderer.
   * It is ephemeral — cleared on the next IRenderable.apply() call.
   *
   * @param nodeId - The node to modify.
   * @param enabled - true to activate emissive highlight, false to clear.
   * @param options.diagramId - Target diagram. Defaults to the event's diagramId.
   */
  setNodeEmissive(
    nodeId: string,
    enabled: boolean,
    options?: { diagramId?: string },
  ): void;

  /**
   * Enables or disables emissive rendering on all nodes belonging to a group.
   * The override is applied immediately to each node's renderer material.
   * It is ephemeral — cleared on the next IRenderable.apply() call.
   *
   * @param groupId - Target group.
   * @param enabled - true to activate emissive highlight, false to clear.
   * @param options.diagramId - Target diagram. Defaults to the event's diagramId.
   * @param options.includeDescendants - Also affect nodes in nested child groups.
   *   Default: true.
   */
  setGroupNodesEmissive(
    groupId: string,
    enabled: boolean,
    options?: { diagramId?: string; includeDescendants?: boolean },
  ): void;
}
```

### Interaction Registries

```typescript
// packages/diagram/src/elements/diagram/rendering/InteractionRegistry.ts

export interface IInteractionRegistry {
  register(mesh: THREE.Mesh, diagramId: string, nodeId: string): void;
  unregister(mesh: THREE.Mesh): void;
  lookup(mesh: THREE.Mesh): { diagramId: string; nodeId: string } | undefined;
  readonly meshes: ReadonlySet<THREE.Mesh>;
  clear(): void;
}

/**
 * Instance-scoped registry for clickable and hoverable node meshes.
 * NodeRenderer registers each node's front-face mesh when the node has
 * clickable=true or onMouseEnter/onMouseLeave callbacks.
 */
export class InteractionRegistry implements IInteractionRegistry {
  register(mesh: THREE.Mesh, diagramId: string, nodeId: string): void;
  unregister(mesh: THREE.Mesh): void;
  lookup(mesh: THREE.Mesh): { diagramId: string; nodeId: string } | undefined;
  readonly meshes: ReadonlySet<THREE.Mesh>;
  clear(): void;
}
```

```typescript
// packages/diagram/src/elements/diagram/rendering/GroupInteractionRegistry.ts

export interface IGroupInteractionRegistry {
  register(mesh: THREE.Mesh, diagramId: string, groupId: string): void;
  unregister(mesh: THREE.Mesh): void;
  lookup(mesh: THREE.Mesh): { diagramId: string; groupId: string } | undefined;
  readonly meshes: ReadonlySet<THREE.Mesh>;
  clear(): void;
}

/**
 * Instance-scoped registry for hoverable group border meshes.
 * GroupRenderer registers each group's border mesh when the group has
 * onMouseEnter/onMouseLeave callbacks.
 */
export class GroupInteractionRegistry implements IGroupInteractionRegistry {
  register(mesh: THREE.Mesh, diagramId: string, groupId: string): void;
  unregister(mesh: THREE.Mesh): void;
  lookup(mesh: THREE.Mesh): { diagramId: string; groupId: string } | undefined;
  readonly meshes: ReadonlySet<THREE.Mesh>;
  clear(): void;
}
```

### Focus Region System

```typescript
// packages/diagram/src/elements/diagram/focusRegion.ts

export type DiagramFocusRegionKind = 'group' | 'canvas';

export interface DiagramFocusRegionState {
  readonly kind: DiagramFocusRegionKind;
  readonly canvasId: string;
  /** Non-null when kind === 'group'. null when kind === 'canvas'. */
  readonly diagramId: string | null;
  /** Non-null when kind === 'group'. null when kind === 'canvas'. */
  readonly groupId: string | null;
  /** Date.now() timestamp of when this focus state was published. */
  readonly focusedAt: number;
}

/** Custom DOM event type dispatched on window. */
export const DIAGRAM_FOCUS_REGION_EVENT = 'brewsite:diagram-focus-region';

/**
 * Returns the current focus region state synchronously.
 * Returns null when no focus is active.
 */
export declare const getDiagramFocusRegion: () => DiagramFocusRegionState | null;

/**
 * Publishes a group-level focus event.
 * Updates the module-level current state and dispatches DIAGRAM_FOCUS_REGION_EVENT
 * on window with the new DiagramFocusRegionState as the CustomEvent detail.
 *
 * @param canvas - Canvas state (or any object with an id property).
 * @param diagramId - The diagram containing the focused group.
 * @param groupId - The focused group id.
 */
export declare const publishDiagramFocusGroup: (
  canvas: Pick<DiagramCanvasState, 'id'>,
  diagramId: string,
  groupId: string,
) => void;

/**
 * Publishes a canvas-level focus event (zoom-out / reset).
 * diagramId and groupId are null on the resulting state.
 */
export declare const publishDiagramFocusCanvas: (
  canvas: Pick<DiagramCanvasState, 'id'>,
) => void;

/**
 * Clears the current focus region and dispatches the event with detail=null.
 * If canvasId is provided, the clear is a no-op when the current focus belongs
 * to a different canvas.
 */
export declare const clearDiagramFocusRegion: (canvasId?: string) => void;
```

### Focus Region React Hook

```typescript
// packages/diagram/src/elements/diagram/useDiagramFocusRegion.ts

export interface UseDiagramFocusRegionOptions {
  /**
   * When provided, the hook only updates state for events on this canvas.
   * Focus events from other canvases are filtered out.
   */
  readonly canvasId?: string;
}

/**
 * React hook that subscribes to diagram focus region changes.
 * Returns the current DiagramFocusRegionState or null when no focus is active.
 *
 * Initializes synchronously from getDiagramFocusRegion() to capture any
 * focus state published before the component mounted.
 *
 * Cleans up its window event listener on component unmount.
 *
 * @example
 * const focus = useDiagramFocusRegion({ canvasId: 'system-canvas' });
 * const focusedGroupId = focus?.kind === 'group' ? focus.groupId : null;
 */
export declare const useDiagramFocusRegion: (
  options?: UseDiagramFocusRegionOptions,
) => DiagramFocusRegionState | null;
```

### DSL Props — Interaction-Relevant Fields

```typescript
// On DiagramNodeDSL / DiagramNodeState (packages/diagram/src/elements/diagram/types.ts):

readonly clickable: boolean;        // default false — opts node into InteractionRegistry
readonly onMouseEnter?: DiagramNodeMouseHandler;  // opts node into InteractionRegistry
readonly onMouseLeave?: DiagramNodeMouseHandler;  // opts node into InteractionRegistry

// On DiagramGroupDSL / DiagramGroupState:

readonly onMouseEnter?: DiagramGroupMouseHandler;  // opts group into GroupInteractionRegistry
readonly onMouseLeave?: DiagramGroupMouseHandler;  // opts group into GroupInteractionRegistry
```

### Usage — Hover with Emissive Highlight

```tsx
// In a scene DSL file:

<DiagramGroup
  id="api-tier"
  label="API Tier"
  variant="boundary"
  onMouseEnter={(event) => {
    event.controls.setGroupNodesEmissive('api-tier', true, {
      color: '#00ff88',
      includeDescendants: true,
    });
  }}
  onMouseLeave={(event) => {
    event.controls.setGroupNodesEmissive('api-tier', false);
  }}
>
  <DiagramNode id="gateway" label="Gateway" />
  <DiagramNode id="auth" label="Auth" />
</DiagramGroup>
```

### Usage — Focus Region with React State

```tsx
// In a React component above ScenePlayer:

import { useDiagramFocusRegion } from '@brewsite/diagram';

function NavigationBar() {
  const focus = useDiagramFocusRegion({ canvasId: 'system-canvas' });
  const focusedGroupId = focus?.kind === 'group' ? focus.groupId : null;

  return (
    <nav>
      {focusedGroupId ? (
        <button onClick={() => publishDiagramFocusCanvas({ id: 'system-canvas' })}>
          Back to Full View
        </button>
      ) : null}
    </nav>
  );
}
```

### Usage — Focus Region in Non-React Code

```typescript
// Outside React — in an event handler or plain TypeScript module:

import {
  publishDiagramFocusGroup,
  publishDiagramFocusCanvas,
  getDiagramFocusRegion,
  DIAGRAM_FOCUS_REGION_EVENT,
} from '@brewsite/diagram';

// Subscribe imperatively:
window.addEventListener(DIAGRAM_FOCUS_REGION_EVENT, (event) => {
  const state = (event as CustomEvent).detail;
  if (state?.kind === 'group') {
    console.log(`Focused group: ${state.groupId} in diagram ${state.diagramId}`);
  }
});

// Publish programmatically (e.g. from ActionInputController callback):
publishDiagramFocusGroup({ id: 'system-canvas' }, 'architecture', 'data-tier');
```

### Usage — Click Events

```typescript
// In widgetSetup.ts, after constructing DiagramCanvasWidget:

const canvasWidget = new DiagramCanvasWidget(
  'system-canvas',
  compileCanvas({ id: 'system-canvas' }, [], []),
);

canvasWidget.onInteraction = (event) => {
  if (event.type === 'node-click') {
    console.log(`Clicked node ${event.nodeId} in diagram ${event.diagramId}`);
    // Trigger scene advance, URL navigation, or React state update:
    scrollEngine.advanceToNextStop();
  }
};

registry.register(canvasWidget);
```

## Technical Considerations

### Raycasting Pipeline

`DiagramCanvasWidget` maintains a `THREE.Raycaster` and `THREE.Vector2` (NDC pointer position) as instance fields. The pipeline runs in the `mousemove` DOM event handler attached to `renderer.domElement`:

1. Compute NDC from `event.clientX`/`clientY` relative to `canvas.getBoundingClientRect()`.
2. Call `raycaster.setFromCamera(this.ndc, cam)` where `cam` is the `THREE.PerspectiveCamera` stored in `scene.userData['__brewsite_camera']`.
3. Raycast separately against node meshes (`Array.from(renderer.getInteractionMeshes())`) and group meshes (`Array.from(renderer.getGroupInteractionMeshes())`).
4. Node hits take priority over group hits. If a node hit is found, the `HoverTarget` includes `nodeId` and a derived `groupPath` from the node's `groupId`.
5. If no node hit, group hits are processed: all hit group meshes are sorted by `GroupInteractionRegistry.lookup` depth (group path length), and the deepest (most specific) group is selected as the primary hit.
6. The resulting `HoverTarget` (`{ diagramId, groupPath, nodeId?, point }`) is compared to the previous frame's `HoverTarget`. If they differ, `transitionHover(prev, next)` fires the appropriate leave/enter event sequence.

The pipeline runs only when `lastState` is non-null (i.e., `apply()` has been called at least once). The camera is read from `scene.userData['__brewsite_camera']` — if the camera is absent, the handler returns early.

### Group Path Traversal

Groups in a diagram can be nested. `DiagramCanvasWidget.buildGroupPath(diagram, leafGroupId)` returns the group ids from root to leaf by traversing `group.parentId` links. The resulting array (e.g., `['cloud-tier', 'api-layer', 'gateway-cluster']`) is stored on `HoverTarget.groupPath`.

`transitionHover(prev, next)` uses these paths to compute the shared prefix between the previous and next hover targets:

- Walk the shared prefix to find where the paths diverge.
- Fire `leave` events for the previous path from the divergence point to the leaf (in reverse order: leaf first, then parent).
- Fire `enter` events for the next path from the divergence point to the leaf (in order: parent first, then child).
- If `stopPropagation()` is called in any callback, traversal halts immediately.
- Node hover events fire last on enter and first on leave, ensuring nodes are always the most specific target.

### Group Interaction Hit Selection

When multiple group meshes are hit by the same ray (which happens when groups are nested — the ray passes through outer and inner group borders), `DiagramCanvasWidget.handleMouseMove` selects the deepest group using path depth as the discriminator. The hit with the longest group path is considered the most specific target. This matches natural user intent: hovering a nested group should fire the inner group's callbacks, not the outer group's.

### Emissive Override Architecture

`DiagramHoverControls.setNodeEmissive()` calls `renderer.setNodeEmissiveOverride(diagramId, nodeId, enabled)` on the `DiagramCanvasRenderer`. This method is a pass-through to the per-diagram `DiagramRenderer`, which maintains a `Map<string, boolean>` of active emissive overrides keyed by node id. On the next `IRenderable.apply()` call, `DiagramCanvasRenderer.update()` applies the compiled `DiagramCanvasState` to each `DiagramRenderer`. At the end of each `DiagramRenderer.update()`, emissive overrides are read from the override map and applied directly to the node material's `emissive` and `emissiveIntensity` uniforms. The override map is not cleared by `apply()` — it persists until explicitly cleared by a leave callback. This is intentional: a rapid mouse move could cause `apply()` to run between the enter and leave callbacks. The renderer applies overrides on top of compiled state every frame, so the visual state stays correct regardless of tick ordering.

The `setGroupNodesEmissive` implementation in `DiagramCanvasWidget.createHoverControls()` collects all node ids in the target group (and optionally descendants, via BFS over the child group map) and calls `setNodeEmissive` for each.

### Focus Region Implementation

`focusRegion.ts` uses a module-level `let currentFocusRegion: DiagramFocusRegionState | null = null` variable. This is a deliberate singleton pattern — there is at most one active focus region across all canvases in the page at a time (not per-canvas). The `canvasId` field on `DiagramFocusRegionState` allows consumers to filter events by canvas.

`publishDiagramFocusGroup` and `publishDiagramFocusCanvas` accept a `Pick<DiagramCanvasState, 'id'>` argument rather than a plain string. This enforces that callers always have access to the canvas state object (typically `this.defaultState` in widget code), preventing id typos.

`useDiagramFocusRegion` subscribes to `window` (not `document` or a custom event emitter) to maximize compatibility with iframe-based apps and server-side rendering guards (`typeof window !== 'undefined'`). The hook memo-izes `options` by `canvasId` string to prevent unnecessary re-subscriptions.

### Widget Disposal Sequence

`DiagramCanvasWidget.dispose()` follows this sequence to prevent use-after-free:

1. Remove `click`, `mousemove`, `mouseleave` DOM listeners from `canvasElement`.
2. Set `canvasElement`, `clickHandler`, `mouseMoveHandler`, `mouseLeaveHandler` to null.
3. Call `clearHover()` to fire any pending leave events against `lastState` (which is still non-null at this point).
4. Call `renderer.dispose(widgetId, scene)` to remove all Three.js objects.
5. Set `scene` and `lastState` to null.
6. Reset `inputTranslation` and `inputRotation` to zero.
7. Call `clearDiagramFocusRegion(this.widgetId)` to clear any active focus region on this canvas.

Step 3 runs before `lastState` is nulled so that leave callbacks have access to the final state when the widget is torn down.

## Breaking Change Assessment

**Semver impact: minor** (new feature, no existing public API modified).

This is the initial implementation of the interaction system. No existing `@brewsite/diagram` consumer API changes. Consumers adding hover or click interaction to an existing project:

1. Add `onMouseEnter`/`onMouseLeave` props to `DiagramNode` or `DiagramGroup` DSL elements.
2. Add `clickable={true}` to nodes that should respond to click.
3. Assign `DiagramCanvasWidget.onInteraction` callback in `widgetSetup.ts`.
4. Use `useDiagramFocusRegion()` in React components or `addEventListener(DIAGRAM_FOCUS_REGION_EVENT, ...)` outside React.

Consumers who do not add any of the above have zero behavior change — the interaction system is entirely opt-in.

## Dependencies

- `@brewsite/core`: `setSceneLightEnabled` (consumed by `DiagramHoverControls.setLightEnabled`), `IRenderable`, `ISceneElement`, `AnimationTickContext`, `WidgetInitContext`, `WidgetRenderContext`.
- `packages/diagram/src/elements/diagram/types.ts`: All hover event types, `DiagramHoverControls`, `DiagramInteractionEvent`, `DiagramNodeMouseHandler`, `DiagramGroupMouseHandler`.
- `packages/diagram/src/elements/diagram/rendering/InteractionRegistry.ts`: `InteractionRegistry`, `IInteractionRegistry`.
- `packages/diagram/src/elements/diagram/rendering/GroupInteractionRegistry.ts`: `GroupInteractionRegistry`, `IGroupInteractionRegistry`.
- `packages/diagram/src/elements/diagram/focusRegion.ts`: `publishDiagramFocusGroup`, `publishDiagramFocusCanvas`, `clearDiagramFocusRegion`, `getDiagramFocusRegion`, `DIAGRAM_FOCUS_REGION_EVENT`.
- React (hook layer only): `useEffect`, `useMemo`, `useState`.
- Three.js (widget layer only): `THREE.Raycaster`, `THREE.Vector2`, `THREE.Box3`, `THREE.Vector3`, `THREE.PerspectiveCamera`.

## Risks & Mitigations

**Risk: Stale emissive overrides across scene transitions** — If a hover is active when the scene advances to a new SceneTrack tick, the override map persists into the new tick's compiled state application.
**Mitigation:** The emissive override is applied on top of compiled state every frame. The compiled state for the new scene does not include an emissive override for the node, so the override remains visible until either a leave event fires (as the user moves the pointer) or the scene completes its transition and the pointer exits. This is the correct behavior — a user who is hovering a node during a scene advance should see the hover state persist until they move the pointer.

**Risk: `DiagramFocusRegionState.diagramId` and `groupId` are nullable** — Both are typed as `string | null` rather than `string | undefined`. This mirrors the canonical "no value" signal for a canvas-level focus (`kind === 'canvas'`), where both fields are explicitly null. Consumers must check `state.kind` before accessing `state.groupId`.
**Mitigation:** The TypeScript types enforce the check at compile time when consumers access `state.groupId` directly — they must handle the `null` case. JSDoc on the interface clarifies the nullability contract.

**Risk: Module-level focus region singleton** — A single `currentFocusRegion` module variable means focus state is globally shared per JavaScript module scope. In apps that render multiple independent `@brewsite/diagram` canvases on the same page, focus events from one canvas can trigger subscriptions filtered to a different canvas if consumers do not pass `canvasId` to `useDiagramFocusRegion`.
**Mitigation:** The `canvasId` filter in `useDiagramFocusRegion` and `clearDiagramFocusRegion` is the designed mitigation. Documentation recommends always passing `canvasId` in multi-canvas deployments.

**Risk: Raycast performance with many groups** — Large diagrams with many nested groups and many registered group meshes could make raycasting expensive. The raycast runs on every `mousemove` event.
**Mitigation:** `GroupInteractionRegistry.meshes` only includes groups with `onMouseEnter` or `onMouseLeave` callbacks. Groups without callbacks are not registered, limiting the raycast candidate set. Consumers who author large interaction-free group hierarchies have zero raycasting cost.

## Open Questions

None. The interaction system is fully implemented and all design decisions are resolved.

## Launch Criteria

- `InteractionRegistry` and `GroupInteractionRegistry` have unit tests asserting `register`, `unregister`, `lookup`, and `clear` behavior.
- `focusRegion.ts` has unit tests covering `publishDiagramFocusGroup`, `publishDiagramFocusCanvas`, `clearDiagramFocusRegion`, and `getDiagramFocusRegion`.
- `useDiagramFocusRegion` has a test asserting that the hook initializes from `getDiagramFocusRegion()` synchronously and that it cleans up its event listener on unmount.
- At least one example in `apps/examples/` demonstrates hover callbacks with `setGroupNodesEmissive` and uses `useDiagramFocusRegion` in a UI component.
- All exported types and functions (`DiagramInteractionEvent`, `DiagramNodeHoverEvent`, `DiagramGroupHoverEvent`, `DiagramHoverControls`, `DiagramNodeMouseHandler`, `DiagramGroupMouseHandler`, `DiagramFocusRegionState`, `DiagramFocusRegionKind`, `DIAGRAM_FOCUS_REGION_EVENT`, `publishDiagramFocusGroup`, `publishDiagramFocusCanvas`, `clearDiagramFocusRegion`, `getDiagramFocusRegion`, `useDiagramFocusRegion`, `InteractionRegistry`, `GroupInteractionRegistry`) are present in `packages/diagram/src/index.ts`.
- CHANGELOG entry written for `@brewsite/diagram`.

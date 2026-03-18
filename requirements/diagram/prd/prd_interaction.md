---
title: "BrewSite Diagram — Interaction System"
doc_type: prd
status: active
owner: brewsite-product-manager
last_updated: 2026-03-17
change_history:
  - date: 2026-03-02
    author: "Toolkit Product"
    summary: "Initial PRD created. Comprehensive documentation of the @brewsite/diagram interaction system as implemented."
  - date: 2026-03-13
    author: "Toolkit Product"
    summary: "Audit correction: all interaction plumbing (raycasting, hover, click, focus region publish/clear) now lives in DiagramWidget, not DiagramCanvasWidget. DiagramCanvasWidget was removed in the NVS release. Updated Overview, Goals, Functional Requirements, API Design (raycasting pipeline, group path traversal, interaction dispatch), and all usage examples to reflect DiagramWidget ownership. Corrected publishDiagramFocusGroup/Canvas signatures — they accept Pick<DiagramState,'id'>, not Pick<DiagramCanvasState,'id'>. Corrected focusRegion.ts architecture: IFocusRegionService interface and DiagramFocusRegionService class are now the primary implementation; module-level functions are backwards-compatible wrappers. Corrected widget registration Usage example to use DiagramWidget. Removed all DiagramCanvasWidget references from active requirements."
  - date: 2026-03-15
    author: "Toolkit Product"
    summary: "Minor drift correction: replaced remaining DiagramCanvasWidget references in Technical Considerations (group interaction hit selection, emissive override architecture) with DiagramWidget. Corrected Pick<DiagramCanvasState,'id'> to Pick<DiagramState,'id'> in focus region implementation section. Replaced DiagramCanvasRenderer reference with DiagramRenderer via DiagramWidget."
  - date: 2026-03-17
    author: "Toolkit Product"
    summary: "Codebase alignment: replaced deprecated diagramPlugin({ diagrams: [...] }) usage in click events example with diagramPlugin() (no args). Removed IAnimationController from Dependencies — DiagramWidget does not import it."
---

# BrewSite Diagram — Interaction System

## Overview

The interaction system in `@brewsite/diagram` enables real-time user interaction with diagram nodes and groups during scene playback. It provides hover enter/leave events on nodes and groups, click events on `clickable` nodes, hover-driven visual controls for ephemeral emissive overrides, and a cross-component focus region system based on custom DOM events. All interaction is opt-in — diagrams with no `onMouseEnter`/`onMouseLeave` callbacks and no `clickable` nodes have zero interaction overhead. This feature lives entirely in `@brewsite/diagram`; `@brewsite/core` has no knowledge of hover, click, or focus region concepts.

Affected package: `@brewsite/diagram`.

## Problem Statement

Diagram scenes in marketing and demo contexts benefit from real-time user interaction: hovering a group highlights it, clicking a node triggers navigation, and drilling into a group fires camera focus changes. Without a managed interaction system, consumers must implement their own raycasting pipeline, manage enter/leave state across frames, and build ad-hoc bridges from Three.js hit detection to React component state. This produces fragile, redundant code that is tightly coupled to rendering internals.

The interaction system solves this by providing:

1. A **raycasting pipeline** owned by `DiagramWidget` that fires typed enter/leave events only when the hover target changes.
2. **Hover controls** — a safe surface for making ephemeral visual state changes (emissive highlights, light toggles) from callback code without going through the compile/playback pipeline.
3. A **focus region system** — a pub/sub mechanism based on DOM custom events that bridges diagram widget events to React component state, enabling drill-down navigation patterns.

## Goals & Success Metrics

**Primary metrics:**
- A consumer can make a group highlight on hover with two callbacks (`onMouseEnter`, `onMouseLeave`) and zero knowledge of Three.js raycasting.
- A consumer can implement a drill-down navigation pattern — hover a group, fire a React state update, re-render the UI — using `useDiagramFocusRegion` without polling or ref bridging.
- `clickable` nodes fire click events with correct `diagramId` and `nodeId` through `DiagramWidget.onInteraction`.

**Guardrail metrics:**
- Raycasting runs only on pointer-move events, not on every animation frame.
- Nodes with `clickable: false` (the default) are not registered with `InteractionRegistry` — zero raycasting overhead for non-interactive nodes.
- Emissive overrides applied via `DiagramHoverControls` are cleared on the next `IRenderable.apply()` call so they do not persist into subsequent scene ticks.
- `useDiagramFocusRegion` cleans up its DOM event listener on component unmount.

## Non-Goals

- The interaction system does not implement tooltip rendering. Hover events deliver the data; consumers implement their own tooltip layer.
- Hover and click events are not recorded or replayed as part of the SceneTrack. They are runtime-only ephemeral events.
- The focus region system tracks at most one focused group per canvas at a time. Multi-selection is not supported.
- Group hover does not automatically trigger camera movement. The `DiagramWidget.applyInputFocus()` method moves the camera, but it is called separately (typically from a `Cmd+click` handler configured by the consumer's `ActionInputController` setup).
- The interaction system does not support touch events. Pointer events are mouse-only.

## Consumer Stories

- As a toolkit consumer, I want to add `onMouseEnter` and `onMouseLeave` callbacks to a `DiagramGroup` so that hovering the group visually highlights its nodes with an emissive glow.
- As a toolkit consumer, I want to add `onMouseEnter` and `onMouseLeave` callbacks to a `DiagramNode` so that hovering a specific node activates a visual indicator.
- As a toolkit consumer, I want `stopPropagation()` to prevent a child group hover event from also firing the parent group's handler, matching standard DOM event semantics.
- As a toolkit consumer, I want to mark a node as `clickable` so that clicking it fires a callback with the diagramId and nodeId, enabling scene navigation or UI state changes.
- As a toolkit consumer, I want to subscribe to diagram focus region changes in a React component so that my navigation bar updates when the user hovers a group.
- As a toolkit consumer, I want the focus region pub/sub to work outside React (from a plain event handler) so that I can integrate it with non-React parts of my application.

## Functional Requirements

1. `DiagramWidget` shall attach `mousemove`, `click`, and `mouseleave` event listeners to `renderer.domElement` in `initialize()` and remove them in `dispose()`.
2. On each `mousemove` event, `DiagramWidget` shall raycast against all registered node meshes (`InteractionRegistry` via `renderer.interactionRegistry`) and group meshes (`GroupInteractionRegistry` via `renderer.groupInteractionRegistry`) and compute a `HoverTarget` describing the current hit.
3. Hover enter/leave callbacks (`onMouseEnter`, `onMouseLeave`) shall fire only when the `HoverTarget` changes between frames — not on every `mousemove` event.
4. Node hover callbacks shall receive a `DiagramNodeHoverEvent` with `type: 'node-mouse-enter'` or `'node-mouse-leave'`. Group hover callbacks shall receive a `DiagramGroupHoverEvent` with `type: 'group-mouse-enter'` or `'group-mouse-leave'`.
5. Group hover events shall be dispatched in parent-to-child order on enter and child-to-parent order on leave, traversing the group path from root to leaf.
6. Calling `event.stopPropagation()` on a group hover event shall prevent further parent or ancestor group callbacks from firing for that hover transition.
7. Emissive overrides applied via `DiagramHoverControls.setNodeEmissive()` or `setGroupNodesEmissive()` are ephemeral. They are cleared on the next `IRenderable.apply()` call when the renderer reapplies compiled state.
8. Nodes with `clickable: false` (the default) must not be registered with `InteractionRegistry`. The raycaster must not test against any mesh for a non-clickable, non-hoverable node.
9. Click detection fires on `click` DOM events (not pointer-down/up). The click handler raycasts against `InteractionRegistry` meshes and fires `onInteraction` with `type: 'node-click'` when a registered mesh is hit. `DiagramWidget` only fires events for nodes that belong to its own `widgetId` diagram.
10. `publishDiagramFocusGroup(diagram, diagramId, groupId)` and `publishDiagramFocusCanvas(diagram)` accept `Pick<DiagramState, 'id'>` and delegate to the `IFocusRegionService` implementation. They update the current focus state and dispatch a `CustomEvent` on `window` with event type `DIAGRAM_FOCUS_REGION_EVENT`.
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
 * Dispatched to DiagramWidget.onInteraction callback.
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

The focus region system is implemented as a class-based service with a production singleton. `IFocusRegionService` is the interface; `DiagramFocusRegionService` is the implementation. Module-level functions are backwards-compatible wrappers that delegate to a shared singleton.

```typescript
// packages/diagram/src/elements/diagram/focusRegion.ts

export type DiagramFocusRegionKind = 'group' | 'canvas';

export interface DiagramFocusRegionState {
  readonly kind: DiagramFocusRegionKind;
  /**
   * The widget ID of the DiagramWidget that published this event.
   * Named 'canvasId' for backwards compatibility with useDiagramFocusRegion.
   */
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
 * Interface contract for the focus region service.
 * Allows per-instance creation for isolated testing without singleton bleed.
 */
export interface IFocusRegionService {
  getDiagramFocusRegion(): DiagramFocusRegionState | null;
  publishDiagramFocusGroup(
    diagram: Pick<DiagramState, 'id'>,
    diagramId: string,
    groupId: string,
  ): void;
  publishDiagramFocusCanvas(diagram: Pick<DiagramState, 'id'>): void;
  clearDiagramFocusRegion(canvasId?: string): void;
}

/** Class-based implementation — instantiatable per test to avoid singleton bleed. */
export class DiagramFocusRegionService implements IFocusRegionService {
  getDiagramFocusRegion(): DiagramFocusRegionState | null;
  publishDiagramFocusGroup(
    diagram: Pick<DiagramState, 'id'>,
    diagramId: string,
    groupId: string,
  ): void;
  publishDiagramFocusCanvas(diagram: Pick<DiagramState, 'id'>): void;
  clearDiagramFocusRegion(canvasId?: string): void;
}

/** Production singleton delegated to by all module-level functions. */
export const diagramFocusRegionService: IFocusRegionService;

// Backwards-compatible module-level wrappers:

export const getDiagramFocusRegion: () => DiagramFocusRegionState | null;

/**
 * @param diagram - The DiagramState or any object with an 'id' string property.
 *   Use the DiagramWidget's state object or { id: widgetId }.
 *   Note: accepts Pick<DiagramState, 'id'>, NOT Pick<DiagramCanvasState, 'id'>.
 */
export const publishDiagramFocusGroup: (
  diagram: Pick<DiagramState, 'id'>,
  diagramId: string,
  groupId: string,
) => void;

export const publishDiagramFocusCanvas: (diagram: Pick<DiagramState, 'id'>) => void;

export const clearDiagramFocusRegion: (canvasId?: string) => void;
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
// NOTE: first argument is Pick<DiagramState, 'id'> — use the diagram widget's id, not a canvas state.
publishDiagramFocusGroup({ id: 'my-diagram-widget-id' }, 'architecture', 'data-tier');
```

### Usage — Click Events

When using `diagramPlugin()`, `DiagramWidget` instances are created automatically during compilation. Access the widget from the registry after the engine initializes, or use the `onInteraction` callback pattern via plugin setup:

```typescript
// The DiagramWidget is created by diagramPlugin. Access it after engine startup:
const widget = registry.get('my-diagram') as DiagramWidget | undefined;
if (widget) {
  widget.onInteraction = (event) => {
    if (event.type === 'node-click') {
      console.log(`Clicked node ${event.nodeId} in diagram ${event.diagramId}`);
      // Trigger scene advance, URL navigation, or React state update:
      scrollEngine.advanceToNextStop();
    }
  };
}
```

For manual widget construction (advanced use case):

```typescript
import { DiagramWidget } from '@brewsite/diagram';

const widget = new DiagramWidget('my-diagram', makeDefaultDiagramState('my-diagram'));
widget.onInteraction = (event) => { /* ... */ };
registry.register(widget);
```

## Technical Considerations

### Raycasting Pipeline

`DiagramWidget` maintains a `THREE.Raycaster` and `THREE.Vector2` (NDC pointer position) as instance fields, reused across events to avoid per-event allocation. The pipeline runs in the `mousemove` DOM event handler attached to `renderer.domElement`:

1. Compute NDC from `event.clientX`/`clientY` relative to `canvas.getBoundingClientRect()`.
2. Call `raycaster.setFromCamera(this.ndc, cam)` where `cam` is the main `THREE.PerspectiveCamera` stored on `this.mainCamera` (injected from `WidgetInitContext.camera`).
3. Raycast against node meshes (`Array.from(this.renderer.interactionRegistry.meshes)`) and group meshes (`Array.from(this.renderer.groupInteractionRegistry.meshes)`) separately.
4. Node hits take priority over group hits. If a node hit is found and its `diagramId` matches this widget's `widgetId`, the `HoverTarget` includes `nodeId` and a derived `groupPath` built from the node's `groupId` via `buildGroupPath(lastState, groupId)`.
5. If no qualifying node hit, group hits are processed: for each hit group mesh, `buildGroupPath(lastState, groupId)` determines its depth. The deepest group is selected as the most specific hit.
6. The resulting `HoverTarget | null` is compared to `this.hovered`. If they differ, `computeHoverTransitionEvents(prev, next, lastState)` from `compiler/hoverStateMachine.ts` produces the ordered event sequence, which is then dispatched via node/group callbacks.

The pipeline runs only when `this.lastState` is non-null (i.e., `apply()` has been called at least once).

### Group Path Traversal

Groups in a diagram can be nested. `buildGroupPath(state, leafGroupId)` from `compiler/hoverStateMachine.ts` returns the group ids from root to leaf by traversing `group.parentId` links in the `DiagramState`. The resulting array (e.g., `['cloud-tier', 'api-layer', 'gateway-cluster']`) is stored on `HoverTarget.groupPath`.

`computeHoverTransitionEvents(prev, next, state)` from `compiler/hoverStateMachine.ts` uses these paths to compute the shared prefix between the previous and next hover targets:

- Walk the shared prefix to find where the paths diverge.
- Fire `leave` events for the previous path from the divergence point to the leaf (in reverse order: leaf first, then parent).
- Fire `enter` events for the next path from the divergence point to the leaf (in order: parent first, then child).
- If `stopPropagation()` is called in any callback, traversal halts immediately.
- Node hover events fire last on enter and first on leave, ensuring nodes are always the most specific target.

### Group Interaction Hit Selection

When multiple group meshes are hit by the same ray (which happens when groups are nested — the ray passes through outer and inner group borders), `DiagramWidget.handleMouseMove` selects the deepest group using path depth as the discriminator. The hit with the longest group path is considered the most specific target. This matches natural user intent: hovering a nested group should fire the inner group's callbacks, not the outer group's.

### Emissive Override Architecture

`DiagramHoverControls.setNodeEmissive()` calls `renderer.setNodeEmissiveOverride(nodeId, enabled)` on the `DiagramRenderer` via the `DiagramWidget`. The `DiagramRenderer` maintains a `Map<string, boolean>` of active emissive overrides keyed by node id. On the next `IRenderable.apply()` call, `DiagramRenderer.update()` applies the compiled `DiagramState`. At the end of each `DiagramRenderer.update()`, emissive overrides are read from the override map and applied directly to the node material's `emissive` and `emissiveIntensity` uniforms. The override map is not cleared by `apply()` — it persists until explicitly cleared by a leave callback. This is intentional: a rapid mouse move could cause `apply()` to run between the enter and leave callbacks. The renderer applies overrides on top of compiled state every frame, so the visual state stays correct regardless of tick ordering.

The `setGroupNodesEmissive` implementation in `DiagramWidget.createHoverControls()` collects all node ids in the target group (and optionally descendants, via BFS over the child group map) and calls `setNodeEmissive` for each.

### Focus Region Implementation

`focusRegion.ts` uses a module-level `let currentFocusRegion: DiagramFocusRegionState | null = null` variable. This is a deliberate singleton pattern — there is at most one active focus region across all canvases in the page at a time (not per-canvas). The `canvasId` field on `DiagramFocusRegionState` allows consumers to filter events by canvas.

`publishDiagramFocusGroup` and `publishDiagramFocusCanvas` accept a `Pick<DiagramState, 'id'>` argument rather than a plain string. This enforces that callers always have access to the diagram state object (typically `this.defaultState` in widget code), preventing id typos.

`useDiagramFocusRegion` subscribes to `window` (not `document` or a custom event emitter) to maximize compatibility with iframe-based apps and server-side rendering guards (`typeof window !== 'undefined'`). The hook memo-izes `options` by `canvasId` string to prevent unnecessary re-subscriptions.

### Widget Disposal Sequence

`DiagramWidget.dispose()` follows this sequence to prevent use-after-free:

1. Remove `click`, `mousemove`, `mouseleave` DOM listeners from `canvasElement`.
2. Set `canvasElement`, `clickHandler`, `mouseMoveHandler`, `mouseLeaveHandler` to null.
3. Call `clearHover()` to fire any pending leave events against `lastState` (which is still non-null at this point).
4. Remove the `diagramGroup` from the `THREE.Scene` and call `renderer.dispose(widgetId, diagramGroup)` to release all Three.js objects.
5. Set `scene`, `mainCamera`, and `lastState` to null.
6. Call `clearDiagramFocusRegion(this.widgetId)` to clear any active focus region associated with this widget.

Step 3 runs before `lastState` is nulled so that leave callbacks have access to the final state when the widget is torn down.

## Breaking Change Assessment

**Semver impact: minor** (new feature, no existing public API modified).

This is the initial implementation of the interaction system. No existing `@brewsite/diagram` consumer API changes. Consumers adding hover or click interaction to an existing project:

1. Add `onMouseEnter`/`onMouseLeave` props to `DiagramNode` or `DiagramGroup` DSL elements.
2. Add `clickable={true}` to nodes that should respond to click.
3. Assign `DiagramWidget.onInteraction` callback in `widgetSetup.ts`.
4. Use `useDiagramFocusRegion()` in React components or `addEventListener(DIAGRAM_FOCUS_REGION_EVENT, ...)` outside React.

Consumers who do not add any of the above have zero behavior change — the interaction system is entirely opt-in.

## Dependencies

- `@brewsite/core`: `IRenderable`, `ISceneElement`, `ILoadable`, `IDslComposite`, `ILightingOverride`, `INVSBounded`, `WidgetInitContext`, `WidgetRenderContext`.
- `packages/diagram/src/elements/diagram/types.ts`: All hover event types, `DiagramHoverControls`, `DiagramInteractionEvent`, `DiagramNodeMouseHandler`, `DiagramGroupMouseHandler`.
- `packages/diagram/src/elements/diagram/compiler/hoverStateMachine.ts`: `computeHoverTransitionEvents`, `buildGroupPath`, `collectGroupIds`, `HoverTarget`, `HoverEvent`.
- `packages/diagram/src/elements/diagram/rendering/InteractionRegistry.ts`: `InteractionRegistry`, `IInteractionRegistry`.
- `packages/diagram/src/elements/diagram/rendering/GroupInteractionRegistry.ts`: `GroupInteractionRegistry`, `IGroupInteractionRegistry`.
- `packages/diagram/src/elements/diagram/focusRegion.ts`: `IFocusRegionService`, `DiagramFocusRegionService`, `diagramFocusRegionService`, `publishDiagramFocusGroup`, `publishDiagramFocusCanvas`, `clearDiagramFocusRegion`, `getDiagramFocusRegion`, `DIAGRAM_FOCUS_REGION_EVENT`.
- React (hook layer only): `useEffect`, `useMemo`, `useState`.
- Three.js (widget layer only): `THREE.Raycaster`, `THREE.Vector2`, `THREE.PerspectiveCamera`.

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
- All exported types and functions (`DiagramInteractionEvent`, `DiagramNodeHoverEvent`, `DiagramGroupHoverEvent`, `DiagramHoverControls`, `DiagramNodeMouseHandler`, `DiagramGroupMouseHandler`, `DiagramFocusRegionState`, `DiagramFocusRegionKind`, `DIAGRAM_FOCUS_REGION_EVENT`, `getDiagramFocusRegion`, `clearDiagramFocusRegion`, `useDiagramFocusRegion`) are present in `packages/diagram/src/index.ts`. Note: `publishDiagramFocusGroup` and `publishDiagramFocusCanvas` are not directly exported from the package index (they are used internally by `DiagramWidget`); `InteractionRegistry` and `GroupInteractionRegistry` are rendering-layer classes not exported from the package root.
- CHANGELOG entry written for `@brewsite/diagram`.

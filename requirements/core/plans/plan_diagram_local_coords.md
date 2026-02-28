---
title: "@brewsite/diagram — Local Coordinate System & DiagramCanvas Redesign"
doc_type: plan
owner: architecture
status: active
updated: 2026-02-25
---

# `@brewsite/diagram` — Local Coordinate System & DiagramCanvas Redesign

## 1. Motivation and Goals

The current design places diagram nodes directly in world space. This has three critical
problems:

1. **No diagram-level transform.** Moving an entire diagram requires updating every node
   position. There is no way to animate "the diagram" as a unit.
2. **Incompatible with Lucid import.** Lucid exports pixel coordinates. Without a diagram-
   level scale, every import requires a manual coordinate conversion.
3. **No cross-diagram edges.** Two related diagrams cannot be connected with visual pipes.

This plan redesigns `<Diagram>` to use **diagram-local coordinates** with a world-space
transform (`position`, `rotation`, `scale`) at the diagram level. It adds:

- `<Exit>` / `<Enter>` DSL child elements for semantic scene-transition animation
- `<DiagramCanvas>` compilation container with its own world transform
- `<DiagramPipe>` for cross-diagram tube connections within a canvas

### Coordinate Model (Model B)

- `<Diagram position rotation scale>` — world/parent-space transform of the diagram origin
- `<DiagramNode position={[x, y, z]}>` — diagram-local position; `z` defaults to 0
- `pivot` attribute controls which point in the diagram's bounding box maps to local `[0,0,0]`
- `scale` drives world-space sizing; Lucid authors can use raw pixel coordinates and set
  `scale={0.01}` to fit — all properties (depth, thickness) scale uniformly with the group

---

## 2. Files To Create or Modify

### Modified files

| File | Change |
|---|---|
| `src/elements/diagram/types.ts` | Add position/rotation/scale/pivot/exit/enter to DiagramState + DiagramDSL; remove cameraTarget/cameraDistance |
| `src/elements/diagram/dsl.tsx` | Add position/rotation/scale/pivot props to DiagramProps; add Exit and Enter DSL components |
| `src/elements/diagram/compile.ts` | Add pivot offset; remove cameraTarget/cameraDistance; update functionalDiagramTransitionSpec |
| `src/elements/diagram/render.ts` | Apply diagram position/rotation/scale to root Group; change parent param from THREE.Scene to THREE.Object3D |
| `src/elements/diagram/widget.ts` | Update onTick() camera framing to use bounds+position+scale instead of cameraTarget/cameraDistance |
| `src/elements/diagram/index.ts` | Re-export new types |
| `src/compiler/handlers.ts` | Add DiagramCanvas/DiagramPipe/Exit/Enter handlers; update extractDiagramDSL |
| `src/index.ts` | Export canvas module |
| `apps/examples/diagram/widgetSetup.ts` | Migrate to DiagramCanvasWidget |
| `apps/examples/diagram/scenes/scene_arch_overview.tsx` | Wrap in DiagramCanvas; add Enter/Exit |
| `apps/examples/diagram/scenes/scene_arch_ecs_detail.tsx` | Wrap in DiagramCanvas |

### New files

| File | Purpose |
|---|---|
| `src/elements/diagram/canvas/types.ts` | DiagramCanvasState, DiagramPipeState, DiagramCanvasDSL, DiagramPipeDSL |
| `src/elements/diagram/canvas/dsl.tsx` | `<DiagramCanvas>` and `<DiagramPipe>` DSL components |
| `src/elements/diagram/canvas/compile.ts` | compileCanvas(), compilePipe(), routePipe(), functionalDiagramCanvasTransitionSpec |
| `src/elements/diagram/canvas/render.ts` | DiagramCanvasRenderer |
| `src/elements/diagram/canvas/widget.ts` | DiagramCanvasWidget |
| `src/elements/diagram/canvas/index.ts` | Barrel re-exports |
| `src/elements/diagram/canvas/__tests__/compile.test.ts` | Canvas compile tests |
| `src/elements/diagram/canvas/__tests__/functionalTransitionSpec.test.ts` | Canvas transition tests |

---

## 3. Type Changes — `src/elements/diagram/types.ts`

### 3.1 New union and interface types (add before DiagramNodeState)

```typescript
/** Pivot point: which corner/center of the node layout maps to diagram local [0,0,0]. */
export type DiagramPivot =
  | 'center'        // geometric center of bounding box (default)
  | 'top-left'      // top-left corner (natural for Lucid import)
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

/** Easing function for <Exit> / <Enter> transitions. */
export type DiagramEasing = 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'spring';

/**
 * Compiled exit behaviour for a diagram. Produced from <Exit> DSL child.
 * Applied by exitFn in functionalDiagramTransitionSpec.
 */
export interface DiagramExitConfig {
  /**
   * Target position in parent space (canvas-local or world) at t=1.
   * If absent, diagram stays at its declared position (scale/fade only).
   */
  readonly to?: readonly [number, number, number];
  /** If true, fades all node and edge opacities from their declared values to 0. Default: true */
  readonly fade: boolean;
  /** Target scale factor at t=1. If absent, scale does not animate. */
  readonly scaleTo?: number;
  readonly easing: DiagramEasing;
}

/**
 * Compiled enter behaviour for a diagram. Produced from <Enter> DSL child.
 * Applied by enterFn in functionalDiagramTransitionSpec.
 */
export interface DiagramEnterConfig {
  /**
   * Source position in parent space (canvas-local or world) at t=0.
   * If absent, diagram enters from its declared position (scale/fade only).
   */
  readonly from?: readonly [number, number, number];
  /** If true, fades all node and edge opacities from 0 to their declared values. Default: true */
  readonly fade: boolean;
  /** Source scale factor at t=0. If absent, scale does not animate. */
  readonly scaleFrom?: number;
  readonly easing: DiagramEasing;
}

/**
 * Raw DSL props from <Exit> before compile.ts applies defaults.
 * All fields are optional; compile.ts fills in defaults.
 */
export interface DiagramExitDSL {
  readonly to?: readonly [number, number, number];
  readonly fade?: boolean;
  readonly scaleTo?: number;
  readonly easing?: DiagramEasing;
}

/** Raw DSL props from <Enter> before compile.ts applies defaults. */
export interface DiagramEnterDSL {
  readonly from?: readonly [number, number, number];
  readonly fade?: boolean;
  readonly scaleFrom?: number;
  readonly easing?: DiagramEasing;
}
```

### 3.2 DiagramState — remove cameraTarget/cameraDistance, add transform fields

Remove these two fields from `DiagramState`:
```typescript
// REMOVE:
readonly cameraTarget: readonly [number, number, number];
readonly cameraDistance: number;
```

Add these fields to `DiagramState` (after the `groups` field):
```typescript
/**
 * World/parent-space position of the diagram group origin.
 * In a DiagramCanvas, parent space = canvas-local space.
 * Defaults to [0, 0, 0].
 */
readonly position: readonly [number, number, number];

/**
 * World/parent-space Euler XYZ rotation of the diagram group in radians.
 * Defaults to [0, 0, 0].
 */
readonly rotation: readonly [number, number, number];

/**
 * Uniform scale applied to the entire diagram group.
 * All node sizes, edge thicknesses, and depths scale proportionally.
 * Use this to convert Lucid pixel coordinates to world units
 * (e.g., scale={0.01} for a 1000px Lucid diagram → 10 world units wide).
 * Defaults to 1.
 */
readonly scale: number;

/**
 * Which point of the node layout bounding box maps to local [0,0,0].
 * Pivot offset is applied at compile time — all node/edge/group positions in the
 * compiled state are already offset so the chosen pivot is at [0,0,0].
 * Defaults to 'center'.
 */
readonly pivot: DiagramPivot;

/**
 * Compiled exit behaviour. null = default fade (no position/scale animation).
 * Applied by exitFn in functionalDiagramTransitionSpec.
 */
readonly exit: DiagramExitConfig | null;

/**
 * Compiled enter behaviour. null = default fade.
 * Applied by enterFn in functionalDiagramTransitionSpec.
 */
readonly enter: DiagramEnterConfig | null;
```

Update JSDoc on `DiagramState.bounds`:
```typescript
/**
 * Bounding box of the diagram layout in DIAGRAM-LOCAL coordinates
 * (after pivot offset is applied). Used by DiagramWidget.onTick() for
 * camera auto-framing and by DiagramCanvasRenderer for canvas-level bounds.
 */
```

### 3.3 DiagramDSL — add new fields

Add to `DiagramDSL` (after the existing `layout` / `layoutSpacing` fields):
```typescript
/**
 * World/parent-space position of the diagram group origin. Default: [0, 0, 0].
 * In a DiagramCanvas, this is canvas-local space.
 */
readonly position?: readonly [number, number, number];

/** World/parent-space Euler XYZ rotation in radians. Default: [0, 0, 0]. */
readonly rotation?: readonly [number, number, number];

/**
 * Uniform scale factor. Default: 1.
 * Lucid authors: set scale to (desired world units / Lucid diagram pixel width).
 */
readonly scale?: number;

/**
 * Pivot point. Default: 'center'.
 * 'top-left' is convenient for Lucid imports (no coordinate offsetting needed).
 */
readonly pivot?: DiagramPivot;

/** Raw exit config from <Exit> child. Absent = default fade. */
readonly exit?: DiagramExitDSL;

/** Raw enter config from <Enter> child. Absent = default fade. */
readonly enter?: DiagramEnterDSL;
```

### 3.4 DiagramNodeDSL — update JSDoc on position

Update the `position` field comment only (type is unchanged):
```typescript
/**
 * Diagram-LOCAL position [x, y, z] of the node center.
 * z=0 puts the node on the diagram's base plane; non-zero z creates depth layering.
 * Lucid imports: x/y are Lucid pixel coordinates (origin per the diagram's pivot setting).
 * If omitted, auto-layout assigns a position based on declaration order.
 */
readonly position?: readonly [number, number, number];
```

---

## 4. DSL Changes — `src/elements/diagram/dsl.tsx`

### 4.1 Update DiagramProps

Add to `DiagramProps`:
```typescript
/** World/parent-space position. Default: [0, 0, 0] */
position?: [number, number, number];
/** World/parent-space Euler XYZ rotation in radians. Default: [0, 0, 0] */
rotation?: [number, number, number];
/** Uniform scale. Default: 1 */
scale?: number;
/** Pivot point. Default: 'center' */
pivot?: DiagramPivot;
```

Import `DiagramPivot` and `DiagramEasing` from `./types`.

### 4.2 Add Exit and Enter components

Add after the `<DiagramGroup>` section:

```typescript
// ─── <Exit> ───────────────────────────────────────────────────────────────────

export interface ExitProps {
  /**
   * Target position in parent space (canvas-local or world) at the end of the exit.
   * If absent, the diagram does not translate during exit (scale/fade only).
   */
  to?: [number, number, number];
  /**
   * If true (default), fade all node and edge opacities to 0 during exit.
   * Set false to disable the fade (translate/scale only).
   */
  fade?: boolean;
  /**
   * Target scale factor at the end of the exit. e.g., scaleTo={0} shrinks to a point.
   * If absent, scale is not animated.
   */
  scaleTo?: number;
  /**
   * Easing function. Default: 'ease' (smooth ease-in-out).
   * 'spring' produces a slight overshoot feel.
   */
  easing?: DiagramEasing;
}

/**
 * Declares exit animation for the parent <Diagram>.
 * Must be a direct child of <Diagram>. At most one <Exit> per diagram.
 * Example: <Exit to={[0, -50, 0]} fade easing="ease-out" />
 */
export function Exit(_props: ExitProps): null {
  return null;
}

// ─── <Enter> ──────────────────────────────────────────────────────────────────

export interface EnterProps {
  /**
   * Source position in parent space at the start of the enter transition.
   * If absent, the diagram enters from its declared position (scale/fade only).
   */
  from?: [number, number, number];
  /**
   * If true (default), fade all node and edge opacities from 0 during enter.
   */
  fade?: boolean;
  /**
   * Source scale factor at the start of the enter. e.g., scaleFrom={0} grows from a point.
   */
  scaleFrom?: number;
  /** Easing function. Default: 'ease'. */
  easing?: DiagramEasing;
}

/**
 * Declares enter animation for the parent <Diagram>.
 * Must be a direct child of <Diagram>. At most one <Enter> per diagram.
 * Example: <Enter from={[-50, 0, 0]} fade easing="spring" />
 */
export function Enter(_props: EnterProps): null {
  return null;
}
```

---

## 5. Compile Changes — `src/elements/diagram/compile.ts`

### 5.1 New helper: `applyEasing`

Add as a module-level pure function (no exports — internal only):

```typescript
/**
 * Maps a linear t ∈ [0,1] through the given easing curve.
 * Used by exitFn / enterFn to apply per-diagram transition curves.
 */
function applyEasing(t: number, easing: DiagramEasing): number {
  switch (easing) {
    case 'linear':   return t;
    case 'ease':     return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    case 'ease-in':  return t * t;
    case 'ease-out': return t * (2 - t);
    case 'spring': {
      // Damped spring: overshoots then settles. k=10, omega=20.
      const s = 1 - Math.pow(2, -10 * t) * Math.cos(20 * t * (Math.PI / 3));
      return Math.max(0, Math.min(1, s));
    }
    default: return t;
  }
}
```

### 5.2 New helper: `compilePivotOffset`

```typescript
/**
 * Computes the translation to apply to ALL node positions so that the declared
 * pivot point of the diagram maps to local [0, 0, 0].
 * bounds is the raw bounding box BEFORE the offset is applied.
 *
 * In Three.js / BrewSite diagram space, Y increases upward:
 *   bounds.y        = bottom edge (most negative Y)
 *   bounds.y + h    = top edge (most positive Y)
 *   bounds.x        = left edge
 *   bounds.x + w    = right edge
 */
function compilePivotOffset(
  bounds: { x: number; y: number; w: number; h: number },
  pivot: DiagramPivot,
): readonly [number, number, number] {
  switch (pivot) {
    case 'center':       return [-(bounds.x + bounds.w / 2), -(bounds.y + bounds.h / 2), 0];
    case 'top-left':     return [-bounds.x,             -(bounds.y + bounds.h), 0];
    case 'top-right':    return [-(bounds.x + bounds.w), -(bounds.y + bounds.h), 0];
    case 'bottom-left':  return [-bounds.x,              -bounds.y,             0];
    case 'bottom-right': return [-(bounds.x + bounds.w), -bounds.y,             0];
    default:             return [0, 0, 0];
  }
}
```

### 5.3 New helpers: `compileExitConfig` / `compileEnterConfig`

```typescript
function compileExitConfig(dsl: DiagramExitDSL | undefined): DiagramExitConfig | null {
  if (!dsl) return null;
  return {
    to: dsl.to,
    fade: dsl.fade ?? true,
    scaleTo: dsl.scaleTo,
    easing: dsl.easing ?? 'ease',
  };
}

function compileEnterConfig(dsl: DiagramEnterDSL | undefined): DiagramEnterConfig | null {
  if (!dsl) return null;
  return {
    from: dsl.from,
    fade: dsl.fade ?? true,
    scaleFrom: dsl.scaleFrom,
    easing: dsl.easing ?? 'ease',
  };
}
```

### 5.4 Update `compileDiagram`

Replace the current last section (camera hint computation) with this:

```typescript
export function compileDiagram(dsl: DiagramDSL): DiagramState {
  // ... existing: layout, sizes, sizeWithDepthMap ...

  const positions = resolveLayout(dsl.nodes, dsl.edges, layout, layoutSpacing);

  // Build size maps (unchanged)
  const sizeMap = new Map<string, readonly [number, number]>();
  const sizeWithDepthMap = new Map<string, readonly [number, number, number]>();
  dsl.nodes.forEach((node) => {
    const size = node.size ?? NODE_DEFAULTS.size;
    const depth = node.depth ?? NODE_DEFAULTS.depth;
    sizeMap.set(node.id, size);
    sizeWithDepthMap.set(node.id, [size[0], size[1], depth]);
  });

  // ── NEW: Pivot offset ───────────────────────────────────────────────────
  // Compute raw bounds from the layout-assigned positions, then derive the
  // pivot offset and apply it to every position in the map.
  const pivot: DiagramPivot = dsl.pivot ?? 'center';
  const rawBounds = computeBounds(
    dsl.nodes.map((n) => n.id),
    positions,
    sizeMap,
  );
  const [ox, oy, oz] = compilePivotOffset(rawBounds, pivot);
  if (ox !== 0 || oy !== 0 || oz !== 0) {
    for (const [id, pos] of positions) {
      positions.set(id, [pos[0] + ox, pos[1] + oy, pos[2] + oz]);
    }
  }
  // ── END pivot offset ────────────────────────────────────────────────────

  const controlPointsMap = routeEdges(dsl.edges, positions, sizeWithDepthMap);

  const nodes = dsl.nodes
    .map((node) => {
      const position = positions.get(node.id) ?? [0, 0, 0];
      const groupId = node.groupId ?? groupMap.get(node.id);
      return compileNode(node, position, groupId);
    })
    .sort((a, b) => a.position[2] - b.position[2]);

  const edges = dsl.edges.map((edge, index) => {
    const id = edgeIdFor(edge, index);
    const controlPoints = controlPointsMap.get(id) ?? [];
    return compileEdge(edge, controlPoints, index);
  });

  const groups = dsl.groups.map((group) => compileGroup(group, positions, sizeMap));

  // Final bounds (after pivot offset applied)
  const bounds = computeBounds(
    dsl.nodes.map((node) => node.id),
    positions,
    sizeMap,
  );

  // ── REMOVED: cameraTarget / cameraDistance ──────────────────────────────
  // Camera framing is now computed at runtime in DiagramWidget.onTick()
  // from state.bounds + state.position + state.scale. Pre-baking camera
  // hints here was fragile once the diagram gained a world transform.

  return {
    id: dsl.id,
    nodes,
    edges,
    groups,
    bounds,
    // New transform fields
    position: dsl.position ?? [0, 0, 0],
    rotation: dsl.rotation ?? [0, 0, 0],
    scale: dsl.scale ?? 1,
    pivot,
    exit: compileExitConfig(dsl.exit),
    enter: compileEnterConfig(dsl.enter),
  };
}
```

### 5.5 Update `functionalDiagramTransitionSpec`

Replace the entire `functionalDiagramTransitionSpec` with:

```typescript
// ─── Easing helpers (local) ───────────────────────────────────────────────

const lerpNum = (a: number, b: number, t: number): number => a + (b - a) * t;

const lerpVec3 = (
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): readonly [number, number, number] => [
  lerpNum(a[0], b[0], t),
  lerpNum(a[1], b[1], t),
  lerpNum(a[2], b[2], t),
];

// ─── Node / edge opacity helpers ─────────────────────────────────────────

const fadeNodesOut = (
  nodes: ReadonlyArray<DiagramNodeState>,
  t: number,
): ReadonlyArray<DiagramNodeState> =>
  nodes.map((n) => ({ ...n, opacity: blendOpacity(n.opacity, 0, t) ?? 0 }));

const fadeNodesIn = (
  nodes: ReadonlyArray<DiagramNodeState>,
  t: number,
): ReadonlyArray<DiagramNodeState> =>
  nodes.map((n) => ({ ...n, opacity: blendOpacity(0, n.opacity, t) ?? n.opacity }));

const fadeEdgesOut = (
  edges: ReadonlyArray<DiagramEdgeState>,
  t: number,
): ReadonlyArray<DiagramEdgeState> =>
  edges.map((e) => ({ ...e, opacity: blendOpacity(e.opacity, 0, t) ?? 0 }));

const fadeEdgesIn = (
  edges: ReadonlyArray<DiagramEdgeState>,
  t: number,
): ReadonlyArray<DiagramEdgeState> =>
  edges.map((e) => ({ ...e, opacity: blendOpacity(0, e.opacity, t) ?? e.opacity }));

// ─── Exit / enter application ─────────────────────────────────────────────

/**
 * Applies the diagram's exit config to produce the state at exit progress t.
 * t=0: diagram at declared state; t=1: diagram at exit target (hidden/moved).
 */
export function applyDiagramExit(diagram: DiagramState, t: number): DiagramState {
  const config = diagram.exit;
  if (!config) {
    // Default: fade out only
    return {
      ...diagram,
      nodes: fadeNodesOut(diagram.nodes, t),
      edges: fadeEdgesOut(diagram.edges, t),
    };
  }
  const et = applyEasing(t, config.easing);
  let position = diagram.position;
  if (config.to) {
    position = lerpVec3(diagram.position, config.to, et);
  }
  let scale = diagram.scale;
  if (config.scaleTo !== undefined) {
    scale = lerpNum(diagram.scale, config.scaleTo, et);
  }
  const nodes = config.fade ? fadeNodesOut(diagram.nodes, et) : diagram.nodes;
  const edges = config.fade ? fadeEdgesOut(diagram.edges, et) : diagram.edges;
  return { ...diagram, position, scale, nodes, edges };
}

/**
 * Applies the diagram's enter config to produce the state at enter progress t.
 * t=0: diagram at enter source (hidden/offscreen); t=1: diagram at declared state.
 */
export function applyDiagramEnter(diagram: DiagramState, t: number): DiagramState {
  const config = diagram.enter;
  if (!config) {
    return {
      ...diagram,
      nodes: fadeNodesIn(diagram.nodes, t),
      edges: fadeEdgesIn(diagram.edges, t),
    };
  }
  const et = applyEasing(t, config.easing);
  let position = diagram.position;
  if (config.from) {
    position = lerpVec3(config.from, diagram.position, et);
  }
  let scale = diagram.scale;
  if (config.scaleFrom !== undefined) {
    scale = lerpNum(config.scaleFrom, diagram.scale, et);
  }
  const nodes = config.fade ? fadeNodesIn(diagram.nodes, et) : diagram.nodes;
  const edges = config.fade ? fadeEdgesIn(diagram.edges, et) : diagram.edges;
  return { ...diagram, position, scale, nodes, edges };
}

// ─── Functional Transition Spec ───────────────────────────────────────────

export const functionalDiagramTransitionSpec: FunctionalTransitionSpec<DiagramState> = {
  exitFn: (from) => (t) => applyDiagramExit(from, t),

  enterFn: (to) => (t) => applyDiagramEnter(to, t),

  interpolateFn: (from, to) => (t) => {
    const fromNodeMap = new Map(from.nodes.map((n) => [n.id, n]));
    const fromEdgeMap = new Map(from.edges.map((e) => [e.id, e]));
    const toNodeIds = new Set(to.nodes.map((n) => n.id));
    const toEdgeIds = new Set(to.edges.map((e) => e.id));

    const blendedNodes = to.nodes.map((toNode) => {
      const fromNode = fromNodeMap.get(toNode.id);
      if (!fromNode) {
        return { ...toNode, opacity: blendOpacity(0, toNode.opacity, t) ?? toNode.opacity };
      }
      return {
        ...toNode,
        position: blendVec3(toMutableVec3(fromNode.position), toMutableVec3(toNode.position), t)
          ?? toNode.position,
        opacity: blendOpacity(fromNode.opacity, toNode.opacity, t) ?? toNode.opacity,
      };
    });

    const fadingNodes = from.nodes
      .filter((n) => !toNodeIds.has(n.id))
      .map((n) => ({ ...n, opacity: blendOpacity(n.opacity, 0, t) ?? 0 }));

    const blendedEdges = to.edges.map((toEdge) => {
      const fromEdge = fromEdgeMap.get(toEdge.id);
      if (!fromEdge) {
        return { ...toEdge, opacity: blendOpacity(0, toEdge.opacity, t) ?? toEdge.opacity };
      }
      return {
        ...toEdge,
        opacity: blendOpacity(fromEdge.opacity, toEdge.opacity, t) ?? toEdge.opacity,
        controlPoints: toEdge.controlPoints.map((point, i) => {
          const fromPoint = fromEdge.controlPoints[i] ?? point;
          return blendVec3(toMutableVec3(fromPoint), toMutableVec3(point), t) ?? point;
        }),
      };
    });

    const fadingEdges = from.edges
      .filter((e) => !toEdgeIds.has(e.id))
      .map((e) => ({ ...e, opacity: blendOpacity(e.opacity, 0, t) ?? 0 }));

    return {
      ...to,
      // Interpolate diagram-level transform
      position: blendVec3(toMutableVec3(from.position), toMutableVec3(to.position), t)
        ?? to.position,
      rotation: blendVec3(toMutableVec3(from.rotation), toMutableVec3(to.rotation), t)
        ?? to.rotation,
      scale: blendNumber(from.scale, to.scale, t) ?? to.scale,
      nodes: [...blendedNodes, ...fadingNodes],
      edges: [...blendedEdges, ...fadingEdges],
    };
  },
};
```

---

## 6. Render Changes — `src/elements/diagram/render.ts`

### 6.1 Change parent parameter type

Change `update()` and `dispose()` signatures from `THREE.Scene` to `THREE.Object3D`.
This allows `DiagramCanvasRenderer` to pass the canvas group as the parent without
a type assertion:

```typescript
// BEFORE:
update(state: DiagramState, scene: THREE.Scene): void
dispose(diagramId: string, scene: THREE.Scene): void

// AFTER:
update(state: DiagramState, parent: THREE.Object3D): void
dispose(diagramId: string, parent: THREE.Object3D): void
```

All internal calls to `scene.add(root)` and `scene.remove(group)` become `parent.add(root)`
and `parent.remove(group)`. The method body is otherwise unchanged. Since `THREE.Scene`
extends `THREE.Object3D`, existing callers (`DiagramWidget.apply()`) pass their scene without
any change.

### 6.2 Apply diagram transform in `update()`

After creating or retrieving the root group, add three lines that apply the diagram's
world/parent-space transform:

```typescript
update(state: DiagramState, parent: THREE.Object3D): void {
  const prev = this.lastState.get(state.id);
  if (!this.diagramGroups.has(state.id)) {
    const root = new THREE.Group();
    root.name = `diagram:${state.id}`;
    this.diagramGroups.set(state.id, root);
    parent.add(root);
  }
  const root = this.diagramGroups.get(state.id)!;

  // ── NEW: Apply diagram world/parent-space transform ────────────────────
  root.position.set(state.position[0], state.position[1], state.position[2]);
  root.rotation.set(state.rotation[0], state.rotation[1], state.rotation[2]);
  root.scale.setScalar(state.scale);
  // ── END new ────────────────────────────────────────────────────────────

  // ... rest of the method unchanged ...
```

No other changes to `render.ts`.

---

## 7. Widget Changes — `src/elements/diagram/widget.ts`

### 7.1 Update `onTick()` camera framing

Replace the block that reads `diagramState.cameraTarget` and `diagramState.cameraDistance`
with runtime computation from bounds + position + scale:

```typescript
onTick(context: AnimationTickContext): void {
  const tick = context.tick;
  const rawDiagramState = tick?.state.widgets[this.widgetId];
  const diagramState = (rawDiagramState as DiagramState | undefined) ?? this.lastState;
  if (!diagramState) return;

  // Yield to Camera widget when explicitly enabled.
  const rawCamState = tick?.state.widgets['camera'];
  const cameraActive =
    typeof rawCamState === 'object' &&
    rawCamState !== null &&
    'enabled' in rawCamState &&
    (rawCamState as { enabled: boolean }).enabled === true;
  if (cameraActive) return;

  const cam = context.scene.userData[CAMERA_KEY] as THREE.PerspectiveCamera | undefined;
  if (!cam) return;

  // ── NEW: derive camera framing from bounds + diagram world transform ───
  const { bounds, position, scale } = diagramState;
  // World-space center = diagram-local bounds center × scale + diagram position
  const worldCX = (bounds.x + bounds.w / 2) * scale + position[0];
  const worldCY = (bounds.y + bounds.h / 2) * scale + position[1];
  const worldCZ = position[2];
  // Camera distance: use larger of width or height (both in world units)
  const worldMaxDim = Math.max(bounds.w, bounds.h) * scale;
  const fov45 = 45 * (Math.PI / 180);
  const dist = (worldMaxDim / (2 * Math.tan(fov45 / 2))) * 1.2;
  // 30% elevation, 100% back along Z
  cam.position.set(worldCX, worldCY + dist * 0.3, worldCZ + dist);
  cam.lookAt(worldCX, worldCY, worldCZ);
  // ── END new ────────────────────────────────────────────────────────────
}
```

No other changes to `widget.ts`. The `mergeSnapshot`, `apply`, `dispose`, `initialize`,
`onInteraction`, and `handleClick` implementations are unchanged.

---

## 8. New Canvas Module

### 8.1 `src/elements/diagram/canvas/types.ts`

```typescript
// Contract layer for DiagramCanvas and DiagramPipe.
// No runtime imports, no Three.js, no React.

import type { DiagramState, DiagramEdgeStyle, DiagramArrowVariant } from '../types';

/**
 * Compiled state of a single cross-diagram pipe (tube connector).
 * Control points are in canvas-local space.
 * Produced by compilePipe() from DiagramPipeDSL.
 */
export interface DiagramPipeState {
  readonly id: string;
  /** ID of the diagram containing the source node */
  readonly fromDiagramId: string;
  /** ID of the source node within fromDiagramId */
  readonly fromNodeId: string;
  /** ID of the diagram containing the destination node */
  readonly toDiagramId: string;
  /** ID of the destination node within toDiagramId */
  readonly toNodeId: string;
  readonly label: string | undefined;
  readonly style: DiagramEdgeStyle;
  readonly arrowStart: DiagramArrowVariant;
  readonly arrowEnd: DiagramArrowVariant;
  readonly color: string;
  readonly thickness: number;
  readonly opacity: number;
  /**
   * CatmullRom control points in canvas-local space.
   * Computed at compile time from the endpoint node positions and diagram transforms.
   */
  readonly controlPoints: ReadonlyArray<readonly [number, number, number]>;
}

/**
 * Fully compiled state of a DiagramCanvas.
 * Owns all child diagram states and cross-diagram pipes.
 * Consumed by DiagramCanvasWidget and DiagramCanvasRenderer.
 */
export interface DiagramCanvasState {
  readonly id: string;
  /** Canvas world-space position. Default: [0, 0, 0] */
  readonly position: readonly [number, number, number];
  /** Canvas world-space Euler XYZ rotation in radians. Default: [0, 0, 0] */
  readonly rotation: readonly [number, number, number];
  /** Canvas uniform scale. Default: 1 */
  readonly scale: number;
  /** All child diagram states, in declaration order. */
  readonly diagrams: ReadonlyArray<DiagramState>;
  /** All cross-diagram pipe states. */
  readonly pipes: ReadonlyArray<DiagramPipeState>;
}

/** Raw DSL props from <DiagramPipe> before compile.ts applies defaults. */
export interface DiagramPipeDSL {
  /**
   * Auto-generated from "fromDiagramId-fromNodeId--toDiagramId-toNodeId" if omitted.
   */
  readonly id?: string;
  /**
   * Dot-notation reference to the source node: "diagramId.nodeId"
   * The diagramId must match a <Diagram id="..."> inside the same <DiagramCanvas>.
   */
  readonly from: string;
  /** Dot-notation reference to the destination node: "diagramId.nodeId" */
  readonly to: string;
  readonly label?: string;
  readonly style?: DiagramEdgeStyle;
  readonly arrowStart?: DiagramArrowVariant;
  readonly arrowEnd?: DiagramArrowVariant;
  readonly color?: string;
  readonly thickness?: number;
  readonly opacity?: number;
}

/** Raw DSL props from <DiagramCanvas> before compile.ts applies defaults. */
export interface DiagramCanvasDSL {
  readonly id: string;
  readonly position?: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
  readonly scale?: number;
}
```

### 8.2 `src/elements/diagram/canvas/dsl.tsx`

```typescript
// Declarative DSL surface for DiagramCanvas and DiagramPipe. No Three.js.

import React from 'react';
import type { DiagramEdgeStyle, DiagramArrowVariant } from '../types';

export interface DiagramCanvasProps {
  /**
   * Unique ID for this canvas. The DiagramCanvasWidget must be registered
   * with this exact id in widgetSetup.ts.
   */
  id: string;
  /** World-space position of the canvas group origin. Default: [0, 0, 0] */
  position?: [number, number, number];
  /** World-space Euler XYZ rotation in radians. Default: [0, 0, 0] */
  rotation?: [number, number, number];
  /**
   * Uniform scale for the entire canvas group.
   * All child diagram positions, scales, and pipe thicknesses scale with this.
   * Default: 1
   */
  scale?: number;
  children?: React.ReactNode;
}

/**
 * Root container for a multi-diagram composition.
 * Provides a shared world-space transform and enables cross-diagram pipes.
 * Child <Diagram> elements use canvas-local coordinates.
 * Child <DiagramPipe> elements connect nodes across child diagrams.
 *
 * Compilation: two-pass (diagrams first, then pipes).
 * Rendering: single DiagramCanvasWidget owns all child diagrams and pipes.
 *
 * Example:
 *   <DiagramCanvas id="system" scale={0.01}>
 *     <Diagram id="frontend" position={[-600, 0, 0]}>...</Diagram>
 *     <Diagram id="backend" position={[600, 0, 0]}>...</Diagram>
 *     <DiagramPipe from="frontend.api" to="backend.gateway" />
 *   </DiagramCanvas>
 */
export function DiagramCanvas(_props: DiagramCanvasProps): null {
  return null;
}

export interface DiagramPipeProps {
  /**
   * Auto-generated id if omitted: "from--to" (dots replaced by dashes).
   */
  id?: string;
  /**
   * Source node in dot notation: "diagramId.nodeId"
   * The diagramId must match a <Diagram id="..."> sibling inside this canvas.
   */
  from: string;
  /**
   * Destination node in dot notation: "diagramId.nodeId"
   */
  to: string;
  /** Optional label at the pipe midpoint. */
  label?: string;
  /** Line visual style. Default: 'solid' */
  style?: DiagramEdgeStyle;
  /** Arrowhead at source. Default: 'none' */
  arrowStart?: DiagramArrowVariant;
  /** Arrowhead at destination. Default: 'open' */
  arrowEnd?: DiagramArrowVariant;
  /** Pipe color (CSS hex). Default: '#667788' */
  color?: string;
  /** Tube radius in canvas units. Default: 0.08 */
  thickness?: number;
  /** Opacity [0–1]. Default: 1 */
  opacity?: number;
}

/**
 * Declares a tube connector between nodes in two different <Diagram> elements
 * inside the same <DiagramCanvas>.
 * Must be a direct child of <DiagramCanvas>.
 *
 * Routing: CatmullRom arc in canvas-local space, computed at compile time.
 * The pipe is rendered by DiagramCanvasWidget alongside the diagram tubes.
 */
export function DiagramPipe(_props: DiagramPipeProps): null {
  return null;
}
```

### 8.3 `src/elements/diagram/canvas/compile.ts`

```typescript
// Pure compilation pipeline for DiagramCanvas.
// No Three.js. No React. No side effects.

import type { DiagramState, DiagramEdgeStyle, DiagramArrowVariant } from '../types';
import type {
  DiagramCanvasDSL,
  DiagramCanvasState,
  DiagramPipeDSL,
  DiagramPipeState,
} from './types';
import type { FunctionalTransitionSpec } from '@brewsite/core';
import { blendNumber, blendOpacity, blendVec3 } from '@brewsite/core';
import { applyDiagramEnter, applyDiagramExit } from '../compile';

// ─── Defaults ────────────────────────────────────────────────────────────────

const PIPE_DEFAULTS = {
  style: 'solid' as DiagramEdgeStyle,
  arrowStart: 'none' as DiagramArrowVariant,
  arrowEnd: 'open' as DiagramArrowVariant,
  color: '#667788',
  thickness: 0.08,
  opacity: 1,
};

// ─── Pipe routing ─────────────────────────────────────────────────────────────

type Vec3 = readonly [number, number, number];

/**
 * Transforms a node's diagram-local position to canvas-local space.
 * Applies diagram position offset and uniform scale.
 * Note: this approximation ignores diagram rotation (adequate for v1 where
 * diagrams are typically axis-aligned within the canvas).
 */
function nodeToCanvasSpace(
  nodeLocalPos: Vec3,
  diagramPos: Vec3,
  diagramScale: number,
): Vec3 {
  return [
    nodeLocalPos[0] * diagramScale + diagramPos[0],
    nodeLocalPos[1] * diagramScale + diagramPos[1],
    nodeLocalPos[2] * diagramScale + diagramPos[2],
  ];
}

/**
 * Routes a cross-diagram pipe between two canvas-local endpoints.
 * Uses a simple arc (elevated at the midpoint) to prevent pipes from cutting
 * through diagram geometry.
 */
function routePipe(from: Vec3, to: Vec3): ReadonlyArray<Vec3> {
  const dist = Math.sqrt(
    (to[0] - from[0]) ** 2 +
    (to[1] - from[1]) ** 2 +
    (to[2] - from[2]) ** 2,
  );
  // Arc height: 15% of the 3D distance, minimum 0.5 canvas units
  const arcH = Math.max(0.5, dist * 0.15);
  const midX = (from[0] + to[0]) / 2;
  const midY = (from[1] + to[1]) / 2 + arcH;
  const midZ = (from[2] + to[2]) / 2;
  const ctrl1: Vec3 = [
    from[0] + (midX - from[0]) * 0.5,
    from[1] + (midY - from[1]) * 0.5,
    from[2] + (midZ - from[2]) * 0.5,
  ];
  const ctrl2: Vec3 = [
    midX + (to[0] - midX) * 0.5,
    midY + (to[1] - midY) * 0.5,
    midZ + (to[2] - midZ) * 0.5,
  ];
  return [from, ctrl1, ctrl2, to];
}

/**
 * Parses a dot-notation reference "diagramId.nodeId" into its components.
 * Returns null if the format is invalid.
 */
function parsePipeRef(ref: string): { diagramId: string; nodeId: string } | null {
  const dot = ref.indexOf('.');
  if (dot <= 0 || dot === ref.length - 1) return null;
  return { diagramId: ref.slice(0, dot), nodeId: ref.slice(dot + 1) };
}

// ─── compilePipe ─────────────────────────────────────────────────────────────

/**
 * Compiles a single DiagramPipeDSL into a DiagramPipeState.
 * Resolves the from/to node positions from the compiled diagram states and
 * routes the pipe in canvas-local space.
 *
 * Emits console.warn for unresolvable references and returns a pipe with
 * empty controlPoints (rendered as invisible) rather than throwing.
 */
export function compilePipe(
  dsl: DiagramPipeDSL,
  diagrams: ReadonlyArray<DiagramState>,
  index: number,
): DiagramPipeState {
  const autoId = `pipe-${dsl.from.replace('.', '-')}--${dsl.to.replace('.', '-')}-${index}`;
  const id = dsl.id ?? autoId;

  const fromRef = parsePipeRef(dsl.from);
  const toRef = parsePipeRef(dsl.to);

  let controlPoints: ReadonlyArray<Vec3> = [];

  if (!fromRef || !toRef) {
    console.warn(
      `DiagramCanvas compilePipe: invalid dot-notation reference in pipe "${id}". ` +
        'Expected "diagramId.nodeId" format.',
    );
  } else {
    const fromDiagram = diagrams.find((d) => d.id === fromRef.diagramId);
    const toDiagram = diagrams.find((d) => d.id === toRef.diagramId);
    const fromNode = fromDiagram?.nodes.find((n) => n.id === fromRef.nodeId);
    const toNode = toDiagram?.nodes.find((n) => n.id === toRef.nodeId);

    if (!fromDiagram || !fromNode) {
      console.warn(
        `DiagramCanvas compilePipe: cannot resolve from="${dsl.from}" in pipe "${id}".`,
      );
    } else if (!toDiagram || !toNode) {
      console.warn(
        `DiagramCanvas compilePipe: cannot resolve to="${dsl.to}" in pipe "${id}".`,
      );
    } else {
      const fromWorld = nodeToCanvasSpace(
        fromNode.position,
        fromDiagram.position,
        fromDiagram.scale,
      );
      const toWorld = nodeToCanvasSpace(
        toNode.position,
        toDiagram.position,
        toDiagram.scale,
      );
      controlPoints = routePipe(fromWorld, toWorld);
    }
  }

  return {
    id,
    fromDiagramId: fromRef?.diagramId ?? '',
    fromNodeId: fromRef?.nodeId ?? '',
    toDiagramId: toRef?.diagramId ?? '',
    toNodeId: toRef?.nodeId ?? '',
    label: dsl.label,
    style: dsl.style ?? PIPE_DEFAULTS.style,
    arrowStart: dsl.arrowStart ?? PIPE_DEFAULTS.arrowStart,
    arrowEnd: dsl.arrowEnd ?? PIPE_DEFAULTS.arrowEnd,
    color: dsl.color ?? PIPE_DEFAULTS.color,
    thickness: dsl.thickness ?? PIPE_DEFAULTS.thickness,
    opacity: dsl.opacity ?? PIPE_DEFAULTS.opacity,
    controlPoints,
  };
}

// ─── compileCanvas ───────────────────────────────────────────────────────────

/**
 * Two-pass compilation for DiagramCanvas.
 * Pass 1: diagrams are already compiled (caller provides compiled DiagramState[]).
 * Pass 2: compile DiagramPipe elements using node positions from pass 1.
 *
 * This function is called by the DiagramCanvas compiler handler in handlers.ts
 * after it has compiled all child Diagram elements via compileDiagram().
 */
export function compileCanvas(
  dsl: DiagramCanvasDSL,
  diagrams: ReadonlyArray<DiagramState>,
  pipes: ReadonlyArray<DiagramPipeDSL>,
): DiagramCanvasState {
  const compiledPipes = pipes.map((pipe, index) => compilePipe(pipe, diagrams, index));

  return {
    id: dsl.id,
    position: dsl.position ?? [0, 0, 0],
    rotation: dsl.rotation ?? [0, 0, 0],
    scale: dsl.scale ?? 1,
    diagrams,
    pipes: compiledPipes,
  };
}

// ─── Functional Transition Spec ───────────────────────────────────────────────

const toMut = (v: readonly [number, number, number]): [number, number, number] =>
  [v[0], v[1], v[2]];

export const functionalDiagramCanvasTransitionSpec: FunctionalTransitionSpec<DiagramCanvasState> = {
  exitFn: (from) => (t) => ({
    ...from,
    diagrams: from.diagrams.map((d) => applyDiagramExit(d, t)),
    pipes: from.pipes.map((p) => ({
      ...p,
      opacity: blendOpacity(p.opacity, 0, t) ?? 0,
    })),
  }),

  enterFn: (to) => (t) => ({
    ...to,
    diagrams: to.diagrams.map((d) => applyDiagramEnter(d, t)),
    pipes: to.pipes.map((p) => ({
      ...p,
      opacity: blendOpacity(0, p.opacity, t) ?? p.opacity,
    })),
  }),

  interpolateFn: (from, to) => (t) => {
    const fromDiagramMap = new Map(from.diagrams.map((d) => [d.id, d]));
    const fromPipeMap = new Map(from.pipes.map((p) => [p.id, p]));
    const toPipeIds = new Set(to.pipes.map((p) => p.id));

    const interpolatedDiagrams = to.diagrams.map((toDiagram) => {
      const fromDiagram = fromDiagramMap.get(toDiagram.id);
      if (!fromDiagram) {
        // New diagram: fade in
        return applyDiagramEnter(toDiagram, t);
      }
      // Interpolate diagram-level transform
      const fromNodeMap = new Map(fromDiagram.nodes.map((n) => [n.id, n]));
      const fromEdgeMap = new Map(fromDiagram.edges.map((e) => [e.id, e]));
      const toNodeIds = new Set(toDiagram.nodes.map((n) => n.id));
      const toEdgeIds = new Set(toDiagram.edges.map((e) => e.id));

      const blendedNodes = toDiagram.nodes.map((toNode) => {
        const fromNode = fromNodeMap.get(toNode.id);
        if (!fromNode) {
          return { ...toNode, opacity: blendOpacity(0, toNode.opacity, t) ?? toNode.opacity };
        }
        return {
          ...toNode,
          position: blendVec3(toMut(fromNode.position), toMut(toNode.position), t) ?? toNode.position,
          opacity: blendOpacity(fromNode.opacity, toNode.opacity, t) ?? toNode.opacity,
        };
      });
      const fadingNodes = fromDiagram.nodes
        .filter((n) => !toNodeIds.has(n.id))
        .map((n) => ({ ...n, opacity: blendOpacity(n.opacity, 0, t) ?? 0 }));

      const blendedEdges = toDiagram.edges.map((toEdge) => {
        const fromEdge = fromEdgeMap.get(toEdge.id);
        if (!fromEdge) {
          return { ...toEdge, opacity: blendOpacity(0, toEdge.opacity, t) ?? toEdge.opacity };
        }
        return {
          ...toEdge,
          opacity: blendOpacity(fromEdge.opacity, toEdge.opacity, t) ?? toEdge.opacity,
          controlPoints: toEdge.controlPoints.map((pt, i) => {
            const fp = fromEdge.controlPoints[i] ?? pt;
            return blendVec3(toMut(fp), toMut(pt), t) ?? pt;
          }),
        };
      });
      const fadingEdges = fromDiagram.edges
        .filter((e) => !toEdgeIds.has(e.id))
        .map((e) => ({ ...e, opacity: blendOpacity(e.opacity, 0, t) ?? 0 }));

      return {
        ...toDiagram,
        position: blendVec3(toMut(fromDiagram.position), toMut(toDiagram.position), t) ?? toDiagram.position,
        rotation: blendVec3(toMut(fromDiagram.rotation), toMut(toDiagram.rotation), t) ?? toDiagram.rotation,
        scale: blendNumber(fromDiagram.scale, toDiagram.scale, t) ?? toDiagram.scale,
        nodes: [...blendedNodes, ...fadingNodes],
        edges: [...blendedEdges, ...fadingEdges],
      };
    });

    // Diagrams in from but not in to: fade out
    const fadingDiagrams = from.diagrams
      .filter((d) => !to.diagrams.some((td) => td.id === d.id))
      .map((d) => applyDiagramExit(d, t));

    const blendedPipes = to.pipes.map((toPipe) => {
      const fromPipe = fromPipeMap.get(toPipe.id);
      if (!fromPipe) {
        return { ...toPipe, opacity: blendOpacity(0, toPipe.opacity, t) ?? toPipe.opacity };
      }
      return {
        ...toPipe,
        opacity: blendOpacity(fromPipe.opacity, toPipe.opacity, t) ?? toPipe.opacity,
        controlPoints: toPipe.controlPoints.map((pt, i) => {
          const fp = fromPipe.controlPoints[i] ?? pt;
          return blendVec3(toMut(fp), toMut(pt), t) ?? pt;
        }),
      };
    });
    const fadingPipes = from.pipes
      .filter((p) => !toPipeIds.has(p.id))
      .map((p) => ({ ...p, opacity: blendOpacity(p.opacity, 0, t) ?? 0 }));

    return {
      ...to,
      position: blendVec3(toMut(from.position), toMut(to.position), t) ?? to.position,
      rotation: blendVec3(toMut(from.rotation), toMut(to.rotation), t) ?? to.rotation,
      scale: blendNumber(from.scale, to.scale, t) ?? to.scale,
      diagrams: [...interpolatedDiagrams, ...fadingDiagrams],
      pipes: [...blendedPipes, ...fadingPipes],
    };
  },
};
```

### 8.4 `src/elements/diagram/canvas/render.ts`

```typescript
// Three.js rendering for DiagramCanvasState.
// WebGL only — no React.
// Owns child DiagramRenderer instances and pipe tube meshes.

import * as THREE from 'three';
import type { DiagramCanvasState, DiagramPipeState } from './types';
import { DiagramRenderer } from '../render';

// Pipe entry mirrors EdgeEntry from diagram/render.ts
type PipeEntry = {
  group: THREE.Group;
  tube: THREE.Mesh;
  arrowStart?: THREE.Mesh;
  arrowEnd?: THREE.Mesh;
  lastState?: DiagramPipeState;
};

export class DiagramCanvasRenderer {
  private canvasGroup: THREE.Group | null = null;
  private pipeRoot: THREE.Group | null = null;
  /** One DiagramRenderer per child diagram, keyed by diagram id. */
  private diagramRenderers = new Map<string, DiagramRenderer>();
  private pipeEntries = new Map<string, PipeEntry>();

  /**
   * Main update path. Creates the canvas root Group on first call,
   * applies the canvas world transform, then delegates each child diagram to
   * a dedicated DiagramRenderer that targets the canvas root as its parent.
   * Pipes are rendered as tube meshes in the canvas root group.
   */
  update(state: DiagramCanvasState, scene: THREE.Scene): void {
    if (!this.canvasGroup) {
      this.canvasGroup = new THREE.Group();
      this.canvasGroup.name = `canvas:${state.id}`;
      this.pipeRoot = new THREE.Group();
      this.pipeRoot.name = `canvas:${state.id}:pipes`;
      this.canvasGroup.add(this.pipeRoot);
      scene.add(this.canvasGroup);
    }

    // Apply canvas world transform
    this.canvasGroup.position.set(state.position[0], state.position[1], state.position[2]);
    this.canvasGroup.rotation.set(state.rotation[0], state.rotation[1], state.rotation[2]);
    this.canvasGroup.scale.setScalar(state.scale);

    // Remove renderers for diagrams no longer in state
    const activeDiagramIds = new Set(state.diagrams.map((d) => d.id));
    for (const [id, renderer] of this.diagramRenderers) {
      if (!activeDiagramIds.has(id)) {
        renderer.dispose(id, this.canvasGroup);
        this.diagramRenderers.delete(id);
      }
    }

    // Update each child diagram
    for (const diagramState of state.diagrams) {
      if (!this.diagramRenderers.has(diagramState.id)) {
        this.diagramRenderers.set(diagramState.id, new DiagramRenderer());
      }
      this.diagramRenderers.get(diagramState.id)!.update(diagramState, this.canvasGroup);
    }

    // Update pipes
    const activePipeIds = new Set(state.pipes.map((p) => p.id));
    for (const [id, entry] of this.pipeEntries) {
      if (!activePipeIds.has(id)) {
        this.pipeRoot!.remove(entry.group);
        this.disposePipe(entry);
        this.pipeEntries.delete(id);
      }
    }
    for (const pipeState of state.pipes) {
      const entry = this.pipeEntries.get(pipeState.id);
      const updated = entry ?? this.createPipe(pipeState);
      this.updatePipe(updated, pipeState);
      if (!entry) {
        this.pipeEntries.set(pipeState.id, updated);
        this.pipeRoot!.add(updated.group);
      }
    }
  }

  dispose(canvasId: string, scene: THREE.Scene): void {
    if (this.canvasGroup) {
      scene.remove(this.canvasGroup);
    }
    for (const [id, renderer] of this.diagramRenderers) {
      if (this.canvasGroup) renderer.dispose(id, this.canvasGroup);
    }
    this.diagramRenderers.clear();
    for (const entry of this.pipeEntries.values()) {
      this.disposePipe(entry);
    }
    this.pipeEntries.clear();
    this.canvasGroup = null;
    this.pipeRoot = null;
  }

  // ─── Pipe rendering (mirrors edge rendering in diagram/render.ts) ─────────

  private createPipe(state: DiagramPipeState): PipeEntry {
    const group = new THREE.Group();
    const points = state.controlPoints.length >= 2
      ? state.controlPoints.map((pt) => new THREE.Vector3(pt[0], pt[1], pt[2]))
      : [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)];
    const curve = new THREE.CatmullRomCurve3(points);
    const geometry = new THREE.TubeGeometry(
      curve,
      Math.max(20, state.controlPoints.length * 8),
      state.thickness,
      8,
      false,
    );
    const material = new THREE.MeshStandardMaterial({
      color: state.color,
      metalness: 0.3,
      roughness: 0.7,
      transparent: state.opacity < 1,
      opacity: state.opacity,
    });
    const tube = new THREE.Mesh(geometry, material);
    group.add(tube);
    return { group, tube, lastState: state };
  }

  private updatePipe(entry: PipeEntry, state: DiagramPipeState): void {
    if (state.controlPoints.length < 2) {
      entry.group.visible = false;
      entry.lastState = state;
      return;
    }
    entry.group.visible = true;

    const prev = entry.lastState;
    const needsGeometry =
      !prev ||
      state.controlPoints !== prev.controlPoints ||
      state.thickness !== prev.thickness;

    let curve: THREE.CatmullRomCurve3 | undefined;
    const getCurve = (): THREE.CatmullRomCurve3 => {
      if (!curve) {
        curve = new THREE.CatmullRomCurve3(
          state.controlPoints.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
        );
      }
      return curve;
    };

    if (needsGeometry) {
      const c = getCurve();
      const geometry = new THREE.TubeGeometry(
        c, Math.max(20, state.controlPoints.length * 8), state.thickness, 8, false,
      );
      entry.tube.geometry.dispose();
      entry.tube.geometry = geometry;
    }

    const matChanged =
      !prev ||
      prev.color !== state.color ||
      prev.opacity !== state.opacity ||
      prev.thickness !== state.thickness;
    if (matChanged) {
      const oldMat = entry.tube.material as THREE.Material;
      oldMat.dispose();
      entry.tube.material = new THREE.MeshStandardMaterial({
        color: state.color,
        metalness: 0.3,
        roughness: 0.7,
        transparent: state.opacity < 1,
        opacity: state.opacity,
      });
    }

    entry.lastState = state;
  }

  private disposePipe(entry: PipeEntry): void {
    entry.tube.geometry.dispose();
    (entry.tube.material as THREE.Material).dispose();
  }
}
```

### 8.5 `src/elements/diagram/canvas/widget.ts`

```typescript
// DiagramCanvasWidget — owns all rendering for a DiagramCanvas and its children.

import * as THREE from 'three';
import type {
  IAnimationController,
  IRenderable,
  ISceneElement,
  AnimationTickContext,
  WidgetInitContext,
  WidgetRenderContext,
} from '@brewsite/core';
import { DiagramCanvas } from './dsl';
import { functionalDiagramCanvasTransitionSpec } from './compile';
import { DiagramCanvasRenderer } from './render';
import type { DiagramCanvasState } from './types';
import {
  diagramInteractionRegistry,
  diagramInteractionLookup,
} from '../render';
import type { DiagramInteractionEvent, DiagramNodeState } from '../types';

const CAMERA_KEY = '__brewsite_camera';

export class DiagramCanvasWidget
  implements
    ISceneElement<DiagramCanvasState>,
    IRenderable<DiagramCanvasState>,
    IAnimationController
{
  readonly widgetId: string;
  readonly defaultState: DiagramCanvasState;
  readonly transitionSpec = functionalDiagramCanvasTransitionSpec;
  readonly DslComponent = DiagramCanvas;
  readonly tickPriority = 1;

  /**
   * Optional callback fired when a clickable node inside any child diagram
   * is clicked. Assign after construction.
   */
  public onInteraction: ((event: DiagramInteractionEvent) => void) | undefined;

  private renderer = new DiagramCanvasRenderer();
  private scene: THREE.Scene | null = null;
  private lastState: DiagramCanvasState | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();

  constructor(widgetId: string, defaultState: DiagramCanvasState) {
    this.widgetId = widgetId;
    this.defaultState = defaultState;
  }

  initialize({ scene, renderer }: WidgetInitContext): void {
    this.scene = scene as THREE.Scene;
    if (renderer?.domElement) {
      this.canvasElement = renderer.domElement;
      this.clickHandler = (e) => this.handleClick(e);
      this.canvasElement.addEventListener('click', this.clickHandler);
    }
  }

  /**
   * Camera auto-framing: computes world-space bounds over all child diagrams
   * and frames the camera to show everything. Yields to Camera widget if active.
   */
  onTick(context: AnimationTickContext): void {
    const tick = context.tick;
    const rawState = tick?.state.widgets[this.widgetId];
    const state = (rawState as DiagramCanvasState | undefined) ?? this.lastState;
    if (!state || state.diagrams.length === 0) return;

    const rawCamState = tick?.state.widgets['camera'];
    const cameraActive =
      typeof rawCamState === 'object' &&
      rawCamState !== null &&
      'enabled' in rawCamState &&
      (rawCamState as { enabled: boolean }).enabled === true;
    if (cameraActive) return;

    const cam = context.scene.userData[CAMERA_KEY] as THREE.PerspectiveCamera | undefined;
    if (!cam) return;

    // Compute world-space bounds over all child diagrams.
    // Each diagram's bounds is in diagram-local space; transform to world:
    //   world pos = diagramLocal * diagram.scale * canvas.scale + diagram.position * canvas.scale + canvas.position
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const cs = state.scale;
    const [cpx, cpy, cpz] = state.position;

    for (const diagram of state.diagrams) {
      const ds = diagram.scale * cs;
      const [dpx, dpy] = diagram.position;
      const { bounds: b } = diagram;
      const wx0 = (b.x * diagram.scale + dpx) * cs + cpx;
      const wy0 = (b.y * diagram.scale + dpy) * cs + cpy;
      const wx1 = ((b.x + b.w) * diagram.scale + dpx) * cs + cpx;
      const wy1 = ((b.y + b.h) * diagram.scale + dpy) * cs + cpy;
      minX = Math.min(minX, wx0, wx1);
      maxX = Math.max(maxX, wx0, wx1);
      minY = Math.min(minY, wy0, wy1);
      maxY = Math.max(maxY, wy0, wy1);
    }

    const worldCX = (minX + maxX) / 2;
    const worldCY = (minY + maxY) / 2;
    const maxDim = Math.max(maxX - minX, maxY - minY);
    const fov45 = 45 * (Math.PI / 180);
    const dist = (maxDim / (2 * Math.tan(fov45 / 2))) * 1.2;
    cam.position.set(worldCX, worldCY + dist * 0.3, cpz + dist);
    cam.lookAt(worldCX, worldCY, cpz);
  }

  apply(state: DiagramCanvasState, _ctx: WidgetRenderContext): void {
    if (!this.scene) return;
    this.lastState = state;
    this.renderer.update(state, this.scene);
  }

  /**
   * Ghost-node merge: carries forward label/shape/iconUrl for empty-label nodes
   * in each child diagram, exactly as DiagramWidget.mergeSnapshot does.
   */
  mergeSnapshot(
    prev: DiagramCanvasState | undefined,
    next: DiagramCanvasState | undefined,
  ): DiagramCanvasState | undefined {
    if (!next || !prev) return next;

    let anyChanged = false;
    const mergedDiagrams = next.diagrams.map((nextDiagram) => {
      const prevDiagram = prev.diagrams.find((d) => d.id === nextDiagram.id);
      if (!prevDiagram) return nextDiagram;

      let diagramChanged = false;
      const mergedNodes = nextDiagram.nodes.map((node): DiagramNodeState => {
        if (node.label !== '') return node;
        const prevNode = prevDiagram.nodes.find((p) => p.id === node.id);
        if (!prevNode) return node;
        diagramChanged = true;
        anyChanged = true;
        return {
          ...node,
          label: prevNode.label,
          sublabel: prevNode.sublabel,
          shape: prevNode.shape,
          iconUrl: prevNode.iconUrl,
          iconScale: prevNode.iconScale,
          sublabelColor: prevNode.sublabelColor,
        };
      });
      return diagramChanged ? { ...nextDiagram, nodes: mergedNodes } : nextDiagram;
    });

    return anyChanged ? { ...next, diagrams: mergedDiagrams } : next;
  }

  dispose(): void {
    if (this.canvasElement && this.clickHandler) {
      this.canvasElement.removeEventListener('click', this.clickHandler);
      this.canvasElement = null;
      this.clickHandler = null;
    }
    if (!this.scene) return;
    this.renderer.dispose(this.widgetId, this.scene);
    this.scene = null;
    this.lastState = null;
  }

  private handleClick(event: MouseEvent): void {
    if (!this.onInteraction || !this.scene || !this.canvasElement) return;
    const rect = this.canvasElement.getBoundingClientRect();
    this.ndc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const cam = this.scene.userData[CAMERA_KEY] as THREE.PerspectiveCamera | undefined;
    if (!cam) return;
    this.raycaster.setFromCamera(this.ndc, cam);
    const intersects = this.raycaster.intersectObjects(
      Array.from(diagramInteractionRegistry),
      false,
    );
    if (intersects.length === 0) return;
    const hit = intersects[0];
    const info = diagramInteractionLookup.get(hit.object as THREE.Mesh);
    if (!info) return;
    // Accept clicks from any child diagram (not just widgetId match)
    const ownsDiagram = this.lastState?.diagrams.some((d) => d.id === info.diagramId) ?? false;
    if (!ownsDiagram) return;
    this.onInteraction({
      type: 'node-click',
      diagramId: info.diagramId,
      nodeId: info.nodeId,
      intersectPoint: [hit.point.x, hit.point.y, hit.point.z],
    });
  }
}
```

### 8.6 `src/elements/diagram/canvas/index.ts`

```typescript
// Canvas element module re-exports.

export type { DiagramCanvasState, DiagramPipeState, DiagramCanvasDSL, DiagramPipeDSL } from './types';
export { DiagramCanvas, DiagramPipe } from './dsl';
export type { DiagramCanvasProps, DiagramPipeProps } from './dsl';
export { compileCanvas, compilePipe, functionalDiagramCanvasTransitionSpec } from './compile';
export { DiagramCanvasRenderer } from './render';
export { DiagramCanvasWidget } from './widget';
```

---

## 9. Handler Changes — `src/compiler/handlers.ts`

### 9.1 New imports

```typescript
import { DiagramCanvas, DiagramPipe } from '../elements/diagram/canvas/dsl';
import { compileCanvas } from '../elements/diagram/canvas/compile';
import type { DiagramCanvasDSL, DiagramPipeDSL } from '../elements/diagram/canvas/types';
import { Exit, Enter } from '../elements/diagram/dsl';
import type { DiagramExitDSL, DiagramEnterDSL, DiagramPivot } from '../elements/diagram/types';
import type { DiagramState } from '../elements/diagram/types';
```

### 9.2 Update `extractDiagramDSL` to read Exit / Enter children

In the first `for` loop (groups pass), add:
```typescript
if (el.type === Exit) {
  exitDSL = el.props as DiagramExitDSL;
} else if (el.type === Enter) {
  enterDSL = el.props as DiagramEnterDSL;
}
```

Declare variables at the top of `extractDiagramDSL`:
```typescript
let exitDSL: DiagramExitDSL | undefined;
let enterDSL: DiagramEnterDSL | undefined;
```

Add to the returned object:
```typescript
position: props.position as readonly [number, number, number] | undefined,
rotation: props.rotation as readonly [number, number, number] | undefined,
scale: props.scale as number | undefined,
pivot: (props.pivot ?? 'center') as DiagramPivot,
exit: exitDSL,
enter: enterDSL,
```

### 9.3 Update `registerDiagramHandlers`

Register new primitives at the top (before `registerNode(Diagram, ...)`):
```typescript
registerNode(Exit, () => {});
registerNode(Enter, () => {});
registerNode(DiagramPipe, () => {});
```

Add the canvas handler after the `Diagram` handler:
```typescript
registerNode(DiagramCanvas, (node: ReactElement, api: CompileApi, helpers: CompileHelpers) => {
  const props = node.props as Record<string, unknown>;
  const allChildren = helpers.collectChildren(node);

  // Pass 1: compile all Diagram children
  const diagramStates: DiagramState[] = [];
  for (const child of allChildren) {
    if (!child || typeof child !== 'object' || !('type' in (child as object))) continue;
    const el = child as ReactElement;
    if (el.type !== Diagram) continue;
    const dsl = extractDiagramDSL(el, helpers);
    diagramStates.push(compileDiagram(dsl));
  }

  // Pass 2: collect DiagramPipe children
  const pipeDSLs: DiagramPipeDSL[] = [];
  for (const child of allChildren) {
    if (!child || typeof child !== 'object' || !('type' in (child as object))) continue;
    const el = child as ReactElement;
    if (el.type !== DiagramPipe) continue;
    pipeDSLs.push(el.props as DiagramPipeDSL);
  }

  const canvasDSL: DiagramCanvasDSL = {
    id: String(props.id),
    position: props.position as readonly [number, number, number] | undefined,
    rotation: props.rotation as readonly [number, number, number] | undefined,
    scale: props.scale as number | undefined,
  };

  const canvasState = compileCanvas(canvasDSL, diagramStates, pipeDSLs);
  api.setWidgetState(String(props.id), canvasState);
});
```

**Important:** When `<Diagram>` is inside a `<DiagramCanvas>`, the canvas handler processes
it via `helpers.collectChildren()` and `extractDiagramDSL()` — NOT via the standalone
`Diagram` handler. The standalone `Diagram` handler only fires for top-level diagrams
(direct children of `<Scene>`). The canvas handler intentionally does NOT call
`helpers.compileChildren()`, so the scene compiler never descends into the canvas's children
through the normal registry path.

---

## 10. Public Exports — `src/index.ts`

Add to the existing exports:
```typescript
// Canvas module
export type { DiagramCanvasState, DiagramPipeState, DiagramCanvasDSL, DiagramPipeDSL } from './elements/diagram/canvas/types';
export { DiagramCanvas, DiagramPipe } from './elements/diagram/canvas/dsl';
export type { DiagramCanvasProps, DiagramPipeProps } from './elements/diagram/canvas/dsl';
export { compileCanvas, compilePipe, functionalDiagramCanvasTransitionSpec } from './elements/diagram/canvas/compile';
export { DiagramCanvasRenderer } from './elements/diagram/canvas/render';
export { DiagramCanvasWidget } from './elements/diagram/canvas/widget';

// New diagram types
export type {
  DiagramPivot,
  DiagramEasing,
  DiagramExitConfig,
  DiagramEnterConfig,
  DiagramExitDSL,
  DiagramEnterDSL,
} from './elements/diagram/types';

// New diagram DSL components
export { Exit, Enter } from './elements/diagram/dsl';
export type { ExitProps, EnterProps } from './elements/diagram/dsl';

// New compile exports
export { applyDiagramExit, applyDiagramEnter } from './elements/diagram/compile';
```

---

## 11. Example App Updates

### 11.1 `apps/examples/diagram/widgetSetup.ts`

Replace the `compileDiagram` + `new DiagramWidget` call with `compileCanvas` + `new DiagramCanvasWidget`:

```typescript
import {
  DiagramCanvasWidget,
  ImagePanelWidget,
  ScreenWidget,
  compileCanvas,
  compileImagePanel,
  compileScreen,
  registerDiagramHandlers,
} from '@brewsite/diagram';

export const createWidgetSetup = (manifest: AssetManifest | null) => {
  registerDiagramHandlers();
  const registry = createDefaultWidgetRegistry(manifest);

  const canvasDefault = compileCanvas(
    { id: 'system-canvas' },
    [
      compileDiagram({
        id: 'system-arch',
        layout: 'manual',
        layoutSpacing: [2, 2],
        pivot: 'center',
        nodes: [
          { id: 'browser',  label: 'Web Browser',    position: [-6,  6,  0], shape: 'flow:actor'       },
          { id: 'cdn',      label: 'CloudFront CDN',  position: [ 0,  2,  0], shape: 'aws:cloudfront'   },
          { id: 'alb',      label: 'Load Balancer',   position: [ 0, -1,  0], shape: 'aws:alb'          },
          { id: 'api',      label: 'API Gateway',     position: [ 0, -4,  0], shape: 'aws:api-gateway'  },
          { id: 'ecs',      label: 'ECS Cluster',     position: [-5, -8,  0], shape: 'aws:ecs'          },
          { id: 'lambda',   label: 'Lambda',          position: [ 5, -8,  0], shape: 'aws:lambda'       },
          { id: 'rds',      label: 'RDS PostgreSQL',  position: [-5,-13,  0], shape: 'aws:rds'          },
          { id: 'cache',    label: 'ElastiCache',     position: [ 0,-13,  0], shape: 'aws:elasticache'  },
          { id: 's3',       label: 'S3 Assets',       position: [ 5,-13,  0], shape: 'aws:s3'           },
        ],
        edges: [
          { from: 'browser', to: 'cdn' }, { from: 'cdn', to: 'alb' },
          { from: 'alb', to: 'api' },     { from: 'api', to: 'ecs' },
          { from: 'api', to: 'lambda' },  { from: 'ecs', to: 'rds' },
          { from: 'ecs', to: 'cache' },   { from: 'ecs', to: 's3' },
        ],
        groups: [],
      }),
    ],
    [],
  );

  const panelDefault = compileImagePanel({ /* unchanged */ });
  const screenDefault = compileScreen({ /* unchanged */ });

  registry
    .register(new DiagramCanvasWidget('system-canvas', canvasDefault))
    .register(new ImagePanelWidget('api-docs-screenshot', panelDefault))
    .register(new ScreenWidget('api-explorer-live', screenDefault));

  return registry;
};
```

Note: `mobile` node with `shape: 'net:mobile'` is intentionally removed — there is no icon
asset for that shape. Replace with `shape: 'flow:actor'` or omit the node.

### 11.2 `apps/examples/diagram/scenes/scene_arch_overview.tsx`

Wrap the existing `<Diagram>` in `<DiagramCanvas id="system-canvas">`. The diagram id must
change to `"system-arch"` (matching the canvas widget setup). Add `pivot="center"`. Optionally
add `<Exit>`:

```tsx
import { DiagramCanvas, DiagramNode, DiagramEdge, DiagramGroup, Exit } from '@brewsite/diagram';

export const sceneArchOverview: SceneDefinition = {
  id: 'arch-overview',
  index: 0,
  getFrame: () => (
    <Scene id="arch-overview">
      <Lighting intensityScale={1}>...</Lighting>
      <DiagramCanvas id="system-canvas">
        <Diagram id="system-arch" layout="manual" pivot="center">
          <Exit to={[0, -60, 0]} fade easing="ease-out" />
          <DiagramGroup id="frontend" label="Client Tier" variant="swimlane">
            <DiagramNode id="browser" label="Web Browser" shape="flow:actor" position={[-6, 6, 0]} />
          </DiagramGroup>
          <DiagramGroup id="api-tier" label="API Tier" variant="boundary">
            <DiagramNode id="cdn"    label="CloudFront CDN" shape="aws:cloudfront"  position={[0,  2, 0]} clickable />
            <DiagramNode id="alb"    label="Load Balancer"  shape="aws:alb"         position={[0, -1, 0]} clickable />
            <DiagramNode id="api"    label="API Gateway"    shape="aws:api-gateway" position={[0, -4, 0]} clickable />
          </DiagramGroup>
          <DiagramGroup id="compute" label="Compute Tier" variant="boundary">
            <DiagramNode id="ecs"    label="ECS Cluster"    shape="aws:ecs"         position={[-5, -8, 0]} clickable />
            <DiagramNode id="lambda" label="Lambda"         shape="aws:lambda"      position={[ 5, -8, 0]} clickable />
          </DiagramGroup>
          <DiagramGroup id="data" label="Data Tier" variant="swimlane">
            <DiagramNode id="rds"    label="RDS PostgreSQL" shape="aws:rds"         position={[-5,-13, 0]} />
            <DiagramNode id="cache"  label="ElastiCache"    shape="aws:elasticache" position={[ 0,-13, 0]} />
            <DiagramNode id="s3"     label="S3 Assets"      shape="aws:s3"          position={[ 5,-13, 0]} />
          </DiagramGroup>
          <DiagramEdge from="browser" to="cdn"    label="HTTPS" />
          <DiagramEdge from="cdn"     to="alb"    />
          <DiagramEdge from="alb"     to="api"    />
          <DiagramEdge from="api"     to="ecs"    label="REST"   />
          <DiagramEdge from="api"     to="lambda" label="Events" style="dashed" />
          <DiagramEdge from="ecs"     to="rds"    label="TCP 5432" />
          <DiagramEdge from="ecs"     to="cache"  label="Redis"  />
          <DiagramEdge from="ecs"     to="s3"     label="r/w"    style="dashed" />
        </Diagram>
      </DiagramCanvas>
    </Scene>
  ),
};
```

### 11.3 `apps/examples/diagram/scenes/scene_arch_ecs_detail.tsx`

Wrap similarly in `<DiagramCanvas id="system-canvas">`. Add `<Enter>` to slide in from the
left. Ghost nodes use diagram-local positions (unchanged semantics, just now clearly local):

```tsx
<DiagramCanvas id="system-canvas">
  <Diagram id="system-arch" layout="manual" pivot="center">
    <Enter from={[-60, 0, 0]} fade easing="ease-in" />
    {/* Ghost nodes: only position + opacity; label/shape merge from previous scene */}
    <DiagramNode id="cdn"    position={[0,  2,-25]} opacity={0.3} />
    <DiagramNode id="alb"    position={[0, -1,-25]} opacity={0.3} />
    <DiagramNode id="api"    position={[0, -4,-25]} opacity={0.3} />
    <DiagramNode id="lambda" position={[5, -8,-25]} opacity={0.3} />
    <DiagramNode id="rds"    position={[-5,-13,-25]} opacity={0.3} />
    <DiagramNode id="cache"  position={[0, -13,-25]} opacity={0.3} />
    <DiagramNode id="s3"     position={[5, -13,-25]} opacity={0.3} />
    {/* Hero node */}
    <DiagramNode id="ecs" label="ECS Cluster" shape="aws:ecs"
      position={[-5,-8,-5]} depth={0.8} color="#1a3d5c" size={[6,3]} />
    {/* Detail nodes */}
    <DiagramNode id="svc-auth"   label="Auth Service" shape="flow:rounded" position={[-9,-6, 8]} color="#0d3d2b" size={[4,2]} />
    <DiagramNode id="svc-api"    label="API Service"  shape="flow:rounded" position={[-5,-6, 8]} color="#0d3d2b" size={[4,2]} />
    <DiagramNode id="svc-worker" label="Worker"       shape="flow:rounded" position={[-1,-6, 8]} color="#0d3d2b" size={[4,2]} />
    <DiagramEdge from="ecs"      to="svc-auth" />
    <DiagramEdge from="ecs"      to="svc-api" />
    <DiagramEdge from="ecs"      to="svc-worker" />
    <DiagramEdge from="svc-api"  to="rds" />
    <DiagramEdge from="svc-auth" to="cache" />
  </Diagram>
</DiagramCanvas>
```

---

## 12. Testing Strategy

### 12.1 Modified tests — `diagram/__tests__/compile.test.ts`

**Update existing tests:**
- Remove assertions on `state.cameraTarget` and `state.cameraDistance` (fields removed)
- Update `compileDiagram` calls to include required new fields where needed

**Add new test cases:**

```typescript
describe('pivot offset', () => {
  it("'center' pivot: bounds center maps to [0, 0]", () => {
    // Two nodes at known positions
    // After compilation with pivot='center', bounds center should be ~[0,0]
  });

  it("'top-left' pivot: top-left corner maps to [0, 0]", () => {
    // After compilation with pivot='top-left', min x and max y should be ~[0, 0]
  });

  it("pivot offset is applied before edge routing", () => {
    // Edge control points should be consistent with post-pivot node positions
  });
});

describe('exit / enter config compilation', () => {
  it('compileExitConfig returns null when no <Exit> in DSL', () => {});
  it('compileExitConfig applies defaults (fade=true, easing=ease)', () => {});
  it('compileEnterConfig applies defaults (fade=true, easing=ease)', () => {});
});

describe('DiagramState transform fields', () => {
  it('position defaults to [0,0,0]', () => {});
  it('scale defaults to 1', () => {});
  it('position/rotation/scale from DSL are passed through unchanged', () => {});
});
```

### 12.2 New tests — `diagram/canvas/__tests__/compile.test.ts`

```typescript
describe('compilePipe', () => {
  it('produces at least 2 control points for a valid pipe', () => {});
  it('warns and returns empty controlPoints for invalid dot-notation', () => {});
  it('warns and returns empty controlPoints for unresolvable diagramId', () => {});
  it('warns and returns empty controlPoints for unresolvable nodeId', () => {});
  it('transforms node positions by diagram scale + position', () => {
    // diagram at position=[10, 0, 0], scale=2, node at local [1, 0, 0]
    // expected world position: [1*2+10, 0, 0] = [12, 0, 0]
  });
});

describe('compileCanvas', () => {
  it('applies canvas position/scale defaults', () => {});
  it('stores compiled diagram states in output', () => {});
  it('compiles pipes using compiled diagram states', () => {});
  it('returns empty pipes array when no DiagramPipe children', () => {});
});

describe('routePipe', () => {
  it('produces 4 control points (start, 2 bezier, end)', () => {});
  it('arc midpoint is elevated relative to straight-line midpoint', () => {});
});
```

### 12.3 New tests — `diagram/canvas/__tests__/functionalTransitionSpec.test.ts`

```typescript
describe('functionalDiagramCanvasTransitionSpec', () => {
  describe('exitFn', () => {
    it('fades all diagram node opacities to 0 at t=1', () => {});
    it('fades pipe opacities to 0 at t=1', () => {});
    it('applies diagram exit config (to position + fade)', () => {});
  });

  describe('enterFn', () => {
    it('fades all diagram node opacities from 0 at t=0', () => {});
    it('applies diagram enter config (from position + fade)', () => {});
  });

  describe('interpolateFn', () => {
    it('interpolates canvas position/rotation/scale', () => {});
    it('interpolates child diagram node positions', () => {});
    it('fades in new diagrams that have no prior state', () => {});
    it('fades out diagrams removed from state', () => {});
    it('interpolates pipe opacities', () => {});
  });
});
```

### 12.4 Updated tests — `diagram/__tests__/functionalTransitionSpec.test.ts`

**Add new test cases:**

```typescript
describe('applyDiagramExit', () => {
  it('with no exit config: fades nodes and edges to 0 at t=1', () => {});
  it('with exit config {to, fade:true}: moves position and fades', () => {});
  it('with exit config {scaleTo:0}: shrinks scale to 0 at t=1', () => {});
  it('applies easing: spring produces non-linear t mapping', () => {});
});

describe('applyDiagramEnter', () => {
  it('with no enter config: fades nodes in from 0 at t=0', () => {});
  it('with enter config {from}: starts at from position at t=0', () => {});
  it('with enter config {scaleFrom:0}: starts at scale 0', () => {});
});

describe('interpolateFn — diagram transform', () => {
  it('interpolates diagram position at t=0.5', () => {});
  it('interpolates diagram scale at t=0.5', () => {});
});
```

---

## 13. Key Invariants and Implementation Notes

### 13.1 Standalone `<Diagram>` still works

A bare `<Diagram>` outside any `<DiagramCanvas>` compiles through the existing `Diagram`
handler and renders through `DiagramWidget` exactly as before, gaining only the new
position/rotation/scale transform fields (all defaulting to safe values).

### 13.2 DiagramRenderer parent type

`DiagramRenderer.update()` now accepts `THREE.Object3D` (not `THREE.Scene`).
`THREE.Scene extends THREE.Object3D`, so all existing callers that pass a scene are
unchanged. `DiagramCanvasRenderer` passes its canvas group (a `THREE.Group`) without
any type cast.

### 13.3 Compilation order guarantees

Within a `<DiagramCanvas>`, the `collectChildren` call returns children in JSX declaration
order. Diagrams are processed in pass 1, pipes in pass 2. Pipe compilation always sees
fully-compiled diagram states. No deferred resolution is needed.

### 13.4 Node positions in ghost-node scenes

Ghost nodes (label-less nodes in scene 2) specify diagram-local positions — the same
coordinate space as the non-ghost nodes in scene 1. The `mergeSnapshot` in
`DiagramCanvasWidget` carries forward label/shape identity exactly as before.

### 13.5 Scale does NOT affect `pivot`

Pivot offset is computed from raw layout positions before scale is applied. The scale
is applied only by Three.js at render time via the group transform. This means:
- `bounds` in `DiagramState` is in diagram units (before scale)
- `position` in `DiagramState` is in parent space (after scale is irrelevant for translation)
- Camera framing multiplies `bounds × scale` to get world-space extents

### 13.6 Lucid import workflow

The `scripts/import-lucid.mjs` script should output:
- `<Diagram ... pivot="top-left">` (Lucid origin is top-left, Y-down)
- Node `position={[lucidX, -lucidY, 0]}` (negate Y for Three.js Y-up)
- `<Diagram scale={worldWidth / lucidDiagramWidth}>` to control world-space size
- All node sizes, edge thicknesses in Lucid pixel units — they scale automatically

### 13.7 What happens to `cameraTarget` and `cameraDistance`

These fields are **removed** from `DiagramState`. The `DiagramWidget.onTick()` and
`DiagramCanvasWidget.onTick()` both compute camera framing at runtime from
`bounds + position + scale`. No tests should assert on these removed fields.

---

## 14. Build Order

Implement files in this order to satisfy import dependencies:

1. `diagram/types.ts` (add new types, remove cameraTarget/cameraDistance)
2. `diagram/dsl.tsx` (add Exit, Enter, new Diagram props)
3. `diagram/compile.ts` (add pivot, exit/enter compile; update transition spec)
4. `diagram/render.ts` (change parent type; apply transform in update)
5. `diagram/widget.ts` (update onTick camera framing)
6. `diagram/index.ts` (re-export new types)
7. `canvas/types.ts`
8. `canvas/dsl.tsx`
9. `canvas/compile.ts`
10. `canvas/render.ts`
11. `canvas/widget.ts`
12. `canvas/index.ts`
13. `compiler/handlers.ts` (update extractDiagramDSL; add canvas/pipe/exit/enter handlers)
14. `src/index.ts` (add canvas exports)
15. `apps/examples/diagram/widgetSetup.ts`
16. `apps/examples/diagram/scenes/scene_arch_overview.tsx`
17. `apps/examples/diagram/scenes/scene_arch_ecs_detail.tsx`
18. Tests (can be written concurrently with steps 1–14)

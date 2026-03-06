---
title: "Diagram Coordinate Alignment with NVS"
doc_type: note
owner: architect
status: draft
updated: 2026-03-05
---

# Diagram Coordinate Alignment with NVS

## 1. The Problem — Acknowledged Without Qualification

The previous PM assessment argued that diagram coordinates are "not arbitrary" because node
sizes and layout defaults are derivable. That argument is correct but irrelevant. The user's
complaint is about something else: **the relationship between a diagram coordinate and a
screen position is unknowable at authoring time.** The PM answer — "auto-framing handles
it" — is precisely what makes the problem worse, not better.

Here is the failure mode in concrete terms:

- An author writes `position={[0, 0, 0]}` with `pivot="center"`. That is the center of
  the diagram bounding box. But "center of the bounding box" is not the same as "center
  of the screen" — the camera adapts to where the nodes are. The diagram is center-of-screen
  only by accident.
- An author writes `position={[-6, 0, 0]}`. Is that the left edge of the screen? It depends
  on: (a) how many other nodes exist, (b) the camera FOV, (c) the canvas scale, (d) what
  the auto-framing algorithm computes as the bounding box. None of these are deterministic
  from authoring-time information.
- An author writing `<DiagramExit to={[0, -50, 0]}>` uses the magic number 50 because they
  ran the scene and observed it needed to be about 50. There is no derivable answer.
- A bot authoring diagram nodes faces trial-and-error for every manual-layout scene.

The PM argued this is tolerable because auto-layout (which doesn't require position
authoring) covers most scenes. This is true for today's content. But it is not a system
design principle — it is an accident of the current workload. Bots that need precise
screen-relative placement will fail.

**The inconsistency is architectural, not cosmetic.** NVS (used everywhere else in the
engine) has a bounded, top-left, [0..1] origin with predictable semantics. Diagram node
space has an unbounded, center-origin Cartesian space whose relationship to the screen is
defined by runtime computation. Two fundamentally different philosophies in one toolkit is
wrong. This note designs the fix.

---

## 2. Proposed Coordinate Model — Option A: NVS-Aligned [0..1]

### Decision

Adopt **[0..1] top-left origin for all diagram node positions**, aligned with NVS.

**Properties of the new system:**

| Property | Value |
|---|---|
| X range | [0..1], where 0 = left edge of diagram viewport, 1 = right edge |
| Y range | [0..1], where 0 = top edge of diagram viewport, 1 = bottom edge |
| Origin | Top-left (consistent with NVS) |
| Center | [0.5, 0.5] |
| Z | Relative depth layering only (unchanged) |
| Sizes | [0..1] fractions: `w` = fraction of diagram viewport width, `h` = fraction of height |
| Aspect ratio | Size fractions are per-axis, like NVS (w and h are independent) |

### Why Option A over Option B (bounded absolute e.g. [0..100])

Option B (bounded absolute) introduces an arbitrary scale factor. Why 100 and not 16?
Option A — pure [0..1] — is already the semantic used by every other positioned element
in the engine: `TextBox`, `NVSRect`, `ModelWidget.nvsBounds`, `DiagramCanvasState.nvsBounds`,
`ChartState.nvsBounds`. Adopting [0..1] for diagram node positions makes diagram authoring
use the same vocabulary the author already uses everywhere else.

The sole complexity of Option A is aspect-ratio awareness for sizes: a node with
`size={[0.1, 0.1]}` is 10% of the viewport width AND 10% of the viewport height, which at
16:9 produces a rectangle wider than it is tall in pixels. This is identical to the behavior
of a `TextBox` with `w={0.1} h={0.1}`. Authors who already author NVS-positioned elements
have internalized this. It is not new complexity; it is unified complexity.

### The new DSL surface (post-migration)

```typescript
// DiagramNodeProps — position
position?: [number, number, number];
// [0..1] in x (left=0, right=1)
// [0..1] in y (top=0, bottom=1)
// z: relative depth layering (unchanged convention)

// DiagramNodeProps — size
size?: [number, number];
// [w, h] in [0..1] fractions of the diagram's viewport bounds
// w is fraction of viewport width, h is fraction of viewport height
// Default: see Section 6 (Migration) for updated defaults
```

The `pivot` prop on `<Diagram>` is **removed**. In the new system, origin is always top-left,
consistent with NVS. Backward-compatible workarounds are not provided — this is a clean break
justified by pre-ship timing.

### Concreteness check — what the user asked for

| Question | Answer in new system |
|---|---|
| What is the left edge? | x = 0 |
| What is the right edge? | x = 1 |
| What is the center? | x = 0.5, y = 0.5 |
| What is the left third? | x ∈ [0, 0.33] |
| How do I exit off the bottom? | `<DiagramExit to={[0.5, 2, 0]}>` — 2 diagram heights below top-left |
| Can I place a node at top-left without running the compiler? | Yes: `position={[0, 0, 0]}` |

These answers are trivially computable, author-time, without running anything.

---

## 3. Auto-Layout Integration

### Layout algorithms are unchanged internally

The grid, hierarchical, flow, and manual layout algorithms currently produce positions in
diagram units. These outputs are correct relative to each other — a 4-column grid with
`spacing={[2, 2]}` produces correct relative spacing regardless of the unit system.

The change: a **normalization pass** is added as the final step of `compileDiagram()`,
after all positions are assigned. This pass converts the algorithm's diagram-unit output
into [0..1] positions by dividing by the computed bounding box.

```typescript
// packages/diagram/src/elements/diagram/compile.ts — new normalization step

/**
 * Maps all node positions and sizes from diagram-unit space to [0..1]
 * within the diagram's bounding box (with padding applied).
 *
 * Operates AFTER layout algorithms assign absolute positions.
 * The bounding box is computed from the outer edges of all nodes
 * (position ± size/2), then expanded by `padding` on all sides.
 *
 * Post-normalization:
 *   - Node at bounding-box left edge → position.x = 0 + padding fraction
 *   - Node at bounding-box right edge → position.x = 1 - padding fraction
 *   - Node at bounding-box center → position.x = 0.5
 */
function normalizeToViewport(
  nodes: DiagramNodeState[],
  padding: number,  // diagram-unit padding (from groupPadding/theme)
): DiagramNodeState[];
```

The normalization algorithm:

```
1. Compute the raw bounding box of all node outer edges:
   minX = min(node.position[0] - node.size[0] / 2)
   maxX = max(node.position[0] + node.size[0] / 2)
   minY = min(node.position[1] - node.size[1] / 2)
   maxY = max(node.position[1] + node.size[1] / 2)

2. Apply padding (the existing group padding constant):
   spanX = (maxX - minX) + 2 * padding
   spanY = (maxY - minY) + 2 * padding
   originX = minX - padding
   originY = minY - padding

3. Normalize each node:
   normalizedPosX = (node.position[0] - originX) / spanX
   normalizedPosY = (node.position[1] - originY) / spanY
   normalizedSizeW = node.size[0] / spanX
   normalizedSizeH = node.size[1] / spanY
```

**Invariant:** After normalization, all node center positions are in [0..1], and all node
outer edges are in [padding_frac, 1 - padding_frac]. The bounding box of all nodes fills
[0..1] (with padding consumed at edges).

### What authors see for auto-layout

Auto-layout authors do not author positions — they never did. The normalization is invisible
to them. The layout still responds to `columns`, `spacing`, `groupPadding` props. These
still control the RELATIVE layout — just the output coordinate system changes.

### For layout sizing defaults

The existing default node `size={[4, 2]}` in diagram units will become, post-normalization,
a fraction of the bounding box. For a 4-column × 3-row grid with `spacing={[2,2]}`:
- Raw span: 4*(4+2)-2 = 22 in X, 3*(2+2)-2 = 10 in Y
- With padding 1.5 each side: spanX = 22+3 = 25, spanY = 10+3 = 13
- Normalized node size: [4/25, 2/13] = [0.16, 0.154]

This is handled by the normalization pass — the author's `size={[4, 2]}` prop feeds the
algorithm, and the normalized size is stored in `DiagramNodeState`. The DSL `size` prop
interpretation changes: it is in **layout units** (same as spacing and padding), not in
the output [0..1] space. This is a clean separation: DSL authors reason in layout units
(which control relative proportions), and the output is always [0..1].

---

## 4. Group Sub-Spaces

Groups are axis-aligned bounding boxes computed from their children's positions. In the
new system, group bounds are also in [0..1] within the diagram's normalized space:

```typescript
// DiagramGroupState.bounds — same type, different unit semantics
interface DiagramGroupBounds {
  x: number;  // was: diagram units — now: [0..1] fraction of diagram viewport
  y: number;
  w: number;
  h: number;
  padding: readonly [number, number, number, number];  // also normalized
  titleGap: number;   // also normalized
}
```

Groups do NOT have their own local [0..1] sub-space for child positioning. The deferred
Gap 3 (group-local sub-space) remains deferred — this note does not revive it. Children
of a group have positions in the diagram's top-level [0..1] space, and the group's bounds
enclose them. This is unchanged behavior, just in a new coordinate unit.

**GroupRenderer receives group bounds in [0..1]** and maps them to Three.js world-space
using the same canvas-scale mapping as nodes.

---

## 5. Camera / Auto-Framing

### Auto-framing is eliminated

The current `DiagramCanvasWidget.onTick` contains 70+ lines of camera auto-framing logic
that scans all diagram bounding boxes and computes a camera position. This logic is the
root of the problem — it makes the coordinate-to-screen mapping dynamic and unknowable.

With bounded [0..1] positions, auto-framing is unnecessary and must be removed.

### How the camera is set instead

The `DiagramCanvasRenderer` sets the canvas camera to show exactly the [0..1] × [0..1]
space of each diagram, scaled to the canvas's world-space extent. The mapping:

```
Given:
  - DiagramCanvasState.scale (canvas uniform scale in world units)
  - DiagramCanvasState.position (canvas origin in world space)
  - Canvas-local orthographic projection:
      worldX_per_unit = scale
      worldY_per_unit = scale

For a node at normalized position [nx, ny]:
  worldX = position[0] + (nx - 0.5) * scale * viewportAspect
  worldY = position[1] + (0.5 - ny) * scale         // Y-flip: NVS top→world +Y
  worldZ = position[2]

Camera: at (worldCX, worldCY, worldCZ + cameraDistance), looking at (worldCX, worldCY, worldCZ)
cameraDistance = scale / (2 * tan(FOV/2))
FOV defaults to 45°
```

The canvas `scale` prop now has a clear meaning: **scale = how many world units the
diagram viewport's height spans**. A canvas with `scale={10}` means the [0..1] height of
the diagram corresponds to 10 world units. This is the same as the `worldHeight` concept
proposed in Gap 2 of the original architect's note — now it becomes the canonical meaning
of `scale`.

**Result:** Any node at `position={[0.5, 0.5, 0]}` is at the world-space center of the
canvas, always. Any node at `position={[0, 0, 0]}` is at top-left, always. The camera
does not move to accommodate content.

### DiagramCanvas.scale defaults

Current canvas usage: `<DiagramCanvas scale={1.0}>` in most scenes, `scale={0.7}` or
`scale={config.diagramScale}` in a few. Post-migration, these values still control the
world-space size of the canvas. The meaning is clearer: `scale={10}` means "the canvas
height is 10 world units."

### Removing onTick framing

`DiagramCanvasWidget.onTick` currently is the entire camera framing system. After this
change, `onTick` becomes a no-op for camera purposes. The `IAnimationController`
implementation on `DiagramCanvasWidget` may be dropped, or retained as a stub for the
focus/orbit input system which uses the camera separately.

The `applyInputFocus`, `focusMesh`, `focusAll` methods that implement interactive camera
zoom-to-group can be retained and adapted to work with the now-fixed camera. They write
to `scene.userData[CAMERA_FOCUS_KEY]` which the camera-controls runtime reads — this
mechanism is unchanged.

---

## 6. Migration Path

This is a breaking change to every diagram authoring surface. Every file that uses
`<DiagramNode position>`, `<Diagram position>`, `<DiagramExit to>`, `<DiagramEnter from>`,
or `<DiagramCanvas position/scale>` must be updated. Pre-ship, this cost is zero — there
are no external consumers.

### 6.1 Type changes

**`packages/diagram/src/elements/diagram/types.ts`**

```typescript
// BEFORE
interface DiagramNodeState {
  position: readonly [number, number, number];  // diagram units
  size: readonly [number, number];              // diagram units
  // ...
}

interface DiagramState {
  position: readonly [number, number, number];  // canvas-local units
  rotation: readonly [number, number, number];  // radians
  scale: number;
  bounds: { x: number; y: number; w: number; h: number };  // diagram units
  // ...
}

// AFTER
interface DiagramNodeState {
  /**
   * Node center position in diagram viewport space [0..1].
   * x=0 = left edge, x=1 = right edge, y=0 = top, y=1 = bottom.
   * z is relative depth layering (unchanged).
   */
  position: readonly [number, number, number];  // [0..1] in x,y
  /**
   * Node size as viewport fractions [w, h].
   * w ∈ [0..1] fraction of diagram viewport width.
   * h ∈ [0..1] fraction of diagram viewport height.
   */
  size: readonly [number, number];              // [0..1] fractions
  // ...
}

interface DiagramState {
  /**
   * Diagram viewport bounds within the canvas NVS region.
   * Replaces position/rotation/scale for screen-space positioning.
   * Rotation of the 3D plane is retained as a separate prop for 3D tilt.
   */
  viewportBounds: NVSRect;    // { x, y, w, h } in canvas NVS [0..1]
  tiltRotation: readonly [number, number, number];  // Euler XYZ radians for 3D tilt
  bounds: { x: number; y: number; w: number; h: number };  // ALSO normalized [0..1]
  // ...
}
```

**`packages/diagram/src/elements/diagram/canvas/types.ts`**

```typescript
// BEFORE
interface DiagramCanvasDSL {
  position?: readonly [number, number, number];  // world-space Vec3
  rotation?: readonly [number, number, number];
  scale?: number;
  // x, y, w, h for NVS ownership (unchanged)
}

// AFTER — no change needed to DiagramCanvasDSL; the canvas's world-space
// position/rotation/scale is still valid for placing the canvas in the scene.
// The DIAGRAM's position-within-canvas changes (see DSL changes below).
```

### 6.2 DSL changes

**`packages/diagram/src/elements/diagram/dsl.tsx`**

```typescript
// DiagramNodeProps — position and size JSDoc updated, semantics change
interface DiagramNodeProps {
  /**
   * Node position in diagram viewport space [x, y, z].
   * x ∈ [0..1]: 0 = left edge of diagram viewport, 1 = right edge.
   * y ∈ [0..1]: 0 = top edge of diagram viewport, 1 = bottom edge.
   * z: depth layering (non-zero stacks nodes at different depths).
   *
   * When using <GridLayout>, <HierarchicalLayout>, or <FlowLayout>,
   * omit this prop — the layout engine assigns positions automatically.
   * Only specify when using <ManualLayout>.
   *
   * The previous `pivot` concept is removed. The origin is always top-left.
   * To place a node at screen center: position={[0.5, 0.5, 0]}.
   */
  position?: [number, number, number];

  /**
   * Node width and height as viewport fractions [w, h].
   * w ∈ [0..1]: fraction of diagram viewport width.
   * h ∈ [0..1]: fraction of diagram viewport height.
   * Default: [0.12, 0.10] (approximately a 2:1 node at 16:9).
   * For an aspect-ratio-correct square in a 16:9 viewport: h ≈ w * (16/9).
   */
  size?: [number, number];
}

// DiagramProps — pivot removed, viewportBounds replaces position for intra-canvas placement
interface DiagramProps {
  id: string;
  /**
   * Viewport bounds within the parent DiagramCanvas's NVS region.
   * Declares what portion of the canvas this diagram occupies.
   * { x, y, w, h } in [0..1] fractions of the canvas NVS region.
   * Default: { x: 0, y: 0, w: 1, h: 1 } (full canvas).
   *
   * For side-by-side diagrams:
   *   left:  viewportBounds={{ x: 0,   y: 0, w: 0.5, h: 1 }}
   *   right: viewportBounds={{ x: 0.5, y: 0, w: 0.5, h: 1 }}
   */
  viewportBounds?: NVSRect;
  /**
   * 3D tilt rotation (Euler XYZ radians) for dramatic perspective effects.
   * Default: [0, 0, 0] (flat, facing camera).
   * Replaces the previous `rotation` prop.
   */
  tilt?: [number, number, number];
  theme?: DiagramTheme;
  children?: React.ReactNode;
  // pivot: REMOVED — origin is always top-left
  // position: REMOVED — use viewportBounds
  // scale: REMOVED — controlled via DiagramCanvas.scale
}

// DiagramExitProps / DiagramEnterProps — to/from are now in viewport space
interface DiagramExitProps {
  /**
   * Target position in diagram viewport space at end of exit.
   * [0..1] in x and y. Values outside [0..1] move off-screen.
   * Example: to={[0.5, 2, 0]} exits to 1 viewport height below center.
   * Example: to={[-1, 0.5, 0]} exits to 1 viewport width to the left.
   */
  to?: [number, number, number];
  fade?: boolean;
  scaleTo?: number;
  easing?: DiagramEasing;
}
```

### 6.3 Compiler changes

**`packages/diagram/src/elements/diagram/compile.ts`**

1. Remove `compilePivotOffset()` entirely.
2. Add `normalizeToViewport()` as a post-layout step (see Section 3 algorithm).
3. Remove the `pivot` field from `DiagramDSL` processing.
4. Change how `DiagramState.bounds` is computed — it becomes the [0..1] extent (always
   `{ x: 0, y: 0, w: 1, h: 1 }` after normalization), or is removed as redundant.
5. Change `DiagramState.position` → `DiagramState.viewportBounds: NVSRect`.

**`packages/diagram/src/elements/diagram/compiler/layoutAlgorithms.ts`**

No algorithmic changes. Algorithms still output diagram-unit positions. The normalization
pass in `compileDiagram()` converts them. The `computeBounds()` utility (called at compile
time to derive the diagram's extent) is still needed pre-normalization.

**`packages/diagram/src/elements/diagram/compiler/groupCompiler.ts`**

Group bounds computation: unchanged algorithm, but bounds are now normalized in the same
post-layout step. `GroupBounds.x/y/w/h` become [0..1] fractions. `GroupBounds.padding`
and `GroupBounds.titleGap` also normalized.

**`packages/diagram/src/elements/diagram/canvas/compile.ts`**

The `compileCanvas()` function needs updating:
- `dsl.position` → map to `DiagramCanvasState.position` (world space — unchanged)
- Child `<Diagram>` elements: their compiled `DiagramState.viewportBounds` is set from
  the diagram's `viewportBounds` DSL prop (default: full canvas `{x:0,y:0,w:1,h:1}`)

### 6.4 Renderer changes

**`packages/diagram/src/elements/diagram/rendering/NodeRenderer.ts`**

Node world-space placement currently maps diagram-unit positions to Three.js coordinates.
New mapping:

```typescript
// New world-space computation for a node at normalized position [nx, ny]
function normalizedToWorld(
  nx: number,
  ny: number,
  canvasPosition: readonly [number, number, number],
  canvasScale: number,
  viewportBounds: NVSRect,
  canvasAspect: number,
): readonly [number, number, number] {
  // viewport offset within canvas
  const vpX = viewportBounds.x + viewportBounds.w * nx;
  const vpY = viewportBounds.y + viewportBounds.h * ny;
  // canvas NVS [0..1] → world space (center-origin, Y-flipped)
  const worldX = canvasPosition[0] + (vpX - 0.5) * canvasScale * canvasAspect;
  const worldY = canvasPosition[1] + (0.5 - vpY) * canvasScale;
  return [worldX, worldY, canvasPosition[2]];
}
```

Size rendering: `size={[w, h]}` fractions are converted to world units:
```
worldW = w * canvasScale * canvasAspect
worldH = h * canvasScale
```

**`packages/diagram/src/elements/diagram/canvas/widget.ts`**

- Remove the `onTick` auto-framing block (lines 143-207).
- The camera is now set once in `initialize()` based on the canvas state.
- The `IAnimationController` interface may be dropped from `DiagramCanvasWidget`.
- Keep the interactive focus methods (`applyInputFocus`, `focusMesh`, `focusAll`) —
  they remain useful for interactive zoom-to-group behavior and now operate on the
  deterministic camera.

### 6.5 Scene file migration

All scene files with manual-layout diagrams need position migration. The mechanical process:

1. For each `<Diagram>` with `<ManualLayout>` and explicit `position` props on nodes:
   a. Collect all node positions and sizes (in diagram units).
   b. Compute the bounding box (as the current `computeBounds()` does).
   c. Apply `compilePivotOffset()` (pivot="center" was the default).
   d. Normalize all positions and sizes to [0..1] within the bounding box + padding.
   e. Replace authored coordinate values with the normalized values.

2. For each `<Diagram position={[...]} scale={...}>` (intra-canvas placement):
   Replace with `viewportBounds={{...}}` that achieves the same screen-space placement.

3. For each `<DiagramExit to={[...]} >` / `<DiagramEnter from={[...]} >`:
   Update to/from values (currently in diagram units / canvas-local units) to [0..1]
   viewport-space values. Exit "off the bottom" = `to={[0.5, 2, 0]}`, etc.

4. For each `<Camera>` co-located with a `<DiagramCanvas>`: the explicit camera settings
   that were hacked to match auto-framing output are no longer needed. Remove them or
   simplify. The diagram canvas manages its own camera.

**Affected scene files** (from current git state):
- `apps/examples/src/brewflow-sidecar/scenes/scene_architecture.tsx` — 2 diagrams, ManualLayout
- `apps/examples/src/whiteboard-arch/diagram.tsx` — ManualLayout, ~60+ nodes at diagram-unit coords
- `apps/examples/src/whiteboard-arch/scenes/*.tsx` — all share the whiteboard diagram
- `apps/examples/src/architecture/scenes/*.tsx` — any with manual layout or DiagramExit offsets
- All `apps/examples/src/brewflow-*/scenes/*.tsx` files that use `<DiagramExit to={...}>`
- Any slides scenes referencing diagram coordinates

Auto-layout scenes (GridLayout, HierarchicalLayout, FlowLayout with no explicit positions)
require **no position migration**. The compiler normalization handles them transparently.

---

## 7. Effort Estimate — Honest

This is a significant but tractable pre-ship change. The scope:

| Work Item | Effort | Notes |
|---|---|---|
| Type changes (`types.ts`, canvas `types.ts`) | 0.5 days | Straight type edits |
| DSL changes (`dsl.tsx`) + `pivot` removal | 0.5 days | Remove props, update JSDoc |
| Compiler: `compileDiagram()` normalization + `compilePivotOffset` removal | 1 day | New normalization logic; affects `compile.ts`, `groupCompiler.ts`, `transitionHelpers.ts` |
| Renderer: `normalizedToWorld` mapping in `NodeRenderer`, `EdgeRenderer`, `GroupRenderer` | 1 day | World-space mapping math; sizes also |
| Canvas widget: remove auto-framing onTick, add deterministic camera setup | 0.5 days | Delete ~70 lines, add ~20 |
| Scene file migration — auto-layout scenes | 0.5 days | Verify no regressions; no coord changes needed |
| Scene file migration — manual layout scenes | 1.5 days | Position conversion per scene; ~8-10 files |
| Scene file migration — DiagramExit/Enter | 0.5 days | Update to/from values |
| Tests: compiler normalization, renderer mapping, transition helpers | 0.5 days | Add normalization-specific tests |
| Visual QA (run dev server, verify each scene) | 0.5 days | Required after coordinate migration |
| **Total** | **6.5 days** | |

Pre-ship, breaking changes are free. There are no published external consumers of the
diagram DSL. This is a bounded, mechanical change. The whiteboard architecture diagram
(with ~60+ manually placed nodes at coordinates up to ±45 diagram units) is the most
labor-intensive migration target, but it is still mechanical: compute bounds, normalize,
replace.

What this change eliminates forever:
- Auto-framing magic that makes screens look different depending on how many nodes exist
- Magic numbers in `DiagramExit to={[0, -50, 0]}` (now: `to={[0.5, 2, 0]}` = 2 heights below)
- Multi-diagram Y separation guesswork (now: `viewportBounds` declarations)
- The "what camera parameters do I need?" authoring burden
- The NVS vs. diagram coordinate context-switch for authors and bots

---

## 8. Open Questions for Plan Phase

1. **Aspect ratio convention for sizes**: Does `size={[w, h]}` where `w` is fraction of
   viewport WIDTH and `h` is fraction of viewport HEIGHT match what we document for NVS
   TextBox? Confirm this is the right convention (not both fractions of height, or both of
   a fixed reference).

2. **`canvasAspect` source**: The renderer needs the canvas's aspect ratio to map viewport
   fractions to world-space correctly. This can come from: (a) `DiagramCanvasState` having
   an `aspect` field set from `DiagramCanvasDSL.w/h` + engine AR, (b) passed down at render
   time from the engine's AR container. Decision needed before implementation.

3. **DiagramCanvas.position world-space**: The canvas world-space `position` and `rotation`
   remain for placing the canvas tilt/position in the scene. These are world-space, not NVS.
   This is intentional — the canvas is a 3D object in the scene. Confirm this dual-mode
   (NVS ownership via `x/y/w/h`, world placement via `position/rotation/scale`) is expected.

4. **Interactive focus (applyInputFocus)**: After removing auto-framing, the interactive
   zoom-to-group must work with a fixed baseline camera. The `focusMesh` and `focusAll`
   methods write to `CAMERA_FOCUS_KEY`, which a camera-controls runtime reads. Confirm this
   mechanism survives the auto-framing removal, or specify what replaces it.

5. **DiagramPipe control points**: Pipes use canvas-local space for control points
   (computed from node positions via `nodeToCanvasSpace()`). After coordinate normalization,
   pipe control points must also use normalized space. The `compilePipe` function needs
   updating alongside `compileDiagram`. Include in the implementation plan.

---

## Summary

The inconsistency between NVS (bounded [0..1] top-left) and diagram space (unbounded
center-origin Cartesian) is a real architectural defect. The PM's previous assessment
that it was tolerable was wrong: "auto-framing saves you" IS the problem because it makes
the coordinate system output-defined, not input-defined.

The fix is Option A: align diagram node positions with NVS [0..1] top-left. This:
- Makes left edge = 0, right edge = 1, center = 0.5 — known at authoring time, always
- Eliminates auto-framing and replaces it with declared viewport bounds
- Aligns diagram authoring with the coordinate philosophy used by every other element
- Requires a normalization post-pass in `compileDiagram()` — layout algorithms are unchanged
- Is a breaking change to all manual-layout scene files — manageable pre-ship

Effort: ~6.5 developer days. No external consumer impact. Recommended to execute before
any diagram-related documentation or bot-authoring workflows are finalized.

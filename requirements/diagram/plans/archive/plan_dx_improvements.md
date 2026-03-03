---
title: "@brewsite/diagram DX Improvements — Implementation Plan"
doc_type: plan
owner: brewsite-architect
status: complete
updated: 2026-03-03
---

# @brewsite/diagram DX Improvements — Implementation Plan

## Overview

This plan implements all 12 findings from the DX audit at
`requirements/diagram/note_dx_audit_findings.md`. Findings are grouped into three semver
tiers and four sequential workstreams. Workstreams 1–3 are fully independent and run in
parallel (Phase 1). Workstream 4 runs after all Phase 1 workstreams are merged (Phase 2).

**Root cause addressed by this plan:** AI assistants and new developers consistently
produce blank diagram renders because (a) widget pre-registration is required but invisible
from the DSL, and (b) the ghost node trigger conflates two semantically different
authoring intents. These two issues (Findings 1 and 2) are addressed in WS4 (Phase 2).

---

## Final Agreed Scope

| Finding | Description | Treatment | Workstream |
|---|---|---|---|
| 5 | Coordinate spaces unlabeled in props | JSDoc only | WS1 |
| 10 | Ghost node feature undiscoverable | JSDoc only | WS1 |
| 11 | Theme hierarchy undocumented | JSDoc only | WS1 |
| 4 | Edge/pipe silent failures wrong channel | `onWarn` threading, better messages | WS2 |
| 7 (validation) | Misplaced `<Enter>`/`<Exit>` silent | Compiler placement warning | WS2 |
| 12 | ManualLayout missing-position error quality | `onWarn` threading, richer message | WS2 |
| 6 | Theme customization verbose spread | `mergeTheme()` helper | WS3 |
| 1 | Widget pre-registration blank canvas | `diagramPlugin()` auto-registration | WS4 |
| 2 | Ghost node trigger semantically wrong | `label: string | undefined`, trigger fix | WS4 |
| 3 | DiagramCanvas/Diagram confusion | Option A collapse via `diagramPlugin()` | WS4 |
| 7 (rename) | `Enter`/`Exit` removed, canonical names | `DiagramEnter`/`DiagramExit` | WS4 |
| 8 | Three emissive props expose Three.js | `glow?` prop, emissive fields removed | WS4 |
| 9 | `depth` prop name collision | `depth` removed, `thickness` canonical | WS4 |

---

## File Change Matrix

No two parallel workstreams (WS1/WS2/WS3) share a file. WS4 may overlap all files since
it is sequential.

| File | WS1 | WS2 | WS3 | WS4 |
|---|---|---|---|---|
| `elements/diagram/dsl.tsx` | ✓ | | | ✓ |
| `elements/diagram/types.ts` | | | | ✓ |
| `elements/diagram/compile.ts` | | ✓ | | ✓ |
| `elements/diagram/widget.ts` | | | | ✓ |
| `elements/diagram/compiler/nodeCompiler.ts` | | | | ✓ |
| `elements/diagram/compiler/edgeRouter.ts` | | ✓ | | |
| `elements/diagram/compiler/layoutAlgorithms.ts` | | ✓ | | ✓ |
| `elements/diagram/compiler/handlers.ts` → `compiler/handlers.ts` | | ✓ | | ✓ |
| `elements/diagram/canvas/compile.ts` | | ✓ | | |
| `elements/diagram/canvas/widget.ts` | | | | ✓ |
| `elements/diagram/canvas/dsl.tsx` | | | | ✓ |
| `elements/diagram/themes/*.ts` (4 files) | | | | ✓ |
| `elements/diagram/rendering/NodeRenderer.ts` | | | | ✓ |
| `elements/diagram/index.ts` | | | ✓ | ✓ |
| `src/index.ts` | | | ✓ | ✓ |
| `elements/diagram/themes/mergeTheme.ts` (new) | | | ✓ | |
| `src/player/diagramPlugin.ts` (new) | | | | ✓ |

---

## Phase 1 — Workstreams 1, 2, 3 (run in parallel)

---

## Workstream 1: Group A — JSDoc Improvements (Findings 5, 10, 11)

**Touches only:** `packages/diagram/src/elements/diagram/dsl.tsx`
**Semver impact:** None (documentation only)
**Blocked by:** Nothing — start immediately

### Scope

Fix incorrect "World-space" label on `DiagramNodeProps.position` (it is diagram-local, not
world-space). Document the ghost node feature on `DiagramNode`. Document the theme cascade
rule on `DiagramProps.theme`. Add coordinate-space prose to all `position` props.

### Detailed Changes

#### 1. `DiagramNodeProps.position` — fix coordinate space label + add context

Current (line ~59):
```typescript
/**
 * World-space position [x, y, z].
 * z controls depth — use for drill-down animations.
 * If omitted, auto-layout assigns a position based on declaration order.
 */
position?: [number, number, number];
```

Replace with:
```typescript
/**
 * Node position in diagram-local space [x, y, z].
 * x and y are in layout units (same units as `size`).
 * z creates depth layering: non-zero z values stack nodes at different depths
 * relative to the camera. The flat view has all nodes at z=0; drill-down scenes
 * use non-zero z to reveal the third dimension.
 *
 * When using `<GridLayout>` or `<HierarchicalLayout>`, omit this prop — the
 * layout engine assigns positions automatically. Only specify `position`
 * explicitly when using `<ManualLayout>`.
 *
 * Note: the parent `<Diagram pivot="...">` setting shifts the origin. With
 * `pivot="center"`, the diagram's bounding-box center becomes [0, 0, 0], so
 * all authored positions are relative to that center.
 *
 * If omitted and layout is manual, this is a ghost node (see `DiagramNode`
 * component documentation for ghost node behavior).
 */
position?: [number, number, number];
```

#### 2. `DiagramNodeProps.depth` — add physical-vs-z clarification

Current (line ~63):
```typescript
/** Physical box depth. Default: 0.4 */
depth?: number;
```

Replace with:
```typescript
/**
 * Physical thickness of the 3D prism box — how far it protrudes from the
 * canvas plane toward the camera. This is NOT z-axis positioning.
 * To change a node's z-axis position (depth layering), use `position[2]`.
 * Default: from theme (darkGlass: 0.4).
 */
depth?: number;
```

#### 3. `DiagramProps.position` — add canvas-local / world-space note

Current (line ~308):
```typescript
/** World/parent-space position. Default: [0, 0, 0] */
position?: [number, number, number];
```

Replace with:
```typescript
/**
 * Diagram origin position in parent space [x, y, z].
 * When inside a `<DiagramCanvas>`, this is canvas-local space — coordinates
 * relative to the canvas group origin. When used standalone, this is world space.
 * Default: [0, 0, 0]
 */
position?: [number, number, number];
```

#### 4. `DiagramProps.theme` — add cascade rule (Finding 11)

Current (line ~315):
```typescript
/**
 * Visual + behavioral theme for this diagram.
 * Overrides the canvas-level theme (if inside a DiagramCanvas).
 * Falls back to the package default (darkGlassTheme) when absent.
 * ...
 */
theme?: DiagramTheme;
```

Add one sentence at the top of the existing JSDoc:
```typescript
/**
 * Visual + behavioral theme for this diagram.
 * Overrides the parent `<DiagramCanvas>` theme for this diagram only.
 * If inside a DiagramCanvas and this prop is omitted, the canvas theme applies.
 * Falls back to darkGlassTheme when no canvas theme is present.
 * Per-node / per-edge props take precedence over all theme values.
 * ...
 */
theme?: DiagramTheme;
```

#### 5. `DiagramNode` component JSDoc — add ghost node feature (Finding 10)

Current (line ~112):
```typescript
/**
 * Declares a diagram node (shape with label).
 * Must be a direct or indirect child of <Diagram>.
 * Can be nested inside <DiagramGroup> to establish group membership.
 */
export function DiagramNode(_props: DiagramNodeProps): null {
```

Replace the JSDoc with:
```typescript
/**
 * Declares a diagram node (shape with label).
 * Must be a direct or indirect child of <Diagram>.
 * Can be nested inside <DiagramGroup> to establish group membership.
 *
 * ### Ghost Nodes
 *
 * When `label` is omitted, this node is a **ghost node** — it inherits its
 * visual identity (label, sublabel, shape, icon, size) from the matching node
 * in the previous scene. Ghost nodes enable drill-down animations where a prior
 * scene's diagram appears as faded context behind the new focal point.
 *
 * To make a node appear as a ghost:
 * - Omit the `label` prop entirely (do NOT pass `label=""`).
 * - Optionally set `opacity` to reduce visual weight (e.g., `opacity={0.3}`).
 * - In a manual-layout diagram, also omit `position` — it will be inherited.
 *
 * @example
 * // Scene 1: full diagram with named nodes
 * <DiagramNode id="api" label="API Gateway" icon="aws:api-gateway" size={[4, 2]} />
 *
 * // Scene 2: api appears as ghost context (no label = inherit identity from Scene 1)
 * <DiagramNode id="api" opacity={0.3} />
 * // ↑ inherits label, icon, shape, size from Scene 1; only opacity changes
 *
 * Contrast with an intentionally labelless node (NOT a ghost):
 * // This node has a label — it is an empty string, not absent.
 * <DiagramNode id="cdn" label="" size={[3, 2]} color="#1a3d5c" />
 * // ↑ fully-declared node, no inheritance from prior scenes
 */
export function DiagramNode(_props: DiagramNodeProps): null {
```

### Testing

No code logic changes — no tests required for JSDoc-only changes.

---

## Workstream 2: Group B — onWarn Threading + Placement Validation (Findings 4, 7-val, 12)

**Touches:** `elements/diagram/compile.ts`, `elements/diagram/compiler/edgeRouter.ts`,
`elements/diagram/compiler/layoutAlgorithms.ts`, `elements/diagram/canvas/compile.ts`,
`compiler/handlers.ts`
**Semver impact:** Minor (additive optional parameters to exported functions)
**Blocked by:** Nothing — runs in parallel with WS1 and WS3

### Scope

1. Add `DiagramWarnFn` type to `elements/diagram/types.ts`.
2. Add optional `onWarn?: DiagramWarnFn` to `compileDiagram`, `routeEdges`,
   `compilePipe`, `resolveLayout` / `resolveLayoutWithGroups`.
3. Replace all `console.warn` calls for user-facing errors in those functions with
   `onWarn?.(code, message)` — with richer message content including diagram ID, scene
   context, and specific entity IDs.
4. In `layoutAlgorithms.ts`, change the ManualLayout `throw new Error` to `onWarn` so
   it doesn't crash the compiler (emit a warning instead).
5. Add placement validation for misplaced `<Enter>`/`<Exit>` in `handlers.ts`.
6. Update `handlers.ts` to thread `onWarn` adaptor into each `compileDiagram` /
   `compileCanvas` / `compilePipe` call.

### New Type: `DiagramWarnFn`

Add to `packages/diagram/src/elements/diagram/types.ts` (append at end):

```typescript
/**
 * Callback for compile-time warnings emitted by diagram compilation functions.
 * handlers.ts adapts this into CompileApi.pushWarning().
 * @internal — consumed by handlers.ts, not part of consumer-facing DSL.
 */
export type DiagramWarnFn = (code: string, message: string) => void;
```

### File: `elements/diagram/compile.ts`

#### Change `compileDiagram` signature

Before:
```typescript
export function compileDiagram(
  dsl: DiagramDSL,
  fallbackTheme: DiagramTheme = darkGlassTheme,
): DiagramState {
```

After:
```typescript
export function compileDiagram(
  dsl: DiagramDSL,
  fallbackTheme: DiagramTheme = darkGlassTheme,
  onWarn?: DiagramWarnFn,
): DiagramState {
```

#### Thread `onWarn` to `routeEdges` and internal layout calls

Inside `compileDiagram`, change:
```typescript
// Before (line ~103):
dsl.groups.forEach((group) => {
  group.nodeIds.forEach((nodeId) => {
    if (groupMap.has(nodeId) && groupMap.get(nodeId) !== group.id) {
      console.warn(`Diagram compileDiagram: node ${nodeId} assigned to multiple groups.`);
    }
```

After:
```typescript
dsl.groups.forEach((group) => {
  group.nodeIds.forEach((nodeId) => {
    if (groupMap.has(nodeId) && groupMap.get(nodeId) !== group.id) {
      onWarn?.(
        'DUPLICATE_GROUP_MEMBERSHIP',
        `Diagram "${dsl.id}": node "${nodeId}" assigned to multiple groups. Only the last assignment applies.`,
      );
    }
```

Change the `routeEdges` call to thread `onWarn`:
```typescript
// Before:
const controlPointsMap = routeEdges(
  edgesForRouting,
  positions,
  sizeWithDepthMap,
  theme.edge.routing,
  theme.edge.landing,
);

// After:
const controlPointsMap = routeEdges(
  edgesForRouting,
  positions,
  sizeWithDepthMap,
  theme.edge.routing,
  theme.edge.landing,
  onWarn,
);
```

Also update the call to `resolveLayoutWithGroups` to thread `onWarn`:
```typescript
// Locate where resolveLayoutWithGroups is called and add onWarn as final param.
const positions = resolveLayoutWithGroups(
  dsl.nodes,
  dsl.edges,
  dsl.groups,
  rootLayout,
  groupLayouts,
  sizeWithDepthMap,
  onWarn,       // ← add
);
```

### File: `elements/diagram/compiler/edgeRouter.ts`

#### Change `routeEdges` signature

The `routeEdges` function is exported. Add optional `onWarn` param at the end.

Before:
```typescript
export function routeEdges(
  edges: ReadonlyArray<DiagramEdgeDSL & { thickness: number }>,
  positions: Map<string, readonly [number, number, number]>,
  sizes: Map<string, readonly [number, number, number]>,
  defaultRouting: EdgeRoutingAlgorithm,
  defaultLanding: EdgeLandingAlgorithm,
): Map<string, ReadonlyArray<Vec3>> {
```

After:
```typescript
export function routeEdges(
  edges: ReadonlyArray<DiagramEdgeDSL & { thickness: number }>,
  positions: Map<string, readonly [number, number, number]>,
  sizes: Map<string, readonly [number, number, number]>,
  defaultRouting: EdgeRoutingAlgorithm,
  defaultLanding: EdgeLandingAlgorithm,
  onWarn?: DiagramWarnFn,
): Map<string, ReadonlyArray<Vec3>> {
```

Add import for `DiagramWarnFn` at top of file:
```typescript
import type { DiagramWarnFn } from '../types';
```

Replace the `console.warn` for missing node endpoints (line ~963):

Before:
```typescript
if (!fromPos || !toPos || !fromSize || !toSize) {
  console.warn(`Diagram routeEdges: missing node(s) for edge ${edge.from} -> ${edge.to}`);
  result.set(id, []);
  return;
}
```

After:
```typescript
if (!fromPos || !toPos || !fromSize || !toSize) {
  const missingId = !fromPos || !fromSize ? edge.from : edge.to;
  onWarn?.(
    'MISSING_EDGE_ENDPOINT',
    `<DiagramEdge from="${edge.from}" to="${edge.to}">: node "${missingId}" not found. ` +
      `Check that "${missingId}" exactly matches a sibling <DiagramNode id="${missingId}"> ` +
      `in the same <Diagram>.`,
  );
  result.set(id, []);
  return;
}
```

### File: `elements/diagram/compiler/layoutAlgorithms.ts`

#### Change `resolveLayout` signature

Before:
```typescript
export function resolveLayout(
  nodes: ReadonlyArray<DiagramNodeDSL>,
  edges: ReadonlyArray<DiagramEdgeDSL>,
  layout: ResolvedLayout,
): Map<string, readonly [number, number, number]> {
```

After:
```typescript
export function resolveLayout(
  nodes: ReadonlyArray<DiagramNodeDSL>,
  edges: ReadonlyArray<DiagramEdgeDSL>,
  layout: ResolvedLayout,
  onWarn?: DiagramWarnFn,
): Map<string, readonly [number, number, number]> {
```

Add import at top:
```typescript
import type { DiagramWarnFn } from '../types';
```

#### Change `resolveLayoutWithGroups` signature (internal function)

Same pattern — add `onWarn?: DiagramWarnFn` as last param and thread it to `resolveLayout`
calls inside.

#### Replace `throw new Error` for ManualLayout missing positions (Finding 12)

Before (line ~48):
```typescript
if (layout.kind === 'manual') {
  const nonGhostMissing = missing.filter((n) => !!n.label);
  if (nonGhostMissing.length > 0) {
    throw new Error(
      'Diagram layout is manual but one or more non-ghost nodes are missing positions. ' +
        'Ghost nodes (no label prop) may omit position — it will be inherited from the previous scene.',
    );
  }
  return positions;
}
```

After:
```typescript
if (layout.kind === 'manual') {
  const nonGhostMissing = missing.filter((n) => !!n.label);  // keep !!n.label — ghost semantic unchanged in WS2
  if (nonGhostMissing.length > 0) {
    const ids = nonGhostMissing.map((n) => `"${n.id}"`).join(', ');
    onWarn?.(
      'MISSING_LAYOUT_POSITION',
      `ManualLayout: ${nonGhostMissing.length} non-ghost node(s) have no explicit position: ${ids}. ` +
        `Add position={[x, y, z]} to each, or switch to <GridLayout> / <HierarchicalLayout> ` +
        `to auto-compute positions. Ghost nodes (label prop absent) may omit position safely.`,
    );
  }
  return positions;
}
```

**Important:** Leave the filter as `!!n.label` in WS2. Do NOT change ghost detection
semantics here — that is a breaking behavioral change and belongs exclusively in WS4.
The `onWarn` threading is the only change in WS2 for this function.

Note: this changes from a compile-time `throw` to a `onWarn` call, returning `positions`
(with those nodes absent from the map). Downstream code in `compile.ts` will set
`positionInherited = true` for nodes with no position in the map, which produces ghost
behavior. This is acceptable: without a position the node simply won't render in the right
place, and the warning clearly explains the fix.

**Rationale for not throwing:** A compile-time error in the middle of compilation leaves
the SceneTrack in a broken state. A warning lets compilation complete with a visible
diagnostic, which is more useful in development.

### File: `elements/diagram/canvas/compile.ts`

#### Change `compilePipe` signature

Add import at top:
```typescript
import type { DiagramWarnFn } from '../types';
```

Before:
```typescript
export function compilePipe(
  dsl: DiagramPipeDSL,
  diagrams: ReadonlyArray<DiagramState>,
  index: number,
  routing: PipeRoutingAlgorithm = DEFAULT_PIPE_ROUTING,
  landing: PipeLandingAlgorithm = DEFAULT_PIPE_LANDING,
): DiagramPipeState {
```

After:
```typescript
export function compilePipe(
  dsl: DiagramPipeDSL,
  diagrams: ReadonlyArray<DiagramState>,
  index: number,
  routing: PipeRoutingAlgorithm = DEFAULT_PIPE_ROUTING,
  landing: PipeLandingAlgorithm = DEFAULT_PIPE_LANDING,
  onWarn?: DiagramWarnFn,
): DiagramPipeState {
```

Replace `console.warn` calls inside `compilePipe`:

Before (line ~104):
```typescript
if (!fromRef || !toRef) {
  console.warn(
    `DiagramCanvas compilePipe: invalid dot-notation reference in pipe "${id}". ` +
      'Expected "diagramId.nodeId" format.',
  );
} else {
  // ...
  if (!fromDiagram || !fromNode) {
    console.warn(
      `DiagramCanvas compilePipe: cannot resolve from="${dsl.from}" in pipe "${id}".`,
    );
  } else if (!toDiagram || !toNode) {
    console.warn(
      `DiagramCanvas compilePipe: cannot resolve to="${dsl.to}" in pipe "${id}".`,
    );
  }
}
```

After:
```typescript
if (!fromRef || !toRef) {
  const bad = !fromRef ? dsl.from : dsl.to;
  onWarn?.(
    'INVALID_PIPE_REF',
    `<DiagramPipe id="${id}">: "${bad}" is not valid dot notation. ` +
      `Expected "diagramId.nodeId" (e.g. "frontend.api"). ` +
      `Both diagramId and nodeId must be non-empty.`,
  );
} else {
  // ...
  if (!fromDiagram || !fromNode) {
    const missingPart = !fromDiagram ? `diagram "${fromRef.diagramId}"` : `node "${fromRef.nodeId}" in diagram "${fromRef.diagramId}"`;
    onWarn?.(
      'MISSING_PIPE_ENDPOINT',
      `<DiagramPipe id="${id}"> from="${dsl.from}": could not resolve ${missingPart}. ` +
        `Check that the diagram id and node id both exactly match a child <Diagram id="..."> ` +
        `and its <DiagramNode id="...">.`,
    );
  } else if (!toDiagram || !toNode) {
    const missingPart = !toDiagram ? `diagram "${toRef.diagramId}"` : `node "${toRef.nodeId}" in diagram "${toRef.diagramId}"`;
    onWarn?.(
      'MISSING_PIPE_ENDPOINT',
      `<DiagramPipe id="${id}"> to="${dsl.to}": could not resolve ${missingPart}. ` +
        `Check that the diagram id and node id both exactly match a child <Diagram id="..."> ` +
        `and its <DiagramNode id="...">.`,
    );
  }
}
```

Also update `compileCanvas` (the caller of `compilePipe`) to accept and thread `onWarn`:
```typescript
export function compileCanvas(
  dsl: DiagramCanvasDSL,
  diagrams: ReadonlyArray<DiagramState>,
  pipes: ReadonlyArray<DiagramPipeDSL>,
  onWarn?: DiagramWarnFn,
): DiagramCanvasState {
```

Thread `onWarn` through each `compilePipe(...)` call inside `compileCanvas`:
```typescript
// Before:
return compilePipe(pipeDsl, diagrams, index, routing, landing);
// After:
return compilePipe(pipeDsl, diagrams, index, routing, landing, onWarn);
```

### File: `compiler/handlers.ts`

#### Add import for DiagramWarnFn

```typescript
import type { DiagramWarnFn } from '../elements/diagram/types';
```

#### Create `onWarn` adaptor helper (inside `registerDiagramHandlers`)

Inside `registerDiagramHandlers`, define a local helper to build the adaptor:
```typescript
const makeWarnFn = (api: CompileApi): DiagramWarnFn => (code, message) => {
  const warnApi = api as CompileApi & {
    pushWarning?: (w: { code: string; message: string; sceneIndex?: number }) => void;
  };
  warnApi.pushWarning?.({ code, message, sceneIndex: api.context.sceneIndex });
};
```

#### Thread `onWarn` into `compileDiagram` calls

In the standalone `Diagram` handler:
```typescript
registerNode(Diagram, (node: ReactElement, api: CompileApi, helpers: CompileHelpers) => {
  const dsl = extractDiagramDSL(node, helpers);
  const onWarn = makeWarnFn(api);
  const state = compileDiagram(dsl, undefined, onWarn);   // ← thread onWarn
  const widgetId = String((node.props as { id?: string }).id ?? dsl.id);
  api.setWidgetState(widgetId, state);
});
```

In the `DiagramCanvas` handler, thread `onWarn` through both `compileDiagram` and
`compileCanvas`:
```typescript
registerNode(DiagramCanvas, (node: ReactElement, api: CompileApi, helpers: CompileHelpers) => {
  // ... (existing logic)
  const onWarn = makeWarnFn(api);

  for (const child of allChildren) {
    // ...
    const dsl = extractDiagramDSL(el, helpers);
    diagramStates.push(compileDiagram(dsl, canvasTheme, onWarn));  // ← add onWarn
  }
  // ...
  const canvasState = compileCanvas(canvasDSL, diagramStates, pipeDSLs, onWarn);  // ← add onWarn
  api.setWidgetState(String(props.id), canvasState);
});
```

#### Add placement validation for `<Enter>`/`<Exit>` inside groups (Finding 7 validation)

In `extractDiagramDSL`'s `collectGroup` function, inside the inner `for (const gc of groupChildren)` loop, add detection of misplaced `Enter`/`Exit`:

```typescript
// After handling gEl.type === ManualLayout, add:
} else if (gEl.type === Enter || gEl.type === Exit) {
  const componentName = gEl.type === Enter ? 'Enter' : 'Exit';
  // We don't have api here, so accept a warnFn param on collectGroup
  // (thread warnFn through from extractDiagramDSL's caller)
  warnFn?.(
    'MISPLACED_DIAGRAM_TRANSITION',
    `<${componentName}> found inside <DiagramGroup id="${groupId}">. ` +
      `<${componentName}> must be a direct child of <Diagram>, not nested inside a group. ` +
      `Move it to be a sibling of the top-level <DiagramNode> and <DiagramGroup> elements.`,
  );
}
```

To make this work, change `collectGroup` signature to accept an optional `warnFn`:
```typescript
const collectGroup = (
  el: ReactElement,
  parentId?: string,
  warnFn?: DiagramWarnFn,
): string => { ... }
```

And thread it through the recursive `collectGroup(gEl, groupId, warnFn)` call for nested
groups.

In `extractDiagramDSL`, change the call site:
```typescript
// Accept warnFn as param on extractDiagramDSL
const extractDiagramDSL = (
  node: ReactElement,
  helpers: CompileHelpers,
  warnFn?: DiagramWarnFn,
): DiagramDSL => { ... }

// And in the group collection loop:
} else if (el.type === DiagramGroup) {
  collectGroup(el, undefined, warnFn);
}
```

In the `Diagram` and `DiagramCanvas` handlers, pass `makeWarnFn(api)` as the `warnFn`:
```typescript
const dsl = extractDiagramDSL(el, helpers, onWarn);  // ← add onWarn
```

Also add validation for duplicate `<Enter>` or `<Exit>` at the top-level (at most one per
diagram). In `extractDiagramDSL`, track whether `exitDSL` and `enterDSL` were already set:
```typescript
} else if (el.type === Exit) {
  if (exitDSL) {
    warnFn?.('DUPLICATE_DIAGRAM_TRANSITION', `<Diagram id="${String(props.id)}">: multiple <Exit> elements found. Only the last one is used.`);
  }
  exitDSL = el.props as DiagramExitDSL;
} else if (el.type === Enter) {
  if (enterDSL) {
    warnFn?.('DUPLICATE_DIAGRAM_TRANSITION', `<Diagram id="${String(props.id)}">: multiple <Enter> elements found. Only the last one is used.`);
  }
  enterDSL = el.props as DiagramEnterDSL;
}
```

#### Remove the MISSING_WIDGET warning block from DiagramCanvas handler

The existing MISSING_WIDGET warning block:
```typescript
if (canvasId && registry && !registry.get(canvasId)) {
  const warnApi = api as CompileApi & { pushWarning?: ... };
  warnApi.pushWarning?.({
    code: 'MISSING_WIDGET',
    message: `<DiagramCanvas id="${canvasId}"> has no corresponding DiagramCanvasWidget registered...`,
    ...
  });
}
```

In WS2, leave this block as-is — it is replaced in WS4 (Finding 1) when auto-registration
is implemented.

### Testing for WS2

File: `packages/diagram/src/__tests__/warnThreading.test.ts` (new)

Test strategy: interface-based stateful tests on pure compile functions.

```typescript
// Test 1: compileDiagram threads onWarn for unknown edges
it('compileDiagram calls onWarn for edges referencing missing nodes', () => {
  const warns: Array<{ code: string; message: string }> = [];
  const onWarn: DiagramWarnFn = (code, message) => warns.push({ code, message });
  compileDiagram(
    {
      id: 'test',
      nodes: [{ id: 'a' }],
      edges: [{ from: 'a', to: 'NONEXISTENT' }],
      groups: [],
    },
    darkGlassTheme,
    onWarn,
  );
  expect(warns).toHaveLength(1);
  expect(warns[0]!.code).toBe('MISSING_EDGE_ENDPOINT');
  expect(warns[0]!.message).toContain('"NONEXISTENT"');
});

// Test 2: onWarn absent — no throw for edge routing failures
it('compileDiagram does not throw when onWarn is absent and edge references missing node', () => {
  expect(() =>
    compileDiagram({
      id: 'test',
      nodes: [{ id: 'a' }],
      edges: [{ from: 'a', to: 'missing' }],
      groups: [],
    }),
  ).not.toThrow();
});

// Test 3: ManualLayout missing positions routes through onWarn
it('resolveLayout emits MISSING_LAYOUT_POSITION when manual layout node has no position', () => {
  const warns: Array<{ code: string; message: string }> = [];
  const onWarn: DiagramWarnFn = (code, message) => warns.push({ code, message });
  resolveLayout(
    [{ id: 'a', label: 'A' }],
    [],
    { kind: 'manual' },
    onWarn,
  );
  expect(warns[0]!.code).toBe('MISSING_LAYOUT_POSITION');
  expect(warns[0]!.message).toContain('"a"');
});

// Test 4: compilePipe emits INVALID_PIPE_REF for bad dot-notation
it('compilePipe emits INVALID_PIPE_REF for malformed from reference', () => {
  const warns: Array<{ code: string; message: string }> = [];
  compilePipe(
    { from: 'no-dot-here', to: 'a.b' },
    [],
    0,
    'curved',
    'sides',
    (code, msg) => warns.push({ code, message: msg }),
  );
  expect(warns[0]!.code).toBe('INVALID_PIPE_REF');
});

// Test 5: extractDiagramDSL warns when Enter is inside a DiagramGroup
// (tested via compileDiagram with the handler — use real handler integration)
```

---

## Workstream 3: Group B — `mergeTheme` Helper (Finding 6)

**Touches:** new `elements/diagram/themes/mergeTheme.ts`, `elements/diagram/index.ts`,
`src/index.ts`
**Semver impact:** Minor (additive new export)
**Blocked by:** Nothing — runs in parallel with WS1 and WS2

### Scope

Export a `mergeTheme(base, overrides)` helper that performs a deep-partial merge on a
`DiagramTheme` object. Pure function. No imports from runtime, Three.js, or React.

### New File: `packages/diagram/src/elements/diagram/themes/mergeTheme.ts`

```typescript
// Pure helper for deep-partial theme overrides.

import type { DiagramTheme } from '../types';

/**
 * Utility type for deep-partial objects.
 * @internal — used by mergeTheme signature only.
 */
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends ReadonlyArray<infer U>
    ? ReadonlyArray<U>
    : T[P] extends object
    ? DeepPartial<T[P]>
    : T[P];
};

/**
 * Produces a new DiagramTheme by merging `overrides` (deep-partial) onto `base`.
 * Nested objects are merged recursively. Arrays and primitives are replaced (not merged).
 * Neither `base` nor `overrides` is mutated.
 *
 * @example
 * const myTheme = mergeTheme(darkGlassTheme, {
 *   node: { defaultColor: '#2a1a40' },
 *   edge: { routing: 'orthogonal', defaultColor: '#ff6b35' },
 * });
 */
export function mergeTheme(base: DiagramTheme, overrides: DeepPartial<DiagramTheme>): DiagramTheme {
  return deepMerge(base, overrides) as DiagramTheme;
}

function deepMerge<T extends object>(base: T, overrides: DeepPartial<T>): T {
  const result = { ...base } as Record<string, unknown>;
  for (const key of Object.keys(overrides) as Array<keyof typeof overrides>) {
    const overrideVal = overrides[key];
    if (overrideVal === undefined) continue;
    const baseVal = base[key as keyof T];
    if (
      overrideVal !== null &&
      typeof overrideVal === 'object' &&
      !Array.isArray(overrideVal) &&
      baseVal !== null &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal)
    ) {
      result[key as string] = deepMerge(
        baseVal as object,
        overrideVal as DeepPartial<typeof baseVal>,
      );
    } else {
      result[key as string] = overrideVal;
    }
  }
  return result as T;
}
```

### Update `elements/diagram/index.ts`

Add export for `mergeTheme`:
```typescript
export { mergeTheme } from './themes/mergeTheme';
```

### Update `src/index.ts`

Add export for `mergeTheme`:
```typescript
export { mergeTheme } from './elements/diagram/themes/mergeTheme';
```

### Testing for WS3

File: `packages/diagram/src/elements/diagram/themes/__tests__/mergeTheme.test.ts` (new)

```typescript
import { mergeTheme } from '../mergeTheme';
import { darkGlassTheme } from '../darkGlass';

it('mergeTheme preserves unmentioned fields from base', () => {
  const result = mergeTheme(darkGlassTheme, { node: { defaultColor: '#ff0000' } });
  expect(result.node.defaultColor).toBe('#ff0000');
  expect(result.node.defaultMetalness).toBe(darkGlassTheme.node.defaultMetalness);
  expect(result.edge).toEqual(darkGlassTheme.edge);
  expect(result.group).toEqual(darkGlassTheme.group);
});

it('mergeTheme does not mutate base theme', () => {
  const original = darkGlassTheme.node.defaultColor;
  mergeTheme(darkGlassTheme, { node: { defaultColor: '#000' } });
  expect(darkGlassTheme.node.defaultColor).toBe(original);
});

it('mergeTheme merges nested objects (edge config)', () => {
  const result = mergeTheme(darkGlassTheme, {
    edge: { routing: 'orthogonal' },
  });
  expect(result.edge.routing).toBe('orthogonal');
  expect(result.edge.defaultColor).toBe(darkGlassTheme.edge.defaultColor);
  expect(result.edge.defaultThickness).toBe(darkGlassTheme.edge.defaultThickness);
});

it('mergeTheme replaces arrays wholesale (not element-wise)', () => {
  const result = mergeTheme(darkGlassTheme, { palette: ['#aaa', '#bbb'] });
  expect(result.palette).toEqual(['#aaa', '#bbb']);
});
```

---

## Phase 2 — Workstream 4 (runs AFTER WS1 + WS2 + WS3 are merged)

---

## Workstream 4: Group C — All Breaking Changes (Findings 1, 2, 3, 7-rename, 8, 9)

**This is a MAJOR version bump for `@brewsite/diagram`.**

**Touches (all files):**
- `packages/diagram/src/elements/diagram/dsl.tsx`
- `packages/diagram/src/elements/diagram/types.ts`
- `packages/diagram/src/elements/diagram/compile.ts`
- `packages/diagram/src/elements/diagram/widget.ts` (kept private; removed from public API)
- `packages/diagram/src/elements/diagram/compiler/nodeCompiler.ts`
- `packages/diagram/src/elements/diagram/compiler/layoutAlgorithms.ts`
- `packages/diagram/src/elements/diagram/canvas/widget.ts`
- `packages/diagram/src/elements/diagram/canvas/dsl.tsx`
- `packages/diagram/src/elements/diagram/themes/darkGlass.ts`
- `packages/diagram/src/elements/diagram/themes/enterprise.ts`
- `packages/diagram/src/elements/diagram/themes/neonCyber.ts`
- `packages/diagram/src/elements/diagram/themes/lightMinimal.ts`
- `packages/diagram/src/elements/diagram/rendering/NodeRenderer.ts` (all `node.depth` reads)
- `packages/diagram/src/elements/diagram/render.ts` (all `node.depth` reads)
- `packages/diagram/src/compiler/handlers.ts`
- `packages/diagram/src/elements/diagram/index.ts`
- `packages/diagram/src/index.ts`
- `packages/diagram/src/player/diagramPlugin.ts` (new file)

**All changes within WS4 are done in a single commit on a single branch.** There are no
sub-workstreams inside WS4 — all files are edited together in the correct dependency order
specified below.

### Implementation Order Within WS4

Edit files in this exact order to avoid TypeScript errors during the edit session:

1. `types.ts` — update type contracts first (all consumers depend on this)
2. `dsl.tsx` — update DSL surface (depends on `types.ts`)
3. `compiler/nodeCompiler.ts` — update compile logic (depends on `types.ts`)
4. `compile.ts` — minor updates (depends on `nodeCompiler.ts`)
5. `compiler/layoutAlgorithms.ts` — ghost detection fix (depends on `types.ts`)
6. `widget.ts` — update mergeSnapshot (depends on `types.ts`)
7. `canvas/widget.ts` — update mergeSnapshot (depends on `types.ts`)
8. `canvas/dsl.tsx` — update JSDoc
9. `themes/*.ts` (4 files) — rename `defaultDepth` → `defaultThickness`
10. `rendering/NodeRenderer.ts` — rename `node.depth` reads
11. `render.ts` — rename `node.depth` reads (search thoroughly — see note below)
12. `compiler/handlers.ts` — add auto-registration + rename Enter/Exit → DiagramEnter/DiagramExit
13. `player/diagramPlugin.ts` — new file
14. `elements/diagram/index.ts` — update exports
15. `src/index.ts` — update exports

---

### Finding 9: `depth` → `thickness` (DSL + State + Theme)

#### `types.ts`: `DiagramNodeState.depth` → `DiagramNodeState.thickness`

Find:
```typescript
/**
 * Physical box depth in diagram units.
 * ...
 */
readonly depth: number;
```

Replace with:
```typescript
/**
 * Physical thickness of the 3D prism box in diagram units — how far it protrudes
 * toward the camera. NOT the same as z-axis depth layering (use `position[2]` for that).
 * Recommended defaults: 0.4 for standard nodes, 0.8 for hero/expanded nodes.
 */
readonly thickness: number;
```

Also in `DiagramThemeNodeConfig`:

Find:
```typescript
/** Physical box depth in diagram units. 0.28 = card-like, 0.6 = block-like */
readonly defaultDepth: number;
```

Replace with:
```typescript
/**
 * Default physical thickness of node prism boxes in diagram units.
 * 0.28 = card-like, 0.6 = block-like.
 */
readonly defaultThickness: number;
```

#### `dsl.tsx`: `DiagramNodeProps.depth` → `DiagramNodeProps.thickness`

Find:
```typescript
/**
 * Physical thickness of the 3D prism box — how far it protrudes from the
 * canvas plane toward the camera. This is NOT z-axis positioning.
 * To change a node's z-axis position (depth layering), use `position[2]`.
 * Default: from theme (darkGlass: 0.4).
 */
depth?: number;
```

Replace with (note: WS1 may have already updated the JSDoc comment — merge as needed):
```typescript
/**
 * Physical thickness of the 3D prism box in diagram units — how far it protrudes
 * toward the camera. NOT z-axis depth layering (use `position[2]` for that).
 * Default: from theme (darkGlass: 0.4).
 */
thickness?: number;
```

#### `compiler/nodeCompiler.ts`: `buildNodeDefaults` + `compileNode`

In `buildNodeDefaults`:
```typescript
// Before:
depth: theme.node.defaultDepth,

// After:
thickness: theme.node.defaultThickness,
```

In `compileNode` return object:
```typescript
// Before:
depth: dsl.depth ?? nd.depth,

// After:
thickness: dsl.thickness ?? nd.thickness,
```

Also update `DiagramNodeDSL` usage. In `nodeCompiler.ts`, the `dsl.depth` reference
changes to `dsl.thickness`. Note: `DiagramNodeDSL` is defined in `types.ts` — change
its `depth?: number` to `thickness?: number` there (already handled in types.ts step
above — just ensure nodeCompiler reads `dsl.thickness`).

In `compile.ts`, the `sizeWithDepthMap` calculation also reads node depth:
```typescript
// Before:
const depth = node.depth ?? nd.depth;
sizeWithDepthMap.set(node.id, [size[0], size[1], depth]);

// After:
const thickness = node.thickness ?? nd.thickness;
sizeWithDepthMap.set(node.id, [size[0], size[1], thickness]);
```

(The variable can remain named whatever internally — `depth` as a local variable is fine.
What matters is reading `node.thickness` not `node.depth` from the DSL.)

#### `widget.ts` (DiagramWidget.mergeSnapshot)

In the merge logic for `positionInherited`:
```typescript
// Before:
depth: node.positionInherited ? prevNode.depth : node.depth,

// After:
thickness: node.positionInherited ? prevNode.thickness : node.thickness,
```

#### `canvas/widget.ts` (DiagramCanvasWidget.mergeSnapshot)

Same change — find `depth:` in the mergeSnapshot spread and rename to `thickness:`.

#### Theme files (4 files)

In each of `darkGlass.ts`, `enterprise.ts`, `neonCyber.ts`, `lightMinimal.ts`:

Find:
```typescript
defaultDepth: /* some number */,
```

Replace with:
```typescript
defaultThickness: /* same number */,
```

#### `rendering/NodeRenderer.ts` and `render.ts`

Search for ALL references to `node.depth` in these files. These are in the Three.js layer
and control the geometry extrusion depth. Replace every `node.depth` with `node.thickness`.

**IMPORTANT:** Do a full-file search for `.depth` in the render path files. A missed rename
here produces a silent `undefined` geometry depth (box collapses to zero thickness, renders
invisible). Search command to verify no missed references after implementing:

```bash
pnpm --filter @brewsite/diagram grep "node\.depth" src/
```

This should return zero results after the rename is complete.

---

### Finding 2: Ghost Node Semantic Fix (`label: string → string | undefined`)

#### `types.ts`: `DiagramNodeState.label`

Before:
```typescript
/** Primary display label */
readonly label: string;
```

After:
```typescript
/**
 * Primary display label.
 * `undefined` means this is a ghost node — it inherits its visual identity
 * (label, sublabel, shape, icon, size) from the matching node in the previous scene.
 * `''` (empty string) is a fully-declared node with an empty text label.
 */
readonly label: string | undefined;
```

Also change `DiagramNodeDSL.label` (already `label?: string`) — no change needed there,
it's already optional. The issue was the compile step defaulting it to `''`.

#### `compiler/nodeCompiler.ts`: `compileNode` — remove `?? ''` default

Before:
```typescript
label: dsl.label ?? '',
```

After:
```typescript
label: dsl.label,
```

That's the entire bug fix for Finding 2 at the compile level. `dsl.label` is `string |
undefined`, so the compiled state correctly preserves `undefined`.

#### `widget.ts` (DiagramWidget.mergeSnapshot) — ghost trigger

Before (line ~212):
```typescript
if (node.label !== '' && !node.positionInherited) return node;
```

After:
```typescript
if (node.label !== undefined && !node.positionInherited) return node;
```

Also in the merge spread, update all `node.label !== ''` checks to `node.label !== undefined`:
```typescript
// Before:
label:        node.label !== '' ? node.label        : prevNode.label,
sublabel:     node.label !== '' ? node.sublabel     : prevNode.sublabel,
shape:        node.label !== '' ? node.shape        : prevNode.shape,
iconUrl:      node.label !== '' ? node.iconUrl      : prevNode.iconUrl,
iconScale:    node.label !== '' ? node.iconScale    : prevNode.iconScale,
sublabelColor: node.label !== '' ? node.sublabelColor : prevNode.sublabelColor,

// After:
label:        node.label !== undefined ? node.label        : prevNode.label,
sublabel:     node.label !== undefined ? node.sublabel     : prevNode.sublabel,
shape:        node.label !== undefined ? node.shape        : prevNode.shape,
iconUrl:      node.label !== undefined ? node.iconUrl      : prevNode.iconUrl,
iconScale:    node.label !== undefined ? node.iconScale    : prevNode.iconScale,
sublabelColor: node.label !== undefined ? node.sublabelColor : prevNode.sublabelColor,
```

#### `canvas/widget.ts` (DiagramCanvasWidget.mergeSnapshot)

Same changes — replace ALL `node.label !== ''` with `node.label !== undefined`.

#### `compiler/layoutAlgorithms.ts` — ghost detection in ManualLayout

Before:
```typescript
const nonGhostMissing = missing.filter((n) => !!n.label);
```

After:
```typescript
const nonGhostMissing = missing.filter((n) => n.label !== undefined);
```

**Note:** WS2 left this filter as `!!n.label` (intentionally — ghost semantics are
unchanged in the minor release). WS4 changes it here to `n.label !== undefined` as part
of the ghost semantic fix. Do not assume WS2 already changed this — apply the change
in WS4 regardless.

#### Rendering layer: `node.label` now `string | undefined`

In `rendering/NodeRenderer.ts` (or wherever troika-three-text text is set), the label
text assignment should handle `undefined`:
```typescript
// Before (likely):
textMesh.text = node.label;

// After:
textMesh.text = node.label ?? '';
```

The render layer treats `undefined` as empty string — the visual is empty text (ghost
nodes have inherited the label from the previous scene's merged state by this point, so
the text mesh will have the correct label from the merged `DiagramNodeState`).

---

### Finding 8: `glow?` Prop — Remove `emissive`/`emissiveIntensity`/`emissiveColor`

#### `types.ts`: Add `GlowConfig` type, update `DiagramNodeDSL`

Add new type before `DiagramNodeDSL`:
```typescript
/**
 * Node glow (emissive lighting) configuration for the DSL surface.
 * The internal render state always uses the three-field emissive model.
 */
export type DiagramNodeGlowConfig = {
  /** Emissive intensity [0–1]. Default: from theme. */
  intensity?: number;
  /** Emissive color (CSS hex). Default: node face color. */
  color?: string;
};
```

In `DiagramNodeDSL`, remove `emissive`, `emissiveIntensity`, `emissiveColor` and add `glow`:

Remove these fields:
```typescript
readonly emissiveIntensity?: number;
readonly emissive?: boolean;
readonly emissiveColor?: string;
```

Add:
```typescript
/**
 * Node glow (emissive) override.
 * - Omit: use theme default (recommended for consistent branding)
 * - `true`: enable glow with theme-default intensity and node face color
 * - `false`: disable glow regardless of theme
 * - object: full control — `{ intensity?: number; color?: string }`
 */
readonly glow?: boolean | DiagramNodeGlowConfig;
```

Note: `DiagramNodeState` keeps `emissiveIntensity`, `emissive`, `emissiveColor` — these
are internal render-layer fields and do NOT change. Only the DSL surface changes.

#### `dsl.tsx`: `DiagramNodeProps`

Remove:
```typescript
/** Emissive intensity on front face [0–1]. Default: from theme (darkGlass: 0.10) */
emissiveIntensity?: number;
/** Enables/disables front-face emissive contribution. */
emissive?: boolean;
/** Emissive color (CSS hex). Default: node `color`. */
emissiveColor?: string;
```

Add:
```typescript
/**
 * Node glow (emissive) override.
 * - Omit: inherit from theme (default)
 * - `true`: enable with theme-default intensity and color
 * - `false`: disable glow regardless of theme
 * - object: `{ intensity?: number; color?: string }` for full control
 *
 * @example
 * <DiagramNode id="api" glow={{ intensity: 0.4, color: '#00ffaa' }} />
 * <DiagramNode id="db" glow={false} />  // suppress theme glow
 */
glow?: boolean | DiagramNodeGlowConfig;
```

Also add `DiagramNodeGlowConfig` to the import from `'./types'` at the top of `dsl.tsx`:
```typescript
import type {
  ...,
  DiagramNodeGlowConfig,   // ← add
} from './types';
```

Use `DiagramNodeGlowConfig` (the named type from `types.ts`) rather than an inline
`{ intensity?: number; color?: string }` object type — consistent with how all other
complex prop types in `dsl.tsx` are defined.

#### `compiler/nodeCompiler.ts`: Map `glow` → internal emissive fields

The `compileNode` function maps DSL to `DiagramNodeState`. Replace the old emissive
derivation with `glow`-based derivation:

Before:
```typescript
const emissiveIntensity = dsl.emissiveIntensity ?? nd.emissiveIntensity;
const emissive = dsl.emissive ?? emissiveIntensity > 0;
const emissiveColor = dsl.emissiveColor ?? color;
```

After:
```typescript
const emissiveIntensity = (() => {
  if (dsl.glow === false) return 0;
  if (typeof dsl.glow === 'object' && dsl.glow !== null && dsl.glow.intensity !== undefined) {
    return dsl.glow.intensity;
  }
  return nd.emissiveIntensity; // theme default
})();
const emissive = (() => {
  if (dsl.glow === false) return false;
  if (dsl.glow === true) return true;
  return emissiveIntensity > 0;
})();
const emissiveColor = (() => {
  if (typeof dsl.glow === 'object' && dsl.glow !== null && dsl.glow.color !== undefined) {
    return dsl.glow.color;
  }
  return color; // default to node face color
})();
```

The returned `DiagramNodeState` object still has `emissiveIntensity`, `emissive`,
`emissiveColor` fields — they are just derived from `glow` now instead of directly from
the DSL props. The render layer is unchanged.

---

### Finding 7 (rename): `Enter`/`Exit` removed, `DiagramEnter`/`DiagramExit` canonical

#### `dsl.tsx`: Add new components, remove old

Add new exports (keeping the existing `EnterProps` and `ExitProps` type definitions,
just rename the components):

```typescript
// Replace:
export function Exit(_props: ExitProps): null { return null; }
export function Enter(_props: EnterProps): null { return null; }

// With:
/**
 * Declares exit animation for the parent <Diagram>.
 * Must be a direct child of <Diagram>. At most one <DiagramExit> per diagram.
 * @example <DiagramExit to={[0, -50, 0]} fade easing="ease-out" />
 */
export function DiagramExit(_props: ExitProps): null { return null; }

/**
 * Declares enter animation for the parent <Diagram>.
 * Must be a direct child of <Diagram>. At most one <DiagramEnter> per diagram.
 * @example <DiagramEnter from={[-50, 0, 0]} fade easing="spring" />
 */
export function DiagramEnter(_props: EnterProps): null { return null; }
```

Also rename the prop interfaces for export clarity (the underlying shapes stay the same):
- `ExitProps` → `DiagramExitProps` (export both the old and new names is NOT needed — clean break)
- `EnterProps` → `DiagramEnterProps`

Update the interface names in the same file:
```typescript
// Before:
export interface ExitProps { ... }
export interface EnterProps { ... }

// After:
export interface DiagramExitProps { ... }
export interface DiagramEnterProps { ... }
```

**Also update `DiagramExitDSL` and `DiagramEnterDSL` in `types.ts`** — these are internal
DSL extraction types and do NOT need to be renamed (they are not public API). Leave them
as-is.

#### `compiler/handlers.ts`: Update all `Exit`/`Enter` references

Update imports:
```typescript
// Before:
import { Diagram, DiagramNode, DiagramEdge, DiagramGroup, Exit, Enter, ... } from '../elements/diagram/dsl';

// After:
import { Diagram, DiagramNode, DiagramEdge, DiagramGroup, DiagramExit, DiagramEnter, ... } from '../elements/diagram/dsl';
```

In `registerDiagramHandlers`:
```typescript
// Before:
registerNode(Exit, () => {});
registerNode(Enter, () => {});

// After:
registerNode(DiagramExit, () => {});
registerNode(DiagramEnter, () => {});
```

In `extractDiagramDSL`:
```typescript
// Before:
} else if (el.type === Exit) {
  exitDSL = el.props as DiagramExitDSL;
} else if (el.type === Enter) {
  enterDSL = el.props as DiagramEnterDSL;
}

// After:
} else if (el.type === DiagramExit) {
  exitDSL = el.props as DiagramExitDSL;
} else if (el.type === DiagramEnter) {
  enterDSL = el.props as DiagramEnterDSL;
}
```

Also update the validation added in WS2 (placement warning):
```typescript
// Before:
} else if (gEl.type === Exit || gEl.type === Enter) {
  const componentName = gEl.type === Exit ? 'Exit' : 'Enter';

// After:
} else if (gEl.type === DiagramExit || gEl.type === DiagramEnter) {
  const componentName = gEl.type === DiagramExit ? 'DiagramExit' : 'DiagramEnter';
```

#### `widget.ts` (DiagramWidget.childDslComponents)

Update references from `Exit`/`Enter` to `DiagramExit`/`DiagramEnter`:
```typescript
// Before:
import { ..., Exit, Enter, ... } from './dsl';
// ...
{ component: Exit as React.ComponentType<unknown>, displayName: 'Exit', topLevelError: true },
{ component: Enter as React.ComponentType<unknown>, displayName: 'Enter', topLevelError: true },

// After:
import { ..., DiagramExit, DiagramEnter, ... } from './dsl';
// ...
{ component: DiagramExit as React.ComponentType<unknown>, displayName: 'DiagramExit', topLevelError: true },
{ component: DiagramEnter as React.ComponentType<unknown>, displayName: 'DiagramEnter', topLevelError: true },
```

---

### Finding 1 + 3: Auto-Registration (`diagramPlugin()`) + Option A Collapse

These two findings are implemented together because they share the same mechanism.

**Finding 1:** `DiagramCanvasWidget` auto-creates during compilation.
**Finding 3 (Option A):** Standalone `<Diagram>` handler wraps result in `DiagramCanvasState`
and auto-creates a `DiagramCanvasWidget`. `DiagramWidget` class is removed from public API.

#### New File: `packages/diagram/src/player/diagramPlugin.ts`

```typescript
// Factory for the @brewsite/diagram WidgetPlugin.
// Provides auto-registration of DiagramCanvasWidget instances during compilation.

import type { WidgetPlugin } from '@brewsite/core';
import type { WidgetRegistry } from '@brewsite/core';
import { registerDiagramHandlers } from '../compiler/handlers';

/**
 * WidgetPlugin for @brewsite/diagram.
 *
 * Provides DiagramCanvasWidget auto-registration: any `<DiagramCanvas>` or
 * standalone `<Diagram>` element encountered during scene compilation will
 * automatically create and register a `DiagramCanvasWidget` — no manual
 * pre-registration in `widgetSetup.ts` is required.
 *
 * Call `registerHandlers()` alone (or import `@brewsite/diagram`) for compilation
 * without a live registry (e.g., in unit tests). Call the full plugin for production.
 *
 * @example
 * <EngineProvider
 *   plugins={[corePlugin(), modelPlugin({ manifestUrl: '...' }), diagramPlugin()]}
 * />
 */
export function diagramPlugin(): WidgetPlugin {
  return {
    createWidgets: () => [],

    registerHandlers: () => {
      // Installs handlers without registry access.
      // register.ts (side-effect import) may have already done this — safe to call again.
      registerDiagramHandlers();
    },

    configureRegistry: (registry: WidgetRegistry) => {
      // Re-register handlers with registry access.
      // registerNode() uses Map.set() — this OVERWRITES the registry-less handlers
      // installed by registerHandlers() with new closures that capture `registry`.
      // After this call, any DiagramCanvas or Diagram handler that fires during
      // compilation will auto-register a DiagramCanvasWidget if one isn't present.
      registerDiagramHandlers(registry);
    },
  };
}
```

#### `compiler/handlers.ts`: Auto-registration in DiagramCanvas handler

Add import at top:
```typescript
import { DiagramCanvasWidget } from '../elements/diagram/canvas/widget';
```

Replace the existing MISSING_WIDGET warning block in the DiagramCanvas handler with
auto-registration:

Before:
```typescript
if (canvasId && registry && !registry.get(canvasId)) {
  const warnApi = api as CompileApi & {
    pushWarning?: (warning: { code: string; message: string; widgetId?: string; sceneIndex?: number }) => void;
  };
  warnApi.pushWarning?.({
    code: 'MISSING_WIDGET',
    message: `<DiagramCanvas id="${canvasId}"> has no corresponding DiagramCanvasWidget registered. ...`,
    widgetId: canvasId,
    sceneIndex: api.context.sceneIndex,
  });
}
```

After:
```typescript
if (canvasId && registry && !registry.get(canvasId)) {
  // Auto-register a DiagramCanvasWidget with a minimal empty default state.
  // The runtime will replace this with the compiled state from the SceneTrack on the first tick.
  const initialState = compileCanvas({ id: canvasId }, [], []);
  registry.register(new DiagramCanvasWidget(canvasId, initialState));
}
```

#### `compiler/handlers.ts`: Option A collapse — standalone `Diagram` handler

Replace the existing standalone `Diagram` handler:

Before:
```typescript
registerNode(Diagram, (node: ReactElement, api: CompileApi, helpers: CompileHelpers) => {
  const dsl = extractDiagramDSL(node, helpers);
  const state = compileDiagram(dsl);
  const widgetId = String((node.props as { id?: string }).id ?? dsl.id);
  api.setWidgetState(widgetId, state);
});
```

After:
```typescript
registerNode(Diagram, (node: ReactElement, api: CompileApi, helpers: CompileHelpers) => {
  const dsl = extractDiagramDSL(node, helpers, makeWarnFn(api));
  const onWarn = makeWarnFn(api);
  const diagramState = compileDiagram(dsl, undefined, onWarn);
  const canvasId = dsl.id;

  // Auto-register a DiagramCanvasWidget when registry is available.
  // This is the Finding 3 "Option A" collapse: standalone <Diagram> routes through
  // DiagramCanvasWidget, unifying the runtime path.
  if (registry && !registry.get(canvasId)) {
    const initialState = compileCanvas({ id: canvasId }, [], []);
    registry.register(new DiagramCanvasWidget(canvasId, initialState));
  }

  // Wrap the single diagram in a canvas state — DiagramCanvasWidget expects DiagramCanvasState.
  const canvasState = compileCanvas(
    {
      id: canvasId,
      position: dsl.position,
      rotation: dsl.rotation,
      scale: dsl.scale,
    },
    [diagramState],
    [],
    onWarn,
  );

  api.setWidgetState(canvasId, canvasState);
});
```

Note: `dsl.position/rotation/scale` are diagram-level transforms. When standalone, these
become the canvas-level transforms so the diagram appears at the authored world position.

#### `canvas/dsl.tsx`: Update `DiagramCanvasProps.id` JSDoc

Remove the manual registration instruction from the JSDoc:

Before:
```typescript
/**
 * Unique ID for this canvas. The DiagramCanvasWidget must be registered
 * with this exact id in widgetSetup.ts.
 */
id: string;
```

After:
```typescript
/**
 * Unique ID for this canvas.
 * When using `diagramPlugin()`, a `DiagramCanvasWidget` is automatically
 * created for this ID during scene compilation.
 */
id: string;
```

#### `elements/diagram/index.ts`: Remove `DiagramWidget` from public exports

Remove these lines:
```typescript
export { DiagramWidget } from './widget';
```

Keep `DiagramWidget` class itself in `widget.ts` (it may be useful as a private
implementation detail in tests). Do NOT delete the file.

#### `src/index.ts`: Update exports

Remove:
```typescript
export { DiagramWidget } from './elements/diagram/widget';
```

Add:
```typescript
export { diagramPlugin } from './player/diagramPlugin';
```

Also update the `Enter`/`Exit` export lines:

Before:
```typescript
export { Diagram, DiagramNode, DiagramEdge, DiagramGroup, Exit, Enter, ... } from './elements/diagram/dsl';
export type { ExitProps, EnterProps, ... } from './elements/diagram/dsl';
```

After:
```typescript
export { Diagram, DiagramNode, DiagramEdge, DiagramGroup, DiagramExit, DiagramEnter, ... } from './elements/diagram/dsl';
export type { DiagramExitProps, DiagramEnterProps, ... } from './elements/diagram/dsl';
```

---

### Testing for WS4

#### Ghost node fix — `packages/diagram/src/elements/diagram/__tests__/ghostNode.test.ts`

```typescript
import { compileDiagram } from '../compile';
import { darkGlassTheme } from '../themes/darkGlass';

describe('ghost node semantic fix (Finding 2)', () => {
  it('node with label absent compiles to label: undefined', () => {
    const state = compileDiagram({
      id: 'test',
      nodes: [{ id: 'a' }],  // label not provided
      edges: [],
      groups: [],
    });
    const node = state.nodes.find((n) => n.id === 'a')!;
    expect(node.label).toBeUndefined();
  });

  it('node with label empty string compiles to label: ""', () => {
    const state = compileDiagram({
      id: 'test',
      nodes: [{ id: 'a', label: '' }],
      edges: [],
      groups: [],
    });
    const node = state.nodes.find((n) => n.id === 'a')!;
    expect(node.label).toBe('');
  });

  it('mergeSnapshot inherits label from prev when current label is undefined (ghost)', () => {
    // Build a widget and call mergeSnapshot directly
    const { DiagramCanvasWidget } = await import('../canvas/widget');
    const { compileCanvas } = await import('../canvas/compile');
    const { compileDiagram } = await import('../compile');

    const prevDiagram = compileDiagram({
      id: 'd', nodes: [{ id: 'a', label: 'API Gateway', shape: 'rectangle' }], edges: [], groups: [],
    });
    const nextDiagram = compileDiagram({
      id: 'd', nodes: [{ id: 'a' /* ghost */ }], edges: [], groups: [],
    });
    const prev = compileCanvas({ id: 'c' }, [prevDiagram], []);
    const next = compileCanvas({ id: 'c' }, [nextDiagram], []);
    const widget = new DiagramCanvasWidget('c', prev);
    const merged = widget.mergeSnapshot(prev, next);
    const mergedNode = merged!.diagrams[0]!.nodes.find((n) => n.id === 'a')!;
    expect(mergedNode.label).toBe('API Gateway');  // inherited from prev
  });

  it('mergeSnapshot does NOT inherit from prev when label is empty string', () => {
    const { DiagramCanvasWidget } = await import('../canvas/widget');
    const { compileCanvas } = await import('../canvas/compile');
    const { compileDiagram } = await import('../compile');

    const prevDiagram = compileDiagram({
      id: 'd', nodes: [{ id: 'a', label: 'API Gateway' }], edges: [], groups: [],
    });
    const nextDiagram = compileDiagram({
      id: 'd', nodes: [{ id: 'a', label: '' /* intentional empty */ }], edges: [], groups: [],
    });
    const prev = compileCanvas({ id: 'c' }, [prevDiagram], []);
    const next = compileCanvas({ id: 'c' }, [nextDiagram], []);
    const widget = new DiagramCanvasWidget('c', prev);
    const merged = widget.mergeSnapshot(prev, next);
    const mergedNode = merged!.diagrams[0]!.nodes.find((n) => n.id === 'a')!;
    expect(mergedNode.label).toBe('');  // NOT inherited — explicit empty
  });
});
```

#### `depth`→`thickness` — `packages/diagram/src/elements/diagram/__tests__/thicknessRename.test.ts`

```typescript
import { compileDiagram } from '../compile';
import { darkGlassTheme } from '../themes/darkGlass';

it('DiagramNodeState has thickness field (not depth)', () => {
  const state = compileDiagram({
    id: 'test',
    nodes: [{ id: 'a', label: 'A', thickness: 0.8 }],
    edges: [],
    groups: [],
  });
  const node = state.nodes.find((n) => n.id === 'a')!;
  expect(node.thickness).toBe(0.8);
  expect('depth' in node).toBe(false);
});

it('DiagramNodeState.thickness defaults from theme.node.defaultThickness', () => {
  const state = compileDiagram({
    id: 'test',
    nodes: [{ id: 'a', label: 'A' }],
    edges: [],
    groups: [],
  }, darkGlassTheme);
  const node = state.nodes.find((n) => n.id === 'a')!;
  expect(node.thickness).toBe(darkGlassTheme.node.defaultThickness);
});
```

#### `glow` prop — `packages/diagram/src/elements/diagram/__tests__/glowProp.test.ts`

```typescript
import { compileDiagram } from '../compile';
import { darkGlassTheme } from '../themes/darkGlass';

it('glow=false sets emissive=false and emissiveIntensity=0', () => {
  const state = compileDiagram({ id: 't', nodes: [{ id: 'a', label: 'A', glow: false }], edges: [], groups: [] });
  const n = state.nodes.find((n) => n.id === 'a')!;
  expect(n.emissive).toBe(false);
  expect(n.emissiveIntensity).toBe(0);
});

it('glow=true enables emissive with theme intensity', () => {
  const state = compileDiagram({ id: 't', nodes: [{ id: 'a', label: 'A', glow: true }], edges: [], groups: [] }, darkGlassTheme);
  const n = state.nodes.find((n) => n.id === 'a')!;
  expect(n.emissive).toBe(true);
  expect(n.emissiveIntensity).toBe(darkGlassTheme.node.defaultEmissiveIntensity);
});

it('glow object with intensity and color overrides theme', () => {
  const state = compileDiagram({ id: 't', nodes: [{ id: 'a', label: 'A', glow: { intensity: 0.9, color: '#ff0000' } }], edges: [], groups: [] });
  const n = state.nodes.find((n) => n.id === 'a')!;
  expect(n.emissiveIntensity).toBe(0.9);
  expect(n.emissiveColor).toBe('#ff0000');
  expect(n.emissive).toBe(true);
});
```

#### Auto-registration — `packages/diagram/src/compiler/__tests__/autoRegistration.test.ts`

```typescript
import { WidgetRegistry } from '@brewsite/core';
import { clearRegistry } from '@brewsite/core';  // test helper
import { registerDiagramHandlers } from '../handlers';
import { DiagramCanvasWidget } from '../../elements/diagram/canvas/widget';

it('DiagramCanvas handler auto-registers DiagramCanvasWidget when registry provided', () => {
  // Arrange
  clearRegistry();
  const registry = new WidgetRegistry({ strict: true });
  registerDiagramHandlers(registry);

  // Compile a minimal scene with a DiagramCanvas
  const { compileSceneTrack } = require('@brewsite/core');
  const { DiagramCanvas, Diagram, DiagramNode } = require('../../elements/diagram/dsl');

  // Build a fake getFrame function
  const { Scene } = require('@brewsite/core');
  // ... (build minimal scene DSL and compile it)
  // Assert that registry now has a DiagramCanvasWidget registered for 'my-canvas'
  const widget = registry.get('my-canvas');
  expect(widget).toBeInstanceOf(DiagramCanvasWidget);
});
```

Note: The full test for auto-registration requires invoking `compileSceneTrack` with a DSL
that contains `<DiagramCanvas>`. Use the real `compileSceneTrack` and real `WidgetRegistry`
rather than mocking — this is an interface-based stateful test.

---

## Migration Guide (Group C Breaking Changes)

Include this section verbatim in the package CHANGELOG and/or README for the major release.

### `depth` → `thickness` on `<DiagramNode>`

**Before:**
```tsx
<DiagramNode id="api" depth={0.8} />
```
**After:**
```tsx
<DiagramNode id="api" thickness={0.8} />
```

Also affects `DiagramTheme` customization:
```typescript
// Before:
const myTheme: DiagramTheme = {
  ...darkGlassTheme,
  node: { ...darkGlassTheme.node, defaultDepth: 0.6 },
};

// After:
const myTheme = mergeTheme(darkGlassTheme, { node: { defaultThickness: 0.6 } });
// — or manually:
const myTheme: DiagramTheme = {
  ...darkGlassTheme,
  node: { ...darkGlassTheme.node, defaultThickness: 0.6 },
};
```

The `DiagramNodeState.depth` type field is removed. If you read node state directly
(e.g., from `tick.state.widgets`), update to `DiagramNodeState.thickness`.

### `emissive`/`emissiveIntensity`/`emissiveColor` removed → `glow`

**Before:**
```tsx
<DiagramNode id="api" emissive emissiveIntensity={0.5} emissiveColor="#00ffaa" />
```
**After:**
```tsx
<DiagramNode id="api" glow={{ intensity: 0.5, color: '#00ffaa' }} />
```

Common patterns:
```tsx
// Disable glow:
// Before: emissive={false}
// After:  glow={false}

// Enable with defaults:
// Before: emissive emissiveIntensity={0.3}
// After:  glow={{ intensity: 0.3 }}

// Theme default (no change needed — just omit glow as before):
// Before: (omit all three props)
// After:  (omit glow)
```

### `<Enter>`/`<Exit>` removed → `<DiagramEnter>`/`<DiagramExit>`

**Before:**
```tsx
<Diagram id="d">
  <Enter from={[-50, 0, 0]} fade />
  <Exit to={[50, 0, 0]} fade />
</Diagram>
```
**After:**
```tsx
<Diagram id="d">
  <DiagramEnter from={[-50, 0, 0]} fade />
  <DiagramExit to={[50, 0, 0]} fade />
</Diagram>
```

`ExitProps` is now `DiagramExitProps`. `EnterProps` is now `DiagramEnterProps`.

### Widget pre-registration eliminated — use `diagramPlugin()`

**Before (widgetSetup.ts):**
```typescript
import { DiagramCanvasWidget, compileCanvas } from '@brewsite/diagram';

registry.register(new DiagramCanvasWidget('system-canvas', compileCanvas({ id: 'system-canvas' }, [], [])));
registry.register(new DiagramCanvasWidget('frontend-canvas', compileCanvas({ id: 'frontend-canvas' }, [], [])));
```

**After (EngineProvider/ScenePlayer props):**
```typescript
import { diagramPlugin } from '@brewsite/diagram';

plugins={[corePlugin(), modelPlugin({ manifestUrl: '...' }), diagramPlugin()]}
```

No `widgetSetup.ts` entries needed for diagram canvases. Remove all `DiagramCanvasWidget`
and `DiagramWidget` pre-registration from `widgetSetup.ts`.

`DiagramWidget` is removed from public exports. If you were directly instantiating it,
switch to `DiagramCanvasWidget` with a single-diagram canvas state:
```typescript
// Before:
new DiagramWidget('my-diagram', defaultDiagramState);

// After (only needed if you are NOT using diagramPlugin()):
import { DiagramCanvasWidget, compileCanvas } from '@brewsite/diagram';
new DiagramCanvasWidget('my-diagram', compileCanvas({ id: 'my-diagram' }, [], []));
```

### Ghost node trigger — semantic fix

This is a **behavior change** for anyone using `label=""` (empty string) on a node.

**Before:** `<DiagramNode id="cdn" label="" />` was a ghost node (inherited from prior scene).
**After:** `<DiagramNode id="cdn" label="" />` is a fully-declared node with an empty text label.

If you intended ghost behavior with `label=""`, change to omitting the `label` prop:
```tsx
// Before (ghost with empty string — only worked by accident):
<DiagramNode id="cdn" label="" opacity={0.3} />

// After (ghost — explicit intent):
<DiagramNode id="cdn" opacity={0.3} />
```

---

## Post-Implementation Verification Steps

After implementing all workstreams:

1. **TypeScript check:** `pnpm --filter @brewsite/diagram typecheck` — must pass with zero errors.
2. **Tests:** `pnpm --filter @brewsite/diagram test` — all existing + new tests pass.
3. **Search for missed depth renames:**
   ```bash
   pnpm --filter @brewsite/diagram exec grep -r "\.depth\b" src/ --include="*.ts" | grep -v "defaultDepth\|iconDepth\|nodeDepth\|// "
   ```
   Expected: zero matches from `DiagramNodeState` or `DiagramNodeDSL` context.
4. **Search for missed emissive prop references in DSL layer:**
   ```bash
   pnpm --filter @brewsite/diagram exec grep -r "emissiveIntensity\|emissiveColor\|: emissive" src/elements/diagram/dsl.tsx src/elements/diagram/types.ts
   ```
   Expected: zero matches (these fields remain in `DiagramNodeState` for the render layer
   only — not in DSL props or DSL types).
5. **Search for old Enter/Exit names in public exports:**
   ```bash
   grep "export.*\bEnter\b\|export.*\bExit\b" packages/diagram/src/index.ts
   ```
   Expected: zero matches (`DiagramEnter`/`DiagramExit` only).
6. **Confirm `DiagramWidget` not in public exports:**
   ```bash
   grep "DiagramWidget" packages/diagram/src/index.ts
   ```
   Expected: zero matches.
7. **Build:** `pnpm --filter @brewsite/diagram build:lib` — must succeed.

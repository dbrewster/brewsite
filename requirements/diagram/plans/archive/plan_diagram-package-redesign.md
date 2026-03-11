---
title: "@brewsite/diagram — Module Architecture Redesign"
doc_type: plan
owner: brewsite-architect
status: complete
updated: 2026-03-10
---

# @brewsite/diagram — Module Architecture Redesign

## 1. Problem Statement

The `@brewsite/diagram` package has accumulated architectural debt that makes modules hard
to reason about, hard to test in isolation, and prone to silent lateral coupling. The root
causes are:

### 1.1 `types.ts` — 1,443 Lines Mixing Four Distinct Concerns

`packages/diagram/src/elements/diagram/types.ts` interleaves four semantically distinct
abstraction layers in one file:

- **DSL prop types** — `DiagramNodeDSL`, `DiagramEdgeDSL`, `DiagramGroupDSL`, `LayoutDSL`
  (consumed only during JSX tree walking in `handlers.ts` and `compile.ts`)
- **Compiled state types** — `DiagramNodeState`, `DiagramEdgeState`, `DiagramGroupState`,
  `DiagramState` (output of compilation; consumed by `render.ts` and transition specs)
- **Theme authoring types** — `DiagramTheme`, `DiagramThemeNodeConfig`, etc.
  (consumed during DSL authoring and by `themeResolver.ts`)
- **Render configuration types** — `DiagramThemeRenderConfig`
  (consumed only by `render.ts`, `NodeRenderer.ts`, `EdgeRenderer.ts`, `GroupRenderer.ts`)
- **Interaction event types** — `DiagramInteractionEvent`, `DiagramHoverControls`, etc.
  (consumed by `widget.ts` and app-level consumers)

A developer reading `types.ts` cannot determine which types belong to which layer without
extensive cross-referencing. Every file in the package imports from `types.ts`, creating a
hub-and-spoke dependency graph where the hub has no clear responsibility.

### 1.2 `compiler/layoutAlgorithms.ts` — 1,078 Lines with Five Distinct Algorithms

Five independent layout algorithms are co-located with no architectural reason:
- `resolveFlowLayout` — sequential flow placement
- `resolveGridLayout` — column-grid placement
- `resolveHierarchicalLayout` — topological (edge-driven) placement
- `resolveLayout` / `resolveLayoutWithGroups` — algorithm dispatch orchestration
- `computeBounds` — bounding box utility

Each algorithm is a pure function with no dependency on the others. Each can be developed,
tested, and debugged independently. Their co-location inflates the file to over 1000 lines,
making any layout regression investigation a cognitive burden.

### 1.3 `widget.ts` — Three Concerns Mixed in 637 Lines

`DiagramWidget` mixes:

**DSL stub functions** (14 null-returning components: `DiagramNode`, `DiagramEdge`,
`DiagramGroup`, etc.) — these are DSL authoring surface, not widget behavior.

**IWidget implementation** (`initialize`, `apply`, `dispose`, `mergeSnapshot`, etc.) —
the runtime integration contract.

**Hover/interaction state machine** (150+ lines of private methods: `transitionHover`,
`handleMouseMove`, `handleClick`, `buildGroupPath`, `collectGroupIds`,
`createHoverControls`) — complex branching logic that determines which hover events to
fire based on raycasting results and group hierarchy traversal.

**Ghost node merge logic** (`mergeSnapshot`, 70+ lines) — a pure transformation from
`DiagramNodeState | undefined` to `DiagramNodeState | undefined` with no dependency on
Three.js or the widget lifecycle.

The hover state machine and ghost node merge logic cannot be unit-tested without
constructing a full DiagramWidget instance with a live Three.js scene.

### 1.4 `focusRegion.ts` — Module-Level Mutable Singleton

```typescript
let currentFocusRegion: DiagramFocusRegionState | null = null;
```

This module-level mutable variable is process-global. Any test that imports code that
touches `publishDiagramFocusGroup()`, `clearDiagramFocusRegion()`, or
`getDiagramFocusRegion()` permanently mutates this state. Tests cannot run in parallel
against focusRegion, and sequential tests bleed state into each other.

### 1.5 `rendering/IconLoader.ts` — Singleton Non-Injectable Dependency

```typescript
export const sharedIconLoader: IIconLoader = new IconLoaderImpl();
```

`render.ts`'s `DiagramRenderer` constructor hardcodes `sharedIconLoader`:
```typescript
this.nodeRenderer = new NodeRenderer(sharedIconLoader, this.interactionRegistry);
```

The `IIconLoader` interface already exists (good). But the concrete singleton is created at
module load time and baked into `DiagramRenderer`'s constructor. Tests of `NodeRenderer`
or `DiagramRenderer` that exercise icon paths will make real network requests. Additionally,
`DiagramWidget.dispose()` calls `sharedIconLoader.disposeAll()`, which is a global side
effect on a per-widget lifecycle event.

### 1.6 `compile.ts` — `normalizeToViewport` Hidden as Private Function

`normalizeToViewport` is a 174-line pure coordinate transformation function embedded as
a private function in `compile.ts`. It converts diagram-unit positions to [0..1] NVS
space with Y-axis flip, padding expansion, and group bounds normalization. There is a
test file `__tests__/normalizeToViewport.test.ts` that can only exercise this function
by calling `compileDiagram()` end-to-end, making it impossible to test the normalization
math in isolation.

### 1.7 Lateral Coupling: `groupCompiler.ts` → `nodeCompiler.ts`

```typescript
// groupCompiler.ts line 12
import { buildGroupDefaults } from './nodeCompiler';
```

`buildGroupDefaults` lives in `nodeCompiler.ts` despite having no relationship to node
compilation logic. It was placed there as a convenience default-builder alongside
`buildNodeDefaults` and `buildEdgeDefaults`. This is a naming and placement mismatch
that creates a lateral sibling dependency: `groupCompiler.ts` depends on `nodeCompiler.ts`
for a function that logically belongs to `groupCompiler.ts` itself or to a shared defaults
module.

### 1.8 `compiler/diagramRenderConstants.ts` — Render Constants in the Compiler Directory

`GROUP_BORDER_PX_TO_UNITS` and `GROUP_RENDER_Z` are constants used by both the compiler
layer (`compile.ts`, `groupCompiler.ts`, `transitionHelpers.ts`) and the rendering layer
(`rendering/GroupRenderer.ts`). They live in `compiler/diagramRenderConstants.ts`, which
means `GroupRenderer.ts` (a render-layer file) imports from the `compiler/` directory —
a violation of expected dependency direction (render should not import from compiler/).

### 1.9 `rendering/NodeRenderer.ts` — Label Layout Math Embedded in Three.js Loop

`labelY`, `sublabelY`, `labelFontSize`, `sublabelFontSize`, and the icon/label positioning
calculations inside `updateEntry()` are pure math that depends only on `DiagramNodeState`
and `DiagramThemeRenderConfig` fields. These 30+ lines of arithmetic are embedded in the
middle of a Three.js mutation loop, making them impossible to test without constructing a
full `NodeRenderEntry`.

### 1.10 `compiler/edgeRenderOptimizer.ts` — Render-Prep Logic in the Compiler Directory

`optimizeSharedFlowTrunks()` operates on `DiagramEdgeState[]` — the post-compilation
compiled render state — not on DSL inputs. It is a render-preparation optimization called
at the end of `compileDiagram()`, but it lives in `compiler/` even though its inputs and
outputs are render state types.

---

## 2. Design Goals

After the redesign, every module in `@brewsite/diagram` must satisfy:

1. **Single responsibility**: the module's purpose is statable in one sentence. If you
   cannot state it, the module should be split.
2. **Typed contractual surface**: all exports are typed interfaces or explicit function
   signatures. No `as Record<string, unknown>` at module boundaries. No implicit type
   inference for public API.
3. **No lateral coupling**: sibling modules in the same directory may not import each
   other except through a shared contract module (types, defaults, or a parent index).
4. **Full testability without mocking internals**: every pure function and every class with
   a typed constructor can be tested with real inputs and real assertions. No test requires
   instantiating Three.js, React, or real network connections to test compilation logic or
   state transformation logic.
5. **Correct dependency direction**: the render layer may import from the compile layer,
   but the compile layer must not import from the render layer. Shared constants must live
   at the element boundary level, not inside either sub-layer.
6. **Stable public API**: `packages/diagram/src/index.ts` exports are unchanged. Any
   internal refactoring must be invisible to package consumers.

---

## 3. Module Inventory

### 3.1 `elements/diagram/types.ts` — MODIFY (keep location, split by adding new files)

**Current state**: 1,443 lines mixing DSL prop types, compiled state types, theme types,
render config types, and interaction types.

**What changes**: No files are moved. A new dedicated render config re-export is created
so that `DiagramThemeRenderConfig` can be imported from `rendering/renderConfig.ts` by
render-layer consumers, while still being available from `types.ts` for public API
consumers. The content of `types.ts` itself gets a clearer internal section structure via
comments and documentation, but is NOT split (to avoid cascading import changes across the
package).

**Rationale**: `DiagramThemeRenderConfig` is exported from the public `index.ts`, so
moving it would require a re-export chain at minimum. Given the existing test coverage and
the fact that most consumers import via `index.ts` re-exports, the risk/reward of splitting
the file is low. The primary concern about `types.ts` is documentation quality and section
structure, which is addressed by comments and JSDoc.

**Net change**: No source changes required; this is a documentation-quality call.

### 3.2 `elements/diagram/constants.ts` — NEW

**Purpose**: Central location for diagram-level constants shared across the compile and
render layers.

**What moves here**: The contents of `compiler/diagramRenderConstants.ts`:
- `GROUP_BORDER_PX_TO_UNITS: number`
- `GROUP_RENDER_Z: number`

**Why**: Both the compiler layer and the rendering layer use these constants. A constant
shared across layers should live at the element boundary, not inside one layer's directory.

**File to create**:
```typescript
// elements/diagram/constants.ts
// Constants shared between the compile and render layers. No Three.js. No React.

/** Conversion factor: border width in CSS pixels → diagram scene units. */
export const GROUP_BORDER_PX_TO_UNITS = 0.0125;

/** Z-offset applied to group borders to render them above the group fill plane. */
export const GROUP_RENDER_Z = 0.005;
```

### 3.3 `compiler/diagramRenderConstants.ts` — MODIFY (becomes a shim)

**Current state**: Defines `GROUP_BORDER_PX_TO_UNITS` and `GROUP_RENDER_Z`.

**What changes**: Becomes a backwards-compatibility shim that re-exports from the new
`elements/diagram/constants.ts`. No callers outside the package need to update; this file
stays because it's in the compiler import chain.

**After change**:
```typescript
// compiler/diagramRenderConstants.ts
// Backwards-compatibility shim — re-exports from element-level constants.
export { GROUP_BORDER_PX_TO_UNITS, GROUP_RENDER_Z } from '../constants';
```

### 3.4 `compiler/defaultsCompiler.ts` — NEW

**Purpose**: Owns all "DSL → default values" transformation for nodes, edges, and groups.
Single location for theme-driven defaults, eliminating the lateral coupling between
`groupCompiler.ts` and `nodeCompiler.ts`.

**What moves here**: From `compiler/nodeCompiler.ts`:
- `buildNodeDefaults(theme: DiagramTheme): NodeDefaults`
- `buildEdgeDefaults(theme: DiagramTheme): EdgeDefaults`
- `buildGroupDefaults(theme: DiagramTheme): GroupDefaults`

**Why**: These three functions form a cohesive "defaults resolution" concern. They have no
dependency on each other's compiled outputs, only on `DiagramTheme`. Placing all three in
one dedicated module makes the defaults contract explicit and eliminates the coupling.

**New interface contracts**:
```typescript
// The return types of the build*Defaults functions — explicitly typed for clarity.
export interface NodeDefaults {
  readonly shape: DiagramNodeShape;
  readonly size: [number, number];
  readonly thickness: number;
  readonly color: string;
  readonly boxColor: string;
  readonly metalness: number;
  readonly roughness: number;
  readonly emissiveIntensity: number;
  readonly cornerRadius: number;
  readonly labelColor: string;
  readonly sublabelColor: string;
  readonly opacity: number;
  readonly clickable: boolean;
  readonly enabled: boolean;
  readonly iconScale: number;
  readonly iconStyle: SvgIcon3DStyle;
  readonly iconDepthFactor: number;
  readonly sideColorDarkenFactor: number;
  readonly borderColorLightenFactor: number;
}

export interface EdgeDefaults {
  readonly style: 'solid';
  readonly arrowStart: 'none';
  readonly arrowEnd: 'none';
  readonly color: string;
  readonly thickness: number;
  readonly opacity: number;
  readonly routing: EdgeRoutingAlgorithm;
  readonly flowTurnRadius: number;
  readonly flowFaceStub: number;
  readonly flowBundleStrength: number;
  readonly flowTargetApproachBias: number;
  readonly allowUnderpass: boolean;
  readonly flow: 'none';
}

export interface GroupDefaults {
  readonly variant: 'boundary';
  readonly orientation: 'vertical';
  readonly color: string;
  readonly borderColor: string;
  readonly borderWidth: number;
  readonly borderHeight: number;
  readonly borderStyle: 'solid';
  readonly fillOpacity: number;
  readonly borderOpacity: number;
  readonly borderEmissiveColor: string;
  readonly borderEmissiveIntensity: number;
  readonly labelColor: string;
}

export function buildNodeDefaults(theme: DiagramTheme): NodeDefaults;
export function buildEdgeDefaults(theme: DiagramTheme): EdgeDefaults;
export function buildGroupDefaults(theme: DiagramTheme): GroupDefaults;
```

### 3.5 `compiler/nodeCompiler.ts` — MODIFY

**What changes**: Remove the `buildNodeDefaults`, `buildEdgeDefaults`, and `buildGroupDefaults`
function bodies. Import `buildNodeDefaults` and `buildEdgeDefaults` from `./defaultsCompiler`
for internal use within `compileNode` and `compileEdge`. **Do NOT re-export them from
`nodeCompiler.ts`** — they belong to `defaultsCompiler.ts` now. `buildGroupDefaults` is
not used in `nodeCompiler.ts` at all after this change.

**After change**: `nodeCompiler.ts` imports for internal use only:
```typescript
import { buildNodeDefaults, buildEdgeDefaults } from './defaultsCompiler';
// These are not re-exported — consumers import from defaultsCompiler directly.
```

**Consequence for `compiler/__tests__/nodeCompiler.test.ts`**: This existing test file
imports `buildNodeDefaults` and `buildGroupDefaults` from `../nodeCompiler`. After Stream A,
those symbols are no longer exported from `nodeCompiler.ts`. The test file must be updated
(see Stream A Step 5a). The test coverage for `build*Defaults` moves to
`compiler/__tests__/defaultsCompiler.test.ts`.

### 3.6 `compiler/groupCompiler.ts` — MODIFY

**What changes**: Remove import `{ buildGroupDefaults } from './nodeCompiler'`. Replace
with `import { buildGroupDefaults } from './defaultsCompiler'`. No other changes.

### 3.7 `compiler/layout/` — NEW DIRECTORY with four sub-modules

**Purpose**: Each file owns exactly one layout algorithm. Previously in `layoutAlgorithms.ts` (1,078 lines).

#### `compiler/layout/gridLayout.ts` — NEW

**Purpose**: Computes a column-grid layout for nodes in a diagram or group.

**Exports**:
```typescript
/**
 * Assigns [x, y, z] positions for a grid layout.
 * Returns a Map from node ID to Cartesian [x, y, z] position in diagram units (Y-up).
 */
export function resolveGridLayout(
  nodes: ReadonlyArray<DiagramNodeDSL>,
  layout: ResolvedGridLayout,
  childrenOrder: ReadonlyArray<string>,
  defaultNodeSize: readonly [number, number],
): Map<string, readonly [number, number, number]>;
```

**Contains**: The current `resolveGridLayout` implementation extracted from
`layoutAlgorithms.ts`. No dependencies on other layout files.

#### `compiler/layout/hierarchicalLayout.ts` — NEW

**Purpose**: Computes a topological (edge-driven) layout for nodes in a diagram.

**Exports**:
```typescript
/**
 * Assigns [x, y, z] positions for a hierarchical (edge-driven) layout.
 * Returns a Map from node ID to Cartesian [x, y, z] position in diagram units (Y-up).
 */
export function resolveHierarchicalLayout(
  nodes: ReadonlyArray<DiagramNodeDSL>,
  edges: ReadonlyArray<DiagramEdgeDSL>,
  layout: ResolvedHierarchicalLayout,
  childrenOrder: ReadonlyArray<string>,
  defaultNodeSize: readonly [number, number],
): Map<string, readonly [number, number, number]>;
```

#### `compiler/layout/flowLayout.ts` — NEW

**Purpose**: Computes a sequential (single-axis flow) layout for nodes.

**Exports**:
```typescript
/**
 * Assigns [x, y, z] positions for a flow layout (single-axis sequential placement).
 * Returns a Map from node ID to Cartesian [x, y, z] position in diagram units (Y-up).
 */
export function resolveFlowLayout(
  nodes: ReadonlyArray<DiagramNodeDSL>,
  layout: ResolvedFlowLayout,
  childrenOrder: ReadonlyArray<string>,
  defaultNodeSize: readonly [number, number],
): Map<string, readonly [number, number, number]>;
```

#### `compiler/layout/bounds.ts` — NEW

**Purpose**: Computes bounding rectangles for node sets and groups.

**Exports**:
```typescript
/**
 * Computes the bounding rectangle enclosing all nodes (outer edges) plus optional padding.
 * Input positions and sizes are in diagram units.
 */
export function computeBounds(
  nodes: ReadonlyArray<{ id: string; position: readonly [number, number, number]; size: readonly [number, number] }>,
  padding?: number,
): { minX: number; maxX: number; minY: number; maxY: number };
```

#### `compiler/layout/index.ts` — NEW

**Purpose**: Barrel re-export for the four extracted algorithm modules only.

**Critical constraint**: This barrel must NOT re-export `resolveLayout` or
`resolveLayoutWithGroups` from `../layoutAlgorithms`. Doing so would create a circular
dependency: `layoutAlgorithms.ts` imports from `./layout/index.ts` to re-export the
algorithm functions, and if `layout/index.ts` then imports from `../layoutAlgorithms`,
the cycle is complete and will cause build failures or silent undefined exports.
The orchestration functions stay in `layoutAlgorithms.ts` exclusively.

```typescript
export { resolveGridLayout } from './gridLayout';
export { resolveHierarchicalLayout } from './hierarchicalLayout';
export { resolveFlowLayout } from './flowLayout';
export { computeBounds } from './bounds';
// NOTE: resolveLayout and resolveLayoutWithGroups are NOT re-exported here.
// They remain in ../layoutAlgorithms.ts and are imported directly by compile.ts.
```

### 3.8 `compiler/layoutAlgorithms.ts` — MODIFY (becomes orchestration-only)

**Current state**: 1,078 lines with 5 distinct algorithms plus orchestration.

**What changes**: The four algorithm implementations (`resolveFlowLayout`,
`resolveGridLayout`, `resolveHierarchicalLayout`, plus `computeBounds`) are extracted to
`compiler/layout/`. The remaining content in `layoutAlgorithms.ts` is:
- `resolveLayout()` — dispatches to the correct algorithm based on layout kind
- `resolveLayoutWithGroups()` — applies layout recursively for groups

`layoutAlgorithms.ts` now imports from `./layout/` and re-exports for backwards
compatibility.

**After change**: `layoutAlgorithms.ts` becomes ~120 lines of orchestration only.

### 3.9 `compiler/normalizeToViewport.ts` — NEW

**Purpose**: Exports the coordinate transformation that converts diagram-unit positions to
[0..1] NVS space, with Y-axis flip and group bounds normalization. Previously a private
function in `compile.ts`.

**Why**: This is the most complex pure mathematical function in the compiler. It has a
174-line implementation that is already unit-tested via end-to-end `compileDiagram()` calls
in `normalizeToViewport.test.ts`. By extracting it, the test file can import and call it
directly without a full compilation round-trip.

**Exports**:
```typescript
export type NormalizeToViewportResult = {
  readonly normalizedPositions: Map<string, readonly [number, number, number]>;
  readonly normalizedSizes: Map<string, readonly [number, number]>;
  readonly normalizedGroups: Map<string, GroupBounds>;
  readonly contentAspect: number;
};

/**
 * Converts diagram-unit node positions and group bounds to [0..1] NVS space.
 * Y axis is flipped: Cartesian +Y (up) → NVS y=0 (top).
 *
 * @param nodes    Nodes with diagram-unit positions (Cartesian Y-up)
 * @param groups   Group bounds map in diagram units (GroupBounds.y = Cartesian bottom)
 * @param padding  Resolved padding in diagram units (used for bounding-box expansion)
 */
export function normalizeToViewport(
  nodes: ReadonlyArray<{ id: string; position: readonly [number, number, number]; size: readonly [number, number] }>,
  groups: Map<string, GroupBounds>,
  padding: number,
): NormalizeToViewportResult;
```

**Dependencies**: imports `GroupBounds` from `./groupCompiler` (where it is defined — line 25 of `groupCompiler.ts`). Does NOT import from `./layoutResolver`; `GroupBounds` is not defined there.

### 3.10 `compile.ts` — MODIFY

**What changes**: Remove the private `normalizeToViewport` function; import from
`./compiler/normalizeToViewport`. No other changes to the compilation logic.

**After change**: `compile.ts` drops from 596 lines to ~420 lines (removing the 174-line
function and its imports).

### 3.11 `compiler/hoverStateMachine.ts` — NEW

**Purpose**: Pure state machine for diagram hover transitions. Determines which
`node-mouse-enter`, `node-mouse-leave`, `group-mouse-enter`, `group-mouse-leave` events to
dispatch when the hover target changes.

**Why**: This logic (150+ lines of private methods in `DiagramWidget`) cannot be tested
without constructing a full widget. The state machine is pure: it takes `(prevTarget,
nextTarget, state)` and returns a list of events to dispatch. No Three.js, no DOM.

**New interface contracts**:
```typescript
export type HoverTarget = {
  readonly diagramId: string;
  readonly groupPath: ReadonlyArray<string>;
  readonly nodeId?: string;
  readonly point: readonly [number, number, number];
};

export type HoverEvent =
  | { type: 'node-mouse-enter'; diagramId: string; nodeId: string; point: readonly [number, number, number] }
  | { type: 'node-mouse-leave'; diagramId: string; nodeId: string; point: readonly [number, number, number] }
  | { type: 'group-mouse-enter'; diagramId: string; groupId: string; point: readonly [number, number, number] }
  | { type: 'group-mouse-leave'; diagramId: string; groupId: string; point: readonly [number, number, number] };

/**
 * Computes the hover events that should be dispatched when the hover target
 * transitions from `prev` to `next`.
 *
 * Returns events in dispatch order:
 * 1. node-mouse-leave for the previous node (if changed)
 * 2. group-mouse-leave for groups that are leaving the path
 * 3. group-mouse-enter for groups that are entering the path
 * 4. node-mouse-enter for the new node (if changed)
 *
 * The caller is responsible for actually dispatching events (calling handlers).
 * stopPropagation semantics are implemented in the caller when a handler returns true.
 */
export function computeHoverTransitionEvents(
  prev: HoverTarget | null,
  next: HoverTarget | null,
): ReadonlyArray<HoverEvent>;

/**
 * Builds the group ancestry path from a leaf groupId to the root group.
 * Returns groups in root→leaf order (root is index 0).
 * Pure function — no Three.js, no DOM.
 */
export function buildGroupPath(
  state: Pick<DiagramState, 'groups'>,
  leafGroupId: string,
): ReadonlyArray<string>;

/**
 * Collects all group IDs in a subtree rooted at `groupId`.
 * When includeDescendants is false, returns a set containing only `groupId`.
 */
export function collectGroupIds(
  state: Pick<DiagramState, 'groups'>,
  groupId: string,
  includeDescendants: boolean,
): ReadonlySet<string>;
```

### 3.12 `compiler/ghostNodeMerge.ts` — NEW

**Purpose**: Pure function for merging ghost node state across scenes. Previously embedded
in `DiagramWidget.mergeSnapshot()`.

**Why**: Ghost node merging is a pure transformation of two `DiagramState` values. It has
no dependency on Three.js, DOM, or widget lifecycle. Extracting it makes it independently
testable and readable.

**Exports**:
```typescript
/**
 * Merges ghost-node properties from `prev` into `next`.
 *
 * A node is a ghost when `node.label === undefined`. Ghost nodes inherit visual
 * identity (label, sublabel, shape, iconUrl, iconScale, sublabelColor) from the
 * matching node in `prev`. Nodes with `positionInherited === true` additionally
 * inherit position, size, and thickness.
 *
 * Returns `next` unchanged if no merging is needed (avoids unnecessary allocation).
 * Returns `undefined` if `next` is `undefined`.
 */
export function mergeGhostNodeSnapshot(
  prev: DiagramState | undefined,
  next: DiagramState | undefined,
): DiagramState | undefined;
```

### 3.13 `widget.ts` — MODIFY

**What changes**:
- Remove `transitionHover`, `buildGroupPath`, `groupDepth`, `collectGroupIds`,
  `createHoverControls`, `handleClick`, `handleMouseMove`, `clearHover`,
  `dispatchNodeHover`, `dispatchGroupHover` — all move to `compiler/hoverStateMachine.ts`
- Remove `mergeSnapshot` implementation body — moves to `compiler/ghostNodeMerge.ts`
- `DiagramWidget.mergeSnapshot()` becomes a one-liner delegating to `mergeGhostNodeSnapshot`
- `DiagramWidget`'s hover handlers become thin adapters that call
  `computeHoverTransitionEvents` and dispatch the resulting events

**After change**: `widget.ts` drops from 637 lines to ~350 lines. The widget class retains
its Three.js lifecycle (initialize/apply/dispose) and DOM event registration, but all
hover event logic is delegated to the pure state machine module.

**DSL stub functions stay in `widget.ts`**: they are already co-located with the widget
class following the established pattern in the codebase.

### 3.14 `focusRegion.ts` — MODIFY (class-based service)

**Current state**: Module-level mutable `let currentFocusRegion` singleton.

**What changes**: Replace the module-level mutable variable with a class
`DiagramFocusRegionService` that can be instantiated per test. Export a default singleton
`diagramFocusRegionService` for production use. All existing functions become methods.

**New interface**:
```typescript
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

export class DiagramFocusRegionService implements IFocusRegionService {
  private current: DiagramFocusRegionState | null = null;

  getDiagramFocusRegion(): DiagramFocusRegionState | null { ... }
  publishDiagramFocusGroup(...): void { ... }
  publishDiagramFocusCanvas(...): void { ... }
  clearDiagramFocusRegion(canvasId?: string): void { ... }
}

/** Default singleton used by DiagramWidget and useDiagramFocusRegion in production. */
export const diagramFocusRegionService: IFocusRegionService = new DiagramFocusRegionService();

// Backwards-compatible module-level function wrappers:
export const getDiagramFocusRegion = (): DiagramFocusRegionState | null =>
  diagramFocusRegionService.getDiagramFocusRegion();
export const clearDiagramFocusRegion = (canvasId?: string): void =>
  diagramFocusRegionService.clearDiagramFocusRegion(canvasId);
// (etc.)
```

**Public API compatibility**: The existing module-level functions (`getDiagramFocusRegion`,
`clearDiagramFocusRegion`, `publishDiagramFocusGroup`, `publishDiagramFocusCanvas`,
`DIAGRAM_FOCUS_REGION_EVENT`) remain exported from `focusRegion.ts` as wrappers. The
`index.ts` exports are unchanged.

**Usages to update**: `widget.ts` and `useDiagramFocusRegion.ts` — both continue to
call the module-level functions, which now delegate to the singleton service. No caller
changes needed.

### 3.15 `rendering/nodeLabelLayout.ts` — NEW

**Purpose**: Pure functions for computing label and sublabel Y-positions within a diagram
node's content rectangle.

**Why**: Label positioning arithmetic (`labelY`, `sublabelY`, `labelFontSize`,
`sublabelFontSize`, icon-vs-text layout logic) is embedded in `NodeRenderer.updateEntry()`.
These 30+ lines of arithmetic are pure math with no Three.js dependency — they compute
layout metrics from node state and theme config. Extracted as a pure function, they become
independently testable.

**Exports**:
```typescript
export type NodeLabelLayout = {
  /** Y center position of the primary label in diagram-local units (Y-up). */
  readonly labelY: number;
  /** Y center position of the sublabel in diagram-local units (Y-up). Undefined if no sublabel. */
  readonly sublabelY: number | undefined;
  /** Computed primary label font size in world units. */
  readonly labelFontSize: number;
  /** Computed sublabel font size in world units. Undefined if no sublabel. */
  readonly sublabelFontSize: number | undefined;
  /** Z offset for label text (in front of node face). */
  readonly labelZ: number;
  /** Z offset for sublabel text. */
  readonly sublabelZ: number;
};

/**
 * Computes label and sublabel layout positions within a node's content rectangle.
 *
 * @param contentW   Width of the usable content area (after shape masking, in world units)
 * @param contentH   Height of the usable content area (after shape masking, in world units)
 * @param thickness  Node depth (used for Z offset calculation)
 * @param hasIcon    Whether the node has an icon overlay (affects label Y position)
 * @param hasSublabel Whether the node has a sublabel
 * @param iconScale  Icon size as fraction of contentH
 * @param labelFontSizeBase  Label font size as fraction of contentH (from theme)
 * @param sublabelFontSizeBase Sublabel font size as fraction of contentH (from theme)
 * @param labelSizeFactor    Composed label size scale factor
 * @param sublabelSizeFactor Composed sublabel size scale factor
 */
export function computeNodeLabelLayout(
  contentW: number,
  contentH: number,
  thickness: number,
  hasIcon: boolean,
  hasSublabel: boolean,
  iconScale: number,
  labelFontSizeBase: number,
  sublabelFontSizeBase: number,
  labelSizeFactor: number,
  sublabelSizeFactor: number,
): NodeLabelLayout;
```

### 3.16 `rendering/NodeRenderer.ts` — MODIFY

**What changes**: Extract label positioning arithmetic into a call to
`computeNodeLabelLayout()` from `./nodeLabelLayout`. The `updateEntry()` method retains
all Three.js mutations but delegates the numeric layout calculation to the pure function.

**Before** (conceptually):
```typescript
// 30+ lines of arithmetic inline
const labelFontSize = contentH * themeConfig.nodeLabelFontSizeBase * (themeConfig.effectiveLabelSizeFactor ?? 1.0);
const sublabelFontSize = ...;
let labelY = 0;
let sublabelY = -contentH * 0.22;
if (state.iconUrl) { ... }
else if (state.sublabel) { ... }
```

**After**:
```typescript
const layout = computeNodeLabelLayout(
  contentW, contentH, state.thickness,
  !!state.iconUrl, !!state.sublabel,
  state.iconScale,
  themeConfig.nodeLabelFontSizeBase, themeConfig.nodeSublabelFontSizeBase,
  themeConfig.effectiveLabelSizeFactor ?? 1.0,
  themeConfig.effectiveSublabelSizeFactor ?? 1.0,
);
// Use layout.labelY, layout.sublabelY, layout.labelFontSize, etc.
```

### 3.17 `render.ts` — MODIFY (DiagramRenderer accepts IIconLoader)

**Current state**: `DiagramRenderer` constructor hardcodes `sharedIconLoader`:
```typescript
this.nodeRenderer = new NodeRenderer(sharedIconLoader, this.interactionRegistry);
```

**What changes**: `DiagramRenderer` accepts an optional `IIconLoader` parameter, defaulting
to `sharedIconLoader`:

```typescript
export class DiagramRenderer {
  constructor(
    initialThemeConfig: DiagramThemeRenderConfig,
    iconLoader: IIconLoader = sharedIconLoader,
  ) {
    this.nodeRenderer = new NodeRenderer(iconLoader, this.interactionRegistry);
    // ...
  }
}
```

**Backwards compatibility**: `DiagramRenderer` is constructed in `widget.ts`:
```typescript
private renderer = new DiagramRenderer(buildThemeRenderConfig(darkGlassTheme));
```
This continues to work because `iconLoader` defaults to `sharedIconLoader`. Tests can
pass a no-op `IIconLoader` double.

**Also**: Remove `sharedIconLoader.disposeAll()` from `DiagramWidget.dispose()`. The
DiagramWidget should dispose only its own resources. Disposing the global shared cache on
widget teardown is a side effect that can corrupt other DiagramWidget instances in the same
render context. The shared icon cache's lifecycle should be managed by the consumer
(e.g., a plugin teardown callback) not by per-widget dispose.

---

## 4. New Interface Definitions (Summary)

All new interfaces introduced by this plan:

```typescript
// compiler/defaultsCompiler.ts
interface NodeDefaults { /* 19 fields */ }
interface EdgeDefaults { /* 14 fields */ }
interface GroupDefaults { /* 13 fields */ }

// compiler/hoverStateMachine.ts
type HoverTarget = { diagramId, groupPath, nodeId?, point }
type HoverEvent =
  | { type: 'node-mouse-enter', diagramId, nodeId, point }
  | { type: 'node-mouse-leave', diagramId, nodeId, point }
  | { type: 'group-mouse-enter', diagramId, groupId, point }
  | { type: 'group-mouse-leave', diagramId, groupId, point }

// compiler/normalizeToViewport.ts
type NormalizeToViewportResult = {
  normalizedPositions: Map<string, readonly [number, number, number]>;
  normalizedSizes: Map<string, readonly [number, number]>;
  normalizedGroups: Map<string, GroupBounds>;
  contentAspect: number;
}

// focusRegion.ts (new)
interface IFocusRegionService { ... }

// rendering/nodeLabelLayout.ts
type NodeLabelLayout = { labelY, sublabelY?, labelFontSize, sublabelFontSize?, labelZ, sublabelZ }
```

---

## 5. File-Level Migration Table

| Old Path | New Path | Action | Reason |
|---|---|---|---|
| `elements/diagram/constants.ts` | `elements/diagram/constants.ts` | **NEW** | Shared constants out of compiler/ |
| `compiler/diagramRenderConstants.ts` | `compiler/diagramRenderConstants.ts` | **MODIFY** | Becomes re-export shim |
| `compiler/defaultsCompiler.ts` | `compiler/defaultsCompiler.ts` | **NEW** | Extract defaults from nodeCompiler |
| `compiler/nodeCompiler.ts` | same | **MODIFY** | Remove build*Defaults bodies; import for internal use only |
| `compiler/__tests__/nodeCompiler.test.ts` | same | **MODIFY** | Remove build*Defaults test suites (moved to defaultsCompiler.test.ts) |
| `compiler/groupCompiler.ts` | same | **MODIFY** | Import buildGroupDefaults from defaultsCompiler |
| `compiler/layoutAlgorithms.ts` | same | **MODIFY** | Becomes orchestration-only (~120 lines) |
| `compiler/layout/gridLayout.ts` | `compiler/layout/gridLayout.ts` | **NEW** | Extracted grid algorithm |
| `compiler/layout/hierarchicalLayout.ts` | `compiler/layout/hierarchicalLayout.ts` | **NEW** | Extracted hierarchical algorithm |
| `compiler/layout/flowLayout.ts` | `compiler/layout/flowLayout.ts` | **NEW** | Extracted flow algorithm |
| `compiler/layout/bounds.ts` | `compiler/layout/bounds.ts` | **NEW** | Extracted bounds utility |
| `compiler/layout/index.ts` | `compiler/layout/index.ts` | **NEW** | Barrel for layout sub-modules |
| `compiler/normalizeToViewport.ts` | `compiler/normalizeToViewport.ts` | **NEW** | Extracted pure function from compile.ts |
| `compile.ts` | same | **MODIFY** | Import normalizeToViewport from compiler/ |
| `elements/diagram/__tests__/normalizeToViewport.test.ts` | same | **MODIFY** | Rewrite to import function directly; stays in current location |
| `compiler/hoverStateMachine.ts` | `compiler/hoverStateMachine.ts` | **NEW** | Extracted from widget.ts |
| `compiler/ghostNodeMerge.ts` | `compiler/ghostNodeMerge.ts` | **NEW** | Extracted from widget.ts |
| `widget.ts` | same | **MODIFY** | Delegate hover/merge to new modules |
| `focusRegion.ts` | same | **MODIFY** | Class-based service + backwards-compat wrappers |
| `rendering/nodeLabelLayout.ts` | `rendering/nodeLabelLayout.ts` | **NEW** | Extracted pure math from NodeRenderer |
| `rendering/NodeRenderer.ts` | same | **MODIFY** | Use computeNodeLabelLayout |
| `render.ts` | same | **MODIFY** | IIconLoader constructor param |
| `elements/image-panel/` | same | **NONE** | Already clean |
| `elements/screen/` | same | **NONE** | Already clean |
| `compiler/handlers.ts` | same | **NONE** | Complex but scoped; no testability blocker |
| `compiler/edgeRenderOptimizer.ts` | same | **NONE** | Tolerable location; no testability blocker |
| `compiler/themeResolver.ts` | same | **NONE** | Already clean and small |
| `compiler/layoutResolver.ts` | same | **NONE** | Already clean and small |
| `compiler/transitionHelpers.ts` | same | **NONE** | Already clean |
| `compiler/edgeRouter.ts` | same | **NONE** | Already well-decomposed pipeline |
| `compiler/routingTypes.ts` | same | **NONE** | Clean contract types |
| `rendering/types.ts` | same | **NONE** | Already correct |
| `rendering/InteractionRegistry.ts` | same | **NONE** | Already has IInteractionRegistry interface |
| `rendering/GroupInteractionRegistry.ts` | same | **NONE** | Already has IGroupInteractionRegistry interface |
| `rendering/EdgeMaterialFactory.ts` | same | **NONE** | Already has IEdgeMaterialFactory interface |
| `rendering/IconLoader.ts` | same | **NONE** | IIconLoader exists; injection via render.ts change |
| `rendering/EnvMapManager.ts` | same | **NONE** | Dev-mode coupling is acceptable for now |
| `rendering/EdgeRenderer.ts` | same | **NONE** | Clean |
| `rendering/GroupRenderer.ts` | same | **NONE** | Clean |
| `rendering/HDRLoader.ts` | same | **NONE** | Vendor copy; do not modify |
| `shapes/` | same | **NONE** | Already clean |
| `themes/` | same | **NONE** | Already clean |
| `math/colorUtils.ts` | same | **NONE** | Already clean |
| `player/diagramPlugin.ts` | same | **NONE** | Already clean |
| `compiler/handlers.ts` | same | **NONE** | No blocking issues; remains as-is |
| `register.ts` | same | **NONE** | Already trivially simple |
| `index.ts` | same | **NONE** | Public API unchanged |

---

## 6. Implementation Work Streams

All five streams can run in parallel. Each stream touches a disjoint set of files.
No two streams share a file. Streams may be started simultaneously by five developers.

### Work Stream A: Constants + Defaults Extraction

**Goal**: Eliminate the lateral coupling between `groupCompiler.ts` and `nodeCompiler.ts`,
and move render constants to the element boundary level.

**Files touched** (exclusive to this stream):
- `elements/diagram/constants.ts` (NEW)
- `compiler/diagramRenderConstants.ts` (MODIFY)
- `compiler/defaultsCompiler.ts` (NEW)
- `compiler/nodeCompiler.ts` (MODIFY)
- `compiler/groupCompiler.ts` (MODIFY)
- `compiler/__tests__/nodeCompiler.test.ts` (MODIFY — remove `build*Defaults` imports and tests)
- `compiler/__tests__/defaultsCompiler.test.ts` (NEW)

**Step-by-step sequence**:

1. **Create `elements/diagram/constants.ts`** (new file, no dependencies):
   ```typescript
   // elements/diagram/constants.ts
   // Constants shared between the compile and render layers.
   export const GROUP_BORDER_PX_TO_UNITS = 0.0125;
   export const GROUP_RENDER_Z = 0.005;
   ```

2. **Modify `compiler/diagramRenderConstants.ts`** to re-export:
   ```typescript
   // compiler/diagramRenderConstants.ts — backwards-compat shim
   export { GROUP_BORDER_PX_TO_UNITS, GROUP_RENDER_Z } from '../constants';
   ```

3. **Create `compiler/defaultsCompiler.ts`** — move `buildNodeDefaults`,
   `buildEdgeDefaults`, `buildGroupDefaults` from `nodeCompiler.ts` verbatim.
   Add explicit return types (the `NodeDefaults`, `EdgeDefaults`, `GroupDefaults`
   interfaces). Import from `../types` as before.

4. **Modify `compiler/nodeCompiler.ts`**: remove the three `build*Defaults` function
   bodies. Add `import { buildNodeDefaults, buildEdgeDefaults } from './defaultsCompiler'`
   for internal use. Do NOT add `export { buildNodeDefaults, buildEdgeDefaults }` —
   these functions are no longer part of `nodeCompiler`'s public surface.

5. **Modify `compiler/groupCompiler.ts`**: change the import:
   - Remove: `import { buildGroupDefaults } from './nodeCompiler'`
   - Add: `import { buildGroupDefaults } from './defaultsCompiler'`

5a. **Modify `compiler/__tests__/nodeCompiler.test.ts`**: remove all imports of
   `buildNodeDefaults` and `buildGroupDefaults` from `../nodeCompiler` and their
   associated test suites. These are now tested in `defaultsCompiler.test.ts`. Do NOT
   update the import to point at `defaultsCompiler` — duplicate coverage is not the goal.
   Retain all `compileNode`, `compileEdge`, and `buildEdgeDefaults` tests that test
   `nodeCompiler`'s actual responsibility.

6. **Create `compiler/__tests__/defaultsCompiler.test.ts`**:
   - Import `buildNodeDefaults`, `buildEdgeDefaults`, `buildGroupDefaults` from
     `../defaultsCompiler`
   - Port relevant test cases from the removed sections of `nodeCompiler.test.ts`
   - Test each function against a real `DiagramTheme` (use `darkGlassTheme` from themes/)
   - Assert that every field of the returned object matches the expected value from the theme
   - Assert that missing theme fields fall back to documented defaults

**Intra-stream sequencing constraint**: Step 1 must complete before Step 2. Steps 3–4
must complete before Steps 5a and 6. Steps 4, 5, and 5a can run in parallel once Step 3
is done. Step 6 depends on Step 3.

---

### Work Stream B: Layout Algorithm Decomposition

**Goal**: Reduce `compiler/layoutAlgorithms.ts` from 1,078 lines to ~120 lines by
extracting each algorithm to its own module.

**Files touched** (exclusive to this stream):
- `compiler/layoutAlgorithms.ts` (MODIFY — keep orchestration, remove algorithm bodies)
- `compiler/layout/gridLayout.ts` (NEW)
- `compiler/layout/hierarchicalLayout.ts` (NEW)
- `compiler/layout/flowLayout.ts` (NEW)
- `compiler/layout/bounds.ts` (NEW)
- `compiler/layout/index.ts` (NEW)
- `compiler/layout/__tests__/gridLayout.test.ts` (NEW)
- `compiler/layout/__tests__/hierarchicalLayout.test.ts` (NEW)
- `compiler/layout/__tests__/flowLayout.test.ts` (NEW)
- `compiler/layout/__tests__/bounds.test.ts` (NEW)

**Step-by-step sequence**:

1. **Create `compiler/layout/bounds.ts`**: copy `computeBounds` from
   `compiler/layoutAlgorithms.ts`. Import from `../../types`. Export the function.

2. **Create `compiler/layout/flowLayout.ts`**: copy `resolveFlowLayout` from
   `compiler/layoutAlgorithms.ts`. Imports: `../../types`, `../../compiler/layoutResolver`.
   Export the function.

3. **Create `compiler/layout/gridLayout.ts`**: copy `resolveGridLayout` from
   `compiler/layoutAlgorithms.ts`. Imports: `../../types`, `../../compiler/layoutResolver`.
   Export the function.

4. **Create `compiler/layout/hierarchicalLayout.ts`**: copy `resolveHierarchicalLayout`
   from `compiler/layoutAlgorithms.ts`. Imports: `../../types`,
   `../../compiler/layoutResolver`. Export the function.

5. **Create `compiler/layout/index.ts`**: re-export all four functions plus the
   orchestration functions from the parent:
   ```typescript
   export { computeBounds } from './bounds';
   export { resolveFlowLayout } from './flowLayout';
   export { resolveGridLayout } from './gridLayout';
   export { resolveHierarchicalLayout } from './hierarchicalLayout';
   ```

6. **Modify `compiler/layoutAlgorithms.ts`**: remove the four algorithm function bodies.
   Add imports from `./layout/*`. Keep `resolveLayout`, `resolveLayoutWithGroups`,
   and their local helpers. Export the four algorithm functions via re-export from
   `./layout/index` so all existing callers (`compile.ts`, `groupCompiler.ts`,
   `layoutAlgorithms.test.ts`) continue to work without modification.

7. **Create tests** in `compiler/layout/__tests__/`:
   - `gridLayout.test.ts`: test `resolveGridLayout` with 1-col, 2-col, auto-col; verify
     positions; verify childrenOrder is respected; verify explicit positions are preserved.
   - `hierarchicalLayout.test.ts`: test `resolveHierarchicalLayout` with DAG of 3 nodes,
     cycle edges, disconnected nodes. Verify Y-axis ordering.
   - `flowLayout.test.ts`: test `resolveFlowLayout` for top-down and left-right directions;
     verify gap spacing; verify explicit positions preserved.
   - `bounds.test.ts`: test `computeBounds` with 0, 1, and N nodes; verify min/max
     coordinate computation.

**Intra-stream sequencing constraint**: Steps 1–4 are independent (run in parallel).
Step 5 depends on 1–4 being written. Step 6 depends on Step 5. Step 7 can run after
each individual module is written.

---

### Work Stream C: Compiler Pure Function Extraction

**Goal**: Make `normalizeToViewport` independently testable and explicitly exported.

**Files touched** (exclusive to this stream):
- `compiler/normalizeToViewport.ts` (NEW)
- `compile.ts` (MODIFY — import normalizeToViewport; no other changes)
- `elements/diagram/__tests__/normalizeToViewport.test.ts` (MODIFY — update to import
  the function directly and call it with real inputs instead of via `compileDiagram`)

**Decision on test file location**: The existing test stays at
`elements/diagram/__tests__/normalizeToViewport.test.ts`. It is NOT moved to
`compiler/__tests__/`. Test co-location with source is a preference, not a requirement —
and moving the file would be a larger diff with no quality benefit. Simply update the
import and rewrite the test body in place.

**Step-by-step sequence**:

1. **Create `compiler/normalizeToViewport.ts`**: extract the private `normalizeToViewport`
   function from `compile.ts` verbatim. Add the explicit type `NormalizeToViewportResult`
   for the return value. Export both the function and the type. Import `GroupBounds` from
   `./groupCompiler`.

2. **Modify `compile.ts`**: remove the `normalizeToViewport` function body. Add:
   ```typescript
   import { normalizeToViewport } from './compiler/normalizeToViewport';
   import type { NormalizeToViewportResult } from './compiler/normalizeToViewport';
   ```

3. **Update `__tests__/normalizeToViewport.test.ts`**: change the test to import
   `normalizeToViewport` directly from `../compiler/normalizeToViewport` instead of
   calling `compileDiagram()` and inspecting the output. Rewrite tests to call the pure
   function with real inputs (node arrays, group bounds maps, padding values) and assert
   directly on the `normalizedPositions`, `normalizedSizes`, `normalizedGroups`, and
   `contentAspect` outputs.

**Test cases to cover**:
- Empty node array → `contentAspect: 1.0`, empty maps
- Single node at origin → positions normalized to `[0.5, 0.5, 0]`
- Y-axis flip: node at Cartesian `y=+2` → NVS `y < 0.5` (top half)
- Group bounds expand the bounding box
- Padding expands the bounding box
- Group bounds Y-flip: Cartesian top = group.y + group.h → NVS top of group

**Intra-stream sequencing constraint**: Step 1 before Step 2. Step 3 can start
independently of Step 2 (test can be written while compile.ts change is in review).

---

### Work Stream D: Widget Interaction Decomposition

**Goal**: Extract the hover state machine and ghost node merge logic from `widget.ts` into
independently testable pure modules. Make `focusRegion.ts` injectively testable.

**Files touched** (exclusive to this stream):
- `compiler/hoverStateMachine.ts` (NEW)
- `compiler/ghostNodeMerge.ts` (NEW)
- `widget.ts` (MODIFY)
- `focusRegion.ts` (MODIFY)
- `compiler/__tests__/hoverStateMachine.test.ts` (NEW)
- `compiler/__tests__/ghostNodeMerge.test.ts` (NEW)
- `elements/diagram/__tests__/focusRegion.test.ts` (NEW)

**Step-by-step sequence**:

1. **Create `compiler/hoverStateMachine.ts`**: implement `computeHoverTransitionEvents`,
   `buildGroupPath`, and `collectGroupIds` as pure functions. These are extracted from
   private methods in `DiagramWidget`. The functions take only plain data (DiagramState
   or parts of it; HoverTarget). No Three.js, no DOM.

   Implementation note for `buildGroupPath`:
   ```typescript
   export function buildGroupPath(
     state: Pick<DiagramState, 'groups'>,
     leafGroupId: string,
   ): ReadonlyArray<string> {
     const byId = new Map(state.groups.map((g) => [g.id, g]));
     const path: string[] = [];
     let cursor = byId.get(leafGroupId);
     while (cursor) {
       path.unshift(cursor.id);
       cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
     }
     return path;
   }
   ```

   Implementation note for `computeHoverTransitionEvents`: mirrors the logic in
   `transitionHover()` in `widget.ts` — compare prevPath and nextPath, computing which
   groups enter and leave. Returns an ordered array of `HoverEvent` values. The caller
   (`DiagramWidget`) dispatches them, handling stopPropagation.

2. **Create `compiler/ghostNodeMerge.ts`**: extract `mergeGhostNodeSnapshot` from
   `DiagramWidget.mergeSnapshot()`. The function is a pure mapping of `DiagramState | undefined`
   pairs. No Three.js. Import types from `../types`.

3. **Modify `widget.ts`**:
   - Add imports: `computeHoverTransitionEvents`, `buildGroupPath`, `collectGroupIds`
     from `./compiler/hoverStateMachine`; `mergeGhostNodeSnapshot` from
     `./compiler/ghostNodeMerge`
   - Replace `DiagramWidget.mergeSnapshot()` body with:
     ```typescript
     mergeSnapshot(prev: DiagramState | undefined, next: DiagramState | undefined) {
       return mergeGhostNodeSnapshot(prev, next);
     }
     ```
   - Replace `transitionHover()` with:
     ```typescript
     private dispatchHoverEvents(prev: HoverTarget | null, next: HoverTarget | null): void {
       const events = computeHoverTransitionEvents(prev, next);
       for (const event of events) {
         const stopped = this.dispatchSingleEvent(event);
         if (stopped) break;
       }
     }
     ```
   - Replace `buildGroupPath()` private method usage with the imported function
   - Replace `collectGroupIds()` with the imported function
   - Remove the now-dead private implementations

4. **Modify `focusRegion.ts`**: add `IFocusRegionService` interface and
   `DiagramFocusRegionService` class. Export `diagramFocusRegionService` singleton.
   Keep module-level function wrappers for backwards compatibility:
   ```typescript
   export const getDiagramFocusRegion = () => diagramFocusRegionService.getDiagramFocusRegion();
   export const clearDiagramFocusRegion = (id?: string) => diagramFocusRegionService.clearDiagramFocusRegion(id);
   // (etc.)
   ```

5. **Write tests**:

   `compiler/__tests__/hoverStateMachine.test.ts`:
   ```typescript
   // Test buildGroupPath with nested groups (root→child→leaf)
   // Test buildGroupPath with unknown groupId → empty array
   // Test computeHoverTransitionEvents(null, null) → []
   // Test null→node: emits node-mouse-enter
   // Test node→null: emits node-mouse-leave
   // Test node A → node B (same group): leave A, enter B
   // Test node A → node B (different group): leave A, leave group, enter new group, enter B
   // Test group enter/leave ordering: outer groups before inner groups
   // Test collectGroupIds with includeDescendants: false → only specified group
   // Test collectGroupIds with includeDescendants: true → subtree
   ```

   `compiler/__tests__/ghostNodeMerge.test.ts`:
   ```typescript
   // Test mergeGhostNodeSnapshot(undefined, undefined) → undefined
   // Test mergeGhostNodeSnapshot(prev, undefined) → undefined
   // Test mergeGhostNodeSnapshot(undefined, next) → next unchanged
   // Test ghost node (label undefined): inherits label, sublabel, shape, iconUrl from prev
   // Test non-ghost node (label defined): not merged
   // Test positionInherited: position, size, thickness merged from prev; flag cleared
   // Test anyChanged=false: returns same next object reference (no allocation)
   ```

   `elements/diagram/__tests__/focusRegion.test.ts`:
   ```typescript
   // Instantiate DiagramFocusRegionService directly (not the module singleton)
   // Test initial state: getDiagramFocusRegion() → null
   // Test publishDiagramFocusGroup: getDiagramFocusRegion() returns correct snapshot
   // Test clearDiagramFocusRegion(canvasId): clears matching canvas, not others
   // Test clearDiagramFocusRegion(): clears all
   // Test CustomEvent dispatch: mock window.dispatchEvent, verify event details
   ```

**Coexistence note**: The existing `elements/diagram/__tests__/ghostNode.test.ts` tests
ghost node semantics end-to-end by calling `DiagramWidget.mergeSnapshot()`. After Stream D,
`mergeSnapshot()` delegates to `mergeGhostNodeSnapshot`. The existing test keeps passing
and remains in place — it provides integration-level coverage that the widget correctly
delegates. The new `ghostNodeMerge.test.ts` provides unit-level coverage of the pure
transformation function directly. Both test files are intentionally kept. Do NOT delete
`ghostNode.test.ts`.

**Intra-stream sequencing constraint**: Steps 1 and 2 are independent. Step 3 depends on
Steps 1 and 2. Steps 4 and 5 are independent of Steps 1–3.

---

### Work Stream E: Rendering Layer Injectable Dependencies

**Goal**: Make `NodeRenderer`'s label math independently testable and make `DiagramRenderer`
testable with a no-op icon loader.

**Files touched** (exclusive to this stream):
- `rendering/nodeLabelLayout.ts` (NEW)
- `rendering/NodeRenderer.ts` (MODIFY)
- `render.ts` (MODIFY)
- `rendering/__tests__/nodeLabelLayout.test.ts` (NEW)

**Step-by-step sequence**:

1. **Create `rendering/nodeLabelLayout.ts`**: extract the label layout arithmetic from
   `NodeRenderer.updateEntry()`. The function takes scalar parameters derived from
   `DiagramNodeState` and `DiagramThemeRenderConfig`, and returns `NodeLabelLayout`.

   Full implementation:
   ```typescript
   export function computeNodeLabelLayout(
     contentW: number,
     contentH: number,
     thickness: number,
     hasIcon: boolean,
     hasSublabel: boolean,
     iconScale: number,
     labelFontSizeBase: number,
     sublabelFontSizeBase: number,
     labelSizeFactor: number,
     sublabelSizeFactor: number,
   ): NodeLabelLayout {
     const labelFontSize = contentH * labelFontSizeBase * labelSizeFactor;
     const sublabelFontSize = hasSublabel ? contentH * sublabelFontSizeBase * sublabelSizeFactor : undefined;
     const labelLine = labelFontSize * 1.1;
     const sublabelLine = sublabelFontSize ? sublabelFontSize * 1.1 : 0;
     const lineGap = contentH * 0.06;

     let labelY = 0;
     let sublabelY: number | undefined;

     if (hasIcon) {
       const iconHeight = contentH * iconScale;
       const iconCenterY = contentH * 0.2;
       const iconBottomY = iconCenterY - iconHeight / 2;
       const textTopY = iconBottomY - contentH * 0.08;
       labelY = textTopY - labelLine / 2;
       if (hasSublabel) {
         sublabelY = labelY - (labelLine / 2 + sublabelLine / 2 + lineGap);
       }
     } else if (hasSublabel) {
       labelY = contentH * 0.1;
       sublabelY = labelY - (labelLine / 2 + sublabelLine / 2 + lineGap);
     }

     return {
       labelY,
       sublabelY,
       labelFontSize,
       sublabelFontSize,
       labelZ: thickness / 2 + 0.02,
       sublabelZ: thickness / 2 + 0.02,
     };
   }
   ```

2. **Modify `rendering/NodeRenderer.ts`**: in `updateEntry()`, replace the inline label
   arithmetic with:
   ```typescript
   import { computeNodeLabelLayout } from './nodeLabelLayout';
   import { getContentRect } from '../shapes/geometryFactory';

   // (in updateEntry)
   const [contentW, contentH] = getContentRect(state.shape, state.size);
   const labelLayout = computeNodeLabelLayout(
     contentW, contentH, state.thickness,
     !!state.iconUrl, !!state.sublabel,
     state.iconScale,
     themeConfig.nodeLabelFontSizeBase,
     themeConfig.nodeSublabelFontSizeBase,
     themeConfig.effectiveLabelSizeFactor ?? 1.0,
     themeConfig.effectiveSublabelSizeFactor ?? 1.0,
   );
   // Use labelLayout.labelFontSize, labelLayout.labelY, etc.
   ```

3. **Modify `render.ts`**: add `iconLoader` parameter to `DiagramRenderer` constructor:
   ```typescript
   import { sharedIconLoader } from './rendering/IconLoader';
   import type { IIconLoader } from './rendering/IconLoader';

   export class DiagramRenderer {
     constructor(
       initialThemeConfig: DiagramThemeRenderConfig,
       iconLoader: IIconLoader = sharedIconLoader,
     ) {
       this.nodeRenderer = new NodeRenderer(iconLoader, this.interactionRegistry);
       // ...
     }
   }
   ```

   Additionally, remove the `sharedIconLoader.disposeAll()` call from any `dispose()`
   path. This global side effect does not belong in per-widget teardown.

4. **Create `rendering/__tests__/nodeLabelLayout.test.ts`**:
   ```typescript
   // Test: no icon, no sublabel → labelY=0, sublabelY=undefined
   // Test: with icon → labelY is below icon + gap
   // Test: with sublabel (no icon) → labelY positive, sublabelY < labelY
   // Test: with icon and sublabel → both positioned below icon
   // Test: labelFontSize = contentH * base * factor (verify multiplication)
   // Test: labelZ = thickness/2 + 0.02
   // Test: zero contentH → no div-by-zero
   ```

**Intra-stream sequencing constraint**: Step 1 before Step 2. Steps 3 and 4 are
independent of Steps 1–2.

---

## 7. Test Strategy

### 7.1 Per-Module Test Coverage

| Module | Test File | Real Inputs | Assertions |
|---|---|---|---|
| `compiler/defaultsCompiler.ts` | `compiler/__tests__/defaultsCompiler.test.ts` | Real `darkGlassTheme`, `neonCyberTheme` | All returned fields match theme values |
| `compiler/layout/gridLayout.ts` | `compiler/layout/__tests__/gridLayout.test.ts` | `DiagramNodeDSL[]` arrays, `ResolvedGridLayout` | Position map matches expected Cartesian coords |
| `compiler/layout/hierarchicalLayout.ts` | `compiler/layout/__tests__/hierarchicalLayout.test.ts` | DAG + cycle edge arrays | Source nodes at root, sinks at leaves |
| `compiler/layout/flowLayout.ts` | `compiler/layout/__tests__/flowLayout.test.ts` | Node arrays + `ResolvedFlowLayout` | Edge-to-edge gap spacing |
| `compiler/layout/bounds.ts` | `compiler/layout/__tests__/bounds.test.ts` | Position arrays | Min/max of outer edges |
| `compiler/normalizeToViewport.ts` | `elements/diagram/__tests__/normalizeToViewport.test.ts` (existing, modified) | Node arrays, group bounds maps, padding | NVS positions, Y-flip, content aspect |
| `compiler/hoverStateMachine.ts` | `compiler/__tests__/hoverStateMachine.test.ts` | HoverTarget values, DiagramState | Ordered HoverEvent arrays |
| `compiler/ghostNodeMerge.ts` | `compiler/__tests__/ghostNodeMerge.test.ts` | DiagramState pairs | Merged DiagramNodeState fields |
| `focusRegion.ts` (new class) | `__tests__/focusRegion.test.ts` | DiagramFocusRegionService instance | State transitions, event dispatch |
| `rendering/nodeLabelLayout.ts` | `rendering/__tests__/nodeLabelLayout.test.ts` | Scalar dimensions | Label Y positions, font sizes |

### 7.2 Test Double Strategy

**For `IIconLoader` in DiagramRenderer tests**:
```typescript
const noOpIconLoader: IIconLoader = {
  load: () => Promise.resolve(new THREE.Group()),
  disposeAll: () => {},
};
const renderer = new DiagramRenderer(buildThemeRenderConfig(darkGlassTheme), noOpIconLoader);
```

**For `focusRegion.ts` tests**: `DiagramWidget` does NOT accept `IFocusRegionService`
as a constructor parameter — it continues to call the module-level wrapper functions
(`getDiagramFocusRegion`, `clearDiagramFocusRegion`, etc.), which delegate to the
singleton `diagramFocusRegionService`. This design avoids changing `DiagramWidget`'s
constructor signature and is sufficient: `focusRegion.ts` is tested by instantiating
`DiagramFocusRegionService` directly in `focusRegion.test.ts`, not through widget
injection. The `IFocusRegionService` interface documents the contract; the singleton
wrappers provide production continuity. If widget-level focus isolation becomes a
testability requirement in the future, a constructor-injection refactor is the path —
it is explicitly out of scope for this plan.

**For layout algorithm tests**: use real `DiagramNodeDSL` objects and real
`ResolvedLayout` values (no mocking required — pure functions).

**For `hoverStateMachine` tests**: use real `DiagramState` objects with minimal fields.
The functions only read `groups` array and `nodes` array — construct minimal objects.

**For `ghostNodeMerge` tests**: use real `DiagramNodeState` and `DiagramState` objects.
No Three.js dependency.

### 7.3 Test Environment

All tests run in Vitest Node environment. No real `requestAnimationFrame`, no real WebGL,
no real network. Tests for pure compilation modules need only the Node environment. Tests
for rendering-layer modules that construct Three.js objects require the existing Three.js
mock patterns already established in the codebase.

---

## 8. Public API Compatibility

**No changes to `packages/diagram/src/index.ts`**.

All refactored functions are internal implementation details. The public API surface
remains identical:
- `DiagramRenderer` still exported from `./elements/diagram/render` (modified constructor
  is backwards-compatible — new param has a default)
- `compileDiagram`, `resolveLayout`, `routeEdges`, `compileNode`, `compileEdge`,
  `compileGroup`, `applyDiagramExit`, `applyDiagramEnter`,
  `functionalDiagramTransitionSpec` still exported from `./elements/diagram/compile`
- All type exports from `./elements/diagram/types` unchanged
- All widget exports (`Diagram`, `DiagramNode`, etc., `DiagramWidget`) from
  `./elements/diagram/widget` unchanged
- `diagramPlugin` unchanged
- All theme exports unchanged
- Focus region exports unchanged (module-level functions remain as wrappers)

**One constructor-level change** that is strictly additive:
```typescript
// Before
new DiagramRenderer(themeConfig)
// After (backwards-compatible — iconLoader has a default value)
new DiagramRenderer(themeConfig)                          // still works
new DiagramRenderer(themeConfig, noOpIconLoader)          // new in tests
```

---

## 9. Verification Checklist

After all five work streams are implemented, verify:

- [ ] `pnpm --filter @brewsite/diagram typecheck` passes with zero errors
- [ ] `pnpm --filter @brewsite/diagram test` passes with all tests green
- [ ] No new `any` types introduced in production code
- [ ] `compiler/diagramRenderConstants.ts` re-exports from `../constants` — verify no
  direct constant definitions remain
- [ ] `compiler/groupCompiler.ts` imports `buildGroupDefaults` from `./defaultsCompiler`,
  NOT from `./nodeCompiler`
- [ ] `compiler/nodeCompiler.ts` does NOT export `buildNodeDefaults`, `buildEdgeDefaults`,
  or `buildGroupDefaults` — they are internal imports only
- [ ] `compiler/__tests__/nodeCompiler.test.ts` no longer imports `buildNodeDefaults` or
  `buildGroupDefaults` from `../nodeCompiler`
- [ ] `compiler/layout/index.ts` does NOT re-export `resolveLayout` or
  `resolveLayoutWithGroups` — only the four algorithm functions are exported there
- [ ] `compiler/layoutAlgorithms.ts` is ≤ 150 lines and contains no algorithm
  implementations — only `resolveLayout` and `resolveLayoutWithGroups`
- [ ] `compiler/layout/` contains four files plus `index.ts`, each algorithm in its own file
- [ ] `compiler/normalizeToViewport.ts` exists and exports `normalizeToViewport` and
  `NormalizeToViewportResult`
- [ ] `compile.ts` imports `normalizeToViewport` from `./compiler/normalizeToViewport`,
  not defined locally
- [ ] `widget.ts` does not contain `transitionHover`, `buildGroupPath`, `collectGroupIds`,
  `createHoverControls` as private methods — these are in `compiler/hoverStateMachine.ts`
- [ ] `widget.ts` does not contain the `mergeSnapshot` implementation body — it delegates
  to `mergeGhostNodeSnapshot`
- [ ] `focusRegion.ts` exports `IFocusRegionService` and `DiagramFocusRegionService`
- [ ] `focusRegion.ts` still exports the module-level functions unchanged (no API break)
- [ ] `rendering/nodeLabelLayout.ts` exists and exports `computeNodeLabelLayout` and
  `NodeLabelLayout`
- [ ] `rendering/NodeRenderer.ts` does not contain inline label arithmetic
- [ ] `DiagramRenderer` constructor accepts an optional second parameter `iconLoader: IIconLoader`
- [ ] `DiagramWidget.dispose()` does NOT call `sharedIconLoader.disposeAll()`
- [ ] All new test files exist and each test file has ≥ 3 meaningful test cases
- [ ] All new pure functions have zero Three.js or React imports
- [ ] `elements/diagram/constants.ts` exists and exports `GROUP_BORDER_PX_TO_UNITS`
  and `GROUP_RENDER_Z`
- [ ] `compiler/diagramRenderConstants.ts` re-exports those constants and is otherwise empty
- [ ] `rendering/GroupRenderer.ts` still works (it imports from `compiler/diagramRenderConstants.ts`,
  which now re-exports from `../constants` — verify no import changes needed)
- [ ] `index.ts` diff shows zero changes

---

## 10. Decisions That Deviate from Default Architecture Patterns

### 10.1 `types.ts` is NOT split

**Decision**: Keep `types.ts` as a single file despite mixing four concern types.

**Rationale**: `DiagramThemeRenderConfig` is exported in the public API from `types.ts`.
Moving it would require a re-export chain with no benefit to package consumers. The 1,443
lines are primarily JSDoc comments — the actual type information density is appropriate
for a package with this many configurable concepts. A future major version could split the
file.

**DEBT**: Document in the file's header which section each type belongs to (DSL types,
compiled state types, theme types, render config types, interaction types).

### 10.2 `compiler/handlers.ts` is NOT refactored

**Decision**: The `extractDiagramDSL` function in `handlers.ts` is not extracted to a
separate `diagramDslExtractor.ts` module.

**Rationale**: The function is 200+ lines but is tested via `handlers.test.tsx` at the
handler level. The `as Record<string, unknown>` casts are unavoidable given that React
elements' props are typed as `{}` at the JSX level. The function's coupling to the
`CompileHelpers` API makes it difficult to extract as a pure function without that contract.
The risk/effort tradeoff does not justify the refactoring in this plan.

**DEBT**: If `extractDiagramDSL` becomes the source of bugs, consider extracting to a
dedicated module with a `DiagramDslProps` intermediate type that holds the raw Record values
before typed extraction. Not part of this plan.

### 10.3 `compiler/edgeRenderOptimizer.ts` stays in `compiler/`

**Decision**: `optimizeSharedFlowTrunks()` is not moved to a different directory despite
operating on compiled state.

**Rationale**: It is called only from `compileDiagram()` at the end of the compilation
pipeline. Moving it to a neutral location (e.g., `elements/diagram/edgeRenderOptimizer.ts`)
would require updating the import in `compile.ts` and rerunning tests with no testability
gain. The function already has tests via the edge routing test suite.

### 10.4 `rendering/EnvMapManager.ts` dev-reload logic is NOT extracted

**Decision**: The `reloadPageOnceForHdr()` and `isDevRuntime()` methods remain in
`EnvMapManager`.

**Rationale**: This logic runs only in development mode (guarded by `isDevRuntime()`).
Tests can work around it by ensuring the dev-reload path is not triggered (HDR URLs that
resolve normally). Extracting to a `IDevReloadStrategy` interface would add complexity
for a path that is not a testability blocker in CI.

### 10.5 DSL stub functions stay in `widget.ts`, not in a separate `dslStubs.ts`

**Decision**: The 14 null-returning DSL stub functions (`DiagramNode`, `DiagramEdge`,
etc.) remain in `widget.ts`.

**Rationale**: The existing convention in this codebase (established in the DX audit
implementation) is to co-locate DSL stubs with the widget file. The stubs in `widget.ts`
are referenced directly by `DiagramWidget.childDslComponents` and
`DiagramWidget.DslComponent`. Separating them would require the widget to import from
a new file for types it directly references.

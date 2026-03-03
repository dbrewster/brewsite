---
title: "@brewsite/diagram — DX Audit: Findings & Recommendations"
doc_type: note
status: implemented
owner: brewsite-product-manager
updated: 2026-03-02
---

# @brewsite/diagram — DX Audit: Findings & Recommendations

**Status:** Implemented. All Group C breaking changes and Group B additive changes have shipped. PRDs and README updated accordingly.

**Trigger:** Reports that AI assistants ("bots") consistently fail to author working diagram
scenes — producing blank renders or compile errors despite writing syntactically valid DSL.
This is a strong signal of systemic usability problems, not individual edge cases.

**Method:** Two-pass analysis. First pass: broad DX audit of the full DSL surface, compiler
pipeline, widget system, examples, and test suite. Second pass: targeted cross-check of
specific technical claims from the first pass against live source code. The cross-check
corrected several initial assumptions and is documented explicitly below.

---

## Cross-Check Corrections (What the First Pass Got Wrong)

Before the findings, these items from the initial broad audit were **incorrect** and must
not be carried into future PRD work:

**Icon type safety is fine.** `DiagramIconVariant` is a proper discriminated union of eight
closed literal-type unions plus an open `custom:${string}` template. All AWS (56 values),
UI (79 values), and tech (65 values) icons are enumerated. TypeScript autocomplete works
for all closed namespaces. This is not a problem.

**Required props are minimal and intentional.** DiagramNode requires only `id`. DiagramEdge
requires `from` and `to`. DiagramGroup requires `id`. Diagram requires `id`. All defaults
are documented in JSDoc. The prop surface is genuinely clean.

**The missing-widget warning message is actionable.** The `MISSING_WIDGET` compiler warning
names the exact canvas ID, names the file (`widgetSetup.ts`), and tells the developer
exactly what to do. It is not a silent failure.

**JSDoc defaults are present.** The audit suggested props had no documented defaults.
The cross-check confirmed defaults are present in component JSDoc. Documentation quality
here is adequate.

These corrections matter: they tell us the problems are architectural and semantic, not
primarily typographic or documentation gaps.

---

## Findings

Findings are ordered by impact on new-developer success, not by ease of fix.

---

### Finding 1 — Widget Pre-Registration: The Primary Cause of Blank Renders

**Severity:** Critical
**Type:** Architectural design problem
**Semver impact if fixed:** Major (breaking change to widget registration contract)

#### The problem

Rendering any `<DiagramCanvas>` requires pre-registering a corresponding
`DiagramCanvasWidget` instance in a separate file (`widgetSetup.ts`) with an ID that
exactly matches the `id` prop used in the DSL. These two declarations are coupled but live
in completely separate locations with no mechanical linkage.

```typescript
// File 1: scenes/my_scene.tsx — the author writes this
<DiagramCanvas id="system-canvas" theme={darkGlassTheme}>
  <Diagram id="arch">
    <DiagramNode id="api" label="API Gateway" icon="aws:api-gateway" />
  </Diagram>
</DiagramCanvas>

// File 2: widgetSetup.ts — the author must ALSO write this
// Nothing in File 1 references File 2 or vice versa
registry.register(
  new DiagramCanvasWidget(
    'system-canvas',
    compileCanvas({ id: 'system-canvas' }, [], [])
  )
);
```

If the registration in File 2 is absent, the scene compiles without error (a warning is
emitted, but see below), and the canvas renders blank.

#### Why bots fail here

A bot reads the `@brewsite/diagram` API surface, writes a syntactically correct
`<DiagramCanvas>` scene, and produces a non-working result. The bot has no way to discover
the `widgetSetup.ts` requirement from the DSL API alone. The widget pre-registration
contract is not surfaced by the DSL types, not surfaced by compiler errors, and not
surfaced by any runtime error. The warning is real but only appears if the consumer's
setup pipes compiler warnings to a visible channel — which first-time consumers haven't
configured yet.

#### Why humans fail here

Adding a new diagram scene to an existing site requires editing two unrelated files in
potentially different directories. A developer focused on the scene authoring task will not
naturally think to check `widgetSetup.ts`. If they forget, nothing breaks loudly. The blank
canvas looks like a rendering bug, not a registration bug.

#### The root cause

The `WidgetRegistry` pre-registration model from `@brewsite/core` was designed for widgets
that require complex upfront initialization: GPU resource allocation, async asset loading,
or state that cannot be derived from the compiled SceneTrack alone. `ModelWidget` is the
canonical example — it must load a GLTF file. Pre-registration is the right model for
that.

`DiagramCanvasWidget` does not require any of this. Its initial state is trivial. The
compiled SceneTrack contains everything needed to drive it. It adopted the pre-registration
model because the widget system requires it, not because canvas initialization demands it.

#### Fix direction

Three approaches, in order of preference:

**Option A (preferred): Auto-register during compilation.**
When the `DiagramCanvas` handler fires in `compiler/handlers.ts`, it has the canvas ID,
the compiled `DiagramCanvasState`, and access to the `WidgetRegistry` via the compile API.
Create the `DiagramCanvasWidget` at compilation time and register it automatically. The
consumer never touches `widgetSetup.ts` for diagram canvases. The `MISSING_WIDGET` warning
path becomes dead code.

This requires threading the `WidgetRegistry` into the compile API context — a small
architectural change with significant DX payoff.

**Option B: Lazy self-registration.**
`DiagramCanvasWidget` registers itself with a shared registry singleton on its first
`apply()` call. Reduces the pain but doesn't eliminate the separate file requirement
entirely.

**Option C: Auto-discovery factory.**
Provide a `createDiagramWidgetsFromScenes(scenes, registry)` helper that scans the
compiled SceneTrack for all `DiagramCanvasState` entries and auto-creates/registers their
widgets. Still requires a separate call but removes the manual per-canvas listing.

The existing explicit pre-registration path should be deprecated (not removed) in the
initial fix. Consumers with existing `widgetSetup.ts` patterns should see a deprecation
warning in the next minor version and a migration path to the auto-registration behavior.

---

### Finding 2 — Ghost Node Trigger: Semantically Wrong Detection Mechanism

**Severity:** Critical
**Type:** Semantic design error
**Semver impact if fixed:** Major (breaking behavior change)

#### The problem

A ghost node is a node that inherits its visual identity (label, shape, icon, size,
position) from the matching node in the previous scene. Ghost nodes enable the drill-down
animation pattern: a full diagram in scene N becomes a faded context layer in scene N+1
when the author zooms into a specific tier.

The ghost node detection in `DiagramWidget.mergeSnapshot()` is triggered by
`node.label === ''` — an empty string label. This is the detection mechanism:

```typescript
// widget.ts:209
if (node.label !== '' && !node.positionInherited) return node;  // fully-declared: skip
// otherwise: merge from previous scene
```

**The semantic problem is that empty string and absent label are two different things.**

- `label=""` means: this node has a label, and the label is empty (a blank text box)
- `label` not specified means: the author didn't provide a label

Both compile to `label: ''` in `DiagramNodeState` because the DSL compiles `undefined`
to `''` as a default. The two intentions are indistinguishable after compilation.

The consequence:

```typescript
// Author intent: "show this node with no visible text label, keep full visual state"
<DiagramNode id="cdn" label="" size={[5, 2]} color="#1a3d5c" />
// Actual behavior: this is a ghost node — it INHERITS from the prior scene
// The explicit color="#1a3d5c" override is discarded if a prior scene had a different color

// Author intent: "show a ghost/faded version of this node from the prior scene"
<DiagramNode id="cdn" opacity={0.3} />
// Actual behavior: this IS correctly a ghost node
// But so is the case above — the author writing label="" gets the wrong behavior
```

There is also no documentation anywhere on the `DiagramNode` component that explains the
ghost node concept, how to trigger it, or what "inheriting from the prior scene" means.
This is a completely undiscoverable feature with a semantically incorrect trigger.

#### Fix direction

Change the ghost node trigger from `label === ''` to `label prop was not provided`
(i.e., `label` is `undefined` in the DSL). This requires preserving `undefined` through
the DSL-to-compiled-state pipeline rather than defaulting it to `''`.

```typescript
// After fix:

// Ghost node: label prop absent entirely
<DiagramNode id="cdn" opacity={0.3} />
// label is undefined in DSL → positionInherited=true set by compiler → ghost

// Intentionally labelless node: explicit empty string
<DiagramNode id="cdn" label="" size={[5, 2]} color="#1a3d5c" />
// label is '' in DSL → NOT a ghost → state fully respected
```

`DiagramNodeState.label` type changes from `string` to `string | undefined`. `positionInherited`
can remain the mechanism for geometry inheritance (it already handles the position case
correctly). The ghost detection in `mergeSnapshot` should check `node.positionInherited === true`
only (which the compiler sets when label is absent) rather than inspecting the string value.

Separately, the ghost node feature needs a JSDoc section on `DiagramNode` explaining:
- What a ghost node is
- When to use it (drill-down, layered scene progressions)
- A before/after code example

---

### Finding 3 — DiagramCanvas vs Diagram: Unnecessary Wrapper Requirement

**Severity:** High
**Type:** API design problem
**Semver impact if fixed:** Major (if collapsing; Minor if just clarifying)

#### The problem

The production codebase consistently wraps single `<Diagram>` elements in a `<DiagramCanvas>`
even when no pipes or multi-diagram features are used:

```tsx
// From apps/website/src/scenes/act5_act6/scene_01_simple_diagram.tsx
<DiagramCanvas id="simple-tech-stack" rotation={[-Math.PI / 12, 0, 0]} scale={1.3} theme={neonCyberTheme}>
  <Diagram id="tech-stack" pivot="center">
    {/* 4 nodes, 3 edges — no pipes, no multi-diagram */}
  </Diagram>
</DiagramCanvas>
```

The props being used at the canvas level (`rotation`, `scale`, `theme`) are also available
on `<Diagram>` itself. The `<DiagramCanvas>` wrapper here adds:
- A required `id` prop that must match a pre-registered widget (Finding 1)
- An extra nesting level
- Nothing functionally different from putting the same props on `<Diagram>` directly

The distinction between `DiagramWidget` (registered when a `<Diagram>` is standalone) and
`DiagramCanvasWidget` (registered when wrapped in `<DiagramCanvas>`) creates two separate
widget types with subtly different camera auto-framing and environment map behavior. This
is an internal implementation detail that has leaked into the authoring surface.

#### Why this confuses

New developers reading examples see `<DiagramCanvas>` used everywhere and assume it is
always required. They add it even for single-diagram cases, triggering the pre-registration
requirement (Finding 1). The `<DiagramCanvas>` also obscures the role of `<Diagram>` —
is `<Diagram>` the "real" thing, or is it just a sub-component of the canvas?

#### Fix direction

Two options:

**Option A (simpler): Collapse into DiagramCanvas.**
Remove `<Diagram>` as a standalone top-level element. All diagrams live inside a
`<DiagramCanvas>`. A canvas with one diagram and no pipes is the standard case. This
eliminates the choice. The `DiagramWidget` class becomes an internal implementation detail
(it's the per-diagram renderer inside `DiagramCanvasWidget`) rather than a public widget.

The pre-registration requirement (Finding 1) still needs to be fixed separately, but at
least there's only one path to learn.

**Option B (more work): Make `<Diagram>` fully capable.**
Give `DiagramWidget` feature parity with `DiagramCanvasWidget`: same camera auto-framing,
same environment map management, same transition spec. Then the rule is simple: use
`<Diagram>` for one diagram; use `<DiagramCanvas>` only when you need `<DiagramPipe>`
(cross-diagram connectors). Document this rule prominently.

Option B is more architecturally honest about what these components do, but requires more
implementation work. Option A is the pragmatic path if the goal is to reduce the number of
things a developer must learn.

---

### Finding 4 — Edge Silent Failures Use the Wrong Warning Channel

**Severity:** High
**Type:** Error quality problem
**Semver impact if fixed:** Patch (no API change; behavior change in warning output)

#### The problem

When a `<DiagramEdge>` references a node ID that does not exist, the edge router emits a
`console.warn()` and returns empty control points. The edge renders invisibly.

```typescript
// edgeRouter.ts:960-967
if (!fromPos || !toPos || !fromSize || !toSize) {
  console.warn(`Diagram routeEdges: missing node(s) for edge ${edge.from} -> ${edge.to}`);
  result.set(id, []);
  return;
}
```

Three problems with this:

**Wrong channel.** `console.warn` bypasses the compiler warning system used by
`MISSING_WIDGET`. Tooling, build processes, and IDE integrations that hook into compiler
warnings will not see this warning. It only appears in the browser console during runtime
— which the author may not be watching.

**Missing context.** The warning does not include: which diagram (`id`), which scene
(index), or the offending node ID in isolation. A developer looking at this warning with
many edges in a diagram has minimal information to diagnose the problem.

**Silent visual failure.** The edge renders invisible. No fallback, no placeholder, no red
outline. The diagram looks "right" except a connection is missing. This is particularly
hard to debug when the diagram is complex.

#### Same problem exists for DiagramPipe dot-notation references

`compilePipe()` handles malformed `"diagramId.nodeId"` references similarly — emitting
a console warning and rendering the pipe invisible. The same fixes apply.

#### Fix direction

Route edge reference errors through the compiler warning API (same `warnApi.pushWarning()`
used for `MISSING_WIDGET`) with a dedicated warning code. Include diagram ID, scene index,
edge `from`/`to` values, and the specific node ID that failed to resolve.

Improve the message:
```
DiagramEdge in <Diagram id="arch"> (scene 2): node 'nonexistent-node' not found.
  Edge: 'api-gateway' → 'nonexistent-node'
  Check that 'nonexistent-node' exactly matches a sibling <DiagramNode id="...">.
```

For pipe references, add format validation (must contain exactly one dot, non-empty diagram
ID, non-empty node ID) and emit distinct messages for format errors vs. lookup failures.

---

### Finding 5 — Coordinate Spaces Are Unlabeled in the API

**Severity:** High
**Type:** Documentation gap (but an API design signal)
**Semver impact if fixed:** None (JSDoc change only)

#### The problem

Three distinct coordinate spaces exist in the diagram system, and none of them are labeled
in prop documentation:

| Component | Prop | Actual space | What it means |
|---|---|---|---|
| `DiagramCanvas` | `position` | World space (Three.js scene) | Absolute position of the entire canvas |
| `Diagram` | `position` | World space (canvas-local) | Position of this diagram within the canvas |
| `DiagramNode` | `position` | Diagram-local (layout units) | Node position within the 2D layout grid |

A developer writing `<DiagramNode position={[0, 0, 5]}>` is placing a node 5 diagram
units deep on the z-axis (depth layering). A developer writing `<Diagram position={[0, 0, 5]}>`
is moving the entire diagram 5 world units in z. These look identical in code but do
completely different things.

The z-axis usage for `DiagramNode.position` is a power feature (depth layering for
drill-down scenes) that is **entirely undocumented inline**. The only evidence it works
is in the production scene `scene_03_arch_detail.tsx` where nodes use non-zero z values
to create visual depth separation.

The pivot offset system compounds this: after `compileDiagram()` applies the pivot offset,
all node positions are shifted so the pivot point is at `[0, 0, 0]`. Developers who
manually place nodes and then change the `pivot` prop will see all their positions shift
in unexpected ways because the pivot transforms the origin, not the positions relative to
an absolute origin.

#### Fix direction

This is entirely a JSDoc and documentation problem. Every `position` prop should be labeled
with its space and units. The z-axis layering behavior for `DiagramNode.position` should
have an explicit JSDoc example. The pivot offset effect should be called out on both the
`pivot` and `position` props of `<Diagram>`.

Example JSDoc for `DiagramNode.position`:
```typescript
/**
 * Node position in diagram-local space [x, y, z].
 * x and y are in layout units (same units as `size`).
 * z creates depth layering: non-zero z values stack nodes
 * at different depths relative to the camera.
 *
 * When using `<GridLayout>` or `<HierarchicalLayout>`, omit this prop
 * and let the layout engine compute positions automatically. Only
 * specify `position` explicitly when using `<ManualLayout>`.
 *
 * Note: positions are affected by the parent `<Diagram pivot="...">` setting.
 * With `pivot="center"`, the diagram's bounding-box center becomes [0, 0, 0].
 */
position?: [number, number, number];
```

---

### Finding 6 — Theme Customization Requires Verbose Spread Pattern

**Severity:** Medium-High
**Type:** API ergonomics
**Semver impact if fixed:** Minor (additive only)

#### The problem

Every theme customization requires manually spreading at every level of nesting. There is
no helper for partial theme overrides:

```typescript
// To change just the node color from darkGlassTheme:
const myTheme: DiagramTheme = {
  ...darkGlassTheme,
  node: {
    ...darkGlassTheme.node,      // ← must re-spread all 14 node config fields
    defaultColor: '#2a1a40',     // ← just wanted to change this one field
  },
};
```

For each additional customization at a different nesting level (e.g., also changing edge
color), another spread level is needed. The full `DiagramTheme` object is large — four
top-level config objects, each with 8–15 fields. The spread ceremony is significant.

This discourages theme customization. Developers default to using a preset exactly as-is,
or avoid theming entirely, even when a small adjustment would significantly improve their
specific visualization.

#### Fix direction

Export a `mergeTheme(base: DiagramTheme, overrides: DeepPartial<DiagramTheme>): DiagramTheme`
helper. Pure function, pure data, zero architectural complexity. One 15-line utility
eliminates the spread pattern for the vast majority of custom themes:

```typescript
// After fix:
const myTheme = mergeTheme(darkGlassTheme, {
  node: { defaultColor: '#2a1a40' },
  edge: { routing: 'orthogonal', defaultColor: '#ff6b35' },
});
```

`DeepPartial<DiagramTheme>` is already expressible in TypeScript without new types. The
function is a recursive merge. This is a pure additive API change — existing code that
uses the spread pattern continues to work.

---

### Finding 7 — Enter/Exit Components Have No Placement Validation

**Severity:** Medium
**Type:** Error quality / naming
**Semver impact if fixed:** Patch for validation; Minor for rename

#### The problem

`<Enter>` and `<Exit>` must be direct children of `<Diagram>`, not children of
`<DiagramGroup>` or nested anywhere else. If placed incorrectly, they are silently ignored.
The handler extracts them from the Diagram's children list and ignores any nested ones:

```tsx
<Diagram id="d">
  <DiagramGroup id="tier-1">
    <Enter from={[0, -50, 0]} fade />  {/* silently ignored — wrong nesting level */}
    <DiagramNode id="a" label="A" />
  </DiagramGroup>
</Diagram>
```

The names `Enter` and `Exit` give no indication of their required parent context. They read
as generic component names — nothing in `<Enter>` signals that it must be a sibling of
`<DiagramNode>`, not a child of `<DiagramGroup>`.

Additionally, there is no enforcement of "at most one per diagram." A diagram with two
`<Enter>` components is undefined behavior. The first one wins but no warning is emitted.

#### Fix direction

Two changes:

**Rename** to `<DiagramEnter>` and `<DiagramExit>`. The `Diagram` prefix ties them to their
required parent context, making misuse less likely.

**Add placement validation** in the `Diagram` handler: if any `Exit`/`Enter` components
are found in positions other than direct Diagram children (i.e., inside groups or nested
elements), emit a compiler warning naming the misplaced component and its incorrect parent.

---

### Finding 8 — Three Emissive Props Expose Internal Three.js Concepts

**Severity:** Medium
**Type:** API surface complexity
**Semver impact if fixed:** Major (prop rename/consolidation)

#### The problem

Nodes expose three separate props for a single conceptual feature ("node glow"):

```typescript
emissive?: boolean;           // enable/disable emissive rendering
emissiveIntensity?: number;   // intensity [0–1]
emissiveColor?: string;       // glow color
```

These map 1:1 to Three.js `MeshStandardMaterial` properties, exposing the rendering
implementation in the authoring API. The interaction rules are non-obvious:

- `emissive` defaults to `true` when `emissiveIntensity > 0`; no explicit documentation
- Setting `emissiveIntensity={0}` with `emissive={true}` results in no visible glow (intensity 0), but the prop is "enabled"
- `emissiveColor` is ignored when `emissive={false}`, which means explicit colors can be silently discarded
- The default behavior (theme determines whether nodes glow by default) is entirely invisible from the props

Most developers want to express one of three things:
- "Use the theme default for glow" (omit all three props — this is already the case)
- "Make this node glow with emphasis" (increase intensity, maybe change color)
- "Suppress glow on this node" (disable regardless of theme)

#### Fix direction

Consolidate to a single `glow` prop with a union type:

```typescript
/**
 * Node glow (emissive) override.
 * - Omit: inherit from theme (default behavior)
 * - true: enable with theme-default intensity and color
 * - false: disable glow regardless of theme
 * - object: full control over intensity and color
 */
glow?: boolean | { intensity?: number; color?: string };
```

The old `emissive`, `emissiveIntensity`, `emissiveColor` props should be deprecated in the
same minor version that `glow` is introduced, and removed in the following major version.
The `DiagramNodeState` internal representation can retain the three-field structure as an
implementation detail; only the DSL surface changes.

---

### Finding 9 — `depth` Prop Name Collides with z-Axis Depth Concept

**Severity:** Medium
**Type:** Naming
**Semver impact if fixed:** Major (breaking prop rename)

#### The problem

The `depth` prop on `<DiagramNode>` controls the physical thickness of the 3D prism box
(how deep it protrudes from the canvas plane). The word "depth" also naturally refers to
z-axis distance — which in this system is controlled by `position[2]`. The same word
describes two different things in the same component:

```tsx
<DiagramNode
  id="api"
  depth={0.8}            // "this box is 0.8 units thick" — physical prism depth
  position={[0, 0, -5]} // "this node is 5 units deep on z-axis" — layering depth
/>
```

A developer adjusting "depth" to control z-ordering will change the wrong prop.

#### Fix direction

Rename `depth` → `thickness` on `DiagramNodeProps`. This is a breaking prop rename. The
migration is fully mechanical — a global find-replace. Deprecate `depth` with a console
warning in the same minor version that `thickness` is introduced; remove in the following
major.

The `DiagramNodeState.depth` field (internal) can be renamed simultaneously or kept as
`depth` internally (the DSL rename does not require an internal rename). Consistency argues
for renaming both.

---

### Finding 10 — Ghost Node Feature is Completely Undiscoverable

**Severity:** Medium (documentation, no code change)
**Type:** Documentation gap
**Semver impact if fixed:** None

#### The problem

The ghost node system (described fully in Finding 2) is a first-class feature that enables
sophisticated drill-down animations. There is no documentation of it anywhere in the public
API surface — not in the `DiagramNode` component JSDoc, not in the package README, not in
any example scene comment.

The feature exists and works (modulo the semantic trigger problem in Finding 2), but a
developer has no way to discover it without reading `DiagramWidget.mergeSnapshot()` source
code, which is an internal widget method not part of the public API.

#### Fix direction

Add a "Ghost Nodes" section to the `DiagramNode` JSDoc and to the package README:

```typescript
/**
 * Ghost node: when `label` is not provided, this node "inherits" its visual
 * identity (label, shape, icon, size) from the matching node in the previous
 * scene. Use this for drill-down animations where a prior scene's nodes appear
 * as faded context behind the new focal point.
 *
 * @example
 * // Scene 1: full diagram with named nodes
 * <DiagramNode id="api" label="API Gateway" icon="aws:api-gateway" size={[4, 2]} />
 *
 * // Scene 2: the same node appears as ghost context (no label = inherit)
 * <DiagramNode id="api" opacity={0.3} />
 * // ↑ inherits label, icon, shape, size from Scene 1; only opacity changes
 */
```

Create one new example scene in `apps/examples/` demonstrating ghost-node drill-down.

---

### Finding 11 — Theme Hierarchy (Canvas vs Diagram) is Undocumented

**Severity:** Medium-Low
**Type:** Documentation gap
**Semver impact if fixed:** None

#### The problem

Both `<DiagramCanvas>` and `<Diagram>` accept a `theme` prop. Their interaction follows a
simple cascade rule: `DiagramCanvas.theme` is the fallback for child diagrams that don't
specify their own theme. But this is not documented in either component's JSDoc, and the
behavior is only discoverable by reading `compiler/handlers.ts`:

```typescript
// handlers.ts:244 — the fallback in action, but invisible to consumers
compileDiagram(dsl, canvasTheme)  // canvasTheme passed as fallback
```

A developer who specifies the same theme on both the canvas and the diagram is duplicating
unnecessarily. A developer who specifies a theme on the canvas and expects child diagrams
to inherit it may not realize it works that way.

#### Fix direction

Add one sentence to each component's JSDoc:

- On `DiagramCanvas.theme`: "Acts as the fallback theme for all child `<Diagram>` elements
  that do not specify their own `theme` prop."
- On `Diagram.theme`: "Overrides the parent `<DiagramCanvas>` theme for this diagram only.
  If inside a DiagramCanvas and this prop is omitted, the canvas theme applies."

---

### Finding 12 — Manual Layout Error Messages Are Weak

**Severity:** Medium-Low
**Type:** Error quality
**Semver impact if fixed:** Patch

#### The problem

When using `<ManualLayout>` and a non-ghost node has no explicit `position` prop, the
layout resolver needs to handle the case. The current behavior and error message quality
for this case was not directly verified in the cross-check, but the broader pattern of
`console.warn` usage (rather than compiler warning API usage) applies here as well.

The likely message when this occurs does not name the specific node(s) missing a position,
making it difficult to diagnose in a large diagram.

#### Fix direction

Emit through the compiler warning API (not `console.warn`). Include:
- Diagram ID
- Scene index
- List of all node IDs that are missing positions
- Actionable suggestion: "Add `position={[x, y, z]}` to each node when using ManualLayout,
  or switch to `<GridLayout>` to auto-compute positions."

---

## Summary Table

| # | Finding | Severity | Type | Semver |
|---|---|---|---|---|
| 1 | Widget pre-registration not discoverable | 🔴 Critical | Architecture | Major |
| 2 | Ghost node trigger is semantically wrong | 🔴 Critical | Semantic | Major |
| 3 | DiagramCanvas vs Diagram wrapping confusion | 🟠 High | API Design | Major |
| 4 | Edge/pipe silent failures wrong warning channel | 🟠 High | Error quality | Patch |
| 5 | Coordinate spaces unlabeled in props | 🟠 High | Documentation | None |
| 6 | Theme customization requires verbose spread | 🟡 Medium-High | API ergonomics | Minor |
| 7 | Enter/Exit have no placement validation | 🟡 Medium | Error quality + naming | Patch/Minor |
| 8 | Three emissive props expose Three.js internals | 🟡 Medium | API surface | Major |
| 9 | `depth` prop name collides with z-axis concept | 🟡 Medium | Naming | Major |
| 10 | Ghost node feature completely undiscoverable | 🟡 Medium | Documentation | None |
| 11 | Theme hierarchy not documented | 🟢 Medium-Low | Documentation | None |
| 12 | ManualLayout missing-position error quality | 🟢 Medium-Low | Error quality | Patch |

---

## Recommended Change Groupings

Changes cluster into three groups based on semver impact and urgency.

### Group A: Documentation and Patch Fixes (Ship Now — No Signoff Needed)

These are safe to implement immediately. They carry no API risk.

- **Finding 5:** Label all `position` props with coordinate space and units in JSDoc
- **Finding 10:** Document ghost node feature on `DiagramNode` JSDoc and README
- **Finding 11:** Document theme hierarchy on `DiagramCanvas` and `Diagram` JSDoc
- **Finding 4:** Route edge/pipe reference errors through compiler warning API (no API change)
- **Finding 7 (partial):** Add placement validation for misplaced `<Enter>`/`<Exit>` (patch)
- **Finding 12:** Improve ManualLayout missing-position error messages (patch)

### Group B: Additive API (Minor Version — Low Risk)

These add new exports without changing or removing anything.

- **Finding 6:** Export `mergeTheme(base, overrides)` helper
- **Finding 7 (partial):** Add `DiagramEnter`/`DiagramExit` as aliases (deprecate `Enter`/`Exit`)

### Group C: Breaking Changes (Major Version — Requires Signoff)

These must be batched into a single major version release with a migration guide.

- **Finding 1:** Auto-register DiagramCanvasWidget during compilation (eliminates manual pre-registration)
- **Finding 2:** Ghost node trigger from `label === ''` to `label` prop absence (`undefined`)
- **Finding 3:** DiagramCanvas/Diagram architecture decision (collapse or clarify)
- **Finding 8:** Consolidate `emissive`/`emissiveIntensity`/`emissiveColor` → `glow` prop
- **Finding 9:** Rename `depth` → `thickness` on `DiagramNode`

The Group C changes together represent a coherent v-next release of `@brewsite/diagram`.
They address the two bot-killer issues (Findings 1 and 2), simplify the API surface
(Findings 8 and 9), and resolve the structural confusion (Finding 3). A single major
release with a complete migration guide is the right delivery vehicle.

---

## What Stays Unchanged

Not everything is a problem. The following aspects of the package are well-designed and
should not be changed based on this audit:

- **Icon type system.** The discriminated union with 8 closed namespaces and full literal
  enumeration is correct. Autocomplete works. No changes needed.
- **Required props surface.** One or two required props per component is genuinely minimal.
  The defaults strategy is sound.
- **Layout cascade rules.** Grid/hierarchical/manual with parent-to-child cascade is the
  right model. The implementation is correct.
- **Edge routing architecture.** The two-axis model (landing algorithm × routing algorithm)
  is a clean separation. Theme-level defaults with per-edge overrides is correct.
- **Compiled state types.** `DiagramState`, `DiagramNodeState`, etc. are clean,
  comprehensive, and correctly typed. No changes needed.
- **Transition spec.** `functionalDiagramTransitionSpec` with closure-based interpolation
  is the right approach for smooth scene transitions. No changes needed.
- **Focus region system.** The pub/sub model with `publishDiagramFocusGroup()` and
  `useDiagramFocusRegion()` is a clean, non-invasive pattern. No changes needed.

---

## Next Steps

1. **Review these findings** for alignment with engineering constraints and product priorities
2. **Decide on Group C scope** — all five breaking changes, or a subset for the initial major
3. **Write PRDs** for each approved change once signoff is confirmed
4. **Implement Group A and Group B** in the interim (no signoff needed)
5. **Update all affected PRDs** after each change is implemented, per the house documentation policy

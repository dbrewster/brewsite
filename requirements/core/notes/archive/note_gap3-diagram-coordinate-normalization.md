---
title: "PM Assessment: Gap 3 — Diagram Coordinate Normalization"
doc_type: note
owner: Toolkit Product
status: draft
updated: 2026-03-06
---

# PM Assessment: Gap 3 — Diagram Coordinate Normalization

**Purpose:** Challenge or validate the architect's deferral of Gap 3 (normalizing diagram node
coordinate space) from the viewport coordinate review at
`requirements/core/notes/note_viewport-coordinate-normalization.md`.

**Position being evaluated:** The user argues that pre-ship is the right time to make this
change, and that the primary concern is **bot authorability** — coding agents cannot reason
about an arbitrary, unbounded coordinate space when placing diagram nodes.

---

## 1. What Is the Diagram Coordinate System Today?

Evidence from reading `packages/diagram/src/elements/diagram/` — types, DSL, compiler, layout
algorithms, and canvas widget — plus `apps/examples/src/` scene files.

### Three nested coordinate spaces

| Layer | System | Bounded? | Range |
|---|---|---|---|
| Canvas in world | World-space Vec3 | No | Unbounded (author-set) |
| Diagram in canvas | Canvas-local Vec3 | No | Unbounded (author-set) |
| Node in diagram | Diagram-local [x, y, z] | **No** | Determined by layout algorithm or author |

The innermost layer — node positions in diagram-local space — is what Gap 3 addresses.

### Diagram units are not arbitrary; they ARE predictable

"Diagram units" ≡ world units at `scale = 1.0`. The defaults make this concrete:

- Default node size: `[4, 2]` diagram units (from `nodeCompiler.ts:20`)
- Default grid spacing: `[2, 2]` diagram units (from `layoutResolver.ts:84`)
- Default group padding: `1.5` diagram units (from `layoutResolver.ts:82`)
- Default flow gap: `2` diagram units

A 3-node grid row with defaults occupies: `3 × (4 + 2) - 2 = 16` diagram units in X.
A 2-row grid: `2 × (2 + 2) - 2 = 6` diagram units in Y.

This is not arbitrary — it is **additive node-size math**. Authors and agents can derive these
extents without running the compiler by applying the published default constants.

### The `pivot="center"` convention normalizes the origin

The `pivot` prop on `<Diagram>` (default: `"center"`) shifts the coordinate origin to the
diagram's bounding-box center. With `pivot="center"`, all authored positions are **relative
offsets from center**:

- `position={[0, 0, 0]}` = center of diagram
- `position={[-9, 0, 0]}` = 9 units to the left of center
- `position={[9, 0, 0]}` = 9 units to the right of center

Evidence from `apps/examples/src/brewflow-sidecar/scenes/scene_architecture.tsx`:
```tsx
<DiagramNode id="proc-bridge" position={[-9, 0, 0]} />
<DiagramNode id="proc-mcp"    position={[0, 0, 0]}  />
<DiagramNode id="proc-dreamer" position={[9, 0, 0]} />
<DiagramNode id="store-episodic"  position={[-5, -5, 0]} />
<DiagramNode id="store-neocortex" position={[5, -5, 0]}  />
```

A human (or bot) reading these coordinates can immediately understand: "left, center, right;
lower-left, lower-right." This is MORE legible than `[50, 127, 0]` in a [0..255] space.

### Auto-framing removes the camera math burden

`DiagramCanvasWidget.onTick` (widget.ts:190–207) scans all node positions at runtime,
computes the bounding box, and auto-frames the camera with 1.2× padding:

```typescript
const maxDim = Math.max(maxX - minX, maxY - minY);
const fov45 = 45 * (Math.PI / 180);
const dist = (maxDim / (2 * Math.tan(fov45 / 2))) * 1.2;
cam.position.set(worldCX, worldCY + dist * 0.3, cpz + dist);
```

Any coordinate range a bot authors will render correctly. The camera adapts.

---

## 2. Bot Authorability Analysis: The Real Picture

### Who actually touches diagram coordinates?

**Auto-layout (GridLayout, HierarchicalLayout, FlowLayout):** The bot specifies nodes, edges,
layout type, and optional spacing overrides. The layout algorithm assigns all positions.
**The bot never touches `position` at all.** Auto-layout covers the large majority of scene
files — of 50+ example scenes, all but 4–5 use auto-layout exclusively.

**Manual layout:** The bot specifies `position={[x, y, z]}` explicitly. This is a minority
pattern, used only when precise spatial control is needed (e.g., a multi-diagram architecture
scene with two vertically stacked groups).

### For auto-layout: bot authorability is excellent

No coordinates to reason about. A bot specifies structure; the engine handles space. The
`GridLayout columns`, `spacing`, and `groupPadding` props give compositional control without
requiring coordinate knowledge. This is working correctly.

### For manual layout: bot authorability is moderate, not broken

The evidence shows that manual-layout coordinates in the wild are legible: small integers
centered at [0, 0, 0], with positive X = right, negative X = left, positive Y = up,
negative Y = down. This is standard Cartesian convention. A bot that understands Cartesian
space can author these coordinates correctly.

**What a bot cannot easily predict:**

1. **DiagramExit/DiagramEnter `from`/`to` positions** — "how far is off-screen in diagram
   units?" (`<DiagramExit to={[0, -50, 0]}>` — why 50? That requires knowing the diagram
   height, which is only known after layout resolution.)

2. **`<Diagram position>` for side-by-side stacking** — when placing two `<Diagram>` children
   inside a `<DiagramCanvas>`, a bot must pick Y offsets (`position={[0, 6, 0]}` and
   `position={[0, -5, 0]}`) that visually separate them without knowing their compiled heights.

3. **DiagramCanvas `position` + `scale` interaction** — `scale={0.7}` shrinks diagram units
   to 70% of world units, but a bot needs explicit documentation of this relationship.

**These are real authoring friction points, but they are specific.** They are not evidence that
the entire coordinate system is broken — they are evidence that a few DSL conveniences are
missing.

---

## 3. Is the Architect's Deferral of Gap 3 Correct?

### The architect's specific Gap 3 definition

The architect defined Gap 3 as: **group-local [0..1] sub-space** — child positions expressed
as fractions of group bounds. The deferral rationale: this requires reversing the data flow
(current: `node positions → group bounds computed from them`; proposed: `group bounds declared
first → node positions as fractions`).

**This specific deferral is correct.** The reversal is not trivial. Implementing it would mean:
1. Authors declare group extents explicitly
2. Node positions inside groups are fractional (0–1 within group)
3. Layout algorithms that operate on groups would need full rewrites
4. All existing manual-layout scenes would break

The cost is high. The benefit is narrow: it only helps manual-layout authors who want to
reason about intra-group placement as fractions. Auto-layout authors don't need it at all.
**Defer confirmed.**

### The user's broader concern — is it the same as Gap 3?

The user's concern is not limited to group-local sub-space. It is: **all diagram coordinates
are arbitrary and unbounded, so bots cannot reason about placement.**

This is a reasonable concern to raise but the code evidence does not support the strongest
form of it. Specifically:

- Diagram units are predictable, not arbitrary (they derive from node size + spacing defaults)
- The `pivot="center"` convention makes the origin predictable (always at diagram center)
- The auto-framing camera removes the most painful consequence (coordinates must agree with camera)
- Manual layout coordinates in practice are small, centered Cartesian integers — bot-legible

**A bounded absolute system (e.g., [0..255]) would not improve bot authorability.** If a bot
is authoring `position={[127, 127, 0]}` in a [0..255] system, it still needs to know:
- That 127 is center (the same semantic as [0, 0, 0] with pivot="center")
- That 255 is the maximum (but what does "maximum" map to in world units?)
- The aspect ratio of the bounded space to reason about X vs Y offsets

A bounded space makes validation possible (reject positions > 255), but it does not make the
coordinate semantics more legible. The current system with `pivot="center"` is arguably MORE
legible: "zero is center, positive is right/up, negative is left/down" is unambiguous.

---

## 4. The Real Problem and the Right Fix

### What IS broken for bot authoring

The specific gaps where a bot would struggle (backed by code evidence):

**Gap A: DiagramExit/DiagramEnter `to`/`from` offsets**
A bot needs to specify how far off-screen to animate a diagram (`to={[0, -50, 0]}`). The
value `50` requires knowing the diagram's compiled height, which is only available after
layout resolution. There is no DSL convenience for "exit off the bottom of the visible area."

**Gap B: Multi-diagram Y separation in DiagramCanvas**
When stacking two `<Diagram>` children vertically (as in `scene_architecture.tsx`), the
correct Y offsets (`position={[0, 6, 0]}` / `position={[0, -5, 0]}`) require knowing each
diagram's height. There is no DSL support for "stack these diagrams with this gap."

**Gap C: Camera world-space math**
When a bot authors `<Camera mode="world" position={[0, 5, 28]} target={[0, 0, 0]} fov={52}>`
alongside a DiagramCanvas, it's guessing at camera distance. (This is addressed by Gap 1 and
Gap 2 in the architect's note — `nvsToWorldAnalytic()` and `worldHeight` prop — which are
proposed for implementation, not deferred.)

**Gap D: Missing JSDoc on coordinate convention**
`DiagramNode.position` JSDoc says "x and y are in layout units" but does not document the
relationship to world units, the pivot effect on origin, or typical value ranges. A bot reading
only the DSL types has insufficient context.

### What is NOT broken

- Auto-layout coordinate authoring (no coordinates required)
- Manual layout position values for spatial concepts (left/right/up/down) — legible
- Edge routing — the layout algorithms handle this correctly
- Camera auto-framing — adapts to any coordinate range

---

## 5. Recommendation

### On the specific Gap 3 (group local [0..1] sub-space): Defer. Architect is correct.

The reversal of the data flow is a significant design change that would break all
existing manual-layout scenes. The benefit — enabling normalized intra-group positioning —
helps a small fraction of use cases and does not address the actual bot-authorability pain
points (which are about exits, multi-diagram spacing, and documentation, not group sub-space).

### On the user's broader concern: Partially agree, but misdiagnosed

The concern is valid — bot authorability for diagram position authoring is imperfect — but
the diagnosis is wrong. The problem is not that the coordinate space is arbitrary. It is:

1. **No `diagramHeight`/`diagramWidth` access at DSL authoring time** — needed for
   DiagramExit offsets and multi-diagram stacking decisions.
2. **No convenience API for common spatial patterns** — "stack two diagrams with N units gap,"
   "exit diagram off the bottom edge."
3. **Insufficient documentation** — the coordinate conventions are not documented in JSDoc.

### Specific actions to take now (pre-ship, low cost)

**Action 1 — Add JSDoc to `DiagramNode.position` (30 min)**
Document: diagram units ≈ world units at `DiagramCanvas scale={1.0}`. With `pivot="center"`,
origin is at diagram bounding-box center. Typical ranges for most diagrams: ±20 in X, ±15 in Y.
Default node size is `[4, 2]`; grid spacing default is `[2, 2]`.

**Action 2 — Add a `<DiagramStack>` or spacing prop on `<DiagramCanvas>` children (medium)**
Allow authors to declare "stack these diagrams vertically with this gap" without specifying
absolute Y positions. Eliminates the most common bot-unfriendly manual positioning scenario.
Consider this as a follow-on to Gap 2 (`worldHeight`) rather than a blocker.

**Action 3 — Add semantic DiagramExit shortcuts (medium)**
Instead of `<DiagramExit to={[0, -50, 0]}>` (magic number), provide:
```tsx
<DiagramExit direction="down" />  // exits to diagram's own height below center
```
The compiler can compute the offset from the compiled diagram bounds. This eliminates the
only non-trivial coordinate the bot needs to author.

**Action 4 — Implement Gap 1 and Gap 2 from architect's note (architect owns)**
`nvsToWorldAnalytic()` and `worldHeight` prop address the camera ↔ diagram math problem.
These are the most important bot-authorability improvements in the viewport normalization space.

### What NOT to do

- Do NOT introduce a bounded absolute coordinate system ([0..255] or similar). It would not
  improve bot reasoning and would require migrating all manual-layout scenes.
- Do NOT implement group-local [0..1] sub-space. The architect's deferral is correct.
- Do NOT change the `pivot="center"` default. Centered Cartesian coordinates are MORE legible
  than bounded absolute coordinates for the "spatial offset" authoring task.

---

## 6. Effort and Timing Assessment

| Action | Effort | Risk | Timing |
|---|---|---|---|
| Action 1: JSDoc improvements | 1–2 hours | Zero | Immediate — do this now |
| Action 3: DiagramExit direction shortcut | 1–2 days | Low (additive, backward compat) | Before first external consumer |
| Action 2: DiagramStack / spacing | 2–4 days | Low (additive) | After Gap 2 (worldHeight) lands |
| Gap 1 (nvsToWorldAnalytic) | 1 day | Zero | Architect queue |
| Gap 2 (worldHeight) | 1–2 days | Zero (optional prop) | Architect queue |
| Gap 3 (group local NVS) | 2+ weeks | High (breaking, data flow reversal) | Deferred indefinitely |

Pre-ship cost of NOT doing Actions 1–3: bots authoring diagram scenes will need to rely on
comments, examples, or trial-and-error for DiagramExit offsets and multi-diagram stacking.
This is a real but tolerable authoring friction, not a correctness or rendering failure.

Pre-ship cost of doing Gap 3: significant engineering time, migration of all manual-layout
scenes, design review, and new test coverage — for a feature that does not address the actual
bot-authorability pain points.

---

## 7. Summary Verdict

| Question | Finding |
|---|---|
| Is the diagram coordinate system "arbitrary and unbounded"? | **No.** Units are predictable (node-size math). `pivot="center"` gives consistent origin. Auto-framing removes camera coupling. |
| Can a bot reason about diagram placement? | **For auto-layout: yes, fully. For manual layout: mostly yes, with specific gaps in exit/enter offsets and multi-diagram spacing.** |
| Should we normalize to a bounded system pre-ship? | **No.** A bounded system (e.g., [0..255]) does not improve bot reasoning and has migration cost. |
| Is the architect's Gap 3 deferral correct? | **Yes.** Group-local NVS requires data flow reversal and does not address actual pain points. |
| What SHOULD we do about bot authorability? | **Actions 1–3 above: JSDoc, DiagramExit direction shortcut, DiagramStack. All are additive and backward-compatible.** |

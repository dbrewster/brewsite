---
title: "Audit and Fix All Example Diagrams + Update Bot Docs After Rendering Fixes"
doc_type: note
status: draft
owner: Toolkit Product
last_updated: 2026-03-18
change_history:
  - date: 2026-03-18
    author: Toolkit PM
    summary: "Created note capturing outstanding work after diagram rendering fixes landed."
  - date: 2026-03-18
    author: Toolkit PM
    summary: "Expanded with prescriptive example fixes, bot docs update scope, and spatial awareness documentation plan."
---

# Note: Post-Rendering-Fix Work Items

## Context — What Changed

The following rendering fixes landed in this session:

1. **Aspect ratio correction** — `render.ts` now applies `sizeScaleX`/`sizeScaleY` from `contentAspect` to node/group sizes. Rectangular nodes declared as `[4, 4]` now render as true squares.
2. **Font size bases bumped** — `labelFontSizeBase` 0.28→0.32, `sublabelFontSizeBase` 0.18→0.22 across all 12 diagram theme files.
3. **Slides fontSize scales corrected** — `fontSize.label` and `fontSize.caption` set to 1.0 in slides `themeCompiler.ts`.
4. **Fit-to-content node layout** — `nodeLabelLayout.ts` rewritten. Icon + label + sublabel now guaranteed to fit within the node's content area via uniform `fitScale`. Returns `iconY` and `effectiveIconScale`.
5. **NodeRenderer icon positioning** — Now uses layout-computed `iconY` and `effectiveIconScale` instead of hardcoded `contentH * 0.2` and raw `state.iconScale`.

These changes affect rendered output for ALL existing diagrams.

---

## Work Item 1: SceneTheme→DiagramTheme Bridge

See plan file `plan_diagram-node-aspect-ratio-and-text-defaults.md`, Fix 2. Still outstanding.

---

## Work Item 2: Fix All Example Diagrams

### Files to fix

Every file below contains `<Diagram>`, `<DiagramNode>`, `<DiagramGroup>`, or `<DiagramEdge>` and must be visually reviewed and updated:

| # | File | Description |
|---|------|-------------|
| 1 | `apps/examples/src/slides-demo/deck.tsx` | Slide deck with embedded diagrams |
| 2 | `apps/examples/src/carousel-selection/scenes/sceneDiagramDetail.tsx` | Carousel diagram detail |
| 3 | `apps/examples/src/carousel-selection/scenes/scenePicker.tsx` | Carousel picker with diagrams |
| 4 | `apps/examples/src/views/scenes/scene3-carousel.tsx` | View carousel with diagrams |
| 5 | `apps/examples/src/core-showcase/scenes.tsx` | Core showcase diagrams |
| 6 | `apps/examples/src/input-showcase/scenes/scene2-camera-controls.tsx` | Input showcase diagram |
| 7 | `apps/examples/src/canvas-region/scenes/viewerScene.tsx` | Canvas region diagram |
| 8 | `apps/website/src/scenes/act5_act6/scene_01_simple_diagram.tsx` | Website simple diagram |
| 9 | `apps/website/src/scenes/act5_act6/scene_02_arch_overview.tsx` | Website architecture overview |
| 10 | `apps/website/src/scenes/act5_act6/scene_03_arch_detail.tsx` | Website architecture detail |
| 11 | `apps/website/src/scenes/act7/scene_02_combined.tsx` | Website combined scene |
| 12 | `apps/website/src/scenes/act1_act2/scene_01_core_intro.tsx` | Website core intro |
| 13 | `apps/website/src/scenes/act1_act2/scene_02_core_baked.tsx` | Website core baked |

### Prescriptive fix instructions for each file

For each file, the fixing bot should:

**Step 1: Read the file and identify all `<DiagramNode>` declarations.**

**Step 2: Check node sizes against these rules:**

- Nodes with `size={[W, H]}` where W ≠ H that were intended to be square: the aspect ratio correction now works correctly, so previously-compensated non-square sizes (e.g., `[4, 3]` that rendered as visually square due to distortion) should be changed to `[4, 4]`.
- Nodes that are intentionally rectangular (e.g., wide labels) should keep their non-square sizes.
- Nodes without an explicit `size` prop use the theme default (`[4, 2]`). These are fine as-is.

**Step 3: Check icon + text fit:**

- For every node that has BOTH `icon` AND `sublabel` props: verify the node is large enough. With the fit-to-content layout, the icon will be scaled down to fit. If the icon appears too small after the fix, increase the node's height dimension.
- Recommended minimum sizes for icon + label + sublabel nodes:
  - Rectangle: `size={[4, 3]}` minimum (was `[4, 2]` which overflowed)
  - Circle/hexagon: `size={[3.5, 3.5]}` minimum (content area is smaller than bounding box)
  - Diamond: `size={[4, 4]}` minimum (content area is ~50% of bounding box)

**Step 4: Check group labels:**

- Groups with long `label` strings may now render differently due to aspect ratio correction. Verify group labels are visible and not clipped.

**Step 5: Check layout spacing:**

- `spacing` values in `<GridLayout>`, `<HierarchicalLayout>`, and `<FlowLayout>` are in diagram units. The aspect ratio correction changes how these map to screen space. If diagrams look too cramped or too spread out, adjust spacing values.

**Step 6: Run `pnpm dev` and visually verify each example.**

### Snapshot tests

After fixing all examples, update the snapshot baselines:
- `apps/examples/src/__tests__/__snapshots__/snapshotBaseline.test.ts.snap`
- `apps/examples/src/__tests__/__snapshots__/snapshotBaseline.test.tsx.snap`

---

## Work Item 3: Update Bot Docs — Spatial Awareness and Layout Guide

### Scope

The `@brewsite/claude-author` package at `packages/claude-author/` contains the MCP server docs that AI scene-authoring bots consume. These docs need a major update to:

1. **Add a comprehensive "Layout and Spatial Awareness" section** that is the first thing bots read
2. **Update the diagram sizing documentation** to reflect the new defaults
3. **Clearly delineate the two coordinate systems** (NVS percentage layout vs world coordinates)

### Bot to launch

Launch a `brewsite-scene-author` or `general-purpose` agent with write access to `packages/claude-author/docs/`. The agent should read the existing docs, understand the changes, and rewrite/create the files described below.

### Files to create or update

#### NEW: `packages/claude-author/docs/guides/layout-spatial-awareness.md`

This should be the **primary spatial reference** for bots. Structure:

```markdown
# Layout and Spatial Awareness

## The Two Coordinate Systems

BrewSite uses exactly two coordinate systems. Every prop you author falls into one or the other:

### 1. NVS (Normalized Viewport Space) — Percentage Layout

**Used by:** Element placement (`x`, `y`, `w`, `h`), Diagram viewport bounds, View bounds, TextBox regions, Chart placement, ImagePanel placement, Screen placement.

- Range: [0, 1]
- Meaning: fraction of the viewport (or parent View)
- x=0 left, x=1 right. y=0 TOP, y=1 BOTTOM.
- An element at x=0.5 y=0.5 w=0.4 h=0.3 is centered, 40% wide, 30% tall.

**Everything that controls WHERE and HOW BIG an element appears on screen is NVS.**

### 2. World Coordinates — 3D Scene Space

**Used by:** Camera position/target, Lighting positions, Floor configuration.

- Range: unbounded (typically -10 to +10)
- Meaning: Three.js world units (meters-ish)
- Camera at position=[0, 2, 5] means 5 units from origin, 2 units up.
- Directional light at position=[3, 5, 4] means upper-right-front.

**Only Camera, Lighting, and Floor use world coordinates. Everything else is NVS.**

## The Mental Model

Think of it as two layers:

1. **The stage** (Camera, Lighting, Floor) — set up once per scene in world coords. This is your physical studio.
2. **The content** (Diagrams, Charts, Models, Screens, Images) — positioned on the viewport in NVS percentages. This is where you place your content within the camera's view.

## Diagram Node Sizes — A Special Case

Inside a `<Diagram>`, node `size` props are in **diagram content units** for auto-layout modes (GridLayout, HierarchicalLayout, FlowLayout). These are NOT NVS and NOT world coordinates — they define relative proportions between nodes within the diagram's internal layout space:

- size={[4, 2]} means "4 units wide, 2 units tall" in the diagram's layout
- The diagram layout engine normalizes these to fit within the Diagram's NVS viewport bounds
- A node with size={[4, 4]} will always render as a square regardless of viewport aspect ratio
- Relative sizing: a [6, 3] node is 1.5× wider and 1.5× taller than a [4, 2] node

For ManualLayout, node sizes must be in [0..1] NVS fractions (like everything else on screen).

### Recommended Node Sizes

| Content | Minimum Size | Notes |
|---------|-------------|-------|
| Label only | [4, 2] | Theme default, good for most cases |
| Label + sublabel | [4, 2.5] | Needs vertical room for two text lines |
| Icon + label | [3, 3] | Icon needs vertical space above label |
| Icon + label + sublabel | [4, 3] | All three stack vertically — this is the safe minimum |
| Icon + label + sublabel (circle/hex) | [3.5, 3.5] | Polygon content area is smaller than bounding box |
| Icon + label + sublabel (diamond) | [4, 4] | Diamond content area is ~50% of bounding box |

Nodes that are too small will have their icon automatically scaled down to fit. Text uses shrink-to-fit. But very small nodes produce unreadable results — use the minimums above.

## Quick Reference Table

| Prop | Coordinate System | Range | Example |
|------|-------------------|-------|---------|
| `<Diagram x y w h>` | NVS | [0, 1] | `x={0.1} y={0.05} w={0.8} h={0.9}` |
| `<Diagram tilt>` | Radians | [-π, π] | `tilt={-0.25}` |
| `<Diagram z>` | World | unbounded | `z={0}` |
| `<DiagramNode size>` | Diagram units (auto) / NVS (manual) | varies | `size={[4, 3]}` |
| `<DiagramNode position>` | NVS (ManualLayout only) | [0, 1] | `position={[0.3, 0.5, 0]}` |
| `<Camera position>` | World | unbounded | `position={[0, 2.5, 5]}` |
| `<Camera target>` | World | unbounded | `target={[0, 0, 0]}` |
| `<Directional position>` | World (direction vector) | unbounded | `position={[3, 5, 4]}` |
| `<Model x y w h>` | NVS | [0, 1] | `x={0.5} y={0.5} w={0.4} h={0.6}` |
| `<Model scale>` | Viewport-relative | 0.01–0.5 | `scale={0.06}` |
| `<Chart x y w h>` | NVS | [0, 1] | `x={0.1} y={0.1} w={0.8} h={0.8}` |
| `<ImagePanel x y w h>` | NVS | [0, 1] | `x={0.5} y={0} w={0.5} h={1}` |
| `<Screen x y w h>` | NVS | [0, 1] | `x={0.3} y={0.2} w={0.4} h={0.5}` |
| `<View x y w h>` | NVS | [0, 1] | `x={0.4} y={0} w={0.6} h={1}` |
| `<GridLayout spacing>` | Diagram units | varies | `spacing={[2, 2]}` |
| `<FlowLayout gap>` | Diagram units | varies | `gap={2.5}` |
```

#### UPDATE: `packages/claude-author/docs/guides/nvs-spatial-model.md`

- Add a prominent callout at the top: "For the complete spatial reference including diagram sizing, see `layout-spatial-awareness.md`."
- Add a "World Coordinates vs NVS" section that clearly states: "Camera, Lighting, and Floor use world coordinates. Everything else uses NVS."
- Remove or update the `<Diagram>` example that shows `w={0.3} h={0.2}` — this is unrealistically small for a useful diagram.

#### UPDATE: `packages/claude-author/docs/diagram/nodes-edges-groups.md`

- Update the `size` prop documentation to clearly state units and recommend minimum sizes.
- Add a "Sizing Guide" subsection after the shape/icon docs with the recommended minimums table above.
- Update the `iconScale` documentation to note that icons are automatically scaled down by the fit-to-content layout when the node is too small.
- Add a callout: "If your node has an icon AND a sublabel, use `size={[4, 3]}` minimum for rectangles."

#### UPDATE: `packages/claude-author/docs/guides/common-gotchas.md`

Add these gotchas:
- "Node too small for icon + label + sublabel" — explain the fit-to-content behavior and recommended minimums.
- "Diagram sizes are NOT NVS" — explain that `<DiagramNode size={[4, 3]}>` is in diagram content units, not viewport fractions. Only `<Diagram x y w h>` is NVS.
- "Square nodes need equal width and height" — `size={[4, 4]}` renders as a square. `size={[4, 2]}` renders as a rectangle.

#### UPDATE: `packages/claude-author/docs/diagram/overview.md`

- Add a "Coordinate Systems in Diagrams" section that explains: the `<Diagram>` component's `x/y/w/h` are NVS (percentage of viewport), but node `size` values inside the diagram are in diagram content units (relative proportions).

### Rebuild docs index

After updating docs, run the docs embedding pipeline:
```bash
pnpm --filter @brewsite/claude-author build
```

This rebuilds the search index that the MCP server uses to serve docs to bots.

---

## Work Item 4: Future — NVS Sizing Migration

A separate discussion is underway about migrating diagram node sizes from "diagram content units" to NVS fractions (0-1). This would eliminate the normalization step, make sizing predictable for bots, and align with manual-layout positions. This is a breaking API change and should be scoped as its own PRD if approved.

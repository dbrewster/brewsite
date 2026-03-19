---
title: Layout and Spatial Awareness
doc_type: guide
owner: claude-author
status: active
updated: 2026-03-19
---

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

## Diagram Node Sizes

Inside a `<Diagram>`, node `size` props are **NVS fractions [0..1]** — the same system used for the diagram's own `w` and `h` props. A `size={[0.15, 0.08]}` node occupies 15% of the diagram viewport width and 8% of its height.

### Recommended Node Sizes

| Recipe | Size | Use Case |
|---|---|---|
| Standard | `[0.15, 0.08]` | Default. 6-12 node diagrams. |
| Compact | `[0.10, 0.06]` | Dense diagrams (13+ nodes). |
| Hero | `[0.25, 0.14]` | Title/header nodes. |
| Wide | `[0.22, 0.10]` | Nodes with long labels. |
| Square | `[0.12, 0.12]` | Icon-heavy nodes, circle shapes. |
| Banner | `[0.35, 0.10]` | Full-width title bars. |

The theme provides a default size of `[0.15, 0.08]` when no `size` is specified. Nodes that are too small will have their icon automatically scaled down to fit. Text uses shrink-to-fit. Very small nodes produce unreadable results — use the recipes above as a floor.

Layout spacing and group padding props are also NVS fractions:
- `spacing`: `[0.06, 0.06]` for GridLayout, `[0.045, 0.045]` for HierarchicalLayout
- `groupPadding`: `0.035`
- `titleGap`: `0.025`

## Quick Reference Table

| Prop | Coordinate System | Range | Example |
|------|-------------------|-------|---------|
| `<Diagram x y w h>` | NVS | [0, 1] | `x={0.1} y={0.05} w={0.8} h={0.9}` |
| `<Diagram tilt>` | Radians | [-pi, pi] | `tilt={-0.25}` |
| `<Diagram z>` | World | unbounded | `z={0}` |
| `<DiagramNode size>` | NVS | [0, 1] | `size={[0.15, 0.08]}` |
| `<DiagramNode position>` | NVS (ManualLayout only) | [0, 1] | `position={[0.3, 0.5, 0]}` |
| `<Camera position>` | World | unbounded | `position={[0, 2.5, 5]}` |
| `<Camera target>` | World | unbounded | `target={[0, 0, 0]}` |
| `<Directional position>` | World (direction vector) | unbounded | `position={[3, 5, 4]}` |
| `<Model x y w h>` | NVS | [0, 1] | `x={0.5} y={0.5} w={0.4} h={0.6}` |
| `<Model scale>` | Viewport-relative | 0.01-0.5 | `scale={0.06}` |
| `<Chart x y w h>` | NVS | [0, 1] | `x={0.1} y={0.1} w={0.8} h={0.8}` |
| `<ImagePanel x y w h>` | NVS | [0, 1] | `x={0.5} y={0} w={0.5} h={1}` |
| `<Screen x y w h>` | NVS | [0, 1] | `x={0.3} y={0.2} w={0.4} h={0.5}` |
| `<View x y w h>` | NVS | [0, 1] | `x={0.4} y={0} w={0.6} h={1}` |
| `<GridLayout spacing>` | NVS | [0, 1] | `spacing={[0.06, 0.06]}` |
| `<HierarchicalLayout spacing>` | NVS | [0, 1] | `spacing={[0.045, 0.045]}` |
| `<FlowLayout gap>` | NVS | [0, 1] | `gap={0.05}` |

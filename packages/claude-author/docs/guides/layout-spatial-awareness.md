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

## Layout Spacing, Gap, and Padding

All layout spacing props are **NVS fractions [0..1]** — they represent fractions of the diagram viewport, not world units.

### FlowLayout gap

`gap` is the edge-to-edge distance between adjacent items. Default: `0.06`.

| Gap value | Visual effect | Use case |
|---|---|---|
| `0.03` | Tight, minimal breathing room | Dense flows, compact cards |
| `0.06` | Standard (default) | Most diagrams |
| `0.08` | Generous spacing | Expanded detail views |
| `0.12` | Wide separation | Before/after comparisons, dramatic visual breaks |

**Critical rule:** The sum of all node heights + all gaps must fit within the diagram viewport (≤ 1.0 on the flow axis) to avoid automatic scale-down. If the total exceeds 1.0, the `normalizeToViewport` pass uniformly shrinks all nodes and gaps to fit — making everything proportionally smaller than authored.

Example: 5 nodes at `h=0.12` with `gap={0.06}` → total = 5×0.12 + 4×0.06 = 0.84. Fits comfortably.

### GridLayout and HierarchicalLayout spacing

`spacing` is `[colGap, rowGap]` in NVS fractions.

- GridLayout default: `[0.06, 0.06]`
- HierarchicalLayout default: `[0.045, 0.045]`

`margin` expands each node's claimed bounding box before spacing is applied. NVS fractions. Default: `0` (no margin). Accepts `number` (uniform) or `[horizontal, vertical]`.

### Group padding and titleGap

- `groupPadding`: `0.035` default (all sides). NVS fractions. Accepts CSS-style shorthand: `number`, `[v, h]`, `[t, h, b]`, or `[t, r, b, l]`.
- `titleGap`: `0.025` default. NVS fractions. Gap between the group title label and the content area below it.

## Node and Edge Thickness

`thickness` controls the 3D depth of node prisms and edge tubes. It is an **NVS fraction of the diagram viewport width** — the same coordinate system as node `size`, layout `gap`, and `spacing`. The render pipeline converts `thickness × uniformWorldW` to get world units.

**For nodes:** Omit `thickness` to use the theme default (recommended). Theme defaults vary by aesthetic: `0.033` (neonCyber, thin cards) to `0.210` (midnight, deep blocks). Override per-node only when you need a specific node to stand out:

```tsx
{/* Hero node — extra thick for visual emphasis */}
<DiagramNode id="hero" label="Platform" thickness={0.225} />

{/* Card-like thin node */}
<DiagramNode id="card" label="Config" thickness={0.030} />

{/* Omit thickness — inherits from theme (recommended) */}
<DiagramNode id="default" label="Service" />
```

**For edges:** `thickness` on `<DiagramEdge>` controls tube radius as an NVS fraction. Omit to use the theme default (typically `0.008`–`0.011`). Override only for emphasis:

```tsx
<DiagramEdge from="a" to="b" thickness={0.018} />  {/* thick emphasis edge */}
<DiagramEdge from="b" to="c" />                     {/* theme default (recommended) */}
```

**For cornerRadius:** `cornerRadius` on `<DiagramNode>` is also an NVS fraction. Theme defaults range from `0.006` (neonCyber) to `0.0135` (lightCanvas). Omit to use the theme default.

## Complete NVS Diagram Example

All sizes, gaps, spacing, and padding in this example are NVS fractions:

```tsx
<Diagram id="arch" x={0.05} y={0.05} w={0.9} h={0.9} tilt={-0.25}>
  <FlowLayout direction="top-down" gap={0.06} />

  <DiagramNode id="api" label="API Gateway" sublabel="REST + gRPC"
    shape="hexagon" icon="net:internet" size={[0.18, 0.10]} />

  <DiagramGroup id="services" label="Services" variant="container">
    <GridLayout columns={3} spacing={[0.04, 0.03]} />
    <DiagramNode id="auth" label="Auth" icon="security:shield" shape="circle" size={[0.12, 0.12]} />
    <DiagramNode id="billing" label="Billing" icon="ui:credit-card" shape="circle" size={[0.12, 0.12]} />
    <DiagramNode id="notify" label="Notify" icon="ui:bell" shape="circle" size={[0.12, 0.12]} />
  </DiagramGroup>

  <DiagramNode id="db" label="Database" sublabel="PostgreSQL"
    shape="octagon" icon="data:warehouse" size={[0.18, 0.10]} />

  <DiagramEdge from="api" to="auth" routing="flow" flow="forward" />
  <DiagramEdge from="api" to="billing" routing="flow" flow="forward" />
  <DiagramEdge from="api" to="notify" routing="flow" flow="forward" />
  <DiagramEdge from="auth" to="db" routing="flow" flow="forward" />
  <DiagramEdge from="billing" to="db" routing="flow" flow="forward" />
  <DiagramEdge from="notify" to="db" routing="flow" flow="forward" />
</Diagram>
```

## Quick Reference Table

| Prop | Coordinate System | Range | Example |
|------|-------------------|-------|---------|
| `<Diagram x y w h>` | NVS | [0, 1] | `x={0.1} y={0.05} w={0.8} h={0.9}` |
| `<Diagram tilt>` | Radians | [-pi, pi] | `tilt={-0.25}` |
| `<Diagram z>` | World | unbounded | `z={0}` |
| `<DiagramNode size>` | NVS | [0, 1] | `size={[0.15, 0.08]}` |
| `<DiagramNode thickness>` | NVS (viewport width fraction) | 0.030–0.210 | Omit for theme default |
| `<DiagramNode cornerRadius>` | NVS (viewport width fraction) | 0.006–0.014 | Omit for theme default |
| `<DiagramNode position>` | NVS (ManualLayout only) | [0, 1] | `position={[0.3, 0.5, 0]}` |
| `<DiagramEdge thickness>` | NVS (viewport width fraction) | 0.008–0.011 | Omit for theme default |
| `<FlowLayout gap>` | NVS | [0, 1] | `gap={0.06}` |
| `<GridLayout spacing>` | NVS | [0, 1] | `spacing={[0.06, 0.06]}` |
| `<GridLayout margin>` | NVS | [0, 1] | `margin={0.01}` or `margin={[0.02, 0.01]}` |
| `<HierarchicalLayout spacing>` | NVS | [0, 1] | `spacing={[0.045, 0.045]}` |
| `groupPadding` (any layout) | NVS | [0, 1] | `groupPadding={0.035}` |
| `titleGap` (any layout) | NVS | [0, 1] | `titleGap={0.025}` |
| `<Camera position>` | World | unbounded | `position={[0, 2.5, 5]}` |
| `<Camera target>` | World | unbounded | `target={[0, 0, 0]}` |
| `<Directional position>` | World (direction vector) | unbounded | `position={[3, 5, 4]}` |
| `<Model x y w h>` | NVS | [0, 1] | `x={0.5} y={0.5} w={0.4} h={0.6}` |
| `<Model scale>` | Viewport-relative | 0.01-0.5 | `scale={0.06}` |
| `<Chart x y w h>` | NVS | [0, 1] | `x={0.1} y={0.1} w={0.8} h={0.8}` |
| `<ImagePanel x y w h>` | NVS | [0, 1] | `x={0.5} y={0} w={0.5} h={1}` |
| `<Screen x y w h>` | NVS | [0, 1] | `x={0.3} y={0.2} w={0.4} h={0.5}` |
| `<View x y w h>` | NVS | [0, 1] | `x={0.4} y={0} w={0.6} h={1}` |

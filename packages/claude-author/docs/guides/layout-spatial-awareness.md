---
title: Layout and Spatial Awareness
doc_type: guide
owner: claude-author
status: active
updated: 2026-03-21
---

## The Two Coordinate Systems

BrewSite uses exactly two coordinate systems. Every prop you author falls into one or the other:

### 1. NVS (Normalized Viewport Space) — SceneLength Unit Strings

**Used by:** Element placement (`x`, `y`, `w`, `h`), Diagram viewport bounds, View bounds, TextBox regions, Chart placement, ImagePanel placement, Screen placement.

- Type: `SceneLength` — accepts `"50%"`, `"15u"`, `"10vw"`, `"20vh"`, or `0`
- Meaning: fraction of the viewport (or parent View), or explicit unit values
- `x={"0%"}` left, `x={"100%"}` right. `y={"0%"}` TOP, `y={"100%"}` BOTTOM.
- An element at `x={"50%"} y={"50%"} w={"40%"} h={"30%"}` is centered, 40% wide, 30% tall.

**Everything that controls WHERE and HOW BIG an element appears on screen uses `SceneLength`.**

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

Inside a `<Diagram>`, node `size` props are **`SceneSize2` tuples** — `[SceneLength, SceneLength]` using the unit system. A `size={["15u", "8u"]}` node occupies 15 units wide and 8 units tall in the diagram viewport.

### Recommended Node Sizes

| Recipe | Size | Use Case |
|---|---|---|
| Standard | `["15u", "8u"]` | Default. 6-12 node diagrams. |
| Compact | `["10u", "6u"]` | Dense diagrams (13+ nodes). |
| Hero | `["25u", "14u"]` | Title/header nodes. |
| Wide | `["22u", "10u"]` | Nodes with long labels. |
| Square | `["12u", "12u"]` | Icon-heavy nodes, circle shapes. |
| Banner | `["35u", "10u"]` | Full-width title bars. |

The theme provides a default size of `["15u", "8u"]` when no `size` is specified. Nodes that are too small will have their icon automatically scaled down to fit. Text uses shrink-to-fit. Very small nodes produce unreadable results — use the recipes above as a floor.

## Layout Spacing, Gap, and Padding

All layout spacing props use **`SceneLength` unit strings** — they represent spatial values in the diagram viewport.

### FlowLayout gap

`gap` is the edge-to-edge distance between adjacent items. Default: `"6u"`.

| Gap value | Visual effect | Use case |
|---|---|---|
| `"3u"` | Tight, minimal breathing room | Dense flows, compact cards |
| `"6u"` | Standard (default) | Most diagrams |
| `"8u"` | Generous spacing | Expanded detail views |
| `"12u"` | Wide separation | Before/after comparisons, dramatic visual breaks |

**Critical rule:** The sum of all node heights + all gaps must fit within the diagram viewport to avoid automatic scale-down. If the total exceeds the viewport, the `normalizeToViewport` pass uniformly shrinks all nodes and gaps to fit — making everything proportionally smaller than authored.

Example: 5 nodes at `h="12u"` with `gap={"6u"}` — fits comfortably.

### GridLayout and HierarchicalLayout spacing

`spacing` is `[colGap, rowGap]` using `SceneLength` units.

- GridLayout default: `["6u", "6u"]`
- HierarchicalLayout default: `["4.5u", "4.5u"]`

`margin` expands each node's claimed bounding box before spacing is applied. Default: `0` (no margin). Accepts `SceneLength` (uniform) or `[horizontal, vertical]`.

### Group padding and titleGap

- `groupPadding`: `"3.5u"` default (all sides). Accepts CSS-style shorthand: `SceneLength`, `[v, h]`, `[t, h, b]`, or `[t, r, b, l]`.
- `titleGap`: `"2.5u"` default. Gap between the group title label and the content area below it.

## Node and Edge Thickness

`thickness` controls the 3D depth of node prisms and edge tubes. It is a **`SceneLength` value** — the same unit system as node `size`, layout `gap`, and `spacing`. The render pipeline resolves the unit to world units.

**For nodes:** Omit `thickness` to use the theme default (recommended). Theme defaults vary by aesthetic: `"3.3u"` (neonCyber, thin cards) to `"21u"` (midnight, deep blocks). Override per-node only when you need a specific node to stand out:

```tsx
{/* Hero node — extra thick for visual emphasis */}
<DiagramNode id="hero" label="Platform" thickness={"22.5u"} />

{/* Card-like thin node */}
<DiagramNode id="card" label="Config" thickness={"3u"} />

{/* Omit thickness — inherits from theme (recommended) */}
<DiagramNode id="default" label="Service" />
```

**For edges:** `thickness` on `<DiagramEdge>` controls tube radius as a `SceneLength`. Omit to use the theme default (typically `"0.8u"`–`"1.1u"`). Override only for emphasis:

```tsx
<DiagramEdge from="a" to="b" thickness={"1.8u"} />  {/* thick emphasis edge */}
<DiagramEdge from="b" to="c" />                       {/* theme default (recommended) */}
```

**For cornerRadius:** `cornerRadius` on `<DiagramNode>` is also a `SceneLength`. Theme defaults range from `"0.6u"` (neonCyber) to `"1.35u"` (lightCanvas). Omit to use the theme default.

## Complete Diagram Example

All sizes, gaps, and spacing in this example use `SceneLength` unit strings:

```tsx
<Diagram id="arch" x={"5%"} y={"5%"} w={"90%"} h={"90%"} tilt={"-0.25rad"}>
  <FlowLayout direction="top-down" gap={"6u"} />

  <DiagramNode id="api" label="API Gateway" sublabel="REST + gRPC"
    shape="hexagon" icon="net:internet" size={["18u", "10u"]} />

  <DiagramGroup id="services" label="Services" variant="container">
    <GridLayout columns={3} spacing={["4u", "3u"]} />
    <DiagramNode id="auth" label="Auth" icon="security:shield" shape="circle" size={["12u", "12u"]} />
    <DiagramNode id="billing" label="Billing" icon="ui:credit-card" shape="circle" size={["12u", "12u"]} />
    <DiagramNode id="notify" label="Notify" icon="ui:bell" shape="circle" size={["12u", "12u"]} />
  </DiagramGroup>

  <DiagramNode id="db" label="Database" sublabel="PostgreSQL"
    shape="octagon" icon="data:warehouse" size={["18u", "10u"]} />

  <DiagramEdge from="api" to="auth" routing="flow" flow="forward" />
  <DiagramEdge from="api" to="billing" routing="flow" flow="forward" />
  <DiagramEdge from="api" to="notify" routing="flow" flow="forward" />
  <DiagramEdge from="auth" to="db" routing="flow" flow="forward" />
  <DiagramEdge from="billing" to="db" routing="flow" flow="forward" />
  <DiagramEdge from="notify" to="db" routing="flow" flow="forward" />
</Diagram>
```

## Quick Reference Table

| Prop | Type | Unit | Example |
|------|------|------|---------|
| `<Diagram x y w h>` | `SceneLength` | `%`, `u`, `vw`, `vh` | `x={"10%"} y={"5%"} w={"80%"} h={"90%"}` |
| `<Diagram tilt>` | `SceneAngle` | `deg`, `rad` | `tilt={"-0.25rad"}` |
| `<Diagram z>` | `number` | World | `z={0}` |
| `<DiagramNode size>` | `SceneSize2` | `u` | `size={["15u", "8u"]}` |
| `<DiagramNode thickness>` | `SceneLength` | `u` | Omit for theme default |
| `<DiagramNode cornerRadius>` | `SceneLength` | `u` | Omit for theme default |
| `<DiagramNode position>` | `ScenePosition3` | `%` (ManualLayout) | `position={["30%", "50%", "0%"]}` |
| `<DiagramEdge thickness>` | `SceneLength` | `u` | Omit for theme default |
| `<FlowLayout gap>` | `SceneLength` | `u` | `gap={"6u"}` |
| `<GridLayout spacing>` | `[SceneLength, SceneLength]` | `u` | `spacing={["6u", "6u"]}` |
| `<GridLayout margin>` | `SceneLength` | `u` | `margin={"1u"}` or `margin={["2u", "1u"]}` |
| `<HierarchicalLayout spacing>` | `[SceneLength, SceneLength]` | `u` | `spacing={["4.5u", "4.5u"]}` |
| `groupPadding` (any layout) | `SceneLength` | `u` | `groupPadding={"3.5u"}` |
| `titleGap` (any layout) | `SceneLength` | `u` | `titleGap={"2.5u"}` |
| `<Camera position>` | `[number, number, number]` | World | `position={[0, 2.5, 5]}` |
| `<Camera target>` | `[number, number, number]` | World | `target={[0, 0, 0]}` |
| `<Directional position>` | `[number, number, number]` | World | `position={[3, 5, 4]}` |
| `<Model x y w h>` | `SceneLength` | `%`, `u`, `vw`, `vh` | `x={"50%"} y={"50%"} w={"40%"} h={"60%"}` |
| `<Model scale>` | `number` | Viewport-relative | `scale={0.06}` |
| `<Chart x y w h>` | `SceneLength` | `%`, `u`, `vw`, `vh` | `x={"10%"} y={"10%"} w={"80%"} h={"80%"}` |
| `<ImagePanel x y w h>` | `SceneLength` | `%`, `u`, `vw`, `vh` | `x={"50%"} y={"0%"} w={"50%"} h={"100%"}` |
| `<Screen x y w h>` | `SceneLength` | `%`, `u`, `vw`, `vh` | `x={"30%"} y={"20%"} w={"40%"} h={"50%"}` |
| `<View x y w h>` | `SceneLength` | `%`, `u`, `vw`, `vh` | `x={"40%"} y={"0%"} w={"60%"} h={"100%"}` |

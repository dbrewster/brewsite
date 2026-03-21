---
title: Embedding 3D Content in Slides
doc_type: guide
owner: claude-author
status: active
updated: 2026-03-21
---

## Smart Layout Routing (Recommended)

The simplest way to add 3D content to a slide is to pass 3D DSL elements directly as layout slot children. The deck compiler automatically detects 3D elements (via `getNodeHandler()`) and routes them to `<View>` regions in the WebGL canvas, while HTML content goes to `<TextBox>` overlay regions.

```tsx
import { Slide, TwoColumnSlide, Body } from '@brewsite/slides';
import { Diagram, DiagramNode, DiagramEdge, FlowLayout } from '@brewsite/diagram';

<Slide key="architecture">
  <TwoColumnSlide
    title="Architecture"
    left={<Body>Our system uses a simple API + database pattern.</Body>}
    right={
      <Diagram id="arch" x={"0%"} y={"0%"} w={"100%"} h={"100%"}>
        <FlowLayout direction="left-right" gap={"8u"} />
        <DiagramNode id="api" label="API" size={["15u", "8u"]} />
        <DiagramNode id="db" label="Database" size={["15u", "8u"]} />
        <DiagramEdge from="api" to="db" />
      </Diagram>
    }
  />
</Slide>
```

The compiler classifies each layout region's children into three categories:

- **`html`** — All children are HTML. Region emits a `<TextBox>` (default behavior).
- **`3d`** — All children are 3D DSL elements. Region emits a `<View>` at the region's NVS coordinates.
- **`mixed`** — Both HTML and 3D children. Region emits both a `<View>` (for 3D elements) and a `<TextBox>` (for HTML elements) at the same NVS coordinates, layered.

When any region emits a routed 3D `<View>`, the compiler injects a default `<Camera>` (mode `world`, position `[0, 1.5, 5]`, fov 42) and default `<Lighting>` (ambient, intensity 1) unless the author provides their own via `sceneDsl`.

### Which Layouts Support Smart Routing

Smart routing applies to **classifiable** layout regions — regions whose content comes from author-provided children rather than structured data:

| Layout | Routable Regions |
|---|---|
| `ContentSlide` | `body` |
| `TwoColumnSlide` | `left`, `right` |
| `ImageSlide` | `body` |
| `FullBleedSlide` | `overlay` |
| `BlankSlide` | `body` |

Title regions, structured-data layouts (`TitleSlide`, `SectionSlide`, `BigNumberSlide`, `MetricGridSlide`, `ComparisonSlide`, `QuoteSlide`, `AgendaSlide`), and the `title` region of any layout are **not classifiable** — they always emit `<TextBox>`.

### Known Limitation: Direct Children Only

3D elements must be **direct children** of the layout slot. The compiler inspects the top-level element type via `getNodeHandler()`. If a 3D element is wrapped inside a custom React component, the compiler cannot see through the wrapper and treats it as HTML.

Fragment children (`<>...</>`) are expanded one level, so wrapping in a fragment is fine.

**Wrong — wrapped in a custom component:**
```tsx
function MyDiagram() {
  return <Diagram id="d1" x={"0%"} y={"0%"} w={"100%"} h={"100%"}>...</Diagram>;
}

<ContentSlide title="Arch">
  <MyDiagram />  {/* Compiler sees MyDiagram, not Diagram — routed as HTML */}
</ContentSlide>
```

**Correct — direct child or inside a fragment:**
```tsx
<ContentSlide title="Arch">
  <Diagram id="d1" x={"0%"} y={"0%"} w={"100%"} h={"100%"}>...</Diagram>
</ContentSlide>

{/* Fragment is also fine: */}
<ContentSlide title="Arch">
  <>
    <Diagram id="d1" x={"0%"} y={"0%"} w={"100%"} h={"100%"}>...</Diagram>
  </>
</ContentSlide>
```

### Before/After: Smart Routing vs sceneDsl

**Before (manual sceneDsl + NVS coordinates):**
```tsx
import { Camera, Lighting, Ambient, View } from '@brewsite/core';
import { Slide, TwoColumnSlide, Body } from '@brewsite/slides';
import { BarChart } from '@brewsite/charts';

<Slide key="revenue" sceneDsl={
  <>
    <Camera mode="world" position={[0, 2, 6]} target={[0, 1, 0]} />
    <Lighting><Ambient intensity={0.8} /></Lighting>
    <View id="chart-view" x={"52%"} y={"15%"} w={"45%"} h={"80%"}>
      <BarChart id="rev" x={"0%"} y={"0%"} w={"100%"} h={"100%"}
        data={[{ label: 'Q1', value: 2.1 }, { label: 'Q2', value: 3.4 }]}
      />
    </View>
  </>
}>
  <TwoColumnSlide
    title="Revenue"
    left={<Body>Revenue grew 176% year-over-year.</Body>}
    right={<></>}  {/* empty — 3D content placed manually via sceneDsl */}
  />
</Slide>
```

**After (smart layout routing):**
```tsx
import { Slide, TwoColumnSlide, Body } from '@brewsite/slides';
import { BarChart } from '@brewsite/charts';

<Slide key="revenue">
  <TwoColumnSlide
    title="Revenue"
    left={<Body>Revenue grew 176% year-over-year.</Body>}
    right={
      <BarChart id="rev" x={"0%"} y={"0%"} w={"100%"} h={"100%"}
        data={[{ label: 'Q1', value: 2.1 }, { label: 'Q2', value: 3.4 }]}
      />
    }
  />
</Slide>
```

The compiler auto-routes the `BarChart` to a `<View>`, injects a default camera and lighting, and positions the view at the right column's NVS coordinates. No `sceneDsl`, no manual `<View>`, no NVS math.

---

## The sceneDsl Prop (Escape Hatch)

The `sceneDsl` prop on `<Slide>` injects 3D elements directly into the compiled `Scene` for that slide. Use `sceneDsl` when you need custom camera positioning, custom lighting, background models, or other scene-level 3D elements that don't belong inside a layout region.

```tsx
import { Camera, Lighting, Ambient, Directional } from '@brewsite/core';
import { Slide, ContentSlide, Body } from '@brewsite/slides';
import { Diagram, DiagramNode, DiagramEdge, FlowLayout } from '@brewsite/diagram';

<Slide key="architecture" sceneDsl={
  <>
    <Camera mode="world" position={[0, 1.5, 5]} target={[0, 0.5, 0]} />
    <Lighting><Ambient intensity={0.8} /><Directional intensity={0.6} position={[5, 5, 5]} /></Lighting>
    <Diagram id="arch" x={"10%"} y={"10%"} w={"80%"} h={"80%"}>
      <FlowLayout direction="left-right" gap={"8u"} />
      <DiagramNode id="api" label="API" size={["15u", "8u"]} />
      <DiagramNode id="db" label="Database" size={["15u", "8u"]} />
      <DiagramEdge from="api" to="db" />
    </Diagram>
  </>
}>
  <ContentSlide title="Architecture">
    <Body>Our system uses a simple API + database pattern.</Body>
  </ContentSlide>
</Slide>
```

The `sceneDsl` ReactNode is stored in the compiled `SlideSpec.sceneDsl` field and injected as sibling elements alongside the auto-generated TextBox and environment elements in the Scene.

`sceneDsl` and smart layout routing can be combined. Use `sceneDsl` for scene-level elements (custom camera, custom lighting, background models) and smart routing for content that belongs in a layout region.

---

## What Goes in sceneDsl

Any core, diagram, model, or chart DSL element can be placed in `sceneDsl`. Common elements include:

**Core elements** (from `@brewsite/core`):
- `Camera` -- scene camera position and mode
- `Lighting`, `Ambient`, `Directional`, `Point`, `Spot` -- scene lighting
- `Background` -- scene background color or gradient
- `Environment` -- HDR environment map
- `Floor` -- reflective floor plane

**Diagram elements** (from `@brewsite/diagram`):
- `Diagram`, `DiagramNode`, `DiagramEdge`, `DiagramGroup` -- 3D diagram
- `DiagramCanvas` -- orthographic diagram with camera orbit/dolly/focus
- `FlowLayout`, `GridLayout`, `RadialLayout` -- automatic node positioning
- `ImagePanel` -- 3D image panel with bezel and glow
- `Screen` -- 3D screen element

**Model elements** (from `@brewsite/model`):
- `Model` -- GLTF model loading and animation
- `LabelItem` -- 3D label positioned in world space

**Chart elements** (from `@brewsite/charts`):
- `BarChart`, `LineChart`, `AreaChart`, `PieChart`, `ScatterChart`, `HeatmapChart`

```tsx
import { Camera, Lighting, Ambient, Directional, Background } from '@brewsite/core';
import { BarChart } from '@brewsite/charts';

<Slide key="revenue" sceneDsl={
  <>
    <Camera mode="world" position={[0, 2, 6]} target={[0, 1, 0]} />
    <Lighting><Ambient intensity={0.7} /><Directional intensity={0.5} position={[3, 5, 4]} /></Lighting>
    <Background color="#0a0a1a" />
    <BarChart
      id="revenue-chart"
      x={"15%"} y={"10%"} w={"70%"} h={"70%"}
      data={[
        { label: 'Q1', value: 2.1 },
        { label: 'Q2', value: 3.4 },
        { label: 'Q3', value: 4.2 },
        { label: 'Q4', value: 5.8 },
      ]}
      animateEntry
    />
  </>
}>
  <ContentSlide title="Revenue Growth">
    <Body>Revenue grew 176% year-over-year.</Body>
  </ContentSlide>
</Slide>
```

---

## Camera and Lighting

**With smart layout routing:** When 3D elements are routed from layout slots, the compiler injects a default `<Camera>` (mode `world`, position `[0, 1.5, 5]`, fov 42) and default `<Lighting>` (ambient white, intensity 1) automatically. You only need to provide explicit camera/lighting via `sceneDsl` if you want custom positioning or multi-light setups.

**With sceneDsl:** `sceneDsl` content needs explicit `Camera` and `Lighting` elements. SlidePlayer does not provide default 3D camera or lighting for `sceneDsl`-only slides. Without these elements, 3D content will not be visible.

Minimal required 3D setup for `sceneDsl`:

```tsx
<Slide key="diagram-slide" sceneDsl={
  <>
    <Camera mode="world" position={[0, 1.5, 5]} target={[0, 0.5, 0]} />
    <Lighting>
      <Ambient intensity={0.8} />
      <Directional intensity={0.6} position={[5, 5, 5]} />
    </Lighting>
    {/* Your 3D content here */}
  </>
}>
  <ContentSlide title="My Slide"><Body>Text content.</Body></ContentSlide>
</Slide>
```

If `Camera` is omitted, the camera holds its last position from the previous scene (or the engine default if this is the first scene). If `Lighting` is omitted, the scene has no light sources and 3D geometry renders black.

Each slide with `sceneDsl` should declare its own Camera and Lighting. Different slides can use different camera positions and lighting setups.

---

## Plugin Registration

3D content requires the corresponding plugins to be registered on the `SceneEngine`. The `slidesPlugin()` is always required. Add element-specific plugins based on which DSL elements you use in `sceneDsl`:

```tsx
import { SceneEngine, corePlugin } from '@brewsite/core';
import { slidesPlugin, SlidePlayer, Slide, ContentSlide, Body } from '@brewsite/slides';
import { diagramPlugin } from '@brewsite/diagram';
import { chartPlugin } from '@brewsite/charts';
import { modelPlugin } from '@brewsite/model';

<SceneEngine plugins={[corePlugin(), slidesPlugin(), diagramPlugin(), chartPlugin(), modelPlugin()]}>
  <SlidePlayer>
    <Slide key="diagrams" sceneDsl={/* Diagram elements */}>
      <ContentSlide title="Architecture"><Body>System overview.</Body></ContentSlide>
    </Slide>
    <Slide key="charts" sceneDsl={/* Chart elements */}>
      <ContentSlide title="Metrics"><Body>Performance data.</Body></ContentSlide>
    </Slide>
    <Slide key="models" sceneDsl={/* Model elements */}>
      <ContentSlide title="Product"><Body>3D product view.</Body></ContentSlide>
    </Slide>
  </SlidePlayer>
</SceneEngine>
```

Only register plugins for the element types you actually use. Unused plugins add no overhead but increase bundle size.

---

## Mixed Text + 3D Slides

HTML overlay content (from layout components like `ContentSlide`, `TitleSlide`, etc.) renders on top of the Three.js canvas. The layering order is:

1. `BackgroundLayer` (z-index 0)
2. `SceneCanvas` -- WebGL canvas with 3D content (z-index 1)
3. `EngineOverlayHost` -- HTML overlays including TextBox regions (z-index 2)

To make 3D content visible alongside text, use one of these strategies:

**Position text to one side** -- Use layouts that occupy partial screen area (`ContentSlide`, `TwoColumnSlide`) so the 3D content is visible in the remaining space:

```tsx
<Slide key="product" sceneDsl={
  <>
    <Camera mode="world" position={[2, 1.5, 4]} target={[2, 0.5, 0]} />
    <Lighting><Ambient intensity={0.8} /><Directional intensity={0.6} position={[5, 5, 5]} /></Lighting>
    <Model id="product" src="/product.glb" x={"50%"} y={"10%"} w={"45%"} h={"80%"} />
  </>
}>
  <TwoColumnSlide
    title="Product"
    left={<Body>Our flagship product features advanced materials and ergonomic design.</Body>}
    right={<></>}
  />
</Slide>
```

**Use FullBleedSlide** -- For maximum 3D visibility with a small text overlay:

```tsx
<Slide key="hero" sceneDsl={
  <>
    <Camera mode="world" position={[0, 2, 8]} target={[0, 1, 0]} />
    <Lighting><Ambient intensity={0.9} /><Directional intensity={0.7} position={[5, 5, 5]} /></Lighting>
    <Model id="hero-model" src="/hero.glb" x={"10%"} y={"10%"} w={"80%"} h={"80%"} />
  </>
}>
  <FullBleedSlide overlayPosition="bottom-left">
    <Body>Introducing the next generation.</Body>
  </FullBleedSlide>
</Slide>
```

The SceneTheme's visual tokens (colors, fonts, accent) apply to both the HTML text overlay and the 3D content (diagram themes, chart colors, etc.), keeping the visual language consistent across layers.

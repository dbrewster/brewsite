---
title: Embedding 3D Content in Slides
doc_type: guide
owner: claude-author
status: active
updated: 2026-03-20
---

## The sceneDsl Prop

The `sceneDsl` prop on `<Slide>` injects 3D elements directly into the compiled `Scene` for that slide. Elements render as Three.js geometry in the WebGL canvas, behind the HTML overlay layer.

```tsx
import { Camera, Lighting, Ambient, Directional } from '@brewsite/core';
import { Slide, ContentSlide, Body } from '@brewsite/slides';
import { Diagram, DiagramNode, DiagramEdge, FlowLayout } from '@brewsite/diagram';

<Slide key="architecture" sceneDsl={
  <>
    <Camera mode="world" position={[0, 1.5, 5]} target={[0, 0.5, 0]} />
    <Lighting><Ambient intensity={0.8} /><Directional intensity={0.6} position={[5, 5, 5]} /></Lighting>
    <Diagram id="arch" x={0.1} y={0.1} w={0.8} h={0.8}>
      <FlowLayout direction="left-right" gap={0.08} />
      <DiagramNode id="api" label="API" size={[0.15, 0.08]} />
      <DiagramNode id="db" label="Database" size={[0.15, 0.08]} />
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
      x={0.15} y={0.1} w={0.7} h={0.7}
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

## Camera and Lighting Are Required

`sceneDsl` content needs explicit `Camera` and `Lighting` elements. `SlidePlayer` does not provide default 3D camera or lighting -- it only manages the HTML overlay layer and slide transitions. Without these elements, 3D content will not be visible.

Minimal required 3D setup:

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
    <Model id="product" src="/product.glb" x={0.5} y={0.1} w={0.45} h={0.8} />
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
    <Model id="hero-model" src="/hero.glb" x={0.1} y={0.1} w={0.8} h={0.8} />
  </>
}>
  <FullBleedSlide overlayPosition="bottom-left">
    <Body>Introducing the next generation.</Body>
  </FullBleedSlide>
</Slide>
```

The SceneTheme's visual tokens (colors, fonts, accent) apply to both the HTML text overlay and the 3D content (diagram themes, chart colors, etc.), keeping the visual language consistent across layers.

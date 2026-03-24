# BrewFlow Authoring Guide

This file is the current, bot-first authoring guide for the BrewFlow/BrewSite workspace. It is based on the active PRDs plus the live package exports in `packages/*`.

Use this guide when you need to author scenes or slide decks with the shipped packages:

| Package | Purpose | Main entry point |
|---|---|---|
| `@brewsite/core` | Scene engine, compiler, player, layout, camera, lighting, backgrounds, overlays | `SceneEngine` or `SceneReel` |
| `@brewsite/model` | GLTF models, playback, tracked labels, attachments | `modelPlugin(...)` |
| `@brewsite/diagram` | Diagrams, image panels, live screens | `diagramPlugin(...)` |
| `@brewsite/charts` | 3D charts with shared data store | `chartPlugin()` + `ChartProvider` |
| `@brewsite/slides` | Opinionated slide-deck authoring surface | `SlidePlayer` |

`packages/docs` is internal docs infrastructure, not a scene-authoring package. `apps/examples` is the best source of real authored scenes.

## Current API Notes

Prefer the current names and patterns:

- Use `SceneEngine`, not `EngineProvider`.
- Use `SceneReel` for embedded canvases.
- Author diagrams directly with `<Diagram ... />` inside a scene.
- Do not author new work against old `DiagramCanvas` examples.

## Workspace Commands

```bash
pnpm install
pnpm dev
pnpm build
pnpm typecheck
pnpm test
```

If you work in `apps/examples`, generate the scene DSL types after changing `siteResources.ts`:

```bash
pnpm --filter @brewsite/examples gen:scene-dsl
```

## Universal Authoring Rules

These rules apply across all scene packages.

1. Author scenes as JSX snapshots, not imperative animation code.
2. Mount scenes with `SceneEngine` for full control, or `SceneReel` for a prebuilt embedded container.
3. Keep scene order explicit. Earlier JSX scene order is earlier playback order.
4. Prefer `key` on `<Scene>` for stable scene identity. Keep `id` only for backward compatibility.
5. Keep element IDs stable across adjacent scenes if you want interpolation instead of exit/enter.
6. Use package plugins once per engine. Plugins register handlers and widget instances.
7. Use normalized viewport space (`x`, `y`, `w`, `h`) whenever a package offers it. `0..1` always maps to the engine viewport.
8. Keep raw Three.js out of scene files. Scene files should describe state only.

## Canonical Core Setup

Use this when building a normal page with scrolling scenes:

```tsx
import {
  Background,
  BackgroundLayer,
  Camera,
  EngineARContainer,
  EngineOverlayHost,
  KeyboardInput,
  Lighting,
  Ambient,
  Directional,
  ProgressManager,
  Scene,
  SceneCanvas,
  SceneEngine,
  ScrollInput,
  ScrollStage,
  TextBox,
  corePlugin,
} from '@brewsite/core';

export function Page() {
  return (
    <SceneEngine plugins={[corePlugin()]}>
      <Scene key="intro" id="intro">
        <ProgressManager scrollUnits={1400} />
        <Background color="#08111f" />
        <Lighting>
          <Ambient intensity={1.4} color="#ffffff" />
          <Directional intensity={2.2} color="#ffffff" position={[12, 18, 24]} />
        </Lighting>
        <Camera mode="world" position={[0, 0, 10]} target={[0, 0, 0]} />
        <TextBox x={0.08} y={0.1} w={0.36} h={0.24}>
          <h1 style={{ margin: 0, color: 'white' }}>Intro</h1>
        </TextBox>
      </Scene>

      <Scene key="detail" id="detail" transition="crossfade">
        <ProgressManager scrollUnits={1800} />
        <Background color="#101826" />
        <Camera mode="world" position={[1.2, 0.3, 8]} target={[0, 0, 0]} />
      </Scene>

      <ScrollStage scrollHeightMode="scene-count" pixelsPerScene={1400}>
        <EngineARContainer aspectRatio={16 / 9} scaleMode="fit-width" referenceWidth={1920}>
          <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
          <SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
          <EngineOverlayHost />
        </EngineARContainer>
        <ScrollInput source="window" />
        <KeyboardInput />
      </ScrollStage>
    </SceneEngine>
  );
}
```

Use `SceneReel` when you want a self-contained embedded player:

```tsx
import { SceneReel, Scene, TimeInput, corePlugin } from '@brewsite/core';

export function Demo() {
  return (
    <SceneReel height={420} plugins={[corePlugin()]}>
      <Scene key="only" id="only" />
      <TimeInput duration={4} loop />
    </SceneReel>
  );
}
```

## Core Authoring

### Core mental model

- A `<Scene>` is one authored snapshot.
- Shared IDs across scenes mean “same thing, new state”.
- Missing IDs in a later scene mean the thing exits.
- New IDs in a later scene mean the thing enters.
- `ProgressManager` controls scroll budget and pacing for that scene.
- `TextBox` is the standard overlay primitive for DOM content.

### Core elements you will author most often

| Element | Use |
|---|---|
| `Scene` | Root scene declaration |
| `Camera` | View framing and motion |
| `Lighting`, `Ambient`, `Directional`, `Point`, `Spot` | Lighting rig |
| `Background` | Solid, image, or gradient-like scene backdrop |
| `Environment` | HDRI/cubemap lighting environment |
| `Floor` | Ground plane / reflection |
| `TextBox` | DOM overlay positioned in NVS |
| `ProgressManager` | Scroll budget, pacing, auto-advance, animation boost |
| `InputController` + `Action` + maps | Per-scene direct input behavior |

### Scene transitions

Current scene transition authoring:

- Omit `transition` for the default dissolve-through-black behavior.
- Use `transition="crossfade"` for equal blending.
- Use `exitStart={0.8}` to control when dissolve exit begins.
- Keep `exitStart` with dissolve-style transitions only.

### InputController pattern

Use `InputController` when a scene needs direct camera or canvas interaction instead of plain scroll-only progression:

```tsx
import {
  Action,
  InputController,
  KeyMap,
  PointerMap,
  WheelMap,
} from '@brewsite/core';

<Scene key="inspect" id="inspect">
  <InputController scope="canvas">
    <Action id="orbit" type="camera.orbit" cameraId="camera">
      <PointerMap event="drag" button="left" axis="xy" />
    </Action>
    <Action id="dolly" type="camera.dolly" cameraId="camera" speed={1.2}>
      <WheelMap axis="y" />
    </Action>
    <Action id="next" type="scene.next">
      <KeyMap keyName="ArrowRight" />
    </Action>
  </InputController>
</Scene>
```

### Authoring rules for bots

- Prefer one exported JSX constant per scene file.
- Keep scene-level JSX pure and serializable where possible.
- Use function-valued props only when a value must depend on `SceneSnapshotContext`.
- Do not put arbitrary custom React components directly under `<Scene>` unless they intentionally expand to supported scene DSL or overlay content.

## Model Authoring with `@brewsite/model`

### When to use it

Use `@brewsite/model` for:

- GLTF model placement
- clip playback
- body-part overrides
- attached sub-models
- tracked labels bound to bones or subparts

### Engine setup

`modelPlugin` owns the asset manifest and label positioner. Pass a manifest URL or a preloaded manifest.

```tsx
import { SceneEngine, corePlugin } from '@brewsite/core';
import { modelPlugin } from '@brewsite/model';

const plugins = [
  corePlugin(),
  modelPlugin({ manifestUrl: '/scene-manifest.json' }),
];
```

### Recommended authoring pattern

Today, the runtime widget factory is keyed on `ModelRouter`, so use that as the root model DSL element.

```tsx
import { Scene } from '@brewsite/core';
import {
  Animation,
  BodyPart,
  Label,
  ModelRouter,
  Playback,
} from '@brewsite/model';

const modelScene = (
  <Scene key="model-intro" id="model-intro">
    <ModelRouter
      id="hero-bot"
      type="bot"
      x={0.42}
      y={0.12}
      w={0.42}
      h={0.76}
      z={0}
      scale={1}
      rotation={[0, 0.35, 0]}
    >
      <Playback>
        <Animation clipName="idle" fadeInSeconds={0.25} clipRepeat />
      </Playback>

      <BodyPart id="head" boneId="Head">
        <Label id="head-label" text="Sensor cluster" />
      </BodyPart>
    </ModelRouter>
  </Scene>
);
```

### Model authoring rules

- `id` is the stable runtime widget ID. Keep it stable across scenes to animate the same model.
- `type` selects the asset manifest entry.
- `x`, `y`, `w`, `h` define the model’s NVS viewport region.
- `z`, `rotation`, and `scale` shape the model inside that region.
- Put clip playback under `<Playback><Animation ... /></Playback>`.
- Put labels under `<BodyPart>` or `<Subpart>`, not directly under the model root.
- Use `enabled={false}` or omit the model in a scene when it should disappear.

### Nested model features

Use these only when you need them:

| DSL | Use |
|---|---|
| `BodyParts` / `BodyPart` | Bone or mesh overrides |
| `Pose` | Pose offsets for specific body parts |
| `ModelPart` | Attachment anchor point on the main model |
| `ContainedModel` | Secondary model mounted to a `ModelPart` |
| `Subpart` | Material/visibility control for a contained model subpart |
| `Motion` | Procedural motion commands or scenes |

## Diagram Authoring with `@brewsite/diagram`

### When to use it

Use `@brewsite/diagram` for:

- architecture diagrams
- node/edge/group layouts
- ghost-node transitions between scenes
- image panels
- iframe-backed live screens

### Engine setup

The current live plugin expects every diagram ID up front.

```tsx
import { SceneEngine, corePlugin } from '@brewsite/core';
import { diagramPlugin } from '@brewsite/diagram';

const plugins = [
  corePlugin(),
  diagramPlugin({ diagrams: ['system-overview', 'system-detail'] }),
];
```

### Diagram example

```tsx
import { Scene } from '@brewsite/core';
import {
  Diagram,
  DiagramEdge,
  DiagramGroup,
  DiagramNode,
  HierarchicalLayout,
  darkGlassTheme,
} from '@brewsite/diagram';

const diagramScene = (
  <Scene key="diagram-overview" id="diagram-overview">
    <Diagram
      id="system-overview"
      x={0.04}
      y={0.08}
      w={0.92}
      h={0.72}
      tilt={-0.28}
      z={0}
      scale={1}
      theme={darkGlassTheme}
    >
      <HierarchicalLayout spacing={[3, 2]} />

      <DiagramGroup id="app-tier" label="Application Tier">
        <DiagramNode id="gateway" label="Gateway" icon="aws:api-gateway" />
        <DiagramNode id="service" label="Service" icon="aws:ecs" />
      </DiagramGroup>

      <DiagramNode id="db" label="Database" icon="aws:rds" />
      <DiagramEdge from="gateway" to="service" label="REST" flow="forward" />
      <DiagramEdge from="service" to="db" label="SQL" flow="forward" />
    </Diagram>
  </Scene>
);
```

### Diagram authoring rules

- Register every `Diagram` ID in `diagramPlugin({ diagrams: [...] })`.
- Keep node IDs stable across scenes for motion continuity.
- Omit `label` on a later-scene `DiagramNode` to make it a ghost node that inherits prior identity.
- Use one layout child per diagram: `GridLayout`, `HierarchicalLayout`, `ManualLayout`, or `FlowLayout`.
- Use diagram-level `x`, `y`, `w`, `h` for NVS placement, then use node-level `position` only when doing manual placement.
- Apply theme defaults at the diagram level and override per node/edge only where needed.

### ImagePanel and Screen

These are sibling scene elements, not diagram children.

```tsx
import { ImagePanel, Screen } from '@brewsite/diagram';

<Scene key="media" id="media">
  <ImagePanel
    id="ui-shot"
    src="/screens/dashboard.webp"
    position={[-5, 0, 0]}
    rotation={[0, 0.2, 0]}
    width={10}
    bezel="dark"
    glow
  />

  <Screen
    id="live-product"
    src="https://example.com"
    position={[5, 0, 0]}
    width={12}
    height={7.5}
    opacity={1}
  />
</Scene>
```

Use `ImagePanel` for static imagery. Use `Screen` for live iframe content.

## Chart Authoring with `@brewsite/charts`

### When to use it

Use `@brewsite/charts` for:

- bar
- line
- area
- pie / donut
- scatter
- heatmap

### Engine setup

Charts require both a plugin and a `ChartProvider` in the same engine tree.

```tsx
import { SceneEngine, corePlugin } from '@brewsite/core';
import { ChartProvider, chartPlugin } from '@brewsite/charts';

const chartsPlugin = chartPlugin();

export function ChartPage() {
  return (
    <SceneEngine plugins={[corePlugin(), chartsPlugin]}>
      <ChartProvider
        data={{
          monthly: [
            { month: 'Jan', revenue: 120, costs: 70 },
            { month: 'Feb', revenue: 140, costs: 82 },
          ],
        }}
      >
        {/* scenes here */}
      </ChartProvider>
    </SceneEngine>
  );
}
```

### Chart example

```tsx
import { Scene } from '@brewsite/core';
import {
  Chart,
  ChartAxis,
  ChartData,
  ChartLegend,
  ChartSeries,
} from '@brewsite/charts';

const chartScene = (
  <Scene key="revenue-chart" id="revenue-chart">
    <Chart
      id="revenue"
      type="bar"
      x={0.08}
      y={0.12}
      w={0.84}
      h={0.7}
      z={0}
      theme="darkGlass"
      interactive
    >
      <ChartData source="monthly" filterGroup="dashboard" />
      <ChartAxis axis="x" field="month" label="Month" />
      <ChartAxis axis="y" field="revenue" label="Revenue" format="$,.0f" />
      <ChartSeries field="revenue" label="Revenue" />
      <ChartSeries field="costs" label="Costs" color="#ff8a4c" />
      <ChartLegend visible position="right" />
    </Chart>
  </Scene>
);
```

### Chart authoring rules

- Every `<Chart>` must have a direct `<ChartData source="...">` child.
- `source` must match a key in `ChartProvider.data`.
- Use `x`, `y`, `w`, `h` for chart placement.
- Use `bounds.depth` when only the 3D thickness needs adjusting.
- Use the same `filterGroup` across charts to enable linked filtering.
- Prefer `theme="darkGlass"` or another preset first; override only when necessary.

## Slide Authoring with `@brewsite/slides`

### When to use it

Use `@brewsite/slides` when you want a deck-first API instead of building a page from raw `SceneEngine` parts.

### SlidePlayer example

```tsx
import {
  Body,
  BulletList,
  Slide,
  SlidePlayer,
  TitleBodyLayout,
  TitleLayout,
  darkDeckTheme,
} from '@brewsite/slides';

export function Deck() {
  return (
    <SlidePlayer theme={darkDeckTheme} transition="dissolve">
      <Slide key="title" title="BrewFlow">
        <TitleLayout title="BrewFlow" subtitle="Scene authoring guide" />
      </Slide>

      <Slide key="authoring" title="Authoring" scrollUnits={400}>
        <TitleBodyLayout title="Rules">
          <BulletList
            animateEntrance
            items={[
              'One Slide compiles to one Scene',
              'Use stable keys',
              'Keep text declarative',
            ]}
          />
          <Body>Slides are the highest-level authoring surface in the repo.</Body>
        </TitleBodyLayout>
      </Slide>
    </SlidePlayer>
  );
}
```

### Slide layouts

| Layout | Use |
|---|---|
| `TitleLayout` | Title + optional subtitle |
| `TitleBodyLayout` | Top title band + main content |
| `TwoColumnLayout` | Comparison layout |
| `FullBleedLayout` | Canvas-first slide with optional text overlay |
| `BlankLayout` | No layout opinion |
| `SlideContent` | Raw custom content escape hatch |

### Slide authoring rules

- `key` on `<Slide>` is required and becomes the compiled scene ID.
- `scrollUnits` sets how much progression budget that slide consumes.
- `notes` is for presenter/speaker metadata.
- `BulletList` and `NumberedList` support `animateEntrance`.
- The built-in slide DSL is text/layout focused. Reach for raw `SceneEngine` if your deck needs full custom 3D scene authoring rules instead of the slide compiler’s layout model.

## Package Selection Guide

Use this when deciding what to author with.

| Need | Package |
|---|---|
| Scroll-driven or freeform 3D scenes | `@brewsite/core` |
| Animated GLTF character, product model, or bone labels | `@brewsite/model` |
| Architecture graph, system topology, image board, live screen | `@brewsite/diagram` |
| Quantitative visualization with shared data/filtering | `@brewsite/charts` |
| Presentation deck with slide layouts and navigation | `@brewsite/slides` |

## Authoring Checklist

- Pick the highest-level package that matches the experience you need.
- Create one plugin instance per engine.
- Keep scene keys and widget IDs stable.
- Use NVS placement first.
- Keep scene JSX declarative.
- Verify package-specific providers are present:
  - `ChartProvider` for charts
  - `modelPlugin({ manifestUrl | manifest })` for models
  - `diagramPlugin({ diagrams: [...] })` for diagrams
- Use `apps/examples` as the source of real composition patterns.

## Best Files to Read Next

If you need concrete examples after this README, start here:

- `apps/examples/src/architecture/scenes/`
- `apps/examples/src/chart/`
- `apps/examples/src/slides-demo/`
- `requirements/core/prd/prd_scene_authoring.md`
- `requirements/model/prd/prd_model.md`
- `requirements/diagram/prd/prd_diagram_element.md`
- `requirements/diagram/prd/prd_image_panel_screen.md`
- `requirements/slides/prd/prd_slides.md`

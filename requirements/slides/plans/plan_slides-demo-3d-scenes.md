---
title: "Add 3D Diagrams and Charts to Slides Demo"
doc_type: plan
owner: architect
status: draft
updated: 2026-03-18
---

# Plan: Add 3D Diagrams and Charts to Slides Demo

## Goal

Transform the slides demo from a pure HTML overlay deck into a showcase of BrewSite's core value proposition: **3D scenes integrated with presentation content**. Add `@brewsite/diagram` and `@brewsite/charts` to 4–5 slides where 3D visualization directly enhances the narrative.

## Background

The slides demo at `apps/examples/src/slides-demo/` currently uses 15 slides — all pure HTML/CSS via TextBox overlays. The `<SlidePlayer>` already accepts a `plugins` prop and the `<Scene>` DSL supports any 3D element alongside TextBox overlays. Diagrams and charts render as 3D geometry in the engine's scene, positioned via NVS coordinates `(x, y, w, h) ∈ [0..1]`, and coexist naturally with the HTML overlay layer.

### How 3D Content Works in Slides

Each `<Slide>` compiles to a `<Scene>`. The `buildSceneElements()` function in `deckCompiler.tsx` creates the Scene with:
- Environment DSL: `<Floor>`, `<Background>`, `<Lighting>`, `<ProgressManager>`
- Metadata DSL: `<SlideMetaDsl>`
- Overlay content: `<TextBox>` elements (rendered as HTML overlays by EngineOverlayHost)

3D DSL elements (`<Diagram>`, `<BarChart>`, etc.) are **compiled by their NodeHandlers** — they become widget state in the SceneTrack, not overlay content. They render as Three.js geometry in the canvas, visible **behind** the HTML overlay.

The key insight: slides that want 3D content need to:
1. Leave space in their TextBox layout for the 3D content to show through (the overlay has `pointer-events: none`)
2. Add Camera + Lighting DSL appropriate for 3D viewing
3. Include diagram/chart DSL as siblings of the TextBox elements in the Scene

### Architecture: Where 3D Elements Go

The `buildSceneElements()` function creates Scene children as a flat array:
```
Scene children = [ProgressManager, Floor, Background, Lighting, SlideMetaDsl, ...TextBoxes]
```

To add 3D content, we need to inject additional DSL elements into this array. The cleanest approach: **extend `SlideSpec` with an optional `sceneDsl` field** that carries extra Scene children authored by the slide. The `buildSceneElements()` function spreads them into the Scene.

## Design

### 1. Extend `SlideSpec` with `sceneDsl`

**File: `packages/slides/src/types.ts`**

Add to `SlideSpec`:
```typescript
/** Optional additional Scene DSL children (3D elements, camera overrides, lighting overrides).
 *  Injected as siblings of the auto-generated TextBox/environment elements. */
sceneDsl?: React.ReactNode;
```

### 2. Extend `<Slide>` Props

**File: `packages/slides/src/dsl.tsx`**

Add to `SlideProps`:
```typescript
/**
 * Additional 3D scene DSL elements injected directly into the Scene.
 * Use for <Diagram>, <BarChart>, <Camera>, <Lighting>, or any core/diagram/chart DSL.
 * These render as Three.js geometry in the canvas, behind the HTML overlay.
 *
 * @example
 * <Slide key="arch" sceneDsl={<>
 *   <Camera mode="world" position={[0, 1.5, 5]} target={[0, 0.3, 0]} fov={38} />
 *   <Diagram id="arch" x={0.5} y={0} w={0.5} h={1}>
 *     <FlowLayout direction="top-down" gap={1} />
 *     <DiagramNode id="api" label="API Gateway" />
 *   </Diagram>
 * </>}>
 *   <TitleBodyLayout title="Architecture">
 *     <Body>Our platform architecture.</Body>
 *   </TitleBodyLayout>
 * </Slide>
 */
sceneDsl?: React.ReactNode;
```

### 3. Wire `sceneDsl` Through Compilation

**File: `packages/slides/src/compiler/deckCompiler.tsx`**

In `compileSlide()`, extract `sceneDsl` from the Slide props and carry it on the SlideSpec:
```typescript
const sceneDsl = props['sceneDsl'] as React.ReactNode | undefined;
// ... add to returned SlideSpec:
sceneDsl: sceneDsl ?? undefined,
```

In `buildSceneElements()`, spread `sceneDsl` into the Scene children:
```typescript
return React.createElement(
  Scene,
  { key: slideSpec.key, id: slideSpec.key },
  React.createElement(ProgressManager, { key: 'pm', scrollUnits: slideSpec.scrollUnits }),
  React.createElement(Floor, { key: 'floor', enabled: false }),
  React.createElement(Background, { key: 'bg', color: spec.theme.background.color }),
  React.createElement(Lighting, { key: 'lighting' },
    React.createElement(Ambient, { key: 'ambient', intensity: 1, color: '#ffffff' }),
  ),
  React.createElement(SlideMetaDsl, { ... }),
  ...textBoxElements,
  // Inject author's 3D scene DSL (Diagram, Chart, Camera overrides, etc.)
  ...(slideSpec.sceneDsl ? [slideSpec.sceneDsl] : []),
);
```

**Important**: When `sceneDsl` includes `<Camera>` or `<Lighting>`, those override the slide's defaults because the compiler processes children in order and later declarations win.

### 4. Update Demo Page to Pass Plugins

**File: `apps/examples/src/slides-demo/SlidesDemoPage.tsx`**

```typescript
import { diagramPlugin } from '@brewsite/diagram';
import { chartPlugin } from '@brewsite/charts';
import { themesPlugin } from '@brewsite/themes';

// Create stable plugin instances (outside component, or useMemo)
const extraPlugins = [diagramPlugin(), chartPlugin(), themesPlugin()];

// In the JSX:
<SlidePlayer plugins={extraPlugins} ...>
```

### 5. Add 3D Content to Specific Slides

**File: `apps/examples/src/slides-demo/deck.tsx`**

Add imports:
```typescript
import { Camera, Lighting, Ambient, Directional, Floor } from '@brewsite/core';
import {
  Diagram, DiagramNode, DiagramEdge, DiagramGroup,
  FlowLayout, GridLayout,
} from '@brewsite/diagram';
import {
  BarChart, ChartAxis, ChartData, ChartSeries, ChartLegend,
} from '@brewsite/charts';
```

#### Slide 6: Platform Architecture → 3D Diagram

Replace the pure-HTML architecture layers with a 3D flow diagram showing the 5-layer stack. Use `<TitleBodyLayout>` with a brief description on the left-ish area, and the diagram filling most of the canvas.

```tsx
const architectureSlide = (
  <Slide
    key="architecture"
    title="Platform Architecture"
    scrollUnits={300}
    sceneDsl={<>
      <Camera mode="world" position={[0, 1.2, 5.5]} target={[0, 0.2, 0]} fov={38} />
      <Lighting>
        <Ambient intensity={2.5} color="#d7e5ff" />
        <Directional intensity={1.2} color="#ffffff" position={[3, 5, 4]} />
      </Lighting>
      <Floor variant="grid" />

      <Diagram id="arch-layers" x={0.02} y={0.02} w={0.96} h={0.94} scale={0.9}>
        <FlowLayout direction="top-down" gap={0.8} />

        <DiagramNode id="apps" label="Applications" sublabel="Analytics · Catalog · Lineage · Admin"
          icon="ui:layout" size={[10, 1.8]} />

        <DiagramNode id="api" label="API Gateway" sublabel="REST · gRPC · WebSocket · SDK"
          icon="net:globe" size={[10, 1.8]} />

        <DiagramGroup id="engine" label="Processing Engine" variant="container">
          <GridLayout columns={3} spacing={[1.2, 0.8]} />
          <DiagramNode id="stream" label="Stream" sublabel="Real-time" icon="data:stream" size={[4.5, 1.6]} />
          <DiagramNode id="batch" label="Batch" sublabel="Scheduled" icon="data:database" size={[4.5, 1.6]} />
          <DiagramNode id="ml" label="ML Pipeline" sublabel="Training · Inference" icon="tech:cpu" size={[4.5, 1.6]} />
        </DiagramGroup>

        <DiagramNode id="storage" label="Storage Layer" sublabel="Columnar · Object Lake · Time-Series · KV Cache"
          icon="data:database" size={[10, 1.8]} />

        <DiagramNode id="infra" label="Infrastructure" sublabel="Multi-Cloud · Auto-Scale · mTLS · Observability"
          icon="security:shield" size={[10, 1.8]} />

        <DiagramEdge from="apps" to="api" routing="flow" flow="forward" />
        <DiagramEdge from="api" to="stream" routing="flow" flow="forward" />
        <DiagramEdge from="api" to="batch" routing="flow" flow="forward" />
        <DiagramEdge from="api" to="ml" routing="flow" flow="forward" />
        <DiagramEdge from="stream" to="storage" routing="flow" flow="forward" />
        <DiagramEdge from="batch" to="storage" routing="flow" flow="forward" />
        <DiagramEdge from="ml" to="storage" routing="flow" flow="forward" />
        <DiagramEdge from="storage" to="infra" routing="flow" flow="forward" />
      </Diagram>
    </>}
  >
    <BlankLayout />
  </Slide>
);
```

**Design note**: BlankLayout with empty children means the full-size TextBox body region renders but is empty — the 3D diagram fills the canvas behind it. The TextBox is transparent so the diagram shows through.

#### Slide 7: Platform Metrics → 3D Bar Chart

Add a 3D bar chart alongside the metric cards. Use a split layout: metric cards on left (HTML overlay), bar chart on right (3D canvas).

```tsx
const metricsSlide = (
  <Slide
    key="metrics"
    title="Platform Metrics"
    scrollUnits={200}
    sceneDsl={<>
      <Camera mode="world" position={[0, 1.2, 5.5]} target={[0, 0.2, 0]} fov={38} />
      <Lighting>
        <Ambient intensity={2.5} color="#d7e5ff" />
        <Directional intensity={1.2} color="#ffffff" position={[3, 5, 4]} />
      </Lighting>
      <Floor variant="grid" />

      <BarChart
        id="metrics-chart"
        data={[
          { quarter: 'Q1', events: 1.2, customers: 580, arr: 38 },
          { quarter: 'Q2', events: 1.8, customers: 720, arr: 48 },
          { quarter: 'Q3', events: 2.1, customers: 790, arr: 58 },
          { quarter: 'Q4', events: 2.4, customers: 847, arr: 68 },
        ]}
        x={0.52} y={0.1} w={0.44} h={0.8}
        depth={0.4}
        animateEntry
      >
        <ChartData keyField="quarter" />
        <ChartAxis axis="x" field="quarter" label="Quarter" />
        <ChartAxis axis="y" field="arr" label="ARR ($M)" />
        <ChartSeries field="arr" label="ARR" />
        <ChartSeries field="events" label="Events/s (M)" />
        <ChartLegend visible position="right" />
      </BarChart>
    </>}
  >
    <BlankLayout>
      {/* Left-side metric cards (HTML overlay, transparent right half shows chart) */}
      <div style={{ ... metric cards positioned in left 48% ... }} />
    </BlankLayout>
  </Slide>
);
```

#### Slide 10: Roadmap Timeline → Morphing Diagram

The roadmap slide can show milestones as a diagram that the 3D engine renders with depth and lighting. The timeline milestones become diagram nodes with a flow layout.

#### Slide 11: Case Study → Before/After Diagram

The Meridian Health case study could show a "before" diagram (fragmented Snowflake + Kafka + Airflow) that visually contrasts with the unified Nexus architecture.

### 6. Camera and Lighting Strategy

Slides with 3D content need explicit Camera + Lighting because the default slide environment (`<Floor enabled={false}>, <Ambient intensity={1}>`) is optimized for invisible 3D (overlay-only slides). For 3D slides:

```tsx
<Camera mode="world" position={[0, 1.2, 5.5]} target={[0, 0.2, 0]} fov={38} />
<Lighting>
  <Ambient intensity={2.5} color="#d7e5ff" />
  <Directional intensity={1.2} color="#ffffff" position={[3, 5, 4]} />
</Lighting>
<Floor variant="grid" />
```

These are included in the `sceneDsl` prop and **override** the slide's auto-generated environment because the compiler processes later children after earlier ones (last write wins for Camera, Lighting, Floor).

### 7. Theme Integration

Diagrams and charts resolve their themes automatically from the engine's `sceneTheme` context. The `themesPlugin()` registers all six theme families (enterprise, darkGlass, midnight, neonCyber, lightCanvas, lightMinimal) with diagram and chart theme registries. Since the slides demo already lets users pick a theme family, the 3D elements will follow the selected theme automatically — no per-slide theme wiring needed.

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `packages/slides/src/types.ts` | Modify | Add `sceneDsl?: React.ReactNode` to `SlideSpec` |
| `packages/slides/src/dsl.tsx` | Modify | Add `sceneDsl?: React.ReactNode` to `SlideProps` |
| `packages/slides/src/compiler/deckCompiler.tsx` | Modify | Extract `sceneDsl` in `compileSlide()`, spread in `buildSceneElements()` |
| `apps/examples/src/slides-demo/SlidesDemoPage.tsx` | Modify | Add diagram/chart/themes plugins |
| `apps/examples/src/slides-demo/deck.tsx` | Modify | Replace 4–5 slides with 3D-enhanced versions |

## Testing Strategy

1. **Existing tests**: All 210 slide tests should continue to pass (sceneDsl is optional, defaults to undefined).
2. **New `deckCompiler.test.ts` test**: Verify that a Slide with `sceneDsl` produces a SlideSpec that carries the DSL, and that `buildSceneElements()` includes it in the Scene children.
3. **Manual verification**: Run the demo, cycle through all 15 slides, verify:
   - Slides without sceneDsl render as before (pure HTML overlay)
   - Slides with sceneDsl show 3D content in the canvas behind the overlay
   - Theme switching updates both overlay and 3D content
   - Arrow key navigation transitions smoothly between 2D and 3D slides

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Camera/lighting mismatch between 3D and non-3D slides | Each 3D slide explicitly declares Camera + Lighting in sceneDsl; non-3D slides use the auto-generated minimal environment |
| Diagram icons not loading (async SVG fetch) | Use only built-in icon namespaces (`flow:*`, `ui:*`, `tech:*`, `data:*`, `net:*`, `security:*`) which are bundled |
| Theme registry not populated | `themesPlugin()` must be in the plugins array; it registers all theme pairs on init |
| Performance concern with 15 scenes + 3D geometry | Diagrams/charts are lightweight geometry (no GLTF loading); the engine only renders the active scene's geometry |

---
title: "@brewsite/charts — Package Design Note"
doc_type: note
owner: Toolkit Product
status: draft
updated: 2026-03-01
---

# @brewsite/charts — Package Design Note

## Purpose

This note captures the research, architectural decisions, and open questions
for a new published package: `@brewsite/charts`. It is intended for architect
review before a formal PRD and implementation plan are written.

---

## Context and Motivation

BrewSite scenes are used for 3D marketing presentations. Data visualization is
a first-class need in that context: revenue charts, funnel metrics, comparison
grids, heatmaps, and scatter plots appear routinely in product demos, investor
decks, and data-driven marketing scenes. Today there is no supported path for
charts in the toolkit — consumers work around it with static images or HTML
overlays, both of which break the visual coherence of the scene.

The goal is a first-party charting package that integrates natively with the
Widget SDK and the BrewSite visual language (PBR materials, environment maps,
the darkGlass / neonCyber / enterprise / lightMinimal theme palette).

---

## The Core Architectural Decision: Native 3D, Not Canvas Texture

The most consequential design decision for this package is how charts physically
exist inside a Three.js scene. Two approaches were evaluated in depth:

### Option A — Canvas-on-Plane (CanvasTexture)
Render charts to an `OffscreenCanvas` using a 2D charting library, apply the
result as a `THREE.CanvasTexture` to a glass panel mesh. The chart looks 3D
because the panel is a real 3D object in the scene, but the chart itself is a
flat bitmap.

This approach was investigated for **ECharts 6** (Apache-2.0) as the 2D engine.
ECharts was eliminated after research surfaced four disqualifying issues for our
specific stack:

1. **pnpm workspace breakage** — `zrender` peer dependency resolution fails in
   pnpm workspaces (GitHub issue #20419, October 2024). Our monorepo uses pnpm
   exclusively.
2. **React wrapper abandoned** — `echarts-for-react`, the standard React
   integration, was last published October 2021. It does not support ECharts v6
   or the tree-shakeable API. We would own a full custom React abstraction layer.
3. **Bundle size** — Community measurement for a realistic four-chart-type
   tree-shaken bundle (bar + line + pie + scatter + tooltip + legend + canvas
   renderer): **200–350 KB gzip**. This becomes a transitive dependency for
   every `@brewsite/charts` consumer.
4. **TypeScript breakage on our stack** — `NodeNext` module resolution, which
   strict TypeScript monorepos use, breaks ECharts imports (issue #19992).
   TypeScript 5.8+ type imports break (issue #21205). Both apply to us.

Other candidates reviewed: Nivo Canvas variants, Chart.js, Recharts (SVG,
eliminated for canvas incompatibility), Observable Plot (SVG, eliminated).
Nivo Canvas variants remain viable for any chart type that genuinely cannot be
rendered in 3D and is deferred to a later version.

### Option B — D3 Math → Three.js Native Geometry (chosen)
Use D3's pure math modules (`d3-scale`, `d3-shape`, `d3-array`, `d3-format`)
as a geometry computation engine. D3 produces coordinate mappings and path
data; Three.js consumes them as native geometry. Charts are real 3D objects in
the scene — not textures on a plane.

**Why D3 is the right engine here:**
D3 is not a renderer. It has no DOM dependency, no React opinion, no canvas
requirement. It computes: given this data domain, produce these world-space
coordinates. The output feeds directly into `THREE.BoxGeometry`, `TubeGeometry`,
`ExtrudeGeometry`, and `InstancedMesh` without any canvas intermediary.

```
D3 scale:  scaleLinear().domain([0, maxValue]).range([0, 4])
Output:    a function   value → Three.js world-space Y coordinate

D3 shape:  pie().value(d => d.amount)(data)
Output:    [{ startAngle, endAngle, data }, ...]
           → fed directly into THREE.Shape + ExtrudeGeometry
```

**Consequences of this choice:**
- Charts are real Three.js objects. Camera can orbit around a bar chart and
  see the bars from the side. Bars cast shadows. Pie slices catch environment
  light. Scatter points have depth.
- Materials, roughness, metalness, transmission, envMap — all native Three.js
  PBR. Charts match the visual language of diagram nodes exactly.
- No `texture.needsUpdate` polling. No resolution ceiling. No canvas context.
- D3 math module bundle: **~35–45 KB gzip** for the full set. 5–8× lighter
  than the ECharts floor.
- Licenses: D3 is ISC (functionally identical to MIT). Clean.

**The tradeoff:** More implementation work per chart type than delegating to a
third-party renderer. Each chart type is a custom Three.js renderer. This is
accepted as consistent with the existing BrewSite philosophy — the diagram
package does not use a third-party diagram renderer either.

---

## Dependency Stack

```
@brewsite/charts → @brewsite/core (Widget SDK)
@brewsite/charts ↛ @brewsite/diagram (no dependency)
@brewsite/diagram ↛ @brewsite/charts (no dependency)
```

Peer dependencies: `react`, `react-dom`, `three` (same versions as core).

Direct dependencies:
- `d3-scale` — coordinate mapping (band, linear, log, ordinal, time)
- `d3-shape` — geometry computation (arc, line, area, pie)
- `d3-array` — data math (extent, group, rollup, bin)
- `d3-format` — number formatting for axis labels
- `d3-time-format` — date/time formatting
- `crossfilter2` — n-dimensional filtering for cross-chart interactivity

D3 modules are ISC-licensed. crossfilter2 is Apache-2.0. All compatible with
the MIT/Apache requirement.

---

## Data Layer Design

Chart data is registered at runtime, not baked into the `SceneTrack`. The DSL
references data by name; the actual data is supplied to a `ChartProvider` before
scene mount. This keeps compiled scene tracks lightweight and supports async or
API-sourced data without DSL changes.

```tsx
// App-level setup (outside the scene)
<ChartProvider
  data={{
    'quarterly-revenue': [
      { quarter: 'Q1', revenue: 1_200_000, region: 'APAC' },
      { quarter: 'Q2', revenue: 1_850_000, region: 'APAC' },
      // ...
    ],
  }}
>
  <ScenePlayer manifest={manifest} />
</ChartProvider>

// Scene DSL (baked into SceneTrack)
<Chart id="revenue-chart" type="bar" theme="darkGlass">
  <ChartData
    source="quarterly-revenue"
    dimensions={['quarter', 'revenue']}
    xField="quarter"
    yField="revenue"
  />
  <ChartAxis axis="x" label="Quarter" />
  <ChartAxis axis="y" label="Revenue" format="$,.0f" />
</Chart>
```

### Transform Pipeline
`<ChartData>` accepts an optional `transform` prop — an ordered array of pure
transformation steps applied to the named source before the chart receives it:

```tsx
<ChartData
  source="raw-events"
  transform={[
    { type: 'filter', test: (d) => d.year === 2025 },
    { type: 'groupby', key: 'region', aggregate: { revenue: 'sum' } },
    { type: 'sort', by: 'revenue', order: 'desc' },
  ]}
/>
```

Transforms are pure functions composed at render time. The `ChartDataStore`
applies them in order each time the source or transform config changes.

---

## Cross-Filtering Design

Cross-filtering is scoped to **one scene**. Charts in the same scene that share
a `filterGroup` prop are linked: brushing or clicking in one chart applies a
dimension filter that all other charts in the group respond to.

Implementation: `crossfilter2` manages the indexed dimensions per filter group.
A `ChartFilterContext` (React context) is created per filter group and made
available to all `ChartWidget` instances sharing that group ID. When a filter
changes, affected widgets call `IRenderable.apply()` with updated data, which
rebuilds the relevant Three.js geometry.

```tsx
// Two charts linked by the same filterGroup
<Chart id="by-region"  type="bar"     filterGroup="sales" ... />
<Chart id="by-quarter" type="line"    filterGroup="sales" ... />
<Chart id="by-product" type="scatter" filterGroup="sales" ... />
```

Brushing the bar chart by APAC instantly redraws the line and scatter with
only APAC data — crossfilter2 incremental index updates make this sub-30ms
for presentation data scales.

**Scope boundary:** Cross-filtering does not cross scene boundaries. Each scene
instantiates independent `ChartFilterContext` instances.

---

## Chart Type Catalogue

### V1 — Native 3D Geometry

All V1 chart types render as real Three.js geometry using D3 math.

#### Bar / Column Chart
- D3: `scaleBand` (X), `scaleLinear` (Y)
- Three.js: `BoxGeometry` per bar, `MeshPhysicalMaterial` (glass)
- 3D value: Real extruded columns. Camera orbit reveals depth. Bars catch
  scene lighting and cast shadows. Multiple series = grouped or stacked
  geometry clusters.
- Variants: vertical column, horizontal bar, grouped, stacked

#### Line Chart
- D3: `scaleLinear` or `scaleTime` (X), `scaleLinear` (Y), `line()` generator
- Three.js: `CatmullRomCurve3` → `TubeGeometry`
- 3D value: A glowing tube traces the data path through space. Multiple series
  are parallel tubes at different Z offsets. Tube radius can encode a second
  data dimension.
- Variants: single line, multi-line, step line

#### Area Chart
- D3: same scales as line, `area()` generator for boundary computation
- Three.js: extruded `THREE.Shape` from the area boundary
- 3D value: A translucent ribbon with real volume rises from the floor plane.
  Gradient transmission material gives the "data wave" look.
- Variants: single area, stacked area

#### Pie / Donut Chart
- D3: `pie()` for angle computation, `arc()` for inner/outer radius
- Three.js: `ExtrudeGeometry` per slice from `THREE.Shape` arc
- 3D value: Real extruded wedges. Each slice is a distinct PBR-material mesh.
  Slices can be exploded on selection. The donut hole is the inner radius.
- Variants: pie, donut, exploded slice

#### Scatter Plot
- D3: `scaleLinear` (X and Y), optional `scaleSqrt` for point size
- Three.js: `InstancedMesh` with `SphereGeometry` base; per-instance color
  via `setColorAt`, per-instance scale for bubble variant
- 3D value: Each data point is a real sphere positioned in world space.
  Color encodes a third dimension. Size (bubble variant) encodes a fourth.
  Raycasting identifies the hovered point for tooltips.
- Variants: scatter, bubble (size-encoded)

#### Heatmap
- D3: `scaleBand` (X and Y), `scaleSequential` with color interpolator for value
- Three.js: `InstancedMesh` with `PlaneGeometry` tiles; per-instance color
  for value dimension; per-instance Y-scale for height dimension
- 3D value: This is where heatmaps become genuinely more powerful in 3D.
  Each cell is a tile on the XZ plane. Color encodes the primary value.
  Tile height (Y scale) can encode a **second independent value** — yielding
  a true 4D visualization (X position, Y position, color, height). If the
  data has a time dimension, keyframe animation can add a 5th.
  Example: a geographic grid where cell color = revenue, cell height =
  growth rate. Neither axis alone tells the full story.
- Variants: flat (color only), raised (color + height), animated time series

---

### V2 Candidates — Native 3D Geometry

Planned but deferred. All use the same D3 math → Three.js geometry pattern.

#### Radar / Spider Chart
- D3: `scaleLinear` per axis, polar coordinate math
- Three.js: `LineSegments` for the web, `Shape` for the filled polygon area
- Value: Comparison of multiple entities across shared axes. A natural shape
  for "product comparison" or "team profile" storytelling. The 3D surface
  (if multiple series are stacked at different Z depths) is striking.

#### Bubble Chart (extended scatter)
- Already covered as a scatter variant with `scaleSqrt` for point size.
  Separated here because the interaction contract (hover = expand + label)
  is distinct from scatter.

#### Funnel Chart
- D3: custom trapezoid geometry from stage values
- Three.js: stacked `ExtrudeGeometry` trapezoids
- Value: Classic marketing/sales stages chart. As a 3D funnel with real
  depth and glass materials it is visually compelling in presentations.

#### Gauge / KPI
- D3: `arc()` for the gauge arc segment
- Three.js: `ExtrudeGeometry` arc + `TextGeometry` or `TextRenderer` for
  the central value
- Value: Single-metric callout. Common in dashboards embedded in scenes as
  a "stat highlight" next to a product demo.

#### Treemap
- D3: `treemap()` layout
- Three.js: `BoxGeometry` tiles positioned on XZ plane, height proportional
  to value
- Value: Hierarchical proportional area encoding. The 3D version — tiles
  with real height — adds a second data dimension to standard treemaps.

#### Slope / Bump Chart
- D3: ordinal X scale (time periods), linear Y, line segments
- Three.js: `TubeGeometry` segments between rank positions
- Value: Before/after comparisons and ranking changes over time. Excellent
  for storytelling. Natural in 3D as parallel "threads" at different depths.

#### Waterfall Chart
- D3: band scale + cumulative offset computation
- Three.js: `BoxGeometry` per bar, colored by positive/negative delta
- Value: Business P&L and bridge charts. Sequential bars with cumulative
  carries.

#### Stacked/Grouped Bar (extended bar)
- D3: `stackOffsetNone` for stacked, `scaleBand` padding for grouped
- Three.js: variant of bar renderer
- Already partially covered by bar V1 variants. Listed explicitly here
  because the interaction contract (segment selection in stacked) is
  non-trivial.

---

### V3 / Deferred — 2D Canvas Fallback

Chart types that are inherently 2D and do not gain meaningfully from 3D
geometry. If these are required, they use **Nivo Canvas variants** rendered
to a `CanvasTexture` on a glass panel mesh — **not ECharts**.

- Candlestick / OHLC (financial)
- Box plot / violin plot (statistical)
- Sankey diagram (flow — overlaps with `@brewsite/diagram` territory)
- Word cloud (not a chart, but appears in presentations)

---

## Three.js Object Model

Every chart renders into a `ChartGroup` — a `THREE.Group` that follows the
same structural pattern as `DiagramCanvasRenderer` in the diagram package:

```
ChartGroup (THREE.Group)
├── AxesGroup     (THREE.Group)   — floor plane, axis lines, tick marks
├── SeriesGroup   (THREE.Group)   — all data geometry (bars, tubes, etc.)
│   ├── SeriesMesh[0]             — InstancedMesh or individual Mesh per series
│   └── SeriesMesh[1]
├── LabelsGroup   (THREE.Group)   — axis labels, tick labels (via TextRenderer)
├── LegendGroup   (THREE.Group)   — legend items
└── GlowSprite    (THREE.Sprite)  — optional glow halo (reused from _shared/)
```

The floor plane and axes use the same material palette as diagram elements.
`TextRenderer` from `@brewsite/diagram`'s rendering layer handles axis labels
and tick values — this is the only reason `@brewsite/charts` may need a soft
dependency on diagram's text infrastructure. **Architect should evaluate whether
`TextRenderer` belongs in `@brewsite/core` or whether `@brewsite/charts` should
re-implement it.**

---

## Widget SDK Integration

`ChartWidget` implements `IWidget`, `ISceneElement`, `IRenderable`, and
`ILoadable`. The element module pattern is mandatory:

```
packages/charts/src/elements/chart/
  types.ts          — ChartState, ChartSpec, ChartSeriesState, ChartTheme
  dsl.tsx           — <Chart>, <ChartData>, <ChartAxis>, <ChartFilter>, <ChartLegend>
  compile.ts        — pure: DSL props → ChartState (no Three.js, no React render)
  render.ts         — Three.js scene graph management; D3 math applied here
  ChartWidget.ts    — implements IWidget + IRenderable + ISceneElement + ILoadable
  index.ts          — public re-exports only
```

The `compile.ts` phase resolves:
- Chart type → renderer variant
- Theme name → `ChartTheme` token object (color palette, material presets)
- Data source name → stored as a reference; data itself is NOT baked into the
  SceneTrack — only the source name and transform config are compiled

The `render.ts` phase, on each `apply()` call:
1. Resolves the named data source from `ChartDataStore` (runtime, not compiled)
2. Applies transform pipeline to get filtered/aggregated data
3. Computes D3 scales from the data extent and chart dimensions
4. Builds or updates Three.js geometry from the scale output
5. Applies PBR materials from the resolved `ChartTheme`

---

## Theme System

`ChartTheme` is a token object parallel to `DiagramTheme`. Existing theme names
(`darkGlass`, `neonCyber`, `enterprise`, `lightMinimal`) are implemented for
charts, mapping the same design tokens into chart-specific properties:

```ts
type ChartTheme = {
  bar: {
    colors: string[];           // series color palette
    metalness: number;
    roughness: number;
    transmission: number;       // glass effect (0 = opaque, 1 = fully transparent)
    emissiveIntensity: number;
    depth: number;              // Z extrusion depth for bars, pie slices, etc.
  };
  axis: {
    lineColor: string;
    tickColor: string;
    labelColor: string;
    gridColor: string;
    gridOpacity: number;
  };
  background: {
    panelColor: string;         // floor/backdrop plane color
    panelOpacity: number;
  };
};
```

The theme is resolved at compile time and stored in `ChartState`. At render
time, `ChartWidget.apply()` passes the theme to the material factory.

---

## Module Structure

```
packages/charts/
  src/
    data/
      types.ts               — ChartDataSource<T>, ChartDimension, FilterGroup, Transform
      ChartDataStore.ts      — runtime data registry; crossfilter2 wrapper
      transforms.ts          — filter, groupby, sort, bin — pure functions
      ChartFilterContext.tsx — React context wrapping crossfilter2 instance per scene
      useChartFilter.ts      — hook: apply filter, read filter state
      useChartData.ts        — hook: resolved + transformed data for a named source
    themes/
      darkGlass.ts
      neonCyber.ts
      enterprise.ts
      lightMinimal.ts
      types.ts               — ChartTheme interface
    renderers/
      bar/
        BarRenderer.ts        — D3 scales → BoxGeometry update logic
      line/
        LineRenderer.ts       — D3 line → CatmullRomCurve3 → TubeGeometry
      area/
        AreaRenderer.ts
      pie/
        PieRenderer.ts        — D3 arc → ExtrudeGeometry
      scatter/
        ScatterRenderer.ts    — D3 scales → InstancedMesh
      heatmap/
        HeatmapRenderer.ts    — D3 band/sequential scales → InstancedMesh tiles
      shared/
        AxesRenderer.ts       — floor plane, axis lines, tick marks
        LegendRenderer.ts     — legend geometry
        ChartMaterialFactory.ts  — PBR material construction from ChartTheme
        IChartRenderer.ts     — interface all renderers implement
    elements/
      chart/
        types.ts
        dsl.tsx
        compile.ts
        render.ts
        ChartWidget.ts
        index.ts
    player/
      ChartProvider.tsx      — data registration + filter context setup
      createDefaultChartRegistry.ts
  package.json
  tsconfig.json
  vite.config.ts             — Vite library build (parallel to core)
```

---

## Key Open Questions for Architect Review

### 1. TextRenderer dependency
Axis labels and tick values require 3D text rendering. The diagram package has
`TextRenderer` (using troika-three-text or a similar solution). Three options:

**A.** Move `TextRenderer` into `@brewsite/core` as a shared primitive. Charts
and diagrams both depend on core. Cleanest long-term.

**B.** `@brewsite/charts` takes a soft peer dependency on `@brewsite/diagram`
for text rendering only. Breaks the package boundary rule (charts ↛ diagram).
Not recommended.

**C.** `@brewsite/charts` re-implements its own text rendering. Duplication, but
maintains package independence.

Recommendation: explore Option A — this is likely a good general promotion
regardless of the charts package.

### 2. Geometry update strategy for cross-filter redraws
When a crossfilter2 dimension changes, `ChartWidget.apply()` is called with
updated data. Two strategies:

**A. Full geometry rebuild** — dispose all series meshes, recreate from scratch.
Simple, always correct, but expensive for large data (hundreds of bars).

**B. Partial update via `InstancedMesh` mutations** — for instanced renderers
(scatter, heatmap), update `setMatrixAt` and `setColorAt` in-place without
rebuilding geometry. For non-instanced renderers (bar, line, pie), rebuild only
changed series meshes. More complex, significantly cheaper.

For presentation data scales (10–500 data points), option A is likely fast
enough. For larger datasets, option B is necessary. The architect should define
the threshold and whether a `lazy` prop on `<Chart>` is appropriate to opt
into the cheaper strategy.

### 3. Tooltip system
Interactive hover tooltips in Three.js require raycasting and DOM (or canvas)
overlay rendering. Three options:

**A.** Use the existing `HudOverlay` system — tooltips render as HUD elements
positioned by `LabelPositioner` projection of the hovered object's world
position. Reuses existing infrastructure.

**B.** Custom tooltip canvas — render tooltip text to a separate `CanvasTexture`
plane that appears near the hovered data point, positioned in world space.
No DOM dependency, stays fully in Three.js.

**C.** HTML overlay — absolute-positioned DOM element over the canvas, using
the same projection pattern as `LabelPositioner`. Easiest to style, but
adds DOM state management.

### 4. Interaction model for cross-filtering
When a user brushes a region on a scatter plot or clicks a bar segment to
filter, the gesture needs to be captured and translated into a crossfilter2
dimension filter. The input layer (`InputController`, `ActionInputController`)
is designed for scene navigation, not fine-grained per-object interaction.

Two models:

**A.** Charts always render interactive — raycasting is active whenever the
engine is not in scroll-driven mode. Brush selection uses a custom
`IAnimationController` that tracks pointer state and emits filter events.

**B.** Charts have an explicit `interactive` prop. When `false` (default in
scroll-driven presentations), charts are pure render objects. When `true`,
the widget activates its raycasting and brush interaction controllers.

Option B is preferred. It keeps scroll-driven presentations performant (no
raycasting every frame) and makes the interactive mode explicit in the DSL.

### 5. Time-series heatmap animation
The user noted that a heatmap with a time dimension can be animated to show
how the data evolves — making it a 5D visualization (X, Y, color, height,
time). This maps naturally to the BrewSite progress model: as `blockProgress`
advances, the displayed time slice advances.

This requires the compiler to bake a sequence of `HeatmapState` frames (one
per time step) into the SceneTrack, similar to how model animation clips are
compiled. The architect should define whether:

**A.** The time-slice data sequence is baked into the SceneTrack at compile
time (requires all data to be known at build time; named source must resolve
synchronously during compilation).

**B.** The time-slice interpolation happens at runtime in the widget's
`IAnimationController.onTick()` — the widget selects which time slice to
display based on `blockProgress`, pulling from the `ChartDataStore` at runtime.

Option B is more flexible and consistent with how named data sources work.

---

## What Is Explicitly Out of Scope

- Server-side rendering of charts
- Real-time streaming data (data is static per scene session)
- Chart export (PNG, SVG, PDF)
- Sankey / flow diagrams (covered by `@brewsite/diagram` edge routing)
- ECharts as a dependency (eliminated; see reasoning above)
- DuckDB-wasm (overkill for presentation data scales)
- Arquero (overkill; crossfilter2 covers the filtering use case at 18× less bundle)
- Cross-scene filtering (filter state is scoped to one scene only)

---

## Licensing Summary

All direct dependencies are permissive and compatible with open-source publishing:

| Dependency | License |
|---|---|
| d3-scale, d3-shape, d3-array, d3-format, d3-time-format | ISC |
| crossfilter2 | Apache-2.0 |
| (If Nivo Canvas added in V3) @nivo/\* | MIT |

No GPL, LGPL, or AGPL in the dependency tree.
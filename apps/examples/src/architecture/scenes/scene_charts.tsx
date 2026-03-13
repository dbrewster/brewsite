import type {JSX} from 'react';
import {
    Ambient,
    Camera,
    Directional,
    Lighting,
    ProgressManager,
    Scene,
    TextBox,
} from '@brewsite/core';
import {
    darkGlassTheme,
    Diagram,
    DiagramEdge,
    DiagramGroup,
    DiagramNode,
    ManualLayout,
} from '@brewsite/diagram';
import {MidFade, ScrollOn} from '@brewsite/core/hud/animejs';

const angledFn = (t: number): number => (t < 0.5 ? 0 : (t - 0.5) / 0.5);

function makeChartsCanvasDiagram(tilt: number, scale: number): JSX.Element {
  return (
    <Diagram id="arch-content" x={0} y={0} w={1} h={1} tilt={tilt} scale={scale} theme={darkGlassTheme}>
      <ManualLayout />

      {/* ── COLUMN 1: Author (DSL) ── */}
      <DiagramGroup id="dsl-group" label="Author (DSL) · chart declarations + data binding" variant="boundary">
        <DiagramNode
          id="dsl-provider"
          label="<ChartProvider>"
          sublabel="React context root · wires IFilterEngine + data source"
          sublabelColor="#b8c8e8"
          icon="ui:server"
          position={[0.109, 0.276, 0]}
          size={[0.152, 0.103]}
        />
        <DiagramNode
          id="dsl-chart"
          label={'<Chart chartType="bar">'}
          sublabel="type · data array · series config · axis config"
          sublabelColor="#b8c8e8"
          icon="ui:chart-bar"
          position={[0.109, 0.436, 0]}
          size={[0.152, 0.103]}
        />
        <DiagramNode
          id="dsl-sources"
          label="named data sources"
          sublabel="source id · filter · group · sort pipeline config"
          sublabelColor="#b8c8e8"
          icon="ui:circle-stack"
          position={[0.109, 0.596, 0]}
          size={[0.152, 0.103]}
        />
        <DiagramNode
          id="dsl-crossfilter"
          label="cross-filter"
          sublabel="brush selection → re-filters all linked chart compilations"
          sublabelColor="#b8c8e8"
          icon="ui:funnel"
          position={[0.109, 0.756, 0]}
          size={[0.152, 0.103]}
        />
      </DiagramGroup>

      {/* ── COLUMN 2: Compile (compiler/) ── */}
      <DiagramGroup id="compile-group" label="Compile (compiler/) · pure data transforms, no render loop" variant="swimlane">
        <DiagramNode
          id="cmp-compile"
          label="compile.ts"
          sublabel="pure: Chart props + filtered dataset → ChartState (SeriesPoint[])"
          sublabelColor="#b8c8e8"
          icon="ui:code-bracket-square"
          position={[0.370, 0.260, 0]}
          size={[0.163, 0.103]}
        />
        <DiagramNode
          id="cmp-transforms"
          label="transforms.ts"
          sublabel="filter → aggregate → sort → group pipeline · runs before snapshot"
          sublabelColor="#b8c8e8"
          icon="ui:arrows-right-left"
          position={[0.370, 0.420, 0]}
          size={[0.163, 0.103]}
        />
        <DiagramNode
          id="cmp-filter"
          label="IFilterEngine"
          sublabel="cross-filter contract · brush/link interface"
          sublabelColor="#b8c8e8"
          icon="ui:funnel"
          position={[0.370, 0.580, 0]}
          size={[0.163, 0.103]}
        />
        <DiagramNode
          id="cmp-simple-filter"
          label="SimpleFilterEngine"
          sublabel="default impl · brush ranges + linked chart update propagation"
          sublabelColor="#b8c8e8"
          icon="ui:adjustments-horizontal"
          position={[0.370, 0.740, 0]}
          size={[0.163, 0.103]}
        />
      </DiagramGroup>

      {/* ── COLUMN 3: Renderers (renderers/) ── */}
      <DiagramGroup id="renderers-group" label="Renderers (renderers/) · IChartRenderer · dispatched by chartType" variant="cluster">
        <DiagramNode
          id="rnd-bar"
          label="BarRenderer"
          sublabel="InstancedMesh of BoxGeometry · shadow cast · per-bar color"
          sublabelColor="#b8c8e8"
          icon="ui:chart-bar"
          position={[0.630, 0.100, 0]}
          size={[0.163, 0.103]}
        />
        <DiagramNode
          id="rnd-line"
          label="LineRenderer"
          sublabel="CatmullRomCurve3 → TubeGeometry · configurable tension"
          sublabelColor="#b8c8e8"
          icon="ui:presentation-chart-line"
          position={[0.630, 0.260, 0]}
          size={[0.163, 0.103]}
        />
        <DiagramNode
          id="rnd-area"
          label="AreaRenderer"
          sublabel="filled ribbon mesh · translucent PBR material"
          sublabelColor="#b8c8e8"
          icon="ui:presentation-chart-bar"
          position={[0.630, 0.420, 0]}
          size={[0.163, 0.103]}
        />
        <DiagramNode
          id="rnd-pie"
          label="PieRenderer"
          sublabel="LatheGeometry per slice · IBL env reflection"
          sublabelColor="#b8c8e8"
          icon="ui:chart-pie"
          position={[0.630, 0.580, 0]}
          size={[0.163, 0.103]}
        />
        <DiagramNode
          id="rnd-scatter"
          label="ScatterRenderer"
          sublabel="InstancedMesh of SphereGeometry · color per data point"
          sublabelColor="#b8c8e8"
          icon="ui:adjustments-horizontal"
          position={[0.630, 0.740, 0]}
          size={[0.163, 0.103]}
        />
        <DiagramNode
          id="rnd-heatmap"
          label="HeatmapRenderer"
          sublabel="PlaneGeometry · vertex color + height map"
          sublabelColor="#b8c8e8"
          icon="ui:squares-2x2"
          position={[0.630, 0.901, 0]}
          size={[0.163, 0.103]}
        />
      </DiagramGroup>

      {/* ── COLUMN 4: Output ── */}
      <DiagramGroup id="output-group" label="Output (ChartWidget) · ISceneElement + IRenderable" variant="boundary">
        <DiagramNode
          id="out-widget"
          label="ChartWidget"
          sublabel="dispatches to IChartRenderer by chartType · apply() per frame"
          sublabelColor="#b8c8e8"
          icon="ui:puzzle-piece"
          position={[0.891, 0.276, 0]}
          size={[0.152, 0.103]}
          color="#1a3060"
          glow={{ intensity: 0.2 }}
        />
        <DiagramNode
          id="out-axes"
          label="AxesRenderer"
          sublabel="shared tick geometry · axis labels · linear/log scale"
          sublabelColor="#b8c8e8"
          icon="ui:chart-bar-square"
          position={[0.891, 0.436, 0]}
          size={[0.152, 0.103]}
        />
        <DiagramNode
          id="out-tooltip"
          label="ChartTooltipOverlay"
          sublabel="Three.js raycasting → React DOM tooltip via EngineOverlayHost"
          sublabelColor="#b8c8e8"
          icon="ui:magnifying-glass"
          position={[0.891, 0.596, 0]}
          size={[0.152, 0.103]}
        />
        <DiagramNode
          id="out-material"
          label="ChartMaterialFactory"
          sublabel="PBR materials · shared theme palette · metalness/roughness"
          sublabelColor="#b8c8e8"
          icon="ui:swatch"
          position={[0.891, 0.756, 0]}
          size={[0.152, 0.103]}
        />
      </DiagramGroup>

      {/* ── Spine: DSL → compiled → widget → renderers → output ── */}
      <DiagramEdge from="dsl-chart" to="cmp-compile" label="props + data" flow="forward" />
      <DiagramEdge from="cmp-transforms" to="cmp-compile" label="filtered + aggregated" style="dashed" />
      <DiagramEdge from="cmp-compile" to="out-widget" label="ChartState" flow="forward" />
      <DiagramEdge from="out-widget" to="rnd-bar" label="dispatch by chartType" flow="forward" />
      <DiagramEdge from="out-widget" to="rnd-pie" flow="forward" />
      <DiagramEdge from="out-widget" to="rnd-scatter" flow="forward" />

      {/* ── Supporting edges ── */}
      <DiagramEdge from="dsl-provider" to="cmp-filter" label="React context" style="dashed" />
      <DiagramEdge from="dsl-sources" to="cmp-transforms" label="source config" style="dashed" />
      <DiagramEdge from="dsl-crossfilter" to="cmp-filter" flow="forward" />
      <DiagramEdge from="cmp-filter" to="cmp-simple-filter" label="implements" style="dashed" />
      <DiagramEdge from="cmp-filter" to="cmp-transforms" label="active filters" flow="forward" />
      <DiagramEdge from="out-axes" to="rnd-bar" label="shared" style="dashed" arrowEnd="open" />
      <DiagramEdge from="out-axes" to="rnd-line" style="dashed" arrowEnd="open" />
      <DiagramEdge from="out-material" to="rnd-bar" label="PBR params" style="dashed" arrowEnd="open" />
    </Diagram>
  );
}

// ── Scene 1 of 2: Angled view ──────────────────────────────────────────────
export const SceneChartsAngledArch = () => (
  <Scene id="arch-charts-angled">
    <ProgressManager scrollUnits={2000} fn={angledFn} />
    <Camera
      mode="world"
      position={[0, 35, 45]}
      target={[0, 0, 0]}
      fov={54}
    />
    <Lighting intensityScale={1}>
      <Ambient intensity={1.0} color="#ffffff" />
      <Directional intensity={0.6} color="#aaccff" position={[0, 20, 30]} />
      <Directional intensity={0.35} color="#ff9944" position={[20, 5, 15]} />
    </Lighting>
    {makeChartsCanvasDiagram(-Math.PI / 4, 1.05)}
  </Scene>
);

// ── Scene 2 of 2: Head-on view with teaching overlay ──────────────────────
export const SceneChartsArch = () => (
  <Scene id="arch-charts" exitStart={0.9}>
    <ProgressManager scrollUnits={3000} />
    <Camera
      mode="world"
      position={[0, 4, 60]}
      target={[0, 0, 0]}
      fov={54}
    />
    {makeChartsCanvasDiagram(-Math.PI / 10, 1.05)}

    {/* Teaching overlay */}
    <TextBox id="charts-teaching" x={0.53} y={0.52} w={0.44} h={0.45}>
      <div style={{
        padding: '32px 40px',
        background: 'rgba(3,5,8,0.85)',
        backdropFilter: 'blur(20px)',
        borderRadius: '4px',
        height: '100%',
        textAlign: 'right',
      }}>
        <MidFade duration={1200}>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '12px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase' as const,
            color: 'rgba(130, 100, 255, 0.8)',
            marginBottom: 10,
          }}>
            @brewsite/charts
          </div>
          <h1 style={{
            fontSize: '48px',
            fontWeight: 600,
            color: '#f0f6fc',
            lineHeight: 1.2,
            margin: '0 0 16px',
          }}>
            Data transforms at compile time.<br />Renderers receive pre-aggregated state.
          </h1>
        </MidFade>
        <ScrollOn duration={900} delay={150}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px 18px',
            marginBottom: 14,
          }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{
                fontSize: '16px',
                fontWeight: 700,
                color: 'rgba(130, 100, 255, 0.7)',
                marginBottom: 5,
              }}>
                Author / DSL
              </div>
              <div style={{
                fontSize: '15px',
                color: 'rgba(240, 246, 252, 0.6)',
                lineHeight: 1.6,
              }}>
                {'<ChartProvider> wraps the app and wires the data context via React. <Chart chartType="bar"> declares a chart with its type, data, and series config. Named sources declare filter, group, and sort rules. Cross-filter declarations link brushing so a selection in one chart re-filters all linked charts.'}
              </div>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{
                fontSize: '16px',
                fontWeight: 700,
                color: 'rgba(100, 160, 255, 0.7)',
                marginBottom: 5,
              }}>
                Compile
              </div>
              <div style={{
                fontSize: '15px',
                color: 'rgba(240, 246, 252, 0.6)',
                lineHeight: 1.6,
              }}>
                compile.ts is pure: Chart props + current filtered dataset → ChartState with fully pre-aggregated series data. transforms.ts runs filter, aggregate, sort, and group operations before the snapshot. IFilterEngine is the cross-filter contract; SimpleFilterEngine is the default. All data processing happens here — zero transforms in the render loop.
              </div>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{
                fontSize: '16px',
                fontWeight: 700,
                color: 'rgba(100, 200, 160, 0.7)',
                marginBottom: 5,
              }}>
                Renderers
              </div>
              <div style={{
                fontSize: '15px',
                color: 'rgba(240, 246, 252, 0.6)',
                lineHeight: 1.6,
              }}>
                ChartWidget dispatches to a specific IChartRenderer based on chartType. Each renderer builds Three.js geometry from pre-aggregated ChartState: BarRenderer uses instanced box geometry; LineRenderer uses CatmullRom tube geometry; PieRenderer uses lathe geometry. AxesRenderer is shared — it generates tick geometry independently of chart type.
              </div>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{
                fontSize: '16px',
                fontWeight: 700,
                color: 'rgba(130, 100, 255, 0.7)',
                marginBottom: 5,
              }}>
                Output
              </div>
              <div style={{
                fontSize: '15px',
                color: 'rgba(240, 246, 252, 0.6)',
                lineHeight: 1.6,
              }}>
                ChartWidget implements ISceneElement + IRenderable. ChartMaterialFactory produces PBR materials from a shared theme spec. ChartTooltipOverlay is a React component via EngineOverlayHost — hit detection runs in Three.js, the tooltip HTML is plain React. Cross-filter brushing updates IFilterEngine, triggering recompilation of dependent ChartState objects.
              </div>
            </div>
          </div>
          <div style={{
            borderRight: '2px solid rgba(130, 100, 255, 0.5)',
            paddingRight: 12,
            fontSize: '14px',
            color: 'rgba(240, 246, 252, 0.85)',
            lineHeight: 1.6,
            fontStyle: 'italic',
            textAlign: 'right',
          }}>
            <strong>Key insight:</strong> All data aggregation runs at compile time. Renderers receive flat SeriesPoint[] arrays — they never filter, sort, or group data during the frame loop.
          </div>
        </ScrollOn>
      </div>
    </TextBox>
  </Scene>
);

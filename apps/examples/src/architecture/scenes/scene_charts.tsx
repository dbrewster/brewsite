import type { JSX } from 'react';
import {
  Scene,
  Camera,
  Lighting,
  Ambient,
  Directional,
  ProgressManager,
} from '@brewsite/core';
import {
  DiagramCanvas,
  Diagram,
  DiagramNode,
  DiagramEdge,
  DiagramGroup,
  ManualLayout,
  darkGlassTheme,
} from '@brewsite/diagram';
import { MidFade, ScrollOn } from '@brewsite/core/hud/animejs';

const LATE_FADE = {
  exit: [1.0, 1.0] as [number, number],
  enter: [1.0, 1.0] as [number, number],
};

export const sceneChartsArch: JSX.Element = (
  <Scene id="arch-charts" transition={LATE_FADE}>
    <ProgressManager
      scrollUnits={3000}
      autoAdvance={{ duration: 10, max: 0.88, pauseOnScroll: true }}
    />
    <Camera
      mode="world"
      position={[0, 4, 60]}
      target={[0, 0, 0]}
      fov={54}
    />
    <Lighting intensityScale={1}>
      <Ambient intensity={1.0} color="#ffffff" />
      <Directional intensity={0.6} color="#aaccff" position={[0, 20, 30]} />
      <Directional intensity={0.35} color="#ff9944" position={[20, 5, 15]} />
    </Lighting>

    <DiagramCanvas
      id="arch-charts-canvas"
      rotation={[-Math.PI / 10, 0, 0]}
      scale={1.05}
      theme={darkGlassTheme}
    >
      <Diagram id="charts-arch" pivot="center">
        <ManualLayout />

        {/* ── COLUMN 1: Author (DSL) ── */}
        <DiagramGroup id="dsl-group" label="Author (DSL)" variant="boundary">
          <DiagramNode
            id="dsl-provider"
            label="<ChartProvider>"
            sublabel="wraps app · wires data context"
            icon="ui:server"
            position={[-13, 5.5, 0]}
            size={[5.2, 2]}
          />
          <DiagramNode
            id="dsl-chart"
            label={'<Chart chartType="bar">'}
            sublabel="type · data · series"
            icon="ui:chart-bar"
            position={[-13, 1.5, 0]}
            size={[5.2, 2]}
          />
          <DiagramNode
            id="dsl-sources"
            label="named sources"
            sublabel="filter · group · sort config"
            icon="ui:circle-stack"
            position={[-13, -2.5, 0]}
            size={[5.2, 2]}
          />
          <DiagramNode
            id="dsl-crossfilter"
            label="cross-filter"
            sublabel="brush link across charts"
            icon="ui:funnel"
            position={[-13, -6.5, 0]}
            size={[5.2, 2]}
          />
        </DiagramGroup>

        {/* ── COLUMN 2: Compile (compiler/) ── */}
        <DiagramGroup id="compile-group" label="Compile (compiler/)" variant="swimlane">
          <DiagramNode
            id="cmp-compile"
            label="compile.ts"
            sublabel="pure: props + data → ChartState"
            icon="ui:code-bracket-square"
            position={[-4.5, 6, 0]}
            size={[5.5, 2]}
          />
          <DiagramNode
            id="cmp-transforms"
            label="transforms.ts"
            sublabel="filter · aggregate · sort · group"
            icon="ui:arrows-right-left"
            position={[-4.5, 2, 0]}
            size={[5.5, 2]}
          />
          <DiagramNode
            id="cmp-filter"
            label="IFilterEngine"
            sublabel="cross-filter contract"
            icon="ui:funnel"
            position={[-4.5, -2, 0]}
            size={[5.5, 2]}
          />
          <DiagramNode
            id="cmp-simple-filter"
            label="SimpleFilterEngine"
            sublabel="default brush / link impl"
            icon="ui:adjustments-horizontal"
            position={[-4.5, -6, 0]}
            size={[5.5, 2]}
          />
        </DiagramGroup>

        {/* ── COLUMN 3: Renderers (renderers/) ── */}
        <DiagramGroup id="renderers-group" label="Renderers (renderers/)" variant="cluster">
          <DiagramNode
            id="rnd-bar"
            label="BarRenderer"
            sublabel="instanced box geometry · shadow"
            icon="ui:chart-bar"
            position={[4.5, 8, 0]}
            size={[5.5, 2]}
          />
          <DiagramNode
            id="rnd-line"
            label="LineRenderer"
            sublabel="CatmullRom tube geometry"
            icon="ui:presentation-chart-line"
            position={[4.5, 5, 0]}
            size={[5.5, 2]}
          />
          <DiagramNode
            id="rnd-area"
            label="AreaRenderer"
            sublabel="translucent ribbon mesh"
            icon="ui:presentation-chart-bar"
            position={[4.5, 2, 0]}
            size={[5.5, 2]}
          />
          <DiagramNode
            id="rnd-pie"
            label="PieRenderer"
            sublabel="lathe geometry · env reflection"
            icon="ui:chart-pie"
            position={[4.5, -1, 0]}
            size={[5.5, 2]}
          />
          <DiagramNode
            id="rnd-scatter"
            label="ScatterRenderer"
            sublabel="instanced sphere cloud"
            icon="ui:adjustments-horizontal"
            position={[4.5, -4, 0]}
            size={[5.5, 2]}
          />
          <DiagramNode
            id="rnd-heatmap"
            label="HeatmapRenderer"
            sublabel="height + color grid"
            icon="ui:squares-2x2"
            position={[4.5, -7, 0]}
            size={[5.5, 2]}
          />
        </DiagramGroup>

        {/* ── COLUMN 4: Output ── */}
        <DiagramGroup id="output-group" label="Output" variant="boundary">
          <DiagramNode
            id="out-widget"
            label="ChartWidget"
            sublabel="ISceneElement + IRenderable"
            icon="ui:puzzle-piece"
            position={[13, 5.5, 0]}
            size={[5, 2]}
            color="#1a3060"
            glow={{ intensity: 0.2 }}
          />
          <DiagramNode
            id="out-axes"
            label="AxesRenderer"
            sublabel="shared tick + label geometry"
            icon="ui:chart-bar-square"
            position={[13, 1.5, 0]}
            size={[5, 2]}
          />
          <DiagramNode
            id="out-tooltip"
            label="ChartTooltipOverlay"
            sublabel="React hover via EngineOverlayHost"
            icon="ui:magnifying-glass"
            position={[13, -2.5, 0]}
            size={[5, 2]}
          />
          <DiagramNode
            id="out-material"
            label="ChartMaterialFactory"
            sublabel="PBR materials · themes"
            icon="ui:swatch"
            position={[13, -6.5, 0]}
            size={[5, 2]}
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
    </DiagramCanvas>

    {/* Overlay */}
    <div style={{
      position: 'absolute',
      bottom: '10%',
      right: '5%',
      maxWidth: 400,
      textAlign: 'right',
    }}>
      <MidFade duration={1200}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          letterSpacing: '0.3em',
          textTransform: 'uppercase' as const,
          color: 'rgba(130, 100, 255, 0.8)',
          marginBottom: 10,
        }}>
          @brewsite/charts
        </div>
        <div style={{
          fontSize: 'clamp(20px, 3vw, 26px)',
          fontWeight: 600,
          color: '#f0f6fc',
          lineHeight: 1.2,
          marginBottom: 14,
        }}>
          Data transforms at compile time.<br />Renderers receive pre-aggregated state.
        </div>
      </MidFade>
      <ScrollOn duration={900} delay={150}>
        <div style={{
          fontSize: 'clamp(13px, 1.6vw, 14px)',
          color: 'rgba(240, 246, 252, 0.6)',
          lineHeight: 1.65,
        }}>
          No data processing in the render loop.
          ChartWidget dispatches to IChartRenderer by chartType.
          Cross-filter brushing links charts through IFilterEngine.
        </div>
      </ScrollOn>
    </div>
  </Scene>
);

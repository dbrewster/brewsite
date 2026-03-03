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

export const sceneDiagramArch: JSX.Element = (
  <Scene id="arch-diagram" transition={LATE_FADE}>
    <ProgressManager
      scrollUnits={3000}
      autoAdvance={{ duration: 10, max: 0.88, pauseOnScroll: true }}
    />
    <Camera
      mode="world"
      position={[0, 4, 58]}
      target={[0, 0, 0]}
      fov={54}
    />
    <Lighting intensityScale={1}>
      <Ambient intensity={1.1} color="#ffffff" />
      <Directional intensity={0.5} color="#aaccff" position={[0, 20, 30]} />
      <Directional intensity={0.4} color="#9966ff" position={[-20, 10, 10]} />
    </Lighting>

    <DiagramCanvas
      id="arch-diagram-canvas"
      rotation={[-Math.PI / 10, 0, 0]}
      scale={1.1}
      theme={darkGlassTheme}
    >
      <Diagram id="diagram-arch" pivot="center">
        <ManualLayout />

        {/* ── COLUMN 1: Author (DSL) ── */}
        <DiagramGroup id="dsl-group" label="Author (DSL)" variant="boundary">
          <DiagramNode
            id="dsl-canvas"
            label="<DiagramCanvas>"
            sublabel="orthographic scene · theme"
            icon="ui:squares-2x2"
            position={[-13, 7, 0]}
            size={[5.2, 2]}
          />
          <DiagramNode
            id="dsl-diagram"
            label="<Diagram>"
            sublabel="pivot · layout root"
            icon="ui:document-text"
            position={[-13, 3.5, 0]}
            size={[5.2, 2]}
          />
          <DiagramNode
            id="dsl-node"
            label="<DiagramNode>"
            sublabel="label · icon · position · size"
            icon="ui:squares-2x2"
            position={[-13, 0, 0]}
            size={[5.2, 2]}
          />
          <DiagramNode
            id="dsl-edge"
            label="<DiagramEdge>"
            sublabel="from · to · flow · style"
            icon="ui:arrows-right-left"
            position={[-13, -3.5, 0]}
            size={[5.2, 2]}
          />
          <DiagramNode
            id="dsl-group-node"
            label="<DiagramGroup>"
            sublabel="boundary · swimlane · cluster"
            icon="ui:squares-plus"
            position={[-13, -7, 0]}
            size={[5.2, 2]}
          />
        </DiagramGroup>

        {/* ── COLUMN 2: Compile (compiler/) ── */}
        <DiagramGroup id="compile-group" label="Compile (compiler/)" variant="swimlane">
          <DiagramNode
            id="cmp-node"
            label="nodeCompiler"
            sublabel="props → resolved positions + sizes"
            icon="ui:adjustments-horizontal"
            position={[-4.5, 7, 0]}
            size={[5.5, 2]}
          />
          <DiagramNode
            id="cmp-layout"
            label="layoutResolver"
            sublabel="algorithm dispatch (hierarchical/grid)"
            icon="ui:squares-plus"
            position={[-4.5, 3.5, 0]}
            size={[5.5, 2]}
          />
          <DiagramNode
            id="cmp-edge-router"
            label="edgeRouter"
            sublabel="curveKernel + pipe routing"
            icon="ui:arrows-pointing-out"
            position={[-4.5, 0, 0]}
            size={[5.5, 2]}
          />
          <DiagramNode
            id="cmp-theme"
            label="themeResolver"
            sublabel="per-node overrides → material params"
            icon="ui:swatch"
            position={[-4.5, -3.5, 0]}
            size={[5.5, 2]}
          />
          <DiagramNode
            id="cmp-transition"
            label="transitionHelpers"
            sublabel="FunctionalTransitionSpec closures"
            icon="ui:sparkles"
            position={[-4.5, -7, 0]}
            size={[5.5, 2]}
          />
        </DiagramGroup>

        {/* ── COLUMN 3: Renderers (rendering/) ── */}
        <DiagramGroup id="renderers-group" label="Renderers (rendering/)" variant="cluster">
          <DiagramNode
            id="rnd-node"
            label="NodeRenderer"
            sublabel="PBR mesh · corner radius · glow"
            icon="ui:puzzle-piece"
            position={[4.5, 7, 0]}
            size={[5.5, 2]}
          />
          <DiagramNode
            id="rnd-edge"
            label="EdgeRenderer"
            sublabel="tube geometry · animated flow"
            icon="ui:arrows-right-left"
            position={[4.5, 3.5, 0]}
            size={[5.5, 2]}
          />
          <DiagramNode
            id="rnd-group"
            label="GroupRenderer"
            sublabel="boundary and swimlane panels"
            icon="ui:squares-plus"
            position={[4.5, 0, 0]}
            size={[5.5, 2]}
          />
          <DiagramNode
            id="rnd-text"
            label="TextRenderer"
            sublabel="troika-three-text SDF labels"
            icon="ui:chat-bubble-left-right"
            position={[4.5, -3.5, 0]}
            size={[5.5, 2]}
          />
          <DiagramNode
            id="rnd-icon"
            label="IconLoader"
            sublabel="extruded SVG · 2D sprite icons"
            icon="ui:photo"
            position={[4.5, -7, 0]}
            size={[5.5, 2]}
          />
        </DiagramGroup>

        {/* ── COLUMN 4: Output ── */}
        <DiagramGroup id="output-group" label="Output" variant="boundary">
          <DiagramNode
            id="out-widget"
            label="DiagramWidget"
            sublabel="ISceneElement + IRenderable + ILoadable"
            icon="ui:puzzle-piece"
            position={[13, 5, 0]}
            size={[5.2, 2]}
            color="#1a3060"
            glow={{ intensity: 0.2 }}
          />
          <DiagramNode
            id="out-envmap"
            label="EnvMapManager"
            sublabel="Radiance HDR env map"
            icon="ui:globe-alt"
            position={[13, 1, 0]}
            size={[5.2, 2]}
          />
          <DiagramNode
            id="out-scene"
            label="DiagramCanvas scene"
            sublabel="Three.js OrthographicCamera"
            icon="ui:squares-2x2"
            position={[13, -3, 0]}
            size={[5.2, 2]}
          />
        </DiagramGroup>

        {/* ── Spine: DSL → compiler → renderers → output ── */}
        <DiagramEdge from="dsl-node" to="cmp-node" label="props" flow="forward" />
        <DiagramEdge from="dsl-edge" to="cmp-edge-router" flow="forward" />
        <DiagramEdge from="cmp-layout" to="cmp-node" label="resolved positions" style="dashed" />
        <DiagramEdge from="cmp-edge-router" to="rnd-edge" label="path geometry" flow="forward" />
        <DiagramEdge from="out-widget" to="rnd-node" label="apply()" flow="forward" />
        <DiagramEdge from="out-widget" to="rnd-edge" flow="forward" />
        <DiagramEdge from="out-widget" to="rnd-group" flow="forward" />

        {/* ── Supporting edges ── */}
        <DiagramEdge from="dsl-canvas" to="cmp-layout" label="layout spec" style="dashed" />
        <DiagramEdge from="dsl-group-node" to="cmp-node" style="dashed" />
        <DiagramEdge from="cmp-node" to="cmp-edge-router" label="anchor points" style="dashed" />
        <DiagramEdge from="cmp-theme" to="rnd-node" label="material params" style="dashed" />
        <DiagramEdge from="out-envmap" to="rnd-node" label="IBL env map" style="dashed" arrowEnd="open" />
        <DiagramEdge from="out-scene" to="out-widget" style="dashed" arrowEnd="open" />
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
          @brewsite/diagram
        </div>
        <div style={{
          fontSize: 'clamp(20px, 3vw, 26px)',
          fontWeight: 600,
          color: '#f0f6fc',
          lineHeight: 1.2,
          marginBottom: 14,
        }}>
          DSL props → pure compile<br />→ Three.js renderers.
        </div>
      </MidFade>
      <ScrollOn duration={900} delay={150}>
        <div style={{
          fontSize: 'clamp(13px, 1.6vw, 14px)',
          color: 'rgba(240, 246, 252, 0.6)',
          lineHeight: 1.65,
        }}>
          No imperative mutation in the render loop.
          Layout, routing, and theming are pure functions.
          Renderers receive compiled state and apply it to Three.js.
        </div>
      </ScrollOn>
    </div>
  </Scene>
);

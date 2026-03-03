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

export const sceneCoreArch: JSX.Element = (
  <Scene id="arch-core" transition={LATE_FADE}>
    <ProgressManager
      scrollUnits={3000}
      autoAdvance={{ duration: 10, max: 0.88, pauseOnScroll: true }}
    />
    <Camera
      mode="world"
      position={[0, 4, 56]}
      target={[0, 0, 0]}
      fov={54}
    />
    <Lighting intensityScale={1}>
      <Ambient intensity={1.0} color="#ffffff" />
      <Directional intensity={0.6} color="#aaccff" position={[0, 20, 30]} />
      <Directional intensity={0.3} color="#6677ff" position={[-15, 5, 10]} />
    </Lighting>

    <DiagramCanvas
      id="arch-core-canvas"
      rotation={[-Math.PI / 10, 0, 0]}
      scale={1.1}
      theme={darkGlassTheme}
    >
      <Diagram id="core-arch" pivot="center">
        <ManualLayout />

        {/* ── COLUMN 1: Author (DSL) ── */}
        <DiagramGroup id="dsl-group" label="Author (DSL)" variant="boundary">
          <DiagramNode
            id="dsl-scene"
            label="<Scene>"
            sublabel="transition spec · scene id"
            icon="ui:document-text"
            position={[-13, 7, 0]}
            size={[5, 2]}
          />
          <DiagramNode
            id="dsl-camera"
            label="<Camera>"
            sublabel="position · fov · orbit mode"
            icon="ui:photo"
            position={[-13, 3.5, 0]}
            size={[5, 2]}
          />
          <DiagramNode
            id="dsl-lighting"
            label="<Lighting>"
            sublabel="ambient · directional lights"
            icon="ui:bolt"
            position={[-13, 0, 0]}
            size={[5, 2]}
          />
          <DiagramNode
            id="dsl-background"
            label="<Background>"
            sublabel="color · gradient · CSS"
            icon="ui:swatch"
            position={[-13, -3.5, 0]}
            size={[5, 2]}
          />
          <DiagramNode
            id="dsl-progress"
            label="<ProgressManager>"
            sublabel="scroll units · auto-advance"
            icon="ui:adjustments-horizontal"
            position={[-13, -7, 0]}
            size={[5, 2]}
          />
        </DiagramGroup>

        {/* ── COLUMN 2: Compile (compiler/) ── */}
        <DiagramGroup id="compile-group" label="Compile (compiler/)" variant="swimlane">
          <DiagramNode
            id="comp-dsl"
            label="sceneDslCompiler"
            sublabel="JSX tree → SceneFrame[]"
            icon="ui:code-bracket-square"
            position={[-4.5, 5.5, 0]}
            size={[5.5, 2]}
          />
          <DiagramNode
            id="comp-handler"
            label="NodeHandler registry"
            sublabel="component → compile fn"
            icon="ui:squares-plus"
            position={[-4.5, 1.5, 0]}
            size={[5.5, 2]}
          />
          <DiagramNode
            id="comp-track"
            label="sceneTrackCompiler"
            sublabel="SceneFrame[] → SceneTrack"
            icon="ui:arrows-right-left"
            position={[-4.5, -2, 0]}
            size={[5.5, 2]}
          />
          <DiagramNode
            id="comp-scenetrack"
            label="SceneTrack"
            sublabel="pre-baked tick[] · O(1) sample"
            icon="ui:circle-stack"
            position={[-4.5, -5.5, 0]}
            size={[5.5, 2]}
            color="#1a3060"
            glow={{ intensity: 0.2 }}
          />
        </DiagramGroup>

        {/* ── COLUMN 3: Execute (runtime/) ── */}
        <DiagramGroup id="runtime-group" label="Execute (runtime/)" variant="cluster">
          <DiagramNode
            id="rt-loop"
            label="RuntimeLoop"
            sublabel="requestAnimationFrame driver"
            icon="ui:arrow-path"
            position={[4.5, 5.5, 0]}
            size={[5.5, 2]}
          />
          <DiagramNode
            id="rt-driver"
            label="RuntimeDriverImpl"
            sublabel="samples SceneTrack each frame"
            icon="ui:cpu-chip"
            position={[4.5, 1.5, 0]}
            size={[5.5, 2]}
          />
          <DiagramNode
            id="rt-sampler"
            label="sceneTrackSampler"
            sublabel="progress → WidgetState"
            icon="ui:funnel"
            position={[4.5, -2, 0]}
            size={[5.5, 2]}
          />
          <DiagramNode
            id="rt-registry"
            label="WidgetRegistry"
            sublabel="widgetId → IWidget.apply()"
            icon="ui:puzzle-piece"
            position={[4.5, -5.5, 0]}
            size={[5.5, 2]}
          />
        </DiagramGroup>

        {/* ── COLUMN 4: Output (player/) ── */}
        <DiagramGroup id="output-group" label="Output (player/)" variant="boundary">
          <DiagramNode
            id="out-canvas"
            label="SceneCanvas"
            sublabel="WebGL · Three.js renderer"
            icon="ui:photo"
            position={[13, 4, 0]}
            size={[5, 2]}
          />
          <DiagramNode
            id="out-overlay"
            label="EngineOverlayHost"
            sublabel="React HUD tree over canvas"
            icon="ui:chat-bubble-left-right"
            position={[13, 0, 0]}
            size={[5, 2]}
          />
          <DiagramNode
            id="out-input"
            label="EngineInputRegion"
            sublabel="scroll spacer · sticky view"
            icon="ui:arrows-pointing-out"
            position={[13, -4, 0]}
            size={[5, 2]}
          />
        </DiagramGroup>

        {/* ── Spine: main signal path left → right ── */}
        <DiagramEdge from="dsl-scene" to="comp-dsl" label="JSX tree" flow="forward" />
        <DiagramEdge from="dsl-camera" to="comp-dsl" flow="forward" />
        <DiagramEdge from="dsl-lighting" to="comp-dsl" flow="forward" />
        <DiagramEdge from="comp-track" to="comp-scenetrack" label="baked tick[]" flow="forward" />
        <DiagramEdge from="comp-scenetrack" to="rt-driver" label="sampled each frame" flow="forward" />
        <DiagramEdge from="rt-registry" to="out-canvas" label="IRenderable.apply()" flow="forward" />

        {/* ── Supporting edges ── */}
        <DiagramEdge from="comp-dsl" to="comp-handler" label="per-node dispatch" style="dashed" />
        <DiagramEdge from="comp-handler" to="comp-track" style="dashed" />
        <DiagramEdge from="rt-loop" to="rt-driver" label="rAF tick" flow="forward" />
        <DiagramEdge from="rt-driver" to="rt-sampler" label="progress" style="dashed" />
        <DiagramEdge from="rt-driver" to="rt-registry" label="dispatch widgetState" flow="forward" />
        <DiagramEdge from="rt-registry" to="out-overlay" label="HUD ReactNode" style="dashed" arrowEnd="open" />
      </Diagram>
    </DiagramCanvas>

    {/* Overlay */}
    <div style={{
      position: 'absolute',
      bottom: '10%',
      left: '5%',
      maxWidth: 400,
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
          @brewsite/core
        </div>
        <div style={{
          fontSize: 'clamp(20px, 3vw, 26px)',
          fontWeight: 600,
          color: '#f0f6fc',
          lineHeight: 1.2,
          marginBottom: 14,
        }}>
          JSX in.<br />Rendered frame out.
        </div>
      </MidFade>
      <ScrollOn duration={900} delay={150}>
        <div style={{
          fontSize: 'clamp(13px, 1.6vw, 14px)',
          color: 'rgba(240, 246, 252, 0.6)',
          lineHeight: 1.65,
        }}>
          Scenes compile once to a flat tick array.
          The runtime samples in O(1) per frame —
          no diffing, no reconciliation.
        </div>
      </ScrollOn>
    </div>
  </Scene>
);

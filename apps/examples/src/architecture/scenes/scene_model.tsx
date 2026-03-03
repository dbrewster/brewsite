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

export const sceneModelArch: JSX.Element = (
  <Scene id="arch-model" transition={LATE_FADE}>
    <ProgressManager
      scrollUnits={3000}
      autoAdvance={{ duration: 10, max: 0.88, pauseOnScroll: true }}
    />
    <Camera
      mode="world"
      position={[0, 4, 54]}
      target={[0, 0, 0]}
      fov={54}
    />
    <Lighting intensityScale={1}>
      <Ambient intensity={1.0} color="#ffffff" />
      <Directional intensity={0.5} color="#ffeecc" position={[10, 20, 20]} />
      <Directional intensity={0.4} color="#aaccff" position={[-10, 5, 20]} />
    </Lighting>

    <DiagramCanvas
      id="arch-model-canvas"
      rotation={[-Math.PI / 10, 0, 0]}
      scale={1.1}
      theme={darkGlassTheme}
    >
      <Diagram id="model-arch" pivot="center">
        <ManualLayout />

        {/* ── COLUMN 1: Author (DSL) ── */}
        <DiagramGroup id="dsl-group" label="Author (DSL)" variant="boundary">
          <DiagramNode
            id="dsl-model"
            label="<Model id src clipName>"
            sublabel="per-scene declaration"
            icon="ui:archive-box"
            position={[-13, 5, 0]}
            size={[5.5, 2]}
          />
          <DiagramNode
            id="dsl-label"
            label="<Label text boneId>"
            sublabel="3D-tracked overlay · offset"
            icon="ui:tag"
            position={[-13, 1, 0]}
            size={[5.5, 2]}
          />
          <DiagramNode
            id="dsl-parts"
            label="parts[]"
            sublabel="per-mesh material overrides"
            icon="ui:paint-brush"
            position={[-13, -3, 0]}
            size={[5.5, 2]}
          />
        </DiagramGroup>

        {/* ── COLUMN 2: Compile (compiler/) ── */}
        <DiagramGroup id="compile-group" label="Compile (compiler/)" variant="swimlane">
          <DiagramNode
            id="cmp-compile"
            label="compile.ts"
            sublabel="pure: props → ModelState per scene"
            icon="ui:code-bracket-square"
            position={[-4.5, 6, 0]}
            size={[5.5, 2]}
          />
          <DiagramNode
            id="cmp-anim"
            label="animationTrackMapping"
            sublabel="clipName → AnimationClip ref"
            icon="ui:film"
            position={[-4.5, 2, 0]}
            size={[5.5, 2]}
          />
          <DiagramNode
            id="cmp-label"
            label="labelCompiler"
            sublabel="label props → LabelResolved"
            icon="ui:document-text"
            position={[-4.5, -2, 0]}
            size={[5.5, 2]}
          />
          <DiagramNode
            id="cmp-plugin"
            label="modelPlugin"
            sublabel="manifest: id → url · metadata"
            icon="ui:puzzle-piece"
            position={[-4.5, -6, 0]}
            size={[5.5, 2]}
          />
        </DiagramGroup>

        {/* ── COLUMN 3: Runtime (ModelWidget) ── */}
        <DiagramGroup id="runtime-group" label="Runtime (ModelWidget)" variant="cluster">
          <DiagramNode
            id="rt-load"
            label="ModelWidget.load()"
            sublabel="async: GLTFLoader + meshoptimizer"
            icon="ui:inbox"
            position={[4.5, 6, 0]}
            size={[5.5, 2]}
          />
          <DiagramNode
            id="rt-tick"
            label="ModelWidget.onTick()"
            sublabel="advances AnimationMixer · tickPriority"
            icon="ui:arrow-path"
            position={[4.5, 2, 0]}
            size={[5.5, 2]}
          />
          <DiagramNode
            id="rt-apply"
            label="ModelWidget.apply()"
            sublabel="position · rotation · scale · parts"
            icon="ui:cpu-chip"
            position={[4.5, -2, 0]}
            size={[5.5, 2]}
          />
          <DiagramNode
            id="rt-label"
            label="LabelPositioner"
            sublabel="bone → world → screen each frame"
            icon="ui:map-pin"
            position={[4.5, -6, 0]}
            size={[5.5, 2]}
          />
        </DiagramGroup>

        {/* ── COLUMN 4: Output ── */}
        <DiagramGroup id="output-group" label="Output" variant="boundary">
          <DiagramNode
            id="out-obj"
            label="Object3D"
            sublabel="Three.js scene graph placement"
            icon="ui:puzzle-piece"
            position={[13, 5, 0]}
            size={[5, 2]}
            color="#1a3060"
            glow={{ intensity: 0.2 }}
          />
          <DiagramNode
            id="out-mixer"
            label="AnimationMixer"
            sublabel="clip blending · crossfade"
            icon="ui:musical-note"
            position={[13, 1, 0]}
            size={[5, 2]}
          />
          <DiagramNode
            id="out-label"
            label="LabelItem"
            sublabel="React: positioned DOM over canvas"
            icon="ui:chat-bubble-left-right"
            position={[13, -3, 0]}
            size={[5, 2]}
          />
        </DiagramGroup>

        {/* ── Spine: DSL → compiled → runtime → output ── */}
        <DiagramEdge from="dsl-model" to="cmp-compile" label="per-scene props" flow="forward" />
        <DiagramEdge from="cmp-compile" to="rt-apply" label="ModelState" flow="forward" />
        <DiagramEdge from="rt-load" to="out-obj" label="parsed GLTF" flow="forward" />
        <DiagramEdge from="rt-tick" to="out-mixer" label="advance clips" flow="forward" />
        <DiagramEdge from="rt-label" to="out-label" label="screen coords" flow="forward" />

        {/* ── Supporting edges ── */}
        <DiagramEdge from="dsl-label" to="cmp-label" flow="forward" />
        <DiagramEdge from="dsl-parts" to="cmp-compile" style="dashed" />
        <DiagramEdge from="cmp-anim" to="rt-tick" label="clip ref" style="dashed" />
        <DiagramEdge from="cmp-label" to="rt-label" label="LabelResolved" style="dashed" />
        <DiagramEdge from="cmp-plugin" to="rt-load" label="manifest url" style="dashed" />
        <DiagramEdge from="out-mixer" to="out-obj" label="bone transforms" flow="forward" />
        <DiagramEdge from="out-obj" to="rt-label" label="bone world pos" style="dashed" arrowEnd="open" />
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
          @brewsite/model
        </div>
        <div style={{
          fontSize: 'clamp(20px, 3vw, 26px)',
          fontWeight: 600,
          color: '#f0f6fc',
          lineHeight: 1.2,
          marginBottom: 14,
        }}>
          GLTF loads once.<br />Bones animate per frame.
        </div>
      </MidFade>
      <ScrollOn duration={900} delay={150}>
        <div style={{
          fontSize: 'clamp(13px, 1.6vw, 14px)',
          color: 'rgba(240, 246, 252, 0.6)',
          lineHeight: 1.65,
        }}>
          GLTF loads once and caches.
          Per-frame: O(1) ModelState → AnimationMixer → bone transforms.
          Labels track bones through 3D → world → screen projection.
        </div>
      </ScrollOn>
    </div>
  </Scene>
);

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

    Diagram,
    DiagramEdge,
    DiagramGroup,
    DiagramNode,
    ManualLayout,
} from '@brewsite/diagram';
import { darkGlassBundle } from '@brewsite/themes';
import {MidFade, ScrollOn} from '@brewsite/core/hud/animejs';

const darkGlassTheme = darkGlassBundle.diagram.dark;

const angledFn = (t: number): number => (t < 0.5 ? 0 : (t - 0.5) / 0.5);

function makeModelCanvasDiagram(tilt: number, scale: number): JSX.Element {
  return (
    <Diagram id="arch-content" x={0} y={0} w={1} h={1} tilt={tilt} scale={scale}>
      <ManualLayout />

      {/* ── COLUMN 1: Author (DSL) ── */}
      <DiagramGroup id="dsl-group" label="Author (DSL) · typed GLTF model declarations" variant="boundary">
        <DiagramNode
          id="dsl-model"
          label="<Model id src clipName>"
          sublabel="per-scene declaration · consistent id required for interpolation"
          sublabelColor="#b8c8e8"
          icon="ui:archive-box"
          position={[0.114, 0.217, 0]}
          size={[0.162, 0.151]}
        />
        <DiagramNode
          id="dsl-label"
          label="<Label text boneId>"
          sublabel="bone-tracked HTML text · world → screen projection"
          sublabelColor="#b8c8e8"
          icon="ui:tag"
          position={[0.114, 0.453, 0]}
          size={[0.162, 0.151]}
        />
        <DiagramNode
          id="dsl-parts"
          label="parts[] overrides"
          sublabel="per-mesh color · metalness · roughness · opacity"
          sublabelColor="#b8c8e8"
          icon="ui:paint-brush"
          position={[0.114, 0.689, 0]}
          size={[0.162, 0.151]}
        />
      </DiagramGroup>

      {/* ── COLUMN 2: Compile (compiler/) ── */}
      <DiagramGroup id="compile-group" label="Compile (compiler/) · pure: props → ModelState per scene" variant="swimlane">
        <DiagramNode
          id="cmp-compile"
          label="compile.ts"
          sublabel="props → ModelState: position · rotation · scale · clip · playback"
          sublabelColor="#b8c8e8"
          icon="ui:code-bracket-square"
          position={[0.373, 0.146, 0]}
          size={[0.162, 0.151]}
        />
        <DiagramNode
          id="cmp-anim"
          label="animationTrackMapping"
          sublabel="clipName string → AnimationClip reference in loaded GLTF"
          sublabelColor="#b8c8e8"
          icon="ui:film"
          position={[0.373, 0.382, 0]}
          size={[0.162, 0.151]}
        />
        <DiagramNode
          id="cmp-label"
          label="labelCompiler"
          sublabel="Label props → LabelResolved (boneId, offset, text, visibility)"
          sublabelColor="#b8c8e8"
          icon="ui:document-text"
          position={[0.373, 0.618, 0]}
          size={[0.162, 0.151]}
        />
        <DiagramNode
          id="cmp-plugin"
          label="modelPlugin"
          sublabel="asset manifest: model id → GLTF URL + metadata"
          sublabelColor="#b8c8e8"
          icon="ui:puzzle-piece"
          position={[0.373, 0.854, 0]}
          size={[0.162, 0.151]}
        />
      </DiagramGroup>

      {/* ── COLUMN 3: Runtime (ModelWidget) ── */}
      <DiagramGroup id="runtime-group" label="Runtime (ModelWidget) · load once, apply() per frame" variant="cluster">
        <DiagramNode
          id="rt-load"
          label="ModelWidget.load()"
          sublabel="async: GLTFLoader + meshoptimizer · cached per URL"
          sublabelColor="#b8c8e8"
          icon="ui:inbox"
          position={[0.633, 0.146, 0]}
          size={[0.162, 0.151]}
        />
        <DiagramNode
          id="rt-tick"
          label="ModelWidget.onTick()"
          sublabel="AnimationMixer.update(delta) · must precede apply()"
          sublabelColor="#b8c8e8"
          icon="ui:arrow-path"
          position={[0.633, 0.382, 0]}
          size={[0.162, 0.151]}
        />
        <DiagramNode
          id="rt-apply"
          label="ModelWidget.apply()"
          sublabel="sets Object3D: position · rotation · scale · clip weights"
          sublabelColor="#b8c8e8"
          icon="ui:cpu-chip"
          position={[0.633, 0.618, 0]}
          size={[0.162, 0.151]}
        />
        <DiagramNode
          id="rt-label"
          label="LabelPositioner"
          sublabel="bone world pos → camera matrix → screen UV per frame"
          sublabelColor="#b8c8e8"
          icon="ui:map-pin"
          position={[0.633, 0.854, 0]}
          size={[0.162, 0.151]}
        />
      </DiagramGroup>

      {/* ── COLUMN 4: Output ── */}
      <DiagramGroup id="output-group" label="Output · Three.js scene graph + React DOM labels" variant="boundary">
        <DiagramNode
          id="out-obj"
          label="Object3D"
          sublabel="Three.js scene graph · SkinnedMesh + bone hierarchy"
          sublabelColor="#b8c8e8"
          icon="ui:puzzle-piece"
          position={[0.892, 0.217, 0]}
          size={[0.151, 0.151]}
          color="#1a3060"
          glow={{ intensity: 0.2 }}
        />
        <DiagramNode
          id="out-mixer"
          label="AnimationMixer"
          sublabel="crossfade · weight blending · clip time advance"
          sublabelColor="#b8c8e8"
          icon="ui:musical-note"
          position={[0.892, 0.453, 0]}
          size={[0.151, 0.151]}
        />
        <DiagramNode
          id="out-label"
          label="LabelItem"
          sublabel="React DOM absolute · CSS transform from screen UV coords"
          sublabelColor="#b8c8e8"
          icon="ui:chat-bubble-left-right"
          position={[0.892, 0.689, 0]}
          size={[0.151, 0.151]}
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
  );
}

// ── Scene 1 of 2: Angled view ──────────────────────────────────────────────
export const SceneModelAngledArch = () => (
  <Scene id="arch-model-angled">
    <ProgressManager scrollUnits={2000} fn={angledFn} />
    <Camera
      mode="world"
      position={[0, 35, 45]}
      target={[0, 0, 0]}
      fov={54}
    />
    <Lighting intensityScale={1}>
      <Ambient intensity={1.0} color="#ffffff" />
      <Directional intensity={0.5} color="#ffeecc" position={[10, 20, 20]} />
      <Directional intensity={0.4} color="#aaccff" position={[-10, 5, 20]} />
    </Lighting>
    {makeModelCanvasDiagram(-Math.PI / 4, 1.1)}
  </Scene>
);

// ── Scene 2 of 2: Head-on view with teaching overlay ──────────────────────
export const SceneModelArch = () => (
  <Scene id="arch-model" exitStart={0.9}>
    <ProgressManager scrollUnits={3000} />
    <Camera
      mode="world"
      position={[0, 4, 54]}
      target={[0, 0, 0]}
      fov={54}
    />
    {makeModelCanvasDiagram(-Math.PI / 10, 1.1)}

    {/* Teaching overlay */}
    <TextBox id="model-teaching" x={0.03} y={0.52} w={0.44} h={0.45}>
      <div style={{
        padding: '32px 40px',
        background: 'rgba(3,5,8,0.85)',
        backdropFilter: 'blur(20px)',
        borderRadius: '4px',
        height: '100%',
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
            @brewsite/model
          </div>
          <h1 style={{
            fontSize: '48px',
            fontWeight: 600,
            color: '#f0f6fc',
            lineHeight: 1.2,
            margin: '0 0 16px',
          }}>
            GLTF loads once.<br />Bones animate per frame.
          </h1>
        </MidFade>
        <ScrollOn duration={900} delay={150}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px 18px',
            marginBottom: 14,
          }}>
            <div>
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
                {'<Model id src clipName> declares a GLTF model per scene. id links the DSL to the loaded widget; clipName selects which animation clip plays — different scenes can play different clips on the same loaded model. parts[] allows per-mesh material overrides. <Label text boneId> anchors a text overlay to a named bone.'}
              </div>
            </div>
            <div>
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
                {'compile.ts is pure: model props → ModelState per scene, capturing position, rotation, scale, clip name, and playback rate. labelCompiler converts <Label> props to LabelResolved descriptors. modelPlugin supplies the asset manifest mapping model IDs to GLTF URLs. The compiler never loads or parses any 3D asset.'}
              </div>
            </div>
            <div>
              <div style={{
                fontSize: '16px',
                fontWeight: 700,
                color: 'rgba(100, 200, 160, 0.7)',
                marginBottom: 5,
              }}>
                Runtime
              </div>
              <div style={{
                fontSize: '15px',
                color: 'rgba(240, 246, 252, 0.6)',
                lineHeight: 1.6,
              }}>
                ModelWidget.load() fetches the GLTF once and decodes with meshoptimizer. onTick() advances the AnimationMixer before apply() runs — ordering matters: bone transforms must update before LabelPositioner projects them to screen. apply() receives ModelState and sets position, rotation, scale, and clip weights.
              </div>
            </div>
            <div>
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
                The parsed GLTF becomes an Object3D in the Three.js scene graph. AnimationMixer blends clips and drives bone transforms each tick. LabelItem is a React DOM element positioned absolutely over the canvas — LabelPositioner projects bone world coordinates through the camera matrix to screen space; no WebGL needed for the HTML text.
              </div>
            </div>
          </div>
          <div style={{
            borderLeft: '2px solid rgba(130, 100, 255, 0.5)',
            paddingLeft: 12,
            fontSize: '14px',
            color: 'rgba(240, 246, 252, 0.85)',
            lineHeight: 1.6,
            fontStyle: 'italic',
          }}>
            <strong>Key insight:</strong> The GLTF loads once and never reloads between scenes. Switching scenes only changes the compiled ModelState — the runtime smoothly blends to the new clip and pose.
          </div>
        </ScrollOn>
      </div>
    </TextBox>
  </Scene>
);

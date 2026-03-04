import type {JSX} from 'react';
import {
    Action,
    Ambient,
    Camera,
    Directional,
    InputController,
    KeyMap,
    Lighting,
    PointerMap,
    ProgressManager,
    Scene,
} from '@brewsite/core';
import {
    darkGlassTheme,
    Diagram,
    DiagramCanvas,
    DiagramEdge,
    DiagramGroup,
    DiagramNode,
    ManualLayout,
} from '@brewsite/diagram';
import {MidFade, ScrollOn} from '@brewsite/core/hud/animejs';

const angledFn = (t: number): number => (t < 0.5 ? 0 : (t - 0.5) / 0.5);

function makeModelCanvasDiagram(): JSX.Element {
  return (
    <Diagram id="arch-content" pivot="center">
      <ManualLayout />

      {/* ── COLUMN 1: Author (DSL) ── */}
      <DiagramGroup id="dsl-group" label="Author (DSL) · typed GLTF model declarations" variant="boundary">
        <DiagramNode
          id="dsl-model"
          label="<Model id src clipName>"
          sublabel="per-scene declaration · consistent id required for interpolation"
          sublabelColor="#b8c8e8"
          icon="ui:archive-box"
          position={[-18, 6, 0]}
          size={[7.5, 3.2]}
        />
        <DiagramNode
          id="dsl-label"
          label="<Label text boneId>"
          sublabel="bone-tracked HTML text · world → screen projection"
          sublabelColor="#b8c8e8"
          icon="ui:tag"
          position={[-18, 1, 0]}
          size={[7.5, 3.2]}
        />
        <DiagramNode
          id="dsl-parts"
          label="parts[] overrides"
          sublabel="per-mesh color · metalness · roughness · opacity"
          sublabelColor="#b8c8e8"
          icon="ui:paint-brush"
          position={[-18, -4, 0]}
          size={[7.5, 3.2]}
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
          position={[-6, 7.5, 0]}
          size={[7.5, 3.2]}
        />
        <DiagramNode
          id="cmp-anim"
          label="animationTrackMapping"
          sublabel="clipName string → AnimationClip reference in loaded GLTF"
          sublabelColor="#b8c8e8"
          icon="ui:film"
          position={[-6, 2.5, 0]}
          size={[7.5, 3.2]}
        />
        <DiagramNode
          id="cmp-label"
          label="labelCompiler"
          sublabel="Label props → LabelResolved (boneId, offset, text, visibility)"
          sublabelColor="#b8c8e8"
          icon="ui:document-text"
          position={[-6, -2.5, 0]}
          size={[7.5, 3.2]}
        />
        <DiagramNode
          id="cmp-plugin"
          label="modelPlugin"
          sublabel="asset manifest: model id → GLTF URL + metadata"
          sublabelColor="#b8c8e8"
          icon="ui:puzzle-piece"
          position={[-6, -7.5, 0]}
          size={[7.5, 3.2]}
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
          position={[6, 7.5, 0]}
          size={[7.5, 3.2]}
        />
        <DiagramNode
          id="rt-tick"
          label="ModelWidget.onTick()"
          sublabel="AnimationMixer.update(delta) · must precede apply()"
          sublabelColor="#b8c8e8"
          icon="ui:arrow-path"
          position={[6, 2.5, 0]}
          size={[7.5, 3.2]}
        />
        <DiagramNode
          id="rt-apply"
          label="ModelWidget.apply()"
          sublabel="sets Object3D: position · rotation · scale · clip weights"
          sublabelColor="#b8c8e8"
          icon="ui:cpu-chip"
          position={[6, -2.5, 0]}
          size={[7.5, 3.2]}
        />
        <DiagramNode
          id="rt-label"
          label="LabelPositioner"
          sublabel="bone world pos → camera matrix → screen UV per frame"
          sublabelColor="#b8c8e8"
          icon="ui:map-pin"
          position={[6, -7.5, 0]}
          size={[7.5, 3.2]}
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
          position={[18, 6, 0]}
          size={[7, 3.2]}
          color="#1a3060"
          glow={{ intensity: 0.2 }}
        />
        <DiagramNode
          id="out-mixer"
          label="AnimationMixer"
          sublabel="crossfade · weight blending · clip time advance"
          sublabelColor="#b8c8e8"
          icon="ui:musical-note"
          position={[18, 1, 0]}
          size={[7, 3.2]}
        />
        <DiagramNode
          id="out-label"
          label="LabelItem"
          sublabel="React DOM absolute · CSS transform from screen UV coords"
          sublabelColor="#b8c8e8"
          icon="ui:chat-bubble-left-right"
          position={[18, -4, 0]}
          size={[7, 3.2]}
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
export const sceneModelAngledArch: JSX.Element = (
  <Scene id="arch-model-angled">
    <ProgressManager scrollUnits={2000} fn={angledFn} />
    {/* Camera controls: Cmd+drag to orbit, Shift+drag to pan, R to reset */}
    <InputController scope="canvas">
      <Action id="rotate" type="diagram-canvas.rotate" canvasId="arch-model-canvas">
        <PointerMap event="drag" button="left" modifiers={['meta']} axis="xy" />
      </Action>
      <Action id="pan" type="diagram-canvas.move" canvasId="arch-model-canvas">
        <PointerMap event="drag" button="left" modifiers={['shift']} axis="xy" />
      </Action>
      <Action id="reset" type="diagram-canvas.reset" canvasId="arch-model-canvas">
        <KeyMap keyName="r" />
      </Action>
    </InputController>
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
    <DiagramCanvas
      id="arch-model-canvas"
      position={[0, 15, 0]}
      rotation={[-Math.PI / 4, 0, 0]}
      scale={1.1}
      theme={darkGlassTheme}
    >
      {makeModelCanvasDiagram()}
    </DiagramCanvas>
  </Scene>
);

// ── Scene 2 of 2: Head-on view with teaching overlay ──────────────────────
export const sceneModelArch: JSX.Element = (
  <Scene id="arch-model" exitStart={0.9}>
    <ProgressManager scrollUnits={3000} />
    <Camera
      mode="world"
      position={[0, 4, 54]}
      target={[0, 0, 0]}
      fov={54}
    />
    <DiagramCanvas
      id="arch-model-canvas"
      position={[0, 15, 0]}
      rotation={[-Math.PI / 10, 0, 0]}
      scale={1.1}
      theme={darkGlassTheme}
    >
      {makeModelCanvasDiagram()}
    </DiagramCanvas>

    {/* Teaching overlay */}
    <div style={{
      position: 'absolute',
      bottom: '3%',
      left: '3%',
      maxWidth: 540,
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
          fontSize: 'clamp(18px, 2.6vw, 24px)',
          fontWeight: 600,
          color: '#f0f6fc',
          lineHeight: 1.2,
          marginBottom: 16,
        }}>
          GLTF loads once.<br />Bones animate per frame.
        </div>
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
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 9,
              letterSpacing: '0.2em',
              textTransform: 'uppercase' as const,
              color: 'rgba(130, 100, 255, 0.7)',
              marginBottom: 5,
            }}>
              Author / DSL
            </div>
            <div style={{
              fontSize: 'clamp(11px, 1.3vw, 12px)',
              color: 'rgba(240, 246, 252, 0.6)',
              lineHeight: 1.6,
            }}>
              {'<Model id src clipName> declares a GLTF model per scene. id links the DSL to the loaded widget; clipName selects which animation clip plays — different scenes can play different clips on the same loaded model. parts[] allows per-mesh material overrides. <Label text boneId> anchors a text overlay to a named bone.'}
            </div>
          </div>
          <div>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 9,
              letterSpacing: '0.2em',
              textTransform: 'uppercase' as const,
              color: 'rgba(100, 160, 255, 0.7)',
              marginBottom: 5,
            }}>
              Compile
            </div>
            <div style={{
              fontSize: 'clamp(11px, 1.3vw, 12px)',
              color: 'rgba(240, 246, 252, 0.6)',
              lineHeight: 1.6,
            }}>
              {'compile.ts is pure: model props → ModelState per scene, capturing position, rotation, scale, clip name, and playback rate. labelCompiler converts <Label> props to LabelResolved descriptors. modelPlugin supplies the asset manifest mapping model IDs to GLTF URLs. The compiler never loads or parses any 3D asset.'}
            </div>
          </div>
          <div>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 9,
              letterSpacing: '0.2em',
              textTransform: 'uppercase' as const,
              color: 'rgba(100, 200, 160, 0.7)',
              marginBottom: 5,
            }}>
              Runtime
            </div>
            <div style={{
              fontSize: 'clamp(11px, 1.3vw, 12px)',
              color: 'rgba(240, 246, 252, 0.6)',
              lineHeight: 1.6,
            }}>
              ModelWidget.load() fetches the GLTF once and decodes with meshoptimizer. onTick() advances the AnimationMixer before apply() runs — ordering matters: bone transforms must update before LabelPositioner projects them to screen. apply() receives ModelState and sets position, rotation, scale, and clip weights.
            </div>
          </div>
          <div>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 9,
              letterSpacing: '0.2em',
              textTransform: 'uppercase' as const,
              color: 'rgba(130, 100, 255, 0.7)',
              marginBottom: 5,
            }}>
              Output
            </div>
            <div style={{
              fontSize: 'clamp(11px, 1.3vw, 12px)',
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
          fontSize: 'clamp(11px, 1.3vw, 12px)',
          color: 'rgba(240, 246, 252, 0.85)',
          lineHeight: 1.6,
          fontStyle: 'italic',
        }}>
          <strong>Key insight:</strong> The GLTF loads once and never reloads between scenes. Switching scenes only changes the compiled ModelState — the runtime smoothly blends to the new clip and pose.
        </div>
      </ScrollOn>
    </div>
  </Scene>
);

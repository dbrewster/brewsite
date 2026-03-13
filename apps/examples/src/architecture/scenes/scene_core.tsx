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
import {MidFade, ScrollOn} from '@brewsite/core/hud/animejs';

// Holds blockProgress=0 for first 50% of scroll, then ramps 0→1 in the second 50%.
// This keeps the camera static at the angled position while the user starts scrolling,
// then animates to the head-on position as they continue.
const angledFn = (t: number): number => (t < 0.5 ? 0 : (t - 0.5) / 0.5);

function makeCoreCanvasDiagram(tilt: number, scale: number): JSX.Element {
  return (
    <Diagram id="arch-content" x={0} y={0} w={1} h={1} tilt={tilt} scale={scale}>
      <ManualLayout />

      {/* ── COLUMN 1: Author (DSL) ── */}
      <DiagramGroup id="dsl-group" label="Author (DSL) · pure JSX, no Three.js" variant="boundary">
        <DiagramNode
          id="dsl-scene"
          label="<Scene>"
          sublabel="key/id identity · easing · HTML overlay children"
          sublabelColor="#b8c8e8"
          icon="ui:document-text"
          position={[0.109, 0.118, 0]}
          size={[0.152, 0.122]}
        />
        <DiagramNode
          id="dsl-camera"
          label="<Camera>"
          sublabel="world | orbit | fitBotHeight modes · fov · exposure"
          sublabelColor="#b8c8e8"
          icon="ui:photo"
          position={[0.109, 0.309, 0]}
          size={[0.152, 0.122]}
        />
        <DiagramNode
          id="dsl-lighting"
          label="<Lighting>"
          sublabel="Ambient | Directional | Point | Spot | GlowPoint"
          sublabelColor="#b8c8e8"
          icon="ui:bolt"
          position={[0.109, 0.500, 0]}
          size={[0.152, 0.122]}
        />
        <DiagramNode
          id="dsl-background"
          label="<Background>"
          sublabel="color | gradient | imageUrl · CSS sizing"
          sublabelColor="#b8c8e8"
          icon="ui:swatch"
          position={[0.109, 0.691, 0]}
          size={[0.152, 0.122]}
        />
        <DiagramNode
          id="dsl-progress"
          label="<ProgressManager>"
          sublabel="scrollUnits · fn(t) pacing curve · autoAdvance"
          sublabelColor="#b8c8e8"
          icon="ui:adjustments-horizontal"
          position={[0.109, 0.882, 0]}
          size={[0.152, 0.122]}
        />
      </DiagramGroup>

      {/* ── COLUMN 2: Compile (compiler/) ── */}
      <DiagramGroup id="compile-group" label="Compile (compiler/) · pure functions, zero Three.js" variant="swimlane">
        <DiagramNode
          id="comp-dsl"
          label="sceneDslCompiler"
          sublabel="walks JSX tree · ReactElement.type → NodeHandler dispatch"
          sublabelColor="#b8c8e8"
          icon="ui:code-bracket-square"
          position={[0.370, 0.214, 0]}
          size={[0.163, 0.122]}
        />
        <DiagramNode
          id="comp-handler"
          label="NodeHandler registry"
          sublabel="component type → (node, ctx) → SceneState"
          sublabelColor="#b8c8e8"
          icon="ui:squares-plus"
          position={[0.370, 0.405, 0]}
          size={[0.163, 0.122]}
        />
        <DiagramNode
          id="comp-track"
          label="sceneTrackCompiler"
          sublabel="SceneFrame[] → flat pre-baked tick[] · interpolation baked"
          sublabelColor="#b8c8e8"
          icon="ui:arrows-right-left"
          position={[0.370, 0.595, 0]}
          size={[0.163, 0.122]}
        />
        <DiagramNode
          id="comp-scenetrack"
          label="SceneTrack"
          sublabel="flat tick[] · O(1) lookup · compiled once at mount"
          sublabelColor="#b8c8e8"
          icon="ui:circle-stack"
          position={[0.370, 0.786, 0]}
          size={[0.163, 0.122]}
          color="#1a3060"
          glow={{ intensity: 0.2 }}
        />
      </DiagramGroup>

      {/* ── COLUMN 3: Execute (runtime/) ── */}
      <DiagramGroup id="runtime-group" label="Execute (runtime/) · rAF loop, O(1) sampling per frame" variant="cluster">
        <DiagramNode
          id="rt-loop"
          label="RuntimeLoop"
          sublabel="requestAnimationFrame driver · fpsCap · delta time"
          sublabelColor="#b8c8e8"
          icon="ui:arrow-path"
          position={[0.630, 0.214, 0]}
          size={[0.163, 0.122]}
        />
        <DiagramNode
          id="rt-driver"
          label="RuntimeDriverImpl"
          sublabel="sample SceneTrack per frame → WidgetState dispatch"
          sublabelColor="#b8c8e8"
          icon="ui:cpu-chip"
          position={[0.630, 0.405, 0]}
          size={[0.163, 0.122]}
        />
        <DiagramNode
          id="rt-sampler"
          label="sceneTrackSampler"
          sublabel="progress [0..1] → WidgetState[] · O(1), no diffing"
          sublabelColor="#b8c8e8"
          icon="ui:funnel"
          position={[0.630, 0.595, 0]}
          size={[0.163, 0.122]}
        />
        <DiagramNode
          id="rt-registry"
          label="WidgetRegistry"
          sublabel="routes WidgetState by id → IWidget.apply()"
          sublabelColor="#b8c8e8"
          icon="ui:puzzle-piece"
          position={[0.630, 0.786, 0]}
          size={[0.163, 0.122]}
        />
      </DiagramGroup>

      {/* ── COLUMN 4: Output (player/) ── */}
      <DiagramGroup id="output-group" label="Output (player/) · React integration surface" variant="boundary">
        <DiagramNode
          id="out-canvas"
          label="SceneCanvas"
          sublabel="WebGLRenderer · tone-mapping · Three.js scene root"
          sublabelColor="#b8c8e8"
          icon="ui:photo"
          position={[0.891, 0.309, 0]}
          size={[0.152, 0.122]}
        />
        <DiagramNode
          id="out-overlay"
          label="EngineOverlayHost"
          sublabel="absolute React tree over canvas · pointer-events passthrough"
          sublabelColor="#b8c8e8"
          icon="ui:chat-bubble-left-right"
          position={[0.891, 0.500, 0]}
          size={[0.152, 0.122]}
        />
        <DiagramNode
          id="out-input"
          label="EngineInputRegion"
          sublabel="scroll spacer · sticky viewport · progress [0..1]"
          sublabelColor="#b8c8e8"
          icon="ui:arrows-pointing-out"
          position={[0.891, 0.691, 0]}
          size={[0.152, 0.122]}
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
  );
}

// ── Scene 1 of 2: Angled view ──────────────────────────────────────────────
// Camera starts elevated at 45°. ProgressManager.fn holds the transition at
// blockProgress=0 for the first half of scroll (static angled view), then
// animates camera + diagram rotation to head-on in the second half.
export const SceneCoreAngledArch = () => (
  <Scene id="arch-core-angled">
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
      <Directional intensity={0.3} color="#6677ff" position={[-15, 5, 10]} />
    </Lighting>
    {makeCoreCanvasDiagram(-Math.PI / 4, 1.1)}
  </Scene>
);

// ── Scene 2 of 2: Head-on view with teaching overlay ──────────────────────
// Camera is at the head-on position. Text fades in as this scene becomes active.
// Dissolve-to-black transitions out to the next package's angled scene.
export const SceneCoreArch = () => (
  <Scene id="arch-core" exitStart={0.9}>
    <ProgressManager scrollUnits={3000} />
    <Camera
      mode="world"
      position={[0, 4, 56]}
      target={[0, 0, 0]}
      fov={54}
    />
    {makeCoreCanvasDiagram(-Math.PI / 10, 1.1)}

    {/* Teaching overlay */}
    <TextBox id="core-teaching" x={0.03} y={0.52} w={0.44} h={0.45}>
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
            @brewsite/core
          </div>
          <h1 style={{
            fontSize: '48px',
            fontWeight: 600,
            color: '#f0f6fc',
            lineHeight: 1.2,
            marginBottom: 16,
            margin: '0 0 16px',
          }}>
            JSX in. Rendered frame out.
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
                {'Scene files are pure JSX: <Scene>, <Camera>, <Lighting>, <Background>, <ProgressManager>. Each component maps to a registered widget via a NodeHandler. No Three.js, no animation math — describe what you want, not how to render it.'}
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
                sceneDslCompiler walks the JSX tree and calls each NodeHandler, accumulating SceneFrame[] — one per scene. sceneTrackCompiler bakes those into a pre-allocated SceneTrack: a flat tick array with transitions pre-interpolated. The compiler is pure — no Three.js, no React, no side effects.
              </div>
            </div>
            <div>
              <div style={{
                fontSize: '16px',
                fontWeight: 700,
                color: 'rgba(100, 200, 160, 0.7)',
                marginBottom: 5,
              }}>
                Execute
              </div>
              <div style={{
                fontSize: '15px',
                color: 'rgba(240, 246, 252, 0.6)',
                lineHeight: 1.6,
              }}>
                RuntimeLoop drives the requestAnimationFrame loop. Each tick, RuntimeDriverImpl calls sceneTrackSampler with the current scroll progress — O(1) lookup into the pre-baked array. WidgetRegistry routes each WidgetState to its IWidget.apply(), where Three.js mutations happen.
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
                SceneCanvas owns the WebGLRenderer. EngineOverlayHost layers React HUD nodes over the canvas. EngineInputRegion creates the scroll spacer that converts viewport scroll into scene progress. All three compose inside ScenePlayer — the only integration surface a page author needs.
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
            <strong>Key insight:</strong> Scenes compile once at mount. The runtime never re-derives state from JSX — it samples a pre-baked array at O(1) per frame, with no diffing, no reconciliation.
          </div>
        </ScrollOn>
      </div>
    </TextBox>
  </Scene>
);

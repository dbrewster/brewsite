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

function makeDiagramCanvasDiagram(): JSX.Element {
  return (
    <Diagram id="arch-content" pivot="center">
      <ManualLayout />

      {/* ── COLUMN 1: Author (DSL) ── */}
      <DiagramGroup id="dsl-group" label="Author (DSL) · declare nodes, edges, groups as JSX" variant="boundary">
        <DiagramNode
          id="dsl-canvas"
          label="<DiagramCanvas>"
          sublabel="orthographic Three.js scene · theme · DiagramWidget owner"
          sublabelColor="#b8c8e8"
          icon="ui:squares-2x2"
          position={[-18, 10, 0]}
          size={[7, 3.2]}
        />
        <DiagramNode
          id="dsl-diagram"
          label="<Diagram>"
          sublabel="pivot center|corner · ManualLayout | AutoLayout root"
          sublabelColor="#b8c8e8"
          icon="ui:document-text"
          position={[-18, 5, 0]}
          size={[7, 3.2]}
        />
        <DiagramNode
          id="dsl-node"
          label="<DiagramNode>"
          sublabel="id · label · sublabel · icon · position · size · glow"
          sublabelColor="#b8c8e8"
          icon="ui:squares-2x2"
          position={[-18, 0, 0]}
          size={[7, 3.2]}
        />
        <DiagramNode
          id="dsl-edge"
          label="<DiagramEdge>"
          sublabel="from/to · label · flow direction · style · arrowEnd"
          sublabelColor="#b8c8e8"
          icon="ui:arrows-right-left"
          position={[-18, -5, 0]}
          size={[7, 3.2]}
        />
        <DiagramNode
          id="dsl-group-node"
          label="<DiagramGroup>"
          sublabel="boundary | swimlane | cluster · architectural container"
          sublabelColor="#b8c8e8"
          icon="ui:squares-plus"
          position={[-18, -10, 0]}
          size={[7, 3.2]}
        />
      </DiagramGroup>

      {/* ── COLUMN 2: Compile (compiler/) ── */}
      <DiagramGroup id="compile-group" label="Compile (compiler/) · pure graph resolution, zero Three.js" variant="swimlane">
        <DiagramNode
          id="cmp-node"
          label="nodeCompiler"
          sublabel="DiagramNode props → resolved world positions + anchor points"
          sublabelColor="#b8c8e8"
          icon="ui:adjustments-horizontal"
          position={[-6, 10, 0]}
          size={[7.5, 3.2]}
        />
        <DiagramNode
          id="cmp-layout"
          label="layoutResolver"
          sublabel="ManualLayout passthrough or hierarchical/grid auto-layout"
          sublabelColor="#b8c8e8"
          icon="ui:squares-plus"
          position={[-6, 5, 0]}
          size={[7.5, 3.2]}
        />
        <DiagramNode
          id="cmp-edge-router"
          label="edgeRouter"
          sublabel="node anchors → Catmull-Rom curve control points"
          sublabelColor="#b8c8e8"
          icon="ui:arrows-pointing-out"
          position={[-6, 0, 0]}
          size={[7.5, 3.2]}
        />
        <DiagramNode
          id="cmp-theme"
          label="themeResolver"
          sublabel="theme defaults + per-node overrides → PBR material params"
          sublabelColor="#b8c8e8"
          icon="ui:swatch"
          position={[-6, -5, 0]}
          size={[7.5, 3.2]}
        />
        <DiagramNode
          id="cmp-transition"
          label="transitionHelpers"
          sublabel="FunctionalTransitionSpec closures · enter/exit state capture"
          sublabelColor="#b8c8e8"
          icon="ui:sparkles"
          position={[-6, -10, 0]}
          size={[7.5, 3.2]}
        />
      </DiagramGroup>

      {/* ── COLUMN 3: Renderers (rendering/) ── */}
      <DiagramGroup id="renderers-group" label="Renderers (rendering/) · Three.js geometry builders" variant="cluster">
        <DiagramNode
          id="rnd-node"
          label="NodeRenderer"
          sublabel="rounded-corner BoxGeometry · PBR material · optional glow mesh"
          sublabelColor="#b8c8e8"
          icon="ui:puzzle-piece"
          position={[6, 10, 0]}
          size={[7.5, 3.2]}
        />
        <DiagramNode
          id="rnd-edge"
          label="EdgeRenderer"
          sublabel="TubeGeometry · animated dashOffset · flow direction"
          sublabelColor="#b8c8e8"
          icon="ui:arrows-right-left"
          position={[6, 5, 0]}
          size={[7.5, 3.2]}
        />
        <DiagramNode
          id="rnd-group"
          label="GroupRenderer"
          sublabel="boundary PlaneGeometry · swimlane divider panel mesh"
          sublabelColor="#b8c8e8"
          icon="ui:squares-plus"
          position={[6, 0, 0]}
          size={[7.5, 3.2]}
        />
        <DiagramNode
          id="rnd-text"
          label="TextRenderer"
          sublabel="troika-three-text · GPU-accelerated SDF label rendering"
          sublabelColor="#b8c8e8"
          icon="ui:chat-bubble-left-right"
          position={[6, -5, 0]}
          size={[7.5, 3.2]}
        />
        <DiagramNode
          id="rnd-icon"
          label="IconLoader"
          sublabel="SVG → extruded BufferGeometry or 2D sprite billboard"
          sublabelColor="#b8c8e8"
          icon="ui:photo"
          position={[6, -10, 0]}
          size={[7.5, 3.2]}
        />
      </DiagramGroup>

      {/* ── COLUMN 4: Output ── */}
      <DiagramGroup id="output-group" label="Output (DiagramWidget) · ISceneElement + IRenderable + ILoadable" variant="boundary">
        <DiagramNode
          id="out-widget"
          label="DiagramWidget"
          sublabel="owns Object3D tree · bridges compile → render · apply() per frame"
          sublabelColor="#b8c8e8"
          icon="ui:puzzle-piece"
          position={[18, 5, 0]}
          size={[7, 3.2]}
          color="#1a3060"
          glow={{ intensity: 0.2 }}
        />
        <DiagramNode
          id="out-envmap"
          label="EnvMapManager"
          sublabel="Radiance HDR → IBL env map for PBR reflections on all nodes"
          sublabelColor="#b8c8e8"
          icon="ui:globe-alt"
          position={[18, 0, 0]}
          size={[7, 3.2]}
        />
        <DiagramNode
          id="out-scene"
          label="DiagramCanvas scene"
          sublabel="isolated OrthographicCamera · separate from main scene camera"
          sublabelColor="#b8c8e8"
          icon="ui:squares-2x2"
          position={[18, -5, 0]}
          size={[7, 3.2]}
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
  );
}

// ── Scene 1 of 2: Angled view ──────────────────────────────────────────────
export const sceneDiagramAngledArch: JSX.Element = (
  <Scene id="arch-diagram-angled">
    <ProgressManager scrollUnits={2000} fn={angledFn} />
    {/* Camera controls: Cmd+drag to orbit, Shift+drag to pan, R to reset */}
    <InputController scope="canvas">
      <Action id="rotate" type="diagram-canvas.rotate" canvasId="arch-diagram-canvas">
        <PointerMap event="drag" button="left" modifiers={['meta']} axis="xy" />
      </Action>
      <Action id="pan" type="diagram-canvas.move" canvasId="arch-diagram-canvas">
        <PointerMap event="drag" button="left" modifiers={['shift']} axis="xy" />
      </Action>
      <Action id="reset" type="diagram-canvas.reset" canvasId="arch-diagram-canvas">
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
      <Ambient intensity={1.1} color="#ffffff" />
      <Directional intensity={0.5} color="#aaccff" position={[0, 20, 30]} />
      <Directional intensity={0.4} color="#9966ff" position={[-20, 10, 10]} />
    </Lighting>
    <DiagramCanvas
      id="arch-diagram-canvas"
      position={[0, 15, 0]}
      rotation={[-Math.PI / 4, 0, 0]}
      scale={1.1}
      theme={darkGlassTheme}
    >
      {makeDiagramCanvasDiagram()}
    </DiagramCanvas>
  </Scene>
);

// ── Scene 2 of 2: Head-on view with teaching overlay ──────────────────────
export const sceneDiagramArch: JSX.Element = (
  <Scene id="arch-diagram" exitStart={0.9}>
    <ProgressManager scrollUnits={3000} />
    <Camera
      mode="world"
      position={[0, 4, 58]}
      target={[0, 0, 0]}
      fov={54}
    />
    <DiagramCanvas
      id="arch-diagram-canvas"
      position={[0, 15, 0]}
      rotation={[-Math.PI / 10, 0, 0]}
      scale={1.1}
      theme={darkGlassTheme}
    >
      {makeDiagramCanvasDiagram()}
    </DiagramCanvas>

    {/* Teaching overlay */}
    <div style={{
      position: 'absolute',
      bottom: '3%',
      right: '3%',
      maxWidth: 540,
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
          fontSize: 'clamp(18px, 2.6vw, 24px)',
          fontWeight: 600,
          color: '#f0f6fc',
          lineHeight: 1.2,
          marginBottom: 16,
        }}>
          DSL props → pure compile<br />→ Three.js renderers.
        </div>
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
              {'Authors declare nodes, edges, and groups as JSX. <DiagramCanvas> owns the orthographic scene and theme. <DiagramNode> and <DiagramEdge> are pure prop declarations — no positional math needed when using auto-layout algorithms. ManualLayout lets you place nodes with explicit world-space coordinates.'}
            </div>
          </div>
          <div style={{ textAlign: 'left' }}>
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
              nodeCompiler resolves positions; layoutResolver dispatches the layout algorithm; edgeRouter computes curve control points; themeResolver produces per-node PBR params; transitionHelpers builds FunctionalTransitionSpec closures capturing enter/exit state. All five compilers are pure functions — zero Three.js, zero mutations.
            </div>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 9,
              letterSpacing: '0.2em',
              textTransform: 'uppercase' as const,
              color: 'rgba(100, 200, 160, 0.7)',
              marginBottom: 5,
            }}>
              Renderers
            </div>
            <div style={{
              fontSize: 'clamp(11px, 1.3vw, 12px)',
              color: 'rgba(240, 246, 252, 0.6)',
              lineHeight: 1.6,
            }}>
              DiagramWidget.apply() distributes compiled state to specialized renderers each frame. NodeRenderer builds PBR rounded-corner meshes with optional glow. EdgeRenderer generates tube geometry with animated flow-dash offsets. TextRenderer uses troika-three-text for GPU-accelerated SDF labels. Each renderer owns its Three.js objects and lifecycle.
            </div>
          </div>
          <div style={{ textAlign: 'left' }}>
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
              DiagramWidget implements ISceneElement + IRenderable + ILoadable. It owns the Three.js Object3D tree and the DiagramCanvas's OrthographicCamera — isolated from the main scene camera. EnvMapManager provides the HDR environment map for PBR reflections on all nodes and edges.
            </div>
          </div>
        </div>
        <div style={{
          borderRight: '2px solid rgba(130, 100, 255, 0.5)',
          paddingRight: 12,
          fontSize: 'clamp(11px, 1.3vw, 12px)',
          color: 'rgba(240, 246, 252, 0.85)',
          lineHeight: 1.6,
          fontStyle: 'italic',
          textAlign: 'right',
        }}>
          <strong>Key insight:</strong> @brewsite/diagram extends core purely through NodeHandler registration and a new IWidget. Core never imports diagram — the dependency is strictly one-way.
        </div>
      </ScrollOn>
    </div>
  </Scene>
);

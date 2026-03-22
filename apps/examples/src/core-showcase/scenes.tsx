// Core Showcase — all 14 scene components.
// Each scene teaches one area of @brewsite/core by showing it in action.
// Every scene wraps its renderable content in a <View> so the stage occupies a
// known sub-region of the viewport, keeping things from feeling oversized on
// ultra-wide monitors while staying proportional on phones.
import type {JSX} from 'react';
import {
  Action,
  Ambient,
  Background,
  Camera,
  Directional,
  Floor,
  GlowPoint,
  InputController,
  KeyMap,
  Lighting,
  PointerMap,
  ProgressManager,
  Scene,
  TextBox,
  View,
  WheelMap,
} from '@brewsite/core';
import {Diagram, DiagramEdge, DiagramGroup, DiagramNode, ManualLayout,} from '@brewsite/diagram';
import {BarChart, ChartAxis, ChartData, ChartSeries,} from '@brewsite/charts';
import {frameworkDataA, frameworkDataB} from './data';

// ─── Standard stage View bounds ─────────────────────────────────────────────
// Every scene places its renderable content inside a View with these bounds.
// Children use local NVS coords (x=0..1, y=0..1) within the stage.
// The 6% horizontal margin + 10%/12% vertical margin keeps content
// comfortably inset from the fixed top/bottom chrome overlays.
export const V = { x: "15%", y: "10%", w: "70%", h: "78%" } as const;

// ─── Shared lighting presets ────────────────────────────────────────────────

const SoftLighting = (): JSX.Element => (
  <Lighting intensityScale={1}>
    <Ambient intensity={0.8} color="#d7e8ff" />
    <Directional intensity={0.9} color="#ffffff" position={[4, 10, 6]} />
    <Directional intensity={0.4} color="#b0ccff" position={[-6, 4, 8]} />
  </Lighting>
);

const HeroLighting = (): JSX.Element => (
  <Lighting intensityScale={1}>
    <Ambient intensity={0.3} color="#0d0d30" />
    <Directional intensity={1.8} color="#8090ff" position={[0, 20, 12]} />
    <Directional intensity={0.6} color="#4060ff" position={[-8, 4, 10]} />
  </Lighting>
);

// ─── SCENE 1: Hero ──────────────────────────────────────────────────────────

export const HeroScene = (): JSX.Element => (
  <Scene id="cs-hero">
    <ProgressManager scrollUnits={1200} />
    <Camera mode="world" position={[0, 3, 10]} target={[0, 0, 0]} fov={"48deg"} />
    <HeroLighting />
    <Background />
    <Floor variant="grid" negativeZExtent={24} />

    <View id="cs-stage" x={V.x} y={V.y} w={V.w} h={V.h}>
      <TextBox id="hero-title" x={"2%"} y={"12%"} w={"96%"} h={"76%"}>
        <div
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: '11px',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--ex-text-muted)',
              fontFamily: 'JetBrains Mono, monospace',
              marginBottom: 18,
            }}
          >
            @brewsite/core
          </div>
          <h1
            style={{
              fontSize: 'clamp(28px, 5vw, 60px)',
              fontWeight: 700,
              color: 'var(--ex-text)',
              margin: '0 0 20px',
              lineHeight: 1.1,
            }}
          >
            BrewSite Core
          </h1>
          <p
            style={{
              fontSize: 'clamp(13px, 1.6vw, 18px)',
              color: 'var(--ex-text)',
              lineHeight: 1.7,
              maxWidth: 480,
              margin: 0,
            }}
          >
            A TypeScript + React + Three.js framework for authoring animated 3D
            scenes driven by scroll. Declare snapshots in JSX — the compiler
            handles all transitions.
          </p>
          <div
            style={{
              marginTop: 28,
              padding: '7px 18px',
              background: 'var(--ex-accent-surface)',
              border: '1px solid var(--ex-accent-border)',
              borderRadius: 20,
              fontSize: 11,
              color: 'var(--ex-text-muted)',
              fontFamily: 'JetBrains Mono, monospace',
              pointerEvents: 'none',
            }}
          >
            Scroll to explore
          </div>
        </div>
      </TextBox>
    </View>
  </Scene>
);

// ─── SCENE 2: Architecture Overview ─────────────────────────────────────────

// ─── SCENE 3: Scene DSL — Snapshots ─────────────────────────────────────────

export const SceneDslScene = (): JSX.Element => (
  <Scene id="cs-scene-dsl">
    <ProgressManager scrollUnits={1200} />
    <Camera mode="world" position={[0, 6, 28]} target={[0, 0, 0]} fov={"50deg"} />
    <SoftLighting />
    <Background />

    <View id="cs-stage" x={V.x} y={V.y} w={V.w} h={V.h}>
      <Diagram
        id="cs-scene-dsl-diagram"
        x={0}
        y={"18%"}
        w={"100%"}
        h={"82%"}
        tilt={"-0.2243994753rad"}
        scale={0.9}
      >
        <ManualLayout />

        <DiagramGroup
          id="snapshot-group"
          label="Scenes are snapshots — declare state, not animation"
          variant="swimlane"
        >
          <DiagramNode
            id="snap-a"
            label="Scene A"
            sublabel="Camera: [0, 2, 8] · Lighting: soft · Background: #111"
                       icon="ui:document-text"
            position={["22%", "50%", 0]}
            size={["22u", "14u"]}
          />
          <DiagramNode
            id="snap-b"
            label="Scene B"
            sublabel="Camera: [-4, 3, 6] · Lighting: dramatic · (inherits)"
                       icon="ui:document-text"
            position={["78%", "50%", 0]}
            size={["22u", "14u"]}
                       glow={{ intensity: 0.15 }}
          />
        </DiagramGroup>

        <DiagramNode
          id="snap-transition"
          label="Auto-transition"
          sublabel="Compiler bakes interpolation into SceneTrack."
                   icon="ui:arrows-right-left"
          position={["50%", "50%", 0]}
          size={["18u", "14u"]}
        />

        <DiagramEdge from="snap-a" to="snap-transition" label="declare" flow="forward" />
        <DiagramEdge from="snap-transition" to="snap-b" label="declare" flow="forward" />
      </Diagram>

      <TextBox id="cs-scene-dsl-caption" x={"2%"} y={0.0} w={"96%"} h={"16%"}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' }}>
          <p style={{ fontSize: 'clamp(12px, 1.4vw, 15px)', color: 'var(--ex-text)', lineHeight: 1.6, margin: 0, maxWidth: 640 }}>
            Each <code style={{ color: 'var(--ex-accent-text)', fontFamily: 'monospace' }}>&lt;Scene&gt;</code> is a complete world snapshot. Elements not re-declared carry forward. Declare only what changes.
          </p>
        </div>
      </TextBox>
    </View>
  </Scene>
);

// ─── SCENE 4: Scene Transition — Same IDs, auto-morph ──────────────────────

export const SceneTransitionScene = (): JSX.Element => (
  <Scene id="cs-scene-transition">
    <ProgressManager scrollUnits={1400} />
    <Camera mode="world" position={[0, 4, 22]} target={[0, 0, 0]} fov={"50deg"} />

    <View id="cs-stage" x={V.x} y={V.y} w={V.w} h={V.h}>
      <Diagram
        id="cs-scene-dsl-diagram"
        x={0}
        y={"18%"}
        w={"100%"}
        h={"82%"}
        tilt={"-0.09817477042rad"}
        scale={1.1}
      >
        <ManualLayout />

        <DiagramGroup
          id="snapshot-group"
          label="Same widget ID → smooth auto-transition between scenes"
          variant="swimlane"
        >
          <DiagramNode
            id="snap-a"
            label="Scene A"
            sublabel="Camera: [0, 2, 8] · Lighting: soft"
                       icon="ui:document-text"
            position={["15%", "50%", 0]}
            size={["22u", "14u"]}
          />
          <DiagramNode
            id="snap-b"
            label="Scene B"
            sublabel="Camera: [-4, 3, 6] · Lighting: dramatic"
                       icon="ui:document-text"
            position={["50%", "50%", 0]}
            size={["22u", "14u"]}
                       glow={{ intensity: 0.2 }}
          />
          <DiagramNode
            id="snap-c"
            label="Scene C"
            sublabel="Camera: [3, 1.5, 5] · (inherits lighting)"
                       icon="ui:document-text"
            position={["85%", "50%", 0]}
            size={["22u", "14u"]}
                       glow={{ intensity: 0.1 }}
          />
        </DiagramGroup>

        <DiagramEdge from="snap-a" to="snap-b" label="morph" flow="forward" />
        <DiagramEdge from="snap-b" to="snap-c" label="morph" flow="forward" />
      </Diagram>

      <TextBox id="cs-transition-caption" x={"2%"} y={0.0} w={"96%"} h={"16%"}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' }}>
          <p style={{ fontSize: 'clamp(12px, 1.4vw, 15px)', color: 'var(--ex-text)', lineHeight: 1.6, margin: 0, maxWidth: 640 }}>
            The diagram above morphed from the previous scene — same <code style={{ color: 'var(--ex-accent-text)', fontFamily: 'monospace' }}>id</code>, different props. A third node appeared — added only in this scene.
          </p>
        </div>
      </TextBox>
    </View>
  </Scene>
);

// ─── SCENE 5: Compiler Pipeline ─────────────────────────────────────────────

export const CompilerScene = (): JSX.Element => (
  <Scene id="cs-compiler">
    <ProgressManager scrollUnits={1600} />
    <Camera mode="world" position={[0, 6, 28]} target={[0, 0, 0]} fov={"52deg"} />
    <Lighting intensityScale={1}>
      <Ambient intensity={0.9} color="#ffffff" />
      <Directional intensity={0.6} color="#99bbff" position={[0, 18, 22]} />
      <Directional intensity={0.4} color="#aa88ff" position={[-10, 4, 12]} />
    </Lighting>
    <Background />

    <View id="cs-stage" x={V.x} y={V.y} w={V.w} h={V.h}>
      <Diagram
        id="cs-compiler-diagram"
        x={0}
        y={"18%"}
        w={"100%"}
        h={"82%"}
        tilt={"-0.2243994753rad"}
        scale={1.0}
      >
        <ManualLayout />

        <DiagramNode id="cmp-jsx" label="Scene JSX" sublabel="<Scene> children: Camera, Lighting, Charts…" icon="ui:code-bracket-square" position={["10%", "50%", 0]} size={["14u", "14u"]} />
        <DiagramNode id="cmp-dsl" label="sceneDslCompiler" sublabel="JSX tree → NodeHandler dispatch" icon="ui:arrows-right-left" position={["30%", "50%", 0]} size={["14u", "14u"]} />
        <DiagramNode id="cmp-frames" label="SceneFrame[]" sublabel="one per scene · widget states" icon="ui:squares-2x2" position={["50%", "50%", 0]} size={["14u", "14u"]} />
        <DiagramNode id="cmp-baker" label="sceneTrackCompiler" sublabel="bakes tick[] · transitions pre-interpolated" icon="ui:cpu-chip" position={["70%", "50%", 0]} size={["14u", "14u"]} />
        <DiagramNode id="cmp-track" label="SceneTrack" sublabel="flat tick[] · O(1) lookup" icon="ui:circle-stack" position={["90%", "50%", 0]} size={["14u", "14u"]} glow={{ intensity: 0.25 }} />

        <DiagramEdge from="cmp-jsx" to="cmp-dsl" label="JSX tree" flow="forward" />
        <DiagramEdge from="cmp-dsl" to="cmp-frames" label="SceneState" flow="forward" />
        <DiagramEdge from="cmp-frames" to="cmp-baker" label="SceneFrame[]" flow="forward" />
        <DiagramEdge from="cmp-baker" to="cmp-track" label="tick[]" flow="forward" />
      </Diagram>

      <TextBox id="cs-compiler-caption" x={"2%"} y={0.0} w={"96%"} h={"16%"}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' }}>
          <p style={{ fontSize: 'clamp(12px, 1.4vw, 14px)', color: 'var(--ex-text)', lineHeight: 1.6, margin: 0, maxWidth: 660 }}>
            Pure compiler pipeline — zero Three.js, zero React. Runs once at mount. The runtime calls{' '}
            <code style={{ color: 'var(--ex-accent-text)', fontFamily: 'monospace' }}>sceneTrackSampler(track, progress)</code> — O(1) — every frame.
          </p>
        </div>
      </TextBox>
    </View>
  </Scene>
);

// ─── SCENE 6: Camera World Mode ─────────────────────────────────────────────

export const CameraWorldScene = (): JSX.Element => (
  <Scene id="cs-camera-world">
    <ProgressManager scrollUnits={1200} />
    <Camera mode="world" position={[3, 2.5, 9]} target={[0, 0.5, 0]} fov={"45deg"} />
    <SoftLighting />
    <Background />
    <Floor variant="grid" negativeZExtent={18} />

    <View id="cs-stage" x={V.x} y={V.y} w={V.w} h={V.h}>
      <TextBox id="cs-cam-world-card" x={"2%"} y={"4%"} w={"50%"} h={"92%"}>
        <div
          style={{
            height: '100%',
            padding: '24px 28px',
            background: 'var(--ex-overlay-surface)',
            backdropFilter: 'blur(16px)',
            borderRadius: 8,
            border: '1px solid var(--ex-accent-border)',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ex-text-muted)', fontFamily: 'monospace', marginBottom: 10 }}>
            Camera · mode="world"
          </div>
          <h2 style={{ fontSize: 'clamp(16px, 2vw, 24px)', color: 'var(--ex-text)', margin: '0 0 12px', fontWeight: 600 }}>
            Explicit position + look-at
          </h2>
          <p style={{ fontSize: 'clamp(11px, 1.2vw, 13px)', color: 'var(--ex-text)', lineHeight: 1.7, margin: '0 0 14px' }}>
            World mode places the camera at an explicit world-space{' '}
            <code style={{ color: 'var(--ex-accent-text)', fontFamily: 'monospace' }}>position</code> and
            looks at a <code style={{ color: 'var(--ex-accent-text)', fontFamily: 'monospace' }}>target</code>.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px', fontSize: 'clamp(10px, 1vw, 12px)', color: 'var(--ex-text-muted)' }}>
            {(['world', 'orbit', 'fitBotHeight', 'fitFloorDepth', 'nvsViewport'] as const).map((m) => (
              <div key={m} style={{ padding: '4px 8px', background: m === 'world' ? 'var(--ex-accent-surface)' : 'var(--ex-surface)', borderRadius: 4, fontFamily: 'monospace' }}>
                {m === 'world' ? `→ ${m}` : m}
              </div>
            ))}
          </div>
        </div>
      </TextBox>
    </View>
  </Scene>
);

// ─── SCENE 7: Camera Orbit Mode ─────────────────────────────────────────────

export const CameraOrbitScene = (): JSX.Element => (
  <Scene id="cs-camera-orbit">
    <ProgressManager scrollUnits={1200} />
    <Camera mode="orbit" target={[0, 0, 0]} azimuth={"0.5rad"} polar={"1.1rad"} distance={8} fov={"50deg"} />
    <SoftLighting />
    <Background />
    <Floor variant="grid" negativeZExtent={18} />

    <View id="cs-stage" x={V.x} y={V.y} w={V.w} h={V.h}>
      <TextBox id="cs-cam-orbit-card" x={"48%"} y={"4%"} w={"50%"} h={"92%"}>
        <div
          style={{
            height: '100%',
            padding: '24px 28px',
            background: 'var(--ex-overlay-surface)',
            backdropFilter: 'blur(16px)',
            borderRadius: 8,
            border: '1px solid var(--ex-accent-border)',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ex-text-muted)', fontFamily: 'monospace', marginBottom: 10 }}>
            Camera · mode="orbit"
          </div>
          <h2 style={{ fontSize: 'clamp(16px, 2vw, 24px)', color: 'var(--ex-text)', margin: '0 0 12px', fontWeight: 600 }}>
            Spherical around a target
          </h2>
          <p style={{ fontSize: 'clamp(11px, 1.2vw, 13px)', color: 'var(--ex-text)', lineHeight: 1.7, margin: '0 0 14px' }}>
            Orbit mode defines the camera as <code style={{ color: 'var(--ex-accent-text)', fontFamily: 'monospace' }}>azimuth</code>,{' '}
            <code style={{ color: 'var(--ex-accent-text)', fontFamily: 'monospace' }}>polar</code>, and{' '}
            <code style={{ color: 'var(--ex-accent-text)', fontFamily: 'monospace' }}>distance</code> from a pivot point.
            Natural for turntable and rotation animations.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px', fontSize: 'clamp(10px, 1vw, 12px)', color: 'var(--ex-text-muted)' }}>
            {(['world', 'orbit', 'fitBotHeight', 'fitFloorDepth', 'nvsViewport'] as const).map((m) => (
              <div key={m} style={{ padding: '4px 8px', background: m === 'orbit' ? 'var(--ex-accent-surface)' : 'var(--ex-surface)', borderRadius: 4, fontFamily: 'monospace' }}>
                {m === 'orbit' ? `→ ${m}` : m}
              </div>
            ))}
          </div>
        </div>
      </TextBox>
    </View>
  </Scene>
);

// ─── SCENE 8: Lighting — Soft ───────────────────────────────────────────────

export const LightingSoftScene = (): JSX.Element => (
  <Scene id="cs-lighting-soft">
    <ProgressManager scrollUnits={1200} />
    <Camera mode="world" position={[0, 8, 32]} target={[0, 0, 0]} fov={"50deg"} />
    <SoftLighting />
    <Background />

    <View id="cs-stage" x={V.x} y={V.y} w={V.w} h={V.h}>
      <Diagram
        id="cs-lighting-diagram"
        x={0}
        y={"18%"}
        w={"100%"}
        h={"82%"}
        tilt={"-0.2617993878rad"}
        scale={1.0}
      >
        <ManualLayout />
        <DiagramNode id="lt-ambient" label="Ambient" sublabel="0.8 intensity · #d7e8ff" icon="ui:light-bulb" position={["20%", "35%", 0]} size={["16u", "14u"]} />
        <DiagramNode id="lt-directional-1" label="Directional A" sublabel="0.9 intensity · #ffffff · [4, 10, 6]" icon="ui:bolt" position={["50%", "35%", 0]} size={["16u", "14u"]} />
        <DiagramNode id="lt-directional-2" label="Directional B" sublabel="0.4 intensity · #b0ccff · [-6, 4, 8]" icon="ui:bolt" position={["80%", "35%", 0]} size={["16u", "14u"]} />
        <DiagramNode id="lt-result" label="Soft Result" sublabel="Professional presentation lighting" icon="ui:light-bulb" position={["50%", "72%", 0]} size={["22u", "14u"]} glow={{ intensity: 0.1 }} />
        <DiagramEdge from="lt-ambient" to="lt-result" flow="forward" style="dashed" />
        <DiagramEdge from="lt-directional-1" to="lt-result" flow="forward" />
        <DiagramEdge from="lt-directional-2" to="lt-result" flow="forward" style="dashed" />
      </Diagram>

      <TextBox id="cs-lighting-soft-caption" x={"2%"} y={0.0} w={"96%"} h={"16%"}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' }}>
          <p style={{ fontSize: 'clamp(12px, 1.4vw, 15px)', color: 'var(--ex-text)', lineHeight: 1.6, margin: 0, maxWidth: 640 }}>
            Soft professional lighting — high ambient fill, two directionals. Scroll to see the same diagram under dramatic lighting.
          </p>
        </div>
      </TextBox>
    </View>
  </Scene>
);

// ─── SCENE 9: Lighting — Dramatic ───────────────────────────────────────────

export const LightingDramaticScene = (): JSX.Element => (
  <Scene id="cs-lighting-dramatic">
    <ProgressManager scrollUnits={1200} />
    <Camera mode="world" position={[0, 8, 32]} target={[0, 0, 0]} fov={"50deg"} />
    <Lighting intensityScale={1.2}>
      <Ambient intensity={0.15} color="#0a0a20" />
      <Directional intensity={2.0} color="#ff6030" position={[8, 12, 4]} />
      <Directional intensity={0.8} color="#3060ff" position={[-8, 2, 6]} />
      <GlowPoint intensity={2.5} color="#ff4020" position={[4, 3, 2]} />
      <GlowPoint intensity={1.8} color="#2040ff" position={[-4, 2, 2]} />
    </Lighting>
    <Background color="#0a0208" />

    <View id="cs-stage" x={V.x} y={V.y} w={V.w} h={V.h}>
      <Diagram
        id="cs-lighting-diagram"
        x={0}
        y={"18%"}
        w={"100%"}
        h={"82%"}
        tilt={"-0.2617993878rad"}
        scale={1.0}
      >
        <ManualLayout />
        <DiagramNode id="lt-ambient" label="Ambient" sublabel="0.15 intensity · #0a0a20" sublabelColor="#ffccaa" icon="ui:light-bulb" position={["20%", "35%", 0]} size={["16u", "14u"]} />
        <DiagramNode id="lt-directional-1" label="Directional A" sublabel="2.0 intensity · #ff6030 · warm key" sublabelColor="#ffccaa" icon="ui:bolt" position={["50%", "35%", 0]} size={["16u", "14u"]} color="#3a1808" />
        <DiagramNode id="lt-directional-2" label="Directional B" sublabel="0.8 intensity · #3060ff · cool fill" sublabelColor="#aac8ff" icon="ui:bolt" position={["80%", "35%", 0]} size={["16u", "14u"]} color="#0a1840" />
        <DiagramNode id="lt-result" label="Dramatic Result" sublabel="Cinematic warm/cool bi-tone + GlowPoint sprites" sublabelColor="#ffccaa" icon="ui:light-bulb" position={["50%", "72%", 0]} size={["22u", "14u"]} color="#301020" glow={{ intensity: 0.3 }} />
        <DiagramEdge from="lt-ambient" to="lt-result" flow="forward" style="dashed" />
        <DiagramEdge from="lt-directional-1" to="lt-result" flow="forward" />
        <DiagramEdge from="lt-directional-2" to="lt-result" flow="forward" />
      </Diagram>

      <TextBox id="cs-lighting-dramatic-caption" x={"2%"} y={0.0} w={"96%"} h={"16%"}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' }}>
          <p style={{ fontSize: 'clamp(12px, 1.4vw, 15px)', color: 'rgba(255, 200, 170, 0.85)', lineHeight: 1.6, margin: 0, maxWidth: 640 }}>
            Same diagram, different <code style={{ color: 'rgba(255, 180, 140, 0.9)', fontFamily: 'monospace' }}>&lt;Lighting&gt;</code>. Warm key + cool fill + <code style={{ fontFamily: 'monospace' }}>GlowPoint</code> sprites. The auto-transition morphed between lighting states.
          </p>
        </div>
      </TextBox>
    </View>
  </Scene>
);

// ─── SCENE 10: Charts — Year A ──────────────────────────────────────────────

export const ChartAScene = (): JSX.Element => {
  return (
    <Scene id="cs-chart-a">
      <ProgressManager scrollUnits={1200} />
      <Camera mode="world" position={[0, 1.5, 6.6]} target={[0, 0.08, 0]} fov={"42deg"} />
      <Lighting intensityScale={1.3}>
        <Ambient intensity={0.9} color="#d7e5ff" />
        <Directional intensity={1.1} color="#edf4ff" position={[0, 2, 10]} />
        <Directional intensity={0.5} color="#59cfff" position={[0, 0.5, 7]} />
      </Lighting>
      <Background />
      <Floor variant="grid" negativeZExtent={16} />

      <View id="cs-stage" x={V.x} y={V.y} w={V.w} h={V.h}>
        <BarChart
          id="framework-adoption"
          data={frameworkDataA}
          x={"10%"}
          y={"18%"}
          w={"80%"}
          h={"72%"}
          depth={0.4}
          interactive
        >
          <ChartData keyField="framework" />
          <ChartAxis axis="x" field="framework" label="Framework" />
          <ChartAxis axis="y" field="adoption" label="Adoption %" />
          <ChartSeries field="adoption" label="Adoption" />
          <ChartSeries field="satisfaction" label="Satisfaction" />
        </BarChart>

        <TextBox id="cs-chart-a-caption" x={"2%"} y={0.0} w={"96%"} h={"16%"}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' }}>
            <p style={{ fontSize: 'clamp(12px, 1.4vw, 15px)', color: 'var(--ex-text)', lineHeight: 1.6, margin: 0, maxWidth: 620 }}>
              <code style={{ color: 'var(--ex-accent-text)', fontFamily: 'monospace' }}>&lt;BarChart&gt;</code> with <code style={{ fontFamily: 'monospace' }}>id="framework-adoption"</code> — 2024 survey data. Scroll to see it morph.
            </p>
          </div>
        </TextBox>
      </View>
    </Scene>
  );
};

// ─── SCENE 11: Charts — Year B (morph!) ─────────────────────────────────────

export const ChartBScene = (): JSX.Element => {
  return (
    <Scene id="cs-chart-b">
      <ProgressManager scrollUnits={1200} />
      <Camera mode="world" position={[0, 1.5, 6.6]} target={[0, 0.08, 0]} fov={"42deg"} />
      <Background />
      <Floor variant="grid" negativeZExtent={16} />

      <View id="cs-stage" x={V.x} y={V.y} w={V.w} h={V.h}>
        <BarChart
          id="framework-adoption"
          data={frameworkDataB}
          x={"10%"}
          y={"18%"}
          w={"80%"}
          h={"72%"}
          depth={0.4}
        >
          <ChartData keyField="framework" />
          <ChartAxis axis="x" field="framework" label="Framework" />
          <ChartAxis axis="y" field="adoption" label="Adoption %" />
          <ChartSeries field="adoption" label="Adoption" />
          <ChartSeries field="satisfaction" label="Satisfaction" />
        </BarChart>

        <TextBox id="cs-chart-b-caption" x={"2%"} y={0.0} w={"96%"} h={"16%"}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' }}>
            <p style={{ fontSize: 'clamp(12px, 1.4vw, 15px)', color: 'var(--ex-text)', lineHeight: 1.6, margin: 0, maxWidth: 620 }}>
              Same chart ID, different data → <strong>datum-level bar morphing</strong>. No animation code. The compiler matched <code style={{ fontFamily: 'monospace' }}>keyField="framework"</code> across scenes.
            </p>
          </div>
        </TextBox>
      </View>
    </Scene>
  );
};

// ─── SCENE 12: Input & Interaction ──────────────────────────────────────────

export const InputScene = (): JSX.Element => (
  <Scene id="cs-input">
    <ProgressManager scrollUnits={1400} />
    <Camera
      mode="orbit"
      target={[0, 0, 0]}
      azimuth={0}
      polar={"1rad"}
      distance={7}
      fov={"50deg"}
    />
    <SoftLighting />
    <Background />

    <InputController scope="canvas" mode="replace">
      <Action id="cs-orbit" type="camera.orbit">
        <PointerMap event="drag" button="left" axis="y" />
      </Action>
      <Action id="cs-pan" type="camera.pan">
        <WheelMap axis="xy" modifiers={["shift"]}/>
      </Action>
      <Action id="cs-orbit-all" type="camera.orbit">
        <WheelMap axis="xy" modifiers={["meta"]}/>
      </Action>
      <Action id="cs-dolly" type="camera.zoom">
        <WheelMap axis="xy" modifiers={["ctrl"]}/>
      </Action>
      <Action id="cs-reset" type="camera.reset">
        <KeyMap keyName="r" />
      </Action>
    </InputController>

    <View id="cs-stage" x={V.x} y={V.y} w={V.w} h={V.h}>
      <Diagram
        id="cs-input-diagram"
        x={0}
        y={"18%"}
        w={"100%"}
        h={"82%"}
        tilt={"-0.3926990817rad"}
        scale={1.0}
      >
        <ManualLayout />
        <DiagramGroup id="input-group" label="InputController + Action — gesture-to-action mapping" variant="swimlane">
          <DiagramNode id="inp-drag" label="Drag → orbit" sublabel="<Action type='camera.orbit'>" icon="ui:arrow-path" position={["20%", "40%", 0]} size={["18u", "15u"]} />
          <DiagramNode id="inp-wheel" label="Wheel → zoom" sublabel="<Action type='camera.zoom'>" icon="ui:arrows-pointing-out" position={["50%", "40%", 0]} size={["18u", "15u"]} />
          <DiagramNode id="inp-key" label="'r' → reset" sublabel="<Action type='camera.reset'>" icon="ui:arrow-path" position={["80%", "40%", 0]} size={["18u", "15u"]} />
        </DiagramGroup>
        <DiagramNode id="inp-camera" label="CameraWidget" sublabel="receives dispatched actions" icon="ui:eye" position={["50%", "75%", 0]} size={["22u", "14u"]} glow={{ intensity: 0.15 }} />
        <DiagramEdge from="inp-drag" to="inp-camera" flow="forward" />
        <DiagramEdge from="inp-wheel" to="inp-camera" flow="forward" />
        <DiagramEdge from="inp-key" to="inp-camera" flow="forward" />
      </Diagram>

      <TextBox id="cs-input-caption" x={"2%"} y={0.0} w={"96%"} h={"16%"}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' }}>
          <p style={{ fontSize: 'clamp(12px, 1.4vw, 15px)', color: 'var(--ex-text)', lineHeight: 1.6, margin: 0, maxWidth: 620 }}>
            Try it: <strong>drag to orbit in y only</strong>, <strong>control + scroll to zoom</strong>, <strong>shift + scroll to move camera</strong>, <strong>Cmd + scroll to orbit</strong>, <strong>press R to reset</strong>. This scene uses <code style={{ fontFamily: 'monospace' }}>mode="replace"</code> to override all defaults. Merge mode (the default) preserves standard bindings automatically.
          </p>
        </div>
      </TextBox>
    </View>
  </Scene>
);

// ─── SCENE 13: Theming ──────────────────────────────────────────────────────

export const ThemingScene = (): JSX.Element => (
  <Scene id="cs-theming">
    <ProgressManager scrollUnits={1400} />
    <Camera mode="world" position={[0, 6, 28]} target={[0, 0, 0]} fov={"50deg"} />
    <SoftLighting />
    <Background />

    <View id="cs-stage" x={V.x} y={V.y} w={V.w} h={V.h}>
      <Diagram
        id="cs-theming-diagram"
        x={"50%"}
        y={0.0}
        w={"50%"}
        h={"100%"}
        tilt={"-0.2243994753rad"}
      >
        <ManualLayout />
        <DiagramNode id="thm-engine" label="SceneEngine" sublabel="themeFamily · themePolarity" icon="ui:cpu-chip" position={["50%", "20%", 0]} size={["35u", "14u"]} glow={{ intensity: 0.15 }} />
        <DiagramNode id="thm-core" label="@brewsite/core" sublabel="CSS vars · EngineOverlayHost" icon="ui:swatch" position={["25%", "55%", 0]} size={["28u", "14u"]} />
        <DiagramNode id="thm-diagram" label="@brewsite/diagram" sublabel="node/edge/group materials" icon="ui:squares-2x2" position={["75%", "55%", 0]} size={["28u", "14u"]} />
        <DiagramNode id="thm-charts" label="@brewsite/charts" sublabel="palette · axis · grid colors" icon="ui:chart-bar" position={["50%", "85%", 0]} size={["28u", "14u"]} />
        <DiagramEdge from="thm-engine" to="thm-core" flow="forward" />
        <DiagramEdge from="thm-engine" to="thm-diagram" flow="forward" />
        <DiagramEdge from="thm-core" to="thm-charts" style="dashed" />
        <DiagramEdge from="thm-diagram" to="thm-charts" style="dashed" />
      </Diagram>

      <TextBox id="cs-theming-card" x={"2%"} y={"4%"} w={"44%"} h={"92%"}>
        <div
          style={{
            height: '100%',
            padding: '24px 28px',
            background: 'var(--ex-overlay-surface)',
            backdropFilter: 'blur(16px)',
            borderRadius: 8,
            border: '1px solid var(--ex-accent-border)',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ex-text-muted)', fontFamily: 'monospace', marginBottom: 10 }}>
            Cross-Package Theming
          </div>
          <h2 style={{ fontSize: 'clamp(16px, 2vw, 22px)', color: 'var(--ex-text)', margin: '0 0 14px', fontWeight: 600 }}>
            6 families × 2 polarities
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 'clamp(10px, 1vw, 11px)', fontFamily: 'monospace' }}>
            {['darkGlass', 'midnight', 'neonCyber', 'enterprise', 'lightCanvas', 'lightMinimal'].map((f) => (
              <div key={f} style={{ padding: '5px 8px', background: f === 'darkGlass' ? 'var(--ex-accent-surface)' : 'var(--ex-surface)', borderRadius: 4, color: 'var(--ex-text-muted)' }}>
                {f}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 'clamp(10px, 1.1vw, 12px)', color: 'var(--ex-text-muted)', lineHeight: 1.7, marginTop: 12 }}>
            Set <code style={{ color: 'var(--ex-accent-text)' }}>themeFamily</code> on <code style={{ color: 'var(--ex-accent-text)' }}>SceneEngine</code> — flows to all widgets automatically. CSS variables for overlays. WebGL font URL for diagram/chart labels.
          </p>
        </div>
      </TextBox>
    </View>
  </Scene>
);

// ─── SCENE 14: Summary ──────────────────────────────────────────────────────

export const SummaryScene = (): JSX.Element => (
  <Scene id="cs-summary">
    <ProgressManager scrollUnits={1200} />
    <Camera mode="world" position={[0, 3, 10]} target={[0, 0, 0]} fov={"48deg"} />
    <HeroLighting />
    <Background />
    <Floor variant="grid" negativeZExtent={24} />

    <View id="cs-stage" x={V.x} y={V.y} w={V.w} h={V.h}>
      <TextBox id="summary-title" x={"2%"} y={"10%"} w={"96%"} h={"80%"}>
        <div
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: 'clamp(24px, 4.5vw, 52px)', fontWeight: 700, color: 'var(--ex-text)', margin: '0 0 18px', lineHeight: 1.15 }}>
            Start Building
          </h1>
          <p style={{ fontSize: 'clamp(12px, 1.4vw, 16px)', color: 'var(--ex-text)', lineHeight: 1.7, maxWidth: 460, margin: '0 0 24px' }}>
            Declare scenes as JSX snapshots. The compiler bakes every transition. The runtime samples at O(1). You ship the result.
          </p>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 'clamp(11px, 1.2vw, 14px)', color: 'var(--ex-accent-text)', padding: '10px 22px', background: 'var(--ex-accent-surface)', border: '1px solid var(--ex-accent-border)', borderRadius: 6 }}>
            npm install @brewsite/core
          </div>
        </div>
      </TextBox>
    </View>
  </Scene>
);

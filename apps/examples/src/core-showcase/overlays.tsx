// TopChrome and BottomChrome overlay components for the Core Showcase.
// Both must live inside <SceneEngine> so they can call useCurrentScene().
import type { JSX } from 'react';
import { useCurrentScene } from '@brewsite/core';

// ─── Per-scene metadata ───────────────────────────────────────────────────────

interface SceneMetadata {
  section: string;
  code: string;
}

const SCENE_META: Record<string, SceneMetadata> = {
  'cs-hero': {
    section: 'Introduction · BrewSite Core',
    code: `import { SceneEngine, ScrollStage, SceneCanvas,
  EngineOverlayHost, InputCoordinator } from '@brewsite/core';

export default function MyPage() {
  return (
    <SceneEngine plugins={plugins} theme={{ family: 'darkGlass', polarity: 'dark' }}>
      <MyScene />
      <ScrollStage scrollHeightMode="scene-count" pixelsPerScene={1200}>
        <SceneCanvas style={{ position: 'absolute', inset: 0 }} />
        <EngineOverlayHost passthroughPointerEvents />
        <InputCoordinator />
      </ScrollStage>
    </SceneEngine>
  );
}`,
  },

  'cs-overview': {
    section: 'Act 1 · Architecture Overview',
    code: `// The four-layer mental model:
// Author (DSL) → Compile → Execute → Output
//
// <Scene> JSX is compiled once at startup into a flat SceneTrack.
// The runtime samples it at O(1) per frame — no diffing, no reconciliation.`,
  },

  'cs-scene-dsl': {
    section: 'Act 2 · Scene Authoring — Snapshots',
    code: `import { Scene, Camera, Lighting, Ambient, Directional,
  Background, ProgressManager } from '@brewsite/core';

export const sceneIntro = (
  <Scene key="intro">
    <ProgressManager scrollUnits={1200} />
    <Camera mode="world" position={[0, 2, 8]} target={[0, 1, 0]} fov={45} />
    <Lighting intensityScale={1}>
      <Ambient intensity={0.6} color="#ffffff" />
      <Directional intensity={1.2} color="#ffffff" position={[5, 10, 5]} />
    </Lighting>
    <Background color="#0a0a14" />
  </Scene>
);`,
  },

  'cs-scene-transition': {
    section: 'Act 2 · Scene Authoring — Auto-Transition',
    code: `// Same diagram ID across scenes → smooth auto-interpolation.
// The compiler detects matching IDs and bakes the transition into SceneTrack.
// You describe the start and end state — the engine handles everything between.

const sceneA = <Scene key="a"><Diagram id="my-diagram" tilt={-Math.PI/4} /></Scene>;
const sceneB = <Scene key="b"><Diagram id="my-diagram" tilt={-Math.PI/12} /></Scene>;
//                                       ^^^^^^^^^^^^ same ID → auto-morph`,
  },

  'cs-compiler': {
    section: 'Act 3 · Compiler Pipeline',
    code: `// The compiler pipeline (pure functions, no Three.js):
//
//  Scene JSX
//    └─► sceneDslCompiler    walks JSX tree, dispatches to NodeHandlers
//          └─► SceneFrame[]  one snapshot per scene
//              └─► sceneTrackCompiler   bakes tick[] with transitions pre-interpolated
//                    └─► SceneTrack    O(1) lookup: sceneTrackSampler(track, progress)
//
// The track is compiled once at mount and never changes.
// Playback calls sceneTrackSampler(track, progress) — no JSX, no diffing.`,
  },

  'cs-camera-world': {
    section: 'Act 4 · Camera — World Mode',
    code: `<Camera
  mode="world"
  position={[0, 2, 8]}   // [x, y, z] in world units
  target={[0, 1, 0]}     // look-at point
  fov={45}               // field of view in degrees
  exposure={1.0}         // tone-mapping exposure
/>`,
  },

  'cs-camera-orbit': {
    section: 'Act 4 · Camera — Orbit Mode',
    code: `<Camera
  mode="orbit"
  target={[0, 0, 0]}     // pivot point
  azimuth={0.3}          // horizontal angle in radians
  polar={1.1}            // vertical angle from equator
  distance={7}           // distance from target
  fov={50}
  interaction={{
    enabled: true,
    rotate: { key: 'none', sensitivity: 0.8 },
    zoom: { key: 'none', sensitivity: 0.5 },
    wheelZoom: { enabled: true },
    damping: 0.08,
  }}
/>`,
  },

  'cs-lighting-soft': {
    section: 'Act 5 · Lighting — Soft / Professional',
    code: `<Lighting intensityScale={1}>
  <Ambient intensity={0.8} color="#d7e8ff" />
  <Directional intensity={0.9} color="#ffffff" position={[4, 10, 6]} />
  <Directional intensity={0.4} color="#b0ccff" position={[-6, 4, 8]} />
</Lighting>`,
  },

  'cs-lighting-dramatic': {
    section: 'Act 5 · Lighting — Dramatic / Cinematic',
    code: `<Lighting intensityScale={1.2}>
  <Ambient intensity={0.15} color="#0a0a20" />
  <Directional intensity={2.0} color="#ff6030" position={[8, 12, 4]} />
  <Directional intensity={0.8} color="#3060ff" position={[-8, 2, 6]} />
  <GlowPoint intensity={2.5} color="#ff4020" position={[4, 3, 2]} />
  <GlowPoint intensity={1.8} color="#2040ff" position={[-4, 2, 2]} />
</Lighting>
// <GlowPoint> = sprite billboard glow — zero illumination cost, pure atmosphere.`,
  },

  'cs-chart-a': {
    section: 'Act 6 · Charts — BarChart DSL',
    code: `import { BarChart, ChartData, ChartAxis, ChartSeries } from '@brewsite/charts';

<BarChart
  id="framework-adoption"   // stable ID — same across morphing scenes
  data={frameworkDataA}
  theme={chartTheme}
  x={0.3} y={0.3} w={0.4} h={0.35}
  depth={0.4}
>
  <ChartData keyField="framework" />
  <ChartAxis axis="x" field="framework" label="Framework" />
  <ChartAxis axis="y" field="adoption" label="Adoption %" />
  <ChartSeries field="adoption" label="Adoption" />
  <ChartSeries field="satisfaction" label="Satisfaction" />
</BarChart>`,
  },

  'cs-chart-b': {
    section: 'Act 6 · Charts — Same ID, Different Data → Auto-Morph',
    code: `// Scene B — same chart ID "framework-adoption", different data array.
// The compiler detects the shared ID and bakes datum-level bar morphing
// into the SceneTrack. No animation code needed.

<BarChart
  id="framework-adoption"   // ← same ID as Scene A
  data={frameworkDataB}     // ← different values → bars morph automatically
  theme={chartTheme}
  x={0.3} y={0.3} w={0.4} h={0.35}
  depth={0.4}
>
  <ChartData keyField="framework" />
  <ChartSeries field="adoption" label="Adoption" />
  <ChartSeries field="satisfaction" label="Satisfaction" />
</BarChart>`,
  },

  'cs-input': {
    section: 'Act 7 · Input — InputController DSL',
    code: `import { InputController, Action, PointerMap, WheelMap, KeyMap } from '@brewsite/core';

<InputController scope="canvas">
  <Action id="orbit" type="camera.orbit">
    <PointerMap event="drag" button="left" axis="xy" />
  </Action>
  <Action id="dolly" type="camera.zoom">
    <WheelMap axis="y" />
  </Action>
  <Action id="reset" type="camera.reset">
    <KeyMap keyName="r" />
    <PointerMap event="click" modifiers={['alt']} />
  </Action>
</InputController>`,
  },

  'cs-theming': {
    section: 'Act 8 · Theming — 6 Families × 2 Polarities = 12 Presets',
    code: `// Themes flow from SceneEngine down to all widgets automatically.
// No per-element theme wiring needed.

<SceneEngine
  plugins={plugins}
  theme={{ family: 'enterprise', polarity: 'light' }}  // 'darkGlass' | 'midnight' | 'neonCyber' | 'enterprise' | 'lightCanvas' | 'lightMinimal'
>
  {scenes}
</SceneEngine>

// Hooks for theme-aware content:
// const theme = useTheme();          // core SceneTheme
// const chartTheme = useChartTheme(); // chart palette
// const diagramTheme = useDiagramTheme(); // diagram material params`,
  },

  'cs-summary': {
    section: 'Act 9 · Summary — Start Building',
    code: `# Install
npm install @brewsite/core @brewsite/diagram @brewsite/charts

# Key concepts:
# 1. Declare <Scene> snapshots — the compiler handles all transitions
# 2. Same widget ID across scenes → automatic interpolation
# 3. <ProgressManager scrollUnits={n}> controls scroll budget per scene
# 4. <InputController> maps gestures to camera/scene/carousel actions
# 5. <EngineOverlayHost> layers React HTML over the 3D canvas`,
  },
};

function getSceneMeta(sceneId: string): SceneMetadata {
  return (
    SCENE_META[sceneId] ?? {
      section: sceneId,
      code: '',
    }
  );
}

// ─── TopChrome ────────────────────────────────────────────────────────────────

export function TopChrome(): JSX.Element {
  const { id } = useCurrentScene();
  const { section } = getSceneMeta(id);

  return (
    <div
      style={{
        position: 'fixed',
        top: 48,
        left: 0,
        right: 0,
        padding: '20px 32px 20px 32px',
        pointerEvents: 'none',
        zIndex: 100,
        background: 'linear-gradient(rgba(3,5,12,0.55), transparent)',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'rgba(140, 170, 255, 0.75)',
          fontFamily: 'JetBrains Mono, Fira Code, monospace',
        }}
      >
        {section}
      </div>
    </div>
  );
}

// ─── BottomChrome ─────────────────────────────────────────────────────────────

export function BottomChrome(): JSX.Element {
  const { id } = useCurrentScene();
  const { code } = getSceneMeta(id);

  if (!code) return <></>;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 100,
        left: 0,
        right: 0,
        maxHeight: 'min(42vh, 260px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: '20px 32px 24px',
        pointerEvents: 'none',
        zIndex: 100,
        background: 'linear-gradient(transparent, rgba(2,4,12,0.75))',
      }}
    >
      <pre
        style={{
          fontFamily: 'JetBrains Mono, Fira Code, monospace',
          fontSize: '11px',
          color: 'rgba(190, 215, 255, 0.72)',
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          margin: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          maxHeight: 'calc(min(42vh, 260px) - 44px)',
        }}
      >
        {code}
      </pre>
    </div>
  );
}

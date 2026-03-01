import { JSX } from 'react';
import {
  Scene,
  Camera,
  Lighting,
  Ambient,
  Directional,
  Background,
  ProgressManager,
} from '@brewsite/core';
import { DWELL_FN } from '../../sceneUtils';
import { DocPanel } from '../../../components/content/DocPanel';
import { DemoProgressProvider, useDemoProgress } from '../../../components/content/DemoProgressProvider';
import { InlineDemo } from '../../../components/demo/InlineDemo';
import { CodeBlock } from '../../../components/ui/CodeBlock';
import { Callout } from '../../../components/ui/Callout';

function CoreConceptsDemo(): JSX.Element {
  const demoProgress = useDemoProgress();
  return (
    <InlineDemo controlledProgress={demoProgress} height={280}>
      <Scene key="cc-s1" id="cc-s1">
        <Camera mode="world" position={[0, 4, 12]} target={[0, 0, 0]} />
        <Lighting>
          <Ambient color="#fff5e0" intensity={0.5} />
          <Directional color="#ffe0b0" intensity={1.2} position={[5, 10, 5]} />
        </Lighting>
        <Background color="#12101e" />
      </Scene>
      <Scene key="cc-s2" id="cc-s2">
        <Camera mode="world" position={[0, 1, 4]} target={[0, 0.5, 0]} />
        <Lighting>
          <Ambient color="#c0d8ff" intensity={0.7} />
          <Directional color="#88ccff" intensity={1.6} position={[-3, 8, 3]} />
        </Lighting>
        <Background color="#0a1220" />
      </Scene>
    </InlineDemo>
  );
}

function CoreConceptsContent(): JSX.Element {
  return (
    <DocPanel slideInBy={0.25}>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', margin: '0 0 8px', fontWeight: 700 }}>
        Core Concepts
      </h1>

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '16px 0 10px' }}>Declarative Scene Snapshots</h2>
      <p style={{ fontSize: 'var(--font-size-base)', lineHeight: 1.65, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
        A BrewSite scene is a pure declaration of what should exist at a moment in time. You
        describe positions, colors, and lighting — never animation curves or frame timings.
        The compiler infers what to animate and how.
      </p>
      <CodeBlock
        language="tsx"
        code={`// Scene A — camera is far back, lit warmly
<Scene key="overview">
  <Camera mode="world" position={[0, 4, 12]} target={[0, 0, 0]} />
  <Lighting>
    <Ambient color="#fff5e0" intensity={0.5} />
  </Lighting>
</Scene>

// Scene B — camera moves in close, lighting shifts cool
<Scene key="detail">
  <Camera mode="world" position={[0, 1, 4]} target={[0, 0.5, 0]} />
  <Lighting>
    <Ambient color="#c0d8ff" intensity={0.7} />
  </Lighting>
</Scene>`}
      />
      <CoreConceptsDemo />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>Pre-Baked SceneTrack</h2>
      <p style={{ fontSize: 'var(--font-size-base)', lineHeight: 1.65, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
        At first render, the compiler generates a flat <code>SceneTrack</code> — a pre-baked array
        of interpolated state for every tick. Advancing progress requires only an array lookup.
        No easing math, no garbage — O(1) per frame.
      </p>
      <pre style={{ fontFamily: 'monospace', fontSize: 13, lineHeight: 1.6, background: 'var(--bg-code)', padding: '16px 20px', borderRadius: 8, border: '1px solid var(--border-subtle)', overflowX: 'auto', margin: '0 0 16px' }}>
        {`Your JSX  →  Compiler  →  SceneTrack  →  Runtime  →  Three.js Frame
(Scenes)     (compile.ts)  (flat array)   (Widgets)   (render.ts)`}
      </pre>

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>The Widget System</h2>
      <p style={{ fontSize: 'var(--font-size-base)', lineHeight: 1.65, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
        Every renderable concept is a <strong>widget</strong>. Camera, Lighting, Background, and
        Floor are all widgets. Build your own using the Widget SDK with the <code>IWidget</code>{' '}
        interface.
      </p>
      <Callout type="note">
        <code>@brewsite/model</code> (GLTF loading, animation playback) is a separate companion
        package and not bundled with <code>@brewsite/core</code>.
      </Callout>
    </DocPanel>
  );
}

export function SceneConcepts(): JSX.Element {
  return (
    <Scene key="scene-concepts" id="scene-concepts">
      <ProgressManager scrollUnits={2400} fn={DWELL_FN} />
      <Camera mode="world" position={[-1, 2, 8]} target={[0, 0.8, 0]} fov={42} />
      <Background color="#0d0f1a" />
      <Lighting>
        <Ambient color="#4466ff" intensity={0.35} />
        <Directional color="#aaccff" intensity={1.5} position={[-3, 10, 6]} />
      </Lighting>

      <DemoProgressProvider startAt={0.25}>
        <CoreConceptsContent />
      </DemoProgressProvider>
    </Scene>
  );
}

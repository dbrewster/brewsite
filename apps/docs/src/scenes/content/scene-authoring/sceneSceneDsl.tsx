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

function SceneDslDemo(): JSX.Element {
  const demoProgress = useDemoProgress();
  return (
    <InlineDemo controlledProgress={demoProgress} height={280}>
      <Scene key="dsl-s1" id="dsl-s1">
        <Camera mode="world" position={[0, 2, 8]} target={[0, 1, 0]} fov={45} />
        <Lighting>
          <Ambient color="#8855ff" intensity={0.4} />
          <Directional color="#ff88ff" intensity={1.5} position={[-4, 8, 4]} />
        </Lighting>
        <Background color="#0f0d1a" />
      </Scene>
      <Scene key="dsl-s2" id="dsl-s2">
        <Camera mode="orbit" target={[0, 1, 0]} azimuth={0.8} polar={1.1} distance={7} />
        <Lighting>
          <Ambient color="#4444ff" intensity={0.5} />
          <Directional color="#aaccff" intensity={1.8} position={[3, 10, 3]} />
        </Lighting>
        <Background color="#080d18" />
      </Scene>
    </InlineDemo>
  );
}

function SceneDslContent(): JSX.Element {
  return (
    <DocPanel slideInBy={0.25}>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', margin: '0 0 8px', fontWeight: 700 }}>Scene DSL</h1>
      <p style={{ fontSize: 'var(--font-size-base)', lineHeight: 1.65, color: 'var(--text-secondary)', margin: '0 0 20px' }}>
        The Scene DSL is a set of JSX components that describe your 3D world as snapshots in time.
        Every component is a <strong>keyframe declaration</strong> — not an animation command.
      </p>

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '0 0 10px' }}>Scene identity</h2>
      <p style={{ fontSize: 'var(--font-size-base)', lineHeight: 1.65, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
        Use the <code>key</code> prop (preferred) or <code>id</code> prop for scene identity.
        The key is how the compiler identifies which scenes to interpolate between.
        Keep scene keys stable — changing them creates new independent scenes.
      </p>
      <CodeBlock
        language="tsx"
        code={`// Preferred — use the React key prop
<Scene key="hero-intro" transition={{ exit: [0, 0.4], enter: [0.6, 1] }}>
  <Camera mode="world" position={[0, 2, 8]} target={[0, 1, 0]} fov={45} />
  <Lighting>
    <Ambient intensity={0.6} color="#ffffff" />
    <Directional intensity={1.2} position={[5, 10, 5]} />
  </Lighting>
  <Background color="#0a0a14" />

  {/* HTML children become overlay content */}
  <div style={{ position: 'absolute', bottom: '8%', left: '6%', color: '#fff' }}>
    <h1>Scene Title</h1>
  </div>
</Scene>`}
      />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>Inheritance rule</h2>
      <p style={{ fontSize: 'var(--font-size-base)', lineHeight: 1.65, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
        Elements not re-declared in a scene <strong>carry forward from the previous scene</strong>.
        Declare only what changes between scenes.
      </p>
      <CodeBlock
        language="tsx"
        code={`// Scene A — declares everything
<Scene key="a">
  <Camera mode="world" position={[0, 2, 8]} target={[0, 1, 0]} />
  <Lighting><Ambient intensity={0.6} /><Directional intensity={1.2} position={[5,10,5]} /></Lighting>
  <Background color="#111" />
</Scene>

// Scene B — only camera changes; Lighting and Background carry forward
<Scene key="b">
  <Camera mode="world" position={[-4, 3, 6]} target={[0, 1, 0]} />
</Scene>`}
      />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>Live Demo</h2>
      <SceneDslDemo />
    </DocPanel>
  );
}

export function SceneSceneDsl(): JSX.Element {
  return (
    <Scene key="scene-scene-dsl" id="scene-scene-dsl">
      <ProgressManager scrollUnits={3200} fn={DWELL_FN} />
      <Camera mode="world" position={[0, 2, 8]} target={[0, 0.8, 0]} fov={42} />
      <Background color="#0f0d1a" />
      <Lighting>
        <Ambient color="#8855ff" intensity={0.3} />
        <Directional color="#cc88ff" intensity={1.4} position={[-4, 8, 4]} />
      </Lighting>

      <DemoProgressProvider startAt={0.25}>
        <SceneDslContent />
      </DemoProgressProvider>
    </Scene>
  );
}

import { JSX } from 'react';
import {
  Scene,
  Camera,
  Lighting,
  Ambient,
  Directional,
  Background,
  Floor,
  FloorPhysical,
  ProgressManager,
} from '@brewsite/core';
import { DWELL_FN } from '../../sceneUtils';
import { DocPanel } from '../../../components/content/DocPanel';
import { DemoProgressProvider, useDemoProgress } from '../../../components/content/DemoProgressProvider';
import { InlineDemo } from '../../../components/demo/InlineDemo';
import { CodeBlock } from '../../../components/ui/CodeBlock';

function MultiSceneDemo(): JSX.Element {
  const demoProgress = useDemoProgress();
  return (
    <InlineDemo controlledProgress={demoProgress} height={280}>
      <Scene key="ms-s1" id="ms-s1">
        <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
        <Lighting>
          <Ambient color="#ffffff" intensity={0.4} />
          <Directional color="#ffffff" intensity={1.0} position={[5, 10, 5]} />
        </Lighting>
        <Background color="#111122" />
        <Floor enabled><FloorPhysical opacity={0.6} metalness={0.4} roughness={0.6} /></Floor>
      </Scene>
      <Scene key="ms-s2" id="ms-s2">
        <Camera mode="orbit" target={[0, 0, 0]} azimuth={1.0} polar={1.2} distance={6} />
        <Lighting>
          <Ambient color="#8855ff" intensity={0.6} />
          <Directional color="#ff88ff" intensity={1.4} position={[-4, 8, 3]} />
        </Lighting>
        <Background color="#1a0a2a" />
      </Scene>
      <Scene key="ms-s3" id="ms-s3">
        <Camera mode="orbit" target={[0, 0, 0]} azimuth={3.0} polar={0.7} distance={10} />
        <Lighting>
          <Ambient color="#22ff88" intensity={0.4} />
          <Directional color="#aaffcc" intensity={1.6} position={[3, 12, -4]} />
        </Lighting>
        <Background color="#0a180f" />
      </Scene>
    </InlineDemo>
  );
}

function MultiSceneContent(): JSX.Element {
  return (
    <DocPanel slideInBy={0.25}>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', margin: '0 0 8px', fontWeight: 700 }}>Multi-Scene Sequences</h1>
      <p style={{ fontSize: 'var(--font-size-base)', lineHeight: 1.65, color: 'var(--text-secondary)', margin: '0 0 20px' }}>
        A sequence is a series of <code>&lt;Scene&gt;</code> elements passed as children to
        <code>ScenePlayer</code>. The compiler generates a smooth animated transition between
        every consecutive pair.
      </p>

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '0 0 10px' }}>Declaring a sequence</h2>
      <CodeBlock
        language="tsx"
        code={`// Scenes are JSX constants — never components, no side effects
const scene01 = (
  <Scene key="overview">
    <Camera mode="world" position={[0, 4, 12]} target={[0, 0, 0]} />
    <Background color="#0a0a14" />
  </Scene>
);

const scene02 = (
  <Scene key="detail">
    <Camera mode="orbit" target={[0, 1, 0]} azimuth={0.8} polar={1.0} distance={5} />
    <Background color="#14080a" />
  </Scene>
);

function MyPage() {
  return (
    <ScenePlayer manifestUrl="/manifest.json" widgetSetup={setup}>
      {scene01}
      {scene02}
    </ScenePlayer>
  );
}`}
      />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>Model ID consistency</h2>
      <p style={{ fontSize: 'var(--font-size-base)', lineHeight: 1.65, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
        The runtime tracks widgets by <code>id</code>. Use the <strong>same id</strong> for the
        same widget across scenes to get smooth interpolation.
      </p>
      <CodeBlock
        language="tsx"
        code={`// ✓ Same id — smooth interpolation between scenes
const s1 = <Scene key="a"><Robot id="hero" position={[0, 0, 0]} /></Scene>;
const s2 = <Scene key="b"><Robot id="hero" position={[-5, 0, 0]} /></Scene>;

// ✗ Different ids — treated as unrelated; no interpolation
const s1 = <Scene key="a"><Robot id="bot-a" position={[0, 0, 0]} /></Scene>;
const s2 = <Scene key="b"><Robot id="bot-b" position={[-5, 0, 0]} /></Scene>;`}
      />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>Live Demo</h2>
      <MultiSceneDemo />
    </DocPanel>
  );
}

export function SceneMultiScene(): JSX.Element {
  return (
    <Scene key="scene-multi-scene" id="scene-multi-scene">
      <ProgressManager scrollUnits={3200} fn={DWELL_FN} />
      <Camera mode="world" position={[-1, 2, 8]} target={[0, 0.8, 0]} fov={42} />
      <Background color="#0f0d1a" />
      <Lighting>
        <Ambient color="#8855ff" intensity={0.3} />
        <Directional color="#cc88ff" intensity={1.4} position={[-2, 10, 5]} />
      </Lighting>

      <DemoProgressProvider startAt={0.25}>
        <MultiSceneContent />
      </DemoProgressProvider>
    </Scene>
  );
}

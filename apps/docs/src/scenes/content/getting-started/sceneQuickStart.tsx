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
import { Callout } from '../../../components/ui/Callout';

function QuickStartDemo(): JSX.Element {
  const demoProgress = useDemoProgress();
  return (
    <InlineDemo controlledProgress={demoProgress} height={320}>
      <Scene key="qs-s1" id="qs-s1">
        <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
        <Lighting>
          <Ambient color="#ffffff" intensity={0.4} />
          <Directional color="#ffffff" intensity={1.0} position={[5, 10, 5]} />
        </Lighting>
        <Background color="#111122" />
        <Floor enabled>
          <FloorPhysical opacity={0.6} metalness={0.4} roughness={0.6} />
        </Floor>
      </Scene>
      <Scene key="qs-s2" id="qs-s2">
        <Camera mode="orbit" target={[0, 0, 0]} azimuth={1.0} polar={1.2} distance={6} />
        <Background color="#1a0a2a" />
        <Lighting>
          <Ambient color="#8855ff" intensity={0.6} />
          <Directional color="#ffffff" intensity={1.2} position={[-5, 8, 4]} />
        </Lighting>
      </Scene>
      <Scene key="qs-s3" id="qs-s3">
        <Camera mode="orbit" target={[0, 0, 0]} azimuth={3.2} polar={0.8} distance={9} />
        <Background color="#0a1a10" />
        <Lighting>
          <Ambient color="#22ff88" intensity={0.4} />
          <Directional color="#88ffcc" intensity={1.4} position={[3, 12, -4]} />
        </Lighting>
      </Scene>
    </InlineDemo>
  );
}

function QuickStartContent(): JSX.Element {
  return (
    <DocPanel slideInBy={0.25}>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', margin: '0 0 8px', fontWeight: 700 }}>
        Quick Start
      </h1>
      <Callout type="tip">You&apos;ll have a running 3D animation scene in about 15 minutes.</Callout>

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>1. Install</h2>
      <CodeBlock language="bash" code="npm install @brewsite/core three react react-dom" />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>2. Author Your Scenes</h2>
      <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
        Scenes are pure declarations of state. You describe positions, colors, and lighting — never
        animation curves. The compiler infers what to animate between consecutive scenes.
      </p>
      <CodeBlock
        language="tsx"
        code={`import { Scene, Camera, Lighting, Ambient, Background } from '@brewsite/core';

const scene01 = (
  <Scene key="intro">
    <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
    <Lighting>
      <Ambient color="#ffffff" intensity={0.4} />
    </Lighting>
    <Background color="#111122" />
  </Scene>
);

const scene02 = (
  <Scene key="detail">
    {/* Only declare what changes — everything else carries forward */}
    <Camera mode="orbit" target={[0, 0, 0]} azimuth={1.0} polar={1.2} distance={6} />
    <Background color="#1a0a2a" />
  </Scene>
);`}
      />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>3. Mount ScenePlayer</h2>
      <CodeBlock
        language="tsx"
        code={`import { ScenePlayer, createDefaultWidgetRegistry } from '@brewsite/core';

// Module-level widget setup — never recreate on render
const widgetSetup = () => createDefaultWidgetRegistry(null);

function App() {
  return (
    <ScenePlayer
      manifestUrl="/scene-manifest.json"
      widgetSetup={widgetSetup}
      quality="balanced"
    >
      {scene01}
      {scene02}
    </ScenePlayer>
  );
}`}
      />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '24px 0 10px' }}>Live Result</h2>
      <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)', margin: '0 0 4px' }}>
        Three scenes, one ScenePlayer. Scroll drives progress — the demo below is driven by your
        scroll position on this page.
      </p>
      <QuickStartDemo />
    </DocPanel>
  );
}

export function SceneQuickStart(): JSX.Element {
  return (
    <Scene key="scene-quick-start" id="scene-quick-start">
      <ProgressManager scrollUnits={3200} fn={DWELL_FN} />
      <Camera mode="world" position={[2, 2, 9]} target={[0, 0.8, 0]} fov={40} />
      <Background color="#0d0f1a" />
      <Lighting>
        <Ambient color="#4466ff" intensity={0.35} />
        <Directional color="#aaccff" intensity={1.4} position={[3, 10, 8]} />
      </Lighting>
      <Floor enabled>
        <FloorPhysical opacity={0.3} metalness={0.4} roughness={0.6} />
      </Floor>

      <DemoProgressProvider startAt={0.25}>
        <QuickStartContent />
      </DemoProgressProvider>
    </Scene>
  );
}

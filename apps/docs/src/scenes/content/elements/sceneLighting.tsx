import { JSX } from 'react';
import {
  Scene,
  Camera,
  Lighting,
  Ambient,
  Directional,
  Point,
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
import { PropTable } from '../../../components/ui/PropTable';

function LightingDemoScene(): JSX.Element {
  const demoProgress = useDemoProgress();
  return (
    <InlineDemo controlledProgress={demoProgress} height={280}>
      <Scene key="lt-d1" id="lt-d1">
        <Camera mode="world" position={[0, 3, 8]} target={[0, 0, 0]} fov={45} />
        <Lighting intensityScale={1}>
          <Ambient color="#ffffff" intensity={0.2} />
          <Directional color="#ffe5b0" intensity={2.0} position={[5, 10, 5]} />
        </Lighting>
        <Background color="#0a0a0e" />
        <Floor enabled><FloorPhysical opacity={0.5} metalness={0.6} roughness={0.3} /></Floor>
      </Scene>
      <Scene key="lt-d2" id="lt-d2">
        <Camera mode="world" position={[0, 3, 8]} target={[0, 0, 0]} fov={45} />
        <Lighting intensityScale={1}>
          <Ambient color="#110022" intensity={0.3} />
          <Directional color="#4422ff" intensity={1.6} position={[-4, 8, 3]} />
          <Point color="#ff4488" intensity={3.0} position={[3, 4, 2]} />
        </Lighting>
        <Background color="#080010" />
      </Scene>
    </InlineDemo>
  );
}

function LightingContent(): JSX.Element {
  return (
    <DocPanel slideInBy={0.25}>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', margin: '0 0 8px', fontWeight: 700 }}>Lighting</h1>
      <p style={{ fontSize: 'var(--font-size-base)', lineHeight: 1.65, color: 'var(--text-secondary)', margin: '0 0 20px' }}>
        The <code>&lt;Lighting&gt;</code> element is a container for all light components.
        Use <code>intensityScale</code> as a global multiplier for easy brightness control.
      </p>

      <CodeBlock
        language="tsx"
        code={`<Lighting intensityScale={1}>
  <Ambient intensity={0.6} color="#ffffff" />
  <Directional intensity={1.2} color="#ffffff" position={[5, 10, 5]} />
  <Point intensity={2.0} color="#7adfff" position={[10, 8, 4]} />
  <Spot
    intensity={3.5}
    color="#ffffff"
    position={[0, 20, 10]}
    target={[0, 0, 0]}
    angle={0.4}
    penumbra={0.3}
  />
  {/* GlowPoint — sprite glow ONLY, no illumination */}
  <GlowPoint intensity={1.5} color="#ff6600" position={[2, 3, 0]} />
</Lighting>`}
      />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>Light types</h2>
      <PropTable
        rows={[
          { name: 'Ambient',     type: 'component', description: 'Fills shadows. Props: intensity, color.' },
          { name: 'Directional', type: 'component', description: 'Main key light. position is the direction vector from origin.' },
          { name: 'Point',       type: 'component', description: 'Omnidirectional. Props: intensity, color, position.' },
          { name: 'Spot',        type: 'component', description: 'Cone light. Props: intensity, color, position, target, angle, penumbra.' },
          { name: 'GlowPoint',   type: 'component', description: 'Billboard sprite glow — zero illumination cost. Decorative only.' },
        ]}
      />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>Live Demo</h2>
      <LightingDemoScene />
    </DocPanel>
  );
}

export function SceneLighting(): JSX.Element {
  return (
    <Scene key="scene-lighting" id="scene-lighting">
      <ProgressManager scrollUnits={3200} fn={DWELL_FN} />
      <Camera mode="world" position={[3, 2, 7]} target={[0, 1, 0]} fov={45} />
      <Background color="#0a1220" />
      <Lighting>
        <Ambient color="#2244ff" intensity={0.4} />
        <Directional color="#88ccff" intensity={1.8} position={[3, 9, 5]} />
        <Point color="#ff4488" intensity={1.5} position={[-4, 3, 2]} />
      </Lighting>
      <Floor enabled>
        <FloorPhysical opacity={0.4} metalness={0.5} roughness={0.5} />
      </Floor>

      <DemoProgressProvider startAt={0.25}>
        <LightingContent />
      </DemoProgressProvider>
    </Scene>
  );
}

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
import { PropTable } from '../../../components/ui/PropTable';

function TransitionsDemo(): JSX.Element {
  const demoProgress = useDemoProgress();
  return (
    <InlineDemo controlledProgress={demoProgress} height={260}>
      <Scene key="tr-s1" id="tr-s1">
        <Camera mode="world" position={[0, 3, 10]} target={[0, 0, 0]} fov={45} />
        <Lighting><Ambient color="#aabbff" intensity={0.5} /><Directional color="#ffffff" intensity={1.4} position={[5, 10, 5]} /></Lighting>
        <Background color="#0a0a1a" />
      </Scene>
      <Scene key="tr-s2" id="tr-s2" exitStart={0.6}>
        <Camera mode="world" position={[-4, 1, 5]} target={[0, 0, 0]} fov={40} />
        <Lighting><Ambient color="#ff8844" intensity={0.4} /><Directional color="#ffcc88" intensity={1.6} position={[-4, 6, 3]} /></Lighting>
        <Background color="#1a0a04" />
      </Scene>
    </InlineDemo>
  );
}

function TransitionsContent(): JSX.Element {
  return (
    <DocPanel slideInBy={0.25}>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', margin: '0 0 8px', fontWeight: 700 }}>Transitions</h1>
      <p style={{ fontSize: 'var(--font-size-base)', lineHeight: 1.65, color: 'var(--text-secondary)', margin: '0 0 20px' }}>
        The default transition is dissolve-through-black: the scene holds at full opacity until
        80% of the block, then fades out quickly. No <code>transition</code> prop needed for the
        common case. Use <code>exitStart</code> to control how long the scene stays visible before
        fading, or <code>transition="crossfade"</code> for a simultaneous equal-blend.
      </p>

      <CodeBlock
        language="tsx"
        code={`// Default: dissolve-through-black at exitStart=0.8
<Scene key="hero">
  <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} fov={45} />
</Scene>

// Hold scene longer before fading
<Scene key="feature" exitStart={0.9}>
  <Camera mode="world" position={[...]} />
</Scene>

// Crossfade: both scenes simultaneously visible throughout
<Scene key="detail" transition="crossfade">
  <Camera mode="world" position={[...]} />
</Scene>`}
      />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>Named transitions</h2>
      <PropTable
        rows={[
          {
            name: '"dissolve"',
            type: 'TransitionName',
            defaultValue: 'system default',
            description: 'Through-black. Outgoing holds until exitStart, fades to nothing. Incoming fades in symmetrically. exitStart defaults to 0.8.',
          },
          {
            name: '"crossfade"',
            type: 'TransitionName',
            description: 'Equal-blend. Both scenes visible simultaneously. Opacity sums to 1 at every frame. exitStart is not applicable.',
          },
        ]}
      />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>Live Demo</h2>
      <TransitionsDemo />
    </DocPanel>
  );
}

export function SceneTransitions(): JSX.Element {
  return (
    <Scene key="scene-transitions" id="scene-transitions">
      <ProgressManager scrollUnits={3200} fn={DWELL_FN} />
      <Camera mode="world" position={[1, 2, 8]} target={[0, 0.8, 0]} fov={42} />
      <Background color="#0f0d1a" />
      <Lighting>
        <Ambient color="#8855ff" intensity={0.3} />
        <Directional color="#cc88ff" intensity={1.4} position={[2, 10, 6]} />
      </Lighting>

      <DemoProgressProvider startAt={0.25}>
        <TransitionsContent />
      </DemoProgressProvider>
    </Scene>
  );
}

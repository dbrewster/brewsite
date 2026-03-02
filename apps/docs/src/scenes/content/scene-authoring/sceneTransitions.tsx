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
      <Scene key="tr-s2" id="tr-s2" transition={{ exit: [0, 0.5], enter: [0.5, 1] }}>
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
      <h1 style={{ fontSize: 'var(--font-size-3xl)', margin: '0 0 8px', fontWeight: 700 }}>Transitions &amp; Easing</h1>
      <p style={{ fontSize: 'var(--font-size-base)', lineHeight: 1.65, color: 'var(--text-secondary)', margin: '0 0 20px' }}>
        Transitions are configured on the <em>incoming</em> scene — the scene being transitioned
        into. Control the timing windows with the <code>transition</code> prop on <code>&lt;Scene&gt;</code>.
        The <code>exit</code> window controls when the outgoing scene fades out;
        the <code>enter</code> window controls when the incoming scene fades in.
      </p>

      <CodeBlock
        language="tsx"
        code={`// Control the entry window for this scene's transition:
<Scene key="feature" transition={{ exit: [0, 0.4], enter: [0.6, 1] }}>
  <Camera mode="world" position={[...]} />
</Scene>`}
      />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>Preset windows</h2>
      <PropTable
        rows={[
          { name: 'TRANSITION_CROSSFADE',   type: 'TransitionWindow', description: 'Exit [0, 0.5] / Enter [0.5, 1] — the default overlap split' },
          { name: 'TRANSITION_SEQUENTIAL',  type: 'TransitionWindow', description: 'Exit [0, 0.4] / Enter [0.6, 1] — gap between exit and enter' },
          { name: 'TRANSITION_EXIT_FIRST',  type: 'TransitionWindow', description: 'Exit [0, 0.6] / Enter [0.4, 1] — outgoing finishes before entering' },
          { name: 'TRANSITION_CUT',         type: 'TransitionWindow', description: 'Instant switch with no blending' },
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

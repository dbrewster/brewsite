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
import { CodeBlock } from '../../../components/ui/CodeBlock';
import { PropTable } from '../../../components/ui/PropTable';
import { Callout } from '../../../components/ui/Callout';

function ProgressManagerContent(): JSX.Element {
  return (
    <DocPanel slideInBy={0.3}>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', margin: '0 0 8px', fontWeight: 700 }}>ProgressManager</h1>
      <p style={{ fontSize: 'var(--font-size-base)', lineHeight: 1.65, color: 'var(--text-secondary)', margin: '0 0 20px' }}>
        Controls how much scroll real estate each scene's transition consumes and the pacing curve
        within that window. Place <code>&lt;ProgressManager&gt;</code> as a child of the scene it
        configures.
      </p>

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '0 0 10px' }}>Props</h2>
      <PropTable
        rows={[
          { name: 'scrollUnits', type: 'number', defaultValue: '1', description: 'Proportional scroll budget. Last scene\'s value is ignored.' },
          { name: 'fn',         type: '(t: number) => number', description: 'Pacing curve. Must satisfy fn(0)===0, fn(1)===1, monotonically non-decreasing.' },
          { name: 'autoAdvance', type: 'object', description: 'Cinematic idle auto-play: { duration, max?, pauseOnScroll? }' },
          { name: 'animationTimeScale', type: 'number', description: 'Total animation-seconds played when scrolling 0→1 through this scene.' },
        ]}
      />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>Examples</h2>
      <CodeBlock
        language="tsx"
        code={`// Short cinematic cut — 400 scroll pixels before next scene
<Scene id="act-header">
  <ProgressManager scrollUnits={400} />
</Scene>

// Content scene — 2400px, dwell pattern (animate fast, hold)
<Scene id="content">
  <ProgressManager
    scrollUnits={2400}
    fn={(t) => Math.min(1, t * 4)}
  />
</Scene>

// Auto-advance after user goes idle for 8 seconds
<Scene id="hero">
  <ProgressManager
    scrollUnits={1800}
    autoAdvance={{ duration: 8, max: 0.80, pauseOnScroll: true }}
  />
</Scene>`}
      />

      <Callout type="warning">
        The <code>fn</code> prop must be a <strong>stable module-level function reference</strong>.
        Inline arrow functions like <code>{'fn={(t) => t * 4}'}</code> create a new reference on
        every render and invalidate the compiled SceneTrack cache, causing constant recompilation.
      </Callout>

      <CodeBlock
        language="typescript"
        code={`// ✓ Module-level constant — stable reference
export const DWELL_FN = (t: number): number => Math.min(1, t * 4);

// In scene:
<ProgressManager scrollUnits={3200} fn={DWELL_FN} />`}
      />
    </DocPanel>
  );
}

export function SceneProgressManager(): JSX.Element {
  return (
    <Scene key="scene-progress-manager" id="scene-progress-manager">
      <ProgressManager scrollUnits={2400} fn={DWELL_FN} />
      <Camera mode="world" position={[-1, 2, 8]} target={[0, 0.8, 0]} fov={42} />
      <Background color="#0f0d1a" />
      <Lighting>
        <Ambient color="#8855ff" intensity={0.3} />
        <Directional color="#cc88ff" intensity={1.4} position={[-1, 10, 6]} />
      </Lighting>

      <ProgressManagerContent />
    </Scene>
  );
}

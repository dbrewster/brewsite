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

function HudDemo(): JSX.Element {
  const demoProgress = useDemoProgress();
  return (
    <InlineDemo controlledProgress={demoProgress} height={260}>
      <Scene key="hud-d1" id="hud-d1">
        <Camera mode="world" position={[0, 2, 7]} target={[0, 1, 0]} fov={45} />
        <Lighting><Ambient color="#ff4444" intensity={0.3} /><Directional color="#ffaa44" intensity={1.6} position={[6, 8, 2]} /></Lighting>
        <Background color="#140a0a" />
        <div style={{ position: 'absolute', bottom: '15%', left: '10%', color: '#fff', pointerEvents: 'none' }}>
          <p style={{ margin: 0, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.6 }}>Scene 1</p>
          <h3 style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 700 }}>HTML Overlay Works Here</h3>
        </div>
      </Scene>
      <Scene key="hud-d2" id="hud-d2">
        <Camera mode="world" position={[3, 2, 7]} target={[0, 1, 0]} fov={45} />
        <Background color="#100510" />
        <div style={{ position: 'absolute', top: '15%', right: '10%', color: '#fff', pointerEvents: 'none' }}>
          <p style={{ margin: 0, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.6 }}>Scene 2</p>
          <h3 style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 700 }}>Different Position</h3>
        </div>
      </Scene>
    </InlineDemo>
  );
}

function HudContent(): JSX.Element {
  return (
    <DocPanel slideInBy={0.25}>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', margin: '0 0 8px', fontWeight: 700 }}>Scene Overlay Content</h1>
      <p style={{ fontSize: 'var(--font-size-base)', lineHeight: 1.65, color: 'var(--text-secondary)', margin: '0 0 20px' }}>
        HTML and React children of <code>&lt;Scene&gt;</code> become 2D overlay content rendered
        by <code>EngineOverlayHost</code>. This is how you add text, panels, callouts, and
        interactive UI over the 3D canvas.
      </p>

      <CodeBlock
        language="tsx"
        code={`export const scene01 = (
  <Scene key="hero">
    <Camera mode="world" position={[2, 1.5, 6]} target={[0, 1, 0]} />

    {/* Everything below is overlay content — not compiled as DSL */}
    <div style={{
      position: 'absolute',
      bottom: '8%',
      left: '6%',
      right: '6%',
      color: '#e9f3ff',
      pointerEvents: 'none',
    }}>
      <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.18em' }}>
        Act 1
      </span>
      <h1 style={{ fontSize: 36, margin: '8px 0' }}>Getting Started</h1>
    </div>
  </Scene>
);`}
      />

      <Callout type="tip">
        Add <code>pointer-events: none</code> to overlay containers that should not block canvas
        interaction. Use <code>pointer-events: auto</code> on specific interactive elements within.
      </Callout>

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>Live Demo</h2>
      <HudDemo />
    </DocPanel>
  );
}

export function SceneHud(): JSX.Element {
  return (
    <Scene key="scene-hud" id="scene-hud">
      <ProgressManager scrollUnits={3200} fn={DWELL_FN} />
      <Camera mode="world" position={[0, 2, 8]} target={[0, 1, 0]} fov={44} />
      <Background color="#140a0a" />
      <Lighting>
        <Ambient color="#ff4444" intensity={0.3} />
        <Directional color="#ffaa44" intensity={1.6} position={[5, 8, 3]} />
      </Lighting>

      <DemoProgressProvider startAt={0.25}>
        <HudContent />
      </DemoProgressProvider>
    </Scene>
  );
}

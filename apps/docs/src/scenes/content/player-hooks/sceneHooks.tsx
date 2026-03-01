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

function HooksDemo(): JSX.Element {
  const demoProgress = useDemoProgress();
  return (
    <InlineDemo controlledProgress={demoProgress} height={240}>
      <Scene key="hk-d1" id="hk-d1">
        <Camera mode="orbit" target={[0, 0, 0]} azimuth={0} polar={1.0} distance={8} />
        <Lighting><Ambient color="#3388ff" intensity={0.5} /><Directional color="#ffffff" intensity={1.8} position={[0, 12, 5]} /></Lighting>
        <Background color="#0a0e18" />
        <div style={{ position: 'absolute', top: '6%', left: '6%', color: 'rgba(100,180,255,0.8)', fontFamily: 'monospace', fontSize: 12, pointerEvents: 'none' }}>
          useEngineState(): sceneId = &quot;hk-d1&quot;
        </div>
      </Scene>
      <Scene key="hk-d2" id="hk-d2">
        <Camera mode="orbit" target={[0, 0, 0]} azimuth={1.8} polar={0.8} distance={6} />
        <Background color="#08121a" />
        <div style={{ position: 'absolute', top: '6%', left: '6%', color: 'rgba(100,180,255,0.8)', fontFamily: 'monospace', fontSize: 12, pointerEvents: 'none' }}>
          useEngineState(): sceneId = &quot;hk-d2&quot;
        </div>
      </Scene>
    </InlineDemo>
  );
}

function HooksContent(): JSX.Element {
  return (
    <DocPanel slideInBy={0.25}>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', margin: '0 0 8px', fontWeight: 700 }}>Hooks Reference</h1>
      <p style={{ fontSize: 'var(--font-size-base)', lineHeight: 1.65, color: 'var(--text-secondary)', margin: '0 0 20px' }}>
        BrewSite provides React hooks for reading engine state inside and outside the
        <code>EngineProvider</code> tree.
      </p>

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '0 0 10px' }}>useEngineState</h2>
      <CodeBlock
        language="typescript"
        code={`// Full engine state — updates every frame on tick index change
const { progress, sceneId, sceneIndex, sceneProgress } = useEngineState();
// Requires EngineProvider ancestor`}
      />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>useSceneEngineState</h2>
      <CodeBlock
        language="typescript"
        code={`// Works from ANYWHERE — no ancestor required
// Uses global player registry keyed by player id
const state = useSceneEngineState('my-player-id');
// Returns null when engine is not mounted
const sceneId = state?.sceneId ?? '';`}
      />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>All hooks</h2>
      <PropTable
        rows={[
          { name: 'useEngineState',        type: 'hook', description: 'Full state snapshot — progress, sceneId, sceneProgress. Requires ancestor.' },
          { name: 'useCurrentScene',       type: 'hook', description: 'Scene id and index only. Re-renders only on scene change.' },
          { name: 'useSceneProgress',      type: 'hook', description: 'Global progress [0..1]. Requires ancestor.' },
          { name: 'useSceneEngineState',   type: 'hook', description: 'Global registry — works anywhere. Accepts engine id string.' },
          { name: 'useSceneEngineContext', type: 'hook', description: 'Returns engine context with scrollToProgress(), getCamera(), etc.' },
          { name: 'useSceneRuntime',       type: 'hook', description: 'Reads engine state from parent of ScenePlayer for responsive scenes.' },
        ]}
      />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>Live Demo</h2>
      <HooksDemo />
    </DocPanel>
  );
}

export function SceneHooksDocs(): JSX.Element {
  return (
    <Scene key="scene-hooks" id="scene-hooks">
      <ProgressManager scrollUnits={3200} fn={DWELL_FN} />
      <Camera mode="world" position={[2, 2, 8]} target={[0, 1, 0]} fov={44} />
      <Background color="#0a0e18" />
      <Lighting>
        <Ambient color="#3388ff" intensity={0.5} />
        <Directional color="#ffffff" intensity={1.8} position={[2, 12, 5]} />
      </Lighting>

      <DemoProgressProvider startAt={0.25}>
        <HooksContent />
      </DemoProgressProvider>
    </Scene>
  );
}

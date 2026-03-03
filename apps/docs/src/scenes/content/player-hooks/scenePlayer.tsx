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

function ScenePlayerContent(): JSX.Element {
  return (
    <DocPanel slideInBy={0.3}>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', margin: '0 0 8px', fontWeight: 700 }}>EngineProvider</h1>
      <p style={{ fontSize: 'var(--font-size-base)', lineHeight: 1.65, color: 'var(--text-secondary)', margin: '0 0 20px' }}>
        <code>EngineProvider</code> is the composable engine entry point. It creates the Three.js
        engine, wires scroll-driven progress, and provides engine context to all children. Compose
        it with <code>EngineInputRegion</code>, <code>SceneCanvas</code>, and{' '}
        <code>EngineOverlayHost</code> for full-page or custom-layout scenes.
      </p>

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '0 0 10px' }}>Basic usage</h2>
      <CodeBlock
        language="tsx"
        code={`import {
  EngineProvider, EngineInputRegion, SceneCanvas,
  EngineOverlayHost, corePlugin,
} from '@brewsite/core';

// Module-level — never inline inside the component
const PLUGINS = [corePlugin({ onSceneChange: (id) => console.log(id) })];

export default function MyPage() {
  return (
    <EngineProvider
      id="my-player"
      manifestUrl="/scene-manifest.json"
      plugins={PLUGINS}
      quality="balanced"
      pixelsPerScene={800}
    >
      {scene01}
      {scene02}
      <EngineInputRegion>
        <SceneCanvas />
        <EngineOverlayHost />
      </EngineInputRegion>
    </EngineProvider>
  );
}`}
      />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>Key props</h2>
      <PropTable
        rows={[
          { name: 'manifestUrl',    type: 'string', required: true, description: 'Path to asset manifest JSON' },
          { name: 'plugins',        type: 'WidgetPlugin[]', required: true, description: 'Widget plugins — use corePlugin() for built-in widgets' },
          { name: 'id',             type: 'string', description: 'Engine ID — required for useSceneEngineState(id)' },
          { name: 'quality',        type: "'performance' | 'balanced' | 'high'", defaultValue: "'balanced'", description: '30 / 60 / 120 framesPerTick' },
          { name: 'pixelsPerScene', type: 'number', defaultValue: '800', description: 'Scroll pixels per scene transition' },
          { name: 'controlledProgress', type: 'number', description: 'External progress [0..1] override (disables scroll)' },
        ]}
      />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>Custom layout</h2>
      <CodeBlock
        language="tsx"
        code={`import { EngineProvider, SceneCanvas, EngineOverlayHost } from '@brewsite/core';

function DocsPage() {
  return (
    <EngineProvider id="docs" manifestUrl="/manifest.json" quality="balanced" plugins={PLUGINS}>
      <Scene key="intro">...</Scene>
      <Scene key="detail">...</Scene>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr' }}>
        <Sidebar />  {/* uses useSceneEngineState('docs') */}
        <main style={{ position: 'relative', height: '100vh' }}>
          <SceneCanvas style={{ width: '100%', height: '100%' }} />
          <EngineOverlayHost />
        </main>
      </div>
    </EngineProvider>
  );
}`}
      />

      <Callout type="tip">
        Use <code>EngineProvider</code> composition when the canvas must live at a specific
        position in your CSS Grid/Flex layout, or when siblings outside the canvas need to read
        engine state (sidebar highlighting, progress bars, etc.).
      </Callout>
    </DocPanel>
  );
}

export function ScenePlayerDocs(): JSX.Element {
  return (
    <Scene key="scene-player" id="scene-player">
      <ProgressManager scrollUnits={2400} fn={DWELL_FN} />
      <Camera mode="world" position={[0, 2, 8]} target={[0, 1, 0]} fov={44} />
      <Background color="#0a0e18" />
      <Lighting>
        <Ambient color="#3388ff" intensity={0.5} />
        <Directional color="#ffffff" intensity={2.0} position={[0, 12, 5]} />
      </Lighting>

      <ScenePlayerContent />
    </Scene>
  );
}

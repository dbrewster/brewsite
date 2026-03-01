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
      <h1 style={{ fontSize: 'var(--font-size-3xl)', margin: '0 0 8px', fontWeight: 700 }}>ScenePlayer &amp; EngineProvider</h1>
      <p style={{ fontSize: 'var(--font-size-base)', lineHeight: 1.65, color: 'var(--text-secondary)', margin: '0 0 20px' }}>
        <code>ScenePlayer</code> is the full-page scroll entry point. It creates a sticky canvas,
        wires scroll-driven progress, and renders overlay content. For custom layouts, use{' '}
        <code>EngineProvider</code> + <code>SceneCanvas</code> + <code>EngineOverlayHost</code>.
      </p>

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '0 0 10px' }}>ScenePlayer</h2>
      <CodeBlock
        language="tsx"
        code={`import { ScenePlayer, createDefaultWidgetRegistry } from '@brewsite/core';

// Module-level — never inline
const widgetSetup = () => createDefaultWidgetRegistry(null);

export default function MyPage() {
  return (
    <ScenePlayer
      id="my-player"
      manifestUrl="/scene-manifest.json"
      widgetSetup={widgetSetup}
      quality="balanced"
      pixelsPerScene={800}
      onSceneChange={(sceneId) => console.log(sceneId)}
    >
      {scene01}
      {scene02}
    </ScenePlayer>
  );
}`}
      />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>Key props</h2>
      <PropTable
        rows={[
          { name: 'manifestUrl',    type: 'string', required: true, description: 'Path to asset manifest JSON' },
          { name: 'id',             type: 'string', description: 'Player ID — required for useSceneEngineState(id)' },
          { name: 'quality',        type: "'performance' | 'balanced' | 'high'", defaultValue: "'balanced'", description: '30 / 60 / 120 framesPerTick' },
          { name: 'pixelsPerScene', type: 'number', defaultValue: '800', description: 'Scroll pixels per scene transition' },
          { name: 'widgetSetup',    type: 'function', description: 'Widget registry factory; defaults to createDefaultWidgetRegistry' },
          { name: 'onSceneChange',  type: '(id, index) => void', description: 'Fires on scene transition' },
          { name: 'controlledProgress', type: 'number', description: 'External progress [0..1] override (disables scroll)' },
        ]}
      />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>EngineProvider (custom layout)</h2>
      <CodeBlock
        language="tsx"
        code={`import { EngineProvider, SceneCanvas, EngineOverlayHost } from '@brewsite/core';

function DocsPage() {
  return (
    <EngineProvider id="docs" manifestUrl="/manifest.json" quality="balanced">
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

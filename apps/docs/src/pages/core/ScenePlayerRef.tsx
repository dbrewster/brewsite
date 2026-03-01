import { JSX } from 'react';
import { Link } from 'react-router';
import { CodeBlock } from '../../components/ui/CodeBlock';
import { PropTable } from '../../components/ui/PropTable';
import { Callout } from '../../components/ui/Callout';

export default function ScenePlayerRef(): JSX.Element {
  return (
    <section>
      <h1>ScenePlayer &amp; EngineProvider</h1>

      <p>
        BrewSite exposes two ways to mount the engine into your React tree:{' '}
        <code>ScenePlayer</code> (all-in-one, unchanged) and the lower-level{' '}
        <code>EngineProvider</code> + layout primitives for custom layouts.
      </p>

      <h2>ScenePlayer</h2>

      <p>
        <code>ScenePlayer</code> is the full-stack integration component — engine, canvas, scroll
        region, and overlay host composed into a single element. It works exactly as before. Use it
        when you want a drop-in player with no custom layout.
      </p>

      <CodeBlock
        language="tsx"
        code={`import { ScenePlayer } from '@brewsite/core';

export default function Page() {
  return (
    <ScenePlayer manifestUrl="/scene-manifest.json" quality="balanced">
      <Scene key="intro">
        <Camera type="world" position={[0, 2, 8]} />
      </Scene>
      <Scene key="detail">
        <Camera type="world" position={[3, 1, 5]} />
      </Scene>
    </ScenePlayer>
  );
}`}
      />

      <PropTable
        rows={[
          {
            name: 'manifestUrl',
            type: 'string',
            required: true,
            description: 'URL to the generated scene-manifest.json (from gen:scene-dsl).',
          },
          {
            name: 'quality',
            type: "'performance' | 'balanced' | 'high'",
            required: false,
            defaultValue: 'balanced',
            description: 'Pre-baked frame count preset.',
          },
          {
            name: 'pixelsPerScene',
            type: 'number',
            required: false,
            defaultValue: '800',
            description: 'Scroll pixels allocated per scene for scroll-mode navigation.',
          },
          {
            name: 'fpsCap',
            type: 'number',
            required: false,
            defaultValue: '60',
            description: 'Maximum frames per second for the render loop.',
          },
          {
            name: 'widgetSetup',
            type: '(manifest: AssetManifest) => WidgetRegistry',
            required: false,
            defaultValue: '—',
            description:
              'Factory for the widget registry. Defaults to createDefaultWidgetRegistry(manifest).',
          },
          {
            name: 'onSceneChange',
            type: '(sceneId: string, sceneIndex: number) => void',
            required: false,
            defaultValue: '—',
            description: 'Called when the active scene changes.',
          },
          {
            name: 'onReady',
            type: '() => void',
            required: false,
            defaultValue: '—',
            description: 'Called when all widgets are loaded and the engine is ready.',
          },
          {
            name: 'onError',
            type: '(error: Error) => void',
            required: false,
            defaultValue: '—',
            description: 'Called on fatal engine errors.',
          },
          {
            name: 'onCompileWarning',
            type: '(warnings: CompileWarning[]) => void',
            required: false,
            defaultValue: '—',
            description: 'Called with DSL compile warnings.',
          },
          {
            name: 'className',
            type: 'string',
            required: false,
            defaultValue: '—',
            description: 'CSS class applied to the root canvas container.',
          },
        ]}
      />

      <Callout type="note">
        <code>ScenePlayer</code> is now a thin composition of <code>EngineProvider</code> +{' '}
        <code>SceneCanvas</code> + <code>EngineOverlayHost</code> + scroll/input regions. Its
        props and behavior are unchanged.
      </Callout>

      <h2>EngineProvider</h2>

      <p>
        <code>EngineProvider</code> sets up the engine and its React contexts but renders no DOM of
        its own. Use it when you need a custom layout — for example, a sidebar that reads engine
        state, or a canvas that occupies only part of the viewport alongside other page content.
      </p>

      <PropTable
        rows={[
          {
            name: 'id',
            type: 'string',
            required: true,
            description:
              'Stable identifier for this engine instance. Used by useSceneEngineState() to locate the engine from anywhere in the React tree.',
          },
          {
            name: 'manifestUrl',
            type: 'string',
            required: true,
            description: 'URL to the generated scene-manifest.json (from gen:scene-dsl).',
          },
          {
            name: 'quality',
            type: "'performance' | 'balanced' | 'high'",
            required: false,
            defaultValue: 'balanced',
            description: 'Pre-baked frame count preset.',
          },
          {
            name: 'widgetSetup',
            type: '(manifest: AssetManifest) => WidgetRegistry',
            required: false,
            defaultValue: '—',
            description: 'Factory for the widget registry.',
          },
          {
            name: 'onSceneChange',
            type: '(sceneId: string, sceneIndex: number) => void',
            required: false,
            defaultValue: '—',
            description: 'Called when the active scene changes.',
          },
          {
            name: 'onReady',
            type: '() => void',
            required: false,
            defaultValue: '—',
            description: 'Called when all widgets are loaded and the engine is ready.',
          },
          {
            name: 'onError',
            type: '(error: Error) => void',
            required: false,
            defaultValue: '—',
            description: 'Called on fatal engine errors.',
          },
          {
            name: 'onCompileWarning',
            type: '(warnings: CompileWarning[]) => void',
            required: false,
            defaultValue: '—',
            description: 'Called with DSL compile warnings.',
          },
        ]}
      />

      <CodeBlock
        language="tsx"
        code={`import { EngineProvider, SceneCanvas, EngineOverlayHost } from '@brewsite/core';

export default function DocsPage() {
  return (
    <EngineProvider id="docs" manifestUrl="/assets/manifest.json" quality="balanced">
      {/* Scene declarations */}
      <Scene key="intro">
        <Camera type="world" position={[2, 1.5, 6]} />
        <div className="panel"><h1>Getting Started</h1></div>
      </Scene>

      {/* Custom layout — sidebar + canvas side by side */}
      <div className="layout">
        <Sidebar />   {/* reads useSceneEngineState('docs') */}
        <main style={{ position: 'relative' }}>
          <SceneCanvas style={{ width: '100%', height: '55vh' }} />
          <EngineOverlayHost />
        </main>
      </div>
    </EngineProvider>
  );
}`}
      />

      <h2>SceneCanvas</h2>

      <p>
        <code>SceneCanvas</code> renders the Three.js <code>{'<canvas>'}</code> element, registers
        itself with the engine, and owns a <code>ResizeObserver</code> to keep the renderer
        dimensions in sync.
      </p>

      <PropTable
        rows={[
          {
            name: 'style',
            type: 'React.CSSProperties',
            required: false,
            defaultValue: '—',
            description:
              'Inline styles for the canvas element. Set width and height here (e.g., { width: "100%", height: "100vh" }).',
          },
          {
            name: 'className',
            type: 'string',
            required: false,
            defaultValue: '—',
            description: 'CSS class applied to the canvas element.',
          },
          {
            name: 'placeholder',
            type: 'ReactNode',
            required: false,
            defaultValue: '—',
            description:
              'Content rendered in place of the canvas while the engine is loading assets.',
          },
          {
            name: 'ref',
            type: 'React.Ref<HTMLCanvasElement>',
            required: false,
            defaultValue: '—',
            description: 'Forwarded ref to the underlying canvas DOM element.',
          },
        ]}
      />

      <CodeBlock
        language="tsx"
        code={`import { SceneCanvas } from '@brewsite/core';

<SceneCanvas
  style={{ width: '100%', height: '55vh' }}
  placeholder={
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <span>Loading…</span>
    </div>
  }
/>`}
      />

      <h2>EngineOverlayHost</h2>

      <p>
        <code>EngineOverlayHost</code> renders the active scene's HTML overlay content (the
        non-element children declared inside <code>{'<Scene>'}</code>). When the active scene
        changes, the host swaps in the new scene's overlay content. Place it as a sibling of{' '}
        <code>SceneCanvas</code> inside a <code>position: relative</code> container.
      </p>

      <PropTable
        rows={[
          {
            name: 'className',
            type: 'string',
            required: false,
            defaultValue: '—',
            description: 'CSS class applied to the overlay host container element.',
          },
          {
            name: 'passthroughPointerEvents',
            type: 'boolean',
            required: false,
            defaultValue: 'false',
            description:
              'When true, the host container has pointer-events: none. Individual overlay children can still opt in with pointer-events: auto.',
          },
        ]}
      />

      <p>
        See <Link to="/core/hud">Scene Overlay</Link> for a full guide on authoring overlay
        content.
      </p>

      <h2>
        <code>useSceneEngineState(id)</code>
      </h2>

      <p>
        Read engine state from anywhere in the React tree — including components that are not
        descendants of <code>EngineProvider</code>. Pass the engine <code>id</code> you used in{' '}
        <code>{'<EngineProvider id="...">'}
        </code>.
      </p>

      <CodeBlock
        language="tsx"
        code={`import { useSceneEngineState } from '@brewsite/core';

function Sidebar() {
  // Works outside the EngineProvider subtree
  const state = useSceneEngineState('docs');

  if (!state) return null; // engine not yet mounted

  return (
    <nav>
      <p>Scene: {state.sceneId}</p>
      <p>Index: {state.sceneIndex}</p>
      <p>Scene progress: {(state.sceneProgress * 100).toFixed(0)}%</p>
      <p>Overall progress: {(state.progress * 100).toFixed(0)}%</p>
    </nav>
  );
}`}
      />

      <PropTable
        rows={[
          {
            name: 'sceneId',
            type: 'string',
            required: false,
            description: 'The key of the currently active Scene.',
          },
          {
            name: 'sceneIndex',
            type: 'number',
            required: false,
            description: 'Zero-based index of the currently active Scene.',
          },
          {
            name: 'sceneProgress',
            type: 'number',
            required: false,
            description: 'Progress through the current scene, 0..1.',
          },
          {
            name: 'progress',
            type: 'number',
            required: false,
            description: 'Overall progress across all scenes, 0..1.',
          },
        ]}
      />

      <Callout type="note">
        <code>useSceneEngineState</code> returns <code>null</code> if no engine with the given{' '}
        <code>id</code> is currently mounted. Guard against <code>null</code> before reading
        snapshot fields.
      </Callout>

      <h2>EngineScrollRegion &amp; EngineInputRegion</h2>

      <p>
        These scroll and input region wrappers work the same as before. Wrap{' '}
        <code>ScenePlayer</code> or the layout containing <code>SceneCanvas</code> to enable
        scroll-mode navigation and camera interaction:
      </p>

      <CodeBlock
        language="tsx"
        code={`import { EngineScrollRegion, EngineInputRegion, ScenePlayer } from '@brewsite/core';

export default function Page() {
  return (
    <EngineScrollRegion pixelsPerScene={800}>
      <div style={{ position: 'sticky', top: 0, height: '100vh' }}>
        <EngineInputRegion>
          <ScenePlayer manifestUrl="/scene-manifest.json" pixelsPerScene={800}>
            {scenes}
          </ScenePlayer>
        </EngineInputRegion>
      </div>
    </EngineScrollRegion>
  );
}`}
      />

      <p>
        See <Link to="/core/input-navigation">Scene Navigation</Link> and{' '}
        <Link to="/core/input-actions">Input Actions</Link> for full documentation.
      </p>

      <h2>TimelineWidget (Dev Tool)</h2>

      <p>
        The <code>TimelineWidget</code> renders a debug overlay showing the current scene, tick,
        and progress. Works with both <code>ScenePlayer</code> and <code>EngineProvider</code>:
      </p>

      <CodeBlock
        language="tsx"
        code={`import { ScenePlayer, TimelineWidget } from '@brewsite/core';

<ScenePlayer manifestUrl="/scene-manifest.json">
  {scenes}
  {import.meta.env.DEV && <TimelineWidget />}
</ScenePlayer>`}
      />

      <Callout type="warning">
        Remove <code>TimelineWidget</code> before production. It adds visual overhead and is for
        development only.
      </Callout>
    </section>
  );
}

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

      {/* ── Section 1: ScenePlayer is a convenience component ────────────── */}

      <Callout type="tip">
        <strong>ScenePlayer is a convenience component for the common case</strong> — full-page
        scroll, canvas fills the viewport, one layout. It is composed of smaller, independently
        usable primitives. For docs layouts, embedded players, split-panel views, or multi-engine
        pages, compose those primitives directly using <code>EngineProvider</code>.
      </Callout>

      {/* ── Section 2: What ScenePlayer is made of ───────────────────────── */}

      <h2>What ScenePlayer is made of</h2>

      <p>
        The internal <code>ScenePlayerInner</code> component is the entire layout surface of{' '}
        <code>ScenePlayer</code>. Here it is, verbatim, with added inline comments:
      </p>

      <CodeBlock
        language="tsx"
        code={`const ScenePlayerInner = (props: ScenePlayerInnerProps): ReactElement => {
  const engine = useSceneEngineContext();
  const labels = engine.frameState.tick?.labelPrimitives ?? [];
  const isControlled = props.controlledProgress !== undefined;
  const isLoading = engine.frameState.tickIndex < 0;

  return (
    // ← THIS IS THE LAYOUT ROOT. When you want a split panel, a sidebar,
    //   or anything other than full-page: replace this div with your own layout.
    <div
      className={props.className}
      style={{ position: 'relative', ...(isControlled ? { height: '100%' } : {}) }}
    >
      {props.loadError && (
        <div role="alert">Scene engine error: {props.loadError.message}</div>
      )}
      {isLoading && props.placeholder && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {props.placeholder}
        </div>
      )}
      {/* EngineInputRegion creates the scroll spacer + sticky container.
          In custom layouts you often DON'T need this. */}
      <EngineInputRegion engine={engine} fillContainer={isControlled}>
        {/* SceneCanvas renders the <canvas> element, owns the ResizeObserver */}
        <SceneCanvas style={{ width: '100%', height: '100%' }} />
        {/* EngineOverlayHost renders HTML children from your <Scene> elements */}
        <EngineOverlayHost passthroughPointerEvents={false} />
        {labels.map((label) => (
          <LabelItem key={label.id} label={label} />
        ))}
        {props.timeline && (
          <TimelineWidget
            engine={engine}
            scenes={engine.sceneIds.map((id) => ({ id }))}
            {...(typeof props.timeline === 'object' ? props.timeline : {})}
          />
        )}
        {props.debug && <SceneInspector sceneIds={engine.sceneIds} />}
      </EngineInputRegion>
    </div>
  );
};`}
      />

      <p>
        There is no magic in <code>ScenePlayer</code>. It is just these components composed
        together. You can build the same thing — or something better for your layout.
      </p>

      {/* ── Section 3: The div that matters ──────────────────────────────── */}

      <h2>The div that matters</h2>

      <p>
        The <code>{'<div style={{ position: \'relative\' }}>'}</code> at the top of{' '}
        <code>ScenePlayerInner</code> is <code>ScenePlayer</code>'s layout root. If you've ever
        found yourself fighting with the <code>className</code> prop or trying to position elements
        relative to the canvas — that div is what you're working with.
      </p>

      <p>
        When you decompose <code>ScenePlayer</code> into <code>EngineProvider</code>, you replace
        that div with your own layout. You get a sidebar, a CSS Grid, a split panel, or whatever
        your page needs — with the canvas in exactly the right place.
      </p>

      {/* ── Section 4: Docs-style layout example ─────────────────────────── */}

      <h2>Docs-style layout example</h2>

      <p>
        Here is a complete custom layout using <code>EngineProvider</code> directly — sidebar,
        canvas, and overlay host composed into a CSS Grid:
      </p>

      <CodeBlock
        language="tsx"
        code={`import {
  EngineProvider, SceneCanvas, EngineOverlayHost,
  useSceneEngineState
} from '@brewsite/core';

function Sidebar() {
  // Works here because EngineProvider is above this in the tree.
  const state = useSceneEngineState('docs-engine');
  return <nav data-current={state?.sceneId}>...</nav>;
}

export default function DocsPage() {
  return (
    <EngineProvider id="docs-engine" manifestUrl="/assets/manifest.json" quality="balanced">
      {/* Scene declarations */}
      <Scene id="intro">...</Scene>
      <Scene id="features">...</Scene>

      {/* Layout — your structure, your CSS */}
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', height: '100vh' }}>
        <Sidebar />
        <main style={{ position: 'relative' }}>
          <SceneCanvas style={{ width: '100%', height: '100%' }} />
          <EngineOverlayHost />
        </main>
      </div>
    </EngineProvider>
  );
}`}
      />

      <Callout type="note">
        <code>EngineInputRegion</code> is intentionally absent from the example above. When you
        control layout yourself, you don't need the scroll spacer and sticky container
        infrastructure. Use <code>ScrollCaptureSection</code> instead when you want scroll-driven
        progress in an embedded canvas.
      </Callout>

      {/* ── Section 5: Scenes don't care where the canvas is ─────────────── */}

      <h2>Scenes don't care where the canvas is</h2>

      <p>
        <code>{'<Scene>'}</code> elements register with <code>EngineProvider</code> via React
        context, not by where they are in the DOM. They can be declared at the top level of{' '}
        <code>EngineProvider</code>, in a separate component, or spread across imported files — it
        doesn't matter. The canvas just needs to be a descendant of the same{' '}
        <code>EngineProvider</code>.
      </p>

      {/* ── Section 6: Multiple ScenePlayers ─────────────────────────────── */}

      <h2>Multiple ScenePlayers on one page</h2>

      <p>
        You're not limited to one <code>ScenePlayer</code> per page. Each{' '}
        <code>EngineProvider</code> (or <code>ScenePlayer</code>) is fully independent — its own
        Three.js scene, its own <code>RuntimeLoop</code>, its own progress state. Use the{' '}
        <code>id</code> prop to identify engines and read state from outside via{' '}
        <code>useSceneEngineState(id)</code>.
      </p>

      <CodeBlock
        language="tsx"
        code={`export default function ComparePage() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      {/* Each ScenePlayer is a fully isolated engine */}
      <ScenePlayer id="left-engine" manifestUrl="/scenes/option-a.json" quality="balanced">
        <Scene id="default">
          <Camera type="world" position={[0, 2, 8]} />
        </Scene>
      </ScenePlayer>

      <ScenePlayer id="right-engine" manifestUrl="/scenes/option-b.json" quality="balanced">
        <Scene id="default">
          <Camera type="world" position={[0, 2, 8]} />
        </Scene>
      </ScenePlayer>
    </div>
  );
}`}
      />

      {/* ── Existing reference sections begin here ────────────────────────── */}

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

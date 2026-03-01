import { JSX } from 'react';
import { Link } from 'react-router';
import { CodeBlock } from '../../components/ui/CodeBlock';
import { PropTable } from '../../components/ui/PropTable';
import { Callout } from '../../components/ui/Callout';

export default function HudOverview(): JSX.Element {
  return (
    <section>
      <h1>Scene Overlay</h1>

      <p>
        HTML children placed inside <code>{'<Scene>'}</code> become 2D overlay content rendered on
        top of the Three.js canvas. This replaces the old <code>{'<Hud>'}</code> /{' '}
        <code>{'<HudItem>'}</code> DSL pattern, which has been removed.
      </p>

      <p>
        Overlay content is rendered by <code>{'<EngineOverlayHost>'}</code> — a separate React
        component that you place in your layout next to <code>{'<SceneCanvas>'}</code>. When the
        active scene changes, <code>EngineOverlayHost</code> swaps in the HTML children declared in
        the newly-active <code>{'<Scene>'}</code>.
      </p>

      <h2>Authoring Overlay Content</h2>

      <p>
        Place any HTML or React elements as direct children of <code>{'<Scene>'}</code> alongside
        your 3D element components. Non-element children are collected as overlay content and are
        not interpreted by the compiler.
      </p>

      <CodeBlock
        language="tsx"
        code={`<Scene key="hero">
  <Camera type="world" position={[2, 1.5, 6]} />
  <Background color="#0a0a0a" />

  {/* HTML children become overlay content for this scene */}
  <div style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)' }}>
    <h1 style={{ color: '#ffffff', fontSize: '3rem' }}>Hello World</h1>
  </div>
</Scene>

<Scene key="detail">
  <Camera type="world" position={[0, 1, 4]} />

  {/* Different overlay for this scene — replaces the previous one */}
  <div style={{ position: 'absolute', bottom: '15%', left: '10%' }}>
    <p style={{ color: '#cccccc' }}>Scroll to explore</p>
  </div>
</Scene>`}
      />

      <h2>Positioning Overlay Elements</h2>

      <p>
        The overlay container fills the same bounding box as the canvas. Use{' '}
        <code>position: absolute</code> with <code>top</code>, <code>right</code>,{' '}
        <code>bottom</code>, and <code>left</code> (or percentages) to place elements over the
        canvas. The overlay container itself is <code>position: relative</code> with{' '}
        <code>pointer-events: none</code> by default.
      </p>

      <CodeBlock
        language="tsx"
        code={`{/* Top-left corner */}
<div style={{ position: 'absolute', top: 24, left: 32 }}>
  <span style={{ color: '#ffffff', fontSize: '0.875rem' }}>01 / 04</span>
</div>

{/* Centered horizontally near the bottom */}
<div style={{
  position: 'absolute',
  bottom: 48,
  left: '50%',
  transform: 'translateX(-50%)',
  textAlign: 'center',
}}>
  <h2 style={{ color: '#ffffff' }}>Product Overview</h2>
  <p style={{ color: 'rgba(255,255,255,0.7)' }}>Engineered for performance</p>
</div>`}
      />

      <h2>
        <code>{'<EngineOverlayHost>'}</code>
      </h2>

      <p>
        Place <code>{'<EngineOverlayHost>'}</code> inside the same parent as{' '}
        <code>{'<SceneCanvas>'}</code>. It renders the active scene's overlay content and updates
        automatically on scene changes.
      </p>

      <CodeBlock
        language="tsx"
        code={`import { EngineProvider, SceneCanvas, EngineOverlayHost } from '@brewsite/core';

export default function Page() {
  return (
    <EngineProvider id="hero" manifestUrl="/assets/manifest.json">
      {/* Scene declarations (3D elements + overlay HTML) */}
      <Scene key="intro">
        <Camera type="world" position={[2, 1.5, 6]} />
        <div style={{ position: 'absolute', top: '20%', left: '10%' }}>
          <h1 style={{ color: '#fff' }}>Getting Started</h1>
        </div>
      </Scene>

      {/* Layout */}
      <main style={{ position: 'relative', width: '100%', height: '100vh' }}>
        <SceneCanvas style={{ width: '100%', height: '100%' }} />
        <EngineOverlayHost />
      </main>
    </EngineProvider>
  );
}`}
      />

      <PropTable
        rows={[
          {
            name: 'className',
            type: 'string',
            required: false,
            defaultValue: '—',
            description:
              'CSS class applied to the overlay host container element.',
          },
          {
            name: 'passthroughPointerEvents',
            type: 'boolean',
            required: false,
            defaultValue: 'false',
            description:
              'When true, the overlay host container has pointer-events: none, passing all clicks through to the canvas beneath. Individual children can still set pointer-events: auto to remain interactive.',
          },
        ]}
      />

      <h2>Interactive Overlay Elements</h2>

      <p>
        Because the overlay host uses <code>pointer-events: none</code> by default, child elements
        are also non-interactive unless you opt in. Set <code>pointer-events: auto</code> on any
        element that should receive clicks, hover, or focus events.
      </p>

      <CodeBlock
        language="tsx"
        code={`<Scene key="cta">
  <Camera type="world" position={[0, 1.5, 5]} />

  <div style={{ position: 'absolute', bottom: 48, right: 48 }}>
    {/* This button receives pointer events even when the host passes through */}
    <button
      style={{ pointerEvents: 'auto', padding: '12px 24px' }}
      onClick={() => router.push('/buy')}
    >
      Buy Now
    </button>
  </div>
</Scene>

{/* Or, disable passthrough entirely for a content-heavy overlay */}
<EngineOverlayHost passthroughPointerEvents={false} />`}
      />

      <h2>Migration from <code>{'<Hud>'}</code> / <code>{'<HudItem>'}</code></h2>

      <Callout type="warning">
        <code>{'<Hud>'}</code> and <code>{'<HudItem>'}</code> are no longer available. Replace
        them with plain HTML children inside <code>{'<Scene>'}</code> and add{' '}
        <code>{'<EngineOverlayHost>'}</code> to your layout.
      </Callout>

      <p>Before (old pattern):</p>

      <CodeBlock
        language="tsx"
        code={`<Scene key="intro" frames={120}>
  <Camera position={[0, 1.5, 4]} target={[0, 1, 0]} />
  <Hud enabled>
    <HudItem id="title" style={{ position: 'absolute', top: 40, left: 60 }}>
      <h2>Welcome</h2>
    </HudItem>
    <HudItem id="sub" style={{ position: 'absolute', bottom: 60, left: 60 }}>
      <p>Scroll to explore</p>
    </HudItem>
  </Hud>
</Scene>`}
      />

      <p>After (new pattern):</p>

      <CodeBlock
        language="tsx"
        code={`<Scene key="intro">
  <Camera type="world" position={[0, 1.5, 4]} />
  <div style={{ position: 'absolute', top: 40, left: 60 }}>
    <h2 style={{ color: '#fff' }}>Welcome</h2>
  </div>
  <div style={{ position: 'absolute', bottom: 60, left: 60 }}>
    <p style={{ color: '#fff' }}>Scroll to explore</p>
  </div>
</Scene>

{/* In your layout: */}
<main style={{ position: 'relative' }}>
  <SceneCanvas style={{ width: '100%', height: '100vh' }} />
  <EngineOverlayHost />
</main>`}
      />

      <Callout type="note">
        For scroll-driven entrance animations on overlay elements, see the{' '}
        <Link to="/core/hud-animejs">Anime.js Presets</Link> page. The{' '}
        <code>useScrollTimeline</code> hook and animation presets work with plain HTML overlay
        content authored as children in <code>{'<Scene>'}</code>.
      </Callout>
    </section>
  );
}

import type { ReactElement } from 'react';
import { Section, DocsDemo, CodeBlock, Callout } from '@brewsite/docs';
import type { SectionId } from '../../docs-nav';
import { HudOverlayDemo } from '../../demos/core/HudOverlayDemo.demo';

const BASIC_OVERLAY_CODE = `// HTML children inside <Scene> become overlay content rendered by EngineOverlayHost.
<Scene key="hero" id="hero">
  <Camera mode="world" position={[0, 2, 8]} target={[0, 1, 0]} />
  <div style={{ position: 'absolute', bottom: '8%', left: '6%', color: '#fff', pointerEvents: 'none' }}>
    <h1 style={{ fontSize: 42, fontWeight: 700 }}>BrewSite</h1>
  </div>
</Scene>`;

const SCENE_SPECIFIC_CODE = `<Scene key="intro">
  <Camera mode="world" position={[0, 2, 8]} target={[0, 1, 0]} />
  <div style={{ position: 'absolute', top: 24, left: 24, color: '#fff', fontWeight: 700 }}>
    Intro
  </div>
</Scene>

<Scene key="features">
  <div style={{ position: 'absolute', top: 24, left: 24, color: '#7bb3ff', fontWeight: 700 }}>
    Features
  </div>
</Scene>`;

const POINTER_EVENTS_CODE = `<Scene key="cta">
  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div>
      <h2 style={{ color: '#fff' }}>Ready to build?</h2>
      <a href="/docs" style={{ pointerEvents: 'auto', padding: '12px 28px', background: '#3b82f6', color: '#fff', borderRadius: 8, textDecoration: 'none' }}>
        Get Started
      </a>
    </div>
  </div>
</Scene>`;

const OVERLAY_HOST_CODE = `import { EngineProvider, SceneCanvas, EngineOverlayHost } from '@brewsite/core';

<EngineProvider manifestUrl="/manifest.json">
  <Scene key="hero">
    <Camera mode="world" position={[0, 2, 8]} target={[0, 1, 0]} />
    <h1 style={{ position: 'absolute', top: 40, left: 40, color: '#fff' }}>Hello</h1>
  </Scene>

  <div style={{ position: 'relative', height: '100vh' }}>
    <SceneCanvas style={{ width: '100%', height: '100%' }} />
    <EngineOverlayHost />
  </div>
</EngineProvider>`;

export function HudPage(): ReactElement {
  return (
    <Section<SectionId> id="hud" title="Overlay Content">
      <p>
        Any HTML or React children placed inside a <code>{'<Scene>'}</code> become 2D overlay
        content rendered above the Three.js canvas by <code>EngineOverlayHost</code>. This is how
        you add text, UI panels, callouts, and interactive elements to your scenes — no special
        wrapper component required.
      </p>

      <DocsDemo title="Overlay changes on scene transition" height={480}>
        <HudOverlayDemo />
      </DocsDemo>

      <h2>Basic Pattern</h2>
      <p>
        Place any JSX inside <code>{'<Scene>'}</code> alongside the DSL elements. The engine
        collects these HTML children and renders them in <code>EngineOverlayHost</code>.
      </p>
      <CodeBlock language="tsx" code={BASIC_OVERLAY_CODE} />

      <h2>Scene-Specific Content</h2>
      <p>
        Each <code>{'<Scene>'}</code> has its own overlay children. When the engine transitions
        between scenes, the outgoing scene's overlay is swapped for the incoming scene's overlay.
      </p>
      <CodeBlock language="tsx" code={SCENE_SPECIFIC_CODE} />

      <Callout type="note">
        3D DSL elements (<code>Camera</code>, <code>Lighting</code>, etc.) carry forward to
        subsequent scenes when not re-declared. HTML overlay children do <em>not</em> carry
        forward — each scene renders its own overlay from scratch.
      </Callout>

      <h2>Pointer Events</h2>
      <p>
        By default the overlay container does not block pointer events from reaching the canvas.
        When you need interactive overlay elements (buttons, links), use{' '}
        <code>{'pointer-events: none'}</code> on the overlay wrapper and{' '}
        <code>{'pointer-events: auto'}</code> on individual interactive children.
      </p>
      <CodeBlock language="tsx" code={POINTER_EVENTS_CODE} />

      <h2>EngineOverlayHost</h2>
      <p>
        <code>ScenePlayer</code> renders an <code>EngineOverlayHost</code> automatically.
        When using the <code>EngineProvider</code> composition pattern, add{' '}
        <code>{'<EngineOverlayHost />'}</code> yourself alongside <code>{'<SceneCanvas />'}</code>:
      </p>
      <CodeBlock language="tsx" code={OVERLAY_HOST_CODE} />

      <h2>Animation Presets</h2>
      <p>
        For smooth fade-in, slide-up, and scroll-driven entrance effects, wrap overlay content
        in Anime.js preset components. See{' '}
        <a href="#hud-animejs">Overlay Anime.js Presets</a>.
      </p>
    </Section>
  );
}

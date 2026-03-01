import { JSX } from 'react';
import { Link } from 'react-router';
import { CodeBlock } from '../../components/ui/CodeBlock';
import { Callout } from '../../components/ui/Callout';
import { LiveDemo } from '../../components/demo/LiveDemo';
import HudOverlayDemo, { CODE as HUD_CODE } from '../../demos/core/HudOverlayDemo.demo';

const BASIC_OVERLAY_CODE = `// HTML children inside <Scene> become overlay content rendered by EngineOverlayHost.
// Use position: absolute to place elements anywhere over the canvas.

<Scene key="hero" id="hero">
  <Camera mode="world" position={[0, 2, 8]} target={[0, 1, 0]} />

  {/* These elements appear above the 3D canvas */}
  <div style={{ position: 'absolute', bottom: '8%', left: '6%', color: '#fff', pointerEvents: 'none' }}>
    <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.18em', opacity: 0.6 }}>
      Introducing
    </span>
    <h1 style={{ fontSize: 42, fontWeight: 700, margin: '8px 0' }}>BrewSite</h1>
    <p style={{ fontSize: 16, opacity: 0.8 }}>Built for the next generation of 3D experiences.</p>
  </div>
</Scene>`;

const SCENE_SPECIFIC_CODE = `// Each scene has its own overlay children — they swap on scene transition.
// Declare only what is visible in that scene. No shared wrapper needed.

<Scene key="intro">
  <Camera mode="world" position={[0, 2, 8]} target={[0, 1, 0]} />
  <div style={{ position: 'absolute', top: 24, left: 24, color: '#fff', fontWeight: 700 }}>
    Intro — no subtitle here
  </div>
</Scene>

<Scene key="features">
  {/* Camera and lighting carry forward from "intro" — only overlay changes */}
  <div style={{ position: 'absolute', top: 24, left: 24, color: '#7bb3ff', fontWeight: 700 }}>
    Features
  </div>
  <div style={{ position: 'absolute', top: 56, left: 24, color: '#aaaacc', fontSize: 14 }}>
    Subtitle appears in this scene
  </div>
</Scene>`;

const POINTER_EVENTS_CODE = `// Add pointer-events: none to prevent overlay blocking canvas interaction.
// Re-enable on specific interactive elements.

<Scene key="cta">
  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div>
      <h2 style={{ color: '#fff' }}>Ready to build?</h2>
      {/* Re-enable for clickable elements */}
      <a href="/docs" style={{ pointerEvents: 'auto', padding: '12px 28px', background: '#3b82f6', color: '#fff', borderRadius: 8, textDecoration: 'none' }}>
        Get Started
      </a>
    </div>
  </div>
</Scene>`;

const OVERLAY_HOST_CODE = `// ScenePlayer wires EngineOverlayHost automatically.
// For EngineProvider composition, add it explicitly:

import { EngineProvider, SceneCanvas, EngineOverlayHost } from '@brewsite/core';

<EngineProvider manifestUrl="/manifest.json">
  <Scene key="hero">
    <Camera mode="world" position={[0, 2, 8]} target={[0, 1, 0]} />
    <h1 style={{ position: 'absolute', top: 40, left: 40, color: '#fff' }}>Hello</h1>
  </Scene>

  <div style={{ position: 'relative', height: '100vh' }}>
    <SceneCanvas style={{ width: '100%', height: '100%' }} />
    {/* EngineOverlayHost renders all scene overlay children here */}
    <EngineOverlayHost />
  </div>
</EngineProvider>`;

export default function HudOverview(): JSX.Element {
  return (
    <section>
      <h1>Overlay Content</h1>

      <p>
        Any HTML or React children placed inside a <code>{'<Scene>'}</code> become 2D overlay
        content rendered above the Three.js canvas by <code>EngineOverlayHost</code>. This is how
        you add text, UI panels, callouts, and interactive elements to your scenes — no special
        wrapper component required.
      </p>

      <LiveDemo title="Overlay changes on scene transition" code={HUD_CODE}>
        <HudOverlayDemo />
      </LiveDemo>

      <h2>Basic Pattern</h2>

      <p>
        Place any JSX inside <code>{'<Scene>'}</code> alongside the DSL elements. The engine
        collects these HTML children and renders them in <code>EngineOverlayHost</code>, which is
        an <code>{'<div>'}</code> positioned absolutely over the canvas.
      </p>

      <CodeBlock language="tsx" code={BASIC_OVERLAY_CODE} />

      <h2>Scene-Specific Content</h2>

      <p>
        Each <code>{'<Scene>'}</code> has its own overlay children. When the engine transitions
        between scenes, the outgoing scene's overlay is swapped for the incoming scene's overlay.
        Declare only what should be visible in that particular scene.
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
        When using the <code>EngineProvider</code> composition pattern (custom layouts), add{' '}
        <code>{'<EngineOverlayHost />'}</code> yourself alongside <code>{'<SceneCanvas />'}</code>:
      </p>

      <CodeBlock language="tsx" code={OVERLAY_HOST_CODE} />

      <h2>Animation Presets</h2>

      <p>
        For smooth fade-in, slide-up, and scroll-driven entrance effects, wrap overlay content
        in Anime.js preset components. See{' '}
        <Link to="/core/hud-animejs">Overlay Anime.js Presets</Link>.
      </p>
    </section>
  );
}

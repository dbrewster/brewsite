import type { ReactElement } from 'react';
import { Section, DocsDemo, CodeBlock, Callout } from '@brewsite/docs';
import type { SectionId } from '../../docs-nav';
import { MultiSceneDemo } from '../../demos/core/MultiSceneDemo.demo';

export function GettingStartedPage(): ReactElement {
  return (
    <Section<SectionId> id="getting-started" title="What is BrewSite Core?">
      <p className="lead">
        <strong>@brewsite/core</strong> is a TypeScript + React + Three.js framework for building
        animated 3D marketing scenes. You describe scenes declaratively using a JSX DSL — the
        compiler pre-bakes smooth transitions into a flat track that renders at 60fps with zero
        frame-time computation.
      </p>

      <ul className="feature-list">
        <li>
          <span className="feature-icon">🎬</span>
          <span>
            <strong>Declarative Scene DSL</strong> — describe state, not animation
          </span>
        </li>
        <li>
          <span className="feature-icon">⚡</span>
          <span>
            <strong>Pre-baked SceneTrack</strong> — O(1) sampling, zero jank
          </span>
        </li>
        <li>
          <span className="feature-icon">🧩</span>
          <span>
            <strong>Widget SDK</strong> — extend with custom renderable concepts
          </span>
        </li>
        <li>
          <span className="feature-icon">🔄</span>
          <span>
            <strong>Scroll &amp; Direct Mode</strong> — scroll-driven or programmatic control
          </span>
        </li>
      </ul>

      <DocsDemo title="Three scenes, one ScenePlayer" height={480}>
        <MultiSceneDemo />
      </DocsDemo>

      <p>
        <a href="#quick-start" className="btn btn--primary">
          Get Started →
        </a>
      </p>

      <Callout type="tip">
        You'll have a running 3D animation scene in about 15 minutes. Start with{' '}
        <a href="#quick-start">Quick Start</a>.
      </Callout>

      <h2>How it works</h2>

      <p>
        Unlike timeline-based animation tools, BrewSite is purely declarative. You write JSX that
        describes what your scene looks like at each keyframe — camera position, lighting color,
        background, floor opacity. The compiler handles the rest: it computes the interpolated
        values between every scene pair and pre-bakes them into a flat <code>SceneTrack</code>{' '}
        array.
      </p>

      <p>
        At runtime, advancing from scene to scene is a single array lookup — no easing math, no
        interpolation, no garbage. The Three.js render layer just reads from the pre-baked state
        and draws.
      </p>

      <h2>What's in the box</h2>

      <p>
        <code>@brewsite/core</code> ships everything you need to build scroll-driven 3D sequences:
      </p>

      <ul>
        <li>
          <strong>Scene DSL</strong> — <code>&lt;Scene&gt;</code>, <code>&lt;Camera&gt;</code>,{' '}
          <code>&lt;Lighting&gt;</code>, <code>&lt;Background&gt;</code>,{' '}
          <code>&lt;Floor&gt;</code>, <code>&lt;Environment&gt;</code>
        </li>
        <li>
          <strong>ScenePlayer</strong> — React component that mounts a Three.js canvas and drives
          the render loop
        </li>
        <li>
          <strong>Scroll integration</strong> — <code>EngineScrollRegion</code> and{' '}
          <code>useEngineScroll</code> hook for scroll-driven progress
        </li>
        <li>
          <strong>HUD system</strong> — overlay 2D content with scroll-driven Anime.js transitions
        </li>
        <li>
          <strong>Widget SDK</strong> — <code>IWidget</code> interface for building your own
          renderable concepts
        </li>
        <li>
          <strong>Model loading</strong> — GLTF model loading and animation playback
        </li>
      </ul>

      <CodeBlock
        language="bash"
        code="npm install @brewsite/core three react react-dom"
      />
    </Section>
  );
}

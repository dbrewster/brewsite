import { JSX } from 'react';
import {
  Scene,
  Camera,
  Lighting,
  Ambient,
  Directional,
  Background,
  Floor,
  FloorPhysical,
  ProgressManager,
} from '@brewsite/core';
import { DWELL_FN } from '../../sceneUtils';
import { DocPanel } from '../../../components/content/DocPanel';
import { CodeBlock } from '../../../components/ui/CodeBlock';

function WhatIsBrewSiteContent(): JSX.Element {
  return (
    <DocPanel slideInBy={0.3}>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', margin: '0 0 8px', fontWeight: 700 }}>
        What is BrewSite Core?
      </h1>
      <p style={{ fontSize: 'var(--font-size-lg)', color: 'var(--text-secondary)', margin: '0 0 24px' }}>
        <strong>@brewsite/core</strong> is a TypeScript + React + Three.js framework for building
        animated 3D marketing scenes. You describe scenes declaratively using a JSX DSL — the
        compiler pre-bakes smooth transitions into a flat track that renders at 60fps with zero
        frame-time computation.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { icon: '🎬', title: 'Declarative Scene DSL', desc: 'Describe state, not animation. You write snapshots; the compiler fills in transitions.' },
          { icon: '⚡', title: 'Pre-baked SceneTrack', desc: 'O(1) sampling at runtime. All interpolation is computed once, at compile time.' },
          { icon: '🧩', title: 'Widget SDK', desc: 'Extend with custom renderable concepts using the IWidget interface.' },
          { icon: '🔄', title: 'Scroll & Direct Mode', desc: 'Scroll-driven or programmatic control. Dwell, auto-advance, and more.' },
        ].map((f) => (
          <div
            key={f.title}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: '16px 18px',
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 8 }}>{f.icon}</div>
            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', marginBottom: 4 }}>{f.title}</div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{f.desc}</div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '0 0 12px' }}>How it works</h2>
      <p style={{ fontSize: 'var(--font-size-base)', lineHeight: 1.65, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
        Unlike timeline-based animation tools, BrewSite is purely declarative. You write JSX that
        describes what your scene looks like at each keyframe — camera position, lighting color,
        background, floor opacity. The compiler handles the rest: it computes interpolated values
        between every scene pair and pre-bakes them into a flat <code>SceneTrack</code> array.
      </p>
      <p style={{ fontSize: 'var(--font-size-base)', lineHeight: 1.65, color: 'var(--text-secondary)', margin: '0 0 24px' }}>
        At runtime, advancing from scene to scene is a single array lookup — no easing math, no
        interpolation, no garbage. The Three.js render layer just reads from the pre-baked state.
      </p>

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '0 0 12px' }}>What&apos;s in the box</h2>
      <CodeBlock
        language="bash"
        code="npm install @brewsite/core three react react-dom"
      />
      <ul style={{ fontSize: 'var(--font-size-base)', lineHeight: 1.7, color: 'var(--text-secondary)', paddingLeft: 20, margin: '16px 0 0' }}>
        <li><strong>Scene DSL</strong> — <code>&lt;Scene&gt;</code>, <code>&lt;Camera&gt;</code>, <code>&lt;Lighting&gt;</code>, <code>&lt;Background&gt;</code>, <code>&lt;Floor&gt;</code>, <code>&lt;Environment&gt;</code></li>
        <li><strong>ScenePlayer</strong> — mounts a Three.js canvas and drives the render loop</li>
        <li><strong>ProgressManager</strong> — per-scene scroll budget and pacing curves</li>
        <li><strong>HUD system</strong> — overlay 2D content with scroll-driven Anime.js transitions</li>
        <li><strong>Widget SDK</strong> — <code>IWidget</code> interface for custom renderable concepts</li>
      </ul>
    </DocPanel>
  );
}

export function SceneWhatIsBrewSite(): JSX.Element {
  return (
    <Scene key="scene-what-is-brewsite" id="scene-what-is-brewsite">
      <ProgressManager scrollUnits={2400} fn={DWELL_FN} />
      <Camera mode="world" position={[0, 1.8, 8]} target={[0, 0.8, 0]} fov={40} />
      <Background color="#0d0f1a" />
      <Lighting>
        <Ambient color="#4466ff" intensity={0.4} />
        <Directional color="#ffffff" intensity={1.6} position={[4, 10, 6]} />
      </Lighting>
      <Floor enabled>
        <FloorPhysical opacity={0.35} metalness={0.4} roughness={0.6} />
      </Floor>

      <WhatIsBrewSiteContent />
    </Scene>
  );
}

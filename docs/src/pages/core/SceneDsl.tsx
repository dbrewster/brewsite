import type { ReactElement } from 'react';
import { Section, DocsDemo, CodeBlock, PropTable, Callout } from '@brewsite/docs';
import type { SectionId } from '../../docs-nav';
import { BasicSceneDemo } from '../../demos/core/BasicSceneDemo.demo';

export function SceneDslPage(): ReactElement {
  return (
    <Section<SectionId> id="scene-dsl" title="Scene DSL">
      <h2><code>&lt;Scene&gt;</code> Component</h2>

      <p>
        The <code>&lt;Scene&gt;</code> component is the fundamental authoring primitive. Each{' '}
        <code>&lt;Scene&gt;</code> represents a keyframe — a complete snapshot of your 3D world at
        one point in the timeline.
      </p>

      <PropTable
        rows={[
          {
            name: 'key',
            type: 'React.Key',
            required: true,
            description:
              'Stable string identifier for this scene. Used for SceneTrack compilation and scene change callbacks. Do not use array indices.',
          },
          {
            name: 'id',
            type: 'string',
            required: false,
            description:
              'Deprecated: use the React key prop. Backward-compatible alias retained for existing scenes.',
          },
          {
            name: 'transition',
            type: '{ easing?: EasingName }',
            required: false,
            description:
              "Override the easing curve for this scene's entry transition.",
          },
        ]}
      />

      <DocsDemo title="Minimal scene setup" height={480}>
        <BasicSceneDemo />
      </DocsDemo>

      <h2>Scene Identity</h2>

      <Callout type="warning">
        Always set <code>key</code> as a stable, unique string. Do not use array indices — they
        break the SceneTrack cache when scenes are reordered.
      </Callout>

      <CodeBlock
        language="tsx"
        code={`// Good — stable, descriptive string keys
<Scene key="hero-intro">...</Scene>
<Scene key="product-detail">...</Scene>
<Scene key="cta-close">...</Scene>

// Bad — array indices break reordering and cache invalidation
{scenes.map((s, i) => (
  <Scene key={i}>...</Scene>
))}`}
      />

      <h2>Elements Inside <code>&lt;Scene&gt;</code></h2>

      <p>
        Place element components as direct children of <code>&lt;Scene&gt;</code>. Only declare the
        elements whose state you want to specify in this scene — undeclared elements inherit from the
        previous scene.
      </p>

      <ul>
        <li><a href="#camera"><code>&lt;Camera&gt;</code></a> — camera position, mode, and interaction</li>
        <li><a href="#lighting"><code>&lt;Lighting&gt;</code></a> — ambient and directional lights</li>
        <li><a href="#background"><code>&lt;Background&gt;</code></a> — scene background color or texture</li>
        <li><a href="#floor"><code>&lt;Floor&gt;</code></a> — reflective floor plane</li>
        <li><a href="#environment"><code>&lt;Environment&gt;</code></a> — HDR environment map</li>
        <li><a href="#model"><code>&lt;Model&gt;</code></a> — GLTF model, position, and animation clip</li>
        <li><a href="#hud"><code>&lt;Hud&gt;</code></a> — 2D overlay with scroll-driven transitions</li>
        <li><a href="#input-navigation"><code>&lt;InputController&gt;</code></a> — scroll/direct-mode scene navigation</li>
      </ul>

      <h2>Scene Inheritance</h2>

      <p>
        Elements not declared in a scene inherit the previous scene's state. You only need to
        specify what changes.
      </p>

      <CodeBlock
        language="tsx"
        code={`<Scene key="scene-a">
  <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
  <Lighting>
    <Ambient color="#ffffff" intensity={0.5} />
    <Directional color="#ffffff" intensity={1.0} position={[5, 10, 5]} />
  </Lighting>
  <Floor enabled>
    <FloorPhysical opacity={0.6} />
  </Floor>
</Scene>

<Scene key="scene-b">
  {/*
    Only the Camera changes. Lighting and Floor carry forward
    from scene-a without re-declaration.
  */}
  <Camera mode="world" position={[-4, 3, 6]} target={[1, 0, 0]} />
</Scene>`}
      />
    </Section>
  );
}

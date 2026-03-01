import { JSX } from 'react';
import { Link } from 'react-router';
import { CodeBlock } from '../../components/ui/CodeBlock';
import { PropTable } from '../../components/ui/PropTable';
import { Callout } from '../../components/ui/Callout';
import { LiveDemo } from '../../components/demo/LiveDemo';
import BasicSceneDemo, { CODE as BASIC_CODE } from '../../demos/core/BasicSceneDemo.demo';

export default function SceneDsl(): JSX.Element {
  return (
    <section>
      <h1>Scene DSL</h1>

      <h2>
        <code>&lt;Scene&gt;</code> Component
      </h2>

      <p>
        The <code>&lt;Scene&gt;</code> component is the fundamental authoring primitive. Each{' '}
        <code>&lt;Scene&gt;</code> represents a keyframe — a complete snapshot of your 3D world at
        one point in the timeline. Scenes are compiled into a flat <code>SceneTrack</code> that the
        runtime samples at 60fps.
      </p>

      <p>
        You don't animate properties directly. You describe what each scene should look like, and
        the compiler infers what to interpolate between consecutive scenes.
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
              "Override the easing curve for this scene's entry transition. Controls how the animation moves from the previous scene into this one.",
          },
        ]}
      />

      <LiveDemo title="Minimal scene setup" code={BASIC_CODE}>
        <BasicSceneDemo />
      </LiveDemo>

      <h2>Scene Identity</h2>

      <p>
        Use React's <code>key</code> prop as the scene identifier. The compiler uses the key to
        match scenes across renders and bake the <code>SceneTrack</code>. Stable, unique keys also
        enable the scene cache to avoid recompilation when unrelated scenes change.
      </p>

      <Callout type="warning">
        Always set <code>key</code> as a stable, unique string. Do not use array indices — they
        break the SceneTrack cache when scenes are reordered and produce incorrect transitions.
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
        Place element components as direct children of <code>&lt;Scene&gt;</code>. Each element
        controls one aspect of the 3D world. Only declare the elements whose state you want to
        specify in this scene — undeclared elements inherit from the previous scene.
      </p>

      <ul>
        <li>
          <Link to="/core/camera">
            <code>&lt;Camera&gt;</code>
          </Link>{' '}
          — camera position, mode, and interaction
        </li>
        <li>
          <Link to="/core/lighting">
            <code>&lt;Lighting&gt;</code>
          </Link>{' '}
          — ambient and directional lights
        </li>
        <li>
          <Link to="/core/background">
            <code>&lt;Background&gt;</code>
          </Link>{' '}
          — scene background color or texture
        </li>
        <li>
          <Link to="/core/floor">
            <code>&lt;Floor&gt;</code>
          </Link>{' '}
          — reflective floor plane
        </li>
        <li>
          <Link to="/core/environment">
            <code>&lt;Environment&gt;</code>
          </Link>{' '}
          — HDR environment map
        </li>
        <li>
          <Link to="/core/model">
            <code>&lt;Model&gt;</code>
          </Link>{' '}
          — GLTF model, position, and animation clip
        </li>
        <li>
          <Link to="/core/hud">
            Scene Overlay
          </Link>{' '}
          — HTML children rendered as a 2D overlay via <code>EngineOverlayHost</code>
        </li>
        <li>
          <Link to="/core/progress-manager">
            <code>&lt;ProgressManager&gt;</code>
          </Link>{' '}
          — per-scene scroll weighting and pacing curve
        </li>
        <li>
          <Link to="/core/input-navigation">
            <code>&lt;InputController&gt;</code>
          </Link>{' '}
          — scroll/direct-mode scene navigation controller
        </li>
      </ul>

      <h2>Overlay Content</h2>

      <p>
        Any non-element HTML or React children inside <code>{'<Scene>'}</code> are collected as
        overlay content and rendered on top of the canvas by{' '}
        <code>{'<EngineOverlayHost>'}</code>. Use <code>position: absolute</code> to place
        elements over the canvas area.
      </p>

      <CodeBlock
        language="tsx"
        code={`<Scene key="hero">
  <Camera type="world" position={[2, 1.5, 6]} />
  <Background color="#0a0a0a" />

  {/* This div becomes overlay content for this scene */}
  <div style={{ position: 'absolute', top: '15%', left: '10%' }}>
    <h1 style={{ color: '#ffffff' }}>Hello World</h1>
  </div>
</Scene>`}
      />

      <p>
        See <Link to="/core/hud">Scene Overlay</Link> for the full guide including{' '}
        <code>EngineOverlayHost</code> props, interactive element handling, and migration from the
        old <code>{'<Hud>'}</code> pattern.
      </p>

      <h2>Scroll Weighting (<code>{'<ProgressManager>'}</code>)</h2>

      <p>
        By default every scene receives the same share of the scroll budget. Use{' '}
        <code>{'<ProgressManager>'}</code> to give a scene more (or less) scroll real estate and
        to apply a custom pacing curve for how the scene's internal progress advances.
      </p>

      <CodeBlock
        language="tsx"
        code={`<Scene key="installation">
  {/*
    This scene gets 2400 scroll units — 6× a scene with 400 units.
    The fn pacing curve animates in the first 25% of scroll,
    then holds the final pose for the remaining 75%.
  */}
  <ProgressManager scrollUnits={2400} fn={(t) => Math.min(1, t * 4)} />
  <Camera type="world" position={[0, 2, 8]} />
</Scene>`}
      />

      <p>
        See <Link to="/core/progress-manager">ProgressManager</Link> for the full reference
        including <code>scrollUnits</code>, <code>fn</code> constraints, and carry-forward
        semantics.
      </p>

      <h2>Scene Inheritance</h2>

      <p>
        Elements not declared in a scene inherit the previous scene's state. You only need to
        specify what changes. This keeps scenes concise and makes the diff between consecutive
        scenes immediately obvious at a glance.
      </p>

      <CodeBlock
        language="tsx"
        code={`<Scene key="scene-a">
  {/* Camera, Lighting, and Floor are all set here */}
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
    </section>
  );
}

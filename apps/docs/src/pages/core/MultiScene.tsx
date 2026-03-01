import { JSX } from 'react';
import { CodeBlock } from '../../components/ui/CodeBlock';
import { Callout } from '../../components/ui/Callout';
import { LiveDemo } from '../../components/demo/LiveDemo';
import MultiSceneDemo, { CODE as MULTI_CODE } from '../../demos/core/MultiSceneDemo.demo';

export default function MultiScene(): JSX.Element {
  return (
    <section>
      <h1>Multi-Scene Sequences</h1>

      <p>
        BrewSite scenes are a sequence of keyframes. The <code>ScenePlayer</code> interpolates
        smoothly between them as the user scrolls (or as you drive progress programmatically). Each
        scene occupies an equal share of the total progress range, and only the props that differ
        from the previous scene are animated.
      </p>

      <LiveDemo title="3-scene sequence" code={MULTI_CODE}>
        <MultiSceneDemo />
      </LiveDemo>

      <h2>Ordering Scenes</h2>

      <p>
        Place <code>&lt;Scene&gt;</code> elements as children of <code>ScenePlayer</code> in order.
        The first scene is at progress <code>0</code>, the last is at progress <code>1</code>.
        Scenes are compiled in the order they appear — their position in the JSX tree is their
        position in the timeline.
      </p>

      <CodeBlock
        language="tsx"
        code={`<ScenePlayer manifestUrl="/manifest.json" widgetSetup={() => registry}>
  <Scene key="s1">
    <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
    <Lighting>
      <Ambient color="#ffffff" intensity={0.4} />
    </Lighting>
  </Scene>

  <Scene key="s2">
    <Camera mode="orbit" target={[0, 0, 0]} azimuth={1.0} polar={1.2} distance={6} />
    <Lighting>
      <Ambient color="#8855ff" intensity={0.6} />
    </Lighting>
  </Scene>

  <Scene key="s3">
    <Camera mode="world" position={[5, 3, 5]} target={[0, 0, 0]} />
    <Lighting>
      <Ambient color="#4488ff" intensity={0.5} />
    </Lighting>
  </Scene>
</ScenePlayer>`}
      />

      <h2>How Progress Works</h2>

      <p>
        Progress is a normalized value in <code>[0, 1]</code> that spans the entire scene
        sequence. Each scene occupies an equal share of that range:
      </p>

      <CodeBlock
        language="typescript"
        code={`// Given N scenes, each scene spans 1/N of the progress range:
// Scene 0: progress [0.00, 0.33)
// Scene 1: progress [0.33, 0.67)
// Scene 2: progress [0.67, 1.00]

const sceneIndex = Math.floor(progress * sceneCount);`}
      />

      <p>
        Within each scene's progress range, the value drives the transition easing from the
        previous scene's state to this scene's state. At <code>progress === 0</code> within a
        scene, the interpolated state matches the previous scene exactly. At{' '}
        <code>progress === 1</code>, it matches this scene's declared state.
      </p>

      <h2>Scene Count and Frame Resolution</h2>

      <p>
        The <code>SceneTrack</code> is pre-baked with a fixed number of ticks per scene. By
        default, the compiler uses a balanced tick count appropriate for most scenes. You can tune
        this with the <code>quality</code> prop on <code>ScenePlayer</code> for smoother or faster
        compilation:
      </p>

      <CodeBlock
        language="tsx"
        code={`{/* Default — good balance for most scenes */}
<ScenePlayer quality="balanced" manifestUrl="/manifest.json" widgetSetup={() => registry}>
  ...
</ScenePlayer>

{/* High — 120 ticks per scene, smoother transitions */}
<ScenePlayer quality="high" manifestUrl="/manifest.json" widgetSetup={() => registry}>
  ...
</ScenePlayer>`}
      />

      <Callout type="note">
        Higher quality increases compile time and memory for the SceneTrack, but has zero effect on
        runtime performance — the tick loop still does one array lookup per frame.
      </Callout>

      <h2>Scene Inheritance</h2>

      <p>
        Only props that differ from the previous scene are animated. Unchanged props hold their
        value with no re-declaration needed. The compiler detects which widget states are identical
        between scenes and skips their interpolation entirely.
      </p>

      <Callout type="tip">
        Only declare what changes. This makes scenes concise and the SceneTrack cache efficient.
        The compiler is fast enough that a large scene with dozens of widgets still compiles in
        milliseconds.
      </Callout>

      <CodeBlock
        language="tsx"
        code={`<Scene key="s1">
  {/* Everything declared here */}
  <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
  <Lighting>
    <Ambient color="#ffffff" intensity={0.4} />
    <Directional color="#ffffff" intensity={1.0} position={[5, 10, 5]} />
  </Lighting>
  <Floor enabled>
    <FloorPhysical opacity={0.6} metalness={0.4} roughness={0.6} />
  </Floor>
</Scene>

<Scene key="s2">
  {/* Only camera changes — Lighting and Floor hold their s1 values */}
  <Camera mode="world" position={[5, 4, 5]} target={[0, 0, 0]} />
</Scene>

<Scene key="s3">
  {/* Camera and ambient light change — Floor still holds s1 values */}
  <Camera mode="orbit" target={[0, 0, 0]} azimuth={0.5} polar={1.0} distance={7} />
  <Lighting>
    <Ambient color="#4466ff" intensity={0.6} />
  </Lighting>
</Scene>`}
      />
    </section>
  );
}

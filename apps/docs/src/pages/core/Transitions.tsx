import { JSX } from 'react';
import { Link } from 'react-router';
import { CodeBlock } from '../../components/ui/CodeBlock';
import { PropTable } from '../../components/ui/PropTable';
import { Callout } from '../../components/ui/Callout';
import { LiveDemo } from '../../components/demo/LiveDemo';
import TransitionEasingDemo, { CODE as EASING_CODE } from '../../demos/core/TransitionEasingDemo.demo';

export default function Transitions(): JSX.Element {
  return (
    <section>
      <h1>Transitions &amp; Easing</h1>

      <p>
        Every scene-to-scene transition is driven by an easing curve. The easing is pre-baked into
        the <code>SceneTrack</code> at compile time — there is no runtime interpolation cost. You
        choose an easing curve once per scene entry, and the compiler samples it at every tick in
        that scene's transition block.
      </p>

      <LiveDemo title="Easing variants" code={EASING_CODE}>
        <TransitionEasingDemo />
      </LiveDemo>

      <h2>
        The <code>transition</code> Prop
      </h2>

      <p>
        Pass a <code>transition</code> object to <code>&lt;Scene&gt;</code> to override the easing
        for that scene's entry. Without it, the compiler uses the default easing curve
        (<code>easeOutCubic</code>), which gives a natural deceleration into the target state.
      </p>

      <CodeBlock
        language="tsx"
        code={`<Scene key="s1">
  <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
</Scene>

{/* This scene's entry will use easeOutExpo — fast start, sharp snap to rest */}
<Scene key="s2" transition={{ easing: 'easeOutExpo' }}>
  <Camera mode="world" position={[5, 3, 5]} target={[0, 0, 0]} />
</Scene>`}
      />

      <h2>Available Easing Names</h2>

      <PropTable
        rows={[
          {
            name: 'linear',
            type: 'EasingName',
            description: 'Constant speed from start to end. Mechanical feel — best for data-driven transitions where smoothing would obscure the change.',
          },
          {
            name: 'easeOutCubic',
            type: 'EasingName',
            defaultValue: 'default',
            description: 'Decelerates to rest with a cubic curve. Natural and polished — the recommended default for most transitions.',
          },
          {
            name: 'easeOutExpo',
            type: 'EasingName',
            description: 'Very fast start, then sharp snap to the final state. Creates a high-energy, snappy feel. Good for dramatic camera moves.',
          },
          {
            name: 'easeInOutSine',
            type: 'EasingName',
            description: 'Gentle symmetric ease — accelerates gradually, peaks at midpoint, then decelerates. Smooth and unobtrusive.',
          },
          {
            name: 'easeInOutCubic',
            type: 'EasingName',
            description: 'Symmetric cubic ease — stronger acceleration and deceleration than easeInOutSine. More dramatic at higher speeds.',
          },
        ]}
      />

      <Callout type="tip">
        When in doubt, use <code>easeOutCubic</code> (the default). It works well for almost all
        camera moves and color transitions. Use <code>easeOutExpo</code> for high-energy or reveal
        moments where you want a sharp arrival.
      </Callout>

      <h2>How Transitions Are Baked</h2>

      <p>
        Transitions are computed once at compile time, not on every frame. The compiler determines
        the transition block between each pair of adjacent scenes, applies the easing function to
        sample a normalized progress value <code>t ∈ [0, 1]</code> at each tick, then stores the
        resulting interpolated widget states in the flat <code>SceneTrack</code> array.
      </p>

      <p>
        At playback time, the runtime does no easing math whatsoever. It reads pre-computed state
        directly from the track.
      </p>

      <Callout type="note">
        Changing a scene's <code>transition</code> prop triggers SceneTrack recompilation. In
        development this happens instantly. In production the track is cached by a hash of the
        compiled DSL nodes — the cache is invalidated only when scene structure changes.
      </Callout>

      <h2>Entry vs. Exit Transitions</h2>

      <p>
        The <code>transition</code> prop applies to the <strong>incoming scene's entry</strong>,
        not the outgoing scene's exit. This means the transition is always defined on the
        destination scene, not the source scene.
      </p>

      <CodeBlock
        language="tsx"
        code={`<Scene key="scene-a">
  {/* No transition prop — this is the starting state */}
  <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
</Scene>

<Scene key="scene-b" transition={{ easing: 'easeOutExpo' }}>
  {/*
    The easeOutExpo curve controls the A → B transition.
    "transition" on scene-b = how we arrive at scene-b from scene-a.
  */}
  <Camera mode="world" position={[5, 3, 5]} target={[0, 0, 0]} />
</Scene>

<Scene key="scene-c" transition={{ easing: 'easeInOutSine' }}>
  {/*
    The easeInOutSine curve controls the B → C transition.
  */}
  <Camera mode="world" position={[-3, 4, 6]} target={[0, 0, 0]} />
</Scene>`}
      />

      <h2>Custom Transition Specs</h2>

      <p>
        For widget authors building custom renderable concepts, BrewSite exposes two lower-level
        transition contracts for full control over interpolation:
      </p>

      <ul>
        <li>
          <strong>ElementTransitionSpec</strong> — discrete batch-fill model. The compiler calls{' '}
          <code>exit</code>, <code>enter</code>, or <code>interpolate</code> once per transition,
          passing a slice of <code>SceneTrackTick[]</code> to fill.
        </li>
        <li>
          <strong>FunctionalTransitionSpec</strong> — closure-based model. The compiler calls your
          factory once with endpoint states. It returns a pure function of{' '}
          <code>t ∈ [0, 1]</code> that the runtime evaluates each frame.
        </li>
      </ul>

      <CodeBlock
        language="typescript"
        code={`import type { FunctionalTransitionSpec } from '@brewsite/core';

// Example: custom widget that fades its opacity value
const myTransitionSpec: FunctionalTransitionSpec<{ opacity: number }> = {
  exitFn: (fromState) => (t) => ({ opacity: fromState.opacity * (1 - t) }),
  enterFn: (toState) => (t) => ({ opacity: toState.opacity * t }),
  interpolateFn: (fromState, toState) => (t) => ({
    opacity: fromState.opacity + (toState.opacity - fromState.opacity) * t,
  }),
};`}
      />

      <p>
        <Link to="/core/widget-sdk">Read the Widget SDK docs →</Link> for the full contract and
        registration API.
      </p>
    </section>
  );
}

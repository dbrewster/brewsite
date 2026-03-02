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
      <h1>Transitions</h1>

      <p>
        Every scene-to-scene transition is controlled by a <code>TransitionWindow</code> — a pair of
        sub-ranges within the block's <code>[0, 1]</code> progress that independently control when
        the outgoing scene fades out (<code>exit</code>) and when the incoming scene fades in (
        <code>enter</code>). Transition timing is pre-baked into the <code>SceneTrack</code> at
        compile time — there is no runtime interpolation cost.
      </p>

      <LiveDemo title="Transition window variants" code={EASING_CODE}>
        <TransitionEasingDemo />
      </LiveDemo>

      <h2>
        The <code>transition</code> Prop
      </h2>

      <p>
        Pass a <code>TransitionWindow</code> to <code>&lt;Scene&gt;</code> to override the transition
        timing for that scene's entry. Without it, each widget's own <code>defaultWindow</code> (or
        the system default crossfade) applies.
      </p>

      <CodeBlock
        language="tsx"
        code={`import { TRANSITION_SEQUENTIAL } from '@brewsite/core';

<Scene key="s1">
  <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
</Scene>

{/* Exit completes before the enter begins — sequential fade */}
<Scene key="s2" transition={TRANSITION_SEQUENTIAL}>
  <Camera mode="world" position={[5, 3, 5]} target={[0, 0, 0]} />
</Scene>`}
      />

      <h2>Built-in Window Presets</h2>

      <PropTable
        rows={[
          {
            name: 'TRANSITION_CROSSFADE',
            type: 'TransitionWindow',
            defaultValue: 'system default',
            description: 'Exit [0, 0.5], Enter [0.5, 1] — classic cross-fade. Outgoing and incoming scenes overlap at the midpoint.',
          },
          {
            name: 'TRANSITION_SEQUENTIAL',
            type: 'TransitionWindow',
            description: 'Exit [0, 0.4], Enter [0.6, 1] — a small gap at the center. Outgoing finishes before incoming starts.',
          },
          {
            name: 'TRANSITION_EXIT_FIRST',
            type: 'TransitionWindow',
            description: 'Exit [0, 0.6], Enter [0.4, 1] — overlapping, but outgoing scene has more time before the incoming fully takes over.',
          },
          {
            name: 'TRANSITION_CUT',
            type: 'TransitionWindow',
            description: 'Instant cut — no blending. Exit collapses to bp=0, Enter to bp=1.',
          },
          {
            name: 'TRANSITION_DEFAULT',
            type: 'TransitionWindow',
            description: 'Empty object — defers to each widget\'s own defaultWindow. Equivalent to omitting the transition prop.',
          },
        ]}
      />

      <Callout type="tip">
        You can also pass a custom <code>TransitionWindow</code> inline:{' '}
        <code>{'transition={{ exit: [0, 0.3], enter: [0.7, 1] }}'}</code>. This gives the outgoing
        scene 30 % of the block and the incoming scene the last 30 %, with a 40 % dead-zone between
        them for a dramatic pause.
      </Callout>

      <h2>Per-Widget Easing via <code>&lt;Transition&gt;</code></h2>

      <p>
        Easing functions are declared per-widget using the <code>&lt;Transition&gt;</code> DSL
        component. Place it as a child of any renderable widget element. The parent widget's compile
        handler collects <code>&lt;Transition&gt;</code> children and stores them as{' '}
        <code>__transitionGroups</code> on the compiled state, where{' '}
        <code>FunctionalTransitionSpec</code> closures read them via <code>makeResolver</code>.
      </p>

      <CodeBlock
        language="tsx"
        code={`import { easeOutExpo, easeInOutCubic } from '@brewsite/core';

<Scene key="s2" transition={TRANSITION_CROSSFADE}>
  {/* Apply a custom ease to the model's transition */}
  <Model id="hero" src="/hero.glb">
    <Transition
      exit={{ window: [0, 0.4], ease: easeOutExpo }}
      enter={{ window: [0.6, 1], ease: easeInOutCubic }}
    />
  </Model>
</Scene>`}
      />

      <h2>Entry vs. Exit Ownership</h2>

      <p>
        The <code>transition</code> prop belongs to the <strong>incoming scene</strong>, not the
        outgoing one. The transition from scene A to scene B is always declared on scene B.
      </p>

      <CodeBlock
        language="tsx"
        code={`<Scene key="scene-a">
  {/* No transition prop — this is the starting state */}
  <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
</Scene>

<Scene key="scene-b" transition={TRANSITION_SEQUENTIAL}>
  {/*
    TRANSITION_SEQUENTIAL controls the A → B transition.
    "transition" on scene-b = how we arrive at scene-b from scene-a.
  */}
  <Camera mode="world" position={[5, 3, 5]} target={[0, 0, 0]} />
</Scene>

<Scene key="scene-c" transition={TRANSITION_CROSSFADE}>
  {/* TRANSITION_CROSSFADE controls the B → C transition. */}
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
          <code>TransitionContext</code> that the runtime evaluates each frame. Use{' '}
          <code>ctx.t</code> for default easing, or <code>ctx.channel('name')</code> for
          per-property channel easing declared via <code>&lt;Transition&gt;</code> children.
        </li>
      </ul>

      <CodeBlock
        language="typescript"
        code={`import type { FunctionalTransitionSpec } from '@brewsite/core';

// Example: custom widget that fades its opacity value
const myTransitionSpec: FunctionalTransitionSpec<{ opacity: number }> = {
  exitFn: (fromState) => (ctx) => ({ opacity: fromState.opacity * (1 - ctx.t) }),
  enterFn: (toState) => (ctx) => ({ opacity: toState.opacity * ctx.t }),
  interpolateFn: (fromState, toState) => (ctx) => ({
    opacity: fromState.opacity + (toState.opacity - fromState.opacity) * ctx.t,
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

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
        Every scene-to-scene transition is driven by a configurable timing window. You control when
        the outgoing scene fades out (<code>exit</code> window) and when the incoming scene fades in
        (<code>enter</code> window). Both windows are specified as block-progress sub-ranges within{' '}
        <code>[0, 1]</code>.
      </p>

      <LiveDemo title="Window variants" code={EASING_CODE}>
        <TransitionEasingDemo />
      </LiveDemo>

      <h2>
        The <code>transition</code> Prop
      </h2>

      <p>
        Pass a <code>transition</code> object to <code>&lt;Scene&gt;</code> to control the timing
        windows for that scene's entry. Without it, the system default crossfade
        (<code>exit: [0, 0.5]</code> / <code>enter: [0.5, 1]</code>) applies.
      </p>

      <CodeBlock
        language="tsx"
        code={`<Scene key="s1">
  <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
</Scene>

{/* This scene fades in late — exit completes before enter starts */}
<Scene key="s2" transition={{ exit: [0, 0.4], enter: [0.6, 1] }}>
  <Camera mode="world" position={[5, 3, 5]} target={[0, 0, 0]} />
</Scene>`}
      />

      <h2>Preset Windows</h2>

      <p>
        Import named presets from <code>@brewsite/core</code> for common timing patterns:
      </p>

      <PropTable
        rows={[
          {
            name: 'TRANSITION_CROSSFADE',
            type: 'TransitionWindow',
            defaultValue: 'system default',
            description: 'exit: [0, 0.5] / enter: [0.5, 1] — standard crossfade split.',
          },
          {
            name: 'TRANSITION_SEQUENTIAL',
            type: 'TransitionWindow',
            description: 'exit: [0, 0.4] / enter: [0.6, 1] — brief pause between exit and enter.',
          },
          {
            name: 'TRANSITION_EXIT_FIRST',
            type: 'TransitionWindow',
            description: 'exit: [0, 0.6] / enter: [0.4, 1] — outgoing scene finishes slightly before entering.',
          },
          {
            name: 'TRANSITION_CUT',
            type: 'TransitionWindow',
            description: 'Instant switch with no blending.',
          },
        ]}
      />

      <CodeBlock
        language="tsx"
        code={`import { TRANSITION_SEQUENTIAL } from '@brewsite/core';

<Scene key="scene-b" transition={TRANSITION_SEQUENTIAL}>
  <Camera mode="world" position={[5, 3, 5]} target={[0, 0, 0]} />
</Scene>`}
      />

      <Callout type="tip">
        When in doubt, omit the <code>transition</code> prop. The default crossfade split works well
        for most camera moves and color transitions.
      </Callout>

      <h2>Entry vs. Exit Windows</h2>

      <p>
        The <code>transition</code> prop is declared on the <strong>incoming scene</strong>. However,
        the <code>exit</code> field controls the <em>outgoing</em> scene's fade-out timing, while
        the <code>enter</code> field controls this scene's fade-in timing.
      </p>

      <CodeBlock
        language="tsx"
        code={`<Scene key="scene-a">
  {/* No transition — starting state */}
  <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
</Scene>

<Scene key="scene-b" transition={{ exit: [0, 0.4], enter: [0.5, 1] }}>
  {/*
    The exit window [0, 0.4] controls how scene-a fades out.
    The enter window [0.5, 1] controls how scene-b fades in.
    "transition" is always declared on the destination scene.
  */}
  <Camera mode="world" position={[5, 3, 5]} target={[0, 0, 0]} />
</Scene>

<Scene key="scene-c" transition={{ exit: [0, 0.5], enter: [0.5, 1] }}>
  {/* Controls the B → C transition */}
  <Camera mode="world" position={[-3, 4, 6]} target={[0, 0, 0]} />
</Scene>`}
      />

      <Callout type="note">
        Changing a scene's <code>transition</code> prop triggers SceneTrack recompilation. In
        development this happens instantly. In production the track is cached by a hash of the
        compiled DSL nodes — the cache is invalidated only when scene structure changes.
      </Callout>

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
          factory once with endpoint states. It returns a closure accepting a{' '}
          <code>TransitionContext</code> (with <code>ctx.t</code> for the default normalized progress
          and <code>ctx.channel(name)</code> for per-property control).
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

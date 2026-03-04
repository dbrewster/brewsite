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
        Every scene-to-scene transition is driven by timing windows that control when the outgoing
        scene fades out and when the incoming scene fades in. Both windows are sub-ranges of{' '}
        <code>blockProgress [0, 1]</code>, which runs from 0 to 1 across each transition block.
      </p>

      <p>
        The default transition is <strong>dissolve-through-black</strong>: the outgoing scene holds
        at full opacity until 80% of the block, then fades out quickly. The incoming scene fades in
        symmetrically. In most marketing scenes no <code>transition</code> prop is needed at all.
      </p>

      <LiveDemo title="Transition variants" code={EASING_CODE}>
        <TransitionEasingDemo />
      </LiveDemo>

      <h2>
        The <code>exitStart</code> Prop
      </h2>

      <p>
        <code>exitStart</code> is the primary authoring control. It is a normalized{' '}
        <code>blockProgress</code> value (0–1) declaring when the outgoing scene begins fading.
        Higher values hold the scene opaque longer before the transition.
      </p>

      <CodeBlock
        language="tsx"
        code={`// Default: exitStart=0.8 → scene opaque until 80%, then fast dissolve-through-black
<Scene id="hero" />

// Hold scene longer before fading — matches the common "DISSOLVE_TO_BLACK" pattern
<Scene id="features" exitStart={0.9} />

// Faster handoff — scene starts fading at 60%
<Scene id="callout" exitStart={0.6} />`}
      />

      <Callout type="tip">
        Omit the <code>transition</code> prop entirely for the standard dissolve. Use{' '}
        <code>exitStart</code> only when you need to tune how long the scene stays visible before
        fading.
      </Callout>

      <h2>Named Transitions</h2>

      <p>
        The <code>transition</code> prop accepts a string name for common transition types:
      </p>

      <PropTable
        rows={[
          {
            name: '"dissolve"',
            type: 'TransitionName',
            defaultValue: 'system default',
            description:
              'Through-black. Scene holds at full opacity until exitStart, then fades to nothing. Incoming fades in symmetrically. exitStart defaults to 0.8.',
          },
          {
            name: '"crossfade"',
            type: 'TransitionName',
            description:
              'Equal-blend. Both scenes visible simultaneously across the full block. Outgoing opacity 1→0, incoming 0→1. Opacity sums to 1 at every frame. exitStart is not applicable.',
          },
        ]}
      />

      <CodeBlock
        language="tsx"
        code={`// Explicit dissolve (same as default)
<Scene id="s1" transition="dissolve" exitStart={0.8} />

// Crossfade — both scenes visible throughout the transition
// exitStart is a TypeScript error with crossfade
<Scene id="s2" transition="crossfade" />`}
      />

      <h2>Raw Escape Hatch</h2>

      <p>
        Pass a <code>TransitionWindow</code> object directly for custom timing that named transitions
        cannot express. This is an advanced escape hatch — prefer <code>exitStart</code> for
        dissolve-through-black variants.
      </p>

      <CodeBlock
        language="tsx"
        code={`// Custom overlap: both scenes briefly at full opacity (intentional double-exposure)
<Scene id="chart-b" transition={{ exit: [0.7, 1.0], enter: [0.0, 0.3] }} />`}
      />

      <Callout type="note">
        <code>exitStart</code> is a TypeScript error when <code>transition</code> is a raw{' '}
        <code>TransitionWindow</code> or <code>"crossfade"</code>. The TypeScript discriminated
        union enforces this at authoring time.
      </Callout>

      <h2>How the Windows Work</h2>

      <p>
        Each <code>SceneFrame</code> stores a <code>transitionWindow</code> governing that scene's
        fade in both directions:
      </p>

      <ul>
        <li>
          <code>exit</code> — controls when <em>this scene</em> fades out (when it is the departing
          scene in block N→N+1).
        </li>
        <li>
          <code>enter</code> — controls when <em>this scene</em> fades in (when it is the arriving
          scene in block N-1→N).
        </li>
      </ul>

      <p>
        For <code>"dissolve"</code> with <code>exitStart=0.8</code>: the resolver computes{' '}
        <code>mid = (0.8 + 1.0) / 2 = 0.9</code> and returns{' '}
        <code>{'{ exit: [0.8, 0.9], enter: [0.9, 1.0] }'}</code>. Both fields are set symmetrically
        from a single <code>exitStart</code> value.
      </p>

      <Callout type="note">
        <strong>Limitation:</strong> transition windows only affect widgets using{' '}
        <code>FunctionalTransitionSpec</code>. Widgets using the older{' '}
        <code>ElementTransitionSpec</code> are pre-baked at compile time with a fixed midpoint and
        do not read <code>transitionWindow</code>.
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
          and <code>ctx.channel(name)</code> for per-property control). Respects{' '}
          <code>transitionWindow</code> at runtime.
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

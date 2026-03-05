import type { ReactElement } from 'react';
import { Section, DocsDemo, CodeBlock, PropTable, Callout } from '@brewsite/docs';
import type { SectionId } from '../../docs-nav';
import { TransitionEasingDemo } from '../../demos/core/TransitionEasingDemo.demo';

export function TransitionsPage(): ReactElement {
  return (
    <Section<SectionId> id="transitions" title="Transitions & Easing">
      <p>
        Every scene-to-scene transition is controlled by a <code>TransitionWindow</code> — a pair of
        sub-ranges within the block's <code>[0, 1]</code> progress that independently control when
        the outgoing scene fades out (<code>exit</code>) and when the incoming scene fades in (
        <code>enter</code>). Transition timing is pre-baked into the <code>SceneTrack</code> at
        compile time — there is no runtime interpolation cost.
      </p>

      <DocsDemo title="Transition window variants" height={480}>
        <TransitionEasingDemo />
      </DocsDemo>

      <h2>The <code>transition</code> Prop</h2>
      <p>
        Pass a <code>TransitionWindow</code> to <code>&lt;Scene&gt;</code> to override the transition
        timing for that scene's entry.
      </p>
      <CodeBlock
        language="tsx"
        code={`import { TRANSITION_SEQUENTIAL } from '@brewsite/core';

<Scene key="s1">
  <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
</Scene>

<Scene key="s2" transition={TRANSITION_SEQUENTIAL}>
  <Camera mode="world" position={[5, 3, 5]} target={[0, 0, 0]} />
</Scene>`}
      />

      <h2>Built-in Window Presets</h2>
      <PropTable
        rows={[
          { name: 'TRANSITION_CROSSFADE', type: 'TransitionWindow', defaultValue: 'system default', description: 'Exit [0, 0.5], Enter [0.5, 1] — classic cross-fade.' },
          { name: 'TRANSITION_SEQUENTIAL', type: 'TransitionWindow', description: 'Exit [0, 0.4], Enter [0.6, 1] — outgoing finishes before incoming starts.' },
          { name: 'TRANSITION_EXIT_FIRST', type: 'TransitionWindow', description: 'Exit [0, 0.6], Enter [0.4, 1] — overlapping, outgoing has more time.' },
          { name: 'TRANSITION_CUT', type: 'TransitionWindow', description: 'Instant cut — no blending.' },
          { name: 'TRANSITION_DEFAULT', type: 'TransitionWindow', description: "Empty object — defers to each widget's own defaultWindow." },
        ]}
      />

      <Callout type="tip">
        You can also pass a custom <code>TransitionWindow</code> inline:{' '}
        <code>{'transition={{ exit: [0, 0.3], enter: [0.7, 1] }}'}</code>.
      </Callout>

      <h2>Entry vs. Exit Ownership</h2>
      <p>
        The <code>transition</code> prop belongs to the <strong>incoming scene</strong>, not the
        outgoing one. The transition from scene A to scene B is always declared on scene B.
      </p>
      <CodeBlock
        language="tsx"
        code={`<Scene key="scene-a">
  <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
</Scene>

<Scene key="scene-b" transition={TRANSITION_SEQUENTIAL}>
  {/* TRANSITION_SEQUENTIAL controls the A → B transition. */}
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
          <code>exit</code>, <code>enter</code>, or <code>interpolate</code> once per transition.
        </li>
        <li>
          <strong>FunctionalTransitionSpec</strong> — closure-based model. The compiler calls your
          factory once with endpoint states and returns a pure function of{' '}
          <code>TransitionContext</code>.
        </li>
      </ul>
      <CodeBlock
        language="typescript"
        code={`import type { FunctionalTransitionSpec } from '@brewsite/core';

const myTransitionSpec: FunctionalTransitionSpec<{ opacity: number }> = {
  exitFn: (fromState) => (ctx) => ({ opacity: fromState.opacity * (1 - ctx.t) }),
  enterFn: (toState) => (ctx) => ({ opacity: toState.opacity * ctx.t }),
  interpolateFn: (fromState, toState) => (ctx) => ({
    opacity: fromState.opacity + (toState.opacity - fromState.opacity) * ctx.t,
  }),
};`}
      />

      <p>
        <a href="#widget-sdk">Read the Widget SDK docs →</a> for the full contract and
        registration API.
      </p>
    </Section>
  );
}

import { JSX } from 'react';
import { CodeBlock } from '../../components/ui/CodeBlock';
import { PropTable } from '../../components/ui/PropTable';
import { Callout } from '../../components/ui/Callout';
import { LiveDemo } from '../../components/demo/LiveDemo';
import VariableStoreDemo, { CODE as VAR_CODE } from '../../demos/core/VariableStoreDemo.demo';

export default function VariableStore(): JSX.Element {
  return (
    <section>
      <h1>VariableStore</h1>

      <p>
        The <code>VariableStore</code> is a lightweight reactive key-value store for sharing
        state between widgets and React components. It's the bridge between the Three.js tick
        loop and your UI — widgets write into the store each frame, and React components read
        from it using a hook.
      </p>

      <LiveDemo title="Reading scene state in React" code={VAR_CODE}>
        <VariableStoreDemo />
      </LiveDemo>

      <h2>Writing to the Store (from a Widget)</h2>

      <p>
        Widgets that implement <code>IAnimationController</code> receive a{' '}
        <code>VariableStoreWriter</code> in their <code>onTick</code> callback. Call{' '}
        <code>variables.set(namespace, key, value)</code> to publish state:
      </p>

      <CodeBlock
        language="typescript"
        code={`// Inside IAnimationController.onTick:
onTick(dt: number, variables: VariableStoreWriter): void {
  variables.set('my-widget', 'score', this.currentScore);
  variables.set('my-widget', 'health', this.currentHealth);
}`}
      />

      <p>
        The <code>namespace</code> parameter isolates each widget's variables from others.
        Use your widget's <code>widgetId</code> or another unique string as the namespace.
      </p>

      <h2>Reading in React</h2>

      <p>
        Use the <code>useVariable&lt;T&gt;</code> hook inside any component rendered inside{' '}
        <code>ScenePlayer</code>. The hook subscribes to changes and re-renders the component
        whenever the value updates:
      </p>

      <CodeBlock
        language="tsx"
        code={`import { useVariable } from '@brewsite/core';

function ScoreDisplay(): JSX.Element {
  const score = useVariable<number>('my-widget', 'score');
  return <div className="score">{score ?? 0}</div>;
}`}
      />

      <Callout type="note">
        <code>useVariable</code> returns <code>undefined</code> until the widget publishes its
        first value. Always provide a fallback (<code>?? 0</code>) when rendering.
      </Callout>

      <h2>Built-in Namespaces</h2>

      <p>
        The engine publishes scene progress and navigation state automatically under the{' '}
        <code>__scene_meta__</code> namespace. These are available to any component via{' '}
        <code>useVariable</code>, though the dedicated hooks (<code>useCurrentScene</code>,{' '}
        <code>useSceneProgress</code>) are more ergonomic for common cases:
      </p>

      <PropTable
        rows={[
          {
            name: "__scene_meta__ / id",
            type: "string",
            description: "The key of the currently active scene (e.g. 'intro', 's2').",
          },
          {
            name: "__scene_meta__ / index",
            type: "number",
            description: "Zero-based index of the currently active scene.",
          },
          {
            name: "__scene_meta__ / progress",
            type: "number",
            description: "Playback progress within the current scene, in the range [0, 1].",
          },
        ]}
      />

      <h2>VariableStoreReader (read-only)</h2>

      <p>
        Inside <code>IRenderable.apply</code>, variables are available read-only via{' '}
        <code>WidgetRenderContext.variables</code>. This lets one widget's render pass react
        to state published by another widget's tick pass:
      </p>

      <CodeBlock
        language="typescript"
        code={`apply(state: MyState, ctx: WidgetRenderContext): void {
  const score = ctx.variables.get<number>('my-widget', 'score');
  if (score !== undefined) {
    // adjust rendering based on score
    this.mesh.scale.setScalar(1 + score * 0.1);
  }
}`}
      />

      <Callout type="tip">
        The separation between <code>VariableStoreWriter</code> (in <code>onTick</code>) and{' '}
        <code>VariableStoreReader</code> (in <code>apply</code>) is intentional. It keeps the
        write path explicit and prevents accidental mutation during the render pass.
      </Callout>
    </section>
  );
}

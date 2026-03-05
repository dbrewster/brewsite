import type { ReactElement } from 'react';
import { Section, DocsDemo, CodeBlock, PropTable, Callout } from '@brewsite/docs';
import type { SectionId } from '../../docs-nav';
import { VariableStoreDemo } from '../../demos/core/VariableStoreDemo.demo';

export function VariableStorePage(): ReactElement {
  return (
    <Section<SectionId> id="variable-store" title="VariableStore">
      <p>
        The <code>VariableStore</code> is a lightweight reactive key-value store for sharing
        state between widgets and React components. It's the bridge between the Three.js tick
        loop and your UI — widgets write into the store each frame, and React components read
        from it using a hook.
      </p>

      <DocsDemo title="Reading scene state in React" height={480}>
        <VariableStoreDemo />
      </DocsDemo>

      <h2>Writing to the Store (from a Widget)</h2>
      <CodeBlock
        language="typescript"
        code={`// Inside IAnimationController.onTick:
onTick(dt: number, variables: VariableStoreWriter): void {
  variables.set('my-widget', 'score', this.currentScore);
  variables.set('my-widget', 'health', this.currentHealth);
}`}
      />

      <h2>Reading in React</h2>
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
      <PropTable
        rows={[
          { name: "__scene_meta__ / id", type: "string", description: "The key of the currently active scene." },
          { name: "__scene_meta__ / index", type: "number", description: "Zero-based index of the currently active scene." },
          { name: "__scene_meta__ / progress", type: "number", description: "Playback progress within the current scene, in the range [0, 1]." },
        ]}
      />

      <h2>VariableStoreReader (read-only)</h2>
      <p>
        Inside <code>IRenderable.apply</code>, variables are available read-only via{' '}
        <code>WidgetRenderContext.variables</code>:
      </p>
      <CodeBlock
        language="typescript"
        code={`apply(state: MyState, ctx: WidgetRenderContext): void {
  const score = ctx.variables.get<number>('my-widget', 'score');
  if (score !== undefined) {
    this.mesh.scale.setScalar(1 + score * 0.1);
  }
}`}
      />

      <Callout type="tip">
        The separation between <code>VariableStoreWriter</code> (in <code>onTick</code>) and{' '}
        <code>VariableStoreReader</code> (in <code>apply</code>) is intentional. It keeps the
        write path explicit and prevents accidental mutation during the render pass.
      </Callout>
    </Section>
  );
}

import type { ReactElement } from 'react';
import { Section, DocsDemo, CodeBlock, Callout } from '@brewsite/docs';
import type { SectionId } from '../../docs-nav';
import { VariableStoreDemo } from '../../demos/core/VariableStoreDemo.demo';

export function HooksPage(): ReactElement {
  return (
    <Section<SectionId> id="hooks" title="Hooks Reference">
      <p>
        All hooks must be called from components rendered inside <code>{'<ScenePlayer>'}</code>.
        They read from React contexts provided by the player.
      </p>

      <Callout type="warning">
        Do not call these hooks outside of a <code>{'<ScenePlayer>'}</code> subtree. They will
        throw.
      </Callout>

      <h3><code>useSceneEngine()</code></h3>
      <p>Returns <code>{'{ progress, sceneId, sceneIndex, engine, state }'}</code>.</p>
      <CodeBlock language="typescript" code={`const { state, engine } = useSceneEngine(options);`} />
      <CodeBlock
        language="tsx"
        code={`import { useSceneEngine } from '@brewsite/core';

function SceneDebug() {
  const { state, engine } = useSceneEngine();
  return (
    <div>
      <p>Scene: {state.sceneId}</p>
      <p>Progress: {state.progress.toFixed(3)}</p>
      <button onClick={() => engine.scrollToProgress(0)}>Reset</button>
    </div>
  );
}`}
      />

      <h3><code>useEngineState()</code></h3>
      <p>Returns <code>EngineState</code> (progress, sceneId, sceneIndex). Lighter than <code>useSceneEngine</code>.</p>
      <CodeBlock language="typescript" code={`const state = useEngineState();
// state.progress  — [0,1]
// state.sceneId   — current scene key
// state.sceneIndex — 0-indexed`} />

      <h3><code>useCurrentScene()</code></h3>
      <p>Returns <code>{'{ id: string, index: number }'}</code>.</p>
      <CodeBlock language="typescript" code={`const { id, index } = useCurrentScene();`} />

      <h3><code>useSceneProgress()</code></h3>
      <p>Returns <code>number</code> [0,1] within the current scene (not total progress).</p>
      <CodeBlock language="typescript" code={`const sceneProgress = useSceneProgress();`} />

      <h3><code>useEngineScrubber()</code></h3>
      <p>Returns <code>{'{ progress, setProgress }'}</code>. Used for direct-mode progress control.</p>
      <CodeBlock
        language="tsx"
        code={`import { useEngineScrubber } from '@brewsite/core';

function Scrubber() {
  const { progress, setProgress } = useEngineScrubber({ pixelsPerScene: 800 });
  return (
    <input
      type="range"
      min={0}
      max={1}
      step={0.001}
      value={progress}
      onChange={e => setProgress(Number(e.target.value))}
    />
  );
}`}
      />

      <h3><code>useEngineScroll()</code></h3>
      <p>Binds scroll events to the engine. Used internally by <code>EngineScrollRegion</code>.</p>
      <CodeBlock language="typescript" code={`useEngineScroll({ pixelsPerScene: 800, disabled: false });`} />

      <h3><code>useEngineInput()</code></h3>
      <p>Binds keyboard/mouse events to the engine. Used internally by <code>EngineInputRegion</code>.</p>
      <CodeBlock language="typescript" code={`useEngineInput({ keyboard: true, wheel: true });`} />

      <h3><code>useSceneEngineContext()</code></h3>
      <p>Returns the <code>RuntimeDriver</code> from context.</p>
      <CodeBlock
        language="tsx"
        code={`import { useSceneEngineContext } from '@brewsite/core';

function JumpButton() {
  const engine = useSceneEngineContext();
  return (
    <button onClick={() => engine.scrollToProgress(0.5)}>
      Jump to midpoint
    </button>
  );
}`}
      />

      <h3><code>useVariable&lt;T&gt;(namespace, key)</code></h3>
      <p>Reactive read of a <code>VariableStore</code> value.</p>
      <CodeBlock
        language="tsx"
        code={`import { useVariable } from '@brewsite/core';

function ActiveSceneLabel() {
  const sceneId = useVariable<string>('__scene_meta__', 'id');
  return <span>Active scene: {sceneId ?? '—'}</span>;
}`}
      />

      <DocsDemo title="useCurrentScene in action" height={480}>
        <VariableStoreDemo />
      </DocsDemo>
    </Section>
  );
}

import { JSX } from 'react';
import { CodeBlock } from '../../components/ui/CodeBlock';
import { Callout } from '../../components/ui/Callout';
import { LiveDemo } from '../../components/demo/LiveDemo';
import VariableStoreDemo, { CODE as VAR_CODE } from '../../demos/core/VariableStoreDemo.demo';

export default function Hooks(): JSX.Element {
  return (
    <section>
      <h1>Hooks Reference</h1>

      <p>
        All hooks must be called from components rendered inside <code>{'<ScenePlayer>'}</code>.
        They read from React contexts provided by the player.
      </p>

      <Callout type="warning">
        Do not call these hooks outside of a <code>{'<ScenePlayer>'}</code> subtree. They will
        throw.
      </Callout>

      <h3><code>useSceneEngine()</code></h3>

      <p>
        Returns <code>{'{ progress, sceneId, sceneIndex, engine, state }'}</code>. The primary
        hook for reading engine state and dispatching progress updates.
      </p>

      <CodeBlock
        language="typescript"
        code={`const { state, engine } = useSceneEngine(options);`}
      />

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

      <p>
        Returns <code>EngineState</code> (progress, sceneId, sceneIndex). Lighter than{' '}
        <code>useSceneEngine</code> — no engine reference.
      </p>

      <CodeBlock
        language="typescript"
        code={`const state = useEngineState();
// state.progress  — [0,1]
// state.sceneId   — current scene key
// state.sceneIndex — 0-indexed`}
      />

      <CodeBlock
        language="tsx"
        code={`import { useEngineState } from '@brewsite/core';

function ProgressBar() {
  const state = useEngineState();
  return (
    <div
      style={{
        width: \`\${state.progress * 100}%\`,
        height: 4,
        background: '#4f8fff',
      }}
    />
  );
}`}
      />

      <h3><code>useCurrentScene()</code></h3>

      <p>
        Returns <code>{'{ id: string, index: number }'}</code>. Convenience hook for the
        currently active scene.
      </p>

      <CodeBlock
        language="typescript"
        code={`const { id, index } = useCurrentScene();`}
      />

      <CodeBlock
        language="tsx"
        code={`import { useCurrentScene } from '@brewsite/core';

function SceneBreadcrumb() {
  const { id, index } = useCurrentScene();
  return <span>Scene {index + 1}: {id}</span>;
}`}
      />

      <h3><code>useSceneProgress()</code></h3>

      <p>
        Returns <code>number</code> [0,1] within the current scene (not total progress).
      </p>

      <CodeBlock
        language="typescript"
        code={`const sceneProgress = useSceneProgress();`}
      />

      <CodeBlock
        language="tsx"
        code={`import { useSceneProgress } from '@brewsite/core';

function SceneLocalProgress() {
  const sceneProgress = useSceneProgress();
  // 0 at the start of the current scene, 1 at its end
  return <span>{(sceneProgress * 100).toFixed(1)}% through this scene</span>;
}`}
      />

      <h3><code>useEngineScrubber()</code></h3>

      <p>
        Returns <code>{'{ progress, setProgress }'}</code>. Used for direct-mode progress control.
      </p>

      <CodeBlock
        language="typescript"
        code={`const { progress, setProgress } = useEngineScrubber({ pixelsPerScene: 800 });`}
      />

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

      <p>
        Binds scroll events to the engine. Used internally by <code>EngineScrollRegion</code>.
        Call this directly if you need custom scroll binding outside the standard region wrapper.
      </p>

      <CodeBlock
        language="typescript"
        code={`useEngineScroll({ pixelsPerScene: 800, disabled: false });`}
      />

      <h3><code>useEngineInput()</code></h3>

      <p>
        Binds keyboard/mouse events to the engine. Used internally by{' '}
        <code>EngineInputRegion</code>.
      </p>

      <CodeBlock
        language="typescript"
        code={`useEngineInput({ keyboard: true, wheel: true });`}
      />

      <h3><code>useSceneEngineContext()</code></h3>

      <p>
        Returns the <code>RuntimeDriver</code> from context. Lower-level than{' '}
        <code>useSceneEngine</code> — use this when you only need imperative engine access and
        do not want a subscription to state updates.
      </p>

      <CodeBlock
        language="typescript"
        code={`const engine = useSceneEngineContext();
engine.scrollToProgress(0.5);`}
      />

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

      <h3><code>useLabelPositioner()</code></h3>

      <p>
        Returns the <code>LabelPositioner</code> instance. Use this when you need to imperatively
        register or update label targets from outside the DSL.
      </p>

      <CodeBlock
        language="typescript"
        code={`const positioner = useLabelPositioner();`}
      />

      <h3><code>useVariable&lt;T&gt;(namespace, key)</code></h3>

      <p>
        Reactive read of a <code>VariableStore</code> value. Re-renders the component whenever
        the stored value changes. Useful for cross-widget communication and reading runtime state
        published by widgets.
      </p>

      <CodeBlock
        language="typescript"
        code={`const sceneId = useVariable<string>('__scene_meta__', 'id');`}
      />

      <CodeBlock
        language="tsx"
        code={`import { useVariable } from '@brewsite/core';

function ActiveSceneLabel() {
  const sceneId = useVariable<string>('__scene_meta__', 'id');
  return <span>Active scene: {sceneId ?? '—'}</span>;
}`}
      />

      <LiveDemo title="useCurrentScene in action" code={VAR_CODE}>
        <VariableStoreDemo />
      </LiveDemo>
    </section>
  );
}

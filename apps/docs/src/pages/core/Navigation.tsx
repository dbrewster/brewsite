import { JSX } from 'react';
import { Link } from 'react-router';
import { CodeBlock } from '../../components/ui/CodeBlock';
import { PropTable } from '../../components/ui/PropTable';
import { Callout } from '../../components/ui/Callout';

export default function Navigation(): JSX.Element {
  return (
    <section>
      <h1>Scene Navigation</h1>

      <p>
        BrewSite supports two navigation modes: scroll-driven (the page scrolls to advance scenes)
        and direct mode (you control progress programmatically or via input events).
      </p>

      <h2>Scroll Mode (default)</h2>

      <p>
        Wrap <code>{'<ScenePlayer>'}</code> in <code>{'<EngineScrollRegion>'}</code> to enable
        scroll-driven navigation. The scroll position is mapped to [0,1] progress across all
        scenes.
      </p>

      <CodeBlock
        language="tsx"
        code={`import { EngineScrollRegion, ScenePlayer } from '@brewsite/core';

export default function Page() {
  return (
    <EngineScrollRegion pixelsPerScene={800}>
      <div style={{ position: 'sticky', top: 0, height: '100vh' }}>
        <ScenePlayer manifestUrl="/scene-manifest.json" pixelsPerScene={800}>
          {scenes}
        </ScenePlayer>
      </div>
    </EngineScrollRegion>
  );
}`}
      />

      <PropTable
        rows={[
          {
            name: 'pixelsPerScene',
            type: 'number',
            required: false,
            defaultValue: '800',
            description: 'Scroll depth in pixels to advance one scene',
          },
        ]}
      />

      <h2>Direct Mode</h2>

      <p>
        Use <code>useEngineScrubber()</code> or <code>engine.scrollToProgress()</code> to drive
        progress directly without scroll:
      </p>

      <CodeBlock
        language="tsx"
        code={`import { useEngineScrubber } from '@brewsite/core';

function Controls() {
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

      <Callout type="note">
        <code>useEngineScrubber</code> must be rendered inside a <code>{'<ScenePlayer>'}</code>{' '}
        subtree. See <Link to="/core/hooks">Hooks Reference</Link> for the full API.
      </Callout>

      <h2>Keyboard Navigation</h2>

      <p>
        ScenePlayer responds to <kbd>ArrowRight</kbd>/<kbd>ArrowLeft</kbd> (advance/retreat one
        scene) and <kbd>Home</kbd>/<kbd>End</kbd> by default when <code>keyboard: true</code> is
        set.
      </p>

      <CodeBlock
        language="tsx"
        code={`<ScenePlayer
  manifestUrl="/scene-manifest.json"
  keyboard
>
  {scenes}
</ScenePlayer>`}
      />

    </section>
  );
}

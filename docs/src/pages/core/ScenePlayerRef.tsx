import type { ReactElement } from 'react';
import { Section, CodeBlock, PropTable, Callout } from '@brewsite/docs';
import type { SectionId } from '../../docs-nav';

export function ScenePlayerPage(): ReactElement {
  return (
    <Section<SectionId> id="player" title="ScenePlayer & EngineProvider">
      <p>
        The <code>ScenePlayer</code> component is the top-level React integration point. It manages
        the Three.js renderer, the widget tick loop, and the HUD overlay.
      </p>

      <h2>Props</h2>
      <PropTable
        rows={[
          { name: 'manifestUrl', type: 'string', required: true, description: 'URL to the generated scene-manifest.json (from gen:scene-dsl)' },
          { name: 'widgetSetup', type: '(manifest: AssetManifest) => WidgetRegistry', required: false, defaultValue: '—', description: 'Factory for the widget registry. Defaults to createDefaultWidgetRegistry(manifest).' },
          { name: 'quality', type: "'performance' | 'balanced' | 'high'", required: false, defaultValue: 'balanced', description: 'Pre-baked frame count preset' },
          { name: 'pixelsPerScene', type: 'number', required: false, defaultValue: '800', description: 'Scroll pixels allocated per scene for scroll-mode navigation' },
          { name: 'fpsCap', type: 'number', required: false, defaultValue: '60', description: 'Maximum frames per second for the render loop' },
          { name: 'onSceneChange', type: '(sceneId: string, sceneIndex: number) => void', required: false, defaultValue: '—', description: 'Called when the current scene changes' },
          { name: 'onReady', type: '() => void', required: false, defaultValue: '—', description: 'Called when all widgets are loaded and ready' },
          { name: 'onError', type: '(error: Error) => void', required: false, defaultValue: '—', description: 'Called on fatal errors' },
          { name: 'className', type: 'string', required: false, defaultValue: '—', description: 'CSS class applied to the root canvas container' },
        ]}
      />

      <h2>EngineScrollRegion</h2>
      <p>
        Wrap <code>ScenePlayer</code> in <code>EngineScrollRegion</code> to create a scroll spacer:
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

      <p>
        See <a href="#input-navigation">Scene Navigation</a> for full scroll vs. direct
        mode documentation.
      </p>

      <h2>EngineInputRegion</h2>
      <p>
        Manages the <code>ActionInputController</code> lifecycle for camera interaction:
      </p>
      <CodeBlock
        language="tsx"
        code={`import { EngineScrollRegion, EngineInputRegion, ScenePlayer } from '@brewsite/core';

export default function Page() {
  return (
    <EngineScrollRegion pixelsPerScene={800}>
      <div style={{ position: 'sticky', top: 0, height: '100vh' }}>
        <EngineInputRegion>
          <ScenePlayer manifestUrl="/scene-manifest.json" pixelsPerScene={800}>
            {scenes}
          </ScenePlayer>
        </EngineInputRegion>
      </div>
    </EngineScrollRegion>
  );
}`}
      />

      <p>
        See <a href="#input-actions">Input Actions</a> for how to configure the
        gestures handled inside <code>EngineInputRegion</code>.
      </p>

      <h2>Asset Loading</h2>
      <CodeBlock
        language="tsx"
        code={`<ScenePlayer
  manifestUrl="/scene-manifest.json"
  onReady={() => console.log('ready')}
>
  {scenes}
</ScenePlayer>`}
      />

      <h2>TimelineWidget (Dev Tool)</h2>
      <CodeBlock
        language="tsx"
        code={`import { ScenePlayer, TimelineWidget } from '@brewsite/core';

<ScenePlayer manifestUrl="/scene-manifest.json">
  {scenes}
  {import.meta.env.DEV && <TimelineWidget />}
</ScenePlayer>`}
      />

      <Callout type="warning">
        Remove <code>TimelineWidget</code> before production. It adds visual overhead and is for
        development only.
      </Callout>
    </Section>
  );
}

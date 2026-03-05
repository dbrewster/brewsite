import type { ReactElement } from 'react';
import { Section, CodeBlock, PropTable, Callout } from '@brewsite/docs';
import type { SectionId } from '../../docs-nav';

export function LabelSystemPage(): ReactElement {
  return (
    <Section<SectionId> id="labels" title="3D Label System">
      <p>
        Labels attach to 3D positions (model bones or world coordinates) and project to screen
        space. They stay positioned relative to the 3D content as the camera moves.
      </p>

      <pre
        style={{
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border)',
          borderRadius: 6,
          padding: '1rem 1.25rem',
          fontSize: 13,
          lineHeight: 1.7,
          overflowX: 'auto',
        }}
      >{`Model (Three.js)  →  LabelPositioner  →  LabelItem (DOM)
   bone position       3D → screen             CSS overlay`}</pre>

      <Callout type="note">
        Labels require a model with named bones. The <code>LabelPositioner</code> reads bone world
        positions each frame and updates DOM elements directly (no React setState).
      </Callout>

      <h2><code>{'<Label>'}</code> DSL</h2>
      <p>Labels are declared as children of <code>{'<Model>'}</code>:</p>
      <CodeBlock
        language="tsx"
        code={`<Model type="MaleDummy" id="character" position={[0, 0, 0]}>
  <Label
    id="name-tag"
    boneKey="Head"
    text="Character Name"
    labelOffset={[0, 0.3, 0]}
    style={{ color: '#ffffff', fontSize: 14, fontWeight: 600 }}
  />
</Model>`}
      />

      <PropTable
        rows={[
          { name: 'id', type: 'string', required: true, description: 'Stable identifier for this label' },
          { name: 'boneKey', type: 'string', required: false, defaultValue: '—', description: 'Bone name to track. Leave unset for a world-position label' },
          { name: 'text', type: 'string', required: false, defaultValue: '—', description: 'Label text content' },
          { name: 'labelOffset', type: '[number, number, number]', required: false, defaultValue: '[0,0,0]', description: 'World-space offset from the tracked position' },
          { name: 'enabled', type: 'boolean', required: false, defaultValue: 'true', description: 'Whether this label renders' },
          { name: 'style', type: 'LabelStyle', required: false, defaultValue: '—', description: 'Visual style configuration' },
        ]}
      />

      <h2><code>LabelPositioner</code></h2>
      <CodeBlock
        language="tsx"
        code={`import { LabelPositioner } from '@brewsite/core';

function MyScene() {
  return (
    <ScenePlayer manifestUrl="/scene-manifest.json">
      {scenes}
      <LabelPositioner />
    </ScenePlayer>
  );
}`}
      />

      <h2><code>LabelStyle</code> Reference</h2>
      <PropTable
        rows={[
          { name: 'color', type: 'string', required: false, defaultValue: '—', description: 'CSS color for the label text' },
          { name: 'lineColor', type: 'string', required: false, defaultValue: '—', description: 'CSS color for the connector line' },
          { name: 'fontSize', type: 'number', required: false, defaultValue: '—', description: 'Font size in pixels' },
          { name: 'fontWeight', type: 'number | string', required: false, defaultValue: '—', description: 'CSS font-weight value' },
          { name: 'lineOpacity', type: 'number', required: false, defaultValue: '—', description: 'Opacity of the connector line (0–1)' },
          { name: 'labelOpacity', type: 'number', required: false, defaultValue: '—', description: 'Opacity of the label text (0–1)' },
          { name: 'lineThickness', type: 'number', required: false, defaultValue: '—', description: 'Stroke width of the connector line in pixels' },
          { name: 'lineLength', type: 'number', required: false, defaultValue: '—', description: 'Length of the connector line in pixels' },
        ]}
      />
    </Section>
  );
}

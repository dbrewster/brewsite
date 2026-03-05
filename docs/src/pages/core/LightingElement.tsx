import type { ReactElement } from 'react';
import { Section, DocsDemo, CodeBlock, PropTable, Callout } from '@brewsite/docs';
import type { SectionId } from '../../docs-nav';
import { LightingDemo } from '../../demos/core/LightingDemo.demo';

const AMBIENT_CODE = `<Lighting>
  <Ambient color="#ffffff" intensity={0.4} />
</Lighting>`;

const DIRECTIONAL_CODE = `<Lighting>
  <Ambient color="#ffffff" intensity={0.3} />
  <Directional
    color="#ffeedd"
    intensity={1.2}
    position={[5, 8, 5]}
  />
</Lighting>`;

const POINT_CODE = `<Lighting>
  <Ambient color="#ffffff" intensity={0.3} />
  <Directional color="#ffffff" intensity={1.0} position={[5, 10, 5]} />
  <Point color="#ff6600" intensity={2.0} position={[0, 2, 0]} />
</Lighting>`;

export function LightingPage(): ReactElement {
  return (
    <Section<SectionId> id="lighting" title="Lighting Element">
      <p>
        The <code>&lt;Lighting&gt;</code> element configures all lights in the scene through a
        declarative, composable child API. Lights are interpolated between scenes just like any other
        prop — color and intensity smoothly transition as the scene progresses.
      </p>

      <DocsDemo title="Ambient, directional, and colored lighting" height={480}>
        <LightingDemo />
      </DocsDemo>

      <h2>Ambient Light</h2>
      <p>
        Ambient light illuminates all geometry uniformly from every direction, with no shadows and
        no position. It establishes the base luminosity and color tone of the scene.
      </p>
      <CodeBlock code={AMBIENT_CODE} language="tsx" />
      <PropTable
        rows={[
          { name: 'color', type: 'string', required: true, description: 'CSS hex color. Tints the entire ambient contribution.' },
          { name: 'intensity', type: 'number', required: true, description: 'Brightness multiplier.' },
          { name: 'id', type: 'string', description: 'Optional stable identifier for this light instance.' },
        ]}
      />

      <h2>Directional Light</h2>
      <p>
        Directional light casts parallel rays from a given position, simulating a distant light source
        like the sun. The direction is computed from <code>position</code> to the scene origin.
      </p>
      <CodeBlock code={DIRECTIONAL_CODE} language="tsx" />
      <PropTable
        rows={[
          { name: 'color', type: 'string', required: true, description: 'CSS hex color.' },
          { name: 'intensity', type: 'number', required: true, description: 'Brightness multiplier.' },
          { name: 'position', type: '[number, number, number]', required: true, description: 'World-space position used to derive the light direction (points toward origin).' },
          { name: 'id', type: 'string', description: 'Optional stable identifier.' },
        ]}
      />

      <h2>Point Lights</h2>
      <p>
        Point lights emit in all directions from a position in 3D space, like a light bulb.
      </p>
      <CodeBlock code={POINT_CODE} language="tsx" />
      <p>
        For maximum realism, combine directional lighting with an HDR environment map. See the{' '}
        <a href="#environment">Environment element</a>.
      </p>

      <h2>The <code>&lt;Lighting&gt;</code> Prop API</h2>
      <PropTable
        rows={[
          { name: 'intensityScale', type: 'number', defaultValue: '1', description: 'Global multiplier applied to all child light intensities.' },
          { name: 'color', type: 'string', description: 'Global tint color mixed across all child lights.' },
        ]}
      />

      <Callout type="tip">
        Start with a low-intensity ambient (<code>0.3–0.5</code>) plus one directional light at a
        roughly 45-degree angle above and to the side. Add a subtle warm tint to the directional
        for a natural cinematic look.
      </Callout>
    </Section>
  );
}

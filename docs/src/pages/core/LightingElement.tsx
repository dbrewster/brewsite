import { JSX } from 'react';
import { CodeBlock } from '../../components/ui/CodeBlock';
import { PropTable } from '../../components/ui/PropTable';
import { Callout } from '../../components/ui/Callout';
import { LiveDemo } from '../../components/demo/LiveDemo';
import LightingDemo, { CODE as LIGHTING_CODE } from '../../demos/core/LightingDemo.demo';

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

export default function LightingElement(): JSX.Element {
  return (
    <section>
      <h1>Lighting Element</h1>
      <p>
        The <code>&lt;Lighting&gt;</code> element configures all lights in the scene through a
        declarative, composable child API. Lights are interpolated between scenes just like any other
        prop — color and intensity smoothly transition as the scene progresses, making lighting
        changes a first-class authoring primitive rather than an afterthought.
      </p>

      <LiveDemo title="Ambient, directional, and colored lighting" code={LIGHTING_CODE}>
        <LightingDemo />
      </LiveDemo>

      <h2>Ambient Light</h2>
      <p>
        Ambient light illuminates all geometry uniformly from every direction, with no shadows and
        no position. It establishes the base luminosity and color tone of the scene — think of it
        as the sky light or room bounce light. Start here before adding directional light.
      </p>
      <CodeBlock code={AMBIENT_CODE} language="tsx" />
      <PropTable
        rows={[
          {
            name: 'color',
            type: 'string',
            required: true,
            description: 'CSS hex color. Tints the entire ambient contribution.',
          },
          {
            name: 'intensity',
            type: 'number',
            required: true,
            description: 'Brightness multiplier. Values above 1 can clip highlights on bright materials.',
          },
          {
            name: 'id',
            type: 'string',
            description: 'Optional stable identifier for this light instance within the scene.',
          },
        ]}
      />

      <h2>Directional Light</h2>
      <p>
        Directional light casts parallel rays from a given position, simulating a distant light source
        like the sun. The direction is computed from <code>position</code> to the scene origin, so
        position acts as a directional vector rather than a physical location. It casts shadows and
        produces the diffuse and specular highlights that make geometry readable.
      </p>
      <CodeBlock code={DIRECTIONAL_CODE} language="tsx" />
      <PropTable
        rows={[
          {
            name: 'color',
            type: 'string',
            required: true,
            description: 'CSS hex color. Warm tones for golden-hour feel; cool tones for overcast.',
          },
          {
            name: 'intensity',
            type: 'number',
            required: true,
            description: 'Brightness multiplier.',
          },
          {
            name: 'position',
            type: '[number, number, number]',
            required: true,
            description:
              'World-space position used to derive the light direction (points toward origin).',
          },
          {
            name: 'id',
            type: 'string',
            description: 'Optional stable identifier for this light instance within the scene.',
          },
        ]}
      />

      <h2>Point Lights</h2>
      <p>
        Point lights emit in all directions from a position in 3D space, like a light bulb. They
        illuminate nearby surfaces, participate in PBR material calculations, and can cast shadows.
        Use them for localized light sources such as emissive props, screen glows, or practical
        lights within the scene.
      </p>
      <CodeBlock code={POINT_CODE} language="tsx" />
      <p>
        For maximum realism, combine directional lighting with an HDR environment map. The environment
        provides physically-based image-based lighting (IBL) across all metallic and reflective surfaces.
        See the <a href="/core/environment">Environment element</a>.
      </p>

      <h2>The <code>&lt;Lighting&gt;</code> Prop API</h2>
      <p>
        The <code>&lt;Lighting&gt;</code> wrapper accepts an <code>intensityScale</code> to globally
        dim or brighten all child lights at once, and an optional <code>color</code> tint applied
        multiplicatively across the whole rig.
      </p>
      <PropTable
        rows={[
          {
            name: 'intensityScale',
            type: 'number',
            defaultValue: '1',
            description:
              'Global multiplier applied to all child light intensities. Useful for fade-in/fade-out of the entire lighting rig.',
          },
          {
            name: 'color',
            type: 'string',
            description:
              'Global tint color mixed across all child lights. Useful for scene-wide color grading.',
          },
        ]}
      />

      <Callout type="tip">
        Start with a low-intensity ambient (<code>0.3–0.5</code>) plus one directional light at a
        roughly 45-degree angle above and to the side. This gives clean shadows and readable geometry
        with minimal tuning. Add a subtle warm tint to the directional for a natural cinematic look.
      </Callout>
    </section>
  );
}

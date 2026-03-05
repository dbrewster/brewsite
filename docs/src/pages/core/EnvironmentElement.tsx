import type { ReactElement } from 'react';
import { Section, DocsDemo, CodeBlock, PropTable, Callout } from '@brewsite/docs';
import type { SectionId } from '../../docs-nav';
import { EnvironmentDemo } from '../../demos/core/EnvironmentDemo.demo';

const HDRI_CODE = `<Environment enabled intensity={1.0}>
  <EnvironmentHdri url="/assets/envmaps/studio.hdr" />
</Environment>`;

const EXR_CODE = `<Environment enabled intensity={0.8}>
  <EnvironmentExr url="/assets/envmaps/outdoor.exr" />
</Environment>`;

const BACKGROUND_CODE = `// Show the HDR as the visible scene background as well as using it for lighting.
<Environment enabled intensity={1.0}>
  <EnvironmentHdri url="/assets/envmaps/studio.hdr" background />
</Environment>`;

const CUBE_CODE = `<Environment enabled intensity={1.0}>
  <EnvironmentCube
    urls={[
      '/assets/envmaps/px.png',
      '/assets/envmaps/nx.png',
      '/assets/envmaps/py.png',
      '/assets/envmaps/ny.png',
      '/assets/envmaps/pz.png',
      '/assets/envmaps/nz.png',
    ]}
  />
</Environment>`;

const GEN_ENVMAP_CODE = `pnpm --filter @brewsite/diagram gen-envmap`;

export function EnvironmentPage(): ReactElement {
  return (
    <Section<SectionId> id="environment" title="Environment Element">
      <p>
        The <code>&lt;Environment&gt;</code> element loads an HDR or EXR environment map and applies
        it as the scene's image-based lighting (IBL). This produces physically-based reflections and
        soft ambient illumination on all metallic and reflective surfaces — particularly visible on{' '}
        <code>&lt;FloorPhysical&gt;</code> with high metalness and low roughness settings. IBL is
        what separates a convincing render from a flat one.
      </p>

      <DocsDemo title="HDR environment reflections vs. direct lighting only" height={480}>
        <EnvironmentDemo />
      </DocsDemo>

      <h2>HDR Environment Maps</h2>
      <p>
        HDRI files (<code>.hdr</code>) are the most common format for environment maps. Use{' '}
        <code>&lt;EnvironmentHdri&gt;</code> as the child source. The <code>intensity</code> prop on
        the parent <code>&lt;Environment&gt;</code> scales the overall IBL contribution — useful for
        balancing environment lighting against direct lights.
      </p>
      <CodeBlock code={HDRI_CODE} language="tsx" />

      <h2>EXR Environment Maps</h2>
      <p>
        EXR files (<code>.exr</code>) offer higher dynamic range precision than HDRI. Use{' '}
        <code>&lt;EnvironmentExr&gt;</code> when you need wider exposure latitude, such as environments
        with very bright sun discs and very dark shadows simultaneously.
      </p>
      <CodeBlock code={EXR_CODE} language="tsx" />

      <h2>Showing the Environment as Background</h2>
      <p>
        By default the environment map only contributes to scene lighting and is invisible as a
        background. Set <code>background</code> on the source child to also render it behind the
        scene geometry.
      </p>
      <CodeBlock code={BACKGROUND_CODE} language="tsx" />

      <h2>Cube Map</h2>
      <p>
        Six-face cube maps are supported via <code>&lt;EnvironmentCube&gt;</code> for legacy assets
        or when equirectangular HDRI is not available. Provide all six face images in px, nx, py, ny,
        pz, nz order.
      </p>
      <CodeBlock code={CUBE_CODE} language="tsx" />

      <h2>Generating Environment Maps</h2>
      <p>
        The diagram package ships a built-in generator that bakes a studio-style environment map
        from parametric settings. Run it once to produce an HDR file optimised for the BrewSite
        rendering pipeline:
      </p>
      <CodeBlock code={GEN_ENVMAP_CODE} language="bash" />
      <Callout type="note">
        The generated env map is placed at{' '}
        <code>packages/diagram/src/elements/diagram/assets/envmaps/</code>. Reference it from your
        scenes using a path relative to the public assets directory.
      </Callout>

      <h2><code>&lt;Environment&gt;</code> Props</h2>
      <PropTable
        rows={[
          {
            name: 'enabled',
            type: 'boolean',
            defaultValue: 'false',
            description:
              'Activates the environment element. When false, no IBL is applied regardless of child source.',
          },
          {
            name: 'intensity',
            type: 'number',
            defaultValue: '1.0',
            description:
              'Scale factor for the IBL contribution. Lower values reduce reflections without removing them entirely.',
          },
        ]}
      />

      <h2>Source Child Props</h2>
      <PropTable
        rows={[
          {
            name: 'url',
            type: 'string',
            required: true,
            description:
              'Path to the HDR or EXR file. Used on EnvironmentHdri and EnvironmentExr.',
          },
          {
            name: 'urls',
            type: '[string, string, string, string, string, string]',
            required: true,
            description:
              'Six face paths in [px, nx, py, ny, pz, nz] order. Used on EnvironmentCube only.',
          },
          {
            name: 'background',
            type: 'boolean',
            defaultValue: 'false',
            description:
              'When true, renders the environment texture as the visible scene background in addition to using it for IBL.',
          },
        ]}
      />
    </Section>
  );
}

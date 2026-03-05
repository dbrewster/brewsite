import type { ReactElement } from 'react';
import { Section, DocsDemo, CodeBlock, PropTable, Callout } from '@brewsite/docs';
import type { SectionId } from '../../docs-nav';
import { FloorReflectionDemo } from '../../demos/core/FloorReflectionDemo.demo';

const PHYSICAL_CODE = `<Floor enabled>
  <FloorPhysical opacity={0.5} metalness={0.4} roughness={0.6} />
</Floor>`;

const MIRROR_CODE = `<Floor enabled>
  <FloorMirror
    mirrorOpacity={0.9}
    mirrorResolution={512}
    mirrorClipBias={0.003}
  />
</Floor>`;

const TEXTURED_CODE = `<Floor enabled position={[0, 0, 0]} scale={30}>
  <FloorPhysical
    textureUrl="/assets/floor/concrete-diffuse.jpg"
    normalMapUrl="/assets/floor/concrete-normal.jpg"
    roughnessMapUrl="/assets/floor/concrete-roughness.jpg"
    textureRepeat={[4, 4]}
    opacity={1.0}
    metalness={0.0}
    roughness={0.9}
  />
</Floor>`;

export function FloorPage(): ReactElement {
  return (
    <Section<SectionId> id="floor" title="Floor Element">
      <p>
        The <code>&lt;Floor&gt;</code> element renders a ground plane beneath your scene. It supports
        two surface types: a full PBR physical material via <code>&lt;FloorPhysical&gt;</code>, and a
        real-time mirror reflection via <code>&lt;FloorMirror&gt;</code>. A well-tuned floor grounds
        your 3D content spatially and adds the reflective depth that makes marketing scenes feel premium.
      </p>

      <DocsDemo title="Reflective floor variations" height={480}>
        <FloorReflectionDemo />
      </DocsDemo>

      <h2>Physical Floor</h2>
      <p>
        <code>&lt;FloorPhysical&gt;</code> uses Three.js <code>MeshStandardMaterial</code>. It supports
        the full PBR texture pipeline: diffuse, normal, roughness, metalness, AO, and emissive maps.
      </p>
      <CodeBlock code={PHYSICAL_CODE} language="tsx" />

      <h2>Mirror Floor</h2>
      <p>
        <code>&lt;FloorMirror&gt;</code> renders a real-time reflection of the scene above the floor
        plane. Use it when you want a crisp mirror effect rather than a physically roughened reflection.
      </p>
      <CodeBlock code={MIRROR_CODE} language="tsx" />

      <h2>Textured Floor</h2>
      <p>
        <code>&lt;FloorPhysical&gt;</code> accepts texture map URLs for all standard PBR channels.
        Textures are loaded asynchronously and tiled via <code>textureRepeat</code>.
      </p>
      <CodeBlock code={TEXTURED_CODE} language="tsx" />

      <h2><code>&lt;Floor&gt;</code> Props</h2>
      <PropTable
        rows={[
          { name: 'enabled', type: 'boolean', defaultValue: 'false', description: 'Activates the floor plane. When false, no floor geometry is rendered.' },
          { name: 'position', type: '[number, number, number]', defaultValue: '[0, 0, 0]', description: 'World-space position offset for the floor plane.' },
          { name: 'rotation', type: '[number, number, number]', defaultValue: '[0, 0, 0]', description: 'Euler rotation in radians.' },
          { name: 'scale', type: 'number', defaultValue: '20', description: 'Floor plane size in world units.' },
        ]}
      />

      <h2><code>&lt;FloorPhysical&gt;</code> Props</h2>
      <PropTable
        rows={[
          { name: 'opacity', type: 'number', defaultValue: '1.0', description: 'Floor surface opacity (0 = invisible, 1 = fully opaque).' },
          { name: 'metalness', type: 'number', defaultValue: '0', description: 'PBR metalness factor (0 = dielectric, 1 = full metal).' },
          { name: 'roughness', type: 'number', defaultValue: '1.0', description: 'PBR roughness factor (0 = mirror-smooth, 1 = fully diffuse).' },
          { name: 'color', type: 'string', defaultValue: '"#ffffff"', description: 'Base diffuse color tint applied before any texture.' },
          { name: 'textureUrl', type: 'string', description: 'Diffuse texture image URL.' },
          { name: 'normalMapUrl', type: 'string', description: 'Normal map image URL.' },
          { name: 'roughnessMapUrl', type: 'string', description: 'Grayscale roughness map URL.' },
          { name: 'textureRepeat', type: '[number, number]', defaultValue: '[1, 1]', description: 'UV tiling for all textures in [u, v] repeats.' },
          { name: 'clearcoat', type: 'number', defaultValue: '0', description: 'Clearcoat layer strength (0–1).' },
          { name: 'envMapIntensity', type: 'number', defaultValue: '1.0', description: 'Scale factor for environment map reflections.' },
          { name: 'emissive', type: 'string', description: 'Emissive color.' },
          { name: 'emissiveIntensity', type: 'number', defaultValue: '1.0', description: 'Multiplier for emissive output.' },
        ]}
      />

      <h2><code>&lt;FloorMirror&gt;</code> Props</h2>
      <PropTable
        rows={[
          { name: 'mirrorOpacity', type: 'number', defaultValue: '0.5', description: 'Reflection opacity.' },
          { name: 'mirrorResolution', type: 'number', defaultValue: '256', description: 'Render resolution for the reflection pass in pixels.' },
          { name: 'mirrorClipBias', type: 'number', defaultValue: '0.003', description: 'Clip plane bias to prevent z-fighting artefacts.' },
          { name: 'mirrorColor', type: 'string', description: 'Tint color mixed into the mirror reflection.' },
        ]}
      />

      <Callout type="tip">
        A subtle <code>&lt;FloorPhysical&gt;</code> (opacity 0.3–0.5, roughness 0.6–0.8) adds
        spatial depth without overwhelming the scene. For a true mirror, switch to <code>&lt;FloorMirror&gt;</code>{' '}
        with <code>mirrorOpacity</code> above 0.8.
      </Callout>
    </Section>
  );
}

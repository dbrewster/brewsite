import { JSX } from 'react';
import { CodeBlock } from '../../components/ui/CodeBlock';
import { PropTable } from '../../components/ui/PropTable';
import { Callout } from '../../components/ui/Callout';
import { LiveDemo } from '../../components/demo/LiveDemo';
import FloorReflectionDemo, { CODE as FLOOR_CODE } from '../../demos/core/FloorReflectionDemo.demo';

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

export default function FloorElement(): JSX.Element {
  return (
    <section>
      <h1>Floor Element</h1>
      <p>
        The <code>&lt;Floor&gt;</code> element renders a ground plane beneath your scene. It supports
        two surface types: a full PBR physical material via <code>&lt;FloorPhysical&gt;</code>, and a
        real-time mirror reflection via <code>&lt;FloorMirror&gt;</code>. A well-tuned floor grounds
        your 3D content spatially and adds the reflective depth that makes marketing scenes feel premium.
      </p>

      <LiveDemo title="Reflective floor variations" code={FLOOR_CODE}>
        <FloorReflectionDemo />
      </LiveDemo>

      <h2>Physical Floor</h2>
      <p>
        <code>&lt;FloorPhysical&gt;</code> uses Three.js <code>MeshStandardMaterial</code> (or{' '}
        <code>MeshPhysicalMaterial</code> when clearcoat is set). It supports the full PBR texture
        pipeline: diffuse, normal, roughness, metalness, AO, displacement, alpha, and emissive maps.
        Pair it with a high-metalness, low-roughness config for a polished stage feel, or a textured
        rough surface for a grounded architectural look.
      </p>
      <CodeBlock code={PHYSICAL_CODE} language="tsx" />

      <h2>Mirror Floor</h2>
      <p>
        <code>&lt;FloorMirror&gt;</code> renders a real-time reflection of the scene above the floor
        plane. It works by rendering a second camera pass below the floor and projecting the result
        onto the surface. Use it when you want a crisp mirror effect rather than a physically roughened
        reflection.
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
          {
            name: 'enabled',
            type: 'boolean',
            defaultValue: 'false',
            description: 'Activates the floor plane. When false, no floor geometry is rendered.',
          },
          {
            name: 'position',
            type: '[number, number, number]',
            defaultValue: '[0, 0, 0]',
            description: 'World-space position offset for the floor plane.',
          },
          {
            name: 'rotation',
            type: '[number, number, number]',
            defaultValue: '[0, 0, 0]',
            description: 'Euler rotation in radians. Rarely needed for a flat floor.',
          },
          {
            name: 'scale',
            type: 'number',
            defaultValue: '20',
            description: 'Floor plane size in world units. Increase for wide scenes.',
          },
        ]}
      />

      <h2><code>&lt;FloorPhysical&gt;</code> Props</h2>
      <PropTable
        rows={[
          {
            name: 'opacity',
            type: 'number',
            defaultValue: '1.0',
            description: 'Floor surface opacity (0 = invisible, 1 = fully opaque).',
          },
          {
            name: 'metalness',
            type: 'number',
            defaultValue: '0',
            description: 'PBR metalness factor (0 = dielectric, 1 = full metal).',
          },
          {
            name: 'roughness',
            type: 'number',
            defaultValue: '1.0',
            description: 'PBR roughness factor (0 = mirror-smooth, 1 = fully diffuse).',
          },
          {
            name: 'color',
            type: 'string',
            defaultValue: '"#ffffff"',
            description: 'Base diffuse color tint applied before any texture.',
          },
          {
            name: 'textureUrl',
            type: 'string',
            description: 'Diffuse texture image URL.',
          },
          {
            name: 'normalMapUrl',
            type: 'string',
            description: 'Normal map image URL for surface detail without added geometry.',
          },
          {
            name: 'roughnessMapUrl',
            type: 'string',
            description: 'Grayscale roughness map URL.',
          },
          {
            name: 'textureRepeat',
            type: '[number, number]',
            defaultValue: '[1, 1]',
            description: 'UV tiling for all textures in [u, v] repeats.',
          },
          {
            name: 'clearcoat',
            type: 'number',
            defaultValue: '0',
            description:
              'Clearcoat layer strength (0–1). Adds a shiny lacquer on top of the base material. Requires MeshPhysicalMaterial.',
          },
          {
            name: 'envMapIntensity',
            type: 'number',
            defaultValue: '1.0',
            description: 'Scale factor for environment map reflections on this surface.',
          },
          {
            name: 'emissive',
            type: 'string',
            description: 'Emissive color. Makes the floor glow independently of scene lighting.',
          },
          {
            name: 'emissiveIntensity',
            type: 'number',
            defaultValue: '1.0',
            description: 'Multiplier for emissive output.',
          },
        ]}
      />

      <h2><code>&lt;FloorMirror&gt;</code> Props</h2>
      <PropTable
        rows={[
          {
            name: 'mirrorOpacity',
            type: 'number',
            defaultValue: '0.5',
            description: 'Reflection opacity (0 = invisible, 1 = full mirror).',
          },
          {
            name: 'mirrorResolution',
            type: 'number',
            defaultValue: '256',
            description:
              'Render resolution for the reflection pass in pixels. Higher values are sharper but more expensive.',
          },
          {
            name: 'mirrorClipBias',
            type: 'number',
            defaultValue: '0.003',
            description:
              'Clip plane bias to prevent z-fighting artefacts at the mirror surface edge.',
          },
          {
            name: 'mirrorColor',
            type: 'string',
            description: 'Tint color mixed into the mirror reflection.',
          },
        ]}
      />

      <Callout type="tip">
        A subtle <code>&lt;FloorPhysical&gt;</code> (opacity 0.3–0.5, roughness 0.6–0.8) adds
        spatial depth without overwhelming the scene. High opacity combined with low roughness
        creates a polished-stone effect. For a true mirror, switch to <code>&lt;FloorMirror&gt;</code>{' '}
        with <code>mirrorOpacity</code> above 0.8 — best suited to minimalist environments where the
        reflection has room to breathe.
      </Callout>
    </section>
  );
}

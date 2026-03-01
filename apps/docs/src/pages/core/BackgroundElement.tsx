import { JSX } from 'react';
import { CodeBlock } from '../../components/ui/CodeBlock';
import { PropTable } from '../../components/ui/PropTable';
import { Callout } from '../../components/ui/Callout';
import { LiveDemo } from '../../components/demo/LiveDemo';
import BackgroundDemo, { CODE as BG_CODE } from '../../demos/core/BackgroundDemo.demo';

const COLOR_CODE = `// Solid color background — the ambient light color strongly influences
// the visual tone of the scene even without an imageUrl.
<Scene key="s1">
  <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
  <Lighting>
    <Ambient color="#4455ff" intensity={0.5} />
  </Lighting>
  <Floor enabled>
    <FloorPhysical opacity={0.5} metalness={0.5} roughness={0.5} />
  </Floor>
</Scene>`;

const IMAGE_CODE = `// Image-based background using a 3D plane in world space.
<Background imageUrl="/assets/backgrounds/gradient.png" opacity={1.0} />

// DOM fallback mode — uses CSS background-* properties.
<Background
  imageUrl="/assets/backgrounds/gradient.png"
  opacity={0.9}
  cssPosition="center top"
  cssSize="cover"
  cssRepeat="no-repeat"
/>`;

export default function BackgroundElement(): JSX.Element {
  return (
    <section>
      <h1>Background Element</h1>
      <p>
        The <code>&lt;Background&gt;</code> element controls what appears behind your 3D scene. It
        supports image-based backgrounds rendered on a 3D plane in world space, as well as a DOM
        fallback mode that applies a CSS background to the container. Like all scene elements,
        background properties are interpolated during scene transitions.
      </p>

      <LiveDemo title="Background color transitions via ambient lighting" code={BG_CODE}>
        <BackgroundDemo />
      </LiveDemo>

      <h2>Color Backgrounds</h2>
      <p>
        For purely color-based backgrounds, omit <code>&lt;Background&gt;</code> entirely and control
        the atmosphere through the <code>&lt;Lighting&gt;</code> ambient color. The ambient color
        floods the scene geometry and floor, effectively tinting the overall visual tone. The demo
        above shows how dramatic scene palette changes can be achieved with ambient light alone —
        no background image required.
      </p>
      <CodeBlock code={COLOR_CODE} language="tsx" />

      <h2>Image Backgrounds</h2>
      <p>
        For image-based backgrounds, provide an <code>imageUrl</code>. In 3D plane mode, the image
        is rendered on a world-space quad behind the scene geometry. In DOM fallback mode, use the
        CSS background props to position and size the image via standard browser styling.
      </p>
      <CodeBlock code={IMAGE_CODE} language="tsx" />

      <h2><code>&lt;Background&gt;</code> Props</h2>
      <PropTable
        rows={[
          {
            name: 'imageUrl',
            type: 'string',
            description:
              'URL of the background image. When omitted, no background image is rendered — use ambient light color for scene tone.',
          },
          {
            name: 'opacity',
            type: 'number',
            defaultValue: '1.0',
            description: 'Background image opacity from 0 (transparent) to 1 (fully opaque).',
          },
          {
            name: 'position',
            type: '[number, number, number]',
            description:
              'World-space offset for the 3D background plane mode. Adjust depth (z) to place the plane behind scene geometry.',
          },
          {
            name: 'cssPosition',
            type: 'string',
            description:
              "CSS background-position value for DOM fallback mode (e.g. 'center top'). Has no effect in 3D plane mode.",
          },
          {
            name: 'cssSize',
            type: 'string',
            description:
              "CSS background-size value for DOM fallback mode (e.g. 'cover' or '100% auto'). Has no effect in 3D plane mode.",
          },
          {
            name: 'cssRepeat',
            type: 'string',
            description:
              "CSS background-repeat value for DOM fallback mode (e.g. 'no-repeat'). Has no effect in 3D plane mode.",
          },
        ]}
      />

      <Callout type="tip">
        Background image opacity is interpolated between scenes just like any other prop. Use deep,
        desaturated colors and controlled ambient intensity for a cinematic look — overly bright or
        saturated backgrounds compete with the 3D content for visual attention.
      </Callout>
    </section>
  );
}

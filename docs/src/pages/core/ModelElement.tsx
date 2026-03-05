import type { ReactElement } from 'react';
import { Section, DocsDemo, CodeBlock, PropTable, Callout } from '@brewsite/docs';
import type { SectionId } from '../../docs-nav';
import { ModelBasicDemo } from '../../demos/core/ModelBasicDemo.demo';
import { ModelAnimationDemo } from '../../demos/core/ModelAnimationDemo.demo';

const BASIC_USAGE_CODE = `<Model type="MaleDummy" id="character" position={[0, 0, 0]} />`;

const ANIMATION_USAGE_CODE = `<Model type="MaleDummy" id="character" position={[0, 0, 0]}>
  <Playback>
    <Animation clipName="chat-relax-m" />
  </Playback>
</Model>`;

const CAMERA_FRAMING_CODE = `<Camera
  mode="fitBotHeight"
  targetId="character"
  targetHeight={1.8}
  framingHeightPct={0.85}
/>`;

const SITE_RESOURCES_CODE = `export const siteResources = {
  models: [{
    type: 'MaleDummy',
    role: 'primary',
    path: '/assets/motion-dummy_male.no-normals.glb',
    footOffsetY: 0.06,
    scale: 30,
  }],
  animations: [{
    type: 'ChatRelaxM',
    path: '/assets/motion/chat-relax-m.glb',
    clipStart: 0.1,
    clipEnd: -0.8,
  }],
};`;

const GEN_DSL_CODE = `pnpm --filter @your-app gen:scene-dsl`;

const WIDGET_REGISTRY_CODE = `import { createDefaultWidgetRegistry } from '@brewsite/core';

export function widgetSetup(manifest) {
  return createDefaultWidgetRegistry(manifest);
}

<ScenePlayer
  manifestUrl="/scene-manifest.json"
  widgetSetup={widgetSetup}
>
  {/* scenes */}
</ScenePlayer>`;

export function ModelPage(): ReactElement {
  return (
    <Section<SectionId> id="model" title="Model Element">
      <p>
        The <code>&lt;Model&gt;</code> element loads a GLTF model and plays back skeletal animations.
        Models are registered via an asset manifest and loaded asynchronously before the first render frame.
      </p>

      <DocsDemo title="MaleDummy model with idle animation" height={480}>
        <ModelBasicDemo />
      </DocsDemo>

      <h2>Asset Manifest</h2>
      <p>
        Models are registered via <code>siteResources.ts</code> and the <code>gen:scene-dsl</code> script.
      </p>
      <CodeBlock code={SITE_RESOURCES_CODE} language="typescript" />
      <CodeBlock code={GEN_DSL_CODE} language="bash" />
      <Callout type="note">
        After running <code>gen:scene-dsl</code>, TypeScript types are generated for your model names
        and clip names.
      </Callout>

      <h2>Basic Usage</h2>
      <CodeBlock code={BASIC_USAGE_CODE} language="tsx" />

      <h2><code>&lt;Model&gt;</code> Props</h2>
      <PropTable
        rows={[
          { name: 'type', type: 'string', required: true, description: 'Model type key matching an entry in your siteResources manifest.' },
          { name: 'id', type: 'string', required: true, description: 'Unique instance identifier. Used by the widget registry and as the targetId in camera descriptors.' },
          { name: 'position', type: '[number, number, number]', defaultValue: '[0, 0, 0]', description: 'World position [x, y, z].' },
          { name: 'rotation', type: '[number, number, number]', defaultValue: '[0, 0, 0]', description: 'Euler rotation in radians [x, y, z].' },
          { name: 'scale', type: 'number | [number, number, number]', defaultValue: '1', description: 'Uniform or per-axis scale.' },
          { name: 'opacity', type: 'number', defaultValue: '1', description: 'Model opacity 0–1.' },
          { name: 'enabled', type: 'boolean', defaultValue: 'true', description: 'Whether the model is rendered.' },
        ]}
      />

      <h2>Animation Clips</h2>
      <DocsDemo title="Switching between animation clips" height={480}>
        <ModelAnimationDemo />
      </DocsDemo>
      <CodeBlock code={ANIMATION_USAGE_CODE} language="tsx" />

      <h2>Camera Framing</h2>
      <p>
        Use <code>mode: 'fitBotHeight'</code> on the <code>&lt;Camera&gt;</code> to automatically frame
        a model by its height.
      </p>
      <CodeBlock code={CAMERA_FRAMING_CODE} language="tsx" />
      <p>
        See the <a href="#camera">Camera element</a> for the full framing mode reference.
      </p>

      <h2>Setting Up the Widget Registry</h2>
      <CodeBlock code={WIDGET_REGISTRY_CODE} language="typescript" />
    </Section>
  );
}

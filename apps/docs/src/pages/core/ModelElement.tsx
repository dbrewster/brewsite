import { JSX } from 'react';
import { Link } from 'react-router';
import { CodeBlock } from '../../components/ui/CodeBlock';
import { PropTable } from '../../components/ui/PropTable';
import { Callout } from '../../components/ui/Callout';
import { LiveDemo } from '../../components/demo/LiveDemo';
import ModelBasicDemo, { CODE as MODEL_BASIC_CODE } from '../../demos/core/ModelBasicDemo.demo';
import ModelAnimationDemo, { CODE as MODEL_ANIM_CODE } from '../../demos/core/ModelAnimationDemo.demo';

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

// In your widgetSetup function:
export function widgetSetup(manifest) {
  return createDefaultWidgetRegistry(manifest);
}

// Pass it to ScenePlayer:
<ScenePlayer
  manifestUrl="/scene-manifest.json"
  widgetSetup={widgetSetup}
>
  {/* scenes */}
</ScenePlayer>`;

export default function ModelElement(): JSX.Element {
  return (
    <section>
      <h1>Model Element</h1>
      <p>
        The <code>&lt;Model&gt;</code> element loads a GLTF model and plays back skeletal animations.
        Models are registered via an asset manifest and loaded asynchronously before the first render frame.
      </p>

      <LiveDemo title="MaleDummy model with idle animation" code={MODEL_BASIC_CODE}>
        <ModelBasicDemo />
      </LiveDemo>

      <h2>Asset Manifest</h2>
      <p>
        Models are registered via <code>siteResources.ts</code> and the <code>gen:scene-dsl</code> script.
        The manifest drives both the runtime asset loader and the TypeScript type generator — every model
        type and clip name your scenes can reference comes from here.
      </p>
      <CodeBlock code={SITE_RESOURCES_CODE} language="typescript" />
      <CodeBlock code={GEN_DSL_CODE} language="bash" />
      <Callout type="note">
        After running <code>gen:scene-dsl</code>, TypeScript types are generated for your model names
        and clip names. Import <code>MaleDummyClipName</code> from the generated file to get
        autocomplete and type-checking on animation clip names.
      </Callout>

      <h2>Basic Usage</h2>
      <p>
        Place a <code>&lt;Model&gt;</code> inside a <code>&lt;Scene&gt;</code>. The <code>type</code> must
        match an entry in your asset manifest; the <code>id</code> is the stable instance identifier used
        by the widget registry and camera descriptors.
      </p>
      <CodeBlock code={BASIC_USAGE_CODE} language="tsx" />

      <h2><code>&lt;Model&gt;</code> Props</h2>
      <PropTable
        rows={[
          {
            name: 'type',
            type: 'string',
            required: true,
            description: 'Model type key matching an entry in your siteResources manifest.',
          },
          {
            name: 'id',
            type: 'string',
            required: true,
            description:
              'Unique instance identifier. Used by the widget registry and as the targetId in camera descriptors like fitBotHeight.',
          },
          {
            name: 'position',
            type: '[number, number, number]',
            defaultValue: '[0, 0, 0]',
            description: 'World position [x, y, z].',
          },
          {
            name: 'rotation',
            type: '[number, number, number]',
            defaultValue: '[0, 0, 0]',
            description: 'Euler rotation in radians [x, y, z].',
          },
          {
            name: 'scale',
            type: 'number | [number, number, number]',
            defaultValue: '1',
            description: 'Uniform or per-axis scale.',
          },
          {
            name: 'opacity',
            type: 'number',
            defaultValue: '1',
            description: 'Model opacity 0–1.',
          },
          {
            name: 'enabled',
            type: 'boolean',
            defaultValue: 'true',
            description: 'Whether the model is rendered.',
          },
        ]}
      />

      <h2>Animation Clips</h2>
      <p>
        Animations are declared inside a <code>&lt;Playback&gt;</code> block nested within the model.
        Each <code>&lt;Animation&gt;</code> references a clip name from your generated types. The runtime
        cross-fades between clips automatically when the active clip changes between scenes.
      </p>

      <LiveDemo title="Switching between animation clips" code={MODEL_ANIM_CODE}>
        <ModelAnimationDemo />
      </LiveDemo>

      <CodeBlock code={ANIMATION_USAGE_CODE} language="tsx" />

      <h2>Camera Framing</h2>
      <p>
        Use <code>mode: 'fitBotHeight'</code> on the <code>&lt;Camera&gt;</code> to automatically frame
        a model by its height. The camera calculates a position that fits the model within the specified
        percentage of the viewport height — no manual position math required.
      </p>
      <CodeBlock code={CAMERA_FRAMING_CODE} language="tsx" />
      <p>
        See the <Link to="/core/camera">Camera element</Link> for the full framing mode reference.
      </p>

      <h2>Setting Up the Widget Registry</h2>
      <p>
        Model loading requires <code>createDefaultWidgetRegistry</code> to be called with the resolved
        manifest. Pass a <code>widgetSetup</code> function to <code>&lt;ScenePlayer&gt;</code> that
        wires the manifest into the registry:
      </p>
      <CodeBlock code={WIDGET_REGISTRY_CODE} language="typescript" />
    </section>
  );
}

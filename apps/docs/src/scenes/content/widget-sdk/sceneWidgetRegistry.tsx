import { JSX } from 'react';
import {
  Scene,
  Camera,
  Lighting,
  Ambient,
  Directional,
  Background,
  ProgressManager,
} from '@brewsite/core';
import { DWELL_FN } from '../../sceneUtils';
import { DocPanel } from '../../../components/content/DocPanel';
import { CodeBlock } from '../../../components/ui/CodeBlock';
import { Callout } from '../../../components/ui/Callout';

function WidgetRegistryContent(): JSX.Element {
  return (
    <DocPanel slideInBy={0.3}>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', margin: '0 0 8px', fontWeight: 700 }}>Widget Registry</h1>
      <p style={{ fontSize: 'var(--font-size-base)', lineHeight: 1.65, color: 'var(--text-secondary)', margin: '0 0 20px' }}>
        The <code>WidgetRegistry</code> maps DSL node types to widget classes. Pass a{' '}
        <code>widgetSetup</code> factory to <code>ScenePlayer</code> to register custom widgets
        alongside the built-ins.
      </p>

      <CodeBlock
        language="typescript"
        code={`// widgetSetup.ts
import { createDefaultWidgetRegistry } from '@brewsite/core';
import type { AssetManifest, WidgetRegistry } from '@brewsite/core';
import { MyBoxWidget } from './widgets/MyBoxWidget';

// Module-level — stable reference, never inline
export const widgetSetup = (manifest: AssetManifest): WidgetRegistry => {
  const registry = createDefaultWidgetRegistry(manifest);
  registry.register(new MyBoxWidget('my-box'));
  return registry;
};

// In your page:
<ScenePlayer
  manifestUrl="/manifest.json"
  widgetSetup={widgetSetup}
>
  ...
</ScenePlayer>`}
      />

      <Callout type="tip">
        <code>createDefaultWidgetRegistry</code> bundles Camera, Lighting, Background, Environment,
        Floor, and SceneMeta widgets. You only need to call it once per app.
      </Callout>

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>With @brewsite/diagram</h2>
      <CodeBlock
        language="typescript"
        code={`import { createDefaultWidgetRegistry } from '@brewsite/core';
import { registerDiagramHandlers } from '@brewsite/diagram';

// Must call registerDiagramHandlers BEFORE createDefaultWidgetRegistry
export const widgetSetup = (manifest) => {
  registerDiagramHandlers();
  return createDefaultWidgetRegistry(manifest);
};`}
      />
    </DocPanel>
  );
}

export function SceneWidgetRegistry(): JSX.Element {
  return (
    <Scene key="scene-widget-registry" id="scene-widget-registry">
      <ProgressManager scrollUnits={2400} fn={DWELL_FN} />
      <Camera mode="orbit" target={[0, 0, 0]} azimuth={0.5} polar={1.0} distance={8} />
      <Background color="#10080e" />
      <Lighting>
        <Ambient color="#cc44ff" intensity={0.4} />
        <Directional color="#ff88cc" intensity={1.6} position={[-2, 8, 4]} />
      </Lighting>

      <WidgetRegistryContent />
    </Scene>
  );
}

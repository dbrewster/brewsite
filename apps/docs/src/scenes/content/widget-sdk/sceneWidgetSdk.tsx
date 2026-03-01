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
import { PropTable } from '../../../components/ui/PropTable';

function WidgetSdkContent(): JSX.Element {
  return (
    <DocPanel slideInBy={0.3}>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', margin: '0 0 8px', fontWeight: 700 }}>Widget SDK Overview</h1>
      <p style={{ fontSize: 'var(--font-size-base)', lineHeight: 1.65, color: 'var(--text-secondary)', margin: '0 0 20px' }}>
        Every renderable concept in BrewSite is a <strong>widget</strong>. The Camera, Lighting,
        Background, and Floor are all widgets. You can build your own using the Widget SDK.
      </p>

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '0 0 10px' }}>IWidget hierarchy</h2>
      <CodeBlock
        language="typescript"
        code={`interface IWidget {
  id: string;
  onTick(state: WidgetState, context: WidgetContext): void;
}

// Widgets that render to the 3D scene
interface ISceneElement extends IWidget { }

// Widgets that update Three.js objects each frame
interface IRenderable extends ISceneElement {
  render(scene: THREE.Scene): void;
  dispose(): void;
}

// Widgets that load external assets
interface ILoadable extends IWidget {
  load(manifest: AssetManifest): Promise<void>;
}`}
      />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>Widget interfaces</h2>
      <PropTable
        rows={[
          { name: 'IWidget',            type: 'interface', description: 'Base: id, onTick. Every widget.' },
          { name: 'ISceneElement',      type: 'interface', description: 'Participates in the 3D scene graph.' },
          { name: 'IRenderable',        type: 'interface', description: 'Calls render() each frame. Three.js operations here.' },
          { name: 'ILoadable',          type: 'interface', description: 'Loads async assets (GLTF, textures, etc.).' },
          { name: 'IDslComposite',      type: 'interface', description: 'Widget provides its own DSL node handler.' },
          { name: 'IAnimationController', type: 'interface', description: 'Controls animation playback with blending.' },
        ]}
      />
    </DocPanel>
  );
}

export function SceneWidgetSdk(): JSX.Element {
  return (
    <Scene key="scene-widget-sdk" id="scene-widget-sdk">
      <ProgressManager scrollUnits={2400} fn={DWELL_FN} />
      <Camera mode="world" position={[0, 2, 8]} target={[0, 1, 0]} fov={44} />
      <Background color="#10080e" />
      <Lighting>
        <Ambient color="#cc44ff" intensity={0.4} />
        <Directional color="#ff88cc" intensity={1.6} position={[-3, 8, 5]} />
      </Lighting>

      <WidgetSdkContent />
    </Scene>
  );
}

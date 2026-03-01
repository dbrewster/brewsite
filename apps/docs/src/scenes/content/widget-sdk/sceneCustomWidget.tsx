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

function CustomWidgetContent(): JSX.Element {
  return (
    <DocPanel slideInBy={0.3}>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', margin: '0 0 8px', fontWeight: 700 }}>Custom Widget</h1>
      <p style={{ fontSize: 'var(--font-size-base)', lineHeight: 1.65, color: 'var(--text-secondary)', margin: '0 0 20px' }}>
        Create custom renderable concepts by implementing <code>IWidget</code> (and optionally
        <code>IRenderable</code>, <code>ILoadable</code>). Register with{' '}
        <code>WidgetRegistry</code> and author DSL using <code>registerNode</code>.
      </p>

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '0 0 10px' }}>Minimal example</h2>
      <CodeBlock
        language="typescript"
        code={`import { IWidget, IRenderable, WidgetState, WidgetContext } from '@brewsite/core';
import * as THREE from 'three';

export class MyBoxWidget implements IWidget, IRenderable {
  readonly id: string;
  private mesh: THREE.Mesh;

  constructor(id: string) {
    this.id = id;
    this.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x4488ff }),
    );
  }

  onTick(state: WidgetState, _ctx: WidgetContext): void {
    // state.position, state.opacity, etc — set by compiler from your DSL
    if (state.position) {
      this.mesh.position.set(...state.position);
    }
  }

  render(scene: THREE.Scene): void {
    if (!scene.children.includes(this.mesh)) {
      scene.add(this.mesh);
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}`}
      />

      <Callout type="note">
        All Three.js code belongs in <code>render.ts</code> files (or the widget class).
        Never import Three.js in <code>compile.ts</code>, <code>dsl.tsx</code>, or scene files.
      </Callout>
    </DocPanel>
  );
}

export function SceneCustomWidget(): JSX.Element {
  return (
    <Scene key="scene-custom-widget" id="scene-custom-widget">
      <ProgressManager scrollUnits={2400} fn={DWELL_FN} />
      <Camera mode="orbit" target={[0, 0, 0]} azimuth={0.3} polar={1.0} distance={8} />
      <Background color="#10080e" />
      <Lighting>
        <Ambient color="#cc44ff" intensity={0.4} />
        <Directional color="#ff88cc" intensity={1.6} position={[-2, 8, 5]} />
      </Lighting>

      <CustomWidgetContent />
    </Scene>
  );
}

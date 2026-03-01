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
import { DemoProgressProvider, useDemoProgress } from '../../../components/content/DemoProgressProvider';
import { InlineDemo } from '../../../components/demo/InlineDemo';
import { CodeBlock } from '../../../components/ui/CodeBlock';

function VariableStoreDemo(): JSX.Element {
  const demoProgress = useDemoProgress();
  return (
    <InlineDemo controlledProgress={demoProgress} height={240}>
      <Scene key="vs-d1" id="vs-d1">
        <Camera mode="orbit" target={[0, 0, 0]} azimuth={0} polar={1.0} distance={8} />
        <Lighting><Ambient color="#cc44ff" intensity={0.4} /><Directional color="#ff88cc" intensity={1.6} position={[-3, 8, 5]} /></Lighting>
        <Background color="#10080e" />
        <div style={{ position: 'absolute', top: '8%', left: '8%', fontFamily: 'monospace', fontSize: 11, color: 'rgba(200,150,255,0.8)', pointerEvents: 'none' }}>
          variableStore.set(&apos;highlight&apos;, &apos;red&apos;)
        </div>
      </Scene>
    </InlineDemo>
  );
}

function VariableStoreContent(): JSX.Element {
  return (
    <DocPanel slideInBy={0.25}>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', margin: '0 0 8px', fontWeight: 700 }}>VariableStore</h1>
      <p style={{ fontSize: 'var(--font-size-base)', lineHeight: 1.65, color: 'var(--text-secondary)', margin: '0 0 20px' }}>
        <code>VariableStore</code> is a reactive key-value store for cross-widget state sharing.
        Widgets that implement <code>IVariableProvider</code> can write values that other widgets
        and React components can observe.
      </p>

      <CodeBlock
        language="typescript"
        code={`// Writing from a widget
class MyWidget implements IWidget, IVariableProvider {
  provideVariables(store: VariableStore): void {
    store.set('my-widget.isActive', true);
    store.set('my-widget.position', [1, 2, 3]);
  }
}

// Reading in React (inside EngineProvider)
function StatusPanel() {
  const engine = useSceneEngineContext();
  const isActive = engine.variableStore?.get('my-widget.isActive') ?? false;
  return <div>Active: {String(isActive)}</div>;
}`}
      />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>VariableStore API</h2>
      <CodeBlock
        language="typescript"
        code={`interface VariableStore {
  get<T>(key: string): T | undefined;
  set(key: string, value: unknown): void;
  subscribe(key: string, cb: (value: unknown) => void): () => void;
}`}
      />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>Live Demo</h2>
      <VariableStoreDemo />
    </DocPanel>
  );
}

export function SceneVariableStore(): JSX.Element {
  return (
    <Scene key="scene-variable-store" id="scene-variable-store">
      <ProgressManager scrollUnits={3200} fn={DWELL_FN} />
      <Camera mode="world" position={[2, 2, 8]} target={[0, 1, 0]} fov={44} />
      <Background color="#10080e" />
      <Lighting>
        <Ambient color="#cc44ff" intensity={0.4} />
        <Directional color="#ff88cc" intensity={1.6} position={[-1, 8, 5]} />
      </Lighting>

      <DemoProgressProvider startAt={0.25}>
        <VariableStoreContent />
      </DemoProgressProvider>
    </Scene>
  );
}

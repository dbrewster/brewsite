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

function InputNavigationContent(): JSX.Element {
  return (
    <DocPanel slideInBy={0.3}>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', margin: '0 0 8px', fontWeight: 700 }}>Scene Navigation</h1>
      <p style={{ fontSize: 'var(--font-size-base)', lineHeight: 1.65, color: 'var(--text-secondary)', margin: '0 0 20px' }}>
        By default, <code>ScenePlayer</code> drives scene progress from the page scroll position.
        You can use <code>InputController</code> to add keyboard, pointer, or gesture navigation.
      </p>

      <CodeBlock
        language="tsx"
        code={`<Scene key="main">
  <InputController scope="canvas">
    {/* Advance/retreat scenes with keyboard */}
    <Action id="next" type="scene.next">
      <KeyMap keyName="ArrowRight" />
    </Action>
    <Action id="prev" type="scene.prev">
      <KeyMap keyName="ArrowLeft" />
    </Action>
    {/* Or scroll-wheel */}
    <Action id="scroll-next" type="scene.next">
      <WheelMap />
    </Action>
  </InputController>
</Scene>`}
      />

      <Callout type="note">
        <code>InputController</code> uses carry-forward semantics — once declared, it persists
        into all subsequent scenes until explicitly overridden.
      </Callout>

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>Scope options</h2>
      <CodeBlock
        language="tsx"
        code={`// Listen on canvas element only (default)
<InputController scope="canvas">...</InputController>

// Listen on the full window
<InputController scope="window">...</InputController>`}
      />
    </DocPanel>
  );
}

export function SceneInputNavigation(): JSX.Element {
  return (
    <Scene key="scene-input-navigation" id="scene-input-navigation">
      <ProgressManager scrollUnits={2400} fn={DWELL_FN} />
      <Camera mode="world" position={[0, 2, 8]} target={[0, 1, 0]} fov={44} />
      <Background color="#0d1210" />
      <Lighting>
        <Ambient color="#22ff88" intensity={0.3} />
        <Directional color="#44ffaa" intensity={1.5} position={[5, 9, -2]} />
      </Lighting>

      <InputNavigationContent />
    </Scene>
  );
}

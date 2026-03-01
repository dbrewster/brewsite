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
import { PropTable } from '../../../components/ui/PropTable';

function InputActionsDemo(): JSX.Element {
  const demoProgress = useDemoProgress();
  return (
    <InlineDemo controlledProgress={demoProgress} height={260}>
      <Scene key="ia-d1" id="ia-d1">
        <Camera mode="orbit" target={[0, 0, 0]} azimuth={0} polar={1.0} distance={8}
          interaction={{ enabled: true, rotate: { speed: 0.8 }, zoom: { speed: 0.5 }, damping: 0.08 }}
        />
        <Lighting><Ambient color="#22ff88" intensity={0.3} /><Directional color="#44ffaa" intensity={1.5} position={[5, 9, -3]} /></Lighting>
        <Background color="#0d1210" />
      </Scene>
    </InlineDemo>
  );
}

function InputActionsContent(): JSX.Element {
  return (
    <DocPanel slideInBy={0.25}>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', margin: '0 0 8px', fontWeight: 700 }}>Input Actions</h1>
      <p style={{ fontSize: 'var(--font-size-base)', lineHeight: 1.65, color: 'var(--text-secondary)', margin: '0 0 20px' }}>
        <code>&lt;InputController&gt;</code> with <code>&lt;Action&gt;</code> children maps
        pointer, wheel, keyboard, and pinch gestures to camera and canvas operations.
      </p>

      <CodeBlock
        language="tsx"
        code={`<Scene key="camera-explore">
  <InputController scope="canvas">
    <Action id="orbit" type="camera.orbit">
      <PointerMap event="drag" />
    </Action>
    <Action id="dolly" type="camera.dolly">
      <WheelMap />
    </Action>
    <Action id="reset" type="camera.reset">
      <KeyMap keyName="Escape" />
    </Action>
  </InputController>
  <Camera
    mode="orbit"
    target={[0, 1, 0]}
    azimuth={0} polar={1.0} distance={8}
    interaction={{ enabled: true }}
  />
</Scene>`}
      />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>Available action types</h2>
      <PropTable
        rows={[
          { name: 'camera.orbit',  type: 'InputActionType', description: 'Rotate camera around target (drag)' },
          { name: 'camera.dolly',  type: 'InputActionType', description: 'Zoom camera in/out (wheel/pinch)' },
          { name: 'camera.reset',  type: 'InputActionType', description: 'Reset camera to authored position' },
          { name: 'scene.next',    type: 'InputActionType', description: 'Advance to next scene' },
          { name: 'scene.prev',    type: 'InputActionType', description: 'Go to previous scene' },
          { name: 'diagram-canvas.move',   type: 'InputActionType', description: 'Pan diagram canvas' },
          { name: 'diagram-canvas.rotate', type: 'InputActionType', description: 'Rotate diagram canvas' },
        ]}
      />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>Live Demo: drag to orbit</h2>
      <InputActionsDemo />
    </DocPanel>
  );
}

export function SceneInputActions(): JSX.Element {
  return (
    <Scene key="scene-input-actions" id="scene-input-actions">
      <ProgressManager scrollUnits={3200} fn={DWELL_FN} />
      <Camera mode="world" position={[2, 2, 8]} target={[0, 1, 0]} fov={44} />
      <Background color="#0d1210" />
      <Lighting>
        <Ambient color="#22ff88" intensity={0.3} />
        <Directional color="#44ffaa" intensity={1.5} position={[4, 9, -2]} />
      </Lighting>

      <DemoProgressProvider startAt={0.25}>
        <InputActionsContent />
      </DemoProgressProvider>
    </Scene>
  );
}

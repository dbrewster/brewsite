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

function ApiReferenceContent(): JSX.Element {
  return (
    <DocPanel slideInBy={0.3}>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', margin: '0 0 8px', fontWeight: 700 }}>API Reference</h1>
      <p style={{ fontSize: 'var(--font-size-base)', lineHeight: 1.65, color: 'var(--text-secondary)', margin: '0 0 20px' }}>
        Complete reference for all public exports from <code>@brewsite/core</code>.
      </p>

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '0 0 10px' }}>Player / Layout</h2>
      <CodeBlock language="typescript" code={`import {
  ScenePlayer, EngineProvider, SceneCanvas, EngineOverlayHost,
  ScrollCaptureSection, EngineInputRegion,
} from '@brewsite/core';`} />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>Scene DSL</h2>
      <CodeBlock language="typescript" code={`import {
  Scene, ProgressManager,
  Camera,
  Lighting, Ambient, Directional, Point, GlowPoint, Spot,
  LightStrand, Wave, Circle, Rectangle, Panel,
  Background,
  Floor, FloorMirror, FloorPhysical,
  Environment, EnvironmentCube,
  Label,
} from '@brewsite/core';`} />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>Input DSL</h2>
      <CodeBlock language="typescript" code={`import {
  InputController, Action, PointerMap, WheelMap, KeyMap, PinchMap,
} from '@brewsite/core';`} />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>Hooks</h2>
      <CodeBlock language="typescript" code={`import {
  useEngineState, useCurrentScene, useSceneProgress,
  useSceneEngineState, useSceneEngineContext,
  useSceneRuntime,
} from '@brewsite/core';`} />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>Utilities</h2>
      <CodeBlock language="typescript" code={`import { createDefaultWidgetRegistry } from '@brewsite/core';

// HUD animation presets
import { Fade, MidFade, SlideUp, SlideDown, ScrollOn, ScrollOff } from '@brewsite/core/hud/animejs';`} />
    </DocPanel>
  );
}

export function SceneApiReference(): JSX.Element {
  return (
    <Scene key="scene-api-reference" id="scene-api-reference">
      <ProgressManager scrollUnits={2400} fn={DWELL_FN} />
      <Camera mode="world" position={[0, 2, 8]} target={[0, 1, 0]} fov={44} />
      <Background color="#08100e" />
      <Lighting>
        <Ambient color="#44ff88" intensity={0.3} />
        <Directional color="#ccffaa" intensity={1.3} position={[3, 10, 4]} />
      </Lighting>

      <ApiReferenceContent />
    </Scene>
  );
}

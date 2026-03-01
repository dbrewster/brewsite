import { JSX } from 'react';
import {
  Scene,
  Camera,
  Lighting,
  Ambient,
  Directional,
  Background,
  Floor,
  FloorPhysical,
  ProgressManager,
} from '@brewsite/core';
import { DWELL_FN } from '../../sceneUtils';
import { DocPanel } from '../../../components/content/DocPanel';
import { DemoProgressProvider, useDemoProgress } from '../../../components/content/DemoProgressProvider';
import { InlineDemo } from '../../../components/demo/InlineDemo';
import { CodeBlock } from '../../../components/ui/CodeBlock';
import { PropTable } from '../../../components/ui/PropTable';

function CameraOrbitDemoScene(): JSX.Element {
  const demoProgress = useDemoProgress();
  return (
    <InlineDemo controlledProgress={demoProgress} height={280}>
      <Scene key="cam-d1" id="cam-d1">
        <Camera mode="orbit" target={[0, 0, 0]} azimuth={0.0} polar={1.2} distance={8} />
        <Lighting><Ambient color="#2244ff" intensity={0.5} /><Directional color="#88ccff" intensity={1.6} position={[-2, 8, 5]} /></Lighting>
        <Background color="#080e18" />
        <Floor enabled><FloorPhysical opacity={0.4} metalness={0.5} roughness={0.5} /></Floor>
      </Scene>
      <Scene key="cam-d2" id="cam-d2">
        <Camera mode="orbit" target={[0, 0, 0]} azimuth={2.0} polar={0.6} distance={5} />
        <Lighting><Ambient color="#4422ff" intensity={0.6} /><Directional color="#aabbff" intensity={1.8} position={[4, 10, 2]} /></Lighting>
        <Background color="#08080e" />
      </Scene>
    </InlineDemo>
  );
}

function CameraContent(): JSX.Element {
  return (
    <DocPanel slideInBy={0.25}>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', margin: '0 0 8px', fontWeight: 700 }}>Camera</h1>
      <p style={{ fontSize: 'var(--font-size-base)', lineHeight: 1.65, color: 'var(--text-secondary)', margin: '0 0 20px' }}>
        The <code>&lt;Camera&gt;</code> element controls the Three.js PerspectiveCamera. The{' '}
        <code>mode</code> discriminant determines which props are valid.
      </p>

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '0 0 10px' }}>World mode</h2>
      <CodeBlock
        language="tsx"
        code={`<Camera
  mode="world"
  position={[0, 2, 8]}   // [x, y, z] in world units
  target={[0, 1, 0]}     // look-at point
  fov={45}               // field of view in degrees
  near={0.1}
  far={1000}
  exposure={1.2}         // tone mapping exposure
/>`}
      />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>Orbit mode</h2>
      <CodeBlock
        language="tsx"
        code={`<Camera
  mode="orbit"
  target={[0, 0, 0]}     // pivot point
  azimuth={0.5}          // horizontal angle in radians
  polar={1.2}            // vertical angle from equator
  distance={6}           // distance from target
  fov={50}
/>`}
      />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>Common props</h2>
      <PropTable
        rows={[
          { name: 'mode',     type: "'world' | 'orbit' | 'fitBotHeight' | 'fitFloorDepth'", required: true, description: 'Camera positioning mode' },
          { name: 'fov',      type: 'number', defaultValue: '45', description: 'Field of view in degrees' },
          { name: 'near',     type: 'number', defaultValue: '0.1', description: 'Near clipping plane' },
          { name: 'far',      type: 'number', defaultValue: '1000', description: 'Far clipping plane' },
          { name: 'exposure', type: 'number', defaultValue: '1.0', description: 'Tone mapping exposure (WebGLRenderer)' },
        ]}
      />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>Live Demo: Orbit Mode</h2>
      <CameraOrbitDemoScene />
    </DocPanel>
  );
}

export function SceneCamera(): JSX.Element {
  return (
    <Scene key="scene-camera" id="scene-camera">
      <ProgressManager scrollUnits={3200} fn={DWELL_FN} />
      <Camera mode="world" position={[-3, 2, 7]} target={[0, 1, 0]} fov={45} />
      <Background color="#0a1220" />
      <Lighting>
        <Ambient color="#2244ff" intensity={0.5} />
        <Directional color="#88ccff" intensity={1.6} position={[-2, 8, 5]} />
      </Lighting>
      <Floor enabled>
        <FloorPhysical opacity={0.4} metalness={0.5} roughness={0.5} />
      </Floor>

      <DemoProgressProvider startAt={0.25}>
        <CameraContent />
      </DemoProgressProvider>
    </Scene>
  );
}

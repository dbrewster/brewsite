import { JSX } from 'react';
import {
  Scene,
  Camera,
  Lighting,
  Ambient,
  Directional,
  Background,
  Floor,
  FloorMirror,
  FloorPhysical,
  ProgressManager,
} from '@brewsite/core';
import { DWELL_FN } from '../../sceneUtils';
import { DocPanel } from '../../../components/content/DocPanel';
import { CodeBlock } from '../../../components/ui/CodeBlock';
import { PropTable } from '../../../components/ui/PropTable';

function FloorContent(): JSX.Element {
  return (
    <DocPanel slideInBy={0.3}>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', margin: '0 0 8px', fontWeight: 700 }}>Floor</h1>
      <p style={{ fontSize: 'var(--font-size-base)', lineHeight: 1.65, color: 'var(--text-secondary)', margin: '0 0 20px' }}>
        The <code>&lt;Floor&gt;</code> element renders a horizontal ground plane. It accepts either
        a <code>&lt;FloorMirror&gt;</code> child (reflective) or a{' '}
        <code>&lt;FloorPhysical&gt;</code> child (PBR material).
      </p>

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '0 0 10px' }}>Mirror reflection</h2>
      <CodeBlock
        language="tsx"
        code={`<Floor enabled position={[0, 0, 0]}>
  <FloorMirror
    mirrorColor="#ffe9c4"
    mirrorOpacity={0.3}
    mirrorResolution={1024}
    mirrorEnvironmentIntensity={0.7}
    mirrorUseEnvironmentBackground
  />
</Floor>`}
      />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>Physical material</h2>
      <CodeBlock
        language="tsx"
        code={`<Floor enabled>
  <FloorPhysical
    color="#222"
    roughness={0.8}
    metalness={0.1}
    opacity={0.6}
  />
</Floor>`}
      />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>FloorMirror props</h2>
      <PropTable
        rows={[
          { name: 'mirrorColor',       type: 'string',  description: 'Tint color for the reflection' },
          { name: 'mirrorOpacity',     type: 'number',  defaultValue: '0.3', description: 'Reflection intensity [0..1]' },
          { name: 'mirrorResolution',  type: 'number',  defaultValue: '512', description: 'Render texture resolution in pixels' },
          { name: 'mirrorClipBias',    type: 'number',  description: 'Clip bias to avoid z-fighting artifacts' },
        ]}
      />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>FloorPhysical props</h2>
      <PropTable
        rows={[
          { name: 'color',     type: 'string', defaultValue: '"#111"', description: 'Surface color' },
          { name: 'roughness', type: 'number', defaultValue: '0.8', description: 'Surface roughness [0..1]' },
          { name: 'metalness', type: 'number', defaultValue: '0.1', description: 'Metalness [0..1]' },
          { name: 'opacity',   type: 'number', defaultValue: '1', description: 'Transparency [0..1]' },
        ]}
      />
    </DocPanel>
  );
}

export function SceneFloor(): JSX.Element {
  return (
    <Scene key="scene-floor" id="scene-floor">
      <ProgressManager scrollUnits={2400} fn={DWELL_FN} />
      <Camera mode="world" position={[0, 3, 9]} target={[0, 0, 0]} fov={44} />
      <Background color="#0a1220" />
      <Lighting>
        <Ambient color="#2244ff" intensity={0.4} />
        <Directional color="#88ccff" intensity={1.8} position={[-1, 10, 4]} />
      </Lighting>
      <Floor enabled>
        <FloorMirror mirrorColor="#4488ff" mirrorOpacity={0.25} mirrorResolution={512} />
      </Floor>

      <FloorContent />
    </Scene>
  );
}

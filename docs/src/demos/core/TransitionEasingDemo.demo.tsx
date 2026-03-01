import { JSX, useState } from 'react';
import {
  Scene,
  Camera,
  Lighting,
  Ambient,
  Floor,
  FloorPhysical,
  type EasingName,
} from '@brewsite/core';
import { DemoScene } from '../shared/DemoScene';

export const CODE = `
// The transition prop on <Scene> controls the easing curve for the
// animated transition into that scene from the previous one.
<Scene key="start" id="start">
  <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
  <Lighting>
    <Ambient color="#ffffff" intensity={0.4} />
  </Lighting>
  <Floor enabled>
    <FloorPhysical opacity={0.6} metalness={0.4} roughness={0.6} />
  </Floor>
</Scene>

<Scene key="end" id="end" transition={{ easing: 'easeInOutCubic' }}>
  <Camera mode="world" position={[3, 3, 6]} target={[0, 0, 0]} />
  <Lighting>
    <Ambient color="#8855ff" intensity={0.6} />
  </Lighting>
  <Floor enabled>
    <FloorPhysical opacity={0.8} metalness={0.5} roughness={0.4} />
  </Floor>
</Scene>
`.trim();

const EASING_OPTIONS: EasingName[] = [
  'linear',
  'easeOutCubic',
  'easeOutExpo',
  'easeInOutSine',
  'easeInOutCubic',
];

export default function TransitionEasingDemo(): JSX.Element {
  const [selectedEasing, setSelectedEasing] = useState<EasingName>('easeInOutCubic');

  return (
    <div>
      <div className="easing-tabs" style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {EASING_OPTIONS.map((easing) => (
          <button
            key={easing}
            type="button"
            onClick={() => setSelectedEasing(easing)}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              borderRadius: 4,
              border: '1px solid',
              cursor: 'pointer',
              fontFamily: 'monospace',
              background: selectedEasing === easing ? '#3b82f6' : 'transparent',
              color: selectedEasing === easing ? '#ffffff' : '#94a3b8',
              borderColor: selectedEasing === easing ? '#3b82f6' : '#334155',
            }}
          >
            {easing}
          </button>
        ))}
      </div>
      <DemoScene key={selectedEasing} sceneCount={2}>
        <Scene key="start" id="start">
          <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
          <Lighting>
            <Ambient color="#ffffff" intensity={0.4} />
          </Lighting>
          <Floor enabled>
            <FloorPhysical opacity={0.6} metalness={0.4} roughness={0.6} />
          </Floor>
        </Scene>
        <Scene key="end" id="end" transition={{ easing: selectedEasing }}>
          <Camera mode="world" position={[3, 3, 6]} target={[0, 0, 0]} />
          <Lighting>
            <Ambient color="#8855ff" intensity={0.6} />
          </Lighting>
          <Floor enabled>
            <FloorPhysical opacity={0.8} metalness={0.5} roughness={0.4} />
          </Floor>
        </Scene>
      </DemoScene>
    </div>
  );
}

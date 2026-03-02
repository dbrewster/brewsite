import { JSX, useState } from 'react';
import {
  Scene,
  Camera,
  Lighting,
  Ambient,
  Floor,
  FloorPhysical,
  type TransitionWindow,
  TRANSITION_CROSSFADE,
  TRANSITION_SEQUENTIAL,
  TRANSITION_EXIT_FIRST,
  TRANSITION_CUT,
} from '@brewsite/core';
import { DemoScene } from '../shared/DemoScene';

export const CODE = `
// The transition prop on <Scene> controls the timing windows for the
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

<Scene key="end" id="end" transition={TRANSITION_SEQUENTIAL}>
  <Camera mode="world" position={[3, 3, 6]} target={[0, 0, 0]} />
  <Lighting>
    <Ambient color="#8855ff" intensity={0.6} />
  </Lighting>
  <Floor enabled>
    <FloorPhysical opacity={0.8} metalness={0.5} roughness={0.4} />
  </Floor>
</Scene>
`.trim();

type WindowOption = {
  label: string;
  value: TransitionWindow;
};

const WINDOW_OPTIONS: WindowOption[] = [
  { label: 'crossfade', value: TRANSITION_CROSSFADE },
  { label: 'sequential', value: TRANSITION_SEQUENTIAL },
  { label: 'exit-first', value: TRANSITION_EXIT_FIRST },
  { label: 'cut', value: TRANSITION_CUT },
];

export default function TransitionEasingDemo(): JSX.Element {
  const [selected, setSelected] = useState<WindowOption>(WINDOW_OPTIONS[0]!);

  return (
    <div>
      <div className="easing-tabs" style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {WINDOW_OPTIONS.map((opt) => (
          <button
            key={opt.label}
            type="button"
            onClick={() => setSelected(opt)}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              borderRadius: 4,
              border: '1px solid',
              cursor: 'pointer',
              fontFamily: 'monospace',
              background: selected.label === opt.label ? '#3b82f6' : 'transparent',
              color: selected.label === opt.label ? '#ffffff' : '#94a3b8',
              borderColor: selected.label === opt.label ? '#3b82f6' : '#334155',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <DemoScene key={selected.label} sceneCount={2}>
        <Scene key="start" id="start">
          <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
          <Lighting>
            <Ambient color="#ffffff" intensity={0.4} />
          </Lighting>
          <Floor enabled>
            <FloorPhysical opacity={0.6} metalness={0.4} roughness={0.6} />
          </Floor>
        </Scene>
        <Scene key="end" id="end" transition={selected.value}>
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

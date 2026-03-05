// TransitionEasingDemo: transition window selector using the ancestor EngineProvider.
import { useState, type ReactElement } from 'react';
import {
  type TransitionWindow,
  type SceneTransitionProp,
  SceneCanvas,
  EngineOverlayHost,
} from '@brewsite/core';

export const CODE = `
// The transition prop on <Scene> controls the timing of the animated transition.
// Use 'dissolve' (default), 'crossfade', or a raw TransitionWindow object.
<Scene key="start" id="start">
  <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
  <Lighting>
    <Ambient color="#ffffff" intensity={0.4} />
  </Lighting>
  <Floor enabled>
    <FloorPhysical opacity={0.6} metalness={0.4} roughness={0.6} />
  </Floor>
</Scene>

<Scene key="end" id="end" transition="dissolve">
  <Camera mode="world" position={[3, 3, 6]} target={[0, 0, 0]} />
  <Lighting>
    <Ambient color="#8855ff" intensity={0.6} />
  </Lighting>
</Scene>
`.trim();

type WindowOption = {
  label: string;
  value: SceneTransitionProp;
};

const WINDOW_OPTIONS: WindowOption[] = [
  { label: 'dissolve', value: 'dissolve' },
  { label: 'crossfade', value: 'crossfade' },
  { label: 'exit-first', value: { exit: [0, 0.6], enter: [0.4, 1] } as TransitionWindow },
  { label: 'sequential', value: { exit: [0, 0.4], enter: [0.6, 1] } as TransitionWindow },
];

// No DemoEngine wrapper — the engine is provided at DocsApp level.
// SceneCanvas reads from the ancestor EngineProvider via EngineContext.
export function TransitionEasingDemo(): ReactElement {
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
      <div style={{ height: 360, position: 'relative' }}>
        <SceneCanvas style={{ width: '100%', height: '100%' }} />
        <EngineOverlayHost />
      </div>
    </div>
  );
}

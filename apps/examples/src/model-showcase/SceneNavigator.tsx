// SceneNavigator.tsx — Floating scene info + prev/next buttons for the model showcase.

import type { JSX } from 'react';
import { useEngineState, useGoToScene } from '@brewsite/core';

const SCENE_LABELS: Record<string, string> = {
  'model-intro': '1 — Intro',
  'model-animation': '2 — Animation',
  'model-labels': '3 — Labels',
  'model-view': '4 — View',
  'model-carousel': '5 — Carousel',
};

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 24,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 100,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '8px 16px',
  borderRadius: 8,
  background: 'rgba(0,0,0,0.65)',
  backdropFilter: 'blur(8px)',
  color: '#fff',
  fontFamily: 'system-ui, sans-serif',
  fontSize: 13,
  userSelect: 'none',
  pointerEvents: 'auto',
};

const btnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.12)',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 4,
  color: '#fff',
  padding: '4px 10px',
  cursor: 'pointer',
  fontSize: 12,
};

export function SceneNavigator(): JSX.Element {
  const state = useEngineState();
  const goToScene = useGoToScene();
  const sceneId = state.sceneId ?? '';
  const label = SCENE_LABELS[sceneId] ?? sceneId;
  const idx = state.sceneIndex ?? 0;
  const total = Object.keys(SCENE_LABELS).length;

  return (
    <div style={containerStyle}>
      <button
        style={{ ...btnStyle, opacity: idx <= 0 ? 0.3 : 1 }}
        disabled={idx <= 0}
        onClick={() => goToScene(idx - 1)}
      >
        ← Prev
      </button>
      <span style={{ minWidth: 130, textAlign: 'center' }}>{label}</span>
      <button
        style={{ ...btnStyle, opacity: idx >= total - 1 ? 0.3 : 1 }}
        disabled={idx >= total - 1}
        onClick={() => goToScene(idx + 1)}
      >
        Next →
      </button>
      <span style={{ opacity: 0.5, fontSize: 11, marginLeft: 4 }}>scroll to navigate</span>
    </div>
  );
}

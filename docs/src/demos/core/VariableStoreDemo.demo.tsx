// VariableStoreDemo: reads scene state via useCurrentScene using the ancestor EngineProvider.
import type { ReactElement } from 'react';
import { useCurrentScene } from '@brewsite/core';

export const CODE = `
// useCurrentScene() reads the active scene id and index from the engine state.
function SceneInfoOverlay(): JSX.Element {
  const { id, index } = useCurrentScene();
  return (
    <div style={{
      position: 'absolute', top: 16, right: 16,
      background: 'rgba(0,0,0,0.5)', padding: '8px 14px',
      borderRadius: 6, color: '#fff', fontSize: 13, fontFamily: 'monospace'
    }}>
      scene: {id} ({index})
    </div>
  );
}
`.trim();

function SceneInfoOverlay(): ReactElement {
  const { id, index } = useCurrentScene();
  return (
    <div style={{
      position: 'absolute',
      top: 16,
      right: 16,
      background: 'rgba(0,0,0,0.5)',
      padding: '8px 14px',
      borderRadius: 6,
      color: '#fff',
      fontSize: 13,
      fontFamily: 'monospace',
    }}>
      scene: {id} ({index})
    </div>
  );
}

// No SceneCanvas — the global SceneCanvas in ScrollCaptureSection provides rendering.
// SceneInfoOverlay reads useCurrentScene() from the ancestor EngineProvider.
export function VariableStoreDemo(): ReactElement {
  return <SceneInfoOverlay />;
}

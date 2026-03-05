// VariableStoreDemo: reads scene state via useCurrentScene using the ancestor EngineProvider.
import type { ReactElement } from 'react';
import {
  useCurrentScene,
  SceneCanvas,
  EngineOverlayHost,
} from '@brewsite/core';

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

// No DemoEngine wrapper — the engine is provided at DocsApp level.
// SceneCanvas reads from the ancestor EngineProvider via EngineContext.
export function VariableStoreDemo(): ReactElement {
  return (
    <>
      <SceneCanvas style={{ width: '100%', height: '100%' }} />
      <EngineOverlayHost />
      <SceneInfoOverlay />
    </>
  );
}

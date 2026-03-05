// HudOverlayDemo: HTML overlay content in scene transitions using the ancestor EngineProvider.
import type { ReactElement } from 'react';
import { SceneCanvas, EngineOverlayHost } from '@brewsite/core';

export const CODE = `
// HTML children inside <Scene> become overlay content rendered above the 3D canvas.
<Scene key="s1" id="s1">
  <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
  <div style={{ position: 'absolute', top: 24, left: 24, color: '#ffffff', fontSize: 20, fontWeight: 700 }}>
    Scene One
  </div>
</Scene>

<Scene key="s2" id="s2">
  <div style={{ position: 'absolute', top: 24, left: 24, color: '#7bb3ff', fontSize: 20, fontWeight: 700 }}>
    Scene Two — Overlay Active
  </div>
  <div style={{ position: 'absolute', top: 56, left: 24, color: '#aaaacc', fontSize: 14 }}>
    Text overlays appear on scene transition
  </div>
</Scene>
`.trim();

// No DemoEngine wrapper — the engine is provided at DocsApp level.
// SceneCanvas reads from the ancestor EngineProvider via EngineContext.
export function HudOverlayDemo(): ReactElement {
  return (
    <>
      <SceneCanvas style={{ width: '100%', height: '100%' }} />
      <EngineOverlayHost />
    </>
  );
}

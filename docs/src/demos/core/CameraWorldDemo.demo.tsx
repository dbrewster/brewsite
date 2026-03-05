// CameraWorldDemo: world-space camera positions across three scenes using the ancestor EngineProvider.
import type { ReactElement } from 'react';
import { SceneCanvas, EngineOverlayHost } from '@brewsite/core';

export const CODE = `
// mode: 'world' gives explicit position + look-at target control per scene.
<Scene key="s1" id="s1">
  <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
</Scene>

<Scene key="s2" id="s2">
  <Camera mode="world" position={[-4, 3, 6]} target={[1, 0, 0]} />
</Scene>

<Scene key="s3" id="s3">
  <Camera mode="world" position={[0, 6, 4]} target={[0, 0, 0]} />
</Scene>
`.trim();

// No DemoEngine wrapper — the engine is provided at DocsApp level.
// SceneCanvas reads from the ancestor EngineProvider via EngineContext.
export function CameraWorldDemo(): ReactElement {
  return (
    <>
      <SceneCanvas style={{ width: '100%', height: '100%' }} />
      <EngineOverlayHost />
    </>
  );
}

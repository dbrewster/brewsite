// BasicSceneDemo: minimal scene with camera, lighting, and floor using the ancestor EngineProvider.
import type { ReactElement } from 'react';
import { SceneCanvas, EngineOverlayHost } from '@brewsite/core';

export const CODE = `
<Scene key="s1" id="s1">
  <Camera
    mode="world"
    position={[0, 2, 8]}
    target={[0, 0, 0]}
  />
  <Lighting>
    <Ambient color="#ffffff" intensity={0.4} />
    <Directional color="#ffffff" intensity={1.0} position={[5, 10, 5]} />
  </Lighting>
  <Floor enabled>
    <FloorPhysical opacity={0.6} metalness={0.4} roughness={0.6} />
  </Floor>
</Scene>
`.trim();

// No DemoEngine wrapper — the engine is provided at DocsApp level.
// SceneCanvas reads from the ancestor EngineProvider via EngineContext.
export function BasicSceneDemo(): ReactElement {
  return (
    <>
      <SceneCanvas style={{ width: '100%', height: '100%' }} />
      <EngineOverlayHost />
    </>
  );
}

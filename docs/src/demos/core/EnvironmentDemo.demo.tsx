// EnvironmentDemo: HDR environment vs. direct lighting comparison using the ancestor EngineProvider.
import type { ReactElement } from 'react';
import { SceneCanvas, EngineOverlayHost } from '@brewsite/core';

export const CODE = `
// Scene 1: no HDR environment — standard direct lighting only
<Scene key="no-env" id="no-env">
  <Camera mode="orbit" target={[0, 0, 0]} azimuth={0.3} polar={1.1} distance={7} />
  <Lighting>
    <Ambient color="#ffffff" intensity={0.8} />
    <Directional color="#ffffff" intensity={1.0} position={[5, 10, 5]} />
  </Lighting>
  <Floor enabled>
    <FloorPhysical opacity={0.3} metalness={0.3} roughness={0.7} />
  </Floor>
</Scene>

// Scene 2: with HDR environment — provides image-based lighting + reflections
<Scene key="with-env" id="with-env">
  <Environment enabled intensity={1.0}>
    <EnvironmentHdri url="/assets/envmaps/night.hdr" />
  </Environment>
  <Floor enabled>
    <FloorPhysical opacity={0.9} metalness={0.8} roughness={0.1} />
  </Floor>
</Scene>
`.trim();

// No DemoEngine wrapper — the engine is provided at DocsApp level.
// SceneCanvas reads from the ancestor EngineProvider via EngineContext.
export function EnvironmentDemo(): ReactElement {
  return (
    <>
      <SceneCanvas style={{ width: '100%', height: '100%' }} />
      <EngineOverlayHost />
    </>
  );
}

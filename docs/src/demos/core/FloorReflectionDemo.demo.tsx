// FloorReflectionDemo: floor surface variants (none, physical, mirror) using the ancestor EngineProvider.
import type { ReactElement } from 'react';
import { SceneCanvas, EngineOverlayHost } from '@brewsite/core';

export const CODE = `
// Scene 1: no floor surface
<Scene key="no-floor" id="no-floor">
  <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
  <Lighting>
    <Ambient color="#ffffff" intensity={0.5} />
    <Directional color="#aaddff" intensity={1.0} position={[5, 10, 5]} />
  </Lighting>
</Scene>

// Scene 2: subtle physical floor
<Scene key="subtle" id="subtle">
  <Floor enabled>
    <FloorPhysical opacity={0.3} metalness={0.2} roughness={0.8} />
  </Floor>
</Scene>

// Scene 3: reflective mirror floor
<Scene key="reflective" id="reflective">
  <Floor enabled>
    <FloorMirror mirrorOpacity={0.9} mirrorResolution={512} mirrorClipBias={0.003} />
  </Floor>
</Scene>
`.trim();

// No DemoEngine wrapper — the engine is provided at DocsApp level.
// SceneCanvas reads from the ancestor EngineProvider via EngineContext.
export function FloorReflectionDemo(): ReactElement {
  return (
    <>
      <SceneCanvas style={{ width: '100%', height: '100%' }} />
      <EngineOverlayHost />
    </>
  );
}

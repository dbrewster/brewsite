// BackgroundDemo: renders lighting and floor color scenes using the ancestor EngineProvider.
import type { ReactElement } from 'react';
import { SceneCanvas, EngineOverlayHost } from '@brewsite/core';

export const CODE = `
// <Background> accepts an imageUrl for image-based backgrounds.
// For solid color scenes, ambient light color strongly influences the visual tone.
<Scene key="deep-blue" id="deep-blue">
  <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
  <Lighting>
    <Ambient color="#4455ff" intensity={0.5} />
  </Lighting>
  <Floor enabled>
    <FloorPhysical opacity={0.5} metalness={0.5} roughness={0.5} />
  </Floor>
</Scene>

<Scene key="purple" id="purple">
  <Lighting>
    <Ambient color="#8844cc" intensity={0.5} />
  </Lighting>
</Scene>

<Scene key="teal" id="teal">
  <Lighting>
    <Ambient color="#44bbaa" intensity={0.5} />
  </Lighting>
</Scene>

<Scene key="dark-warm" id="dark-warm">
  <Lighting>
    <Ambient color="#ffaa44" intensity={0.5} />
  </Lighting>
</Scene>
`.trim();

// No DemoEngine wrapper — the engine is provided at DocsApp level.
// SceneCanvas reads from the ancestor EngineProvider via EngineContext.
export function BackgroundDemo(): ReactElement {
  return (
    <>
      <SceneCanvas style={{ width: '100%', height: '100%' }} />
      <EngineOverlayHost />
    </>
  );
}

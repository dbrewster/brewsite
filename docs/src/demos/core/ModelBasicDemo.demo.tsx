// ModelBasicDemo: GLTF model loading and basic positioning using the ancestor EngineProvider.
import type { ReactElement } from 'react';
import { SceneCanvas, EngineOverlayHost } from '@brewsite/core';

export const CODE = `
// <Model> takes a type matching a key in the asset manifest plus a unique id.
<Scene key="s1" id="s1">
  <Camera mode="world" position={[0, 1.5, 4]} target={[0, 0.9, 0]} />
  <Model type="MaleDummy" id="character" position={[0, 0, 0]} rotation={[0, 0, 0]}>
    <Playback>
      <Animation clipName="chat-relax-m" enabled clipRepeat />
    </Playback>
  </Model>
</Scene>

<Scene key="s2" id="s2">
  <Camera mode="orbit" target={[0, 0.9, 0]} azimuth={0.8} polar={1.3} distance={4} />
  <Model type="MaleDummy" id="character" position={[0, 0, 0]} rotation={[0, 1.2, 0]}>
    <Playback>
      <Animation clipName="chat-relax-m" enabled clipRepeat />
    </Playback>
  </Model>
</Scene>
`.trim();

// No DemoEngine wrapper — the engine is provided at DocsApp level.
// SceneCanvas reads from the ancestor EngineProvider via EngineContext.
export function ModelBasicDemo(): ReactElement {
  return (
    <>
      <SceneCanvas style={{ width: '100%', height: '100%' }} />
      <EngineOverlayHost />
    </>
  );
}

// InputActionsDemo: action-mapped camera interaction using the ancestor EngineProvider.
import type { ReactElement } from 'react';
import { SceneCanvas, EngineOverlayHost } from '@brewsite/core';

export const CODE = `
// <InputController> wires up action-mapped camera interactions for a scene.
<Scene key="scene" id="scene">
  <Camera
    mode="orbit"
    target={[0, 0, 0]}
    azimuth={0}
    polar={1.2}
    distance={6}
    interaction={{ enabled: true }}
  />
  <InputController>
    <Action id="orbit" type="camera.orbit">
      <PointerMap event="drag" button="left" />
    </Action>
    <Action id="dolly" type="camera.dolly">
      <WheelMap />
    </Action>
    <Action id="reset" type="camera.reset">
      <PointerMap event="click" button="right" />
    </Action>
  </InputController>
</Scene>
`.trim();

// No DemoEngine wrapper — the engine is provided at DocsApp level.
// SceneCanvas reads from the ancestor EngineProvider via EngineContext.
export function InputActionsDemo(): ReactElement {
  return (
    <>
      <SceneCanvas style={{ width: '100%', height: '100%' }} />
      <EngineOverlayHost />
    </>
  );
}

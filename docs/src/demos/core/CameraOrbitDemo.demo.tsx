// CameraOrbitDemo: orbital camera sweep across three scenes using the ancestor EngineProvider.
import type { ReactElement } from 'react';
import { SceneCanvas, EngineOverlayHost } from '@brewsite/core';

export const CODE = `
// mode: 'orbit' positions the camera spherically around a target.
<Scene key="s1" id="s1">
  <Camera mode="orbit" target={[0, 0, 0]} azimuth={0.0} polar={1.2} distance={8} />
</Scene>

<Scene key="s2" id="s2">
  <Camera mode="orbit" target={[0, 0, 0]} azimuth={1.5} polar={1.0} distance={6} />
</Scene>

<Scene key="s3" id="s3">
  <Camera mode="orbit" target={[0, 0, 0]} azimuth={3.0} polar={0.8} distance={8} />
</Scene>
`.trim();

// No DemoEngine wrapper — the engine is provided at DocsApp level.
// SceneCanvas reads from the ancestor EngineProvider via EngineContext.
export function CameraOrbitDemo(): ReactElement {
  return (
    <>
      <SceneCanvas style={{ width: '100%', height: '100%' }} />
      <EngineOverlayHost />
    </>
  );
}

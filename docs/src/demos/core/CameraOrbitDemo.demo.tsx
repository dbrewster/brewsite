// CameraOrbitDemo: scene defined in docs-scenes.tsx; global SceneCanvas provides rendering.

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

// No SceneCanvas — the global SceneCanvas in ScrollCaptureSection provides rendering.
export function CameraOrbitDemo(): null {
  return null;
}

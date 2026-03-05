// CameraWorldDemo: scene defined in docs-scenes.tsx; global SceneCanvas provides rendering.

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

// No SceneCanvas — the global SceneCanvas in ScrollCaptureSection provides rendering.
export function CameraWorldDemo(): null {
  return null;
}

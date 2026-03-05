// InputActionsDemo: scene defined in docs-scenes.tsx; global SceneCanvas provides rendering.

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

// No SceneCanvas — the global SceneCanvas in ScrollCaptureSection provides rendering.
export function InputActionsDemo(): null {
  return null;
}

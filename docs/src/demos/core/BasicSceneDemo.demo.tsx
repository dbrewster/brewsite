// BasicSceneDemo: scene defined in docs-scenes.tsx; global SceneCanvas provides rendering.

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

// No SceneCanvas — the global SceneCanvas in ScrollCaptureSection provides rendering.
export function BasicSceneDemo(): null {
  return null;
}

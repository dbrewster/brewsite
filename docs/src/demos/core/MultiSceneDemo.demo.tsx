// MultiSceneDemo: scene defined in docs-scenes.tsx; global SceneCanvas provides rendering.

export const CODE = `
<Scene key="s1" id="s1">
  <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
  <Lighting>
    <Ambient color="#ffffff" intensity={0.4} />
  </Lighting>
  <Floor enabled>
    <FloorPhysical opacity={0.6} metalness={0.4} roughness={0.6} />
  </Floor>
</Scene>

<Scene key="s2" id="s2">
  <Camera mode="orbit" target={[0, 0, 0]} azimuth={1.0} polar={1.2} distance={6} />
  <Lighting>
    <Ambient color="#8855ff" intensity={0.6} />
  </Lighting>
</Scene>

<Scene key="s3" id="s3">
  <Camera mode="world" position={[5, 3, 5]} target={[0, 0, 0]} />
  <Lighting>
    <Ambient color="#4488ff" intensity={0.5} />
  </Lighting>
</Scene>
`.trim();

// No SceneCanvas — the global SceneCanvas in ScrollCaptureSection provides rendering.
export function MultiSceneDemo(): null {
  return null;
}

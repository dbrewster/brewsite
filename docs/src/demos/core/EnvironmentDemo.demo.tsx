// EnvironmentDemo: scene defined in docs-scenes.tsx; global SceneCanvas provides rendering.

export const CODE = `
// Scene 1: no HDR environment — standard direct lighting only
<Scene key="no-env" id="no-env">
  <Camera mode="orbit" target={[0, 0, 0]} azimuth={0.3} polar={1.1} distance={7} />
  <Lighting>
    <Ambient color="#ffffff" intensity={0.8} />
    <Directional color="#ffffff" intensity={1.0} position={[5, 10, 5]} />
  </Lighting>
  <Floor enabled>
    <FloorPhysical opacity={0.3} metalness={0.3} roughness={0.7} />
  </Floor>
</Scene>

// Scene 2: with HDR environment — provides image-based lighting + reflections
<Scene key="with-env" id="with-env">
  <Environment enabled intensity={1.0}>
    <EnvironmentHdri url="/assets/envmaps/night.hdr" />
  </Environment>
  <Floor enabled>
    <FloorPhysical opacity={0.9} metalness={0.8} roughness={0.1} />
  </Floor>
</Scene>
`.trim();

// No SceneCanvas — the global SceneCanvas in ScrollCaptureSection provides rendering.
export function EnvironmentDemo(): null {
  return null;
}

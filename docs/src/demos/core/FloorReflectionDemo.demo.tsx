// FloorReflectionDemo: scene defined in docs-scenes.tsx; global SceneCanvas provides rendering.

export const CODE = `
// Scene 1: no floor surface
<Scene key="no-floor" id="no-floor">
  <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
  <Lighting>
    <Ambient color="#ffffff" intensity={0.5} />
    <Directional color="#aaddff" intensity={1.0} position={[5, 10, 5]} />
  </Lighting>
</Scene>

// Scene 2: subtle physical floor
<Scene key="subtle" id="subtle">
  <Floor enabled>
    <FloorPhysical opacity={0.3} metalness={0.2} roughness={0.8} />
  </Floor>
</Scene>

// Scene 3: reflective mirror floor
<Scene key="reflective" id="reflective">
  <Floor enabled>
    <FloorMirror mirrorOpacity={0.9} mirrorResolution={512} mirrorClipBias={0.003} />
  </Floor>
</Scene>
`.trim();

// No SceneCanvas — the global SceneCanvas in ScrollCaptureSection provides rendering.
export function FloorReflectionDemo(): null {
  return null;
}

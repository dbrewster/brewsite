// LightingDemo: scene defined in docs-scenes.tsx; global SceneCanvas provides rendering.

export const CODE = `
// Scene 1: ambient only
<Scene key="ambient" id="ambient">
  <Lighting>
    <Ambient color="#ffffff" intensity={0.6} />
  </Lighting>
</Scene>

// Scene 2: ambient + directional
<Scene key="directional" id="directional">
  <Lighting>
    <Ambient color="#ffffff" intensity={0.3} />
    <Directional color="#ffeedd" intensity={1.2} position={[5, 8, 5]} />
  </Lighting>
</Scene>

// Scene 3: cool blue lighting
<Scene key="blue" id="blue">
  <Lighting>
    <Ambient color="#2244bb" intensity={0.5} />
    <Directional color="#6699ff" intensity={1.0} position={[-5, 8, 5]} />
  </Lighting>
</Scene>

// Scene 4: warm golden lighting
<Scene key="warm" id="warm">
  <Lighting>
    <Ambient color="#ffaa33" intensity={0.4} />
    <Directional color="#ffddaa" intensity={1.5} position={[5, 10, 0]} />
  </Lighting>
</Scene>
`.trim();

// No SceneCanvas — the global SceneCanvas in ScrollCaptureSection provides rendering.
export function LightingDemo(): null {
  return null;
}

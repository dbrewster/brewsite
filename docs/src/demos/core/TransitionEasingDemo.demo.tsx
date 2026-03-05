// TransitionEasingDemo: the global SceneCanvas in ScrollCaptureSection provides rendering.
// The transition-easing scene is defined in docs-scenes.tsx (transition-start / transition-end).

export const CODE = `
// The transition prop on <Scene> controls the timing of the animated transition.
// Use 'dissolve' (default), 'crossfade', or a raw TransitionWindow object.
<Scene key="start" id="start">
  <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
  <Lighting>
    <Ambient color="#ffffff" intensity={0.4} />
  </Lighting>
  <Floor enabled>
    <FloorPhysical opacity={0.6} metalness={0.4} roughness={0.6} />
  </Floor>
</Scene>

<Scene key="end" id="end" transition="dissolve">
  <Camera mode="world" position={[3, 3, 6]} target={[0, 0, 0]} />
  <Lighting>
    <Ambient color="#8855ff" intensity={0.6} />
  </Lighting>
</Scene>
`.trim();

// No SceneCanvas — the global SceneCanvas in ScrollCaptureSection provides rendering.
export function TransitionEasingDemo(): null {
  return null;
}

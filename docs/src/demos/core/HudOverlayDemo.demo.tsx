// HudOverlayDemo: scene defined in docs-scenes.tsx; global SceneCanvas provides rendering.

export const CODE = `
// HTML children inside <Scene> become overlay content rendered above the 3D canvas.
<Scene key="s1" id="s1">
  <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
  <div style={{ position: 'absolute', top: 24, left: 24, color: '#ffffff', fontSize: 20, fontWeight: 700 }}>
    Scene One
  </div>
</Scene>

<Scene key="s2" id="s2">
  <div style={{ position: 'absolute', top: 24, left: 24, color: '#7bb3ff', fontSize: 20, fontWeight: 700 }}>
    Scene Two — Overlay Active
  </div>
  <div style={{ position: 'absolute', top: 56, left: 24, color: '#aaaacc', fontSize: 14 }}>
    Text overlays appear on scene transition
  </div>
</Scene>
`.trim();

// No SceneCanvas — the global SceneCanvas in ScrollCaptureSection provides rendering.
export function HudOverlayDemo(): null {
  return null;
}

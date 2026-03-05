// ModelAnimationDemo: scene defined in docs-scenes.tsx; global SceneCanvas provides rendering.

export const CODE = `
// Each scene declares a different animation clip on the same model instance.
// The runtime cross-fades between clips when transitioning between scenes.
<Scene key="relaxed" id="relaxed">
  <Camera mode="world" position={[0, 1.5, 4]} target={[0, 0.9, 0]} />
  <Model type="MaleDummy" id="character" position={[0, 0, 0]}>
    <Playback>
      <Animation clipName="chat-relax-m" enabled clipRepeat />
    </Playback>
  </Model>
</Scene>

<Scene key="active" id="active">
  <Camera mode="orbit" target={[0, 0.9, 0]} azimuth={0.4} polar={1.2} distance={4} />
  <Model type="MaleDummy" id="character" position={[0, 0, 0]}>
    <Playback>
      <Animation clipName="standing_chat_m_270753" enabled clipRepeat />
    </Playback>
  </Model>
</Scene>
`.trim();

// No SceneCanvas — the global SceneCanvas in ScrollCaptureSection provides rendering.
export function ModelAnimationDemo(): null {
  return null;
}

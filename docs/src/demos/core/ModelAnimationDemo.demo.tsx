import { JSX } from 'react';
import {
  Scene,
  Camera,
  Lighting,
  Ambient,
  Directional,
  Floor,
  FloorPhysical,
} from '@brewsite/core';
import { Model, Playback, Animation } from '@brewsite/model';
import { DemoScene } from '../shared/DemoScene';
import { createModelDemoWidgetSetup } from '../shared/demoSetup';

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

export default function ModelAnimationDemo(): JSX.Element {
  return (
    <DemoScene
      sceneCount={2}
      sceneDuration={3000}
      manifestUrl="/scene-manifest.json"
      plugins={createModelDemoWidgetSetup()}
    >
      <Scene key="relaxed" id="relaxed" >
        <Camera mode="world" position={[0, 1.5, 4]} target={[0, 0.9, 0]} />
        <Lighting>
          <Ambient color="#ffffff" intensity={0.5} />
          <Directional color="#aaddff" intensity={1.0} position={[5, 10, 5]} />
        </Lighting>
        <Floor enabled>
          <FloorPhysical opacity={0.5} metalness={0.4} roughness={0.6} />
        </Floor>
        <Model type="MaleDummy" id="character" position={[0, 0, 0]}>
          <Playback>
            <Animation clipName="chat-relax-m" enabled clipRepeat />
          </Playback>
        </Model>
      </Scene>

      <Scene key="active" id="active" >
        <Camera mode="orbit" target={[0, 0.9, 0]} azimuth={0.4} polar={1.2} distance={4} />
        <Lighting>
          <Ambient color="#ffffff" intensity={0.4} />
          <Directional color="#aaccff" intensity={0.8} position={[5, 10, 5]} />
        </Lighting>
        <Floor enabled>
          <FloorPhysical opacity={0.5} metalness={0.4} roughness={0.6} />
        </Floor>
        <Model type="MaleDummy" id="character" position={[0, 0, 0]}>
          <Playback>
            <Animation clipName="standing_chat_m_270753" enabled clipRepeat />
          </Playback>
        </Model>
      </Scene>
    </DemoScene>
  );
}

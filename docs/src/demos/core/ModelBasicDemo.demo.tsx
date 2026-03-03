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
// Model demos require widgetSetup={createModelDemoWidgetSetup()} on DemoScene.
// <Model> takes a type matching a key in the asset manifest plus a unique id.
// Animation clips are driven via <Playback> + <Animation> children.
<Scene key="s1" id="s1">
  <Camera mode="world" position={[0, 1.5, 4]} target={[0, 0.9, 0]} />
  <Model type="MaleDummy" id="character" position={[0, 0, 0]} rotation={[0, 0, 0]}>
    <Playback>
      <Animation clipName="chat-relax-m" enabled clipRepeat />
    </Playback>
  </Model>
  <Lighting>
    <Ambient color="#ffffff" intensity={0.5} />
    <Directional color="#aaddff" intensity={1.0} position={[5, 10, 5]} />
  </Lighting>
  <Floor enabled>
    <FloorPhysical opacity={0.5} metalness={0.3} roughness={0.6} />
  </Floor>
</Scene>

<Scene key="s2" id="s2">
  <Camera mode="orbit" target={[0, 0.9, 0]} azimuth={0.8} polar={1.3} distance={4} />
  <Model type="MaleDummy" id="character" position={[0, 0, 0]} rotation={[0, 1.2, 0]}>
    <Playback>
      <Animation clipName="chat-relax-m" enabled clipRepeat />
    </Playback>
  </Model>
</Scene>
`.trim();

export default function ModelBasicDemo(): JSX.Element {
  return (
    <DemoScene
      sceneCount={2}
      sceneDuration={3000}
      manifestUrl="/scene-manifest.json"
      plugins={createModelDemoWidgetSetup()}
    >
      <Scene key="s1" id="s1" >
        <Camera mode="world" position={[0, 1.5, 4]} target={[0, 0.9, 0]} />
        <Model type="MaleDummy" id="character" position={[0, 0, 0]} rotation={[0, 0, 0]}>
          <Playback>
            <Animation clipName="chat-relax-m" enabled clipRepeat />
          </Playback>
        </Model>
        <Lighting>
          <Ambient color="#ffffff" intensity={0.5} />
          <Directional color="#aaddff" intensity={1.0} position={[5, 10, 5]} />
        </Lighting>
        <Floor enabled>
          <FloorPhysical opacity={0.5} metalness={0.3} roughness={0.6} />
        </Floor>
      </Scene>

      <Scene key="s2" id="s2" >
        <Camera mode="orbit" target={[0, 0.9, 0]} azimuth={0.8} polar={1.3} distance={4} />
        <Model type="MaleDummy" id="character" position={[0, 0, 0]} rotation={[0, 1.2, 0]}>
          <Playback>
            <Animation clipName="chat-relax-m" enabled clipRepeat />
          </Playback>
        </Model>
        <Lighting>
          <Ambient color="#ffffff" intensity={0.4} />
          <Directional color="#aaddff" intensity={0.8} position={[5, 10, 5]} />
        </Lighting>
        <Floor enabled>
          <FloorPhysical opacity={0.4} metalness={0.3} roughness={0.6} />
        </Floor>
      </Scene>
    </DemoScene>
  );
}

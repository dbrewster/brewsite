import { JSX } from 'react';
import {
  Scene,
  Camera,
  Lighting,
  Ambient,
  Floor,
  FloorPhysical,
} from '@brewsite/core';
import { DemoScene } from '../shared/DemoScene';

export const CODE = `
// <Background> accepts an imageUrl for image-based backgrounds.
// For solid color scenes, ambient light color strongly influences the visual tone.
// Each scene here demonstrates a distinct color palette via ambient lighting.
<Scene key="deep-blue">
  <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
  <Lighting>
    <Ambient color="#4455ff" intensity={0.5} />
  </Lighting>
  <Floor enabled>
    <FloorPhysical opacity={0.5} metalness={0.5} roughness={0.5} />
  </Floor>
</Scene>

<Scene key="purple">
  <Lighting>
    <Ambient color="#8844cc" intensity={0.5} />
  </Lighting>
</Scene>

<Scene key="teal">
  <Lighting>
    <Ambient color="#44bbaa" intensity={0.5} />
  </Lighting>
</Scene>

<Scene key="dark-warm">
  <Lighting>
    <Ambient color="#ffaa44" intensity={0.5} />
  </Lighting>
</Scene>
`.trim();

export default function BackgroundDemo(): JSX.Element {
  return (
    <DemoScene sceneCount={4}>
      <Scene key="deep-blue">
        <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
        <Lighting>
          <Ambient color="#4455ff" intensity={0.5} />
        </Lighting>
        <Floor enabled>
          <FloorPhysical opacity={0.5} metalness={0.5} roughness={0.5} />
        </Floor>
      </Scene>

      <Scene key="purple">
        <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
        <Lighting>
          <Ambient color="#8844cc" intensity={0.5} />
        </Lighting>
        <Floor enabled>
          <FloorPhysical opacity={0.5} metalness={0.5} roughness={0.5} />
        </Floor>
      </Scene>

      <Scene key="teal">
        <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
        <Lighting>
          <Ambient color="#44bbaa" intensity={0.5} />
        </Lighting>
        <Floor enabled>
          <FloorPhysical opacity={0.5} metalness={0.5} roughness={0.5} />
        </Floor>
      </Scene>

      <Scene key="dark-warm">
        <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
        <Lighting>
          <Ambient color="#ffaa44" intensity={0.5} />
        </Lighting>
        <Floor enabled>
          <FloorPhysical opacity={0.5} metalness={0.5} roughness={0.5} />
        </Floor>
      </Scene>
    </DemoScene>
  );
}

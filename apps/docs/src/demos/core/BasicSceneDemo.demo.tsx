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
import { DemoScene } from '../shared/DemoScene';

export const CODE = `
<Scene key="s1">
  <Camera
    mode="world"
    position={[0, 2, 8]}
    target={[0, 0, 0]}
  />
  <Lighting>
    <Ambient color="#ffffff" intensity={0.4} />
    <Directional color="#ffffff" intensity={1.0} position={[5, 10, 5]} />
  </Lighting>
  <Floor enabled>
    <FloorPhysical opacity={0.6} metalness={0.4} roughness={0.6} />
  </Floor>
</Scene>
`.trim();

export default function BasicSceneDemo(): JSX.Element {
  return (
    <DemoScene sceneCount={1} height={360}>
      <Scene key="s1">
        <Camera
          mode="world"
          position={[0, 2, 8]}
          target={[0, 0, 0]}
        />
        <Lighting>
          <Ambient color="#ffffff" intensity={0.4} />
          <Directional color="#ffffff" intensity={1.0} position={[5, 10, 5]} />
        </Lighting>
        <Floor enabled>
          <FloorPhysical opacity={0.6} metalness={0.4} roughness={0.6} />
        </Floor>
      </Scene>
    </DemoScene>
  );
}

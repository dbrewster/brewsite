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
// mode: 'world' gives explicit position + look-at target control per scene.
<Scene key="s1">
  <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
</Scene>

<Scene key="s2">
  <Camera mode="world" position={[-4, 3, 6]} target={[1, 0, 0]} />
</Scene>

<Scene key="s3">
  <Camera mode="world" position={[0, 6, 4]} target={[0, 0, 0]} />
</Scene>
`.trim();

export default function CameraWorldDemo(): JSX.Element {
  return (
    <DemoScene sceneCount={3}>
      <Scene key="s1">
        <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
        <Lighting>
          <Ambient color="#ffffff" intensity={0.5} />
          <Directional color="#ffffff" intensity={1.0} position={[5, 10, 5]} />
        </Lighting>
        <Floor enabled>
          <FloorPhysical opacity={0.5} metalness={0.4} roughness={0.6} />
        </Floor>
      </Scene>

      <Scene key="s2">
        <Camera mode="world" position={[-4, 3, 6]} target={[1, 0, 0]} />
        <Lighting>
          <Ambient color="#ffffff" intensity={0.5} />
          <Directional color="#ffffff" intensity={1.0} position={[5, 10, 5]} />
        </Lighting>
        <Floor enabled>
          <FloorPhysical opacity={0.5} metalness={0.4} roughness={0.6} />
        </Floor>
      </Scene>

      <Scene key="s3">
        <Camera mode="world" position={[0, 6, 4]} target={[0, 0, 0]} />
        <Lighting>
          <Ambient color="#ffffff" intensity={0.5} />
          <Directional color="#ffffff" intensity={1.0} position={[5, 10, 5]} />
        </Lighting>
        <Floor enabled>
          <FloorPhysical opacity={0.5} metalness={0.4} roughness={0.6} />
        </Floor>
      </Scene>
    </DemoScene>
  );
}

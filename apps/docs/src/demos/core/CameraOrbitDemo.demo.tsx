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
// mode: 'orbit' positions the camera spherically around a target.
// azimuth = horizontal angle (radians), polar = vertical angle, distance = radius.
<Scene key="s1" id="s1">
  <Camera
    mode="orbit"
    target={[0, 0, 0]}
    azimuth={0.0}
    polar={1.2}
    distance={8}
  />
</Scene>

<Scene key="s2" id="s2">
  <Camera
    mode="orbit"
    target={[0, 0, 0]}
    azimuth={1.5}
    polar={1.0}
    distance={6}
  />
</Scene>

<Scene key="s3" id="s3">
  <Camera
    mode="orbit"
    target={[0, 0, 0]}
    azimuth={3.0}
    polar={0.8}
    distance={8}
  />
</Scene>
`.trim();

export default function CameraOrbitDemo(): JSX.Element {
  return (
    <DemoScene sceneCount={3}>
      <Scene key="s1" id="s1">
        <Camera
          mode="orbit"
          target={[0, 0, 0]}
          azimuth={0.0}
          polar={"1.2rad"}
          distance={8}
        />
        <Lighting>
          <Ambient color="#ffffff" intensity={0.5} />
          <Directional color="#ffffff" intensity={1.0} position={[5, 10, 5]} />
        </Lighting>
        <Floor enabled>
          <FloorPhysical opacity={0.5} metalness={0.5} roughness={0.5} />
        </Floor>
      </Scene>

      <Scene key="s2" id="s2">
        <Camera
          mode="orbit"
          target={[0, 0, 0]}
          azimuth={"1.5rad"}
          polar={"1rad"}
          distance={6}
        />
        <Lighting>
          <Ambient color="#ffffff" intensity={0.5} />
          <Directional color="#ffffff" intensity={1.0} position={[5, 10, 5]} />
        </Lighting>
        <Floor enabled>
          <FloorPhysical opacity={0.5} metalness={0.5} roughness={0.5} />
        </Floor>
      </Scene>

      <Scene key="s3" id="s3">
        <Camera
          mode="orbit"
          target={[0, 0, 0]}
          azimuth={"3rad"}
          polar={"0.8rad"}
          distance={8}
        />
        <Lighting>
          <Ambient color="#ffffff" intensity={0.5} />
          <Directional color="#ffffff" intensity={1.0} position={[5, 10, 5]} />
        </Lighting>
        <Floor enabled>
          <FloorPhysical opacity={0.5} metalness={0.5} roughness={0.5} />
        </Floor>
      </Scene>
    </DemoScene>
  );
}

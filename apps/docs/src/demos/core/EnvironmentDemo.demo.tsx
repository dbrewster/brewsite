import { JSX } from 'react';
import {
  Scene,
  Camera,
  Lighting,
  Ambient,
  Directional,
  Floor,
  FloorPhysical,
  Environment,
  EnvironmentHdri,
} from '@brewsite/core';
import { DemoScene } from '../shared/DemoScene';

export const CODE = `
// Scene 1: no HDR environment — standard direct lighting only
<Scene key="no-env" id="no-env">
  <Camera mode="orbit" target={[0, 0, 0]} azimuth={0.3} polar={1.1} distance={7} />
  <Lighting>
    <Ambient color="#ffffff" intensity={0.8} />
    <Directional color="#ffffff" intensity={1.0} position={[5, 10, 5]} />
  </Lighting>
  <Floor enabled>
    <FloorPhysical opacity={0.3} metalness={0.3} roughness={0.7} />
  </Floor>
</Scene>

// Scene 2: with HDR environment — provides image-based lighting + reflections
// Replace the url with the path to your HDR environment map file.
<Scene key="with-env" id="with-env">
  <Environment enabled intensity={1.0}>
    <EnvironmentHdri url="/assets/envmaps/night.hdr" />
  </Environment>
  <Floor enabled>
    <FloorPhysical opacity={0.9} metalness={0.8} roughness={0.1} />
  </Floor>
</Scene>
`.trim();

export default function EnvironmentDemo(): JSX.Element {
  return (
    <DemoScene sceneCount={2}>
      <Scene key="no-env" id="no-env">
        <Camera mode="orbit" target={[0, 0, 0]} azimuth={"0.3rad"} polar={"1.1rad"} distance={7} />
        <Lighting>
          <Ambient color="#ffffff" intensity={0.8} />
          <Directional color="#ffffff" intensity={1.0} position={[5, 10, 5]} />
        </Lighting>
        <Floor enabled>
          <FloorPhysical opacity={0.3} metalness={0.3} roughness={0.7} />
        </Floor>
      </Scene>

      <Scene key="with-env" id="with-env">
        <Camera mode="orbit" target={[0, 0, 0]} azimuth={"0.8rad"} polar={"1rad"} distance={7} />
        <Lighting>
          <Ambient color="#ffffff" intensity={0.5} />
          <Directional color="#aaccff" intensity={0.8} position={[5, 10, 5]} />
        </Lighting>
        <Environment enabled intensity={1.0}>
          <EnvironmentHdri url="/assets/envmaps/night.hdr" />
        </Environment>
        <Floor enabled>
          <FloorPhysical opacity={0.9} metalness={0.8} roughness={0.1} />
        </Floor>
      </Scene>
    </DemoScene>
  );
}

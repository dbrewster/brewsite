import { JSX } from 'react';
import {
  Scene,
  Camera,
  Lighting,
  Ambient,
  Directional,
  Background,
  ProgressManager,
} from '@brewsite/core';
import { DWELL_FN } from '../../sceneUtils';

export function SceneEnvironmentPanel(): JSX.Element {
  return (
    <>
      {/* Base state: camera 2 units further back — start of panel scroll window */}
      <Scene id="scene-environment-base">
        <Camera mode="orbit" target={[0, 0, 0]} azimuth={"0.3rad"} polar={"1.1rad"} distance={10} />
        <Background color="#0a1220" />
        <Lighting>
          <Ambient color="#2244ff" intensity={0.4} />
          <Directional color="#88ccff" intensity={1.6} position={[2, 9, 5]} />
        </Lighting>
      </Scene>

      {/* Arrived state: reading position — end of panel scroll window */}
      <Scene id="scene-environment">
        <ProgressManager fn={DWELL_FN} />
        <Camera mode="orbit" target={[0, 0, 0]} azimuth={"0.3rad"} polar={"1.1rad"} distance={8} />
        <Background color="#0a1220" />
        <Lighting>
          <Ambient color="#2244ff" intensity={0.4} />
          <Directional color="#88ccff" intensity={1.6} position={[2, 9, 5]} />
        </Lighting>
      </Scene>
    </>
  );
}

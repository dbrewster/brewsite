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

export function SceneCustomWidgetPanel(): JSX.Element {
  return (
    <>
      {/* Base state: camera 2 units further back — start of panel scroll window */}
      <Scene id="scene-custom-widget-base">
        <Camera mode="orbit" target={[0, 0, 0]} azimuth={"0.3rad"} polar={"1rad"} distance={10} />
        <Background color="#10080e" />
        <Lighting>
          <Ambient color="#cc44ff" intensity={0.4} />
          <Directional color="#ff88cc" intensity={1.6} position={[-2, 8, 5]} />
        </Lighting>
      </Scene>

      {/* Arrived state: reading position — end of panel scroll window */}
      <Scene id="scene-custom-widget">
        <ProgressManager fn={DWELL_FN} />
        <Camera mode="orbit" target={[0, 0, 0]} azimuth={"0.3rad"} polar={"1rad"} distance={8} />
        <Background color="#10080e" />
        <Lighting>
          <Ambient color="#cc44ff" intensity={0.4} />
          <Directional color="#ff88cc" intensity={1.6} position={[-2, 8, 5]} />
        </Lighting>
      </Scene>
    </>
  );
}

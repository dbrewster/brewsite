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

export function SceneInstallationPanel(): JSX.Element {
  return (
    <>
      {/* Base state: camera 2 units further back — start of panel scroll window */}
      <Scene id="scene-installation-base">
        <Camera mode="world" position={[1, 2, 10]} target={[0, 0.8, 0]} fov={40} />
        <Background color="#0d0f1a" />
        <Lighting>
          <Ambient color="#4466ff" intensity={0.4} />
          <Directional color="#ffffff" intensity={1.6} position={[2, 10, 7]} />
        </Lighting>
      </Scene>

      {/* Arrived state: reading position — end of panel scroll window */}
      <Scene id="scene-installation">
        <ProgressManager fn={DWELL_FN} />
        <Camera mode="world" position={[1, 2, 8]} target={[0, 0.8, 0]} fov={40} />
        <Background color="#0d0f1a" />
        <Lighting>
          <Ambient color="#4466ff" intensity={0.4} />
          <Directional color="#ffffff" intensity={1.6} position={[2, 10, 7]} />
        </Lighting>
      </Scene>
    </>
  );
}

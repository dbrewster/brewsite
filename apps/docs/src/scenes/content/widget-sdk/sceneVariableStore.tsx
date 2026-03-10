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

export function SceneVariableStorePanel(): JSX.Element {
  return (
    <>
      {/* Base state: camera 2 units further back — start of panel scroll window */}
      <Scene id="scene-variable-store-base">
        <Camera mode="world" position={[2, 2, 10]} target={[0, 1, 0]} fov={44} />
        <Background color="#10080e" />
        <Lighting>
          <Ambient color="#cc44ff" intensity={0.4} />
          <Directional color="#ff88cc" intensity={1.6} position={[-1, 8, 5]} />
        </Lighting>
      </Scene>

      {/* Arrived state: reading position — end of panel scroll window */}
      <Scene id="scene-variable-store">
        <ProgressManager fn={DWELL_FN} />
        <Camera mode="world" position={[2, 2, 8]} target={[0, 1, 0]} fov={44} />
        <Background color="#10080e" />
        <Lighting>
          <Ambient color="#cc44ff" intensity={0.4} />
          <Directional color="#ff88cc" intensity={1.6} position={[-1, 8, 5]} />
        </Lighting>
      </Scene>
    </>
  );
}

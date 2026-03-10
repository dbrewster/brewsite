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

export function SceneHooksPanel(): JSX.Element {
  return (
    <>
      {/* Base state: camera 2 units further back — start of panel scroll window */}
      <Scene id="scene-hooks-base">
        <Camera mode="world" position={[2, 2, 10]} target={[0, 1, 0]} fov={44} />
        <Background color="#0a0e18" />
        <Lighting>
          <Ambient color="#3388ff" intensity={0.5} />
          <Directional color="#ffffff" intensity={1.8} position={[2, 12, 5]} />
        </Lighting>
      </Scene>

      {/* Arrived state: reading position — end of panel scroll window */}
      <Scene id="scene-hooks">
        <ProgressManager fn={DWELL_FN} />
        <Camera mode="world" position={[2, 2, 8]} target={[0, 1, 0]} fov={44} />
        <Background color="#0a0e18" />
        <Lighting>
          <Ambient color="#3388ff" intensity={0.5} />
          <Directional color="#ffffff" intensity={1.8} position={[2, 12, 5]} />
        </Lighting>
      </Scene>
    </>
  );
}

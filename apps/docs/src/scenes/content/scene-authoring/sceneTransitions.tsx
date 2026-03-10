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

export function SceneTransitionsPanel(): JSX.Element {
  return (
    <>
      {/* Base state: camera 2 units further back — start of panel scroll window */}
      <Scene id="scene-transitions-base">
        <Camera mode="world" position={[1, 2, 10]} target={[0, 0.8, 0]} fov={42} />
        <Background color="#0f0d1a" />
        <Lighting>
          <Ambient color="#8855ff" intensity={0.3} />
          <Directional color="#cc88ff" intensity={1.4} position={[2, 10, 6]} />
        </Lighting>
      </Scene>

      {/* Arrived state: reading position — end of panel scroll window */}
      <Scene id="scene-transitions">
        <ProgressManager fn={DWELL_FN} />
        <Camera mode="world" position={[1, 2, 8]} target={[0, 0.8, 0]} fov={42} />
        <Background color="#0f0d1a" />
        <Lighting>
          <Ambient color="#8855ff" intensity={0.3} />
          <Directional color="#cc88ff" intensity={1.4} position={[2, 10, 6]} />
        </Lighting>
      </Scene>
    </>
  );
}

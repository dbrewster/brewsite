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

export function SceneHudPanel(): JSX.Element {
  return (
    <>
      {/* Base state: camera 2 units further back — start of panel scroll window */}
      <Scene id="scene-hud-base">
        <Camera mode="world" position={[0, 2, 10]} target={[0, 1, 0]} fov={"44deg"} />
        <Background color="#140a0a" />
        <Lighting>
          <Ambient color="#ff4444" intensity={0.3} />
          <Directional color="#ffaa44" intensity={1.6} position={[5, 8, 3]} />
        </Lighting>
      </Scene>

      {/* Arrived state: reading position — end of panel scroll window */}
      <Scene id="scene-hud">
        <ProgressManager fn={DWELL_FN} />
        <Camera mode="world" position={[0, 2, 8]} target={[0, 1, 0]} fov={"44deg"} />
        <Background color="#140a0a" />
        <Lighting>
          <Ambient color="#ff4444" intensity={0.3} />
          <Directional color="#ffaa44" intensity={1.6} position={[5, 8, 3]} />
        </Lighting>
      </Scene>
    </>
  );
}

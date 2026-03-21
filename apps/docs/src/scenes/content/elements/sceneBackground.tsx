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

export function SceneBackgroundPanel(): JSX.Element {
  return (
    <>
      {/* Base state: camera 2 units further back — start of panel scroll window */}
      <Scene id="scene-background-base">
        <Camera mode="world" position={[0, 2, 10]} target={[0, 1, 0]} fov={"44deg"} />
        <Background color="#0a1220" />
        <Lighting>
          <Ambient color="#2244ff" intensity={0.4} />
          <Directional color="#88ccff" intensity={1.6} position={[-1, 9, 5]} />
        </Lighting>
      </Scene>

      {/* Arrived state: reading position — end of panel scroll window */}
      <Scene id="scene-background">
        <ProgressManager fn={DWELL_FN} />
        <Camera mode="world" position={[0, 2, 8]} target={[0, 1, 0]} fov={"44deg"} />
        <Background color="#0a1220" />
        <Lighting>
          <Ambient color="#2244ff" intensity={0.4} />
          <Directional color="#88ccff" intensity={1.6} position={[-1, 9, 5]} />
        </Lighting>
      </Scene>
    </>
  );
}

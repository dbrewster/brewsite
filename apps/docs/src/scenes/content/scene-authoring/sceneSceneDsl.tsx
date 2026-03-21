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

export function SceneSceneDslPanel(): JSX.Element {
  return (
    <>
      {/* Base state: camera 2 units further back — start of panel scroll window */}
      <Scene id="scene-scene-dsl-base">
        <Camera mode="world" position={[0, 2, 10]} target={[0, 0.8, 0]} fov={"42deg"} />
        <Background color="#0f0d1a" />
        <Lighting>
          <Ambient color="#8855ff" intensity={0.3} />
          <Directional color="#cc88ff" intensity={1.4} position={[-4, 8, 4]} />
        </Lighting>
      </Scene>

      {/* Arrived state: reading position — end of panel scroll window */}
      <Scene id="scene-scene-dsl">
        <ProgressManager fn={DWELL_FN} />
        <Camera mode="world" position={[0, 2, 8]} target={[0, 0.8, 0]} fov={"42deg"} />
        <Background color="#0f0d1a" />
        <Lighting>
          <Ambient color="#8855ff" intensity={0.3} />
          <Directional color="#cc88ff" intensity={1.4} position={[-4, 8, 4]} />
        </Lighting>
      </Scene>
    </>
  );
}

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

export function SceneApiReferencePanel(): JSX.Element {
  return (
    <>
      {/* Base state: camera 2 units further back — start of panel scroll window */}
      <Scene id="scene-api-reference-base">
        <Camera mode="world" position={[0, 2, 10]} target={[0, 1, 0]} fov={44} />
        <Background color="#08100e" />
        <Lighting>
          <Ambient color="#44ff88" intensity={0.3} />
          <Directional color="#ccffaa" intensity={1.3} position={[3, 10, 4]} />
        </Lighting>
      </Scene>

      {/* Arrived state: reading position — end of panel scroll window */}
      <Scene id="scene-api-reference">
        <ProgressManager fn={DWELL_FN} />
        <Camera mode="world" position={[0, 2, 8]} target={[0, 1, 0]} fov={44} />
        <Background color="#08100e" />
        <Lighting>
          <Ambient color="#44ff88" intensity={0.3} />
          <Directional color="#ccffaa" intensity={1.3} position={[3, 10, 4]} />
        </Lighting>
      </Scene>
    </>
  );
}

import { JSX } from 'react';
import {
  Scene,
  Camera,
  Lighting,
  Ambient,
  Directional,
  Background,
  Floor,
  FloorPhysical,
  ProgressManager,
} from '@brewsite/core';
import { DWELL_FN } from '../../sceneUtils';

export function SceneQuickStartPanel(): JSX.Element {
  return (
    <>
      {/* Base state: camera 2 units further back — start of panel scroll window */}
      <Scene id="scene-quick-start-base">
        <Camera mode="world" position={[2, 2, 11]} target={[0, 0.8, 0]} fov={40} />
        <Background color="#0d0f1a" />
        <Lighting>
          <Ambient color="#4466ff" intensity={0.4} />
          <Directional color="#aaccff" intensity={1.4} position={[3, 10, 8]} />
        </Lighting>
        <Floor enabled>
          <FloorPhysical opacity={0.3} metalness={0.4} roughness={0.6} />
        </Floor>
      </Scene>

      {/* Arrived state: reading position — end of panel scroll window */}
      <Scene id="scene-quick-start">
        <ProgressManager fn={DWELL_FN} />
        <Camera mode="world" position={[2, 2, 9]} target={[0, 0.8, 0]} fov={40} />
        <Background color="#0d0f1a" />
        <Lighting>
          <Ambient color="#4466ff" intensity={0.4} />
          <Directional color="#aaccff" intensity={1.4} position={[3, 10, 8]} />
        </Lighting>
        <Floor enabled>
          <FloorPhysical opacity={0.3} metalness={0.4} roughness={0.6} />
        </Floor>
      </Scene>
    </>
  );
}

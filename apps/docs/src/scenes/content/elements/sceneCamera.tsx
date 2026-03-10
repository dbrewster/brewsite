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

export function SceneCameraPanel(): JSX.Element {
  return (
    <>
      {/* Base state: camera 2 units further back — start of panel scroll window */}
      <Scene id="scene-camera-base">
        <Camera mode="world" position={[-3, 2, 9]} target={[0, 1, 0]} fov={45} />
        <Background color="#0a1220" />
        <Lighting>
          <Ambient color="#2244ff" intensity={0.5} />
          <Directional color="#88ccff" intensity={1.6} position={[-2, 8, 5]} />
        </Lighting>
        <Floor enabled>
          <FloorPhysical opacity={0.4} metalness={0.5} roughness={0.5} />
        </Floor>
      </Scene>

      {/* Arrived state: reading position — end of panel scroll window */}
      <Scene id="scene-camera">
        <ProgressManager fn={DWELL_FN} />
        <Camera mode="world" position={[-3, 2, 7]} target={[0, 1, 0]} fov={45} />
        <Background color="#0a1220" />
        <Lighting>
          <Ambient color="#2244ff" intensity={0.5} />
          <Directional color="#88ccff" intensity={1.6} position={[-2, 8, 5]} />
        </Lighting>
        <Floor enabled>
          <FloorPhysical opacity={0.4} metalness={0.5} roughness={0.5} />
        </Floor>
      </Scene>
    </>
  );
}

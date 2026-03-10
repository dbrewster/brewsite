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

export function SceneWhatIsBrewSitePanel(): JSX.Element {
  return (
    <>
      {/* Base state: camera 2 units further back — start of panel scroll window */}
      <Scene id="scene-what-is-brewsite-base">
        <Camera mode="world" position={[0, 1.8, 10]} target={[0, 0.8, 0]} fov={40} />
        <Background color="#0d0f1a" />
        <Lighting>
          <Ambient color="#4466ff" intensity={0.4} />
          <Directional color="#ffffff" intensity={1.6} position={[4, 10, 6]} />
        </Lighting>
        <Floor enabled>
          <FloorPhysical opacity={0.35} metalness={0.4} roughness={0.6} />
        </Floor>
      </Scene>

      {/* Arrived state: reading position — end of panel scroll window */}
      <Scene id="scene-what-is-brewsite">
        <ProgressManager fn={DWELL_FN} />
        <Camera mode="world" position={[0, 1.8, 8]} target={[0, 0.8, 0]} fov={40} />
        <Background color="#0d0f1a" />
        <Lighting>
          <Ambient color="#4466ff" intensity={0.4} />
          <Directional color="#ffffff" intensity={1.6} position={[4, 10, 6]} />
        </Lighting>
        <Floor enabled>
          <FloorPhysical opacity={0.35} metalness={0.4} roughness={0.6} />
        </Floor>
      </Scene>
    </>
  );
}

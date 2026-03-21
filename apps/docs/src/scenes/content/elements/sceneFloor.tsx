import { JSX } from 'react';
import {
  Scene,
  Camera,
  Lighting,
  Ambient,
  Directional,
  Background,
  Floor,
  FloorMirror,
  ProgressManager,
} from '@brewsite/core';
import { DWELL_FN } from '../../sceneUtils';

export function SceneFloorPanel(): JSX.Element {
  return (
    <>
      {/* Base state: camera 2 units further back — start of panel scroll window */}
      <Scene id="scene-floor-base">
        <Camera mode="world" position={[0, 3, 11]} target={[0, 0, 0]} fov={"44deg"} />
        <Background color="#0a1220" />
        <Lighting>
          <Ambient color="#2244ff" intensity={0.4} />
          <Directional color="#88ccff" intensity={1.8} position={[-1, 10, 4]} />
        </Lighting>
        <Floor enabled>
          <FloorMirror mirrorColor="#4488ff" mirrorOpacity={0.25} mirrorResolution={512} />
        </Floor>
      </Scene>

      {/* Arrived state: reading position — end of panel scroll window */}
      <Scene id="scene-floor">
        <ProgressManager fn={DWELL_FN} />
        <Camera mode="world" position={[0, 3, 9]} target={[0, 0, 0]} fov={"44deg"} />
        <Background color="#0a1220" />
        <Lighting>
          <Ambient color="#2244ff" intensity={0.4} />
          <Directional color="#88ccff" intensity={1.8} position={[-1, 10, 4]} />
        </Lighting>
        <Floor enabled>
          <FloorMirror mirrorColor="#4488ff" mirrorOpacity={0.25} mirrorResolution={512} />
        </Floor>
      </Scene>
    </>
  );
}

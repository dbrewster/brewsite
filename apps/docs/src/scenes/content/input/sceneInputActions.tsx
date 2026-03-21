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

export function SceneInputActionsPanel(): JSX.Element {
  return (
    <>
      {/* Base state: camera 2 units further back — start of panel scroll window */}
      <Scene id="scene-input-actions-base">
        <Camera mode="world" position={[2, 2, 10]} target={[0, 1, 0]} fov={"44deg"} />
        <Background color="#0d1210" />
        <Lighting>
          <Ambient color="#22ff88" intensity={0.3} />
          <Directional color="#44ffaa" intensity={1.5} position={[4, 9, -2]} />
        </Lighting>
      </Scene>

      {/* Arrived state: reading position — end of panel scroll window */}
      <Scene id="scene-input-actions">
        <ProgressManager fn={DWELL_FN} />
        <Camera mode="world" position={[2, 2, 8]} target={[0, 1, 0]} fov={"44deg"} />
        <Background color="#0d1210" />
        <Lighting>
          <Ambient color="#22ff88" intensity={0.3} />
          <Directional color="#44ffaa" intensity={1.5} position={[4, 9, -2]} />
        </Lighting>
      </Scene>
    </>
  );
}

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

export function SceneConceptsPanel(): JSX.Element {
  return (
    <>
      {/* Base state: camera 2 units further back — start of panel scroll window */}
      <Scene id="scene-concepts-base">
        <Camera mode="world" position={[-1, 2, 10]} target={[0, 0.8, 0]} fov={"42deg"} />
        <Background color="#0d0f1a" />
        <Lighting>
          <Ambient color="#4466ff" intensity={0.4} />
          <Directional color="#aaccff" intensity={1.5} position={[-3, 10, 6]} />
        </Lighting>
      </Scene>

      {/* Arrived state: reading position — end of panel scroll window */}
      <Scene id="scene-concepts">
        <ProgressManager fn={DWELL_FN} />
        <Camera mode="world" position={[-1, 2, 8]} target={[0, 0.8, 0]} fov={"42deg"} />
        <Background color="#0d0f1a" />
        <Lighting>
          <Ambient color="#4466ff" intensity={0.4} />
          <Directional color="#aaccff" intensity={1.5} position={[-3, 10, 6]} />
        </Lighting>
      </Scene>
    </>
  );
}

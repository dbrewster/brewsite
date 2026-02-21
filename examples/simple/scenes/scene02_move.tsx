import { Scene, Lighting, Ambient, Directional } from '@brewsite/core';
import { Pose, PrimaryModel, PrimaryEyes, PrimaryNeck, PrimaryForearmRight } from '../generated/sceneDsl.generated';
import type { SceneDefinition } from '@brewsite/core';

export const scene02Move: SceneDefinition = {
  id: 'move-right',
  index: 1,
  getFrame: () => (
    <Scene id="move-right">
      <Lighting intensityScale={1}>
        <Ambient intensity={1.2} color="#ffffff" />
        <Directional intensity={2} color="#ffffff" position={[-20, 30, 40]} />
      </Lighting>
      <PrimaryModel
        position={[0, -12, 0]}
        rotation={[0, -Math.PI / 2 -.2, 0]}
        scale={0.2}
        metalness={.9}
        roughness={.1}
      >
        <PrimaryEyes color="#ff0000" opacity={1} />
        <PrimaryNeck color="#000000" opacity={1}/>
        <PrimaryForearmRight color="#00ff00" opacity={1}/>
      </PrimaryModel>
    </Scene>
  ),
};

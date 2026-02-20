import type { SceneDefinition } from '@brewsite/core';
import { Scene, Lighting, Ambient, Directional } from '@brewsite/core';
import { PrimaryModel } from '../generated/sceneDsl.generated';

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
        position={[18, -12, 0]}
        rotation={[0, Math.PI / 2, 0]}
        scale={0.2}
      />
    </Scene>
  ),
};

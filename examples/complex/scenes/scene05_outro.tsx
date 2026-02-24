import type { SceneDefinition } from '@brewsite/core';
import { Ambient, Background, Directional, Environment, Floor, Lighting, Scene } from '@brewsite/core';
import { backgrounds, sceneLighting } from './sceneAssets';

export const scene05Outro: SceneDefinition = {
  id: 'complex-outro',
  index: 4,
  getFrame: () => (
    <Scene id="complex-outro">
      <Background imageUrl={backgrounds.outro} opacity={1} cssSize="cover" cssPosition="center" />
      <Lighting intensityScale={1}>
        <Ambient intensity={sceneLighting.soft.ambient * 0.6} color="#d9e0ff" />
        <Directional intensity={sceneLighting.soft.directional * 0.6} color="#ffffff" position={sceneLighting.soft.direction} />
      </Lighting>
    </Scene>
  ),
};

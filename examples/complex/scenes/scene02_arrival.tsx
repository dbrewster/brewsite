import type { SceneDefinition } from '@brewsite/core';
import { Ambient, Background, Directional, Environment, Floor, Lighting, Scene } from '@brewsite/core';
import { Animation, BodyParts, Playback, Pose, Robot } from '../../generated/sceneDsl.generated';
import { backgrounds, sceneLighting } from './sceneAssets';

export const scene02Arrival: SceneDefinition = {
  id: 'complex-arrival',
  index: 1,
  getFrame: () => (
    <Scene id="complex-arrival">
      <Background imageUrl={backgrounds.reveal} opacity={1} cssSize="cover" cssPosition="center" />
      <Lighting intensityScale={1}>
        <Ambient intensity={sceneLighting.soft.ambient} color="#e6eeff" />
        <Directional intensity={sceneLighting.soft.directional} color="#ffffff" position={sceneLighting.soft.direction} />
      </Lighting>
      <Robot
        id="complex-robot"
        position={[-10, 0, -200]}
        rotation={[0, -Math.PI / 2, 0]}
        scale={0.18}
        metalness={0.85}
        roughness={0.18}
      >
        <BodyParts>
          <Robot.Eyes color="#7ffcff" opacity={1} />
          <Robot.Chest color="#223247" opacity={1} />
          <Robot.Neck color="#8f9bb3" opacity={1}>
            <Pose rotate={{ yawPct: 0.1, pitchPct: 0.08 }} />
          </Robot.Neck>
          <Robot.RightForeArm color="#ff3b30" opacity={1}>
          </Robot.RightForeArm>
          <Robot.LeftFoot>
            <Pose rotate={{ pitchPct: -0.3 }} />
          </Robot.LeftFoot>
          <Robot.RightFoot>
            <Pose rotate={{ pitchPct: -0.3 }} />
          </Robot.RightFoot>
        </BodyParts>
        <Playback>
          <Animation clipName="chat-relax-f" enabled weight={0.6} fadeInSeconds={0.4} />
        </Playback>
      </Robot>
    </Scene>
  ),
};

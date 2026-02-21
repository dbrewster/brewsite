import { Scene, Lighting, Ambient, Directional } from '@brewsite/core';
import type { SceneDefinition } from '@brewsite/core';
import { BodyParts, Pose, Robot } from '../../generated/sceneDsl.generated';

export const scene01Move: SceneDefinition = {
  id: 'move-left',
  index: 0,
  getFrame: () => (
    <Scene id="move-left">
      <Lighting intensityScale={1}>
        <Ambient intensity={2.2} color="#ffffff" />
        <Directional intensity={2} color="#ffffff" position={[20, 30, 40]} />
      </Lighting>
      <Robot
        id="robot-left"
        position={[-18, -12, 0]}
        rotation={[0, -Math.PI / 2 + .2, 0]}
        scale={0.2}
        metalness={.9}
        roughness={.1}
      >
        <BodyParts>
          <Robot.Eyes color="#ff00ff" opacity={1}/>
          <Robot.Neck color="#ff0000" opacity={1}>
            <Pose rotate={{
              yawPct: .2,
              pitchPct: .4
            }}/>
          </Robot.Neck>
          <Robot.RightForeArm color="#ff0000" opacity={1}/>
        </BodyParts>
      </Robot>
    </Scene>
  ),
};

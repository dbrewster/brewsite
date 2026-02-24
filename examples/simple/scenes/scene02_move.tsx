import {Scene, Lighting, Ambient, Directional, Pose, ModelPart, Subpart, Label} from '@brewsite/core';
import {BrainSubparts, Robot} from '../../generated/sceneDsl.generated';
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
      <Robot
        id="robot-left"
        position={[0, -30, 0]}
        rotation={[0, -Math.PI + .4, 0]}
        scale={0.2}
        metalness={.9}
        roughness={.1}
      >
        <Robot.Eyes color="#ff0000" opacity={1} />
        <Robot.Neck color="#000000" opacity={1}>
          <Pose reset/>
        </Robot.Neck>
        <Robot.Spine2>
          <Pose reset/>
        </Robot.Spine2>
        <Robot.RightForeArm color="#00ff00" opacity={1}>
          <Pose reset/>
        </Robot.RightForeArm>
        <Robot.LeftForeArm color="#00ff00">
          <Pose rotate={{yawPct: -Math.PI/8}}/>
        </Robot.LeftForeArm>
        <Robot.LeftShoulder>
          <Pose rotate={{pitchPct: -Math.PI/8}}/>
        </Robot.LeftShoulder>
        <Robot.Head opacity={.6}/>
        <Robot.Brain opacity={1}>
          <BrainSubparts>
            <BrainSubparts.MarkerFrontLeft>
              <Label id={'ec'} text={'Executive Control'} labelOffset={[-10, 10, 0]} style={{fontSize: '1.2rem', lineColor: 'target-color', color: 'target-color'}}/>
            </BrainSubparts.MarkerFrontLeft>
            <BrainSubparts.MarkerBackLeft>
              <Label id={'memory'} text={'Memory'} labelOffset={[10, 0, 0]} style={{fontSize: '1.2rem', lineColor: 'target-color', color: 'target-color'}}/>
            </BrainSubparts.MarkerBackLeft>
          </BrainSubparts>
        </Robot.Brain>
      </Robot>
    </Scene>
  ),
};

import {Scene, Lighting, Ambient, Directional, ModelPart, ContainedModel, Label, Subpart} from '@brewsite/core';
import {BodyParts, BrainSubparts, Pose, Robot} from '../../generated/sceneDsl.generated';

export const scene01Move= (
    <Scene key="move-left">
      <Lighting intensityScale={1}>
        <Ambient intensity={2.2} color="#ffffff" />
        <Directional intensity={2} color="#ffffff" position={[20, 30, 40]} />
      </Lighting>
      <Robot
        id="robot-left"
        position={[-18, -30, 0]}
        rotation={[0, .2, 0]}
        scale={0.2}
        metalness={.9}
        roughness={.1}
      >
        <BodyParts>
          <Robot.Eyes color="#ff00ff" opacity={1}/>
          <Robot.NeckTwist02 color="#ff0000" opacity={1}>
            <Pose rotate={{
              pitchPct: .4
            }}/>
          </Robot.NeckTwist02>
          <Robot.RForearm color="#ff0000" opacity={1}>
          </Robot.RForearm>
          <Robot.Spine02>
            <Pose rotate={{pitchPct: Math.PI/8}}/>
          </Robot.Spine02>
          <Robot.LClavicle>
            <Pose rotate={{pitchPct: Math.PI/8}}/>
          </Robot.LClavicle>
        </BodyParts>
        <Robot.Brain opacity={1}>
        </Robot.Brain>
      </Robot>
    </Scene>
);

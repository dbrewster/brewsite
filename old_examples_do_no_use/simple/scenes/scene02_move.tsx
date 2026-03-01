import {Scene, Lighting, Ambient, Directional, Pose, ModelPart, Subpart, Label} from '@brewsite/core';
import {BrainSubparts, Robot} from '../../generated/sceneDsl.generated';

export const scene02Move= (
    <Scene id="move-right">
      <Lighting intensityScale={1}>
        <Ambient intensity={1.2} color="#ffffff" />
        <Directional intensity={2} color="#ffffff" position={[-20, 30, 40]} />
      </Lighting>
      <Robot
        id="robot-left"
        position={[0, -30, 0]}
        rotation={[0, -Math.PI/2 + .4, 0]}
        scale={0.2}
        metalness={.9}
        roughness={.1}
      >
        <Robot.Eyes color="#ff0000" opacity={1} />
        <Robot.NeckTwist02 color="#000000" opacity={1}>
          <Pose reset/>
        </Robot.NeckTwist02>
        <Robot.Spine02>
          <Pose reset/>
        </Robot.Spine02>
        <Robot.RForearm color="#00ff00" opacity={1}>
          <Pose reset/>
        </Robot.RForearm>
        <Robot.LForearm color="#00ff00">
          <Pose rotate={{yawPct: -Math.PI/8}}/>
        </Robot.LForearm>
        <Robot.LClavicle>
          <Pose rotate={{pitchPct: -Math.PI/8}}/>
        </Robot.LClavicle>
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
);

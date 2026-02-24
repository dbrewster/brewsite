import type { SceneDefinition } from '@brewsite/core';
import { Ambient, Background, Directional, Environment, Floor, Lighting, Scene } from '@brewsite/core';
import { Animation, BodyParts, Playback, Pose, Robot } from '../../generated/sceneDsl.generated';
import { backgrounds, sceneLighting } from './sceneAssets';

export interface BasicRobotPairProps {
  idBase: string,
  color1: string,
  color2: string,
  xPosition: number,
  zPosition: number,
  distance: number,
  animationBase: string,
  clipStartOnce: number,
}
export const BasicRobotPair = ({idBase, color1, color2, zPosition, xPosition, distance, animationBase, clipStartOnce} : BasicRobotPairProps) => {

  return (
    <>
      <Robot
        id={idBase + "_1"}
        position={[xPosition - distance/2, 0, zPosition - 2]}
        rotation={[0, 0, 0]}
        scale={0.18}
        metalness={0.85}
        roughness={0.18}
      >
        <BodyParts>
          <Robot.Eyes color="#7ffcff" opacity={1}/>
          <Robot.Chest color="#223247" opacity={1}/>
          <Robot.LForearm color={color1} opacity={1}/>
          <Robot.RForearm color={color1} opacity={1}/>
          <Robot.NeckTwist02>
            <Pose yPct={.05}/>
          </Robot.NeckTwist02>
          <Robot.LFoot>
            <Pose rotate={{pitchPct: -0.3}}/>
          </Robot.LFoot>
          <Robot.RFoot>
            <Pose rotate={{pitchPct: -0.3}}/>
          </Robot.RFoot>
          <Robot.Spine02>
            <Pose rotate={{pitchPct: 0.3}}/>
          </Robot.Spine02>
        </BodyParts>
        <Playback>
          <Animation clipStartOnce={clipStartOnce} clipName={animationBase + "-f"} enabled weight={0.6} clipStart={.1} />
        </Playback>
      </Robot>
      <Robot
        id={idBase + "_2"}
        position={[xPosition + distance/2, 0, zPosition]}
        rotation={[0, Math.PI, 0]}
        scale={0.18}
        metalness={0.85}
        roughness={0.18}
      >
        <BodyParts>
          <Robot.Eyes color="#7ffcff" opacity={1}/>
          <Robot.Chest color="#223247" opacity={1}/>
          <Robot.LForearm color={color2} opacity={1}/>
          <Robot.RForearm color={color2} opacity={1}/>
          <Robot.NeckTwist02>
            <Pose yPct={.1}/>
          </Robot.NeckTwist02>
          <Robot.LFoot>
            <Pose rotate={{pitchPct: -0.3}}/>
          </Robot.LFoot>
          <Robot.RFoot>
            <Pose rotate={{pitchPct: -0.3}}/>
          </Robot.RFoot>
          <Robot.Spine02>
            <Pose rotate={{pitchPct: 0.3}}/>
          </Robot.Spine02>
        </BodyParts>
        <Playback>
          <Animation clipStartOnce={clipStartOnce} clipName={animationBase + "-m"} enabled weight={0.6} clipStart={.1}/>
        </Playback>
      </Robot>
    </>
  )
}
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
      <BasicRobotPair idBase={'p1'} color1='#ff3b30' color2='#7ffcff' xPosition={-45} zPosition={-42} distance={26} animationBase='chat-relax' clipStartOnce={0}/>
      <BasicRobotPair idBase={'p2'} color1='#4f2be0' color2='#7ffcff' xPosition={45} zPosition={-72} distance={26} animationBase='chat-relax' clipStartOnce={4}/>
      <BasicRobotPair idBase={'p3'} color1='#ff3be0' color2='#25fc3f' xPosition={5} zPosition={-102} distance={26} animationBase='chat-talkandlaugh' clipStartOnce={9}/>
      <BasicRobotPair idBase={'p4'} color1='#4ffbe0' color2='#2f0cff' xPosition={25} zPosition={2} distance={26} animationBase='chat-talkandlaugh' clipStartOnce={1}/>
    </Scene>
  ),
};

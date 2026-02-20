import type {SceneFrameContext} from '../../../robot/runtime/compiler/sceneTypes';
import {
  createBlinkAnimation,
  createBreathingAnimation} from "./customAnimations";
import {hexToRgb} from "../../../robot/runtime/compiler/sceneUtils";
import {
  RIBBON_CONFIG} from './scene01_intro';
import {
  Ambient,
  Animation,
  Annotation,
  Annotations,
  AutoTransition,
  BodyParts,
  Environment,
  Lighting,
  Model,
  Motion,
  Playback,
  Pose,
  Ribbon,
  Scene,
  Spot,
  Transitions,
  BrainLabelAnnotations,
  LogoAnnotation,
  MessageAnnotation,
  BodyPart,
  ModelPart
} from '../../../robot/runtime/compiler/index';

const BODY_YAW_DEG = 20;
const TORSO_YAW_PCT = 0.2;
const HEAD_NET_YAW_DEG = 70;
const TORSO_YAW_DEG = TORSO_YAW_PCT * 15;
const HEAD_YAW_DEG = HEAD_NET_YAW_DEG - BODY_YAW_DEG - TORSO_YAW_DEG;
const LEG_YAW_DEG = 12;
const FOOT_PITCH_DEG = 14;

export const RotatedBodyParts = ({transparentHead, transparentChest, rotation = 'right'}: { transparentHead: boolean, transparentChest: boolean, rotation?: 'left' | 'right' }) => {
  const multiplier = rotation === 'left' ? -1 : 1;
  return (
    <BodyParts>
      <BodyPart id="head" color="#dddddd" metalness={0.6} roughness={0.3} opacity={transparentHead ? 0.2 : 1}/>
      <BodyPart id="eyes" color="#999" metalness={0} roughness={0.9} opacity={1}/>
      <BodyPart id="chest" opacity={transparentChest ? 0.6 : 1}/>
      <BodyPart id="robot">
        <Pose rotate={{yawPct: multiplier * -BODY_YAW_DEG / 30}}/>
      </BodyPart>
      <BodyPart id="torso">
        <Pose rotate={{yawPct: multiplier * -TORSO_YAW_PCT}}/>
      </BodyPart>
      <BodyPart id="head">
        <Pose rotate={{yawPct: multiplier * -HEAD_YAW_DEG / 90}}/>
      </BodyPart>
      <BodyPart id="left_leg">
        <Pose rotate={{yawPct: multiplier * LEG_YAW_DEG / 20}}/>
      </BodyPart>
      <BodyPart id="right_leg">
        <Pose rotate={{yawPct: multiplier * LEG_YAW_DEG / 20}}/>
      </BodyPart>
      <BodyPart id="left_foot">
        <Pose rotate={{pitchPct: multiplier * -FOOT_PITCH_DEG / 45}}/>
      </BodyPart>
      <BodyPart id="right_foot">
        <Pose rotate={{pitchPct: multiplier * -FOOT_PITCH_DEG / 45}}/>
      </BodyPart>
      <BodyPart id="left_forearm">
        <Pose rotate={{yawPct: multiplier * 15 / 45}}/>
      </BodyPart>
      <BodyPart id="right_forearm">
        <Pose rotate={{yawPct: multiplier * -15 / 45}}/>
      </BodyPart>
      <BodyPart id="left_fingers">
        <Pose rotate={{pitchPct: multiplier * 0.2}}/>
      </BodyPart>
      <BodyPart id="right_fingers">
        <Pose rotate={{pitchPct: multiplier * 0.2}}/>
      </BodyPart>
      <BodyPart id="left_thumb">
        <Pose rotate={{pitchPct: multiplier * 0.15, yawPct: multiplier * 3}}/>
      </BodyPart>
      <BodyPart id="right_thumb">
        <Pose rotate={{pitchPct: multiplier * 0.15, yawPct: multiplier * -3}}/>
      </BodyPart>
    </BodyParts>
  )
}
export const robotScene = (context: SceneFrameContext) => {
  const moveDelta = context?.ui?.ar ? (context.ui.ar - .57) * 20 : 0
  return (
    <Scene id="robot" index={1} isLightScene>
      <Transitions>
        <AutoTransition/>
      </Transitions>

      <Annotations>
        <MessageAnnotation
          id="robot-message"
          color='#a855ff'
          content={(
            <div className="robot-hero-copy">
              <div className="robot-hero-text robot-scene-message is-visible">
                <div className="robot-hero-eyebrow">System</div>
                <h1>Agents, orchestrated.</h1>
                <p className="robot-hero-support">
                  BrewFlow turns the agents you already use into a governed workforce.
                </p>
                <div className="robot-hero-badges" aria-hidden="true">
                  <span className="robot-pill">Executive control</span>
                  <span className="robot-pill">Memory</span>
                  <span className="robot-pill">Policy</span>
                  <span className="robot-pill">Verification</span>
                </div>
                <p className="robot-hero-detail">
                  It's not a new agent - it's the system around them. We add executive control, memory, and policy so
                  specialists coordinate, share context, and ship with accountability. You get the speed of many agents
                  with the reliability of one enterprise platform.
                </p>
              </div>
            </div>
          )}
        />
        <BrainLabelAnnotations/>
        <Annotation
          id="chest-action"
          label="Agent Execution"
          mode="world"
          targetPartId="chest_anchor"
          labelOffset={[-10.5, 3, 16]}
          style={{
            lineOpacity: 0.65,
            labelOpacity: 0.85,
            textColor: '#a855ff',
            lineColor: '#a855ff',
            lineThickness: 0.1,
          }}
        />
      </Annotations>

      <Ribbon
        config={{
          ...RIBBON_CONFIG,
          opacity: 0,
        }}
      />

      <Model id="primary"
        scale={0.2}
        rotation={[0, -0.7, 0]}
        position={[6, -25 + moveDelta, 0]}
      >
        <ModelPart id="chest_particles" enabled scale={0.4}/>
        <RotatedBodyParts transparentHead transparentChest/>
        <ModelPart id="brain" enabled opacity={1}/>
        <Playback>
          <Motion customAnimations={[createBreathingAnimation(), createBlinkAnimation()]}/>
          <Animation enabled={false}/>
        </Playback>
      </Model>

      <Lighting intensityScale={1}>
        <Ambient intensity={.06} color="#b384ef"/>
        <Spot
          intensity={4.2}
          color="#ffffff"
          position={[0, 50, 0]}
          target={[18, 20, 0]}
          angle={Math.PI}
          penumbra={0.8}
          distance={190}
          decay={0.3}
        />
      </Lighting>
    </Scene>
  );
};

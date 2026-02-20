import type {RibbonConfig} from '../../../robot/model/robotSceneTypes';
import {
  createBlinkAnimation,
  createBreathingAnimation} from './customAnimations';
import type {SceneFrameContext} from '../../../robot/runtime/compiler/sceneTypes';
import {
  Ambient,
  Animation,
  Annotations,
  AutoTransition,
  BodyParts,
  Environment,
  Lighting,
  Model,
  Motion,
  Playback,
  Scene,
  Spot,
  Transitions,
  LogoAnnotation,
  MessageAnnotation,
  BodyPart,
  ModelPart
} from '../../../robot/runtime/compiler/index';
import {LogoRotationRuntime} from "../../../robot/logoRotator/LogoRotationRuntime";
import {useLogoRotationState} from "../../../robot/logoRotator/useLogoRotationState";

export const RIBBON_CONFIG: RibbonConfig = {
  strandCount: 25,
  spacing: 2,
  radius: 0.05,
  radiusTaper: 0.75,
  segments: 120,
  twistFrequency: 0,
  twistPhase: 0,
  opacity: 0.82,
  glowLightsEnabled: true,
  glowLightCount: 26,
  glowLightIntensity: 2.4,
  glowLightColor: '#ffd4a6',
  glowLightDistance: 240,
  glowLightDecay: 0.55,
  curve: {
    width: 320,
    yOffset: -10,
    z: 2,
    waveAmplitude: -10.6,
    waveFrequency: 1,
    depthAmplitude: 5.4,
    depthFrequency: 0.6,
    depthPhase: Math.PI * 0.5,
  },
  position: [20, -13, 30],
  rotation: [.2, 2.5, .2],
  scale: [2, 2, 2],
};

const LogoTail = ({runtime}: { runtime?: LogoRotationRuntime }) => {
  const state = useLogoRotationState(runtime ?? null);
  return (
    <span className="robot-hero-tail" style={{color: state.palette?.primary}}>
      {state.label}
    </span>
  );
};

export const introScene = (context: SceneFrameContext) => {
  const sceneProgress = context.sceneProgress;
  const modelScale =
    sceneProgress < 0.5
      ? 0.2 - sceneProgress * 0.05
      : 0.2 - (1 - sceneProgress) * 0.05;

  return (
    <Scene id="intro" index={0}>
      <Transitions>
        <AutoTransition/>
      </Transitions>

      <Annotations>
        <MessageAnnotation
          id="base-message"
          content={(
            <div className="robot-hero-copy">
              <div className="robot-hero-text">
                <h1>
                  Your agents.
                  <br/>
                  One workforce.
                </h1>
                <p className="robot-hero-support">
                  Memory. Executive function. Self-regulation.
                </p>
                <p>
                  Your agents operate as one governed organization. <br/> Brew intelligence into{' '}
                  <LogoTail runtime={context.ui?.logo}/>.
                </p>
              </div>
            </div>
          )}
        />
      </Annotations>

      <Model id="primary"
        scale={modelScale}
        position={[0, -10, 0]}
        metalness={0.95}
        roughness={0.08}
        rotation={[0, -Math.PI/2 -0.2, 0]}
      >
        <BodyParts>
          <BodyPart id="head" color="#dddddd" metalness={0.6} roughness={0.3} opacity={1}/>
          <BodyPart id="eyes" color="#999" metalness={0} roughness={0.9} opacity={1}/>
          <BodyPart id="chest" opacity={0.6}/>
        </BodyParts>
        <ModelPart id="chest_particles" enabled scale={0.4}/>
        <Playback>
          <Motion customAnimations={[createBreathingAnimation(), createBlinkAnimation()]}/>
          <Animation enabled={false}/>
        </Playback>
      </Model>

      <Lighting intensityScale={1}>
        <Ambient intensity={2.6} color="#ffffff"/>
        <Spot
          intensity={2.2}
          color="#b384ef"
          position={[0, 50, 20]}
          target={[0, 0, 0]}
          angle={Math.PI}
          penumbra={0.8}
          distance={190}
          decay={0.3}
        />
      </Lighting>

      {/*<Environment enabled preset="room" intensity={1.35} />*/}
    </Scene>
  );
};

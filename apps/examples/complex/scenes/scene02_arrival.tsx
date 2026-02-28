import { Ambient, Background, Directional, Environment, Floor, Hud, HudItem, Lighting, Scene } from '@brewsite/core';
import { Fade } from '@brewsite/core/hud/animejs';
import { Animation, BodyParts, Playback, Pose, Robot } from '../../generated/sceneDsl.generated';
import { backgrounds, sceneLighting } from './sceneAssets';

export const scene02Arrival= (
    <Scene key="complex-arrival">
      <Background imageUrl={backgrounds.reveal} opacity={1} cssSize="cover" cssPosition="center" />
      <Lighting intensityScale={1}>
        <Ambient intensity={sceneLighting.soft.ambient} color="#e6eeff" />
        <Directional intensity={sceneLighting.soft.directional} color="#ffffff" position={sceneLighting.soft.direction} />
      </Lighting>
      <Robot
        id="complex-robot"
        position={[-10, 0, -200]}
        scale={0.18}
        metalness={0.85}
        roughness={0.18}
      >
        <BodyParts>
          <Robot.Eyes color="#7ffcff" opacity={1} />
          <Robot.Chest color="#223247" opacity={1} />
          <Robot.NeckTwist02 color="#8f9bb3" opacity={1}>
            <Pose rotate={{ yawPct: 0.1, pitchPct: 0.08 }} />
          </Robot.NeckTwist02>
          <Robot.RForearm color="#ff3b30" opacity={1}>
          </Robot.RForearm>
          <Robot.LFoot>
            <Pose rotate={{ pitchPct: -0.3 }} />
          </Robot.LFoot>
          <Robot.RFoot>
            <Pose rotate={{ pitchPct: -0.3 }} />
          </Robot.RFoot>
        </BodyParts>
        <Playback>
          <Animation clipName="chat-relax-f" enabled weight={0.6} fadeInSeconds={0.4} />
        </Playback>
      </Robot>
      <Hud>
        <HudItem id="complex-hud">
          <Fade duration={1200}>
            <div className="complex-hud complex-hud--right">
              <div className="complex-hud__eyebrow">Scene 2</div>
              <h2 className="complex-hud__title">Arrival and first contact.</h2>
              <div className="complex-hud__body">
                The robot enters with softer lighting and a relaxed animation loop, establishing
                scale before the reveal.
              </div>
            </div>
          </Fade>
        </HudItem>
      </Hud>
    </Scene>
);

import { Ambient, Background, Directional, Environment, Floor, Hud, HudItem, Lighting, Point, Scene, Spot } from '@brewsite/core';
import { Fade } from '@brewsite/core/hud/animejs';
import { Animation, BodyParts, ContainedModel, ModelPart, Playback, Pose, Robot } from '../../generated/sceneDsl.generated';
import { backgrounds, sceneLighting } from './sceneAssets';

export const scene03Reveal= (
    <Scene id="complex-reveal">
      <Background imageUrl={backgrounds.focus} opacity={1} cssSize="cover" cssPosition="center" />
      <Lighting intensityScale={1}>
        <Ambient intensity={sceneLighting.dramatic.ambient} color="#d6f3ff" />
        <Directional intensity={sceneLighting.dramatic.directional} color="#ffffff" position={sceneLighting.dramatic.direction} />
        <Point intensity={3.2} color="#7adfff" position={[22, 18, 14]} />
        <Point intensity={1.6} color="#4b7cff" position={[-16, 8, -6]} />
        <Spot intensity={4.8} color="#8ffff6" position={[6, 22, 18]} target={[0, -4, 0]} angle={0.45} penumbra={0.25} />
        <Spot intensity={2.6} color="#5aa8ff" position={[-10, 16, 10]} target={[4, -6, 2]} angle={0.55} penumbra={0.35} />
      </Lighting>
      <Robot
        id="complex-robot"
        position={[0, 0, -10]}
        rotation={[0, 0, 0]}
        scale={0.19}
        metalness={0.9}
        roughness={0.12}
      >
        <BodyParts>
          <Robot.Eyes color="#8ff7ff" opacity={1} />
          <Robot.Head color="#d7e7ff" opacity={0.5} />
          <Robot.NeckTwist02 color="#9aa9c3" opacity={1} />
          <Robot.RForearm color="#3bff30" opacity={1}>
            <Pose reset />
          </Robot.RForearm>
        </BodyParts>
        <ModelPart id="brain" anchor="Head" rotation={[0, 0, 0]} position={[0, 0.05, 0]} opacity={1}>
          <ContainedModel
            modelId="brain"
            scale={0.55}
            position={[0, -0.1, 0.13]}
            rotation={[-0.3, 0, 0]}
          />
        </ModelPart>
      </Robot>
      <Hud>
        <HudItem id="complex-hud">
          <Fade duration={1200}>
            <div className="complex-hud complex-hud--right">
              <div className="complex-hud__eyebrow">Scene 3</div>
              <h2 className="complex-hud__title">Reveal with focal lighting.</h2>
              <div className="complex-hud__body">
                Key lights tighten the frame while the head-mounted model appears, pulling
                attention to the hero detail.
              </div>
            </div>
          </Fade>
        </HudItem>
      </Hud>
    </Scene>
);

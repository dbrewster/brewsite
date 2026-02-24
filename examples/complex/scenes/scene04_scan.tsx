import type { SceneDefinition } from '@brewsite/core';
import { Ambient, Background, Directional, Environment, Floor, Hud, HudItem, Lighting, Point, Scene, Spot } from '@brewsite/core';
import { Fade } from '../../../src/hud/animejs';
import { Animation, BodyParts, ContainedModel, ModelPart, Playback, Pose, Robot } from '../../generated/sceneDsl.generated';
import { backgrounds, sceneLighting } from './sceneAssets';

export const scene04Scan: SceneDefinition = {
  id: 'complex-scan',
  index: 3,
  getFrame: () => (
    <Scene id="complex-scan">
      <Background imageUrl={backgrounds.scan} opacity={1} cssSize="cover" cssPosition="center" />
      <Lighting intensityScale={1}>
        <Ambient intensity={sceneLighting.scan.ambient} color="#bdf6ff" />
        <Directional intensity={sceneLighting.scan.directional} color="#ffffff" position={sceneLighting.scan.direction} />
        <Point intensity={2.8} color="#5fe0ff" position={[18, 12, -10]} />
        <Point intensity={1.4} color="#3b5bff" position={[-14, 6, 8]} />
        <Spot intensity={5.2} color="#7bfff2" position={[4, 20, -2]} target={[6, -8, -4]} angle={0.5} penumbra={0.3} />
        <Spot intensity={3.1} color="#5b9bff" position={[-8, 14, 14]} target={[2, -6, 4]} angle={0.6} penumbra={0.4} />
      </Lighting>
      <Robot
        id="complex-robot"
        position={[-10, 0, 5]}
        rotation={[0, -Math.PI / 2 - 0.2, 0]}
        scale={0.19}
        metalness={0.92}
        roughness={0.1}
      >
        <Playback>
          <Animation clipName="08-drunken-stumble-and-fall" enabled weight={1}/>
        </Playback>
        <BodyParts>
          <Robot.Eyes color="#66f0ff" opacity={1} />
          <Robot.Head color="#d2e6ff" opacity={0.85} />
          <Robot.NeckTwist02 color="#7f9bb8" opacity={1}>
            <Pose rotate={{ yawPct: 0.22, pitchPct: 0.24 }} />
          </Robot.NeckTwist02>
          <Robot.RForearm color="#3b30ff" opacity={1}>
            <Pose rotate={{ yawPct: 0.32, pitchPct: -0.05 }} />
          </Robot.RForearm>
        </BodyParts>
      </Robot>
      <Hud>
        <HudItem id="complex-hud">
          <Fade duration={1200}>
            <div className="complex-hud complex-hud--right">
              <div className="complex-hud__eyebrow">Scene 4</div>
              <h2 className="complex-hud__title">Scan and analyze.</h2>
              <div className="complex-hud__body">
                Cooler hues and sharper highlights signal a diagnostic pass while the pose shifts
                to emphasize precision.
              </div>
            </div>
          </Fade>
        </HudItem>
      </Hud>
    </Scene>
  ),
};

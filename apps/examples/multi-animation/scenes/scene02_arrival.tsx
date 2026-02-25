import {Floor, FloorMirror, SceneDefinition} from '@brewsite/core';
import {Ambient, Background, Directional, Hud, HudItem, Lighting, Scene} from '@brewsite/core';
import {Fade} from '@brewsite/core/hud/animejs';
import {Animation, MaleDummy, Playback} from '../../generated/sceneDsl.generated';
import {backgrounds, sceneLighting} from './sceneAssets';

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
      <MaleDummy
        id="complex-worker"
        position={[-10, 0, -200]}
        rotation={[0, 0, 0]}
        scale={30}
        metalness={.1}
      >
        <Playback>
          <Animation clipName="04-trip-forward-and-roll" enabled weight={1} fadeInSeconds={0.4} />
        </Playback>
      </MaleDummy>
      <Floor enabled position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <FloorMirror
          mirrorColor="#ffe9c4"
          mirrorOpacity={.7}
          mirrorResolution={1024}
          mirrorClipBias={0.003}
          mirrorEnvironmentIntensity={.7}
          mirrorUseEnvironmentBackground
        />
      </Floor>
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
  ),
};

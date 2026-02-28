import {Animation, Camera, Floor, FloorMirror, Playback} from '@brewsite/core';
import {Ambient, Background, Directional, Hud, HudItem, Lighting, Point, Scene, Spot} from '@brewsite/core';
import {Fade} from '@brewsite/core/hud/animejs';
import {Worker} from '../../generated/sceneDsl.generated';
import {backgrounds, sceneLighting} from './sceneAssets';

export const scene03_05Reveal= (
    <Scene id="complex-reveal">
      <Camera
        mode="fitFloorDepth"
        fov={60}
        floorY={0}
        floorZMin={-250}
        floorZMax={100}
        cameraY={40}
        lookAtZ={-200}
      />
      <Background imageUrl={backgrounds.focus} opacity={1} cssSize="cover" cssPosition="center" />
      <Lighting intensityScale={1}>
        <Ambient intensity={sceneLighting.dramatic.ambient} color="#d6f3ff" />
        <Directional intensity={sceneLighting.dramatic.directional} color="#ffffff" position={sceneLighting.dramatic.direction} />
        <Point intensity={1.6} color="#7adfff" position={[22, 18, 14]} />
        <Point intensity={0.8} color="#4b7cff" position={[-16, 8, -6]} />
        <Spot intensity={2.4} color="#8ffff6" position={[6, 22, 18]} target={[0, -4, 0]} angle={0.45} penumbra={0.25} />
        <Spot intensity={1.3} color="#5aa8ff" position={[-10, 16, 10]} target={[4, -6, 2]} angle={0.55} penumbra={0.35} />
      </Lighting>
      <Worker
        id="complex-worker"
        position={[0, 0, -10]}
      >
        <Playback>
          <Animation clipName="08-drunken-stumble-and-fall" enabled weight={1}/>
        </Playback>
      </Worker>
      <Floor enabled position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <FloorMirror
          mirrorColor="#ffe9c4"
          mirrorOpacity={.3}
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

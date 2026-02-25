import {Camera, FloorMirror, SceneDefinition} from '@brewsite/core';
import { Ambient, Background, Directional, Environment, Floor, Hud, HudItem, Lighting, Point, Scene, Spot } from '@brewsite/core';
import { Fade } from '../../../src/hud/animejs';
import {Animation, Playback, Worker} from '../../generated/sceneDsl.generated';
import { backgrounds, sceneLighting } from './sceneAssets';

export const scene04Scan: SceneDefinition = {
  id: 'complex-scan',
  index: 3,
  getFrame: () => (
    <Scene id="complex-scan">
      <Camera
        enabled
        mode="fitFloorDepth"
        fov={60}
        floorY={0}
        floorZMin={-250}
        floorZMax={100}
        cameraY={40}
        lookAtZ={-200}
      />
      <Background imageUrl={backgrounds.scan} opacity={1} cssSize="cover" cssPosition="center" />
      <Lighting intensityScale={1}>
        <Ambient intensity={sceneLighting.scan.ambient} color="#bdf6ff" />
        <Directional intensity={sceneLighting.scan.directional} color="#ffffff" position={sceneLighting.scan.direction} />
        <Point intensity={1.4} color="#5fe0ff" position={[18, 12, -10]} />
        <Point intensity={0.7} color="#3b5bff" position={[-14, 6, 8]} />
        <Spot intensity={2.6} color="#7bfff2" position={[4, 20, -2]} target={[6, -8, -4]} angle={0.5} penumbra={0.3} />
        <Spot intensity={1.6} color="#5b9bff" position={[-8, 14, 14]} target={[2, -6, 4]} angle={0.6} penumbra={0.4} />
      </Lighting>
      <Worker
        id="complex-worker"
        position={[-10, 0, 5]}
      >
        <Playback>
          <Animation clipName="08-drunken-stumble-and-fall" enabled weight={1}/>
        </Playback>
      </Worker>
      <Floor enabled position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <FloorMirror
          mirrorColor="#ffe9c4"
          mirrorOpacity={0}
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

import {Camera} from '@brewsite/core';
import { Ambient, Background, Directional, Environment, EnvironmentCube, Floor, Lighting, Scene } from '@brewsite/core';
import { Fade } from '@brewsite/core/hud/animejs';
import {FloorMirror} from "@brewsite/core";
import {backgrounds, sceneLighting} from "./sceneAssets";
import {makeCubeUrls, skyEnvironment} from "../../meeting/scenes/sceneAssets";

export const scene01Intro= (
    <Scene id="complex-intro">
      <Camera
        mode="fitFloorDepth"
        fov={60}
        floorY={0}
        floorZMin={-250}
        floorZMax={100}
        cameraY={40}
        lookAtZ={-200}
      />
      <Background imageUrl={backgrounds.intro} opacity={1} cssSize="cover" cssPosition="center" />
      <Lighting intensityScale={1}>
        <Ambient intensity={sceneLighting.soft.ambient} color="#dbe4ff" />
        <Directional intensity={sceneLighting.soft.directional} color="#ffffff" position={sceneLighting.soft.direction} />
      </Lighting>
      <Environment enabled intensity={0.05}>
        <EnvironmentCube urls={makeCubeUrls(skyEnvironment)} />
      </Environment>
      <Floor enabled position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <FloorMirror
          mirrorColor="#ffe9c4"
          mirrorOpacity={1}
          mirrorResolution={1024}
          mirrorClipBias={0.003}
          mirrorEnvironmentIntensity={.7}
          mirrorUseEnvironmentBackground
        />
      </Floor>
      <Fade duration={1200}>
        <div className="complex-hud complex-hud--bottom">
          <div className="complex-hud__eyebrow">Complex Example</div>
          <h2 className="complex-hud__title">A cinematic, multi-scene robot showcase.</h2>
          <div className="complex-hud__body">
            This sequence highlights lighting shifts, motion accents, and camera framing across
            a 5-scene arc. Follow the HUD as it moves to narrate the mid-sequence focus beats.
          </div>
        </div>
      </Fade>
    </Scene>
);

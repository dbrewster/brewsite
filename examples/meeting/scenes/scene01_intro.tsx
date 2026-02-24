import {Camera, SceneDefinition} from '@brewsite/core';
import { Ambient, Background, Directional, Environment, EnvironmentCube, Floor, Lighting, Scene } from '@brewsite/core';
import { backgrounds, makeCubeUrls, sceneLighting, skyEnvironment } from './sceneAssets';
import {FloorMirror} from "../../../src/elements/floor/dsl";

export const scene01Intro: SceneDefinition = {
  id: 'complex-intro',
  index: 0,
  getFrame: () => (
    <Scene id="complex-intro">
      <Camera
        enabled
        mode="fitFloorDepth"
        fov={60}
        floorY={0}
        floorZMin={-250}
        floorZMax={100}
        cameraY={80}
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
          mirrorOpacity={0.3}
          mirrorResolution={1024}
          mirrorClipBias={0.003}
          mirrorEnvironmentIntensity={.7}
          mirrorUseEnvironmentBackground
        />
      </Floor>
    </Scene>
  ),
};

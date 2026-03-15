// scene01_intro.tsx — Robot fades in from below center, idle pose.

import type { JSX } from 'react';
import { Ambient, Background, Camera, Directional, Lighting, ProgressManager, Scene } from '@brewsite/core';
import { Model } from '@brewsite/model';

export function Scene01Intro(): JSX.Element {
  return (
    <Scene id="model-intro">
      <ProgressManager scrollUnits={1200} />
      <Camera mode="world" position={[0, 1.2, 4.5]} target={[0, 1.0, 0]} fov={45} />
      <Lighting intensityScale={1.1}>
        <Ambient intensity={0.7} color="#d0e4ff" />
        <Directional intensity={1.0} color="#ffffff" position={[3, 8, 6]} />
        <Directional intensity={0.3} color="#a0c0ff" position={[-5, 3, 8]} />
      </Lighting>
      <Background color="#030510" />
      <Model
        type="Robot"
        id="robot"
        scale={0.001}
        x={0.15} y={0} w={0.7} h={1}
        opacity={1}
        z={0}
      />
    </Scene>
  );
}

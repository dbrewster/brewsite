// scene04_view.tsx — Model positioned inside a <View> region.
//
// The <View> defines a right-panel NVS region. The <Model> inside it authors
// x={0} y={0} w={1} h={1}, which composes with the View's content bounds so
// the model's NVS center resolves to the center of that region, not the full
// viewport. This confirms api.composeBounds() wiring is correct.

import type { JSX } from 'react';
import { Ambient, Background, Camera, Directional, Lighting, ProgressManager, Scene, View } from '@brewsite/core';
import { Animation, Model, Playback } from '@brewsite/model';

export function Scene04View(): JSX.Element {
  return (
    <Scene id="model-view">
      <ProgressManager scrollUnits={1200} />
      <Camera mode="world" position={[0, 1.2, 4.5]} target={[0, 1.0, 0]} fov={45} />
      <Lighting intensityScale={1.1}>
        <Ambient intensity={0.7} color="#d0e4ff" />
        <Directional intensity={1.0} color="#ffffff" position={[3, 8, 6]} />
        <Directional intensity={0.3} color="#a0c0ff" position={[-5, 3, 8]} />
      </Lighting>
      <Background color="#030510" />
      {/*
        View occupies right 60% of viewport, full height with a small top inset.
        padding={[0.05, 0.04]} = 5% top/bottom, 4% left/right.
      */}
      <View id="right-panel" x={0.38} y={0} w={0.62} h={1} padding={[0.05, 0.04]}>
        <Model
          type="Robot"
          id="robot"
          scale={0.001}
          x={0} y={0} w={1} h={1}
          opacity={1}
          z={0}
        >
          <Playback>
            <Animation
              enabled
              clipName="chat-relax-f"
              weight={0.7}
              fadeInSeconds={0.3}
              clipRepeat
            />
          </Playback>
        </Model>
      </View>
    </Scene>
  );
}

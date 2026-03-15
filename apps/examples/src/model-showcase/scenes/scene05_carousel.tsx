// scene05_carousel.tsx — Three robot instances in a carousel layout.
//
// ViewLayout kind="carousel" positions three Views in a linear fan:
//   - activeIndex=1 → center panel is robot-carousel-b
//   - inactiveScale=0.72 → side panels render at 72% scale
//   - zStep=9 → side panels pushed 9 world-units back in Z
//
// Each Model fills its View's content bounds (x=0 y=0 w=1 h=1).
// Views are sized w=0.38 h=0.88 — slightly taller than wide to give
// the robot vertical room. gap=0.03 separates them.
//
// Three distinct animation clips give each panel a unique character.

import type { JSX } from 'react';
import {
  Ambient,
  Background,
  Camera,
  Directional,
  Lighting,
  Scene,
  View,
  ViewLayout,
} from '@brewsite/core';
import { Animation, Model, Playback } from '@brewsite/model';

export function Scene05Carousel(): JSX.Element {
  return (
    <Scene id="model-carousel">
      <Camera mode="world" position={[0, 1.2, 4.5]} target={[0, 1.0, 0]} fov={45} />
      <Lighting intensityScale={1.1}>
        <Ambient intensity={0.7} color="#d0e4ff" />
        <Directional intensity={1.0} color="#ffffff" position={[3, 8, 6]} />
        <Directional intensity={0.3} color="#a0c0ff" position={[-5, 3, 8]} />
      </Lighting>
      <Background color="#030510" />
      <ViewLayout
        kind="carousel"
        activeIndex={1}
        inactiveScale={0.72}
        zStep={9}
        gap={0.03}
        y={0}
        h={1}
      >
        {/* Panel left — relaxed idle */}
        <View id="carousel-panel-a" w={0.38} h={0.88}>
          <Model
            type="Robot"
            id="robot-carousel-a"
            scale={0.001}
            x={0} y={0} w={1} h={1}
            opacity={1}
            z={0}
          >
            <Playback>
              <Animation
                enabled
                clipName="chat-relax-f"
                weight={1}
                fadeInSeconds={0.3}
                clipRepeat
              />
            </Playback>
          </Model>
        </View>

        {/* Panel center (active) — expressive talking animation */}
        <View id="carousel-panel-b" w={0.38} h={0.88}>
          <Model
            type="Robot"
            id="robot-carousel-b"
            scale={0.001}
            x={0} y={0} w={1} h={1}
            opacity={1}
            z={0}
          >
            <Playback>
              <Animation
                enabled
                clipName="chat-talkandlaugh-f"
                weight={1}
                fadeInSeconds={0.3}
                clipRepeat
              />
            </Playback>
          </Model>
        </View>

        {/* Panel right — alternate relaxed idle */}
        <View id="carousel-panel-c" w={0.38} h={0.88}>
          <Model
            type="Robot"
            id="robot-carousel-c"
            scale={0.001}
            x={0} y={0} w={1} h={1}
            opacity={1}
            z={0}
          >
            <Playback>
              <Animation
                enabled
                clipName="chat-relax-m"
                weight={1}
                fadeInSeconds={0.3}
                clipRepeat
              />
            </Playback>
          </Model>
        </View>
      </ViewLayout>
    </Scene>
  );
}

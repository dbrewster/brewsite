// scene03_labels.tsx — Robot center, head highlighted in accent color with a label.
//
// LabelItem is NOT placed here — it is rendered in ModelShowcasePage inside
// EngineOverlayHost so that it composites over the canvas at the correct DOM level.

import type { JSX } from 'react';
import { Ambient, Background, Camera, Directional, Lighting, ProgressManager, Scene } from '@brewsite/core';
import { Animation, BodyPart, BodyParts, Label, Model, Playback } from '@brewsite/model';

export function Scene03Labels(): JSX.Element {
  return (
    <Scene id="model-labels">
      <ProgressManager scrollUnits={1200} />
      <Camera mode="world" position={[0, 1.2, 4.5]} target={[0, 1.0, 0]} fov={"45deg"} />
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
        x={0.1} y={0} w={0.8} h={1}
        opacity={1}
        z={0}
      >
        <Playback>
          <Animation
            enabled
            clipName="chat-relax-f"
            weight={0.6}
            clipRepeat
          />
        </Playback>
        <BodyParts>
          <BodyPart id="Head" color="#7ffcff" opacity={1}>
            <Label
              id="head-label"
              text="Sensor Array"
              labelOffset={[0, 0.35, 0]}
            />
          </BodyPart>
        </BodyParts>
      </Model>
    </Scene>
  );
}

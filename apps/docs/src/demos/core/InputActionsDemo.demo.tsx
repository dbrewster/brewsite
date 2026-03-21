import { JSX } from 'react';
import {
  Scene,
  Camera,
  Lighting,
  Ambient,
  Directional,
  Floor,
  FloorPhysical,
  InputController,
  Action,
  PointerMap,
  WheelMap,
} from '@brewsite/core';
import { DemoScene } from '../shared/DemoScene';

export const CODE = `
// <InputController> wires up action-mapped camera interactions for a scene.
// <Action> defines a named action type; input event maps are specified as children.
// Note: orbit and zoom require camera.interaction.enabled=true on the Camera.
// mode="replace" overrides all defaults; merge mode (the default) preserves standard bindings.
<Scene key="scene" id="scene">
  <Camera
    mode="orbit"
    target={[0, 0, 0]}
    azimuth={0}
    polar={1.2}
    distance={6}
    interaction={{ enabled: true }}
  />
  <InputController mode="replace">
    <Action id="orbit" type="camera.orbit">
      <PointerMap event="drag" button="left" />
    </Action>
    <Action id="zoom" type="camera.zoom">
      <WheelMap />
    </Action>
    <Action id="reset" type="camera.reset">
      <PointerMap event="click" button="right" />
    </Action>
  </InputController>
</Scene>

// Tip: Drag to orbit, scroll to zoom, right-click to reset camera.
`.trim();

export default function InputActionsDemo(): JSX.Element {
  return (
    <DemoScene sceneCount={1}>
      <Scene key="scene" id="scene">
        <Camera
          mode="orbit"
          target={[0, 0, 0]}
          azimuth={0}
          polar={"1.2rad"}
          distance={6}
          interaction={{ enabled: true }}
        />
        <Lighting>
          <Ambient color="#ffffff" intensity={0.5} />
          <Directional color="#ffffff" intensity={0.8} position={[5, 10, 5]} />
        </Lighting>
        <Floor enabled>
          <FloorPhysical opacity={0.5} metalness={0.4} roughness={0.6} />
        </Floor>
        <InputController mode="replace">
          <Action id="orbit" type="camera.orbit">
            <PointerMap event="drag" button="left" />
          </Action>
          <Action id="zoom" type="camera.zoom">
            <WheelMap />
          </Action>
          <Action id="reset" type="camera.reset">
            <PointerMap event="click" button="right" />
          </Action>
        </InputController>
      </Scene>
    </DemoScene>
  );
}

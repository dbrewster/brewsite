// viewerScene.tsx — Single scene for the Canvas Region product viewer example.

import type { JSX } from 'react';
import { Scene, InputController, Action, PointerMap, WheelMap, PinchMap, KeyMap } from '@brewsite/core';
import {
  Diagram,
  DiagramNode,
  DiagramEdge,
  DiagramGroup,
  ManualLayout,
} from '@brewsite/diagram';

/**
 * A simple 3-node architecture diagram used as the 3D content
 * for the Canvas Region embedding mode example.
 *
 * <InputController> explicitly wires camera orbit (drag), dolly (wheel/pinch),
 * pan (shift+drag), and reset (R key) — the compiler-injected default only
 * covers keyboard scene navigation, not pointer/wheel camera actions.
 */
export function ViewerScene(): JSX.Element {
  return (
    <Scene id="viewer">
      <InputController scope="canvas">
        <Action id="orbit" type="camera.orbit">
          <PointerMap event="drag" button="left" />
        </Action>
        <Action id="dolly" type="camera.dolly">
          <WheelMap />
          <PinchMap />
        </Action>
        <Action id="pan" type="canvas.pan">
          <PointerMap event="drag" button="left" modifiers={['shift']} />
        </Action>
        <Action id="reset" type="camera.reset">
          <KeyMap keyName="r" />
        </Action>
      </InputController>
      <Diagram id="arch-diagram" x={0} y={0} w={1} h={1} tilt={-0.3} scale={1}>
        <ManualLayout />
        <DiagramGroup id="backend" label="Backend Services">
          <DiagramNode
            id="api"
            label="API Gateway"
            shape="rectangle"
            icon="ui:globe-alt"
            position={[0.35, 0.5, 0]}
            size={[0.2, 0.15]}
          />
          <DiagramNode
            id="db"
            label="Database"
            shape="circle"
            icon="ui:circle-stack"
            position={[0.65, 0.5, 0]}
            size={[0.2, 0.15]}
          />
        </DiagramGroup>
        <DiagramNode
          id="client"
          label="Web Client"
          shape="rectangle"
          icon="ui:computer-desktop"
          position={[0.5, 0.15, 0]}
          size={[0.2, 0.15]}
        />
        <DiagramEdge from="client" to="api" label="HTTPS" />
        <DiagramEdge from="api" to="db" label="SQL" />
      </Diagram>
    </Scene>
  );
}

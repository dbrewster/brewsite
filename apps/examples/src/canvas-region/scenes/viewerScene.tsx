// viewerScene.tsx — Single scene for the Canvas Region product viewer example.

import type { JSX } from 'react';
import { Scene } from '@brewsite/core';
import {
  Diagram,
  DiagramNode,
  DiagramEdge,
  DiagramGroup,
  ManualLayout, FlowLayout,
} from '@brewsite/diagram';

/**
 * A simple 3-node architecture diagram used as the 3D content
 * for the Canvas Region embedding mode example.
 *
 * No explicit <InputController> is needed — the compiler-injected defaults
 * provide orbit, pan, zoom, reset, and scene navigation automatically.
 */
export function ViewerScene(): JSX.Element {
  return (
    <Scene id="viewer">
      <Diagram id="arch-diagram" x={0} y={0} w={"100%"} h={"100%"} tilt={"-0.3rad"} scale={1}>
        <FlowLayout gap={"20%"}/>
        <DiagramGroup id="backend" label="Backend Services">
          <DiagramNode
            id="api"
            label="API Gateway"
            shape="rectangle"
            icon="ui:globe-alt"
            position={["35%", "50%", 0]}
            size={["0.2u", "0.15u"]}
          />
          <DiagramNode
            id="db"
            label="Database"
            shape="circle"
            icon="ui:circle-stack"
            position={["65%", "50%", 0]}
            size={["0.2u", "0.2u"]}
          />
        </DiagramGroup>
        <DiagramNode
          id="client"
          label="Web Client"
          shape="rectangle"
          icon="ui:computer-desktop"
          position={["50%", "15%", 0]}
          size={["0.2u", "0.15u"]}
        />
        <DiagramEdge from="client" to="api" label="HTTPS" />
        <DiagramEdge from="api" to="db" label="SQL" />
      </Diagram>
    </Scene>
  );
}

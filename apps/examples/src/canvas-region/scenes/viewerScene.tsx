// viewerScene.tsx — Single scene for the Canvas Region product viewer example.

import type { JSX } from 'react';
import { Scene } from '@brewsite/core';
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
 * No explicit <InputController> is needed — the compiler-injected defaults
 * provide orbit, pan, zoom, reset, and scene navigation automatically.
 */
export function ViewerScene(): JSX.Element {
  return (
    <Scene id="viewer">
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

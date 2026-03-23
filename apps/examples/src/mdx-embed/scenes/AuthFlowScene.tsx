// AuthFlowScene.tsx — Authentication flow diagram for the MDX embed example.

import type { JSX } from 'react';
import { Scene } from '@brewsite/core';
import {
  Diagram,
  DiagramNode,
  DiagramEdge,
  DiagramGroup,
  FlowLayout,
} from '@brewsite/diagram';

export function AuthFlowScene(): JSX.Element {
  return (
    <Scene id="auth-flow">
      <Diagram id="auth-diagram" x={0} y={0} w="100%" h="100%" tilt="-0.25rad" scale={1}>
        <FlowLayout gap="20%" />

        <DiagramNode
          id="client"
          label="Client App"
          shape="rectangle"
          icon="ui:device-phone-mobile"
          position={["15%", "50%", 0]}
          size={["16u", "14u"]}
        />

        <DiagramGroup id="auth-layer" label="Auth Layer">
          <DiagramNode
            id="gateway"
            label="API Gateway"
            shape="hexagon"
            icon="ui:shield-check"
            position={["40%", "30%", 0]}
            size={["16u", "14u"]}
          />
          <DiagramNode
            id="oauth"
            label="OAuth Provider"
            shape="diamond"
            icon="ui:key"
            position={["40%", "70%", 0]}
            size={["16u", "14u"]}
          />
        </DiagramGroup>

        <DiagramGroup id="backend" label="Backend">
          <DiagramNode
            id="api"
            label="API Server"
            shape="rectangle"
            icon="ui:server"
            position={["70%", "30%", 0]}
            size={["16u", "12u"]}
          />
          <DiagramNode
            id="db"
            label="User Store"
            shape="circle"
            icon="ui:circle-stack"
            position={["70%", "70%", 0]}
            size={["16u", "16u"]}
          />
        </DiagramGroup>

        <DiagramEdge from="client" to="gateway" label="Request" flow="forward" />
        <DiagramEdge from="gateway" to="oauth" label="Validate" flow="forward" />
        <DiagramEdge from="oauth" to="gateway" label="Token" flow="forward" />
        <DiagramEdge from="gateway" to="api" label="Authorized" flow="forward" />
        <DiagramEdge from="api" to="db" label="Query" flow="forward" />
      </Diagram>
    </Scene>
  );
}

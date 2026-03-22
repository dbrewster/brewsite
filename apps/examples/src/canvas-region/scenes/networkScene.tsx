// networkScene.tsx — Network topology diagram scene for multi-canvas demo.

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
 * A network topology diagram: load balancer → app servers → cache + database.
 */
export function NetworkScene(): JSX.Element {
  return (
    <Scene id="network">
      <Diagram id="network-diagram" x={"10%"} y={0} w={"80%"} h={"100%"} tilt={"-0.25rad"} scale={1}>
        <FlowLayout gap={"20%"}/>

        <DiagramNode
          id="lb"
          label="Load Balancer"
          shape="hexagon"
          icon="ui:arrows-right-left"
          position={["50%", "10%", 0]}
          size={["18u", "14u"]}
        />

        <DiagramGroup id="app-tier" label="Application Tier">
          <DiagramNode
            id="app-1"
            label="App Server 1"
            shape="rectangle"
            icon="ui:server"
            position={["25%", "40%", 0]}
            size={["18u", "12u"]}
          />
          <DiagramNode
            id="app-2"
            label="App Server 2"
            shape="rectangle"
            icon="ui:server"
            position={["50%", "40%", 0]}
            size={["18u", "12u"]}
          />
          <DiagramNode
            id="app-3"
            label="App Server 3"
            shape="rectangle"
            icon="ui:server"
            position={["75%", "40%", 0]}
            size={["18u", "12u"]}
          />
        </DiagramGroup>

        <DiagramGroup id="data-tier" label="Data Tier">
          <DiagramNode
            id="cache"
            label="Redis Cache"
            shape="heptagon"
            icon="ui:bolt"
            position={["30%", "75%", 0]}
            size={["18u", "16u"]}
          />
          <DiagramNode
            id="db"
            label="PostgreSQL"
            shape="circle"
            icon="ui:circle-stack"
            position={["70%", "75%", 0]}
            size={["18u", "18u"]}
          />
        </DiagramGroup>

        <DiagramEdge from="lb" to="app-1" flow="forward" />
        <DiagramEdge from="lb" to="app-2" flow="forward" />
        <DiagramEdge from="lb" to="app-3" flow="forward" />
        <DiagramEdge from="app-1" to="cache" label="Read" flow="forward" />
        <DiagramEdge from="app-2" to="cache" label="Read" flow="forward" />
        <DiagramEdge from="app-2" to="db" label="Write" flow="forward" />
        <DiagramEdge from="app-3" to="db" label="R/W" flow="forward" />
      </Diagram>
    </Scene>
  );
}

import type { JSX } from 'react';
import {
  Camera, Floor, Lighting, Ambient, Directional, ProgressManager, Scene,
} from '@brewsite/core';
import {
  Diagram, DiagramEdge, DiagramGroup, DiagramNode, FlowLayout, GridLayout,
} from '@brewsite/diagram';

const CAM_POS: [number, number, number] = [0, 1.5, 6];
const CAM_TGT: [number, number, number] = [0, 0.3, 0];

export const DiagramDetailScene = (): JSX.Element => (
  <Scene id="detail-diagram-view">
    <ProgressManager scrollUnits={800} />
    <Camera mode="world" position={CAM_POS} target={CAM_TGT} fov={38} />
    <Lighting intensityScale={1.3}>
      <Ambient intensity={2.8} color="#d7e5ff" />
      <Directional intensity={1.5} color="#ffffff" position={[3, 5, 4]} />
    </Lighting>
    <Floor variant="grid" negativeZExtent={20} />

    {/* Same diagram ID as picker — nodes morph from compact to expanded */}
    <Diagram id="picker-diagram" x={0.05} y={0.02} w={0.9} h={0.92} scale={1.0}>
      <FlowLayout direction="top-down" gap={1.2} />

      <DiagramNode id="api" label="API Gateway" sublabel="REST + gRPC · rate limiting · auth" size={[9, 2.2]}
        glow={{ intensity: 0.12 }} />

      <DiagramGroup id="services" label="Microservices" variant="container">
        <GridLayout columns={3} spacing={[1.5, 0.9]} />

        <DiagramNode id="auth" label="Auth Service"
          sublabel="OAuth 2.0 · JWT · MFA" size={[5.5, 2.0]} />
        <DiagramNode id="billing" label="Billing Service"
          sublabel="Stripe · invoices · usage" size={[5.5, 2.0]} />
        <DiagramNode id="notify" label="Notification Service"
          sublabel="email · SMS · push" size={[5.5, 2.0]} />
      </DiagramGroup>

      <DiagramNode id="db" label="Database Cluster"
        sublabel="PostgreSQL · read replicas · connection pooling" size={[9, 2.2]} />

      <DiagramEdge from="api" to="auth" routing="flow" flow="forward" />
      <DiagramEdge from="api" to="billing" routing="flow" flow="forward" />
      <DiagramEdge from="api" to="notify" routing="flow" flow="forward" />
      <DiagramEdge from="auth" to="db" routing="flow" flow="forward" />
      <DiagramEdge from="billing" to="db" routing="flow" flow="forward" />
      <DiagramEdge from="notify" to="db" routing="flow" flow="forward" />
    </Diagram>
  </Scene>
);

import type { JSX } from 'react';
import { Scene, Camera, Lighting, Ambient, Directional, Floor, FloorMirror, ProgressManager } from '@brewsite/core';
import { DiagramCanvas, Diagram, DiagramEdge, DiagramGroup, DiagramNode, Exit, ManualLayout, darkGlassTheme } from '@brewsite/diagram';
import { MidFade, SlideUp } from '@brewsite/core/hud/animejs';

export const scene02ArchOverview: JSX.Element = (
  <Scene id="website-arch-overview">
    <ProgressManager
      scrollUnits={1800}
      autoAdvance={{ duration: 7, max: 0.85, pauseOnScroll: true }}
    />
    <Camera mode="world" fov={55} position={[0, 10, 50]} target={[0, 0, 0]} />

    <Floor enabled position={[0, -20, 0]}>
      <FloorMirror
        mirrorColor="#08101e"
        mirrorOpacity={0.2}
        mirrorResolution={512}
        mirrorClipBias={0.003}
      />
    </Floor>
    <Lighting intensityScale={1}>
      <Ambient intensity={1.2} color="#ffffff" />
      <Directional intensity={0.5} color="#ffefef" position={[0, 30, 50]} />
      <Directional intensity={0.6} color="#aaccff" position={[-20, 10, 20]} />
    </Lighting>
    <DiagramCanvas id="system-canvas" rotation={[-Math.PI / 8, 0, 0]} scale={1.4} theme={darkGlassTheme}>
      <Diagram id="system-arch" pivot="center">
        <ManualLayout />
        <Exit to={[0, -60, 0]} fade easing="ease-out" />

        <DiagramGroup id="frontend" label="Client Tier" variant="swimlane">
          <DiagramNode id="browser" label="Web Browser" icon="ui:user" position={[-6, 6, 0]} />
        </DiagramGroup>

        <DiagramGroup id="api-tier" label="API Tier" variant="boundary">
          <DiagramNode id="cdn" label="CloudFront CDN"  icon="aws:cloudfront"   position={[0, 2, 0]} />
          <DiagramNode id="alb" label="Load Balancer"   icon="aws:alb"          position={[0, -1, 0]} />
          <DiagramNode id="api" label="API Gateway"     icon="aws:api-gateway"  position={[0, -4, 0]} />
        </DiagramGroup>

        <DiagramGroup id="compute" label="Compute Tier" variant="boundary">
          <DiagramNode id="ecs"    label="ECS Cluster" icon="aws:ecs"    position={[-5, -8, 0]} />
          <DiagramNode id="lambda" label="Lambda"      icon="aws:lambda" position={[5, -8, 0]} />
        </DiagramGroup>

        <DiagramGroup id="data" label="Data Tier" variant="swimlane">
          <DiagramNode id="rds"   label="RDS PostgreSQL" icon="aws:rds"         position={[-5, -13, 0]} />
          <DiagramNode id="cache" label="ElastiCache"    icon="aws:elasticache" position={[0, -13, 0]} />
          <DiagramNode id="s3"    label="S3 Assets"      icon="aws:s3"          position={[5, -13, 0]} />
        </DiagramGroup>

        <DiagramEdge from="browser" to="cdn"    label="HTTPS"    flow="forward" />
        <DiagramEdge from="cdn"     to="alb"                     flow="forward" />
        <DiagramEdge from="alb"     to="api"                     flow="forward" />
        <DiagramEdge from="api"     to="ecs"    label="REST"     flow="forward" />
        <DiagramEdge from="api"     to="lambda" label="Events"   style="dashed" flow="forward" />
        <DiagramEdge from="ecs"     to="rds"    label="TCP 5432" flow="forward" />
        <DiagramEdge from="ecs"     to="cache"  label="Redis"    flow="forward" />
        <DiagramEdge from="ecs"     to="s3"     label="r/w"      style="dashed" flow="forward" />
      </Diagram>
    </DiagramCanvas>
    <div style={{ position: 'absolute', top: '6%', right: '5%', textAlign: 'right', maxWidth: 300 }}>
      <MidFade duration={1200}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          color: 'rgba(240,246,252,0.4)',
          marginBottom: 8,
        }}>
          Production Architecture
        </div>
        <div style={{ fontSize: 20, fontWeight: 600, color: '#f0f6fc' }}>
          16 nodes · 4 tiers · 8 edges
        </div>
      </MidFade>
    </div>
    <div style={{ position: 'absolute', bottom: '8%', left: '5%', maxWidth: 360 }}>
      <SlideUp duration={1000} delay={100}>
        <div style={{ fontSize: 22, fontWeight: 600, color: '#f0f6fc' }}>
          Architecture diagrams.<br />Presentation-ready.
        </div>
      </SlideUp>
    </div>
  </Scene>
);

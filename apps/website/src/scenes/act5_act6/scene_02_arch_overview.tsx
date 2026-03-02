import type { JSX } from 'react';
import { Scene, Camera, Lighting, Ambient, Directional, Floor, FloorMirror, ProgressManager } from '@brewsite/core';
import {DiagramCanvas, Diagram, DiagramEdge, DiagramGroup, DiagramNode, HierarchicalLayout, darkGlassTheme, GridLayout} from '@brewsite/diagram';
import { MidFade, ScrollOn } from '@brewsite/core/hud/animejs';
import { isMobile } from '../../utils/viewport';
import type { Vec3 } from '@brewsite/core';
import { dwellFn } from '../../utils/pacing';

const LATE_FADE = { exit: [1.0, 1.0] as [number, number], enter: [1.0, 1.0] as [number, number] };

export const scene02ArchOverview: JSX.Element = (
  <Scene id="website-arch-overview" transition={LATE_FADE}>
    <ProgressManager
      scrollUnits={1800}
      fn={dwellFn}
      autoAdvance={{ duration: 7, max: 0.85, pauseOnScroll: true }}
    />
    <Camera
      mode="world"
      position={(isMobile ? [0, 8, 38] : [0, 10, 50]) as Vec3}
      target={[0, 0, 0]}
      fov={isMobile ? 65 : 55}
    />

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
    <DiagramCanvas id="system-canvas" rotation={[-Math.PI / 8, 0, 0]} scale={isMobile ? 1.0 : 1.4} theme={darkGlassTheme}>
      <Diagram id="system-arch" pivot="center">
        <GridLayout />

        <DiagramGroup id="frontend" label="Client Tier" variant="swimlane">
          <DiagramNode id="browser" label="Web Browser" icon="ui:user" />
        </DiagramGroup>

        <DiagramGroup id="api-tier" label="API Tier" variant="boundary">
          <DiagramNode id="cdn" label="CloudFront CDN"  icon="aws:cloudfront" />
          <DiagramNode id="alb" label="Load Balancer"   icon="aws:alb" />
          <DiagramNode id="api" label="API Gateway"     icon="aws:api-gateway" />
        </DiagramGroup>

        <DiagramGroup id="compute" label="Compute Tier" variant="boundary">
          <DiagramNode id="ecs"    label="ECS Cluster" icon="aws:ecs" />
          <DiagramNode id="lambda" label="Lambda"      icon="aws:lambda" />
        </DiagramGroup>

        <DiagramGroup id="data" label="Data Tier" variant="swimlane">
          <DiagramNode id="rds"   label="RDS PostgreSQL" icon="aws:rds" />
          <DiagramNode id="cache" label="ElastiCache"    icon="aws:elasticache" />
          <DiagramNode id="s3"    label="S3 Assets"      icon="aws:s3" />
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
        <div style={{ fontSize: 'clamp(16px, 2.2vw, 20px)', fontWeight: 600, color: '#f0f6fc' }}>
          16 nodes · 4 tiers · 8 edges
        </div>
      </MidFade>
    </div>
    <div style={{ position: 'absolute', bottom: '8%', left: '5%', maxWidth: 360 }}>
      <ScrollOn duration={1000} delay={100}>
        <div style={{ fontSize: 'clamp(18px, 2.5vw, 22px)', fontWeight: 600, color: '#f0f6fc' }}>
          Architecture diagrams.<br />Presentation-ready.
        </div>
      </ScrollOn>
    </div>
  </Scene>
);

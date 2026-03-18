import type { JSX } from 'react';
import { Scene, Camera, Lighting, Ambient, Directional, Floor, FloorMirror, ProgressManager, TextBox } from '@brewsite/core';
import {Diagram, DiagramEdge, DiagramGroup, DiagramNode, HierarchicalLayout, GridLayout} from '@brewsite/diagram';
import { isMobile } from '../../utils/viewport';
import { dwellFn } from '../../utils/pacing';

const LATE_FADE = { exit: [1.0, 1.0] as [number, number], enter: [1.0, 1.0] as [number, number] };

const snippetCode = `<DiagramGroup id="api-tier" label="API Tier" variant="boundary">
  <DiagramNode id="cdn" label="CloudFront" icon="aws:cloudfront" />
  <DiagramNode id="api" label="API Gateway" icon="aws:api-gateway" />
</DiagramGroup>
<DiagramGroup id="compute" label="Compute" variant="boundary">
  <DiagramNode id="ecs"    label="ECS"    icon="aws:ecs" />
  <DiagramNode id="lambda" label="Lambda" icon="aws:lambda" />
</DiagramGroup>`;

export const scene02ArchOverview: JSX.Element = (
  <Scene id="website-arch-overview" transition={LATE_FADE}>
    <ProgressManager
      scrollUnits={1800}
      fn={dwellFn}
      autoAdvance={{ duration: 7, max: 0.85, pauseOnScroll: true }}
    />
    <Camera mode="nvsViewport" worldScale={50} />

    <Floor enabled position={[0, 0, 0]}>
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
    <Diagram id="system-arch" x={0} y={0} w={1} h={1} tilt={-Math.PI / 8} scale={isMobile ? 1.0 : 1.4}>
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

    {/* Top-right: stat only — no eyebrow label */}
    <TextBox key="arch-overview-stats" x={0.65} y={0.04} w={0.32} h={0.08} overflow="visible">
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 'clamp(16px, 2.2vw, 20px)', fontWeight: 600, color: '#f0f6fc' }}>
          16 nodes · 4 tiers · 8 edges
        </div>
      </div>
    </TextBox>

    {/* Bottom-left: headline + code snippet + body */}
    <TextBox key="arch-overview-content" x={0.03} y={0.52} w={0.38} h={0.45} overflow="visible">
      <div style={{ fontSize: 'clamp(18px, 2.5vw, 22px)', fontWeight: 600, color: '#f0f6fc', lineHeight: 1.3, marginBottom: 16 }}>
        Your production<br />architecture,<br />in a scene.
      </div>
      <pre style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 'clamp(11px, 1.2vw, 13px)',
        lineHeight: 1.7,
        color: '#00f5ff',
        background: 'rgba(0,245,255,0.04)',
        border: '1px solid rgba(0,245,255,0.15)',
        borderRadius: 6,
        padding: 16,
        maxWidth: 400,
        margin: '0 0 14px',
        whiteSpace: 'pre-wrap',
      }}>
        {snippetCode}
      </pre>
      <div style={{ fontSize: 'clamp(13px, 1.5vw, 15px)', color: 'rgba(240,246,252,0.6)', lineHeight: 1.6 }}>
        Groups, swimlanes, nested tiers — all declared.<br />
        Ready for your next deck, demo, or keynote.
      </div>
    </TextBox>
  </Scene>
);

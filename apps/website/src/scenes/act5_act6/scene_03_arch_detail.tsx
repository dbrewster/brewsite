import type { JSX } from 'react';
import { Scene, Camera, Lighting, Ambient, Directional, ProgressManager } from '@brewsite/core';
import { Diagram, DiagramEdge, DiagramNode, DiagramEnter, ManualLayout } from '@brewsite/diagram';
import { isMobile } from '../../utils/viewport';
import { dwellFn } from '../../utils/pacing';

const LATE_FADE = { exit: [1.0, 1.0] as [number, number], enter: [1.0, 1.0] as [number, number] };

const snippetCode = `// before (ghosted context)
<DiagramNode id="cdn" position={[0.618, 0.083, -25]} opacity={0.3} />
<DiagramNode id="api" position={[0.618, 0.417, -25]} opacity={0.3} />

// after (detail drill-down)
<DiagramNode id="ecs"     label="ECS Cluster" position={[0.324, 0.639, -5]} />
<DiagramNode id="svc-api" label="API Service" position={[0.324, 0.528,  8]} />`;

export const scene03ArchDetail: JSX.Element = (
  <Scene id="website-arch-detail" transition={LATE_FADE}>
    <ProgressManager
      scrollUnits={1800}
      fn={dwellFn}
      autoAdvance={{ duration: 7, max: 0.85, pauseOnScroll: true }}
    />
    <Camera mode="nvsViewport" worldScale={50} />

    <Lighting intensityScale={1}>
      <Ambient intensity={1.0} color="#ffffff" />
      <Directional intensity={0.6} color="#aaccff" position={[-20, 10, 20]} />
    </Lighting>
    <Diagram id="system-arch" x={0} y={0} w={1} h={1} tilt={-Math.PI / 12} scale={isMobile ? 1.0 : 1.4}>
        <ManualLayout />
        <DiagramEnter from={[-1, 0.5, 0]} fade easing="ease-in" />

        {/* Ghost nodes from previous scene — carry position/shape but fade to 30% */}
        <DiagramNode id="cdn"    position={[0.618, 0.083, -25]}  size={[0.15, 0.08]} opacity={0.3} />
        <DiagramNode id="alb"    position={[0.618, 0.250, -25]}  size={[0.15, 0.08]} opacity={0.3} />
        <DiagramNode id="api"    position={[0.618, 0.417, -25]}  size={[0.15, 0.08]} opacity={0.3} />
        <DiagramNode id="lambda" position={[0.912, 0.639, -25]}  size={[0.15, 0.08]} opacity={0.3} />
        <DiagramNode id="rds"    position={[0.324, 0.917, -25]}  size={[0.15, 0.08]} opacity={0.3} />
        <DiagramNode id="cache"  position={[0.618, 0.917, -25]}  size={[0.15, 0.08]} opacity={0.3} />
        <DiagramNode id="s3"     position={[0.912, 0.917, -25]}  size={[0.15, 0.08]} opacity={0.3} />

        {/* ECS detail drill-down */}
        <DiagramNode
          id="ecs"
          label="ECS Cluster"
          icon="aws:ecs"
          position={[0.324, 0.639, -5]}
          thickness={0.8}
          color="#1a3d5c"
          size={[0.353, 0.167]}
        />
        <DiagramNode id="svc-auth"   label="Auth Service" position={[0.088, 0.528, 8]}  color="#0d3d2b" size={[0.235, 0.111]} />
        <DiagramNode id="svc-api"    label="API Service"  position={[0.324, 0.528, 8]}  color="#0d3d2b" size={[0.235, 0.111]} />
        <DiagramNode id="svc-worker" label="Worker"       position={[0.559, 0.528, 8]}  color="#0d3d2b" size={[0.235, 0.111]} />

        <DiagramEdge from="ecs"      to="svc-auth"   flow="forward" />
        <DiagramEdge from="ecs"      to="svc-api"    flow="forward" />
        <DiagramEdge from="ecs"      to="svc-worker" flow="forward" />
        <DiagramEdge from="svc-api"  to="rds"        flow="forward" />
        <DiagramEdge from="svc-auth" to="cache"      flow="forward" />
      </Diagram>

    {/* Right-aligned overlay: eyebrow + headline + snippet + body */}
    <div key="arch-detail-overlay" style={{ position: 'absolute', bottom: '8%', right: '5%', textAlign: 'right', maxWidth: 340 }}>
      <div style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10,
        letterSpacing: '0.3em',
        textTransform: 'uppercase',
        color: 'rgba(0,245,255,0.55)',
        marginBottom: 12,
      }}>
        Drill down. Stay in the scene.
      </div>
      <div style={{
        fontSize: 'clamp(18px, 2.5vw, 22px)',
        fontWeight: 600,
        color: '#f0f6fc',
        lineHeight: 1.35,
        marginBottom: 16,
      }}>
        Click a group.<br />Zoom to the detail.<br />Ghost the rest.
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
        maxWidth: 340,
        margin: '0 0 14px',
        textAlign: 'left',
        whiteSpace: 'pre-wrap',
      }}>
        {snippetCode}
      </pre>
      <div style={{ fontSize: 'clamp(14px, 1.8vw, 16px)', color: 'rgba(240,246,252,0.65)', lineHeight: 1.6 }}>
        The context stays visible. The focus shifts.<br />
        One scene system. Infinite depth.
      </div>
    </div>
  </Scene>
);

import type { JSX } from 'react';
import { Scene, Camera, Lighting, Ambient, Directional, ProgressManager } from '@brewsite/core';
import { DiagramCanvas, Diagram, DiagramNode, DiagramEdge, ManualLayout, neonCyberTheme } from '@brewsite/diagram';
import { MidFade, ScrollOn } from '@brewsite/core/hud/animejs';
import { isMobile } from '../../utils/viewport';
import type { Vec3 } from '@brewsite/core';
import { dwellFn } from '../../utils/pacing';

const LATE_FADE = { exit: [1.0, 1.0] as [number, number], enter: [1.0, 1.0] as [number, number] };

const snippetCode = `<DiagramNode id="api"   label="API Gateway" icon="aws:api-gateway" position={[0.500, 0.500, 0]} />
<DiagramNode id="db"    label="PostgreSQL"  icon="aws:rds"         position={[0.167, 0.864, 0]} />
<DiagramNode id="cache" label="Redis"       icon="aws:elasticache" position={[0.833, 0.864, 0]} />
<DiagramEdge from="api" to="db"    label="SQL"   flow="forward" />
<DiagramEdge from="api" to="cache" label="Cache" flow="forward" />`;

export const scene01SimpleDiagram: JSX.Element = (
  <Scene id="website-diagram-simple" transition={LATE_FADE}>
    <ProgressManager
      scrollUnits={1800}
      fn={dwellFn}
      autoAdvance={{ duration: 7, max: 0.85, pauseOnScroll: true }}
    />
    <Camera
      mode="world"
      position={(isMobile ? [0, 10, 30] : [0, 8, 40]) as Vec3}
      target={[0, 0, 0]}
      fov={isMobile ? 65 : 55}
    />

    <Lighting intensityScale={1}>
      <Ambient intensity={1.0} color="#ffffff" />
      <Directional intensity={0.5} color="#aaccff" position={[0, 20, 30]} />
      <Directional intensity={0.3} color="#00aaff" position={[-10, 10, 10]} />
    </Lighting>
    <DiagramCanvas
      id="simple-tech-stack"
      rotation={[-Math.PI / 12, 0, 0]}
      scale={isMobile ? 1.0 : 1.3}
      theme={neonCyberTheme}
    >
      <Diagram id="tech-stack">
        <ManualLayout />
        <DiagramNode id="frontend" label="React App"   icon="ui:globe-alt"    position={[0.500, 0.136, 0]} />
        <DiagramNode id="api"      label="API Gateway" icon="aws:api-gateway"  position={[0.500, 0.500, 0]} />
        <DiagramNode id="db"       label="PostgreSQL"  icon="aws:rds"          position={[0.167, 0.864, 0]} />
        <DiagramNode id="cache"    label="Redis"       icon="aws:elasticache"  position={[0.833, 0.864, 0]} />

        <DiagramEdge from="frontend" to="api"   label="REST"  flow="forward" />
        <DiagramEdge from="api"      to="db"    label="SQL"   flow="forward" />
        <DiagramEdge from="api"      to="cache" label="Cache" flow="forward" style="dashed" />
      </Diagram>
    </DiagramCanvas>
    <div style={{ position: 'absolute', bottom: '10%', left: '5%', maxWidth: 420 }}>
      <MidFade duration={1300}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          color: 'rgba(0,245,255,0.6)',
          marginBottom: 10,
        }}>
          @brewsite/diagram
        </div>
        <div style={{ fontSize: 'clamp(20px, 3vw, 24px)', fontWeight: 600, color: '#f0f6fc', marginBottom: 16, lineHeight: 1.25 }}>
          Your architecture slide,<br />in a scene.
        </div>
      </MidFade>
      <ScrollOn duration={700} delay={100}>
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
      </ScrollOn>
      <ScrollOn duration={900} delay={200}>
        <div style={{ fontSize: 'clamp(13px, 1.6vw, 14px)', color: 'rgba(240,246,252,0.6)', lineHeight: 1.65 }}>
          Declare nodes and edges in JSX.<br />
          20+ icon namespaces. Auto-layout. Routed edges.
        </div>
      </ScrollOn>
    </div>
  </Scene>
);

import type { JSX } from 'react';
import { Scene, Camera, Lighting, Ambient, Directional } from '@brewsite/core';
import { DiagramCanvas, Diagram, DiagramNode, DiagramEdge, ManualLayout, neonCyberTheme } from '@brewsite/diagram';
import { MidFade, SlideUp } from '@brewsite/core/hud/animejs';

export const scene01SimpleDiagram: JSX.Element = (
  <Scene id="website-diagram-simple">
    <Camera mode="world" position={[0, 8, 40]} target={[0, 0, 0]} fov={55} />

    <Lighting intensityScale={1}>
      <Ambient intensity={1.0} color="#ffffff" />
      <Directional intensity={0.5} color="#aaccff" position={[0, 20, 30]} />
      <Directional intensity={0.3} color="#00aaff" position={[-10, 10, 10]} />
    </Lighting>
    <DiagramCanvas
      id="simple-tech-stack"
      rotation={[-Math.PI / 12, 0, 0]}
      scale={1.3}
      theme={neonCyberTheme}
    >
      <Diagram id="tech-stack" pivot="center">
        <ManualLayout />
        <DiagramNode id="frontend" label="React App"   icon="ui:globe-alt"    position={[0, 4, 0]} />
        <DiagramNode id="api"      label="API Gateway" icon="aws:api-gateway"  position={[0, 0, 0]} />
        <DiagramNode id="db"       label="PostgreSQL"  icon="aws:rds"          position={[-3, -4, 0]} />
        <DiagramNode id="cache"    label="Redis"       icon="aws:elasticache"  position={[3, -4, 0]} />

        <DiagramEdge from="frontend" to="api"   label="REST"  flow="forward" />
        <DiagramEdge from="api"      to="db"    label="SQL"   flow="forward" />
        <DiagramEdge from="api"      to="cache" label="Cache" flow="forward" style="dashed" />
      </Diagram>
    </DiagramCanvas>
    <div style={{ position: 'absolute', bottom: '10%', left: '5%', maxWidth: 360 }}>
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
        <div style={{ fontSize: 24, fontWeight: 600, color: '#f0f6fc', marginBottom: 12 }}>
          From whiteboard<br />to 3D in JSX.
        </div>
      </MidFade>
      <SlideUp duration={900} delay={150}>
        <div style={{ fontSize: 14, color: 'rgba(240,246,252,0.6)', lineHeight: 1.65 }}>
          Themes, icons, routed edges, groups. No Figma required.
        </div>
      </SlideUp>
    </div>
  </Scene>
);

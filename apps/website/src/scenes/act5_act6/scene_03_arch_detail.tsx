import type { JSX } from 'react';
import { Scene, Camera, Lighting, Ambient, Directional, ProgressManager } from '@brewsite/core';
import { DiagramCanvas, Diagram, DiagramEdge, DiagramNode, Enter, ManualLayout, darkGlassTheme } from '@brewsite/diagram';
import { SlideUp } from '@brewsite/core/hud/animejs';

export const scene03ArchDetail: JSX.Element = (
  <Scene id="website-arch-detail">
    <ProgressManager
      scrollUnits={1800}
      autoAdvance={{ duration: 7, max: 0.85, pauseOnScroll: true }}
    />
    <Camera mode="world" fov={55} position={[0, 8, 45]} target={[0, -5, 0]} />

    <Lighting intensityScale={1}>
      <Ambient intensity={1.0} color="#ffffff" />
      <Directional intensity={0.6} color="#aaccff" position={[-20, 10, 20]} />
    </Lighting>
    <DiagramCanvas id="system-canvas" rotation={[-Math.PI / 12, 0, 0]} scale={1.4} theme={darkGlassTheme}>
      <Diagram id="system-arch" pivot="center">
        <ManualLayout />
        <Enter from={[-60, 0, 0]} fade easing="ease-in" />

        {/* Ghost nodes from previous scene */}
        <DiagramNode id="cdn"    position={[0, 2, -25]}   opacity={0.3} />
        <DiagramNode id="alb"    position={[0, -1, -25]}  opacity={0.3} />
        <DiagramNode id="api"    position={[0, -4, -25]}  opacity={0.3} />
        <DiagramNode id="lambda" position={[5, -8, -25]}  opacity={0.3} />
        <DiagramNode id="rds"    position={[-5, -13, -25]} opacity={0.3} />
        <DiagramNode id="cache"  position={[0, -13, -25]} opacity={0.3} />
        <DiagramNode id="s3"     position={[5, -13, -25]} opacity={0.3} />

        {/* ECS detail drill-down */}
        <DiagramNode
          id="ecs"
          label="ECS Cluster"
          icon="aws:ecs"
          position={[-5, -8, -5]}
          depth={0.8}
          color="#1a3d5c"
          size={[6, 3]}
        />
        <DiagramNode id="svc-auth"   label="Auth Service" position={[-9, -6, 8]}  color="#0d3d2b" size={[4, 2]} />
        <DiagramNode id="svc-api"    label="API Service"  position={[-5, -6, 8]}  color="#0d3d2b" size={[4, 2]} />
        <DiagramNode id="svc-worker" label="Worker"       position={[-1, -6, 8]}  color="#0d3d2b" size={[4, 2]} />

        <DiagramEdge from="ecs"      to="svc-auth"   flow="forward" />
        <DiagramEdge from="ecs"      to="svc-api"    flow="forward" />
        <DiagramEdge from="ecs"      to="svc-worker" flow="forward" />
        <DiagramEdge from="svc-api"  to="rds"        flow="forward" />
        <DiagramEdge from="svc-auth" to="cache"      flow="forward" />
      </Diagram>
    </DiagramCanvas>
    <div style={{ position: 'absolute', bottom: '8%', right: '5%', textAlign: 'right', maxWidth: 340 }}>
      <SlideUp duration={1100}>
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
      </SlideUp>
      <SlideUp duration={1000} delay={100}>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#f0f6fc', lineHeight: 1.35 }}>
          DiagramGroups · Focus Regions<br />· Theme System
        </div>
      </SlideUp>
    </div>
  </Scene>
);
